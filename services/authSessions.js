'use strict';
const crypto = require('node:crypto');
const jwt = require('jsonwebtoken');
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
class AuthError extends Error {
  constructor(code, status = 401) {
    super(code); this.code = code; this.status = status;
  }
}
const hash = value => crypto.createHash('sha256').update(value).digest('hex');
function equal(a, b) {
  if(typeof a!=='string'||typeof b!=='string')return false;
  const left=Buffer.from(a),right=Buffer.from(b);
  return left.length===right.length&&crypto.timingSafeEqual(left,right);
}
function createAuthSessions({ db, secret, now = Date.now }) {
  if (typeof secret !== 'string' || !secret) throw new Error('JWT_SECRET is required');
  const key = purpose => crypto.createHmac('sha256', secret).update('samarth-auth-v1:' + purpose).digest();
  const mac = (purpose, text) => crypto.createHmac('sha256', key(purpose)).update(text).digest('base64url');
  const envelope = (sid, generation, value) => {
    const payload = `v1.${sid}.${generation}.${value}`;
    return payload + '.' + mac('envelope', payload);
  };
  function parse(raw) {
    if (typeof raw !== 'string' || raw.length > 256) throw new AuthError('auth_refresh_invalid');
    const parts = raw.split('.');
    if (parts.length !== 5 || parts[0] !== 'v1' || !UUID.test(parts[1]) ||
        !/^(0|[1-9][0-9]{0,15})$/.test(parts[2]) || !/^[a-f0-9]{64}$/.test(parts[3]) ||
        !/^[A-Za-z0-9_-]{43}$/.test(parts[4]) || !equal(parts[4], mac('envelope', parts.slice(0,4).join('.')))) {
      throw new AuthError('auth_refresh_invalid');
    }
    const generation = Number(parts[2]);
    if (!Number.isSafeInteger(generation) || generation >= Number.MAX_SAFE_INTEGER) throw new AuthError('auth_refresh_invalid');
    return { sid: parts[1], generation, value: parts[3] };
  }
  async function rpc(name, args) {
    try {
      const { data, error } = await db.rpc('samarth_auth_' + name, args);
      if (error || !data || typeof data.state !== 'string') throw new AuthError('auth_unavailable', 503);
      return data;
    } catch (_) { throw new AuthError('auth_unavailable', 503); }
  }
  function access(user, session) {
    const remaining = Math.floor((Date.parse(session.absolute_expires_at) - now()) / 1000);
    if (!Number.isFinite(remaining) || remaining <= 0) throw new AuthError('auth_expired');
    return jwt.sign({ id: user.id, email: user.email, sid: session.session_id,
      tv: session.token_version }, secret, { algorithm: 'HS256', expiresIn: Math.min(900, remaining) });
  }
  async function user(id) {
    try {
      const { data, error } = await db.from('users').select('id,name,email,phone,profile_photo_url,created_at').eq('id', id).maybeSingle();
      if (error) throw new AuthError('auth_unavailable', 503);
      if (!data) throw new AuthError('auth_revoked');
      return data;
    } catch (error) { if (error instanceof AuthError) throw error; throw new AuthError('auth_unavailable', 503); }
  }
  async function create(account) {
    const sid = crypto.randomUUID(), value = crypto.randomBytes(32).toString('hex');
    const result = await rpc('create_session', { p_user_id: account.id, p_session_id: sid,
      p_refresh_hash: hash(value), p_expected_password_hash: account.password });
    if (result.state !== 'created') throw new AuthError(result.state === 'disabled' ? 'auth_disabled' : 'auth_credentials_changed');
    return { token: access(account, result), refresh: envelope(sid,0,value), user: await user(account.id), absolute: result.absolute_expires_at };
  }
  async function refresh(raw) {
    const parsed = parse(raw); // Authenticate envelope BEFORE any database mutation.
    const next = crypto.createHmac('sha256', key('successor')).update(`${parsed.sid}.${parsed.generation + 1}.${parsed.value}`).digest('hex');
    const result = await rpc('rotate_session', { p_session_id: parsed.sid, p_presented_hash: hash(parsed.value),
      p_next_hash: hash(next), p_generation: parsed.generation });
    if (!['current','previous','rotated'].includes(result.state)) {
      throw new AuthError(result.state === 'expired' ? 'auth_expired' : 'auth_revoked');
    }
    const account = await user(result.user_id);
    const generation = parsed.generation + (result.state === 'current' ? 0 : 1);
    if (result.refresh_generation !== generation || result.session_id !== parsed.sid) throw new AuthError('auth_unavailable',503);
    return { token: access(account,result), refresh: envelope(parsed.sid,generation,result.state === 'current' ? parsed.value : next),
      user: account, absolute: result.absolute_expires_at };
  }
  function decode(token, ignoreExpiration = false) {
    try {
      const value = jwt.verify(token, secret, { algorithms: ['HS256'], ignoreExpiration });
      if (!UUID.test(value.id) || !Number.isFinite(value.exp) || (value.sid !== undefined && (!UUID.test(value.sid) || !Number.isSafeInteger(value.tv) || value.tv < 0))) throw Error();
      return value;
    } catch (error) { throw new AuthError(error.name === 'TokenExpiredError' ? 'auth_expired' : 'auth_invalid'); }
  }
  async function validate(token) {
    const decoded = decode(token);
    const result = await rpc('validate_access', { p_user_id: decoded.id,
      p_session_id: decoded.sid || null, p_token_version: decoded.sid ? decoded.tv : null });
    if (!['active','legacy'].includes(result.state)) throw new AuthError(result.state === 'disabled' ? 'auth_disabled' : result.state === 'expired' ? 'auth_expired' : 'auth_revoked');
    return decoded;
  }
  async function logout(raw, token) {
    let parsed;
    try {if(raw)parsed=parse(raw);}catch(error){if(!(error instanceof AuthError))throw error;}
    if (parsed) {
      // No rotation during logout. Bind session owner through a service-only read.
      let row;
      try { const result = await db.from('auth_sessions').select('user_id').eq('id',parsed.sid).maybeSingle();
        if(result.error) throw Error(); row=result.data;
      } catch (_) { throw new AuthError('auth_unavailable',503); }
      if(row) await rpc('revoke_session',{p_user_id:row.user_id,p_session_id:parsed.sid});
    } else if (token) {
      const decoded = decode(token,true);
      await rpc(decoded.sid ? 'revoke_session' : 'revoke_user', decoded.sid ?
        {p_user_id:decoded.id,p_session_id:decoded.sid} : {p_user_id:decoded.id,p_disabled:null});
    }
  }
  return { create, refresh, validate, logout, decode, parse, rpc,
    revokeUser: id => rpc('revoke_user',{p_user_id:id,p_disabled:null}),
    resetPassword: (resetHash,passwordHash) => rpc('reset_password',{p_reset_hash:resetHash,p_password_hash:passwordHash}) };
}
let instance;
function getAuthSessions() {
  if (!instance) {
    const {createClient}=require('@supabase/supabase-js');
    instance=createAuthSessions({db:createClient(process.env.SUPABASE_URL,process.env.SUPABASE_SERVICE_KEY,{global:{fetch:(url,init)=>fetch(url,{...init,signal:AbortSignal.timeout(10000)})}}),secret:process.env.JWT_SECRET});
  }
  return instance;
}
module.exports={createAuthSessions,getAuthSessions,AuthError,hash,equal};
