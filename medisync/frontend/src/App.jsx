import DrugInteractionChecker from "./DrugInteractionChecker";
import { useEffect, useState } from "react";
import "./App.css";

const API_URL = "http://localhost:5000/api";


const INTERACTION_API_URL = "http://localhost:3001";

async function checkDrugPair(drugA, drugB) {
  const params = new URLSearchParams({
    drugA: drugA.trim(),
    drugB: drugB.trim(),
  });

  const response = await fetch(
    `${INTERACTION_API_URL}/api/interactions/check?${params}`
  );

  const data = await response.json();

  if (!response.ok) {
    throw new Error(
      data.message || "Unable to check drug interactions."
    );
  }

  return data;
}


function getSavedUser() {
  try {
    return JSON.parse(localStorage.getItem("medisync_user") || "null");
  } catch {
    return null;
  }
}

function getToken() {
  return localStorage.getItem("medisync_token");
}

function mapPrescription(row, patients = []) {
  const patient = patients.find(
    (item) => String(item.id) === String(row.patientId)
  );

  return {
    ...row,
    id: String(row.id),
    patientId: String(row.patientId),
    patientName: patient?.name || row.patientName || "Patient",
    medication: row.medication || row.medication_name || "",
    dosage: row.dosage || "",
    frequency: row.frequency || "",
    instructions: row.instructions || "",
    startDate: row.startDate
      ? String(row.startDate).slice(0, 10)
      : "",
    endDate: row.endDate ? String(row.endDate).slice(0, 10) : "",
    status: row.status || "Active",
  };
}

