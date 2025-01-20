const { Client, GatewayIntentBits, Partials, EmbedBuilder } = require('discord.js');
const express = require('express');
const cron = require('node-cron');
const { russianQuizData, germanQuizData, frenchQuizData, russianWordList, germanWordList, frenchWordList } = require('./russianData'); // Assuming you have the data in separate files
const { shuffleArray } = require('./utilities');
const help = require('./commands/help'); // Assuming you have a separate help file
const resources = require('./commands/resources'); // Assuming you have a separate resources file

// Environment Variables
const DISCORD_TOKEN = process.env.DISCORD_TOKEN;

if (!DISCORD_TOKEN) {
    console.error('Error: DISCORD_TOKEN environment variable is not set.');
    process.exit(1);
}

const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent,
        GatewayIntentBits.GuildMessageReactions,
    ],
    partials: [Partials.Message, Partials.Channel, Partials.Reaction],
});

// Express Server to Keep the Bot Alive
const app = express();
app.get('/', (req, res) => {
    res.send('Bot is running!');
});
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Server is running on port ${PORT}`));

// Embed Colors
const embedColors = {
    russian: '#7907ff',
    german: '#f4ed09',
    french: '#09ebf6',
    default: '#1cd86c',
};

// Word of the Day Channels and Schedule
const wordOfTheDayChannels = {
    russian: 'YOUR_RUSSIAN_CHANNEL_ID_HERE',
    german: 'YOUR_GERMAN_CHANNEL_ID_HERE',
    french: 'YOUR_FRENCH_CHANNEL_ID_HERE',
};

// Word of the Day Schedule (Change timings if needed)
const wordOfTheDayTimes = {
    russian: '30 12 * * *', // 12:30 PM IST
    german: '0 9 * * *', // 9:00 AM IST
    french: '15 18 * * *', // 6:15 PM IST
};

// Active Quiz Tracking
const activeQuizzes = {};

// Bot Commands
client.on('messageCreate', async (message) => {
    if (message.author.bot) return;

    // !quiz Command
    if (message.content.toLowerCase().startsWith('!quiz')) {
        const language = message.content.split(' ')[1]?.toLowerCase();
        if (!['russian', 'german', 'french'].includes(language)) {
            return message.channel.send('Please specify a valid language: `!quiz russian`, `!quiz german`, or `!quiz french`.');
        }

        if (activeQuizzes[message.author.id]) {
            return message.reply('You are already taking a quiz. Please finish it first.');
        }

        const levelEmbed = new EmbedBuilder()
            .setTitle(`Choose Your Level for the ${language.charAt(0).toUpperCase() + language.slice(1)} Quiz`)
            .setDescription('React to select your level:\n\n🇦: A1\n🇧: A2\n🇨: B1\n🇩: B2\n🇪: C1\n🇫: C2')
            .setColor(embedColors[language]);

        const levelMessage = await message.channel.send({ embeds: [levelEmbed] });
        const levelEmojis = ['🇦', '🇧', '🇨', '🇩', '🇪', '🇫'];
        const levels = ['A1', 'A2', 'B1', 'B2', 'C1', 'C2'];

        for (const emoji of levelEmojis) {
            await levelMessage.react(emoji);
        }

        const filter = (reaction, user) =>
            levelEmojis.includes(reaction.emoji.name) && user.id === message.author.id;

        try {
            const collected = await levelMessage.awaitReactions({ filter, max: 1, time: 15000 });
            const reaction = collected.first();

            if (!reaction) {
                return message.channel.send('No level selected. Quiz cancelled.');
            }

            const selectedLevel = levels[levelEmojis.indexOf(reaction.emoji.name)];
            await levelMessage.delete();

            const quizData = language === 'russian' ? russianQuizData : language === 'german' ? germanQuizData : frenchQuizData;
            const questions = quizData[selectedLevel] || [];
            shuffleArray(questions);
            const questionsToAsk = questions.slice(0, 5);

            if (questionsToAsk.length === 0) {
                return message.channel.send('No questions available for this level.');
            }

            activeQuizzes[message.author.id] = { language, level: selectedLevel, score: 0, detailedResults: [] };

            for (const question of questionsToAsk) {
                const embed = new EmbedBuilder()
                    .setTitle(`**${language.charAt(0).toUpperCase() + language.slice(1)} Vocabulary Quiz**`)
                    .setDescription(`What is the English meaning of "${question.word}"?`)
                    .addFields(question.options.map((opt, i) => ({
                        name: `Option ${String.fromCharCode(65 + i)}`,
                        value: opt,
                        inline: true,
                    })))
                    .setColor(embedColors[language])
                    .setFooter({ text: 'React with the emoji corresponding to your answer.' });

                const quizMessage = await message.channel.send({ embeds: [embed] });
                const emojis = ['🇦', '🇧', '🇨', '🇩'];
                for (const emoji of emojis) {
                    await quizMessage.react(emoji);
                }

                const quizFilter = (reaction, user) =>
                    emojis.includes(reaction.emoji.name) && user.id === message.author.id;

                const quizCollected = await quizMessage.awaitReactions({ filter: quizFilter, max: 1, time: 60000 });
                const quizReaction = quizCollected.first();

                if (quizReaction && quizReaction.emoji.name === question.correct) {
                    activeQuizzes[message.author.id].score++;
                }

                activeQuizzes[message.author.id].detailedResults.push({
                    word: question.word,
                    userAnswer: quizReaction
                        ? question.options[emojis.indexOf(quizReaction.emoji.name)]
                        : 'No Answer',
                    correct: question.meaning,
                    isCorrect: quizReaction && quizReaction.emoji.name === question.correct,
                });

                await quizMessage.delete();
            }

            const result = activeQuizzes[message.author.id];
            delete activeQuizzes[message.author.id];

            const resultEmbed = new EmbedBuilder()
                .setTitle('Quiz Results')
                .setDescription(`You scored ${result.score} out of 5 in level ${result.level} (${result.language.charAt(0).toUpperCase() + result.language.slice(1)})!`)
                .setColor(embedColors[result.language])
                .addFields(
                    { name: 'Level', value: result.level, inline: false },
                    {
                        name: 'Language',
                        value: result.language.charAt(0).toUpperCase() + result.language.slice(1),
                        inline: false,
                    },
                    {
                        name: 'Detailed Results',
                        value: result.detailedResults
                            .map(
                                (res) =>
                                    `**Word:** ${res.word}\nYour Answer: ${res.userAnswer}\nCorrect: ${res.correct}\nResult: ${
                                        res.isCorrect ? '✅' : '❌'
                                    }`
                            )
                            .join('\n\n'),
                    }
                );

            await message.channel.send({ embeds: [resultEmbed] });
        } catch (error) {
            console.error(error);
            return message.channel.send('An error occurred. Please try again.');
        }
    }

    // !help Command
    if (message.content.toLowerCase() === '!help') {
        help.execute(message);
    }

    // !resources Command
    if (message.content.toLowerCase() === '!resources') {
        resources.execute(message);
    }
});

// Word of the Day Scheduler
cron.schedule(wordOfTheDayTimes.russian, async () => {
    const channel = await client.channels.fetch(wordOfTheDayChannels.russian);
    const randomWord = russianWordList[Math.floor(Math.random() * russianWordList.length)];

    const embed = new EmbedBuilder()
        .setTitle('**Word of the Day (Russian)**')
        .setDescription(`**Word:** ${randomWord.word}`)
        .addFields(
            { name: 'Meaning', value: randomWord.meaning },
            { name: 'Plural', value: randomWord.plural },
            { name: 'Examples', value: randomWord.examples }
        )
        .setColor(embedColors.russian);

    await channel.send({ embeds: [embed] });
}, {
    scheduled: true,
    timezone: 'Asia/Kolkata',
});

// Similarly for German and French Word of the Day cron tasks...

// Bot Ready Event
client.once('ready', () => {
    console.log(`${client.user.tag} is online!`);
});

// Login the Bot
client.login(DISCORD_TOKEN);