'use strict';
const jwt = require('jsonwebtoken');
const { sessionVersion, equalHex } = require('../services/security');

function createSessionGuard(database, { required = false } = {}) {
  return async function sessionGuard(req, res, next) {
    const authorization = req.headers.authorization;
    if (!authorization && !required) return next();
    if (typeof authorization !== 'string' || !/^Bearer \S+$/.test(authorization)) {
      return res.status(401).json({ error: 'Authentication required', code: 'login_required' });
    }
    try {
      const decoded = jwt.verify(authorization.slice(7), process.env.JWT_SECRET, { algorithms: ['HS256'] });
      if (!decoded || typeof decoded.id !== 'string' || !decoded.id || typeof decoded.sv !== 'string') {
        return res.status(401).json({ error: 'Please login again', code: 'login_required' });
      }
      const { data: user, error } = await database.from('users').select('id, password, is_active')
        .eq('id', decoded.id).maybeSingle().abortSignal(AbortSignal.timeout(10000));
      if (error) return res.status(503).json({ error: 'Authentication service unavailable' });
      if (!user || user.is_active === false || !equalHex(sessionVersion(user.password), decoded.sv)) {
        return res.status(401).json({ error: 'Please login again', code: 'login_required' });
      }
      req.user = decoded;
      next();
    } catch (error) {
      if (['JsonWebTokenError', 'TokenExpiredError', 'NotBeforeError'].includes(error.name)) {
        return res.status(401).json({ error: 'Invalid or expired token', code: 'login_required' });
      }
      return res.status(503).json({ error: 'Authentication service unavailable' });
    }
  };
}
module.exports = { createSessionGuard };
