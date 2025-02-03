const { EmbedBuilder } = require('discord.js');
const germanQuizData = require('./germanD');
const frenchQuizData = require('./frenchD');
const russianQuizData = require('./russianD');

const activeDuels = {}; // Track active duels in each channel

module.exports = {
    name: 'duel',
    description: 'Start a language quiz duel!',
    async execute(message) {
        if (activeDuels[message.channel.id]) {
            return message.channel.send('A duel is already in progress in this channel.');
        }
        activeDuels[message.channel.id] = true;

        const embedColors = { german: '#ffcc00', french: '#0055a4', russian: '#d52b1e' };
        const languageEmojis = ['🇩🇪', '🇫🇷', '🇷🇺'];
        const languages = ['german', 'french', 'russian'];
        
        const languageEmbed = new EmbedBuilder()
            .setTitle('Choose a Language for the Quiz')
            .setDescription('React to select the language:\n\n🇩🇪: German\n🇫🇷: French\n🇷🇺: Russian')
            .setColor('#ffffff');

        const languageMessage = await message.channel.send({ embeds: [languageEmbed] });
        for (const emoji of languageEmojis) await languageMessage.react(emoji);

        const languageReaction = await languageMessage.awaitReactions({
            filter: (reaction, user) => languageEmojis.includes(reaction.emoji.name) && user.id === message.author.id,
            max: 1,
            time: 15000,
        });

        if (!languageReaction.size) {
            await languageMessage.delete();
            delete activeDuels[message.channel.id];
            return message.channel.send('No language selected. Duel cancelled.');
        }

        const selectedLanguage = languages[languageEmojis.indexOf(languageReaction.first().emoji.name)];
        await languageMessage.delete();

        let quizData;
        if (selectedLanguage === 'german') quizData = germanQuizData;
        else if (selectedLanguage === 'french') quizData = frenchQuizData;
        else if (selectedLanguage === 'russian') quizData = russianQuizData;

        const players = message.guild.members.cache.filter(member => !member.user.bot).map(member => member.user);
        if (players.length < 2) {
            delete activeDuels[message.channel.id];
            return message.channel.send('Not enough players to start a duel.');
        }

        shuffleArray(players);
        const teamRed = players.slice(0, Math.ceil(players.length / 2));
        const teamBlue = players.slice(Math.ceil(players.length / 2));

        const teamFormationEmbed = new EmbedBuilder()
            .setTitle('Team Formation')
            .setDescription(`🔴 **Red Team:** ${teamRed.map(p => p.username).join(', ')}\n\n🔵 **Blue Team:** ${teamBlue.map(p => p.username).join(', ')}`)
            .setColor('#ffffff');

        const formationMessage = await message.channel.send({ embeds: [teamFormationEmbed] });
        await new Promise(resolve => setTimeout(resolve, 5000));
        await formationMessage.delete();

        const duelData = {
            teams: { Red: teamRed, Blue: teamBlue },
            scores: { Red: 0, Blue: 0 },
            selectedLanguage
        };

        await startTeamQuiz(message, duelData, 'Red');
    }
};

async function startTeamQuiz(message, duelData, team) {
    const { selectedLanguage, teams, scores } = duelData;
    const questions = getQuizQuestions(selectedLanguage);
    let teamScore = 0;
    const startTime = Date.now();

    for (const player of teams[team]) {
        for (const question of questions) {
            shuffleArray(question.options);

            const embed = new EmbedBuilder()
                .setTitle(`**${selectedLanguage.toUpperCase()} Quiz - ${team} Team**`)
                .setDescription(`What is the English meaning of **"${question.word}"**?\n\n` +
                    `🇦 ${question.options[0]}\n🇧 ${question.options[1]}\n🇨 ${question.options[2]}\n🇩 ${question.options[3]}`)
                .setColor(team === 'Red' ? '#e74c3c' : '#3498db');

            const quizMessage = await message.channel.send({ embeds: [embed] });
            const emojis = ['🇦', '🇧', '🇨', '🇩'];
            for (const emoji of emojis) await quizMessage.react(emoji);

            const reaction = await quizMessage.awaitReactions({
                filter: (reaction, user) => emojis.includes(reaction.emoji.name) && user.id === player.id,
                max: 1,
                time: 12000,
            });

            await quizMessage.delete();

            if (reaction.size) {
                const userAnswer = question.options[emojis.indexOf(reaction.first().emoji.name)];
                if (userAnswer === question.options[0]) teamScore++;
            }
        }
    }

    const totalTimeTaken = Math.round((Date.now() - startTime) / 1000);
    scores[team] = teamScore;

    const resultEmbed = new EmbedBuilder()
        .setTitle(`Result: ${team} Team`)
        .setDescription(`Score: **${teamScore}**\nTime Taken: **${totalTimeTaken}s**\n`)
        .setColor(team === 'Red' ? '#e74c3c' : '#3498db');

    if (team === 'Red') {
        resultEmbed.addFields({ name: 'Blue Team Needs', value: `${teamScore + 1} to Win!` });
    }

    const resultMessage = await message.channel.send({ embeds: [resultEmbed] });
    await new Promise(resolve => setTimeout(resolve, 5000));
    await resultMessage.delete();

    if (team === 'Red') {
        await startTeamQuiz(message, duelData, 'Blue');
    } else {
        await showFinalResult(message, duelData);
    }
}

async function showFinalResult(message, duelData) {
    const { scores } = duelData;
    const winner = scores.Blue > scores.Red ? 'Blue' : scores.Red > scores.Blue ? 'Red' : 'Draw';

    const finalResultEmbed = new EmbedBuilder()
        .setTitle('Final Duel Results')
        .setDescription(winner === 'Draw' ? 'It\'s a tie!' : `🏆 **${winner} Team Wins!** 🏆`)
        .setColor(winner === 'Blue' ? '#3498db' : winner === 'Red' ? '#e74c3c' : '#ffff00');

    await message.channel.send({ embeds: [finalResultEmbed] });

    delete activeDuels[message.channel.id];
}

function getQuizQuestions(language) {
    if (language === 'german') return germanQuizData.A1.slice(0, 5);
    if (language === 'french') return frenchQuizData.A1.slice(0, 5);
    if (language === 'russian') return russianQuizData.A1.slice(0, 5);
    return [];
}

function shuffleArray(array) {
    for (let i = array.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [array[i], array[j]] = [array[j], array[i]];
    }
}