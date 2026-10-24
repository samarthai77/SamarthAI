const fs=require('fs'),path=require('path'),vm=require('vm'); const root=process.env.SAMARTH_TEST_ROOT||path.resolve(__dirname,'../..'); const thread='22222222-2222-4222-8222-222222222222';
// Atomic unique-insert DB double. Data outlives engine/module instances, not process memory caches.
function database() {
 const rows=new Map(),chats=new Map();let owner=true,claims=0,saves=0,failRead=false;
 const db={rows,chats,get claims(){return claims;},get saves(){return saves;},setOwner:v=>owner=v,setFailRead:v=>failRead=v,
  from(table){let op='select',payload,filters=[],single=false;
   const q={select(){return q;},insert(v){op='insert';payload=v;return q;},update(v){op='update';payload=v;return q;},eq(k,v){filters.push([k,v]);return q;},single(){single=true;return q;},maybeSingle(){single=true;return q;},abortSignal(){return q;},then(resolve,reject){return Promise.resolve().then(()=>{
    const store=table==='chat_idempotency'?rows:chats;
    if(table==='conversations')return {data:owner?{id:thread,title:'New Chat'}:null,error:owner?null:{code:'42501'}};
    if(failRead&&op==='select')return {data:null,error:{code:'network'}};
    if(op==='insert'){const item=structuredClone(Array.isArray(payload)?payload[0]:payload);const key=table==='chat_idempotency'?item.user_id+':'+item.request_id:item.id;
     if(store.has(key))return {data:null,error:{code:'23505'}};
     if(table==='chat_idempotency'){claims++;item.created_at=new Date().toISOString();}else saves++;
     store.set(key,item);return {data:structuredClone(item),error:null};}
    const found=[...store.values()].filter(row=>filters.every(([k,v])=>row[k]===v));
    if(op==='update')for(const row of found)Object.assign(row,structuredClone(payload));
    return {data:single?structuredClone(found[0]||null):structuredClone(found),error:single&&!found.length?{code:'PGRST116'}:null};
   }).then(resolve,reject);}};return q;}};
 return db;
}
function engine(db,runConversation){const module={exports:{}};const source=fs.readFileSync(path.join(root,'services/autonomousEngine.js'),'utf8');
 vm.runInThisContext('(function(require,module,exports){'+source+'\n})')(name=>name==='@supabase/supabase-js'?{createClient:()=>db}:name==='./conversationEngine'?{runConversation}:name==='./chatIdempotency'?require(path.join(root,'services/chatIdempotency')):require(name.startsWith('.')?path.resolve(root,'services',name):name),module,module.exports);return module.exports;}

module.exports={database,engine};
