const express = require('express');
const rateLimit = require('express-rate-limit');
const crypto = require('crypto');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const multer = require('multer');
const { createClient } = require('@supabase/supabase-js');

const router = express.Router();
// =====================================================
// AUTH SECURITY RATE LIMITERS
// =====================================================

// Login: brute-force protection
const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 10,
  standardHeaders: 'draft-8',
  legacyHeaders: false,
  message: {
    error: 'Too many login attempts. Please try again later.'
  }
});

// Registration: bot/account-abuse protection
const registerLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  limit: 5,
  standardHeaders: 'draft-8',
  legacyHeaders: false,
  message: {
    error: 'Too many registration attempts. Please try again later.'
  }
});
// =====================================================
// PASSWORD RECOVERY RATE LIMITERS
// =====================================================

const forgotPasswordLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 5,
  standardHeaders: 'draft-8',
  legacyHeaders: false,
  message: {
    error: 'Too many password reset requests. Please try again later.'
  }
});

const resetPasswordLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 10,
  standardHeaders: 'draft-8',
  legacyHeaders: false,
  message: {
    error: 'Too many password reset attempts. Please try again later.'
  }
});
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
// =====================================================
// PASSWORD RESET EMAIL
// =====================================================

async function sendPasswordResetEmail({
  email,
  resetUrl
}) {
  const resendApiKey =
    process.env.RESEND_API_KEY;

  const emailFrom =
    process.env.EMAIL_FROM;

  if (!resendApiKey || !emailFrom) {
    throw new Error(
      'Password reset email service is not configured'
    );
  }

  const response = await fetch(
    'https://api.resend.com/emails',
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${resendApiKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        from: emailFrom,
        to: [email],
        subject: 'SamarthAI Password Reset',
        html: `
          <div style="font-family:Arial,sans-serif;max-width:600px;margin:auto">
            <h2>SamarthAI Password Reset</h2>

            <p>
              We received a request to reset your SamarthAI password.
            </p>

            <p>
              This link will expire in
              <strong>15 minutes</strong>
              and can only be used once.
            </p>

            <p>
              <a
                href="${resetUrl}"
                style="
                  display:inline-block;
                  padding:12px 20px;
                  background:#ff6b00;
                  color:white;
                  text-decoration:none;
                  border-radius:8px;
                "
              >
                Reset Password
              </a>
            </p>

            <p>
              If you did not request this, you can safely ignore this email.
            </p>

            <p>— SamarthAI Security</p>
          </div>
        `
      })
    }
  );

  if (!response.ok) {
    let data = null;

    try {
      data = await response.json();
    } catch {}

    throw new Error(
      data?.message ||
      data?.error ||
      `Email provider failed (${response.status})`
    );
  }
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