async function apiRequest(path, options = {}) {
  const token = getToken();

  const response = await fetch(`${API_URL}${path}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...options.headers,
    },
  });

  const data = await response.json().catch(() => ({}));

  if (response.status === 401) {
    localStorage.removeItem("medisync_token");
    localStorage.removeItem("medisync_user");
    window.location.reload();
    throw new Error("Your session expired. Please sign in again.");
  }

  if (!response.ok) {
    throw new Error(data.message || "The request could not be completed.");
  }

  return data;
}

function App() {
  const [user, setUser] = useState(getSavedUser);
  const [activePage, setActivePage] = useState("Dashboard");
  const [mode, setMode] = useState("login");
  const [role, setRole] = useState("patient");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [authError, setAuthError] = useState("");
  const [authMessage, setAuthMessage] = useState("");
  const [loading, setLoading] = useState(false);

  const [patients, setPatients] = useState([]);
  const [selectedPatientId, setSelectedPatientId] = useState("");
  const [prescriptions, setPrescriptions] = useState([
  {
    id: "prescription-001",
    patientId: "2",
    patientName: "Shreya",
    doctorName: "Dr.Ram",
    medicine: "Miconazole",
    dosage: "",
    frequency: "",
    duration: "",
    instructions: "Interaction check required.",
    status: "Active",
    createdAt: new Date().toISOString()
  },
  {
    id: "prescription-002",
    patientId: "2",
    patientName: "Shreya",
    doctorName: "Dr.Ram",
    medicine: "Tolinase",
    dosage: "",
    frequency: "",
    duration: "",
    instructions: "Interaction check required.",
    status: "Active",
    createdAt: new Date().toISOString()
  }
]);
  const [showPrescriptionForm, setShowPrescriptionForm] = useState(false);
  const [search, setSearch] = useState("");
  const [notice, setNotice] = useState("");
  const [workspaceLoading, setWorkspaceLoading] = useState(false);

  

  const isDoctor = user?.role?.toLowerCase() === "doctor";

  useEffect(() => {
    if (user && !getToken()) {
      localStorage.removeItem("medisync_user");
      setUser(null);
    }
  }, [user]);

  async function loadWorkspace(currentUser = user) {
    if (!currentUser || !getToken()) return;

    setWorkspaceLoading(true);
    setNotice("");

    try {
      if (currentUser.role.toLowerCase() === "doctor") {
        const patientData = await apiRequest("/doctor/patients");
        const loadedPatients = (patientData.patients || []).map((patient) => ({
          ...patient,
          id: String(patient.id),
        }));

        setPatients(loadedPatients);

        setSelectedPatientId((previous) => {
          if (loadedPatients.some((p) => p.id === previous)) return previous;
          return loadedPatients[0]?.id || "";
        });

        if (loadedPatients.length === 0) {
          setPrescriptions([]);
          setNotice(
            "No patients are assigned to your account yet. Ask an administrator to link a patient."
          );
        }
      } else {
        const data = await apiRequest("/prescriptions");
        setPrescriptions(
          (data.prescriptions || []).map((row) =>
            mapPrescription(row)
          )
        );
      }
    } catch (error) {
      setNotice(error.message || "Unable to load your dashboard.");
    } finally {
      setWorkspaceLoading(false);
    }
  }

  useEffect(() => {
    if (user && getToken()) {
      loadWorkspace(user);
    }
    // Load data when the logged-in account changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id, user?.role]);

  useEffect(() => {
    async function loadDoctorPrescriptions() {
      if (!user || !isDoctor || !selectedPatientId || !getToken()) {
        if (isDoctor) setPrescriptions([]);
        return;
      }

      try {
        const data = await apiRequest(
          `/prescriptions?patientId=${encodeURIComponent(selectedPatientId)}`
        );

        setPrescriptions(
          (data.prescriptions || []).map((row) =>
            mapPrescription(row, patients)
          )
        );
      } catch (error) {
        setNotice(error.message || "Unable to load prescriptions.");
      }
    }

    loadDoctorPrescriptions();
  }, [user?.id, user?.role, isDoctor, selectedPatientId, patients]);

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

    if (mode === "register" && password.length < 8) {
      setAuthError("Password must be at least 8 characters.");
      return;
    }

    setLoading(true);

    try {
      const endpoint =
        mode === "register" ? "/auth/register" : "/auth/login";

      const payload =
        mode === "register"
          ? { name: name.trim(), email: email.trim(), password, role }
          : { email: email.trim(), password, role };

      const response = await fetch(`${API_URL}${endpoint}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const data = await response.json().catch(() => ({}));

      if (!response.ok) {
        throw new Error(
          data.message || "Unable to continue. Please check your details."
        );
      }

      if (mode === "register") {
        setAuthMessage("Account created successfully. You can now sign in.");
        setMode("login");
        setPassword("");
        setConfirmPassword("");
      } else {
        const loggedInUser = {
          id: String(data.user.id),
          name: data.user.name || data.user.full_name || email.split("@")[0],
          email: data.user.email || email,
          role: data.user.role || role,
        };

        localStorage.setItem("medisync_token", data.token);
        localStorage.setItem("medisync_user", JSON.stringify(loggedInUser));

        setPatients([]);
        setPrescriptions([]);
        setSelectedPatientId("");
        setUser(loggedInUser);
        setNotice("");
      }
    } catch (error) {
      setAuthError(
        error.message === "Failed to fetch"
          ? "Cannot connect to the backend. Make sure the server is running on port 5000."
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
    setPatients([]);
    setPrescriptions([]);
    setSelectedPatientId("");
    setMode("login");
    setRole("patient");
    setName("");
    setEmail("");
    setPassword("");
    setConfirmPassword("");
    setNotice("");
    setShowPrescriptionForm(false);
  }

  function updatePrescriptionField(event) {
    const { name: field, value } = event.target;

    setPrescriptionForm((current) => ({
      ...current,
      [field]: value,
    }));
  }

  async function addPrescription(event) {
    event.preventDefault();
    setNotice("");

    if (!selectedPatientId) {
      setNotice("Please select an assigned patient.");
      return;
    }

    const selectedPatient = patients.find(
      (patient) => patient.id === selectedPatientId
    );

    if (!selectedPatient) {
      setNotice("The selected patient was not found.");
      return;
    }

    const {
      medication,
      dosage,
      frequency,
      frequencyTimes,
      instructions,
      startDate,
      endDate,
    } = prescriptionForm;

    if (!medication.trim() || !dosage.trim() || !frequency) {
      setNotice("Medication name, dosage and frequency are required.");
      return;
    }

    const frequencyLimits = {
      "Once a day": 1,
      "Twice a day": 2,
      "Three times a day": 3,
      "Four times a day": 4,
    };

    if (!Array.isArray(frequencyTimes) ||
        frequencyTimes.length !== frequencyLimits[frequency]) {
      setNotice(
        `Select exactly ${frequencyLimits[frequency]} scheduled time(s) for ${frequency.toLowerCase()}.`
      );
      return;
    }

    if (
      startDate &&
      endDate &&
      endDate < startDate
    ) {
      setNotice("End date cannot be before start date.");
      return;
    }

    setLoading(true);

    try {
      const data = await apiRequest("/prescriptions", {
        method: "POST",
        body: JSON.stringify({
          patientId: Number(selectedPatientId),
          medication: medication.trim(),
          dosage: dosage.trim(),
          frequency,
          frequencyTimes,
          instructions: instructions.trim(),
          startDate,
          endDate,
        }),
      });

      const savedPrescription = mapPrescription(
        data.prescription,
        patients
      );

      setPrescriptions((current) => [
        savedPrescription,
        ...current.filter((item) => item.id !== savedPrescription.id),
      ]);

      setPrescriptionForm({
        medication: "",
        dosage: "",
        frequency: "",
        frequencyTimes: [],
        instructions: "",
        startDate: "",
        endDate: "",
      });

      setShowPrescriptionForm(false);
      setNotice("Prescription saved successfully to the database.");
    } catch (error) {
      setNotice(error.message || "Unable to save prescription.");
    } finally {
      setLoading(false);
    }
  }

  function changePrescriptionStatus(id, status) {
    setNotice(
      "Status changes are not connected to the database yet. The saved status has not changed."
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

            <span className="eyebrow">
              {mode === "login" ? "WELCOME BACK" : "GET STARTED"}
            </span>
            <h2>
              {mode === "login"
                ? "Sign in to MediSync"
                : "Create your account"}
            </h2>
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
                  autoComplete={
                    mode === "login" ? "current-password" : "new-password"
                  }
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
              {mode === "login"
                ? "New to MediSync?"
                : "Already have an account?"}{" "}
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

            <p className="security-note">
              🔒 Your health journey deserves care and privacy.
            </p>
          </div>
        </section>
      </div>
    );
  }

  const visiblePrescriptions = isDoctor
    ? prescriptions.filter((prescription) =>
        `${prescription.medication} ${prescription.patientName}`
          .toLowerCase()
          .includes(search.toLowerCase())
      )
    : prescriptions;

  const activeCount = visiblePrescriptions.filter(
    (prescription) => prescription.status === "Active"
  ).length;

  const selectedPatient = patients.find(
    (patient) => patient.id === selectedPatientId
  );

  return (
    <div className="dashboard-layout">
      <aside className="sidebar">
        <div className="brand-logo sidebar-logo">
          <span className="brand-symbol">✚</span>
          <span>MediSync</span>
        </div>

        <div className="sidebar-label">WORKSPACE</div>
        <div className="nav-item active"><span>▦</span> Dashboard</div>
        <button
  type="button"
  className="nav-item"
  onClick={() => {
    document.getElementById("prescriptions-section")
      ?.scrollIntoView({ behavior: "smooth" });
  }}
>
  <span>▤</span> Prescriptions
</button>

<button
  type="button"
  className="nav-item"
  onClick={() => {
    document.getElementById("medication-schedule-section")
      ?.scrollIntoView({ behavior: "smooth" });
  }}
>
  <span>◷</span> Medication schedule
</button>
<div
  className="nav-item"
  onClick={() => {
    document
      .getElementById("care-coordination-section")
      ?.scrollIntoView({ behavior: "smooth", block: "start" });
  }}
  style={{ cursor: "pointer" }}
>
  Care coordination
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
              <h1>
                {isDoctor ? `Welcome, ${user.name}` : `Welcome, ${user.name}`}
              </h1>
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
                disabled={patients.length === 0}
              >
                <span>＋</span> Add prescription
              </button>
            )}
          </div>

          {notice && (
            <div className="alert success notice" role="status">
              {notice}
              <button onClick={() => setNotice("")} aria-label="Dismiss">×</button>
            </div>
          )}

          {workspaceLoading && (
            <div className="alert success notice">Loading your records...</div>
          )}

          <div className="stats-grid">
            <div className="stat-card">
              <div className="stat-icon lavender">▤</div>
              <div>
                <span>{isDoctor ? "Prescriptions entered" : "My prescriptions"}</span>
                <strong>{visiblePrescriptions.length}</strong>
              </div>
              <span className="stat-caption">Saved records</span>
            </div>

            <div className="stat-card">
              <div className="stat-icon mint">✓</div>
              <div>
                <span>Active prescriptions</span>
                <strong>{activeCount}</strong>
              </div>
              <span className="stat-caption">Currently active</span>
            </div>

            <div className="stat-card">
              <div className="stat-icon peach">{isDoctor ? "♙" : "♡"}</div>
              <div>
                <span>{isDoctor ? "Assigned patients" : "Care status"}</span>
                <strong>{isDoctor ? patients.length : "Connected"}</strong>
              </div>
              <span className="stat-caption">
                {isDoctor ? "From your database" : "Your account is connected"}
              </span>
            </div>
          </div>

          {isDoctor && showPrescriptionForm && (
            <section className="content-card prescription-editor">
              <div className="section-heading">
                <div>
                  <h2>New prescription</h2>
                  <p>Enter the medication details for an assigned patient.</p>
                </div>
                <button
                  type="button"
                  className="icon-button"
                  onClick={() => setShowPrescriptionForm(false)}
                  aria-label="Close prescription form"
                >
                  ×
                </button>
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
                      <option value="">Select a patient</option>
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
                      placeholder="As written on the prescription"
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
                        const selectedTimes =
                          prescriptionForm.frequencyTimes || [];

                        const frequencyLimit = {
                          "Once a day": 1,
                          "Twice a day": 2,
                          "Three times a day": 3,
                          "Four times a day": 4,
                        }[prescriptionForm.frequency] || 0;

                        const isSelected = selectedTimes.includes(time);
                        const limitReached =
                          selectedTimes.length >= frequencyLimit;

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
                  <button
                    type="button"
                    className="secondary-button"
                    onClick={() => setShowPrescriptionForm(false)}
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="primary-button compact"
                    disabled={loading}
                  >
                    {loading ? "Saving..." : "Save prescription"}
                  </button>
                </div>
              </form>
            </section>
          )}

          {isDoctor && (
            <section className="content-card patient-selector">
              <div>
                <h2>Patient overview</h2>
                <p>Choose an assigned patient to view their saved prescriptions.</p>
              </div>

              <label className="selector-field">
                <span>Patient</span>
                <select
                  value={selectedPatientId}
                  onChange={(event) => setSelectedPatientId(event.target.value)}
                >
                  <option value="">Select a patient</option>
                  {patients.map((patient) => (
                    <option key={patient.id} value={patient.id}>
                      {patient.name}
                    </option>
                  ))}
                </select>
              </label>

              {selectedPatient && (
                <div className="patient-summary">
                  <div className="patient-avatar">
                    {selectedPatient.name.charAt(0)}
                  </div>
                  <div>
                    <strong>{selectedPatient.name}</strong>
                    <span>{selectedPatient.email}</span>
                  </div>
                  <span className="status-pill">Assigned patient</span>
                </div>
              )}
            </section>
          )}
  <section
  id="prescriptions-section"
  className="content-card"
>
          <section className="content-card">
            <div className="section-heading">
              <div>
                <h2>{isDoctor ? "Prescription records" : "My prescriptions"}</h2>
                <p>
                  {isDoctor
                    ? "Saved medication records for the selected patient."
                    : "Medication details saved by your healthcare team."}
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

            <div className="prescription-list">
              {visiblePrescriptions.map((prescription) => (
                <PrescriptionCard
                  key={prescription.id}
                  prescription={prescription}
                  doctorView={isDoctor}
                  onStatusChange={isDoctor ? changePrescriptionStatus : undefined}
                />
              ))}

              {!workspaceLoading && visiblePrescriptions.length === 0 && (
                <EmptyState
                  title="No prescriptions yet"
                  description={
                    isDoctor
                      ? selectedPatientId
                        ? "Add a prescription for this patient to see it here."
                        : "Select an assigned patient to view their prescriptions."
                      : "When your doctor saves a prescription, it will appear here."
                  }
                  action={
                    isDoctor && patients.length > 0
                      ? "Add prescription"
                      : undefined
                  }
                  onAction={() => setShowPrescriptionForm(true)}
                />
              )}
            </div>
          </section>

          {!isDoctor && (
            <section className="reminder-banner">
              <div className="reminder-symbol">♡</div>
              <div>
                <strong>Stay informed about your medications</strong>
                <p>
                  Follow your doctor's instructions. Contact your healthcare
                  professional if you have questions about a prescription.
                </p>
              </div>
            </section>
          )}
          
      {/* End of the existing Prescription records section */}
      </section>

      {/* Add the new sections immediately below */}
       
<section
  id="medication-schedule-section"
  className="content-card"
>
  <div className="section-heading">
    <div>
      <h2>Medication schedule</h2>
      <p>Review your prescribed medications and scheduled times.</p>
    </div>
  </div>

  {!isDoctor && visiblePrescriptions.filter(
    (prescription) => prescription.status === "Active"
  ).length === 0 && (
    <EmptyState
      title="No active medications"
      description="Your active prescriptions will appear here when your doctor adds them."
    />
  )}

  {!isDoctor && visiblePrescriptions
    .filter((prescription) => prescription.status === "Active")
    .map((prescription) => {
      const match = prescription.frequency.match(/\(([^)]+)\)/);
      const times = match
        ? match[1].split(",").map((time) => time.trim())
        : [];

      return (
        <article
          className="prescription-card"
          key={prescription.id}
        >
          <div className="medication-symbol">✚</div>

          <div className="prescription-details">
            <h3>{prescription.medication}</h3>

            <div className="medication-meta">
              <span>
                <b>Dosage</b>
                {prescription.dosage}
              </span>
              <span>
                <b>Frequency</b>
                {prescription.frequency.split(" (")[0]}
              </span>
            </div>

            <p>
              <strong>Scheduled times</strong>
            </p>

            {times.length > 0 ? (
              <div className="frequency-times">
                {times.map((time) => (
                  <span
                    className="status-pill"
                    key={time}
                  >
                    {time}
                  </span>
                ))}
              </div>
            ) : (
              <p>Scheduled times were not specified.</p>
            )}

            {prescription.instructions && (
              <p className="medication-instructions">
                {prescription.instructions}
              </p>
            )}

            {(prescription.startDate || prescription.endDate) && (
              <p className="date-range">
                {prescription.startDate || "Start date not set"}
                {" — "}
                {prescription.endDate || "End date not set"}
              </p>
            )}
          </div>
        </article>
      );
    })}

  {isDoctor && (
    <p>
      Select a patient to review their prescriptions in Prescription records.
    </p>
  )}
