/**
 * Integration Runner — PostgreSQL version
 * source_type: 'api' | 'excel' | 'csv' | 'sheets'
 */
const axios   = require('axios');
const xml2js  = require('xml2js');
const crypto  = require('crypto');
const https   = require('https');
const fs      = require('fs');
const path    = require('path');
const { Pool } = require('pg');
const { v4: uuidv4 } = require('uuid');
const { getAsync, allAsync, runAsync } = require('../models/database');
const { decrypt } = require('../utils/encrypt');

const UPLOAD_DIR = path.join(__dirname, '../../data/uploads');

// ── XML helper ────────────────────────────────────────────────────────────────
function parseXml(xmlString) {
    return new Promise((resolve, reject) =>
        xml2js.parseString(xmlString, { explicitArray: false, mergeAttrs: true },
            (err, r) => err ? reject(err) : resolve(r))
    );
}

// ── Records extraction ────────────────────────────────────────────────────────
function extractRecords(data, rootPath) {
    if (!rootPath) {
        if (Array.isArray(data)) return data;
        if (data && typeof data === 'object') {
            for (const val of Object.values(data)) {
                if (Array.isArray(val)) return val;
            }
            return [data];
        }
        return [];
    }
    let current = data;
    for (const part of rootPath.split('.')) {
        if (current == null) return [];
        current = current[part];
    }
    return Array.isArray(current) ? current : (current != null ? [current] : []);
}

// ── Excel reader ──────────────────────────────────────────────────────────────
async function readExcel(filePath, sheetName) {
    const XLSX = require('xlsx');
    const wb = XLSX.readFile(filePath, { cellDates: true });
    const ws = sheetName
        ? (wb.Sheets[sheetName] || wb.Sheets[wb.SheetNames[0]])
        : wb.Sheets[wb.SheetNames[0]];
    return XLSX.utils.sheet_to_json(ws, { defval: null, raw: false });
}

// ── CSV reader ────────────────────────────────────────────────────────────────
function parseCsvContent(content) {
    const lines = content.replace(/\r\n/g, '\n').replace(/\r/g, '\n').split('\n').filter(l => l.trim());
    if (lines.length < 2) return [];
    const delim = (lines[0].match(/;/g)||[]).length > (lines[0].match(/,/g)||[]).length ? ';' : ',';
    const headers = parseCsvLine(lines[0], delim);
    return lines.slice(1).map(line => {
        const vals = parseCsvLine(line, delim);
        const obj = {};
        headers.forEach((h, i) => { obj[h.trim()] = vals[i] != null ? vals[i].trim() : null; });
        return obj;
    }).filter(r => Object.values(r).some(v => v != null && v !== ''));
}

function parseCsvLine(line, delim) {
    const result = []; let cur = '', inQ = false;
    for (let i = 0; i < line.length; i++) {
        const ch = line[i];
        if (ch === '"') { if (inQ && line[i+1] === '"') { cur += '"'; i++; } else inQ = !inQ; }
        else if (ch === delim && !inQ) { result.push(cur); cur = ''; }
        else cur += ch;
    }
    result.push(cur);
    return result;
}

async function readCsv(filePath) {
    return parseCsvContent(fs.readFileSync(filePath, 'utf8'));
}

