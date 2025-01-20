const { Client, GatewayIntentBits, Partials, MessageEmbed } = require('discord.js');
const germanData = require('./germanData');
const frenchData = require('./frenchData');
const russianData = require('./russianData');

// Environment variable for bot token
const DISCORD_TOKEN = process.env.DISCORD_TOKEN;

// Create a new Discord client
const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent
    ],
    partials: [Partials.Message, Partials.Channel, Partials.Reaction]
});

// Active quizzes tracker
const activeQuizzes = {};

// Channel ID for Word of the Day
const wordOfTheDayChannelId = '1327875414584201350'; // Replace with your channel ID

// Schedule Word of the Day
client.once('ready', () => {
    console.log('Frau Lingua is online!');
    scheduleWordOfTheDay();
});

// Function to schedule Word of the Day
function scheduleWordOfTheDay() {
    const schedule = [
        { language: 'german', data: germanData.germanWordList, istTime: '18:00' },
        { language: 'russian', data: russianData.russianWordList, istTime: '18:01' },
        { language: 'french', data: frenchData.frenchWordList, istTime: '18:02' },
    ];

    setInterval(() => {
        const currentTime = new Date().toLocaleTimeString('en-IN', {
            hour: '2-digit',
            minute: '2-digit',
            hour12: false,
        });
        schedule.forEach(({ language, data, istTime }) => {
            if (currentTime === istTime) {
                sendWordOfTheDay(language, data);
            }
        });
    }, 60000); // Check every minute
}

// Function to send Word of the Day
function sendWordOfTheDay(language, wordList) {
    const channel = client.channels.cache.get(wordOfTheDayChannelId);
    if (!channel) return;

    const randomWord = wordList[Math.floor(Math.random() * wordList.length)];
    const embedColor = getEmbedColor(language);

    const embed = new MessageEmbed()
        .setColor(embedColor)
        .setTitle(`Word of the Day - ${language.toUpperCase()}`)
        .setDescription(`
**Word:** ${randomWord.word}
**Meaning:** ${randomWord.meaning}
**Plural:** ${randomWord.plural}
**Indefinite Article:** ${randomWord.indefinite}
**Definite Article:** ${randomWord.definite}`);
    channel.send({ embeds: [embed] });
}

// Function to get embed color based on language
function getEmbedColor(language) {
    switch (language) {
        case 'french': return '#09ebf6';
        case 'german': return '#f4ed09';
        case 'russian': return '#7907ff';
        default: return '#1cd86c';
    }
}

client.on('messageCreate', async (message) => {
    if (message.author.bot) return;

    // Help command
    if (message.content.startsWith('!help')) {
        const embed = new MessageEmbed()
            .setColor('#1cd86c')
            .setTitle('Help - Commands')
            .setDescription('Here are the available commands:')
            .addFields(
                { name: '!quiz', value: 'Start a quiz by selecting a language and level.' },
                { name: '!resources', value: 'Get learning resources for German, French, and Russian.' },
                { name: '!help', value: 'Show this help message.' }
            );
        message.channel.send({ embeds: [embed] });
    }

    // Resources command
    if (message.content.startsWith('!resources')) {
        const embed = new MessageEmbed()
            .setColor('#1cd86c')
            .setTitle('Language Learning Resources')
            .setDescription('Here are some resources to help you learn:')
            .addFields(
                { name: 'German', value: 'Duolingo, Deutsche Welle, LingQ' },
                { name: 'French', value: 'Duolingo, Français Facile, TV5MONDE' },
                { name: 'Russian', value: 'Duolingo, Master Russian, Learn Russian Step by Step' }
            );
        message.channel.send({ embeds: [embed] });
    }
});

client.login(DISCORD_TOKEN);