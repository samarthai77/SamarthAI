const express = require('express');
const jwt = require('jsonwebtoken');
const { createClient } = require('@supabase/supabase-js');

const router = express.Router();

// Supabase Client
const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_ANON_KEY
);

const JWT_SECRET = process.env.JWT_SECRET || 'samarthai_secret';

// ============ AI CHAT ============
router.post('/', async (req, res) => {
  try {
    // 1. Verify token
    const token = req.headers.authorization?.split(' ')[1];
    if (!token) {
      return res.status(401).json({ error: 'No token provided' });
    }

    const decoded = jwt.verify(token, JWT_SECRET);
    const userId = decoded.id;

    // 2. Get message from body
    const { message } = req.body;
    if (!message) {
      return res.status(400).json({ error: 'Message is required' });
    }

    // 3. Call AI API (Groq or Gemini)
    const aiResponse = await callAI(message);

    // 4. Save chat to database
    const { data: chat, error } = await supabase
      .from('chats')
      .insert([
        {
          user_id: userId,
          message: message,
          response: aiResponse,
          model: 'groq'
        }
      ])
      .select()
      .single();

    if (error) {
      console.error('❌ Chat save error:', error);
    }

    // 5. Return response
    res.json({
      response: aiResponse,
      chat_id: chat?.id || null
    });

  } catch (error) {
    console.error('❌ Chat error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// ============ CALL AI FUNCTION ============
async function callAI(message) {
  // TODO: Replace with actual Groq/Gemini API call
  // For now, returning a mock response
  return `SamarthAI: I received your message: "${message}". I'm here to help!`;
}

// ============ GET CHAT HISTORY ============
router.get('/history', async (req, res) => {
  try {
    const token = req.headers.authorization?.split(' ')[1];
    if (!token) {
      return res.status(401).json({ error: 'No token provided' });
    }

    const decoded = jwt.verify(token, JWT_SECRET);
    const userId = decoded.id;

    const { data: chats, error } = await supabase
      .from('chats')
      .select('id, message, response, model, created_at')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(50);

    if (error) {
      return res.status(400).json({ error: error.message });
    }

    res.json(chats);
  } catch (error) {
    res.status(401).json({ error: 'Invalid token' });
  }
});

module.exports = router;
