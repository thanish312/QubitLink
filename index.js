/**
 * QubicLink V2 - FORT KNOX PRODUCTION BUILD
 * 
 * FAILURE PROTECTIONS:
 * 1. Anti-Crash: All Discord interactions wrapped in try/catch.
 * 2. Anti-Scam: "First to Verify" wins. Stolen wallets are blocked.
 * 3. Type Safety: BigInt for all balances.
 * 4. Hierarchy Safety: Checks permissions before adding roles.
 * 5. Rate Limiting: Sleep functions to prevent API bans.
 * 
 * SECURITY UPGRADES:
 * 1. Layer 1: Strict Zod schema validation on all incoming webhooks.
 * 2. Layer 2: Semantic on-chain validation via Qubic RPC.
 * 3. Layer 3: Replay attack protection by logging processed txIds.
 */

require('dotenv').config();
const { Client, GatewayIntentBits, REST, Routes, SlashCommandBuilder, Events, MessageFlags } = require('discord.js');
const { PrismaClient } = require('@prisma/client');
const express = require('express');
const cron = require('node-cron');
const { z } = require('zod'); // NEW: Schema validation library

// --- SETUP ---
const prisma = new PrismaClient();
const client = new Client({ 
    intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMembers] 
});
const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());

// --- CONFIGURATION ---
const ROLES = {
    VERIFIED: process.env.VERIFIED_ROLE_ID,
    WHALE: process.env.WHALE_ROLE_ID
};
const WHALE_THRESHOLD = 1000000000n; // 1 Billion Qubic (BigInt)

// --- LAYER 1: ZOD SCHEMA DEFINITION ---
// This schema defines the exact structure of a valid EasyConnect payload.
const easyConnectSchema = z.object({
    ProcedureTypeName: z.literal("AddToBidOrder"),
    ProcedureTypeValue: z.literal(6),
    RawTransaction: z.object({
        transaction: z.object({
            sourceId: z.string().regex(/^[A-Z2-7]{52}$/), // Qubic address format
            amount: z.string().regex(/^\d+$/), // String of digits
            txId: z.string().length(60)
        })
    })
}).strict(); // .strict() rejects any payload with extra, unexpected fields.

// --- HELPER FUNCTIONS ---

// 1. Fetch Balance safely (Returns BigInt)
async function getQubicBalance(address) {
    try {
        const response = await fetch(`https://rpc.qubic.org/v1/balances/${address}`);
        if (!response.ok) return 0n;
        const data = await response.json();
        return BigInt(data.balance.balance || 0); 
    } catch (error) {
        console.error(`⚠️ API Error for ${address.substring(0,8)}...: ${error.message}`);
        return 0n;
    }
}

// 2. Safe Role Assignment (Prevents crashes if Bot is lower rank)
async function addRoleSafe(member, roleId, roleName) {
    if (!roleId) return;
    try {
        if (member.roles.cache.has(roleId)) return; // Already has it
        await member.roles.add(roleId);
        console.log(`✅ Role Added: ${roleName} -> ${member.user.tag}`);
    } catch (error) {
        console.error(`❌ PERMISSION ERROR: Cannot add ${roleName} to ${member.user.tag}.`);
        console.error(`   -> Check Discord Server Settings > Roles.`);
        console.error(`   -> Move 'QubicLink' ABOVE '${roleName}'.`);
    }
}

// 3. Safe Role Removal
async function removeRoleSafe(member, roleId, roleName) {
    if (!roleId) return;
    try {
        if (!member.roles.cache.has(roleId)) return; // Doesn't have it
        await member.roles.remove(roleId);
        console.log(`📉 Role Removed: ${roleName} <- ${member.user.tag}`);
    } catch (error) {
        console.error(`❌ PERMISSION ERROR: Cannot remove ${roleName}. Check Hierarchy.`);
    }
}

// 4. Sleep (Rate Limiter)
const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

// Safe defer helper to avoid "Interaction has already been acknowledged" errors
async function safeDeferReply(interaction) {
    if (!interaction || interaction.deferred || interaction.replied) return;
    try {
        await interaction.deferReply({ flags: MessageFlags.Ephemeral });
    } catch (err) {
        if (err && err.code === 40060) return; // already acknowledged
        console.error('DeferReply Error:', err);
    }
}

