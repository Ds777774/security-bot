// duel.js
const { EmbedBuilder } = require('discord.js');
const { getLeaderboardData } = require('./leaderboard'); // Correct import

// Import quiz data
const { russianQuizData } = require('./russianData');
const { germanQuizData } = require('./germanData');
const { frenchQuizData } = require('./frenchData');

module.exports = {
  name: 'duel',
  description: 'A competitive quiz game between two teams based on quiz scores.',
  async execute(message, args) {
    const mentionedUsers = args.filter(arg => arg.startsWith('<@') && arg.endsWith('>')).map(arg => arg.replace(/[<@!>]/g, ''));

    if (mentionedUsers.length < 2) {
      return message.channel.send('You need at least 2 players to start a duel.');
    }

    // Get leaderboard data for the players
    const leaderboardData = await getLeaderboardData(mentionedUsers); // Fetch the data

    // Sort players by their quiz performance
    const sortedPlayers = leaderboardData.sort((a, b) => b.points - a.points);  // Using points for sorting
    let teamSize = [];
    
    // Even out the teams with 2 players (1 in each team)
    if (mentionedUsers.length === 2) {
      teamSize = [1, 1]; // 1 player per team
    } else {
      teamSize = mentionedUsers.length === 5 ? [2, 3] : [Math.floor(mentionedUsers.length / 2), Math.ceil(mentionedUsers.length / 2)];
    }

    const teamRed = sortedPlayers.slice(0, teamSize[0]);
    const teamBlue = sortedPlayers.slice(teamSize[0]);

    // Generate the embed showing the teams
    const teamEmbed = new EmbedBuilder()
      .setTitle('Team Formation')
      .setDescription(`**Team Red**: ${teamRed.map(player => player.username).join(', ')}\n**Team Blue**: ${teamBlue.map(player => player.username).join(', ')}`)
      .setColor('#ff0000')
      .setFooter({ text: 'Teams formed. Get ready to duel!' });
    const teamMessage = await message.channel.send({ embeds: [teamEmbed] });

    // Wait for 10 seconds before deleting the message
    setTimeout(() => teamMessage.delete(), 10000);

    // Randomly decide which team will start
    const startingTeam = Math.random() < 0.5 ? 'Blue' : 'Red';
    const startingEmbed = new EmbedBuilder()
      .setTitle(`${startingTeam} Team Starts First`)
      .setDescription(`${startingTeam} team will begin answering questions!`)
      .setColor('#acf508');

    await message.channel.send({ embeds: [startingEmbed] });

    // Ask the first question
    const askQuestions = async (team, teamName) => {
      for (let player of team) {
        const questions = await getQuestionsForPlayer(player);
        let score = 0;
        const startTime = Date.now();

        for (let question of questions) {
          const questionEmbed = new EmbedBuilder()
            .setTitle(`**${teamName} Quiz**`)
            .setDescription(question.prompt)
            .setColor('#0099ff');

          const quizMessage = await message.channel.send({ embeds: [questionEmbed] });
          const answerReaction = await quizMessage.awaitReactions({
            filter: (reaction, user) => user.id === player.userId && ['🇦', '🇧', '🇨', '🇩'].includes(reaction.emoji.name),
            max: 1,
            time: 12000,
          });

          if (answerReaction.size > 0 && answerReaction.first().emoji.name === question.correctAnswer) {
            score++;
          }

          await quizMessage.delete(); // Delete the message after answering
        }

        const timeTaken = (Date.now() - startTime) / 1000; // in seconds
        player.score = score;
        player.timeTaken = timeTaken;

        // Send score and time for this player
        const playerResultEmbed = new EmbedBuilder()
          .setTitle(`${player.username}'s Results`)
          .setDescription(`You scored **${score}/5** in **${timeTaken}s**.`)
          .setColor('#acf508');
        await message.channel.send({ embeds: [playerResultEmbed] });
      }
    };

    // Get questions based on leaderboard performance
    const getQuestionsForPlayer = async (player) => {
      // Assuming player.language and player.level exist
      const levelQuestions = await getQuestions(player.language, player.level); // This function should fetch questions from your quiz data
      return shuffleArray(levelQuestions).slice(0, 5); // Ask 5 questions
    };

    // Duel logic
    await askQuestions(teamRed, 'Red');
    await askQuestions(teamBlue, 'Blue');

    // Calculate results and determine winner
    const redTeamScore = teamRed.reduce((acc, player) => acc + player.score, 0);
    const blueTeamScore = teamBlue.reduce((acc, player) => acc + player.score, 0);

    let winnerTeam;
    let resultEmbed;

    if (redTeamScore > blueTeamScore) {
      winnerTeam = 'Red';
      resultEmbed = new EmbedBuilder()
        .setTitle('Red Team Wins!')
        .setDescription(`Red Team scored **${redTeamScore}** points!`)
        .setColor('#ff0000');
    } else if (blueTeamScore > redTeamScore) {
      winnerTeam = 'Blue';
      resultEmbed = new EmbedBuilder()
        .setTitle('Blue Team Wins!')
        .setDescription(`Blue Team scored **${blueTeamScore}** points!`)
        .setColor('#0000ff');
    } else {
      // Tie-breaker based on time
      const redTeamTime = teamRed.reduce((acc, player) => acc + player.timeTaken, 0);
      const blueTeamTime = teamBlue.reduce((acc, player) => acc + player.timeTaken, 0);

      if (redTeamTime < blueTeamTime) {
        winnerTeam = 'Red';
        resultEmbed = new EmbedBuilder()
          .setTitle('Red Team Wins by Time!')
          .setDescription(`Red Team took **${redTeamTime}s** while Blue Team took **${blueTeamTime}s**.`)
          .setColor('#ff0000');
      } else {
        winnerTeam = 'Blue';
        resultEmbed = new EmbedBuilder()
          .setTitle('Blue Team Wins by Time!')
          .setDescription(`Blue Team took **${blueTeamTime}s** while Red Team took **${redTeamTime}s**.`)
          .setColor('#0000ff');
      }
    }

    await message.channel.send({ embeds: [resultEmbed] });
  }
};