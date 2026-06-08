const router = require('express').Router();
const { v4: uuidv4 } = require('uuid');
const { runAsync, getAsync, allAsync } = require('../models/database');
const { authenticate, requireRole } = require('../middleware/auth');
const { logAudit } = require('../utils/audit');
const { encrypt, decrypt } = require('../utils/encrypt');
const { Pool } = require('pg');

router.get('/', authenticate, async (req, res) => {
    try {
        const { company_id, status } = req.query;
        let query = `
            SELECT i.*, c.trade_name AS company_name, dt.name AS db_target_name,
                   s.cron_expression, s.is_active AS schedule_active,
                   s.last_run, s.next_run, s.last_status AS schedule_last_status
            FROM etl.integrations i
            LEFT JOIN etl.companies c ON c.id = i.company_id
            LEFT JOIN etl.database_targets dt ON dt.id = i.db_target_id
            LEFT JOIN etl.schedules s ON s.integration_id = i.id
            WHERE 1=1`;
        const params = [];
        if (company_id) { query += ' AND i.company_id = ?'; params.push(company_id); }
        if (status)     { query += ' AND i.status = ?';     params.push(status); }
        query += ' ORDER BY i.created_at DESC';
        res.json(await allAsync(query, params));
    } catch (e) { res.status(500).json({ error: e.message }); }
});

router.get('/:id', authenticate, async (req, res) => {
    try {
        const row = await getAsync(`
            SELECT i.*, c.trade_name AS company_name, dt.name AS db_target_name
            FROM etl.integrations i
            LEFT JOIN etl.companies c ON c.id = i.company_id
            LEFT JOIN etl.database_targets dt ON dt.id = i.db_target_id
            WHERE i.id = ?`, [req.params.id]);
        if (!row) return res.status(404).json({ error: 'Integration not found' });
        ['headers','query_params','field_mappings','auth_config'].forEach(f => {
            if (row[f]) try { row[f] = JSON.parse(row[f]); } catch {}
        });
        const schedule = await getAsync('SELECT * FROM etl.schedules WHERE integration_id = ?', [req.params.id]);
        res.json({ ...row, schedule });
    } catch (e) { res.status(500).json({ error: e.message }); }
});

