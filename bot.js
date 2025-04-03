const fs = require('fs');
const { Client, MessageMedia } = require('whatsapp-web.js');
const TelegramBot = require('node-telegram-bot-api');
const qrcode = require('qrcode-terminal');
const axios = require('axios');

// Archivo para almacenar la sesión de WhatsApp
const SESSION_FILE_PATH = './whatsapp-session.json';
let sessionData;

// Cargar la sesión si existe
if (fs.existsSync(SESSION_FILE_PATH)) {
  sessionData = require(SESSION_FILE_PATH);
}

// Configuración
const telegramToken = '6587799120:AAHy5m6vwFo1zX2odV1nBuzuuncgxCzNrk0';
const telegramChatId = '624861458';
const myWhatsappNumber = '5358126024@c.us'; // Formato correcto: <número>@c.us

// Inicializar bots
const telegramBot = new TelegramBot(telegramToken, { polling: true });
const whatsappClient = new Client({
  puppeteer: { headless: true },
  session: sessionData
});

// Manejo de eventos de WhatsApp

// Si no hay sesión, se genera el QR
whatsappClient.on('qr', qr => {
  qrcode.generate(qr, { small: true });
  console.log('Escanea el código QR para iniciar sesión.');
});

// Al autenticarse, guardar la sesión en un archivo
whatsappClient.on('authenticated', (session) => {
  console.log('WhatsApp autenticado!');
  sessionData = session;
  fs.writeFile(SESSION_FILE_PATH, JSON.stringify(session), (err) => {
    if (err) {
      console.error('Error al guardar la sesión:', err);
    } else {
      console.log('Sesión guardada correctamente en', SESSION_FILE_PATH);
    }
  });
});

whatsappClient.on('ready', () => console.log('WhatsApp conectado!'));

// WhatsApp → Telegram: Enviar archivos y metadatos
whatsappClient.on('message', async (msg) => {
  if (msg.hasMedia) {
    try {
      const media = await msg.downloadMedia();
      if (!media || !media.data) {
        console.error('No se pudo descargar el media.');
        return;
      }
      const buffer = Buffer.from(media.data, 'base64');

      // Calcular tamaño del archivo en KB
      const fileSizeBytes = Buffer.byteLength(buffer);
      const fileSizeKB = (fileSizeBytes / 1024).toFixed(2);

      const contact = await msg.getContact();
      const caption = `📤 De: ${contact.pushname} (${msg.from.split('@')[0]})
📄 Archivo: ${media.filename || 'Sin nombre'}
📝 Tipo: ${media.mimetype}
📏 Tamaño: ${fileSizeKB} KB`;

      if (media.mimetype.startsWith('image/')) {
        await telegramBot.sendPhoto(telegramChatId, buffer, { caption });
      } else if (media.mimetype.startsWith('video/')) {
        await telegramBot.sendVideo(telegramChatId, buffer, { caption });
      } else if (media.mimetype.startsWith('audio/')) {
        await telegramBot.sendAudio(telegramChatId, buffer, { caption });
      } else {
        await telegramBot.sendDocument(telegramChatId, buffer, { caption, filename: media.filename || 'documento' });
      }
    } catch (error) {
      console.error('Error WhatsApp → Telegram:', error);
      telegramBot.sendMessage(telegramChatId, '❌ Error al enviar archivo de WhatsApp a Telegram');
    }
  }
});

// Telegram → WhatsApp: Descargar y enviar archivos
telegramBot.on('message', async (msg) => {
  try {

    if (msg.photo || msg.document || msg.video || msg.audio) {
      let fileId, fileName, mimeType;
      
      if (msg.photo) {
        fileId = msg.photo[msg.photo.length - 1].file_id;
        fileName = `photo_${Date.now()}.jpg`;
        mimeType = 'image/jpeg';
      } else if (msg.document) {
        fileId = msg.document.file_id;
        fileName = msg.document.file_name;
        mimeType = msg.document.mime_type;
      } else if (msg.video) {
        fileId = msg.video.file_id;
        fileName = `video_${Date.now()}.mp4`;
        mimeType = 'video/mp4';
      } else if (msg.audio) {
        fileId = msg.audio.file_id;
        fileName = `audio_${Date.now()}.mp3`;
        mimeType = msg.audio.mime_type || 'audio/mpeg';
      }

      // Descargar archivo de Telegram
      const fileLink = await telegramBot.getFileLink(fileId);
      const response = await axios.get(fileLink, { responseType: 'arraybuffer' });
      const base64Data = Buffer.from(response.data).toString('base64');

      // Crear objeto MessageMedia según la documentación
      const media = new MessageMedia(mimeType, base64Data, fileName);

      // Enviar a WhatsApp
      await whatsappClient.sendMessage(myWhatsappNumber, media);
      telegramBot.sendMessage(telegramChatId, `✅ Archivo enviado a WhatsApp: ${fileName}`);
    }
  } catch (error) {
    console.error('Error Telegram → WhatsApp:', error);
    telegramBot.sendMessage(telegramChatId, '❌ Error al enviar el archivo a WhatsApp');
  }
});

// Manejo de desconexiones y reconexiones en WhatsApp
whatsappClient.on('disconnected', () => {
  console.log('WhatsApp desconectado, reiniciando...');
  whatsappClient.initialize();
});

whatsappClient.initialize();
