const test=require('node:test'),assert=require('node:assert/strict'),fs=require('fs'),path=require('path'),vm=require('vm');
const root=process.env.SAMARTH_TEST_ROOT||path.resolve(__dirname,'..');
const {execute,historyId}=require(path.join(root,'services/chatIdempotency'));
const user='11111111-1111-4111-8111-111111111111',thread='22222222-2222-4222-8222-222222222222',id='33333333-3333-4333-8333-333333333333';
const options={userId:user,conversationId:thread,requestId:id,message:'hello',metadata:{language:'hi-IN'}};
const response=()=>({success:true,result:{response:'answer'},agent:{id:'chat'},persistence:{saved:false,chatId:null}});
const {database,engine}=require('./helpers/chat-idempotency-fixture.cjs');
test('simultaneous identical requests claim once, then replay without generation or duplicate history',async()=>{
 const db=database();let calls=0,release;const gate=new Promise(r=>release=r);const app=engine(db,async()=>{calls++;await gate;return {response:'answer'};});
 const first=app.run(options);while(!calls)await new Promise(r=>setImmediate(r));
 await assert.rejects(app.run(options),e=>e.code==='request_in_progress');release();await first;
 const replay=await app.run(options);assert.equal(replay.replayed,true);assert.equal(calls,1);assert.equal(db.saves,1);assert.equal(db.claims,1);
});
test('new server/module instance replays completed durable state; current ownership checked first',async()=>{
 const db=database();let calls=0;await engine(db,async()=>{calls++;return {response:'answer'};}).run(options);
 const app=engine(db,async()=>{calls++;throw Error('must not regenerate');});assert.equal((await app.run(options)).result.response,'answer');assert.equal(calls,1);
 db.setOwner(false);await assert.rejects(app.run(options),e=>e.code==='conversation_forbidden');
});
test('orphan claim after restart never takes over or calls AI',async()=>{
 const db=database();db.rows.set(user+':'+id,{user_id:user,request_id:id,conversation_id:thread,fingerprint:require('crypto').createHash('sha256').update(JSON.stringify({conversationId:thread,language:'hi-IN',message:'hello',mode:'conversation'})).digest('hex'),state:'in_progress',created_at:'2000-01-01T00:00:00Z'});
 let calls=0;await assert.rejects(engine(db,async()=>calls++).run(options),e=>e.code==='request_in_progress');assert.equal(calls,0);
});
test('failed request is terminal on retry and remains terminal after restart',async()=>{
 const db=database();let calls=0;await assert.rejects(engine(db,async()=>{calls++;throw Error('provider unavailable');}).run(options));
 await assert.rejects(engine(db,async()=>calls++).run(options),e=>e.code==='request_failed');assert.equal(calls,1);assert.equal(db.saves,0);
});
test('disconnect with streamed text persists partial once and safely replays it',async()=>{
 const db=database(),controller=new AbortController();let calls=0;
 const app=engine(db,async o=>{calls++;o.onDelta('partial');controller.abort();throw controller.signal.reason;});
 const first=await app.run({...options,signal:controller.signal,onDelta:()=>{}});assert.equal(first.result.stopped,true);
 const replay=await app.run(options);assert.equal(replay.result.response,'partial');assert.equal(calls,1);assert.equal(db.saves,1);
});
test('disconnect before first text never regenerates that request',async()=>{
 const db=database(),controller=new AbortController();let calls=0;const app=engine(db,async()=>{calls++;controller.abort();throw controller.signal.reason;});
 await assert.rejects(app.run({...options,signal:controller.signal}));await assert.rejects(app.run(options),e=>e.code==='request_failed');assert.equal(calls,1);
});
test('completed generation survives history outage and concurrent retries save one row',async()=>{
 const db=database();let calls=0,persistCalls=0;const generate=async()=>{calls++;return response();};
 await assert.rejects(execute({db,options,generate,persist:async()=>null}),e=>e.code==='history_save_pending');
 const app=engine(db,async()=>{calls++;return {response:'wrong'};});await Promise.all([app.run(options),app.run(options)]);
 assert.equal(calls,1);assert.equal(db.saves,1);assert.equal(db.chats.values().next().value.response,'answer');
});
test('history INSERT commit with lost acknowledgement recovers via same primary key',async()=>{
 const db=database();let calls=0;await assert.rejects(execute({db,options,generate:async()=>{calls++;return response();},persist:async(result,chatId)=>{
  await db.from('chats').insert({id:chatId,user_id:user,conversation_id:thread,message:'hello',response:'answer'}).single();return null;
 }}),e=>e.code==='history_save_pending');
 await engine(db,async()=>{calls++;}).run(options);assert.equal(calls,1);assert.equal(db.saves,1);
});
test('request ID cannot be reused for a different message, conversation or language',async()=>{
 const db=database(),app=engine(db,async()=>({response:'answer'}));await app.run(options);
 for(const patch of [{message:'changed'},{conversationId:'44444444-4444-4444-8444-444444444444'},{metadata:{language:'en-IN'}}])await assert.rejects(app.run({...options,...patch}),e=>e.code==='request_id_conflict');
 assert.equal(db.saves,1);
});
test('different users are isolated; location revocation does not resend or regenerate',async()=>{
 const db=database();let calls=0;const app=engine(db,async()=>{calls++;return {response:'answer'};});await app.run({...options,metadata:{language:'hi-IN',location:{latitude:1,longitude:2}}});
 await app.run(options);assert.equal(calls,1);await app.run({...options,userId:'55555555-5555-4555-8555-555555555555'});assert.equal(calls,2);assert.equal(db.saves,2);
 assert.notEqual(historyId(user,id),historyId('55555555-5555-4555-8555-555555555555',id));
});
test('expiry discards replay payload, retains tombstone, never regenerates',async()=>{
 const db=database();let calls=0;const app=engine(db,async()=>{calls++;return {response:'answer'};});await app.run(options);db.rows.get(user+':'+id).replay_expires_at='2000-01-01T00:00:00Z';
 await assert.rejects(app.run(options),e=>e.code==='request_replay_expired');assert.equal(db.rows.get(user+':'+id).result,null);assert.equal(calls,1);
});
test('invalid ID, unavailable ledger and conflicting existing history all fail closed',async()=>{
 const db=database();let calls=0;const app=engine(db,async()=>{calls++;return {response:'answer'};});await assert.rejects(app.run({...options,requestId:'invalid'}),e=>e.code==='invalid_request_id');assert.equal(calls,0);
 const bad={from:()=>({insert(){return this;},select(){return this;},single:async()=>({error:{code:'PGRST205'}})})};await assert.rejects(execute({db:bad,options,generate:async()=>calls++,persist:async()=>null}),e=>e.code==='idempotency_unavailable');assert.equal(calls,0);
 db.chats.set(historyId(user,id),{id:historyId(user,id),user_id:user,conversation_id:thread,message:'other',response:'private'});await assert.rejects(app.run(options),e=>e.code==='history_save_pending');assert.equal(db.saves,0);
});
test('fresh Node process replays DB snapshot with zero provider calls and one history row',async()=>{
 const db=database();await engine(db,async()=>({response:'durable answer'})).run(options);
 const dir=fs.mkdtempSync(path.join(require('os').tmpdir(),'samarth-chat-restart-'));
 const snapshot=path.join(dir,'fixture.json');fs.writeFileSync(snapshot,JSON.stringify({rows:[...db.rows],chats:[...db.chats],options}));
 const child=`const fs=require('fs');const {database,engine}=require(process.argv[1]);const saved=JSON.parse(fs.readFileSync(process.argv[2]));const db=database();for(const [k,v] of saved.rows)db.rows.set(k,v);for(const [k,v] of saved.chats)db.chats.set(k,v);let calls=0;engine(db,async()=>{calls++;throw Error('Unexpected generation');}).run(saved.options).then(r=>console.log(JSON.stringify({calls,history:db.chats.size,response:r.result.response,replayed:r.replayed}))).catch(e=>{console.error(e);process.exitCode=1});`;
 try {const output=require('child_process').execFileSync(process.execPath,['-e',child,path.join(__dirname,'helpers/chat-idempotency-fixture.cjs'),snapshot],{encoding:'utf8'});
  assert.deepEqual(JSON.parse(output),{calls:0,history:1,response:'durable answer',replayed:true});
 } finally {fs.unlinkSync(snapshot);fs.rmdirSync(dir);}
});
test('lost completion acknowledgement cannot overwrite committed completion or regenerate',async()=>{
 const db=database();const original=db.from.bind(db);let lost=false,calls=0;
 db.from=table=>{const q=original(table),update=q.update.bind(q);q.update=patch=>{update(patch);if(table==='chat_idempotency'&&patch.state==='completed'&&!lost){lost=true;const single=q.single.bind(q);q.single=()=>{single();const then=q.then.bind(q);q.then=(resolve,reject)=>then(value=>resolve({...value,error:{code:'network'}}),reject);return q;};}return q;};return q;};
 const app=engine(db,async()=>{calls++;return {response:'committed answer'};});await assert.rejects(app.run(options),e=>e.code==='idempotency_unavailable');
 assert.equal(db.rows.get(user+':'+id).state,'completed');assert.equal((await app.run(options)).result.response,'committed answer');assert.equal(calls,1);assert.equal(db.saves,1);
});
test('claim acknowledgement lost after INSERT never starts a second generation',async()=>{
 const db=database(),original=db.from.bind(db);let lost=false,calls=0;db.from=table=>{const q=original(table),insert=q.insert.bind(q);q.insert=value=>{insert(value);if(table==='chat_idempotency'&&!lost){lost=true;const then=q.then.bind(q);q.then=(resolve,reject)=>then(()=>reject(new TypeError('lost acknowledgement')),reject);}return q;};return q;};
 const app=engine(db,async()=>{calls++;return {response:'answer'};});await assert.rejects(app.run(options));await assert.rejects(app.run(options),e=>e.code==='request_in_progress');assert.equal(calls,0);assert.equal(db.claims,1);
});
