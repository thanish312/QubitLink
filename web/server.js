const express = require('express');
const path = require('path');
const helmet = require('helmet');
const webhookRouter = require('./routes/webhook');
const adminRouter = require('./routes/admin');

const createServer = (discordClient) => {
    const app = express();
    const PORT = process.env.PORT || 3000;

    // 1. Security Middleware
    // TODO: Investigate removing 'unsafe-inline' for scriptSrc.
    // This is currently needed for React hydration, but it's a security risk.
    app.use(helmet({
        contentSecurityPolicy: {
            directives: {
                defaultSrc: ["'self'"],
                scriptSrc: ["'self'", "'unsafe-inline'"],
                imgSrc: ["'self'", "data:", "https://cdn.discordapp.com"],
            },
        },
    }));
    app.use(express.json());
    app.set('discord_client', discordClient);

    // 2. API Routes
    app.use('/webhook', webhookRouter);
    app.use('/api/admin', adminRouter);

    // 3. Frontend Static Serving
    const frontendDist = path.join(__dirname, '../frontend/dist');
    app.use('/dashboard', express.static(frontendDist));

    // 4. Root Redirect
    app.get('/', (req, res) => {
        res.redirect('/dashboard');
    });

    // 5. Frontend SPA Fallback - serve index.html for all dashboard sub-routes
    // This handles client-side routing for paths like /dashboard/settings, /dashboard/users, etc.
    // The static middleware above handles /dashboard itself and existing static files
    app.get(/^\/dashboard\/.+/, (req, res) => {
        res.sendFile(path.join(frontendDist, 'index.html'));
    });

    // 6. Error Handling Middleware
    app.use((err, req, res, next) => {
        console.error(err.stack);
        res.status(500).send('Something broke!');
    });

    const start = () => {
        app.listen(PORT, () => {
            console.info('=== QubicLink Server Started ===');
            console.info(`🔒 Security Headers Enabled`);
            console.info(`🚀 Admin Dashboard: http://localhost:${PORT}/dashboard`);
        });
    };

    return { start };
};

module.exports = createServer;