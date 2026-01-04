const logger = require('../utils/logger');
const cron = require('node-cron');
const { prisma } = require('../services/prisma');
const { getQubicBalance } = require('../services/qubic.service');
const { processUserRoles } = require('./roleAssignmentJob');
const CONFIG = require('../config/config');

let rpcFailures = 0;
let isCooldown = false;

const fetchWalletsGroupedByUser = async () => {
    const wallets = await prisma.wallet.findMany({
        where: { isVerified: true },
        select: { userId: true, address: true },
    });

    const userMap = new Map();
    wallets.forEach((w) => {
        if (!userMap.has(w.userId)) userMap.set(w.userId, []);
        userMap.get(w.userId).push(w.address);
    });
    return userMap;
};

const updateUserPortfolioAndRoles = async (
    client,
    guild,
    userId,
    userWalletAddresses,
    roleThresholds,
    stats
) => {
    try {
        const balancePromises = userWalletAddresses.map((addr) =>
            getQubicBalance(addr)
        );
        const balances = await Promise.all(balancePromises);
        const totalNetWorth = balances.reduce((acc, curr) => acc + curr, 0n);

        const userPortfolio = await prisma.portfolio.upsert({
            where: { userId },
            update: { totalBalance: totalNetWorth },
            create: { userId, totalBalance: totalNetWorth },
        });

        await processUserRoles(guild, userPortfolio, roleThresholds);

        stats.processed++;
    } catch (err) {
        if (
            err.message &&
            (err.message.includes('RPC') || err.message.includes('fetch'))
        ) {
            stats.skipped++;
            rpcFailures++;
            logger.warn(
                { userId, err },
                'Skipped user portfolio update due to RPC/Network error'
            );
        } else {
            stats.errors++;
            logger.error({ userId, err }, 'Error processing user portfolio');
        }
    }
};

const runPortfolioRefresh = async (client) => {
    if (isCooldown) {
        logger.warn(
            'RPC circuit breaker is active. Skipping portfolio refresh.'
        );
        return;
    }

    logger.info('=== 💰 Portfolio Refresh Started ===');
    const startTime = Date.now();

    try {
        const guild = await client.guilds
            .fetch(CONFIG.GUILD_ID)
            .catch(() => null);
        if (!guild) {
            logger.error('Guild not found, aborting refresh.');
            return;
        }

        const roleThresholds = await prisma.roleThreshold.findMany({
            orderBy: { threshold: 'desc' },
        });
        if (roleThresholds.length === 0) {
            logger.warn(
                'No role thresholds configured in DB. Skipping dynamic role assignment in portfolio refresh.'
            );
        }

        const userMap = await fetchWalletsGroupedByUser();
        const userIds = Array.from(userMap.keys());
        logger.info(
            { userCount: userIds.length, walletCount: userMap.size },
            'Processing user portfolios and roles'
        );

        const stats = {
            processed: 0,
            errors: 0,
            skipped: 0,
        };

        for (
            let i = 0;
            i < userIds.length;
            i += CONFIG.PORTFOLIO_REFRESH_BATCH_SIZE
        ) {
            const batchUserIds = userIds.slice(
                i,
                i + CONFIG.PORTFOLIO_REFRESH_BATCH_SIZE
            );

            await Promise.all(
                batchUserIds.map(async (userId) => {
                    const userWalletAddresses = userMap.get(userId);
                    await updateUserPortfolioAndRoles(
                        client,
                        guild,
                        userId,
                        userWalletAddresses,
                        roleThresholds,
                        stats
                    );
                })
            );

            if (i + CONFIG.PORTFOLIO_REFRESH_BATCH_SIZE < userIds.length) {
                await new Promise((r) =>
                    setTimeout(r, CONFIG.PORTFOLIO_REFRESH_BATCH_DELAY_MS)
                );
            }
        }

        const duration = ((Date.now() - startTime) / 1000).toFixed(1);
        logger.info(
            { ...stats, duration, userCount: userIds.length },
            '=== Portfolio Refresh Complete ==='
        );

        if (rpcFailures >= CONFIG.RPC_FAILURE_THRESHOLD) {
            logger.warn(
                'RPC failure threshold reached. Activating circuit breaker.'
            );
            isCooldown = true;
            setTimeout(() => {
                logger.info(
                    'RPC circuit breaker cooldown finished. Resuming normal operations.'
                );
                isCooldown = false;
                rpcFailures = 0;
            }, CONFIG.RPC_COOLDOWN_MS);
        } else {
            rpcFailures = 0;
        }

        return { ...stats, duration, userCount: userIds.length }; // Return stats on completion
    } catch (error) {
        logger.error({ err: error }, 'Portfolio refresh critical failure');
    }
};

const portfolioRefreshJob = (client) => {
    try {
        const task = cron.schedule(CONFIG.PORTFOLIO_REFRESH_JOB_SCHEDULE, () =>
            runPortfolioRefresh(client)
        );
        return task;
    } catch (e) {
        logger.error({ err: e }, 'Failed to start portfolio refresh job');
        return null;
    }
};

module.exports = { portfolioRefreshJob, runPortfolioRefresh };
