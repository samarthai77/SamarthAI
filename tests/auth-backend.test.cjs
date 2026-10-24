const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const jwt=require('jsonwebtoken'),bcrypt=require('bcryptjs'),express=require('express');
const {createAuthSessions,AuthError,hash,equal}=require('../services/authSessions');
const modules=process.env.AUTH_TEST_NODE_MODULES;
const integration=test.describe;
const root=path.resolve(__dirname,'..'),u='11111111-1111-4111-8111-111111111111',secret='synthetic-test-key-not-a-production-secret';
function load(file,stubs){const m={exports:{}};const fn=vm.runInThisContext('(function(require,module,exports){'+fs.readFileSync(path.join(root,file),'utf8')+'\n})',{filename:file});fn(name=>stubs[name]||require(name.startsWith('.')?path.resolve(root,path.dirname(file),name):name),m,m.exports);return m.exports;}
test('constant-time comparison rejects unicode and mismatched lengths without throwing',()=>{assert.equal(equal('a'.repeat(64),'é'.repeat(64)),false);assert.equal(equal('abc','abc'),true);assert.equal(equal(null,'x'),false);});
test('invalid, forged and unsigned refresh envelopes never reach the database',async()=>{
 let calls=0;const auth=createAuthSessions({secret,db:{rpc:async()=>{calls++;throw Error();}}});
 for(const raw of ['',null,'v1.bad.0.secret.mac','v1.'+u+'.0.'+'a'.repeat(64)+'.'+'b'.repeat(43)])await assert.rejects(auth.refresh(raw),e=>e.code==='auth_refresh_invalid');assert.equal(calls,0);
});
test('JWT algorithm, missing expiry, invalid UUID and expired signature fail before DB access',async()=>{
 const auth=createAuthSessions({secret,db:{rpc(){throw Error('must not call');}}});
 for(const token of [jwt.sign({id:u},secret),jwt.sign({id:'bad'},secret,{expiresIn:900}),jwt.sign({id:u},secret,{algorithm:'HS384',expiresIn:900}),jwt.sign({id:u},secret,{expiresIn:-1})])await assert.rejects(auth.validate(token),e=>e.status===401);
});
integration('backend with actual isolated PostgreSQL', {skip:!modules},()=>{
 const {Pool}=require(path.join(modules,'pg'));let admin,pool,db,auth,http,base,csrf,cookieJar={},rpcCalls=0,outage=false;
 const cfg={host:'127.0.0.1',port:Number(process.env.AUTH_TEST_PG_PORT||55483),user:'postgres'};
 const account={id:u,email:'synthetic@example.invalid',name:'Fixture',password:null};
 async function rpc(name,args){rpcCalls++;if(outage)return {error:{code:'503'}};try{
   if(!/^samarth_auth_[a-z_]+$/.test(name))throw Error('Invalid fixture RPC');
   const keys=Object.keys(args);if(keys.some(k=>!/^p_[a-z_]+$/.test(k)))throw Error('Invalid fixture argument');
   const r=await pool.query(`SELECT public.${name}(${keys.map((k,i)=>k+' => $'+(i+1)).join(',')}) result`,Object.values(args));return {data:r.rows[0].result};
 }catch(error){return {error:{code:error.code}};}}
 function from(table){
   if(!['users','auth_sessions','password_reset_tokens'].includes(table))throw Error('Unexpected fixture table');
   let columns='*',where=[],values=[],limit='',order='',insert=null;
   const q={select(c='*'){if(!/^[a-z_, *]+$/.test(c))throw Error('columns');columns=c;return q;},eq(k,v){if(!/^[a-z_]+$/.test(k))throw Error('column');values.push(v);where.push(k+'=$'+values.length);return q;},order(){order=' ORDER BY created_at DESC';return q;},limit(n){limit=' LIMIT '+Number(n);return q;},insert(value){insert=Array.isArray(value)?value[0]:value;return q;},single(){return run(true);},maybeSingle(){return run(true);},then(resolve,reject){return run(false).then(resolve,reject);}};
   async function run(single){if(outage)return {error:{code:'network'}};try{
     let r;if(insert){const keys=Object.keys(insert);r=await pool.query(`INSERT INTO ${table}(${keys.join(',')}) VALUES(${keys.map((_,i)=>'$'+(i+1)).join(',')}) RETURNING ${columns}`,Object.values(insert));}
     else r=await pool.query(`SELECT ${columns} FROM ${table}${where.length?' WHERE '+where.join(' AND '):''}${order}${limit}`,values);
     return {data:single?r.rows[0]||null:r.rows,error:null};
   }catch(error){return {error:{code:error.code}};}}
   return q;
 }
 async function clean(){outage=false;cookieJar={};await pool.query('TRUNCATE auth_sessions,auth_user_security,password_reset_tokens;');await pool.query('UPDATE users SET password=$1',[account.password]);}
 async function request(route,{method='GET',body,headers={},jar=true}={}){
   const response=await fetch(base+route,{method,headers:{Origin:'https://samarthai-backend.onrender.com','X-Forwarded-Proto':'https',...(jar?{Cookie:Object.entries(cookieJar).map(([k,v])=>k+'='+v).join(';')} :{}),...headers},body:body===undefined?undefined:JSON.stringify(body)});
   if(jar)for(const item of response.headers.getSetCookie()){const [pair]=item.split(';'),pos=pair.indexOf('=');cookieJar[pair.slice(0,pos)]=pair.slice(pos+1);}
   return response;
 }
 async function bootstrap(){const r=await request('/api/auth/session');csrf=(await r.json()).csrfToken;return r;}
 const security=()=>({'Content-Type':'application/json','X-CSRF-Token':csrf});
 test.before(async()=>{
   process.env.JWT_SECRET=secret;process.env.NODE_ENV='production';process.env.PUBLIC_APP_URL='https://samarthai-backend.onrender.com';
   admin=new Pool({...cfg,database:'postgres'});await admin.query('DROP DATABASE IF EXISTS auth_backend_fixture');await admin.query('CREATE DATABASE auth_backend_fixture');
   pool=new Pool({...cfg,database:'auth_backend_fixture'});
   await pool.query('CREATE TABLE users(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),name text,email text UNIQUE,password text,phone text,profile_photo_url text,created_at timestamptz DEFAULT now()); CREATE TABLE password_reset_tokens(id bigserial PRIMARY KEY,user_id uuid REFERENCES users(id),token_hash text UNIQUE,expires_at timestamptz,used_at timestamptz);');
   account.password=await bcrypt.hash('fixture-password',10);await pool.query('INSERT INTO users(id,name,email,password) VALUES($1,$2,$3,$4)',[u,account.name,account.email,account.password]);
   await pool.query(fs.readFileSync(path.join(root,'docs/sql/auth-session-migration.sql'),'utf8'));
   db={rpc,from};auth=createAuthSessions({secret,db});
   const services={getAuthSessions:()=>auth,AuthError,equal};
   const middleware=load('middleware/authSession.js',{'../services/authSessions':services});
   const router=load('routes/auth.js',{'@supabase/supabase-js':{createClient:()=>db},'../services/authSessions':services,'../middleware/authSession':middleware});
   const app=express();app.set('trust proxy',1);app.use(express.json());app.use(middleware.sessionGate);app.use('/api/auth',router);
   app.get('/api/private',(req,res)=>res.json({id:req.authSession?.id}));
   http=app.listen(0,'127.0.0.1');await new Promise(resolve=>http.once('listening',resolve));base='http://127.0.0.1:'+http.address().port;
 });
 test.after(async()=>{if(http)await new Promise(r=>http.close(r));if(pool)await pool.end();if(admin)await admin.end();});
 test.beforeEach(clean);
 test('create session issues 15 minute JWT, hashes only, and whitelisted user fields',async()=>{
   const session=await auth.create(account),decoded=jwt.verify(session.token,secret);assert.equal(decoded.exp-decoded.iat,900);assert.equal(decoded.id,u);assert.equal(session.user.password,undefined);
   const row=(await pool.query('SELECT * FROM auth_sessions')).rows[0];assert.equal(row.refresh_hash,hash(auth.parse(session.refresh).value));assert(!JSON.stringify(row).includes(auth.parse(session.refresh).value));
 });
 test('MAC binds session UUID, generation and secret before RPC',async()=>{
   const session=await auth.create(account),parts=session.refresh.split('.');const before=rpcCalls;
   for(const [i,value] of [[1,'22222222-2222-4222-8222-222222222222'],[2,'1'],[3,'b'.repeat(64)],[4,'A'.repeat(43)]]){const forged=[...parts];forged[i]=value;await assert.rejects(auth.refresh(forged.join('.')),e=>e.code==='auth_refresh_invalid');}assert.equal(rpcCalls,before);
 });
 test('parallel refreshes and process-service restart return identical successor',async()=>{
   const session=await auth.create(account),other=createAuthSessions({secret,db});const results=await Promise.all([auth.refresh(session.refresh),other.refresh(session.refresh),auth.refresh(session.refresh)]);
   assert(results.every(x=>x.refresh===results[0].refresh));assert.equal(auth.parse(results[0].refresh).generation,1);assert.equal((await other.refresh(results[0].refresh)).refresh,results[0].refresh);
 });
 test('lost refresh completion recovers during grace without another generation',async()=>{
   const session=await auth.create(account);const lost=await auth.refresh(session.refresh);const recovered=await auth.refresh(session.refresh);assert.equal(recovered.refresh,lost.refresh);
 });
 test('old refresh replay after grace revokes JWT access',async()=>{
   const session=await auth.create(account);await auth.refresh(session.refresh);await pool.query("UPDATE auth_sessions SET previous_valid_until=clock_timestamp()-interval '1 second'");await assert.rejects(auth.refresh(session.refresh),e=>e.code==='auth_revoked');await assert.rejects(auth.validate(session.token),e=>e.code==='auth_revoked');
 });
 test('logout revokes one session; global revocation revokes all and legacy JWTs',async()=>{
   const one=await auth.create(account),two=await auth.create(account);await auth.logout(one.refresh,one.token);await assert.rejects(auth.validate(one.token));await auth.validate(two.token);await auth.revokeUser(u);await assert.rejects(auth.validate(two.token));await assert.rejects(auth.validate(jwt.sign({id:u},secret,{expiresIn:3600})));
 });
 test('invalid refresh cookie still permits logout via a verified JWT',async()=>{const session=await auth.create(account);await auth.logout('corrupt',session.token);await assert.rejects(auth.validate(session.token));});
 test('account disabled sessions fail closed',async()=>{const session=await auth.create(account);await auth.rpc('revoke_user',{p_user_id:u,p_disabled:true});await assert.rejects(auth.validate(session.token),e=>e.code==='auth_disabled');await assert.rejects(auth.refresh(session.refresh));await assert.rejects(auth.create(account),e=>e.code==='auth_disabled');});
 test('deleted user loses JWT access and refresh session through FK cascade',async()=>{const other={...account,id:'77777777-7777-4777-8777-777777777777',email:'other@example.invalid'};await pool.query('INSERT INTO users(id,name,email,password) VALUES($1,$2,$3,$4)',[other.id,other.name,other.email,other.password]);const session=await auth.create(other);await pool.query('DELETE FROM users WHERE id=$1',[other.id]);await assert.rejects(auth.validate(session.token),e=>e.code==='auth_revoked');await assert.rejects(auth.refresh(session.refresh));});
 test('network/database failure is 503 and does not revoke or erase state',async()=>{const session=await auth.create(account);outage=true;await assert.rejects(auth.refresh(session.refresh),e=>e.status===503);await assert.rejects(auth.validate(session.token),e=>e.status===503);outage=false;await auth.validate(session.token);});
 test('password reset atomically revokes every session and consumes reset token',async()=>{const session=await auth.create(account);const raw='d'.repeat(64);await pool.query("INSERT INTO password_reset_tokens(user_id,token_hash,expires_at) VALUES($1,$2,now()+interval '15 minutes')",[u,hash(raw)]);await auth.resetPassword(hash(raw),await bcrypt.hash('new-password',12));await assert.rejects(auth.validate(session.token));assert.equal((await auth.resetPassword(hash(raw),account.password)).state,'invalid');assert.equal((await auth.create(account).catch(e=>e)).code,'auth_credentials_changed');});
 test('bootstrap sets host-only secure CSRF cookie; refresh secret never returned in JSON',async()=>{
   const bootstrapResponse=await bootstrap();assert(bootstrapResponse.headers.getSetCookie()[0].includes('__Host-samarth_csrf='));assert(bootstrapResponse.headers.getSetCookie()[0].includes('Secure'));assert(!bootstrapResponse.headers.getSetCookie()[0].includes('Domain='));
   const r=await request('/api/auth/login',{method:'POST',headers:security(),body:{email:account.email,password:'fixture-password'}});assert.equal(r.status,200);const data=await r.json();assert(data.token);assert.equal(data.refresh,undefined);assert(!JSON.stringify(data).includes('password'));const cookie=r.headers.getSetCookie().find(x=>x.startsWith('__Host-samarth_refresh='));assert(cookie.includes('HttpOnly'));assert(cookie.includes('Secure'));assert(cookie.includes('SameSite=Lax'));assert(cookie.includes('Path=/'));assert.equal(r.headers.get('cache-control'),'no-store');
 });
 test('missing/forged CSRF and foreign/missing Origin cannot rotate a cookie',async()=>{
   await bootstrap();for(const headers of [{Origin:'https://evil.invalid','X-CSRF-Token':csrf},{Origin:'','X-CSRF-Token':csrf},{'X-CSRF-Token':'z'.repeat(64)},{}]){const before=rpcCalls;assert.equal((await request('/api/auth/refresh',{method:'POST',headers})).status,403);assert.equal(rpcCalls,before);}
 });
 test('expired access returns structured 401 before protected route side effects',async()=>{const session=await auth.create(account),d=jwt.decode(session.token),expired=jwt.sign({id:u,sid:d.sid,tv:d.tv},secret,{expiresIn:-1});const r=await request('/api/private',{headers:{Authorization:'Bearer '+expired}});assert.equal(r.status,401);assert.equal((await r.json()).code,'auth_expired');});
 test('case-insensitive Express paths cannot bypass session revocation',async()=>{const session=await auth.create(account);await auth.revokeUser(u);const r=await request('/API/PRIVATE',{headers:{Authorization:'Bearer '+session.token}});assert.equal(r.status,401);assert.equal((await r.json()).code,'auth_revoked');});
 test('refresh works with expired Bearer, rotates cookie and restores profile',async()=>{await bootstrap();const session=await auth.create(account);cookieJar.__Host_samarth_unused='ignored';cookieJar['__Host-samarth_refresh']=session.refresh;const r=await request('/api/auth/refresh',{method:'POST',headers:{...security(),Authorization:'Bearer expired'}});assert.equal(r.status,200);const data=await r.json();await auth.validate(data.token);assert.equal((await request('/api/auth/profile',{headers:{Authorization:'Bearer '+data.token}})).status,200);});
 test('logout endpoint revokes server state and expires refresh cookie',async()=>{await bootstrap();const session=await auth.create(account);cookieJar['__Host-samarth_refresh']=session.refresh;const r=await request('/api/auth/logout',{method:'POST',headers:security()});assert.equal(r.status,200);assert(r.headers.getSetCookie()[0].includes('Expires=Thu, 01 Jan 1970'));await assert.rejects(auth.validate(session.token));});
 test('logout-all uses verified identity, never a supplied user ID',async()=>{await bootstrap();const session=await auth.create(account);const r=await request('/api/auth/logout-all',{method:'POST',body:{userId:'22222222-2222-4222-8222-222222222222'},headers:{...security(),Authorization:'Bearer '+session.token}});assert.equal(r.status,200);await assert.rejects(auth.validate(session.token));});
 test('refresh outage keeps cookie and exposes no database exception',async()=>{await bootstrap();const session=await auth.create(account);cookieJar['__Host-samarth_refresh']=session.refresh;outage=true;const r=await request('/api/auth/refresh',{method:'POST',headers:security()});assert.equal(r.status,503);assert.equal(r.headers.getSetCookie().length,0);assert.equal((await r.json()).code,'auth_unavailable');});
 test('HTTP cookie issuance is refused in production',async()=>{const r=await request('/api/auth/session',{headers:{'X-Forwarded-Proto':'http'}});assert.equal(r.status,503);assert.equal(r.headers.getSetCookie().length,0);});
 test('password-reset HTTP flow invokes atomic reset and rejects token reuse',async()=>{await bootstrap();const session=await auth.create(account),raw='e'.repeat(64);await pool.query("INSERT INTO password_reset_tokens(user_id,token_hash,expires_at) VALUES($1,$2,now()+interval '15 minutes')",[u,hash(raw)]);const options={method:'POST',headers:security(),body:{token:raw,password:'new-password'}};assert.equal((await request('/api/auth/reset-password',options)).status,200);await assert.rejects(auth.validate(session.token));assert.equal((await request('/api/auth/reset-password',options)).status,400);});
});
