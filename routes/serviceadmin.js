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
// AUTH + SERVICE ADMIN CHECK
// ============================================

async function requireServiceAdmin(req, res) {
  const token = req.headers.authorization?.split(' ')[1];

  if (!token) {
    res.status(401).json({
      error: 'No token provided'
    });
    return null;
  }

  let decoded;

  try {
    decoded = jwt.verify(token, JWT_SECRET);
  } catch (error) {
    res.status(401).json({
      error: 'Invalid or expired token'
    });
    return null;
  }

  const { data: admin, error } = await supabase
    .from('service_admins')
    .select('id, user_id, is_active')
    .eq('user_id', decoded.id)
    .eq('is_active', true)
    .maybeSingle();

  if (error) {
    res.status(500).json({
      error: error.message
    });
    return null;
  }

  if (!admin) {
    res.status(403).json({
      error: 'Service Admin access required'
    });
    return null;
  }

  return decoded;
}


// ============================================
// GET ALL COMPLAINTS
// ============================================

router.get('/complaints', async (req, res) => {
  try {
    const admin = await requireServiceAdmin(req, res);

    if (!admin) return;

    const { data: complaints, error } = await supabase
      .from('service_complaints')
      .select(`
        id,
        service_id,
        provider_id,
        customer_id,
        reason,
        description,
        status,
        admin_note,
        created_at,
        updated_at
      `)
      .order('created_at', {
        ascending: false
      });

    if (error) {
      return res.status(400).json({
        error: error.message
      });
    }

    const safeComplaints = [];

    for (const complaint of complaints || []) {

      let service = null;
      let provider = null;
      let customer = null;

      if (complaint.service_id) {
        const { data } = await supabase
          .from('services')
          .select('id, title, is_active')
          .eq('id', complaint.service_id)
          .maybeSingle();

        service = data;
      }

      if (complaint.provider_id) {
        const { data } = await supabase
          .from('users')
          .select('id, name, phone')
          .eq('id', complaint.provider_id)
          .maybeSingle();

        provider = data;
      }

      if (complaint.customer_id) {
        const { data } = await supabase
          .from('users')
          .select('id, name')
          .eq('id', complaint.customer_id)
          .maybeSingle();

        customer = data;
      }

      safeComplaints.push({
        id: complaint.id,

        service_id: complaint.service_id,
        service_title: service?.title || 'Service',
        service_is_active:
          service?.is_active ?? null,

        provider_id: complaint.provider_id,
        provider_name:
          provider?.name || 'Service Provider',
        provider_phone:
          provider?.phone || null,

        customer_id: complaint.customer_id,
        customer_name:
          customer?.name || 'Customer',

        reason: complaint.reason,
        description: complaint.description,

        status: complaint.status,
        admin_note: complaint.admin_note,

        created_at: complaint.created_at,
        updated_at: complaint.updated_at
      });
    }

    res.json(safeComplaints);

  } catch (error) {
    console.error(
      '❌ Admin get complaints error:',
      error
    );

    res.status(500).json({
      error: 'Internal server error'
    });
  }
});


// ============================================
// UPDATE COMPLAINT STATUS / ADMIN NOTE
// ============================================

