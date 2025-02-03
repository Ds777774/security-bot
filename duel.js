const { EmbedBuilder } = require('discord.js');
const { russianQuizData } = require('./russianD');
const { germanQuizData } = require('./germanD');
const { frenchQuizData } = require('./frenchD');

const activeDuels = {}; // Track ongoing duels

// Shuffle function to randomize an array
function shuffleArray(array) {
    for (let i = array.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [array[i], array[j]] = [array[j], array[i]]; // Swap elements
    }
}

module.exports = {
    name: 'duel',
    description: 'Starts a team quiz duel!',
    async execute(message) {
        if (activeDuels[message.channel.id]) {
            return message.channel.send('A duel is already in progress in this channel.');
        }

        // Ask user to select a language
        const languageEmbed = new EmbedBuilder()
            .setTitle('Select a Language')
            .setDescription('React with the corresponding emoji:\n🇩 - German\n🇷 - Russian\n🇫 - French')
            .setColor('#acf508');

        const languageMessage = await message.channel.send({ embeds: [languageEmbed] });
        await languageMessage.react('🇩'); // German
        await languageMessage.react('🇷'); // Russian
        await languageMessage.react('🇫'); // French

        const filter = (reaction, user) => ['🇩', '🇷', '🇫'].includes(reaction.emoji.name) && user.id === message.author.id;
        const collected = await languageMessage.awaitReactions({ filter, max: 1, time: 30000 });

        if (!collected.size) {
            return message.channel.send('No language selected. Duel cancelled.');
        }

        let selectedQuizData;
        const reaction = collected.first().emoji.name;
        if (reaction === '🇩') selectedQuizData = germanQuizData;
        else if (reaction === '🇷') selectedQuizData = russianQuizData;
        else if (reaction === '🇫') selectedQuizData = frenchQuizData;

        await languageMessage.delete();

        // Collect players for the duel
        const players = [];
        const mentionFilter = (m) => m.mentions.users.size > 0 && m.author.id === message.author.id;
        const teamEmbed = new EmbedBuilder()
            .setTitle('Team Quiz Duel')
            .setDescription('Mention users to form teams (max 10 players).')
            .setColor('#acf508');

        const startMessage = await message.channel.send({ embeds: [teamEmbed] });
        const collectedPlayers = await message.channel.awaitMessages({ filter: mentionFilter, max: 1, time: 30000 });

        if (!collectedPlayers.size) return message.channel.send('No users mentioned. Duel cancelled.');
        collectedPlayers.first().mentions.users.forEach((user) => players.push(user.id));

        if (players.length < 2) return message.channel.send('At least 2 players required.');
        if (players.length > 10) return message.channel.send('Max 10 players allowed.');

        shuffleArray(players);
        const mid = Math.ceil(players.length / 2);
        const teamBlue = players.slice(0, mid);
        const teamRed = players.slice(mid);

        const startingTeam = Math.random() < 0.5 ? 'Blue' : 'Red';
        const teamFormationEmbed = new EmbedBuilder()
            .setTitle('Teams Formed!')
            .setDescription(`**Team Blue:** ${teamBlue.map(id => `<@${id}>`).join(', ')}\n**Team Red:** ${teamRed.map(id => `<@${id}>`).join(', ')}\n\n**${startingTeam} Team Starts!**`)
            .setColor('#3498db');

        // Send team formation and delete after 5 seconds
        const teamFormationMessage = await message.channel.send({ embeds: [teamFormationEmbed] });
        setTimeout(() => teamFormationMessage.delete(), 5000);

        // Initialize active duel data
        activeDuels[message.channel.id] = { teamBlue, teamRed, scores: {}, times: {}, detailedResults: {}, selectedQuizData, firstTeam: startingTeam };

        // Start first team quiz after team formation embed is deleted
        setTimeout(() => {
            startTeamQuiz(message, startingTeam, activeDuels[message.channel.id]);
        }, 5000);
    }
};

