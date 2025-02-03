// Active Quiz Tracking
const activeQuizzes = {};
const { Client, GatewayIntentBits, Partials, EmbedBuilder } = require('discord.js');
const express = require('express');
const cron = require('node-cron');
// Import quiz data
const { russianQuizData, russianWordList } = require('./russianData');
const { germanQuizData, germanWordList } = require('./germanData');
const { frenchQuizData, frenchWordList } = require('./frenchData');

// Ensure shuffleArray is imported correctly
const { shuffleArray } = require('./utilities');
const help = require('./commands/help');
const resources = require('./commands/resources');
const { handleGreeting } = require('./greetingsHandler');
const { handleMemberJoin, handleMemberLeave } = require('./welcomeHandler');
const announcement = require('./commands/announcement');
const { handleBadWords } = require('./badWords');
const suggestion = require('./commands/suggestion');
const ticket = require('./commands/ticket');
const leaderboard = require('./leaderboard.js');
const linkFilter = require('./linkFilter');
const { handleSpamDetection } = require('./spamHandler');
const modRank = require('./modrank'); // Adjust the path if necessary
const updates = require('./commands/updates');
const { handleBanCommand } = require('./banHandler');
const { updateBotStatus } = require('./statusUpdater');

const duel = require('./duel');

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
GatewayIntentBits.GuildMembers,
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
    default: '#acf508',
};

// Word of the Day Data for each language
const wordOfTheDayChannelIds = {
  russian: '1303664003444379649', // Replace with actual Russian channel ID
  german: '1225363050207514675',   // Replace with actual German channel ID
  french: '1225362787581296640',   // Replace with actual French channel ID
};

// Word of the Day Function
const sendWordOfTheDay = async (language) => {
  let wordList;
  if (language === 'russian') wordList = russianWordList;
  else if (language === 'german') wordList = germanWordList;
  else if (language === 'french') wordList = frenchWordList;

  const randomWord = wordList[Math.floor(Math.random() * wordList.length)];
  const channelId = wordOfTheDayChannelIds[language];

  try {
    const channel = await client.channels.fetch(channelId);
    if (!channel) {
      console.error(`Channel for ${language} not found!`);
      return;
    }

    
const embed = new EmbedBuilder()
      .setTitle('**Word of the Day**')
      .setDescription(`Today's Word of the Day is...\n\n**${randomWord.word}**`)
      .addFields(
        { name: '**Meaning**', value: randomWord.meaning, inline: false },
        { name: '**Plural**', value: randomWord.plural, inline: false },
        { name: '**Indefinite Article**', value: randomWord.indefinite, inline: false },
        { name: '**Definite Article**', value: randomWord.definite, inline: false }
      )
      .setColor(embedColors[language]); // Set the color based on language 

    await channel.send({ embeds: [embed] }); 

  } catch (error) {
    console.error(`Error sending Word of the Day for ${language}:`, error);
  }
};

// Word of the Day Schedule for each language
const wordOfTheDayTimes = {
  russian: '30 03 * * *',  // 03:30 AM IST for Russian
  german: '30 04 * * *',   // 04:30 AM IST for German
  french: '30 04 * * *',   // 04:30 AM IST for French
};

Object.keys(wordOfTheDayTimes).forEach((language) => {
  cron.schedule(wordOfTheDayTimes[language], async () => {
    try {

      await sendWordOfTheDay(language);
    } catch (error) {
      console.error(`Failed to send Word of the Day for ${language}:`, error);
    }
  }, {
    scheduled: true,
    timezone: 'Asia/Kolkata', // Set timezone to Kolkata, India
  });
});

// Check if the message is badwords in any language
client.on('messageCreate', async (message) => {
    if (message.author.bot) return;





if (message.content.toLowerCase() === '!duel') {
    duel.execute(message);
}






    await handleBanCommand(message);

// Track bumping points for the bump bot
    await modRank.trackBumpingPoints(message); 

    // Handle !modrank command
    if (message.content.toLowerCase() === '!modrank') {
        await modRank.execute(message); // Display the leaderboard
    } 

    // Optional: Update mod rank when a moderator sends a message
    const moderatorRole = message.guild.roles.cache.find(role => role.name.toLowerCase() === 'moderator');
    if (moderatorRole && message.member.roles.cache.has(moderatorRole.id)) {
        await modRank.updateModRank(message.author.id, message.author.username, message.guild); // Update points for moderators
    }
        await handleSpamDetection(message);
await handleBanCommand(message);
if (message.content.toLowerCase() === '!leaderboard') {
   leaderboard.execute(message);
}

if (message.content.toLowerCase() === '!ticket') {
  ticket.execute(message);
}

if(message.content.toLowerCase().startsWith('!suggestion')) {
    suggestion.execute(message);
}
    // Handle bad words
    handleBadWords(message);
});