router.put('/complaints/:id', async (req, res) => {
  try {
    const admin = await requireServiceAdmin(req, res);

    if (!admin) return;

    const { id } = req.params;

    const {
      status,
      admin_note
    } = req.body;

    const allowedStatuses = [
      'pending',
      'reviewing',
      'resolved',
      'rejected'
    ];

    if (
      status !== undefined &&
      !allowedStatuses.includes(status)
    ) {
      return res.status(400).json({
        error:
          'Invalid status. Allowed: pending, reviewing, resolved, rejected'
      });
    }

    // Get existing complaint
    const { data: existing, error: existingError } =
      await supabase
        .from('service_complaints')
        .select(`
          id,
          service_id,
          provider_id,
          status,
          admin_note
        `)
        .eq('id', id)
        .maybeSingle();

    if (existingError) {
      return res.status(500).json({
        error: existingError.message
      });
    }

    if (!existing) {
      return res.status(404).json({
        error: 'Complaint not found'
      });
    }

    const oldStatus = existing.status;
    const newStatus =
      status !== undefined
        ? status
        : existing.status;

    const newNote =
      admin_note !== undefined
        ? String(admin_note).trim() || null
        : existing.admin_note;

    // Update complaint
    const { data: updated, error: updateError } =
      await supabase
        .from('service_complaints')
        .update({
          status: newStatus,
          admin_note: newNote,
          updated_at: new Date().toISOString()
        })
        .eq('id', id)
        .select()
        .single();

    if (updateError) {
      return res.status(400).json({
        error: updateError.message
      });
    }

    // ========================================
    // ADMIN ACTION RECORD
    // ========================================

    let action = 'complaint_updated';

    if (oldStatus !== newStatus) {
      action = `status_${newStatus}`;
    }

    const { error: actionError } = await supabase
      .from('service_admin_actions')
      .insert([{
        admin_id: admin.id,
        complaint_id: existing.id,
        service_id: existing.service_id,
        provider_id: existing.provider_id,
        action,
        old_status: oldStatus,
        new_status: newStatus,
        admin_note: newNote
      }]);

    if (actionError) {
      console.error(
        '❌ Admin action log error:',
        actionError
      );
    }

    // ========================================
    // PROVIDER NOTIFICATION
    // ========================================

    let notificationTitle =
      '🛡️ Complaint Update';

    let notificationMessage =
      'Aapki service complaint par admin ne update kiya hai.';

    if (newStatus === 'reviewing') {
      notificationTitle =
        '🔎 Complaint Under Review';

      notificationMessage =
        'Aapki service complaint SamarthAI moderation team review kar rahi hai.';
    }

    if (newStatus === 'resolved') {
      notificationTitle =
        '✅ Complaint Resolved';

      notificationMessage =
        'Aapki service complaint par admin review complete ho gaya hai.';
    }

    if (newStatus === 'rejected') {
      notificationTitle =
        'ℹ️ Complaint Rejected';

      notificationMessage =
        'Customer complaint admin review ke baad rejected kar di gayi hai.';
    }

    if (newNote) {
      notificationMessage +=
        ` Admin Note: ${newNote}`;
    }

    const { error: notificationError } =
      await supabase
        .from('notifications')
        .insert([{
          user_id: existing.provider_id,
          title: notificationTitle,
          message: notificationMessage,
          type: 'service_admin_action',
          related_id: existing.id,
          is_read: false
        }]);

    if (notificationError) {
      console.error(
        '❌ Admin notification error:',
        notificationError
      );
    }

    res.json({
      message: 'Complaint updated successfully',
      complaint: updated
    });

  } catch (error) {
    console.error(
      '❌ Admin update complaint error:',
      error
    );

    res.status(500).json({
      error: 'Internal server error'
    });
  }
});


// ============================================
// DISABLE SERVICE
// ============================================

router.post('/services/:id/disable', async (req, res) => {
  try {
    const admin = await requireServiceAdmin(req, res);

    if (!admin) return;

    const { id } = req.params;

    const {
      reason,
      complaint_id
    } = req.body;

    // Get service
    const { data: service, error: serviceError } =
      await supabase
        .from('services')
        .select(`
          id,
          user_id,
          title,
          is_active
        `)
        .eq('id', id)
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

    if (!service.is_active) {
      return res.json({
        message: 'Service is already disabled',
        service
      });
    }

    // Disable service
    const { data: updatedService, error: updateError } =
      await supabase
        .from('services')
        .update({
          is_active: false
        })
        .eq('id', id)
        .select()
        .single();

    if (updateError) {
      return res.status(400).json({
        error: updateError.message
      });
    }

    // ========================================
    // ADMIN ACTION LOG
    // ========================================

    const { error: actionError } = await supabase
      .from('service_admin_actions')
      .insert([{
        admin_id: admin.id,
        complaint_id: complaint_id || null,
        service_id: service.id,
        provider_id: service.user_id,
        action: 'service_disabled',
        old_status: null,
        new_status: null,
        admin_note:
          reason
            ? String(reason).trim()
            : 'Service disabled by Service Admin'
      }]);

    if (actionError) {
      console.error(
        '❌ Service disable action log error:',
        actionError
      );
    }

    // ========================================
    // PROVIDER NOTIFICATION
    // ========================================

    const message =
      reason
        ? `Aapki "${service.title}" service SamarthAI admin moderation ke dwara disable ki gayi hai. Reason: ${String(reason).trim()}`
        : `Aapki "${service.title}" service SamarthAI admin moderation ke dwara disable ki gayi hai.`;

    const { error: notificationError } =
      await supabase
        .from('notifications')
        .insert([{
          user_id: service.user_id,
          title: '🚫 Service Disabled',
          message,
          type: 'service_admin_action',
          related_id: service.id,
          is_read: false
        }]);

    if (notificationError) {
      console.error(
        '❌ Service disable notification error:',
        notificationError
      );
    }

    res.json({
      message: 'Service disabled successfully',
      service: updatedService
    });

  } catch (error) {
    console.error(
      '❌ Admin disable service error:',
      error
    );

    res.status(500).json({
      error: 'Internal server error'
    });
  }
});


module.exports = router;
