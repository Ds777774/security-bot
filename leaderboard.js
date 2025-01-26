const { EmbedBuilder } = require('discord.js');
const { Pool } = require('pg');

// PostgreSQL connection setup
const pool = new Pool({
    connectionString: process.env.DATABASE_URL, // Render's PostgreSQL URL
    ssl: {
        rejectUnauthorized: false, // Required for Render
    },
});

// Ensure the leaderboard table exists
(async () => {
    try {
        await pool.query(`
            CREATE TABLE IF NOT EXISTS leaderboard (
                id SERIAL PRIMARY KEY,
                username TEXT NOT NULL,
                language TEXT NOT NULL,
                level TEXT NOT NULL,
                quizzes INTEGER NOT NULL,
                points INTEGER NOT NULL
            )
        `);
        console.log("PostgreSQL: Leaderboard table is ready.");
    } catch (err) {
        console.error("Error creating leaderboard table:", err);
    }
})();

// Function to update the leaderboard
module.exports.updateLeaderboard = async (username, language, level, points) => {
    try {
        const client = await pool.connect();

        // Check if the user already exists in the leaderboard
        const result = await client.query(
            `SELECT * FROM leaderboard WHERE username = $1 AND language = $2 AND level = $3`,
            [username, language, level]
        );

        if (result.rows.length > 0) {
            // Update existing user entry
            await client.query(
                `UPDATE leaderboard SET quizzes = quizzes + 1, points = points + $1 WHERE username = $2 AND language = $3 AND level = $4`,
                [points, username, language, level]
            );
        } else {
            // Insert new user entry
            await client.query(
                `INSERT INTO leaderboard (username, language, level, quizzes, points) VALUES ($1, $2, $3, 1, $4)`,
                [username, language, level, points]
            );
        }

        client.release();
    } catch (err) {
        console.error("Error updating leaderboard:", err);
    }
};

// Function to fetch and display the leaderboard
module.exports.execute = async (message) => {
    try {
        const client = await pool.connect();

        // Language selection
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

        // Level selection
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

        // Fetch leaderboard data from PostgreSQL
        const leaderboardData = await client.query(
            `SELECT username, quizzes, points, (points::FLOAT / quizzes) AS avg_points
            FROM leaderboard
            WHERE language = $1 AND level = $2
            ORDER BY points DESC
            LIMIT 10`,
            [selectedLanguage, selectedLevel]
        );

        client.release();

        if (leaderboardData.rows.length === 0) {
            return message.channel.send(`No leaderboard data found for ${selectedLanguage.toUpperCase()} ${selectedLevel}.`);
        }

        // Create leaderboard embed
        const leaderboardEmbed = new EmbedBuilder()
            .setTitle(`${selectedLanguage.charAt(0).toUpperCase() + selectedLanguage.slice(1)} Level ${selectedLevel} Leaderboard`)
            .setColor('#FFD700')
            .setDescription(
                leaderboardData.rows
                    .map(
                        (row, index) =>
                            `**#${index + 1}** ${row.username} - **Q:** ${row.quizzes} | **P:** ${row.points} | **AVG:** ${row.avg_points.toFixed(2)}`
                    )
                    .join('\n')
            );

        message.channel.send({ embeds: [leaderboardEmbed] });
    } catch (error) {
        console.error("Error fetching leaderboard:", error);
        message.channel.send('An error occurred. Please try again.');
    }
};