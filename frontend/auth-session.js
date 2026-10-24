/* Shared custom-JWT session lifecycle. Refresh secrets exist only in HttpOnly cookies. */
(() => {
    'use strict';
    if (window.SamarthAuth) return;
    const backend = 'https://samarthai-backend.onrender.com';
    const api = (['localhost','127.0.0.1','samarthai-backend.onrender.com'].includes(location.hostname) ? location.origin : backend) + '/api';
    const rawFetch = window.fetch.bind(window);
    let pending = null, csrfPending = null, csrfToken = '', timer = null, blockedUntil = 0;
    let epoch = 0, memoryToken = '', ending = false, changing = false, unavailable = false;
    const lock = run => navigator.locks?.request ? navigator.locks.request('samarth-auth-refresh',run) : run();
    const read = key => { try { return localStorage.getItem(key); } catch (_) { return null; } };
    const write = (key,value) => { try { value === null ? localStorage.removeItem(key) : localStorage.setItem(key,value); } catch (_) {} };
    const token = () => read('token') || read('samarthai_token') || memoryToken;
    const payload = value => { try { return JSON.parse(atob(value.split('.')[1].replace(/-/g,'+').replace(/_/g,'/'))); } catch (_) { return {}; } };
    const valid = value => Number(payload(value).exp) * 1000 > Date.now() + 60000;
    const signal = (name,detail) => window.dispatchEvent(new CustomEvent(name,{detail}));
    function notice(message) {
        if (!document.body) { document.addEventListener('DOMContentLoaded',()=>notice(message),{once:true}); return; }
        let box=document.getElementById('sessionStatus');
        if(!message){box?.remove();return;}
        if(!box){box=document.createElement('div');box.id='sessionStatus';box.setAttribute('role','status');
            box.style.cssText='padding:10px;background:#fff3cd;color:#513c00;text-align:center';document.body.prepend(box);}
        box.textContent=message+' ';
        const retry=document.createElement('button');retry.type='button';retry.textContent='Retry session';
        retry.onclick=()=>restore().then(ok=>{if(ok)location.reload();});box.appendChild(retry);
    }
    function clear(redirect=true) {
        epoch++;unavailable=false;memoryToken='';write('token',null);write('samarthai_token',null);write('user',null);
        clearTimeout(timer);signal('samarth:session-ended');
        const page=location.pathname.split('/').pop()||'index.html';
        if(redirect&&!['index.html','login.html','register.html','forgot-password.html','reset-password.html','privacy-policy.html'].includes(page))location.href='login.html';
    }
    function schedule() {
        clearTimeout(timer);
        const expiry=Number(payload(token()).exp)*1000;
        if(!expiry||document.hidden)return;
        timer=setTimeout(()=>restore(),Math.max(1000,expiry-Date.now()-60000));
    }
    function accept(data) {
        if(typeof data.token!=='string'||!data.user?.id)throw Error('Invalid session response');
        unavailable=false;memoryToken=data.token;write('token',data.token);write('samarth_session_ended',null);
        write('user',JSON.stringify(data.user));notice('');schedule();signal('samarth:session-ready');
    }
    async function timedFetch(url,init) {
        const controller=new AbortController(),timeout=setTimeout(()=>controller.abort(),12000);
        try{return await rawFetch(url,{...init,credentials:'include',cache:'no-store',signal:controller.signal});}
        finally{clearTimeout(timeout);}
    }
    async function csrf() {
        if(csrfToken)return csrfToken;
        if(!csrfPending)csrfPending=(async()=>{
            const response=await timedFetch(api+'/auth/session',{method:'GET'});
            if(!response.ok)throw Object.assign(Error('Session service unavailable'),{transient:true});
            const data=await response.json();
            if(!/^[a-f0-9]{64}$/.test(data.csrfToken))throw Error('Invalid CSRF response');
            csrfToken=data.csrfToken;return csrfToken;
        })().finally(()=>{csrfPending=null;});
        return csrfPending;
    }
    async function refresh(force=false,observed=token()) {
        if(ending||changing)throw Object.assign(Error('Session change in progress'),{transient:true});
        if(pending)return pending;
        const startedEpoch=epoch;
        const run=async()=>{
            if(startedEpoch!==epoch)throw Error('Session changed');
            // Another tab may have refreshed while this tab waited for the Web Lock.
            if((!force||token()!==observed)&&valid(token()))return true;
            if(Date.now()<blockedUntil)throw Object.assign(Error('Session cooldown'),{transient:true});
            const response=await timedFetch(api+'/auth/refresh',{method:'POST',headers:{'X-CSRF-Token':await csrf()}});
            let data={};try{data=await response.json();}catch(_){}
            if(startedEpoch!==epoch||ending)throw Error('Session changed');
            if(!response.ok){
                if(response.status===401){
                    // A pre-migration JWT is usable only until its original expiry.
                    if(data.code==='auth_missing'&&!payload(token()).sid&&valid(token()))return true;
                    clear();throw Object.assign(Error('Session ended'),{ended:true});
                }
                if(response.status===403){csrfToken='';}
                blockedUntil=Date.now()+Math.max(5,Math.min(300,Number(response.headers.get('Retry-After'))||15))*1000;
                throw Object.assign(Error('Session temporarily unavailable'),{transient:true});
            }
            accept(data);return true;
        };
        pending=lock(run).finally(()=>{pending=null;});
        return pending;
    }
    async function restore() {
        if(read('samarth_session_ended')&&!token()){clear();return false;}
        try{const result=await refresh();unavailable=false;notice('');schedule();return result;}
        catch(error){
            if(error.ended)return false;
            unavailable=true;notice('Connection/session service is temporarily unavailable. Your login has been kept.');
            clearTimeout(timer);if(!document.hidden)timer=setTimeout(()=>restore(),Math.max(15000,blockedUntil-Date.now()));
            return null;
        }
    }
    async function logout(all=false) {
        if(ending)return false;
        if(all&&!valid(token())){try{await refresh(true);}catch(_){notice('Reconnect before signing out all sessions.');return false;}}
        if(pending)await pending.catch(()=>{});
        ending=true;epoch++;
        try{
            return await lock(async()=>{
                const headers={'X-CSRF-Token':await csrf()};if(token())headers.Authorization='Bearer '+token();
                const response=await timedFetch(api+'/auth/'+(all?'logout-all':'logout'),{method:'POST',headers});
                if(!response.ok)throw Error('Logout not confirmed');
                write('samarth_session_ended',String(Date.now()));clear(false);notice('');return true;
            });
        }catch(_){notice('Logout could not be confirmed. Reconnect and retry logout.');return false;}
        finally{ending=false;}
    }
    window.SamarthAuth={get unavailable(){return unavailable;},peekToken:token,getToken:async()=>{await window.SamarthAuth.ready;return token();},refresh,restore,logout,accept,clear};
    window.fetch=async(input,init={})=>{
        const url=new URL(typeof input==='string'||input instanceof URL?String(input):input.url,location.href);
        if(![new URL(api).origin,backend].includes(url.origin)||!url.pathname.startsWith('/api/'))return rawFetch(input,init);
        const authPath=url.pathname.slice('/api/auth/'.length);
        const publicAuth=url.pathname.startsWith('/api/auth/')&&['session','login','register','forgot-password','reset-password','refresh','logout'].includes(authPath);
        const method=(init.method||(input instanceof Request?input.method:'GET')).toUpperCase();
        const template=new Request(input instanceof Request?input:url.href,{...init,credentials:'include'});
        const secureAction=publicAuth&&method==='POST'&&authPath!=='forgot-password';
        if(!publicAuth){
            await window.SamarthAuth.ready;
            if(!token()&&unavailable)throw Object.assign(Error('Session temporarily unavailable'),{transient:true});
            if(token()&&!valid(token())){try{await refresh();}catch(error){
                if(!error.ended)throw error;
                return new Response(JSON.stringify({code:'auth_revoked',error:'This session has ended. Please sign in again.'}),{status:401,headers:{'Content-Type':'application/json'}});
            }}
        }
        async function send(){
            if(template.signal.aborted)throw new DOMException('Aborted','AbortError');
            const headers=new Headers(template.headers);
            if(!publicAuth){if(token())headers.set('Authorization','Bearer '+token());else headers.delete('Authorization');}
            if(secureAction)headers.set('X-CSRF-Token',await csrf());
            return rawFetch(new Request(template.clone(),{headers,credentials:'include'}));
        }
        async function perform(){
        const observed=token();let response=await send();
        if(secureAction&&response.status===403){
            const problem=await response.clone().json().catch(()=>({}));
            if(problem.code==='auth_csrf'){csrfToken='';response=await send();}
        }
        if(!publicAuth&&response.status===401){
            let data={};try{data=await response.clone().json();}catch(_){}
            if(data.code==='auth_expired'){
                try{await refresh(true,observed);response=await send();}catch(error){if(!error.ended)throw error;}
            }else if(['auth_revoked','auth_disabled','auth_invalid'].includes(data.code))clear();
        }
        if(publicAuth&&response.ok&&['login','register'].includes(authPath))accept(await response.clone().json());
        if(publicAuth&&response.ok&&authPath==='reset-password'){write('samarth_session_ended',String(Date.now()));clear(false);}
        return response;
        }
        if(secureAction&&['login','register','reset-password','logout'].includes(authPath)){
            await window.SamarthAuth.ready;
            if(pending)await pending.catch(()=>{});
            changing=true;
            try{return await lock(async()=>{epoch++;return perform();});}
            finally{changing=false;}
        }
        return perform();
    };
    window.addEventListener('storage',event=>{
        if(event.key==='samarth_session_ended'&&event.newValue){clear();return;}
        if(event.key==='token'){memoryToken=event.newValue||'';if(!event.newValue){epoch++;clearTimeout(timer);}else schedule();}
    });
    window.addEventListener('online',()=>restore());
    window.addEventListener('pageshow',()=>restore());
    document.addEventListener('visibilitychange',()=>{if(!document.hidden)restore();else clearTimeout(timer);});
    window.SamarthAuth.ready=restore();
})();
