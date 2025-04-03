
const { Client, MessageMedia } = require('whatsapp-web.js');
const TelegramBot = require('node-telegram-bot-api');
const qrcode = require('qrcode-terminal');
const axios = require('axios');

// Configuración
const telegramToken = '6587799120:AAHy5m6vwFo1zX2odV1nBuzuuncgxCzNrk0';
const telegramChatId = '624861458';
const myWhatsappNumber = '5358126024@'; // Tu número en formato internacional sin '+' 

// Inicializar bots
const telegramBot = new TelegramBot(telegramToken, { polling: true });
const whatsappClient = new Client({ puppeteer: { headless: true } });

// Conexión WhatsApp
whatsappClient.on('qr', qr => qrcode.generate(qr, { small: true }));
whatsappClient.on('ready', () => console.log('WhatsApp conectado!'));

// WhatsApp → Telegram
whatsappClient.on('message', async (msg) => {
  if (msg.hasMedia) {
    try {
      const media = await msg.downloadMedia();
      const buffer = Buffer.from(media.data, 'base64');
      
      const contact = await msg.getContact();
      const caption = `📤 De: ${contact.pushname} (${msg.from.split('@')[0]})\n📄 Archivo: ${media.filename}`;

      if (media.mimetype.startsWith('image/')) {
        await telegramBot.sendPhoto(telegramChatId, buffer, { caption });
      } else if (media.mimetype.startsWith('video/')) {
        await telegramBot.sendVideo(telegramChatId, buffer, { caption });
      } else {
        await telegramBot.sendDocument(telegramChatId, buffer, { caption, filename: media.filename });
      }
    } catch (error) {
      console.error('Error WhatsApp → Telegram:', error);
    }
  }
});

// Telegram → WhatsApp
telegramBot.on('message', async (msg) => {
  try {
    if (msg.photo || msg.document || msg.video) {
      let fileId, fileName;
      
      if (msg.photo) {
        fileId = msg.photo[msg.photo.length - 1].file_id;
        fileName = `photo_${Date.now()}.jpg`;
      } else if (msg.document) {
        fileId = msg.document.file_id;
        fileName = msg.document.file_name;
      } else if (msg.video) {
        fileId = msg.video.file_id;
        fileName = `video_${Date.now()}.mp4`;
      }

      // Descargar archivo de Telegram
      const fileLink = await telegramBot.getFileLink(fileId);
      const response = await axios.get(fileLink, { responseType: 'arraybuffer' });
      const media = new MessageMedia(
        msg.document?.mime_type || 'image/jpeg',
        Buffer.from(response.data).toString('base64'),
        fileName
      );

      // Enviar a WhatsApp
      await whatsappClient.sendMessage(myWhatsappNumber, media);
      telegramBot.sendMessage(telegramChatId, '✅ Archivo enviado a WhatsApp');
    }
  } catch (error) {
    console.error('Error Telegram → WhatsApp:', error);
    telegramBot.sendMessage(telegramChatId, '❌ Error al enviar el archivo');
  }
});

whatsappClient.initialize();