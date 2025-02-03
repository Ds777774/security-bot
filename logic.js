// logic.js - This file handles the logic to get the appropriate quiz questions based on the user's level

const { russianQuizData } = require('./russianData');
const { germanQuizData } = require('./germanData');
const { frenchQuizData } = require('./frenchData');

// Shuffle function to randomize the questions
const shuffleArray = (array) => {
  let shuffled = array.slice();
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  return shuffled;
};

// Function to get questions based on player data
const getQuestions = async (player) => {
  // Assuming that player.language and player.level are available
  let questions;
  switch (player.language) {
    case 'Russian':
      questions = russianQuizData[player.level] || [];
      break;
    case 'German':
      questions = germanQuizData[player.level] || [];
      break;
    case 'French':
      questions = frenchQuizData[player.level] || [];
      break;
    default:
      questions = [];
      break;
  }
  
  return shuffleArray(questions).slice(0, 5); // Return 5 randomized questions
};

module.exports = { getQuestions };