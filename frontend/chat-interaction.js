let sendInFlight=false, conversationReady=Promise.resolve(), activeChatRequest=null;
let sharedChatLocation=null, sharedLocationAt=0;
const actionIcons={
    Copy:'<rect x="8" y="8" width="12" height="12" rx="2"/><path d="M16 8V4H4v12h4"/>',
    Like:'<path d="M8 10l4-7c3 0 2 4 2 6h5l-2 11H8zM3 10h5v10H3z"/>',
    Dislike:'<path d="M8 14l4 7c3 0 2-4 2-6h5L17 4H8zM3 4h5v10H3z"/>',
    Listen:'<path d="M11 5L6 9H3v6h3l5 4zM15 8c3 2 3 6 0 8M18 5c5 4 5 10 0 14"/>',
    Share:'<path d="M12 16V3m-5 5l5-5 5 5M5 13v7h14v-7"/>'
};
function createChatActions(msg,content) {
    const row=document.createElement('div');row.className='msg-actions';
    const buttons={};
    Object.entries(actionIcons).forEach(([name,path])=>{
        const button=document.createElement('button');button.type='button';button.className='msg-action-btn';button.title=name;button.setAttribute('aria-label',name);
        button.innerHTML=`<svg viewBox="0 0 24 24" width="19" height="19" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round">${path}</svg>`;
        buttons[name]=button;row.append(button);
    });
    buttons.Copy.onclick=async()=>{const icon=buttons.Copy.innerHTML;await copyChatText(content.chatText,buttons.Copy);setTimeout(()=>buttons.Copy.innerHTML=icon,1300);};
    for(const name of ['Like','Dislike']) {buttons[name].setAttribute('aria-pressed','false');buttons[name].onclick=()=>{for(const item of ['Like','Dislike']){buttons[item].classList.toggle('active',item===name);buttons[item].setAttribute('aria-pressed',String(item===name));}showFeedbackMessage('धन्यवाद, आपकी प्रतिक्रिया दर्ज की गई।');};}
    buttons.Listen.onclick=()=>{if(!('speechSynthesis' in window)){showFeedbackMessage('इस browser में speaker उपलब्ध नहीं है।');return;}voiceReplyEnabled=true;speakAIResponse(content.chatText);};
    buttons.Share.onclick=async()=>{try{if(navigator.share)await navigator.share({title:'SamarthAI',text:content.chatText});else{const icon=buttons.Share.innerHTML;await copyChatText(content.chatText,buttons.Share);setTimeout(()=>buttons.Share.innerHTML=icon,1300);}}catch(error){if(error.name!=='AbortError')showFeedbackMessage('Share नहीं हो पाया।');}};
    msg.append(row);
}
let latestChatUser=null, followChatLatest=false, alignChatTurn=false;
function latestChatMessage(){const messages=document.getElementById('chatMessages').getElementsByClassName('msg-wrapper');return messages[messages.length-1];}
function chatNearBottom(){
    const box=document.getElementById('chatMessages'),last=latestChatMessage();
    // The turn spacer is blank layout space, not unread reply content.
    return !last || last.getBoundingClientRect().bottom<=box.getBoundingClientRect().bottom-parseFloat(getComputedStyle(box).paddingBottom)+4;
}
function updateChatLatest(){document.getElementById('jumpLatest').hidden=chatNearBottom();}
function setChatScrollTop(top){document.getElementById('chatMessages').scrollTop=top;}
function chatTurnTop(){
    const box=document.getElementById('chatMessages'),style=getComputedStyle(box);
    const user=latestChatUser.getBoundingClientRect(),top=box.getBoundingClientRect().top;
    const start=user.top-top+box.scrollTop-parseFloat(style.paddingTop);
    // For a tall prompt, leave room for the reply's first lines as well.
    const replyStart=user.bottom-top+box.scrollTop+parseFloat(getComputedStyle(latestChatUser).marginBottom);
    const replyRoom=Math.min(96,box.clientHeight/3);
    return Math.max(start,replyStart-box.clientHeight+parseFloat(style.paddingBottom)+replyRoom);
}
function updateChatReplySpace(){
    const box=document.getElementById('chatMessages');
    if(!latestChatUser || !box.contains(latestChatUser)){box.style.setProperty('--reply-space','0px');updateChatLatest();return;}
    const last=box.lastElementChild;
    const end=last.getBoundingClientRect().bottom-box.getBoundingClientRect().top+box.scrollTop+parseFloat(getComputedStyle(last).marginBottom);
    const space=Math.max(0,box.clientHeight+chatTurnTop()-end-parseFloat(getComputedStyle(box).paddingBottom));
    box.style.setProperty('--reply-space',space+'px');updateChatLatest();
}
function layoutChatReply(){
    const box=document.getElementById('chatMessages'),readingTop=box.scrollTop;
    updateChatReplySpace();
    if(alignChatTurn && latestChatUser && box.contains(latestChatUser))setChatScrollTop(chatTurnTop());
    else if(followChatLatest)jumpToLatest();
    else if(Math.abs(box.scrollTop-readingTop)>1)setChatScrollTop(readingTop);
    updateChatLatest();
}
function beginChatTurn(wrap){latestChatUser=wrap;followChatLatest=false;alignChatTurn=true;layoutChatReply();}
function resetChatTurn(){latestChatUser=null;followChatLatest=false;alignChatTurn=false;document.getElementById('chatMessages').style.removeProperty('--reply-space');document.getElementById('jumpLatest').hidden=true;}
function jumpToLatest(){
    const box=document.getElementById('chatMessages'),last=latestChatMessage();
    if(last)setChatScrollTop(box.scrollTop+last.getBoundingClientRect().bottom-box.getBoundingClientRect().bottom+parseFloat(getComputedStyle(box).paddingBottom));
    updateChatLatest();
}
function followLatestReply(){alignChatTurn=false;followChatLatest=true;layoutChatReply();}
function chatMessageAdded(wrap,isUser){if(isUser)beginChatTurn(wrap);else layoutChatReply();}
function setChatBusy(busy){
    const button=document.getElementById('sendBtn');button.disabled=false;button.classList.toggle('is-stop',busy);
    button.setAttribute('aria-label',busy?'Stop generating':'Send message');button.title=busy?'Stop generating':'Send';button.textContent=busy?'■':'➤';
    button.onclick=busy?stopGenerating:()=>sendMessage();
}
function stopGenerating(){
    const request=activeChatRequest;if(!request)return;if(request.ai)renderChatMarkdown(request.ai.querySelector('.msg-content'),request.text);request.stopped=true;request.controller.abort();
    if(request.ai) {const label=document.createElement('div');label.className='generation-status';label.textContent='Stopped';request.ai.querySelector('.msg').append(label);}
    activeChatRequest=null;sendInFlight=false;showTyping(false);setChatBusy(false);
}
function chatStatus(request,text,retryable=true){
    const status=document.createElement('div');status.className='send-error';status.role='alert';status.append(document.createTextNode(text));
    if(retryable){const button=document.createElement('button');button.type='button';button.textContent='Retry / फिर भेजें';button.onclick=()=>sendMessage({message:request.message,wrap:request.wrap,conversationId:request.conversationId,oldAI:request.ai});status.append(button);}
    request.wrap.querySelector('.msg').append(status);
}
async function consumeChatEvents(response,receive,signal){
    const reader=response.body.getReader(),decoder=new TextDecoder();let buffer='';
    const drain=()=>{let index;while((index=buffer.indexOf('\n\n'))>=0){const frame=buffer.slice(0,index);buffer=buffer.slice(index+2);const lines=frame.split('\n');const event=lines.find(line=>line.startsWith('event:'))?.slice(6).trim();const data=lines.filter(line=>line.startsWith('data:')).map(line=>line.slice(5).trimStart()).join('\n');if(data)receive(event||'message',JSON.parse(data));}};
    try{while(true){signal.throwIfAborted();const {done,value}=await reader.read();if(done)break;buffer+=decoder.decode(value,{stream:true}).replace(/\r/g,'');if(buffer.length>1024*1024)throw new Error('Stream too large');drain();}buffer+=decoder.decode();if(buffer.trim()){buffer+='\n\n';drain();}}
    finally{await reader.cancel().catch(()=>{});reader.releaseLock();}
}
async function sendMessage(retry=null){
    const started=performance.now();
    const input=document.getElementById('chatInput');if(sendInFlight)return;
    const message=retry?retry.message:input.value.trim();if(!message)return;
    if(retry && retry.conversationId!==currentConversationId){showFeedbackMessage('मूल बातचीत खोलकर फिर कोशिश करें।');return;}
    const request={message,wrap:retry?.wrap||addMessage(message,true),conversationId:currentConversationId,controller:new AbortController(),text:'',ai:null,stopped:false};
    request.wrap.querySelector('.send-error')?.remove();if(retry?.oldAI)retry.oldAI.remove();
    activeChatRequest=request;sendInFlight=true;setChatBusy(true);showTyping(true);beginChatTurn(request.wrap);
    if(!retry){input.value='';resizeChatInput();if(matchMedia('(pointer:coarse)').matches)input.blur();}
    const timing={start:started,optimisticMs:performance.now()-started};let paintTimer,finished=false;
    const stillCurrent=()=>activeChatRequest===request&&!request.stopped;
    const paint=()=>{paintTimer=null;if(!stillCurrent())return;renderChatMarkdown(request.ai.querySelector('.msg-content'),request.text);layoutChatReply();};
    const delta=text=>{
        if(!stillCurrent()||typeof text!=='string')return;
        if(!request.ai){showTyping(false);request.ai=addMessage('',false);timing.firstTextMs=performance.now()-timing.start;}
        request.text+=text;if(!paintTimer)paintTimer=setTimeout(paint,70);
    };
    const timeout=setTimeout(()=>{request.timedOut=true;request.controller.abort();},125000);
    try{
        await chatReady;await conversationReady;if(!stillCurrent())return;
        if(!request.wrap.isConnected){document.getElementById('chatMessages').append(request.wrap);showTyping(true);beginChatTurn(request.wrap);}
        if(!currentConversationId){const thread=await createNewConversation(true,request.controller.signal);if(!thread?.id)throw new Error('Conversation unavailable');}
        if(!stillCurrent())return;request.conversationId=currentConversationId;
        // No GPS await in the send path. Location is shared only by an explicit composer action.
        const location=sharedChatLocation && Date.now()-sharedLocationAt<300000?sharedChatLocation:{latitude:null,longitude:null,timezone:Intl.DateTimeFormat().resolvedOptions().timeZone,locationUnavailable:true};
        timing.requestMs=performance.now()-timing.start;
        const res=await fetch(AUTONOMOUS_API,{method:'POST',signal:request.controller.signal,headers:{'Content-Type':'application/json','Accept':'text/event-stream','Authorization':'Bearer '+localStorage.getItem('token')},body:JSON.stringify({message,conversationId:request.conversationId,mode:'conversation',stream:true,metadata:{location,language:localStorage.getItem('samarthai_language')||'hi-IN'}})});
        if(!res.ok){const problem=await res.json().catch(()=>({}));const error=new Error('Chat unavailable');error.code=problem.code || (res.status===401?'login_required':res.status===429?'provider_rate_limit':'network_error');throw error;}
        if(res.headers.get('content-type')?.includes('text/event-stream')){
            await consumeChatEvents(res,(event,data)=>{
                if(!stillCurrent())return;
                if(event==='delta')delta(data.text);
                if(event==='error'){const error=new Error('Chat unavailable');error.code=data.code;throw error;}
                if(event==='done'){const reply=data?.result?.response||data?.response;if(typeof reply==='string'){request.text=reply;if(!request.ai)request.ai=addMessage('',false);}finished=true;}
            },request.controller.signal);
            if(!finished)throw new Error('Connection interrupted');
        }else{
            const data=await res.json(),reply=data?.result?.response||data?.response;
            if(!data.success&&data.error)throw new Error('Chat unavailable');if(typeof reply!=='string'||!reply.trim())throw new Error('Empty response');delta(reply);finished=true;
        }
        if(!stillCurrent())return;clearTimeout(paintTimer);paint();showTyping(false);timing.ok=true;speakAIResponse(request.text);
        loadConversations().then(renderConversationList);
    }catch(error){if(stillCurrent()){clearTimeout(paintTimer);if(request.ai)paint();const statusText=request.timedOut?'जवाब में अधिक समय लग रहा है।':error.code==='login_required'?'सत्र समाप्त हो गया है। फिर login करें।':error.code==='provider_rate_limit'?'अधिक अनुरोध आ रहे हैं। थोड़ी देर बाद फिर कोशिश करें।':['provider_auth','provider_configuration','provider_not_configured'].includes(error.code)?'AI सेवा फिलहाल उपलब्ध नहीं है। कुछ देर बाद फिर कोशिश करें।':'जवाब पूरा नहीं हो पाया। आपका संदेश सुरक्षित है।';chatStatus(request,statusText);timing.ok=false;}}
    finally{clearTimeout(timeout);clearTimeout(paintTimer);if(stillCurrent()){activeChatRequest=null;sendInFlight=false;showTyping(false);setChatBusy(false);window.samarthChatTiming=timing;}}
}
function initializeChatExperience(){
    const box=document.getElementById('chatMessages');
    const stopAutoScroll=()=>{alignChatTurn=false;followChatLatest=false;};
    // Cancel alignment before the next stream paint when the reader takes control.
    for(const type of ['wheel','touchmove','pointerdown'])box.addEventListener(type,stopAutoScroll,{passive:true});
    box.addEventListener('keydown',event=>{if(['ArrowUp','ArrowDown','PageUp','PageDown','Home','End',' '].includes(event.key))stopAutoScroll();});
    // Keyboard resize can also emit scroll events; only reader input cancels alignment.
    box.addEventListener('scroll',updateChatLatest,{passive:true});
    // Re-align only an untouched new turn; preserve the reader's position otherwise.
    new ResizeObserver(layoutChatReply).observe(box);
    new MutationObserver(layoutChatReply).observe(box,{childList:true,subtree:true});
    document.getElementById('shareChatLocation').onclick=async()=>{
        const button=document.getElementById('shareChatLocation');button.disabled=true;
        try{const value=await getClientLocation();if(Number.isFinite(value.latitude)&&Number.isFinite(value.longitude)){sharedChatLocation=value;sharedLocationAt=Date.now();button.textContent='Location shared · 5 min';}else{sharedChatLocation=null;showFeedbackMessage('Location उपलब्ध नहीं है। शहर का नाम लिख सकते हैं।');}}
        finally{button.disabled=false;}
    };
    navigator.permissions?.query({name:'geolocation'}).then(permission=>{permission.onchange=()=>{if(permission.state!=='granted'){sharedChatLocation=null;sharedLocationAt=0;document.getElementById('shareChatLocation').textContent='Share location';}};}).catch(()=>{});
    setChatBusy(false);
}
