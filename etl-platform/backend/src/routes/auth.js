const router  = require('express').Router();
const bcrypt  = require('bcryptjs');
const jwt     = require('jsonwebtoken');
const { getAsync, runAsync } = require('../models/database');
const { authenticate } = require('../middleware/auth');

router.post('/login', async (req, res) => {
    try {
        const { email, password } = req.body;
        if (!email || !password) return res.status(400).json({ error: 'Email and password required' });
        const user = await getAsync('SELECT * FROM etl.users WHERE email=? AND status=?', [email, 'active']);
        if (!user) return res.status(401).json({ error: 'Invalid credentials' });
        const ok = await bcrypt.compare(password, user.password_hash);
        if (!ok) return res.status(401).json({ error: 'Invalid credentials' });
        await runAsync('UPDATE etl.users SET last_login=NOW() WHERE id=?', [user.id]);
        const token = jwt.sign(
            { id: user.id, email: user.email, role: user.role, name: user.name },
            process.env.JWT_SECRET || 'dev_secret',
            { expiresIn: process.env.JWT_EXPIRES_IN || '24h' }
        );
        const { password_hash, ...userData } = user;
        res.json({ token, user: userData });
    } catch (e) { res.status(500).json({ error: e.message }); }
});

router.get('/me', authenticate, async (req, res) => {
    const { password_hash, ...user } = req.user;
    res.json(user);
});

router.post('/change-password', authenticate, async (req, res) => {
    try {
        const { current_password, new_password } = req.body;
        const user = await getAsync('SELECT * FROM etl.users WHERE id=?', [req.user.id]);
        const ok = await bcrypt.compare(current_password, user.password_hash);
        if (!ok) return res.status(400).json({ error: 'Current password is incorrect' });
        const hash = await bcrypt.hash(new_password, 12);
        await runAsync('UPDATE etl.users SET password_hash=?, updated_at=NOW() WHERE id=?', [hash, req.user.id]);
        res.json({ message: 'Password updated' });
    } catch (e) { res.status(500).json({ error: e.message }); }
});

module.exports = router;
