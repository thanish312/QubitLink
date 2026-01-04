const express = require('express');
const path = require('path');
const helmet = require('helmet');
const webhookRouter = require('./routes/webhook');
const adminRouter = require('./routes/admin');
const logger = require('../utils/logger');

const createServer = (discordClient, tasks) => {
    const app = express();
    const PORT = process.env.PORT || 3000;
    const VITE_PORT = 5173;
    const isDev = process.argv.includes('--dev');

    /*
     * 1. Core Middleware & App Context
     */
    app.use(helmet()); // Apply basic security headers
    app.use(express.json()); // Essential for parsing JSON request bodies
    app.set('discord_client', discordClient);
    app.set('tasks', tasks);


    /*
     * 2. API Routes (must be first)
     */
    app.use('/webhook', webhookRouter);
    app.use('/api/admin', adminRouter);

    if (isDev) {
        /*
         * 3a. Development – Proxy to Vite
         */
        const { createProxyMiddleware } = require('http-proxy-middleware');

        app.use(
            '/',
            createProxyMiddleware({
                target: `http://localhost:${VITE_PORT}`,
                changeOrigin: true,
                ws: true,
                logLevel: 'warn',
            })
        );
    } else {
        /*
         * 3b. Production – Static frontend
         */
        const frontendDist = path.join(__dirname, '../frontend/dist');

        app.use(express.static(frontendDist));

        /*
         * 4. SPA fallback (Express 5 safe)
         *    Use middleware, NOT app.get('*') or '/*'
         */
        app.use((req, res, next) => {
            if (req.method !== 'GET') return next();
            res.sendFile(path.join(frontendDist, 'index.html'));
        });
    }

    /*
     * 5. Error handler (Express 5 signature)
     */
    app.use((err, req, res, next) => {
        logger.error({ err }, 'Unhandled server error');

        if (res.headersSent) {
            return next(err);
        }

        res.status(500).json({
            error: { message: 'Internal Server Error' },
        });
    });

    const start = () => {
        app.listen(PORT, () => {
            logger.info('=== QubicLink Server Started ===');
            logger.info(`🔥 Mode: ${isDev ? 'Development' : 'Production'}`);
            logger.info(`🚀 Application running at: http://localhost:${PORT}`);
        });
    };

    return { start };
};

module.exports = createServer;
