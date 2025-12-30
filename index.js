/**
 * QubicLink V2 - Production Wallet Verification System
 * 
 * Multi-layer security architecture for Discord wallet verification:
 * - Layer 1: Zod schema validation
 * - Layer 2: On-chain RPC verification
 * - Layer 3: Replay attack protection
 * 
 * @requires dotenv ^16.0.0
 * @requires discord.js ^14.0.0
 * @requires @prisma/client ^5.0.0
 * @requires express ^4.18.0
 * @requires node-cron ^3.0.0
 * @requires zod ^3.22.0
 */

require('dotenv').config();
const { Client, GatewayIntentBits, REST, Routes, SlashCommandBuilder, Events, MessageFlags } = require('discord.js');
const { PrismaClient } = require('@prisma/client');
const express = require('express');
const cron = require('node-cron');
const { z } = require('zod');
const crypto = require('crypto');

const prisma = new PrismaClient();
const client = new Client({ 
    intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMembers] 
});
const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());

// Configuration Constants
const CONFIG = {
    ROLES: {
        VERIFIED: process.env.VERIFIED_ROLE_ID,
        WHALE: process.env.WHALE_ROLE_ID
    },
    WHALE_THRESHOLD: 1000000000n,
    QUBIC_RPC_URL: 'https://rpc.qubic.org',
    CHALLENGE_EXPIRY_MS: 600000, // 10 minutes
    SIGNAL_CODE_MIN: 10000,
    SIGNAL_CODE_MAX: 99999,
    QUBIC_TO_USD: 0.0000006021,
    USD_TO_INR: 83,
    RATE_LIMIT_DELAY_MS: 200
};

// Webhook Payload Schema
const easyConnectSchema = z.object({
    ProcedureTypeName: z.string(),
    ProcedureTypeValue: z.number().int(),
    RawTransaction: z.object({
        transaction: z.object({
            sourceId: z.string().regex(/^[A-Z2-7]{52,60}$/),
            destId: z.string().regex(/^[A-Z2-7]{52,60}$/),
            amount: z.string().regex(/^\d+$/),
            tickNumber: z.number().int().positive(),
            inputType: z.number().int(),
            inputSize: z.number().int(),
            inputHex: z.string(),
            signatureHex: z.string(),
            txId: z.string().length(60)
        }),
        timestamp: z.string(),
        moneyFlew: z.boolean()
    }),
    ParsedTransaction: z.object({
        IssuerAddress: z.string(),
        AssetName: z.string(),
        Price: z.number(),
        NumberOfShares: z.number()
    })
}).strict();

/**
 * Cryptographically secure random integer generator
 * Uses crypto.randomBytes for unbiased distribution
 */
function secureRandomInt(min, max) {
    const range = max - min + 1;
    const bytesNeeded = Math.ceil(Math.log2(range) / 8);
    const maxValue = Math.pow(256, bytesNeeded);
    const threshold = maxValue - (maxValue % range);
    
    let randomValue;
    do {
        const randomBytes = crypto.randomBytes(bytesNeeded);
        randomValue = 0;
        for (let i = 0; i < bytesNeeded; i++) {
            randomValue = (randomValue << 8) | randomBytes[i];
        }
    } while (randomValue >= threshold);
    
    return min + (randomValue % range);
}

/**
 * Fetches on-chain balance for a Qubic wallet address
 */
async function getQubicBalance(address) {
    try {
        const response = await fetch(`${CONFIG.QUBIC_RPC_URL}/v1/balances/${address}`);
        if (!response.ok) {
            console.warn(`Balance API returned ${response.status} for ${address.substring(0,8)}...`);
            return 0n;
        }
        const data = await response.json();
        return BigInt(data.balance?.balance || 0);
    } catch (error) {
        console.error(`Balance fetch failed for ${address.substring(0,8)}...: ${error.message}`);
        return 0n;
    }
}

/**
 * Safely adds role to Discord member with hierarchy checks
 */
async function addRoleSafe(member, roleId, roleName) {
    if (!roleId) {
        console.warn(`Role ID missing for ${roleName}`);
        return;
    }
    
    try {
        if (member.roles.cache.has(roleId)) {
            return;
        }
        await member.roles.add(roleId);
        console.info(`Role assigned: ${roleName} → ${member.user.tag} (${member.id})`);
    } catch (error) {
        console.error(`Role assignment failed: ${roleName} → ${member.user.tag}. Error: ${error.message}. Check bot role hierarchy.`);
    }
}

/**
 * Safely removes role from Discord member
 */
