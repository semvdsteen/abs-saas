const express = require('express');
const path = require('path');
const bodyParser = require('body-parser');
const app = express();

const PORT = process.env.PORT || 10000;

// Middleware
app.use(bodyParser.json());
app.use(express.static(__dirname));

// API endpoint voor e-mails
app.post('/api/mail', async (req, res) => {
  try {
    const { name, email, content } = req.body;
    console.log('Mail ontvangen:', name, email, content);

    // (Hier kun je later mailverzending toevoegen met nodemailer of OpenAI)
    res.json({ status: 'ok' });
  } catch (error) {
    console.error('Fout bij mail:', error);
    res.json({ status: 'error' });
  }
});

// Hoofdpagina
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'index.html'));
});

app.listen(PORT, () => {
  console.log(`✅ ABS server running on port ${PORT}`);
});
