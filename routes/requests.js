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
// ============ GET ALL REQUESTS ============
router.get('/', async (req, res) => {
  try {
    const token = req.headers.authorization?.split(' ')[1];
    if (!token) {
      return res.status(401).json({ error: 'No token provided' });
    }

    const decoded = jwt.verify(token, JWT_SECRET);

    const { data: requests, error } = await supabase
      .from('service_requests')
      .select('*')
      .eq('user_id', decoded.id)
      .order('created_at', { ascending: false });

    if (error) {
      return res.status(400).json({ error: error.message });
    }

    res.json(requests);
  } catch (error) {
    console.error('❌ Get requests error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});
// ============ UPDATE REQUEST ============
router.put('/:id', async (req, res) => {
  try {
    const token = req.headers.authorization?.split(' ')[1];
    if (!token) {
      return res.status(401).json({ error: 'No token provided' });
    }

    const decoded = jwt.verify(token, JWT_SECRET);
    const { id } = req.params;
    const { category, description, budget, location, status } = req.body;

    // Check if request exists and belongs to user
    const { data: existing, error: checkError } = await supabase
      .from('service_requests')
      .select('*')
      .eq('id', id)
      .eq('user_id', decoded.id)
      .single();

    if (checkError || !existing) {
      return res.status(404).json({ error: 'Request not found or unauthorized' });
    }

    // Update request
    const { data: request, error } = await supabase
      .from('service_requests')
      .update({
        category: category || existing.category,
        description: description || existing.description,
        budget: budget || existing.budget,
        location: location || existing.location,
        status: status || existing.status
      })
      .eq('id', id)
      .select()
      .single();

    if (error) {
      return res.status(400).json({ error: error.message });
    }

    res.json({
      message: 'Request updated successfully',
      request
    });
  } catch (error) {
    console.error('❌ Update request error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});
// ============ DELETE REQUEST ============
router.delete('/:id', async (req, res) => {
  try {
    const token = req.headers.authorization?.split(' ')[1];
    if (!token) {
      return res.status(401).json({ error: 'No token provided' });
    }

    const decoded = jwt.verify(token, JWT_SECRET);
    const { id } = req.params;

    // Check if request exists and belongs to user
    const { data: existing, error: checkError } = await supabase
      .from('service_requests')
      .select('*')
      .eq('id', id)
      .eq('user_id', decoded.id)
      .single();

    if (checkError || !existing) {
      return res.status(404).json({ error: 'Request not found or unauthorized' });
    }

    const { error } = await supabase
      .from('service_requests')
      .delete()
      .eq('id', id);

    if (error) {
      return res.status(400).json({ error: error.message });
    }

    res.json({ message: 'Request deleted successfully' });
  } catch (error) {
    console.error('❌ Delete request error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});
module.exports = router;
