// Pure Node server (geen extra dependencies nodig)
const http = require('http');
const fs = require('fs');
const path = require('path');

const port = process.env.PORT || 3000;
const root = __dirname;

function serve(file, type, res) {
  fs.readFile(path.join(root, file), (err, data) => {
    if (err) { res.writeHead(404); res.end('Not Found'); return; }
    res.writeHead(200, { 'Content-Type': type });
    res.end(data);
  });
}

const server = http.createServer((req, res) => {
  const url = (req.url || '/').split('?')[0];

  if (url === '/' || url === '/index.html') {
    return serve('index.html', 'text/html; charset=utf-8', res);
  }
  if (url === '/abs_logo.png') {
    return serve('abs_logo.png', 'image/png', res);
  }

  // Alles wat we niet kennen:
  res.writeHead(404);
  res.end('Not Found');
});

server.listen(port, () => {
  console.log(`Server running on port ${port}`);
});
