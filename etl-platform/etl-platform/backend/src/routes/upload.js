const router  = require('express').Router();
const multer  = require('multer');
const path    = require('path');
const fs      = require('fs');
const os      = require('os');
const { Pool } = require('pg');
const { authenticate, requireRole } = require('../middleware/auth');
const { runAsync, getAsync }        = require('../models/database');
const { logAudit }                  = require('../utils/audit');
const { v4: uuidv4 }               = require('uuid');
const crypto                        = require('crypto');
const { decrypt }                   = require('../utils/encrypt');

const upload = multer({
    storage: multer.diskStorage({
        destination: (req, file, cb) => cb(null, os.tmpdir()),
        filename:    (req, file, cb) => cb(null, 'etl_' + Date.now() + path.extname(file.originalname)),
    }),
    limits: { fileSize: 50 * 1024 * 1024 },
    fileFilter: (req, file, cb) => {
        const allowed = ['.xlsx', '.xls', '.csv'];
        const ext = path.extname(file.originalname).toLowerCase();
        allowed.includes(ext) ? cb(null, true) : cb(new Error('Tipo nao suportado: ' + ext));
    },
});

async function readFile(filePath, originalName, sheetName) {
    const ext = path.extname(originalName).toLowerCase();
    if (ext === '.csv') {
        return parseCsv(fs.readFileSync(filePath, 'utf8'));
    }
    const XLSX = require('xlsx');
    const wb   = XLSX.readFile(filePath, { cellDates: true });
    const ws   = sheetName ? (wb.Sheets[sheetName] || wb.Sheets[wb.SheetNames[0]]) : wb.Sheets[wb.SheetNames[0]];
    return XLSX.utils.sheet_to_json(ws, { defval: null, raw: false });
}

function parseCsv(content) {
    const lines = content.replace(/\r\n/g,'\n').replace(/\r/g,'\n').split('\n').filter(l=>l.trim());
    if (lines.length < 2) return [];
    const delim = (lines[0].match(/;/g)||[]).length > (lines[0].match(/,/g)||[]).length ? ';' : ',';
    const headers = parseLine(lines[0], delim);
    return lines.slice(1).map(line => {
        const vals = parseLine(line, delim);
        const obj = {};
        headers.forEach((h,i) => { obj[h.trim()] = vals[i]!=null ? vals[i].trim() : null; });
        return obj;
    }).filter(r => Object.values(r).some(v => v!=null && v!==''));
}

function parseLine(line, delim) {
    const result=[]; let cur='', inQ=false;
    for(let i=0;i<line.length;i++){
        const ch=line[i];
        if(ch==='"'){if(inQ&&line[i+1]==='"'){cur+='"';i++;}else inQ=!inQ;}
        else if(ch===delim&&!inQ){result.push(cur);cur='';}
        else cur+=ch;
    }
    result.push(cur);
    return result;
}

// ── Preview ───────────────────────────────────────────────────────────────────
router.post('/preview', authenticate, upload.single('file'), async (req, res) => {
    try {
        if (!req.file) return res.status(400).json({ error: 'Nenhum arquivo enviado' });
        const records = await readFile(req.file.path, req.file.originalname, req.body.sheet_name || null);
        fs.unlinkSync(req.file.path);
        const fields = records.length > 0 ? [...new Set(records.flatMap(r => Object.keys(r)))] : [];
        res.json({ success: true, total: records.length, fields, preview: records.slice(0, 5) });
    } catch (e) {
        if (req.file?.path && fs.existsSync(req.file.path)) fs.unlinkSync(req.file.path);
        res.status(500).json({ error: e.message });
    }
});

