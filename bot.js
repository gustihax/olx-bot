const { ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js')
const axios = require('axios')
const cheerio = require('cheerio')

const searchResults = new Map()
const ITEMS_PER_PAGE = 5

async function handleCommand(interaction) {
	if (!interaction.isRepliable()) return

	const query = interaction.options.getString('query')
	try {
		await interaction.deferReply()
		const results = await searchOLX(query)

		if (results.length === 0) {
			const message = await interaction.editReply({
				content: 'Нічого не знайдено.',
				components: [],
			})
			setTimeout(() => message.delete().catch(() => {}), 3 * 60 * 60 * 1000)
			return
		}

		searchResults.set(interaction.user.id, {
			items: results,
			currentPage: 0,
			query: query,
		})

		await sendSearchResults(interaction, results, 0)
	} catch (error) {
		console.error('Search error:', error)
		if (interaction.isRepliable()) {
			const message = await interaction.editReply(
				'Сталася помилка при пошуку. Спробуйте ще раз.'
			)
			setTimeout(() => message.delete().catch(() => {}), 3 * 60 * 60 * 1000)
		}
	}
}

async function handleButton(interaction) {
	if (!interaction.isRepliable()) return

	const [action, userId] = interaction.customId.split('_')
	if (userId !== interaction.user.id) return

	try {
		await interaction.deferUpdate()
		const userData = searchResults.get(userId)
		if (!userData) return

		let newPage = userData.currentPage
		if (action === 'next') newPage++
		if (action === 'prev') newPage--

		userData.currentPage = newPage
		await sendSearchResults(interaction, userData.items, newPage, true)
	} catch (error) {
		console.error('Button error:', error)
	}
}

async function searchOLX(query) {
	const url = `https://www.olx.ua/d/uk/list/q-${encodeURIComponent(query)}/`
	const response = await axios.get(url)
	const $ = cheerio.load(response.data)

	const results = []
	$('div[data-cy="l-card"]').each((i, element) => {
		const title = $(element).find('h6').text().trim()
		const price = $(element).find('[data-testid="ad-price"]').text().trim()
		const link = $(element).find('a').attr('href')
		const image = $(element).find('img').attr('src')

		results.push({
			title,
			price,
			link: `https://www.olx.ua${link}`,
			image,
		})
	})

	return results
}

async function sendSearchResults(interaction, results, page, isUpdate = false) {
	if (!interaction.isRepliable()) return

	const startIdx = page * ITEMS_PER_PAGE
	const endIdx = startIdx + ITEMS_PER_PAGE
	const pageResults = results.slice(startIdx, endIdx)

	const userData = searchResults.get(interaction.user.id)
	const query =
		userData?.query ||
		interaction.options?.getString('query') ||
		'Пошуковий запит'

	const embed = {
		color: 0x0099ff,
		title: `Результати пошуку на OLX: "${query}"`,
		fields: pageResults.map(item => ({
			name: item.title,
			value: `💰 ${item.price}\n🔗 [Посилання](${item.link})`,
		})),
		footer: {
			text: `Сторінка ${page + 1}/${Math.ceil(
				results.length / ITEMS_PER_PAGE
			)}`,
		},
	}

	const row = new ActionRowBuilder().addComponents(
		new ButtonBuilder()
			.setCustomId(`prev_${interaction.user.id}`)
			.setLabel('◀️ Назад')
			.setStyle(ButtonStyle.Primary)
			.setDisabled(page === 0),
		new ButtonBuilder()
			.setCustomId(`next_${interaction.user.id}`)
			.setLabel('Вперед ▶️')
			.setStyle(ButtonStyle.Primary)
			.setDisabled(endIdx >= results.length)
	)

	const message = isUpdate
		? await interaction.update({
				embeds: [embed],
				components: [row],
				fetchReply: true,
		  })
		: await interaction.editReply({
				embeds: [embed],
				components: [row],
				fetchReply: true,
		  })

	setTimeout(() => message.delete().catch(() => {}), 3 * 60 * 60 * 1000)
}

module.exports = {
	handleCommand,
	handleButton,
}