</section>
 
<DrugInteractionChecker />
      
<section id="care-coordination-section" className="content-card">
  <div className="section-heading">
    <div>
      <h2>Care Coordination</h2>
      <p>
        Keep patient information and medication details together.
      </p>
    </div>
    <span className="status-pill">Connected</span>
  </div>

  <div className="patient-summary">
    <div className="patient-avatar">
      {(isDoctor
        ? selectedPatient?.name
        : user.name || "U"
      )?.charAt(0).toUpperCase() || "U"}
    </div>

    <div>
      <strong>
        {isDoctor
          ? selectedPatient?.name || "No patient selected"
          : user.name}
      </strong>
      <span>
        {isDoctor
          ? selectedPatient?.email || "Select an assigned patient"
          : user.email}
      </span>
    </div>

    <span className="status-pill">
      {isDoctor ? "Patient overview" : "Patient account"}
    </span>
  </div>

  <div className="stats-grid">
    <div className="stat-card">
      <div className="stat-icon lavender">▤</div>
      <div>
        <span>Total prescriptions</span>
        <strong>{visiblePrescriptions.length}</strong>
      </div>
      <span className="stat-caption">Saved records</span>
    </div>

    <div className="stat-card">
      <div className="stat-icon mint">✓</div>
      <div>
        <span>Active medications</span>
        <strong>
          {
            visiblePrescriptions.filter(
              (p) => p.status === "Active"
            ).length
          }
        </strong>
      </div>
      <span className="stat-caption">Currently active</span>
    </div>
  </div>

  <div className="section-heading">
    <div>
      <h2>Medication care details</h2>
      <p>Review the saved instructions for each active prescription.</p>
    </div>
  </div>

  {visiblePrescriptions.filter(
    (p) => p.status === "Active"
  ).length === 0 ? (
    <EmptyState
      title="No active medications"
      description="Active prescription details will appear here when available."
    />
  ) : (
    <div className="prescription-list">
      {visiblePrescriptions
        .filter((p) => p.status === "Active")
        .map((prescription) => (
          <article
            className="prescription-card"
            key={prescription.id}
          >
            <div className="medication-symbol">✚</div>

            <div className="prescription-details">
              <h3>{prescription.medication}</h3>

              <div className="medication-meta">
                <span>
                  <b>Dosage</b>
                  {prescription.dosage || "Not specified"}
                </span>
                <span>
                  <b>Frequency</b>
                  {prescription.frequency || "Not specified"}
                </span>
              </div>

              <p>
                <strong>Instructions:</strong>{" "}
                {prescription.instructions || "No instructions recorded."}
              </p>

              {isDoctor && (
                <p>
                  <strong>Patient:</strong>{" "}
                  {prescription.patientName}
                </p>
              )}
            </div>
          </article>
        ))}
    </div>
  )}

  <div className="form-actions">
    <button
      type="button"
      className="primary-button compact"
      onClick={() => {
        const activeMedications = visiblePrescriptions.filter(
          (p) => p.status === "Active"
        );

        const summary = [
          "MediSync Care Summary",
          `Account: ${user.name}`,
          `Role: ${isDoctor ? "Doctor" : "Patient"}`,
          `Patient: ${
            isDoctor
              ? selectedPatient?.name || "None selected"
              : user.name
          }`,
          `Total prescriptions: ${visiblePrescriptions.length}`,
          "",
          "Active medications:",
          ...activeMedications.map(
            (p) =>
              `- ${p.medication}; Dosage: ${p.dosage}; Frequency: ${p.frequency}; Instructions: ${p.instructions || "None recorded"}`
          ),
        ].join("\n");

        navigator.clipboard.writeText(summary)
          .then(() => setNotice("Care summary copied successfully."))
          .catch(() => setNotice("Could not copy the summary. Please check browser clipboard permissions."));
      }}
    >
      Copy care summary
    </button>
  </div>

  <p className="muted">
    Medication updates shown here reflect saved prescription records.
    This section does not independently verify whether a patient has taken a dose.
  </p>
