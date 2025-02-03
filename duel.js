const { Client, MessageEmbed } = require('discord.js');
const { getTeams, askQuestions, calculateTarget } = require('./logic');
const pg = require('pg');
const client = new Client();
const db = new pg.Client('postgresql://neondb_owner:npg_4hwZrTGUJR2a@ep-orange-king-a839r2uc-pooler.eastus2.azure.neon.tech/neondb?sslmode=require');

// Connect to the database
db.connect();

client.on('message', async (message) => {
  if (message.content.startsWith('!duel')) {
    const players = message.mentions.users.map(user => user.id);

    if (players.length < 4 || players.length > 9) {
      return message.reply("Please ping between 4 to 9 players.");
    }

    // Get team distribution based on leaderboard data
    const { teamRed, teamBlue } = await getTeams(players, db);

    // Display teams
    const teamEmbed = new MessageEmbed()
      .setTitle('Teams')
      .addField('Team Red', teamRed.join('\n'))
      .addField('Team Blue', teamBlue.join('\n'))
      .setColor('#00FF00');
    
    const teamMessage = await message.channel.send({ embeds: [teamEmbed] });

    // Wait for 10 seconds, then delete the teams message
    setTimeout(() => teamMessage.delete(), 10000);

    // Ask for language selection via reactions
    const languageEmbed = new MessageEmbed()
      .setTitle('Select Language')
      .setDescription('React with your flag to choose a language!');
    
    const languageMessage = await message.channel.send({ embeds: [languageEmbed] });

    // React with flags for language selection
    const languages = ['🇩🇪', '🇬🇧', '🇫🇷', '🇪🇸']; // Example language flags
    for (let flag of languages) {
      await languageMessage.react(flag);
    }

    // Only the command sender can react
    await languageMessage.awaitReactions({ max: 1, time: 60000, errors: ['time'], filter: (reaction, user) => user.id === message.author.id });

    // Delete the message after the user reacts
    await languageMessage.delete();

    // Randomly choose starting team
    const startingTeam = Math.random() > 0.5 ? 'Blue' : 'Red';
    message.channel.send(`${startingTeam} team will start first!`);

    // Ask questions based on players' quiz data and record responses
    const results = await askQuestions(teamRed, teamBlue, db);

    // Calculate target score for the chasing team
    const targetScore = calculateTarget(results.blue);

    // Show the target and results
    const resultEmbed = new MessageEmbed()
      .setTitle('Results')
      .addField('Team Blue', `${results.blue.correct}/${results.blue.total} in ${results.blue.time}s`)
      .addField('Team Red', `${results.red.correct}/${results.red.total} in ${results.red.time}s`)
      .addField('Target for Red Team', targetScore.toString())
      .setColor('#FF0000');

    message.channel.send({ embeds: [resultEmbed] });
  }
});

client.login('YOUR_DISCORD_BOT_TOKEN');