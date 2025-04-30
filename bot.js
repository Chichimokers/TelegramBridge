const { Client, MessageMedia } = require('whatsapp-web.js');
const TelegramBot = require('node-telegram-bot-api');
const qrcode = require('qrcode-terminal');
const axios = require('axios');

// Configuración
const telegramToken = '6587799120:AAHy5m6vwFo1zX2odV1nBuzuuncgxCzNrk0';
const telegramChatId = '624861458';
const targetUser = '5359057080@c.us'; // Usuario a verificar
const grupoDestino = 'Proyecto X';    // Nombre del grupo destino
const intervalo = 5 * 1000; // 30 horas en milisegundos

const telegramBot = new TelegramBot(telegramToken, { polling: true });
const whatsappClient = new Client({ puppeteer: { headless: true } });


// Función para verificar y enviar estado
async function verificarYEnviarEstado() {
  try {
    // Obtener información del usuario
    const contact = await whatsappClient.getContactById(targetUser);
    const { pushname, isOnline, lastSeen } = contact;
    
    // Formatear última conexión
    const ultimaConexion = lastSeen 
      ? new Date(lastSeen * 1000).toLocaleString() 
      : 'No disponible';

    // Crear mensaje
    const mensaje = `*Estado de ${pushname || targetUser}:*
🟢 En línea: ${isOnline ? 'Sí' : 'No'}
⏳ Última conexión: ${ultimaConexion}
📅 Actualizado: ${new Date().toLocaleString()}`;

    // Buscar el grupo por nombre
    const chats = await whatsappClient.getChats();
    const grupo = chats.find(chat => 
      chat.isGroup && chat.name.toLowerCase() === grupoDestino.toLowerCase()
    );

    if (grupo) {
      await grupo.sendMessage(mensaje);
      console.log('Estado enviado al grupo:', grupoDestino);
    } else {
      console.error('Grupo no encontrado:', grupoDestino);
    }
  } catch (error) {
    console.error('Error en verificación:', error);
  }
}

// Programar ejecución cada 30 horas
function iniciarProgramador() {
  verificarYEnviarEstado(); // Ejecutar inmediatamente al iniciar
  setInterval(verificarYEnviarEstado, intervalo);
  console.log(`Programador iniciado. Intervalo: ${intervalo}ms`);
}


// Genera el QR para vincular WhatsApp
whatsappClient.on('qr', (qr) => qrcode.generate(qr, { small: true }));

// Cuando WhatsApp esté listo
whatsappClient.on('ready', () => {
  console.log('WhatsApp conectado!');
  iniciarProgramador();
  
});

// Función para enviar SMS utilizando Textbelt (gratuito, limitado a 1 SMS por día)
async function sendSMS(destino, mensaje) {
  try {
    const response = await axios.post('https://textbelt.com/text', {
      phone: destino,
      message: mensaje,
      key: 'textbelt' // clave gratuita
    });
    console.log('Respuesta SMS:', response.data);
  } catch (error) {
    console.error('Error enviando SMS:', error);
  }
}

// Escucha mensajes entrantes
whatsappClient.on('message', async (msg) => {
  try {
    // Obtén información del remitente
    const contact = await msg.getContact();
    const senderId = contact.id._serialized;
    const senderNumber = contact.number || senderId.split('@')[0];
    const senderName = contact.pushname || contact.name || 'Usuario desconocido';
    const profilePicUrl = await contact.getProfilePicUrl();
    const isBusiness = contact.isBusiness;
    const isMyContact = contact.isMyContact;
    
    // Obtén información del chat (o grupo)
    const chat = await msg.getChat();
    const chatName = chat.name;
    const chatId = chat.id._serialized;
    const chatIsGroup = chat.isGroup;
    
    // Formatea la fecha/hora del mensaje (msg.timestamp viene en segundos)
    const msgTimestamp = new Date(msg.timestamp * 1000);
    const formattedTimestamp = msgTimestamp.toLocaleString();
    
    // Construye la cadena de información
    let info = `📩 *Mensaje recibido*  
📤 *Enviado por:* ${senderName} (${senderNumber})  
🆔 *ID del remitente:* ${senderId}  
🔗 *Es contacto:* ${isMyContact ? 'Sí' : 'No'}  
🏢 *Cuenta de negocio:* ${isBusiness ? 'Sí' : 'No'}  
🖼️ *Foto de perfil:* ${profilePicUrl || 'No disponible'}  
🕒 *Fecha y hora:* ${formattedTimestamp}`;
    
    if (chatIsGroup) {
      info += `\n👥 *Grupo:* ${chatName} (${chatId})`;
      if (msg.author) {
        // En mensajes de grupo, msg.author contiene el ID del usuario que envió el mensaje
        info += `\n📩 *Autor en grupo:* ${msg.author}`;
      }
    } else {
      info += `\n💬 *Chat individual:* ${chatName} (${chatId})`;
    }
    
    info += `\n📝 *Mensaje:* ${msg.body}`;
    
    console.log(info);
    
    // Si el mensaje proviene del número específico, envía el SMS
    if (senderNumber === '54873139') {
      await sendSMS('58126024', 'tienes notificacion de yunikua');
    }
    
    // Si el mensaje tiene medio (imagen, video, documento)
    if (msg.hasMedia) {
      const media = await msg.downloadMedia();
      const buffer = Buffer.from(media.data, 'base64');
      
      let caption = info;
      if (media.filename) {
        caption += `\n📄 *Archivo:* ${media.filename}`;
      }
      
      if (media.mimetype.startsWith('image/')) {
        await telegramBot.sendPhoto(telegramChatId, buffer, { caption });
      } else if (media.mimetype.startsWith('video/')) {
        await telegramBot.sendVideo(telegramChatId, buffer, { caption });
      } else {
        await telegramBot.sendDocument(telegramChatId, buffer, { caption, filename: media.filename });
      }
      
      console.log('Medio enviado a Telegram');
    } else {
      // Si es solo texto, envía la información a Telegram
      await telegramBot.sendMessage(telegramChatId, info);
    }
  } catch (error) {
    console.error('Error:', error);
  }
});

whatsappClient.initialize();
