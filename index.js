// Import required classes from discord.js and dotenv
const { Client, GatewayIntentBits, EmbedBuilder } = require('discord.js');
require('dotenv').config(); // Load environment variables from .env file

// Create a new client instance with necessary intents
const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,        // Access guild functionality
    GatewayIntentBits.GuildMembers, // Handle member events like joining
    GatewayIntentBits.MessageContent // Read message content
  ],
});

// Event listener for when the bot is successfully logged in
client.once('ready', () => {
  console.log(`✅ Logged in as ${client.user.tag}!`);
});

// Event listener for when a new member joins the server
client.on('guildMemberAdd', async (member) => {
  console.log(`📥 ${member.user.tag} has joined the server.`);

  // Calculate account age
  const accountAge = Date.now() - member.user.createdTimestamp;
  const threeDaysInMillis = 3 * 24 * 60 * 60 * 1000; // 3 days in milliseconds

  // Check if account is less than 3 days old
  if (accountAge < threeDaysInMillis) {
    // Create an embedded message to send as a DM
    const embed = new EmbedBuilder()
      .setColor('#FF0000') // Red for warning
      .setTitle('🚨 Account Age Restriction')
      .setDescription('Your account must be at least **3 days old** to join this server.')
      .addFields(
        { name: 'Reason', value: 'Your account is too new to join this server.' },
        { name: 'Action', value: 'You have been kicked for violating the rule.' }
      )
      .setTimestamp()
      .setFooter({ text: 'Please contact a server admin if you believe this is a mistake.' });

    // Send the embedded message to the new member
    try {
      await member.send({ embeds: [embed] });
      console.log(`📤 Sent DM to ${member.user.tag}.`);
    } catch (error) {
      console.error(`❌ Could not send DM to ${member.user.tag}.`, error);
    }

    // Kick the member from the server
    try {
      await member.kick('Account less than 3 days old');
      console.log(`🔨 Kicked ${member.user.tag} for having an account less than 3 days old.`);
    } catch (error) {
      console.error(`❌ Failed to kick ${member.user.tag}.`, error);
    }
  }
});

// Log in to Discord with your app's token (stored in .env file)
client.login(process.env.DISCORD_TOKEN)
  .then(() => console.log('🚀 Bot is running...'))
  .catch((error) => console.error('❌ Failed to log in:', error));