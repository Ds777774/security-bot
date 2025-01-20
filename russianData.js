// Quiz Data for Russian
const russianQuizData = {
    A1: [
        {
            word: "Дом",
            options: ["🇦 House", "🇧 Tree", "🇨 Car", "🇩 Dog"],
            correct: "🇦" // Correct answer is "House"
        },
        {
            word: "Кошка",
            options: ["🇦 Cat", "🇧 Mouse", "🇨 Bird", "🇩 Horse"],
            correct: "🇦" // Correct answer is "Cat"
        }
    ],
    A2: [
        {
            word: "Дружба",
            options: ["🇦 Friendship", "🇧 Love", "🇨 Anger", "🇩 Sadness"],
            correct: "🇦" // Correct answer is "Friendship"
        }
    ],
    B1: [
        {
            word: "Свобода",
            options: ["🇦 Freedom", "🇧 Justice", "🇨 Peace", "🇩 Honor"],
            correct: "🇦" // Correct answer is "Freedom"
        }
    ],
    B2: [
        {
            word: "Прогресс",
            options: ["🇦 Progress", "🇧 Decline", "🇨 Start", "🇩 Stop"],
            correct: "🇦" // Correct answer is "Progress"
        }
    ],
    C1: [
        {
            word: "Гармония",
            options: ["🇦 Harmony", "🇧 Chaos", "🇨 Peace", "🇩 Disagreement"],
            correct: "🇦" // Correct answer is "Harmony"
        }
    ],
    C2: [
        {
            word: "Совершенство",
            options: ["🇦 Perfection", "🇧 Imperfection", "🇨 Mediocrity", "🇩 Excellence"],
            correct: "🇦" // Correct answer is "Perfection"
        }
    ]
};

// Word of the Day Data for Russian
const russianWordList = [
    {
        word: "Собака",
        meaning: "Dog",
        plural: "Собаки",
        indefinite: null, // Indefinite articles do not apply in Russian
        definite: null // Definite articles do not apply in Russian
    },
    {
        word: "Книга",
        meaning: "Book",
        plural: "Книги",
        indefinite: null,
        definite: null
    },
    {
        word: "Море",
        meaning: "Sea",
        plural: "Моря",
        indefinite: null,
        definite: null
    }
];

module.exports = { russianQuizData, russianWordList };