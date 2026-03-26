const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const supabase = require('../db');

const router = express.Router();
const JWT_SECRET = process.env.JWT_SECRET || 'super-secret-nestle-key-2026';

// 🚀 REGISTER ENDPOINT (Use Postman to create your first users)
router.post('/register', async (req, res) => {
    const { email, password, role } = req.body;
    try {
        const salt = await bcrypt.genSalt(10);
        const password_hash = await bcrypt.hash(password, salt);

        const { error } = await supabase.from('app_users').insert([{ email, password_hash, role }]);
        if (error) throw error;

        res.json({ success: true, message: 'User registered successfully' });
    } catch (error) {
        res.status(500).json({ error: 'Registration failed', details: error.message });
    }
});

// 🚀 LOGIN ENDPOINT
router.post('/login', async (req, res) => {
    const { email, password } = req.body;
    try {
        const { data: users, error } = await supabase.from('app_users').select('*').eq('email', email);
        if (error || users.length === 0) return res.status(401).json({ error: 'Invalid credentials' });

        const user = users[0];
        const isMatch = await bcrypt.compare(password, user.password_hash);
        if (!isMatch) return res.status(401).json({ error: 'Invalid credentials' });

        const token = jwt.sign({ id: user.id, role: user.role }, JWT_SECRET, { expiresIn: '1d' });

        res.json({ success: true, token, user: { id: user.id, email: user.email, role: user.role } });
    } catch (error) {
        res.status(500).json({ error: 'Login failed', details: error.message });
    }
});

module.exports = router;