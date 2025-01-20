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

                activeQuizzes[message.author.id].detailedResults.push({
                    word: question.word,
                    userAnswer: quizReaction ? question.options[['🇦', '🇧', '🇨', '🇩'].indexOf(quizReaction.emoji.name)].split(': ')[1] : 'No Answer',
                    correct: question.meaning,
                    isCorrect: quizReaction && quizReaction.emoji.name === question.correct,
                });

                await quizMessage.delete();
            }

            const result = activeQuizzes[message.author.id];

// Clearing the active quiz after the result is displayed
clearActiveQuiz(activeQuizzes, message.author.id);

const resultEmbed = new EmbedBuilder()
    .setTitle('Quiz Results')
    .setDescription(`You scored ${result.score} out of 5 in level ${result.level} (${result.language.toUpperCase()})!`)
    .setColor(embedColors[selectedLanguage]) // Make sure 'selectedLanguage' is available in this context
    .addFields(
        { name: 'Level', value: result.level, inline: false },
        { name: 'Language', value: result.language.charAt(0).toUpperCase() + result.language.slice(1), inline: false }, // Added language
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
});

// Word of the Day Schedules
cron.schedule('53 11 * * *', async () => {
    const channel = await client.channels.fetch(wordOfTheDayChannels.german);
    const randomWord = germanWordList[Math.floor(Math.random() * germanWordList.length)];
    const embed = new EmbedBuilder()
        .setTitle('**Word of the Day (GERMAN)**')
        .setDescription(`**Word:** ${randomWord.word}`)
        .addFields(
            { name: '**Meaning**', value: randomWord.meaning },
            { name: '**Plural**', value: randomWord.plural },
            { name: '**Indefinite Article**', value: randomWord.indefinite },
            { name: '**Definite Article**', value: randomWord.definite }
        )
        .setColor(embedColors.german);

    await channel.send({ embeds: [embed] });
}, {
    scheduled: true,
    timezone: 'Asia/Kolkata',
});

// Repeat for French and Russian (adjust times)
cron.schedule('53 11 * * *', async () => {
    const channel = await client.channels.fetch(wordOfTheDayChannels.french);
    const randomWord = frenchWordList[Math.floor(Math.random() * frenchWordList.length)];
    const embed = new EmbedBuilder()
        .setTitle('**Word of the Day (FRENCH)**')
        .setDescription(`**Word:** ${randomWord.word}`)
        .addFields(
            { name: '**Meaning**', value: randomWord.meaning },
            { name: '**Plural**', value: randomWord.plural },
            { name: '**Indefinite Article**', value: randomWord.indefinite },
            { name: '**Definite Article**', value: randomWord.definite }
        )
        .setColor(embedColors.french);

    await channel.send({ embeds: [embed] });
}, {
    scheduled: true,
    timezone: 'Asia/Kolkata',
});

// Russian
cron.schedule('53 11 * * *', async () => {
    const channel = await client.channels.fetch(wordOfTheDayChannels.russian);
    const randomWord = russianWordList[Math.floor(Math.random() * russianWordList.length)];
    const embed = new EmbedBuilder()
        .setTitle('**Word of the Day (RUSSIAN)**')
        .setDescription(`**Word:** ${randomWord.word}`)
        .addFields(
            { name: '**Meaning**', value: randomWord.meaning },
            { name: '**Plural**', value: randomWord.plural },
            { name: '**Indefinite Article**', value: randomWord.indefinite },
            { name: '**Definite Article**', value: randomWord.definite }
        )
        .setColor(embedColors.russian);

    await channel.send({ embeds: [embed] });
}, {
    scheduled: true,
    timezone: 'Asia/Kolkata',
});

client.once('ready', () => {
    console.log(`${client.user.tag} is online!`);
});

client.login(DISCORD_TOKEN);
