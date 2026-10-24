'use strict';
const crypto=require('node:crypto');
const {getAuthSessions,AuthError,equal}=require('../services/authSessions');
const REFRESH='__Host-samarth_refresh', CSRF='__Host-samarth_csrf';
function cookies(req) {
  const result=Object.create(null);
  for(const item of (req.headers.cookie||'').split(';')) {
    const pos=item.indexOf('='); if(pos<0)continue;
    const name=item.slice(0,pos).trim();
    if(Object.hasOwn(result,name)) throw new AuthError('auth_cookie_invalid');
    result[name]=item.slice(pos+1).trim();
  }
  return result;
}
function cookieOptions(req) {
  const dev=process.env.NODE_ENV!=='production' && process.env.AUTH_LOCAL_HTTP==='true' &&
    ['127.0.0.1','localhost','[::1]'].includes(req.hostname);
  if(!req.secure&&!dev) throw new AuthError('auth_https_required',503);
  return {secure:!dev,httpOnly:true,sameSite:'lax',path:'/'};
}
function names(req){return cookieOptions(req).secure?{refresh:REFRESH,csrf:CSRF}:{refresh:'samarth_refresh_dev',csrf:'samarth_csrf_dev'};}
function allowedOrigins() {
  const values=[process.env.PUBLIC_APP_URL,process.env.FRONTEND_URL,'https://samarthai-backend.onrender.com'];
  if(process.env.NODE_ENV!=='production'&&process.env.AUTH_LOCAL_HTTP==='true')values.push('http://localhost:3000','http://127.0.0.1:3000');
  return new Set(values.filter(Boolean).map(value=>new URL(value).origin));
}
function sendError(res,error) {
  const status=error instanceof AuthError?error.status:503;
  const code=error instanceof AuthError?error.code:'auth_unavailable';
  const messages={auth_unavailable:'Session service temporarily unavailable. Please retry.',auth_expired:'Your session expired. Please sign in again.',auth_revoked:'This session has ended. Please sign in again.',auth_disabled:'Account access has been disabled.',auth_csrf:'Session security check failed. Reload and try again.',auth_https_required:'Secure HTTPS is required for login.'};
  if(status===503)res.set('Retry-After','5');
  return res.status(status).json({error:messages[code]||'Unable to verify this session. Please sign in again.',code});
}
function csrf(req,res,next) {
  try {
    const origin=req.headers.origin;
    if(!origin||!allowedOrigins().has(origin)||req.headers['sec-fetch-site']==='cross-site')throw new AuthError('auth_csrf',403);
    const value=cookies(req)[names(req).csrf];
    if(!value||!/^[a-f0-9]{64}$/.test(value)||!equal(value,req.headers['x-csrf-token']))throw new AuthError('auth_csrf',403);
    next();
  } catch(error){sendError(res,error);}
}
function bootstrap(req,res) {
  try {
    if((req.headers.origin&&!allowedOrigins().has(req.headers.origin))||req.headers['sec-fetch-site']==='cross-site')throw new AuthError('auth_csrf',403);
    const opts=cookieOptions(req),name=names(req).csrf;
    let value=cookies(req)[name];
    if(!value||!/^[a-f0-9]{64}$/.test(value))value=crypto.randomBytes(32).toString('hex');
    res.set('Cache-Control','no-store');res.cookie(name,value,{...opts,httpOnly:false,maxAge:30*86400000});
    return res.json({csrfToken:value});
  } catch(error){return sendError(res,error);}
}
function writeSession(req,res,session) {
  const remaining=Math.min(7*86400000,Date.parse(session.absolute)-Date.now());
  if(!(remaining>0))throw new AuthError('auth_expired');
  res.set('Cache-Control','no-store');
  res.cookie(names(req).refresh,session.refresh,{...cookieOptions(req),maxAge:remaining});
  return {token:session.token,user:session.user,expiresIn:900};
}
function clearSession(req,res){res.clearCookie(names(req).refresh,cookieOptions(req));res.set('Cache-Control','no-store');}
const publicAuth=new Set(['/session','/refresh','/login','/register','/forgot-password','/reset-password','/logout']);
async function sessionGate(req,res,next) {
  const path=req.path.toLowerCase().replace(/\/+$/,'');
  if(!path.startsWith('/api/'))return next();
  if(path.startsWith('/api/auth/')&&publicAuth.has(path.slice('/api/auth'.length)))return next();
  const header=req.headers.authorization;
  if(!header)return next(); // Existing route-level anonymous/public permissions remain authoritative.
  try {
    if(!/^Bearer \S+$/.test(header))throw new AuthError('auth_invalid');
    req.authSession=await getAuthSessions().validate(header.slice(7));return next();
  }catch(error){return sendError(res,error);}
}
module.exports={csrf,bootstrap,writeSession,clearSession,cookies,names,sendError,sessionGate};
