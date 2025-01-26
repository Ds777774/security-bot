const { EmbedBuilder, PermissionFlagsBits, ChannelType } = require('discord.js');

module.exports = {
  name: 'ticket',
  description: 'Create a support ticket.',
  async execute(message) {
    try {
      // Check if the member already has an open ticket
      const existingTicket = message.guild.channels.cache.find(
        (channel) =>
          channel.name === `ticket-${message.author.username.toLowerCase()}`
      );

      if (existingTicket) {
        return message.channel.send(
          `You already have an open ticket: ${existingTicket}.`
        );
      }

      // Create a new ticket channel
      const ticketChannel = await message.guild.channels.create({
        name: `ticket-${message.author.username.toLowerCase()}`,
        type: ChannelType.GuildText, // Corrected channel type
        topic: `Support Ticket for ${message.author.username}`,
        permissionOverwrites: [
          {
            id: message.guild.id,
            deny: [PermissionFlagsBits.ViewChannel],
          },
          {
            id: message.author.id,
            allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages],
          },
        ],
      });

      // Get the Moderator role
      const modRole = message.guild.roles.cache.find(role => role.name === 'Moderator');
      if (!modRole) {
        return message.channel.send('Moderator role not found. Please ensure it exists.');
      }

      // Send welcome message in the ticket channel with updated color
      const embed = new EmbedBuilder()
        .setTitle('Support Ticket Created')
        .setDescription(
          `Hello ${message.author.username}, how can we assist you today? Please describe your issue, and a staff member will assist you shortly.\n\nYou can close this ticket by reacting with 🛑.`
        )
        .setColor('#acf508'); // Changed color to #acf508

      const ticketMessage = await ticketChannel.send({ embeds: [embed] });

      // Add a reaction for the user to close the ticket
      await ticketMessage.react('🛑'); // React with a "stop" emoji for closing the ticket

      // Inform the user that the ticket has been created
      message.channel.send(
        `Your ticket has been created: ${ticketChannel}. A staff member will be with you shortly!`
      );

      // Set a timeout to send a direct message to the ticket channel tagging @Moderator after 5 minutes
      setTimeout(async () => {
        try {
          // Check if the channel still exists before tagging
          const channel = message.guild.channels.cache.get(ticketChannel.id);
          if (channel) {
            await channel.send(`Hey <@&${modRole.id}>, please assist ${message.author.username} with their ticket.`);
          }
        } catch (timeoutError) {
          console.error('Error tagging Moderator role:', timeoutError);
        }
      }, 5 * 60 * 1000); // 5 minutes

      // Set up the reaction collector to handle ticket closure
      const filter = (reaction, user) => {
        return reaction.emoji.name === '🛑' && user.id === message.author.id;
      };

      const collector = ticketMessage.createReactionCollector({
        filter,
        time: 86400000, // The ticket will be open for 24 hours
      });

      collector.on('collect', async (reaction) => {
        try {
          // Check if the channel still exists before attempting to delete
          const channel = message.guild.channels.cache.get(ticketChannel.id);
          if (channel) {
            await channel.delete();
            message.channel.send(`Your ticket has been closed.`);
          } else {
            message.channel.send('The ticket channel no longer exists.');
          }
        } catch (closeError) {
          console.error('Error closing ticket:', closeError);
          message.channel.send('There was an error closing your ticket.');
        }
      });

      collector.on('end', async (collected, reason) => {
        try {
          if (reason === 'time') {
            const channel = message.guild.channels.cache.get(ticketChannel.id);
            if (channel) {
              await channel.delete();
              message.channel.send(`Ticket expired and has been automatically closed.`);
            }
          }
        } catch (deleteError) {
          console.error('Error during ticket expiration:', deleteError);
        }
      });

    } catch (error) {
      console.error('Error creating ticket:', error); // More specific logging
      message.channel.send(`There was an error creating your ticket. Error details: ${error.message}`);
    }
  },
};