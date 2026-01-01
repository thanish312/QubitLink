const prisma = require('../../services/prisma');
const { safeDeferReply } = require('../../services/discord.service');
const { getQubicBalance } = require('../../services/qubic.service');
const { DISCORD_ERROR_CODES } = require('../constants');

module.exports = async (interaction, commandId) => {
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
            return `${i + 1}. ${w.address.slice(0, 8)}... ${w.isVerified ? `✅ (${bal.toString()} Q)` : '⏳ Pending verification'}`;
        });
        
        const list = (await Promise.all(listPromises)).join('\n');

        await interaction.editReply({
            content: `### 💼 Your Portfolio\n\n${list}\n\n**Total Net Worth:** ${totalBalance.toString()} QUBIC`
        });
        
        console.info(`[${commandId}] Portfolio displayed - Wallets: ${wallets.length}, Total: ${totalBalance.toString()}`);
    } catch (e) { 
        if (e.code !== DISCORD_ERROR_CODES.UNKNOWN_INTERACTION) {
            console.error(`[${commandId}] Portfolio command error: ${e.message}`);
        }
    }
};