// ── Run em background ─────────────────────────────────────────────────────────
router.post('/run', authenticate, requireRole('superadmin','admin','operator'),
    upload.single('file'), async (req, res) => {
        let tmpFile = req.file?.path;
        try {
            if (!req.file)           return res.status(400).json({ error: 'Nenhum arquivo enviado' });
            const { integration_id } = req.body;
            if (!integration_id)     return res.status(400).json({ error: 'integration_id obrigatorio' });

            const integration = await getAsync('SELECT * FROM etl.integrations WHERE id=?', [integration_id]);
            if (!integration)        return res.status(404).json({ error: 'Integracao nao encontrada' });
            if (!integration.db_target_id || !integration.target_table)
                return res.status(400).json({ error: 'Banco de dados e tabela destino nao configurados' });

            const records = await readFile(req.file.path, req.file.originalname, integration.sheet_name || null);
            fs.unlinkSync(req.file.path); tmpFile = null;

            if (records.length === 0) return res.status(400).json({ error: 'Arquivo sem registros validos' });

            const batchId   = uuidv4();
            const logId     = uuidv4();
            const companyId = integration.company_id;
            const origem    = path.extname(req.file.originalname).toLowerCase() === '.csv' ? 'csv' : 'excel';
            const startedAt = new Date().toISOString();
            const fileName  = req.file.originalname;

            await runAsync(
                'INSERT INTO etl.execution_logs (id,integration_id,company_id,batch_id,status,trigger_type,triggered_by,started_at,records_fetched) VALUES (?,?,?,?,?,?,?,?,?)',
                [logId, integration_id, companyId, batchId, 'running', 'manual', req.user.id, startedAt, records.length]
            );

            res.json({
                success: true, running: true, log_id: logId, batch_id: batchId,
                records_fetched: records.length,
                message: 'Processando ' + records.length.toLocaleString('pt-BR') + ' registros em segundo plano...',
            });

            setImmediate(async () => {
                let targetPool;
                try {
                    let processedRecords = records;
                    if (integration.field_mappings) {
                        try {
                            const mappings = JSON.parse(integration.field_mappings);
                            if (Array.isArray(mappings) && mappings.length > 0) {
                                processedRecords = records.map(r => {
                                    const mapped = {};
                                    mappings.forEach(m => { if(m.source&&m.target) mapped[m.target]=r[m.source]; });
                                    return Object.keys(mapped).length > 0 ? mapped : r;
                                });
                            }
                        } catch {}
                    }

                    const dbTarget = await getAsync('SELECT * FROM etl.database_targets WHERE id=?', [integration.db_target_id]);
                    const password = decrypt(dbTarget.password_encrypted);
                    targetPool = new Pool({
                        host: dbTarget.host, port: dbTarget.port || 5432,
                        database: dbTarget.database_name, user: dbTarget.username, password,
                        ssl: { rejectUnauthorized: false },
                        connectionTimeoutMillis: 20000, query_timeout: 300000,
                    });

                    // Garante schema/tabela
                    const { schema, table } = parseTableName(integration.target_table);
                    await targetPool.query('CREATE SCHEMA IF NOT EXISTS "' + schema + '"');
                    const ex = await targetPool.query(
                        'SELECT COUNT(*) AS cnt FROM information_schema.tables WHERE table_schema=$1 AND table_name=$2',
                        [schema, table]
                    );
                    const allFieldNames = [...new Set(processedRecords.flatMap(r => Object.keys(r)))];
                    if (parseInt(ex.rows[0].cnt) === 0) {
                        const cols = allFieldNames.map(k => '"' + k.replace(/[^\w]/g,'_') + '" TEXT').join(', ');
                        const meta = '"_etl_id_empresa" VARCHAR(36),"_etl_id_integracao" VARCHAR(36),"_etl_batch_id" VARCHAR(36),"_etl_data_execucao" TIMESTAMPTZ,"_etl_data_insercao" TIMESTAMPTZ DEFAULT NOW(),"_etl_data_update" TIMESTAMPTZ,"_etl_hash" VARCHAR(32),"_etl_origem" VARCHAR(50)';
                        await targetPool.query('CREATE TABLE "' + schema + '"."' + table + '" (' + cols + ',' + meta + ')');
                    }

                    const now = new Date().toISOString();
                    if (integration.delete_before_insert === true || integration.delete_before_insert === 't') {
                        await targetPool.query('DELETE FROM "' + schema + '"."' + table + '" WHERE "_etl_id_empresa"=$1', [String(companyId)]);
                    }

                    const metaRecords = processedRecords.map(record => {
                        const hash = crypto.createHash('md5').update(JSON.stringify(record)).digest('hex');
                        const sanitized = {};
                        Object.entries(record).forEach(([k,v]) => { sanitized[k.replace(/[^\w]/g,'_')] = v!=null ? String(v) : null; });
                        return { ...sanitized, _etl_id_empresa: String(companyId), _etl_id_integracao: integration_id,
                            _etl_batch_id: batchId, _etl_data_execucao: now, _etl_hash: hash, _etl_origem: origem };
                    });

                    const allCols = [...new Set(metaRecords.flatMap(r => Object.keys(r)))];
                    const BATCH = 500;
                    let inserted = 0;
                    for (let i = 0; i < metaRecords.length; i += BATCH) {
                        const chunk = metaRecords.slice(i, i + BATCH);
                        const colNames = allCols.map(c => '"' + c + '"').join(',');
                        const rows = chunk.map((row, ri) => '(' + allCols.map((_,ci) => '$' + (ri*allCols.length+ci+1)).join(',') + ')').join(',');
                        const params = chunk.flatMap(row => allCols.map(col => row[col] ?? null));
                        const r = await targetPool.query('INSERT INTO "' + schema + '"."' + table + '" (' + colNames + ') VALUES ' + rows, params);
                        inserted += r.rowCount || chunk.length;
                    }

                    const finishedAt = new Date().toISOString();
                    const duration   = new Date(finishedAt) - new Date(startedAt);
                    await runAsync(
                        'UPDATE etl.execution_logs SET status=?,finished_at=?,duration_ms=?,records_inserted=?,raw_response=? WHERE id=?',
                        ['success', finishedAt, duration, inserted, 'Upload: ' + fileName + ' (' + records.length + ' linhas)', logId]
                    );
                    console.log('Upload concluido: ' + inserted + ' inseridos');
                } catch (e) {
                    console.error('Upload error:', e.message);
                    const fin = new Date().toISOString();
                    await runAsync('UPDATE etl.execution_logs SET status=?,finished_at=?,error_message=? WHERE id=?',
                        ['error', fin, e.message, logId]).catch(()=>{});
                } finally {
                    if (targetPool) try { await targetPool.end(); } catch {}
                }
            });
        } catch (e) {
            if (tmpFile && fs.existsSync(tmpFile)) fs.unlinkSync(tmpFile);
            res.status(500).json({ error: e.message });
        }
    }
);

function parseTableName(raw) {
    if (!raw) return { schema: 'public', table: 'etl_data' };
    const clean = raw.replace(/"/g, '');
    const parts = clean.split('.');
    return parts.length >= 2 ? { schema: parts[0], table: parts[1] } : { schema: 'public', table: parts[0] };
}

module.exports = router;
