const securityLog = require('../services/securityLog');
const express = require('express');
const jwt = require('jsonwebtoken');
const { createClient } = require('@supabase/supabase-js');

const router = express.Router();

const supabase = createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_SERVICE_KEY,
  { global: { fetch: require('../services/security').boundedFetch } }
);

const JWT_SECRET = process.env.JWT_SECRET;


// ================= GET MY NOTIFICATIONS =================

router.get('/', async (req, res) => {
    try {

        const token =
            req.headers.authorization?.split(' ')[1];

        if (!token) {
            return res.status(401).json({
                error: 'No token provided'
            });
        }

        const decoded =
            jwt.verify(token, JWT_SECRET);

        const { data, error } =
            await supabase
                .from('notifications')
                .select('*')
                .eq('user_id', decoded.id)
                .order('created_at', {
                    ascending: false
                });

        if (error) {
            securityLog.error(
                '❌ Notifications fetch error:',
                error
            );

            return res.status(400).json({
                error: 'Request could not be completed'
            });
        }

        res.json(data || []);

    } catch (error) {

        securityLog.error(
            '❌ Notifications error:',
            error
        );

        res.status(500).json({
            error: 'Internal server error'
        });
    }
});

// ================= MARK ALL NOTIFICATIONS AS READ =================

router.put('/read-all', async (req, res) => {
    try {

        const token =
            req.headers.authorization?.split(' ')[1];

        if (!token) {
            return res.status(401).json({
                error: 'No token provided'
            });
        }

        const decoded =
            jwt.verify(token, JWT_SECRET);

        const { error } =
            await supabase
                .from('notifications')
                .update({
                    is_read: true
                })
                .eq('user_id', decoded.id)
                .eq('is_read', false);

        if (error) {
            securityLog.error(
                '❌ Mark notifications read error:',
                error
            );

            return res.status(400).json({
                error: 'Request could not be completed'
            });
        }

        res.json({
            success: true,
            message: 'Notifications marked as read'
        });

    } catch (error) {

        securityLog.error(
            '❌ Mark all notifications error:',
            error
        );

        res.status(500).json({
            error: 'Internal server error'
        });
    }
});
module.exports = router;
