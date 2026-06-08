const router = require('express').Router();
const { getAsync, allAsync } = require('../models/database');
const { authenticate } = require('../middleware/auth');

router.get('/stats', authenticate, async (req, res) => {
    try {
        const [coRow, intRow, errRow, todayRow, recRow, todayOk] = await Promise.all([
            getAsync("SELECT COUNT(*) AS total FROM etl.companies WHERE status='active'"),
            getAsync("SELECT COUNT(*) AS total FROM etl.integrations WHERE status='active'"),
            getAsync("SELECT COUNT(*) AS total FROM etl.execution_logs WHERE status='error' AND started_at >= NOW() - INTERVAL '24 hours'"),
            getAsync("SELECT COUNT(*) AS total FROM etl.execution_logs WHERE started_at::date = CURRENT_DATE"),
            getAsync("SELECT COALESCE(SUM(records_inserted),0)+COALESCE(SUM(records_updated),0) AS total FROM etl.execution_logs WHERE started_at::date=CURRENT_DATE AND status='success'"),
            getAsync("SELECT COUNT(*) AS total FROM etl.execution_logs WHERE status='success' AND started_at::date=CURRENT_DATE"),
        ]);
        const recentLogs = await allAsync(`
            SELECT l.id,l.status,l.started_at,l.duration_ms,l.records_inserted,l.records_updated,l.error_message,
                   i.name AS integration_name, c.trade_name AS company_name
            FROM etl.execution_logs l
            LEFT JOIN etl.integrations i ON i.id = l.integration_id
            LEFT JOIN etl.companies c ON c.id = l.company_id
            ORDER BY l.started_at DESC LIMIT 10`);
        const upcomingSchedules = await allAsync(`
            SELECT s.cron_expression,s.last_run,s.run_count,
                   i.name AS integration_name, c.trade_name AS company_name
            FROM etl.schedules s
            JOIN etl.integrations i ON i.id = s.integration_id
            LEFT JOIN etl.companies c ON c.id = i.company_id
            WHERE s.is_active=true ORDER BY s.last_run ASC LIMIT 5`);
        res.json({
            active_companies:    parseInt(coRow?.total||0),
            active_integrations: parseInt(intRow?.total||0),
            errors_24h:          parseInt(errRow?.total||0),
            executions_today:    parseInt(todayRow?.total||0),
            success_today:       parseInt(todayOk?.total||0),
            records_today:       parseInt(recRow?.total||0),
            recent_logs:         recentLogs,
            upcoming_schedules:  upcomingSchedules,
        });
    } catch (e) { res.status(500).json({ error: e.message }); }
});

module.exports = router;
