const { Client, LocalAuth, MessageMedia } = require('whatsapp-web.js');
const TelegramBot = require('node-telegram-bot-api');
const qrcode = require('qrcode-terminal');
const axios = require('axios');
const readline = require('readline');

// Configuración
const telegramToken = '6587799120:AAHy5m6vwFo1zX2odV1nBuzuuncgxCzNrk0';
const telegramChatId = '624861458';
const targetUser = '5359057080@c.us';
const grupoDestino = 'Proyecto X';
const intervalo = 5 * 1000;
const phoneNumber = '5358126024'; // Número a autenticar

const telegramBot = new TelegramBot(telegramToken, { polling: true });

// Configurar cliente WhatsApp con autenticación local
const whatsappClient = new Client({
  puppeteer: { headless: true },
  authStrategy: new LocalAuth({
    clientId: phoneNumber // Usar el número como ID para la sesión
  }),
  ffmpegPath: '/usr/bin/ffmpeg' // Asegúrate de tener ffmpeg instalado
});

// Interfaz para leer código de autenticación
const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

// Evento cuando se solicita código de autenticación
whatsappClient.on('auth_code_request', (phone) => {
  console.log(`\nSe ha solicitado código de autenticación para el número: ${phone}`);
  
  rl.question('Por favor ingresa el código de 6 dígitos recibido por WhatsApp: ', (code) => {
    whatsappClient.enterAuthCode(code.trim());
    rl.close();
  });
});

// Evento cuando se solicita código QR (como respaldo)
whatsappClient.on('qr', (qr) => {
  console.log('\nCódigo QR generado (usar como respaldo):');
  qrcode.generate(qr, { small: true });
});

// Resto de tu código permanece igual...
whatsappClient.on('ready', () => {
  console.log('WhatsApp conectado!');
  iniciarProgramador();
});

async function verificarYEnviarEstado() {
  try {
    const contact = await whatsappClient.getContactById(targetUser);
    const { pushname, isOnline, lastSeen } = contact;
    
    const ultimaConexion = lastSeen 
      ? new Date(lastSeen * 1000).toLocaleString() 
      : 'No disponible';

    const mensaje = `*Estado de ${pushname || targetUser}:*
🟢 En línea: ${isOnline ? 'Sí' : 'No'}
⏳ Última conexión: ${ultimaConexion}
📅 Actualizado: ${new Date().toLocaleString()}`;

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

function iniciarProgramador() {
  verificarYEnviarEstado();
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
