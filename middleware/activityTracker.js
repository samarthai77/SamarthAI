const jwt = require('jsonwebtoken');
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
);

// Same user ke last_seen ko baar-baar DB me update na karein
const lastActivityWrite = new Map();

const ONLINE_WINDOW_MS = 5 * 60 * 1000; // 5 minutes
const WRITE_INTERVAL_MS = 60 * 1000;   // 1 minute

async function activityTracker(req, res, next) {
  try {
    const authHeader = req.headers.authorization || '';

    if (!authHeader.startsWith('Bearer ')) {
      return next();
    }

    const token = authHeader.substring(7).trim();

    if (!token) {
      return next();
    }

    const decoded = jwt.verify(
      token,
      process.env.JWT_SECRET
    );

    const userId = decoded.id;

    if (!userId) {
      return next();
    }

    const now = Date.now();
    const lastWrite = lastActivityWrite.get(userId) || 0;

    // Har request par DB update nahi hoga
    if (now - lastWrite < WRITE_INTERVAL_MS) {
      return next();
    }

    lastActivityWrite.set(userId, now);

    // User active hai to last_seen update karo
    await supabase
      .from('users')
      .update({
        last_seen_at: new Date(now).toISOString()
      })
      .eq('id', userId)
      .eq('is_active', true);

  } catch (error) {
    // Activity tracker ki wajah se normal request kabhi block nahi hogi
    console.warn(
      'Activity tracker warning:',
      error.message
    );
  }

  next();
}

module.exports = activityTracker;
