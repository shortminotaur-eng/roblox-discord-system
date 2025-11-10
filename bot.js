// bot.js
const { Client, GatewayIntentBits, REST, Routes, SlashCommandBuilder } = require('discord.js');
const fetch = require('node-fetch');

const TOKEN = process.env.DISCORD_TOKEN || 'YOUR_DISCORD_BOT_TOKEN_HERE';
const SERVER_URL = process.env.SERVER_URL || 'https://example.com';

const client = new Client({ intents: [GatewayIntentBits.Guilds] });

client.once('ready', () => {
  console.log(`✅ Logged in as ${client.user.tag}`);
});

// /balance command
const commands = [
  new SlashCommandBuilder()
    .setName('balance')
    .setDescription('Check your Roblox balance linked to your Discord account')
];

const rest = new REST({ version: '10' }).setToken(TOKEN);

(async () => {
  try {
    console.log('🔁 Registering slash command...');
    await rest.put(
      Routes.applicationCommands('YOUR_CLIENT_ID'),
      { body: commands.map(c => c.toJSON()) }
    );
    console.log('✅ Command registered!');
  } catch (error) {
    console.error('Command registration failed:', error);
  }
})();

client.on('interactionCreate', async interaction => {
  if (!interaction.isChatInputCommand()) return;
  if (interaction.commandName === 'balance') {
    const user = interaction.user.username;
    try {
      const res = await fetch(`${SERVER_URL}/api/balance/${encodeURIComponent(user)}`);
      const data = await res.json();
      await interaction.reply(`💰 ${user}, your balance is **${data.balance}** Robux credits.`);
    } catch (err) {
      await interaction.reply('⚠️ Error fetching balance.');
    }
  }
});

client.login(TOKEN);
