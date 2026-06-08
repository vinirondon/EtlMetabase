require('dotenv').config();
const express = require('express');
const cors    = require('cors');
const path    = require('path');
const { initializeDatabase } = require('./models/database');
const { startAll } = require('./scheduler/cronManager');

const app = express();

app.use(cors({
    origin: process.env.FRONTEND_URL || '*',
    credentials: true,
}));
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// Routes
app.use('/api/auth',         require('./routes/auth'));
app.use('/api/companies',    require('./routes/companies'));
app.use('/api/integrations', require('./routes/integrations'));
app.use('/api/schedules',    require('./routes/schedules'));
app.use('/api/logs',         require('./routes/logs'));
app.use('/api/dashboard',    require('./routes/dashboard'));
app.use('/api/users',        require('./routes/users'));
app.use('/api/execute',      require('./routes/execute'));
app.use('/api/upload',       require('./routes/upload'));

app.get('/api/health', (req, res) => res.json({ status: 'ok', timestamp: new Date().toISOString() }));

const PORT = process.env.PORT || 3001;

initializeDatabase()
    .then(() => startAll())
    .then(() => {
        app.listen(PORT, () => console.log(`🚀 ETL Platform API running on port ${PORT}`));
    })
    .catch(err => {
        console.error('Failed to start:', err);
        process.exit(1);
    });
