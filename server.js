import express from 'express';
import cors from 'cors';
import morgan from 'morgan';
import dotenv from 'dotenv';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import Database from 'better-sqlite3';
import path from 'path';
import { fileURLToPath } from 'url';
import OpenAI from 'openai';

dotenv.config();
const app = express();
app.use(cors());
app.use(express.json({limit:'2mb'}));
app.use(morgan('dev'));

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// DB
const db = new Database(process.env.SQLITE_PATH || 'data.db');
db.pragma('journal_mode = WAL');
db.exec(`
CREATE TABLE IF NOT EXISTS orgs (id INTEGER PRIMARY KEY, name TEXT UNIQUE NOT NULL);
CREATE TABLE IF NOT EXISTS users (id INTEGER PRIMARY KEY, org_id INTEGER NOT NULL, email TEXT NOT NULL, pass TEXT NOT NULL, role TEXT NOT NULL, UNIQUE(org_id,email));
CREATE TABLE IF NOT EXISTS leads (id INTEGER PRIMARY KEY, org_id INTEGER NOT NULL, client_name TEXT, client_email TEXT, client_phone TEXT, client_addr TEXT, items_json TEXT, amount REAL, vat REAL, total REAL, created_at TEXT DEFAULT (DATETIME('now')));
CREATE TABLE IF NOT EXISTS settings (org_id INTEGER PRIMARY KEY, locale TEXT DEFAULT 'nl-NL', tax_rate REAL DEFAULT 21, next_inv TEXT DEFAULT 'INV-2025-0001', stripe_link TEXT DEFAULT '');
`);

const JWT_SECRET = process.env.JWT_SECRET || 'devsecret';
const sign = (p)=> jwt.sign(p, JWT_SECRET, {expiresIn:'7d'});
const auth = (req,res,next)=>{
  const tok = (req.headers.authorization||'').replace('Bearer ','');
  try { req.user = jwt.verify(tok, JWT_SECRET); return next(); }
  catch(e){ return res.status(401).json({error:'unauthorized'}); }
};

// serve frontend
import { dirname } from 'path';
app.use('/', express.static(path.join(__dirname, '../frontend')));

// auth
app.post('/api/auth/signup',(req,res)=>{
  const {org,email,password,role='admin'} = req.body||{};
  if(!org || !email || !password) return res.status(400).json({error:'missing'});
  const tx = db.transaction(()=>{
    db.prepare('INSERT INTO orgs (name) VALUES (?)').run(org);
    const orgId = db.prepare('SELECT id FROM orgs WHERE name=?').get(org).id;
    const hash = bcrypt.hashSync(password, 10);
    db.prepare('INSERT INTO users (org_id,email,pass,role) VALUES (?,?,?,?)').run(orgId,email,hash,role);
    db.prepare('INSERT OR IGNORE INTO settings (org_id) VALUES (?)').run(orgId);
    return orgId;
  });
  try { const id = tx(); res.json({ok:true, orgId:id}); }
  catch(e){ res.status(400).json({error:'org_exists'}); }
});

app.post('/api/auth/login',(req,res)=>{
  const {org,email,password} = req.body||{};
  const row = db.prepare(`
    SELECT o.id as org_id, u.pass, u.role FROM users u JOIN orgs o ON o.id=u.org_id
    WHERE o.name=? AND u.email=?`).get(org,email);
  if(!row) return res.status(401).json({error:'invalid'});
  if(!bcrypt.compareSync(password, row.pass)) return res.status(401).json({error:'invalid'});
  return res.json({token: sign({org_id: row.org_id, email, role: row.role})});
});

