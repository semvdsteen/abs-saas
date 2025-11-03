const http = require('http');
const fs = require('fs');
const path = require('path');

const port = process.env.PORT || 10000;

const server = http.createServer((req, res) => {
  if (req.url === '/' || req.url === '/index.html') {
    fs.readFile(path.join(__dirname, 'index.html'), (err, data) => {
      if (err) { res.writeHead(500); return res.end('Server error'); }
      res.writeHead(200, {'Content-Type':'text/html; charset=utf-8'});
      return res.end(data);
    });
  } else {
    res.writeHead(404); res.end('Not Found');
  }
});

server.listen(port, () => console.log('Server running on port ' + port));
