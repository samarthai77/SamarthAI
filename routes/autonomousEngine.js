'use strict';

const express = require('express');
const jwt = require('jsonwebtoken');

const router = express.Router();
const streamResponse = require('../services/streamResponse');
const runtime=require('../services/chatRuntime');
const {userLimiter}=require('../middleware/chatRateLimit');
const {randomUUID}=require('crypto');

const autonomousEngine = require('../services/autonomousEngine');

const chatRoutes = require('./chat');
const gpsRoutes = require('./gps');
const sosRoutes = require('./sos');
const scannerRoutes = require('./scanner');
const familyRoutes = require('./family');
const memoryRoutes = require('./memory');


/* =========================================================
   AUTHENTICATION
   ========================================================= */

function authenticate(req, res, next) {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader) {
      return res.status(401).json({
        success: false,
        code:'login_required',
        error: 'Authorization header required'
      });
    }

    const parts = authHeader.split(' ');

    if (
      parts.length !== 2 ||
      parts[0].toLowerCase() !== 'bearer'
    ) {
      return res.status(401).json({
        success: false,
        code:'login_required',
        error: 'Invalid authorization format'
      });
    }

    const token = parts[1];

    if (!process.env.JWT_SECRET) {
      runtime.diagnostic({stage:'auth',code:'operation_failed'});

      return res.status(500).json({
        success: false,
        code:'auth_configuration',
        error: 'Authentication configuration error'
      });
    }

    const decoded = jwt.verify(
      token,
      process.env.JWT_SECRET
    );

    if (!decoded?.id) {
      return res.status(401).json({
        success: false,
        code:'login_required',
        error: 'Invalid authentication token'
      });
    }

    req.user = decoded;

    next();

  } catch (error) {

    runtime.diagnostic({stage:'auth',code:'operation_failed'});

    if (
      error.name === 'TokenExpiredError'
    ) {
      return res.status(401).json({
        success: false,
        code:'login_required',
        error: 'Authentication token expired'
      });
    }

    return res.status(401).json({
      success: false,
      code:'login_required',
      error: 'Invalid authentication token'
    });
  }
}


/* =========================================================
   HEALTH
   GET /api/autonomous/health
   ========================================================= */

router.get('/health', (req, res) => {

  try {

    const status =
      autonomousEngine.getStatus();

    return res.json({
      success: true,
      ...status
    });

  } catch (error) {

    runtime.diagnostic({stage:'auth',code:'operation_failed'});

    return res.status(500).json({
      success: false,
      status: 'error',
      error: 'Autonomous engine health check failed'
    });
  }
});


/* =========================================================
   AGENTS
   GET /api/autonomous/agents
   ========================================================= */

router.get('/agents', (req, res) => {

  try {

    return res.json({
      success: true,
      agents:
        autonomousEngine.listAgents()
    });

  } catch (error) {

    runtime.diagnostic({stage:'auth',code:'operation_failed'});

    return res.status(500).json({
      success: false,
      error: 'Unable to load agents'
    });
  }
});


/* =========================================================
   AUTONOMOUS RUN
   POST /api/autonomous/run
   ========================================================= */

router.post(
  '/run',
  authenticate,
  userLimiter,
  async (req, res) => {

    try {

      const {
        message,
        conversationId,
        mode,
        metadata
      } = req.body || {};

      if (
        typeof message !== 'string' ||
        !message.trim()
      ) {
        return res.status(400).json({
          success: false,
          code:'invalid_request',
          error: 'Message is required'
        });
      }

      if (!conversationId) {
        return res.status(400).json({
          success: false,
          code:'invalid_request',
          error: 'conversationId is required'
        });
      }

      const options = {userId:req.user.id, conversationId, requestId:req.body.requestId??randomUUID(), message:message.trim(), mode:mode || 'conversation',
        metadata:metadata && typeof metadata === 'object' ? metadata : {}};
      if (message.length > 10000) return res.status(400).json({success:false,code:'invalid_request',error:'Message too long'});
      if (req.body.stream === true && req.accepts('text/event-stream')) return streamResponse(req,res,autonomousEngine.run,options);
      return streamResponse.json(req,res,autonomousEngine.run,options);

    } catch (error) {

      runtime.diagnostic({stage:'auth',code:'operation_failed'});

      return res.status([400,403,409].includes(error.status) ? error.status : 503).json({
        success: false,
        autonomous: true,
        ...runtime.envelope(error)
      });
    }
  }
);


/* =========================================================
   LEGACY / DIRECT ROUTES
   Keep existing V1 functionality working.
   ========================================================= */

router.use(
  '/chat',
  chatRoutes
);

router.use(
  '/gps',
  gpsRoutes
);

router.use(
  '/sos',
  sosRoutes
);

router.use(
  '/scanner',
  scannerRoutes
);

router.use(
  '/family',
  familyRoutes
);

router.use(
  '/memory',
  memoryRoutes
);


/* =========================================================
   404 FOR AUTONOMOUS ROUTES
   ========================================================= */

router.use(
  (req, res) => {

    return res.status(404).json({
      success: false,
      error: 'Autonomous API route not found',
      path: req.originalUrl
    });
  }
);


module.exports = router;
