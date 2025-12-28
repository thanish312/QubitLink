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
 **/

require('dotenv').config();
const { Client, GatewayIntentBits, REST, Routes, SlashCommandBuilder, Events, MessageFlags } = require('discord.js');
const { PrismaClient } = require('@prisma/client');
const express = require('express');
const cron = require('node-cron');
const { z } = require('zod');

const prisma = new PrismaClient();
const client = new Client({ 
    intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMembers] 
});
const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());

const ROLES = {
    VERIFIED: process.env.VERIFIED_ROLE_ID,
    WHALE: process.env.WHALE_ROLE_ID
};
const WHALE_THRESHOLD = 1000000000n;

// --- LAYER 1: ZOD SCHEMA DEFINITION (COMPLETE & ACCURATE) ---
// This schema now perfectly mirrors the real EasyConnect payload structure.
const easyConnectSchema = z.object({
    ProcedureTypeName: z.literal("AddToBidOrder"),
    ProcedureTypeValue: z.literal(6),
    RawTransaction: z.object({
        transaction: z.object({
            sourceId: z.string().regex(/^[A-Z2-7]{52}$/),
            destId: z.string(),
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

async function getQubicBalance(address) {
    try {
        const response = await fetch(`https://rpc.qubic.org/v1/balances/${address}`);
        if (!response.ok) return 0n;
        const data = await response.json();
        return BigInt(data.balance.balance || 0); 
    } catch (error) {
        console.error(`API Error for ${address.substring(0,8)}...: ${error.message}`);
        return 0n;
    }
}

async function addRoleSafe(member, roleId, roleName) {
    if (!roleId) return;
    try {
        if (member.roles.cache.has(roleId)) return;
        await member.roles.add(roleId);
        console.log(`Role Added: ${roleName} -> ${member.user.tag}`);
    } catch (error) {
        console.error(`Permission Error: Cannot add ${roleName} to ${member.user.tag}. Check Discord Server Settings > Roles. Move 'QubicLink' ABOVE '${roleName}'.`);
    }
}

async function removeRoleSafe(member, roleId, roleName) {
    if (!roleId) return;
    try {
        if (!member.roles.cache.has(roleId)) return;
        await member.roles.remove(roleId);
        console.log(`Role Removed: ${roleName} <- ${member.user.tag}`);
    } catch (error) {
        console.error(`Permission Error: Cannot remove ${roleName}. Check Hierarchy.`);
    }
}

const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

async function safeDeferReply(interaction) {
    if (!interaction || interaction.deferred || interaction.replied) return;
    try {
        await interaction.deferReply({ flags: MessageFlags.Ephemeral });
    } catch (err) {
        if (err && err.code === 40060) return;
        console.error('DeferReply Error:', err);
    }
}

async function verifyTransactionOnChain(txId, expectedSource, expectedAmount) {
    try {
        console.log(`Verifying txId ${txId.substring(0,8)}... on-chain...`);
        const response = await fetch(`https://rpc.qubic.org/v1/transactions/${txId}`);
        if (!response.ok) {
            console.warn(`RPC lookup failed for txId ${txId}.`);
            return false;
        }
        const onChainTx = await response.json();

        const isSourceValid = onChainTx.sourceId === expectedSource;
        const isAmountValid = onChainTx.amount === expectedAmount;

        if (!isSourceValid || !isAmountValid) {
            console.warn(`Semantic Mismatch for ${txId}!`);
            console.warn(`Expected: ${expectedSource} | ${expectedAmount}`);
            console.warn(`On-Chain: ${onChainTx.sourceId} | ${onChainTx.amount}`);
            return false;
        }

        console.log(`On-chain data matches.`);
        return true;
    } catch (error) {
        console.error('Critical RPC Error:', error);
        return false;
    }
}

cron.schedule('*/30 * * * *', async () => {
    console.log('Starting Portfolio Refresh...');
    try {
        const verifiedWallets = await prisma.wallet.findMany({ 
            where: { isVerified: true },
            select: { userId: true }
        });
        
        const uniqueUserIds = [...new Set(verifiedWallets.map(w => w.userId))];
        const guild = await client.guilds.fetch(process.env.GUILD_ID);

        console.log(`Checking ${uniqueUserIds.length} Users...`);

        for (const userId of uniqueUserIds) {
            try {
                const member = await guild.members.fetch(userId).catch(() => null);
                if (!member) continue;

                const userWallets = await prisma.wallet.findMany({ where: { userId: userId, isVerified: true } });
                let totalNetWorth = 0n;

                for (const wallet of userWallets) {
                    const balance = await getQubicBalance(wallet.address);
                    totalNetWorth += balance;
                    await sleep(200);
                }

                await addRoleSafe(member, ROLES.VERIFIED, "VERIFIED");

                if (totalNetWorth >= WHALE_THRESHOLD) {
                    await addRoleSafe(member, ROLES.WHALE, "WHALE");
                } else {
                    await removeRoleSafe(member, ROLES.WHALE, "WHALE");
                }

            } catch (err) {
                console.error(`Skipped user ${userId}: ${err.message}`);
            }
        }
        console.log('Refresh Complete.');
    } catch (error) {
        console.error('Critical Failure:', error);
    }
});

app.post('/webhook/qubic', async (req, res) => {
    const batch = req.body;
    
    if (!Array.isArray(batch)) {
        return res.status(400).send('Expected an array of transactions.');
    }

    console.log(`Webhook Batch Received: ${batch.length} transaction(s).`);

    for (const payload of batch) {
        try {
            const validationResult = easyConnectSchema.safeParse(payload);
            if (!validationResult.success) {
                console.warn(`Invalid Schema in batch item. Skipping.`);
                continue;
            }
            const validatedPayload = validationResult.data;
            const tx = validatedPayload.RawTransaction.transaction;

            try {
                await prisma.processedTransaction.create({
                    data: { txId: tx.txId }
                });
            } catch (error) {
                if (error.code === 'P2002') {
                    console.warn(`Replay Detected. Skipping txId ${tx.txId.substring(0,8)}...`);
                    continue;
                }
                throw error;
            }

            const isOnChainValid = await verifyTransactionOnChain(tx.txId, tx.sourceId, tx.amount);
            if (!isOnChainValid) {
                console.warn(`On-chain validation failed. Skipping txId ${tx.txId.substring(0,8)}...`);
                continue;
            }

            const walletAddress = tx.sourceId;
            const bidAmount = parseInt(tx.amount, 10);

            const challenge = await prisma.challenge.findFirst({
                where: {
                    walletAddress: walletAddress,
                    signalCode: bidAmount,
                    expiresAt: { gt: new Date() }
                },
            });

            if (challenge) {
                console.log(`Match Found! Processing for ${challenge.discordId}`);

                const existingWallet = await prisma.wallet.findUnique({ where: { address: walletAddress } });
                
                if (existingWallet && existingWallet.userId !== challenge.discordId && existingWallet.isVerified) {
                    console.warn(`Blocked: Wallet stolen attempt by ${challenge.discordId}`);
                    await prisma.challenge.delete({ where: { id: challenge.id } });
                    continue;
                }

                await prisma.wallet.upsert({
                    where: { address: walletAddress },
                    update: { isVerified: true, verifiedAt: new Date(), userId: challenge.discordId },
                    create: { address: walletAddress, userId: challenge.discordId, isVerified: true, verifiedAt: new Date() }
                });

                const allWallets = await prisma.wallet.findMany({ where: { userId: challenge.discordId, isVerified: true } });
                let total = 0n;
                for (const w of allWallets) { 
                    total += await getQubicBalance(w.address); 
                }

                try {
                    const guild = await client.guilds.fetch(process.env.GUILD_ID);
                    const member = await guild.members.fetch(challenge.discordId);
                    
                    await addRoleSafe(member, ROLES.VERIFIED, "VERIFIED");
                    
                    if (total >= WHALE_THRESHOLD) {
                        await addRoleSafe(member, ROLES.WHALE, "WHALE");
                    }

                    await member.send({
                        content: `## Verification Successful!\n\n**Wallet:** \`${walletAddress}\`\n**Portfolio:** ${allWallets.length} Wallet(s)\n**Net Worth:** \`${total.toString()} QUBIC\`\n\n*Your roles have been updated instantly.*`
                    }).catch(() => console.log(`Couldn't DM user ${challenge.discordId}`));

                } catch (err) { console.error('Discord Action Failed:', err.message); }

                await prisma.challenge.deleteMany({ where: { walletAddress: walletAddress } });
            }

        } catch (error) {
            console.error('Error processing a batch item:', error);
        }
    }

    res.status(200).send('Batch processed');
});

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
    console.log(`Bot Logged in as ${c.user.tag}`);
    try {
        await rest.put(Routes.applicationGuildCommands(process.env.CLIENT_ID, process.env.GUILD_ID), { body: commands });
        console.log('Slash commands loaded.');
    } catch (err) { console.error(err); }
});

client.on(Events.InteractionCreate, async interaction => {
    if (!interaction.isChatInputCommand()) return;

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
                content: `### Your Portfolio\n\n${list}\n\n**Total Net Worth:** \`${totalBalance.toString()} QUBIC\``
            });
        } catch (e) { if(e.code !== 10062) console.error(e); }
    }

    if (interaction.commandName === 'link') {
        try {
            await safeDeferReply(interaction);

            const walletInput = interaction.options.getString('wallet').trim().toUpperCase();
            const discordId = interaction.user.id;

            await prisma.user.upsert({ where: { discordId }, update: {}, create: { discordId } });

            const existingWallet = await prisma.wallet.findUnique({ where: { address: walletInput } });
            
            if (existingWallet && existingWallet.userId !== discordId && existingWallet.isVerified) {
                return interaction.editReply(`Access Denied. Wallet verified by another user.`);
            }
            if (existingWallet && existingWallet.userId === discordId && existingWallet.isVerified) {
                return interaction.editReply(`Already Linked. This wallet is in your portfolio.`);
            }

            await prisma.wallet.upsert({
                where: { address: walletInput },
                update: { userId: discordId },
                create: { address: walletInput, userId: discordId }
            });

            let signalCode;
            const active = await prisma.challenge.findFirst({
                where: { discordId, walletAddress: walletInput, expiresAt: { gt: new Date() } },
                orderBy: { createdAt: 'desc' }
            });

            let statusMsg = "Secure Link Initiated";
            if (active) {
                signalCode = active.signalCode;
                statusMsg = "Active Challenge Found";
            } else {
                signalCode = Math.floor(Math.random() * (99000 - 30000) + 30000);
                await prisma.challenge.create({
                    data: { discordId, walletAddress: walletInput, signalCode, expiresAt: new Date(Date.now() + 600000) }
                });
            }

            const expiryUnix = Math.floor((Date.now() + 600000) / 1000);
            await interaction.editReply({
                content: `### ${statusMsg}\n**Signal Code:** \`${signalCode}\`\n**Wallet:** \`${walletInput}\`\n\n*Place a Limit Bid for **${signalCode} QUBIC**.*\n*Expires <t:${expiryUnix}:R>*`
            });

        } catch (error) {
            if (error.code !== 10062) {
                console.error('Link Cmd Error:', error);
                await interaction.editReply({ content: 'System Error.' }).catch(() => {});
            }
        }
    }
});

app.listen(PORT, () => console.log(`Webhook Server running on port ${PORT}`));
client.login(process.env.DISCORD_TOKEN);