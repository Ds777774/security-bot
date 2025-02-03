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
        activeDuels[message.channel.id] = { teamBlue, teamRed, scores: { Blue: 0, Red: 0 }, times: { Blue: 0, Red: 0 }, detailedResults: { Blue: [], Red: [] }, selectedQuizData };

        // Start the first team quiz
        await startTeamQuiz(message, startingTeam, activeDuels[message.channel.id]);
    }
};

async function startTeamQuiz(message, team, duelData) {
    const teamPlayers = team === 'Blue' ? duelData.teamBlue : duelData.teamRed;
    let totalScore = 0, totalTime = 0;

    // Track the time taken by the team for each player
    for (const player of teamPlayers) {
        const result = await askQuizQuestions(message, player, duelData.selectedQuizData);
        totalScore += result.score;
        totalTime += result.time;
        duelData.detailedResults[team].push({ playerId: player, score: result.score, time: result.time });
    }

    duelData.scores[team] = totalScore;
    duelData.times[team] = totalTime;

    // Send the results for the team that just completed the quiz
    const resultEmbed = new EmbedBuilder()
        .setTitle(`${team} Team Results`)
        .setDescription(`**Correct Answers:** ${totalScore}\n**Total Time Taken:** ${totalTime} seconds`)
        .setColor(team === 'Blue' ? '#3498db' : '#e74c3c');

    duelData.detailedResults[team].forEach(playerResult => {
        resultEmbed.addFields({
            name: `<@${playerResult.playerId}>`,
            value: `Score: ${playerResult.score}, Time: ${playerResult.time}s`,
            inline: true
        });
    });

    const resultMessage = await message.channel.send({ embeds: [resultEmbed] });

    // Set target score for the other team
    const otherTeam = team === 'Blue' ? 'Red' : 'Blue';
    resultEmbed.addFields({ name: `${otherTeam} Team needs ${totalScore + 1} to win!`, value: '\u200B' });

    await resultMessage.edit({ embeds: [resultEmbed] });
    setTimeout(() => resultMessage.delete(), 5000); // Delete first team's result after 5 seconds

    // Start second team's quiz after the first team results are deleted
    setTimeout(() => {
        const nextTeam = otherTeam === 'Red' ? 'Red' : 'Blue';
        startTeamQuiz(message, nextTeam, duelData);
    }, 5000); // Start second team after 5 seconds delay
}

async function askQuizQuestions(message, playerId, selectedQuizData) {
    const user = await message.client.users.fetch(playerId);

    if (!selectedQuizData || selectedQuizData.length === 0) {
        return message.channel.send(`<@${playerId}>, there was an error loading the quiz questions.`);
    }

    const questions = selectedQuizData.slice(0, 5); // Get the first 5 questions
    let score = 0, totalTime = 0;

    for (const question of questions) {
        const options = [...question.options];
        const correctOption = options[0]; // The correct option is always the first option
        shuffleArray(options); // Shuffle options each time

        const correctIndex = options.indexOf(correctOption); // Get the new index of the correct option
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

        totalTime += 12; // Add 12 seconds for each question
        await quizMessage.delete(); // Delete the message after answering
    }

    return { score, time: totalTime }; // Return score and total time taken
}