router.post('/', authenticate, requireRole('superadmin','admin','operator'), async (req, res) => {
    try {
        const {
            company_id, name, description, base_url, endpoint, method,
            auth_type, auth_config, headers, query_params, body_template,
            response_format, timeout, db_target_id, target_table,
            field_mappings, root_path, dedup_field, delete_before_insert,
            source_type, sheets_url, file_path, sheet_name
        } = req.body;

        const srcType = source_type || 'api';
        if (!company_id || !name)
            return res.status(400).json({ error: 'company_id and name required' });
        if (srcType === 'api' && !base_url)
            return res.status(400).json({ error: 'base_url required for API integrations' });
        if (srcType === 'sheets' && !sheets_url)
            return res.status(400).json({ error: 'sheets_url required for Google Sheets' });

        const id = uuidv4();
        await runAsync(`
            INSERT INTO etl.integrations
            (id,company_id,name,description,base_url,endpoint,method,auth_type,auth_config,
             headers,query_params,body_template,response_format,timeout,db_target_id,target_table,
             field_mappings,root_path,dedup_field,delete_before_insert,source_type,sheets_url,
             file_path,sheet_name,created_by)
            VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
            [id, company_id, name, description||null, base_url||null, endpoint||'', method||'GET',
             auth_type||'none',
             auth_config    ? JSON.stringify(auth_config)    : null,
             headers        ? JSON.stringify(headers)        : null,
             query_params   ? JSON.stringify(query_params)   : null,
             body_template  || null, response_format||'json', timeout||30000,
             db_target_id||null, target_table||null,
             field_mappings ? JSON.stringify(field_mappings) : null,
             root_path||null, dedup_field||null, delete_before_insert ? true : false,
             srcType, sheets_url||null, file_path||null, sheet_name||null, req.user.id]
        );
        await logAudit({ userId: req.user.id, userEmail: req.user.email, action: 'CREATE_INTEGRATION', resourceType: 'integration', resourceId: id, ip: req.ip });
        res.status(201).json({ id, name });
    } catch (e) { res.status(500).json({ error: e.message }); }
});

router.put('/:id', authenticate, requireRole('superadmin','admin','operator'), async (req, res) => {
    try {
        const f = req.body;
        ['auth_config','headers','query_params','field_mappings'].forEach(k => {
            if (f[k] && typeof f[k] === 'object') f[k] = JSON.stringify(f[k]);
        });
        await runAsync(`
            UPDATE etl.integrations SET
                name=COALESCE(?,name), description=COALESCE(?,description),
                base_url=?, endpoint=COALESCE(?,endpoint), method=COALESCE(?,method),
                auth_type=COALESCE(?,auth_type), auth_config=COALESCE(?,auth_config),
                headers=COALESCE(?,headers), query_params=COALESCE(?,query_params),
                body_template=COALESCE(?,body_template), response_format=COALESCE(?,response_format),
                timeout=COALESCE(?,timeout), status=COALESCE(?,status),
                db_target_id=COALESCE(?,db_target_id), target_table=COALESCE(?,target_table),
                field_mappings=COALESCE(?,field_mappings), root_path=COALESCE(?,root_path),
                dedup_field=COALESCE(?,dedup_field), delete_before_insert=?,
                source_type=COALESCE(?,source_type), sheets_url=?, file_path=?, sheet_name=?,
                updated_at=NOW()
            WHERE id=?`,
            [f.name, f.description, f.base_url||null, f.endpoint, f.method,
             f.auth_type, f.auth_config, f.headers, f.query_params, f.body_template,
             f.response_format, f.timeout, f.status, f.db_target_id, f.target_table,
             f.field_mappings, f.root_path, f.dedup_field,
             f.delete_before_insert ? true : false,
             f.source_type||'api', f.sheets_url||null, f.file_path||null, f.sheet_name||null,
             req.params.id]
        );
        await logAudit({ userId: req.user.id, userEmail: req.user.email, action: 'UPDATE_INTEGRATION', resourceType: 'integration', resourceId: req.params.id, ip: req.ip });
        res.json({ message: 'Integration updated' });
    } catch (e) { res.status(500).json({ error: e.message }); }
});

router.delete('/:id', authenticate, requireRole('superadmin','admin'), async (req, res) => {
    try {
        await runAsync('DELETE FROM etl.integrations WHERE id = ?', [req.params.id]);
        await logAudit({ userId: req.user.id, userEmail: req.user.email, action: 'DELETE_INTEGRATION', resourceType: 'integration', resourceId: req.params.id, ip: req.ip });
        res.json({ message: 'Integration deleted' });
    } catch (e) { res.status(500).json({ error: e.message }); }
});

// ── Database Targets ──────────────────────────────────────────────────────────
router.get('/targets/all', authenticate, async (req, res) => {
    try {
        const { company_id } = req.query;
        let q = 'SELECT id,company_id,name,type,host,port,database_name,username,status,is_linked,linked_from_id FROM etl.database_targets WHERE 1=1';
        const params = [];
        if (company_id) { q += ' AND company_id = ?'; params.push(company_id); }
        q += ' ORDER BY name';
        res.json(await allAsync(q, params));
    } catch (e) { res.status(500).json({ error: e.message }); }
});

router.post('/targets', authenticate, requireRole('superadmin','admin'), async (req, res) => {
    try {
        const { company_id, name, type, host, port, database_name, username, password, options } = req.body;
        if (!company_id || !name || !host || !database_name || !username || !password)
            return res.status(400).json({ error: 'All connection fields required' });
        const id     = uuidv4();
        const encPwd = encrypt(password);
        await runAsync(
            'INSERT INTO etl.database_targets (id,company_id,name,type,host,port,database_name,username,password_encrypted,options) VALUES (?,?,?,?,?,?,?,?,?,?)',
            [id, company_id, name, type||'postgresql', host, port||5432, database_name, username, encPwd, options ? JSON.stringify(options) : null]
        );
        await logAudit({ userId: req.user.id, userEmail: req.user.email, action: 'CREATE_DB_TARGET', resourceType: 'database_target', resourceId: id, ip: req.ip });
        res.status(201).json({ id, name });
    } catch (e) { res.status(500).json({ error: e.message }); }
});

router.put('/targets/:id', authenticate, requireRole('superadmin','admin'), async (req, res) => {
    try {
        const { name, host, port, database_name, username, password } = req.body;
        if (password) {
            const encPwd = encrypt(password);
            await runAsync(
                'UPDATE etl.database_targets SET name=?,host=?,port=?,database_name=?,username=?,password_encrypted=? WHERE id=?',
                [name, host, port, database_name, username, encPwd, req.params.id]
            );
        } else {
            await runAsync(
                'UPDATE etl.database_targets SET name=?,host=?,port=?,database_name=?,username=? WHERE id=?',
                [name, host, port, database_name, username, req.params.id]
            );
        }
        res.json({ message: 'Target updated' });
    } catch (e) { res.status(500).json({ error: e.message }); }
});

router.delete('/targets/:id', authenticate, requireRole('superadmin','admin'), async (req, res) => {
    try {
        await runAsync('DELETE FROM etl.database_targets WHERE id = ?', [req.params.id]);
        res.json({ message: 'Target deleted' });
    } catch (e) { res.status(500).json({ error: e.message }); }
});

router.post('/targets/link', authenticate, requireRole('superadmin','admin'), async (req, res) => {
    try {
        const { company_id, target_id, name } = req.body;
        if (!company_id || !target_id || !name)
            return res.status(400).json({ error: 'company_id, target_id and name required' });
        const original = await getAsync('SELECT * FROM etl.database_targets WHERE id = ?', [target_id]);
        if (!original) return res.status(404).json({ error: 'Banco de origem nao encontrado' });
        const id = uuidv4();
        await runAsync(
            'INSERT INTO etl.database_targets (id,company_id,name,type,host,port,database_name,username,password_encrypted,options,is_linked,linked_from_id) VALUES (?,?,?,?,?,?,?,?,?,?,true,?)',
            [id, company_id, name, original.type, original.host, original.port, original.database_name, original.username, original.password_encrypted, original.options||null, target_id]
        );
        await logAudit({ userId: req.user.id, userEmail: req.user.email, action: 'LINK_DB_TARGET', resourceType: 'database_target', resourceId: id, ip: req.ip });
        res.status(201).json({ id, name });
    } catch (e) { res.status(500).json({ error: e.message }); }
});

router.post('/targets/:id/test', authenticate, async (req, res) => {
    const target = await getAsync('SELECT * FROM etl.database_targets WHERE id = ?', [req.params.id]);
    if (!target) return res.status(404).json({ error: 'Database target not found' });
    const start = Date.now();
    let testPool = null;
    try {
        const password = decrypt(target.password_encrypted);
        testPool = new Pool({
            host: target.host, port: target.port || 5432,
            database: target.database_name, user: target.username, password,
            ssl: { rejectUnauthorized: false },
            connectionTimeoutMillis: 12000,
        });
        const result = await testPool.query(`
            SELECT version() AS server_version,
                   current_database() AS current_database,
                   current_user AS connected_user,
                   NOW() AS server_time,
                   (SELECT COUNT(*) FROM information_schema.tables WHERE table_type='BASE TABLE') AS table_count`);
        const row = result.rows[0];
        res.json({
            success: true, duration_ms: Date.now() - start,
            server_version: 'PostgreSQL',
            full_version: row.server_version,
            current_database: row.current_database,
            connected_user: row.connected_user,
            server_time: row.server_time,
            table_count: parseInt(row.table_count),
        });
    } catch (err) {
        res.json({ success: false, duration_ms: Date.now() - start, error: err.message });
    } finally {
        if (testPool) try { await testPool.end(); } catch {}
    }
});

module.exports = router;
