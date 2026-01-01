const express = require('express');
const router = express.Router();
const prisma = require('../../services/prisma');
const { adminAuth, adminCors, generateAdminToken } = require('../../middleware/auth');
const { getQubicBalance } = require('../../services/qubic.service');
const { addRoleSafe } = require('../../services/discord.service');
const CONFIG = require('../../config/config');

// Make the config object immutable
Object.freeze(CONFIG);

// Apply CORS to all admin routes
router.use(adminCors);

/**
 * Admin Authentication
 */
router.post('/auth', async (req, res) => {
    const { password } = req.body;
    
    if (!process.env.ADMIN_PASSWORD) {
        console.error('[Admin] ADMIN_PASSWORD environment variable not set.');
        return res.status(500).json({ error: 'Server configuration error' });
    }

    if (password === process.env.ADMIN_PASSWORD) {
        const token = generateAdminToken();
        console.info('[Admin] Authentication successful');
        res.json({ token });
    } else {
        console.warn('[Admin] Authentication failed');
        res.status(401).json({ error: 'Invalid password' });
    }
});

/**
 * Dashboard Statistics
 */
router.get('/stats', adminAuth, async (req, res) => {
    try {
        const [totalVerified, pendingChallenges, totalUsers, recentVerifications] = await Promise.all([
            prisma.wallet.count({ where: { isVerified: true } }),
            prisma.challenge.count({ where: { expiresAt: { gt: new Date() } } }),
            prisma.user.count(),
            prisma.wallet.count({
                where: {
                    isVerified: true,
                    verifiedAt: { gte: new Date(Date.now() - 86400000) }
                }
            })
        ]);

        res.json({ totalVerified, pendingChallenges, totalUsers, recentVerifications });
    } catch (error) {
        // Handle database sleep/connection errors gracefully
        console.error('[Admin] Stats fetch error (DB might be sleeping):', error.message);
        res.status(500).json({ error: 'Database connection error' });
    }
});

/**
 * Get Configuration
 */
router.get('/config', adminAuth, async (req, res) => {
    res.json({
        verifiedRoleId: CONFIG.ROLES.VERIFIED || '',
        whaleRoleId: CONFIG.ROLES.WHALE || '',
        whaleThreshold: CONFIG.WHALE_THRESHOLD.toString(),
        signalCodeMin: CONFIG.SIGNAL_CODE_MIN.toString(),
        signalCodeMax: CONFIG.SIGNAL_CODE_MAX.toString(),
        challengeExpiryMs: CONFIG.CHALLENGE_EXPIRY_MS.toString()
    });
});

/**
 * Get All Wallets (FIXED FRONTEND COMPATIBILITY)
 */
router.get('/wallets', adminAuth, async (req, res) => {
    try {
        const wallets = await prisma.wallet.findMany({
            orderBy: { verifiedAt: 'desc' },
            take: 100
        });

        // MAGIC FIX: We map 'address' to 'id' so your Frontend code finds the ID it expects.
        const compatibleWallets = wallets.map(w => ({
            ...w,
            id: w.address // <--- This fixes the "undefined" error in your dashboard buttons
        }));

        res.json(compatibleWallets);
    } catch (error) {
        console.error('[Admin] Wallets fetch error:', error);
        res.status(500).json({ error: 'Failed to fetch wallets' });
    }
});

/**
 * Delete Wallet
 */
router.delete('/wallets/:id', adminAuth, async (req, res) => {
    const targetId = req.params.id;

    // Safety check for the "undefined" issue
    if (!targetId || targetId === 'undefined') {
        console.error('[Admin] Delete failed: Frontend sent "undefined" ID');
        return res.status(400).json({ error: 'Invalid Wallet Address' });
    }

    try {
        await prisma.wallet.deleteMany({ where: { address: targetId } });
        console.info(`[Admin] Wallet deleted: ${targetId}`);
        res.json({ success: true });
    } catch (error) {
        console.error('[Admin] Wallet delete error:', error);
        res.status(500).json({ error: 'Failed to delete wallet' });
    }
});

/**
 * Manually Verify Wallet
 */
