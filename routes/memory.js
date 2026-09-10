const express = require('express');
const jwt = require('jsonwebtoken');
const { createClient } = require('@supabase/supabase-js');

const router = express.Router();

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
);

const JWT_SECRET = process.env.JWT_SECRET || 'samarthai_secret';

// =====================================================
// AUTH HELPER
// =====================================================
function getUserId(req) {
  const token = req.headers.authorization?.split(' ')[1];

  if (!token) {
    throw new Error('NO_TOKEN');
  }

  const decoded = jwt.verify(token, JWT_SECRET);

  if (!decoded?.id) {
    throw new Error('INVALID_TOKEN');
  }

  return decoded.id;
}

// =====================================================
// GET USER FAMILY
// =====================================================
async function getUserFamily(userId) {
  const { data, error } = await supabase
    .from('family_members')
    .select('family_id, role, is_active')
    .eq('user_id', userId)
    .eq('is_active', true)
    .limit(1)
    .maybeSingle();

  if (error) throw error;

  return data || null;
}

// =====================================================
// PERSONAL MEMORY - SAVE
// POST /memory/personal
// =====================================================
router.post('/personal', async (req, res) => {
  try {
    const userId = getUserId(req);
    const { key, value } = req.body;

    if (!key) {
      return res.status(400).json({
        error: 'Key required'
      });
    }

    // Check existing memory
    const { data: existing, error: findError } = await supabase
      .from('personal_memory')
      .select('id')
      .eq('user_id', userId)
      .eq('key', key)
      .maybeSingle();

    if (findError) throw findError;

    let data;
    let error;

    if (existing) {
      const result = await supabase
        .from('personal_memory')
        .update({
          value,
          updated_at: new Date().toISOString()
        })
        .eq('id', existing.id)
        .select()
        .single();

      data = result.data;
      error = result.error;
    } else {
      const result = await supabase
        .from('personal_memory')
        .insert([{
          user_id: userId,
          key,
          value
        }])
        .select()
        .single();

      data = result.data;
      error = result.error;
    }

    if (error) {
      return res.status(400).json({
        error: error.message
      });
    }

    res.json({
      message: 'Personal memory saved',
      data
    });

  } catch (error) {
    console.error('Personal memory save error:', error);

    if (
      error.message === 'NO_TOKEN' ||
      error.message === 'INVALID_TOKEN' ||
      error.name === 'JsonWebTokenError'
    ) {
      return res.status(401).json({
        error: 'Unauthorized'
      });
    }

    res.status(500).json({
      error: 'Internal server error'
    });
  }
});

// =====================================================
// PERSONAL MEMORY - GET
// GET /memory/personal/:key
// =====================================================
router.get('/personal/:key', async (req, res) => {
  try {
    const userId = getUserId(req);
    const { key } = req.params;

    const { data, error } = await supabase
      .from('personal_memory')
      .select('value')
      .eq('user_id', userId)
      .eq('key', key)
      .maybeSingle();

    if (error) throw error;

    if (!data) {
      return res.status(404).json({
        error: 'Personal memory not found'
      });
    }

    res.json({
      key,
      value: data.value
    });

  } catch (error) {
    console.error('Personal memory fetch error:', error);

    if (
      error.message === 'NO_TOKEN' ||
      error.message === 'INVALID_TOKEN' ||
      error.name === 'JsonWebTokenError'
    ) {
      return res.status(401).json({
        error: 'Unauthorized'
      });
    }

    res.status(500).json({
      error: 'Internal server error'
    });
  }
});

// =====================================================
// FAMILY MEMORY - SAVE
// POST /memory/family
// =====================================================
router.post('/family', async (req, res) => {
  try {
    const userId = getUserId(req);
    const { key, value } = req.body;

    if (!key) {
      return res.status(400).json({
        error: 'Key required'
      });
    }

    const family = await getUserFamily(userId);

    if (!family) {
      return res.status(403).json({
        error: 'User is not an active family member'
      });
    }

    // Only family admin can create/update shared family memory
    if (family.role !== 'admin') {
      return res.status(403).json({
        error: 'Only family admin can modify family memory'
      });
    }

    // Check existing memory
    const { data: existing, error: findError } = await supabase
      .from('family_memory')
      .select('id')
      .eq('family_id', family.family_id)
      .eq('key', key)
      .maybeSingle();

    if (findError) throw findError;

    let data;
    let error;

    if (existing) {
      const result = await supabase
        .from('family_memory')
        .update({
          value,
          updated_at: new Date().toISOString()
        })
        .eq('id', existing.id)
        .select()
        .single();

      data = result.data;
      error = result.error;
    } else {
      const result = await supabase
        .from('family_memory')
        .insert([{
          family_id: family.family_id,
          key,
          value
        }])
        .select()
        .single();

      data = result.data;
      error = result.error;
    }

    if (error) {
      return res.status(400).json({
        error: error.message
      });
    }

    res.json({
      message: 'Family memory saved',
      data
    });

  } catch (error) {
    console.error('Family memory save error:', error);

    if (
      error.message === 'NO_TOKEN' ||
      error.message === 'INVALID_TOKEN' ||
      error.name === 'JsonWebTokenError'
    ) {
      return res.status(401).json({
        error: 'Unauthorized'
      });
    }

    res.status(500).json({
      error: 'Internal server error'
    });
  }
});

// =====================================================
// FAMILY MEMORY - GET
// GET /memory/family/:key
// =====================================================
router.get('/family/:key', async (req, res) => {
  try {
    const userId = getUserId(req);
    const { key } = req.params;

    const family = await getUserFamily(userId);

    if (!family) {
      return res.status(403).json({
        error: 'User is not an active family member'
      });
    }

    const { data, error } = await supabase
      .from('family_memory')
      .select('value')
      .eq('family_id', family.family_id)
      .eq('key', key)
      .maybeSingle();

    if (error) throw error;

    if (!data) {
      return res.status(404).json({
        error: 'Family memory not found'
      });
    }

    res.json({
      key,
      value: data.value
    });

  } catch (error) {
    console.error('Family memory fetch error:', error);

    if (
      error.message === 'NO_TOKEN' ||
      error.message === 'INVALID_TOKEN' ||
      error.name === 'JsonWebTokenError'
    ) {
      return res.status(401).json({
        error: 'Unauthorized'
      });
    }

    res.status(500).json({
      error: 'Internal server error'
    });
  }
});

module.exports = router;
