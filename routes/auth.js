const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const multer = require('multer');
const { createClient } = require('@supabase/supabase-js');

const router = express.Router();

// Supabase Client
const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
);

const JWT_SECRET = process.env.JWT_SECRET;
const JWT_EXPIRES_IN = '1h';

if (!JWT_SECRET) {
  throw new Error('JWT_SECRET environment variable is required');
}

// ============ MULTER PROFILE PHOTO UPLOAD ============

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

// ============ REGISTER ============

router.post('/register', async (req, res) => {
  try {
    const { name, email, password, phone } = req.body;

    if (!name || !email || !password) {
      return res.status(400).json({
        error: 'Name, email and password are required'
      });
    }

    const { data: existingUsers, error: existingUserError } =
      await supabase
        .from('users')
        .select('id')
        .eq('email', email)
        .limit(1);

    if (existingUserError) {
      console.error('❌ User lookup error:', existingUserError);
      return res.status(500).json({
        error: 'Unable to check account'
      });
    }

    if (existingUsers && existingUsers.length > 0) {
      return res.status(400).json({
        error: 'User already exists'
      });
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    const { data: user, error } = await supabase
      .from('users')
      .insert([
        {
          name,
          email,
          password: hashedPassword,
          phone
        }
      ])
      .select()
      .single();

    if (error) {
      console.error('❌ Supabase insert error:', error);
      return res.status(400).json({
        error: error.message
      });
    }

    const token = jwt.sign(
      {
        id: user.id,
        email: user.email
      },
      JWT_SECRET,
      {
        expiresIn: JWT_EXPIRES_IN
      }
    );

    res.status(201).json({
      message: 'User registered successfully',
      token,
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        profile_photo_url: user.profile_photo_url || null
      }
    });

  } catch (error) {
    console.error('❌ Register error:', error);
    res.status(500).json({
      error: 'Internal server error'
    });
  }
});

// ============ LOGIN ============

router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({
        error: 'Email and password are required'
      });
    }

    const { data: users, error } = await supabase
      .from('users')
      .select('*')
      .eq('email', email)
      .order('created_at', { ascending: false })
      .limit(1);

    const user = users?.[0];

    if (error || !user) {
      return res.status(401).json({
        error: 'Invalid credentials'
      });
    }

    const isMatch = await bcrypt.compare(
      password,
      user.password
    );

    if (!isMatch) {
      return res.status(401).json({
        error: 'Invalid credentials'
      });
    }

    const token = jwt.sign(
      {
        id: user.id,
        email: user.email
      },
      JWT_SECRET,
      {
        expiresIn: JWT_EXPIRES_IN
      }
    );

    res.json({
      message: 'Login successful',
      token,
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        profile_photo_url: user.profile_photo_url || null
      }
    });

  } catch (error) {
    console.error('❌ Login error:', error);
    res.status(500).json({
      error: 'Internal server error'
    });
  }
});

// ============ PROFILE GET ============

router.get('/profile', async (req, res) => {
  try {
    const token = req.headers.authorization?.split(' ')[1];

    if (!token) {
      return res.status(401).json({
        error: 'No token provided'
      });
    }

    const decoded = jwt.verify(token, JWT_SECRET);

    const { data: user, error } = await supabase
      .from('users')
      .select(
        'id, name, email, phone, profile_photo_url, created_at'
      )
      .eq('id', decoded.id)
      .single();

    if (error || !user) {
      return res.status(404).json({
        error: 'User not found'
      });
    }

    res.json(user);

  } catch (error) {
    console.error('❌ Profile error:', error);

    res.status(401).json({
      error: 'Invalid token'
    });
  }
});

// ============ PROFILE PHOTO UPLOAD ============

router.post(
  '/profile/photo',
  upload.single('profile_photo'),
  async (req, res) => {
    try {
      const token = req.headers.authorization?.split(' ')[1];

      if (!token) {
        return res.status(401).json({
          error: 'No token provided'
        });
      }

      const decoded = jwt.verify(token, JWT_SECRET);

      if (!req.file) {
        return res.status(400).json({
          error: 'Profile photo is required'
        });
      }

      const extensionMap = {
        'image/jpeg': 'jpg',
        'image/png': 'png',
        'image/webp': 'webp'
      };

      const extension = extensionMap[req.file.mimetype];

      if (!extension) {
        return res.status(400).json({
          error: 'Only JPG, PNG and WebP images are allowed'
        });
      }

      const filePath =
        `${decoded.id}/profile-${Date.now()}.${extension}`;

      const { error: uploadError } = await supabase
        .storage
        .from('profile-photos')
        .upload(filePath, req.file.buffer, {
          contentType: req.file.mimetype,
          upsert: true
        });

      if (uploadError) {
        console.error(
          '❌ Profile photo upload error:',
          uploadError
        );

        return res.status(500).json({
          error: 'Failed to upload profile photo'
        });
      }

      const {
        data: publicUrlData
      } = supabase
        .storage
        .from('profile-photos')
        .getPublicUrl(filePath);

      const profilePhotoUrl =
        publicUrlData?.publicUrl || null;

      if (!profilePhotoUrl) {
        return res.status(500).json({
          error: 'Unable to create profile photo URL'
        });
      }

      const { error: updateError } = await supabase
        .from('users')
        .update({
          profile_photo_url: profilePhotoUrl
        })
        .eq('id', decoded.id);

      if (updateError) {
        console.error(
          '❌ Profile photo database update error:',
          updateError
        );

        return res.status(500).json({
          error: 'Photo uploaded but profile update failed'
        });
      }

      res.json({
        message: 'Profile photo uploaded successfully',
        profile_photo_url: profilePhotoUrl
      });

    } catch (error) {
      console.error(
        '❌ Profile photo error:',
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
  }
);

// ============ UPDATE PROFILE ============

router.put('/profile', async (req, res) => {
  try {
    const token = req.headers.authorization?.split(' ')[1];

    if (!token) {
      return res.status(401).json({
        error: 'No token provided'
      });
    }

    const decoded = jwt.verify(token, JWT_SECRET);

    const { name, phone } = req.body;

    const { error: updateError } = await supabase
      .from('users')
      .update({
        name,
        phone
      })
      .eq('id', decoded.id);

    if (updateError) {
      return res.status(400).json({
        error: updateError.message
      });
    }

    const { data: user, error: fetchError } =
      await supabase
        .from('users')
        .select(
          'id, name, email, phone, profile_photo_url, created_at'
        )
        .eq('id', decoded.id)
        .single();

    if (fetchError || !user) {
      return res.status(404).json({
        error: 'User not found'
      });
    }

    res.json({
      message: 'Profile updated successfully',
      user
    });

  } catch (error) {
    console.error(
      '❌ Update profile error:',
      error
    );

    res.status(401).json({
      error: 'Invalid token'
    });
  }
});

// ============ MULTER ERROR HANDLER ============

router.use((error, req, res, next) => {
  if (error instanceof multer.MulterError) {
    if (error.code === 'LIMIT_FILE_SIZE') {
      return res.status(400).json({
        error: 'Profile photo must be 5MB or smaller'
      });
    }

    return res.status(400).json({
      error: error.message
    });
  }

  if (
    error &&
    error.message ===
      'Only JPG, PNG and WebP images are allowed'
  ) {
    return res.status(400).json({
      error: error.message
    });
  }

  next(error);
});

module.exports = router;
