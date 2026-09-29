'use strict';

/**
 * SamarthAI Autonomous Engine
 *
 * Central orchestration layer for the V1 agentic architecture.
 *
 * Main agents:
 * - chat
 * - family
 * - sos
 * - gps
 * - scanner
 * - services
 *
 * The engine delegates natural-language requests to the existing
 * conversation engine instead of duplicating business logic.
 */

const crypto = require('crypto');

const conversationEngine = require('./conversationEngine');

const runConversation =
  conversationEngine.runConversation ||
  conversationEngine;

/* =========================================================
   AGENT REGISTRY
   ========================================================= */

const AGENTS = Object.freeze({
  chat: {
    id: 'chat',
    name: 'Chat Agent',
    description:
      'Handles normal AI conversation, reasoning and general requests.',
    status: 'active'
  },

  family: {
    id: 'family',
    name: 'Family Agent',
    description:
      'Handles family-related information and family operations.',
    status: 'active'
  },

  sos: {
    id: 'sos',
    name: 'SOS Agent',
    description:
      'Handles emergency and SOS-related operations.',
    status: 'active'
  },

  gps: {
    id: 'gps',
    name: 'GPS Agent',
    description:
      'Handles location and GPS-related operations.',
    status: 'active'
  },

  scanner: {
    id: 'scanner',
    name: 'Scanner Agent',
    description:
      'Handles document and scanner-related operations.',
    status: 'active'
  },

  services: {
    id: 'services',
    name: 'Services Agent',
    description:
      'Handles local service discovery and service-related requests.',
    status: 'active'
  }
});


/* =========================================================
   HELPERS
   ========================================================= */

function isValidUuid(value) {
  if (typeof value !== 'string') {
    return false;
  }

  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
    .test(value);
}


function createRunId() {
  return crypto.randomUUID();
}


function normalizeMessage(message) {
  if (typeof message !== 'string') {
    return '';
  }

  return message.trim();
}


/* =========================================================
   AGENT RESOLUTION
   ========================================================= */

function getAgentForResult(result) {
  const tool = result?.plan?.tool;

  switch (tool) {
    case 'family':
      return AGENTS.family;

    case 'gps':
    case 'user_location':
      return AGENTS.gps;

    case 'services':
      return AGENTS.services;

    case 'sos':
      return AGENTS.sos;

    case 'scanner':
      return AGENTS.scanner;

    case 'weather':
    case 'time':
    case 'web':
    case 'none':
    default:
      return AGENTS.chat;
  }
}


/* =========================================================
   AGENT LIST
   ========================================================= */

function listAgents() {
  return Object.values(AGENTS);
}


/* =========================================================
   ENGINE STATUS
   ========================================================= */

function getStatus() {
  return {
    engine: 'SamarthAI Autonomous Engine',
    version: '1.0.0',
    status: 'active',
    mode: 'agentic',
    agents: listAgents().map(agent => ({
      id: agent.id,
      name: agent.name,
      status: agent.status
    })),
    timestamp: new Date().toISOString()
  };
}


/* =========================================================
   MAIN AUTONOMOUS RUNNER
   ========================================================= */

async function run(options = {}) {
  const {
    userId,
    conversationId,
    message,
    mode = 'conversation',
    metadata = {}
  } = options;

  const normalizedMessage = normalizeMessage(message);

  /* -------------------------
     VALIDATION
     ------------------------- */

  if (!isValidUuid(userId)) {
    throw new Error('A valid userId is required');
  }

  if (!isValidUuid(conversationId)) {
    throw new Error('A valid conversationId is required');
  }

  if (!normalizedMessage) {
    throw new Error('Message is required');
  }

  /* -------------------------
     RUN ID
     ------------------------- */

  const runId = createRunId();

  /* -------------------------
     EXECUTE EXISTING ENGINE
     ------------------------- */

  const result = await runConversation({
    userId,
    conversationId,
    message: normalizedMessage,
    mode,
    metadata
  });

  /* -------------------------
     RESOLVE AGENT
     ------------------------- */

  const agent = getAgentForResult(result);

  /* -------------------------
     AUTONOMOUS RESPONSE
     ------------------------- */

  return {
    success: true,

    autonomous: true,

    runId,

    agent: {
      id: agent.id,
      name: agent.name,
      status: agent.status
    },

    mode,

    result
  };
}


/* =========================================================
   EXPORTS
   ========================================================= */

module.exports = {
  run,
  listAgents,
  getAgentForResult,
  getStatus,
  agents: AGENTS
};
