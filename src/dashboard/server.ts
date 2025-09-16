import http from 'http';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url || '/', `http://${req.headers.host}`);

  // CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (url.pathname === '/' || url.pathname === '/index.html') {
    // Serve the dashboard HTML
    try {
      const htmlPath = path.join(__dirname, 'public', 'index.html');
      const html = fs.readFileSync(htmlPath, 'utf8');
      res.writeHead(200, { 'Content-Type': 'text/html' });
      res.end(html);
    } catch (error) {
      res.writeHead(500, { 'Content-Type': 'text/plain' });
      res.end('Error loading dashboard: ' + error.message);
    }
  } else if (url.pathname.startsWith('/api/')) {
    // Proxy API requests to main server
    try {
      const apiUrl = `http://localhost:3002${url.pathname}${url.search}`;
      const response = await fetch(apiUrl);
      const data = await response.text();

      res.writeHead(response.status, {
        'Content-Type': response.headers.get('content-type') || 'application/json'
      });
      res.end(data);
    } catch (error) {
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Failed to fetch from API server' }));
    }
  } else {
    // 404
    res.writeHead(404, { 'Content-Type': 'text/plain' });
    res.end('Not found');
  }
});

const PORT = 3001;
server.listen(PORT, () => {
  console.log(`📊 Dashboard server running at http://localhost:${PORT}`);
  console.log('🔗 Visit http://localhost:3001 to view the live dashboard');
});