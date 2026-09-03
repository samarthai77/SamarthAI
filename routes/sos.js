const express = require('express');
const jwt = require('jsonwebtoken');
const { createClient } = require('@supabase/supabase-js');

const router = express.Router();

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
);

const JWT_SECRET = process.env.JWT_SECRET || 'samarthai_secret';

// ============ CREATE SOS ============
router.post('/', async (req, res) => {
  try {
    const token = req.headers.authorization?.split(' ')[1];
    if (!token) {
      return res.status(401).json({ error: 'No token provided' });
    }

    const decoded = jwt.verify(token, JWT_SECRET);
    const { location, contacts } = req.body;

    if (!location) {
      return res.status(400).json({ error: 'Location is required' });
    }

    const { data: sos, error } = await supabase
      .from('sos_alerts')
      .insert([{
        user_id: decoded.id,
        location,
        contacts: contacts || [],
        status: 'active'
      }])
      .select()
      .single();

    if (error) {
      return res.status(400).json({ error: error.message });
    }

    res.status(201).json({
      message: 'SOS alert created successfully',
      sos
    });
  } catch (error) {
    console.error('❌ Create SOS error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router;
