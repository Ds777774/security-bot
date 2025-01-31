const { EmbedBuilder } = require('discord.js');
const { Pool } = require('pg');
const moment = require('moment-timezone');
require('dotenv').config(); // Load environment variables from .env file

let pool;

// Function to initialize or reconnect to the database
function initializeDatabase() {
    pool = new Pool({
        connectionString: process.env.DATABASE_URL,
        ssl: {
            rejectUnauthorized: false, // Disable SSL verification for NeonTech (if necessary)
        },
    });

    pool.on('error', (err) => {
        console.error('Unexpected database error:', err);
        console.log('Reinitializing database connection...');
        initializeDatabase(); // Reconnect if the connection is lost
    });
}

// Initialize the database connection
initializeDatabase();

// Create the moderator_activity table if it doesn't exist
async function createTableIfNotExist() {
    const createTableQuery = `
        CREATE TABLE IF NOT EXISTS moderator_activity (
            user_id VARCHAR(255) PRIMARY KEY,
            username VARCHAR(255) NOT NULL,
            points INT DEFAULT 0
        );
    `;

    try {
        await pool.query(createTableQuery);
    } catch (err) {
        console.error('Error creating table:', err);
        console.log('Reinitializing database connection...');
        initializeDatabase(); // Reconnect if the query fails
    }
}

// Ensure the table exists on startup
createTableIfNotExist().catch((err) => console.error('Initialization error:', err));

// Track messages
async function trackMessage(message) {
    if (message.author.bot) return;

    const moderatorRole = message.guild.roles.cache.find((role) => role.name.toLowerCase() === 'moderator');
    if (!moderatorRole || !message.member.roles.cache.has(moderatorRole.id)) return;

    const userId = message.author.id;
    const username = message.author.username;

    try {
        const res = await pool.query('SELECT * FROM moderator_activity WHERE user_id = $1', [userId]);

        if (res.rows.length === 0) {
            await pool.query('INSERT INTO moderator_activity (user_id, username, points) VALUES ($1, $2, $3)', [userId, username, 1]);
        } else {
            await pool.query('UPDATE moderator_activity SET points = points + 1 WHERE user_id = $1', [userId]);
        }
    } catch (err) {
        console.error('Error tracking message:', err);
        console.log('Reinitializing database connection...');
        initializeDatabase(); // Reconnect if the query fails
    }
}

// Track "bumping" messages from a specific bot
async function trackBumpingPoints(message) {
    if (
        message.author.id === '735147814878969968' && // Bumping bot ID
        message.content.includes('Thx for bumping our Server! We will remind you in 2 hours!')
    ) {
        const mentionedUser = message.mentions.users.first();
        if (mentionedUser) {
            const userId = mentionedUser.id;
            const username = mentionedUser.username;

            console.log(`Bump message received: ${message.content}`);
            console.log(`Bumping user: ${mentionedUser.username}`);

            try {
                const res = await pool.query('SELECT * FROM moderator_activity WHERE user_id = $1', [userId]);

                if (res.rows.length === 0) {
                    // Insert a new row if the user doesn't exist
                    await pool.query('INSERT INTO moderator_activity (user_id, username, points) VALUES ($1, $2, $3)', [userId, username, 3]);
                } else {
                    // Update points for the user
                    await pool.query('UPDATE moderator_activity SET points = points + 3 WHERE user_id = $1', [userId]);
                }
            } catch (err) {
                console.error('Error tracking bumping points:', err);
                console.log('Reinitializing database connection...');
                initializeDatabase(); // Reconnect if the query fails
            }
        }
    }
}

// Generate leaderboard
async function generateLeaderboard(discordClient, channelId) {
    try {
        const res = await pool.query('SELECT * FROM moderator_activity ORDER BY points DESC LIMIT 10');
        const sortedUsers = res.rows;

        const embed = new EmbedBuilder()
            .setTitle('🏆 Moderator of The Month')
            .setColor('#acf508') // Custom color
            .setDescription(
                sortedUsers
                    .map(
                        (user, index) =>
                            `**${index + 1}. <@${user.user_id}>** - ${user.points} points` // Ping the user in the leaderboard
                    )
                    .join('\n') || 'No points recorded yet!'
            )
            .setFooter({ text: sortedUsers.length > 0 ? `🎉 Congratulations to ${sortedUsers[0].username} for leading!` : 'Start earning points to get featured!' });

        const channel = discordClient.channels.cache.get(channelId);
        if (channel) channel.send({ embeds: [embed] });
    } catch (err) {
        console.error('Error generating leaderboard:', err);
        console.log('Reinitializing database connection...');
        initializeDatabase(); // Reconnect if the query fails
    }
}

// Check if today is the last day of the month and send the leaderboard if true
async function checkLastDayOfMonth(discordClient, channelId) {
    const today = moment().tz('Europe/Berlin');
    const lastDay = moment().endOf('month');

    if (today.isSame(lastDay, 'day')) {
        await generateLeaderboard(discordClient, channelId);
    }
}

// Schedule a daily check for the last day of the month
setInterval(() => {
    checkLastDayOfMonth(client, '1224730855717470299'); // Use the provided channel ID
}, 86400000); // 86400000 ms = 24 hours

module.exports = {
    trackMessage,
    trackBumpingPoints,
    generateLeaderboard,
};