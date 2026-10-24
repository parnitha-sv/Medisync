
const express = require("express");
const cors = require("cors");
const fs = require("fs");
const path = require("path");
const { parse } = require("csv-parse");

const app = express();
const PORT = 3001;

app.use(cors());
app.use(express.json());

const CSV_PATH = path.join(__dirname, "drug_interactions.csv");

// Load the dataset once when the service starts.
console.log("Loading drug interaction dataset...");

const records = [];


async function loadDataset() {
  const parser = fs
    .createReadStream(CSV_PATH)
    .pipe(
      parse({
        columns: true,
        skip_empty_lines: true,
        relax_quotes: true,
        relax_column_count: true,
        bom: true,
      })
    );

  for await (const record of parser) {
    records.push(record);
  }
}


function normalize(value) {
  return String(value || "")
    .normalize("NFKC")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, " ");
}

function getField(record, field) {
  return String(record[field] || "").trim();
}

app.get("/api/health", (req, res) => {
  res.json({
    status: "ok",
    service: "MediSync Drug Interaction Checker",
    datasetLoaded: records.length > 0,
    recordsLoaded: records.length,
  });
});

app.get("/api/interactions/check", (req, res) => {
  const drugA = String(req.query.drugA || "").trim();
  const drugB = String(req.query.drugB || "").trim();

  if (!drugA || !drugB) {
    return res.status(400).json({
      message: "Please provide both drugA and drugB.",
    });
  }

  if (normalize(drugA) === normalize(drugB)) {
    return res.status(400).json({
      message: "Enter two different medicines.",
    });
  }

  const a = normalize(drugA);
  const b = normalize(drugB);

  const matches = records.filter((record) => {
    const name1 = normalize(record.drug1_standardized_name);
    const name2 = normalize(record.drug2_standardized_name);

    return (
      (name1 === a && name2 === b) ||
      (name1 === b && name2 === a)
    );
  });

  if (matches.length === 0) {
    return res.json({
      drugA,
      drugB,
      interactionFound: false,
      message:
        "No matching interaction record was found in this dataset. This does not prove that the combination is safe.",
      interactions: [],
    });
  }

  return res.json({
    drugA,
    drugB,
    interactionFound: true,
    count: matches.length,
    interactions: matches.map((record) => ({
      drug1: getField(record, "drug1_standardized_name"),
      drug2: getField(record, "drug2_standardized_name"),
      label: getField(record, "interaction_label"),
      description: getField(record, "sentence"),
      source: getField(record, "interaction_source"),
    })),
  });
});

async function startServer() {
  try {
    await loadDataset();

    console.log(`Loaded ${records.length} interaction records.`);

    app.listen(PORT, () => {
      console.log(
        `Drug interaction API running at http://localhost:${PORT}`
      );
    });
  } catch (error) {
    console.error("Failed to load interaction dataset:", error.message);
    process.exit(1);
  }
}

startServer();
