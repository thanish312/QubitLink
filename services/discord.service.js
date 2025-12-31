const { MessageFlags } = require('discord.js');

/**
 * Safely adds role to Discord member with hierarchy checks
 */
async function addRoleSafe(member, roleId, roleName) {
    if (!roleId) {
        console.warn(`Role ID missing for ${roleName}`);
        return;
    }
    
    try {
        if (member.roles.cache.has(roleId)) {
            return;
        }
        await member.roles.add(roleId);
        console.info(`Role assigned: ${roleName} → ${member.user.tag} (${member.id})`);
    } catch (error) {
        console.error(`Role assignment failed: ${roleName} → ${member.user.tag}. Error: ${error.message}. Check bot role hierarchy.`);
    }
}

/**
 * Safely removes role from Discord member
 */
async function removeRoleSafe(member, roleId, roleName) {
    if (!roleId) return;
    
    try {
        if (!member.roles.cache.has(roleId)) {
            return;
        }
        await member.roles.remove(roleId);
        console.info(`Role removed: ${roleName} ← ${member.user.tag} (${member.id})`);
    } catch (error) {
        console.error(`Role removal failed: ${roleName} ← ${member.user.tag}. Error: ${error.message}`);
    }
}

/**
 * Safely defers Discord interaction reply
 */
async function safeDeferReply(interaction) {
    if (!interaction || interaction.deferred || interaction.replied) return;
    
    try {
        await interaction.deferReply({ flags: MessageFlags.Ephemeral });
    } catch (err) {
        if (err?.code === 40060) return;
        console.error(`Defer reply failed: ${err.message}`);
    }
}

module.exports = {
    addRoleSafe,
    removeRoleSafe,
    safeDeferReply
};