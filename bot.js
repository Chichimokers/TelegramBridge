const phoneNumbers = '5358126024'; // Número internacional
const phoneNumber = "Erne";
const { Client, LocalAuth } = require('whatsapp-web.js');
const TelegramBot = require('node-telegram-bot-api');
const axios = require('axios');
const readline = require('readline');
const fs = require('fs');
const path = require('path');
const { Boom } = require('@hapi/boom');
const lastime = "";
// Configuración
const telegramToken = '6587799120:AAHy5m6vwFo1zX2odV1nBuzuuncgxCzNrk0';
const telegramChatId = '624861458';
const targetUser = '5359057080@c.us';
const grupoDestino = 'Proyecto X';
const intervalo = 30 * 1000; // 30 horas
let ultimoEstado = null;
let ultimaConexionRegistrada = null;

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
    const pairingCode = await whatsappClient.requestPairingCode(phoneNumbers);
    console.log(`\n✅ CÓDIGO DE 8 DÍGITOS: ${pairingCode}`);
    console.log('📱 Ingresar en WhatsApp: Configuración → Dispositivos vinculados → Vincular dispositivo');
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

whatsappClient.on('auth_failure', () => {
  console.log('⚠️ Autenticación fallida. Forzando nueva autenticación...');
  forceWhatsAppAuth();
});


async function verificarYEnviarEstado() {
  try {
    const contact = await whatsappClient.getContactById(targetUser);
    const estaEnLinea = contact.isOnline;
    const ultimaConexion = contact.lastSeen 
      ? new Date(contact.lastSeen * 1000).toLocaleString() 
      : 'No disponible';

    // Determinar si hay cambios relevantes
    const cambioEstado = estaEnLinea !== ultimoEstado;
    const cambioConexion = ultimaConexion !== ultimaConexionRegistrada;

    // Solo actuar si hay cambios
    if (cambioEstado || cambioConexion) {
      let mensajeEstado = '';
      
      if (cambioEstado) {
        mensajeEstado = estaEnLinea 
          ? `🟢 *${contact.pushname} está CONECTADO*`
          : `🔴 *${contact.pushname} se DESCONECTÓ*`;
      }

      const mensajeConexion = `⏳ Última vez: ${ultimaConexion}`;
      const mensajeCompleto = `${mensajeEstado}\n${mensajeConexion}\n📅 Actualizado: ${new Date().toLocaleString()}`;

      const grupo = (await whatsappClient.getChats()).find(chat => 
        chat.isGroup && chat.name.toLowerCase() === grupoDestino.toLowerCase()
      );

      if (grupo) {
        await grupo.sendMessage(mensajeCompleto);
        console.log('✅ Estado actualizado enviado al grupo');
        
        // Actualizar registros
        ultimoEstado = estaEnLinea;
        ultimaConexionRegistrada = ultimaConexion;
      }
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



// ================= INICIALIZACIÓN =================
(async () => {
  try {
    const sessionDir = path.join(__dirname, `wwebjs_sessions/${phoneNumber}`);
    if (!fs.existsSync(sessionDir)) {
      fs.mkdirSync(sessionDir, { recursive: true });
      fs.chmodSync(sessionDir, 0o777);
    }

    await whatsappClient.initialize();
    console.log('🚀 Núcleo de WhatsApp inicializado');

    // Detectar sesiones inexistentes después de 10 segundos
    setTimeout(() => {
      if (!whatsappClient.info?.wid) {
        console.log('⏳ No se detectó sesión activa. Iniciando autenticación...');
        forceWhatsAppAuth();
      }
    }, 10000);

  } catch (error) {
    console.error('Fallo catastrófico:', error);
    process.exit(1);
  }
})();