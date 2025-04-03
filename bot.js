const { Client, MessageMedia } = require('whatsapp-web.js'); 
const TelegramBot = require('node-telegram-bot-api');
const qrcode = require('qrcode-terminal');
const axios = require('axios'); // Para enviar el SMS

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

// Función para enviar SMS utilizando Textbelt
async function sendSMS(destino, mensaje) {
  try {
    const response = await axios.post('https://textbelt.com/text', {
      phone: destino,
      message: mensaje,
      key: 'textbelt' // Clave gratuita (limitada a un mensaje por día)
    });
    console.log('Respuesta SMS:', response.data);
  } catch (error) {
    console.error('Error enviando SMS:', error);
  }
}

// Escucha mensajes entrantes
whatsappClient.on('message', async (msg) => {
  try {
    // Si el mensaje proviene de un grupo, el remitente real puede estar en msg.author
    const contact = await msg.getContact();
    const senderId = contact.id._serialized;
    const senderNumber = contact.number || senderId.split('@')[0];
    const senderName = contact.pushname || contact.name || 'Usuario desconocido';
    const profilePicUrl = await contact.getProfilePicUrl();
    const isBusiness = contact.isBusiness;
    const isMyContact = contact.isMyContact;
    
    // Construir información del remitente
    const info = `📤 Enviado por: ${senderName} (${senderNumber})
ID: ${senderId}
¿Es contacto? ${isMyContact ? 'Sí' : 'No'}
¿Es cuenta de negocio? ${isBusiness ? 'Sí' : 'No'}
Foto de perfil: ${profilePicUrl || 'No disponible'}`;
    
    console.log(info);
    
    // Nueva funcionalidad: si el mensaje es de un contacto específico, enviar SMS
    if (senderNumber === '54873139') {
      await sendSMS('58126024', 'tienes notificacion de yunikua');
    }
    
    // Procesa medios (imágenes, videos, documentos) si están presentes
    if (msg.hasMedia) {
      const media = await msg.downloadMedia();
      const buffer = Buffer.from(media.data, 'base64');
      
      let caption = info;
      if (media.filename) {
        caption += `\n📄 Archivo: ${media.filename}`;
      }
      
      if (media.mimetype.startsWith('image/')) {
        await telegramBot.sendPhoto(telegramChatId, buffer, { caption });
      } else if (media.mimetype.startsWith('video/')) {
        await telegramBot.sendVideo(telegramChatId, buffer, { caption });
      } else {
        await telegramBot.sendDocument(telegramChatId, buffer, { caption, filename: media.filename });
      }
      
      console.log('Archivo enviado a Telegram');
    }
  } catch (error) {
    console.error('Error:', error);
  }
});

whatsappClient.initialize();
