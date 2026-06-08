const { v4: uuidv4 } = require('uuid');
const { runAsync } = require('../models/database');

async function logAudit({ userId, userEmail, action, resourceType, resourceId, details, ip }) {
    try {
        await runAsync(
            `INSERT INTO etl.audit_logs (id,user_id,user_email,action,resource_type,resource_id,details,ip_address)
             VALUES (?,?,?,?,?,?,?,?)`,
            [uuidv4(), userId||null, userEmail||null, action, resourceType||null,
             resourceId||null, details ? JSON.stringify(details) : null, ip||null]
        );
    } catch (e) {
        console.warn('Audit log failed:', e.message);
    }
}

module.exports = { logAudit };
