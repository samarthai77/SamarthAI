const express = require('express');
const jwt = require('jsonwebtoken');
const multer = require('multer');
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

// Maximum 5 MB per photo
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 5 * 1024 * 1024
  },
  fileFilter: (req, file, cb) => {
    const allowedTypes = [
      'image/jpeg',
      'image/png',
      'image/webp'
    ];

    if (!allowedTypes.includes(file.mimetype)) {
      return cb(
        new Error('Only JPG, PNG and WebP images are allowed')
      );
    }

    cb(null, true);
  }
});

// ============================================
// UPLOAD PORTFOLIO PHOTO
// POST /api/service-portfolio/:serviceId
// ============================================

router.post('/:serviceId', upload.single('photo'), async (req, res) => {
  try {
    const token = req.headers.authorization?.split(' ')[1];

    if (!token) {
      return res.status(401).json({
        error: 'Authentication required'
      });
    }

    const decoded = jwt.verify(token, JWT_SECRET);
    const { serviceId } = req.params;

    if (!req.file) {
      return res.status(400).json({
        error: 'Photo is required'
      });
    }

    // Check service ownership
    const { data: service, error: serviceError } = await supabase
      .from('services')
      .select('id, user_id')
      .eq('id', serviceId)
      .eq('user_id', decoded.id)
      .maybeSingle();

    if (serviceError) {
      return res.status(500).json({
        error: serviceError.message
      });
    }

    if (!service) {
      return res.status(404).json({
        error: 'Service not found or unauthorized'
      });
    }

    // Maximum 10 portfolio photos per service
    const { count, error: countError } = await supabase
      .from('service_portfolio')
      .select('id', {
        count: 'exact',
        head: true
      })
      .eq('service_id', serviceId);

    if (countError) {
      return res.status(500).json({
        error: countError.message
      });
    }

    if ((count || 0) >= 10) {
      return res.status(400).json({
        error: 'Maximum 10 portfolio photos allowed per service'
      });
    }

    const extension = req.file.mimetype === 'image/png'
      ? 'png'
      : req.file.mimetype === 'image/webp'
        ? 'webp'
        : 'jpg';

    const fileName =
      `${decoded.id}/${serviceId}/${Date.now()}-${Math.random()
        .toString(36)
        .slice(2)}.${extension}`;

    // Upload to Supabase Storage
    const { error: uploadError } = await supabase.storage
      .from('service-portfolio')
      .upload(fileName, req.file.buffer, {
        contentType: req.file.mimetype,
        upsert: false
      });

    if (uploadError) {
      console.error('❌ Portfolio upload error:', uploadError);

      return res.status(500).json({
        error: uploadError.message
      });
    }

    // Get public URL
    const { data: publicUrlData } = supabase.storage
      .from('service-portfolio')
      .getPublicUrl(fileName);

    const imageUrl = publicUrlData?.publicUrl;

    if (!imageUrl) {
      return res.status(500).json({
        error: 'Unable to generate image URL'
      });
    }

    // Save database record
    const caption =
      typeof req.body.caption === 'string'
        ? req.body.caption.trim().slice(0, 200)
        : null;

    const { data: portfolio, error: insertError } = await supabase
      .from('service_portfolio')
      .insert([{
        service_id: serviceId,
        user_id: decoded.id,
        image_url: imageUrl,
        caption
      }])
      .select()
      .single();

    if (insertError) {
      // Cleanup uploaded file if database insert fails
      await supabase.storage
        .from('service-portfolio')
        .remove([fileName]);

      return res.status(500).json({
        error: insertError.message
      });
    }

    res.status(201).json({
      message: 'Portfolio photo uploaded successfully',
      portfolio
    });

  } catch (error) {
    console.error('❌ Portfolio upload error:', error);

    if (
      error.name === 'JsonWebTokenError' ||
      error.name === 'TokenExpiredError'
    ) {
      return res.status(401).json({
        error: 'Invalid or expired token'
      });
    }

    if (error instanceof multer.MulterError) {
      if (error.code === 'LIMIT_FILE_SIZE') {
        return res.status(400).json({
          error: 'Photo must be 5 MB or smaller'
        });
      }

      return res.status(400).json({
        error: error.message
      });
    }

    res.status(500).json({
      error: 'Internal server error'
    });
  }
});

// ============================================
// GET PORTFOLIO PHOTOS
// GET /api/service-portfolio/:serviceId
// ============================================

router.get('/:serviceId', async (req, res) => {
  try {
    const { serviceId } = req.params;

    const { data, error } = await supabase
      .from('service_portfolio')
      .select(`
        id,
        service_id,
        user_id,
        image_url,
        caption,
        created_at
      `)
      .eq('service_id', serviceId)
      .order('created_at', {
        ascending: false
      });

    if (error) {
      return res.status(500).json({
        error: error.message
      });
    }

    res.json(data || []);

  } catch (error) {
    console.error('❌ Get portfolio error:', error);

    res.status(500).json({
      error: 'Internal server error'
    });
  }
});

// ============================================
// DELETE PORTFOLIO PHOTO
// DELETE /api/service-portfolio/:id
// ============================================

router.delete('/:id', async (req, res) => {
  try {
    const token = req.headers.authorization?.split(' ')[1];

    if (!token) {
      return res.status(401).json({
        error: 'Authentication required'
      });
    }

    const decoded = jwt.verify(token, JWT_SECRET);
    const { id } = req.params;

    const { data: portfolio, error: findError } = await supabase
      .from('service_portfolio')
      .select('id, user_id, image_url')
      .eq('id', id)
      .eq('user_id', decoded.id)
      .maybeSingle();

    if (findError) {
      return res.status(500).json({
        error: findError.message
      });
    }

    if (!portfolio) {
      return res.status(404).json({
        error: 'Portfolio photo not found or unauthorized'
      });
    }

    // Extract storage path from public URL
    const marker = '/service-portfolio/';

    const markerIndex = portfolio.image_url.indexOf(marker);

    if (markerIndex !== -1) {
      const filePath = decodeURIComponent(
        portfolio.image_url.slice(
          markerIndex + marker.length
        )
      );

      await supabase.storage
        .from('service-portfolio')
        .remove([filePath]);
    }

    const { error: deleteError } = await supabase
      .from('service_portfolio')
      .delete()
      .eq('id', id)
      .eq('user_id', decoded.id);

    if (deleteError) {
      return res.status(500).json({
        error: deleteError.message
      });
    }

    res.json({
      message: 'Portfolio photo deleted successfully'
    });

  } catch (error) {
    console.error('❌ Delete portfolio error:', error);

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
