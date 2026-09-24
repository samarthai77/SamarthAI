const express = require('express');
const jwt = require('jsonwebtoken');
const { createClient } = require('@supabase/supabase-js');
const {
  routeAI,
  planToolCall
} = require('../services/aiGateway');
const {
  getTool
} = require('../services/tools');

const router = express.Router();

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
);

const JWT_SECRET = process.env.JWT_SECRET;

if (!JWT_SECRET) {
  throw new Error('JWT_SECRET environment variable is required');
}

const GROQ_MODEL = 'openai/gpt-oss-20b';

// =====================================================
// AUTH
// =====================================================
function getUserId(req) {
  const token = req.headers.authorization?.split(' ')[1];

  if (!token) return null;

  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    return decoded?.id || null;
  } catch (e) {
    console.error('JWT error:', e.message);
    return null;
  }
}

// =====================================================
// TIMEOUT
// =====================================================
function withTimeout(promise, ms, fallbackValue, label = '') {
  let timer;

  return Promise.race([
    promise,
    new Promise(resolve => {
      timer = setTimeout(() => {
        console.warn(`⚠️ ${label} timed out after ${ms}ms`);
        resolve(fallbackValue);
      }, ms);
    })
  ])
    .finally(() => {
      if (timer) clearTimeout(timer);
    })
    .catch(error => {
      console.error(`❌ ${label} failed:`, error.message);
      return fallbackValue;
    });
}

// =====================================================
// PERSONAL MEMORY
// =====================================================
async function getPersonalMemory(userId) {
  if (!userId) return [];

  try {
    const { data, error } = await supabase
      .from('personal_memory')
      .select('id,key,value,updated_at')
      .eq('user_id', userId)
      .order('updated_at', { ascending: false })
      .limit(100);

    if (error) {
      console.error('Personal memory read:', error);
      return [];
    }

    return data || [];
  } catch (e) {
    console.error('Personal memory exception:', e);
    return [];
  }
}

// =====================================================
// FAMILY MEMORY
// =====================================================
async function getFamilyMemory(userId) {
  if (!userId) return [];

  try {
    const { data: member, error: memberError } = await supabase
      .from('family_members')
      .select('family_id,is_active')
      .eq('user_id', userId)
      .eq('is_active', true)
      .limit(1)
      .maybeSingle();

    if (memberError || !member?.family_id) {
      return [];
    }

    const { data, error } = await supabase
      .from('family_memory')
      .select('key,value,updated_at')
      .eq('family_id', member.family_id)
      .order('updated_at', { ascending: false })
      .limit(100);

    if (error) {
      console.error('Family memory read:', error);
      return [];
    }

    return data || [];
  } catch (e) {
    console.error('Family memory exception:', e);
    return [];
  }
}

// =====================================================
// SAVE PERSONAL MEMORY
// =====================================================
async function savePersonalMemory(userId, key, value) {
  const { data: existing, error: findError } = await supabase
    .from('personal_memory')
    .select('id')
    .eq('user_id', userId)
    .eq('key', key)
    .limit(1)
    .maybeSingle();

  if (findError) throw findError;

  if (existing) {
    const { data, error } = await supabase
      .from('personal_memory')
      .update({
        value,
        updated_at: new Date().toISOString()
      })
      .eq('id', existing.id)
      .select()
      .single();

    if (error) throw error;

    return data;
  }

  const { data, error } = await supabase
    .from('personal_memory')
    .insert([
      {
        user_id: userId,
        key,
        value
      }
    ])
    .select()
    .single();

  if (error) throw error;

  return data;
}

