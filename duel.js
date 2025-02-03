const { Client, EmbedBuilder } = require('discord.js');
const { shuffleArray } = require('./utilities');
// Import quiz data
const { russianQuizData, russianWordList } = require('./russianData');
const { germanQuizData, germanWordList } = require('./germanData');
const { frenchQuizData, frenchWordList } = require('./frenchData');

const activeDuels = {}; // Track ongoing duels

module.exports = {
    name: 'duel',
    description: 'Starts a team quiz duel!',
    async execute(message) {
        if (activeDuels[message.channel.id]) {
            return message.channel.send('A duel is already in progress in this channel.');
        }

        const players = [];
        const filter = (m) => m.mentions.users.size > 0 && m.author.id === message.author.id;
        const embed = new EmbedBuilder()
            .setTitle('Team Quiz Duel')
            .setDescription('Mention users to form teams (max 10 players).')
            .setColor('#acf508');

        const startMessage = await message.channel.send({ embeds: [embed] });
        const collected = await message.channel.awaitMessages({ filter, max: 1, time: 30000 });
        if (!collected.size) return message.channel.send('No users mentioned. Duel cancelled.');

        collected.first().mentions.users.forEach((user) => players.push(user.id));

        if (players.length < 2) return message.channel.send('At least 2 players required.');
        if (players.length > 10) return message.channel.send('Max 10 players allowed.');

        shuffleArray(players);
        const mid = Math.ceil(players.length / 2);
        const teamBlue = players.slice(0, mid);
        const teamRed = players.slice(mid);

        const startingTeam = Math.random() < 0.5 ? 'Blue' : 'Red';
        const teamEmbed = new EmbedBuilder()
            .setTitle('Teams Formed!')
            .setDescription(`**Team Blue:** ${teamBlue.map(id => `<@${id}>`).join(', ')}\n**Team Red:** ${teamRed.map(id => `<@${id}>`).join(', ')}\n\n**${startingTeam} Team Starts!**`)
            .setColor('#3498db');

        await message.channel.send({ embeds: [teamEmbed] }).then(msg => setTimeout(() => msg.delete(), 10000));

        activeDuels[message.channel.id] = { teamBlue, teamRed, scores: { Blue: 0, Red: 0 }, times: { Blue: 0, Red: 0 } };
        await startTeamQuiz(message, startingTeam, activeDuels[message.channel.id]);
    }
};

async function startTeamQuiz(message, team, duelData) {
    const teamPlayers = team === 'Blue' ? duelData.teamBlue : duelData.teamRed;
    let totalScore = 0, totalTime = 0;

    for (const player of teamPlayers) {
        const result = await askQuizQuestions(message, player);
        totalScore += result.score;
        totalTime += result.time;
    }

    duelData.scores[team] = totalScore;
    duelData.times[team] = totalTime;

    const resultEmbed = new EmbedBuilder()
        .setTitle(`${team} Team Results`)
        .setDescription(`**Correct Answers:** ${totalScore}\n**Total Time Taken:** ${totalTime} seconds`)
        .setColor(team === 'Blue' ? '#3498db' : '#e74c3c');

    await message.channel.send({ embeds: [resultEmbed] });

    if (team === 'Blue') {
        await message.channel.send(`**Red Team needs to score ${totalScore + 1} to win!**`);
        await startTeamQuiz(message, 'Red', duelData);
    } else {
        const blueScore = duelData.scores['Blue'];
        const redScore = duelData.scores['Red'];
        const winner = redScore > blueScore ? 'Red' : blueScore > redScore ? 'Blue' : (duelData.times['Red'] < duelData.times['Blue'] ? 'Red' : 'Blue');
        await message.channel.send(`**${winner} Team Wins!**`);
        delete activeDuels[message.channel.id];
    }
}

async function askQuizQuestions(message, playerId) {
    const user = await message.client.users.fetch(playerId);

    // Select a random language quiz dataset
    const quizDatasets = [germanQuizData, frenchQuizData, russianQuizData];
    const selectedQuizData = quizDatasets[Math.floor(Math.random() * quizDatasets.length)];

    // Ensure selectedQuizData is an array and extract questions safely
    const questions = shuffleArray(Array.isArray(selectedQuizData) ? selectedQuizData : Object.values(selectedQuizData).flat()).slice(0, 5);

    let score = 0, startTime = Date.now();
    for (const question of questions) {
        const options = shuffleArray([...question.options]);
        const correctIndex = options.indexOf(question.correct);
        const embed = new EmbedBuilder()
            .setTitle('Quiz Question')
            .setDescription(`**${question.word}**\nA) ${options[0]}\nB) ${options[1]}\nC) ${options[2]}\nD) ${options[3]}`)
            .setColor('#acf508');

        const quizMessage = await message.channel.send({ content: `<@${playerId}>`, embeds: [embed] });
        const emojis = ['🇦', '🇧', '🇨', '🇩'];
        for (const emoji of emojis) await quizMessage.react(emoji);

        const filter = (reaction, userReact) => emojis.includes(reaction.emoji.name) && userReact.id === playerId;
        const collected = await quizMessage.awaitReactions({ filter, max: 1, time: 12000 });
        const userChoice = collected.first() ? emojis.indexOf(collected.first().emoji.name) : -1;

        if (userChoice === correctIndex) score++;
        await quizMessage.delete();
    }

    return { score, time: Math.round((Date.now() - startTime) / 1000) };
}