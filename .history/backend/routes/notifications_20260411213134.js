const express = require('express');
const supabase = require('../db');
const router = express.Router();

// Get notifications for a user (by email or role)
router.get('/', async (req, res) => {
    const { email, role } = req.query;
    try {
        let query = supabase.from('notifications').select('*');
        if (email) query = query.eq('user_email', email);
        if (role) query = query.eq('user_role', role);

        const { data, error } = await query.order('created_at', { ascending: false });
        if (error) throw error;
        res.json({ success: true, notifications: data });
    } catch (err) {
        res.status(500).json({ error: 'Failed to fetch notifications' });
    }
});

// Mark notifications as read
router.post('/mark-read', async (req, res) => {
    const { ids } = req.body;
    try {
        await supabase.from('notifications').update({ is_read: true }).in('id', ids);
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ error: 'Failed to update' });
    }
});

// Internal helper to create a notification (used by other routes)
const createNotification = async ({ user_email, user_role, title, message, link }) => {
    try {
        await supabase.from('notifications').insert([{ user_email, user_role, title, message, link }]);
    } catch (err) {
        console.error('Failed to create notification:', err);
    }
};

module.exports = { router, createNotification };