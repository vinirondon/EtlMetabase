const jwt = require('jsonwebtoken');
const { getAsync } = require('../models/database');

async function authenticate(req, res, next) {
    const auth = req.headers.authorization;
    if (!auth || !auth.startsWith('Bearer '))
        return res.status(401).json({ error: 'Token required' });
    try {
        const decoded = jwt.verify(auth.slice(7), process.env.JWT_SECRET || 'dev_secret');
        const user = await getAsync('SELECT * FROM etl.users WHERE id=? AND status=?', [decoded.id, 'active']);
        if (!user) return res.status(401).json({ error: 'User not found or inactive' });
        req.user = user;
        next();
    } catch (e) {
        return res.status(401).json({ error: 'Invalid or expired token' });
    }
}

function requireRole(...roles) {
    return (req, res, next) => {
        if (!req.user || !roles.includes(req.user.role))
            return res.status(403).json({ error: 'Insufficient permissions' });
        next();
    };
}

module.exports = { authenticate, requireRole };
