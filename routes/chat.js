const express = require('express');
const jwt = require('jsonwebtoken');
const { createClient } = require('@supabase/supabase-js');

const router = express.Router();

// =====================================================
// SUPABASE
// =====================================================

// Existing chat client
const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_ANON_KEY
);

// Memory client - SERVER SIDE ONLY
const supabaseAdmin = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
);

const JWT_SECRET = process.env.JWT_SECRET || 'samarthai_secret';

// =====================================================
// AUTH HELPER
// =====================================================

function getUserFromToken(req) {
  try {
    const token = req.headers.authorization?.split(' ')[1];

    if (!token) return null;

    const decoded = jwt.verify(token, JWT_SECRET);

    if (!decoded?.id) return null;

    return decoded;
  } catch (error) {
    return null;
  }
}

// =====================================================
// GET USER FAMILY
// =====================================================

async function getUserFamily(userId) {
  try {
    const { data, error } = await supabaseAdmin
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
  } catch (error) {
    console.error('Family lookup exception:', error);
    return null;
  }
}

// =====================================================
// LOAD PERSONAL MEMORY
// =====================================================

async function getPersonalMemories(userId) {
  try {
    const { data, error } = await supabaseAdmin
      .from('personal_memory')
      .select('key, value')
      .eq('user_id', userId)
      .order('updated_at', { ascending: false })
      .limit(30);

    if (error) {
      console.error('Personal memory load error:', error);
      return [];
    }

    return data || [];
  } catch (error) {
    console.error('Personal memory exception:', error);
    return [];
  }
}

// =====================================================
// LOAD FAMILY MEMORY
// =====================================================

async function getFamilyMemories(userId) {
  try {
    const family = await getUserFamily(userId);

    if (!family?.family_id) {
      return [];
    }

    const { data, error } = await supabaseAdmin
      .from('family_memory')
      .select('key, value')
      .eq('family_id', family.family_id)
      .order('updated_at', { ascending: false })
      .limit(30);

    if (error) {
      console.error('Family memory load error:', error);
      return [];
    }

    return data || [];
  } catch (error) {
    console.error('Family memory exception:', error);
    return [];
  }
}

// =====================================================
// MEMORY TEXT FORMAT
// =====================================================

function formatMemories(personal, family) {
  let memoryText = '';

  if (personal.length > 0) {
    memoryText += '\n\nPRIVATE PERSONAL MEMORY OF THIS USER:\n';

    personal.forEach(item => {
      memoryText += `- ${item.key}: ${JSON.stringify(item.value)}\n`;
    });
  }

  if (family.length > 0) {
    memoryText += '\n\nSHARED FAMILY MEMORY:\n';

    family.forEach(item => {
      memoryText += `- ${item.key}: ${JSON.stringify(item.value)}\n`;
    });
  }

  return memoryText;
}

// =====================================================
// DETECT MEMORY REQUEST
// =====================================================

function isMemoryRequest(message) {
  if (!message) return false;

  const text = message.toLowerCase();

  const words = [
    'yaad rakh',
    'yaad rakho',
    'yaad rkh',
    'memory me',
    'memory mein',
    'memory me save',
    'save kr lo',
    'save kar lo',
    'save karo',
    'save krna',
    'remember this',
    'remember me',
    'remember',
    'memorize'
  ];

  return words.some(word => text.includes(word));
}

// =====================================================
// EXTRACT PERSONAL MEMORY
// =====================================================

function extractPersonalMemory(message) {
  if (!message) return null;

  const text = message.trim();

  // Name
  let match = text.match(
    /mera naam\s+(?:hai\s+)?(.+?)(?:\s+hai)?(?:\s+yaad|\s+save|\s+memory|$)/i
  );

  if (match?.[1]) {
    return {
      key: 'name',
      value: match[1].trim()
    };
  }

  // I am / main
  match = text.match(
    /(?:main|mai|i am)\s+(.+?)(?:\s+yaad|\s+save|\s+memory|$)/i
  );

  if (match?.[1] && match[1].length < 100) {
    return {
      key: 'personal_note',
      value: match[1].trim()
    };
  }

  // Generic save
  let cleaned = text
    .replace(/memory\s*(me|mein)\s*/gi, '')
    .replace(/save\s*(kr\s*lo|kar\s*lo|karo|krna|this)?/gi, '')
    .replace(/yaad\s*(rakh|rakho|rkh)/gi, '')
    .trim();

  if (!cleaned) return null;

  return {
    key: 'personal_note',
    value: cleaned
  };
}

