const cron = require('node-cron');
const prisma = require('../services/prisma');
const { getQubicBalance } = require('../services/qubic.service');
const { addRoleSafe, removeRoleSafe } = require('../services/discord.service');
const CONFIG = require('../config/config');

const fetchWalletsGroupedByUser = async () => {
    const wallets = await prisma.wallet.findMany({ 
        where: { isVerified: true },
        select: { userId: true, address: true }
    });

    const userMap = new Map();
    wallets.forEach(w => {
        if (!userMap.has(w.userId)) userMap.set(w.userId, []);
        userMap.get(w.userId).push(w.address);
    });
    return userMap;
};

const processUser = async (guild, userId, userWalletAddresses, stats) => {
    try {
        const member = await guild.members.fetch(userId).catch(() => null);
        if (!member) return; // User left server

        const balancePromises = userWalletAddresses.map(addr => getQubicBalance(addr));
        const balances = await Promise.all(balancePromises);
        const totalNetWorth = balances.reduce((acc, curr) => acc + curr, 0n);

        await addRoleSafe(member, CONFIG.ROLES.VERIFIED, "VERIFIED");

        const isWhale = totalNetWorth >= CONFIG.WHALE_THRESHOLD;
        const hasWhaleRole = member.roles.cache.has(CONFIG.ROLES.WHALE);

        if (isWhale && !hasWhaleRole) {
            await addRoleSafe(member, CONFIG.ROLES.WHALE, "WHALE");
            stats.changes++;
        } else if (!isWhale && hasWhaleRole) {
            await removeRoleSafe(member, CONFIG.ROLES.WHALE, "WHALE");
            stats.changes++;
        }

        stats.processed++;
    } catch (err) {
        if (err.message && (err.message.includes('RPC') || err.message.includes('fetch'))) {
            stats.skipped++;
            console.warn(`⚠️ Skipped user ${userId} due to RPC/Network error: ${err.message}`);
        } else {
            stats.errors++;
            console.error(`Error processing user ${userId}: ${err.message}`);
        }
    }
};

const portfolioRefreshJob = (client) => {
    try {
        cron.schedule(CONFIG.PORTFOLIO_REFRESH_JOB_SCHEDULE, async () => {
            console.info('=== ⚡ Portfolio Refresh Started ===');
            const startTime = Date.now();
            
            try {
                const guild = await client.guilds.fetch(CONFIG.GUILD_ID).catch(() => null);
                if (!guild) {
                    console.error('Guild not found, aborting refresh.');
                    return;
                }

                const userMap = await fetchWalletsGroupedByUser();
                const userIds = Array.from(userMap.keys());
                console.info(`Processing ${userIds.length} users with ${userMap.size} total wallets...`);

                const stats = { processed: 0, errors: 0, changes: 0, skipped: 0 };

                for (let i = 0; i < userIds.length; i += CONFIG.PORTFOLIO_REFRESH_BATCH_SIZE) {
                    const batchUserIds = userIds.slice(i, i + CONFIG.PORTFOLIO_REFRESH_BATCH_SIZE);
                    
                    await Promise.all(batchUserIds.map(async (userId) => {
                        const userWalletAddresses = userMap.get(userId);
                        await processUser(guild, userId, userWalletAddresses, stats);
                    }));

                    if (i + CONFIG.PORTFOLIO_REFRESH_BATCH_SIZE < userIds.length) {
                        await new Promise(r => setTimeout(r, CONFIG.PORTFOLIO_REFRESH_BATCH_DELAY_MS));
                    }
                }

                const duration = ((Date.now() - startTime) / 1000).toFixed(1);
                console.info(`=== Portfolio Refresh Complete ===`);
                console.info(`Users: ${stats.processed}/${userIds.length} | Role Updates: ${stats.changes} | Skipped (Safety): ${stats.skipped} | Errors: ${stats.errors} | Time: ${duration}s`);

            } catch (error) {
                console.error(`Portfolio refresh critical failure: ${error.message}`);
            }
        });
    } catch (e) {
        console.error('Failed to start portfolio refresh job:', e.message);
    }
};

module.exports = portfolioRefreshJob;