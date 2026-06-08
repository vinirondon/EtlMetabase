const router = require('express').Router();
const bcrypt = require('bcryptjs');
const { v4: uuidv4 } = require('uuid');
const { runAsync, getAsync, allAsync } = require('../models/database');
const { authenticate, requireRole } = require('../middleware/auth');

router.get('/', authenticate, requireRole('superadmin','admin'), async (req, res) => {
    try {
        const rows = await allAsync('SELECT id,name,email,role,status,last_login,created_at FROM etl.users ORDER BY created_at DESC');
        res.json(rows);
    } catch (e) { res.status(500).json({ error: e.message }); }
});

router.post('/', authenticate, requireRole('superadmin','admin'), async (req, res) => {
    try {
        const { name, email, password, role } = req.body;
        if (!name || !email || !password) return res.status(400).json({ error: 'name, email and password required' });
        const exists = await getAsync('SELECT id FROM etl.users WHERE email=?', [email]);
        if (exists) return res.status(400).json({ error: 'Email already in use' });
        const hash = await bcrypt.hash(password, 12);
        const id   = uuidv4();
        await runAsync('INSERT INTO etl.users (id,name,email,password_hash,role) VALUES (?,?,?,?,?)',
            [id, name, email, hash, role||'operator']);
        res.status(201).json({ id, name, email });
    } catch (e) { res.status(500).json({ error: e.message }); }
});

router.put('/:id', authenticate, requireRole('superadmin','admin'), async (req, res) => {
    try {
        const { name, email, role, status, password } = req.body;
        if (password) {
            const hash = await bcrypt.hash(password, 12);
            await runAsync('UPDATE etl.users SET name=COALESCE(?,name), email=COALESCE(?,email), role=COALESCE(?,role), status=COALESCE(?,status), password_hash=?, updated_at=NOW() WHERE id=?',
                [name, email, role, status, hash, req.params.id]);
        } else {
            await runAsync('UPDATE etl.users SET name=COALESCE(?,name), email=COALESCE(?,email), role=COALESCE(?,role), status=COALESCE(?,status), updated_at=NOW() WHERE id=?',
                [name, email, role, status, req.params.id]);
        }
        res.json({ message: 'User updated' });
    } catch (e) { res.status(500).json({ error: e.message }); }
});

router.delete('/:id', authenticate, requireRole('superadmin'), async (req, res) => {
    try {
        if (req.params.id === req.user.id) return res.status(400).json({ error: 'Cannot delete yourself' });
        await runAsync('DELETE FROM etl.users WHERE id=?', [req.params.id]);
        res.json({ message: 'User deleted' });
    } catch (e) { res.status(500).json({ error: e.message }); }
});

module.exports = router;
