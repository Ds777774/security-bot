const { Client, GatewayIntentBits, Partials, EmbedBuilder } = require('discord.js');
const express = require('express');
const cron = require('node-cron');
const { russianQuizData, germanQuizData, frenchQuizData, russianWordList, germanWordList, frenchWordList } = require('./russianData');
const { shuffleArray } = require('./utilities');
const help = require('./commands/help');
const resources = require('./commands/resources');

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

// Express Server to Keep Bot Alive
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

// Word of the Day Channels
const wordOfTheDayChannels = {
    russian: '1327875414584201350',
    german: '1327875414584201350',
    french: '1327875414584201350,
};

// Word of the Day Schedule
const wordOfTheDayTimes = {
    russian: '00 22 * * *', // 12:30 PM IST
    german: '00 22 * * *',   // 9:00 AM IST
    french: '00 22 * * *', // 6:15 PM IST
};

// Active Quiz Tracking
const activeQuizzes = {};

// Commands and Event Handling
client.on('messageCreate', async (message) => {
    if (message.author.bot) return;

    if (message.content.toLowerCase() === '!quiz') {
        const languageEmbed = new EmbedBuilder()
            .setTitle('Choose a Language for the Quiz')
            .setDescription('React to select the language:\n\n🇩: German\n🇫: French\n🇷: Russian')
            .setColor(embedColors.default);

        const languageMessage = await message.channel.send({ embeds: [languageEmbed] });
        const languageEmojis = ['🇩', '🇫', '🇷'];
        const languages = ['german', 'french', 'russian'];

        for (const emoji of languageEmojis) {
            await languageMessage.react(emoji);
        }

        const filter = (reaction, user) =>
            languageEmojis.includes(reaction.emoji.name) && user.id === message.author.id;

        try {
            const collected = await languageMessage.awaitReactions({ filter, max: 1, time: 15000 });
            const reaction = collected.first();

            if (!reaction) {
                return message.channel.send('No language selected. Quiz cancelled.');
            }

            const selectedLanguage = languages[languageEmojis.indexOf(reaction.emoji.name)];
            await languageMessage.delete();

            const levelEmbed = new EmbedBuilder()
                .setTitle(`Choose Your Level for the ${selectedLanguage.charAt(0).toUpperCase() + selectedLanguage.slice(1)} Quiz`)
                .setDescription('React to select your level:\n\n🇦: A1\n🇧: A2\n🇨: B1\n🇩: B2\n🇪: C1\n🇫: C2')
                .setColor(embedColors[selectedLanguage]);

            const levelMessage = await message.channel.send({ embeds: [levelEmbed] });
            const levelEmojis = ['🇦', '🇧', '🇨', '🇩', '🇪', '🇫'];
            const levels = ['A1', 'A2', 'B1', 'B2', 'C1', 'C2'];

            for (const emoji of levelEmojis) {
                await levelMessage.react(emoji);
            }

            const levelFilter = (reaction, user) =>
                levelEmojis.includes(reaction.emoji.name) && user.id === message.author.id;

            const collectedLevel = await levelMessage.awaitReactions({ filter: levelFilter, max: 1, time: 15000 });
            const levelReaction = collectedLevel.first();

            if (!levelReaction) {
                return message.channel.send('No level selected. Quiz cancelled.');
            }

            const selectedLevel = levels[levelEmojis.indexOf(levelReaction.emoji.name)];
            await levelMessage.delete();

            const quizData = selectedLanguage === 'russian' ? russianQuizData : selectedLanguage === 'german' ? germanQuizData : frenchQuizData;
            const questions = quizData[selectedLevel] || [];
            shuffleArray(questions);
            const questionsToAsk = questions.slice(0, 5);

            if (questionsToAsk.length === 0) {
                return message.channel.send('No questions available for this level.');
            }

            activeQuizzes[message.author.id] = { language: selectedLanguage, level: selectedLevel, score: 0, detailedResults: [] };

            for (const question of questionsToAsk) {
                const embed = new EmbedBuilder()
                    .setTitle(`**${selectedLanguage.charAt(0).toUpperCase() + selectedLanguage.slice(1)} Vocabulary Quiz**`)
                    .setDescription(`What is the English meaning of **"${question.word}"**?\n\n**A:** ${question.options[0]}\n**B:** ${question.options[1]}\n**C:** ${question.options[2]}\n**D:** ${question.options[3]}`)
                    .setColor(embedColors[selectedLanguage])
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

    if (message.content.toLowerCase() === '!help') {
        help.execute(message);
    }

    if (message.content.toLowerCase() === '!resources') {
        resources.execute(message);
    }
});

client.once('ready', () => {
    console.log(`${client.user.tag} is online!`);
});

client.login(DISCORD_TOKEN);