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

// ============================================
// CREATE CUSTOMER COMPLAINT
// ============================================

router.post('/', async (req, res) => {
  try {
    const token = req.headers.authorization?.split(' ')[1];

    if (!token) {
      return res.status(401).json({
        error: 'No token provided'
      });
    }

    const decoded = jwt.verify(token, JWT_SECRET);

    const {
      service_id,
      provider_id,
      reason,
      description
    } = req.body;

    if (!provider_id || !reason) {
      return res.status(400).json({
        error: 'Provider ID and complaint reason are required'
      });
    }

    // ========================================
    // CHECK PROVIDER
    // ========================================

    const { data: provider, error: providerError } =
      await supabase
        .from('users')
        .select('id, name')
        .eq('id', provider_id)
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

    // ========================================
    // CHECK SERVICE
    // ========================================

    let service = null;

    if (service_id) {
      const { data: serviceData, error: serviceError } =
        await supabase
          .from('services')
          .select('id, user_id, title, is_active')
          .eq('id', service_id)
          .maybeSingle();

      if (serviceError) {
        return res.status(500).json({
          error: serviceError.message
        });
      }

      if (!serviceData) {
        return res.status(404).json({
          error: 'Service not found'
        });
      }

      if (String(serviceData.user_id) !== String(provider_id)) {
        return res.status(400).json({
          error: 'Service and provider do not match'
        });
      }

      service = serviceData;
    }

    // ========================================
    // PREVENT SELF COMPLAINT
    // ========================================

    if (String(decoded.id) === String(provider_id)) {
      return res.status(400).json({
        error: 'You cannot report your own service'
      });
    }

    // ========================================
    // CREATE COMPLAINT
    // ========================================

    const { data: complaint, error: complaintError } =
      await supabase
        .from('service_complaints')
        .insert([{
          service_id: service_id || null,
          provider_id,
          customer_id: decoded.id,
          reason: String(reason).trim(),
          description: description
            ? String(description).trim()
            : null,
          status: 'pending'
        }])
        .select()
        .single();

    if (complaintError) {
      console.error(
        '❌ Complaint insert error:',
        complaintError
      );

      return res.status(400).json({
        error: complaintError.message
      });
    }

    // ========================================
    // PROVIDER NOTIFICATION
    // ========================================

    const serviceTitle =
      service?.title || 'Service';

    const { error: notificationError } =
      await supabase
        .from('notifications')
        .insert([{
          user_id: provider_id,
          title: '⚠️ Customer Complaint Received',
          message:
            `Aapki "${serviceTitle}" service ke against customer complaint receive hui hai.`,
          type: 'service_complaint',
          related_id: complaint.id,
          is_read: false
        }]);

    if (notificationError) {
      console.error(
        '❌ Complaint notification error:',
        notificationError
      );
    }

    res.status(201).json({
      message: 'Complaint submitted successfully',
      complaint: {
        id: complaint.id,
        service_id: complaint.service_id,
        provider_id: complaint.provider_id,
        reason: complaint.reason,
        status: complaint.status,
        created_at: complaint.created_at
      }
    });

  } catch (error) {
    console.error(
      '❌ Create complaint error:',
      error
    );

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


// ============================================
// CUSTOMER — GET MY COMPLAINTS
// ============================================

router.get('/my', async (req, res) => {
  try {
    const token = req.headers.authorization?.split(' ')[1];

    if (!token) {
      return res.status(401).json({
        error: 'No token provided'
      });
    }

    const decoded = jwt.verify(token, JWT_SECRET);

    const { data: complaints, error } =
      await supabase
        .from('service_complaints')
        .select(`
          id,
          service_id,
          provider_id,
          reason,
          description,
          status,
          admin_note,
          created_at,
          updated_at,
          services(title),
          users!service_complaints_provider_id_fkey(name)
        `)
        .eq('customer_id', decoded.id)
        .order('created_at', {
          ascending: false
        });

    if (error) {
      return res.status(400).json({
        error: error.message
      });
    }

    const safeComplaints = (complaints || []).map(
      complaint => ({
        id: complaint.id,
        service_id: complaint.service_id,
        provider_id: complaint.provider_id,
        provider_name:
          complaint.users?.name || 'Service Provider',
        service_title:
          complaint.services?.title || 'Service',
        reason: complaint.reason,
        description: complaint.description,
        status: complaint.status,
        admin_note: complaint.admin_note,
        created_at: complaint.created_at,
        updated_at: complaint.updated_at
      })
    );

    res.json(safeComplaints);

  } catch (error) {
    console.error(
      '❌ Get customer complaints error:',
      error
    );

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


// ============================================
// PROVIDER — GET COMPLAINTS AGAINST ME
// ============================================

router.get('/provider', async (req, res) => {
  try {
    const token = req.headers.authorization?.split(' ')[1];

    if (!token) {
      return res.status(401).json({
        error: 'No token provided'
      });
    }

    const decoded = jwt.verify(token, JWT_SECRET);

    const { data: complaints, error } =
      await supabase
        .from('service_complaints')
        .select(`
          id,
          service_id,
          customer_id,
          reason,
          description,
          status,
          admin_note,
          created_at,
          updated_at,
          services(title),
          users!service_complaints_customer_id_fkey(name)
        `)
        .eq('provider_id', decoded.id)
        .order('created_at', {
          ascending: false
        });

    if (error) {
      return res.status(400).json({
        error: error.message
      });
    }

    const safeComplaints = (complaints || []).map(
      complaint => ({
        id: complaint.id,
        service_id: complaint.service_id,
        customer_id: complaint.customer_id,
        customer_name:
          complaint.users?.name || 'Customer',
        service_title:
          complaint.services?.title || 'Service',
        reason: complaint.reason,
        description: complaint.description,
        status: complaint.status,
        admin_note: complaint.admin_note,
        created_at: complaint.created_at,
        updated_at: complaint.updated_at
      })
    );

    res.json(safeComplaints);

  } catch (error) {
    console.error(
      '❌ Get provider complaints error:',
      error
    );

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


module.exports = router;
