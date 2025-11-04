// ABS SaaS – minimalistische Node server (zonder extra packages)
// Routes: /, /index.html, /app.html, /leads.html, POST /api/offer

const http = require('http');
const fs   = require('fs');
const path = require('path');

const PORT   = process.env.PORT || 10000;
const OPENAI = process.env.OPENAI_API_KEY || ''; // Stel in op Render → Environment

const ROOT = __dirname;

// Helpers
function sendFile(res, relPath, type) {
  fs.readFile(path.join(ROOT, relPath), (err, data) => {
    if (err) { res.writeHead(404); return res.end('Not Found'); }
    res.writeHead(200, { 'Content-Type': type });
    res.end(data);
  });
}

function readJson(req) {
  return new Promise(resolve => {
    let body = '';
    req.on('data', c => body += c);
    req.on('end', () => {
      try { resolve(JSON.parse(body || '{}')); }
      catch { resolve({}); }
    });
  });
}

async function askOpenAI(messages) {
  if (!OPENAI) return '(OPENAI_API_KEY ontbreekt op de server)';
  const r = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Authorization': 'Bearer ' + OPENAI,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      model: 'gpt-4o-mini',
      messages,
      temperature: 0.3
    })
  });
  const j = await r.json().catch(() => ({}));
  return j?.choices?.[0]?.message?.content || '(geen antwoord)';
}

// Server
const server = http.createServer(async (req, res) => {
  const url = (req.url || '/').split('?')[0];

  // API: offerte generator
  if (req.method === 'POST' && url === '/api/offer') {
    const body = await readJson(req);
    const { name = '', email = '', phone = '', industry = 'anders', description = '', lang = 'nl' } = body;

    const system = `Je bent een commerciële assistent. Schrijf een korte, duidelijke offerte-tekst in ${lang}.
Gebruik kopjes: Probleem, Oplossing, Planning, Prijsindicatie (bandbreedte), Geldigheid, Call-to-action.
Houd het professioneel maar toegankelijk.`;

    const user = `Lead:
- Naam: ${name}
- E-mail: ${email}
- Telefoon: ${phone}
- Branche: ${industry}
- Omschrijving: ${description}
Schrijf max 220 woorden.`;

    const reply = await askOpenAI([
      { role: 'system', content: system },
      { role: 'user', content: user }
    ]);

    res.writeHead(200, { 'Content-Type': 'application/json' });
    return res.end(JSON.stringify({ reply }));
  }

  // Statische pagina's
  if (url === '/' || url === '/index.html') return sendFile(res, 'index.html', 'text/html; charset=utf-8');
  if (url === '/app.html')               return sendFile(res, 'app.html',   'text/html; charset=utf-8');
  if (url === '/leads.html')             return sendFile(res, 'leads.html', 'text/html; charset=utf-8');

  // Fallback
  res.writeHead(404);
  res.end('Not Found');
});

// Start
server.listen(PORT, () => {
  console.log(`✅ ABS server running on port ${PORT}`);
});
