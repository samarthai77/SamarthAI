const express = require('express');
const jwt = require('jsonwebtoken');
const { createClient } = require('@supabase/supabase-js');

const router = express.Router();

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
);

const JWT_SECRET = process.env.JWT_SECRET || 'samarthai_secret';

// =====================================================
// AUTH
// =====================================================
function getUserId(req) {
  const token = req.headers.authorization?.split(' ')[1];

  if (!token) return null;

  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    return decoded?.id || null;
  } catch (err) {
    return null;
  }
}

// =====================================================
// PERSONAL MEMORY - GET ALL
// =====================================================
async function getPersonalMemories(userId) {
  if (!userId) return [];

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
}

// =====================================================
// FAMILY INFO
// =====================================================
async function getUserFamily(userId) {
  if (!userId) return null;

  const { data, error } = await supabase
    .from('family_members')
    .select('family_id, role, is_active')
    .eq('user_id', userId)
    .eq('is_active', true)
    .limit(1)
    .maybeSingle();

  if (error) {
    console.error('Family lookup error:', error);
    return null;
  }

  return data || null;
}

// =====================================================
// FAMILY MEMORY - GET
// =====================================================
async function getFamilyMemories(userId) {
  const family = await getUserFamily(userId);

  if (!family?.family_id) return [];

  const { data, error } = await supabase
    .from('family_memory')
    .select('key, value')
    .eq('family_id', family.family_id)
    .order('updated_at', { ascending: false })
    .limit(50);

  if (error) {
    console.error('Family memory read error:', error);
    return [];
  }

  return data || [];
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
    .maybeSingle();

  if (findError) {
    console.error('Memory find error:', findError);
    throw findError;
  }

  if (existing) {
    const { data, error } = await supabase
      .from('personal_memory')
      .update({
        value: value,
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
      key: key,
      value: value
    }])
    .select()
    .single();

  if (error) throw error;

  return data;
}

// =====================================================
// DETECT MEMORY SAVE REQUEST
// =====================================================
function detectMemoryRequest(message) {
  const text = String(message || '').trim();

  const wantsMemory =
    /(memory|save|store|remember|yaad|याद|सहेज|save kr|save kar)/i
      .test(text);

  if (!wantsMemory) return null;

  // -----------------------------------------------
  // NAME
  // -----------------------------------------------

  let match = text.match(
    /mera\s+(?:naam|name)\s+(.+?)(?:\s+hai)?(?:\s+.*memory.*)?$/i
  );

  if (!match) {
    match = text.match(
      /my\s+name\s+is\s+(.+?)(?:\s+.*memory.*)?$/i
    );
  }

  if (match) {
    let name = match[1].trim();

    // Remove common trailing words
    name = name
      .replace(/\s+(ko|kr|kar|do|please)$/i, '')
      .trim();

    if (name) {
      return {
        key: 'name',
        value: name
      };
    }
  }

  // -----------------------------------------------
  // GENERIC PERSONAL INFORMATION
  // -----------------------------------------------

  match = text.match(
    /(?:mera|meri)\s+(.+?)\s+(?:hai|is)\s+(.+?)(?:\s+.*memory.*)?$/i
  );

  if (match) {
    return {
      key: match[1].trim().toLowerCase(),
      value: match[2].trim()
    };
  }

  return null;
}

