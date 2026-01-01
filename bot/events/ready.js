const { Events, REST, Routes } = require('discord.js');
const CONFIG = require('../../config/config');
const commands = require('../commands');

module.exports = {
    name: Events.ClientReady,
    once: true,
    async execute(client) {
        console.info('=== QubicLink Bot Started ===');
        console.info(`Bot User: ${client.user.tag} (${client.user.id})`);
        console.info(`Guild ID: ${CONFIG.GUILD_ID}`);

        const rest = new REST({ version: '10' }).setToken(CONFIG.DISCORD_TOKEN);
        
        try {
            // First, clear all existing commands to prevent duplicates
            await rest.put(
                Routes.applicationGuildCommands(CONFIG.CLIENT_ID, CONFIG.GUILD_ID), 
                { body: [] }
            );
            console.info('Cleared existing commands');
            
            // Then register the new commands
            await rest.put(
                Routes.applicationGuildCommands(CONFIG.CLIENT_ID, CONFIG.GUILD_ID), 
                { body: commands }
            );
            console.info('Slash commands registered successfully');
        } catch (err) { 
            console.error('Slash command registration failed:', err.message); 
        }
    },
};
