require('dotenv').config();

// Add this at the very top of your main entry file
BigInt.prototype.toJSON = function () {
    return this.toString();
};

const fs = require('fs');
const path = require('path');
const client = require('./bot/client');
const createServer = require('./web/server');
const { portfolioRefreshJob, runPortfolioRefresh } = require('./jobs/portfolioRefresh');
const cleanupWalletsJob = require('./jobs/cleanupWallets');
const { roleAssignmentJob } = require('./jobs/roleAssignmentJob');
const CONFIG = require('./config/config');

const logger = require('./utils/logger');

async function main() {
    // Register Discord event handlers
    const eventsPath = path.join(__dirname, 'bot/events');
    const eventFiles = fs
        .readdirSync(eventsPath)
        .filter((file) => file.endsWith('.js'));

    for (const file of eventFiles) {
        const filePath = path.join(eventsPath, file);
        const event = require(filePath);
        if (event.once) {
            client.once(event.name, (...args) => event.execute(...args));
        } else {
            client.on(event.name, (...args) => event.execute(...args));
        }
    }

    // Start the cron jobs and capture the portfolio task for external control
    const portfolioTask = portfolioRefreshJob(client);
    cleanupWalletsJob();
    roleAssignmentJob(client);

    // Create and start the web server, passing the portfolio task to it
    const { start } = createServer(client, { portfolioTask });
    start();

    // Login to Discord
    client.login(CONFIG.DISCORD_TOKEN).catch((err) => {
        logger.error({ err }, 'Discord login failed');
        process.exit(1);
    });
}

main();
