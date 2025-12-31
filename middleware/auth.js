const { verifyAdminToken } = require('../utils/crypto');

/**
 * Admin authentication middleware
 */
function adminAuth(req, res, next) {
    const token = req.headers.authorization?.replace('Bearer ', '');
    
    if (!token || !verifyAdminToken(token)) {
        return res.status(401).json({ error: 'Unauthorized' });
    }
    
    next();
}

/**
 * CORS middleware for admin routes
 */
function adminCors(req, res, next) {
    res.header('Access-Control-Allow-Origin', '*');
    res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE');
    res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization');
    
    if (req.method === 'OPTIONS') {
        return res.sendStatus(200);
    }
    
    next();
}

module.exports = {
    adminAuth,
    adminCors
};