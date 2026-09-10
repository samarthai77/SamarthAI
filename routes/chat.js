const express = require('express');
const jwt = require('jsonwebtoken');
const { createClient } = require('@supabase/supabase-js');

const router = express.Router();

// =====================================================
// SUPABASE
// Server-side route -> SERVICE KEY
// =====================================================
const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
);

const JWT_SECRET = process.env.JWT_SECRET || 'samarthai_secret';

const GROQ_MODEL = 'openai/gpt-oss-20b';

// =====================================================
// AUTH
// =====================================================
function getUserId(req) {
  const token = req.headers.authorization?.split(' ')[1];

  if (!token) {
    return null;
  }

  try {
    const decoded = jwt.verify(token, JWT_SECRET);

    if (!decoded?.id) {
      return null;
    }

    return decoded.id;
  } catch (error) {
    console.error('JWT error:', error.message);
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
      .select('key, value')
      .eq('user_id', userId)
      .order('updated_at', { ascending: false })
      .limit(50);

    if (error) {
      console.error('Personal memory read error:', error);
      return [];
    }

    return data || [];
  } catch (error) {
    console.error('Personal memory exception:', error);
    return [];
  }
}

// =====================================================
// FAMILY MEMORY
// =====================================================

async function getFamilyMemory(userId) {
  if (!userId) return [];

  try {
    const { data: familyMember, error: familyError } = await supabase
      .from('family_members')
      .select('family_id, role, is_active')
      .eq('user_id', userId)
      .eq('is_active', true)
      .limit(1)
      .maybeSingle();

    if (familyError) {
      console.error('Family member lookup error:', familyError);
      return [];
    }

    if (!familyMember?.family_id) {
      return [];
    }

    const { data, error } = await supabase
      .from('family_memory')
      .select('key, value')
      .eq('family_id', familyMember.family_id)
      .order('updated_at', { ascending: false })
      .limit(50);

    if (error) {
      console.error('Family memory read error:', error);
      return [];
    }

    return data || [];

  } catch (error) {
    console.error('Family memory exception:', error);
    return [];
  }
}

// =====================================================
// SAVE PERSONAL MEMORY
// =====================================================

async function savePersonalMemory(userId, key, value) {
  if (!userId || !key) {
    return null;
  }

  try {
    const { data: existing, error: findError } = await supabase
      .from('personal_memory')
      .select('id')
      .eq('user_id', userId)
      .eq('key', key)
      .limit(1)
      .maybeSingle();

    if (findError) {
      throw findError;
    }

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
      .insert([{
        user_id: userId,
        key,
        value
      }])
      .select()
      .single();

    if (error) throw error;

    return data;

  } catch (error) {
    console.error('Save personal memory error:', error);
    throw error;
  }
}

// =====================================================
// DETECT MEMORY SAVE REQUEST
// =====================================================

function detectMemorySave(message) {
  if (!message) return null;

  const text = message.trim();

  // ---------------------------------------------------
  // NAME
  // Example:
  // mera naam shekhar hai ise memory me save kr lo
  // mera naam shekhar hai yaad rakho
  // my name is shekhar remember it
  // ---------------------------------------------------

  const nameMatch = text.match(
    /(?:mera\s+naam|my\s+name\s+is)\s+([a-zA-Z\u0900-\u097F][a-zA-Z\u0900-\u097F\s]{0,40}?)(?:\s+(?:hai|h|is)\b)/i
  );

  if (
    nameMatch &&
    /(?:save|saved|memory|yaad|rakh|remember|याद|रख|सेव)/i.test(text)
  ) {
    const name = nameMatch[1].trim();

    if (name) {
      return {
        key: 'name',
        value: name
      };
    }
  }

  // ---------------------------------------------------
  // GENERAL MEMORY
  // Examples:
  // remember that I like tea
  // yaad rakho mujhe chai pasand hai
  // ise memory me save karo
  // ---------------------------------------------------

  const rememberMatch = text.match(
    /(?:remember|yaad\s+rakho|याद\s+रखो|memory\s+me\s+save|memory\s+mein\s+save|मेमोरी\s+में\s+सेव)\s*(?:that|ki|कि)?\s*(.+)$/i
  );

  if (rememberMatch) {
    return {
      key: 'note',
      value: rememberMatch[1].trim()
    };
  }

  return null;
}

