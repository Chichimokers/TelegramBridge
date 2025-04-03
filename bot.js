const { Client, MessageMedia } = require('whatsapp-web.js');
const TelegramBot = require('node-telegram-bot-api');
const qrcode = require('qrcode-terminal');

// Configura el bot de Telegram
const telegramToken = '6587799120:AAHy5m6vwFo1zX2odV1nBuzuuncgxCzNrk0';
const telegramChatId = '624861458';
const telegramBot = new TelegramBot(telegramToken, { polling: true });

// Configura el cliente de WhatsApp
const whatsappClient = new Client({
  puppeteer: { headless: true },
});

// Genera QR para vincular WhatsApp
whatsappClient.on('qr', (qr) => qrcode.generate(qr, { small: true }));

// Cuando WhatsApp esté listo
whatsappClient.on('ready', () => {
  console.log('WhatsApp conectado!');
});

// Escucha mensajes entrantes
whatsappClient.on('message', async (msg) => {
  if (msg.hasMedia) {
    try {
      const media = await msg.downloadMedia();
      const buffer = Buffer.from(media.data, 'base64');
      
      // Obtener información del remitente
      const senderNumber = msg.from.split('@')[0]; // Extrae el número de teléfono
      const contact = await msg.getContact();
      const senderName = contact.pushname || contact.name || 'Usuario desconocido'; // Nombre del contacto
      
      // Crear caption con la información
      const caption = `📤 Enviado por: ${senderName} (${senderNumber})\n📄 Archivo: ${media.filename}`;

      // Envía a Telegram según el tipo de archivo
      if (media.mimetype.startsWith('image/')) {
        await telegramBot.sendPhoto(telegramChatId, buffer, { caption: caption });
      } else if (media.mimetype.startsWith('video/')) {
        await telegramBot.sendVideo(telegramChatId, buffer, { caption: caption });
      } else {
        await telegramBot.sendDocument(telegramChatId, buffer, {
          caption: caption,
          filename: media.filename
        });
      }

      console.log('Archivo enviado a Telegram');
    } catch (error) {
      console.error('Error:', error);
    }
  }
});

whatsappClient.initialize();