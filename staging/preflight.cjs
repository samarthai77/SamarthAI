'use strict';
// Local-only configuration checks: no network requests, migrations or secret output.
const fs = require('node:fs');
const path = require('node:path');
function validate(env, root = path.resolve(__dirname, '..')) {
  const errors = [];
  if (env.STAGING_ONLY !== 'true') errors.push('STAGING_ONLY must explicitly equal true');
  if (process.versions.node !== '24.22.1') errors.push('Node 24.22.1 is required');
  try {
    const url = new URL(env.SUPABASE_URL);
    if (!env.STAGING_SUPABASE_PROJECT_REF || url.protocol !== 'https:' || url.hostname !== `${env.STAGING_SUPABASE_PROJECT_REF}.supabase.co`) errors.push('A dedicated staging Supabase project must match its declared project ref');
    // Public project identifier only; never permit the previously configured production project.
    if (url.hostname === 'curszxwxfujksnkihkc.supabase.co') errors.push('Production database is forbidden in staging');
  } catch { errors.push('Valid staging SUPABASE_URL is required'); }
  if (!/^rzp_test_/.test(env.RAZORPAY_KEY_ID || '')) errors.push('Only Razorpay test mode is allowed');
  for (const name of ['FRONTEND_URL', 'PUBLIC_APP_URL']) {
    try {
      const url = new URL(env[name]);
      if (url.protocol !== 'https:' || ['samarthai.life','samarthai-backend.onrender.com'].includes(url.hostname)) errors.push(`${name} must point to isolated staging HTTPS`);
    } catch { errors.push(`Valid staging ${name} is required`); }
  }
  if (!env.JWT_SECRET || Buffer.byteLength(env.JWT_SECRET) < 32) errors.push('A new staging JWT secret of at least 32 bytes is required');
  for (const name of ['SUPABASE_SERVICE_KEY','RAZORPAY_KEY_SECRET','RAZORPAY_WEBHOOK_SECRET','GEMINI_API_KEY']) {
    if (!env[name] || /REPLACE|placeholder|test-fixture/i.test(env[name])) errors.push(`${name} must be provisioned independently for staging`);
  }
  const frontend = path.join(root, 'frontend');
  for (const file of fs.readdirSync(frontend).filter(file => /\.(html|js)$/.test(file))) {
    if (/https:\/\/samarthai-backend\.onrender\.com\/api/.test(fs.readFileSync(path.join(frontend,file),'utf8'))) errors.push(`Production API URL is hardcoded in frontend/${file}`);
  }
  return errors;
}
if (require.main === module) {
  const errors = validate(process.env);
  if (errors.length) { for (const message of errors) console.error(`[staging-preflight] ${message}`); process.exitCode = 1; }
  else console.log('[staging-preflight] Configuration checks passed; live DB policies and provider mode still require independent verification');
}
module.exports = { validate };
