'use strict';
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const root = path.join(__dirname, '../frontend');
const hash = text => `'sha256-${crypto.createHash('sha256').update(text.replace(/\r\n?/g, '\n')).digest('base64')}'`;
const policies = new Map();
for (const name of fs.readdirSync(root).filter(name => name.endsWith('.html'))) {
  const html = fs.readFileSync(path.join(root, name), 'utf8');
  const hashes = new Set();
  for (const match of html.matchAll(/<script\b([^>]*)>([\s\S]*?)<\/script\s*>/gi)) {
    if (!/\bsrc\s*=/i.test(match[1]) && match[2].trim()) hashes.add(hash(match[2]));
  }
  // Existing static handlers remain functional without enabling arbitrary inline scripts.
  // Interpolated handlers are replaced by data attributes and a delegated listener.
  for (const match of html.matchAll(/\bon[a-z]+\s*=\s*(["'])([\s\S]*?)\1/gi)) {
    if (!match[2].includes('${')) hashes.add(hash(match[2]));
  }
  policies.set(name, [
    "default-src 'self'",
    "base-uri 'self'", "object-src 'none'", "frame-ancestors 'none'", "form-action 'self'",
    `script-src 'self' 'unsafe-hashes' https://checkout.razorpay.com ${[...hashes].join(' ')}`,
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data: blob: https:",
    "media-src 'self' blob: https://*.supabase.co",
    "font-src 'self' data:",
    "connect-src 'self' https://*.supabase.co wss://*.supabase.co https://*.razorpay.com https://*.tile.openstreetmap.org https://nominatim.openstreetmap.org https://router.project-osrm.org",
    "frame-src 'self' blob: https://*.razorpay.com",
    "worker-src 'self' blob:"
  ].join('; '));
}
function contentSecurityPolicy(req, res, next) {
  const name = req.path === '/' ? 'index.html' : path.basename(req.path);
  const policy = policies.get(name);
  if (policy) res.setHeader('Content-Security-Policy', policy);
  next();
}
module.exports = contentSecurityPolicy;
module.exports.policies = policies;
