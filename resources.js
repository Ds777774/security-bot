const { EmbedBuilder } = require('discord.js');

const embedColors = {
    russian: '#7907ff',
    german: '#f4ed09',
    french: '#09ebf6',
};

module.exports = {
    name: 'resources',
    description: 'Shares helpful resources for learning languages.',
    execute: async (message) => {
        const embed = new EmbedBuilder()
            .setTitle('Language Learning Resources')
            .setDescription(
                '**Russian**:\n' +
                '1. **Duolingo**: [duolingo.com](https://www.duolingo.com)\n' +
                '2. **RussianPod101**: [russianpod101.com](https://www.russianpod101.com)\n\n' +
                '**German**:\n' +
                '1. **Duolingo**: [duolingo.com](https://www.duolingo.com)\n' +
                '2. **Goethe-Institut**: [goethe.de](https://www.goethe.de)\n\n' +
                '**French**:\n' +
                '1. **Duolingo**: [duolingo.com](https://www.duolingo.com)\n' +
                '2. **TV5MONDE**: [apprendre.tv5monde.com](https://apprendre.tv5monde.com)'
            )
            .setColor(embedColors.default)
            .setFooter({ text: 'Explore these resources to enhance your learning!' });

        await message.channel.send({ embeds: [embed] });
    },
};