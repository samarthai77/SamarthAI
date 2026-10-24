let chatCooldownUntil=0,chatCooldownTimer;
function armChatCooldown(seconds){const ms=Math.min(900,Math.max(0,Number(seconds)||0))*1000;if(!ms)return;chatCooldownUntil=Math.max(chatCooldownUntil,Date.now()+ms);clearTimeout(chatCooldownTimer);chatCooldownTimer=setTimeout(()=>{chatCooldownUntil=0;setChatBusy(sendInFlight);},Math.max(0,chatCooldownUntil-Date.now()));chatCooldownTimer.unref?.();setChatBusy(sendInFlight);}
let sendInFlight=false, conversationReady=Promise.resolve(), activeChatRequest=null;
function createChatRequestId(){
    if(typeof crypto.randomUUID==='function')return crypto.randomUUID();
    const bytes=crypto.getRandomValues(new Uint8Array(16));bytes[6]=(bytes[6]&15)|64;bytes[8]=(bytes[8]&63)|128;
    const hex=Array.from(bytes,value=>value.toString(16).padStart(2,'0')).join('');
    return `${hex.slice(0,8)}-${hex.slice(8,12)}-${hex.slice(12,16)}-${hex.slice(16,20)}-${hex.slice(20)}`;
}
let sharedChatLocation=null, sharedLocationAt=0, chatLocationTimer=null, chatLocationVersion=0;
function stopChatLocation(){
    chatLocationVersion++;clearTimeout(chatLocationTimer);sharedChatLocation=null;sharedLocationAt=0;
    const button=document.getElementById('shareChatLocation');button.disabled=false;button.textContent='Share location';button.setAttribute('aria-pressed','false');
}
function currentChatLocation(){
    if(sharedChatLocation && Date.now()-sharedLocationAt>=300000)stopChatLocation();
    return sharedChatLocation;
}
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
let latestChatUser=null, alignChatTurn=false;
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
    if(!latestChatUser || !box.contains(latestChatUser)){box.style.setProperty('--reply-space','0px');return;}
    const last=box.lastElementChild;
    const end=last.getBoundingClientRect().bottom-box.getBoundingClientRect().top+box.scrollTop+parseFloat(getComputedStyle(last).marginBottom);
    const space=Math.max(0,box.clientHeight+chatTurnTop()-end-parseFloat(getComputedStyle(box).paddingBottom));
    box.style.setProperty('--reply-space',space+'px');
}
function layoutChatReply(){
    const box=document.getElementById('chatMessages'),readingTop=box.scrollTop;
    updateChatReplySpace();
    if(alignChatTurn && latestChatUser && box.contains(latestChatUser))setChatScrollTop(chatTurnTop());
    else if(Math.abs(box.scrollTop-readingTop)>1)setChatScrollTop(readingTop);

}
function beginChatTurn(wrap){latestChatUser=wrap;alignChatTurn=true;layoutChatReply();}
function resetChatTurn(){latestChatUser=null;alignChatTurn=false;document.getElementById('chatMessages').style.removeProperty('--reply-space');}
function chatMessageAdded(wrap,isUser){if(isUser)beginChatTurn(wrap);else layoutChatReply();}
function setChatBusy(busy){
    const button=document.getElementById('sendBtn');button.disabled=!busy&&Date.now()<chatCooldownUntil;button.classList.toggle('is-stop',busy);
    button.setAttribute('aria-label',busy?'Stop generating':'Send message');button.title=busy?'Stop generating':'Send';button.textContent=busy?'■':'➤';
    button.onclick=busy?stopGenerating:()=>sendMessage();
}
function stopGenerating(){
    const request=activeChatRequest;if(!request)return;if(request.ai)renderChatMarkdown(request.ai.querySelector('.msg-content'),request.text);request.stopped=true;request.controller.abort();
    if(request.ai) {const label=document.createElement('div');label.className='generation-status';label.textContent='Stopped';request.ai.querySelector('.msg').append(label);}
    activeChatRequest=null;sendInFlight=false;showTyping(false);setChatBusy(false);
}
function chatStatus(request,text,retryable=true,recovery){
    const status=document.createElement('div');status.className='send-error';status.role='alert';status.append(document.createTextNode(text));
    if(retryable||recovery==='confirm_new_request'){
      const button=document.createElement('button');button.type='button';
      button.textContent=recovery==='confirm_new_request'?'नया अनुरोध: फिर Generate करें':'Retry / फिर भेजें';
      button.onclick=()=>{if(Date.now()<chatCooldownUntil){showFeedbackMessage('Cooldown पूरा होने पर कोशिश करें।');return;}
       if(recovery==='confirm_new_request'&&!window.confirm('नया AI अनुरोध चलेगा और अतिरिक्त API खर्च हो सकता है। पिछली request अनिश्चित हो तो उसका जवाब बाद में आ सकता है। क्या फिर generate करें?'))return;
       return sendMessage({message:request.message,wrap:request.wrap,conversationId:request.conversationId,oldAI:request.ai,requestId:recovery==='confirm_new_request'?undefined:request.requestId,language:request.language});};status.append(button);
    }
    request.wrap.querySelector('.msg').append(status);
}
async function consumeChatEvents(response,receive,signal){
    const reader=response.body.getReader(),decoder=new TextDecoder();let buffer='';
    const drain=()=>{let index;while((index=buffer.indexOf('\n\n'))>=0){const frame=buffer.slice(0,index);buffer=buffer.slice(index+2);const lines=frame.split('\n');const event=lines.find(line=>line.startsWith('event:'))?.slice(6).trim();const data=lines.filter(line=>line.startsWith('data:')).map(line=>line.slice(5).trimStart()).join('\n');if(data){let payload;try{payload=JSON.parse(data);}catch{throw Object.assign(new Error('Stream protocol'),{code:'sse_protocol'});}receive(event||'message',payload);}}};
    try{while(true){signal.throwIfAborted();const {done,value}=await reader.read();if(done)break;buffer+=decoder.decode(value,{stream:true}).replace(/\r/g,'');if(buffer.length>1024*1024)throw Object.assign(new Error('Stream too large'),{code:'sse_protocol'});drain();}buffer+=decoder.decode();if(buffer.trim()){buffer+='\n\n';drain();}}
    finally{await reader.cancel().catch(()=>{});reader.releaseLock();}
}
function waitChatReady(task,signal){return new Promise((resolve,reject)=>{const abort=()=>{signal.removeEventListener('abort',abort);reject(Object.assign(new Error('Request ended'),{code:'request_timeout'}));};if(signal.aborted){Promise.resolve(task).catch(()=>{});return abort();}signal.addEventListener('abort',abort,{once:true});Promise.resolve(task).then(value=>{signal.removeEventListener('abort',abort);resolve(value);},error=>{signal.removeEventListener('abort',abort);reject(error);});});}
async function sendMessage(retry=null){
    const started=performance.now();
    const input=document.getElementById('chatInput');if(sendInFlight)return;if(Date.now()<chatCooldownUntil){showFeedbackMessage('Cooldown पूरा होने पर कोशिश करें।');return;}
    const message=retry?retry.message:input.value.trim();if(!message)return;
    if(retry && retry.conversationId!==currentConversationId){showFeedbackMessage('मूल बातचीत खोलकर फिर कोशिश करें।');return;}
    const request={requestId:retry?.requestId||createChatRequestId(),language:retry?.language||localStorage.getItem('samarthai_language')||'hi-IN',message,wrap:retry?.wrap||addMessage(message,true),conversationId:currentConversationId,controller:new AbortController(),text:'',ai:null,stopped:false};
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
    const timeout=setTimeout(()=>{request.timedOut=true;request.controller.abort();},130000);
    try{
        await waitChatReady(chatReady,request.controller.signal);await waitChatReady(conversationReady,request.controller.signal);if(!stillCurrent())return;
        if(!request.wrap.isConnected){document.getElementById('chatMessages').append(request.wrap);showTyping(true);beginChatTurn(request.wrap);}
        if(!currentConversationId){const thread=await createNewConversation(true,request.controller.signal);if(!thread?.id)throw new Error('Conversation unavailable');}
        if(!stillCurrent())return;request.conversationId=currentConversationId;
        // No GPS await in the send path. Location is shared only by an explicit composer action.
        const location=(!retry && currentChatLocation()) ||{latitude:null,longitude:null,timezone:Intl.DateTimeFormat().resolvedOptions().timeZone,locationUnavailable:true};
        timing.requestMs=performance.now()-timing.start;
        const res=await fetch(AUTONOMOUS_API,{method:'POST',signal:request.controller.signal,headers:{'Content-Type':'application/json','Accept':'text/event-stream','Authorization':'Bearer '+localStorage.getItem('token')},body:JSON.stringify({requestId:request.requestId,message,conversationId:request.conversationId,mode:'conversation',stream:true,metadata:{location,language:request.language}})});
        if(!res.ok){const problem=await res.json().catch(()=>({}));const error=new Error('Chat unavailable');error.code=problem.code || (res.status===401?'login_required':res.status===429?'server_rate_limit':'network_error');error.retryAfter=Number(problem.retryAfter)||Number(res.headers.get('retry-after'))||0;error.recovery=problem.recovery;error.retryable=problem.retryable;throw error;}
        if(res.headers.get('content-type')?.includes('text/event-stream')){
            await consumeChatEvents(res,(event,data)=>{
                if(!stillCurrent())return;
                if(event==='ready'&&Number.isFinite(data.deadlineMs)){clearTimeout(timeout);request.serverTimer=setTimeout(()=>{request.timedOut=true;request.controller.abort();},Math.min(130000,Math.max(1,data.deadlineMs+10000)));}
                if(event==='delta')delta(data.text);
                if(event==='error'){const error=new Error('Chat unavailable');Object.assign(error,{code:data.code,retryAfter:data.retryAfter,recovery:data.recovery,retryable:data.retryable});throw error;}
                if(event==='done'){const reply=data?.result?.response||data?.response;if(typeof reply!=='string'||!reply.trim())throw Object.assign(new Error('Empty response'),{code:'provider_empty_response'});if(typeof reply==='string'){request.text=reply;if(!request.ai)request.ai=addMessage('',false);}finished=true;}
            },request.controller.signal);
            if(!finished)throw Object.assign(new Error('Connection interrupted'),{code:'sse_interrupted'});
        }else{
            const data=await res.json(),reply=data?.result?.response||data?.response;
            if(!data.success&&data.error)throw Object.assign(new Error('Chat unavailable'),{code:data.code,retryAfter:data.retryAfter,recovery:data.recovery,retryable:data.retryable});if(typeof reply!=='string'||!reply.trim())throw new Error('Empty response');delta(reply);finished=true;
        }
        if(!stillCurrent())return;clearTimeout(paintTimer);paint();showTyping(false);timing.ok=true;speakAIResponse(request.text);
        loadConversations().then(renderConversationList);
    }catch(error){if(stillCurrent()){clearTimeout(paintTimer);if(request.ai)paint();
      const code=request.timedOut?'request_timeout':error.code||'network_error';
      const messages={server_rate_limit:'Server अनुरोध सीमा पहुँची है। Cooldown के बाद Retry करें।',provider_rate_limit:'AI provider की सीमा पहुँची है। Cooldown के बाद कोशिश करें।',login_required:'सत्र समाप्त या अमान्य है। फिर login करें।',auth_configuration:'Login सेवा अभी उपलब्ध नहीं है।',conversation_forbidden:'इस बातचीत का access उपलब्ध नहीं है।',database_unavailable:'डेटाबेस उपलब्ध नहीं है। Retry से स्थिति जाँचें।',database_timeout:'डेटाबेस ने समय पर जवाब नहीं दिया। Retry करें।',request_timeout:'Request की समय-सीमा समाप्त हुई। Retry से स्थिति जाँचें।',provider_timeout:'AI provider ने समय पर जवाब नहीं दिया।',provider_network:'AI provider से कनेक्शन नहीं हो पाया।',provider_auth:'AI सेवा का configuration उपलब्ध नहीं है।',provider_configuration:'AI सेवा का configuration उपलब्ध नहीं है।',provider_not_configured:'AI सेवा उपलब्ध नहीं है।',sse_protocol:'जवाब की stream अमान्य है। Retry करें।',sse_interrupted:'जवाब की stream अधूरी रह गई। Retry से स्थिति जाँचें।',provider_stream_interrupted:'AI stream अधूरी रह गई।',provider_stream_error:'AI stream में त्रुटि हुई।',provider_protocol:'AI सेवा का जवाब अमान्य था।',provider_empty_response:'AI सेवा ने खाली जवाब दिया।',provider_invalid_json:'AI planner का जवाब अमान्य था।',provider_unavailable:'AI सेवा अभी उपलब्ध नहीं है।',tool_unavailable:'माँगी गई सेवा अभी उपलब्ध नहीं है।',invalid_request:'संदेश या बातचीत अमान्य है।',client_disconnected:'कनेक्शन बंद हुआ। Retry से स्थिति जाँचें।',network_error:'Network से संपर्क नहीं हो पाया। उसी request को Retry करें।',request_in_progress:'यह request अभी चल रही है। Retry केवल स्थिति जाँचेगा।',request_uncertain:'पिछली request की स्थिति अनिश्चित है। अपने-आप generation नहीं दोहराई जाएगी।',request_failed:'यह request विफल होकर बंद हो गई है।',request_id_conflict:'Request ID दूसरे संदेश से जुड़ी है।',request_replay_expired:'इस request का replay समय समाप्त है।',history_save_pending:'जवाब सुरक्षित है; history की पुष्टि बाकी है। Retry करें।',idempotency_unavailable:'सुरक्षित request tracking उपलब्ध नहीं है। Retry करें।',invalid_request_id:'Request ID अमान्य है।'};
      armChatCooldown(error.retryAfter||(code==='server_rate_limit'||code==='provider_rate_limit'?30:0));
      const fresh=['request_failed','request_uncertain','request_replay_expired'].includes(code);
      chatStatus(request,messages[code]||'जवाब पूरा नहीं हो पाया। Retry से स्थिति जाँचें।',error.retryable!==false&&!fresh&&!['login_required','auth_configuration','conversation_forbidden','request_id_conflict','invalid_request_id','invalid_request'].includes(code),fresh?'confirm_new_request':error.recovery);
      timing.ok=false;}}
    finally{clearTimeout(timeout);clearTimeout(request.serverTimer);clearTimeout(paintTimer);if(stillCurrent()){activeChatRequest=null;sendInFlight=false;showTyping(false);setChatBusy(false);window.samarthChatTiming=timing;}}
}
function initializeChatExperience(){
    const box=document.getElementById('chatMessages');
    const stopAutoScroll=()=>{alignChatTurn=false;};
    // Cancel alignment before the next stream paint when the reader takes control.
    for(const type of ['wheel','touchmove','pointerdown'])box.addEventListener(type,stopAutoScroll,{passive:true});
    box.addEventListener('keydown',event=>{if(['ArrowUp','ArrowDown','PageUp','PageDown','Home','End',' '].includes(event.key))stopAutoScroll();});
    // Re-align only an untouched new turn; preserve the reader's position otherwise.
    new ResizeObserver(layoutChatReply).observe(box);
    new MutationObserver(layoutChatReply).observe(box,{childList:true,subtree:true});
    document.getElementById('shareChatLocation').onclick=async()=>{
        if(currentChatLocation()){stopChatLocation();return;}
        if(!window.confirm('Allow your current location snapshot in chat messages you send for 5 minutes? Use Stop to end this sooner. Already sent messages cannot be recalled.'))return;
        const button=document.getElementById('shareChatLocation'),version=++chatLocationVersion;
        button.disabled=true;button.textContent='Requesting permission…';
        try{
            const value=await getClientLocation();if(version!==chatLocationVersion)return;
            if(Number.isFinite(value.latitude)&&Number.isFinite(value.longitude)){
                sharedChatLocation=value;sharedLocationAt=Date.now();button.textContent='Location enabled · Stop';button.setAttribute('aria-pressed','true');
                chatLocationTimer=setTimeout(stopChatLocation,300000);
            }else{stopChatLocation();showFeedbackMessage('Location उपलब्ध नहीं है। शहर का नाम लिख सकते हैं।');}
        }finally{if(version===chatLocationVersion)button.disabled=false;}
    };
    navigator.permissions?.query({name:'geolocation'}).then(permission=>{permission.onchange=()=>{if(permission.state!=='granted')stopChatLocation();};}).catch(()=>{});
    document.addEventListener('visibilitychange',()=>{if(!document.hidden)currentChatLocation();});
    setChatBusy(false);
}
