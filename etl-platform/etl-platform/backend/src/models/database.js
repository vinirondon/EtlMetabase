const { Pool } = require('pg');

const config = {
    host:     process.env.DB_HOST     || '46.225.143.59',
    port:     parseInt(process.env.DB_PORT || '5432'),
    database: process.env.DB_DATABASE || 'metabase_etl',
    user:     process.env.DB_USER     || 'metabase_user',
    password: process.env.DB_PASSWORD || 'senha_segura_metabase',
    ssl: process.env.DB_SSL === 'false' ? false : { rejectUnauthorized: false },
    max: 10,
    min: 2,
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 30000,
};

let pool = null;

function getPool() {
    if (!pool) {
        pool = new Pool(config);
        pool.on('error', (err) => {
            console.error('Pool error:', err.message);
        });
    }
    return pool;
}

async function runAsync(sql, params = []) {
    const p = getPool();
    // Converte ? para $1, $2...
    let idx = 0;
    const replaced = sql.replace(/\?/g, () => `$${++idx}`);
    const result = await p.query(replaced, params.map(v => v === undefined ? null : v));
    return result.rowCount || 0;
}

async function getAsync(sql, params = []) {
    const p = getPool();
    let idx = 0;
    const replaced = sql.replace(/\?/g, () => `$${++idx}`);
    const result = await p.query(replaced, params.map(v => v === undefined ? null : v));
    return result.rows[0] || null;
}

async function allAsync(sql, params = []) {
    const p = getPool();
    let idx = 0;
    const replaced = sql.replace(/\?/g, () => `$${++idx}`);
    const result = await p.query(replaced, params.map(v => v === undefined ? null : v));
    return result.rows;
}

async function execOne(sql) {
    const p = getPool();
    await p.query(sql);
}

