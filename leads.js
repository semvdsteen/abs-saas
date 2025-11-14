// server.js
// Simpele ABS SaaS backend met:
// - statische bestanden
// - leads-API (JSON file opslag)
// - mail-demo endpoint

const express = require("express");
const path = require("path");
const fs = require("fs");

const app = express();
const PORT = process.env.PORT || 10000;

// ==== MIDDLEWARE ====
app.use(express.json());

// Statische bestanden (index.html, leads.html, leads.js, etc.)
app.use(express.static(__dirname));

// ==== LEADS OPSLAG (JSON FILE) ====

// map: /data/leads.json
const dataDir = path.join(__dirname, "data");
const leadsFile = path.join(dataDir, "leads.json");

// Zorg dat map en file bestaan
function ensureStorage() {
  if (!fs.existsSync(dataDir)) {
    fs.mkdirSync(dataDir);
  }
  if (!fs.existsSync(leadsFile)) {
    fs.writeFileSync(leadsFile, "[]", "utf8");
  }
}

// Lees leads uit file
function loadLeads() {
  ensureStorage();
  const raw = fs.readFileSync(leadsFile, "utf8");
  try {
    return JSON.parse(raw);
  } catch (e) {
    console.error("Kon leads.json niet parsen, reset naar []");
    return [];
  }
}

// Schrijf leads naar file
function saveLeads(leads) {
  ensureStorage();
  fs.writeFileSync(leadsFile, JSON.stringify(leads, null, 2), "utf8");
}

// Helper om simpele unieke id te maken
function createId() {
  return Date.now().toString(36) + Math.random().toString(36).substring(2, 8);
}

// ==== API: LEADS ====

// Alle leads ophalen
app.get("/api/leads", (req, res) => {
  const leads = loadLeads();
  res.json(leads);
});

// Nieuwe lead aanmaken
app.post("/api/leads", (req, res) => {
  const { companyName, contactName, email, phone, notes, status } = req.body;

  if (!companyName || !contactName) {
    return res.status(400).json({
      error: "companyName en contactName zijn verplicht",
    });
  }

  const leads = loadLeads();
  const now = new Date().toISOString();

  const newLead = {
    id: createId(),
    companyName,
    contactName,
    email: email || "",
    phone: phone || "",
    notes: notes || "",
    status: status || "nieuw",
    createdAt: now,
    updatedAt: now,
  };

  leads.push(newLead);
  saveLeads(leads);

  res.status(201).json(newLead);
});

// Bestaande lead bijwerken
app.put("/api/leads/:id", (req, res) => {
  const { id } = req.params;
  const updates = req.body;

  const leads = loadLeads();
  const index = leads.findIndex((l) => l.id === id);

  if (index === -1) {
    return res.status(404).json({ error: "Lead niet gevonden" });
  }

  leads[index] = {
    ...leads[index],
    ...updates,
    updatedAt: new Date().toISOString(),
  };

  saveLeads(leads);
  res.json(leads[index]);
});

// Lead verwijderen
app.delete("/api/leads/:id", (req, res) => {
  const { id } = req.params;
  const leads = loadLeads();
  const index = leads.findIndex((l) => l.id === id);

  if (index === -1) {
    return res.status(404).json({ error: "Lead niet gevonden" });
  }

  const removed = leads.splice(index, 1)[0];
  saveLeads(leads);
  res.json({ ok: true, removed });
});

// ==== API: MAIL DEMO ====
// LET OP: dit stuurt nog geen echte mail, maar logt alleen in de server

app.post("/api/mail", (req, res) => {
  const { to, subject, text } = req.body;

  if (!to || !text) {
    return res
      .status(400)
      .json({ error: "Veld 'to' en 'text' zijn verplicht" });
  }

  console.log("==== MAIL DEMO ====");
  console.log("To:     ", to);
  console.log("Subject:", subject || "(geen onderwerp)");
  console.log("Text:\n", text.substring(0, 500));
  console.log("====================");

  res.json({ ok: true });
});

// ==== ROOT ROUTE ====
// optioneel: index.html als hoofdpagina
app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "index.html"));
});

// ==== SERVER STARTEN ====
app.listen(PORT, () => {
  console.log(`ABS SaaS server draait op poort ${PORT}`);
});
