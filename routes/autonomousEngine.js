'use strict';

const express = require('express');
const jwt = require('jsonwebtoken');

const router = express.Router();

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
        error: 'Invalid authorization format'
      });
    }

    const token = parts[1];

    if (!process.env.JWT_SECRET) {
      console.error(
        '❌ JWT_SECRET is not configured'
      );

      return res.status(500).json({
        success: false,
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
        error: 'Invalid authentication token'
      });
    }

    req.user = decoded;

    next();

  } catch (error) {

    console.error(
      '❌ Autonomous authentication error:',
      error.message
    );

    if (
      error.name === 'TokenExpiredError'
    ) {
      return res.status(401).json({
        success: false,
        error: 'Authentication token expired'
      });
    }

    return res.status(401).json({
      success: false,
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

    console.error(
      '❌ Autonomous health error:',
      error
    );

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

    console.error(
      '❌ Agent list error:',
      error
    );

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
          error: 'Message is required'
        });
      }

      if (!conversationId) {
        return res.status(400).json({
          success: false,
          error: 'conversationId is required'
        });
      }

      const result =
        await autonomousEngine.run({
          userId: req.user.id,
          conversationId,
          message: message.trim(),
          mode: mode || 'conversation',
          metadata:
            metadata &&
            typeof metadata === 'object'
              ? metadata
              : {}
        });

      return res.json(result);

    } catch (error) {

      console.error(
        '❌ Autonomous run error:',
        error
      );

      return res.status(500).json({
        success: false,
        autonomous: true,
        error:
          error.message ||
          'Autonomous engine execution failed'
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
