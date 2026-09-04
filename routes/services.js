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
// ============ UPDATE SERVICE ============
router.put('/:id', async (req, res) => {
  try {
    const token = req.headers.authorization?.split(' ')[1];
    if (!token) {
      return res.status(401).json({ error: 'No token provided' });
    }

    const decoded = jwt.verify(token, JWT_SECRET);
    const { id } = req.params;
    const { title, description, price, category, location, is_active } = req.body;

    // Check if service exists and belongs to user
    const { data: existing, error: checkError } = await supabase
      .from('services')
      .select('*')
      .eq('id', id)
      .eq('user_id', decoded.id)
      .single();

    if (checkError || !existing) {
      return res.status(404).json({ error: 'Service not found or unauthorized' });
    }

    // Update service
    const { data: service, error } = await supabase
      .from('services')
      .update({
        title: title || existing.title,
        description: description || existing.description,
        price: price || existing.price,
        category: category || existing.category,
        location: location || existing.location,
        is_active: is_active !== undefined ? is_active : existing.is_active
      })
      .eq('id', id)
      .select()
      .single();

    if (error) {
      return res.status(400).json({ error: error.message });
    }

    res.json({
      message: 'Service updated successfully',
      service
    });
  } catch (error) {
    console.error('❌ Update service error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});
// ============ DELETE SERVICE ============
router.delete('/:id', async (req, res) => {
  try {
    const token = req.headers.authorization?.split(' ')[1];
    if (!token) {
      return res.status(401).json({ error: 'No token provided' });
    }

    const decoded = jwt.verify(token, JWT_SECRET);
    const { id } = req.params;

    // Check if service exists and belongs to user
    const { data: existing, error: checkError } = await supabase
      .from('services')
      .select('*')
      .eq('id', id)
      .eq('user_id', decoded.id)
      .single();

    if (checkError || !existing) {
      return res.status(404).json({ error: 'Service not found or unauthorized' });
    }

    const { error } = await supabase
      .from('services')
      .delete()
      .eq('id', id);

    if (error) {
      return res.status(400).json({ error: error.message });
    }

    res.json({ message: 'Service deleted successfully' });
  } catch (error) {
    console.error('❌ Delete service error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});
module.exports = router;
