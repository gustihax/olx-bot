const { ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js')
const axios = require('axios')
const cheerio = require('cheerio')

const searchResults = new Map()
const ITEMS_PER_PAGE = 5

async function handleCommand(interaction) {
	const query = interaction.options.getString('query')
	try {
		const results = await searchOLX(query)
		searchResults.set(interaction.user.id, {
			items: results,
			currentPage: 0,
		})

		await sendSearchResults(interaction, results, 0)
	} catch (error) {
		await interaction.reply('Сталася помилка при пошуку. Спробуйте ще раз.')
	}
}

async function handleButton(interaction) {
	const [action, userId] = interaction.customId.split('_')
	if (userId !== interaction.user.id) return

	const userData = searchResults.get(userId)
	if (!userData) return

	let newPage = userData.currentPage
	if (action === 'next') newPage++
	if (action === 'prev') newPage--

	userData.currentPage = newPage
	await sendSearchResults(interaction, userData.items, newPage, true)
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
	const startIdx = page * ITEMS_PER_PAGE
	const endIdx = startIdx + ITEMS_PER_PAGE
	const pageResults = results.slice(startIdx, endIdx)

	if (pageResults.length === 0) {
		const reply = await interaction.reply({
			content: 'Нічого не знайдено.',
			ephemeral: false,
		})
		setTimeout(() => {
			if (reply && !reply.deleted) {
				reply.delete().catch(console.error)
			}
		}, 3 * 60 * 60 * 1000)
		return
	}

	const embed = {
		color: 0x0099ff,
		title: 'Результати пошуку на OLX',
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

	if (isUpdate) {
		await interaction.update({ embeds: [embed], components: [row] })
	} else {
		const reply = await interaction.reply({
			embeds: [embed],
			components: [row],
			fetchReply: true,
		})

		setTimeout(() => {
			if (reply && !reply.deleted) {
				reply.delete().catch(console.error)
			}
		}, 3 * 60 * 60 * 1000)
	}
}

module.exports = {
	handleCommand,
	handleButton,
}