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
  } catch {
    return null;
  }
}

// =====================================================
// GET USER FAMILY
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
// GET PERSONAL MEMORY
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
// GET FAMILY MEMORY
// =====================================================
async function getFamilyMemories(userId) {
  if (!userId) return [];

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
  if (!userId || !key) return null;

  const { data: existing, error: findError } = await supabase
    .from('personal_memory')
    .select('id')
    .eq('user_id', userId)
    .eq('key', key)
    .maybeSingle();

  if (findError) {
    console.error('Personal memory find error:', findError);
    return null;
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

    if (error) {
      console.error('Personal memory update error:', error);
      return null;
    }

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

  if (error) {
    console.error('Personal memory insert error:', error);
    return null;
  }

  return data;
}

// =====================================================
// SAVE FAMILY MEMORY
// =====================================================
async function saveFamilyMemory(userId, key, value) {
  if (!userId || !key) {
    return {
      success: false,
      reason: 'invalid'
    };
  }

  const family = await getUserFamily(userId);

  if (!family?.family_id) {
    return {
      success: false,
      reason: 'no_family'
    };
  }

  // Only admin can modify shared family memory
  if (family.role !== 'admin') {
    return {
      success: false,
      reason: 'not_admin'
    };
  }

  const { data: existing, error: findError } = await supabase
    .from('family_memory')
    .select('id')
    .eq('family_id', family.family_id)
    .eq('key', key)
    .maybeSingle();

  if (findError) {
    console.error('Family memory find error:', findError);
    return {
      success: false,
      reason: 'database'
    };
  }

  if (existing) {
    const { data, error } = await supabase
      .from('family_memory')
      .update({
        value,
        updated_at: new Date().toISOString()
      })
      .eq('id', existing.id)
      .select()
      .single();

    if (error) {
      console.error('Family memory update error:', error);
      return {
        success: false,
        reason: 'database'
      };
    }

    return {
      success: true,
      data
    };
  }

  const { data, error } = await supabase
    .from('family_memory')
    .insert([{
      family_id: family.family_id,
      key,
      value
    }])
    .select()
    .single();

  if (error) {
    console.error('Family memory insert error:', error);
    return {
      success: false,
      reason: 'database'
    };
  }

  return {
    success: true,
    data
  };
}

// =====================================================
// DETECT PERSONAL MEMORY REQUEST
// =====================================================
function detectPersonalMemory(message) {
  const text = String(message || '').trim();

  const saveWords =
    /(memory|memor(y|ie)|yaad|save|store|remember)/i;

  if (!saveWords.test(text)) {
    return null;
  }

  // Example:
  // mera name shekhar hai
  // mera naam shekhar hai
  // my name is shekhar
  let match = text.match(
    /(?:mera|meri)\s+(?:name|naam)\s+(?:hai|is)\s+(.+?)(?:\s+hai)?$/i
  );

  if (!match) {
    match = text.match(
      /my\s+name\s+is\s+(.+?)(?:\s+please)?$/i
    );
  }

  if (match) {
    return {
      key: 'name',
      value: match[1].trim()
    };
  }

  // Generic:
  // mera favourite color blue hai
  // meri city prayagraj hai
  match = text.match(
    /(?:mera|meri)\s+(.+?)\s+(?:hai|is)\s+(.+?)(?:\s+memory.*)?$/i
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
async function callGroqAI(message, personalMemories, familyMemories) {

  const personalText = personalMemories.length
    ? personalMemories
        .map(item => `${item.key}: ${JSON.stringify(item.value)}`)
        .join('\n')
    : 'No personal memory available.';

  const familyText = familyMemories.length
    ? familyMemories
        .map(item => `${item.key}: ${JSON.stringify(item.value)}`)
        .join('\n')
    : 'No family memory available.';

  const systemPrompt = `
You are SamarthAI, a helpful personal AI assistant.

Current date: ${new Date().toLocaleDateString('en-IN', {
    day: 'numeric',
    month: 'long',
    year: 'numeric'
  })}

IMPORTANT MEMORY RULES:

1. Personal Memory belongs only to the currently logged-in user.
2. Never claim that you know a personal detail unless it is present in the memory context or current conversation.
3. Family Memory is shared information for the user's family.
4. Do not reveal another family member's private/personal memory.
5. If the user asks their name and it exists in Personal Memory, answer it directly.
6. If information is not available, honestly say you don't have it.
7. Do not invent memories.
8. Reply naturally in the language used by the user. Hindi/Hinglish users should normally receive Hindi/Hinglish replies.

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
        'Authorization': `Bearer ${process.env.GROQ_API_KEY}`,
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
    console.error('Groq API error:', data.error);

    return 'AI service error: ' + (
      data.error.message || 'Unknown error'
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

    console.log(
      '📥 Gemini status:',
      response.status
    );

    if (data.error) {
      console.error(
        '❌ Gemini API error:',
        data.error
      );

      return 'Gemini API error: ' +
        data.error.message;
    }

    const description =
      data.candidates?.[0]?.content?.parts?.[0]?.text;

    if (!description) {
      return 'No description available. Please try again.';
    }

    return description;

  } catch (error) {

    console.error(
      '❌ Gemini vision error:',
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
    // IMAGE CHAT
    // =================================================
    if (image) {

      const response =
        await callGeminiVision(image);

      let chatId = null;

      // Save chat only for logged-in users
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
    // PERSONAL MEMORY
    // =================================================
    let memorySaved = false;
    let savedMemory = null;

    if (userId) {

      const detectedMemory =
        detectPersonalMemory(message);

      if (detectedMemory) {

        savedMemory =
          await savePersonalMemory(
            userId,
            detectedMemory.key,
            detectedMemory.value
          );

        if (savedMemory) {
          memorySaved = true;

          console.log(
            '🧠 Personal memory saved:',
            detectedMemory.key
          );
        }
      }
    }

    // =================================================
    // LOAD MEMORY FOR AI
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
      }

      chatId = chat?.id || null;
    }

    // =================================================
    // RESPONSE
    // =================================================
    res.json({
      response,
      chat_id: chatId,
      memory_saved: memorySaved,
      memory: savedMemory
        ? {
            type: 'personal',
            key: savedMemory.key
          }
        : null
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
