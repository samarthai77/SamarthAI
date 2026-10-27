'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const Module = require('node:module');
const crypto = require('node:crypto');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const sharp = require('sharp');
const { sessionVersion } = require('../services/security');
const database = require('./helpers/securityDatabase.cjs');
const uid = '11111111-1111-4111-8111-111111111111';
const other = '22222222-2222-4222-8222-222222222222';
const family = '33333333-3333-4333-8333-333333333333';
const secret = 'test-only-secret-not-a-production-credential';
Object.assign(process.env, { JWT_SECRET: secret, SUPABASE_URL: 'https://fixture.supabase.co', SUPABASE_SERVICE_KEY: 'test-fixture', GEMINI_API_KEY: 'test-fixture', RAZORPAY_KEY_ID: 'test-fixture', RAZORPAY_KEY_SECRET: 'test-payment-secret', RAZORPAY_WEBHOOK_SECRET: 'test-webhook-secret', RESEND_API_KEY: 'test-fixture', EMAIL_FROM: 'test@example.invalid' });
const initialPassword = bcrypt.hashSync('fixture password twelve', 4);
const tables = {
  users: [{ id: uid, name: 'Fixture', email: 'fixture@example.invalid', password: initialPassword, is_active: true }, { id: other, name: 'Other', password: initialPassword, is_active: true }],
  families: [{ id: family, name: 'Test family', created_by: uid }],
  family_members: [{ id: 'member-1', user_id: uid, family_id: family, name: 'Fixture', role: 'admin', is_active: true, location: 'private', location_sharing_enabled: false }],
  services: [{ id: 'service-1', user_id: uid, title: 'Fixture service', category: 'plumber', is_active: true, users: { name: 'Fixture' } }],
  subscriptions: [], payment_orders: [], payment_webhook_events: [], password_reset_tokens: [], conversations: []
};
const db = database(tables);
let providerCalls = 0, emails = [], providerSubscriptionStatus = 'cancelled', paymentStatus = 'captured';
const nativeFetch = global.fetch;
global.fetch = async (url, options) => {
  if (String(url).startsWith('http://127.0.0.1:')) return nativeFetch(url, options);
  if (String(url).startsWith('https://api.resend.com/')) { emails.push(JSON.parse(options.body)); return Response.json({ id: 'email-fixture' }); }
  if (String(url).includes('generativelanguage.googleapis.com')) { providerCalls++; return Response.json({ candidates: [{ content: { parts: [{ text: 'Fixture analysis' }] } }] }); }
  throw new Error('Unmocked outbound network call blocked');
};
const originalLoad = Module._load;
Module._load = function(request, parent, isMain) {
  if (request === '@supabase/supabase-js') return { createClient: () => db };
  if (request === 'razorpay') return class {
    api = { rq: { defaults: {} } };
    orders = { create: async options => ({ id: 'order-fixture', ...options }) };
    payments = { fetch: async id => ({ id, order_id: 'order-fixture', status: paymentStatus, amount: 19900, currency: 'INR' }) };
    invoices = { fetch: async id => ({ id, status: 'paid', amount: 19900, amount_paid: 19900, amount_due: 0, currency: 'INR', subscription_id: 'sub-known' }) };
    subscriptions = { fetch: async id => ({ id, status: providerSubscriptionStatus, plan_id: 'plan_TivCWQkgKrBgYu', current_end: Math.floor(Date.now() / 1000) + 3600 }), create: async options => ({ id: 'sub-fixture', status: 'created', ...options }) };
  };
  return originalLoad.call(this, request, parent, isMain);
};
let app;
try { app = require('../server'); } finally { Module._load = originalLoad; }
let server, base;
const makeToken = (id = uid) => jwt.sign({ id, sv: sessionVersion(tables.users.find(row => row.id === id).password) }, secret, { expiresIn: '1h' });
let bearer = makeToken();
async function request(url, { auth = bearer, method = 'GET', body, headers = {}, raw } = {}) {
  const response = await nativeFetch(base + url, { method, headers: { ...(auth ? { authorization: 'Bearer ' + auth } : {}), ...(body ? { 'content-type': 'application/json' } : {}), ...headers }, body: raw ?? (body ? JSON.stringify(body) : undefined) });
  const text = await response.text();
  let data; try { data = JSON.parse(text); } catch { data = text; }
  return { status: response.status, headers: response.headers, data };
}
test.before(async () => { server = app.listen(0, '127.0.0.1'); await new Promise(resolve => server.once('listening', resolve)); base = `http://127.0.0.1:${server.address().port}`; });
test.after(async () => { global.fetch = nativeFetch; await new Promise(resolve => server.close(resolve)); });
test('health and authored frontend pages serve without credentials', async () => {
  assert.equal((await request('/healthz', { auth: null })).status, 200);
  for (const page of ['chat.html', 'family.html', 'gps.html', 'camera.html', 'payment.html']) {
    const result = await request('/' + page, { auth: null }); assert.equal(result.status, 200); assert(result.headers.get('content-security-policy')); assert.equal(result.headers.get('x-powered-by'), null);
  }
});
test('CORS accepts the Kavach frontend and rejects unrelated origins', async () => {
  assert.equal((await request('/healthz', { auth: null, headers: { origin: 'https://samarthai.life' } })).status, 200);
  const result = await request('/healthz', { auth: null, headers: { origin: 'https://untrusted.invalid' } });
  assert.equal(result.status, 403); assert(!JSON.stringify(result.data).includes('stack'));
});
test('protected feature routes reject missing or forged authentication', async () => {
  for (const route of ['/api/auth/profile', '/api/family', '/api/sos', '/api/gps/member-1', '/api/messages', '/api/payment/status', '/api/notifications']) {
    const result = await request(route, { auth: 'forged' }); assert.equal(result.status, 401, route);
  }
});
test('profile and portfolio uploads reject unauthenticated oversized multipart before parsing', async () => {
  for (const route of ['/api/auth/profile/photo', '/api/service-portfolio/service-1']) {
    const result = await request(route, { method: 'POST', auth: null, headers: { 'content-type': 'multipart/form-data; boundary=x' }, raw: '--x\r\n' + 'x'.repeat(200000) });
    assert.equal(result.status, 401, route); assert.equal(db.uploads.length, 0);
  }
});
test('profile upload decodes a real image and stores normalized WebP', async () => {
  const form = new FormData(); const bytes = await sharp({ create: { width: 8, height: 8, channels: 3, background: 'red' } }).png().toBuffer();
  form.append('profile_photo', new Blob([bytes], { type: 'image/png' }), 'photo.png');
  const result = await request('/api/auth/profile/photo', { method: 'POST', raw: form });
  assert.equal(result.status, 200); assert.equal(db.uploads.at(-1).options.contentType, 'image/webp');
});
test('profile upload rejects MIME spoofing and too many multipart fields', async () => {
  let form = new FormData(); form.append('profile_photo', new Blob(['not an image'], { type: 'image/png' }), 'fake.png');
  assert.equal((await request('/api/auth/profile/photo', { method: 'POST', raw: form })).status, 400);
  form = new FormData(); for (let i = 0; i < 10; i++) form.append('field' + i, 'value');
  assert.equal((await request('/api/auth/profile/photo', { method: 'POST', raw: form })).status, 400);
});
test('Family returns only the current family and redacts ordinary location sharing', async () => {
  const result = await request('/api/family'); assert.equal(result.status, 200); assert.equal(result.data.family.id, family); assert.equal(result.data.members[0].location, null);
  const outside = await request('/api/family?noCreate=true', { auth: makeToken(other) }); assert.equal(outside.status, 200); assert.deepEqual(outside.data.members, []);
});
test('Family non-admin mutation is denied', async () => {
  tables.family_members.push({ id: 'member-2', user_id: other, family_id: family, name: 'Other', role: 'member', is_active: true });
  const result = await request('/api/family', { method: 'POST', auth: makeToken(other), body: { name: 'Unauthorized addition' } }); assert.equal(result.status, 403);
});
test('GPS retains fail-closed consent and family ownership checks', async () => {
  assert.equal((await request('/api/gps')).status, 200);
  assert.equal((await request('/api/gps/member-1')).status, 403);
  assert.equal((await request('/api/gps/not-in-family')).status, 404);
  assert.equal((await request('/api/gps/location-sharing', { method: 'PATCH', body: { enabled: true } })).status, 503);
});
test('SOS rejects invalid coordinates and stores a valid emergency with server-controlled contacts', async () => {
  assert.equal((await request('/api/sos', { method: 'POST', body: { latitude: 999, longitude: 0 } })).status, 400);
  const result = await request('/api/sos', { method: 'POST', body: { latitude: 25.4, longitude: 81.8, contacts: ['attacker-controlled'] } });
  assert.equal(result.status, 201); assert.equal(tables.sos_alerts[0].user_id, uid); assert(!tables.sos_alerts[0].contacts.includes('attacker-controlled'));
});
test('Scanner requires authentication, validates data and uses mocked provider', async () => {
  assert.equal((await request('/api/scanner/analyze', { method: 'POST', auth: null, body: { image: 'bad' } })).status, 401);
  assert.equal((await request('/api/scanner/analyze', { method: 'POST', body: { image: 'bad' } })).status, 400);
  const image = 'data:image/png;base64,' + Buffer.alloc(100, 1).toString('base64');
  const result = await request('/api/scanner/analyze', { method: 'POST', body: { image } }); assert.equal(result.status, 200); assert.equal(result.data.response, 'Fixture analysis'); assert.equal(providerCalls, 1);
});
test('Services listing works and owner mutation cannot target another provider', async () => {
  const list = await request('/api/services', { auth: null }); assert.equal(list.status, 200); assert.equal(list.data[0].title, 'Fixture service');
  const result = await request('/api/services/service-1', { method: 'PUT', auth: makeToken(other), body: { title: 'hijack' } }); assert([403, 404].includes(result.status)); assert.equal(tables.services[0].title, 'Fixture service');
});
test('database diagnostics and malformed/oversized bodies do not leak to clients', async () => {
  db.fail = 'services'; const result = await request('/api/services', { auth: null }); db.fail = null;
  assert.equal(result.status, 400); assert(!JSON.stringify(result.data).includes('PRIVATE_DATABASE_DETAIL'));
  assert.equal((await request('/api/auth/login', { auth: null, method: 'POST', raw: '{', headers: { 'content-type': 'application/json' } })).status, 400);
  assert.equal((await request('/api/auth/login', { auth: null, method: 'POST', body: { email: 'x'.repeat(140000) } })).status, 413);
});
test('admin dashboard failure does not expose database details or hints', async () => {
  tables.service_admins = [{ id: 'admin-fixture', user_id: uid, is_active: true }];
  db.fail = 'app_installs';
  const result = await request('/api/admin/dashboard');
  db.fail = null;
  assert.equal(result.status, 500); assert.equal(result.data.details, undefined);
  assert(!JSON.stringify(result.data).includes('PRIVATE_DATABASE_DETAIL'));
});
test('Register enforces password policy, preserves existing accounts and issues a revocable JWT', async () => {
  assert.equal((await request('/api/auth/register', { auth: null, method: 'POST', body: { name: 'New', email: 'new@example.invalid', password: 'short' } })).status, 400);
  const result = await request('/api/auth/register', { auth: null, method: 'POST', body: { name: 'New', email: 'new@example.invalid', password: 'new secure passphrase' } });
  assert.equal(result.status, 201); const saved = tables.users.find(row => row.email === 'new@example.invalid'); assert(await bcrypt.compare('new secure passphrase', saved.password)); assert.equal(jwt.verify(result.data.token, secret).sv, sessionVersion(saved.password));
});
test('Login accepts existing passwords and reset revokes JWTs immediately', async () => {
  const login = await request('/api/auth/login', { auth: null, method: 'POST', body: { email: 'fixture@example.invalid', password: 'fixture password twelve' } }); assert.equal(login.status, 200); assert.equal(login.headers.get('cache-control'), 'no-store'); assert.equal(login.headers.get('referrer-policy'), 'no-referrer');
  const raw = 'a'.repeat(64); tables.password_reset_tokens.push({ id: 'reset-1', user_id: uid, token_hash: crypto.createHash('sha256').update(raw).digest('hex'), expires_at: new Date(Date.now() + 60000).toISOString(), used_at: null });
  const reset = await request('/api/auth/reset-password', { auth: null, method: 'POST', body: { token: raw, password: 'new fixture passphrase' } }); assert.equal(reset.status, 200);
  assert.equal((await request('/api/auth/profile', { auth: login.data.token })).status, 401);
  const again = await request('/api/auth/reset-password', { auth: null, method: 'POST', body: { token: raw, password: 'another safe passphrase' } }); assert.equal(again.status, 400);
  bearer = makeToken(); assert.equal((await request('/api/auth/profile')).status, 200);
});
test('Forgot password uses a generic response and mocked email without disclosing account existence', async () => {
  const known = await request('/api/auth/forgot-password', { auth: null, method: 'POST', body: { email: 'fixture@example.invalid' } });
  const unknown = await request('/api/auth/forgot-password', { auth: null, method: 'POST', body: { email: 'unknown@example.invalid' } });
  assert.equal(known.status, 200); assert.deepEqual(known.data, unknown.data); assert.equal(emails.length, 1);
});
test('Razorpay order amount is server-controlled and cross-user verification is denied', async () => {
  const created = await request('/api/payment/create-order', { method: 'POST', body: { planId: 'basic', amount: 1 } }); assert.equal(created.status, 201); assert.equal(tables.payment_orders[0].amount_paise, 19900);
  const signature = crypto.createHmac('sha256', process.env.RAZORPAY_KEY_SECRET).update('order-fixture|pay-fixture').digest('hex');
  const result = await request('/api/payment/verify', { method: 'POST', auth: makeToken(other), body: { razorpay_order_id: 'order-fixture', razorpay_payment_id: 'pay-fixture', razorpay_signature: signature } }); assert.equal(result.status, 404);
});
test('Razorpay signature rejects tampering and valid payment is idempotent', async () => {
  const body = { razorpay_order_id: 'order-fixture', razorpay_payment_id: 'pay-fixture', razorpay_signature: '0'.repeat(64) };
  assert.equal((await request('/api/payment/verify', { method: 'POST', body })).status, 400);
  body.razorpay_signature = crypto.createHmac('sha256', process.env.RAZORPAY_KEY_SECRET).update('order-fixture|pay-fixture').digest('hex');
  paymentStatus = 'authorized';
  assert.equal((await request('/api/payment/verify', { method: 'POST', body })).status, 409);
  paymentStatus = 'captured';
  assert.equal((await request('/api/payment/verify', { method: 'POST', body })).status, 200);
  assert.equal((await request('/api/payment/verify', { method: 'POST', body })).status, 200);
});
test('Webhook authenticates exact raw bytes, rejects forgery and ignores unsigned event-id changes', async () => {
  const raw = JSON.stringify({ event: 'subscription.cancelled', payload: { subscription: { entity: { id: 'sub-known', status: 'cancelled' } } } });
  tables.subscriptions.push({ id: 'local-sub', user_id: uid, plan_id: 'basic', provider_subscription_id: 'sub-known', status: 'active' });
  const headers = { 'content-type': 'application/json', 'x-razorpay-signature': '0'.repeat(64) };
  assert.equal((await request('/api/payment/webhook', { auth: null, method: 'POST', raw, headers })).status, 400);
  headers['x-razorpay-signature'] = crypto.createHmac('sha256', process.env.RAZORPAY_WEBHOOK_SECRET).update(raw).digest('hex');
  assert.equal((await request('/api/payment/webhook', { auth: null, method: 'POST', raw: raw + ' ', headers })).status, 400);
  assert.equal((await request('/api/payment/webhook', { auth: null, method: 'POST', raw, headers })).status, 200);
  headers['x-razorpay-event-id'] = 'changed-header';
  const replay = await request('/api/payment/webhook', { auth: null, method: 'POST', raw, headers }); assert.equal(replay.status, 200); assert.match(replay.data.message, /already processed/); assert.equal(tables.payment_webhook_events.length, 1);
});
test('authenticated subscription does not grant paid access; active future subscription does', async () => {
  tables.subscriptions = [{ id: 'sub-local', user_id: uid, plan_id: 'basic', status: 'authenticated', current_end: new Date(Date.now() + 60000).toISOString() }];
  assert.equal((await request('/api/payment/status')).data.isPaid, false);
  tables.subscriptions[0].status = 'active'; assert.equal((await request('/api/payment/status')).data.isPaid, true);
  tables.subscriptions[0].current_end = new Date(Date.now() - 60000).toISOString(); assert.equal((await request('/api/payment/status')).data.isPaid, false);
});
test('no referral backend is present: report as absent rather than claim a passing referral test', () => {
  const fs = require('node:fs'); const path = require('node:path');
  const sources = fs.readdirSync(path.join(__dirname, '../routes')).filter(file => file.endsWith('.js')).map(file => fs.readFileSync(path.join(__dirname, '../routes', file), 'utf8')).join('\n');
  assert(!/\breferral\b/i.test(sources));
});

