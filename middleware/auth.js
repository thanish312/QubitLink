const jwt = require('jsonwebtoken');
const cors = require('cors');

/**
 * Generate admin authentication JWT.
 * @returns {string} - The signed JWT.
 */
function generateAdminToken() {
    if (!process.env.ADMIN_JWT_SECRET) {
        throw new Error('ADMIN_JWT_SECRET is not defined');
    }
    const payload = { role: 'admin' };
    return jwt.sign(payload, process.env.ADMIN_JWT_SECRET, {
        expiresIn: '24h',
    });
}

/**
 * Admin authentication middleware.
 * Verifies the JWT from the Authorization header.
 */
function adminAuth(req, res, next) {
    const token = req.headers.authorization?.replace('Bearer ', '');

    if (!token) {
        return res
            .status(401)
            .json({ error: 'Unauthorized: No token provided' });
    }

    try {
        const decoded = jwt.verify(token, process.env.ADMIN_JWT_SECRET);
        if (decoded.role !== 'admin') {
            return res
                .status(403)
                .json({ error: 'Forbidden: Insufficient privileges' });
        }
        req.user = decoded; // Attach user info to the request
        next();
    } catch (error) {
        if (error instanceof jwt.TokenExpiredError) {
            return res
                .status(401)
                .json({ error: 'Unauthorized: Token expired' });
        }
        return res.status(401).json({ error: 'Unauthorized: Invalid token' });
    }
}

/**
 * CORS middleware for admin routes.
 * Restricts access to the defined FRONTEND_URL.
 */
const adminCors = cors({
    origin: process.env.FRONTEND_URL,
    methods: ['GET', 'POST', 'PUT', 'DELETE'],
    allowedHeaders: ['Content-Type', 'Authorization'],
});

module.exports = {
    generateAdminToken,
    adminAuth,
    adminCors,
};
