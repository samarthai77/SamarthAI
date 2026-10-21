'use strict';
// Opt-in SSE on the existing authenticated endpoint; legacy JSON clients are unchanged.
async function streamResponse(req, res, run, options) {
  const controller = new AbortController();
  const abort = () => controller.abort(new DOMException('Client disconnected', 'AbortError'));
  req.on('aborted', abort); res.on('close', abort);
  const deadline = setTimeout(() => controller.abort(new DOMException('Request timed out', 'TimeoutError')), 120000);
  res.status(200).set({'Content-Type':'text/event-stream; charset=utf-8','Cache-Control':'no-cache, no-transform','X-Accel-Buffering':'no'});
  res.flushHeaders();
  const send = (event, data) => { if (!res.destroyed && !res.writableEnded) res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`); };
  const heartbeat = setInterval(() => { if (!res.destroyed) res.write(': keepalive\n\n'); }, 15000);
  send('ready', {streaming:true});
  try {
    const result = await run({...options, signal:controller.signal, onDelta:text => send('delta', {text})});
    if (controller.signal.aborted) throw controller.signal.reason;
    send('done', result);
  } catch (error) {
    const code = error.code || (controller.signal.aborted ? 'request_timeout' : 'chat_unavailable');
    send('error', {code, retryable:true, error:'जवाब पूरा नहीं हो पाया। फिर कोशिश करें।'});
  } finally {
    clearTimeout(deadline); clearInterval(heartbeat);
    req.off('aborted', abort); res.off('close', abort); res.end();
  }
}
module.exports = streamResponse;
