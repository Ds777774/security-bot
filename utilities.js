const { EmbedBuilder } = require('discord.js');

// Colors for embeds based on language
const embedColors = {
    russian: '#7907ff',
    german: '#f4ed09',
    french: '#09ebf6',
};

// Function to shuffle an array in place using the Fisher-Yates algorithm
/**
 * Shuffles an array in place using the Fisher-Yates algorithm.
 * @param {Array} array - The array to shuffle.
 */
function shuffleArray(array) {
    for (let i = array.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [array[i], array[j]] = [array[j], array[i]]; // Swap elements
    }
}

// Function to clear the active quiz for a user
/**
 * Clears the active quiz for a user.
 * @param {Object} activeQuizzes - The object tracking active quizzes.
 * @param {String} userId - The ID of the user whose quiz data to clear.
 */
function clearActiveQuiz(activeQuizzes, userId) {
    if (activeQuizzes[userId]) {
        delete activeQuizzes[userId];
    }
}

// Function to track the active quiz for a user
/**
 * Tracks the active quiz for a user.
 * @param {Object} activeQuizzes - The object tracking active quizzes.
 * @param {String} userId - The ID of the user taking the quiz.
 * @param {Object} quizData - The quiz data for the user.
 */
function trackActiveQuiz(activeQuizzes, userId, quizData) {
    if (quizData && typeof quizData === 'object' && quizData.language && quizData.level) {
        activeQuizzes[userId] = quizData;
    } else {
        throw new Error('Invalid quiz data provided');
    }
}

// Function to generate a random item from an array (e.g., "Word of the Day")
/**
 * Generates a random item from an array (e.g., "Word of the Day").
 * @param {Array} array - The array to select a random item from.
 * @returns {*} A random item from the array.
 */
function getRandomItem(array) {
    if (!Array.isArray(array) || array.length === 0) {
        throw new Error('Invalid array provided for random selection.');
    }
    return array[Math.floor(Math.random() * array.length)];
}

// Function to format a word's details into an embed-friendly format
/**
 * Formats a word's details into an embed-friendly format.
 * @param {Object} word - The word object containing details.
 * @returns {Array} An array of fields for an embed.
 */
function formatWordDetails(word) {
    if (!word || typeof word !== 'object') {
        throw new Error('Invalid word object');
    }

    return [
        { name: '**Meaning**', value: word.meaning || 'N/A', inline: false },
        { name: '**Plural**', value: word.plural || 'N/A', inline: false },
        { name: '**Indefinite Article**', value: word.indefinite || 'N/A', inline: false },
        { name: '**Definite Article**', value: word.definite || 'N/A', inline: false }
    ];
}

// Function to handle "Word of the Day" logic
/**
 * Handles the "Word of the Day" logic.
 * @param {Array} wordList - List of words to choose from for the Word of the Day.
 * @param {String} language - The language of the word.
 * @returns {Object} An object containing the word and its details.
 */
function getWordOfTheDay(wordList, language) {
    const word = getRandomItem(wordList);
    return {
        word,
        language,
        formattedDetails: formatWordDetails(word),
    };
}

// Function to send a Word of the Day message
/**
 * Sends a Word of the Day message.
 * @param {Object} message - The Discord message object.
 * @param {Array} wordList - List of words for Word of the Day.
 * @param {String} language - The language of the word.
 */
async function sendWordOfTheDay(message, wordList, language) {
    const wordOfTheDay = getWordOfTheDay(wordList, language);
    const embed = new EmbedBuilder()
        .setTitle(`Word of the Day - ${wordOfTheDay.language.toUpperCase()}`)
        .setDescription(`Today's word is **${wordOfTheDay.word.word}**`)
        .addFields(wordOfTheDay.formattedDetails)
        .setColor(embedColors[wordOfTheDay.language]);

    await message.channel.send({ embeds: [embed] });
}

module.exports = {
    shuffleArray,
    clearActiveQuiz,
    trackActiveQuiz,
    getRandomItem,
    formatWordDetails,
    getWordOfTheDay,
    sendWordOfTheDay,
};