router.post(
  '/register',
  registerLimiter,
  async (req, res) => {
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

router.post(
  '/login',
  loginLimiter,
  async (req, res) => {
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
// =====================================================
// FORGOT PASSWORD
// =====================================================

router.post(
  '/forgot-password',
  forgotPasswordLimiter,
  async (req, res) => {
    const genericResponse = {
      message:
        'If an account exists for this email, a password reset link has been sent.'
    };

    try {
      const email =
        typeof req.body?.email === 'string'
          ? req.body.email.trim().toLowerCase()
          : '';

      if (!email) {
        return res.status(200).json(genericResponse);
      }

      const {
        data: users,
        error: userError
      } = await supabase
        .from('users')
        .select('id, email')
        .eq('email', email)
        .limit(1);

      if (userError) {
        console.error(
          'Password reset user lookup failed:',
          userError.message
        );

        return res.status(200).json(genericResponse);
      }

      const user = users?.[0];

      if (!user) {
        return res.status(200).json(genericResponse);
      }

      const rawToken =
        crypto.randomBytes(32).toString('hex');

      const tokenHash =
        crypto
          .createHash('sha256')
          .update(rawToken)
          .digest('hex');

      const expiresAt =
        new Date(
          Date.now() + 15 * 60 * 1000
        ).toISOString();

      const {
        error: deleteOldTokensError
      } = await supabase
        .from('password_reset_tokens')
        .delete()
        .eq('user_id', user.id)
        .is('used_at', null);

      if (deleteOldTokensError) {
        console.error(
          'Password reset cleanup failed:',
          deleteOldTokensError.message
        );

        return res.status(200).json(genericResponse);
      }

      const {
        error: insertTokenError
      } = await supabase
        .from('password_reset_tokens')
        .insert({
          user_id: user.id,
          token_hash: tokenHash,
          expires_at: expiresAt
        });

      if (insertTokenError) {
        console.error(
          'Password reset token creation failed:',
          insertTokenError.message
        );

        return res.status(200).json(genericResponse);
      }

      const publicAppUrl =
        (
          process.env.PUBLIC_APP_URL ||
          'https://samarthai-backend.onrender.com'
        ).replace(/\/+$/, '');

      const resetUrl =
        `${publicAppUrl}/reset-password.html?token=${encodeURIComponent(
          rawToken
        )}`;

      try {
        await sendPasswordResetEmail({
          email: user.email,
          resetUrl
        });
      } catch (emailError) {
        console.error(
          'Password reset email failed:',
          emailError.message
        );

        await supabase
          .from('password_reset_tokens')
          .delete()
          .eq('token_hash', tokenHash);
      }

      return res.status(200).json(genericResponse);

    } catch (error) {
      console.error(
        'Forgot password error:',
        error.message
      );

      return res.status(200).json(genericResponse);
    }
  }
);
// =====================================================
// RESET PASSWORD
// =====================================================

router.post(
  '/reset-password',
  resetPasswordLimiter,
  async (req, res) => {
    try {
      const {
        token,
        password
      } = req.body || {};

      if (
        typeof token !== 'string' ||
        !/^[a-f0-9]{64}$/i.test(token)
      ) {
        return res.status(400).json({
          error: 'Invalid or expired reset link'
        });
      }

      if (
        typeof password !== 'string' ||
        password.length < 8
      ) {
        return res.status(400).json({
          error:
            'Password must be at least 8 characters'
        });
      }

      const tokenHash =
        crypto
          .createHash('sha256')
          .update(token)
          .digest('hex');

      const {
        data: resetTokens,
        error: tokenLookupError
      } = await supabase
        .from('password_reset_tokens')
        .select(
          'id, user_id, expires_at, used_at'
        )
        .eq('token_hash', tokenHash)
        .limit(1);

      if (
        tokenLookupError ||
        !resetTokens?.length
      ) {
        return res.status(400).json({
          error: 'Invalid or expired reset link'
        });
      }

      const resetToken = resetTokens[0];

      if (resetToken.used_at) {
        return res.status(400).json({
          error: 'Invalid or expired reset link'
        });
      }

      if (
        new Date(resetToken.expires_at).getTime()
        <= Date.now()
      ) {
        return res.status(400).json({
          error: 'Invalid or expired reset link'
        });
      }

      const {
        data: consumedToken,
        error: consumeError
      } = await supabase
        .from('password_reset_tokens')
        .update({
          used_at: new Date().toISOString()
        })
        .eq('id', resetToken.id)
        .is('used_at', null)
        .select('id')
        .maybeSingle();

      if (
        consumeError ||
        !consumedToken
      ) {
        return res.status(400).json({
          error: 'Invalid or expired reset link'
        });
      }

      const hashedPassword =
        await bcrypt.hash(password, 12);

      const {
        error: passwordUpdateError
      } = await supabase
        .from('users')
        .update({
          password: hashedPassword
        })
        .eq('id', resetToken.user_id);

      if (passwordUpdateError) {
        console.error(
          'Password update failed:',
          passwordUpdateError.message
        );

        return res.status(500).json({
          error:
            'Unable to reset password. Please request a new link.'
        });
      }

      await supabase
        .from('password_reset_tokens')
        .delete()
        .eq('user_id', resetToken.user_id);

      return res.json({
        success: true,
        message:
          'Password reset successfully. Please login with your new password.'
      });

    } catch (error) {
      console.error(
        'Reset password error:',
        error.message
      );

      return res.status(500).json({
        error: 'Unable to reset password'
      });
    }
  }
);
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
// ============ DELETE ACCOUNT ============

router.delete('/account', async (req, res) => {
  try {

    const token =
      req.headers.authorization?.split(' ')[1];

    if (!token) {
      return res.status(401).json({
        error: 'No token provided'
      });
    }

    const decoded = jwt.verify(
      token,
      JWT_SECRET
    );

    if (!decoded?.id) {
      return res.status(401).json({
        error: 'Invalid token'
      });
    }


    // ------------------------------------------------
    // GET CURRENT USER
    // ------------------------------------------------

    const {
      data: user,
      error: userError
    } = await supabase
      .from('users')
    .select(
  'id, email, password, profile_photo_url'
) 
      
      .eq('id', decoded.id)
      .single();

    if (userError || !user) {
      return res.status(404).json({
        error: 'User account not found'
      });
    }

// ------------------------------------------------
// VERIFY CURRENT PASSWORD BEFORE ACCOUNT DELETION
// ------------------------------------------------

const { currentPassword } = req.body || {};

if (
  typeof currentPassword !== 'string' ||
  !currentPassword
) {
  return res.status(400).json({
    error: 'Current password is required'
  });
}

const passwordMatches = await bcrypt.compare(
  currentPassword,
  user.password
);

if (!passwordMatches) {
  return res.status(401).json({
    error: 'Incorrect current password'
  });
}
    // ------------------------------------------------
    // COLLECT PORTFOLIO STORAGE FILES
    // BEFORE DATABASE DELETION
    // ------------------------------------------------

    const {
      data: portfolioRows,
      error: portfolioError
    } = await supabase
      .from('service_portfolio')
      .select('image_url')
      .eq('user_id', decoded.id);

    if (portfolioError) {

      console.error(
        '❌ Portfolio cleanup lookup error:',
        portfolioError
      );

      return res.status(500).json({
        error:
          'Unable to prepare account deletion. Your account was not deleted.'
      });
    }

let storageCleanupWarning = false;

const portfolioPaths = [];
    

    const portfolioMarker =
      '/service-portfolio/';

    for (const item of portfolioRows || []) {

      if (
        item &&
        item.image_url &&
        item.image_url.includes(
          portfolioMarker
        )
      ) {

        const markerIndex =
          item.image_url.indexOf(
            portfolioMarker
          );

        const filePath =
          decodeURIComponent(
            item.image_url.slice(
              markerIndex +
                portfolioMarker.length
            )
          );

        if (filePath) {
          portfolioPaths.push(
            filePath
          );
        }
      }
    }


    // ------------------------------------------------
    // DELETE DATABASE ACCOUNT DATA
    // ------------------------------------------------

    const {
      data: deleteResult,
      error: deleteError
    } = await supabase.rpc(
      'delete_user_account',
      {
        p_user_id: decoded.id
      }
    );

    if (deleteError) {

      console.error(
        '❌ Account deletion database error:',
        deleteError
      );

      return res.status(500).json({
        error:
          'Account deletion failed. Your account was not deleted.'
      });
    }


    // ------------------------------------------------
    // REMOVE PORTFOLIO STORAGE FILES
    // ------------------------------------------------

    if (portfolioPaths.length > 0) {

      try {

        const {
          error: portfolioStorageError
        } = await supabase
          .storage
          .from('service-portfolio')
          .remove(portfolioPaths);

        if (portfolioStorageError) {
storageCleanupWarning = true;
          console.error(
            '⚠️ Portfolio storage cleanup error:',
            portfolioStorageError
          );

        }

      } catch (storageError) {
storageCleanupWarning = true;
        console.error(
          '⚠️ Portfolio storage cleanup exception:',
          storageError
        );

      }
    }


    // ------------------------------------------------
    // REMOVE PROFILE PHOTO FILES
    // ------------------------------------------------

    try {

      const {
        data: profileFiles,
        error: profileListError
      } = await supabase
        .storage
        .from('profile-photos')
        .list(decoded.id);

if (profileListError) {
  storageCleanupWarning = true;

  console.error(
    '⚠️ Profile photo listing error:',
    profileListError
  );
}

if (
  !profileListError &&
  profileFiles?.length
) {    

        const profilePaths =
          profileFiles.map(
            file =>
              `${decoded.id}/${file.name}`
          );

        const {
          error: profileRemoveError
        } = await supabase
          .storage
          .from('profile-photos')
          .remove(profilePaths);

        if (profileRemoveError) {
storageCleanupWarning = true;
          console.error(
            '⚠️ Profile photo cleanup error:',
            profileRemoveError
          );

        }
      }

    } catch (storageError) {
storageCleanupWarning = true;
      console.error(
        '⚠️ Profile photo cleanup exception:',
        storageError
      );

    }


    // ------------------------------------------------
    // FINAL RESPONSE
    // ------------------------------------------------

 res.json({
  success: true,

  message: storageCleanupWarning
    ? 'Your SamarthAI account and database data have been deleted. Some storage files could not be removed.'
    : 'Your SamarthAI account and associated account data have been deleted.',

  storage_cleanup_warning:
    storageCleanupWarning,

  result:
    deleteResult || null
});

  } catch (error) {

    console.error(
      '❌ Delete account error:',
      error
    );


    if (
      error.name ===
        'JsonWebTokenError' ||
      error.name ===
        'TokenExpiredError'
    ) {

      return res.status(401).json({
        error:
          'Invalid or expired token'
      });
    }


    res.status(500).json({
      error:
        'Unable to delete account'
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
