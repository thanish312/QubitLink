const logger = require('../../utils/logger');
const { Events, REST, Routes } = require('discord.js');
const CONFIG = require('../../config/config');
const commands = require('../commands');

module.exports = {
    name: Events.ClientReady,
    once: true,
    async execute(client) {
        logger.info('=== QubicLink Bot Started ===');
        logger.info(`Bot User: ${client.user.tag} (${client.user.id})`);
        logger.info(`Guild ID: ${CONFIG.GUILD_ID}`);

        const rest = new REST({ version: '10' }).setToken(CONFIG.DISCORD_TOKEN);

        try {
            // First, clear all existing commands to prevent duplicates
            await rest.put(
                Routes.applicationGuildCommands(
                    CONFIG.CLIENT_ID,
                    CONFIG.GUILD_ID
                ),
                { body: [] }
            );
            logger.info('Cleared existing commands');

            // Then register the new commands
            await rest.put(
                Routes.applicationGuildCommands(
                    CONFIG.CLIENT_ID,
                    CONFIG.GUILD_ID
                ),
                { body: commands }
            );
            logger.info('Slash commands registered successfully');
        } catch (err) {
            logger.error({ err }, 'Slash command registration failed');
        }
    },
};