// --- LAYER 2: ON-CHAIN VERIFICATION HELPER ---
async function verifyTransactionOnChain(txId, expectedSource, expectedAmount) {
    try {
        console.log(`[L2] Verifying txId ${txId.substring(0,8)}... on-chain...`);
        const response = await fetch(`https://rpc.qubic.org/v1/transactions/${txId}`);
        if (!response.ok) {
            console.warn(`[L2] ⚠️ RPC lookup failed for txId ${txId}.`);
            return false;
        }
        const onChainTx = await response.json();

        // Compare webhook data with live on-chain data
        const isSourceValid = onChainTx.sourceId === expectedSource;
        const isAmountValid = onChainTx.amount === expectedAmount; // Amounts are strings

        if (!isSourceValid || !isAmountValid) {
            console.warn(`[L2] ⚠️ Semantic Mismatch for ${txId}!`);
            console.warn(`     -> Expected: ${expectedSource} | ${expectedAmount}`);
            console.warn(`     -> On-Chain: ${onChainTx.sourceId} | ${onChainTx.amount}`);
            return false;
        }

        console.log(`[L2] ✅ On-chain data matches.`);
        return true;
    } catch (error) {
        console.error('[L2] Critical RPC Error:', error);
        return false;
    }
}

// ==========================================
// 1. CRON JOB (THE SELF-HEALING SYSTEM)
// ==========================================
// Runs every 30 minutes to ensure data is fresh and roles are correct
cron.schedule('*/30 * * * *', async () => {
    console.log('⏰ CRON: Starting Portfolio Refresh...');
    try {
        // Find users with at least one verified wallet
        const verifiedWallets = await prisma.wallet.findMany({ 
            where: { isVerified: true },
            select: { userId: true } // Only need User IDs
        });
        
        // Get unique User IDs
        const uniqueUserIds = [...new Set(verifiedWallets.map(w => w.userId))];
        const guild = await client.guilds.fetch(process.env.GUILD_ID);

        console.log(`🔍 Checking ${uniqueUserIds.length} Users...`);

        for (const userId of uniqueUserIds) {
            try {
                // Fetch Discord Member
                const member = await guild.members.fetch(userId).catch(() => null);
                if (!member) continue; // User left the server

                // Calculate Total Net Worth
                const userWallets = await prisma.wallet.findMany({ where: { userId: userId, isVerified: true } });
                let totalNetWorth = 0n;

                for (const wallet of userWallets) {
                    const balance = await getQubicBalance(wallet.address);
                    totalNetWorth += balance;
                    await sleep(200); // 200ms delay to be nice to API
                }

                // SYNC ROLES
                // 1. Ensure Verified Role
                await addRoleSafe(member, ROLES.VERIFIED, "VERIFIED");

                // 2. Check Whale Status
                if (totalNetWorth >= WHALE_THRESHOLD) {
                    await addRoleSafe(member, ROLES.WHALE, "WHALE");
                } else {
                    await removeRoleSafe(member, ROLES.WHALE, "WHALE");
                }

            } catch (err) {
                console.error(`Skipped user ${userId}: ${err.message}`);
            }
        }
        console.log('✅ CRON: Refresh Complete.');
    } catch (error) {
        console.error('🔥 CRON CRITICAL FAILURE:', error);
    }
});

