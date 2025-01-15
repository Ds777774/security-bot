// Import required classes from discord.js and dotenv
const { Client, GatewayIntentBits, EmbedBuilder } = require('discord.js');
require('dotenv').config();  // Load environment variables from .env file

// Create a new client instance with necessary intents
const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,         // To access guild functionality
    GatewayIntentBits.GuildMembers,   // To handle member events like joining
    GatewayIntentBits.MessageContent  // For reading message content
  ],
});

// Event listener for when the bot is successfully logged in
client.once('ready', () => {
  console.log(`Logged in as ${client.user.tag}!`);  // Log bot name when logged in
});

// Event listener for when a new member joins the server
client.on('guildMemberAdd', async (member) => {
  console.log(`${member.user.tag} has joined the server.`);

  // Check if the account is less than 3 days old
  const accountAge = Date.now() - member.user.createdTimestamp;
  const threeDaysInMillis = 3 * 24 * 60 * 60 * 1000;  // 3 days in milliseconds

  if (accountAge < threeDaysInMillis) {
    // Create an embedded message to send as a DM
    const embed = new EmbedBuilder()
      .setColor('#FF0000')
      .setTitle('Account Age Restriction')
      .setDescription('Your account must be at least **3 days old** to join this server.')
      .addFields(
        { name: 'Reason:', value: 'Your account is too new to join this server.' },
        { name: 'Action:', value: 'You have been kicked for violating the rule.' }
      )
      .setTimestamp()
      .setFooter({ text: 'Please contact a server admin if you believe this is a mistake.' });

    // Send the embedded message to the new member
    try {
      await member.send({ embeds: [embed] });
    } catch (error) {
      console.error('Could not send DM to the member.', error);
    }

    // Kick the member from the server
    await member.kick('Account less than 3 days old');
    console.log(`Kicked ${member.user.tag} for having an account less than 3 days old.`);
  }
});

// Log in to Discord with your app's token (stored in .env file)
client.login(process.env.DISCORD_TOKEN).catch(console.error);