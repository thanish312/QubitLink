const logger = require('../utils/logger');


/**
 * Safely adds a role to a Discord member with hierarchy checks.
 * @param {import('discord.js').GuildMember} member - The member to add the role to.
 * @param {string} roleId - The ID of the role to add.
 * @param {string} roleName - The name of the role (for logging).
 */
async function addRoleSafe(member, roleId, roleName) {
    if (!roleId) {
        logger.warn({ roleName }, '[DiscordService] Role ID missing');
        return;
    }

    try {
        if (member.roles.cache.has(roleId)) {
            logger.debug(
                { roleName, userId: member.id },
                '[DiscordService] Member already has role'
            );
            return;
        }
        await member.roles.add(roleId);
        logger.info(
            { roleName, userId: member.id, userTag: member.user.tag },
            '[DiscordService] Role assigned'
        );
    } catch (error) {
        logger.error(
            {
                err: error,
                roleName,
                userId: member.id,
                userTag: member.user.tag,
            },
            '[DiscordService] Role assignment failed. Check bot role hierarchy.'
        );
    }
}

/**
 * Safely removes a role from a Discord member.
 * @param {import('discord.js').GuildMember} member - The member to remove the role from.
 * @param {string} roleId - The ID of the role to remove.
 * @param {string} roleName - The name of the role (for logging).
 */
async function removeRoleSafe(member, roleId, roleName) {
    if (!roleId) return;

    try {
        if (!member.roles.cache.has(roleId)) {
            logger.debug(
                { roleName, userId: member.id },
                '[DiscordService] Member does not have role'
            );
            return;
        }
        await member.roles.remove(roleId);
        logger.info(
            { roleName, userId: member.id, userTag: member.user.tag },
            '[DiscordService] Role removed'
        );
    } catch (error) {
        logger.error(
            {
                err: error,
                roleName,
                userId: member.id,
                userTag: member.user.tag,
            },
            '[DiscordService] Role removal failed'
        );
    }
}

module.exports = { addRoleSafe, removeRoleSafe };