router.post('/wallets/:id/verify', adminAuth, async (req, res) => {
    const walletAddress = req.params.id;

    // Safety check for the "undefined" issue
    if (!walletAddress || walletAddress === 'undefined') {
        console.error('[Admin] Verify failed: Frontend sent "undefined" ID');
        return res.status(400).json({ error: 'Invalid Wallet Address' });
    }
    
    try {
        let wallet;
        let discordUserId;

        // 1. Check if wallet already exists
        const existingWallet = await prisma.wallet.findUnique({
            where: { address: walletAddress }
        });

        if (existingWallet) {
            discordUserId = existingWallet.userId;
            wallet = await prisma.wallet.update({
                where: { address: walletAddress },
                data: { isVerified: true, verifiedAt: new Date() }
            });
        } else {
            // 2. Wallet doesn't exist, find the owner via Challenge
            const challenge = await prisma.challenge.findFirst({
                where: { walletAddress: walletAddress },
                orderBy: { createdAt: 'desc' }
            });

            if (!challenge) {
                return res.status(404).json({ 
                    error: 'Wallet not found in DB and no pending challenge found.' 
                });
            }

            discordUserId = challenge.discordId;

            // Ensure User exists
            await prisma.user.upsert({
                where: { discordId: discordUserId },
                update: {},
                create: { discordId: discordUserId }
            });

            // Create Verified Wallet
            wallet = await prisma.wallet.create({
                data: {
                    address: walletAddress,
                    userId: discordUserId,
                    isVerified: true,
                    verifiedAt: new Date()
                }
            });
        }

        console.info(`[Admin] Wallet manually verified: ${wallet.address.substring(0,12)}...`);

        // Assign Roles
        try {
            const client = req.app.get('discord_client');
            const guild = await client.guilds.fetch(CONFIG.GUILD_ID);
            const member = await guild.members.fetch(discordUserId);
            
            await addRoleSafe(member, CONFIG.ROLES.VERIFIED, "VERIFIED");

            // Check Whales
            const userWallets = await prisma.wallet.findMany({
                where: { userId: discordUserId, isVerified: true }
            });
            
            let total = 0n;
            for (const w of userWallets) {
                try {
                    total += await getQubicBalance(w.address);
                } catch (e) { /* ignore balance error */ }
            }
            
            if (total >= CONFIG.WHALE_THRESHOLD) {
                await addRoleSafe(member, CONFIG.ROLES.WHALE, "WHALE");
            }
        } catch (e) {
            console.warn('[Admin] Discord Role update minor error:', e.message);
        }

        res.json({ success: true });
    } catch (error) {
        console.error('[Admin] Manual verification error:', error);
        res.status(500).json({ error: 'Failed to verify wallet: ' + error.message });
    }
});

/**
 * Get All Challenges
 */
router.get('/challenges', adminAuth, async (req, res) => {
    try {
        const challenges = await prisma.challenge.findMany({
            where: { expiresAt: { gt: new Date() } },
            orderBy: { createdAt: 'desc' }
        });
        
        // Add ID mapping for challenges too, just in case
        const safeChallenges = challenges.map(c => ({
            ...c,
            // If frontend uses id, it works. If it uses address, it works.
            id: c.id 
        }));

        res.json(safeChallenges);
    } catch (error) {
        console.error('[Admin] Challenges fetch error:', error);
        res.status(500).json({ error: 'Failed to fetch challenges' });
    }
});

/**
 * Delete Challenge
 */
router.delete('/challenges/:id', adminAuth, async (req, res) => {
    try {
        await prisma.challenge.delete({ where: { id: req.params.id } });
        console.info(`[Admin] Challenge deleted: ${req.params.id}`);
        res.json({ success: true });
    } catch (error) {
        console.error('[Admin] Challenge delete error:', error);
        res.status(500).json({ error: 'Failed to delete challenge' });
    }
});

/**
 * Get All Users
 */
router.get('/users', adminAuth, async (req, res) => {
    try {
        const users = await prisma.user.findMany({
            include: { wallets: { select: { isVerified: true } } },
            orderBy: { createdAt: 'desc' }
        });

        const usersWithCounts = users.map(user => ({
            discordId: user.discordId,
            createdAt: user.createdAt,
            totalCount: user.wallets.length,
            verifiedCount: user.wallets.filter(w => w.isVerified).length
        }));

        res.json(usersWithCounts);
    } catch (error) {
        console.error('[Admin] Users fetch error:', error);
        res.status(500).json({ error: 'Failed to fetch users' });
    }
});

/**
 * Get Activity Log
 */
router.get('/activity', adminAuth, async (req, res) => {
    try {
        const [recentVerifications, recentChallenges] = await Promise.all([
            prisma.wallet.findMany({
                where: { isVerified: true, verifiedAt: { not: null } },
                orderBy: { verifiedAt: 'desc' },
                take: 20,
                select: { address: true, verifiedAt: true, userId: true }
            }),
            prisma.challenge.findMany({
                orderBy: { createdAt: 'desc' },
                take: 20,
                select: { walletAddress: true, createdAt: true, signalCode: true }
            })
        ]);

        const activity = [
            ...recentVerifications.map(w => ({
                type: 'verified',
                message: `Wallet ${w.address.substring(0,12)}... verified`,
                timestamp: w.verifiedAt
            })),
            ...recentChallenges.map(c => ({
                type: 'challenge',
                message: `Challenge created: ${c.signalCode} shares`,
                timestamp: c.createdAt
            }))
        ].sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp)).slice(0, 50);

        res.json(activity);
    } catch (error) {
        console.error('[Admin] Activity fetch error:', error);
        res.status(500).json({ error: 'Failed to fetch activity' });
    }
});

console.info('[Admin] API routes registered');

module.exports = router;