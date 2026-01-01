const cron = require('node-cron');
const prisma = require('../services/prisma');
const CONFIG = require('../config/config');

// This interval is used to prevent the cleanup job from deleting a wallet
// while a user still has a valid challenge pending. The default is 24 hours.
const CLEANUP_INTERVAL_HOURS = 24;

const cleanupWalletsJob = () => {
    try {
        cron.schedule(CONFIG.CLEANUP_JOB_SCHEDULE, async () => {
            console.info('=== 🧹 Database Cleanup Started ===');
            
            try {
                const cutoffDate = new Date(Date.now() - CLEANUP_INTERVAL_HOURS * 60 * 60 * 1000);
                
                // 1. Clean up Expired Challenges
                // These are safe to delete immediately after they expire.
                const deletedChallenges = await prisma.challenge.deleteMany({
                    where: { expiresAt: { lt: new Date() } }
                });
                if (deletedChallenges.count > 0) {
                    console.info(`   - Removed ${deletedChallenges.count} expired challenges`);
                }

                // 2. Clean up Old Unverified Wallets
                // We only delete them if they are older than the cleanup interval
                // to avoid interfering with active verifications.
                const deletedWallets = await prisma.wallet.deleteMany({
                    where: {
                        isVerified: false,
                        createdAt: { lt: cutoffDate },
                    },
                });
                
                if (deletedWallets.count > 0) {
                    console.info(`   - Removed ${deletedWallets.count} stale wallets (>${CLEANUP_INTERVAL_HOURS}h old)`);
                }
                
            } catch (e) { 
                console.error('Cleanup job error:', e.message); 
            }
        });
    } catch (e) {
        console.error('Failed to start cleanup job:', e.message);
    }
};

module.exports = cleanupWalletsJob;