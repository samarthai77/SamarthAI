/* Pinned local Markdown-it + DOMPurify. HTML is disabled before sanitization. */
const chatMarkdown = window.markdownit?.({html:false, linkify:false, breaks:false, typographer:false});
async function copyChatText(text, button) {
    try {
        if (navigator.clipboard?.writeText) await navigator.clipboard.writeText(text);
        else {
            const field=document.createElement('textarea'); field.value=text; field.style.position='fixed'; field.style.opacity='0';
            document.body.append(field); field.select(); const ok=document.execCommand('copy'); field.remove(); if(!ok) throw new Error();
        }
        const previous=button.textContent; button.textContent='Copied ✓';
        setTimeout(()=>{button.textContent=previous;},1200);
    } catch { if(typeof showFeedbackMessage==='function') showFeedbackMessage('Copy नहीं हुआ। Text चुनकर copy करें।'); }
}
function renderChatMarkdown(container, source, plain=false) {
    const text=String(source ?? ''); container.chatText=text;
    container.classList.toggle('plain-text',plain);
    if(plain || !chatMarkdown || !window.DOMPurify) {container.textContent=text;return;}
    container.innerHTML=DOMPurify.sanitize(chatMarkdown.render(text),{USE_PROFILES:{html:true},FORBID_TAGS:['style','form','input','button','img'],FORBID_ATTR:['style','id','name']});
    container.querySelectorAll('a').forEach(link=>{link.target='_blank';link.rel='noopener noreferrer';});
    container.querySelectorAll('table').forEach(table=>{const scroll=document.createElement('div');scroll.className='table-scroll';scroll.tabIndex=0;scroll.setAttribute('aria-label','Scrollable table');table.replaceWith(scroll);scroll.append(table);});
    container.querySelectorAll('pre > code').forEach(code=>{
        const pre=code.parentElement, block=document.createElement('section'), header=document.createElement('div');
        block.className='code-block';header.className='code-header';pre.tabIndex=0;pre.setAttribute('aria-label','Scrollable code block');
        const label=document.createElement('span');label.textContent=code.className.replace(/^language-/,'') || 'Code';
        const copy=document.createElement('button');copy.type='button';copy.textContent='Copy Code';copy.setAttribute('aria-label','Copy code');
        copy.onclick=()=>copyChatText(code.textContent,copy);header.append(label,copy);pre.replaceWith(block);block.append(header,pre);
    });
}
