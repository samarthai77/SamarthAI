'use strict';
// A fresh headless Edge profile; every non-local request is intercepted before network.
const fs = require('node:fs');
const path = require('node:path');
const Module = require('node:module');
const { chromium } = require(path.join(process.env.TEMP, 'samarthai-browser-review/node_modules/playwright'));
Object.assign(process.env, { JWT_SECRET: 'browser-test-only-not-a-real-secret', SUPABASE_URL: 'https://fixture.supabase.co', SUPABASE_SERVICE_KEY: 'test-fixture', GEMINI_API_KEY: 'test-fixture', RAZORPAY_KEY_ID: 'test-fixture', RAZORPAY_KEY_SECRET: 'test-fixture' });
const db = require('../tests/helpers/securityDatabase.cjs')({});
const originalLoad = Module._load;
Module._load = function(request, parent, main) {
  if (request === '@supabase/supabase-js') return { createClient: () => db };
  if (request === 'razorpay') return class { api = { rq: { defaults: {} } }; };
  return originalLoad.call(this, request, parent, main);
};
let app; try { app = require('../server'); } finally { Module._load = originalLoad; }
const results = [], observations = [];
const user = { id: '11111111-1111-4111-8111-111111111111', name: 'Browser Fixture', email: 'browser@example.invalid' };
async function check(name, fn) { try { await fn(); results.push({ name, status: 'pass' }); } catch (error) { results.push({ name, status: 'fail', reason: error.message.slice(0,1400) }); } }
function ensure(value, text) { if (!value) throw new Error(text); }
(async () => {
  const server = app.listen(0, '127.0.0.1'); await new Promise(resolve => server.once('listening', resolve));
  const base = `http://127.0.0.1:${server.address().port}`;
  let browser;
  try {
    browser = await chromium.launch({ executablePath: 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe', headless: true });
    for (const mobile of [false, true]) {
      const label = mobile ? 'mobile-emulation' : 'desktop';
      const context = await browser.newContext({ viewport: mobile ? { width:390,height:844 } : { width:1280,height:800 }, isMobile:mobile, hasTouch:mobile, serviceWorkers:'block' });
      const intended = [], errors = [], csp = [], sameOriginApiRequests = [];
      await context.route('**/*', async route => {
        const request = route.request(); const url = new URL(request.url());
        if (url.origin === base && !url.pathname.startsWith('/api/')) return route.continue();
        // Never proxy to Production or use real credentials, even for a GET.
        if (url.origin !== base) intended.push({ host: url.hostname, path: url.pathname, method: request.method() });
        if (url.origin === base && url.pathname.startsWith('/api/')) {
          sameOriginApiRequests.push({ path:url.pathname,method:request.method() });
          let body = [];
          if (url.pathname.endsWith('/auth/login')) body = { token:'browser-fixture-token', user };
          else if (url.pathname.endsWith('/auth/profile')) body = user;
          else if (url.pathname === '/api/family') body = { family:null,members:[],currentUserRole:null };
          else if (url.pathname.endsWith('/family/alerts')) body = { alerts:[] };
          else if (url.pathname.endsWith('/banners/public')) body = { banners:[] };
          else if (url.pathname.endsWith('/payment/status')) body = { isPaid:false,plan:{id:'free'},subscription:null };
          else if (url.pathname.endsWith('/payment/plans')) body = { currency:'INR',plans:[] };
          else if (url.pathname.endsWith('/sos/family-active')) body = { active:false,sos:null };
          else if (url.pathname.endsWith('/chat/conversations')) body = { conversations:[] };
          return route.fulfill({ status:200,contentType:'application/json',headers:{'access-control-allow-origin':'*','access-control-allow-headers':'authorization,content-type','access-control-allow-methods':'GET,POST,PUT,PATCH,DELETE,OPTIONS'},body:JSON.stringify(body) });
        }
        if (url.hostname === 'checkout.razorpay.com') return route.fulfill({ status:200,contentType:'text/javascript',body:'window.Razorpay = function(){ this.open = function(){}; this.on = function(){}; };' });
        return route.abort('blockedbyclient');
      });
      const page = await context.newPage();
      page.on('pageerror', error => errors.push({ page:new URL(page.url()).pathname,message:error.message }));
      page.on('console', message => { if (/Content Security Policy|violates.*directive|Refused to/i.test(message.text())) csp.push({ page:new URL(page.url()).pathname,message:message.text().slice(0,350) }); });
      await check(`${label}: login redirects to Chat under enforced CSP`, async () => {
        await page.goto(base+'/login.html');
        await page.locator('#loginEmail').fill('browser@example.invalid');
        await page.locator('#loginPassword').fill('browser fixture password');
        await page.locator('#loginBtn').click();
        await page.waitForURL('**/chat.html', { timeout:5000 });
        ensure(await page.locator('#chatInput').isVisible(), 'Chat composer missing');
      });
      for (const [feature, file] of Object.entries({family:'family.html',sos:'sos.html',gps:'gps.html',scanner:'camera.html',services:'services.html'})) {
        await check(`${label}: Chat navigation to ${feature}`, async () => {
          await page.goto(base+'/chat.html');
          await page.locator('#inputPlusBtn').click();
          if(!mobile && feature==='family') await page.screenshot({path:'review/desktop-navigation.png'});
          const button = page.locator(`[onclick="openFeature('${feature}')"]`).filter({visible:true}).first();
          await button.click({ timeout:3000 });
          await page.waitForURL('**/'+file, { timeout:4000 });
        });
      }
      await check(`${label}: Chat feature retains composer`, async () => {
        await page.goto(base+'/chat.html'); await page.locator('#inputPlusBtn').click();
        await page.locator('[onclick="openFeature(\'chat\')"]').filter({visible:true}).first().click({timeout:3000});
        ensure(await page.locator('#chatInput').evaluate(el => el === document.activeElement),'Chat composer not focused');
      });
      await check(`${label}: language selection persists`, async () => {
        await page.goto(base+'/chat.html');
        const answer = dialog => dialog.type() === 'prompt' ? dialog.accept('en-US') : dialog.accept();
        page.on('dialog',answer); await page.evaluate(()=>openLanguageSettings()); page.off('dialog',answer);
        ensure(await page.evaluate(()=>localStorage.getItem('samarthai_language'))==='en-US','Language did not persist');
      });
      await check(`${label}: GPS asks only after user action; denial is handled`, async () => {
        await page.addInitScript(()=>{ window.__gpsCalls=0; navigator.geolocation.watchPosition=(_ok,fail)=>{window.__gpsCalls++; queueMicrotask(()=>fail({code:1})); return 1;}; });
        await page.goto(base+'/gps.html'); ensure(await page.evaluate(()=>window.__gpsCalls)===0,'Automatic location access');
        await page.locator('#startGps').click(); await page.waitForFunction(()=>window.__gpsCalls===1);
        ensure((await page.locator('#gpsStatus').innerText()).includes('permission'),'Permission denial not explained');
      });
      await check(`${label}: Scanner does not request camera until click; denial is handled`, async () => {
        await page.addInitScript(()=>{window.__cameraCalls=0; navigator.mediaDevices.getUserMedia=async()=>{window.__cameraCalls++;throw new DOMException('Denied','NotAllowedError');};});
        await page.goto(base+'/camera.html'); ensure(await page.evaluate(()=>window.__cameraCalls)===0,'Automatic camera access');
        await page.locator('#startDocumentCamera').click(); await page.waitForFunction(()=>window.__cameraCalls===1);
        ensure((await page.locator('#status').innerText()).includes('permission'),'Camera permission denial not explained');
      });
      await check(`${label}: payment gateway script allowed by CSP (mocked)`, async()=>{await page.goto(base+'/payment.html');ensure(await page.evaluate(()=>typeof window.Razorpay)==='function','Checkout script blocked');});
      await check(`${label}: admin panel does not render privileged data from an empty fixture`,async()=>{await page.goto(base+'/admin.html');ensure(!(await page.content()).includes('PRIVATE_DATABASE_DETAIL'),'Diagnostic leak');});
      await check(`${label}: API calls stay on the served origin and never target Production`,async()=>{
        ensure(sameOriginApiRequests.some(r=>r.path==='/api/auth/login'),'Login did not use local API');
        ensure(sameOriginApiRequests.some(r=>r.path==='/api/auth/profile'),'Profile did not use local API');
        ensure(!intended.some(r=>r.host==='samarthai-backend.onrender.com'),'Production API request attempted');
      });
      await check(`${label}: no JavaScript page errors`,async()=>ensure(errors.length===0,JSON.stringify(errors)));
      await check(`${label}: no CSP console violations`,async()=>ensure(csp.length===0,JSON.stringify(csp)));
      observations.push({label,errors,csp,sameOriginApiRequests,blockedOrMockedExternalRequests:intended});
      await context.close();
    }
  } catch(error) { results.push({name:'browser infrastructure',status:'blocked',reason:error.message.split('\n')[0]}); }
  finally { if(browser)await browser.close();await new Promise(resolve=>server.close(resolve)); }
  const report={browser:'Local headless Edge; desktop and mobile viewport emulation; no real mobile hardware',results,observations,passed:results.filter(x=>x.status==='pass').length,failed:results.filter(x=>x.status==='fail').length};
  fs.writeFileSync('review/browser-results.json',JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify({passed:report.passed,failed:report.failed,results},null,2));
})().catch(error=>{console.error(error.message);process.exitCode=1;});
