'use strict';
const {createHash, randomUUID} = require('crypto');
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const problem = (code, status=503) => Object.assign(new Error(code), {code, status});
function canonical(value) {
  if (Array.isArray(value)) return value.map(canonical);
  if (value && typeof value === 'object') return Object.fromEntries(Object.keys(value).sort().map(key => [key,canonical(value[key])]));
  return value;
}
function historyId(userId, requestId) {
  const bytes = createHash('sha256').update('samarthai-chat-v1:'+userId.toLowerCase()+':'+requestId.toLowerCase()).digest();
  bytes[6]=(bytes[6]&15)|64; bytes[8]=(bytes[8]&63)|128;
  const hex=bytes.subarray(0,16).toString('hex');
  return `${hex.slice(0,8)}-${hex.slice(8,12)}-${hex.slice(12,16)}-${hex.slice(16,20)}-${hex.slice(20)}`;
}
async function query(value) {
  const result=await (value.abortSignal ? value.abortSignal(AbortSignal.timeout(15000)) : value);
  return result;
}
async function execute({db, options, generate, persist}) {
  const {userId,conversationId,message,mode='conversation',metadata={}}=options;
  if (![userId,conversationId,options.requestId].every(value=>typeof value==='string'&&UUID.test(value))) throw problem('invalid_request_id',400);
  const requestId=options.requestId.toLowerCase(), token=randomUUID();
  // Location is deliberately excluded: retries can revoke location without changing request identity.
  const fingerprint=createHash('sha256').update(JSON.stringify(canonical({conversationId:conversationId.toLowerCase(),message:message.trim(),mode,language:metadata.language || 'hi-IN'}))).digest('hex');
  const owned=()=>db.from('chat_idempotency').select('*').eq('user_id',userId).eq('request_id',requestId).single();
  const write=patch=>db.from('chat_idempotency').update(patch).eq('user_id',userId).eq('request_id',requestId).eq('token',token).eq('state','in_progress').select('request_id').single();
  // Only the unique-key INSERT winner may call a provider. No timeout takeover.
  const claim=await query(db.from('chat_idempotency').insert({user_id:userId,request_id:requestId,conversation_id:conversationId,fingerprint,token,state:'in_progress'}).select('request_id').single());
  let result, replayed=false;
  if (claim.error) {
    if (claim.error.code!=='23505') throw problem('idempotency_unavailable');
    const {data:row,error}=await query(owned());
    if (error||!row) throw problem('idempotency_unavailable');
    if (row.conversation_id.toLowerCase()!==conversationId.toLowerCase()||row.fingerprint!==fingerprint) throw problem('request_id_conflict',409);
    if (row.state==='in_progress') throw problem('request_in_progress',409);
    if (row.state==='failed') throw problem('request_failed',409);
    if (row.state!=='completed'||!row.result||!Number.isFinite(Date.parse(row.replay_expires_at))||Date.parse(row.replay_expires_at)<=Date.now()) {
      // Remove the expired response copy, retain the unique-key tombstone.
      await query(db.from('chat_idempotency').update({result:null}).eq('user_id',userId).eq('request_id',requestId).eq('state','completed'));
      throw problem('request_replay_expired',409);
    }
    result=row.result; replayed=true;
  } else {
    if (!claim.data) throw problem('idempotency_unavailable');
    try {
      result=await generate();
      result={...result,requestId};
      const finished=new Date(), expires=new Date(finished.getTime()+86400000);
      // Persist generation BEFORE history. Recovery uses this response, never AI again.
      const done=await query(write({state:'completed',result,finished_at:finished.toISOString(),replay_expires_at:expires.toISOString()}));
      if (done.error||!done.data) throw problem('idempotency_unavailable');
    } catch (error) {
      // A completion may already have committed despite a network error. The
      // in_progress condition prevents this write from overwriting it.
      try { await query(write({state:'failed',failure_code:'generation_or_commit_failed',finished_at:new Date().toISOString()})); } catch {}
      throw error;
    }
  }
  if (!result.persistence?.saved) {
    const id=await persist(result,historyId(userId,requestId));
    if (!id) throw problem('history_save_pending');
    result={...result,persistence:{saved:true,chatId:id}};
    const saved=await query(db.from('chat_idempotency').update({result}).eq('user_id',userId).eq('request_id',requestId).eq('state','completed').select('request_id').single());
    if (saved.error||!saved.data) throw problem('history_save_pending');
  }
  return {...result,replayed};
}
module.exports={execute,historyId};
