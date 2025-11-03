// Pure Node server met AI-proxy (+ fallback apiKey uit request)
const http = require('http');
const fs = require('fs');
const path = require('path');

const PORT = process.env.PORT || 10000;
const OPENAI_API_KEY = process.env.OPENAI_API_KEY || ''; // mag leeg zijn; dan gebruiken we body.apiKey

const root = __dirname;
function sendFile(res, file, type){
  fs.readFile(path.join(root, file), (err, data)=>{
    if(err){ res.writeHead(404); return res.end('Not Found'); }
    res.writeHead(200, {'Content-Type': type});
    res.end(data);
  });
}

async function handleAI(req, res){
  let body = '';
  req.on('data', c => body += c);
  req.on('end', async ()=>{
    try{
      const parsed = JSON.parse(body || '{}');
      const question = parsed.question || '';
      const lang = parsed.lang || 'nl';
      const key = OPENAI_API_KEY || parsed.apiKey || ''; // << Fallback via request

      if(!key){
        res.writeHead(400, {'Content-Type':'application/json'});
        return res.end(JSON.stringify({error:'missing_api_key'}));
      }

      const payload = {
        model: 'gpt-4o-mini',
        messages: [
          { role:'system', content:`Je bent een behulpzame zakelijke assistent. Antwoord kort, duidelijk en in taal: ${lang}.` },
          { role:'user', content: question }
        ],
        temperature: 0.3
      };

      const r = await fetch('https://api.openai.com/v1/chat/completions', {
        method:'POST',
        headers:{
          'Authorization':'Bearer ' + key,
          'Content-Type':'application/json'
        },
        body: JSON.stringify(payload)
      });
      const j = await r.json();
      const reply = j?.choices?.[0]?.message?.content || '(geen antwoord)';
      res.writeHead(200, {'Content-Type':'application/json'});
      res.end(JSON.stringify({reply}));
    }catch(e){
      res.writeHead(500, {'Content-Type':'application/json'});
      res.end(JSON.stringify({error:'ai_failed'}));
    }
  });
}

const server = http.createServer((req,res)=>{
  const url = (req.url||'/').split('?')[0];
  if(req.method==='POST' && url==='/api/chat') return handleAI(req,res);

  if(url==='/'||url==='/index.html') return sendFile(res,'index.html','text/html; charset=utf-8');
  if(url==='/app.html')               return sendFile(res,'app.html','text/html; charset=utf-8');

  res.writeHead(404); res.end('Not Found');
});

server.listen(PORT, ()=> console.log('ABS server on :' + PORT));