// =====================================================
// SAVE PERSONAL MEMORY
// =====================================================

async function savePersonalMemory(userId, memory) {
  if (!userId || !memory) return null;

  try {
    const { data: existing, error: findError } = await supabaseAdmin
      .from('personal_memory')
      .select('id')
      .eq('user_id', userId)
      .eq('key', memory.key)
      .maybeSingle();

    if (findError) {
      console.error('Memory search error:', findError);
      return null;
    }

    if (existing) {
      const { data, error } = await supabaseAdmin
        .from('personal_memory')
        .update({
          value: memory.value,
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

    const { data, error } = await supabaseAdmin
      .from('personal_memory')
      .insert([{
        user_id: userId,
        key: memory.key,
        value: memory.value
      }])
      .select()
      .single();

    if (error) {
      console.error('Personal memory insert error:', error);
      return null;
    }

    return data;

  } catch (error) {
    console.error('Personal memory save exception:', error);
    return null;
  }
}

// =====================================================
// GROQ AI
// =====================================================

async function callGroqAI(message, memoryContext = '') {

  const systemPrompt = `
You are SamarthAI, a helpful personal AI assistant.

Answer naturally in the user's language.
If the user speaks Hindi/Hinglish, answer in Hindi/Hinglish.

Use the following memory only when relevant.

IMPORTANT PRIVACY RULE:
- Personal memory belongs only to the current user.
- Family memory is shared only within the current user's active family.
- Never reveal private personal memory of another person.
- Do not claim to remember something unless it is actually present in the supplied memory.

${memoryContext}
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
                  text: 'Describe this image in simple words in Hindi:'
                },

                {
                  inline_data: {
                    mime_type: 'image/png',
                    data: imageBase64.split(',')[1]
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

    console.log(
      '📥 Gemini response:',
      JSON.stringify(data, null, 2)
    );

    if (data.error) {

      console.error(
        '❌ Gemini API error:',
        data.error
      );

      return 'Gemini API error: ' + data.error.message;
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

    return 'Image analysis failed: ' + error.message;
  }
}

// =====================================================
// MAIN CHAT
// =====================================================

router.post('/', async (req, res) => {

  try {

    const user = getUserFromToken(req);

    const userId = user?.id || null;

    const { message, image } = req.body;

    if (!message && !image) {

      return res.status(400).json({
        error: 'Message or image required'
      });
    }

    // =================================================
    // MEMORY SAVE
    // =================================================

    let memorySaved = false;

    if (message && userId && isMemoryRequest(message)) {

      const memory = extractPersonalMemory(message);

      if (memory) {

        const saved =
          await savePersonalMemory(
            userId,
            memory
          );

        if (saved) {

          memorySaved = true;

          console.log(
            '🧠 Personal memory saved:',
            saved
          );
        }
      }
    }

    // =================================================
    // LOAD MEMORY FOR AI
    // =================================================

    let personalMemories = [];
    let familyMemories = [];

    if (userId) {

      personalMemories =
        await getPersonalMemories(userId);

      familyMemories =
        await getFamilyMemories(userId);
    }

    const memoryContext =
      formatMemories(
        personalMemories,
        familyMemories
      );

    // =================================================
    // AI RESPONSE
    // =================================================

    let response;

    if (image) {

      response =
        await callGeminiVision(image);

    } else {

      response =
        await callGroqAI(
          message,
          memoryContext
        );
    }

    // =================================================
    // SAVE CHAT
    // =================================================

    const { data: chat, error } =
      await supabase
        .from('chats')
        .insert([
          {
            user_id: userId || 'guest',
            message,
            response,
            model: image
              ? 'gemini-vision'
              : 'groq'
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

    // =================================================
    // RESPONSE
    // =================================================

    res.json({

      response,

      chat_id:
        chat?.id || null,

      memorySaved

    });

  } catch (error) {

    console.error(
      'Chat error:',
      error
    );

    res.status(500).json({
      error: 'Internal server error'
    });
  }
});

module.exports = router;
