const express = require('express');
const jwt = require('jsonwebtoken');
const { createClient } = require('@supabase/supabase-js');

const router = express.Router();

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
);

const JWT_SECRET = process.env.JWT_SECRET || 'samarthai_secret';

// ============ CREATE SOS ============
router.post('/', async (req, res) => {
  try {
    const token = req.headers.authorization?.split(' ')[1];
    if (!token) {
      return res.status(401).json({ error: 'No token provided' });
    }

    const decoded = jwt.verify(token, JWT_SECRET);
    const { location, contacts } = req.body;

    if (!location) {
      return res.status(400).json({ error: 'Location is required' });
    }

    const { data: sos, error } = await supabase
      .from('sos_alerts')
      .insert([{
        user_id: decoded.id,
        location,
        contacts: contacts || [],
        status: 'active'
      }])
      .select()
      .single();

    if (error) {
      return res.status(400).json({ error: error.message });
    }
// Create in-app alerts for other active family members
const { data: membership, error: membershipError } = await supabase
    .from('family_members')
    .select('family_id')
    .eq('user_id', decoded.id)
    .eq('is_active', true)
    .limit(1)
    .maybeSingle();

if (!membershipError && membership?.family_id) {
    const { data: familyMembers, error: membersError } = await supabase
        .from('family_members')
        .select('id, user_id, name')
        .eq('family_id', membership.family_id)
        .eq('is_active', true);

    if (!membersError && Array.isArray(familyMembers)) {
        const alerts = familyMembers
        .filter(member => member.id !== membership.id)  
            .map(member => ({
                member_id: member.id,
                alert_type: 'sos',
                message: `🚨 SOS emergency alert from ${decoded.id}`,
                sos_id: sos.id,
                is_read: false
            }));
console.log('SOS ALERTS TO INSERT:', alerts);
if (alerts.length > 0) {
    const { error: alertError } = await supabase
        .from('alerts')
        .insert(alerts);

    if (alertError) {
        console.error('ALERT INSERT ERROR:', alertError);
    }
}       
    
    res.status(201).json({
      message: 'SOS alert created successfully',
      sos
    });
  } catch (error) {
    console.error('❌ Create SOS error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});
// ============ GET SOS ALERTS ============
router.get('/', async (req, res) => {
  try {
    const token = req.headers.authorization?.split(' ')[1];
    if (!token) {
      return res.status(401).json({ error: 'No token provided' });
    }

    const decoded = jwt.verify(token, JWT_SECRET);

    const { data: sosAlerts, error } = await supabase
      .from('sos_alerts')
      .select('*')
      .eq('user_id', decoded.id)
      .order('created_at', { ascending: false });

    if (error) {
      return res.status(400).json({ error: error.message });
    }

    res.json(sosAlerts);
  } catch (error) {
    console.error('❌ Get SOS error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});
module.exports = router;
