'use strict';
const {rateLimit}=require('express-rate-limit');
const runtime=require('../services/chatRuntime');
function limited(req,res){const reset=req.rateLimit?.resetTime?.getTime?.()||Date.now()+60000;const retryAfter=Math.max(1,Math.ceil((reset-Date.now())/1000));runtime.diagnostic({stage:'rate_limit',requestId:req.body?.requestId,code:'server_rate_limit',status:429});res.set('Retry-After',String(retryAfter));return res.status(429).json(runtime.envelope(runtime.error('server_rate_limit',429,{retryAfter})));}
const userLimiter=rateLimit({windowMs:60000,limit:20,keyGenerator:req=>req.user.id,standardHeaders:'draft-8',legacyHeaders:false,handler:limited});
module.exports={userLimiter,limited};
