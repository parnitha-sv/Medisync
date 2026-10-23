
require("dotenv").config();

const express = require("express");
const cors = require("cors");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const { Pool } = require("pg");

const app = express();
const PORT = process.env.PORT || 5000;

if (!process.env.DATABASE_URL || !process.env.JWT_SECRET) {
  console.error("Missing DATABASE_URL or JWT_SECRET in backend/.env");
  process.exit(1);
}

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

app.use(
  cors({
    origin: [
      "http://localhost:5173",
      "http://localhost:5174",
      "http://localhost:5175",
    ],
  })
);

app.use(express.json());

app.get("/", (req, res) => {
  res.json({ message: "MediSync backend is running" });
});

app.get("/api/health", async (req, res) => {
  try {
    await pool.query("SELECT 1");
    res.json({ status: "ok", database: "connected" });
  } catch (error) {
    console.error("Database health check failed:", error.message);
    res.status(503).json({
      status: "error",
      database: "unavailable",
    });
  }
});

// Verify the JWT on protected endpoints.
function authenticateToken(req, res, next) {
  const authorization = req.headers.authorization || "";
  const [scheme, token] = authorization.split(" ");

  if (scheme !== "Bearer" || !token) {
    return res.status(401).json({ message: "Please sign in first." });
  }

  try {
    req.auth = jwt.verify(token, process.env.JWT_SECRET);
    next();
  } catch {
    return res.status(401).json({
      message: "Your session has expired. Please sign in again.",
    });
  }
}

function requireRole(role) {
  return (req, res, next) => {
    if (req.auth.role !== role) {
      return res.status(403).json({
        message: `Access restricted to ${role} accounts.`,
      });
    }
    next();
  };
}

// Register an account.
app.post("/api/auth/register", async (req, res) => {
  try {
    const { name, email, password, role } = req.body;

    if (
      typeof name !== "string" ||
      !name.trim() ||
      typeof email !== "string" ||
      !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim()) ||
      typeof password !== "string" ||
      password.length < 8 ||
      !["patient", "doctor"].includes(role)
    ) {
      return res.status(400).json({
        message:
          "Provide a name, valid email, password of at least 8 characters, and patient or doctor role.",
      });
    }

    const passwordHash = await bcrypt.hash(password, 12);

    const result = await pool.query(
      `INSERT INTO users (full_name, email, password_hash, role)
       VALUES ($1, $2, $3, $4)
       RETURNING id, full_name, email, role`,
      [name.trim(), email.trim().toLowerCase(), passwordHash, role]
    );

    const created = result.rows[0];

    res.status(201).json({
      message: "Account created successfully.",
      user: {
        id: created.id,
        name: created.full_name,
        email: created.email,
        role: created.role,
      },
    });
  } catch (error) {
    if (error.code === "23505") {
      return res.status(409).json({
        message: "An account with this email already exists.",
      });
    }

    console.error("Registration error:", error.message);
    res.status(500).json({ message: "Unable to create account." });
  }
});

// Sign in.
app.post("/api/auth/login", async (req, res) => {
  try {
    const { email, password, role } = req.body;

    if (
      typeof email !== "string" ||
      typeof password !== "string" ||
      !["patient", "doctor"].includes(role)
    ) {
      return res.status(400).json({
        message: "Provide a valid email, password and account type.",
      });
    }

    const result = await pool.query(
      `SELECT id, full_name, email, password_hash, role
       FROM users
       WHERE email = $1`,
      [email.trim().toLowerCase()]
    );

    const user = result.rows[0];

    if (
      !user ||
      user.role !== role ||
      !(await bcrypt.compare(password, user.password_hash))
    ) {
      return res.status(401).json({
        message: "Invalid email, password or account type.",
      });
    }

    const token = jwt.sign(
      { sub: String(user.id), role: user.role },
      process.env.JWT_SECRET,
      { expiresIn: "1h" }
    );

    res.json({
      message: "Login successful.",
      token,
      user: {
        id: user.id,
        name: user.full_name,
        email: user.email,
        role: user.role,
      },
    });
  } catch (error) {
    console.error("Login error:", error.message);
    res.status(500).json({ message: "Unable to sign in." });
  }
});

// Return only patients assigned to the signed-in doctor.
app.get(
  "/api/doctor/patients",
  authenticateToken,
  requireRole("doctor"),
  async (req, res) => {
    try {
      const result = await pool.query(
        `SELECT u.id, u.full_name AS name, u.email
         FROM doctor_patients dp
         JOIN users u ON u.id = dp.patient_id
         WHERE dp.doctor_id = $1
           AND u.role = 'patient'
         ORDER BY u.full_name`,
        [req.auth.sub]
      );

      res.json({ patients: result.rows });
    } catch (error) {
      console.error("Patient list error:", error.message);
      res.status(500).json({ message: "Unable to load patients." });
    }
  }
);

