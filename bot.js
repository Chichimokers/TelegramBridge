const phoneNumbers = '5358126024'; // Número internacional
const phoneNumber = "Erne";
const { Client, LocalAuth } = require('whatsapp-web.js');
const axios = require('axios');
const path = require('path');
const { Boom } = require('@hapi/boom');
const fs = require('fs');
// Configuración
const targetUser = '5359057080@c.us';
const grupoDestino = 'Proyecto X';
const intervaloNoticias = 60 * 60 * 1000; // 1 hora
const newsAPIKey = '4f2bf5fbe85055fdfcf774fb6935d4b2'; // Consigue una API key de https://gnews.io/

// Configurar cliente WhatsApp
const whatsappClient = new Client({
  puppeteer: {
    headless: 'new',
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
    backupSyncIntervalMs: 300000
  }),
  webVersionCache: {
    type: 'remote',
    remotePath: 'https://raw.githubusercontent.com/wppconnect-team/wa-version/main/html/2.2412.54.html'
  }
});

// ======= FUNCIÓN PARA OBTENER NOTICIAS TECH =======
async function getTechNews() {
  try {
    const response = await axios.get(`https://gnews.io/api/v4/top-headlines?category=technology&lang=es&max=3&apikey=${newsAPIKey}`);
    
    const articles = response.data.articles;
    let newsMessage = "📰 *ÚLTIMAS NOTICIAS TECH* 📡\n\n";
    
    articles.forEach((article, index) => {
      newsMessage += `🔥 *${article.title}*\n${article.description}\n${article.url}\n\n`;
    });
    
    return newsMessage + `🕒 Actualizado: ${new Date().toLocaleTimeString()}`;
    
  } catch (error) {
    console.error('Error fetching news:', error);
    return "❌ Error al obtener las noticias. Inténtalo de nuevo más tarde.";
  }
}

// ======= ENVIAR NOTICIAS AL GRUPO =======
async function sendNewsToGroup() {
  try {
    const news = await getTechNews();
    const grupo = (await whatsappClient.getChats()).find(chat => 
      chat.isGroup && chat.name.toLowerCase() === grupoDestino.toLowerCase()
    );
    
    if (grupo) {
      await grupo.sendMessage(news);
      console.log('✅ Noticias enviadas al grupo');
    }
  } catch (error) {
    console.error('Error enviando noticias:', error);
  }
}

// ======= PROGRAMADOR DE NOTICIAS =======
function iniciarProgramador() {
  // Enviar inmediatamente al iniciar
  sendNewsToGroup();
  
  // Programar cada hora
  setInterval(sendNewsToGroup, intervaloNoticias);
  console.log(`⏰ Programador activo cada ${intervaloNoticias/3600000} horas`);
}

// ======= EVENTOS DEL CLIENTE =======
whatsappClient.on('ready', () => {
  console.log('\n🟢 WhatsApp completamente operativo');
  iniciarProgramador();
});

whatsappClient.on('auth_failure', () => {
  console.log('⚠️ Autenticación fallida. Forzando nueva autenticación...');
  forceWhatsAppAuth();
});



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