const express = require('express');
const webhookRouter = require('./routes/webhook');

const createServer = (discordClient) => {
    const app = express();
    const PORT = process.env.PORT || 3000;

    app.use(express.json());
    app.set('discord_client', discordClient);

    app.use('/webhook', webhookRouter);

    const start = () => {
        app.listen(PORT, () => {
            console.info('=== QubicLink Server Started ===');
            console.info(`Webhook server listening on port ${PORT}`);
            console.info(`Environment: ${process.env.NODE_ENV || 'development'}`);
        });
    };

    return { start };
};

module.exports = createServer;
