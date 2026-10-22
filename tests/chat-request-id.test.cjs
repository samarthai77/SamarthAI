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
 const status=app.wraps[0].msg.children.at(-1);assert.equal(status.children.length,1);assert.match(status.children[0].text,/नया भेजें/);
});
test('older mobile browsers generate secure UUIDs without randomUUID support',()=>{
 const app=frontend(()=>{});app.context.crypto={getRandomValues:require('crypto').webcrypto.getRandomValues.bind(require('crypto').webcrypto)};
 assert.match(app.context.createChatRequestId(),/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);
});
