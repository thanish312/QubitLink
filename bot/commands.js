const { SlashCommandBuilder } = require('discord.js');

const commands = [
    new SlashCommandBuilder()
        .setName('link')
        .setDescription('Add a wallet to your portfolio')
        .addStringOption((option) =>
            option
                .setName('wallet')
                .setDescription('Qubic Address')
                .setRequired(true)
        ),
    new SlashCommandBuilder()
        .setName('portfolio')
        .setDescription('View your linked wallets'),
].map((c) => c.toJSON());

module.exports = commands;
