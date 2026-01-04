const logger = require('../utils/logger');
const cron = require('node-cron');
const { prisma } = require('../services/prisma');
const CONFIG = require('../config/config');
const { withRetry } = require('../utils/retry');

// This interval is used to prevent the cleanup job from deleting a wallet
// while a user still has a valid challenge pending. The default is 24 hours.
const CLEANUP_INTERVAL_HOURS = 24;

const cleanupWalletsJob = () => {
    try {
        cron.schedule(CONFIG.CLEANUP_JOB_SCHEDULE, async () => {
            logger.info('=== 🧹 Database Cleanup Started ===');

            try {
                await withRetry(async () => {
                    const cutoffDate = new Date(
                        Date.now() - CLEANUP_INTERVAL_HOURS * 60 * 60 * 1000
                    );

                    // 1. Clean up Expired Challenges
                    const deletedChallenges = await prisma.challenge.deleteMany({
                        where: { expiresAt: { lt: new Date() } },
                    });
                    if (deletedChallenges.count > 0) {
                        logger.info(
                            { count: deletedChallenges.count },
                            'Removed expired challenges'
                        );
                    }

                    // 2. Clean up Old Unverified Wallets
                    const staleWallets = await prisma.wallet.findMany({
                        where: {
                            isVerified: false,
                            createdAt: { lt: cutoffDate },
                        },
                    });

                    if (staleWallets.length > 0) {
                        const staleWalletAddresses = staleWallets.map(
                            (w) => w.address
                        );

                        const activeChallenges = await prisma.challenge.findMany({
                            where: {
                                walletAddress: { in: staleWalletAddresses },
                                expiresAt: { gt: new Date() },
                            },
                        });

                        const walletsToDelete = staleWallets.filter(
                            (w) =>
                                !activeChallenges.some(
                                    (c) => c.walletAddress === w.address
                                )
                        );

                        if (walletsToDelete.length > 0) {
                            const deletedWallets = await prisma.wallet.deleteMany({
                                where: {
                                    address: {
                                        in: walletsToDelete.map((w) => w.address),
                                    },
                                },
                            });

                            if (deletedWallets.count > 0) {
                                logger.info(
                                    { count: deletedWallets.count },
                                    `Removed stale wallets (>${CLEANUP_INTERVAL_HOURS}h old)`
                                );
                            }
                        }
                    }
                }, 'Database Cleanup');
            } catch (e) {
                logger.error({ err: e }, 'Cleanup job failed after retries');
            }
        });
    } catch (e) {
        logger.error({ err: e }, 'Failed to start cleanup job');
    }
};

module.exports = cleanupWalletsJob;
