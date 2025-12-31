const { Events } = require('discord.js');
const prisma = require('../../services/prisma');
const { safeDeferReply } = require('../../services/discord.service');
const { getQubicBalance, isValidQubicAddress } = require('../../services/qubic.service');
const { secureRandomInt } = require('../../utils/helpers');
const CONFIG = require('../../config/config');

module.exports = {
    name: Events.InteractionCreate,
    async execute(interaction) {
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
                    return `${i+1}. 
${w.address.substring(0, 8)}...
 - ${w.isVerified ? '✅' : '⏳'} ${w.isVerified ? `(${bal.toString()} Q)` : ''}`;
                });
                
                const list = (await Promise.all(listPromises)).join('\n');

                await interaction.editReply({
                    content: `### 💼 Your Portfolio\n\n${list}\n\n**Total Net Worth:** 
${totalBalance.toString()} QUBIC`
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

                if (active) {
                    signalCode = active.signalCode;
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
                
                await interaction.editReply({
  content: 
`🔐 **Wallet Verification Required**

To verify ownership of your wallet, complete a **temporary buy order**.

**1️⃣ Create a Buy Order**
• **Asset:** \`GARTH\`  
• **Price:** \`1 QU\`  
• **Shares:** \`${signalCode}\`

Create the order using:
<https://qubictrade.com/> or <https://qxboard.com/>

**2️⃣ Confirmation & Cancellation**
• Once confirmed, you may **cancel the order immediately** to recover your funds  
• Verification completes in **~6–7 minutes**

⏳ **Time limit:** 5 minutes  
⏰ **Expires:** <t:${expiryUnix}:R>

**Wallet:** \`${walletInput}\`  
**Verification Code:** \`${signalCode}\``
});


                console.info(`[${commandId}] Challenge sent - Code: ${signalCode}`);

            } catch (error) {
                if (error.code !== 10062) {
                    console.error(`[${commandId}] Link command error: ${error.message}`);
                    await interaction.editReply({ content: '🔥 System Error. Please try again.' }).catch(() => {});
                }
            }
        }
    },
};
