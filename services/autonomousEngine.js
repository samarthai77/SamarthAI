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

const {
  createClient
} = require('@supabase/supabase-js');

const conversationEngine =
  require('./conversationEngine');

const runConversation =
  conversationEngine.runConversation ||
  conversationEngine;

const supabase =
  createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_SERVICE_KEY
  );
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

async function saveAutonomousChat({
  userId,
  conversationId,
  message,
  response,
  agentId
}) {
  try {

    const {
      data,
      error
    } = await supabase
      .from('chats')
      .insert([
        {
          user_id:
            userId,

          conversation_id:
            conversationId,

          message,
          response,

          model:
            `samarthai-autonomous-${agentId || 'chat'}`
        }
      ])
      .select('id')
      .single();

    if(error){
      console.error(
        '❌ Autonomous chat save error:',
        error
      );

      return null;
    }

    const {
      data: conversation
    } = await supabase
      .from('conversations')
      .select('title')
      .eq('id', conversationId)
      .eq('user_id', userId)
      .maybeSingle();

    const currentTitle =
      String(
        conversation?.title || ''
      ).trim();

    const cleanTitle =
      String(message || '')
        .trim()
        .replace(/\s+/g, ' ')
        .slice(0, 70);

    const updateData = {
      updated_at:
        new Date().toISOString()
    };

    if(
      cleanTitle &&
      (
        !currentTitle ||
        currentTitle === 'New Chat'
      )
    ){
      updateData.title =
        cleanTitle;
    }

    await supabase
      .from('conversations')
      .update(updateData)
      .eq('id', conversationId)
      .eq('user_id', userId);

    return data?.id || null;

  }catch(error){

    console.error(
      '❌ Autonomous persistence error:',
      error
    );

    return null;
  }
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

const result =
    await runConversation({
      userId,
      conversationId,
      message:
        normalizedMessage,
      location:
        metadata &&
        typeof metadata === 'object'
          ? metadata.location || null
          : null
    });

  const agent =
    getAgentForResult(result);

  const savedChatId =
    await saveAutonomousChat({
      userId,
      conversationId,
      message:
        normalizedMessage,
      response:
        result?.response || '',
      agentId:
        agent.id
    });

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

  persistence: {
    saved:
      Boolean(savedChatId),

    chatId:
      savedChatId
  },

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
