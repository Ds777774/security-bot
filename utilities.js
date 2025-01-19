// utilities.js

/**
 * Shuffles an array in place.
 * @param {Array} array - The array to shuffle.
 */
function shuffleArray(array) {
    for (let i = array.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [array[i], array[j]] = [array[j], array[i]];
    }
}

/**
 * Clears the active quiz for a user.
 * @param {Object} activeQuizzes - The object tracking active quizzes.
 * @param {String} userId - The ID of the user whose quiz data to clear.
 */
function clearActiveQuiz(activeQuizzes, userId) {
    delete activeQuizzes[userId];
}

module.exports = {
    shuffleArray,
    clearActiveQuiz,
};