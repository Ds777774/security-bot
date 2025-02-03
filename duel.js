const { Client, EmbedBuilder } = require('discord.js');
const { shuffleArray } = require('./utilities');
const { russianQuizData } = require('./russianD');
const { germanQuizData } = require('./germanD');
const { frenchQuizData } = require('./frenchD');

const activeDuels = {}; // Track ongoing duels

module.exports = {
    name: 'duel',
    description: 'Starts a team quiz duel!',
    async execute(message) {
        if (activeDuels[message.channel.id]) {
            return message.channel.send('A duel is already in progress in this channel.');
        }

        // Step 1: Choose Language
        const languageEmbed = new EmbedBuilder()
            .setTitle('Choose a Language for the Quiz')
            .setDescription('React to select the language:\n\n🇩🇪: German\n🇫🇷: French\n🇷🇺: Russian')
            .setColor('#acf508');

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
            return message.channel.send('No language selected. Duel cancelled.');
        }

        const selectedLanguage = languages[languageEmojis.indexOf(languageReaction.first().emoji.name)];
        await languageMessage.delete();

        // Step 2: Form Teams
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

        await message.channel.send({ embeds: [teamFormationEmbed] }).then(msg => setTimeout(() => msg.delete(), 5000));

        activeDuels[message.channel.id] = { teamBlue, teamRed, scores: { Blue: 0, Red: 0 }, times: { Blue: 0, Red: 0 }, selectedLanguage };
        await startTeamQuiz(message, startingTeam, activeDuels[message.channel.id]);
    }
};

async function startTeamQuiz(message, team, duelData) {
    const teamPlayers = team === 'Blue' ? duelData.teamBlue : duelData.teamRed;
    let totalScore = 0, totalTime = 0;
    let selectedQuizData;

    if (duelData.selectedLanguage === 'german') selectedQuizData = germanQuizData;
    else if (duelData.selectedLanguage === 'french') selectedQuizData = frenchQuizData;
    else if (duelData.selectedLanguage === 'russian') selectedQuizData = russianQuizData;

    for (const player of teamPlayers) {
        const result = await askQuizQuestions(message, player, selectedQuizData);
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

async function askQuizQuestions(message, playerId, selectedQuizData) {
    const user = await message.client.users.fetch(playerId);
    
    if (!selectedQuizData || selectedQuizData.length === 0) {
        return message.channel.send(`<@${playerId}>, there was an error loading the quiz questions.`);
    }

    const questions = shuffleArray(selectedQuizData).slice(0, 5);
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