const router = require('express').Router();
const { v4: uuidv4 } = require('uuid');
const { runAsync, getAsync, allAsync } = require('../models/database');
const { authenticate, requireRole } = require('../middleware/auth');
const { logAudit } = require('../utils/audit');

router.get('/', authenticate, async (req, res) => {
    try {
        const rows = await allAsync(`
            SELECT c.*, COUNT(i.id) AS integration_count
            FROM etl.companies c
            LEFT JOIN etl.integrations i ON i.company_id = c.id
            GROUP BY c.id, c.trade_name, c.legal_name, c.cnpj, c.email, c.phone, c.status, c.notes, c.created_at, c.updated_at
            ORDER BY c.created_at DESC`);
        res.json(rows);
    } catch (e) { res.status(500).json({ error: e.message }); }
});

router.get('/:id', authenticate, async (req, res) => {
    try {
        const row = await getAsync('SELECT * FROM etl.companies WHERE id=?', [req.params.id]);
        if (!row) return res.status(404).json({ error: 'Company not found' });
        res.json(row);
    } catch (e) { res.status(500).json({ error: e.message }); }
});

router.post('/', authenticate, requireRole('superadmin','admin'), async (req, res) => {
    try {
        const { trade_name, legal_name, cnpj, email, phone, notes, status } = req.body;
        if (!trade_name || !legal_name) return res.status(400).json({ error: 'trade_name and legal_name required' });
        const id = uuidv4();
        await runAsync(
            'INSERT INTO etl.companies (id,trade_name,legal_name,cnpj,email,phone,notes,status) VALUES (?,?,?,?,?,?,?,?)',
            [id, trade_name, legal_name, cnpj||null, email||null, phone||null, notes||null, status||'active']
        );
        await logAudit({ userId: req.user.id, userEmail: req.user.email, action: 'CREATE_COMPANY', resourceType: 'company', resourceId: id, ip: req.ip });
        res.status(201).json({ id, trade_name });
    } catch (e) { res.status(500).json({ error: e.message }); }
});

router.put('/:id', authenticate, requireRole('superadmin','admin'), async (req, res) => {
    try {
        const { trade_name, legal_name, cnpj, email, phone, notes, status } = req.body;
        await runAsync(
            'UPDATE etl.companies SET trade_name=COALESCE(?,trade_name), legal_name=COALESCE(?,legal_name), cnpj=COALESCE(?,cnpj), email=COALESCE(?,email), phone=COALESCE(?,phone), notes=COALESCE(?,notes), status=COALESCE(?,status), updated_at=NOW() WHERE id=?',
            [trade_name, legal_name, cnpj, email, phone, notes, status, req.params.id]
        );
        await logAudit({ userId: req.user.id, userEmail: req.user.email, action: 'UPDATE_COMPANY', resourceType: 'company', resourceId: req.params.id, ip: req.ip });
        res.json({ message: 'Company updated' });
    } catch (e) { res.status(500).json({ error: e.message }); }
});

router.delete('/:id', authenticate, requireRole('superadmin','admin'), async (req, res) => {
    try {
        await runAsync('DELETE FROM etl.companies WHERE id=?', [req.params.id]);
        await logAudit({ userId: req.user.id, userEmail: req.user.email, action: 'DELETE_COMPANY', resourceType: 'company', resourceId: req.params.id, ip: req.ip });
        res.json({ message: 'Company deleted' });
    } catch (e) { res.status(500).json({ error: e.message }); }
});

module.exports = router;