// =====================================================
// FORMAT MEMORY FOR AI
// =====================================================

function formatMemory(personalMemory, familyMemory) {

  let result = '';

  if (personalMemory.length > 0) {
    result += '\n\nPRIVATE PERSONAL MEMORY:\n';

    for (const item of personalMemory) {
      result += `- ${item.key}: ${formatValue(item.value)}\n`;
    }
  }

  if (familyMemory.length > 0) {
    result += '\nSHARED FAMILY MEMORY:\n';

    for (const item of familyMemory) {
      result += `- ${item.key}: ${formatValue(item.value)}\n`;
    }
  }

  return result;
}

// =====================================================
// FORMAT JSONB VALUE
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
// RECENT CHAT HISTORY
// =====================================================

async function getRecentChatHistory(userId) {
  if (!userId) return [];

  try {
    const { data, error } = await supabase
      .from('chats')
      .select('message, response, model')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(10);

    if (error) {
      console.error('Chat history error:', error);
      return [];
    }

    if (!data) return [];

    return data.reverse();

  } catch (error) {
    console.error('Chat history exception:', error);
    return [];
  }
}

// =====================================================
// GROQ AI
// =====================================================

async function callGroqAI(message, personalMemory, familyMemory, history) {

  const systemPrompt = `
You are SamarthAI, a helpful personal AI assistant.

IMPORTANT MEMORY RULES:

1. PRIVATE PERSONAL MEMORY belongs only to the currently logged-in user.
2. SHARED FAMILY MEMORY belongs to the user's family.
3. Never reveal private personal memory of another family member.
4. You may use the currently logged-in user's personal memory naturally.
5. You may use shared family memory when relevant.
6. Never claim that you remembered something unless it actually exists in the supplied memory.
7. If the user asks "mera naam kya hai?" and the personal memory contains "name", answer using that value.
8. If memory does not contain the requested information, honestly say that you don't have it.
9. Do not invent names, dates, family information, or personal facts.
10. Reply naturally in the language used by the user. Hindi/Hinglish is preferred when the user writes Hindi/Hinglish.
11. Keep normal answers concise and useful.

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

  // Add recent conversation
  for (const item of history) {

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
  }

  // Current user message
  messages.push({
    role: 'user',
    content: message
  });

  const response = await fetch(
    'https://api.groq.com/openai/v1/chat/completions',
    {
      method: 'POST',

      headers: {
        'Authorization': `Bearer ${process.env.GROQ_API_KEY}`,
        'Content-Type': 'application/json'
      },

      body: JSON.stringify({
        model: GROQ_MODEL,
        messages,
        temperature: 0.7,
        max_tokens: 700
      })
    }
  );

  const data = await response.json();

  console.log(
    'Groq status:',
    response.status
  );

  if (!response.ok) {
    console.error(
      'Groq API error:',
      JSON.stringify(data)
    );

    throw new Error(
      data?.error?.message || 'Groq API request failed'
    );
  }

  return (
    data.choices?.[0]?.message?.content ||
    'Sorry, I could not process your request.'
  );
}

// =====================================================
// GEMINI VISION
// =====================================================

async function callGeminiVision(imageBase64) {

  try {

    console.log('📸 Analyzing image...');

    console.log(
      '🔑 Gemini API Key exists?',
      !!process.env.GEMINI_API_KEY
    );

    if (!imageBase64 || imageBase64.length < 100) {

      console.error('❌ Invalid image data');

      return 'Invalid image. Please try again.';
    }

    const base64Data =
      imageBase64.includes(',')
        ? imageBase64.split(',')[1]
        : imageBase64;

    const mimeMatch =
      imageBase64.match(/^data:(.*?);base64,/);

    const mimeType =
      mimeMatch?.[1] || 'image/png';

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
                  text:
                    'Describe this image in simple Hindi. Be accurate and concise.'
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

    console.log(
      '📥 Gemini status:',
      response.status
    );

    if (data.error) {

      console.error(
        '❌ Gemini API error:',
        data.error
      );

      return (
        'Gemini API error: ' +
        data.error.message
      );
    }

    const description =
      data.candidates?.[0]?.content?.parts?.[0]?.text;

    if (!description) {

      console.error(
        '❌ No description found'
      );

      return 'No description available. Please try again.';
    }

    return description;

  } catch (error) {

    console.error(
      '❌ Gemini vision error:',
      error
    );

    return (
      'Image analysis failed: ' +
      error.message
    );
  }
}

// =====================================================
// MAIN CHAT
// =====================================================

router.post('/', async (req, res) => {

  try {

    const userId = getUserId(req);

    const {
      message,
      image
    } = req.body;

    if (!message && !image) {

      return res.status(400).json({
        error: 'Message or image required'
      });
    }

    // =================================================
    // IMAGE CHAT
    // =================================================

    if (image) {

      const response =
        await callGeminiVision(image);

      let chatId = null;

      if (userId) {

        const { data: chat, error } =
          await supabase
            .from('chats')
            .insert([{
              user_id: userId,
              message: message || '[Image]',
              response,
              model: 'gemini-vision'
            }])
            .select()
            .single();

        if (error) {
          console.error(
            'Chat save error:',
            error
          );
        }

        chatId = chat?.id || null;
      }

      return res.json({
        response,
        chat_id: chatId
      });
    }

    // =================================================
    // MEMORY SAVE DETECTION
    // =================================================

    const memoryRequest =
      detectMemorySave(message);

    if (memoryRequest && userId) {

      try {

        const saved =
          await savePersonalMemory(
            userId,
            memoryRequest.key,
            memoryRequest.value
          );

        console.log(
          '✅ Personal memory saved:',
          memoryRequest.key,
          memoryRequest.value
        );

        const confirmation =
          memoryRequest.key === 'name'
            ? `Bilkul. Maine yaad rakh liya hai ki aapka naam ${memoryRequest.value} hai.`
            : `Bilkul. Maine ye baat aapki personal memory mein save kar li hai.`;

        const { data: chat, error } =
          await supabase
            .from('chats')
            .insert([{
              user_id: userId,
              message,
              response: confirmation,
              model: 'memory'
            }])
            .select()
            .single();

        if (error) {
          console.error(
            'Memory chat save error:',
            error
          );
        }

        return res.json({
          response: confirmation,
          chat_id: chat?.id || null,
          memory_saved: true,
          memory: saved
        });

      } catch (memoryError) {

        console.error(
          '❌ Memory save failed:',
          memoryError
        );

        return res.status(500).json({
          error:
            'Memory save failed: ' +
            memoryError.message
        });
      }
    }

    // =================================================
    // LOAD MEMORY
    // =================================================

    const [
      personalMemory,
      familyMemory,
      history
    ] = await Promise.all([

      getPersonalMemory(userId),

      getFamilyMemory(userId),

      getRecentChatHistory(userId)

    ]);

    console.log(
      '🧠 Memory:',
      {
        userId,
        personal: personalMemory.length,
        family: familyMemory.length,
        history: history.length
      }
    );

    // =================================================
    // CALL GROQ WITH MEMORY
    // =================================================

    const response =
      await callGroqAI(
        message,
        personalMemory,
        familyMemory,
        history
      );

    // =================================================
    // SAVE CHAT
    // =================================================

    let chatId = null;

    if (userId) {

      const { data: chat, error } =
        await supabase
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

        console.error(
          'Chat save error:',
          error
        );

      } else {

        chatId = chat?.id || null;
      }
    }

    // =================================================
    // RESPONSE
    // =================================================

    res.json({
      response,
      chat_id: chatId,
      memory_used: {
        personal: personalMemory.length,
        family: familyMemory.length
      }
    });

  } catch (error) {

    console.error(
      '❌ Chat error:',
      error
    );

    res.status(500).json({
      error:
        error.message ||
        'Internal server error'
    });
  }
});

module.exports = router;
