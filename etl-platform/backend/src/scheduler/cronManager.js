const cron = require('node-cron');
const { allAsync } = require('../models/database');
const { runIntegration } = require('../workers/integrationRunner');
const activeTasks = new Map();

async function startAll() {
    try {
        const schedules = await allAsync(`
            SELECT s.id, s.integration_id, s.cron_expression
            FROM etl.schedules s JOIN etl.integrations i ON i.id=s.integration_id
            WHERE s.is_active=true`);
        schedules.forEach(s => scheduleTask(s));
        console.log(`⏱  Cron scheduler: ${schedules.length} schedule(s) loaded`);
    } catch (e) {
        console.warn('Cron scheduler warning:', e.message);
    }
}

function scheduleTask(schedule) {
    if (!cron.validate(schedule.cron_expression)) {
        console.warn(`Invalid cron "${schedule.cron_expression}" for schedule ${schedule.id}`);
        return;
    }
    stopTask(schedule.id);
    const task = cron.schedule(schedule.cron_expression, async () => {
        console.log(`⚡ Cron running integration ${schedule.integration_id}`);
        try { await runIntegration(schedule.integration_id, null, 'scheduled'); }
        catch (e) { console.error('Scheduled run error:', e.message); }
    });
    activeTasks.set(schedule.id, task);
}

function stopTask(id) {
    if (activeTasks.has(id)) { activeTasks.get(id).destroy(); activeTasks.delete(id); }
}

function stopAll() { activeTasks.forEach(t=>t.destroy()); activeTasks.clear(); }

module.exports = { startAll, scheduleTask, stopTask, stopAll };
