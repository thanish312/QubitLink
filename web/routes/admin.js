const asyncHandler = require('../../utils/asyncHandler');
const logger = require('../../utils/logger');
const express = require('express');
const router = express.Router();
const { prisma } = require('../../services/prisma');
const {
    adminAuth,
    adminCors,
    generateAdminToken,
} = require('../../middleware/auth');
const { getQubicBalance } = require('../../services/qubic.service');
const { addRoleSafe, removeRoleSafe } = require('../../services/discord.service');
const CONFIG = require('../../config/config');

const { runPortfolioRefresh } = require('../../jobs/portfolioRefresh');

// Make the config object immutable
Object.freeze(CONFIG);

// Apply CORS only in development. In production, requests are same-origin.
if (process.env.NODE_ENV !== 'production') {
    router.use(adminCors);
}

/**
 * Manual Job Triggers
 */
router.post(
    '/jobs/refresh',
    adminAuth,
    asyncHandler(async (req, res) => {
        logger.info('[Admin] Manual portfolio refresh triggered');
        const { portfolioTask } = req.app.get('tasks');
        const client = req.app.get('discord_client');

        if (!portfolioTask || !client) {
            logger.error(
                '[Admin] Portfolio refresh task or Discord client not found.'
            );
            return res
                .status(500)
                .json({ error: 'Task or client not available.' });
        }

        // Stop the scheduled task to prevent race conditions
        portfolioTask.stop();
        logger.info('[Admin] Scheduled portfolio task stopped for manual run.');

        try {
            // Await the completion of the manual run
            const result = await runPortfolioRefresh(client);

            logger.info(
                '[Admin] Manual portfolio refresh completed successfully.'
            );
            res.status(200).json({
                message:
                    'Manual portfolio and role refresh completed successfully.',
                result,
            });
        } catch (error) {
            logger.error(
                { err: error },
                '[Admin] Manual portfolio refresh failed.'
            );
            res.status(500).json({
                error: 'An error occurred during the manual refresh.',
            });
        } finally {
            // Always restart the scheduled task
            portfolioTask.start();
            logger.info('[Admin] Scheduled portfolio task restarted.');
        }
    })
);

/**
 * Admin Authentication
 */
router.post(
    '/auth',
    asyncHandler(async (req, res) => {
        const { password } = req.body;

        if (!process.env.ADMIN_PASSWORD) {
            logger.error(
                '[Admin] ADMIN_PASSWORD environment variable not set.'
            );
            return res
                .status(500)
                .json({ error: 'Server configuration error' });
        }

        if (password === process.env.ADMIN_PASSWORD) {
            const token = generateAdminToken();
            logger.info('[Admin] Authentication successful');
            res.json({ token });
        } else {
            logger.warn('[Admin] Authentication failed');
            res.status(401).json({ error: 'Invalid password' });
        }
    })
);

/**
 * Dashboard Statistics
 */
router.get(
    '/stats',
    adminAuth,
    asyncHandler(async (req, res) => {
        const [
            totalVerified,
            pendingChallenges,
            totalUsers,
            recentVerifications,
        ] = await Promise.all([
            prisma.wallet.count({ where: { isVerified: true } }),
            prisma.challenge.count({
                where: { expiresAt: { gt: new Date() } },
            }),
            prisma.user.count(),
            prisma.wallet.count({
                where: {
                    isVerified: true,
                    verifiedAt: { gte: new Date(Date.now() - 86400000) },
                },
            }),
        ]);

        res.json({
            totalVerified,
            pendingChallenges,
            totalUsers,
            recentVerifications,
        });
    })
);

/**
 * Get Configuration
 */
router.get(
    '/config',
    adminAuth,
    asyncHandler(async (req, res) => {
        res.json({
            signalCodeMin: CONFIG.SIGNAL_CODE_MIN.toString(),
            signalCodeMax: CONFIG.SIGNAL_CODE_MAX.toString(),
            challengeExpiryMs: CONFIG.CHALLENGE_EXPIRY_MS.toString(),
        });
    })
);

/**
 * Role Threshold Management
 */
router.get(
    '/roles',
    adminAuth,
    asyncHandler(async (req, res) => {
        const roles = await prisma.roleThreshold.findMany({
            orderBy: { threshold: 'asc' },
        });
        res.json(roles);
    })
);

router.post(
    '/roles',
    adminAuth,
    asyncHandler(async (req, res) => {
        const { roleId, roleName, threshold } = req.body;
        try {
            const newRole = await prisma.roleThreshold.create({
                data: {
                    roleId,
                    roleName,
                    threshold: BigInt(threshold),
                },
            });
            res.status(201).json(newRole);
        } catch (error) {
            if (error.code === 'P2002') {
                return res
                    .status(409)
                    .json({ error: 'A role with this ID already exists.' });
            }
            throw error;
        }
    })
);

