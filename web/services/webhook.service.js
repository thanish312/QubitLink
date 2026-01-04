const logger = require('../../utils/logger');
const { prisma } = require('../../services/prisma');
const easyConnectSchema = require('../../schemas/webhook');
const { verifyTransactionOnChain, getQubicBalance } = require('../../services/qubic.service');
const { addRoleSafe, removeRoleSafe } = require('../../services/discord.service');
const { sleep } = require('../../utils/helpers');
const CONFIG = require('../../config/config');

const validatePayload = (payload, requestId) => {
    const validationResult = easyConnectSchema.safeParse(payload);
    if (!validationResult.success) {
        logger.warn(
            { requestId, validationError: validationResult.error.errors[0] },
            '[Layer 1] Schema validation failed'
        );
        return null;
    }
    return validationResult.data;
};

const preventReplay = async (txId, requestId) => {
    try {
        await prisma.processedTransaction.create({ data: { txId } });
        logger.info({ requestId, txId }, '[Layer 3] Transaction logged as processed');
        return true;
    } catch (error) {
        if (error.code === 'P2002') {
            logger.warn(
                { requestId, txId },
                `[Layer 3] Replay attack detected - txId: ${txId.substring(0, 12)}...`
            );
            return false;
        }
        throw error;
    }
};

const verifyOnChain = async (txId, sourceId, amount, requestId) => {
    const isOnChainValid = await verifyTransactionOnChain(txId, sourceId, amount);
    if (!isOnChainValid) {
        logger.warn(
            { requestId, txId },
            `[Layer 2] On-chain verification failed for txId: ${txId.substring(0, 12)}...`
        );
    }
    return isOnChainValid;
};

const matchChallenge = async (walletAddress, numberOfShares, requestId) => {
    logger.info({ requestId, walletAddress, numberOfShares }, 'Searching for challenge');
    const challenge = await prisma.challenge.findFirst({
        where: {
            walletAddress: walletAddress,
            signalCode: numberOfShares,
            expiresAt: { gt: new Date() },
        },
    });
    if (!challenge) {
        logger.debug({ requestId, walletAddress }, 'No matching challenge found');
    }
    return challenge;
};

const preventTheft = async (walletAddress, challenge, requestId) => {
    const existingWallet = await prisma.wallet.findUnique({ where: { address: walletAddress } });
    if (
        existingWallet &&
        existingWallet.userId !== challenge.discordId &&
        existingWallet.isVerified
    ) {
        logger.warn(
            {
                requestId,
                walletAddress,
                ownerId: existingWallet.userId,
                thiefId: challenge.discordId,
            },
            'Wallet theft attempt blocked'
        );
        await prisma.challenge.delete({ where: { id: challenge.id } });
        return false;
    }
    return true;
};

const verifyWalletAndUser = async (walletAddress, discordId, requestId, txPrisma) => {
    await txPrisma.wallet.upsert({
        where: { address: walletAddress },
        update: { isVerified: true, verifiedAt: new Date(), userId: discordId },
        create: {
            address: walletAddress,
            userId: discordId,
            isVerified: true,
            verifiedAt: new Date(),
        },
    });

    await txPrisma.portfolio.upsert({
        where: { userId: discordId },
        update: {},
        create: { userId: discordId, totalBalance: 0n },
    });

    logger.info({ requestId, walletAddress, discordId }, 'Wallet verified and portfolio entry created');
};

