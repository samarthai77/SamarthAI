'use strict';
// Offline only. Do not log, export, validate online or modify credential values.
const fs = require('node:fs');
const cp = require('node:child_process');
const crypto = require('node:crypto');
const git = args => cp.execFileSync('git',args,{encoding:'utf8',maxBuffer:32*1024*1024});
const scan = JSON.parse(fs.readFileSync('review/history-scan.json','utf8'));
const identities = new Set(), locations = [];
for (const item of scan.findings.filter(item=>item.rule==='provider-token')) {
  const source = git(['cat-file','blob',item.blob]);
  const matches = [...source.matchAll(/\bsb_secret_[A-Za-z0-9_-]{20,}\b/g)];
  if (!matches.length) continue;
  for (const match of matches) identities.add(crypto.createHash('sha256').update(match[0]).digest('hex'));
  const lines = source.split('\n');
  const keys = lines.slice(0,item.line).reverse().map(line=>line.match(/-\s*key:\s*(SUPABASE_[A-Z_]+)/)?.[1]).filter(Boolean);
  locations.push({path:item.path,line:item.line,setting:keys[0]||'unclassified',inOriginalCommit:item.inSecurityCommit,commits:git(['log','--all','--find-object='+item.blob,'--format=%h','--',item.path]).trim().split('\n')});
}
const currentMatches = [];
for (const file of git(['ls-files']).trim().split('\n')) {
  const bytes=fs.readFileSync(file);if(bytes.includes(0))continue;
  if (/\bsb_secret_[A-Za-z0-9_-]{20,}\b/.test(bytes.toString('utf8'))) currentMatches.push(file);
}
const result = {method:'offline Git object inspection and current tracked-source scan',distinctHistoricalSupabaseSecretFormatValues:identities.size,historicalLocations:locations,currentTrackedFilesWithSecretFormat:currentMatches,liveValidity:'unverified: opaque credential cannot be validated offline',networkRequests:0,rotationOrRevocationPerformed:false,historyRewritePerformed:false,originalSecurityCommit:git(['rev-parse','6270c05']).trim(),status:'OPEN: owner confirmation of prior revocation/rotation is still required'};
fs.writeFileSync('review/historical-key-check.json',JSON.stringify(result,null,2)+'\n');
console.log(JSON.stringify(result,null,2));
