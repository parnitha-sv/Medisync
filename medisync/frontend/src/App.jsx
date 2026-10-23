
import { useEffect, useState } from "react";
import "./App.css";

const API_URL = "http://localhost:5000/api";

const initialPatients = [
  { id: "p1", name: "Asha Kumar", email: "asha@gmail.com" },
  { id: "p2", name: "Sunitha Rao", email: "sunitha@gmail.com" },
  { id: "p3", name: "Shreya Sharma", email: "shreya08@gmail.com" },
];

const initialPrescriptions = [
  {
    id: "rx1",
    patientId: "p1",
    patientName: "Asha Kumar",
    medication: "Prescription awaiting doctor entry",
    dosage: "—",
    frequency: "—",
    instructions: "Your prescriptions will appear here when added by your doctor.",
    startDate: "",
    endDate: "",
    status: "Active",
  },
];

function getSavedUser() {
  try {
    return JSON.parse(localStorage.getItem("medisync_user") || "null");
  } catch {
    return null;
  }
}

function App() {
  const [user, setUser] = useState(getSavedUser);
  const [mode, setMode] = useState("login");
  const [role, setRole] = useState("patient");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [authError, setAuthError] = useState("");
  const [authMessage, setAuthMessage] = useState("");
  const [loading, setLoading] = useState(false);

  const [patients] = useState(initialPatients);
  const [selectedPatientId, setSelectedPatientId] = useState("p1");
  const [prescriptions, setPrescriptions] = useState(initialPrescriptions);
  const [showPrescriptionForm, setShowPrescriptionForm] = useState(false);
  const [search, setSearch] = useState("");
  const [notice, setNotice] = useState("");

  const [prescriptionForm, setPrescriptionForm] = useState({
    medication: "",
    dosage: "",
    frequency: "",
    instructions: "",
    startDate: "",
    endDate: "",
  });

  useEffect(() => {
    const savedUser = getSavedUser();
    if (savedUser) setUser(savedUser);
  }, []);

  const isDoctor = user?.role?.toLowerCase() === "doctor";

  async function handleAuth(event) {
    event.preventDefault();
    setAuthError("");
    setAuthMessage("");

    if (mode === "register" && password !== confirmPassword) {
      setAuthError("Passwords do not match.");
      return;
    }

    if (mode === "register" && !name.trim()) {
      setAuthError("Please enter your full name.");
      return;
    }

    setLoading(true);

    try {
      const endpoint =
        mode === "register" ? "/auth/register" : "/auth/login";

      const payload =
        mode === "register"
          ? {
              name: name.trim(),
              email: email.trim(),
              password,
              role,
            }
          : {
              email: email.trim(),
              password,
              role,
            };

      const response = await fetch(`${API_URL}${endpoint}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const data = await response.json().catch(() => ({}));

      if (!response.ok) {
        throw new Error(data.message || data.error || "Unable to continue. Please check your details.");
      }

      if (mode === "register") {
        setAuthMessage("Account created successfully. You can now log in.");
        setMode("login");
        setPassword("");
        setConfirmPassword("");
      } else {
        const loggedInUser = {
          id: data.user?.id,
          name: data.user?.name || data.user?.full_name || name || email.split("@")[0],
          email: data.user?.email || email,
          role: data.user?.role || role,
        };

        localStorage.setItem("medisync_token", data.token);
        localStorage.setItem("medisync_user", JSON.stringify(loggedInUser));
        setUser(loggedInUser);
        setNotice("");
      }
    } catch (error) {
      setAuthError(
        error.message === "Failed to fetch"
          ? "Cannot connect to the backend. Make sure your backend server is running."
          : error.message
      );
    } finally {
      setLoading(false);
    }
  }

  function logout() {
    localStorage.removeItem("medisync_token");
    localStorage.removeItem("medisync_user");
    setUser(null);
    setMode("login");
    setPassword("");
    setConfirmPassword("");
    setNotice("");
  }

  function updatePrescriptionField(event) {
    const { name: field, value } = event.target;
    setPrescriptionForm((current) => ({ ...current, [field]: value }));
  }

  function addPrescription(event) {
    event.preventDefault();

    if (!selectedPatientId) {
      setNotice("Please select a patient.");
      return;
    }

    const selectedPatient = patients.find(
      (patient) => patient.id === selectedPatientId
    );

    if (!prescriptionForm.medication.trim() || !prescriptionForm.dosage.trim()) {
      setNotice("Medication name and dosage are required.");
      return;
    }

    const newPrescription = {
      ...prescriptionForm,
      id: `rx-${Date.now()}`,
      patientId: selectedPatientId,
      patientName: selectedPatient?.name || "Patient",
      status: "Active",
    };

    setPrescriptions((current) => [newPrescription, ...current]);
    setPrescriptionForm({
      medication: "",
      dosage: "",
      frequency: "",
      instructions: "",
      startDate: "",
      endDate: "",
    });
    setShowPrescriptionForm(false);
    setNotice("Prescription added to the current session.");
  }

  function changePrescriptionStatus(id, status) {
    setPrescriptions((current) =>
      current.map((prescription) =>
        prescription.id === id ? { ...prescription, status } : prescription
      )
    );
  }

  if (!user) {
    return (
      <div className="auth-page">
        <section className="auth-brand">
          <div className="brand-logo">
            <span className="brand-symbol">✚</span>
            <span>MediSync</span>
          </div>

          <div className="brand-content">
            <span className="eyebrow">CONNECTED CARE, SIMPLIFIED</span>
            <h1>Better coordination.<br />Healthier tomorrows.</h1>
            <p>
              One connected space for patients and doctors to coordinate
              prescriptions and medication care.
            </p>

            <div className="brand-points">
              <div><span>✓</span> Clear prescription records</div>
              <div><span>✓</span> Patient-focused care</div>
              <div><span>✓</span> Connected doctor workflows</div>
            </div>
          </div>

          <div className="brand-footer">Your care, connected.</div>
        </section>

        <section className="auth-panel">
          <div className="auth-card">
            <div className="mobile-brand brand-logo">
              <span className="brand-symbol">✚</span>
              <span>MediSync</span>
            </div>

            <span className="eyebrow">{mode === "login" ? "WELCOME BACK" : "GET STARTED"}</span>
            <h2>{mode === "login" ? "Sign in to MediSync" : "Create your account"}</h2>
            <p className="muted">
              {mode === "login"
                ? "Enter your details to access your workspace."
                : "Set up your account to get started."}
            </p>

            <div className="role-switch" aria-label="Account type">
              <button
                type="button"
                className={role === "patient" ? "selected" : ""}
                onClick={() => setRole("patient")}
              >
                <span>♡</span> Patient
              </button>
              <button
                type="button"
                className={role === "doctor" ? "selected" : ""}
                onClick={() => setRole("doctor")}
              >
                <span>✚</span> Doctor
              </button>
            </div>

            <form onSubmit={handleAuth} className="auth-form">
              {mode === "register" && (
                <label>
                  Full name
                  <input
                    value={name}
                    onChange={(event) => setName(event.target.value)}
                    placeholder="Enter your full name"
                    autoComplete="name"
                    required
                  />
                </label>
              )}

              <label>
                Email address
                <input
                  type="email"
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                  placeholder="you@example.com"
                  autoComplete="email"
                  required
                />
              </label>

              <label>
                Password
                <input
                  type="password"
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  placeholder="Enter your password"
                  autoComplete={mode === "login" ? "current-password" : "new-password"}
                  required
                />
              </label>

              {mode === "register" && (
                <label>
                  Confirm password
                  <input
                    type="password"
                    value={confirmPassword}
                    onChange={(event) => setConfirmPassword(event.target.value)}
                    placeholder="Re-enter your password"
                    autoComplete="new-password"
                    required
                  />
                </label>
              )}

              {authError && <div className="alert error">{authError}</div>}
              {authMessage && <div className="alert success">{authMessage}</div>}

              <button className="primary-button" type="submit" disabled={loading}>
                {loading
                  ? "Please wait..."
                  : mode === "login"
                    ? "Sign in"
                    : "Create account"}
                {!loading && <span>→</span>}
              </button>
            </form>

            <p className="auth-switch">
              {mode === "login" ? "New to MediSync?" : "Already have an account?"}{" "}
              <button
                type="button"
                onClick={() => {
                  setMode(mode === "login" ? "register" : "login");
                  setAuthError("");
                  setAuthMessage("");
                }}
              >
                {mode === "login" ? "Create an account" : "Sign in"}
              </button>
            </p>

            <p className="security-note">🔒 Your health journey deserves care and privacy.</p>
          </div>
        </section>
      </div>
    );
  }

  const patientPrescriptions = prescriptions.filter(
    (prescription) => prescription.patientId === selectedPatientId
  );

  const visiblePrescriptions = isDoctor
    ? prescriptions.filter((prescription) =>
        `${prescription.medication} ${prescription.patientName}`
          .toLowerCase()
          .includes(search.toLowerCase())
      )
    : prescriptions.filter((prescription) => prescription.patientId === "p1");

  const activeCount = visiblePrescriptions.filter(
    (prescription) => prescription.status === "Active"
  ).length;

  return (
    <div className="dashboard-layout">
      <aside className="sidebar">
        <div className="brand-logo sidebar-logo">
          <span className="brand-symbol">✚</span>
          <span>MediSync</span>
        </div>

        <div className="sidebar-label">WORKSPACE</div>
        <div className="nav-item active">
          <span>▦</span> Dashboard
        </div>
        <div className="nav-item">
          <span>▤</span> Prescriptions
        </div>
        <div className="nav-item">
          <span>◷</span> Medication schedule
        </div>
        <div className="nav-item">
          <span>♡</span> Care coordination
        </div>

        <div className="sidebar-bottom">
          <div className="help-card">
            <div className="help-icon">✚</div>
            <strong>Care starts here</strong>
            <p>Keep your medication information organized.</p>
          </div>
          <button className="logout-button" onClick={logout}>
            <span>↪</span> Log out
          </button>
        </div>
      </aside>

      <main className="dashboard-main">
        <header className="topbar">
          <div>
            <div className="breadcrumb">MediSync / Dashboard</div>
            <div className="topbar-title">
              {isDoctor ? "Doctor workspace" : "Patient workspace"}
            </div>
          </div>
          <div className="profile">
            <div className="profile-avatar">
              {(user.name || "U").charAt(0).toUpperCase()}
            </div>
            <div className="profile-details">
              <strong>{user.name}</strong>
              <span>{isDoctor ? "Doctor" : "Patient"}</span>
            </div>
          </div>
        </header>

        <div className="dashboard-content">
          <div className="welcome-row">
            <div>
              <span className="eyebrow">YOUR HEALTH, IN SYNC</span>
              <h1>{isDoctor ? `Welcome, Dr. ${user.name}` : `Welcome, ${user.name}`}</h1>
              <p>
                {isDoctor
                  ? "Manage patient prescriptions and coordinate care."
                  : "Your medication information and care plan, all in one place."}
              </p>
            </div>

            {isDoctor && (
              <button
                className="primary-button compact"
                onClick={() => {
                  setShowPrescriptionForm((current) => !current);
                  setNotice("");
                }}
              >
                <span>＋</span> Add prescription
              </button>
            )}
          </div>

          {notice && (
            <div className="alert success notice">
              {notice}
              <button onClick={() => setNotice("")} aria-label="Dismiss">×</button>
            </div>
          )}

          <div className="stats-grid">
            <div className="stat-card">
              <div className="stat-icon lavender">▤</div>
              <div><span>{isDoctor ? "Prescriptions entered" : "My prescriptions"}</span><strong>{visiblePrescriptions.length}</strong></div>
              <span className="stat-caption">In this session</span>
            </div>
            <div className="stat-card">
              <div className="stat-icon mint">✓</div>
              <div><span>Active prescriptions</span><strong>{activeCount}</strong></div>
              <span className="stat-caption">Currently active</span>
            </div>
            <div className="stat-card">
              <div className="stat-icon peach">{isDoctor ? "♙" : "♡"}</div>
              <div><span>{isDoctor ? "Available patients" : "Care status"}</span><strong>{isDoctor ? patients.length : "On track"}</strong></div>
              <span className="stat-caption">{isDoctor ? "Frontend preview" : "Stay connected to your doctor"}</span>
            </div>
          </div>

          {isDoctor && showPrescriptionForm && (
            <section className="content-card prescription-editor">
              <div className="section-heading">
                <div>
                  <h2>New prescription</h2>
                  <p>Enter the medication details for a patient.</p>
                </div>
                <button className="icon-button" onClick={() => setShowPrescriptionForm(false)}>×</button>
              </div>

              <form onSubmit={addPrescription}>
                <div className="form-grid">
                  <label className="full-field">
                    Select patient
                    <select
                      value={selectedPatientId}
                      onChange={(event) => setSelectedPatientId(event.target.value)}
                      required
                    >
                      {patients.map((patient) => (
                        <option key={patient.id} value={patient.id}>
                          {patient.name} — {patient.email}
                        </option>
                      ))}
                    </select>
                  </label>

                  <label>
                    Medication name *
                    <input
                      name="medication"
                      value={prescriptionForm.medication}
                      onChange={updatePrescriptionField}
                      placeholder="Enter medication name"
                      required
                    />
                  </label>
                  <label>
                    Dosage *
                    <input
                      name="dosage"
                      value={prescriptionForm.dosage}
                      onChange={updatePrescriptionField}
                      placeholder="e.g. as prescribed"
                      required
                    />
                  </label>
                  

<label>
  Frequency per day
  <select
    name="frequency"
    value={prescriptionForm.frequency}
    onChange={updatePrescriptionField}
    required
  >
    <option value="">Select frequency</option>
    <option value="Once a day">Once a day</option>
    <option value="Twice a day">Twice a day</option>
    <option value="Three times a day">Three times a day</option>
    <option value="Four times a day">Four times a day</option>
  </select>
</label>



<label>
  Scheduled times
  <div className="frequency-times">
    {["Morning", "Afternoon", "Evening", "Bedtime"].map((time) => {
      const selectedTimes = prescriptionForm.frequencyTimes || [];

      const frequencyLimit = {
        "Once a day": 1,
        "Twice a day": 2,
        "Three times a day": 3,
        "Four times a day": 4,
      }[prescriptionForm.frequency] || 0;

      const isSelected = selectedTimes.includes(time);
      const limitReached = selectedTimes.length >= frequencyLimit;

      return (
        <label key={time} className="frequency-option">
          <input
            type="checkbox"
            checked={isSelected}
            disabled={!isSelected && limitReached}
            onChange={(event) => {
              setPrescriptionForm((current) => ({
                ...current,
                frequencyTimes: event.target.checked
                  ? [...(current.frequencyTimes || []), time]
                  : (current.frequencyTimes || []).filter(
                      (item) => item !== time
                    ),
              }));
            }}
          />
          {time}
        </label>
      );
    })}
  </div>
</label>

                  <label>
                    Start date
                    <input
                      type="date"
                      name="startDate"
                      value={prescriptionForm.startDate}
                      onChange={updatePrescriptionField}
                    />
                  </label>
                  <label>
                    End date
                    <input
                      type="date"
                      name="endDate"
                      value={prescriptionForm.endDate}
                      onChange={updatePrescriptionField}
                    />
                  </label>
                  <label className="full-field">
                    Instructions
                    <textarea
                      name="instructions"
                      value={prescriptionForm.instructions}
                      onChange={updatePrescriptionField}
                      placeholder="Enter the doctor's instructions"
                      rows="3"
                    />
                  </label>
                </div>
                <div className="form-actions">
                  <button type="button" className="secondary-button" onClick={() => setShowPrescriptionForm(false)}>Cancel</button>
                  <button type="submit" className="primary-button compact">Save prescription</button>
                </div>
              </form>
            </section>
          )}

          {isDoctor && (
            <section className="content-card patient-selector">
              <div>
                <h2>Patient overview</h2>
                <p>Select a patient to view their prescriptions in this session.</p>
              </div>
              <label className="selector-field">
                <span>Patient</span>
                <select
                  value={selectedPatientId}
                  onChange={(event) => setSelectedPatientId(event.target.value)}
                >
                  {patients.map((patient) => (
                    <option key={patient.id} value={patient.id}>{patient.name}</option>
                  ))}
                </select>
              </label>
              <div className="patient-summary">
                <div className="patient-avatar">
                  {patients.find((p) => p.id === selectedPatientId)?.name.charAt(0)}
                </div>
                <div>
                  <strong>{patients.find((p) => p.id === selectedPatientId)?.name}</strong>
                  <span>{patients.find((p) => p.id === selectedPatientId)?.email}</span>
                </div>
                <span className="status-pill">Patient record</span>
              </div>
            </section>
          )}

          <section className="content-card">
            <div className="section-heading">
              <div>
                <h2>{isDoctor ? "Prescription records" : "My prescriptions"}</h2>
                <p>
                  {isDoctor
                    ? "Review medication records for the selected patient."
                    : "Review the medication details entered for your care."}
                </p>
              </div>
              {isDoctor && (
                <input
                  className="search-input"
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                  placeholder="Search records..."
                  aria-label="Search prescriptions"
                />
              )}
            </div>

            {isDoctor ? (
              <div className="prescription-list">
                {prescriptions
                  .filter((prescription) => prescription.patientId === selectedPatientId)
                  .filter((prescription) =>
                    `${prescription.medication} ${prescription.patientName}`
                      .toLowerCase()
                      .includes(search.toLowerCase())
                  )
                  .map((prescription) => (
                    <PrescriptionCard
                      key={prescription.id}
                      prescription={prescription}
                      doctorView
                      onStatusChange={changePrescriptionStatus}
                    />
                  ))}
                {prescriptions.filter((p) => p.patientId === selectedPatientId).filter((p) =>
                  `${p.medication} ${p.patientName}`.toLowerCase().includes(search.toLowerCase())
                ).length === 0 && (
                  <EmptyState
                    title="No prescriptions yet"
                    description="Add a prescription for this patient to see it here."
                    action="Add prescription"
                    onAction={() => setShowPrescriptionForm(true)}
                  />
                )}
              </div>
            ) : (
              <div className="prescription-list">
                {visiblePrescriptions.map((prescription) => (
                  <PrescriptionCard key={prescription.id} prescription={prescription} />
                ))}
                {visiblePrescriptions.length === 0 && (
                  <EmptyState
                    title="No prescriptions yet"
                    description="When your doctor adds a prescription, it will appear here."
                  />
                )}
              </div>
            )}
          </section>

          {!isDoctor && (
            <section className="reminder-banner">
              <div className="reminder-symbol">♡</div>
              <div>
                <strong>Stay informed about your medications</strong>
                <p>Follow your doctor's instructions. Contact your healthcare professional if you have questions about a prescription.</p>
              </div>
            </section>
          )}

          <footer className="dashboard-footer">
            <span>© {new Date().getFullYear()} MediSync</span>
            <span>Connected care, simplified.</span>
          </footer>
        </div>
      </main>
    </div>
  );
}

function PrescriptionCard({ prescription, doctorView = false, onStatusChange }) {
  return (
    <article className="prescription-card">
      <div className="medication-symbol">✚</div>
      <div className="prescription-details">
        <div className="medication-title-row">
          <h3>{prescription.medication}</h3>
          <span className={`status-pill ${prescription.status === "Completed" ? "completed" : ""}`}>
            {prescription.status}
          </span>
        </div>
        {doctorView && <p className="patient-name">Patient: {prescription.patientName}</p>}
        <div className="medication-meta">
          <span><b>Dosage</b>{prescription.dosage}</span>
          <span><b>Frequency</b>{prescription.frequency || "Not specified"}</span>
        </div>
        {prescription.instructions && (
          <p className="medication-instructions">{prescription.instructions}</p>
        )}
        {(prescription.startDate || prescription.endDate) && (
          <p className="date-range">
            {prescription.startDate || "Start date not set"} — {prescription.endDate || "End date not set"}
          </p>
        )}
        {doctorView && onStatusChange && (
          <div className="record-actions">
            <button
              className="secondary-button small"
              onClick={() =>
                onStatusChange(
                  prescription.id,
                  prescription.status === "Active" ? "Completed" : "Active"
                )
              }
            >
              Mark {prescription.status === "Active" ? "completed" : "active"}
            </button>
          </div>
        )}
      </div>
    </article>
  );
}

function EmptyState({ title, description, action, onAction }) {
  return (
    <div className="empty-state">
      <div className="empty-icon">▤</div>
      <h3>{title}</h3>
      <p>{description}</p>
      {action && onAction && (
        <button className="secondary-button" onClick={onAction}>{action}</button>
      )}
    </div>
  );
}

export default App;
