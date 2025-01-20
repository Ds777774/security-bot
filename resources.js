const { EmbedBuilder } = require('discord.js');

const embedColors = {
    russian: '#7907ff',
    german: '#f4ed09',
    french: '#09ebf6',
    default: '#1cd86c',
};

module.exports = {
    name: 'help',
    description: 'Displays quiz rules for Russian, German, and French.',
    execute: async (message) => {
        const embed = new EmbedBuilder()
            .setTitle('Quiz Rules')
            .setDescription(
                'Here are the rules for the Vocabulary Quiz:\n\n' +
                '1. Use **!quiz [language]** to start the quiz.\n' +
                '   Supported languages: Russian, German, French.\n' +
                '2. Choose your level by reacting to the options:\n   🇦: A1, 🇧: A2, 🇨: B1, 🇩: B2, 🇪: C1, 🇫: C2.\n' +
                '3. The bot will ask **5 questions** from the selected level.\n' +
                '4. Each question has **4 options (A, B, C, D)**.\n' +
                '5. You have **1 minute** to answer each question.\n' +
                '6. Your final result will include your score, correct answers, and detailed feedback.'
            )
            .setColor(embedColors.default)
            .setFooter({ text: 'Type !quiz [language] to begin the quiz. Good luck!' });

        await message.channel.send({ embeds: [embed] });
    },
};