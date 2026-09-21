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


// ======================================================
// ADMIN AUTHENTICATION
// ======================================================

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

  if (!decoded?.id) {
    res.status(401).json({
      error: 'Invalid token'
    });
    return null;
  }

  const {
    data: admin,
    error
  } = await supabase
    .from('service_admins')
    .select('id, user_id, is_active')
    .eq('user_id', decoded.id)
    .eq('is_active', true)
    .maybeSingle();

  if (error) {
    console.error(
      '❌ Admin authorization error:',
      error
    );

    res.status(500).json({
      error: 'Unable to verify admin access'
    });

    return null;
  }

  if (!admin) {
    res.status(403).json({
      error: 'Admin access required'
    });

    return null;
  }

  return {
    decoded,
    admin
  };
}


// ======================================================
// ADMIN DASHBOARD
// ======================================================

router.get('/dashboard', async (req, res) => {
  let adminStep = 'starting';

  try {

    const auth = await requireServiceAdmin(req, res);

    if (!auth) return;


    // --------------------------------------------------
    // TIME
    // --------------------------------------------------

    const now = new Date();

    const fiveMinutesAgo =
      new Date(
        now.getTime() - 5 * 60 * 1000
      ).toISOString();


    // Start of today
    const startOfToday = new Date();

    startOfToday.setHours(
      0,
      0,
      0,
      0
    );


    // Start of current month
    const startOfMonth = new Date(
      now.getFullYear(),
      now.getMonth(),
      1
    );


    // --------------------------------------------------
    // TOTAL MEMBERS
    // --------------------------------------------------
adminStep = 'total_members';
    const {
      count: totalMembers,
      error: totalError
    } = await supabase
      .from('users')
      .select('id', {
        count: 'exact',
        head: true
      });

    if (totalError) {
      throw totalError;
    }


    // --------------------------------------------------
    // ONLINE MEMBERS
    // --------------------------------------------------
adminStep = 'online_members';
    const {
      count: onlineMembers,
      error: onlineError
    } = await supabase
      .from('users')
      .select('id', {
        count: 'exact',
        head: true
      })
      .eq('is_active', true)
      .gte(
        'last_seen_at',
        fiveMinutesAgo
      );

    if (onlineError) {
      throw onlineError;
    }


    // --------------------------------------------------
    // OFFLINE MEMBERS
    // --------------------------------------------------
adminStep = 'offline_members';
    const {
      count: offlineMembers,
      error: offlineError
    } = await supabase
      .from('users')
      .select('id', {
        count: 'exact',
        head: true
      })
      .or(
        `last_seen_at.is.null,last_seen_at.lt.${fiveMinutesAgo}`
      );

    if (offlineError) {
      throw offlineError;
    }


    // --------------------------------------------------
    // FREE MEMBERS
    // --------------------------------------------------
adminStep = 'free_members';
    const {
      count: freeMembers,
      error: freeError
    } = await supabase
      .from('users')
      .select('id', {
        count: 'exact',
        head: true
      })
      .eq('plan', 'free');

    if (freeError) {
      throw freeError;
    }


    // --------------------------------------------------
    // PRO MEMBERS
    // --------------------------------------------------
adminStep = 'pro_members';
    const {
      count: proMembers,
      error: proError
    } = await supabase
      .from('users')
      .select('id', {
        count: 'exact',
        head: true
      })
      .eq('plan', 'pro');

    if (proError) {
      throw proError;
    }


    // --------------------------------------------------
    // NEW MEMBERS TODAY
    // --------------------------------------------------
adminStep = 'new_today';
    const {
      count: newToday,
      error: todayError
    } = await supabase
      .from('users')
      .select('id', {
        count: 'exact',
        head: true
      })
      .gte(
        'created_at',
        startOfToday.toISOString()
      );

    if (todayError) {
      throw todayError;
    }


    // --------------------------------------------------
    // NEW MEMBERS THIS MONTH
    // --------------------------------------------------
adminStep = 'new_this_month';
    const {
      count: newThisMonth,
      error: monthError
    } = await supabase
      .from('users')
      .select('id', {
        count: 'exact',
        head: true
      })
      .gte(
        'created_at',
        startOfMonth.toISOString()
      );

    if (monthError) {
      throw monthError;
    }


    // --------------------------------------------------
    // APP INSTALLS
    // --------------------------------------------------
adminStep = 'app_installs';
    const {
      count: installs,
      error: installError
    } = await supabase
      .from('app_installs')
      .select('id', {
        count: 'exact',
        head: true
      });

    if (installError) {
      throw installError;
    }


    // --------------------------------------------------
    // MEMBER LIST
    // --------------------------------------------------
adminStep = 'members_list';
    const {
      data: members,
      error: membersError
    } = await supabase
      .from('users')
      .select(`
        id,
        name,
        email,
        phone,
        profile_photo_url,
        plan,
        is_active,
        created_at,
        last_seen_at
      `)
      .order(
        'created_at',
        {
          ascending: false
        }
      )
      .limit(200);

    if (membersError) {
      throw membersError;
    }


    // --------------------------------------------------
    // FORMAT MEMBER DATA
    // --------------------------------------------------

    const safeMembers =
      (members || []).map(user => {

        const isOnline =
          user.is_active === true &&
          user.last_seen_at &&
          new Date(
            user.last_seen_at
          ).getTime() >=
            Date.now() -
            5 * 60 * 1000;

        return {
          id: user.id,

          name:
            user.name || 'User',

          email:
            user.email || '',

          phone:
            user.phone || null,

          profile_photo_url:
            user.profile_photo_url || null,

          plan:
            user.plan || 'free',

          is_active:
            user.is_active !== false,

          online:
            Boolean(isOnline),

          created_at:
            user.created_at,

          last_seen_at:
            user.last_seen_at || null
        };
      });


    // --------------------------------------------------
    // RESPONSE
    // --------------------------------------------------

    res.json({

      success: true,

      stats: {

        total_members:
          totalMembers || 0,

        online_members:
          onlineMembers || 0,

        offline_members:
          offlineMembers || 0,

        free_members:
          freeMembers || 0,

        pro_members:
          proMembers || 0,

        new_today:
          newToday || 0,

        new_this_month:
          newThisMonth || 0,

        installs:
          installs || 0
      },

      members:
        safeMembers

    });

} catch (error) {

    console.error(
      '❌ Admin dashboard error:',
      JSON.stringify(
        error,
        Object.getOwnPropertyNames(error),
        2
      )
    );

    console.error(
      '❌ Admin dashboard error message:',
      error?.message
    );

    console.error(
      '❌ Admin dashboard error code:',
      error?.code
    );

    console.error(
      '❌ Admin dashboard error details:',
      error?.details
    );

    console.error(
      '❌ Admin dashboard error hint:',
      error?.hint
    );

    console.error(
      '❌ Admin dashboard error stack:',
      error?.stack
    );
console.error(
  '❌ Admin dashboard error step:',
  adminStep
);
    res.status(500).json({
      error:
        'Unable to load admin dashboard',

      details:
        error?.message ||
        error?.details ||
        error?.hint ||
        error?.code ||
        'Unknown database error'
    });
  }
});


