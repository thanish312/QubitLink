const cron = require('node-cron');
const prisma = require('../services/prisma');
const { getQubicBalance } = require('../services/qubic.service');
const { addRoleSafe, removeRoleSafe } = require('../services/discord.service');
const { sleep } = require('../utils/helpers');
const CONFIG = require('../config/config');

/**
 * Scheduled portfolio refresh and role synchronization
 * Runs every 30 minutes to update user roles based on wallet balances
 */
const portfolioRefreshJob = (client) => cron.schedule('*/30 * * * *', async () => {
    console.info('=== Portfolio Refresh Started ===');
    const startTime = Date.now();
    
    try {
        const verifiedWallets = await prisma.wallet.findMany({ 
            where: { isVerified: true },
            select: { userId: true }
        });
        
        const uniqueUserIds = [...new Set(verifiedWallets.map(w => w.userId))];
        const guild = await client.guilds.fetch(CONFIG.GUILD_ID);

        console.info(`Processing ${uniqueUserIds.length} verified users`);

        let processed = 0;
        let errors = 0;

        for (const userId of uniqueUserIds) {
            try {
                const member = await guild.members.fetch(userId).catch(() => null);
                if (!member) {
                    console.debug(`User ${userId} not found in guild, skipping`);
                    continue;
                }

                const userWallets = await prisma.wallet.findMany({ 
                    where: { userId: userId, isVerified: true } 
                });
                
                let totalNetWorth = 0n;
                for (const wallet of userWallets) {
                    const balance = await getQubicBalance(wallet.address);
                    totalNetWorth += balance;
                    await sleep(CONFIG.RATE_LIMIT_DELAY_MS);
                }

                await addRoleSafe(member, CONFIG.ROLES.VERIFIED, "VERIFIED");

                if (totalNetWorth >= CONFIG.WHALE_THRESHOLD) {
                    await addRoleSafe(member, CONFIG.ROLES.WHALE, "WHALE");
                } else {
                    await removeRoleSafe(member, CONFIG.ROLES.WHALE, "WHALE");
                }

                processed++;
            } catch (err) {
                errors++;
                console.error(`Error processing user ${userId}: ${err.message}`);
            }
        }

        const duration = Date.now() - startTime;
        console.info(`=== Portfolio Refresh Complete ===`);
        console.info(`Processed: ${processed}, Errors: ${errors}, Duration: ${duration}ms`);
    } catch (error) {
        console.error(`Portfolio refresh critical failure: ${error.message}`);
    }
});

module.exports = portfolioRefreshJob;