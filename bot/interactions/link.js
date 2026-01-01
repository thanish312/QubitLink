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

        if (!isValidQubicAddress(walletInput)) {
            console.warn(`[${commandId}] Invalid wallet address format: ${walletInput.substring(0,12)}...`);
            return interaction.editReply('❌ Invalid wallet address. Must be exactly 60 uppercase letters (A-Z).\n\nExample: `JAKDBYHQOUICADHMNZMCMQIUVLZCTCCGEYNLBBGPBFNNTVZZCBCIMWICCFHN`');
        }

        console.debug(`[${commandId}] Wallet: ${walletInput.substring(0,12)}...`);

        await prisma.user.upsert({ 
            where: { discordId }, 
            update: {}, 
            create: { discordId } 
        });

        const existingWallet = await prisma.wallet.findUnique({ 
            where: { address: walletInput } 
        });
        
        if (existingWallet && existingWallet.userId === discordId && existingWallet.isVerified) {
            console.debug(`[${commandId}] Wallet already linked and verified for this user`);
            return interaction.editReply('✅ Already Linked. This wallet is in your portfolio and verified.');
        }
        
        if (existingWallet && existingWallet.userId !== discordId && existingWallet.isVerified) {
            console.warn(`[${commandId}] Wallet already verified by another user`);
            return interaction.editReply('🚫 Access Denied. This wallet is already verified by another user.');
        }

        // Explicitly create or update to prevent duplicates
        if (!existingWallet) {
            await prisma.wallet.create({
                data: {
                    address: walletInput,
                    userId: discordId,
                }
            });
        } else if (existingWallet.userId !== discordId) {
            // Allow a user to "claim" an unverified wallet entry
            await prisma.wallet.update({
                where: { address: walletInput },
                data: { userId: discordId }
            });
        }


        let signalCode;
        let statusMsg = "🔐 Secure Link Initiated";
        const activeChallenge = await prisma.challenge.findFirst({
            where: { 
                discordId, 
                walletAddress: walletInput, 
                expiresAt: { gt: new Date() } 
            },
            orderBy: { createdAt: 'desc' }
        });

        if (activeChallenge) {
            signalCode = activeChallenge.signalCode;
            statusMsg = "🔄 Active Challenge Found";
            // Reset the timer by updating the expiresAt field
            await prisma.challenge.update({
                where: { id: activeChallenge.id },
                data: { expiresAt: new Date(Date.now() + CONFIG.CHALLENGE_EXPIRY_MS) }
            });
            console.info(`[${commandId}] Reusing and resetting timer for existing challenge: ${signalCode}`);
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
        
        await interaction.editReply({
            content: `### ${statusMsg}\n\nTo verify ownership of your wallet, please complete a **temporary buy order**.\n\n---\n\n#### 1️⃣ Create a Buy Order\n- **Asset:** \n- **Price:** \n- **Shares:** \n\nUse https://qubictrade.com/ or https://qxboard.com/ to place the order.\n\n---\n\n#### 2️⃣ Confirmation & Cancellation\n- Once the transaction is confirmed, you may **cancel the order immediately** to recover your funds.  \n- Verification typically completes within **6–7 minutes**.\n\n⏳ **Time limit:** Please complete this within **5 minutes**  \n⏰ This request expires **<t:${expiryUnix}:R>**\n\n---\n\n**Wallet:** \n**Verification Code:** `
        });

        console.info(`[${commandId}] Challenge sent - Code: ${signalCode}`);

    } catch (error) {
        if (error.code !== DISCORD_ERROR_CODES.UNKNOWN_INTERACTION) {
            console.error(`[${commandId}] Link command error: ${error.message}`);
            await interaction.editReply({ content: '🔥 System Error. Please try again.' }).catch(() => {});
        }
    }
};
