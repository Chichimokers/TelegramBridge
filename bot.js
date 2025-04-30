const { Client, LocalAuth, WAState } = require('whatsapp-web.js');
const TelegramBot = require('node-telegram-bot-api');
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
const phoneNumbers = '+5358126024'; // Número internacional
const phoneNumber = "Erne";
// Configurar cliente WhatsApp
const whatsappClient = new Client({
  puppeteer: {
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  },
  authStrategy: new LocalAuth({
    clientId: phoneNumber,
    dataPath: path.join(__dirname, `wwebjs_sessions/${phoneNumber}`)
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

// ================= AUTENTICACIÓN POR TELÉFONO =================
whatsappClient.on('state_change', async (state) => {
  console.log('[DEBUG] Estado actual:', WAState[state]);
  if ([WAState.UNPAIRED, WAState.UNPAIRED_IDLE].includes(state)) {
    try {
      const pairingCode = await whatsappClient.requestPairingCode(phoneNumbers);
      console.log(`\n🔢 Código de emparejamiento de 8 dígitos: ${pairingCode}`);
      console.log('Ingresa este código en tu WhatsApp: Menú → Dispositivos vinculados → Vincular dispositivo');
    } catch (error) {
      console.error('Error generando código:', error);
    }
  }
});

whatsappClient.on('authenticated', () => {
  console.log('\n✅ Autenticación exitosa!');
});

// ================= MANEJO DE ERRORES =================
let authAttempts = 0;
whatsappClient.on('auth_failure', (msg) => {
  authAttempts++;
  console.error(`❌ Error de autenticación (Intento ${authAttempts}): ${msg}`);
  if (authAttempts >= 3) process.exit(1);
});

// ================= FUNCIONALIDAD PRINCIPAL =================
whatsappClient.on('ready', () => {
  console.log('\n🟢 WhatsApp conectado!');
  iniciarProgramador();
});

async function verificarYEnviarEstado() {
  try {
    const contact = await whatsappClient.getContactById(targetUser);
    const mensaje = `*Estado de ${contact.pushname}:*
🟢 En línea: ${contact.isOnline ? 'Sí' : 'No'}
⏳ Última conexión: ${contact.lastSeen ? new Date(contact.lastSeen * 1000).toLocaleString() : 'Nunca'}`;

    const grupo = (await whatsappClient.getChats()).find(chat => 
      chat.isGroup && chat.name.toLowerCase() === grupoDestino.toLowerCase()
    );
    
    if (grupo) await grupo.sendMessage(mensaje);
  } catch (error) {
    console.error('Error en verificación:', error);
  }
}

function iniciarProgramador() {
  verificarYEnviarEstado();
  setInterval(verificarYEnviarEstado, intervalo);
  console.log(`⏰ Envíos programados cada ${intervalo/3600000} horas`);
}

// ================= MANEJO DE MENSAJES =================
whatsappClient.on('message', async (msg) => {
  try {
    const contact = await msg.getContact();
    const info = `📩 Mensaje de ${contact.pushname} (${contact.number}):
📝 ${msg.body}`;

    await telegramBot.sendMessage(telegramChatId, info);

    if (msg.hasMedia) {
      const media = await msg.downloadMedia();
      const buffer = Buffer.from(media.data, 'base64');
      await telegramBot.sendDocument(telegramChatId, buffer, { 
        caption: info,
        filename: media.filename || 'archivo'
      });
    }
  } catch (error) {
    console.error('Error procesando mensaje:', error);
  }
});

// ================= INICIO =================
(async () => {
  // Verificar y crear directorio de sesiones
  const sessionPath = path.join(__dirname, `wwebjs_sessions/${phoneNumber}`);
  if (!fs.existsSync(sessionPath)) {
    fs.mkdirSync(sessionPath, { recursive: true });
    fs.chmodSync(sessionPath, 0o777);
  }

  try {
    await whatsappClient.initialize();
    console.log('🚀 Iniciando proceso de autenticación...');
  } catch (error) {
    console.error('Error crítico:', error);
    process.exit(1);
  }
})();