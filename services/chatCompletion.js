'use strict';
// One attempt per configured provider. Never log bodies, prompts, URLs or credentials.
class ProviderError extends Error {
  constructor(code, status = 503) { super(code); this.code = code; this.status = status; }
}
function errorCode(status) {
  return status === 401 || status === 403 ? 'provider_auth' : status === 429 ? 'provider_rate_limit' : status === 400 || status === 404 ? 'provider_configuration' : 'provider_unavailable';
}
async function readEvents(body, receive, signal) {
  const reader = body.getReader(), decoder = new TextDecoder(); let buffer = '';
  const drain = () => {
    let split;
    while ((split = buffer.indexOf('\n\n')) !== -1) {
      const frame = buffer.slice(0, split); buffer = buffer.slice(split + 2);
      const data = frame.split('\n').filter(line => line.startsWith('data:')).map(line => line.slice(5).trimStart()).join('\n');
      if (data && data !== '[DONE]') receive(JSON.parse(data));
    }
  };
  try {
    while (true) {
      signal?.throwIfAborted();
      const {done, value} = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, {stream:true}).replace(/\r/g, '');
      if (buffer.length > 1024 * 1024) throw new ProviderError('provider_protocol');
      drain();
    }
    buffer += decoder.decode(); if (buffer.trim()) { buffer += '\n\n'; drain(); }
  } finally { await reader.cancel().catch(() => {}); reader.releaseLock(); }
}
async function completeChat({messages, response_format, max_completion_tokens = 2048, temperature = 0.3, signal, onDelta} = {}) {
  const providers = [
    {name:'groq', key:process.env.GROQ_API_KEY, model:process.env.GROQ_MODEL || 'openai/gpt-oss-20b', url:'https://api.groq.com/openai/v1/chat/completions'},
    {name:'gemini', key:process.env.GEMINI_API_KEY, model:process.env.GEMINI_MODEL || 'gemini-2.5-flash'},
    {name:'openai', key:process.env.OPENAI_API_KEY, model:process.env.OPENAI_MODEL || 'gpt-4.1-mini', url:'https://api.openai.com/v1/chat/completions'}
  ].filter(provider => provider.key);
  if (!providers.length) throw new ProviderError('provider_not_configured');
  let failure;
  for (const provider of providers) {
    signal?.throwIfAborted();
    const timeout = new AbortController();
    const timer = setTimeout(() => timeout.abort(), response_format ? 20000 : 45000);
    const combined = signal ? AbortSignal.any([signal, timeout.signal]) : timeout.signal;
    let text = '', streamed = false;
    const push = delta => { if (typeof delta === 'string' && delta) { text += delta; if (onDelta) { streamed = true; onDelta(delta); } } };
    try {
      const stream = !!onDelta && !response_format;
      let url = provider.url, headers = {'Content-Type':'application/json'}, body;
      if (provider.name === 'gemini') {
        url = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(provider.model)}:${stream ? 'streamGenerateContent?alt=sse' : 'generateContent'}`;
        headers['x-goog-api-key'] = provider.key;
        body = {
          systemInstruction:{parts:[{text:messages.filter(m => m.role === 'system').map(m => m.content).join('\n')}]},
          contents:messages.filter(m => m.role !== 'system').map(m => ({role:m.role === 'assistant' ? 'model' : 'user', parts:[{text:m.content}]})),
          generationConfig:{temperature, maxOutputTokens:max_completion_tokens, ...(response_format ? {responseMimeType:'application/json'} : {})}
        };
      } else {
        headers.Authorization = `Bearer ${provider.key}`;
        body = {model:provider.model, messages, temperature, stream, max_completion_tokens, ...(response_format ? {response_format} : {})};
        if (provider.name === 'groq' && provider.model.startsWith('openai/gpt-oss')) Object.assign(body, {reasoning_effort:'low', include_reasoning:false});
      }
      const response = await fetch(url, {method:'POST', headers, body:JSON.stringify(body), signal:combined});
      if (!response.ok) { await response.body?.cancel(); throw new ProviderError(errorCode(response.status), response.status); }
      const deltaFrom = data => provider.name === 'gemini'
        ? (data.candidates?.[0]?.content?.parts || []).filter(p => !p.thought).map(p => p.text || '').join('')
        : data.choices?.[0]?.delta?.content;
      if (stream && response.headers.get('content-type')?.includes('text/event-stream')) {
        let finished = false;
        await readEvents(response.body, data => {
          if (data.error) throw new ProviderError('provider_stream_error');
          push(deltaFrom(data));
          if (data.choices?.[0]?.finish_reason || data.candidates?.[0]?.finishReason) finished = true;
        }, combined);
        if (!finished) throw new ProviderError('provider_stream_interrupted');
      } else {
        // A provider can return complete JSON instead; this is an explicit non-streaming fallback.
        const data = await response.json();
        push(provider.name === 'gemini' ? deltaFrom(data) : data.choices?.[0]?.message?.content);
      }
      if (!text.trim()) throw new ProviderError('provider_empty_response');
      if (response_format) {
        try { JSON.parse(text.replace(/^```(?:json)?\s*/i,'').replace(/\s*```$/,'')); }
        catch { throw new ProviderError('provider_invalid_json'); }
      }
      return text;
    } catch (error) {
      if (signal?.aborted) throw signal.reason;
      failure = error instanceof ProviderError ? error : new ProviderError(timeout.signal.aborted ? 'provider_timeout' : 'provider_network');
      console.warn('[chat-provider]', {provider:provider.name, code:failure.code, status:failure.status});
      // Switching after text reached the browser would splice two different answers together.
      if (streamed) { failure.partial=true; throw failure; }
    } finally { clearTimeout(timer); }
  }
  throw failure;
}
module.exports = {completeChat, ProviderError, readEvents};
