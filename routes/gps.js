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

// Get logged-in user ID from custom JWT
function getUserId(req) {
    try {
        const auth = req.headers.authorization || '';

        if (!auth.startsWith('Bearer ')) {
            return null;
        }

        const token = auth.substring(7);
        const decoded = jwt.verify(token, JWT_SECRET);

        return decoded.id || null;
    } catch (error) {
        console.error('GPS auth error:', error.message);
        return null;
    }
}


// =====================================================
// GET /api/gps
// Basic GPS status
// =====================================================
router.get('/', (req, res) => {
    res.json({
        success: true,
        message: 'GPS tracking service is active'
    });
});


// =====================================================
// PUT /api/gps/location
// Save current user's GPS location
// =====================================================
router.put('/location', async (req, res) => {
    try {
        const userId = getUserId(req);

        if (!userId) {
            return res.status(401).json({
                success: false,
                error: 'Unauthorized'
            });
        }

        const {
            latitude,
            longitude,
            location
        } = req.body || {};

        // Accept either a ready-made location string
        // or latitude/longitude values.
        let locationText = location;

        if (
            !locationText &&
            latitude !== undefined &&
            longitude !== undefined
        ) {
            locationText = `${latitude}, ${longitude}`;
        }

        if (!locationText) {
            return res.status(400).json({
                success: false,
                error: 'Location data is required'
            });
        }

        // Find the logged-in user's active family membership
        const { data: member, error: memberError } = await supabase
            .from('family_members')
            .select('id, family_id, user_id, name')
            .eq('user_id', userId)
            .eq('is_active', true)
            .limit(1)
            .maybeSingle();

        if (memberError) {
            console.error('GPS member lookup error:', memberError);

            return res.status(500).json({
                success: false,
                error: 'Could not find family member'
            });
        }

        if (!member) {
            return res.status(404).json({
                success: false,
                error: 'You are not an active family member'
            });
        }

        // Update location
        const { data: updatedMember, error: updateError } = await supabase
            .from('family_members')
            .update({
                location: String(locationText),
                last_updated: new Date().toISOString()
            })
            .eq('id', member.id)
            .select('id, family_id, user_id, name, location, last_updated')
            .single();

        if (updateError) {
            console.error('GPS location update error:', updateError);

            return res.status(500).json({
                success: false,
                error: 'Could not update location'
            });
        }

        return res.json({
            success: true,
            message: 'Location updated successfully',
            member: updatedMember
        });

    } catch (error) {
        console.error('GPS location error:', error);

        return res.status(500).json({
            success: false,
            error: 'GPS service failed'
        });
    }
});


// =====================================================
// GET /api/gps/:memberId
// Get GPS location of a family member
// =====================================================
router.get('/:memberId', async (req, res) => {
    try {
        const userId = getUserId(req);

        if (!userId) {
            return res.status(401).json({
                success: false,
                error: 'Unauthorized'
            });
        }

        const memberId = req.params.memberId;

        // Find current user's family
        const { data: currentMember, error: currentError } =
            await supabase
                .from('family_members')
                .select('family_id')
                .eq('user_id', userId)
                .eq('is_active', true)
                .limit(1)
                .maybeSingle();

        if (currentError || !currentMember) {
            return res.status(404).json({
                success: false,
                error: 'Your family membership was not found'
            });
        }

        // Only allow members of the same family
        const { data: member, error: memberError } =
            await supabase
                .from('family_members')
                .select('id, family_id, name, location, last_updated')
                .eq('id', memberId)
                .eq('family_id', currentMember.family_id)
                .eq('is_active', true)
                .maybeSingle();

        if (memberError) {
            console.error('GPS family member error:', memberError);

            return res.status(500).json({
                success: false,
                error: 'Could not load family member location'
            });
        }

        if (!member) {
            return res.status(404).json({
                success: false,
                error: 'Family member not found'
            });
        }

        return res.json({
            success: true,
            member
        });

    } catch (error) {
        console.error('GPS member location error:', error);

        return res.status(500).json({
            success: false,
            error: 'Family GPS service failed'
        });
    }
});


// =====================================================
// POST /api/gps/:memberId/sos
// Existing GPS-linked SOS route
// =====================================================
router.post('/:memberId/sos', async (req, res) => {
    try {
        const userId = getUserId(req);

        if (!userId) {
            return res.status(401).json({
                success: false,
                error: 'Unauthorized'
            });
        }

        const memberId = req.params.memberId;

        // Verify current user's family
        const { data: currentMember, error: currentError } =
            await supabase
                .from('family_members')
                .select('family_id')
                .eq('user_id', userId)
                .eq('is_active', true)
                .limit(1)
                .maybeSingle();

        if (currentError || !currentMember) {
            return res.status(404).json({
                success: false,
                error: 'Your family membership was not found'
            });
        }

        // Verify target member belongs to same family
        const { data: targetMember, error: targetError } =
            await supabase
                .from('family_members')
                .select('id, family_id, name, user_id, location')
                .eq('id', memberId)
                .eq('family_id', currentMember.family_id)
                .eq('is_active', true)
                .maybeSingle();

        if (targetError || !targetMember) {
            return res.status(404).json({
                success: false,
                error: 'Family member not found'
            });
        }

        const { data: alert, error: sosError } =
            await supabase
                .from('sos_alerts')
                .insert({
                    user_id: targetMember.user_id || userId,
                    location: targetMember.location || 'Location unavailable',
                    status: 'active'
                })
                .select()
                .single();

        if (sosError) {
            console.error('GPS SOS error:', sosError);

            return res.status(500).json({
                success: false,
                error: 'Could not create SOS alert'
            });
        }

        return res.status(201).json({
            success: true,
            message: `SOS alert triggered for ${targetMember.name}`,
            alert
        });

    } catch (error) {
        console.error('GPS SOS service error:', error);

        return res.status(500).json({
            success: false,
            error: 'SOS service failed'
        });
    }
});


module.exports = router;
