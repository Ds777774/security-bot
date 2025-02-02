const { EmbedBuilder, PermissionsBitField } = require('discord.js');

const SPAM_LIMIT = 5; // Number of messages allowed within the timeframe
const SPAM_TIMEFRAME = 5000; // Timeframe in milliseconds (5 seconds)
const WARNING_MESSAGE = 'Please avoid spamming!';
const TIMEOUT_DURATION = 300000; // Timeout duration in milliseconds (5 minutes)

const userMessages = new Map();
const userWarnings = new Map();
const userTimeouts = new Map();

const handleSpamDetection = async (message) => {
  if (message.author.bot || !message.content) return;

  const userId = message.author.id;
  const currentTimestamp = Date.now();

  // Initialize user data if not already present
  if (!userMessages.has(userId)) {
    userMessages.set(userId, []);
    userWarnings.set(userId, 0);
  }

  const userMessageHistory = userMessages.get(userId);
  userMessageHistory.push(currentTimestamp);

  // Filter out messages older than the SPAM_TIMEFRAME
  const recentMessages = userMessageHistory.filter(
    (timestamp) => currentTimestamp - timestamp < SPAM_TIMEFRAME
  );

  // If the user exceeds the spam limit
  if (recentMessages.length >= SPAM_LIMIT) {
    // Check if the user is already in a timeout
    if (userTimeouts.has(userId)) return; // User already in timeout, prevent further action

    const warningCount = userWarnings.get(userId);

    // First offense: Send warning message
    if (warningCount === 0) {
      await message.channel.send(`${message.author}, ${WARNING_MESSAGE}`);
      userWarnings.set(userId, 1);
    } 
    // Second offense: Timeout the user
    else if (warningCount === 1) {
      try {
        const member = await message.guild.members.fetch(userId);
        if (member && member.moderatable) {
          await member.timeout(TIMEOUT_DURATION, 'Spamming'); // Timeout user
          await message.channel.send(
            `${message.author} has been timed out for 5 minutes due to repeated spamming.`
          );

          // After timeout, reset the warning count to 0 for the next offenses
          userWarnings.set(userId, 0);
          userTimeouts.set(userId, Date.now()); // Track timeout duration
        }
      } catch (error) {
        console.error('Error timing out user:', error);
      }
    }

    // **Deleting Spam Messages**
    try {
      const messages = await message.channel.messages.fetch({ limit: 100 }); // Fetch up to 100 messages
      const userMessagesToDelete = messages.filter(
        (msg) => msg.author.id === userId && currentTimestamp - msg.createdTimestamp < SPAM_TIMEFRAME
      );

      // Delete the spam messages
      for (const msg of userMessagesToDelete.values()) {
        try {
          await msg.delete();
        } catch (deleteError) {
          if (deleteError.code !== 10008) {
            console.error('Error deleting message:', deleteError);
          }
        }
      }
    } catch (fetchError) {
      console.error('Error fetching messages:', fetchError);
    }
  }

  // Update the user's message history
  userMessages.set(userId, recentMessages);
};

module.exports = { handleSpamDetection };