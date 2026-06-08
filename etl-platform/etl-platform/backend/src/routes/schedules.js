const router = require('express').Router();
const { v4: uuidv4 } = require('uuid');
const { runAsync, getAsync, allAsync } = require('../models/database');
const { authenticate, requireRole } = require('../middleware/auth');
const { scheduleTask, stopTask } = require('../scheduler/cronManager');

router.get('/', authenticate, async (req, res) => {
    try {
        const rows = await allAsync(`
            SELECT s.*, i.name AS integration_name, i.company_id, c.trade_name AS company_name
            FROM etl.schedules s
            JOIN etl.integrations i ON i.id = s.integration_id
            LEFT JOIN etl.companies c ON c.id = i.company_id
            ORDER BY s.created_at DESC`);
        res.json(rows);
    } catch (e) { res.status(500).json({ error: e.message }); }
});

router.post('/', authenticate, requireRole('superadmin','admin','operator'), async (req, res) => {
    try {
        const { integration_id, cron_expression } = req.body;
        if (!integration_id || !cron_expression)
            return res.status(400).json({ error: 'integration_id and cron_expression required' });
        const existing = await getAsync('SELECT id FROM etl.schedules WHERE integration_id=?', [integration_id]);
        let scheduleId;
        if (existing) {
            await runAsync('UPDATE etl.schedules SET cron_expression=?, is_active=true, updated_at=NOW() WHERE integration_id=?', [cron_expression, integration_id]);
            scheduleId = existing.id;
            res.json({ id: scheduleId, message: 'Schedule updated' });
        } else {
            scheduleId = uuidv4();
            await runAsync('INSERT INTO etl.schedules (id,integration_id,cron_expression,is_active) VALUES (?,?,?,true)', [scheduleId, integration_id, cron_expression]);
            res.status(201).json({ id: scheduleId });
        }
        scheduleTask({ id: scheduleId, integration_id, cron_expression });
    } catch (e) { res.status(500).json({ error: e.message }); }
});

router.put('/:id', authenticate, requireRole('superadmin','admin','operator'), async (req, res) => {
    try {
        const { cron_expression, is_active } = req.body;
        await runAsync('UPDATE etl.schedules SET cron_expression=COALESCE(?,cron_expression), is_active=COALESCE(?,is_active), updated_at=NOW() WHERE id=?',
            [cron_expression||null, is_active!=null ? is_active : null, req.params.id]);
        const updated = await getAsync('SELECT * FROM etl.schedules WHERE id=?', [req.params.id]);
        if (updated) {
            if (updated.is_active) scheduleTask(updated);
            else stopTask(updated.id);
        }
        res.json({ message: 'Schedule updated' });
    } catch (e) { res.status(500).json({ error: e.message }); }
});

router.patch('/:id/toggle', authenticate, requireRole('superadmin','admin','operator'), async (req, res) => {
    try {
        await runAsync('UPDATE etl.schedules SET is_active = NOT is_active, updated_at=NOW() WHERE id=?', [req.params.id]);
        const updated = await getAsync('SELECT * FROM etl.schedules WHERE id=?', [req.params.id]);
        if (updated?.is_active) scheduleTask(updated);
        else stopTask(req.params.id);
        res.json({ is_active: updated?.is_active });
    } catch (e) { res.status(500).json({ error: e.message }); }
});

router.delete('/:id', authenticate, requireRole('superadmin','admin'), async (req, res) => {
    try {
        stopTask(req.params.id);
        await runAsync('DELETE FROM etl.schedules WHERE id=?', [req.params.id]);
        res.json({ message: 'Schedule deleted' });
    } catch (e) { res.status(500).json({ error: e.message }); }
});

module.exports = router;