// ======================================================
// TRACK APP INSTALL
// ======================================================

router.post('/install', async (req, res) => {

  try {

    const {
      install_id,
      platform
    } = req.body;


    if (
      !install_id ||
      typeof install_id !== 'string'
    ) {
      return res.status(400).json({
        error:
          'install_id is required'
      });
    }


    // ----------------------------------------------
    // OPTIONAL USER AUTHENTICATION
    // ----------------------------------------------

    let userId = null;

    const token =
      req.headers.authorization?.split(' ')[1];

    if (token) {

      try {

        const decoded =
          jwt.verify(
            token,
            JWT_SECRET
          );

        userId =
          decoded?.id || null;

      } catch (error) {

        // Install tracking should still work
        // for unauthenticated users.
        userId = null;
      }
    }


    // ----------------------------------------------
    // CHECK EXISTING INSTALL
    // ----------------------------------------------

    const {
      data: existing,
      error: existingError
    } = await supabase
      .from('app_installs')
      .select('id')
      .eq(
        'install_id',
        install_id
      )
      .maybeSingle();


    if (existingError) {
      throw existingError;
    }


    // ----------------------------------------------
    // EXISTING INSTALL
    // ----------------------------------------------

    if (existing) {

      const updateData = {
        last_seen_at:
          new Date().toISOString()
      };

      if (userId) {
        updateData.user_id =
          userId;
      }

      const {
        error: updateError
      } = await supabase
        .from('app_installs')
        .update(updateData)
        .eq(
          'id',
          existing.id
        );

      if (updateError) {
        throw updateError;
      }

      return res.json({
        success: true,
        already_installed: true
      });
    }


    // ----------------------------------------------
    // NEW INSTALL
    // ----------------------------------------------

    const {
      error: insertError
    } = await supabase
      .from('app_installs')
      .insert([{
        install_id,
        user_id: userId,
        first_installed_at:
          new Date().toISOString(),
        last_seen_at:
          new Date().toISOString(),
        user_agent:
          req.headers['user-agent'] || null,
        platform:
          platform || null
      }]);


    if (insertError) {
      throw insertError;
    }


    res.status(201).json({

      success: true,

      already_installed:
        false

    });

  } catch (error) {

    console.error(
      '❌ App install tracking error:',
      error
    );

    res.status(500).json({
      error:
        'Unable to track app install'
    });
  }
});


module.exports = router;