</section>


          <footer className="dashboard-footer">
            <span>© {new Date().getFullYear()} MediSync</span>
            <span>Connected care, simplified.</span>
          </footer>
        </div>
      </main>
    </div>
  );
}

function PrescriptionCard({
  prescription,
  doctorView = false,
  onStatusChange,
}) {
  return (
    <article className="prescription-card">
      <div className="medication-symbol">✚</div>

      <div className="prescription-details">
        <div className="medication-title-row">
          <h3>{prescription.medication}</h3>
          <span
            className={`status-pill ${
              prescription.status === "Completed" ? "completed" : ""
            }`}
          >
            {prescription.status}
          </span>
        </div>

        {doctorView && (
          <p className="patient-name">
            Patient: {prescription.patientName}
          </p>
        )}

        <div className="medication-meta">
          <span>
            <b>Dosage</b>
            {prescription.dosage}
          </span>
          <span>
            <b>Frequency</b>
            {prescription.frequency || "Not specified"}
          </span>
        </div>

        {prescription.instructions && (
          <p className="medication-instructions">
            {prescription.instructions}
          </p>
        )}

        {(prescription.startDate || prescription.endDate) && (
          <p className="date-range">
            {prescription.startDate || "Start date not set"} —{" "}
            {prescription.endDate || "End date not set"}
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
        <button className="secondary-button" onClick={onAction}>
          {action}
        </button>
      )}
    </div>
  );
}

export default App;