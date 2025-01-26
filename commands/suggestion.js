
const { EmbedBuilder } = require('discord.js'); // Use EmbedBuilder instead of MessageEmbed

module.exports = {
  name: 'suggestion',
  description: 'Send a suggestion to the suggestions channel',

  async execute(message, args) {
    // Check if the message is from a bot (ignore it if it's from a bot)
    if (message.author.bot) return;

    // Get the suggestion channel by its ID
    const suggestionChannel = message.guild.channels.cache.get('1224730855717470299'); // Updated channel ID

    if (!suggestionChannel) {
      return message.reply('I could not find the suggestions channel.');
    }

    // Ask the user for their suggestion
    const askMessage = await message.reply('What is your suggestion? Please type your suggestion after this message.');

    // Create a message collector to collect the user's suggestion
    const filter = (response) => response.author.id === message.author.id; // Make sure it’s the same user
    const collectedMessages = await message.channel.awaitMessages({
      filter,
      time: 60000, // Collect for 1 minute
      max: 1,
      errors: ['time'],
    }).catch(() => {
      message.reply('You took too long to respond!');
      return;
    });

    if (!collectedMessages || collectedMessages.size === 0) {
      return message.reply('No suggestion received.');
    }

    const suggestionMessage = collectedMessages.first().content;

    // Create the embed for the suggestion
    const embed = new EmbedBuilder()
      .setColor('#acf508')
      .setTitle('New Suggestion')
      .setDescription(`Suggestion by **${message.author.tag}**\n\n${suggestionMessage}`)
      .setTimestamp();

    // Send the suggestion to the suggestion channel
    try {
      await suggestionChannel.send({ embeds: [embed] });

      // Delete the user's original message and the suggestion prompt
      await message.delete();
      await collectedMessages.first().delete();
      await askMessage.delete(); // Delete the bot's asking message
    } catch (error) {
      console.error('Error sending suggestion:', error);
      message.reply('There was an error sending your suggestion.');
    }
  },
};