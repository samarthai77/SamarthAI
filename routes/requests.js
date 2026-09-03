const express = require('express');
const jwt = require('jsonwebtoken');
const { createClient } = require('@supabase/supabase-js');

const router = express.Router();

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
);

const JWT_SECRET = process.env.JWT_SECRET || 'samarthai_secret';

// ============ CREATE REQUEST ============
router.post('/', async (req, res) => {
  try {
    const token = req.headers.authorization?.split(' ')[1];
    if (!token) {
      return res.status(401).json({ error: 'No token provided' });
    }

    const decoded = jwt.verify(token, JWT_SECRET);
    const { category, description, budget, location } = req.body;

    if (!category || !description) {
      return res.status(400).json({ error: 'Category and description are required' });
    }

    const { data: request, error } = await supabase
      .from('service_requests')
      .insert([{
        user_id: decoded.id,
        category,
        description,
        budget: budget || null,
        location: location || null,
        status: 'pending'
      }])
      .select()
      .single();

    if (error) {
      return res.status(400).json({ error: error.message });
    }

    res.status(201).json({
      message: 'Service request created successfully',
      request
    });
  } catch (error) {
    console.error('❌ Create request error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router;
