const { Client, GatewayIntentBits, Partials, EmbedBuilder } = require('discord.js');
const express = require('express');
const cron = require('node-cron');
const { russianQuizData, russianWordList } = require('./russianData');
const { shuffleArray } = require('./utilities');

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
    default: '#87CEEB',
};

// Word of the Day Channel (Replace with actual channel ID)
const wordOfTheDayChannel = 'YOUR_CHANNEL_ID_HERE';

// Active Quiz Tracking
const activeQuizzes = {};

// Bot Commands
client.on('messageCreate', async (message) => {
    if (message.author.bot) return;

    // Help Command
    if (message.content.toLowerCase() === '!help') {
        const helpEmbed = new EmbedBuilder()
            .setTitle('Quiz Rules')
            .setDescription(
                'Here are the rules for the Russian Vocabulary Quiz:\n\n' +
                '1. Use **!quiz** to start the quiz.\n' +
                '2. Choose your level by reacting to the options:\n   🇦: A1, 🇧: A2, 🇨: B1, 🇩: B2, 🇪: C1, 🇫: C2.\n' +
                '3. The bot will ask **5 questions** from the selected level.\n' +
                '4. Each question has **4 options (A, B, C, D)**.\n' +
                '5. You have **1 minute** to answer each question.\n' +
                '6. Your final result will include your score, correct answers, and detailed feedback.'
            )
            .setColor(embedColors.russian)
            .setFooter({ text: 'Type !quiz to begin the quiz. Good luck!' });

        await message.channel.send({ embeds: [helpEmbed] });
        return;
    }

    // Quiz Command
    if (message.content.toLowerCase() === '!quiz') {
        if (activeQuizzes[message.author.id]) {
            return message.reply('You are already taking a quiz. Please finish it first.');
        }

        const levelEmbed = new EmbedBuilder()
            .setTitle('Choose Your Level')
            .setDescription('React to select your level:\n\n🇦: A1\n🇧: A2\n🇨: B1\n🇩: B2\n🇪: C1\n🇫: C2')
            .setColor(embedColors.russian);

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

            const questions = russianQuizData[selectedLevel] || [];
            shuffleArray(questions);
            const questionsToAsk = questions.slice(0, 5);

            if (questionsToAsk.length === 0) {
                return message.channel.send('No questions available for this level.');
            }

            activeQuizzes[message.author.id] = { language: 'Russian', level: selectedLevel, score: 0, detailedResults: [] };

            for (const question of questionsToAsk) {
                const embed = new EmbedBuilder()
                    .setTitle(`**Russian Vocabulary Quiz**`)
                    .setDescription(`What is the English meaning of "${question.word}"?`)
                    .addFields(question.options.map((opt, i) => ({
                        name: `Option ${String.fromCharCode(65 + i)}`,
                        value: opt,
                        inline: true,
                    })))
                    .setColor(embedColors.russian)
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
                .setDescription(`You scored ${result.score} out of 5 in level ${result.level}!`)
                .setColor(embedColors.russian)
                .addFields(
                    { name: 'Level', value: result.level, inline: false },
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

// Word of the Day Scheduler
cron.schedule('30 12 * * *', async () => {
    const channel = await client.channels.fetch(wordOfTheDayChannel);
    const randomWord = russianWordList[Math.floor(Math.random() * russianWordList.length)];

    const embed = new EmbedBuilder()
        .setTitle('**Word of the Day**')
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

// Bot Ready Event
client.once('ready', () => {
    console.log(`${client.user.tag} is online!`);
});

// Login the Bot
client.login(DISCORD_TOKEN);