async function startTeamQuiz(message, team, duelData) {
    const teamPlayers = team === 'Blue' ? duelData.teamBlue : duelData.teamRed;
    let totalScore = 0, totalTime = 0;

    for (const player of teamPlayers) {
        const result = await askQuizQuestions(message, player, duelData.selectedQuizData);
        totalScore += result.score;
        totalTime += result.time;
        duelData.detailedResults[team] = { score: totalScore, time: totalTime };
    }

    duelData.scores[team] = totalScore;
    duelData.times[team] = totalTime;

    const resultEmbed = new EmbedBuilder()
        .setTitle(`${team} Team Results`)
        .setDescription(`**Correct Answers:** ${totalScore}\n**Total Time Taken:** ${totalTime} seconds`)
        .setColor(team === 'Blue' ? '#3498db' : '#e74c3c');

    const resultMessage = await message.channel.send({ embeds: [resultEmbed] });
    setTimeout(() => resultMessage.delete(), 5000);

    // If first team finished, start second team quiz
    if (!duelData.scores[team === 'Blue' ? 'Red' : 'Blue']) {
        setTimeout(() => startTeamQuiz(message, team === 'Blue' ? 'Red' : 'Blue', duelData), 5000);
    } else {
        setTimeout(() => showFinalResult(message, duelData), 5000);
    }
}

async function showFinalResult(message, duelData) {
    const { scores, times } = duelData;
    let winner;

    if (scores.Blue > scores.Red) {
        winner = 'Blue';
    } else if (scores.Red > scores.Blue) {
        winner = 'Red';
    } else {
        // If scores are equal, decide by time taken
        if (times.Blue < times.Red) {
            winner = 'Blue';
        } else if (times.Red < times.Blue) {
            winner = 'Red';
        } else {
            winner = 'Draw'; // If both score and time are equal, it's a true tie
        }
    }

    const finalResultEmbed = new EmbedBuilder()
        .setTitle('Final Duel Results')
        .setDescription(winner === 'Draw' ? 'It\'s a tie!' : `🏆 **${winner} Team Wins!** 🏆 (Faster Team)`)
        .setColor(winner === 'Blue' ? '#3498db' : winner === 'Red' ? '#e74c3c' : '#ffff00')
        .addFields(
            { name: 'Blue Team Score', value: `${scores.Blue} (Time: ${times.Blue}s)`, inline: true },
            { name: 'Red Team Score', value: `${scores.Red} (Time: ${times.Red}s)`, inline: true }
        );

    await message.channel.send({ embeds: [finalResultEmbed] });

    // Reset duel after completion
    delete activeDuels[message.channel.id];
}
async function askQuizQuestions(message, playerId, selectedQuizData) {
    const user = await message.client.users.fetch(playerId);
    const questions = selectedQuizData.slice(0, 5);
    let score = 0, totalTime = 0;

    const emojis = ['🇦', '🇧', '🇨', '🇩'];

    for (const question of questions) {
        const options = [...question.options];
        shuffleArray(options);

        const correctAnswer = question.options[0];
        const correctIndex = options.indexOf(correctAnswer);

        const embed = new EmbedBuilder()
            .setTitle('Quiz Question')
            .setDescription(`**${question.word}**\n🇦 ${options[0]}\n🇧 ${options[1]}\n🇨 ${options[2]}\n🇩 ${options[3]}`)
            .setColor('#acf508');

        const quizMessage = await message.channel.send({ content: `<@${playerId}>`, embeds: [embed] });

        for (const emoji of emojis) {
            await quizMessage.react(emoji);
        }

        const startTime = Date.now();
        const collected = await quizMessage.awaitReactions({ max: 1, time: 12000 });

        const timeTaken = Math.floor((Date.now() - startTime) / 1000);
        if (collected.size && emojis.indexOf(collected.first().emoji.name) === correctIndex) score++;

        totalTime += timeTaken;
        await quizMessage.delete();
    }

    return { score, time: totalTime };
}