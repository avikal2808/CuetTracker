const http = require('http');
const fs = require('fs');
const path = require('path');

const PORT = process.env.PORT || 3000;
const ROOT_DIR = path.join(__dirname, '..', 'public');
const API_ROUTES = { '/api/extract-syllabus': '../public/api/extract-syllabus.js' };
const API_BODY_LIMIT = 8 * 1024 * 1024;

// Local convenience: pick up GEMINI_API_KEY from a .env file next to package.json
// so the AI reader works on localhost too. Existing env vars always win.
function loadDotEnv() {
  const envPath = path.join(__dirname, '..', '.env');
  if (!fs.existsSync(envPath)) return;
  fs.readFileSync(envPath, 'utf8').split(/\r?\n/).forEach(line => {
    const match = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/i);
    if (!match) return;
    const key = match[1];
    const value = match[2].replace(/^['"]|['"]$/g, '');
    if (!process.env[key]) process.env[key] = value;
  });
}

loadDotEnv();

/**
 * Run a Vercel-style serverless handler (req.body + res.status().json())
 * against the plain Node request/response objects used by this dev server.
 */
function runApiRoute(handlerPath, req, res) {
  const chunks = [];
  let size = 0;
  let aborted = false;

  req.on('data', chunk => {
    if (aborted) return;
    size += chunk.length;
    if (size > API_BODY_LIMIT) {
      aborted = true;
      res.writeHead(413, { 'Content-Type': 'application/json; charset=utf-8' });
      res.end(JSON.stringify({ error: 'That photo is too large. Please use an image under 4 MB.' }));
      return;
    }
    chunks.push(chunk);
  });

  req.on('end', async () => {
    if (aborted) return;

    try {
      req.body = JSON.parse(Buffer.concat(chunks).toString('utf8') || '{}');
    } catch (err) {
      res.writeHead(400, { 'Content-Type': 'application/json; charset=utf-8' });
      res.end(JSON.stringify({ error: 'Malformed request body.' }));
      return;
    }

    res.status = code => { res.statusCode = code; return res; };
    res.json = payload => {
      res.setHeader('Content-Type', 'application/json; charset=utf-8');
      res.end(JSON.stringify(payload));
    };

    try {
      // eslint-disable-next-line global-require
      await require(handlerPath)(req, res);
    } catch (err) {
      if (!res.headersSent) {
        res.status(500).json({ error: 'The API route crashed.', detail: String(err && err.message) });
      }
    }
  });
}

const MIME_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon'
};

const server = http.createServer((req, res) => {
  let cleanUrl = req.url.split('?')[0];
  if (cleanUrl === '/' || cleanUrl === '') {
    cleanUrl = '/index.html';
  }

  // Serverless-style API routes (deployed on Vercel, emulated here for local dev).
  if (API_ROUTES[cleanUrl]) {
    if (req.method !== 'POST') {
      res.writeHead(405, { 'Content-Type': 'application/json; charset=utf-8' });
      res.end(JSON.stringify({ error: 'Method not allowed. Use POST.' }));
      return;
    }
    console.log(`[api] ${req.method} ${cleanUrl}${process.env.GEMINI_API_KEY ? '' : ' (no GEMINI_API_KEY found)'}`);
    runApiRoute(path.join(__dirname, API_ROUTES[cleanUrl]), req, res);
    return;
  }

  const filePath = path.join(ROOT_DIR, cleanUrl);

  // Security: prevent path traversal outside project root
  if (!filePath.startsWith(ROOT_DIR)) {
    res.writeHead(403, { 'Content-Type': 'text/plain' });
    res.end('Forbidden');
    return;
  }

  fs.readFile(filePath, (err, content) => {
    if (err) {
      if (err.code === 'ENOENT') {
        // Fallback to index.html for SPA routing (only for non-asset requests)
        const isAsset = cleanUrl.includes('.');
        if (!isAsset) {
          fs.readFile(path.join(ROOT_DIR, 'index.html'), (indexErr, indexContent) => {
            if (indexErr) {
              res.writeHead(404, { 'Content-Type': 'text/plain' });
              res.end('File Not Found');
            } else {
              res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
              res.end(indexContent);
            }
          });
        } else {
          res.writeHead(404, { 'Content-Type': 'text/plain' });
          res.end(`File Not Found: ${cleanUrl}`);
        }
      } else {
        res.writeHead(500, { 'Content-Type': 'text/plain' });
        res.end(`Server Error: ${err.code}`);
      }
      return;
    }

    const ext = path.extname(filePath).toLowerCase();
    const contentType = MIME_TYPES[ext] || 'application/octet-stream';
    res.writeHead(200, { 'Content-Type': contentType });
    res.end(content);
  });
});

server.listen(PORT, () => {
  console.log(`\n==================================================`);
  console.log(`  CUET & Commerce Study Tracker is LIVE!`);
  console.log(`  Access the Web App at: http://localhost:${PORT}`);
  console.log(`==================================================\n`);
});
