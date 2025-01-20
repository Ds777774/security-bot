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
  // Help Command
  if (message.content.toLowerCase() === '!help') {
    const helpEmbed = new EmbedBuilder()
      .setTitle('Quiz Rules')
      .setDescription(
        'Here are the rules for the German Vocabulary Quiz:\n\n' +
        '1. Use **!quiz** to begin the quiz.\n' +
        '2. Select your level by reacting to the options:\n   🇦: A1, 🇧: A2, 🇨: B1, 🇩: B2, 🇪: C1, 🇫: C2.\n' +
        '3. The bot will ask **5 questions** from the selected level.\n' +
        '4. Each question has **4 options (A, B, C, D)**.\n' +
        '5. You have **1 minute** to answer each question.\n' +
        '6. Your final result will include your score, correct answers, and your level.'
      )
      .setColor('#f4ed09')
      .setFooter({ text: 'Type !quiz to begin the quiz. Good luck!' });

    await message.channel.send({ embeds: [helpEmbed] });
    return; // Stop further execution for this command
  }

  // Resources Command
  if (message.content.toLowerCase() === '!resources') {
    const resourcesPromptEmbed = new EmbedBuilder()
      .setTitle('Choose a Language for Resources')
      .setDescription(
        'Please select the language for which you want resources:\n\n' +
        '🇩🇪 German\n' +
        '🇫🇷 French\n' +
        '🇷🇺 Russian'
      )
      .setColor('#3498db')
      .setFooter({ text: 'React with the corresponding flag to choose a language.' });

    const msg = await message.channel.send({ embeds: [resourcesPromptEmbed] });

    // React with the available language flags
    await msg.react('🇩🇪'); // German flag
    await msg.react('🇫🇷'); // French flag
    await msg.react('🇷🇺'); // Russian flag

    // Create a reaction collector for the user to choose the language
    const filter = (reaction, user) => ['🇩🇪', '🇫🇷', '🇷🇺'].includes(reaction.emoji.name) && !user.bot;
    const collector = msg.createReactionCollector({ filter, time: 60000 }); // Collector for 60 seconds

    collector.on('collect', async (reaction, user) => {
      // Remove the user's reaction
      await reaction.users.remove(user);

      // Delete the original prompt message
      await msg.delete();

      // Send the resources based on the selected language
      let resourcesEmbed;

      if (reaction.emoji.name === '🇩🇪') {
        resourcesEmbed = new EmbedBuilder()
          .setTitle('German Learning Resources')
          .setDescription(
            '**YouTube Channel:**\n' +
            '[Learn German Original](https://youtube.com/@learngermanoriginal?si=6tqhbeRjhkGSCW6z)\n\n' +
            '**Book Recommendations:**\n' +
            'Made German Simple by Arnold\n\n' +
            '**Vocabulary PDF:**\n' +
            '[Download PDF](https://drive.google.com/file/d/1I73hvUDb3uvVNP98oAEbOvVYGLv1NlKO/view?usp=drivesdk)'
          )
          .setColor('#f4ed09');
      } else if (reaction.emoji.name === '🇫🇷') {
        resourcesEmbed = new EmbedBuilder()
          .setTitle('French Learning Resources')
          .setDescription(
            '**YouTube Channel:**\n' +
            '[LingoNi French](https://youtube.com/@lingonifrench?si=FcmmO68Onp0qGaat)\n\n' +
            '**Vocabulary PDF:**\n' +
            '[Download PDF](https://drive.google.com/file/d/1I4p26ddR2Wy_XsB2dtX_5uwvsjYq69So/view?usp=drivesdk)'
          )
          .setColor('#3498db');
      } else if (reaction.emoji.name === '🇷🇺') {
        resourcesEmbed = new EmbedBuilder()
          .setTitle('Russian Learning Resources')
          .setDescription(
            '**YouTube Channel:**\n' +
            '[Real Russian Club](https://youtube.com/@realrussianclub?si=vjrr0SdOL-In-0lN)\n\n' +
            '**Vocabulary PDF:**\n' +
            '[Download PDF](https://drive.google.com/file/d/1I9i72NHcSHIrBEHdxMH3vGkwZVnVcGZ5/view?usp=drivesdk)'
          )
          .setColor('#e74c3c');
      }

      // Send the resources
      await message.channel.send({ embeds: [resourcesEmbed] });

      // Stop the collector
      collector.stop();
    });

    collector.on('end', (collected, reason) => {
      if (reason === 'time') {
        msg.delete();
        message.channel.send('Time is up! Please try again with the !resources command.');
      }
    });
  }

    if (message.content.toLowerCase() === '!dead') {
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
                userAnswer: quizReaction ? question.options[['🇦', '🇧', '🇨', '🇩'].indexOf(quizReaction.emoji.name)] : 'No Answer',
                correct: question.meaning,
                isCorrect: quizReaction && quizReaction.emoji.name === question.correct,
            });

            await quizMessage.delete();
        }

        const result = activeQuizzes[message.author.id];

        // Clearing the active quiz after the result is displayed
        delete activeQuizzes[message.author.id];  // Updated to remove the quiz entry

        const resultEmbed = new EmbedBuilder()
            .setTitle('Quiz Results')
            .setDescription(`You scored ${result.score} out of 5 in level ${result.level}!`)
            .setColor(embedColors[result.language]) 
            .addFields(
                { name: 'Level', value: result.level, inline: false },
                { name: 'Language', value: result.language.charAt(0).toUpperCase() + result.language.slice(1), inline: false },
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

// Word of the Day Schedules
cron.schedule('16 15 * * *', async () => {
    const channel = await client.channels.fetch(wordOfTheDayChannels.german);
    const randomWord = germanWordList[Math.floor(Math.random() * germanWordList.length)];
    const embed = new EmbedBuilder()
        .setTitle('**Word of the Day**')
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
cron.schedule('16 15 * * *', async () => {
    const channel = await client.channels.fetch(wordOfTheDayChannels.french);
    const randomWord = frenchWordList[Math.floor(Math.random() * frenchWordList.length)];
    const embed = new EmbedBuilder()
        .setTitle('**Word of the Day**')
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
cron.schedule('16 15 * * *', async () => {
    const channel = await client.channels.fetch(wordOfTheDayChannels.russian);
    const randomWord = russianWordList[Math.floor(Math.random() * russianWordList.length)];
    const embed = new EmbedBuilder()
        .setTitle('**Word of the Day**')
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
