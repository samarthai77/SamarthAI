const express = require('express');
const jwt = require('jsonwebtoken');
const { createClient } = require('@supabase/supabase-js');

const router = express.Router();

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_ANON_KEY
);

const JWT_SECRET = process.env.JWT_SECRET || 'samarthai_secret';

// ============ GROQ AI ============
async function callGroqAI(message) {
  const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${process.env.GROQ_API_KEY}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      model: 'mixtral-8x7b-32768',
      messages: [{ role: 'user', content: message }],
      temperature: 0.7,
      max_tokens: 500
    })
  });
  const data = await response.json();
  return data.choices?.[0]?.message?.content || 'Sorry, I could not process your request.';
}

// ============ GEMINI VISION ============
async function callGeminiVision(imageBase64) {
  try {
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${process.env.GEMINI_API_KEY}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{
            parts: [
              { text: 'Describe this image in simple words:' },
              { inline_data: { mime_type: 'image/png', data: imageBase64 } }
            ]
          }]
        })
      }
    );
    const data = await response.json();
    return data.candidates?.[0]?.content?.parts?.[0]?.text || 'No description available.';
  } catch (error) {
    console.error('Gemini vision error:', error);
    return 'Image analysis failed.';
  }
}

// ============ MAIN CHAT ============
router.post('/', async (req, res) => {
  try {
    const token = req.headers.authorization?.split(' ')[1];
    if (!token) return res.status(401).json({ error: 'No token provided' });

    const decoded = jwt.verify(token, JWT_SECRET);
    const { message, image } = req.body;

    if (!message && !image) {
      return res.status(400).json({ error: 'Message or image required' });
    }

    let response;
    if (image) {
      response = await callGeminiVision(image);
    } else {
      response = await callGroqAI(message);
    }

    const { data: chat, error } = await supabase
      .from('chats')
      .insert([{ user_id: decoded.id, message, response, model: image ? 'gemini-vision' : 'groq' }])
      .select()
      .single();

    if (error) console.error('Chat save error:', error);

    res.json({ response, chat_id: chat?.id || null });
  } catch (error) {
    console.error('Chat error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router;
