const crypto = require('crypto');

/**
 * Generate admin authentication token
 */
function generateAdminToken() {
    const payload = { role: 'admin', timestamp: Date.now() };
    return Buffer.from(JSON.stringify(payload)).toString('base64');
}

/**
 * Verify admin authentication token
 */
function verifyAdminToken(token) {
    try {
        const payload = JSON.parse(Buffer.from(token, 'base64').toString());
        // Token valid for 24 hours
        return payload.role === 'admin' && (Date.now() - payload.timestamp) < 86400000;
    } catch {
        return false;
    }
}

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
    generateAdminToken,
    verifyAdminToken,
    adminAuth,
    adminCors
};