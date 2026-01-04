const logger = require('../utils/logger');
const cron = require('node-cron');
const { prisma } = require('../services/prisma');
const { addRoleSafe, removeRoleSafe } = require('../services/discord.service');
const CONFIG = require('../config/config');
const { withRetry } = require('../utils/retry');

const processUserRoles = async (guild, userPortfolio, roleThresholds) => {
    try {
        const member = await guild.members.fetch(userPortfolio.userId).catch(() => null);
        if (!member) {
            logger.debug({ userId: userPortfolio.userId }, 'Member not found in guild, skipping role assignment.');
            return;
        }
        
        // Ensure the member's roles cache is up-to-date
        await member.fetch();

        const totalNetWorth = userPortfolio.totalBalance;
        logger.debug(
            { userId: member.id, totalNetWorth: totalNetWorth.toString(), type: typeof totalNetWorth }, 
            'Processing user for role assignment'
        );

        // Log all available thresholds for debugging
        roleThresholds.forEach(role => {
            logger.debug(
                { roleName: role.roleName, threshold: role.threshold.toString(), type: typeof role.threshold },
                'Evaluating against role threshold.'
            );
        });

        // Find the highest role the user qualifies for.
        const targetRoleThreshold = roleThresholds.find(role => {
            const comparison = BigInt(totalNetWorth) >= BigInt(role.threshold);
            logger.debug(
                { 
                    roleName: role.roleName, 
                    netWorth: totalNetWorth.toString(), 
                    threshold: role.threshold.toString(), 
                    isMet: comparison 
                },
                'Comparing net worth to role threshold.'
            );
            return comparison;
        });

        if (targetRoleThreshold) {
            logger.info({ userId: member.id, determinedRole: targetRoleThreshold.roleName }, 'Target role determined.');
        } else {
            logger.info({ userId: member.id, netWorth: totalNetWorth.toString() }, 'User did not meet any role thresholds.');
        }

        // Assign target role
        if (targetRoleThreshold) {
            if (!member.roles.cache.has(targetRoleThreshold.roleId)) {
                await addRoleSafe(member, targetRoleThreshold.roleId, targetRoleThreshold.roleName);
            } else {
                logger.debug({ userId: member.id, roleName: targetRoleThreshold.roleName }, 'Member already has target role.');
            }
        }

        // Remove other threshold-based roles if no longer applicable or not the target
        for (const role of roleThresholds) {
            if (
                (!targetRoleThreshold || role.roleId !== targetRoleThreshold.roleId) &&
                member.roles.cache.has(role.roleId)
            ) {
                await removeRoleSafe(member, role.roleId, role.roleName);
            }
        }
    } catch (err) {
        logger.error({ userId: userPortfolio.userId, err }, 'Error processing user roles');
    }
};

const roleAssignmentJob = (client) => {
    try {
        // Run more frequently to ensure roles are up to date with cached portfolios
        cron.schedule('*/30 * * * *', async () => {
            logger.info('=== Role Assignment Job Started ===');

            try {
                const guild = await client.guilds
                    .fetch(CONFIG.GUILD_ID)
                    .catch(() => null);
                if (!guild) {
                    logger.error('Guild not found, aborting role assignment.');
                    return;
                }

                const roleThresholds = await withRetry(() =>
                    prisma.roleThreshold.findMany({
                        orderBy: { threshold: 'desc' },
                    }), 'roleAssignmentJob-fetchThresholds');

                if (roleThresholds.length === 0) {
                    logger.info(
                        'No role thresholds configured. Skipping role assignment.'
                    );
                    return;
                }

                const portfolios = await withRetry(() => prisma.portfolio.findMany(), 'roleAssignmentJob-fetchPortfolios');

                for (const userPortfolio of portfolios) {
                    await processUserRoles(
                        guild,
                        userPortfolio,
                        roleThresholds
                    );
                }

                logger.info('=== Role Assignment Job Complete ===');
            } catch (error) {
                logger.error(
                    { err: error },
                    'Role assignment job critical failure after retries'
                );
            }
        });
    } catch (e) {
        logger.error({ err: e }, 'Failed to start role assignment job');
    }
};

module.exports = { roleAssignmentJob, processUserRoles };
