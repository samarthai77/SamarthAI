const express = require('express');
const jwt = require('jsonwebtoken');
const { createClient } = require('@supabase/supabase-js');

const router = express.Router();

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
);

const JWT_SECRET = process.env.JWT_SECRET;

if (!JWT_SECRET) {
  throw new Error('JWT_SECRET environment variable is required');
}

// ============ ADD SERVICE ============
router.post('/', async (req, res) => {
  try {
    const token = req.headers.authorization?.split(' ')[1];
    if (!token) {
      return res.status(401).json({ error: 'No token provided' });
    }

    const decoded = jwt.verify(token, JWT_SECRET);
    const { title, description, price, category, location } = req.body;

    
      return res.status(400).json({ error: 'Title, description, price and category are required' });
    }
if (!title || !description || price === undefined || price === null || price === '' || !category) {
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
// ============ GET ALL SERVICES ============
router.get('/', async (req, res) => {
  try {
    const { data: services, error } = await supabase
      .from('services')
      .select(`
        id,
        title,
        description,
        price,
        category,
        location,
        is_active,
        created_at,
        users(name)
      `)
      .eq('is_active', true)
      .order('created_at', { ascending: false });

    if (error) {
      return res.status(400).json({ error: error.message });
    }

    const safeServices = (services || []).map(service => ({
      ...service,
      provider_name: service.users?.name || 'Service Provider'
    }));

    safeServices.forEach(service => {
      delete service.users;
    });

    res.json(safeServices);

  } catch (error) {
    console.error('❌ Get services error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});
// ============ GET SERVICE CONTACT ============
router.get('/:id/contact', async (req, res) => {
  try {
    const token = req.headers.authorization?.split(' ')[1];

    if (!token) {
      return res.status(401).json({
        error: 'Authentication required'
      });
    }

    const decoded = jwt.verify(token, JWT_SECRET);
    const { id } = req.params;

    const { data: service, error: serviceError } = await supabase
      .from('services')
      .select('id, user_id, is_active')
      .eq('id', id)
      .eq('is_active', true)
      .maybeSingle();

    if (serviceError) {
      return res.status(500).json({
        error: serviceError.message
      });
    }

    if (!service) {
      return res.status(404).json({
        error: 'Service not found'
      });
    }

    const { data: provider, error: providerError } = await supabase
      .from('users')
      .select('name, phone')
      .eq('id', service.user_id)
      .maybeSingle();

    if (providerError) {
      return res.status(500).json({
        error: providerError.message
      });
    }

    if (!provider) {
      return res.status(404).json({
        error: 'Service provider not found'
      });
    }

    res.json({
      name: provider.name || 'Service Provider',
      phone: provider.phone || null
    });

  } catch (error) {
    console.error('❌ Get service contact error:', error);

    if (
      error.name === 'JsonWebTokenError' ||
      error.name === 'TokenExpiredError'
    ) {
      return res.status(401).json({
        error: 'Invalid or expired token'
      });
    }

    res.status(500).json({
      error: 'Internal server error'
    });
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
      price: price !== undefined && price !== null && price !== '' ? price : existing.price,
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