async function removeRoleSafe(member, roleId, roleName) {
    if (!roleId) return;
    
    try {
        if (!member.roles.cache.has(roleId)) {
            return;
        }
        await member.roles.remove(roleId);
        console.info(`Role removed: ${roleName} ← ${member.user.tag} (${member.id})`);
    } catch (error) {
        console.error(`Role removal failed: ${roleName} ← ${member.user.tag}. Error: ${error.message}`);
    }
}

/**
 * Rate limiting utility
 */
const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

/**
 * Safely defers Discord interaction reply
 */
async function safeDeferReply(interaction) {
    if (!interaction || interaction.deferred || interaction.replied) return;
    
    try {
        await interaction.deferReply({ flags: MessageFlags.Ephemeral });
    } catch (err) {
        if (err?.code === 40060) return;
        console.error(`Defer reply failed: ${err.message}`);
    }
}

/**
 * Layer 2: Verifies transaction authenticity via on-chain RPC
 */
async function verifyTransactionOnChain(txId, expectedSource, expectedAmount) {
    try {
        console.info(`[Layer 2] Verifying transaction: ${txId.substring(0,12)}...`);
        
        const response = await fetch(`${CONFIG.QUBIC_RPC_URL}/v1/transactions/${txId}`);
        if (!response.ok) {
            console.warn(`[Layer 2] RPC returned ${response.status} for ${txId.substring(0,12)}...`);
            return false;
        }
        
        const rpcResponse = await response.json();
        const onChainTx = rpcResponse.transaction;
        
        if (!onChainTx) {
            console.warn(`[Layer 2] No transaction data found on-chain for ${txId.substring(0,12)}...`);
            return false;
        }

        const sourceMatch = onChainTx.sourceId === expectedSource;
        const amountMatch = onChainTx.amount === expectedAmount;

        if (!sourceMatch || !amountMatch) {
            console.warn(`[Layer 2] Semantic mismatch detected:`);
            console.warn(`  Expected: source=${expectedSource.substring(0,12)}..., amount=${expectedAmount}`);
            console.warn(`  On-chain: source=${onChainTx.sourceId.substring(0,12)}..., amount=${onChainTx.amount}`);
            return false;
        }

        console.info(`[Layer 2] Transaction verified successfully`);
        return true;
    } catch (error) {
        console.error(`[Layer 2] RPC verification error: ${error.message}`);
        return false;
    }
}

/**
 * Scheduled portfolio refresh and role synchronization
 * Runs every 30 minutes to update user roles based on wallet balances
 */
cron.schedule('*/30 * * * *', async () => {
    console.info('=== Portfolio Refresh Started ===');
    const startTime = Date.now();
    
    try {
        const verifiedWallets = await prisma.wallet.findMany({ 
            where: { isVerified: true },
            select: { userId: true }
        });
        
        const uniqueUserIds = [...new Set(verifiedWallets.map(w => w.userId))];
        const guild = await client.guilds.fetch(process.env.GUILD_ID);

        console.info(`Processing ${uniqueUserIds.length} verified users`);

        let processed = 0;
        let errors = 0;

        for (const userId of uniqueUserIds) {
            try {
                const member = await guild.members.fetch(userId).catch(() => null);
                if (!member) {
                    console.debug(`User ${userId} not found in guild, skipping`);
                    continue;
                }

                const userWallets = await prisma.wallet.findMany({ 
                    where: { userId: userId, isVerified: true } 
                });
                
                let totalNetWorth = 0n;
                for (const wallet of userWallets) {
                    const balance = await getQubicBalance(wallet.address);
                    totalNetWorth += balance;
                    await sleep(CONFIG.RATE_LIMIT_DELAY_MS);
                }

                await addRoleSafe(member, CONFIG.ROLES.VERIFIED, "VERIFIED");

                if (totalNetWorth >= CONFIG.WHALE_THRESHOLD) {
                    await addRoleSafe(member, CONFIG.ROLES.WHALE, "WHALE");
                } else {
                    await removeRoleSafe(member, CONFIG.ROLES.WHALE, "WHALE");
                }

                processed++;
            } catch (err) {
                errors++;
                console.error(`Error processing user ${userId}: ${err.message}`);
            }
        }

        const duration = Date.now() - startTime;
        console.info(`=== Portfolio Refresh Complete ===`);
        console.info(`Processed: ${processed}, Errors: ${errors}, Duration: ${duration}ms`);
    } catch (error) {
        console.error(`Portfolio refresh critical failure: ${error.message}`);
    }
});

/**
 * Webhook endpoint for EasyConnect transaction notifications
 */