// ==========================================
// 2. WEBHOOK (THE TRANSACTION VERIFIER)
// ==========================================
app.post('/webhook/qubic', async (req, res) => {
    try {
        // --- 🛡️ LAYER 1: STRICT PAYLOAD SCHEMA VALIDATION ---
        const validationResult = easyConnectSchema.safeParse(req.body);
        if (!validationResult.success) {
            console.warn(`[L1] ⚠️ Invalid Schema Received. Rejecting.`);
            console.warn(validationResult.error.issues);
            return res.status(400).send('Invalid payload schema');
        }
        const payload = validationResult.data;
        const tx = payload.RawTransaction.transaction;

        // --- 🛡️ LAYER 3: REPLAY ATTACK PROTECTION ---
        try {
            await prisma.processedTransaction.create({
                data: { txId: tx.txId }
            });
            console.log(`[L3] ✅ New txId ${tx.txId.substring(0,8)}... logged.`);
        } catch (error) {
            if (error.code === 'P2002') { // P2002 = Unique constraint violation
                console.warn(`[L3] ⚠️ REPLAY ATTACK DETECTED! txId ${tx.txId} already processed.`);
                return res.status(200).send('Already processed'); // Return 200 so EasyConnect doesn't retry
            }
            throw error; // Rethrow other DB errors
        }

        // --- 🛡️ LAYER 2: SEMANTIC (ON-CHAIN) VALIDATION ---
        const isOnChainValid = await verifyTransactionOnChain(tx.txId, tx.sourceId, tx.amount);
        if (!isOnChainValid) {
            return res.status(400).send('On-chain validation failed');
        }

        // --- ✅ ALL SECURITY CHECKS PASSED ---
        // Now we can trust the data and run the business logic.
        const walletAddress = tx.sourceId;
        const bidAmount = parseInt(tx.amount, 10);

        console.log(`🔎 Incoming Bid: ${walletAddress.substring(0,6)}... | Amount: ${bidAmount}`);

        // Find the Challenge
        const challenge = await prisma.challenge.findFirst({
            where: {
                walletAddress: walletAddress,
                signalCode: bidAmount,
                expiresAt: { gt: new Date() }
            },
        });

        if (challenge) {
            console.log(`✅ MATCH FOUND! User: ${challenge.discordId}`);

            // SECURITY: Check if wallet is verified by SOMEONE ELSE
            const existingWallet = await prisma.wallet.findUnique({ where: { address: walletAddress } });
            
            if (existingWallet && existingWallet.userId !== challenge.discordId && existingWallet.isVerified) {
                console.warn(`⚠️ BLOCKED: Wallet stolen attempt by ${challenge.discordId}`);
                await prisma.challenge.delete({ where: { id: challenge.id } }); // Delete the hacker's challenge
                return res.status(200).send('Blocked: Stolen');
            }

            // DB UPDATE: Verify the wallet
            await prisma.wallet.upsert({
                where: { address: walletAddress },
                update: { isVerified: true, verifiedAt: new Date(), userId: challenge.discordId },
                create: { address: walletAddress, userId: challenge.discordId, isVerified: true, verifiedAt: new Date() }
            });

            // INSTANT PORTFOLIO CALCULATION (Don't wait for Cron)
            const allWallets = await prisma.wallet.findMany({ where: { userId: challenge.discordId, isVerified: true } });
            let total = 0n;
            for (const w of allWallets) { 
                total += await getQubicBalance(w.address); 
            }

            // INSTANT ROLE ASSIGNMENT
            try {
                const guild = await client.guilds.fetch(process.env.GUILD_ID);
                const member = await guild.members.fetch(challenge.discordId);
                
                await addRoleSafe(member, ROLES.VERIFIED, "VERIFIED");
                
                if (total >= WHALE_THRESHOLD) {
                    await addRoleSafe(member, ROLES.WHALE, "WHALE");
                }

                // Send DM
                await member.send({
                    content: `## 🚀 Verification Successful!\n\n**Wallet:** \`${walletAddress}\`\n**Portfolio:** ${allWallets.length} Wallet(s)\n**Net Worth:** \`${total.toString()} QUBIC\`\n\n*Your roles have been updated instantly.*`
                }).catch(() => console.log(`Couldn't DM user ${challenge.discordId}`));

            } catch (err) { console.error('Discord Action Failed:', err.message); }

            // Cleanup Challenges
            await prisma.challenge.deleteMany({ where: { walletAddress: walletAddress } });

            return res.status(200).send('Verified');
        }

        return res.status(200).send('No Match');

    } catch (error) {
        console.error('🔥 Webhook Error:', error);
        return res.status(500).send('Server Error');
    }
});

// ==========================================
// 3. DISCORD BOT COMMANDS
// ==========================================
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

