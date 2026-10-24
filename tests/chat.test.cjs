const test=require('node:test'),assert=require('node:assert/strict'),fs=require('fs'),path=require('path'),vm=require('vm');
const root=process.env.SAMARTH_TEST_ROOT || path.resolve(__dirname,'..');
const {completeChat,ProviderError}=require(path.join(root,'services/chatCompletion'));
test.beforeEach(()=>require(path.join(root,'services/chatCompletion')).resetProviderState());
const weatherIntent=require(path.join(root,'services/weatherIntent'));
function load(relative,stubs){const module={exports:{}};const source=fs.readFileSync(path.join(root,relative),'utf8');const wrapped=vm.runInThisContext('(function(require,module,exports){'+source+'\n})',{filename:relative});wrapped(name=>Object.hasOwn(stubs,name)?stubs[name]:name==='./chatIdempotency'?{execute:async({generate,persist})=>{const value=await generate();const chatId=await persist(value,'33333333-3333-4333-8333-333333333333');return {...value,persistence:{saved:!!chatId,chatId}};}}:require(name.startsWith('.')?path.resolve(path.dirname(path.join(root,relative)),name):name),module,module.exports);return module.exports;}
const user='11111111-1111-4111-8111-111111111111',thread='22222222-2222-4222-8222-222222222222';
function database(owner=true){return {from(table){const query=new Proxy({}, {get(_,method){if(method==='then')return (resolve)=>resolve({data:table==='conversations'&&owner?{id:thread}:table==='users'?{family_id:null}:[],error:!owner&&table==='conversations'?{code:'42501'}:null});return ()=>query;}});return query;}};}
function engine({completion,weather}={}){return load('services/conversationEngine.js',{'@supabase/supabase-js':{createClient:()=>database()},'./tools':{getTool:()=>({execute:weather||(()=>({data:{temperature:{degrees:25}},location:{name:'Prayagraj'}}))})},'./aiGateway':{callGroq:()=>{},callOpenAI:()=>{}},'./chatCompletion':{completeChat:completion,ProviderError},'./weatherIntent':weatherIntent});}
test('named-city weather recovery never needs GPS and rejects unrelated requests',()=>{assert.equal(weatherIntent('Prayagraj ka mausam batao').tool_args.locationName,'Prayagraj');assert.equal(weatherIntent('प्रयागराज का मौसम बताओ').tool_args.locationName,'Prayagraj');assert.equal(weatherIntent('weather in Prayagraj').tool_args.locationName,'Prayagraj');assert.equal(weatherIntent('आज मौसम कैसा है?').tool_args.locationName,null);assert.equal(weatherIntent('मेरी family दिखाओ'),null);});
test('final answer preserves Markdown, indentation and actual streamed chunks',async()=>{
 const answer='## Heading\n\nParagraph.\n\n```py\nif True:\n    print("a")\n```';const chunks=[];
 const app=engine({completion:async opts=>{if(opts.response_format)return JSON.stringify({tool:'none',mode:'conversation'});opts.onDelta?.(answer.slice(0,15));opts.onDelta?.(answer.slice(15));return answer;}});
 const result=await app.runConversation({userId:user,conversationId:thread,message:'Code',onDelta:text=>chunks.push(text)});
 assert.equal(result.response,answer);assert.equal(chunks.join(''),answer);
});
test('planner outage still routes explicit Prayagraj weather to actual tool without GPS',async()=>{
 let args;const app=engine({completion:async()=>{throw new ProviderError('provider_rate_limit');},weather:async value=>{args=value;return {data:{temperature:{degrees:25}},location:{name:'Prayagraj'}};}});
 const result=await app.runConversation({userId:user,conversationId:thread,message:'Prayagraj ka mausam batao',location:{latitude:null,longitude:null}});
 assert.equal(args.locationName,'Prayagraj');assert.equal(args.latitude,null);assert.match(result.response,/25°C/);
});
test('planner outage for non-weather is retryable, never a fabricated successful answer',async()=>{
 const app=engine({completion:async()=>{throw new ProviderError('provider_auth');}});
 await assert.rejects(app.runConversation({userId:user,conversationId:thread,message:'Recipe'}),error=>error.code==='provider_auth');
});
test('thread ownership is enforced before calling the conversation engine',async()=>{
 let called=false;const app=load('services/autonomousEngine.js',{'@supabase/supabase-js':{createClient:()=>database(false)},'./conversationEngine':{runConversation:async()=>{called=true;}}});
 await assert.rejects(app.run({userId:user,conversationId:thread,message:'x'}),error=>error.status===403);assert.equal(called,false);
});
test('configured provider chain falls back on 429, no missing-provider calls, no text duplication',async()=>{
 const original=global.fetch, env={...process.env};const urls=[];
 process.env.GROQ_API_KEY='fixture';process.env.GEMINI_API_KEY='fixture';delete process.env.OPENAI_API_KEY;
 global.fetch=async url=>{urls.push(url);return urls.length===1?new Response('{}',{status:429}):Response.json({candidates:[{content:{parts:[{text:'{"tool":"none"}'}]}}]});};
 try{assert.equal(await completeChat({messages:[{role:'user',content:'plan'}],response_format:{type:'json_object'}}),'{"tool":"none"}');assert.equal(urls.length,2);assert.match(urls[1],/generativelanguage/);}finally{global.fetch=original;process.env=env;}
});
test('provider streams actual split UTF-8 SSE deltas; cancellation stops fetch',async()=>{
 const original=global.fetch, env={...process.env};process.env.GROQ_API_KEY='fixture';delete process.env.GEMINI_API_KEY;delete process.env.OPENAI_API_KEY;
 const text='नमस्ते\n\n```py\n  x=1\n```',frames=`data: ${JSON.stringify({choices:[{delta:{content:text},finish_reason:null}]})}\n\ndata: ${JSON.stringify({choices:[{delta:{},finish_reason:'stop'}]})}\n\ndata: [DONE]\n\n`;
 const bytes=new TextEncoder().encode(frames);global.fetch=async()=>new Response(new ReadableStream({start(controller){controller.enqueue(bytes.slice(0,27));controller.enqueue(bytes.slice(27));controller.close();}}),{headers:{'content-type':'text/event-stream'}});
 try{const chunks=[];assert.equal(await completeChat({messages:[{role:'user',content:'x'}],onDelta:t=>chunks.push(t)}),text);assert.equal(chunks.join(''),text);const controller=new AbortController();controller.abort();await assert.rejects(completeChat({messages:[],signal:controller.signal}));}finally{global.fetch=original;process.env=env;}
});
test('mid-stream interruption is an error and never starts another provider',async()=>{
 const original=global.fetch,env={...process.env};process.env.GROQ_API_KEY='fixture';process.env.GEMINI_API_KEY='fixture';let calls=0;
 global.fetch=async()=>{calls++;return new Response('data: {"choices":[{"delta":{"content":"partial"}}]}\n\n',{headers:{'content-type':'text/event-stream'}});};
 try{await assert.rejects(completeChat({messages:[],onDelta:()=>{}}),error=>error.partial===true);assert.equal(calls,1);}finally{global.fetch=original;process.env=env;}
});
test('SSE transport emits ordered deltas and done, and aborts provider work on disconnect',async()=>{
 const EventEmitter=require('events'),streamResponse=require(path.join(root,'services/streamResponse'));
 const req=new EventEmitter(),res=new EventEmitter();let output='',aborted=false;
 Object.assign(res,{status(){return this;},set(){return this;},flushHeaders(){},write(value){output+=value;},end(){this.writableEnded=true;}});
 await streamResponse(req,res,async opts=>{opts.onDelta('पहला');opts.onDelta(' दूसरा');return {success:true,result:{response:'पहला दूसरा'}};},{});
 assert(output.indexOf('पहला')<output.indexOf(' दूसरा'));assert.match(output,/event: done/);
 const req2=new EventEmitter(),res2=new EventEmitter();Object.assign(res2,{status(){return this;},set(){return this;},flushHeaders(){},write(){},end(){this.writableEnded=true;}});
 await streamResponse(req2,res2,async opts=>{const task=new Promise((_,reject)=>opts.signal.addEventListener('abort',()=>{aborted=true;reject(opts.signal.reason);}));res2.emit('close');return task;},{});assert(aborted);
});
test('JWT authentication still runs before the SSE or JSON handler',async()=>{
 let calls=0,handlers;const router={get(){},use(){},post(path,...items){if(path==='/run')handlers=items;}};
 const stubs={'../middleware/chatRateLimit':{userLimiter:(req,res,next)=>next()},express:{Router:()=>router},jsonwebtoken:{verify(){throw new Error('invalid');}},'../services/streamResponse':()=>{calls++;},'../services/autonomousEngine':{run:()=>{calls++;}}};
 for(const name of ['chat','gps','sos','scanner','family','memory'])stubs['./'+name]={};
 load('routes/autonomousEngine.js',stubs);const res={status(value){this.code=value;return this;},json(value){this.body=value;return this;}};
 handlers[0]({headers:{}},res,()=>calls++);assert.equal(res.code,401);assert.equal(calls,0);assert.equal(res.body.code,'login_required');const previousSecret=process.env.JWT_SECRET;process.env.JWT_SECRET='fixture';handlers[0]({headers:{authorization:'Bearer invalid'}},res,()=>calls++);if(previousSecret===undefined)delete process.env.JWT_SECRET;else process.env.JWT_SECRET=previousSecret;assert.equal(res.code,401);assert.equal(res.body.code,'login_required');assert.equal(calls,0);
});
test('abort after a real partial answer persists only that user’s partial text',async()=>{
 const controller=new AbortController();let saved;
 const db=database();const originalFrom=db.from;db.from=table=>{const base=originalFrom(table);return new Proxy(base,{get(target,key){if(key==='insert')return rows=>{saved=rows[0];return base;};return target[key];}});};
 const app=load('services/autonomousEngine.js',{'@supabase/supabase-js':{createClient:()=>db},'./conversationEngine':{runConversation:async opts=>{opts.onDelta('partial\n\n  code');controller.abort();throw controller.signal.reason;}}});
 const response=await app.run({userId:user,conversationId:thread,message:'x',signal:controller.signal,onDelta:()=>{}});
 assert.equal(response.result.stopped,true);assert.equal(saved.response,'partial\n\n  code');assert.equal(saved.user_id,user);assert.equal(saved.conversation_id,thread);
});
