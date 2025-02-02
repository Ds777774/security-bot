const { ActivityType } = require('discord.js');
const moment = require('moment-timezone');

const germanCities = [
    'Berlin', 'Munich', 'Hamburg', 'Cologne', 'Frankfurt', 'Stuttgart', 'Düsseldorf', 'Dresden', 'Leipzig', 'Nuremberg',
    'Bremen', 'Hannover', 'Münster', 'Aachen', 'Freiburg', 'Heidelberg', 'Mainz', 'Würzburg', 'Kassel', 'Paderborn',
    'Essen', 'Dortmund', 'Bonn', 'Mannheim', 'Karlsruhe', 'Kiel', 'Magdeburg', 'Rostock', 'Saarbrücken', 'Lübeck',
    'Erfurt', 'Regensburg', 'Osnabrück', 'Göttingen', 'Chemnitz', 'Cottbus', 'Koblenz', 'Ulm', 'Bielefeld', 'Flensburg'
];

function getGreeting() {
    const hour = moment().tz('Europe/Berlin').hour();
    if (hour >= 5 && hour < 12) {
        return 'Guten Morgen';
    } else if (hour >= 12 && hour < 18) {
        return 'Guten Nachmittag';
    } else if (hour >= 18 && hour < 22) {
        return 'Guten Abend';
    } else {
        return 'Guten Nacht';
    }
}

function getRandomCity() {
    const randomIndex = Math.floor(Math.random() * germanCities.length);
    return germanCities[randomIndex];
}

let currentStatusIndex = 0;

async function updateBotStatus(client) {
    try {
        const statuses = [
            { type: ActivityType.Playing, text: `Welcome to the LinguaLounge` },
            { type: ActivityType.Watching, text: `Ich heiße Frau Lingua` },
            { type: ActivityType.Listening, text: `Ich komme aus ${getRandomCity()}` },  // Dynamically get city
            { type: ActivityType.Playing, text: getGreeting() },  // Dynamically get greeting
            { type: ActivityType.Playing, text: `Type !help` }
        ];

        const status = statuses[currentStatusIndex];
        await client.user.setActivity(status.text, { type: status.type });

        currentStatusIndex = (currentStatusIndex + 1) % statuses.length;
    } catch (error) {
        console.error('Error updating bot status:', error);
    }
}

module.exports = { updateBotStatus };