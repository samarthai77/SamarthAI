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

// ============ SEND MESSAGE ============
router.post('/', async (req, res) => {
  try {
    const token = req.headers.authorization?.split(' ')[1];
    if (!token) {
      return res.status(401).json({ error: 'No token provided' });
    }

    const decoded = jwt.verify(token, JWT_SECRET);
    const { receiver_id, message } = req.body;

    if (!receiver_id || !message) {
      return res.status(400).json({ error: 'Receiver ID and message are required' });
    }
// Receiver must be an active member of the sender's family
const { data: senderMember, error: senderError } = await supabase
  .from('family_members')
  .select('family_id')
  .eq('user_id', decoded.id)
  .eq('is_active', true)
  .maybeSingle();

if (senderError) throw senderError;

if (!senderMember) {
  return res.status(403).json({
    error: 'You are not an active family member'
  });
}

if (receiver_id === decoded.id) {
  return res.status(400).json({
    error: 'You cannot send a message to yourself'
  });
}

const { data: receiverMember, error: receiverError } = await supabase
  .from('family_members')
  .select('id, user_id, family_id')
  .eq('user_id', receiver_id)
  .eq('is_active', true)
  .eq('family_id', senderMember.family_id)
  .maybeSingle();

if (receiverError) throw receiverError;

if (!receiverMember) {
  return res.status(403).json({
    error: 'Receiver is not an active member of your family'
  });
}
    const { data, error } = await supabase
      .from('messages')
      .insert([{
        sender_id: decoded.id,
        receiver_id,
        message,
        is_read: false
      }])
      .select()
      .single();

    if (error) {
      return res.status(400).json({ error: error.message });
    }

    res.status(201).json({
      message: 'Message sent successfully',
      data
    });
  } catch (error) {
    console.error('❌ Send message error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});
// ============ GET MESSAGES WITH USER ============
router.get('/:userId', async (req, res) => {
  try {
    const token = req.headers.authorization?.split(' ')[1];
    if (!token) {
      return res.status(401).json({ error: 'No token provided' });
    }

    const decoded = jwt.verify(token, JWT_SECRET);
    const { userId } = req.params;

    if (!userId) {
      return res.status(400).json({ error: 'User ID is required' });
    }

    const { data: messages, error } = await supabase
      .from('messages')
      .select('*')
      .or(`sender_id.eq.${decoded.id},receiver_id.eq.${decoded.id}`)
      .or(`sender_id.eq.${userId},receiver_id.eq.${userId}`)
      .order('created_at', { ascending: true });

    if (error) {
      return res.status(400).json({ error: error.message });
    }

    res.json(messages);
  } catch (error) {
    console.error('❌ Get messages error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});
// ============ DELETE MESSAGE ============
router.delete('/:id', async (req, res) => {
  try {
    const token = req.headers.authorization?.split(' ')[1];
    if (!token) {
      return res.status(401).json({ error: 'No token provided' });
    }

    const decoded = jwt.verify(token, JWT_SECRET);
    const { id } = req.params;

    // Check if message exists and belongs to user (sender)
    const { data: existing, error: checkError } = await supabase
      .from('messages')
      .select('*')
      .eq('id', id)
      .eq('sender_id', decoded.id)
      .single();

    if (checkError || !existing) {
      return res.status(404).json({ error: 'Message not found or unauthorized' });
    }

    const { error } = await supabase
      .from('messages')
      .delete()
      .eq('id', id);

    if (error) {
      return res.status(400).json({ error: error.message });
    }

    res.json({ message: 'Message deleted successfully' });
  } catch (error) {
    console.error('❌ Delete message error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});
module.exports = router;
