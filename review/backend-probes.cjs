'use strict';
// Reuse the existing isolated HTTP fixture in memory; original tests/files are untouched.
const fs = require('node:fs');
const path = require('node:path');
const Module = require('node:module');
const filename = path.resolve(__dirname, '../tests/security-integration.test.cjs');
let source = fs.readFileSync(filename, 'utf8');
source = source.replace("paymentStatus = 'captured';", "paymentStatus = 'captured', invoiceProviderStatus = 'paid';");
source = source.replace("id, status: 'paid', amount: 19900", "id, status: invoiceProviderStatus, amount: 19900");
source += `
test('REVIEW: private profile stays bound to caller despite user-id parameters', async () => {
  const result=await request('/api/auth/profile?user_id='+uid,{auth:makeToken(other)});
  assert.equal(result.status,200);assert.equal(result.data.id,other);assert.equal(result.data.password,undefined);
});
test('REVIEW: another user cannot read private chat history or list its conversation', async () => {
  const id='44444444-4444-4444-8444-444444444444';
  tables.conversations=[{id,user_id:uid,title:'PRIVATE CHAT'}];
  const result=await request('/api/chat/history/'+id,{auth:makeToken(other)});
  assert([403,404].includes(result.status));
  const list=await request('/api/chat/history',{auth:makeToken(other)});
  assert.equal(list.status,200);assert(!JSON.stringify(list.data).includes('PRIVATE CHAT'));
});
test('REVIEW: Family non-admin cannot approve a join request', async () => {
  const result=await request('/api/family/join-requests/fixture-request/approve',{method:'POST',auth:makeToken(other),body:{}});
  assert.equal(result.status,403);
});
test('REVIEW: admin approval passes authenticated reviewer to RPC, not body reviewer', async () => {
  let received;db.rpc=async(name,args)=>{received={name,args};return {data:{approved:true},error:null};};
  const result=await request('/api/family/join-requests/fixture-request/approve',{method:'POST',body:{p_reviewer_id:other}});
  assert.equal(result.status,200);assert.equal(received.name,'approve_family_join_request');assert.equal(received.args.p_reviewer_id,uid);
});
test('REVIEW: active SOS location visible to same-family member but not outsiders', async () => {
  const third='55555555-5555-4555-8555-555555555555';
  tables.users.push({id:third,password:initialPassword,is_active:true});
  tables.family_members.push({id:'outsider-member',user_id:third,family_id:'outside-family',name:'Outside',is_active:true});
  tables.sos_alerts=[{id:'emergency',user_id:uid,location:'25.4, 81.8',status:'active',created_at:new Date().toISOString()}];
  const result=await request('/api/sos/family-active',{auth:makeToken(other)});
  assert.equal(result.status,200);assert.equal(result.data.active,true);assert.equal(result.data.sos.location,'25.4, 81.8');
  const outside=await request('/api/sos/family-active',{auth:makeToken(third)});
  assert.equal(outside.status,200);assert.equal(outside.data.active,false);
});
test('REVIEW: unrelated user cannot resolve someone else emergency', async () => {
  const third='55555555-5555-4555-8555-555555555555';
  const result=await request('/api/sos/emergency/resolve',{auth:makeToken(third),method:'POST',body:{}});
  assert([403,404].includes(result.status));assert.equal(tables.sos_alerts[0].status,'active');
});
test('REVIEW: failed provider payment cannot mark order paid', async () => {
  tables.payment_orders=[];await request('/api/payment/create-order',{method:'POST',body:{planId:'basic'}});
  paymentStatus='failed';
  const signature=crypto.createHmac('sha256',process.env.RAZORPAY_KEY_SECRET).update('order-fixture|pay-fixture').digest('hex');
  const result=await request('/api/payment/verify',{method:'POST',body:{razorpay_order_id:'order-fixture',razorpay_payment_id:'pay-fixture',razorpay_signature:signature}});
  assert.equal(result.status,409);assert.equal(tables.payment_orders[0].status,'created');paymentStatus='captured';
});
test('REVIEW: nearby Services search filters location radius and category', async () => {
  tables.services=[{id:'near-plumber',user_id:uid,title:'Near fixture',category:'plumber',latitude:25.401,longitude:81.801,is_active:true,users:{name:'Fixture'}}];
  const result=await request('/api/services/nearby?latitude=25.4&longitude=81.8&category=plumber&radius=5');
  assert.equal(result.status,200);assert.equal(result.data.length,1);assert.equal(result.data[0].id,'near-plumber');
  const otherCategory=await request('/api/services/nearby?latitude=25.4&longitude=81.8&category=electrician&radius=5');assert.equal(otherCategory.status,200);assert.equal(otherCategory.data.length,0);
});
test('REVIEW: refund event behavior is characterized, not declared a passing refund policy', async () => {
  tables.subscriptions=[{id:'refund-sub',user_id:uid,plan_id:'basic',provider_subscription_id:'sub-known',status:'active',current_end:new Date(Date.now()+3600000).toISOString()}];
  const raw=JSON.stringify({event:'refund.processed',payload:{refund:{entity:{id:'refund-fixture',payment_id:'pay-fixture'}}}});
  const signature=crypto.createHmac('sha256',process.env.RAZORPAY_WEBHOOK_SECRET).update(raw).digest('hex');
  const result=await request('/api/payment/webhook',{auth:null,method:'POST',raw,headers:{'content-type':'application/json','x-razorpay-signature':signature}});
  const status=await request('/api/payment/status');
  require('node:fs').writeFileSync(require('node:path').resolve(__dirname,'../review/refund-characterization.json'),JSON.stringify({httpStatus:result.status,paidAccessAfterRefund:status.data.isPaid,refundProcessingImplemented:false},null,2));
  assert.equal(result.status,200);assert.equal(status.data.isPaid,true);
});
test('REVIEW ACCEPTANCE: old invoice event must not overwrite authoritative provider invoice status', async () => {
  tables.subscriptions=[{id:'invoice-sub',user_id:uid,plan_id:'basic',provider_subscription_id:'sub-known',status:'expired',current_end:new Date(Date.now()-60000).toISOString()}];
  tables.payment_invoices=[];invoiceProviderStatus='expired';
  const raw=JSON.stringify({event:'invoice.paid',payload:{invoice:{entity:{id:'expired-invoice'}}}});
  const signature=crypto.createHmac('sha256',process.env.RAZORPAY_WEBHOOK_SECRET).update(raw).digest('hex');
  const result=await request('/api/payment/webhook',{auth:null,method:'POST',raw,headers:{'content-type':'application/json','x-razorpay-signature':signature}});
  assert.equal(result.status,200);assert.equal(tables.payment_invoices[0].status,'expired');
  assert.equal(tables.subscriptions[0].status,'expired');
  assert.equal((await request('/api/payment/status')).data.isPaid,false);
});
`;
const isolated = new Module(filename, module);
isolated.filename = filename; isolated.paths = Module._nodeModulePaths(path.dirname(filename));
isolated._compile(source, filename);