async function createSchema() {
    const statements = [
        `CREATE SCHEMA IF NOT EXISTS etl`,

        `CREATE TABLE IF NOT EXISTS etl.users (
            id            VARCHAR(36) PRIMARY KEY,
            name          VARCHAR(200) NOT NULL,
            email         VARCHAR(200) NOT NULL UNIQUE,
            password_hash VARCHAR(200) NOT NULL,
            role          VARCHAR(50)  NOT NULL DEFAULT 'operator',
            status        VARCHAR(20)  NOT NULL DEFAULT 'active',
            last_login    TIMESTAMPTZ,
            created_at    TIMESTAMPTZ DEFAULT NOW(),
            updated_at    TIMESTAMPTZ DEFAULT NOW()
        )`,

        `CREATE TABLE IF NOT EXISTS etl.companies (
            id         VARCHAR(36) PRIMARY KEY,
            trade_name VARCHAR(200) NOT NULL,
            legal_name VARCHAR(200) NOT NULL,
            cnpj       VARCHAR(20),
            email      VARCHAR(200),
            phone      VARCHAR(50),
            status     VARCHAR(20) NOT NULL DEFAULT 'active',
            notes      TEXT,
            created_at TIMESTAMPTZ DEFAULT NOW(),
            updated_at TIMESTAMPTZ DEFAULT NOW()
        )`,

        `CREATE TABLE IF NOT EXISTS etl.company_users (
            company_id VARCHAR(36) NOT NULL,
            user_id    VARCHAR(36) NOT NULL,
            PRIMARY KEY (company_id, user_id)
        )`,

        `CREATE TABLE IF NOT EXISTS etl.database_targets (
            id                 VARCHAR(36) PRIMARY KEY,
            company_id         VARCHAR(36) NOT NULL,
            name               VARCHAR(200) NOT NULL,
            type               VARCHAR(50) NOT NULL DEFAULT 'postgresql',
            host               VARCHAR(200) NOT NULL,
            port               INT DEFAULT 5432,
            database_name      VARCHAR(200) NOT NULL,
            username           VARCHAR(200) NOT NULL,
            password_encrypted TEXT NOT NULL,
            options            TEXT,
            status             VARCHAR(20) DEFAULT 'active',
            is_linked          BOOLEAN DEFAULT FALSE,
            linked_from_id     VARCHAR(36),
            created_at         TIMESTAMPTZ DEFAULT NOW()
        )`,

        `CREATE TABLE IF NOT EXISTS etl.integrations (
            id                   VARCHAR(36) PRIMARY KEY,
            company_id           VARCHAR(36) NOT NULL,
            name                 VARCHAR(200) NOT NULL,
            description          TEXT,
            base_url             VARCHAR(500),
            endpoint             VARCHAR(500) DEFAULT '',
            method               VARCHAR(10) NOT NULL DEFAULT 'GET',
            auth_type            VARCHAR(50) NOT NULL DEFAULT 'none',
            auth_config          TEXT,
            headers              TEXT,
            query_params         TEXT,
            body_template        TEXT,
            response_format      VARCHAR(20) NOT NULL DEFAULT 'json',
            timeout              INT DEFAULT 30000,
            status               VARCHAR(20) NOT NULL DEFAULT 'active',
            db_target_id         VARCHAR(36),
            target_table         VARCHAR(200),
            field_mappings       TEXT,
            root_path            VARCHAR(500),
            dedup_field          VARCHAR(200),
            delete_before_insert BOOLEAN DEFAULT FALSE,
            source_type          VARCHAR(20) DEFAULT 'api',
            sheets_url           VARCHAR(500),
            file_path            VARCHAR(500),
            sheet_name           VARCHAR(200),
            created_by           VARCHAR(36),
            created_at           TIMESTAMPTZ DEFAULT NOW(),
            updated_at           TIMESTAMPTZ DEFAULT NOW()
        )`,

        `CREATE TABLE IF NOT EXISTS etl.schedules (
            id              VARCHAR(36) PRIMARY KEY,
            integration_id  VARCHAR(36) NOT NULL,
            cron_expression VARCHAR(100) NOT NULL,
            is_active       BOOLEAN NOT NULL DEFAULT TRUE,
            last_run        TIMESTAMPTZ,
            next_run        TIMESTAMPTZ,
            last_status     VARCHAR(20),
            run_count       INT DEFAULT 0,
            created_at      TIMESTAMPTZ DEFAULT NOW(),
            updated_at      TIMESTAMPTZ DEFAULT NOW()
        )`,

        `CREATE TABLE IF NOT EXISTS etl.execution_logs (
            id               VARCHAR(36) PRIMARY KEY,
            integration_id   VARCHAR(36) NOT NULL,
            company_id       VARCHAR(36) NOT NULL,
            batch_id         VARCHAR(36) NOT NULL,
            status           VARCHAR(20) NOT NULL,
            trigger_type     VARCHAR(50) DEFAULT 'scheduled',
            triggered_by     VARCHAR(36),
            started_at       TIMESTAMPTZ NOT NULL,
            finished_at      TIMESTAMPTZ,
            duration_ms      INT,
            records_fetched  INT DEFAULT 0,
            records_inserted INT DEFAULT 0,
            records_updated  INT DEFAULT 0,
            records_skipped  INT DEFAULT 0,
            error_message    TEXT,
            request_url      TEXT,
            response_status  INT,
            raw_response     TEXT,
            created_at       TIMESTAMPTZ DEFAULT NOW()
        )`,

        `CREATE TABLE IF NOT EXISTS etl.audit_logs (
            id            VARCHAR(36) PRIMARY KEY,
            user_id       VARCHAR(36),
            user_email    VARCHAR(200),
            action        VARCHAR(100) NOT NULL,
            resource_type VARCHAR(100),
            resource_id   VARCHAR(36),
            details       TEXT,
            ip_address    VARCHAR(100),
            created_at    TIMESTAMPTZ DEFAULT NOW()
        )`,
    ];

    for (const sql of statements) {
        await execOne(sql);
    }
}

async function initializeDatabase() {
    console.log('🔌 Connecting to PostgreSQL...');
    const p = getPool();
    await p.query('SELECT 1'); // testa conexão
    console.log(`✅ Connected to PostgreSQL: ${config.host}/${config.database}`);

    await createSchema();
    console.log('✅ Schema etl.* verified');

    const adminExists = await getAsync("SELECT id FROM etl.users WHERE role = 'superadmin'");
    if (!adminExists) {
        await require('./seed').seedAdmin({ runAsync, getAsync });
    }

    console.log('✅ Database ready\n');
}

module.exports = { initializeDatabase, getPool, runAsync, getAsync, allAsync, execOne };
