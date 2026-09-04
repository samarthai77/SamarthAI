const express = require('express');
const jwt = require('jsonwebtoken');
const { createClient } = require('@supabase/supabase-js');

const router = express.Router();

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
);

const JWT_SECRET = process.env.JWT_SECRET || 'samarthai_secret';

// ============ ADD REVIEW ============
router.post('/', async (req, res) => {
  try {
    const token = req.headers.authorization?.split(' ')[1];
    if (!token) {
      return res.status(401).json({ error: 'No token provided' });
    }

    const decoded = jwt.verify(token, JWT_SECRET);
    const { service_id, rating, comment } = req.body;

    if (!service_id || !rating) {
      return res.status(400).json({ error: 'Service ID and rating are required' });
    }

    if (rating < 1 || rating > 5) {
      return res.status(400).json({ error: 'Rating must be between 1 and 5' });
    }

    const { data: review, error } = await supabase
      .from('reviews')
      .insert([{
        service_id,
        reviewer_id: decoded.id,
        rating,
        comment: comment || null
      }])
      .select()
      .single();

    if (error) {
      return res.status(400).json({ error: error.message });
    }

    res.status(201).json({
      message: 'Review added successfully',
      review
    });
  } catch (error) {
    console.error('❌ Add review error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});
// ============ GET REVIEWS FOR A SERVICE ============
router.get('/:service_id', async (req, res) => {
  try {
    const { service_id } = req.params;

    if (!service_id) {
      return res.status(400).json({ error: 'Service ID is required' });
    }

    const { data: reviews, error } = await supabase
      .from('reviews')
      .select('*, users(name, email)')
      .eq('service_id', service_id)
      .order('created_at', { ascending: false });

    if (error) {
      return res.status(400).json({ error: error.message });
    }

    res.json(reviews);
  } catch (error) {
    console.error('❌ Get reviews error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});
// ============ UPDATE REVIEW ============
router.put('/:id', async (req, res) => {
  try {
    const token = req.headers.authorization?.split(' ')[1];
    if (!token) {
      return res.status(401).json({ error: 'No token provided' });
    }

    const decoded = jwt.verify(token, JWT_SECRET);
    const { id } = req.params;
    const { rating, comment } = req.body;

    // Check if review exists and belongs to user
    const { data: existing, error: checkError } = await supabase
      .from('reviews')
      .select('*')
      .eq('id', id)
      .eq('reviewer_id', decoded.id)
      .single();

    if (checkError || !existing) {
      return res.status(404).json({ error: 'Review not found or unauthorized' });
    }

    // Update review
    const { data: review, error } = await supabase
      .from('reviews')
      .update({
        rating: rating || existing.rating,
        comment: comment || existing.comment
      })
      .eq('id', id)
      .select()
      .single();

    if (error) {
      return res.status(400).json({ error: error.message });
    }

    res.json({
      message: 'Review updated successfully',
      review
    });
  } catch (error) {
    console.error('❌ Update review error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});
module.exports = router;
