const express = require('express');
const jwt = require('jsonwebtoken');
const { createClient } = require('@supabase/supabase-js');

const router = express.Router();

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
);

const JWT_SECRET = process.env.JWT_SECRET || 'samarthai_secret';

// ============ ADD SERVICE ============
router.post('/', async (req, res) => {
  try {
    const token = req.headers.authorization?.split(' ')[1];
    if (!token) {
      return res.status(401).json({ error: 'No token provided' });
    }

    const decoded = jwt.verify(token, JWT_SECRET);
    const { title, description, price, category, location } = req.body;

    if (!title || !description || !price || !category) {
      return res.status(400).json({ error: 'Title, description, price and category are required' });
    }

    const { data: service, error } = await supabase
      .from('services')
      .insert([{
        user_id: decoded.id,
        title,
        description,
        price,
        category,
        location: location || null,
        is_active: true
      }])
      .select()
      .single();

    if (error) {
      return res.status(400).json({ error: error.message });
    }

    res.status(201).json({
      message: 'Service added successfully',
      service
    });
  } catch (error) {
    console.error('❌ Add service error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});
// ============ GET ALL SERVICES ============
router.get('/', async (req, res) => {
  try {
    const { data: services, error } = await supabase
      .from('services')
      .select('*, users(name, email, phone)')
      .eq('is_active', true)
      .order('created_at', { ascending: false });

    if (error) {
      return res.status(400).json({ error: error.message });
    }

    res.json(services);
  } catch (error) {
    console.error('❌ Get services error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});
module.exports = router;
