const express = require('express');
const jwt = require('jsonwebtoken');
const { createClient } = require('@supabase/supabase-js');

const router = express.Router();

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
);

const JWT_SECRET = process.env.JWT_SECRET || 'samarthai_secret';

// ============ UPDATE GPS LOCATION ============
router.put('/location', async (req, res) => {
  try {
    const token = req.headers.authorization?.split(' ')[1];
    if (!token) {
      return res.status(401).json({ error: 'No token provided' });
    }

    const decoded = jwt.verify(token, JWT_SECRET);
    const { latitude, longitude } = req.body;

    if (latitude === undefined || longitude === undefined) {
      return res.status(400).json({ error: 'Latitude and longitude are required' });
    }

    // Update user location
    const { data: user, error } = await supabase
      .from('users')
      .update({
        location: { lat: latitude, lng: longitude }
      })
      .eq('id', decoded.id)
      .select()
      .single();

    if (error) {
      return res.status(400).json({ error: error.message });
    }

    res.json({
      message: 'Location updated successfully',
      location: user.location
    });
  } catch (error) {
    console.error('❌ Update location error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router;
