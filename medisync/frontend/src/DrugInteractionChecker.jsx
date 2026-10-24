
import { useState } from "react";

const API_URL = "http://localhost:3001";

export default function DrugInteractionChecker() {
  const [drugA, setDrugA] = useState("");
  const [drugB, setDrugB] = useState("");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState("");

  async function checkInteractions(event) {
    event.preventDefault();
    setLoading(true);
    setResult(null);
    setError("");

    try {
      const params = new URLSearchParams({
        drugA: drugA.trim(),
        drugB: drugB.trim(),
      });

      const response = await fetch(
        `${API_URL}/api/interactions/check?${params}`
      );

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || "Request failed.");
      }

      setResult(data);
    } catch (err) {
      setError(
        err.message || "Unable to contact the interaction service."
      );
    } finally {
      setLoading(false);
    }
  }

  return (
    <main style={styles.page}>
      <section style={styles.card}>
        <h1 style={styles.heading}>Drug Interaction Checker</h1>
        <p style={styles.subtitle}>
          Check two medicines against the MediSync interaction dataset.
        </p>

        <form onSubmit={checkInteractions}>
          <label style={styles.label} htmlFor="drugA">
            First medicine
          </label>
          <input
            id="drugA"
            style={styles.input}
            value={drugA}
            onChange={(e) => setDrugA(e.target.value)}
            placeholder="e.g. Miconazole"
            required
          />

          <label style={styles.label} htmlFor="drugB">
            Second medicine
          </label>
          <input
            id="drugB"
            style={styles.input}
            value={drugB}
            onChange={(e) => setDrugB(e.target.value)}
            placeholder="e.g. Tolinase"
            required
          />

          <button style={styles.button} disabled={loading}>
            {loading ? "Checking..." : "Check interactions"}
          </button>
        </form>

        {error && (
          <div style={styles.error} role="alert">
            {error}
          </div>
        )}

        {result && (
          <section style={styles.result} aria-live="polite">
            <h2>
              {result.interactionFound
                ? "Potential interaction found"
                : "No matching interaction record"}
            </h2>

            <p>
              {result.interactionFound
                ? `${result.count} matching record(s) found.`
                : result.message}
            </p>

            {result.interactions?.map((item, index) => (
              <article key={index} style={styles.interaction}>
                <strong>
                  {item.drug1} + {item.drug2}
                </strong>
                <p>
                  <b>Dataset label:</b>{" "}
                  {item.label || "Not specified"}
                </p>
                <p>
                  {item.description || "No description provided."}
                </p>
              </article>
            ))}

            <p style={styles.disclaimer}>
              This tool supports screening only. A healthcare
              professional must review potential interactions.
              No matching record does not prove that a combination
              is safe.
            </p>
          </section>
        )}
      </section>
    </main>
  );
}

const styles = {
  page: {
    minHeight: "100vh",
    background: "#f1f5f9",
    padding: "32px 16px",
    fontFamily: "Arial, sans-serif",
  },
  card: {
    maxWidth: "650px",
    margin: "0 auto",
    padding: "28px",
    background: "#fff",
    borderRadius: "16px",
    boxShadow: "0 4px 20px rgba(0,0,0,0.08)",
  },
  heading: { color: "#173b70", marginTop: 0 },
  subtitle: { color: "#64748b", lineHeight: 1.5 },
  label: {
    display: "block",
    marginTop: "20px",
    marginBottom: "8px",
    fontWeight: "bold",
  },
  input: {
    boxSizing: "border-box",
    width: "100%",
    padding: "12px",
    border: "1px solid #cbd5e1",
    borderRadius: "8px",
    fontSize: "16px",
  },
  button: {
    width: "100%",
    marginTop: "24px",
    padding: "13px",
    background: "#1764d1",
    color: "#fff",
    border: 0,
    borderRadius: "8px",
    cursor: "pointer",
    fontSize: "16px",
  },
  result: {
    marginTop: "24px",
    padding: "16px",
    border: "1px solid #cbd5e1",
    borderRadius: "10px",
    overflowWrap: "anywhere",
  },
  interaction: {
    marginTop: "16px",
    padding: "14px",
    background: "#fff7ed",
    borderRadius: "8px",
  },
  error: {
    marginTop: "16px",
    padding: "12px",
    color: "#b91c1c",
    background: "#fef2f2",
    borderRadius: "8px",
  },
  disclaimer: {
    marginTop: "20px",
    fontSize: "13px",
    color: "#64748b",
    lineHeight: 1.5,
  },
};
