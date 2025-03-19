const { Client, GatewayIntentBits, Partials, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const mongoose = require('mongoose');
const Creative = require('./models/creative');
require('dotenv').config();

// Подключение к MongoDB
mongoose.connect(process.env.MONGO_URI, { useNewUrlParser: true, useUnifiedTopology: true });

// Инициализация клиента Discord
const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
    GatewayIntentBits.GuildMessageReactions
  ],
  partials: [Partials.Message, Partials.Channel, Partials.GuildMember]
});

// Временное хранилище для групп фотографий
// { mediaGroupId: { photos: [], description: '', buyerId: '', processed: false } }
const mediaGroups = {};

// Обработка готовности бота
client.once('ready', () => {
  console.log(`Бот ${client.user.tag} готов к работе!`);
});

// Обработка сообщений
client.on('messageCreate', async (message) => {
  // Игнорируем сообщения от ботов
  if (message.author.bot) return;

  // Проверяем, что сообщение в канале для баеров
  if (message.channelId !== process.env.BUYERS_CHANNEL_ID) return;

  try {
    // Проверяем наличие вложений
    if (message.attachments.size === 0) return;

    const description = message.content || 'Без описания';
    const attachments = Array.from(message.attachments.values());
    const images = attachments.filter(att => att.contentType?.startsWith('image/'));

    if (images.length === 0) return;

    // Создаем креатив
    const creative = new Creative({
      buyerId: message.author.id,
      buyerName: message.author.tag,
      teamLeadId: process.env.TEAMLEAD_CHANNEL_ID,
      images: images.map(img => img.url),
      description: description,
      messageId: message.id
    });

    await creative.save();

    // Создаем кнопки
    const row = new ActionRowBuilder()
      .addComponents(
        new ButtonBuilder()
          .setCustomId(`approve_${creative._id}`)
          .setLabel('Апрув')
          .setStyle(ButtonStyle.Success),
        new ButtonBuilder()
          .setCustomId(`reject_${creative._id}`)
          .setLabel('Отклонить')
          .setStyle(ButtonStyle.Danger)
      );

    // Отправляем все изображения в одном сообщении
    const teamLeadChannel = await client.channels.fetch(process.env.TEAMLEAD_CHANNEL_ID);
    
    // Создаем массив файлов для отправки
    const files = images.map(img => ({
      attachment: img.url,
      name: `image-${Date.now()}-${Math.random().toString(36).substring(7)}.png`
    }));

    // Отправляем сообщение с описанием, кнопками и всеми изображениями
    await teamLeadChannel.send({
      content: `**Новый креатив от <@${message.author.id}>**\n${description}`,
      components: [row],
      files: files
    });

    // Отправляем подтверждение в канал баеров
    await message.reply('Креатив отправлен на рассмотрение тимлиду.');

  } catch (error) {
    console.error('Ошибка при обработке креатива:', error);
    await message.reply('Произошла ошибка при обработке креатива. Пожалуйста, попробуйте снова.');
  }
});

// Обработка нажатий на кнопки
client.on('interactionCreate', async (interaction) => {
  if (!interaction.isButton()) return;

  const [action, creativeId] = interaction.customId.split('_');

  try {
    const creative = await Creative.findById(creativeId);
    if (!creative) {
      await interaction.reply({ content: 'Креатив не найден', ephemeral: true });
      return;
    }

    const buyerChannel = await client.channels.fetch(process.env.BUYERS_CHANNEL_ID);
    const originalMessage = await buyerChannel.messages.fetch(creative.messageId);

    if (action === 'approve') {
      creative.status = 'approved';
      await creative.save();

      // Отправляем ответ в канал баеров
      await originalMessage.reply({ 
        content: `<@${creative.buyerId}>, **ваш креатив одобрен! ✅**\n${creative.description}` 
      });
      // Ответ виден всем в канале тимлида
      await interaction.reply({ content: `Креатив от <@${creative.buyerId}> одобрен ✅` });

    } else if (action === 'reject') {
      creative.status = 'rejected';
      await creative.save();

      // Отправляем ответ в канал баеров
      await originalMessage.reply({ 
        content: `<@${creative.buyerId}>, **ваш креатив отклонен! ❌**\n${creative.description}` 
      });
      // Ответ виден всем в канале тимлида
      await interaction.reply({ content: `Креатив от <@${creative.buyerId}> отклонен ❌` });
    }

  } catch (error) {
    console.error('Ошибка при обработке решения:', error);
    await interaction.reply({ content: 'Произошла ошибка', ephemeral: true });
  }
});

// Обработка ошибок
client.on('error', error => {
  console.error('Ошибка Discord клиента:', error);
});

// Запуск бота
client.login(process.env.DISCORD_TOKEN);