// =====================================================
// GROQ AI
// =====================================================
async function callGroqAI(
  message,
  personalMemories,
  familyMemories
) {

  const personalText = personalMemories.length
    ? personalMemories
        .map(item =>
          `${item.key}: ${JSON.stringify(item.value)}`
        )
        .join('\n')
    : 'No personal memory available.';

  const familyText = familyMemories.length
    ? familyMemories
        .map(item =>
          `${item.key}: ${JSON.stringify(item.value)}`
        )
        .join('\n')
    : 'No family memory available.';

  const systemPrompt = `
You are SamarthAI, a helpful personal AI assistant.

IMPORTANT:

Personal Memory belongs ONLY to the currently logged-in user.

Family Memory is shared family information.

Never invent memory.

If the user's requested information exists in Personal Memory,
use it directly.

If the user asks their name and the Personal Memory contains
key "name", answer with that name.

Reply in Hindi/Hinglish when the user uses Hindi/Hinglish.

PERSONAL MEMORY:
${personalText}

FAMILY MEMORY:
${familyText}
`;

  const response = await fetch(
    'https://api.groq.com/openai/v1/chat/completions',
    {
      method: 'POST',
      headers: {
        'Authorization':
          `Bearer ${process.env.GROQ_API_KEY}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: 'openai/gpt-oss-20b',
        messages: [
          {
            role: 'system',
            content: systemPrompt
          },
          {
            role: 'user',
            content: message
          }
        ],
        temperature: 0.7,
        max_tokens: 500
      })
    }
  );

  const data = await response.json();

  console.log(
    'Groq response:',
    JSON.stringify(data)
  );

  if (data.error) {
    console.error('Groq error:', data.error);

    return 'AI service error: ' +
      (data.error.message || 'Unknown error');
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

    if (!imageBase64 || imageBase64.length < 100) {
      return 'Invalid image. Please try again.';
    }

    const base64Data = imageBase64.includes(',')
      ? imageBase64.split(',')[1]
      : imageBase64;

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
                text: 'Describe this image in simple Hindi.'
              },
              {
                inline_data: {
                  mime_type: 'image/png',
                  data: base64Data
                }
              }
            ]
          }]
        })
      }
    );

    const data = await response.json();

    if (data.error) {
      console.error(
        'Gemini error:',
        data.error
      );

      return 'Gemini API error: ' +
        data.error.message;
    }

    return (
      data.candidates?.[0]?.content?.parts?.[0]?.text ||
      'No description available.'
    );

  } catch (error) {

    console.error(
      'Gemini vision error:',
      error
    );

    return 'Image analysis failed: ' +
      error.message;
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
    // IMAGE
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
              response: response,
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
    // MEMORY SAVE REQUEST
    // =================================================
    const memoryRequest =
      detectMemoryRequest(message);

    if (memoryRequest && userId) {

      console.log(
        '🧠 Memory request detected:',
        memoryRequest
      );

      try {

        const saved =
          await savePersonalMemory(
            userId,
            memoryRequest.key,
            memoryRequest.value
          );

        console.log(
          '✅ Personal memory saved:',
          saved
        );

        const confirmation =
          memoryRequest.key === 'name'
            ? `Bilkul 😊 Maine aapka naam "${memoryRequest.value}" apni Personal Memory mein save kar liya hai.`
            : `Bilkul 😊 Maine "${memoryRequest.key}" ki information apni Personal Memory mein save kar li hai.`;

        // Save chat
        const { data: chat, error } =
          await supabase
            .from('chats')
            .insert([{
              user_id: userId,
              message: message,
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
          memory: {
            type: 'personal',
            key: memoryRequest.key,
            value: memoryRequest.value
          }
        });

      } catch (memoryError) {

        console.error(
          '❌ Memory save failed:',
          memoryError
        );

        return res.status(500).json({
          error: 'Memory save failed'
        });
      }
    }

    // =================================================
    // LOAD MEMORY
    // =================================================
    const personalMemories =
      userId
        ? await getPersonalMemories(userId)
        : [];

    const familyMemories =
      userId
        ? await getFamilyMemories(userId)
        : [];

    // =================================================
    // AI RESPONSE
    // =================================================
    const response =
      await callGroqAI(
        message,
        personalMemories,
        familyMemories
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
            message: message,
            response: response,
            model: 'groq'
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

    // =================================================
    // RESPONSE
    // =================================================
    res.json({
      response,
      chat_id: chatId,
      memory_saved: false
    });

  } catch (error) {

    console.error(
      '❌ Chat error:',
      error
    );

    res.status(500).json({
      error: 'Internal server error'
    });
  }
});

module.exports = router;
