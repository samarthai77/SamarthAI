const test=require('node:test'),assert=require('node:assert/strict'),fs=require('fs'),path=require('path'),vm=require('vm');
const root=process.env.SAMARTH_TEST_ROOT||path.resolve(__dirname,'..');
function frontend(fetch) {
 const elements={};const node=()=>({children:[],classList:{toggle(){}},setAttribute(){},remove(){},append(...items){this.children.push(...items);}});
 elements.chatInput={value:'hello',blur(){}};elements.sendBtn=node();elements.chatMessages=node();
 let userCount=0;const wraps=[];
 const context={console,crypto:require('crypto').webcrypto,performance,AbortController,TextDecoder,setTimeout,clearTimeout,matchMedia:()=>({matches:false}),
  document:{getElementById:id=>elements[id],createElement:()=>node(),createTextNode:text=>({text})},localStorage:{getItem:key=>key==='token'?'fixture':'hi-IN'},
  currentConversationId:'22222222-2222-4222-8222-222222222222',chatReady:Promise.resolve(),AUTONOMOUS_API:'https://fixture.invalid/run',fetch,
  showFeedbackMessage(){},resizeChatInput(){},showTyping(){},renderChatMarkdown(){},speakAIResponse(){},loadConversations:()=>Promise.resolve([]),renderConversationList(){},
  addMessage(text,isUser){if(isUser)userCount++;const msg=node(),content=node();const wrap={isConnected:true,querySelector:selector=>selector==='.msg'?msg:selector==='.msg-content'?content:null,remove(){}};wrap.msg=msg;wraps.push(wrap);return wrap;}};
 context.window=context;vm.createContext(context);vm.runInContext(fs.readFileSync(path.join(root,'frontend/chat-interaction.js'),'utf8'),context);
 context.beginChatTurn=()=>{};context.layoutChatReply=()=>{};
 return {context,wraps,elements,get userCount(){return userCount;}};
}
test('frontend network Retry keeps request ID, prompt, thread and language; does not resend GPS',async()=>{
 const bodies=[];const app=frontend(async(url,options)=>{bodies.push(JSON.parse(options.body));if(bodies.length===1)throw new TypeError('Network failure');return Response.json({success:true,result:{response:'cached answer'}});});
 vm.runInContext('sharedChatLocation={latitude:1,longitude:2}; sharedLocationAt=Date.now();',app.context);
 await app.context.sendMessage();const retry=app.wraps[0].msg.children.at(-1).children.at(-1);assert.equal(retry.textContent,'Retry / फिर भेजें');
 await retry.onclick();assert.equal(bodies.length,2);assert.match(bodies[0].requestId,/^[0-9a-f-]{36}$/);assert.equal(bodies[1].requestId,bodies[0].requestId);assert.equal(bodies[1].message,'hello');assert.equal(bodies[0].metadata.location.latitude,1);assert.equal(bodies[1].metadata.location.latitude,null);assert.equal(app.userCount,1);
});
test('frontend simultaneous Send is guarded and SSE completed replay renders normally',async()=>{
 let count=0,release;const gate=new Promise(r=>release=r);const app=frontend(async()=>{count++;await gate;return new Response('event: ready\ndata: {}\n\nevent: done\ndata: {"success":true,"replayed":true,"result":{"response":"saved response"}}\n\n',{headers:{'content-type':'text/event-stream'}});});
 const first=app.context.sendMessage();await new Promise(r=>setImmediate(r));await app.context.sendMessage();assert.equal(count,1);release();await first;assert.equal(app.userCount,1);assert.equal(app.context.samarthChatTiming.ok,true);
});
test('terminal failed request does not offer an automatic paid Retry',async()=>{
 const app=frontend(async()=>new Response('event: error\ndata: {"code":"request_failed"}\n\n',{headers:{'content-type':'text/event-stream'}}));await app.context.sendMessage();
 const status=app.wraps[0].msg.children.at(-1);assert.equal(status.children.length,2);assert.match(status.children[1].textContent,/नया अनुरोध/);
});
test('older mobile browsers generate secure UUIDs without randomUUID support',()=>{
 const app=frontend(()=>{});app.context.crypto={getRandomValues:require('crypto').webcrypto.getRandomValues.bind(require('crypto').webcrypto)};
 assert.match(app.context.createChatRequestId(),/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);
});

test('new paid attempt requires confirmation and a different request ID',async()=>{
 const bodies=[];const app=frontend(async(url,options)=>{bodies.push(JSON.parse(options.body));return bodies.length===1?new Response('event: error\ndata: {"code":"request_failed","retryable":false,"recovery":"confirm_new_request"}\n\n',{headers:{'content-type':'text/event-stream'}}):Response.json({success:true,result:{response:'new answer'}});});
 await app.context.sendMessage();const button=app.wraps[0].msg.children.at(-1).children.at(-1);app.context.confirm=()=>false;await button.onclick();assert.equal(bodies.length,1);app.context.confirm=()=>true;await button.onclick();assert.equal(bodies.length,2);assert.notEqual(bodies[0].requestId,bodies[1].requestId);assert.equal(app.userCount,1);
});
test('server cooldown blocks Send and preserves the draft',async()=>{
 let calls=0;const app=frontend(async()=>{calls++;return Response.json({code:'server_rate_limit',retryAfter:1},{status:429,headers:{'retry-after':'1'}});});await app.context.sendMessage();app.elements.chatInput.value='draft';await app.context.sendMessage();assert.equal(calls,1);assert.equal(app.elements.chatInput.value,'draft');assert.equal(app.elements.sendBtn.disabled,true);
});
test('malformed SSE is a protocol failure, not an empty successful reply',async()=>{
 const app=frontend(async()=>new Response('event: delta\ndata: {broken}\n\n',{headers:{'content-type':'text/event-stream'}}));await app.context.sendMessage();assert.equal(app.context.samarthChatTiming.ok,false);assert.match(app.wraps[0].msg.children.at(-1).children[0].text,/अमान्य/);
});

test('Stop remains usable during an active request and stops only that request',async()=>{let aborted=false;const app=frontend(async(url,options)=>new Promise((resolve,reject)=>options.signal.addEventListener('abort',()=>{aborted=true;reject(options.signal.reason);})));const running=app.context.sendMessage();await new Promise(r=>setImmediate(r));assert.equal(app.elements.sendBtn.disabled,false);app.context.stopGenerating();await running;assert.equal(aborted,true);});
test('Stop cancels a pending prerequisite without issuing a request',async()=>{let calls=0;const app=frontend(async()=>{calls++;});app.context.chatReady=new Promise(()=>{});const running=app.context.sendMessage();await new Promise(r=>setImmediate(r));app.context.stopGenerating();await running;assert.equal(calls,0);});
