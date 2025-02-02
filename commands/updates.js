const { EmbedBuilder } = require('discord.js');

module.exports = {
    execute: async (message) => {
        // Embed content
        const embed = new EmbedBuilder()
            .setTitle('Frau Lingua 1.0.3 - Update Information') // Heading
            .setColor('#acf508') // Updated color
            .setDescription('We are excited to share with you the latest updates for Frau Lingua 1.0.3! Please take a moment to review the improvements and new features that have been added:')
            .addFields(
                {
                    name: '🗓️ Date of Update',
                    value: 'January 23, 2025',
                    inline: false
                },
                {
                    name: '✨ New Features for Users',
                    value: `
We have added several new commands to enhance your experience:

1. **!leaderboard**: View the quiz leaderboard and check out top performers.
2. **!suggestion**: Share your ideas and suggestions to help improve the server.
3. **!ticket**: Open a ticket to report any issues or concerns to the moderation team.
4. **!resources**: Access helpful resources to make the most of the bot and server.
                    `,
                    inline: false
                },
                {
                    name: '🔒 Security Enhancements',
                    value: `
We’ve also implemented important security measures to ensure a safe and enjoyable environment for everyone:

1. **Suspicious Links**: Any suspicious links will now automatically kick the member who sent them, while also notifying the moderators in a dedicated channel and removing the link.
2. **Spam Detection**: We’ve improved our spam detection to keep conversations clean and free from disruptions.
3. **Bad Words Detection**: Offensive language is now flagged and dealt with appropriately to maintain a positive community atmosphere.
                    `,
                    inline: false
                }
            )
            .setFooter({ text: 'We’re constantly improving. Stay tuned for future updates!' });

        // Send the embed in the channel
        await message.channel.send({ embeds: [embed] });
    }
};