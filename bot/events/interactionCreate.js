const { Events } = require('discord.js');
const portfolio = require('../interactions/portfolio');
const link = require('../interactions/link');

const commands = {
    portfolio,
    link,
};

module.exports = {
    name: Events.InteractionCreate,
    async execute(interaction) {
        if (!interaction.isChatInputCommand()) return;

        const commandId = `${interaction.user.id}-${Date.now()}`;
        const command = commands[interaction.commandName];

        if (command) {
            await command(interaction, commandId);
        }
    },
};
