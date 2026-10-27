'use strict';
const crypto = require('node:crypto');

// This HMAC is safe to put in a signed token; never put a password hash in a JWT.
function sessionVersion(passwordHash, secret = process.env.JWT_SECRET) {
  if (!secret || typeof passwordHash !== 'string' || !passwordHash) throw new Error('Invalid session configuration');
  return crypto.createHmac('sha256', secret).update('samarthai-session-v1\0').update(passwordHash).digest('hex');
}

function passwordError(password) {
  if (typeof password !== 'string' || [...password].length < 12 || Buffer.byteLength(password, 'utf8') > 72) {
    return 'Password must contain at least 12 characters and at most 72 UTF-8 bytes';
  }
  return null;
}

async function boundedFetch(input, options = {}) {
  const deadline = AbortSignal.timeout(15000);
  return fetch(input, { ...options, signal: options.signal ? AbortSignal.any([options.signal, deadline]) : deadline });
}

function equalHex(expected, received) {
  return typeof expected === 'string' && typeof received === 'string' &&
    /^[a-f0-9]{64}$/i.test(received) && /^[a-f0-9]{64}$/i.test(expected) &&
    crypto.timingSafeEqual(Buffer.from(expected, 'hex'), Buffer.from(received, 'hex'));
}

module.exports = { sessionVersion, passwordError, boundedFetch, equalHex };
