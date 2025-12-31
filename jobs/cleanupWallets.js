const cron = require('node-cron');
const prisma = require('../services/prisma');
const { Prisma } = require('@prisma/client');

const CLEANUP_INTERVAL_MINUTES = 15;

/**
 * Scheduled job to clean up old, unverified wallets from the database.
 */
const cleanupWalletsJob = () => cron.schedule('*/5 * * * *', async () => { // Runs every 5 minutes
    console.info('=== Unverified Wallet Cleanup Started ===');
    const startTime = Date.now();

    try {
        const cutoffDate = new Date(Date.now() - CLEANUP_INTERVAL_MINUTES * 60 * 1000);

        const deletedWallets = await prisma.wallet.deleteMany({
            where: {
                isVerified: false,
                createdAt: {
                    lt: cutoffDate,
                },
            },
        });

        if (deletedWallets.count > 0) {
            console.info(`Cleaned up ${deletedWallets.count} unverified wallet(s).`);
        } else {
            console.info('No unverified wallets to clean up.');
        }

    } catch (error) {
        // P2025 is the error code for "record to delete not found", which is fine.
        if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2025') {
            console.info('No unverified wallets to clean up.');
        } else {
            console.error(`Unverified wallet cleanup critical failure: ${error.message}`);
        }
    }

    const duration = Date.now() - startTime;
    console.info(`=== Unverified Wallet Cleanup Complete - Duration: ${duration}ms ===`);
});

module.exports = cleanupWalletsJob;
