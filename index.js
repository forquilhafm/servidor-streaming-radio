const http = require('http');

const PORT = process.env.PORT || 8000;
const MOUNT_POINT = '/aovivo';
const PASSWORD = 'radiosenha123';

let sourceClient = null;
const listenerClients = new Set();

const server = http.createServer((req, res) => {
    const url = req.url.split('?')[0];

    // 1. ACEITAR CONEXÃO DO TRANSMISSOR
    if (req.method === 'SOURCE' || req.method === 'PUT') {
        // Aceita autenticação básica ou via cabeçalho do Icecast
        const authHeader = req.headers['authorization'] || req.headers['ice-password'];
        let isAuthorized = false;

        if (authHeader) {
            if (authHeader.startsWith('Basic ')) {
                const credentials = Buffer.from(authHeader.split(' ')[1], 'base64').toString();
                isAuthorized = credentials.includes(PASSWORD);
            } else {
                isAuthorized = authHeader === PASSWORD;
            }
        }

        if (url !== MOUNT_POINT || !isAuthorized) {
            res.writeHead(401, { 'WWW-Authenticate': 'Basic realm="Icecast"' });
            return res.end('Não autorizado');
        }

        if (sourceClient) sourceClient.destroy();
        
        console.log('Estúdio externo conectado com sucesso!');
        sourceClient = req;

        // Repassa os dados de áudio em tempo real para os ouvintes
        req.on('data', (chunk) => {
            for (const client of listenerClients) {
                client.write(chunk);
            }
        });

        req.on('end', () => {
            sourceClient = null;
            for (const client of listenerClients) client.end();
            console.log('Estúdio externo desconectado.');
        });

        req.on('error', () => { sourceClient = null; });

        // Resposta padrão que o Transmissor espera para confirmar que deu certo
        res.writeHead(200, {
            'Icecast-Login': '1',
            'Connection': 'Keep-Alive'
        });
        res.write('\r\n');
        return;
    }

    // 2. ENVIAR ÁUDIO PARA A AUTOMAÇÃO DA RÁDIO
    if (url === MOUNT_POINT) {
        res.writeHead(200, {
            'Content-Type': 'audio/mpeg',
            'Connection': 'keep-alive',
            'Transfer-Encoding': 'chunked',
            'Cache-Control': 'no-cache, no-store, must-revalidate',
            'Pragma': 'no-cache',
            'Expires': '0'
        });

        listenerClients.add(res);
        console.log(`Automação da rádio conectada. Total: ${listenerClients.size}`);

        req.on('close', () => {
            listenerClients.delete(res);
            console.log(`Automação desconectada. Restantes: ${listenerClients.size}`);
        });
        return;
    }

    // Página inicial simples
    res.writeHead(200, { 'Content-Type': 'text/plain; charset=utf-8' });
    res.end('Nosso Servidor de Rádio P2P está Ativo e Online.');
});

server.listen(PORT, () => {
    console.log(`Servidor rodando internamente na porta ${PORT}`);
});
