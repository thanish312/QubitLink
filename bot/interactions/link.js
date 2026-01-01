const { EmbedBuilder } = require('discord.js');
const prisma = require('../../services/prisma');
const { safeDeferReply } = require('../../services/discord.service');
const { isValidQubicAddress } = require('../../services/qubic.service');
const { secureRandomInt } = require('../../utils/helpers');
const CONFIG = require('../../config/config');
const { DISCORD_ERROR_CODES } = require('../constants');

module.exports = async (interaction, commandId) => {
    console.info(`[${commandId}] Link command - User: ${interaction.user.tag}`);
    
    try {
        await safeDeferReply(interaction);

        const walletInput = interaction.options.getString('wallet').trim().toUpperCase();
        const discordId = interaction.user.id;

        // 1. Validate Address
        if (!isValidQubicAddress(walletInput)) {
            console.warn(`[${commandId}] Invalid wallet address format: ${walletInput.substring(0,12)}...`);
            return interaction.editReply({
                content: '❌ **Invalid Wallet Address**',
                embeds: [
                    new EmbedBuilder()
                        .setColor(0xEF4444) // Red
                        .setDescription('The address must be exactly **60 uppercase letters (A-Z)**.')
                        .addFields({ name: 'Example', value: '`JAKDBYHQOUICADHMNZMCMQIUVLZCTCCGEYNLBBGPBFNNTVZZCBCIMWICCFHN`' })
                ]
            });
        }

        console.debug(`[${commandId}] Wallet: ${walletInput.substring(0,12)}...`);

        // 2. Database Operations (Upsert User, Check Wallet)
        await prisma.user.upsert({ 
            where: { discordId }, 
            update: {}, 
            create: { discordId } 
        });

        const existingWallet = await prisma.wallet.findUnique({ 
            where: { address: walletInput } 
        });
        
        if (existingWallet && existingWallet.userId === discordId && existingWallet.isVerified) {
            return interaction.editReply({
                embeds: [
                    new EmbedBuilder()
                        .setColor(0x10B981) // Green
                        .setTitle('✅ Already Linked')
                        .setDescription('This wallet is already in your portfolio and verified.')
                ]
            });
        }
        
        if (existingWallet && existingWallet.userId !== discordId && existingWallet.isVerified) {
            return interaction.editReply({
                embeds: [
                    new EmbedBuilder()
                        .setColor(0xEF4444) // Red
                        .setTitle('🚫 Access Denied')
                        .setDescription('This wallet is already verified by another user.')
                ]
            });
        }

        // Create or Update unverified wallet
        if (!existingWallet) {
            await prisma.wallet.create({ data: { address: walletInput, userId: discordId } });
        } else if (existingWallet.userId !== discordId) {
            await prisma.wallet.update({ where: { address: walletInput }, data: { userId: discordId } });
        }

        // 3. Challenge Logic
        let signalCode;
        let isExisting = false;
        
        const activeChallenge = await prisma.challenge.findFirst({
            where: { discordId, walletAddress: walletInput, expiresAt: { gt: new Date() } },
            orderBy: { createdAt: 'desc' }
        });

        if (activeChallenge) {
            signalCode = activeChallenge.signalCode;
            isExisting = true;
            await prisma.challenge.update({
                where: { id: activeChallenge.id },
                data: { expiresAt: new Date(Date.now() + CONFIG.CHALLENGE_EXPIRY_MS) }
            });
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
            console.info(`[${commandId}] New challenge created: ${signalCode}`);
        }

        const expiryUnix = Math.floor((Date.now() + CONFIG.CHALLENGE_EXPIRY_MS) / 1000);

        // 4. Construct the Clean Embed
        const embed = new EmbedBuilder()
            .setColor(0x3B82F6) // Discord Blue
            .setTitle(isExisting ? '🔄 Active Verification Found' : '🔐 Secure Link Initiated')
            .setDescription('To verify ownership, please create a **temporary buy order** using the details below.\n\n_You may cancel the order immediately after it confirms._')
            .addFields(
                { 
                    name: '1️⃣  Order Details', 
                    value: `**Asset:** GARTH\n**Price:** 1\n**Shares:** \`${signalCode}\``, 
                    inline: true 
                },
                { 
                    name: '2️⃣  Links', 
                    value: '[Open QubicTrade](https://qubictrade.com/)\n[Open QXBoard](https://qxboard.com/)', 
                    inline: true 
                },
                { 
                    name: '3️⃣  Verification Code (Shares)', 
                    value: `\`\`\`${signalCode}\`\`\`` // Block for easy copying
                },
                { 
                    name: '👛  Wallet Address', 
                    value: `\`\`\`${walletInput}\`\`\`` // Block for easy copying
                },
                {
                    name: '⏳  Time Limit',
                    value: `Requests expires **<t:${expiryUnix}:R>**.\nVerification typically takes **6-7 minutes**.`
                }
            )
            .setFooter({ text: 'The bot checks for this specific transaction on the blockchain.' });

        await interaction.editReply({ content: '', embeds: [embed] });

    } catch (error) {
        if (error.code !== DISCORD_ERROR_CODES.UNKNOWN_INTERACTION) {
            console.error(`[${commandId}] Link command error: ${error.message}`);
            await interaction.editReply({ content: '🔥 System Error. Please try again.' }).catch(() => {});
        }
    }
};