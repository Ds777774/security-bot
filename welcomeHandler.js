const { EmbedBuilder } = require('discord.js');

// Function to handle member joins
const handleMemberJoin = async (member) => {
    const guild = member.guild;
    const memberCount = guild.memberCount;

    // Send a message in the "welcome" channel mentioning the user
    const channel = guild.channels.cache.find(ch => ch.name === 'welcome');
    if (channel) {
        await channel.send(`Hello <@${member.id}>, welcome to the server! You are member **#${memberCount}**!`);
    } else {
        console.error("Channel not found: 'general'");
    }
};

// Function to handle member leaves
const handleMemberLeave = async (member) => {
    const guild = member.guild;
    const memberCount = guild.memberCount;

    // Send a leave message mentioning the user and showing the updated member count
    const channel = guild.channels.cache.find(ch => ch.name === 'welcome');
    if (channel) {
        await channel.send(`${member.user.username} has left the server. We now have **${memberCount}** members.`);
    } else {
        console.error("Channel not found: 'general'");
    }
};

module.exports = {
    handleMemberJoin,
    handleMemberLeave
};