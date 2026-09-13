const express = require('express');
const jwt = require('jsonwebtoken');
const { createClient } = require('@supabase/supabase-js');

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
// PERSONAL MEMORY
// =====================================================
async function getPersonalMemory(userId) {
  if (!userId) return [];

  try {
    const { data, error } = await supabase
      .from('personal_memory')
      .select('key,value')
      .eq('user_id', userId)
      .order('updated_at', { ascending: false })
      .limit(50);

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

    if (memberError || !member?.family_id) return [];

    const { data, error } = await supabase
      .from('family_memory')
      .select('key,value')
      .eq('family_id', member.family_id)
      .order('updated_at', { ascending: false })
      .limit(50);

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
    .insert([{ user_id: userId, key, value }])
    .select()
    .single();

  if (error) throw error;
  return data;
}

// =====================================================
// MEMORY SAVE DETECTOR
// IMPORTANT: QUESTIONS MUST NOT SAVE MEMORY
// =====================================================
function detectMemorySave(message) {
  const text = String(message || '').trim();

  if (!text) return null;

  // Questions about memory/name must NEVER be treated as save requests.
  const isMemoryQuery =
    /(?:mera\s+(?:naam|name)|my\s+name|tumhe\s+mera\s+(?:naam|name)|mujhe\s+mera\s+(?:naam|name)).*(?:kya|kaun|batao|btao|yaad|pata|hai\s*na|h\s*na|\?)$/i.test(text);

  if (isMemoryQuery) {
    return null;
  }

  // Explicit name-memory request.
  const nameMatch = text.match(
    /(?:mera\s+(?:naam|name)|my\s+name\s+is)\s+([a-zA-Z\u0900-\u097F][a-zA-Z\u0900-\u097F\s]{0,40}?)(?=\s+(?:hai|h|is)\b)/i
  );

  if (
    nameMatch &&
    /(?:save|saved|memory|yaad\s+(?:rakho|rakhna)|remember|याद\s+(?:रखो|रखना)|सेव)/i.test(text)
  ) {
    const name = nameMatch[1].trim();

    // Prevent conversational words from being stored as a name.
    if (
      name &&
      !/^(to|yaad|hai|h|na|batao|btao|kya|pata)$/i.test(name)
    ) {
      return {
        key: 'name',
        value: name
      };
    }
  }

  // Explicit general memory request.
  const rememberMatch = text.match(
    /(?:remember|yaad\s+rakho|yaad\s+rakhna|याद\s+रखो|याद\s+रखना|memory\s+me\s+save|memory\s+mein\s+save|मेमोरी\s+में\s+सेव)\s*(?:that|ki|कि)?\s*(.+)$/i
  );

  if (rememberMatch) {
    const value = rememberMatch[1].trim();

    if (
      value &&
      !/^(mera\s+(?:naam|name)|my\s+name|mera\s+(?:naam|name)\s+to\s+yaad)$/i.test(value)
    ) {
      return {
        key: 'note',
        value
      };
    }
  }

  return null;
}
// =====================================================
// MEMORY FORMAT
// =====================================================
function formatValue(value) {
  if (value === null || value === undefined) return '';

  if (typeof value === 'object') {
    try {
      return JSON.stringify(value);
    } catch {
      return String(value);
    }
  }

  return String(value);
}

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
      .limit(10);

    if (error) {
      console.error('Chat history error:', error);
      return [];
    }

    return (data || []).reverse();
  } catch (e) {
    console.error('Chat history exception:', e);
    return [];
  }
}

