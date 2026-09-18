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

// ============ CREATE REQUEST ============
router.post('/', async (req, res) => {
  try {
    const token = req.headers.authorization?.split(' ')[1];
    if (!token) {
      return res.status(401).json({ error: 'No token provided' });
    }

    const decoded = jwt.verify(token, JWT_SECRET);
  const {
  provider_id,
  category,
  description,
  budget,
  location
} = req.body;  

    if (!category || !description) {
      return res.status(400).json({ error: 'Category and description are required' });
    }

    const { data: request, error } = await supabase
      .from('service_requests')
      .insert([{
        user_id: decoded.id,
        provider_id: provider_id || null,
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
// ============ PROVIDER NOTIFICATION ============
    if (provider_id) {
      const { error: notificationError } = await supabase
        .from('notifications')
        .insert([{
          user_id: provider_id,
          title: '🛠️ New Service Request',
          message: `Aapko ${category} ki nayi service request mili hai.`,
          type: 'service_request',
          related_id: request.id,
          is_read: false
        }]);

      if (notificationError) {
        console.error(
          '❌ Provider notification error:',
          notificationError
        );
      }
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
// ============ GET PROVIDER REQUESTS ============
router.get('/provider', async (req, res) => {
  try {
    const token = req.headers.authorization?.split(' ')[1];

    if (!token) {
      return res.status(401).json({
        error: 'No token provided'
      });
    }

    const decoded = jwt.verify(token, JWT_SECRET);

    const { data: requests, error } = await supabase
      .from('service_requests')
      .select('*')
      .eq('provider_id', decoded.id)
      .order('created_at', { ascending: false });

    if (error) {
      return res.status(400).json({
        error: error.message
      });
    }

    res.json(requests);

  } catch (error) {
    console.error('❌ Get provider requests error:', error);

    res.status(500).json({
      error: 'Internal server error'
    });
  }
});
// ============ PROVIDER ACCEPT / REJECT REQUEST ============
router.put('/provider/:id/status', async (req, res) => {
  try {
    const token = req.headers.authorization?.split(' ')[1];

    if (!token) {
      return res.status(401).json({
        error: 'No token provided'
      });
    }

    const decoded = jwt.verify(token, JWT_SECRET);

    const { id } = req.params;
    const { status } = req.body;

    const allowedStatuses = [
      'accepted',
      'rejected'
    ];

    if (!allowedStatuses.includes(status)) {
      return res.status(400).json({
        error: 'Status must be accepted or rejected'
      });
    }

    // Check request belongs to this provider
    const { data: existing, error: checkError } =
      await supabase
        .from('service_requests')
        .select('*')
        .eq('id', id)
        .eq('provider_id', decoded.id)
        .single();

    if (checkError || !existing) {
      return res.status(404).json({
        error: 'Request not found or unauthorized'
      });
    }

    if (existing.status !== 'pending') {
      return res.status(400).json({
        error:
          `Request already ${existing.status}`
      });
    }

    // Update request status
    const { data: updated, error: updateError } =
      await supabase
        .from('service_requests')
        .update({
          status
        })
        .eq('id', id)
        .eq('provider_id', decoded.id)
        .select()
        .single();

    if (updateError) {
      return res.status(400).json({
        error: updateError.message
      });
    }

    // Notify customer
    const notificationTitle =
      status === 'accepted'
        ? '✅ Service Request Accepted'
        : '❌ Service Request Rejected';

    const notificationMessage =
      status === 'accepted'
        ? 'Provider ne aapki service request accept kar li hai.'
        : 'Provider ne aapki service request reject kar di hai.';

    const { error: notificationError } =
      await supabase
        .from('notifications')
        .insert([{
          user_id: existing.user_id,
          title: notificationTitle,
          message: notificationMessage,
          type: 'service_request',
          related_id: existing.id,
          is_read: false
        }]);

    if (notificationError) {
      console.error(
        '❌ Customer notification error:',
        notificationError
      );
    }

    res.json({
      message:
        status === 'accepted'
          ? 'Request accepted successfully'
          : 'Request rejected successfully',
      request: updated
    });

  } catch (error) {

    console.error(
      '❌ Provider request status error:',
      error
    );

    res.status(500).json({
      error: 'Internal server error'
    });
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
