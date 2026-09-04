const IcecastServer = require('node-icecast-server');

// O Render define a porta automaticamente
const PORT = process.env.PORT || 8000;

const server = new IcecastServer({
  port: PORT,
  maxClients: 15,
  sources: {
    '/radio': {
      password: 'senhaforquilha', // Senha que usaremos para enviar o áudio
      bitrate: 128,
      type: 'audio/mpeg' // Formato MP3 padrão aceito pelas automações
    }
  }
});

server.start(() => {
  console.log(`Servidor de Rádio rodando na porta ${PORT}`);
});