router.put(
    '/roles/:id',
    adminAuth,
    asyncHandler(async (req, res) => {
        const { id } = req.params;
        const { roleId, roleName, threshold } = req.body;
        const updatedRole = await prisma.roleThreshold.update({
            where: { id },
            data: {
                roleId,
                roleName,
                threshold: BigInt(threshold),
            },
        });
        res.json(updatedRole);
    })
);

router.delete(
    '/roles/:id',
    adminAuth,
    asyncHandler(async (req, res) => {
        const { id } = req.params;
        await prisma.roleThreshold.delete({ where: { id } });
        res.status(204).send();
    })
);

/**
 * Get All Wallets (FIXED FRONTEND COMPATIBILITY)
 */
router.get(
    '/wallets',
    adminAuth,
    asyncHandler(async (req, res) => {
        const wallets = await prisma.wallet.findMany({
            orderBy: { verifiedAt: 'desc' },
            take: 100,
        });

        res.json(wallets);
    })
);

/**
 * Delete Wallet
 */
router.delete(
    '/wallets/:id',
    adminAuth,
    asyncHandler(async (req, res) => {
        const targetId = req.params.id;

        // Safety check for the "undefined" issue
        if (!targetId || targetId === 'undefined') {
            logger.error('[Admin] Delete failed: Frontend sent "undefined" ID');
            return res.status(400).json({ error: 'Invalid Wallet Address' });
        }

        await prisma.wallet.deleteMany({ where: { address: targetId } });
        logger.info(`[Admin] Wallet deleted: ${targetId}`);
        res.json({ success: true });
    })
);

/**
 * Manually Verify Wallet
 */
router.post(
    '/wallets/:id/verify',
    adminAuth,
    asyncHandler(async (req, res) => {
        const walletAddress = req.params.id;

        // Safety check for the "undefined" issue
        if (!walletAddress || walletAddress === 'undefined') {
            logger.error('[Admin] Verify failed: Frontend sent "undefined" ID');
            return res.status(400).json({ error: 'Invalid Wallet Address' });
        }

        let wallet;
        let discordUserId;

        // Fetch all role thresholds once
        const roleThresholds = await prisma.roleThreshold.findMany({
            orderBy: { threshold: 'desc' },
        });

        if (roleThresholds.length === 0) {
            logger.warn(
                '[Admin] No role thresholds configured in DB. Skipping dynamic role assignment.'
            );
            // Proceed with basic verification but skip dynamic roles
        }

        // 1. Check if wallet already exists
        const existingWallet = await prisma.wallet.findUnique({
            where: { address: walletAddress },
        });

        if (existingWallet) {
            discordUserId = existingWallet.userId;
            wallet = await prisma.wallet.update({
                where: { address: walletAddress },
                data: { isVerified: true, verifiedAt: new Date() },
            });
        } else {
            // 2. Wallet doesn't exist, find the owner via Challenge
            const challenge = await prisma.challenge.findFirst({
                where: { walletAddress: walletAddress },
                orderBy: { createdAt: 'desc' },
            });

            if (!challenge) {
                return res.status(404).json({
                    error: 'Wallet not found in DB and no pending challenge found.',
                });
            }

            discordUserId = challenge.discordId;

            // Ensure User exists
            await prisma.user.upsert({
                where: { discordId: discordUserId },
                update: {},
                create: { discordId: discordUserId },
            });

            // Create Verified Wallet
            wallet = await prisma.wallet.create({
                data: {
                    address: walletAddress,
                    userId: discordUserId,
                    isVerified: true,
                    verifiedAt: new Date(),
                },
            });
        }

        logger.info(
            `[Admin] Wallet manually verified: ${wallet.address.substring(0, 12)}...`
        );

        // Assign Roles
        try {
            const client = req.app.get('discord_client');
            const guild = await client.guilds.fetch(CONFIG.GUILD_ID);
            const member = await guild.members.fetch(discordUserId);

            // Calculate total net worth for dynamic roles
            const userWallets = await prisma.wallet.findMany({
                where: { userId: discordUserId, isVerified: true },
            });

            let total = 0n;
            for (const w of userWallets) {
                try {
                    total += await getQubicBalance(w.address);
                } catch (e) {
                    logger.warn(
                        { walletAddress: w.address, err: e },
                        '[Admin] Failed to get Qubic balance for role assignment.'
                    );
                }
            }

            // Find the highest role the user qualifies for.
            const targetRoleThreshold = roleThresholds.find(role => {
                const comparison = BigInt(total) >= BigInt(role.threshold);
                logger.debug(
                    { 
                        roleName: role.roleName, 
                        netWorth: total.toString(), 
                        threshold: role.threshold.toString(), 
                        isMet: comparison 
                    },
                    '[Admin] Comparing net worth to role threshold for manual verification.'
                );
                return comparison;
            });

            // Assign target role
            if (targetRoleThreshold) {
                await addRoleSafe(
                    member,
                    targetRoleThreshold.roleId,
                    targetRoleThreshold.roleName
                );
            }

            // Remove other threshold-based roles if no longer applicable
            for (const role of roleThresholds) {
                if (
                    (!targetRoleThreshold || role.roleId !== targetRoleThreshold.roleId) &&
                    member.roles.cache.has(role.roleId)
                ) {
                    await removeRoleSafe(member, role.roleId, role.roleName);
                }
            }

        } catch (error) {
            logger.warn(
                { err: error },
                '[Admin] Discord Role update minor error during manual verification'
            );
        }

        res.json({ success: true });
    })
);

