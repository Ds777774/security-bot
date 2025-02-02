const { REST, Routes } = require('discord.js');
require('dotenv').config();

const commands = [
    {
        name: 'quiz',
        description: 'Start a language quiz',
    },
    {
        name: 'leaderboard',
        description: 'View the quiz leaderboard',
    },
    {
        name: 'ticket',
        description: 'Open a support ticket',
    },
    {
        name: 'suggestion',
        description: 'Submit a suggestion',
    },
    {
        name: 'announcement',
        description: 'Send an announcement',
    },
    {
        name: 'updates',
        description: 'Get the latest updates',
    },
    {
        name: 'help',
        description: 'Get a list of available commands',
    },
    {
        name: 'resources',
        description: 'View language learning resources',
    },
    {
        name: 'modrank',
        description: 'Check the moderator leaderboard',
    }
];

const rest = new REST({ version: '10' }).setToken(process.env.DISCORD_TOKEN);

(async () => {
    try {
        console.log('Registering slash commands...');
        await rest.put(
            Routes.applicationCommands(process.env.CLIENT_ID),
            { body: commands }
        );
        console.log('Slash commands registered successfully.');
    } catch (error) {
        console.error('Error registering slash commands:', error);
    }
})();