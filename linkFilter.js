const { EmbedBuilder } = require('discord.js');

module.exports = (client) => {
    // List of suspicious patterns (you can add more as needed)
    const suspiciousLinks = [
        /steamgift\.com/i,        // Matches Steam Gift links
        /freegiftcards/i,         // Matches suspicious free gift card links
        /getfreegame/i,           // Matches free game links
        /discounts/i,             // Matches discount or offer links
        /.*\.ru$/,                // Matches Russian domain links (you can add more such patterns if needed)
        /.*\.xyz$/,               // Matches .xyz domain links (often used by suspicious websites)
        /steamcommunity\.com/i,   // Matches SteamCommunity.com
        /steamcomunity\.com/i     // Matches steamcomunity.com (added new pattern)
    ];

    // Listener for new messages
    client.on('messageCreate', async (message) => {
        // Ignore bot messages or messages without content
        if (message.author.bot || !message.content) return;

        // Check if the message contains any suspicious links
        const foundSuspiciousLink = suspiciousLinks.some(pattern => pattern.test(message.content));

        if (foundSuspiciousLink) {
            try {
                // Check if the message can be deleted (e.g., message exists and bot has permissions)
                if (message.deletable) {
                    await message.delete();
                }

                // Kick the user directly without sending a warning
                await message.guild.members.kick(message.author, { reason: "Sent suspicious link." });

                // Create the embed log for the action
                const logEmbed = new EmbedBuilder()
                    .setColor(0xacf508)  // Set color to #acf508
                    .setTitle('User Kicked for Suspicious Link')
                    .setDescription(`${message.author.tag} was kicked for sending a suspicious link: ${message.content}`)
                    .setTimestamp();

                // Log the action to the specified log channel (1224730855717470299)
                const logChannel = message.guild.channels.cache.get('1224730855717470299');
                if (logChannel) {
                    logChannel.send({ embeds: [logEmbed] });
                }

            } catch (err) {
                // Gracefully handle errors
                if (err.code === 10008) {
                    console.error('The message is unknown or has been deleted already.');
                } else {
                    console.error('Error kicking user:', err);
                }
            }
        }
    });
};