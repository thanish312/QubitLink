const prisma = require('../../services/prisma');
const easyConnectSchema = require('../../schemas/webhook');
const { verifyTransactionOnChain, getQubicBalance } = require('../../services/qubic.service');
const { addRoleSafe } = require('../../services/discord.service');
const { sleep } = require('../../utils/helpers');
const CONFIG = require('../../config/config');

const validatePayload = (payload, requestId) => {
    const validationResult = easyConnectSchema.safeParse(payload);
    if (!validationResult.success) {
        console.warn(`[${requestId}] [Layer 1] Schema validation failed:`, validationResult.error.errors[0]);
        return null;
    }
    return validationResult.data;
};

const preventReplay = async (txId, requestId) => {
    try {
        await prisma.processedTransaction.create({
            data: { txId }
        });
        console.info(`[${requestId}] [Layer 3] Transaction logged as processed`);
        return true;
    } catch (error) {
        if (error.code === 'P2002') {
            console.warn(`[${requestId}] [Layer 3] Replay attack detected - txId: ${txId.substring(0,12)}...`);
            return false;
        }
        throw error;
    }
};

const verifyOnChain = async (txId, sourceId, amount, requestId) => {
    const isOnChainValid = await verifyTransactionOnChain(txId, sourceId, amount);
    if (!isOnChainValid) {
        console.warn(`[${requestId}] [Layer 2] On-chain verification failed for txId: ${txId.substring(0,12)}...`);
    }
    return isOnChainValid;
};

const matchChallenge = async (walletAddress, numberOfShares, requestId) => {
    console.info(`[${requestId}] Searching for challenge: wallet=${walletAddress.substring(0,12)}..., shares=${numberOfShares}`);
    const challenge = await prisma.challenge.findFirst({
        where: {
            walletAddress: walletAddress,
            signalCode: numberOfShares,
            expiresAt: { gt: new Date() }
        },
    });

    if (!challenge) {
        console.debug(`[${requestId}] No matching challenge found`);
    }
    return challenge;
};

const preventTheft = async (walletAddress, challenge, requestId) => {
    const existingWallet = await prisma.wallet.findUnique({
        where: { address: walletAddress } 
    });
    
    if (existingWallet && existingWallet.userId !== challenge.discordId && existingWallet.isVerified) {
        console.warn(`[${requestId}] Wallet theft attempt blocked - Wallet owned by ${existingWallet.userId}, attempted by ${challenge.discordId}`);
        await prisma.challenge.delete({ where: { id: challenge.id } });
        return false;
    }
    return true;
};

const verifyWallet = async (walletAddress, discordId, requestId) => {
    await prisma.wallet.upsert({
        where: { address: walletAddress },
        update: { 
            isVerified: true, 
            verifiedAt: new Date(), 
            userId: discordId 
        },
        create: { 
            address: walletAddress, 
            userId: discordId, 
            isVerified: true, 
            verifiedAt: new Date() 
        }
    });
    console.info(`[${requestId}] Wallet verified and saved to database`);
};

const calculatePortfolio = async (discordId, requestId) => {
    const allWallets = await prisma.wallet.findMany({ 
        where: { userId: discordId, isVerified: true } 
    });
    
    let totalNetWorth = 0n;
    for (const w of allWallets) { 
        totalNetWorth += await getQubicBalance(w.address);
        await sleep(CONFIG.RATE_LIMIT_DELAY_MS);
    }
    console.info(`[${requestId}] Portfolio calculated - User: ${discordId}, Wallets: ${allWallets.length}, Net Worth: ${totalNetWorth.toString()} QUBIC`);
    return { allWallets, totalNetWorth };
};

const assignRolesAndNotify = async (req, challenge, walletAddress, parsed, allWallets, totalNetWorth, requestId) => {
    try {
        const guild = await req.app.get('discord_client').guilds.fetch(CONFIG.GUILD_ID);
        const member = await guild.members.fetch(challenge.discordId);
        
        await addRoleSafe(member, CONFIG.ROLES.VERIFIED, "VERIFIED");
        
        if (totalNetWorth >= CONFIG.WHALE_THRESHOLD) {
            await addRoleSafe(member, CONFIG.ROLES.WHALE, "WHALE");
        }

        await member.send({
            content: `## 🎉 Verification Successful!\n\n**Wallet:** ${walletAddress}\n**Transaction:** ${parsed.NumberOfShares} ${parsed.AssetName} @ ${parsed.Price} QU\n**Portfolio:** ${allWallets.length} Wallet(s)\n**Net Worth:** ${totalNetWorth.toString()} QUBIC\n\n*Your roles have been updated instantly.*`
        }).catch(() => console.warn(`[${requestId}] Could not DM user ${challenge.discordId}`));

        console.info(`[${requestId}] User notified and roles assigned`);
    } catch (err) { 
        console.error(`[${requestId}] Discord operations failed: ${err.message}`); 
    } 
};

const cleanup = async (walletAddress, requestId) => {
    await prisma.challenge.deleteMany({ 
        where: { walletAddress: walletAddress } 
    });
    console.info(`[${requestId}] Challenge cleaned up`);
};

const processWebhook = async (req, requestId) => {
    const batch = req.body;
    const transactions = Array.isArray(batch) ? batch : [batch];

    console.info(`[${requestId}] Processing ${transactions.length} transaction(s) in background`);

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

            // --- CHANGED: RPC Check First ---
            // 1. Verify on Blockchain (Ensures we don't save junk to DB)
            if (!await verifyOnChain(tx.txId, tx.sourceId, tx.amount, requestId)) {
                skipped++;
                continue;
            }

            // 2. Prevent Replay (Now only runs if RPC was successful)
            // This also saves the txId to the DB to stop future duplicates
            if (!await preventReplay(tx.txId, requestId)) {
                skipped++;
                continue;
            }
            // --------------------------------

            const challenge = await matchChallenge(tx.sourceId, parsed.NumberOfShares, requestId);
            if (!challenge) {
                skipped++;
                continue;
            }

            if (!await preventTheft(tx.sourceId, challenge, requestId)) {
                skipped++;
                continue;
            }

            await prisma.$transaction(async (prisma) => {
                await verifyWallet(tx.sourceId, challenge.discordId, requestId);
                // Note: In the future, consider moving these out of the transaction for speed
                const { allWallets, totalNetWorth } = await calculatePortfolio(challenge.discordId, requestId);
                await assignRolesAndNotify(req, challenge, tx.sourceId, parsed, allWallets, totalNetWorth, requestId);
                await cleanup(tx.sourceId, requestId);
            });

            processed++;

        } catch (error) {
            console.error(`[${requestId}] Transaction processing error:`, error);
            skipped++;
        }
    }
    console.info(`[${requestId}] Webhook background processing complete - Processed: ${processed}, Skipped: ${skipped}`);
};

module.exports = {
    processWebhook
};
