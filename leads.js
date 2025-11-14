// ====== STATE ======
let leads = [];

// ====== LOAD LEADS FROM API ======
async function loadLeads() {
    try {
        const res = await fetch("/api/leads");
        leads = await res.json();
        renderLeads();
        updateLeadCount();
    } catch (err) {
        console.error("Kan leads niet laden:", err);
    }
}

// ====== RENDER LEADS IN LIST ======
function renderLeads() {
    const list = document.getElementById("lead-list");
    list.innerHTML = "";

    leads.forEach((lead, index) => {
        const li = document.createElement("div");
        li.className = "lead-item";
        li.innerHTML = `
            <strong>${lead.companyName}</strong><br>
            ${lead.contactName} — ${lead.email}<br>
            <span class="status">${lead.status.toUpperCase()}</span>
        `;

        li.onclick = () => fillOfferHelper(index);

        list.appendChild(li);
    });
}

// ====== UPDATE LEAD COUNT ======
function updateLeadCount() {
    const el = document.getElementById("lead-count");
    if (el) el.textContent = leads.length;
}

// ====== FILL OFFER HELPER WITH LEAD DATA ======
function fillOfferHelper(index) {
    const lead = leads[index];

    document.getElementById("offer-service").value = lead.notes || "";
    document.getElementById("offer-benefits").value = 
        `${lead.companyName}\n${lead.contactName} — ${lead.email}`;
    document.getElementById("lead-email").value = lead.email;
}

// ====== SAVE NEW LEAD ======
async function saveLead() {
    const company = document.getElementById("lead-company").value.trim();
    const contact = document.getElementById("lead-contact").value.trim();
    const email   = document.getElementById("lead-email").value.trim();
    const phone   = document.getElementById("lead-phone").value.trim();
    const notes   = document.getElementById("lead-notes").value.trim();

    if (!company || !contact) {
        alert("Bedrijfsnaam en contactpersoon zijn verplicht.");
        return;
    }

    const newLead = {
        companyName: company,
        contactName: contact,
        email,
        phone,
        notes,
        status: "nieuw"
    };

    try {
        await fetch("/api/leads", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(newLead)
        });

        // Velden leegmaken
        document.getElementById("lead-company").value = "";
        document.getElementById("lead-contact").value = "";
        document.getElementById("lead-email").value = "";
        document.getElementById("lead-phone").value = "";
        document.getElementById("lead-notes").value = "";

        loadLeads(); // opnieuw laden
    } catch (err) {
        console.error("Lead opslaan mislukt:", err);
    }
}

// ====== OFFERTETEKST GENEREREN ======
function generateOffer() {
    const dienst  = document.getElementById("offer-service").value.trim();
    const tone    = document.getElementById("offer-tone").value;
    const prijs   = document.getElementById("offer-price").value.trim();
    const plus    = document.getElementById("offer-benefits").value.trim();

    let intro = "";
    if (tone === "vlot") {
        intro = `Thanks voor de aanvraag voor ${dienst}!`;
    } else if (tone === "formeel") {
        intro = `Dank voor uw interesse in ${dienst}.`;
    } else {
        intro = `Bedankt voor uw aanvraag voor ${dienst}.`;
    }

    const tekst = `
${intro}

Hierbij sturen wij een eerste voorstel.

Indicatieve investering: ${prijs || "in overleg"}.

Pluspunten / garanties:
${plus}

Laat het gerust weten als er vragen zijn.

Met vriendelijke groet,
ABS – AI Business Services
`;

    document.getElementById("offer-result").value = tekst;
}

// ====== COPY TEXT TO CLIPBOARD ======
async function copyOffer() {
    try {
        await navigator.clipboard.writeText(
            document.getElementById("offer-result").value
        );
        alert("Offerte gekopieerd!");
    } catch (err) {
        alert("Kopiëren mislukt.");
    }
}

// ====== SEND MAIL ======
async function sendMail() {
    const to = document.getElementById("lead-email").value.trim();
    const text = document.getElementById("offer-result").value.trim();
    const subject = "Voorstel – ABS Business Service";

    if (!to || !text) {
        alert("Geen e-mail of geen offerte ingevuld.");
        return;
    }

    try {
        const res = await fetch("/api/mail", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ to, subject, text })
        });

        if (res.ok) {
            alert("Mail verzonden (check server console)!");
        } else {
            alert("Fout bij mail versturen.");
        }
    } catch (err) {
        alert("Kan server niet bereiken.");
    }
}

// ====== INIT ======
document.addEventListener("DOMContentLoaded", () => {
    loadLeads();

    document.getElementById("save-lead-btn").onclick = saveLead;
    document.getElementById("generate-offer-btn").onclick = generateOffer;
    document.getElementById("copy-offer-btn").onclick = copyOffer;
    document.getElementById("send-offer-btn").onclick = sendMail;
});
