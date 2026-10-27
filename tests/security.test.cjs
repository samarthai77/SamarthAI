'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const jwt = require('jsonwebtoken');
const sharp = require('sharp');
const { sessionVersion, passwordError, boundedFetch } = require('../services/security');
const { createSessionGuard } = require('../middleware/sessionGuard');
const { normalizeImage, uploadSlot } = require('../middleware/safeUpload');
const secret = 'test-only-session-secret-not-a-real-credential';
process.env.JWT_SECRET = secret;
const response = () => ({ status(n) { this.code = n; return this; }, json(body) { this.body = body; return this; } });
function database(user, error = null) {
  return { from() { const q = { select() { return q; }, eq() { return q; }, maybeSingle() { return q; }, abortSignal() { return Promise.resolve({ data: user, error }); } }; return q; } };
}
const user = { id: 'fixture-user', password: 'test-password-hash', is_active: true };
function token(claims = {}) { return jwt.sign({ id: user.id, sv: sessionVersion(user.password), ...claims }, secret, { expiresIn: '1h' }); }
async function guard(value, db = database(user), required = true) {
  const res = response(); let passed = false;
  await createSessionGuard(db, { required })({ headers: value ? { authorization: value } : {} }, res, () => { passed = true; });
  return { res, passed };
}
test('sessions accept current token and reject changed password across process instances', async () => {
  assert.equal((await guard('Bearer ' + token())).passed, true);
  assert.equal((await guard('Bearer ' + token(), database({ ...user, password: 'changed' }))).res.code, 401);
});
test('sessions reject legacy, disabled, deleted, malformed, expired and wrong-algorithm JWTs', async () => {
  for (const value of [undefined, 'Basic secret', 'Bearer invalid', 'Bearer ' + token({ sv: undefined }), 'Bearer ' + jwt.sign({ id: user.id, sv: sessionVersion(user.password) }, secret, { algorithm: 'HS384' }), 'Bearer ' + jwt.sign({ id: user.id, sv: sessionVersion(user.password) }, secret, { expiresIn: -1 })]) {
    assert.equal((await guard(value)).res.code, 401);
  }
  assert.equal((await guard('Bearer ' + token(), database(null))).res.code, 401);
  assert.equal((await guard('Bearer ' + token(), database({ ...user, is_active: false }))).res.code, 401);
});
test('session DB failure fails closed without returning sensitive diagnostics', async () => {
  const { res } = await guard('Bearer ' + token(), database(null, { message: 'password secret database details' }));
  assert.equal(res.code, 503); assert.doesNotMatch(JSON.stringify(res.body), /password|database details/);
  assert.equal((await guard(undefined, database(null), false)).passed, true);
});
test('password policy applies Unicode length and bcrypt UTF-8 byte ceiling', () => {
  assert.equal(passwordError('a sufficiently long passphrase'), null);
  for (const value of [undefined, {}, 'short', 'a'.repeat(73), '😀'.repeat(20)]) assert.equal(typeof passwordError(value), 'string');
  assert.equal(passwordError('a'.repeat(72)), null);
});
test('session JWT fingerprint is keyed and does not disclose password hash', () => {
  assert.notEqual(sessionVersion('hash', secret), sessionVersion('hash', 'another-secret'));
  assert.match(sessionVersion('hash'), /^[a-f0-9]{64}$/);
});
test('uploads decode and normalize valid JPG, PNG and WebP', async () => {
  for (const format of ['jpeg', 'png', 'webp']) {
    const source = await sharp({ create: { width: 12, height: 10, channels: 3, background: 'blue' } }).toFormat(format).toBuffer();
    const output = await normalizeImage(source, `image/${format}`);
    const metadata = await sharp(output).metadata();
    assert.equal(metadata.format, 'webp'); assert.equal(metadata.width, 12); assert.equal(metadata.height, 10);
    assert.equal(metadata.exif, undefined);
  }
});
test('uploads reject spoofed MIME, corrupt data, huge bytes and excessive dimensions', async () => {
  const valid = await sharp({ create: { width: 1, height: 1, channels: 3, background: 'red' } }).png().toBuffer();
  const wide = await sharp({ create: { width: 4097, height: 1, channels: 3, background: 'red' } }).png().toBuffer();
  for (const [bytes, mime] of [[valid, 'image/jpeg'], [Buffer.from('<svg/>'), 'image/png'], [valid.subarray(0, 20), 'image/png'], [Buffer.alloc(5 * 1024 * 1024 + 1), 'image/png'], [wide, 'image/png']]) await assert.rejects(normalizeImage(bytes, mime));
});
test('upload concurrency releases slots on disconnect and finish exactly once', () => {
  const { EventEmitter } = require('node:events'); const slots = [];
  for (let i = 0; i < 4; i++) { const res = new EventEmitter(); let called = false; uploadSlot({}, res, () => { called = true; }); assert(called); slots.push(res); }
  const rejected = response(); uploadSlot({}, rejected, () => assert.fail('over capacity')); assert.equal(rejected.code, 429);
  for (const res of slots) { res.emit('close'); res.emit('finish'); }
  const res = new EventEmitter(); let called = false; uploadSlot({}, res, () => { called = true; }); assert(called); res.emit('finish');
});
test('outbound fetch composes caller cancellation with a bounded deadline', async () => {
  const original = global.fetch; let signal;
  global.fetch = async (url, options) => { signal = options.signal; return {}; };
  try { const controller = new AbortController(); await boundedFetch('https://fixture.invalid', { signal: controller.signal }); assert(signal); controller.abort(); assert(signal.aborted); } finally { global.fetch = original; }
});
test('CSP permits authored inline scripts by hash, and rejects arbitrary inline/eval', () => {
  const { policies } = require('../middleware/contentSecurityPolicy');
  for (const [name, policy] of policies) {
    const source = fs.readFileSync(path.join(__dirname, '../frontend', name), 'utf8');
    const scriptDirective = policy.split('; ').find(value => value.startsWith('script-src '));
    assert(!scriptDirective.includes("'unsafe-inline'")); assert(!scriptDirective.includes("'unsafe-eval'"));
    for (const match of source.matchAll(/<script\b([^>]*)>([\s\S]*?)<\/script\s*>/gi)) {
      if (/\bsrc\s*=/i.test(match[1]) || !match[2].trim()) continue;
      const hash = crypto.createHash('sha256').update(match[2].replace(/\r\n?/g, '\n')).digest('base64');
      assert(scriptDirective.includes(hash), name);
    }
    assert(policy.includes("object-src 'none'")); assert(policy.includes("frame-ancestors 'none'"));
    assert(Buffer.byteLength(policy) < 16000, `${name} header too large`);
  }
});
test('runtime pins agree and every authored inline script compiles', () => {
  const root = path.join(__dirname, '..');
  assert.equal(require('../package.json').engines.node, '24.22.1');
  for (const file of ['.node-version', '.nvmrc']) assert.equal(fs.readFileSync(path.join(root, file), 'utf8').trim(), '24.22.1');
  assert.match(fs.readFileSync(path.join(root, 'render.yaml'), 'utf8'), /buildCommand: npm ci/);
  const vm = require('node:vm');
  for (const file of fs.readdirSync(path.join(root, 'frontend')).filter(name => name.endsWith('.html'))) {
    const html = fs.readFileSync(path.join(root, 'frontend', file), 'utf8');
    for (const match of html.matchAll(/<script\b([^>]*)>([\s\S]*?)<\/script\s*>/gi)) {
      if (!/\bsrc\s*=|application\/ld\+json/i.test(match[1])) new vm.Script(match[2], { filename: file });
    }
  }
});
test('security logging drops SDK credentials, passwords and raw provider diagnostics', () => {
  const log = require('../services/securityLog'); const original = console.error; let captured;
  console.error = (...values) => { captured = JSON.stringify(values); };
  try { log.error('Private label', { config: { headers: { authorization: 'PRIVATE_TOKEN' } }, password: 'PRIVATE_PASSWORD', message: 'PRIVATE_DATABASE' }); } finally { console.error = original; }
  assert(!captured.includes('PRIVATE_')); assert(captured.includes('internal_error'));
});
test('delegated CSP actions pass data as arguments and ignore arbitrary action names', () => {
  const vm = require('node:vm'); let handler, received;
  vm.runInNewContext(fs.readFileSync(path.join(__dirname, '../frontend/security-actions.js'), 'utf8'), {
    document: { addEventListener(event, fn) { handler = fn; } },
    window: { quickStatus: (...args) => { received = args; } }
  });
  handler({ target: { closest: () => ({ dataset: { securityAction: 'quickStatus', arg1: 'fixture-id', arg2: 'resolved' } }) } });
  assert.deepEqual(received, ['fixture-id', 'resolved']);
  received = undefined;
  handler({ target: { closest: () => ({ dataset: { securityAction: 'constructor', arg1: 'malicious code' } }) } });
  assert.equal(received, undefined);
});
