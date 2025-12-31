require('dotenv').config();
const fs = require('fs');
const path = require('path');
const client = require('./bot/client');
const createServer = require('./web/server');
const portfolioRefreshJob = require('./jobs/portfolioRefresh');
const cleanupWalletsJob = require('./jobs/cleanupWallets');
const CONFIG = require('./config/config');

// Register Discord event handlers
const eventsPath = path.join(__dirname, 'bot/events');
const eventFiles = fs.readdirSync(eventsPath).filter(file => file.endsWith('.js'));

for (const file of eventFiles) {
    const filePath = path.join(eventsPath, file);
    const event = require(filePath);
    if (event.once) {
        client.once(event.name, (...args) => event.execute(...args));
    } else {
        client.on(event.name, (...args) => event.execute(...args));
    }
}

// Start the cron jobs
portfolioRefreshJob(client);
cleanupWalletsJob();

// Create and start the web server
const { start } = createServer(client);
start();

// Login to Discord
client.login(CONFIG.DISCORD_TOKEN).catch(err => {
    console.error('Discord login failed:', err.message);
    process.exit(1);
});
