const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { createClient } = require('@supabase/supabase-js');

const router = express.Router();

// Supabase Client
const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_ANON_KEY
);

const JWT_SECRET = process.env.JWT_SECRET || 'samarthai_secret';

// ============ REGISTER ============
router.post('/register', async (req, res) => {
  try {
    const { name, email, password, phone } = req.body;

    // 1. Check if user exists
    const { data: existingUser } = await supabase
      .from('users')
      .select('id')
      .eq('email', email)
      .single();

    if (existingUser) {
      return res.status(400).json({ error: 'User already exists' });
    }

    // 2. Hash password
    const hashedPassword = await bcrypt.hash(password, 10);

    // 3. Insert user
    const { data: user, error } = await supabase
      .from('users')
      .insert([{ name, email, password: hashedPassword, phone }])
      .select()
      .single();

    if (error) {
      return res.status(400).json({ error: error.message });
    }

    // 4. Generate JWT
    const token = jwt.sign({ id: user.id, email: user.email }, JWT_SECRET);

    res.status(201).json({
      message: 'User registered successfully',
      token,
      user: { id: user.id, name: user.name, email: user.email }
    });

  } catch (error) {
    res.status(500).json({ error: 'Internal server error' });
  }
});

// ============ LOGIN ============
router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;

    // 1. Find user
    const { data: user, error } = await supabase
      .from('users')
      .select('*')
      .eq('email', email)
      .single();

    if (error || !user) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    // 2. Check password
    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    // 3. Generate JWT
    const token = jwt.sign({ id: user.id, email: user.email }, JWT_SECRET);

    res.json({
      message: 'Login successful',
      token,
      user: { id: user.id, name: user.name, email: user.email }
    });

  } catch (error) {
    res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router;
