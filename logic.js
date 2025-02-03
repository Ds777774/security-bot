const pg = require('pg');

// Function to fetch leaderboard data and create balanced teams
async function getTeams(players, db) {
  const playerScores = await db.query('SELECT user_id, score, level FROM leaderboard WHERE user_id = ANY($1)', [players]);

  // Sort players by score to balance the teams
  const sortedPlayers = playerScores.rows.sort((a, b) => b.score - a.score);

  // Split players into two teams: Team Red and Team Blue
  const half = Math.ceil(sortedPlayers.length / 2);
  const teamRed = sortedPlayers.slice(0, half).map(player => `<@${player.user_id}>`);
  const teamBlue = sortedPlayers.slice(half).map(player => `<@${player.user_id}>`);

  return { teamRed, teamBlue };
}

// Function to ask questions to the players based on their quiz level
async function askQuestions(teamRed, teamBlue, db) {
  const askPlayerQuestions = async (team) => {
    let totalQuestions = 0;
    let correctAnswers = 0;
    let totalTime = 0;

    for (let player of team) {
      const playerData = await db.query('SELECT level FROM leaderboard WHERE user_id = $1', [player]);

      // Fetch questions based on player's level
      const questions = await getQuestions(playerData.rows[0].level);

      for (let question of questions) {
        const startTime = Date.now();
        // Simulate question answering (mock)
        const userAnswer = await askQuestion(player, question); // Assume function that handles user answer
        const endTime = Date.now();

        totalQuestions++;
        if (userAnswer === question.correctAnswer) {
          correctAnswers++;
        }

        totalTime += (endTime - startTime) / 1000; // Time in seconds
      }
    }

    return { correct: correctAnswers, total: totalQuestions, time: totalTime };
  };

  const blueResults = await askPlayerQuestions(teamBlue);
  const redResults = await askPlayerQuestions(teamRed);

  return { blue: blueResults, red: redResults };
}

// Function to calculate the target score for the second team to chase
function calculateTarget(blueResults) {
  const target = blueResults.correct + 1;
  return target;
}

// Function to simulate question asking (mocked)
async function askQuestion(player, question) {
  // Simulate player answering
  return question.correctAnswer; // Just return the correct answer for simplicity
}

// Function to get questions based on the player's quiz level (mocked)
async function getQuestions(level) {
  // Return mock questions based on the player's level
  return [
    {
      question: "What is the English meaning of 'Hafen'?",
      options: ["Port", "Station", "Harbor", "Airport"],
      correctAnswer: "Harbor",
    },
    // Add more questions...
  ];
}

module.exports = { getTeams, askQuestions, calculateTarget };