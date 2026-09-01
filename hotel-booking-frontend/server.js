// Minimal static file server with SPA fallback and canonical-domain redirect (no extra dependencies).
const http = require("http");
const fs = require("fs");
const path = require("path");

const PORT = process.env.PORT || 8080;
const DIST_DIR = __dirname;
const CANONICAL_HOST = "www.palazzopintobnb.com";

const MIME_TYPES = {
  ".html": "text/html",
  ".js": "application/javascript",
  ".css": "text/css",
  ".json": "application/json",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".gif": "image/gif",
  ".ico": "image/x-icon",
  ".webp": "image/webp",
  ".woff": "font/woff",
  ".woff2": "font/woff2",
  ".txt": "text/plain",
  ".map": "application/json",
};

const server = http.createServer((req, res) => {
  const host = (req.headers.host || "").split(":")[0].toLowerCase();

  // Any host other than the canonical www domain (azurewebsites.net, apex domain, etc.) gets redirected.
  if (host !== CANONICAL_HOST) {
    res.writeHead(301, { Location: `https://${CANONICAL_HOST}${req.url}` });
    return res.end();
  }

  const urlPath = decodeURIComponent(req.url.split("?")[0]);
  let filePath = path.join(DIST_DIR, urlPath);

  if (!filePath.startsWith(DIST_DIR)) {
    filePath = path.join(DIST_DIR, "index.html");
  }

  fs.stat(filePath, (err, stats) => {
    if (err || !stats.isFile()) {
      filePath = path.join(DIST_DIR, "index.html");
    }
    const ext = path.extname(filePath);
    res.writeHead(200, { "Content-Type": MIME_TYPES[ext] || "application/octet-stream" });
    fs.createReadStream(filePath).pipe(res);
  });
});

server.listen(PORT, "0.0.0.0", () => {
  console.log(`Frontend server listening on port ${PORT}`);
});
