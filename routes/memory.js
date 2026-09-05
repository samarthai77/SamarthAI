const express = require('express');
const jwt = require('jsonwebtoken');
const { createClient } = require('@supabase/supabase-js');

const router = express.Router();

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
);

const JWT_SECRET = process.env.JWT_SECRET || 'samarthai_secret';

// Save memory
router.post('/', async (req, res) => {
  try {
    const token = req.headers.authorization?.split(' ')[1];
    if (!token) return res.status(401).json({ error: 'No token' });
    const decoded = jwt.verify(token, JWT_SECRET);
    const { key, value } = req.body;
    if (!key) return res.status(400).json({ error: 'Key required' });

    const { data, error } = await supabase
      .from('memory')
      .upsert({ user_id: decoded.id, key, value })
      .select()
      .single();

    if (error) return res.status(400).json({ error: error.message });
    res.json({ message: 'Memory saved', data });
  } catch (error) {
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get memory
router.get('/:key', async (req, res) => {
  try {
    const token = req.headers.authorization?.split(' ')[1];
    if (!token) return res.status(401).json({ error: 'No token' });
    const decoded = jwt.verify(token, JWT_SECRET);
    const { key } = req.params;

    const { data, error } = await supabase
      .from('memory')
      .select('value')
      .eq('user_id', decoded.id)
      .eq('key', key)
      .single();

    if (error) return res.status(404).json({ error: 'Not found' });
    res.json({ key, value: data.value });
  } catch (error) {
    res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router;