test('late activation webhook cannot reactivate a provider-cancelled subscription', async () => {
  tables.subscriptions = [{ id: 'late-sub', user_id: uid, plan_id: 'basic', provider_subscription_id: 'sub-known', status: 'cancelled' }];
  const raw = JSON.stringify({ event: 'subscription.activated', payload: { subscription: { entity: { id: 'sub-known', status: 'active' } } } });
  const signature = crypto.createHmac('sha256', process.env.RAZORPAY_WEBHOOK_SECRET).update(raw).digest('hex');
  const result = await request('/api/payment/webhook', { auth: null, method: 'POST', raw, headers: { 'content-type': 'application/json', 'x-razorpay-signature': signature } });
  assert.equal(result.status, 200); assert.equal(tables.subscriptions[0].status, 'cancelled');
});
test('paid invoice cannot reactivate cancelled subscription; current paid billing period can activate', async () => {
  const raw = JSON.stringify({ event: 'invoice.paid', payload: { invoice: { entity: { id: 'inv-known' } } } });
  const signature = crypto.createHmac('sha256', process.env.RAZORPAY_WEBHOOK_SECRET).update(raw).digest('hex');
  const opts = { auth: null, method: 'POST', raw, headers: { 'content-type': 'application/json', 'x-razorpay-signature': signature } };
  assert.equal((await request('/api/payment/webhook', opts)).status, 409);
  providerSubscriptionStatus = 'active';
  assert.equal((await request('/api/payment/webhook', opts)).status, 200);
  assert.equal(tables.subscriptions[0].status, 'active');
  assert(Date.parse(tables.subscriptions[0].current_end) > Date.now());
});