// =====================================================
// SHOW CHAT RECORD
// =====================================================
function isHistoryRequest(message) {
  return /(?:pichhli|pichli|purani|previous|old).*(?:chat|baat|batcheet|conversation|record|history)|(?:chat|conversation|record|history).*(?:dikhao|dikhाओ|batao|bata|show)/i
    .test(message || '');
}

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
// GROQ
// =====================================================
async function callGroqAI(
  message,
  personalMemory,
  familyMemory,
  history
) {
  const systemPrompt = `
You are SamarthAI, a helpful personal AI assistant.

CONVERSATION RULES:

1. Be natural, friendly and conversational.
2. Usually answer in 1-3 short sentences.
3. Do not be too brief or robotic.
4. Match the user's language and tone.
5. For simple factual questions, answer directly and clearly.
6. For casual conversation, respond naturally and ask one relevant follow-up question when appropriate.
7. Do not give unnecessary explanations, lists or details unless the user asks.
8. Do not repeat information unnecessarily.
9. For simple yes/no questions, answer clearly and then add a short natural sentence when useful.
10. If the user asks their name, answer naturally using the saved name.
11. If the user asks "tumhe mera naam yaad hai?" or "mera naam yaad hai na?", answer from existing memory. NEVER save memory because of these questions.
12. Never change memory just because the user asks a question.
13. Memory is changed only by an explicit save/remember request handled by the server.
14. Never invent facts or pretend to know something you don't know.
15. Never be overconfident. If uncertain, say so honestly and briefly.
16. PRIVATE PERSONAL MEMORY belongs only to the current user.
17. SHARED FAMILY MEMORY can be used when relevant.
18. Never reveal another person's private memory.
19. Prefer Hindi/Hinglish when the user uses Hindi/Hinglish.
20. Keep the conversation useful, natural and comfortable for the user.
UNDERSTANDING USER:
- Understand Hindi, Hinglish, Roman Hindi and common typing mistakes.
- Understand short words from context, such as "suno", "sno", "sun", "acha", "haan", "nhi", "mtlb", "btao", "ky".
- Do not give a generic greeting when the user is continuing a conversation.
- If the meaning is clear from context, respond naturally.
- If the meaning is genuinely unclear, ask a short clarification.
- Use the immediately previous conversation to understand short messages.
CURRENT DATE:
${new Date().toLocaleDateString('en-IN', {
  weekday: 'long',
  year: 'numeric',
  month: 'long',
  day: 'numeric'
})}

${formatMemory(personalMemory, familyMemory)}
`;

  const messages = [
    {
      role: 'system',
      content: systemPrompt
    }
  ];

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
        max_tokens: 500
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
          contents: [{
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
          }]
        })
      }
    );

    const data = await response.json();

    if (!response.ok || data.error) {
      console.error('Gemini error:', JSON.stringify(data));
      return 'Image analysis failed.';
    }

    return (
      data.candidates?.[0]?.content?.parts?.[0]?.text ||
      'Image ko samajh nahi paaya.'
    );

  } catch (e) {
    console.error('Gemini vision error:', e);
    return 'Image analysis failed.';
  }
}

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
    const { message, image } = req.body;

    if (!message && !image) {
      return res.status(400).json({
        error: 'Message or image required'
      });
    }

    // -------------------------------------------------
    // IMAGE
    // -------------------------------------------------
    if (image) {
      const response = await callGeminiVision(image);

      let chatId = null;

      if (userId) {
        const { data: chat, error } = await supabase
          .from('chats')
          .insert([{
            user_id: userId,
            message: message || '[Image]',
            response,
            model: 'gemini-vision'
          }])
          .select()
          .single();

        if (error) console.error('Chat save error:', error);
        chatId = chat?.id || null;
      }

      return res.json({
        response,
        chat_id: chatId
      });
    }

    // -------------------------------------------------
    // LOAD HISTORY
    // -------------------------------------------------
    const history = await getRecentChatHistory(userId);

    // -------------------------------------------------
    // CHAT RECORD REQUEST
    // -------------------------------------------------
    if (userId && isHistoryRequest(message)) {
      const response = formatChatHistory(history);

      return res.json({
        response,
        chat_id: null,
        memory_used: {
          personal: 0,
          family: 0
        }
      });
    }

    // -------------------------------------------------
    // MEMORY SAVE
    // -------------------------------------------------
    const memoryRequest = detectMemorySave(message);

    if (memoryRequest && userId) {
      try {
        const saved = await savePersonalMemory(
          userId,
          memoryRequest.key,
          memoryRequest.value
        );

        const response =
          memoryRequest.key === 'name'
            ? `Bilkul, yaad rakh liya.`
            : `Bilkul, save kar liya.`;

        await supabase
          .from('chats')
          .insert([{
            user_id: userId,
            message,
            response,
            model: 'memory'
          }]);

        console.log(
          '✅ Personal memory saved:',
          memoryRequest.key,
          memoryRequest.value
        );

        return res.json({
          response,
          chat_id: null,
          memory_saved: true,
          memory: saved
        });

      } catch (e) {
        console.error('Memory save failed:', e);

        return res.status(500).json({
          error: 'Memory save failed'
        });
      }
    }

    // -------------------------------------------------
    // LOAD MEMORY
    // -------------------------------------------------
    const [
      personalMemory,
      familyMemory
    ] = await Promise.all([
      getPersonalMemory(userId),
      getFamilyMemory(userId)
    ]);

    console.log('🧠 Context:', {
      userId,
      personal: personalMemory.length,
      family: familyMemory.length,
      history: history.length
    });

    // -------------------------------------------------
    // AI
    // -------------------------------------------------
    const response = await callGroqAI(
      message,
      personalMemory,
      familyMemory,
      history
    );

    // -------------------------------------------------
    // SAVE CHAT
    // -------------------------------------------------
    let chatId = null;

    if (userId) {
      const { data: chat, error } = await supabase
        .from('chats')
        .insert([{
          user_id: userId,
          message,
          response,
          model: 'groq'
        }])
        .select()
        .single();

      if (error) {
        console.error('Chat save error:', error);
      } else {
        chatId = chat?.id || null;
      }
    }

    res.json({
      response,
      chat_id: chatId,
      memory_used: {
        personal: personalMemory.length,
        family: familyMemory.length
      }
    });

  } catch (error) {
    console.error('❌ Chat error:', error);

    res.status(500).json({
      error: error.message || 'Internal server error'
    });
  }
});

module.exports = router;
