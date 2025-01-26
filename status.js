module.exports = (client) => {
  const statuses = [
    'Hallo',
    'Bonjour',
    'Привет',
    'Welcome to LinguaLounge',
    "I'm Frau Lingua",
    'Type !help',
    'Type !quiz',
    'Monitoring You',
  ];

  let i = 0;

  setInterval(() => {
    if (i >= statuses.length) i = 0;
    const status = statuses[i];

    client.user.setPresence({
      activities: [{ name: status, type: 'PLAYING' }], // Example activity type
      status: 'online',
    });

    i++;
  }, 5000); // Change status every 5 seconds
};