// =====================================================
// AUTOMATIC MEMORY DETECTOR
// =====================================================
function detectMemorySave(message) {
  const text = String(message || '').trim();

  if (!text) return null;

  // -----------------------------------------------
  // QUESTIONS ARE NOT MEMORY
  // -----------------------------------------------
  if (
    /(?:kya|kaun|kab|kyu|kyon|why|what|who|when|how|batao|btao|pata hai|\?)$/i
      .test(text)
  ) {
    return null;
  }

  // -----------------------------------------------
  // NAME
  // -----------------------------------------------
  let match = text.match(
    /(?:mera\s+naam|my\s+name)\s+(?:hai|is)?\s*([a-zA-Z\u0900-\u097F][a-zA-Z\u0900-\u097F\s]{1,40}?)(?:\s+(?:hai|h|is))?$/i
  );

  if (match) {
    const name = match[1].trim();

    if (
      name &&
      !/^(kya|kaun|yaad|batao|btao|pata)$/i.test(name)
    ) {
      return {
        key: 'name',
        value: name
      };
    }
  }

  // -----------------------------------------------
  // EXPLICIT REMEMBER
  // -----------------------------------------------
  match = text.match(
    /(?:remember|yaad\s+rakho|yaad\s+rakhna|याद\s+रखो|याद\s+रखना|memory\s+me\s+save|memory\s+mein\s+save|मेमोरी\s+में\s+सेव)\s*(?:that|ki|कि)?\s*(.+)$/i
  );

  if (match) {
    const value = match[1].trim();

    if (value) {
      return {
        key: `note_${Date.now()}`,
        value
      };
    }
  }

  // -----------------------------------------------
  // LIKES / DISLIKES
  // -----------------------------------------------
  match = text.match(
    /(?:mujhe|i)\s+(.+?)\s+(?:pasand|achha\s+lagta|accha\s+lagta|like\s+hai)$/i
  );

  if (match) {
    return {
      key: `preference_${Date.now()}`,
      value: `User likes ${match[1].trim()}`
    };
  }

  match = text.match(
    /(?:mujhe|i)\s+(.+?)\s+(?:pasand\s+nahi|achha\s+nahi\s+lagta|accha\s+nahi\s+lagta|don't\s+like)$/i
  );

  if (match) {
    return {
      key: `preference_${Date.now()}`,
      value: `User does not like ${match[1].trim()}`
    };
  }

  // -----------------------------------------------
  // USER FACTS
  // -----------------------------------------------
  match = text.match(
    /^(?:main|mai|mera|meri|i am|i'm|i)\s+(.{3,120})$/i
  );

  if (match) {
    const value = match[1].trim();

    if (
      !/^(kya|kaise|kyu|kyon|kab|kahan|batao|btao|hu|hoon)$/i.test(value)
    ) {
      return {
        key: `fact_${Date.now()}`,
        value: `User: ${value}`
      };
    }
  }

  // -----------------------------------------------
  // FAMILY / PERSONAL FACTS
  // -----------------------------------------------
  match = text.match(
    /^(?:meri|mere|my)\s+(.{3,100})$/i
  );

  if (match) {
    const value = match[1].trim();

    if (
      !/(?:kya|kaise|kyu|kyon|kab|kahan|batao|btao)$/i.test(value)
    ) {
      return {
        key: `personal_${Date.now()}`,
        value: value
      };
    }
  }

  return null;
}

// =====================================================
// FORMAT VALUE
// =====================================================
function formatValue(value) {
  if (value === null || value === undefined) {
    return '';
  }

  if (typeof value === 'object') {
    try {
      return JSON.stringify(value);
    } catch {
      return String(value);
    }
  }

  return String(value);
}

// =====================================================
// FORMAT MEMORY
// =====================================================
function formatMemory(personal, family) {
  let text = '';

  if (personal.length) {
    text += '\nPRIVATE PERSONAL MEMORY:\n';

    personal.forEach(item => {
      text += `- ${item.key}: ${formatValue(item.value)}\n`;
    });
  }

  if (family.length) {
    text += '\nSHARED FAMILY MEMORY:\n';

    family.forEach(item => {
      text += `- ${item.key}: ${formatValue(item.value)}\n`;
    });
  }

  return text;
}
// =====================================================
// AI TOOL EXECUTOR
// =====================================================

async function executeChatTool({
  plan,
  userId,
  location = null
}) {

  const toolName =
    String(plan?.tool || '')
      .trim()
      .toLowerCase();

  const action =
    String(plan?.action || '')
      .trim()
      .toLowerCase();

  const args =
    plan?.arguments &&
    typeof plan.arguments === 'object'
      ? plan.arguments
      : {};


  // ---------------------------------------------------
  // NO TOOL
  // ---------------------------------------------------

  if (
    !toolName ||
    toolName === 'none' ||
    action === 'none'
  ) {

    return null;

  }


  // ---------------------------------------------------
  // GET TOOL
  // ---------------------------------------------------

  const tool =
    getTool(toolName);


  if (!tool) {

    return {
      error:
        `Tool "${toolName}" is not available`
    };

  }


  // ---------------------------------------------------
  // WEATHER
  // ---------------------------------------------------

  if (toolName === 'weather') {

    if (
      !location ||
      location.latitude === undefined ||
      location.longitude === undefined
    ) {

      return {
        needs_location: true
      };

    }


    return await tool.execute({

      latitude:
        location.latitude,

      longitude:
        location.longitude,

      type:
        args.weather_type ||
        'current'

    });

  }


  // ---------------------------------------------------
  // FAMILY
  // ---------------------------------------------------

  if (
    toolName === 'family' &&
    action === 'read'
  ) {

    return await tool.execute(
      userId
    );

  }


  // ---------------------------------------------------
  // SERVICES
  // ---------------------------------------------------

  if (
    toolName === 'services' &&
    action === 'search'
  ) {

    return await tool.execute({

      query:
        args.query || '',

      category:
        args.category || '',

      location:
        args.location_name ||
        location?.name ||
        '',

      limit:
        10

    });

  }


  // ---------------------------------------------------
  // GPS
  // ---------------------------------------------------

  if (
    toolName === 'gps' &&
    action === 'locate'
  ) {

    return {

      needs_member:
        true,

      member_name:
        args.member_name || ''

    };

  }


  // ---------------------------------------------------
  // UNSUPPORTED ACTION
  // ---------------------------------------------------

  return {

    error:
      `Action "${action}" is not implemented yet`

  };

}


// =====================================================
// CHAT HISTORY
// =====================================================
async function getRecentChatHistory(userId) {
  if (!userId) return [];

  try {
    const { data, error } = await supabase
      .from('chats')
      .select('message,response,model,created_at')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(30);

    if (error) {
      console.error('Chat history error:', error);
      return [];
    }
return (data || [])
  .filter(item => {
    const response = String(item.response || '').trim();

    return (
      response &&
      response !== 'Sorry, I could not process your request.' &&
      !response.toLowerCase().includes('could not process your request')
    );
  })
  .reverse();
    
  } catch (e) {
    console.error('Chat history exception:', e);
    return [];
  }
}
// =====================================================
// SAVE CHAT MESSAGE
// =====================================================
async function saveChatMessage(
  userId,
  message,
  response,
  model
) {
  try {

    const {
      data,
      error
    } = await supabase
      .from('chats')
      .insert([
        {
          user_id: userId,
          message,
          response,
          model
        }
      ])
      .select()
      .single();

    if (error) {
      console.error(
        'Chat save error:',
        error
      );

      return null;
    }

    return data?.id || null;

  } catch (error) {

    console.error(
      'Chat save exception:',
      error
    );

    return null;
  }
}


// =====================================================
// COMMON CHAT RESPONSE
// =====================================================
async function sendChatResponse({
  res,
  userId,
  message,
  response,
  model,
  intent,
  provider = 'samarthai-tool',
  web_used = false,
  personalMemory = [],
  familyMemory = [],
  history = [],
  memory_saved = false
}) {

  const chatId =
    await saveChatMessage(
      userId,
      message,
      response,
      model
    );

  return res.json({

    response,

    chat_id:
      chatId,

    provider,

    model,

    intent,

    web_used:
      Boolean(web_used),

    memory_used: {

      personal:
        personalMemory.length,

      family:
        familyMemory.length,

      history:
        history.length

    },

    memory_saved:
      Boolean(memory_saved)

  });
}


// =====================================================
// HISTORY REQUEST
// =====================================================
function isHistoryRequest(message) {
  const text = String(message || '').trim().toLowerCase();

  const hasHistoryWord =
    /pichhli|pichli|pichhle|purani|previous|old|last|pehle|history|record|conversation|chat|baat.?cheet|baatcheet/i
      .test(text);

  const hasRequestWord =
    /batao|btao|dikhao|dikhाओ|show|hui|huyi|thi|the|kya|kya.?kya/i
      .test(text);

  return hasHistoryWord && hasRequestWord;
}


// =====================================================
// FORMAT HISTORY
// =====================================================
function formatChatHistory(history) {
  if (!history.length) {
    return 'Abhi koi purani chat available nahi hai.';
  }

  let result = 'Aapki recent baatcheet:\n\n';

  history.forEach(item => {
    if (item.message) {
      result += `Aap: ${item.message}\n`;
    }

    if (item.response) {
      result += `SamarthAI: ${item.response}\n`;
    }

    result += '\n';
  });

  return result.trim();
}

// =====================================================
// GROQ AI
// =====================================================
async function callGroqAI(
  message,
  personalMemory,
  familyMemory,
  history
) {
  const systemPrompt = `
You are SamarthAI, a highly capable personal AI assistant.

IMPORTANT MEMORY BEHAVIOUR:

- Remember useful facts about the current user.
- Use personal memory naturally.
- Use previous conversation context naturally.
- Do not pretend to remember something that is not present.
- Do not expose private memory belonging to another user.
- Do not repeat the entire memory list to the user.
- When the user refers to something from earlier, use conversation history.
- If an earlier conversation contains the answer, use it.
- Understand Hindi, Roman Hindi, Hinglish and typing mistakes.
- Maintain conversational continuity.
- Short messages such as "haan", "hmm", "acha", "nahi", "mtlb", "btao" must be understood from context.
- Do not restart the conversation unnecessarily.

CONVERSATION:

1. Be natural and human-like.
2. Match the user's language.
3. Hindi/Hinglish is preferred when the user uses Hindi/Hinglish.
4. Usually answer in 1-3 sentences.
5. Give more detail when the question needs it.
6. Do not give unnecessary explanations.
7. Do not invent memories.
8. Do not claim to remember something unless it exists in memory or history.
9. Use the current conversation history before answering.
10. If the user asks "tumhe yaad hai?", check memory/history first.
11. If information is unavailable, say so honestly.

MEMORY:

PRIVATE PERSONAL MEMORY:
${formatMemory(personalMemory, [])}

SHARED FAMILY MEMORY:
${formatMemory([], familyMemory)}

CURRENT DATE:
${new Date().toLocaleDateString('en-IN', {
  weekday: 'long',
  year: 'numeric',
  month: 'long',
  day: 'numeric'
})}
`;

  const messages = [
    {
      role: 'system',
      content: systemPrompt
    }
  ];

  // -------------------------------------------------
  // PREVIOUS CONVERSATION
  // -------------------------------------------------
  history.forEach(item => {
    if (item.message) {
      messages.push({
        role: 'user',
        content: item.message
      });
    }

    if (item.response) {
      messages.push({
        role: 'assistant',
        content: item.response
      });
    }
  });

  // -------------------------------------------------
  // CURRENT MESSAGE
  // -------------------------------------------------
  messages.push({
    role: 'user',
    content: message
  });

  const response = await fetch(
    'https://api.groq.com/openai/v1/chat/completions',
    {
      method: 'POST',

      headers: {
        Authorization: `Bearer ${process.env.GROQ_API_KEY}`,
        'Content-Type': 'application/json'
      },

      body: JSON.stringify({
        model: GROQ_MODEL,
        messages,
        temperature: 0.5,
        max_tokens: 700
      })
    }
  );

  const data = await response.json();

  console.log('Groq status:', response.status);

  if (!response.ok) {
    console.error('Groq error:', JSON.stringify(data));

    throw new Error(
      data?.error?.message || 'Groq API request failed'
    );
  }

  return (
    data.choices?.[0]?.message?.content ||
    'Mujhe iska jawab nahi mil paaya.'
  );
}

// =====================================================
// GEMINI VISION
// =====================================================
async function callGeminiVision(imageBase64) {
  try {
    if (!imageBase64 || imageBase64.length < 100) {
      return 'Invalid image. Please try again.';
    }

    const base64Data = imageBase64.includes(',')
      ? imageBase64.split(',')[1]
      : imageBase64;

    const mimeMatch = imageBase64.match(
      /^data:(.*?);base64,/
    );

    const mimeType = mimeMatch?.[1] || 'image/png';

    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${process.env.GEMINI_API_KEY}`,
      {
        method: 'POST',

        headers: {
          'Content-Type': 'application/json'
        },

        body: JSON.stringify({
          contents: [
            {
              parts: [
                {
                  text: 'Describe this image in simple Hindi. Be accurate and concise.'
                },
                {
                  inline_data: {
                    mime_type: mimeType,
                    data: base64Data
                  }
                }
              ]
            }
          ]
        })
      }
    );

    const data = await response.json();

    if (!response.ok || data.error) {
      console.error(
        'Gemini error:',
        JSON.stringify(data)
      );

      return 'Image analysis failed.';
    }

    return (
      data.candidates?.[0]?.content?.parts?.[0]?.text ||
      'Image ko samajh nahi paaya.'
    );

  } catch (e) {
    console.error(
      'Gemini vision error:',
      e
    );

    return 'Image analysis failed.';
  }
}
// =====================================================
// LOAD CHAT HISTORY
// =====================================================
router.get('/history', async (req, res) => {

  const userId =
    getUserId(req);

  if (!userId) {
    return res.status(401).json({
      error: 'Authentication required'
    });
  }

  try {

    const {
      data,
      error
    } = await supabase
      .from('chats')
      .select(
        'id,message,response,model,created_at'
      )
      .eq(
        'user_id',
        userId
      )
      .order(
        'created_at',
        {
          ascending: true
        }
      )
      .limit(100);

    if (error) {

      console.error(
        'Chat history load error:',
        error
      );

      return res.status(500).json({
        error:
          'Chat history load failed'
      });

    }

    return res.json({

      success: true,

      chats:
        data || []

    });

  } catch (error) {

    console.error(
      'Chat history exception:',
      error
    );

    return res.status(500).json({
      error:
        'Internal server error'
    });

  }

});



// =====================================================
// MAIN CHAT
// =====================================================
router.post('/', async (req, res) => {
  try {
    const userId = getUserId(req);

    if (!userId) {
      return res.status(401).json({
        error: 'Authentication required'
      });
    }

const {
  message,
  image,
  location
} = req.body;

    if (!message && !image) {
      return res.status(400).json({
        error: 'Message or image required'
      });
    }

    // =================================================
    // IMAGE
    // =================================================
    if (image) {
      const response = await callGeminiVision(image);

      const { data: chat, error } = await supabase
        .from('chats')
        .insert([
          {
            user_id: userId,
            message: message || '[Image]',
            response,
            model: 'gemini-vision'
          }
        ])
        .select()
        .single();

      if (error) {
        console.error(
          'Chat save error:',
          error
        );
      }

      return res.json({
        response,
        chat_id: chat?.id || null
      });
    }

    // =================================================
    // LOAD FULL CONTEXT
    // =================================================
    const [
      history,
      personalMemory,
      familyMemory
    ] = await Promise.all([
      withTimeout(
        getRecentChatHistory(userId),
        5000,
        [],
        'Chat history'
      ),

      withTimeout(
        getPersonalMemory(userId),
        5000,
        [],
        'Personal memory'
      ),

      withTimeout(
        getFamilyMemory(userId),
        5000,
        [],
        'Family memory'
      )
    ]);

    console.log('🧠 Context:', {
      userId,
      personal: personalMemory.length,
      family: familyMemory.length,
      history: history.length
    });

    // =================================================
    // SHOW OLD CHAT
    // =================================================
    if (isHistoryRequest(message)) {
      const response =
        formatChatHistory(history);

      return res.json({
        response,
        chat_id: null,
        memory_used: {
          personal: personalMemory.length,
          family: familyMemory.length,
          history: history.length
        }
      });
    }

    // =================================================
    // EXPLICIT / AUTOMATIC MEMORY
    // =================================================
    const memoryRequest =
      detectMemorySave(message);

    // IMPORTANT:
    // Save memory AND continue to AI.
    // Previous version returned immediately,
    // which made memory conversations feel robotic.
    if (memoryRequest && userId) {
      try {
        const saved =
          await savePersonalMemory(
            userId,
            memoryRequest.key,
            memoryRequest.value
          );

        // Add newly saved memory to current context.
        personalMemory.unshift({
          key: memoryRequest.key,
          value: memoryRequest.value
        });

        console.log(
          '✅ Memory saved:',
          memoryRequest.key,
          memoryRequest.value
        );

        // Continue normally to AI.
        // No early return.
        void saved;

      } catch (e) {
        console.error(
          'Memory save failed:',
          e
        );
      }
    }

  // =================================================
// AI / TOOL RESPONSE
// =================================================

const memoryText =
  formatMemory(
    personalMemory,
    familyMemory
  );



// -------------------------------------------------
// AI TOOL PLANNER
// -------------------------------------------------

const toolPlan =
  await planToolCall({
    message,
    history
  });

console.log(
  '🤖 Tool Plan:',
  JSON.stringify(toolPlan)
);


// -------------------------------------------------
// EXECUTE TOOL
// -------------------------------------------------

let toolResult = null;
if (
  toolPlan &&
  toolPlan.tool &&
  toolPlan.tool !== 'none'
) {

  try {

    toolResult =
      await executeChatTool({

        plan:
          toolPlan,

        userId,

        location

      });

  } catch (toolError) {

    console.error(
      'Tool execution error:',
      toolError
    );

    toolResult = {

      error:
        toolError.message

    };

  }

}
// -------------------------------------------------
// WEATHER NEEDS LOCATION
// -------------------------------------------------
if (
  toolPlan?.tool === 'weather' &&
  toolResult?.needs_location
) {

  const response =
    'Mausam batane ke liye mujhe us jagah ka location chahiye. Agar aap chahein to location permission de sakte hain. 📍';

  return await sendChatResponse({

    res,

    userId,

    message,

    response,

    model:
      'weather',

    intent:
      'weather',

    personalMemory,

    familyMemory,

    history,

    memory_saved:
      Boolean(memoryRequest)

  });

}

// -------------------------------------------------
// FAMILY RESULT
// -------------------------------------------------

if (
  toolPlan?.tool === 'family' &&
  toolResult
){

  const members =
    Array.isArray(toolResult.members)
      ? toolResult.members
      : [];


  let response = '';


  if (!members.length) {

    response =
      'Aapki family mein abhi koi active member nahi mila.';

  } else {

    response =
      'Aapki family ke active members:\n\n' +

      members
        .map((member, index) => {

          const relation =
            member.relation
              ? ` (${member.relation})`
              : '';

          return (
            `${index + 1}. ` +
            `${member.name || 'Member'}` +
            `${relation}`
          );

        })
        .join('\n');
  }

return await sendChatResponse({

    res,

    userId,

    message,

    response,

    model:
      'family',

    intent:
      'family',

    personalMemory,

    familyMemory,

    history,

    memory_saved:
      Boolean(memoryRequest)

  });
}
// -------------------------------------------------
// SERVICES RESULT
// -------------------------------------------------

if (
  toolPlan?.tool === 'services' &&
  Array.isArray(toolResult)
){

  let response = '';


  if (!toolResult.length) {

    response =
      'Abhi is category ka koi active service provider nahi mila.';

  } else {

    response =
      'Mujhe ye service providers mile:\n\n' +

      toolResult
        .map((service, index) => {

          const price =
            service.price !== null &&
            service.price !== undefined
              ? `₹${service.price}`
              : 'Price available nahi hai';


          const locationText =
            service.location
              ? `📍 ${service.location}`
              : '';


          return (

            `${index + 1}. ` +
            `${service.title || service.category || 'Service'}\n` +

            `👤 ${service.provider_name}\n` +

            `💰 ${price}\n` +

            `${locationText}`

          );

        })
        .join('\n\n');
  }


return await sendChatResponse({

    res,

    userId,

    message,

    response,

    model:
      'services',

    intent:
      'services',

    personalMemory,

    familyMemory,

    history,

    memory_saved:
      Boolean(memoryRequest)

  });
}


// -------------------------------------------------
// GPS
// -------------------------------------------------

if (
  toolPlan?.tool === 'gps' &&
  toolResult?.needs_member
) {

  const response =
    'Kis family member ki location dekhni hai? Jaise: bhai, mummy ya papa. 📍';

return await sendChatResponse({

    res,

    userId,

    message,

    response,

    model:
      'gps',

    intent:
      'gps',

    personalMemory,

    familyMemory,

    history,

    memory_saved:
      Boolean(memoryRequest)

  });
}


// -------------------------------------------------
// NORMAL AI
// -------------------------------------------------

const aiResult =
  await routeAI({

    message,

    history,

    memoryText

  });


  
const response =
  aiResult.text;


// =================================================
// SAVE NORMAL AI RESPONSE
// =================================================

return await sendChatResponse({

  res,

  userId,

  message,

  response,

  provider:
    aiResult.provider,

  model:
    aiResult.model,

  intent:
    aiResult.intent,

  web_used:
    Boolean(aiResult.web_used),

  personalMemory,

  familyMemory,

  history,

  memory_saved:
    Boolean(memoryRequest)

});
    

  } catch (error) {
    console.error(
      '❌ Chat error:',
      error
    );

    return res.status(500).json({
      error:
        error.message ||
        'Internal server error'
    });
  }
});

module.exports = router;