// ── Google Sheets reader ──────────────────────────────────────────────────────
async function readGoogleSheets(sheetsUrl) {
    let exportUrl = sheetsUrl;
    const matchId = sheetsUrl.match(/\/spreadsheets\/d\/([a-zA-Z0-9_-]+)/);
    if (matchId) {
        const gidMatch = sheetsUrl.match(/[?&#]gid=(\d+)/);
        exportUrl = `https://docs.google.com/spreadsheets/d/${matchId[1]}/export?format=csv&gid=${gidMatch?.[1] || '0'}`;
    }
    const response = await axios.get(exportUrl, {
        timeout: 30000, responseType: 'text',
        httpsAgent: new https.Agent({ rejectUnauthorized: false }),
    });
    return parseCsvContent(response.data);
}

// ── Auth headers ──────────────────────────────────────────────────────────────
function buildAuthHeaders(authType, authConfig) {
    if (!authType || authType === 'none') return {};
    try {
        const cfg = typeof authConfig === 'string' ? JSON.parse(authConfig) : (authConfig || {});
        if (authType === 'bearer' && cfg.token) return { Authorization: `Bearer ${cfg.token}` };
        if (authType === 'basic' && cfg.username)
            return { Authorization: `Basic ${Buffer.from(`${cfg.username}:${cfg.password||''}`).toString('base64')}` };
        if (authType === 'apikey' && cfg.api_key) return { [cfg.header_name || 'X-API-Key']: cfg.api_key };
    } catch {}
    return {};
}

// ── Open target PostgreSQL pool ───────────────────────────────────────────────
async function openTargetPool(target) {
    const password = decrypt(target.password_encrypted);
    const pool = new Pool({
        host:     target.host,
        port:     target.port || 5432,
        database: target.database_name,
        user:     target.username,
        password,
        ssl: (() => {
            try {
                const opts = target.options ? JSON.parse(target.options) : {};
                if (opts.ssl === false) return false;
                if (opts.ssl === true) return { rejectUnauthorized: false };
                return false; // padrão: sem SSL
            } catch { return false; }
        })(),
        connectionTimeoutMillis: 20000,
        query_timeout: 300000,
    });
    await pool.query('SELECT 1'); // valida conexão
    return pool;
}

// ── Parse table name ──────────────────────────────────────────────────────────
function parseTableName(raw) {
    if (!raw) return { schema: 'public', table: 'etl_data' };
    const clean = raw.replace(/"/g, '');
    const parts = clean.split('.');
    if (parts.length >= 2) return { schema: parts[0], table: parts[1] };
    return { schema: 'public', table: parts[0] };
}

// ── Ensure table exists ───────────────────────────────────────────────────────
async function ensureTable(pool, tableName, allRecords) {
    const { schema, table } = parseTableName(tableName);
    const allFieldNames = [...new Set(
        allRecords.flatMap(r => r && typeof r === 'object' ? Object.keys(r) : [])
    )];

    // Cria schema se não existir
    await pool.query(`CREATE SCHEMA IF NOT EXISTS "${schema}"`);

    // Verifica se tabela existe
    const exists = await pool.query(
        `SELECT COUNT(*) AS cnt FROM information_schema.tables WHERE table_schema=$1 AND table_name=$2`,
        [schema, table]
    );

    if (parseInt(exists.rows[0].cnt) > 0) {
        await addMissingColumns(pool, schema, table, allFieldNames);
        return;
    }

    // Cria tabela
    const cols = allFieldNames.map(k => `"${k.replace(/[^\w]/g, '_')}" TEXT`).join(', ');
    const metaCols = [
        `"_etl_id_empresa" VARCHAR(36)`,
        `"_etl_id_integracao" VARCHAR(36)`,
        `"_etl_batch_id" VARCHAR(36)`,
        `"_etl_data_execucao" TIMESTAMPTZ`,
        `"_etl_data_insercao" TIMESTAMPTZ DEFAULT NOW()`,
        `"_etl_data_update" TIMESTAMPTZ`,
        `"_etl_hash" VARCHAR(32)`,
        `"_etl_origem" VARCHAR(50)`,
    ].join(', ');

    await pool.query(`CREATE TABLE "${schema}"."${table}" (${cols}, ${metaCols})`);
    console.log(`✅ Auto-created table "${schema}"."${table}"`);
}

async function addMissingColumns(pool, schema, table, fieldNames) {
    const existing = await pool.query(
        `SELECT column_name FROM information_schema.columns WHERE table_schema=$1 AND table_name=$2`,
        [schema, table]
    );
    const existingSet = new Set(existing.rows.map(r => r.column_name.toLowerCase()));
    const metaNames = ['_etl_id_empresa','_etl_id_integracao','_etl_batch_id',
        '_etl_data_execucao','_etl_data_insercao','_etl_data_update','_etl_hash','_etl_origem'];

    for (const col of [...fieldNames, ...metaNames]) {
        const safe = col.replace(/[^\w]/g, '_');
        if (!existingSet.has(safe.toLowerCase())) {
            try {
                await pool.query(`ALTER TABLE "${schema}"."${table}" ADD COLUMN IF NOT EXISTS "${safe}" TEXT`);
                console.log(`  + Added column "${safe}"`);
            } catch (e) {
                console.warn(`  ! Could not add column "${safe}": ${e.message}`);
            }
        }
    }
}

// ── Upsert records (PostgreSQL) ───────────────────────────────────────────────
async function upsertRecords(pool, tableName, records, dedupField, integrationId, companyId, batchId, deleteBeforeInsert = false, origem = 'api') {
    if (!records.length) return { inserted: 0, updated: 0, skipped: 0 };
    const { schema, table } = parseTableName(tableName);
    const now = new Date().toISOString();

    const metaRecords = records.map(record => {
        const hash = crypto.createHash('md5').update(JSON.stringify(record)).digest('hex');
        const sanitized = {};
        Object.entries(record).forEach(([k, v]) => {
            sanitized[k.replace(/[^\w]/g, '_')] = v != null ? String(v) : null;
        });
        return {
            ...sanitized,
            _etl_id_empresa:    String(companyId),
            _etl_id_integracao: String(integrationId),
            _etl_batch_id:      String(batchId),
            _etl_data_execucao: now,
            _etl_hash:          hash,
            _etl_origem:        origem,
        };
    });

    const allCols   = [...new Set(metaRecords.flatMap(r => Object.keys(r)))];
    const dedupSafe = dedupField ? dedupField.replace(/[^\w]/g, '_') : null;

    if (deleteBeforeInsert) {
        await pool.query(
            `DELETE FROM "${schema}"."${table}" WHERE "_etl_id_empresa" = $1`,
            [String(companyId)]
        );
        console.log(`  🗑️  Deleted records for company ${companyId}`);
    }

    let inserted = 0, updated = 0;

    // Insere em lotes de 500
    const BATCH = 500;
    for (let i = 0; i < metaRecords.length; i += BATCH) {
        const chunk = metaRecords.slice(i, i + BATCH);

        if (deleteBeforeInsert || !dedupSafe) {
            // INSERT simples
            const colNames = allCols.map(c => `"${c}"`).join(', ');
            const rows = chunk.map((row, ri) => {
                const vals = allCols.map((col, ci) => `$${ri * allCols.length + ci + 1}`);
                return `(${vals.join(', ')})`;
            }).join(', ');
            const params = chunk.flatMap(row => allCols.map(col => row[col] ?? null));
            const result = await pool.query(
                `INSERT INTO "${schema}"."${table}" (${colNames}) VALUES ${rows}`,
                params
            );
            inserted += result.rowCount || chunk.length;
        } else {
            // INSERT ... ON CONFLICT DO UPDATE (upsert nativo do PostgreSQL)
            const colNames  = allCols.map(c => `"${c}"`).join(', ');
            const updateSet = allCols
                .filter(c => c !== dedupSafe)
                .map(c => `"${c}" = EXCLUDED."${c}"`).join(', ');

            for (const row of chunk) {
                const vals    = allCols.map(col => row[col] ?? null);
                const holders = allCols.map((_, ci) => `$${ci + 1}`).join(', ');
                const result  = await pool.query(
                    `INSERT INTO "${schema}"."${table}" (${colNames}) VALUES (${holders})
                     ON CONFLICT ("${dedupSafe}") DO UPDATE SET ${updateSet},
                     "_etl_data_update" = NOW()`,
                    vals
                );
                if (result.rowCount) inserted++;
            }
        }
    }

    return { inserted, updated, skipped: 0 };
}

// ── Fetch records by source ───────────────────────────────────────────────────
async function fetchRecords(integration) {
    const sourceType = integration.source_type || 'api';

    if (sourceType === 'api') {
        const customHeaders = integration.headers ? (() => {
            const h = JSON.parse(integration.headers);
            if (Array.isArray(h)) { const obj = {}; h.filter(x=>x.key).forEach(x=>{obj[x.key]=x.value;}); return obj; }
            return h;
        })() : {};

        const authHeaders  = buildAuthHeaders(integration.auth_type, integration.auth_config);
        const rawQp        = integration.query_params ? JSON.parse(integration.query_params) : [];
        const queryParams  = Array.isArray(rawQp)
            ? rawQp.reduce((acc,p) => { if(p.key) acc[p.key]=p.value; return acc; }, {}) : rawQp;

        const url = `${integration.base_url.replace(/\/$/, '')}${integration.endpoint || ''}`;
        const response = await axios({
            method: integration.method || 'GET', url,
            headers: { ...customHeaders, ...authHeaders },
            params: Object.keys(queryParams).length ? queryParams : undefined,
            data: integration.body_template || undefined,
            timeout: integration.timeout || 30000,
            responseType: 'text',
            httpsAgent: new https.Agent({ rejectUnauthorized: false }),
        });

        let parsedData;
        if (integration.response_format === 'xml') {
            parsedData = await parseXml(response.data);
        } else {
            try {
                parsedData = typeof response.data === 'string' ? JSON.parse(response.data) : response.data;
                if (typeof parsedData === 'string') parsedData = JSON.parse(parsedData);
            } catch (e) {
                throw new Error('Erro ao fazer parse do JSON: ' + e.message);
            }
        }

        const records = extractRecords(parsedData, integration.root_path);
        return { records, responseStatus: response.status, rawPreview: String(response.data||'').substring(0,5000) };
    }

    if (sourceType === 'excel') {
        if (!integration.file_path) throw new Error('Arquivo Excel não configurado.');
        const filePath = path.isAbsolute(integration.file_path)
            ? integration.file_path : path.join(UPLOAD_DIR, integration.file_path);
        if (!fs.existsSync(filePath)) throw new Error('Arquivo não encontrado. Faça o upload novamente.');
        const records = await readExcel(filePath, integration.sheet_name || null);
        return { records, responseStatus: 200, rawPreview: `Excel: ${records.length} linhas` };
    }

    if (sourceType === 'csv') {
        if (!integration.file_path) throw new Error('Arquivo CSV não configurado.');
        const filePath = path.isAbsolute(integration.file_path)
            ? integration.file_path : path.join(UPLOAD_DIR, integration.file_path);
        if (!fs.existsSync(filePath)) throw new Error('Arquivo não encontrado. Faça o upload novamente.');
        const records = await readCsv(filePath);
        return { records, responseStatus: 200, rawPreview: `CSV: ${records.length} linhas` };
    }

    if (sourceType === 'sheets') {
        if (!integration.sheets_url) throw new Error('URL do Google Sheets não configurada.');
        const records = await readGoogleSheets(integration.sheets_url);
        return { records, responseStatus: 200, rawPreview: `Google Sheets: ${records.length} linhas` };
    }

    throw new Error(`Tipo de fonte desconhecido: ${sourceType}`);
}

// ── Main runner ───────────────────────────────────────────────────────────────
async function runIntegration(integrationId, triggeredBy = null, triggerType = 'scheduled') {
    const integration = await getAsync('SELECT * FROM etl.integrations WHERE id = ?', [integrationId]);
    if (!integration) throw new Error('Integration not found');

    const companyId = integration.company_id;
    const batchId   = uuidv4();
    const logId     = uuidv4();
    const startedAt = new Date().toISOString();

    await runAsync(
        `INSERT INTO etl.execution_logs
         (id, integration_id, company_id, batch_id, status, trigger_type, triggered_by, started_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        [logId, integrationId, companyId, batchId, 'running', triggerType, triggeredBy || null, startedAt]
    );

    let status = 'success', errorMessage = null, responseStatus = null, rawResponse = null;
    let recordsFetched = 0, recordsInserted = 0, recordsUpdated = 0, recordsSkipped = 0;

    try {
        const sourceType = integration.source_type || 'api';
        const { records, responseStatus: rs, rawPreview } = await fetchRecords(integration);
        responseStatus = rs;
        rawResponse    = rawPreview;
        recordsFetched = records.length;

        if (recordsFetched === 0) {
            console.warn(`Integration ${integrationId}: 0 records (source="${sourceType}")`);
        }

        // Aplica mapeamentos
        let processedRecords = records;
        if (integration.field_mappings) {
            const mappings = JSON.parse(integration.field_mappings);
            if (Array.isArray(mappings) && mappings.length > 0) {
                processedRecords = records.map(r => {
                    const mapped = {};
                    mappings.forEach(m => { if (m.source && m.target) mapped[m.target] = r[m.source]; });
                    return Object.keys(mapped).length > 0 ? mapped : r;
                });
            }
        }

        // Persiste no PostgreSQL de destino
        if (integration.db_target_id && integration.target_table && processedRecords.length > 0) {
            const dbTarget = await getAsync('SELECT * FROM etl.database_targets WHERE id = ?', [integration.db_target_id]);
            if (dbTarget) {
                const targetPool = await openTargetPool(dbTarget);
                try {
                    await ensureTable(targetPool, integration.target_table, processedRecords);
                    const result = await upsertRecords(
                        targetPool, integration.target_table, processedRecords,
                        integration.dedup_field, integrationId, companyId, batchId,
                        integration.delete_before_insert === true || integration.delete_before_insert === 't',
                        sourceType
                    );
                    recordsInserted = result.inserted;
                    recordsUpdated  = result.updated;
                    recordsSkipped  = result.skipped;
                } finally {
                    try { await targetPool.end(); } catch {}
                }
            }
        }

    } catch (err) {
        status       = 'error';
        errorMessage = err.message;
        console.error(`❌ Integration ${integrationId} failed: ${err.message}`);
    }

    const finishedAt = new Date().toISOString();
    const duration   = new Date(finishedAt) - new Date(startedAt);

    await runAsync(`
        UPDATE etl.execution_logs SET
            status=?, finished_at=?, duration_ms=?,
            records_fetched=?, records_inserted=?, records_updated=?,
            records_skipped=?, error_message=?, response_status=?, raw_response=?
        WHERE id=?`,
        [status, finishedAt, duration, recordsFetched, recordsInserted,
         recordsUpdated, recordsSkipped, errorMessage, responseStatus, rawResponse, logId]
    );

    await runAsync(
        `UPDATE etl.schedules SET last_run=?, last_status=?, run_count=run_count+1 WHERE integration_id=?`,
        [finishedAt, status, integrationId]
    );

    return { logId, batchId, status, recordsFetched, recordsInserted, recordsUpdated, recordsSkipped, errorMessage, duration };
}

module.exports = { runIntegration };
