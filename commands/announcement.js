const { MessageActionRow, MessageButton } = require('discord.js');

module.exports = {
  name: 'announcement',
  description: 'Send an announcement to the specific announcements channel with everyone ping',

  async execute(message, args) {
    // Check if the message author has the 'Moderator' role
    if (!message.member.roles.cache.some(role => role.name === 'Moderator')) {
      return message.reply('You do not have the required role to make an announcement.');
    }

    // Ask the moderator for the announcement message
    const askMessage = await message.reply('Please type the announcement message you want to send.');

    // Filter to ensure we get the correct response
    const filter = response => response.author.id === message.author.id;
    let collected;

    try {
      collected = await message.channel.awaitMessages({ filter, time: 30000, max: 1, errors: ['time'] });
    } catch (error) {
      return message.reply('You took too long to respond. Please try again.');
    }

    const announcementMessage = collected.first().content;

    // Fetch the specific announcement channel using its ID
    const announcementChannel = message.guild.channels.cache.get('1279821768785137686');
    if (!announcementChannel) {
      return message.reply('Announcement channel not found. Please check the channel ID.');
    }

    // Send the message to the specified announcement channel with everyone ping
    try {
      const sentMessage = await announcementChannel.send(`@everyone\n\n${announcementMessage}`);

      // Add reactions to the announcement message
      await sentMessage.react('👍');  // Thumbs up
      await sentMessage.react('🇩🇪');  // German flag
      await sentMessage.react('🇫🇷');  // French flag
      await sentMessage.react('🇷🇺');  // Russian flag
      await sentMessage.react('🎉');  // Celebration
      await sentMessage.react('🎊');  // Party Popper
      await sentMessage.react('🔥');  // Fire

      message.reply('Your announcement has been sent with reactions!');
    } catch (error) {
      console.error(error);
      message.reply('An error occurred while sending the announcement.');
    }
  },
};