/**
 * Get All Challenges
 */
router.get(
    '/challenges',
    adminAuth,
    asyncHandler(async (req, res) => {
        const challenges = await prisma.challenge.findMany({
            where: { expiresAt: { gt: new Date() } },
            orderBy: { createdAt: 'desc' },
        });

        // Add ID mapping for challenges too, just in case
        const safeChallenges = challenges.map((c) => ({
            ...c,
            // If frontend uses id, it works. If it uses address, it works.
            id: c.id,
        }));

        res.json(safeChallenges);
    })
);

/**
 * Delete Challenge
 */
router.delete(
    '/challenges/:id',
    adminAuth,
    asyncHandler(async (req, res) => {
        await prisma.challenge.delete({ where: { id: req.params.id } });
        logger.info(`[Admin] Challenge deleted: ${req.params.id}`);
        res.json({ success: true });
    })
);

/**
 * Get All Users
 */
router.get(
    '/users',
    adminAuth,
    asyncHandler(async (req, res) => {
        const users = await prisma.user.findMany({
            include: { wallets: { select: { isVerified: true } } },
            orderBy: { createdAt: 'desc' },
        });

        const usersWithCounts = users.map((user) => ({
            discordId: user.discordId,
            createdAt: user.createdAt,
            totalCount: user.wallets.length,
            verifiedCount: user.wallets.filter((w) => w.isVerified).length,
        }));

        res.json(usersWithCounts);
    })
);

/**
 * Get a single user's details
 */
router.get(
    '/users/:discordId',
    adminAuth,
    asyncHandler(async (req, res) => {
        const { discordId } = req.params;

        const user = await prisma.user.findUnique({
            where: { discordId },
            include: {
                wallets: {
                    orderBy: { createdAt: 'desc' },
                },
            },
        });

        if (!user) {
            return res.status(404).json({ error: 'User not found' });
        }

        const challenges = await prisma.challenge.findMany({
            where: { discordId },
            orderBy: { createdAt: 'desc' },
            take: 10,
        });

        const client = req.app.get('discord_client');
        const discordUser = await client.users.fetch(discordId);

        res.json({ ...user, challenges, discordUser });
    })
);

/**
 * Get Activity Log
 */
router.get(
    '/activity',
    adminAuth,
    asyncHandler(async (req, res) => {
        const [recentVerifications, recentChallenges] = await Promise.all([
            prisma.wallet.findMany({
                where: { isVerified: true, verifiedAt: { not: null } },
                orderBy: { verifiedAt: 'desc' },
                take: 20,
                select: { address: true, verifiedAt: true, userId: true },
            }),
            prisma.challenge.findMany({
                orderBy: { createdAt: 'desc' },
                take: 20,
                select: {
                    walletAddress: true,
                    createdAt: true,
                    signalCode: true,
                },
            }),
        ]);

        const activity = [
            ...recentVerifications.map((w) => ({
                type: 'verified',
                message: `Wallet ${w.address.substring(0, 12)}... verified`,
                timestamp: w.verifiedAt,
            })),
            ...recentChallenges.map((c) => ({
                type: 'challenge',
                message: `Challenge created: ${c.signalCode} shares`,
                timestamp: c.createdAt,
            })),
        ]
            .sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp))
            .slice(0, 50);

        res.json(activity);
    })
);

logger.info('[Admin] API routes registered');

module.exports = router;
