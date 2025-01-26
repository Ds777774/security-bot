const { EmbedBuilder } = require('discord.js');
const sqlite3 = require('sqlite3').verbose();
const db = new sqlite3.Database('./quiz_data.db');

// Initialize the database
db.serialize(() => {
    db.run(`
        CREATE TABLE IF NOT EXISTS leaderboard (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            username TEXT NOT NULL,
            language TEXT NOT NULL,
            level TEXT NOT NULL,
            quizzes INTEGER NOT NULL,
            points INTEGER NOT NULL
        )
    `);
});

module.exports = {
    name: 'leaderboard',
    description: 'Shows the quiz leaderboard for a specific language and level.',
    async execute(message, args) {
        try {
            // Ask for language selection
            const languageEmbed = new EmbedBuilder()
                .setTitle('Choose a Language for the Leaderboard')
                .setDescription('React to select the language:\n\n🇩🇪: German\n🇫🇷: French\n🇷🇺: Russian')
                .setColor('#00FF00');

            const languageMessage = await message.channel.send({ embeds: [languageEmbed] });
            const languageEmojis = ['🇩🇪', '🇫🇷', '🇷🇺'];
            const languages = ['german', 'french', 'russian'];

            for (const emoji of languageEmojis) {
                await languageMessage.react(emoji);
            }

            const languageReaction = await languageMessage.awaitReactions({
                filter: (reaction, user) => languageEmojis.includes(reaction.emoji.name) && user.id === message.author.id,
                max: 1,
                time: 15000,
            });

            if (!languageReaction.size) {
                await languageMessage.delete();
                return message.channel.send('No language selected. Command cancelled.');
            }

            const selectedLanguage = languages[languageEmojis.indexOf(languageReaction.first().emoji.name)];
            await languageMessage.delete();

            // Ask for level selection
            const levelEmbed = new EmbedBuilder()
                .setTitle(`Choose a Level for the ${selectedLanguage.charAt(0).toUpperCase() + selectedLanguage.slice(1)} Leaderboard`)
                .setDescription('React to select the level:\n\n🇦: A1\n🇧: A2\n🇨: B1\n🇩: B2\n🇪: C1\n🇫: C2')
                .setColor('#00FF00');

            const levelMessage = await message.channel.send({ embeds: [levelEmbed] });
            const levelEmojis = ['🇦', '🇧', '🇨', '🇩', '🇪', '🇫'];
            const levels = ['A1', 'A2', 'B1', 'B2', 'C1', 'C2'];

            for (const emoji of levelEmojis) {
                await levelMessage.react(emoji);
            }

            const levelReaction = await levelMessage.awaitReactions({
                filter: (reaction, user) => levelEmojis.includes(reaction.emoji.name) && user.id === message.author.id,
                max: 1,
                time: 15000,
            });

            if (!levelReaction.size) {
                await levelMessage.delete();
                return message.channel.send('No level selected. Command cancelled.');
            }

            const selectedLevel = levels[levelEmojis.indexOf(levelReaction.first().emoji.name)];
            await levelMessage.delete();

            // Fetch the leaderboard data
            db.all(
                `
                SELECT username, quizzes, points, (points * 1.0 / quizzes) AS avg_points
                FROM leaderboard
                WHERE language = ? AND level = ?
                ORDER BY points DESC
                LIMIT 10
                `,
                [selectedLanguage, selectedLevel],
                (err, rows) => {
                    if (err) {
                        console.error(err);
                        return message.channel.send('An error occurred while fetching the leaderboard.');
                    }

                    if (rows.length === 0) {
                        return message.channel.send(`No leaderboard data found for ${selectedLanguage.toUpperCase()} ${selectedLevel}.`);
                    }

                    const leaderboardEmbed = new EmbedBuilder()
                        .setTitle(`${selectedLanguage.charAt(0).toUpperCase() + selectedLanguage.slice(1)} Level ${selectedLevel} Leaderboard`)
                        .setColor('#FFD700')
                        .setDescription(
                            rows
                                .map(
                                    (row, index) =>
                                        `**#${index + 1}** ${row.username} - **Q:** ${row.quizzes} | **P:** ${row.points} | **AVG:** ${row.avg_points.toFixed(
                                            2
                                        )}`
                                )
                                .join('\n')
                        );

                    message.channel.send({ embeds: [leaderboardEmbed] });
                }
            );
        } catch (error) {
            console.error(error);
            message.channel.send('An error occurred. Please try again.');
        }
    },
};

// Insert or update user data in the database
module.exports.updateLeaderboard = (username, language, level, points) => {
    db.serialize(() => {
        db.get(
            `SELECT * FROM leaderboard WHERE username = ? AND language = ? AND level = ?`,
            [username, language, level],
            (err, row) => {
                if (err) {
                    return console.error(err);
                }

                if (row) {
                    db.run(
                        `UPDATE leaderboard SET quizzes = quizzes + 1, points = points + ? WHERE username = ? AND language = ? AND level = ?`,
                        [points, username, language, level]
                    );
                } else {
                    db.run(
                        `INSERT INTO leaderboard (username, language, level, quizzes, points) VALUES (?, ?, ?, ?, ?)`,
                        [username, language, level, 1, points]
                    );
                }
            }
        );
    });
};