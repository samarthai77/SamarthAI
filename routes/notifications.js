const express = require('express');
const router = express.Router();
const jwt = require('jsonwebtoken');

const supabase = require('../supabaseClient');

const JWT_SECRET = process.env.JWT_SECRET;

// GET MY NOTIFICATIONS
router.get('/', async (req, res) => {
    try {
        const token = req.headers.authorization?.split(' ')[1];

        if (!token) {
            return res.status(401).json({
                error: 'No token provided'
            });
        }

        const decoded = jwt.verify(token, JWT_SECRET);

        const { data, error } = await supabase
            .from('notifications')
            .select('*')
            .eq('user_id', decoded.id)
            .order('created_at', { ascending: false });

        if (error) {
            return res.status(400).json({
                error: error.message
            });
        }

        res.json(data || []);

    } catch (error) {
        console.error('❌ Get notifications error:', error);

        res.status(500).json({
            error: 'Internal server error'
        });
    }
});

module.exports = router;
