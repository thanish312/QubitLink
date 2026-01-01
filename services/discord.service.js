const { MessageFlags } = require('discord.js');
const { DISCORD_ERROR_CODES } = require('../bot/constants');

/**
 * Safely adds a role to a Discord member with hierarchy checks.
 * @param {import('discord.js').GuildMember} member - The member to add the role to.
 * @param {string} roleId - The ID of the role to add.
 * @param {string} roleName - The name of the role (for logging).
 */
async function addRoleSafe(member, roleId, roleName) {
    if (!roleId) {
        console.warn(`[DiscordService] Role ID missing for ${roleName}`);
        return;
    }
    
    try {
        if (member.roles.cache.has(roleId)) {
            return;
        }
        await member.roles.add(roleId);
        console.info(`[DiscordService] Role assigned: ${roleName} -> ${member.user.tag} (${member.id})`);
    } catch (error) {
        console.error(`[DiscordService] Role assignment failed: ${roleName} -> ${member.user.tag}. Error: ${error.message}. Check bot role hierarchy.`);
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
            return;
        }
        await member.roles.remove(roleId);
        console.info(`[DiscordService] Role removed: ${roleName} <- ${member.user.tag} (${member.id})`);
    } catch (error) {
        console.error(`[DiscordService] Role removal failed: ${roleName} <- ${member.user.tag}. Error: ${error.message}`);
    }
}

/**
 * Safely defers a Discord interaction reply.
 * @param {import('discord.js').Interaction} interaction - The interaction to defer.
 */
async function safeDeferReply(interaction) {
    if (!interaction || interaction.deferred || interaction.replied) return;
    
    try {
        await interaction.deferReply({ flags: MessageFlags.Ephemeral });
    } catch (err) {
        if (err?.code === DISCORD_ERROR_CODES.INTERACTION_ALREADY_ACKNOWLEDGED) return;
        console.error(`[DiscordService] Defer reply failed: ${err.message}`);
    }
}

module.exports = {
    addRoleSafe,
    removeRoleSafe,
    safeDeferReply
};