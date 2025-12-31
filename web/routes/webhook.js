const express = require('express');
const crypto = require('crypto');
const easyConnectSchema = require('../../schemas/webhook');
const prisma =require('../../services/prisma');
const { verifyTransactionOnChain, getQubicBalance } = require('../../services/qubic.service');
const { addRoleSafe } = require('../../services/discord.service');
const { sleep } = require('../../utils/helpers');
const CONFIG = require('../../config/config');

const router = express.Router();

const processWebhook = async (req, requestId) => {
    const batch = req.body;
    const transactions = Array.isArray(batch) ? batch : [batch];

    console.info(`[${requestId}] Processing ${transactions.length} transaction(s) in background`);

    let processed = 0;
    let skipped = 0;

    for (const payload of transactions) {
        try {
            // Layer 1: Schema Validation
            const validationResult = easyConnectSchema.safeParse(payload);
            if (!validationResult.success) {
                console.warn(`[${requestId}] [Layer 1] Schema validation failed:`, validationResult.error.errors[0]);
                skipped++;
                continue;
            }
            
            const validatedPayload = validationResult.data;
            const tx = validatedPayload.RawTransaction.transaction;
            const parsed = validatedPayload.ParsedTransaction;

            console.info(`[${requestId}] [Layer 1] Valid schema - txId: ${tx.txId.substring(0,12)}...`);
            console.debug(`[${requestId}] Transaction details: ${parsed.NumberOfShares} ${parsed.AssetName} @ ${parsed.Price} QU from ${tx.sourceId.substring(0,12)}...`);

            // Layer 3: Replay Protection
            try {
                await prisma.processedTransaction.create({
                    data: { txId: tx.txId }
                });
                console.info(`[${requestId}] [Layer 3] Transaction logged as processed`);
            } catch (error) {
                if (error.code === 'P2002') {
                    console.warn(`[${requestId}] [Layer 3] Replay attack detected - txId: ${tx.txId.substring(0,12)}...`);
                    skipped++;
                    continue;
                }
                throw error;
            }

            // Layer 2: On-chain Verification
            const isOnChainValid = await verifyTransactionOnChain(tx.txId, tx.sourceId, tx.amount);
            if (!isOnChainValid) {
                console.warn(`[${requestId}] [Layer 2] On-chain verification failed for txId: ${tx.txId.substring(0,12)}...`);
                skipped++;
                continue;
            }

            // Challenge Matching
            const walletAddress = tx.sourceId;
            const numberOfShares = parsed.NumberOfShares;

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
                skipped++;
                continue;
            }

            console.info(`[${requestId}] Challenge matched - User: ${challenge.discordId}`);

            // Anti-theft Protection
            const existingWallet = await prisma.wallet.findUnique({
                where: { address: walletAddress } 
            });
            
            if (existingWallet && existingWallet.userId !== challenge.discordId && existingWallet.isVerified) {
                console.warn(`[${requestId}] Wallet theft attempt blocked - Wallet owned by ${existingWallet.userId}, attempted by ${challenge.discordId}`);
                await prisma.challenge.delete({ where: { id: challenge.id } });
                skipped++;
                continue;
            }

            // Wallet Verification
            await prisma.wallet.upsert({
                where: { address: walletAddress },
                update: { 
                    isVerified: true, 
                    verifiedAt: new Date(), 
                    userId: challenge.discordId 
                },
                create: { 
                    address: walletAddress, 
                    userId: challenge.discordId, 
                    isVerified: true, 
                    verifiedAt: new Date() 
                }
            });

            console.info(`[${requestId}] Wallet verified and saved to database`);

            // Calculate Total Portfolio
            const allWallets = await prisma.wallet.findMany({ 
                where: { userId: challenge.discordId, isVerified: true } 
            });
            
            let totalNetWorth = 0n;
            for (const w of allWallets) { 
                totalNetWorth += await getQubicBalance(w.address);
                await sleep(CONFIG.RATE_LIMIT_DELAY_MS);
            }

            console.info(`[${requestId}] Portfolio calculated - User: ${challenge.discordId}, Wallets: ${allWallets.length}, Net Worth: ${totalNetWorth.toString()} QUBIC`);

            // Discord Role Assignment
            try {
                const guild = await req.app.get('discord_client').guilds.fetch(CONFIG.GUILD_ID);
                const member = await guild.members.fetch(challenge.discordId);
                
                await addRoleSafe(member, CONFIG.ROLES.VERIFIED, "VERIFIED");
                
                if (totalNetWorth >= CONFIG.WHALE_THRESHOLD) {
                    await addRoleSafe(member, CONFIG.ROLES.WHALE, "WHALE");
                }

                await member.send({
                    content: `## 🎉 Verification Successful!\n\n**Wallet:** 
${walletAddress}
**Transaction:** ${numberOfShares} ${parsed.AssetName} @ ${parsed.Price} QU
**Portfolio:** ${allWallets.length} Wallet(s)
**Net Worth:** 
${totalNetWorth.toString()} QUBIC

*Your roles have been updated instantly.*`
                }).catch(() => console.warn(`[${requestId}] Could not DM user ${challenge.discordId}`));

                console.info(`[${requestId}] User notified and roles assigned`);
            } catch (err) { 
                console.error(`[${requestId}] Discord operations failed: ${err.message}`); 
            } 

            // Cleanup
            await prisma.challenge.deleteMany({ 
                where: { walletAddress: walletAddress } 
            });
            
            console.info(`[${requestId}] Challenge cleaned up`);
            processed++;

        } catch (error) {
            console.error(`[${requestId}] Transaction processing error:`, error);
            skipped++;
        }
    }
    console.info(`[${requestId}] Webhook background processing complete - Processed: ${processed}, Skipped: ${skipped}`);
};

/**
 * Webhook endpoint for EasyConnect transaction notifications
 */
router.post('/qubic', (req, res) => {
    const requestId = crypto.randomBytes(4).toString('hex');
    console.info(`[${requestId}] Webhook request received`);

    // Acknowledge the request immediately to prevent timeouts
    res.status(200).json({
        success: true, 
        message: "Webhook received and is being processed.",
        requestId 
    });

    // Process the webhook in the background
    processWebhook(req, requestId).catch(error => {
        console.error(`[${requestId}] Unhandled error in background webhook processing:`, error);
    });
});

module.exports = router;
