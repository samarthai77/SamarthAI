'use strict';
const runtime=require('./chatRuntime');
async function transport(req,res,run,options,stream=true){return runtime.run(options,async()=>{
 const controller=new AbortController();
 const abort=()=>controller.abort(runtime.error('client_disconnected',499));
 req.on('aborted',abort);res.on('close',abort);
 const deadline=setTimeout(()=>controller.abort(runtime.error('request_timeout',504)),runtime.remaining());
 let heartbeat;
 const send=(event,data)=>{if(!res.destroyed&&!res.writableEnded)res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);};
 if(stream){res.status(200).set({'Content-Type':'text/event-stream; charset=utf-8','Cache-Control':'no-cache, no-transform','X-Accel-Buffering':'no'});res.flushHeaders();heartbeat=setInterval(()=>{if(!res.destroyed&&!res.writableEnded)res.write(': keepalive\n\n');},15000);send('ready',{streaming:true,deadlineMs:runtime.remaining(),requestId:options.requestId});}
 runtime.diagnostic({stage:'request'});
 try{const result=await runtime.wait(run({...options,signal:controller.signal,onDelta:stream?text=>send('delta',{text}):undefined}),controller.signal);if(controller.signal.aborted)throw controller.signal.reason;
  if(stream)send('done',result);else if(!res.destroyed)res.json(result);
  runtime.diagnostic({stage:'request',status:200});
 }catch(err){const payload=runtime.envelope(err);runtime.diagnostic({stage:'request',code:payload.code,status:err.status||503});
  if(stream)send('error',payload);else if(!res.destroyed){if(payload.retryAfter)res.set('Retry-After',String(payload.retryAfter));res.status(['provider_auth','provider_configuration','provider_not_configured'].includes(payload.code)?503:[400,401,403,409,429,504].includes(err.status)?err.status:503).json(payload);}
 }finally{clearTimeout(deadline);clearInterval(heartbeat);req.off('aborted',abort);res.off('close',abort);if(stream&&!res.writableEnded)res.end();}
});}
function streamResponse(req,res,run,options){return transport(req,res,run,options,true);}
streamResponse.json=(req,res,run,options)=>transport(req,res,run,options,false);
module.exports=streamResponse;
