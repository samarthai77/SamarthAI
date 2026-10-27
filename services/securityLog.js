'use strict';
// SDK error objects can contain request headers, bearer tokens and credentials.
// Log only an allowlisted category, never the raw error/config/body/message.
const allowed = new Set(['23505', '42501', 'PGRST116', 'AbortError', 'TimeoutError', 'JsonWebTokenError', 'TokenExpiredError']);
function diagnostic(level, values) {
  const error = values.find(value => value && typeof value === 'object');
  const candidate = error?.code || error?.name;
  console[level]('[backend]', { event: 'operation_failed', code: allowed.has(candidate) ? candidate : 'internal_error' });
}
module.exports = { error: (...values) => diagnostic('error', values), warn: (...values) => diagnostic('warn', values) };