client.once(Events.ClientReady, async c => {
    console.log(`🤖 Bot Logged in as ${c.user.tag}`);
    try {
        await rest.put(Routes.applicationGuildCommands(process.env.CLIENT_ID, process.env.GUILD_ID), { body: commands });
        console.log('✨ Slash commands loaded.');
    } catch (err) { console.error(err); }
});

client.on(Events.InteractionCreate, async interaction => {
    if (!interaction.isChatInputCommand()) return;

    // --- COMMAND: /PORTFOLIO ---
    if (interaction.commandName === 'portfolio') {
        try {
            await safeDeferReply(interaction);
            const wallets = await prisma.wallet.findMany({ where: { userId: interaction.user.id } });

            if (wallets.length === 0) return interaction.editReply('You have no linked wallets. Use `/link`.');

            let totalBalance = 0n;
            const listPromises = wallets.map(async (w, i) => {
                const bal = w.isVerified ? await getQubicBalance(w.address) : 0n;
                if(w.isVerified) totalBalance += bal;
                return `${i+1}. \`${w.address.substring(0, 8)}...\` - ${w.isVerified ? '✅' : '⏳'} ${w.isVerified ? `(${bal.toString()} Q)` : ''}`;
            });
            
            const list = (await Promise.all(listPromises)).join('\n');

            await interaction.editReply({
                content: `### 💼 Your Portfolio\n\n${list}\n\n**Total Net Worth:** \`${totalBalance.toString()} QUBIC\``
            });
        } catch (e) { if(e.code !== 10062) console.error(e); }
    }

    // --- COMMAND: /LINK ---
    if (interaction.commandName === 'link') {
        try {
            // SAFETY NET START
            await safeDeferReply(interaction);

            const walletInput = interaction.options.getString('wallet').trim().toUpperCase();
            const discordId = interaction.user.id;

            // 1. Upsert User
            await prisma.user.upsert({ where: { discordId }, update: {}, create: { discordId } });

            // 2. Security: Check if taken
            const existingWallet = await prisma.wallet.findUnique({ where: { address: walletInput } });
            
            if (existingWallet && existingWallet.userId !== discordId && existingWallet.isVerified) {
                return interaction.editReply(`❌ **Access Denied.** Wallet verified by another user.`);
            }
            if (existingWallet && existingWallet.userId === discordId && existingWallet.isVerified) {
                return interaction.editReply(`✅ **Already Linked.** This wallet is in your portfolio.`);
            }

            // 3. Add to Portfolio (Pending)
            await prisma.wallet.upsert({
                where: { address: walletInput },
                update: { userId: discordId },
                create: { address: walletInput, userId: discordId }
            });

            // 4. Challenge Logic
            let signalCode;
            const active = await prisma.challenge.findFirst({
                where: { discordId, walletAddress: walletInput, expiresAt: { gt: new Date() } },
                orderBy: { createdAt: 'desc' }
            });

            let statusMsg = "🔒 **Secure Link Initiated**";
            if (active) {
                signalCode = active.signalCode;
                statusMsg = "⚠️ **Active Challenge Found**";
            } else {
                signalCode = Math.floor(Math.random() * (99000 - 30000) + 30000);
                await prisma.challenge.create({
                    data: { discordId, walletAddress: walletInput, signalCode, expiresAt: new Date(Date.now() + 600000) }
                });
            }

            const expiryUnix = Math.floor((Date.now() + 600000) / 1000);
            await interaction.editReply({
                content: `### ${statusMsg}\n**Signal Code:** \`${signalCode}\`\n**Wallet:** \`${walletInput}\`\n\n👉 *Place a Limit Bid for **${signalCode} QUBIC**.*\n⏳ *Expires <t:${expiryUnix}:R>*`
            });

        } catch (error) {
            if (error.code !== 10062) { // Ignore Timeout/Unknown Interaction
                console.error('Link Cmd Error:', error);
                await interaction.editReply({ content: '❌ System Error.' }).catch(() => {});
            }
        }
    }
});

// --- STARTUP ---
app.listen(PORT, () => console.log(`🌍 Webhook Server running on port ${PORT}`));
client.login(process.env.DISCORD_TOKEN);