// Commands and Event Handling
client.on('messageCreate', async (message) => {
    if (message.author.bot) return;

// Commands for Announcement
    if (message.content.toLowerCase() === '!announcement') {
    announcement.execute(message);
}
    if (message.content.toLowerCase() === '!updates') {
        updates.execute(message); // Execute the updates command
}
    // Check if the message is a greeting in any language
    const response = handleGreeting(message);

    if (response) {
        // Reply with "How are you?" in the detected language
        await message.reply(response);
        return; // Exit after replying to avoid processing other commands
    }

    if (message.content.toLowerCase() === '!quiz') {
        // Check if the user is already participating in a quiz
        if (activeQuizzes[message.author.id]) {
            return message.channel.send('You are already participating in a quiz! Please finish it before starting a new one.');
        }

        try {
            // Step 1: Select Language
            const languageEmbed = new EmbedBuilder()
                .setTitle('Choose a Language for the Quiz')
                .setDescription('React to select the language:\n\n🇩🇪: German\n🇫🇷: French\n🇷🇺: Russian')
                .setColor(embedColors.default);

            const languageMessage = await message.channel.send({ embeds: [languageEmbed] });
            const languageEmojis = ['🇩🇪', '🇫🇷', '🇷🇺'];
            const languages = ['german', 'french', 'russian'];

            for (const emoji of languageEmojis) {
                await languageMessage.react(emoji);
            }

            const languageReaction = await languageMessage.awaitReactions({
                filter: (reaction, user) => languageEmojis.includes(reaction.emoji.name) && user.id === message.author.id,
                max: 1,
                time: 15000,
            });

            if (!languageReaction.size) {
                try {
                    await languageMessage.delete();  // Ensure the message is deleted after timeout
                } catch (err) {
                    console.error('Error deleting message:', err);  // Catch potential errors
                }
                return message.channel.send('No language selected. Quiz cancelled.');
            }

            const selectedLanguage = languages[languageEmojis.indexOf(languageReaction.first().emoji.name)];
            await languageMessage.delete();

            // Step 2: Select Level
            const levelEmbed = new EmbedBuilder()
                .setTitle(`Choose Your Level for the ${selectedLanguage.charAt(0).toUpperCase() + selectedLanguage.slice(1)} Quiz`)
                .setDescription('React to select your level:\n\n🇦: A1\n🇧: A2\n🇨: B1\n🇩: B2\n🇪: C1\n🇫: C2')
                .setColor(embedColors[selectedLanguage]);

            const levelMessage = await message.channel.send({ embeds: [levelEmbed] });
            const levelEmojis = ['🇦', '🇧', '🇨', '🇩', '🇪', '🇫'];
            const levels = ['A1', 'A2', 'B1', 'B2', 'C1', 'C2'];

            await Promise.all(levelEmojis.map((emoji) => levelMessage.react(emoji)));

            const levelReaction = await levelMessage.awaitReactions({
                filter: (reaction, user) => levelEmojis.includes(reaction.emoji.name) && user.id === message.author.id,
                max: 1,
                time: 15000,
            }).catch(() => null);

            if (!levelReaction || !levelReaction.size) {
                await levelMessage.delete();
                return message.channel.send('No level selected or time expired. Quiz cancelled.');
            }

            const selectedLevel = levels[levelEmojis.indexOf(levelReaction.first().emoji.name)];
            await levelMessage.delete();

            // Step 3: Start Quiz
            let quizData;
            if (selectedLanguage === 'german') {
                quizData = germanQuizData;
            } else if (selectedLanguage === 'french') {
                quizData = frenchQuizData;
            } else if (selectedLanguage === 'russian') {
                quizData = russianQuizData;
            } else {
                return message.channel.send('Invalid language selected. Quiz cancelled.');
            }

            // Ensure quiz data exists for the selected level
            if (!quizData || !quizData[selectedLevel]) {
                console.log(`No quiz data found for level: ${selectedLevel} in ${selectedLanguage}`);
                return message.channel.send(`No quiz data available for level ${selectedLevel} in ${selectedLanguage}.`);
            }

            // Extract questions and shuffle
            const questions = quizData[selectedLevel];
            shuffleArray(questions);

            // Select up to 5 questions to ask
const questionsToAsk = questions.slice(0, 5);
if (questionsToAsk.length === 0) {
    return message.channel.send('No questions available for this level. Quiz cancelled.');
}

activeQuizzes[message.author.id] = { language: selectedLanguage, level: selectedLevel, score: 0, detailedResults: [] };

for (const question of questionsToAsk) {
    // Shuffle options for the current question
    const correctOption = question.correct; // Store the correct option
    question.options = question.options.sort(() => Math.random() - 0.5); // Shuffle options randomly
    question.correct = correctOption; // Ensure the correct option is still marked as correct after shuffle

    const embed = new EmbedBuilder()
        .setTitle(`**${selectedLanguage.charAt(0).toUpperCase() + selectedLanguage.slice(1)} Vocabulary Quiz**`)
        .setDescription(
            `What is the English meaning of **"${question.word}"**?\n\n` +
            `A) ${question.options[0]}\n` +



            `B) ${question.options[1]}\n` +



            `C) ${question.options[2]}\n` +



            `D) ${question.options[3]}`
        )
        .setColor(embedColors[selectedLanguage])
        .setFooter({ text: 'React with the emoji corresponding to your answer.' });

    const quizMessage = await message.channel.send({ embeds: [embed] });
    const emojis = ['🇦', '🇧', '🇨', '🇩'];

    for (const emoji of emojis) {
        await quizMessage.react(emoji);
    }

    const quizReaction = await quizMessage.awaitReactions({
        filter: (reaction, user) => emojis.includes(reaction.emoji.name) && user.id === message.author.id,
        max: 1,
        time: 60000,
    });

    const userReaction = quizReaction.first();

    // Determine the correct emoji for the answer
    const correctEmoji = emojis[question.options.indexOf(correctOption)]; // Find the emoji for the correct answer
    const userAnswer = userReaction ? question.options[emojis.indexOf(userReaction.emoji.name)] : 'No Answer';
    const isCorrect = userReaction && userReaction.emoji.name === correctEmoji;

    // Update score and results
    if (isCorrect) {
        activeQuizzes[message.author.id].score++;
    }

    activeQuizzes[message.author.id].detailedResults.push({
        word: question.word,
        userAnswer: userAnswer,
        correct: correctOption,
        isCorrect: isCorrect,
    });

    await quizMessage.delete();
}

            // Step 4: Display Results
const result = activeQuizzes[message.author.id];

// Create the detailed results text
const detailedResultsText = result.detailedResults
    .map(
        (res) =>
            `**Word:** ${res.word}\nYour Answer: ${res.userAnswer}\nCorrect: ${res.correct}\nResult: ${
                res.isCorrect ? '✅' : '❌'
            }`
    )
    .join('\n\n');

// Final score logic (if the user scored exactly 5 points, add 1 extra point for leaderboard)
const finalScore = result.score === 5 ? result.score + 1 : result.score; // Add bonus point for perfect score

// Build the final result message
const resultEmbed = new EmbedBuilder()
    .setTitle('Quiz Results')
    .setDescription(
        `You scored ${result.score} out of ${result.detailedResults.length}!\n\n` + // Display the original score
        `**Level:** ${result.level}\n` +
        `**Language:** ${result.language.charAt(0).toUpperCase() + result.language.slice(1)}\n\n` +
        `**Detailed Results:**\n${detailedResultsText}`
    )
    .setColor(embedColors[result.language]);

// Send the result message
await message.channel.send({ embeds: [resultEmbed] });

// Update the leaderboard with quiz results
const username = message.author.username; // Get the user's username
const points = finalScore; // Use the final score (including extra point if perfect)

leaderboard.updateLeaderboard(username, selectedLanguage, selectedLevel, points);
delete activeQuizzes[message.author.id];
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
    linkFilter(client);
    // Start the status update cycle
    setInterval(() => updateBotStatus(client), 10000); // Update every 10 seconds
});

// Event when a member joins the server
client.on('guildMemberAdd', (member) => {
    handleMemberJoin(member); // Call the handle join function
}); 

// Event when a member leaves the server
client.on('guildMemberRemove', (member) => {
    handleMemberLeave(member); // Call the handle leave function
});

client.login(DISCORD_TOKEN);