// Create a prescription for a patient assigned to this doctor.
app.post(
  "/api/prescriptions",
  authenticateToken,
  requireRole("doctor"),
  async (req, res) => {
    try {
      const {
        patientId,
        medication,
        dosage,
        frequency,
        frequencyTimes = [],
        instructions = "",
        startDate = "",
        endDate = "",
      } = req.body;

      if (
        !patientId ||
        !Number.isInteger(Number(patientId)) ||
        typeof medication !== "string" ||
        !medication.trim() ||
        typeof dosage !== "string" ||
        !dosage.trim() ||
        typeof frequency !== "string" ||
        !frequency.trim() ||
        !Array.isArray(frequencyTimes) ||
        !frequencyTimes.every((time) =>
          ["Morning", "Afternoon", "Evening", "Bedtime"].includes(time)
        ) ||
        new Set(frequencyTimes).size !== frequencyTimes.length ||
        typeof instructions !== "string"
      ) {
        return res.status(400).json({
          message: "Please provide valid prescription details.",
        });
      }

      const frequencyLimits = {
        "Once a day": 1,
        "Twice a day": 2,
        "Three times a day": 3,
        "Four times a day": 4,
      };

      if (
        Object.hasOwn(frequencyLimits, frequency) &&
        frequencyTimes.length > 0 &&
        frequencyTimes.length !== frequencyLimits[frequency]
      ) {
        return res.status(400).json({
          message: "Select the appropriate number of scheduled times.",
        });
      }

      if (
        (startDate && !/^\d{4}-\d{2}-\d{2}$/.test(startDate)) ||
        (endDate && !/^\d{4}-\d{2}-\d{2}$/.test(endDate))
      ) {
        return res.status(400).json({
          message: "Dates must use YYYY-MM-DD format.",
        });
      }

      if (startDate && endDate && endDate < startDate) {
        return res.status(400).json({
          message: "End date cannot be before start date.",
        });
      }

      const assignment = await pool.query(
        `SELECT 1
         FROM doctor_patients
         WHERE doctor_id = $1 AND patient_id = $2`,
        [req.auth.sub, Number(patientId)]
      );

      if (assignment.rowCount === 0) {
        return res.status(403).json({
          message: "This patient is not assigned to your account.",
        });
      }

      const storedFrequency = frequencyTimes.length
        ? `${frequency} (${frequencyTimes.join(", ")})`
        : frequency;

      const result = await pool.query(
        `INSERT INTO prescriptions
          (patient_id, doctor_id, medication_name, dosage, frequency,
           instructions, start_date, end_date, status)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
         RETURNING *`,
        [
          Number(patientId),
          Number(req.auth.sub),
          medication.trim(),
          dosage.trim(),
          storedFrequency,
          instructions.trim(),
          startDate || null,
          endDate || null,
          "Active",
        ]
      );

      const row = result.rows[0];

      res.status(201).json({
        message: "Prescription saved successfully.",
        prescription: {
          id: row.id,
          patientId: row.patient_id,
          doctorId: row.doctor_id,
          medication: row.medication_name,
          dosage: row.dosage,
          frequency: row.frequency,
          instructions: row.instructions,
          startDate: row.start_date,
          endDate: row.end_date,
          status: row.status,
        },
      });
    } catch (error) {
      console.error("Create prescription error:", error.message);
      res.status(500).json({ message: "Unable to save prescription." });
    }
  }
);

// Patients see their own prescriptions.
// Doctors can see prescriptions for a patient assigned to them.
app.get("/api/prescriptions", authenticateToken, async (req, res) => {
  try {
    const { patientId } = req.query;
    let result;

    if (req.auth.role === "patient") {
      result = await pool.query(
        `SELECT id, patient_id, doctor_id, medication_name, dosage,
                frequency, instructions, start_date, end_date, status, created_at
         FROM prescriptions
         WHERE patient_id = $1
         ORDER BY created_at DESC`,
        [req.auth.sub]
      );
    } else if (req.auth.role === "doctor") {
      if (!patientId || !Number.isInteger(Number(patientId))) {
        return res.status(400).json({
          message: "Provide a valid patientId.",
        });
      }

      const assignment = await pool.query(
        `SELECT 1 FROM doctor_patients
         WHERE doctor_id = $1 AND patient_id = $2`,
        [req.auth.sub, Number(patientId)]
      );

      if (assignment.rowCount === 0) {
        return res.status(403).json({
          message: "This patient is not assigned to your account.",
        });
      }

      result = await pool.query(
        `SELECT id, patient_id, doctor_id, medication_name, dosage,
                frequency, instructions, start_date, end_date, status, created_at
         FROM prescriptions
         WHERE patient_id = $1 AND doctor_id = $2
         ORDER BY created_at DESC`,
        [Number(patientId), req.auth.sub]
      );
    } else {
      return res.status(403).json({ message: "Invalid account role." });
    }

    res.json({
      prescriptions: result.rows.map((row) => ({
        id: row.id,
        patientId: row.patient_id,
        doctorId: row.doctor_id,
        medication: row.medication_name,
        dosage: row.dosage,
        frequency: row.frequency,
        instructions: row.instructions,
        startDate: row.start_date,
        endDate: row.end_date,
        status: row.status,
        createdAt: row.created_at,
      })),
    });
  } catch (error) {
    console.error("Fetch prescriptions error:", error.message);
    res.status(500).json({ message: "Unable to load prescriptions." });
  }
});

app.listen(PORT, () => {
  console.log(`MediSync backend running at http://localhost:${PORT}`);
});
