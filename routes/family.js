const express = require('express');
const jwt = require('jsonwebtoken');
const { createClient } = require('@supabase/supabase-js');

const router = express.Router();

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
);

const JWT_SECRET = process.env.JWT_SECRET || 'samarthai_secret';

// ============ ADD FAMILY MEMBER ============
router.post('/', async (req, res) => {
  try {
    const token = req.headers.authorization?.split(' ')[1];
    if (!token) {
      return res.status(401).json({ error: 'No token provided' });
    }

    const decoded = jwt.verify(token, JWT_SECRET);
    const { name, phone, location } = req.body;

    if (!name || !phone) {
      return res.status(400).json({ error: 'Name and phone are required' });
    }

    // Generate a family_id (same for all members)
    const familyId = decoded.id; // Using user_id as family_id

    const { data: member, error } = await supabase
      .from('family_members')
      .insert([{
        user_id: decoded.id,
        family_id: familyId,
        name,
        phone,
        location: location || null
      }])
      .select()
      .single();

    if (error) {
      return res.status(400).json({ error: error.message });
    }

    res.status(201).json({
      message: 'Family member added successfully',
      member
    });
  } catch (error) {
    console.error('❌ Add family member error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});
// ============ GET FAMILY MEMBERS ============
router.get('/', async (req, res) => {
  try {
    const token = req.headers.authorization?.split(' ')[1];
    if (!token) {
      return res.status(401).json({ error: 'No token provided' });
    }

    const decoded = jwt.verify(token, JWT_SECRET);

    const { data: members, error } = await supabase
      .from('family_members')
      .select('*')
      .eq('user_id', decoded.id)
      .order('created_at', { ascending: false });

    if (error) {
      return res.status(400).json({ error: error.message });
    }

    res.json(members);
  } catch (error) {
    console.error('❌ Get family members error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});
// ============ UPDATE FAMILY MEMBER ============
router.put('/:id', async (req, res) => {
  try {
    const token = req.headers.authorization?.split(' ')[1];
    if (!token) {
      return res.status(401).json({ error: 'No token provided' });
    }

    const decoded = jwt.verify(token, JWT_SECRET);
    const { id } = req.params;
    const { name, phone, location } = req.body;

    // Check if member exists and belongs to user
    const { data: existing, error: checkError } = await supabase
      .from('family_members')
      .select('*')
      .eq('id', id)
      .eq('user_id', decoded.id)
      .single();

    if (checkError || !existing) {
      return res.status(404).json({ error: 'Member not found or unauthorized' });
    }

    // Update member
    const { data: member, error } = await supabase
      .from('family_members')
      .update({
        name: name || existing.name,
        phone: phone || existing.phone,
        location: location || existing.location,
        last_updated: new Date().toISOString()
      })
      .eq('id', id)
      .select()
      .single();

    if (error) {
      return res.status(400).json({ error: error.message });
    }

    res.json({
      message: 'Family member updated successfully',
      member
    });
  } catch (error) {
    console.error('❌ Update family member error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});
module.exports = router;
