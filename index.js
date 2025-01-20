const { Client, GatewayIntentBits, Partials, EmbedBuilder } = require('discord.js');
const express = require('express');
const cron = require('node-cron');
const { germanQuizData, germanWordList } = require('./germanData');
const { frenchQuizData, frenchWordList } = require('./frenchData');
const { russianQuizData, russianWordList } = require('./russianData');
const { shuffleArray, clearActiveQuiz } = require('./utilities');

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

// Express server to keep the bot alive
const app = express();
app.get('/', (req, res) => {
    res.send('Bot is running!');
});
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Server is running on port ${PORT}`));

// Embed Colors for Different Languages
const embedColors = {
    german: '#f4ed09',
    french: '#09ebf6',
    russian: '#7907ff',
    default: '#87CEEB',
};

// Word of the Day Channels
const wordOfTheDayChannels = {
    german: '1327875414584201350',
    french: '1327875414584201350',
    russian: '1327875414584201350',
};

// Active Quiz Tracking
const activeQuizzes = {};

// Start Command
client.on('messageCreate', async (message) => {
    if (message.content.toLowerCase() === '!quiz') {
        if (activeQuizzes[message.author.id]) {
            return message.reply('You are already taking a quiz. Please finish it first.');
        }

        const languageEmbed = new EmbedBuilder()
            .setTitle('Choose Your Quiz Language')
            .setDescription('React to select your language:\n\n🇩: German\n🇫: French\n🇷: Russian')
            .setColor(embedColors.default);

        const languageMessage = await message.channel.send({ embeds: [languageEmbed] });
        const languageEmojis = ['🇩', '🇫', '🇷'];
        const languages = ['german', 'french', 'russian'];

        for (const emoji of languageEmojis) {
            await languageMessage.react(emoji);
        }

        const filter = (reaction, user) => languageEmojis.includes(reaction.emoji.name) && user.id === message.author.id;
        try {
            const collected = await languageMessage.awaitReactions({ filter, max: 1, time: 15000 });
            const reaction = collected.first();

            if (!reaction) {
                return message.channel.send('No language selected. Quiz cancelled.');
            }

            const selectedLanguage = languages[languageEmojis.indexOf(reaction.emoji.name)];
            const quizData = {
                german: germanQuizData,
                french: frenchQuizData,
                russian: russianQuizData,
            }[selectedLanguage];

            await languageMessage.delete();

            const levelEmbed = new EmbedBuilder()
                .setTitle('Choose Your Level')
                .setDescription('React to select your level:\n\n🇦: A1\n🇧: A2\n🇨: B1\n🇩: B2\n🇪: C1\n🇫: C2')
                .setColor(embedColors[selectedLanguage]);

            const levelMessage = await message.channel.send({ embeds: [levelEmbed] });
            const levelEmojis = ['🇦', '🇧', '🇨', '🇩', '🇪', '🇫'];
            const levels = ['A1', 'A2', 'B1', 'B2', 'C1', 'C2'];

            for (const emoji of levelEmojis) {
                await levelMessage.react(emoji);
            }

            const levelFilter = (reaction, user) => levelEmojis.includes(reaction.emoji.name) && user.id === message.author.id;
            const levelCollected = await levelMessage.awaitReactions({ filter: levelFilter, max: 1, time: 15000 });
            const levelReaction = levelCollected.first();

            if (!levelReaction) {
                return message.channel.send('No level selected. Quiz cancelled.');
            }

            const selectedLevel = levels[levelEmojis.indexOf(levelReaction.emoji.name)];
            await levelMessage.delete();

            const questions = quizData[selectedLevel] || [];
            shuffleArray(questions);
            const questionsToAsk = questions.slice(0, 5);

            if (questionsToAsk.length === 0) {
                return message.channel.send('No questions available for this level.');
            }

            activeQuizzes[message.author.id] = { language: selectedLanguage, level: selectedLevel, score: 0, detailedResults: [] };

            for (const question of questionsToAsk) {
                const embed = new EmbedBuilder()
                    .setTitle(`**${selectedLanguage.toUpperCase()} Vocabulary Quiz**`)
                    .setDescription(`What is the English meaning of "${question.word}"?`)
                    .addFields(question.options.map((opt) => ({ name: opt, value: '\u200B', inline: true })))
                    .setColor(embedColors[selectedLanguage])
                    .setFooter({ text: 'React with the emoji corresponding to your answer' });

                const quizMessage = await message.channel.send({ embeds: [embed] });
                for (const emoji of ['🇦', '🇧', '🇨', '🇩']) {
                    await quizMessage.react(emoji);
                }

                const quizFilter = (reaction, user) =>
                    ['🇦', '🇧', '🇨', '🇩'].includes(reaction.emoji.name) && user.id === message.author.id;
                const quizCollected = await quizMessage.awaitReactions({ filter: quizFilter, max: 1, time: 15000 });
                const quizReaction = quizCollected.first();

                if (quizReaction && quizReaction.emoji.name === question.correct) {
                    activeQuizzes[message.author.id].score++;
                }

                await quizMessage.delete();
            }

            const result = activeQuizzes[message.author.id];
            clearActiveQuiz(activeQuizzes, message.author.id);

            const resultEmbed = new EmbedBuilder()
                .setTitle('Quiz Results')
                .setDescription(`You scored ${result.score} out of 5!`)
                .addFields(
                    { name: 'Level', value: result.level, inline: false },
                    { name: 'Language', value: result.language, inline: false }
                )
                .setColor(embedColors[selectedLanguage]);

            await message.channel.send({ embeds: [resultEmbed] });

            const detailedResultEmbed = new EmbedBuilder()
                .setTitle('Detailed Results')
                .setColor(embedColors[selectedLanguage])
                .setDescription(
                    result.detailedResults
                        .map(
                            (res) =>
                                `**Word:** ${res.word}\nYour Answer: ${res.userAnswer}\nCorrect: ${res.correct}\nResult: ${
                                    res.isCorrect ? '✅' : '❌'
                                }`
                        )
                        .join('\n\n')
                );

            await message.channel.send({ embeds: [detailedResultEmbed] });
        } catch (error) {
            console.error(error);
            return message.channel.send('An error occurred. Please try again.');
        }
    }
});
// Word of the Day Setup
const sendWordOfTheDay = async (language) => {
    const wordChannel = await client.channels.fetch(wordOfTheDayChannels[language]);

    if (!wordChannel) {
        console.error(`Channel for ${language} not found.`);
        return;
    }

    const wordList = {
        german: germanWordList,
        french: frenchWordList,
        russian: russianWordList,
    }[language];

    const randomWord = wordList[Math.floor(Math.random() * wordList.length)];

    const wordEmbed = new EmbedBuilder()
        .setTitle(`Word of the Day - ${language.charAt(0).toUpperCase() + language.slice(1)}`)
        .setDescription(`**${randomWord.word}**\n\n${randomWord.translation}`)
        .setColor(embedColors[language]);

    await wordChannel.send({ embeds: [wordEmbed] });
};

// Schedule Word of the Day
cron.schedule('30 12 * * *', () => {
    sendWordOfTheDay('german');
    sendWordOfTheDay('french');
    sendWordOfTheDay('russian');
});

// Bot Login
client.once('ready', () => {
    console.log('Bot is logged in and ready!');
});

client.login(DISCORD_TOKEN);

// Utilities (helpers)
const shuffleArray = (array) => {
    for (let i = array.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [array[i], array[j]] = [array[j], array[i]];
    }
};

const clearActiveQuiz = (activeQuizzes, userId) => {
    delete activeQuizzes[userId];
};