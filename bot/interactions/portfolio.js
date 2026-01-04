const logger = require('../../utils/logger');
const { prisma } = require('../../services/prisma');
const { getQubicBalance } = require('../../services/qubic.service');
const { DISCORD_ERROR_CODES } = require('../constants');

module.exports = async (interaction, commandId) => {
    logger.info({ commandId, user: interaction.user.tag }, 'Portfolio command');

    try {
        // 1. Defer the reply IMMEDIATELY.
        await interaction.deferReply({ ephemeral: true });

        // 2. Do the slow work.
        const wallets = await prisma.wallet.findMany({
            where: { userId: interaction.user.id },
        });

        if (wallets.length === 0) {
            logger.debug({ commandId }, 'No wallets found');
            return interaction.editReply(
                'You have no linked wallets. Use `/link` to add one.'
            );
        }

        let totalBalance = 0n;
        const listPromises = wallets.map(async (w, i) => {
            try {
                const bal = w.isVerified
                    ? await getQubicBalance(w.address)
                    : 0n;
                if (w.isVerified) totalBalance += bal;
                return `${i + 1}. ${w.address.slice(0, 8)}... ${
                    w.isVerified
                        ? `✅ (${bal.toString()} Q)`
                        : '⏳ Pending verification'
                }`;
            } catch {
                logger.warn(
                    { commandId, wallet: w.address },
                    'Failed to fetch balance for a wallet, showing 0.'
                );
                return `${i + 1}. ${w.address.slice(0, 8)}... ⚠️ RPC Error (showing 0 Q)`;
            }
        });

        const list = (await Promise.all(listPromises)).join('\n');

        // 3. Edit the reply with the final result.
        await interaction.editReply({
            content: `### 💼 Your Portfolio\n\n${list}\n\n**Total Net Worth:** ${totalBalance.toString()} QUBIC`,
        });

        logger.info(
            {
                commandId,
                walletCount: wallets.length,
                totalBalance: totalBalance.toString(),
            },
            'Portfolio displayed'
        );
    } catch (e) {
        // This will catch errors from the deferReply or initial prisma query.
        if (e.code !== DISCORD_ERROR_CODES.UNKNOWN_INTERACTION) {
            logger.error({ commandId, err: e }, 'Portfolio command failed');
            // If we already deferred, we have to use editReply.
            if (!interaction.replied) {
                await interaction
                    .editReply({
                        content:
                            'An error occurred while fetching your portfolio.',
                    })
                    .catch(() => {});
            }
        }
    }
};
