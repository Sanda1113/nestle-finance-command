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
        const normalizedEmail = typeof email === 'string' ? email.trim().toLowerCase() : '';
        const normalizedRole = typeof role === 'string' ? role.trim().toLowerCase() : '';
        const normalizedPassword = typeof password === 'string' ? password : '';
        if (!normalizedEmail || !normalizedPassword || !normalizedRole) {
            return res.status(400).json({ error: 'Email, password, and role are required' });
        }

        const salt = await bcrypt.genSalt(10);
        const password_hash = await bcrypt.hash(normalizedPassword, salt);

        const { error } = await supabase.from('app_users').insert([{ email: normalizedEmail, password_hash, role: normalizedRole }]);
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
        const normalizedEmail = typeof email === 'string' ? email.trim().toLowerCase() : '';
        const normalizedPassword = typeof password === 'string' ? password : '';
        if (!normalizedEmail || !normalizedPassword) {
            return res.status(400).json({ error: 'Email and password are required' });
        }

        let { data: users, error } = await supabase.from('app_users').select('*').eq('email', normalizedEmail);
        if (error) throw error;

        if (!users || users.length === 0) {
            const { data: caseInsensitiveUsers, error: caseInsensitiveError } = await supabase
                .from('app_users')
                .select('*')
                .ilike('email', normalizedEmail);
            if (caseInsensitiveError) throw caseInsensitiveError;
            users = caseInsensitiveUsers || [];
        }

        if (users.length === 0) return res.status(401).json({ error: 'Invalid credentials' });

        let user = null;
        for (const candidate of users) {
            if (!candidate?.password_hash) continue;
            const isMatch = await bcrypt.compare(normalizedPassword, candidate.password_hash);
            if (isMatch) {
                user = candidate;
                break;
            }
        }
        if (!user) return res.status(401).json({ error: 'Invalid credentials' });

        const token = jwt.sign({ id: user.id, role: user.role }, JWT_SECRET, { expiresIn: '1d' });

        res.json({ success: true, token, user: { id: user.id, email: user.email, role: user.role } });
    } catch (error) {
        res.status(500).json({ error: 'Login failed', details: error.message });
    }
});

module.exports = router;
