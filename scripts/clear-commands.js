require('dotenv').config();
const { REST, Routes } = require('discord.js');
const CONFIG = require('../config/config');

const rest = new REST({ version: '10' }).setToken(CONFIG.DISCORD_TOKEN);

async function clearCommands() {
    try {
        console.log('Clearing guild commands...');
        await rest.put(
            Routes.applicationGuildCommands(CONFIG.CLIENT_ID, CONFIG.GUILD_ID),
            { body: [] }
        );
        console.log('✅ Guild commands cleared');
        
        console.log('Clearing global commands...');
        await rest.put(
            Routes.applicationCommands(CONFIG.CLIENT_ID),
            { body: [] }
        );
        console.log('✅ Global commands cleared');
        
        console.log('All commands cleared successfully!');
    } catch (error) {
        console.error('Error clearing commands:', error);
    }
}

clearCommands();

