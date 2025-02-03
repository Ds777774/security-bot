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

// Function to determine top scorer in a team
function getTopScorer(team, message, duelData) {
    let topPlayer = null;
    let highestScore = -1;
    let bestTime = Infinity;

    for (const playerId of team) {
        const playerScore = duelData.detailedResults[playerId]?.score || 0;
        const playerTime = duelData.detailedResults[playerId]?.time || 0;

        if (playerScore > highestScore || (playerScore === highestScore && playerTime < bestTime)) {
            highestScore = playerScore;
            bestTime = playerTime;
            topPlayer = playerId;
        }
    }

    if (!topPlayer) return "No valid scorer";

    const user = message.guild.members.cache.get(topPlayer);
    return `${user ? user.displayName : "Unknown"} - ${highestScore} (${bestTime}s)`;
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

        const teamFormationMessage = await message.channel.send({ embeds: [teamFormationEmbed] });
        setTimeout(() => teamFormationMessage.delete(), 5000);

        activeDuels[message.channel.id] = { teamBlue, teamRed, scores: {}, times: {}, detailedResults: {}, selectedQuizData, firstTeam: startingTeam };

        setTimeout(() => startTeamQuiz(message, startingTeam, activeDuels[message.channel.id]), 5000);
    }
};

async function startTeamQuiz(message, team, duelData) {
    const teamPlayers = team === 'Blue' ? duelData.teamBlue : duelData.teamRed;
    let totalScore = 0, totalTime = 0;

    for (const player of teamPlayers) {
        const result = await askQuizQuestions(message, player, duelData.selectedQuizData, duelData);
        totalScore += result.score;
        totalTime += result.time;
    }

    duelData.scores[team] = totalScore;
    duelData.times[team] = totalTime;

    const otherTeam = team === 'Blue' ? 'Red' : 'Blue';

    const resultEmbed = new EmbedBuilder()
        .setTitle(`${team} Team Results`)
        .setDescription(`**Team ${team} - ${totalScore} points (${totalTime}s)**\n${teamPlayers.map(id => `<@${id}> - ${duelData.detailedResults[id].score} (${duelData.detailedResults[id].time}s)`).join('\n')}`)
        .setColor(team === 'Blue' ? '#3498db' : '#e74c3c');

    if (!duelData.scores[otherTeam]) {
        resultEmbed.addFields({ name: `${otherTeam} Team needs ${totalScore + 1} to win!`, value: '\u200B' });
    }

    const resultMessage = await message.channel.send({ embeds: [resultEmbed] });
    setTimeout(() => resultMessage.delete(), 5000);

    if (!duelData.scores[otherTeam]) {
        setTimeout(() => startTeamQuiz(message, otherTeam, duelData), 5000);
    } else {
        setTimeout(() => showFinalResult(message, duelData), 5000);
    }
}

async function showFinalResult(message, duelData) {
    const { scores, times } = duelData;
    let winner = scores.Blue > scores.Red ? 'Blue' : scores.Red > scores.Blue ? 'Red' : times.Blue < times.Red ? 'Blue' : 'Red';

    const finalResultEmbed = new EmbedBuilder()
        .setTitle('DUEL SUMMARY')
        .setDescription(`**Team Blue - ${scores.Blue} points (${times.Blue}s)**\nTop Scorer: ${getTopScorer(duelData.teamBlue, message, duelData)}\n\n**Team Red - ${scores.Red} points (${times.Red}s)**\nTop Scorer: ${getTopScorer(duelData.teamRed, message, duelData)}\n\n🏆 **${winner} Team Wins!** 🏆`)
        .setColor(winner === 'Blue' ? '#3498db' : '#e74c3c');

    await message.channel.send({ embeds: [finalResultEmbed] });
}