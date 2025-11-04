// Node server: static + AI chat + offerte generator
const http = require('http');
const fs   = require('fs');
const path = require('path');

const PORT = process.env.PORT || 10000;
const OPENAI = process.env.OPENAI_API_KEY || '';

const root = __dirname;
const send = (res,file,type)=>fs.readFile(path.join(root,file),(e,d)=>{
  if(e){ res.writeHead(404); return res.end('Not Found'); }
  res.writeHead(200,{'Content-Type':type}); res.end(d);
});
const readJson = (req)=>new Promise(r=>{
  let b=''; req.on('data',c=>b+=c); req.on('end',()=>{ try{ r(JSON.parse(b||'{}')); }catch{ r({}); }});
});

async function askOpenAI(messages){
  const r = await fetch('https://api.openai.com/v1/chat/completions',{
    method:'POST',
    headers:{'Authorization':'Bearer '+OPENAI,'Content-Type':'application/json'},
    body: JSON.stringify({model:'gpt-4o-mini',messages,temperature:0.3})
  });
  const j = await r.json();
  return j?.choices?.[0]?.message?.content || '';
}

const server = http.createServer(async (req,res)=>{
  const url = (req.url||'/').split('?')[0];

  // API: offerte generator
  if(req.method==='POST' && url==='/api/offer'){
    if(!OPENAI){ res.writeHead(500,{'Content-Type':'application/json'}); return res.end(JSON.stringify({error:'missing_openai_key'})); }
    const body = await readJson(req);
    const {name='',email='',phone='',industry='anders',description='',lang='nl'} = body;

    const sys = `Je bent een commerciële assistent. Schrijf een korte, duidelijke offerte-tekst in ${lang} voor branche: ${industry}. 
Gebruik kopjes: Probleem, Oplossing, Planning, Prijsindicatie (bandbreedte), Geldigheid, Call-to-action. Schrijf professioneel maar toegankelijk.`;
    const user = `Lead:
- Naam: ${name}
- E-mail: ${email}
- Telefoon: ${phone}
- Branche: ${industry}
- Omschrijving: ${description}
Schrijf max 220 woorden.`;

    const reply = await askOpenAI([{role:'system',content:sys},{role:'user',content:user}]);
    res.writeHead(200,{'Content-Type':'application/json'});
    return res.end(JSON.stringify({reply}));
  }

  // bestaande routes
  if(url==='/'||url==='/index.html') return send(res,'index.html','text/html; charset=utf-8');
  if(url==='/app.html')               return send(res,'app.html','text/html; charset=utf-8');
  if(url==='/leads.html')             return send(res,'leads.html','text/html; charset=utf-8');

  res.writeHead(404); res.end('Not Found');
});

server.listen(PORT, ()=>console.log('ABS server on :'+PORT));