app.post('/webhook/qubic', async (req, res) => {
    const requestId = crypto.randomBytes(4).toString('hex');
    console.info(`[${requestId}] Webhook request received`);
    
    const batch = req.body;
    const transactions = Array.isArray(batch) ? batch : [batch];

    console.info(`[${requestId}] Processing ${transactions.length} transaction(s)`);

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
                const guild = await client.guilds.fetch(process.env.GUILD_ID);
                const member = await guild.members.fetch(challenge.discordId);
                
                await addRoleSafe(member, CONFIG.ROLES.VERIFIED, "VERIFIED");
                
                if (totalNetWorth >= CONFIG.WHALE_THRESHOLD) {
                    await addRoleSafe(member, CONFIG.ROLES.WHALE, "WHALE");
                }

                await member.send({
                    content: `## 🎉 Verification Successful!\n\n**Wallet:** \`${walletAddress}\`\n**Transaction:** ${numberOfShares} ${parsed.AssetName} @ ${parsed.Price} QU\n**Portfolio:** ${allWallets.length} Wallet(s)\n**Net Worth:** \`${totalNetWorth.toString()} QUBIC\`\n\n*Your roles have been updated instantly.*`
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

    console.info(`[${requestId}] Webhook processing complete - Processed: ${processed}, Skipped: ${skipped}`);
    res.status(200).json({ 
        success: true, 
        processed, 
        skipped,
        requestId 
    });
});

/**
 * Discord slash commands
 */
const commands = [
    new SlashCommandBuilder()
        .setName('link')
        .setDescription('Add a wallet to your portfolio')
        .addStringOption(option => 
            option.setName('wallet').setDescription('Qubic Address').setRequired(true)
        ),
    new SlashCommandBuilder()
        .setName('portfolio')
        .setDescription('View your linked wallets')
].map(c => c.toJSON());

const rest = new REST({ version: '10' }).setToken(process.env.DISCORD_TOKEN);

/**
 * Bot ready event handler
 */
client.once(Events.ClientReady, async c => {
    console.info('=== QubicLink Bot Started ===');
    console.info(`Bot User: ${c.user.tag} (${c.user.id})`);
    console.info(`Guild ID: ${process.env.GUILD_ID}`);
    
    try {
        await rest.put(
            Routes.applicationGuildCommands(process.env.CLIENT_ID, process.env.GUILD_ID), 
            { body: commands }
        );
        console.info('Slash commands registered successfully');
    } catch (err) { 
        console.error('Slash command registration failed:', err.message); 
    }
});

/**
 * Command interaction handler
 */
client.on(Events.InteractionCreate, async interaction => {
    if (!interaction.isChatInputCommand()) return;

    const commandId = `${interaction.user.id}-${Date.now()}`;

    if (interaction.commandName === 'portfolio') {
        console.info(`[${commandId}] Portfolio command - User: ${interaction.user.tag}`);
        
        try {
            await safeDeferReply(interaction);
            
            const wallets = await prisma.wallet.findMany({ 
                where: { userId: interaction.user.id } 
            });

            if (wallets.length === 0) {
                console.debug(`[${commandId}] No wallets found`);
                return interaction.editReply('You have no linked wallets. Use `/link` to add one.');
            }

            let totalBalance = 0n;
            const listPromises = wallets.map(async (w, i) => {
                const bal = w.isVerified ? await getQubicBalance(w.address) : 0n;
                if (w.isVerified) totalBalance += bal;
                return `${i+1}. \`${w.address.substring(0, 8)}...\` - ${w.isVerified ? '✅' : '⏳'} ${w.isVerified ? `(${bal.toString()} Q)` : ''}`;
            });
            
            const list = (await Promise.all(listPromises)).join('\n');

            await interaction.editReply({
                content: `### 💼 Your Portfolio\n\n${list}\n\n**Total Net Worth:** \`${totalBalance.toString()} QUBIC\``
            });
            
            console.info(`[${commandId}] Portfolio displayed - Wallets: ${wallets.length}, Total: ${totalBalance.toString()}`);
        } catch (e) { 
            if (e.code !== 10062) {
                console.error(`[${commandId}] Portfolio command error: ${e.message}`);
            }
        }
    }

    if (interaction.commandName === 'link') {
        console.info(`[${commandId}] Link command - User: ${interaction.user.tag}`);
        
        try {
            await safeDeferReply(interaction);

            const walletInput = interaction.options.getString('wallet').trim().toUpperCase();
            const discordId = interaction.user.id;

            console.debug(`[${commandId}] Wallet: ${walletInput.substring(0,12)}...`);

            await prisma.user.upsert({ 
                where: { discordId }, 
                update: {}, 
                create: { discordId } 
            });

            const existingWallet = await prisma.wallet.findUnique({ 
                where: { address: walletInput } 
            });
            
            if (existingWallet && existingWallet.userId !== discordId && existingWallet.isVerified) {
                console.warn(`[${commandId}] Wallet already verified by another user`);
                return interaction.editReply('🚫 Access Denied. Wallet verified by another user.');
            }
            
            if (existingWallet && existingWallet.userId === discordId && existingWallet.isVerified) {
                console.debug(`[${commandId}] Wallet already linked to this user`);
                return interaction.editReply('✅ Already Linked. This wallet is in your portfolio.');
            }

            await prisma.wallet.upsert({
                where: { address: walletInput },
                update: { userId: discordId },
                create: { address: walletInput, userId: discordId }
            });

            let signalCode;
            const active = await prisma.challenge.findFirst({
                where: { 
                    discordId, 
                    walletAddress: walletInput, 
                    expiresAt: { gt: new Date() } 
                },
                orderBy: { createdAt: 'desc' }
            });

            let statusMsg = "🔐 Secure Link Initiated";
            if (active) {
                signalCode = active.signalCode;
                statusMsg = "🔄 Active Challenge Found";
                console.info(`[${commandId}] Reusing existing challenge: ${signalCode}`);
            } else {
                signalCode = secureRandomInt(CONFIG.SIGNAL_CODE_MIN, CONFIG.SIGNAL_CODE_MAX);
                
                await prisma.challenge.create({
                    data: { 
                        discordId, 
                        walletAddress: walletInput, 
                        signalCode, 
                        expiresAt: new Date(Date.now() + CONFIG.CHALLENGE_EXPIRY_MS) 
                    }
                });
                console.info(`[${commandId}] New challenge created: ${signalCode} shares`);
            }

            const expiryUnix = Math.floor((Date.now() + CONFIG.CHALLENGE_EXPIRY_MS) / 1000);
            const costAt1QU = signalCode * 1;
            const costInUSD = costAt1QU * CONFIG.QUBIC_TO_USD;
            const costInINR = costInUSD * CONFIG.USD_TO_INR;
            
            await interaction.editReply({
                content: `### ${statusMsg}\n**🔐 Verification Code:** \`${signalCode}\` shares\n**💼 Wallet:** \`${walletInput}\`\n**💰 Total Cost:** \`${costAt1QU.toLocaleString()}\` QUBIC (~₹${costInINR.toFixed(2)} / $${costInUSD.toFixed(4)})\n\n📱 **Step-by-Step Instructions:**\n\n**1. Open QubicTrade on Your Phone**\n   → Go to **https://qubictrade.io/**\n   → (Must use same phone with Qubic Wallet installed)\n\n**2. Connect Your Wallet**\n   → Tap "Connect Wallet"\n   → Select "Qubic Wallet" app\n   → Approve connection\n\n**3. Select GARTH Asset**\n   → Find and tap on **GARTH**\n\n**4. Place Buy Order**\n   → Tap **BUY**\n   → **Price:** \`1\` QU (type exactly: 1)\n   → **Amount:** \`${signalCode}\` shares\n   → **Total Cost:** ${costAt1QU.toLocaleString()} QUBIC\n\n**5. Confirm Transaction**\n   → Review details\n   → Tap "Confirm"\n   → Approve in Qubic Wallet\n\n⏰ **Expires:** <t:${expiryUnix}:R>\n\n✅ **Why Price = 1 QU?**\nThis keeps your cost ultra-minimal (₹${costInINR.toFixed(2)})! Even if the order executes, you only lose a few rupees.\n\n💡 **After Verification:**\nYour Discord roles will update instantly! You can cancel the order on QubicTrade to get your QUBIC back (optional).`
            });

            console.info(`[${commandId}] Challenge sent - Code: ${signalCode}, Cost: ${costAt1QU} QUBIC`);

        } catch (error) {
            if (error.code !== 10062) {
                console.error(`[${commandId}] Link command error: ${error.message}`);
                await interaction.editReply({ content: '🔥 System Error. Please try again.' }).catch(() => {});
            }
        }
    }
});

/**
 * Application startup
 */
app.listen(PORT, () => {
    console.info('=== QubicLink Server Started ===');
    console.info(`Webhook server listening on port ${PORT}`);
    console.info(`Environment: ${process.env.NODE_ENV || 'development'}`);
});

client.login(process.env.DISCORD_TOKEN).catch(err => {
    console.error('Discord login failed:', err.message);
    process.exit(1);
});