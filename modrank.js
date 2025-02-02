const { EmbedBuilder } = require('discord.js');
const { Pool } = require('pg');

const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: {
        rejectUnauthorized: false, // Required for Neon DB
    },
});

// Ensure mod_rank table exists
(async () => {
    try {
        await pool.query(`
            CREATE TABLE IF NOT EXISTS mod_rank (
                user_id TEXT PRIMARY KEY,
                username TEXT NOT NULL,
                points INTEGER NOT NULL DEFAULT 0,
                joined_at TIMESTAMP NOT NULL
            );
        `);
    } catch (err) {
        console.error('Error creating mod_rank table:', err);
    }
})();

// Function to update moderator points
module.exports.updateModRank = async (userId, username, guild, points = 1) => {
    try {
        const client = await pool.connect();

        const moderatorRole = guild.roles.cache.find(role => role.name.toLowerCase() === 'moderator');
        if (!moderatorRole) return;

        const member = guild.members.cache.get(userId);
        if (!member || !member.roles.cache.has(moderatorRole.id)) {
            client.release();
            return;
        }

        // Get role assignment timestamp
        const roleAssignedAt = member.roles.cache.get(moderatorRole.id).createdAt;

        const result = await client.query(`SELECT * FROM mod_rank WHERE user_id = $1`, [userId]);

        if (result.rows.length > 0) {
            await client.query(
                `UPDATE mod_rank SET points = points + $1 WHERE user_id = $2`,
                [points, userId]
            );
        } else {
            await client.query(
                `INSERT INTO mod_rank (user_id, username, points, joined_at) VALUES ($1, $2, $3, $4)`,
                [userId, username, points, roleAssignedAt]
            );
        }

        client.release();
    } catch (err) {
        console.error('Error updating moderator rank:', err);
    }
};

// Function to track bumping points
module.exports.trackBumpingPoints = async (message) => {
    if (message.author.id !== '735147814878969968') return; // Only track messages from bump bot

    if (!message.content.includes('Thx for bumping our Server!')) return;

    let mentionedUser = message.mentions.users.first();

    if (!mentionedUser) {
        const userIdMatch = message.content.match(/<@!?(\d+)>/);
        if (userIdMatch) {
            mentionedUser = await message.client.users.fetch(userIdMatch[1]);
        }
    }

    if (mentionedUser) {
        const guild = message.guild;
        const moderatorRole = guild.roles.cache.find(role => role.name.toLowerCase() === 'moderator');
        const member = guild.members.cache.get(mentionedUser.id);

        if (!moderatorRole || !member || !member.roles.cache.has(moderatorRole.id)) return; // Ensure user has Moderator role

        try {
            const client = await pool.connect();

            const result = await client.query(`SELECT * FROM mod_rank WHERE user_id = $1`, [mentionedUser.id]);

            if (result.rows.length > 0) {
                await client.query(
                    `UPDATE mod_rank SET points = points + 3 WHERE user_id = $1`,
                    [mentionedUser.id]
                );
            } else {
                await client.query(
                    `INSERT INTO mod_rank (user_id, username, points, joined_at) VALUES ($1, $2, 3, NOW())`,
                    [mentionedUser.id, mentionedUser.username]
                );
            }

            client.release();
        } catch (err) {
            console.error('Error tracking bumping points:', err);
        }
    }
};

// Function to fetch and display moderator leaderboard
module.exports.execute = async (message) => {
    try {
        const client = await pool.connect();

        const leaderboardData = await client.query(`
            SELECT username, points,
                   EXTRACT(DAY FROM NOW() - joined_at) AS days,
                   (points::FLOAT / NULLIF(EXTRACT(DAY FROM NOW() - joined_at), 0)) AS avg_points
            FROM mod_rank
            ORDER BY points DESC, avg_points DESC
            LIMIT 10
        `);

        client.release();

        if (leaderboardData.rows.length === 0) {
            return message.channel.send('No moderator activity recorded yet.');
        }

        const leaderboardEmbed = new EmbedBuilder()
            .setTitle('Moderator Leaderboard')
            .setColor('#acf508')
            .setDescription(
                leaderboardData.rows
                    .map(
                        (row, index) =>
                            `**#${index + 1}** | **${row.days} Days** | **${row.username}** - **P:** ${row.points} | **AVG:** ${row.avg_points ? row.avg_points.toFixed(2) : '0.00'}`
                    )
                    .join('\n')
            );

        message.channel.send({ embeds: [leaderboardEmbed] });
    } catch (error) {
        console.error('Error fetching moderator leaderboard:', error);
        message.channel.send('An error occurred while retrieving the moderator leaderboard.');
    }
};