const assignRolesAndNotify = async (req, challenge, walletAddress, parsed, txPrisma, requestId) => {
    try {
        const client = req.app.get('discord_client');
        const guild = await client.guilds.fetch(CONFIG.GUILD_ID);
        const member = await guild.members.fetch(challenge.discordId);

        const roleThresholds = await txPrisma.roleThreshold.findMany({ orderBy: { threshold: 'desc' } });
        if (roleThresholds.length === 0) {
            logger.warn({ requestId }, 'No role thresholds configured in DB. Skipping role assignment.');
            return;
        }

        const allWallets = await txPrisma.wallet.findMany({
            where: { userId: challenge.discordId, isVerified: true },
        });

        let totalNetWorth = 0n;
        for (const w of allWallets) {
            totalNetWorth += await getQubicBalance(w.address);
            await sleep(CONFIG.RATE_LIMIT_DELAY_MS);
        }

        const targetRoleThreshold = roleThresholds.reduce((acc, role) => {
            if (totalNetWorth >= role.threshold) return role;
            return acc;
        }, null);

        if (targetRoleThreshold) {
            await addRoleSafe(member, targetRoleThreshold.roleId, targetRoleThreshold.roleName);
            logger.info(
                {
                    requestId,
                    userId: member.id,
                    roleName: targetRoleThreshold.roleName,
                    netWorth: totalNetWorth.toString(),
                },
                'Target role assigned.'
            );
        }

        for (const role of roleThresholds) {
            if (
                ((targetRoleThreshold && role.roleId !== targetRoleThreshold.roleId) ||
                    !targetRoleThreshold) &&
                member.roles.cache.has(role.roleId)
            ) {
                await removeRoleSafe(member, role.roleId, role.roleName);
            }
        }

        await member
            .send({
                content: `## 🎉 Verification Successful!\n\n**Wallet:** ${walletAddress}\n**Transaction:** ${parsed.NumberOfShares} ${parsed.AssetName} @ ${parsed.Price} QU\n**Portfolio:** ${allWallets.length} Wallet(s)\n**Net Worth:** ${totalNetWorth.toString()} QUBIC\n\n*Your roles have been updated instantly.*`,
            })
            .catch(() =>
                logger.warn({ requestId, discordId: challenge.discordId }, 'Could not DM user')
            );

        logger.info({ requestId, userId: member.id }, 'User notified and roles assigned');
    } catch (err) {
        logger.error(
            { err, requestId, discordId: challenge.discordId },
            'Discord operations (role assignment/DM) failed'
        );
    }
};

const cleanup = async (walletAddress, requestId, txPrisma) => {
    await txPrisma.challenge.deleteMany({ where: { walletAddress: walletAddress } });
    logger.info({ requestId, walletAddress }, 'Challenge cleaned up');
};

const processWebhook = async (req, requestId) => {
    const batch = req.body;
    const transactions = Array.isArray(batch) ? batch : [batch];

    logger.info(
        { requestId, transactionCount: transactions.length },
        'Processing transaction(s) in background'
    );

    let processed = 0;
    let skipped = 0;

    for (const payload of transactions) {
        try {
            const validatedPayload = validatePayload(payload, requestId);
            if (!validatedPayload) {
                skipped++;
                continue;
            }

            const tx = validatedPayload.RawTransaction.transaction;
            const parsed = validatedPayload.ParsedTransaction;

            if (!(await preventReplay(tx.txId, requestId))) {
                skipped++;
                continue;
            }

            const challenge = await matchChallenge(tx.sourceId, parsed.NumberOfShares, requestId);
            if (!challenge) {
                skipped++;
                continue;
            }

            const isTxValid = await verifyOnChain(tx.txId, tx.sourceId, tx.amount, requestId);
            if (!isTxValid) {
                skipped++;
                continue;
            }

            if (!(await preventTheft(tx.sourceId, challenge, requestId))) {
                skipped++;
                continue;
            }

            await prisma.$transaction(async (txPrisma) => {
                await verifyWalletAndUser(tx.sourceId, challenge.discordId, requestId, txPrisma);
                await assignRolesAndNotify(
                    req,
                    challenge,
                    tx.sourceId,
                    parsed,
                    txPrisma,
                    requestId
                );
                await cleanup(tx.sourceId, requestId, txPrisma);
            });

            processed++;
        } catch (error) {
            logger.error({ err: error, requestId }, 'Transaction processing error');
            skipped++;
        }
    }

    logger.info({ requestId, processed, skipped }, 'Webhook background processing complete');
};

module.exports = { processWebhook };
