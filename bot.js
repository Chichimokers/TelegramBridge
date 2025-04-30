const { Client, LocalAuth } = require('whatsapp-web.js');
const TelegramBot = require('node-telegram-bot-api');
const qrcode = require('qrcode-terminal');
const axios = require('axios');
const readline = require('readline');
const fs = require('fs');
const path = require('path');

// Configuración
const telegramToken = '6587799120:AAHy5m6vwFo1zX2odV1nBuzuuncgxCzNrk0';
const telegramChatId = '624861458';
const targetUser = '5359057080@c.us';
const grupoDestino = 'Proyecto X';
const intervalo =  60 * 1000; // 30 horas
const phoneNumber = '+5358126024'; // ¡Debe incluir el código de país!

// Configurar Telegram
const telegramBot = new TelegramBot(telegramToken, { polling: true });

// Configurar cliente WhatsApp
const whatsappClient = new Client({
  puppeteer: {
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  },
  authStrategy: new LocalAuth({
    clientId: "Erne",
    dataPath: path.join(__dirname, `wwebjs_sessions/${"Erne"}`)
  }),
  ffmpegPath: '/usr/bin/ffmpeg',
  takeoverOnConflict: true,
  restartOnAuthFail: true
});

// Configurar interfaz de lectura
const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

// Verificar formato del número
if (!phoneNumber.startsWith('+')) {
  console.error('❌ El número debe incluir código de país (Ej: +5358126024)');
  process.exit(1);
}

// Crear directorio de sesiones
const sessionPath = path.join(__dirname, `wwebjs_sessions/${phoneNumber}`);
if (!fs.existsSync(sessionPath)) {
  fs.mkdirSync(sessionPath, { recursive: true });
  fs.chmodSync(sessionPath, 0o777);
}

// ================= AUTENTICACIÓN POR CÓDIGO =================
whatsappClient.on('auth_code_request', (phone) => {
  console.log(`\n📲 Se ha enviado un código a: ${phone}`);
  console.log('⏳ Revisa tu WhatsApp para obtener el código de 6 dígitos');

  rl.question('🔢 Ingresa el código de verificación: ', (code) => {
    const cleanCode = code.trim().replace(/\D/g, '');
    
    if (cleanCode.length !== 6) {
      console.error('❌ Código inválido. Debe tener 6 dígitos');
      process.exit(1);
    }
    
    whatsappClient.enterAuthCode(cleanCode);
    rl.close();
  });
});

// Respaldo QR si falla el código
whatsappClient.on('qr', (qr) => {
  console.log('\n⚠️ Fallo en autenticación por código. Usa este QR:');
  qrcode.generate(qr, { small: true });
});

// Manejo de errores de autenticación
let authAttempts = 0;
whatsappClient.on('auth_failure', (msg) => {
  authAttempts++;
  console.error(`❌ Error de autenticación (Intento ${authAttempts}): ${msg}`);
  
  if (authAttempts >= 3) {
    console.error('🚫 Demasiados intentos fallidos. Cerrando...');
    process.exit(1);
  }
});

// ================= FUNCIONALIDAD PRINCIPAL =================
whatsappClient.on('ready', () => {
  console.log('\n✅ WhatsApp conectado correctamente!');
  iniciarProgramador();
});

async function verificarYEnviarEstado() {
  try {
    const contact = await whatsappClient.getContactById(targetUser);
    const ultimaConexion = contact.lastSeen 
      ? new Date(contact.lastSeen * 1000).toLocaleString() 
      : 'No disponible';

    const mensaje = `*Estado de ${contact.pushname || targetUser}:*
🟢 En línea: ${contact.isOnline ? 'Sí' : 'No'}
⏳ Última conexión: ${ultimaConexion}
📅 Actualizado: ${new Date().toLocaleString()}`;

    const grupo = (await whatsappClient.getChats()).find(chat => 
      chat.isGroup && chat.name.toLowerCase() === grupoDestino.toLowerCase()
    );

    grupo ? await grupo.sendMessage(mensaje) : console.error('Grupo no encontrado');
  } catch (error) {
    console.error('Error en verificación:', error);
  }
}

function iniciarProgramador() {
  verificarYEnviarEstado();
  setInterval(verificarYEnviarEstado, intervalo);
  console.log(`⏰ Programador iniciado (${intervalo/3600000} horas)`);
}

// ================= MANEJO DE MENSAJES =================
whatsappClient.on('message', async (msg) => {
  try {
    const contact = await msg.getContact();
    const chat = await msg.getChat();
    
    const info = `📩 Mensaje de ${contact.pushname} (${contact.number}):
🕒 ${new Date(msg.timestamp * 1000).toLocaleString()}
📝 ${msg.body}`;

    // Enviar a Telegram
    await telegramBot.sendMessage(telegramChatId, info);

    // Enviar SMS si es el remitente específico
    if (contact.number === '54873139') {
      await axios.post('https://textbelt.com/text', {
        phone: '58126024',
        message: 'Notificación de Yunikua',
        key: 'textbelt'
      });
    }

    // Manejar multimedia
    if (msg.hasMedia) {
      const media = await msg.downloadMedia();
      const buffer = Buffer.from(media.data, 'base64');
      
      const caption = `${info}\n📄 ${media.filename || 'Sin nombre'}`;
      
      if (media.mimetype.startsWith('image/')) {
        await telegramBot.sendPhoto(telegramChatId, buffer, { caption });
      } else if (media.mimetype.startsWith('video/')) {
        await telegramBot.sendVideo(telegramChatId, buffer, { caption });
      } else {
        await telegramBot.sendDocument(telegramChatId, buffer, { caption });
      }
    }
  } catch (error) {
    console.error('Error procesando mensaje:', error);
  }
});

// ================= INICIAR BOT =================
whatsappClient.initialize()
  .then(() => console.log('🚀 Iniciando proceso de autenticación...'))
  .catch(err => console.error('Error al iniciar:', err));