// leads
app.get('/api/leads', auth, (req,res)=>{
  const rows = db.prepare('SELECT id, client_name, client_email, total, created_at FROM leads WHERE org_id=? ORDER BY id DESC').all(req.user.org_id);
  res.json({rows});
});
app.post('/api/leads', auth, (req,res)=>{
  const {client, items, totals} = req.body||{};
  const info = db.prepare('INSERT INTO leads (org_id, client_name, client_email, client_phone, client_addr, items_json, amount, vat, total) VALUES (?,?,?,?,?,?,?, ?, ?)')
    .run(req.user.org_id, client?.name||'', client?.email||'', client?.phone||'', client?.addr||'', JSON.stringify(items||[]), totals?.amount||0, totals?.vat||0, totals?.total||0);
  res.json({ok:true, id: info.lastInsertRowid});
});

// settings
app.get('/api/settings', auth, (req,res)=> {
  const s = db.prepare('SELECT locale, tax_rate, next_inv, stripe_link FROM settings WHERE org_id=?').get(req.user.org_id);
  res.json(s||{});
});
app.post('/api/settings', auth, (req,res)=>{
  const {locale,tax_rate,next_inv,stripe_link} = req.body||{};
  db.prepare('UPDATE settings SET locale=COALESCE(?,locale), tax_rate=COALESCE(?,tax_rate), next_inv=COALESCE(?,next_inv), stripe_link=COALESCE(?,stripe_link) WHERE org_id=?')
    .run(locale, tax_rate, next_inv, stripe_link, req.user.org_id);
  res.json({ok:true});
});

// AI
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

app.post('/api/ai/chat', auth, async (req, res) => {
  try {
    const { messages, language = 'nl' } = req.body || {};
    if (!Array.isArray(messages) || messages.length === 0) {
      return res.status(400).json({ error: 'messages_required' });
    }
    const system = [{ role:'system', content:
      `Je bent een zakelijke AI-assistent voor organisatie ${req.user.org_id}.
       Schrijf duidelijk, beleefd en kort. Gebruik taal: ${language}.
       Als bedragen worden genoemd: noem het 'indicatie' en verwijs naar PDF-offerte.` }];

    const completion = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [...system, ...messages].slice(-20),
      temperature: 0.3
    });
    const text = completion.choices?.[0]?.message?.content || '';
    res.json({ reply: text });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'ai_failed' });
  }
});

app.post('/api/ai/lead-notes', auth, async (req,res)=>{
  try{
    const { lead } = req.body || {};
    const prompt = `Maak 1–2 zinnen CRM-notitie (bullet points) op basis van:
Klant: ${lead?.client?.name||'-'} (${lead?.client?.email||'-'})
Adres: ${lead?.client?.addr||'-'}
Items: ${(lead?.items||[]).map(i=>`${i.desc} x${i.qty}`).join(', ')}
Totaal: ${lead?.totals?.total||'-'}
Taal: Nederlands.`;

    const completion = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [{ role:'user', content: prompt }],
      temperature: 0.2
    });
    res.json({ notes: completion.choices?.[0]?.message?.content || '' });
  }catch(e){
    console.error(e); res.status(500).json({error:'ai_failed'});
  }
});

app.post('/api/ai/offer-text', auth, async (req,res)=>{
  try{
    const { clientName, items = [], total, language='nl' } = req.body || {};
    const prompt = `Schrijf een korte professionele begeleidende tekst voor een offerte.
Taal: ${language}. Aanspreking: ${clientName||'klant'}.
Noem hoofdlijnen items: ${(items||[]).slice(0,5).map(i=>i.desc).join(', ')}.
Totaalindicatie: ${total||'-'} (excl. voorbehoud).
Call-to-action: bevestigen of afspraak plannen.`;

    const completion = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [{ role:'user', content: prompt }],
      temperature: 0.4
    });
    res.json({ text: completion.choices?.[0]?.message?.content || '' });
  }catch(e){
    console.error(e); res.status(500).json({error:'ai_failed'});
  }
});

app.get('/api/health', (req,res)=> res.json({ok:true}));

const port = process.env.PORT || 8080;
app.listen(port, ()=> console.log('ABS server on :' + port));
