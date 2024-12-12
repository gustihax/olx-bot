require('dotenv').config()
const { Client, GatewayIntentBits } = require('discord.js')
const { handleCommand, handleButton } = require('./bot.js')

const client = new Client({
	intents: [
		GatewayIntentBits.Guilds,
		GatewayIntentBits.GuildMessages,
		GatewayIntentBits.MessageContent,
	],
})

client.once('ready', () => {
	console.log('Bot is ready!')

	// Реєструємо slash-команду
	client.application.commands.create({
		name: 'search',
		description: 'Пошук оголошень на OLX',
		options: [
			{
				name: 'query',
				description: 'Що шукаємо?',
				type: 3,
				required: true,
			},
		],
	})
})

client.on('interactionCreate', async interaction => {
	if (!interaction.isCommand() && !interaction.isButton()) return

	if (interaction.isCommand() && interaction.commandName === 'search') {
		await handleCommand(interaction)
	}

	if (interaction.isButton()) {
		await handleButton(interaction)
	}
})

client.login(process.env.DISCORD_TOKEN)
