const http = require('http');

const PORT = process.env.PORT || 8000;
const MOUNT_POINT = '/aovivo';
const PASSWORD = 'radiosenha123';

let sourceClient = null;
const listenerClients = new Set();

const server = http.createServer((req, res) => {
    const url = req.url.split('?')[0];

    // 1. RECONHECER O SINAL DO SEU TRANSMISSOR
    if (req.method === 'SOURCE' || req.method === 'PUT') {
        const authHeader = req.headers['authorization'] || req.headers['ice-password'] || '';
        let isAuthorized = false;

        // Decodifica a senha de forma inteligente se o transmissor mandar colado ou separado
        if (authHeader.startsWith('Basic ')) {
            try {
                const base64Token = authHeader.replace('Basic ', '').trim();
                const credentials = Buffer.from(base64Token, 'base64').toString('utf-8');
                isAuthorized = credentials.includes(PASSWORD) || credentials.endsWith(':' + PASSWORD);
            } catch (e) {
                isAuthorized = false;
            }
        } else if (authHeader) {
            isAuthorized = authHeader.trim() === PASSWORD;
        }

        // Se o transmissor mandar a senha na própria URL (comum em alguns softwares)
        if (req.url.includes('pass=') && req.url.includes(PASSWORD)) {
            isAuthorized = true;
        }

        if (url !== MOUNT_POINT || !isAuthorized) {
            console.log('Tentativa de conexão recusada: senha incorreta ou ponto incorreto.');
            res.writeHead(401, { 'WWW-Authenticate': 'Basic realm="Icecast"' });
            return res.end('Não autorizado');
        }

        if (sourceClient) sourceClient.destroy();
        
        console.log('🔥 Transmissor Conectado com Sucesso!');
        sourceClient = req;

        // Distribui os blocos de áudio brutos MP3 recebidos para a rádio em tempo real
        req.on('data', (chunk) => {
            for (const client of listenerClients) {
                client.write(chunk);
            }
        });

        req.on('end', () => {
            sourceClient = null;
            for (const client of listenerClients) client.end();
            console.log('Transmissor desconectado.');
        });

        req.on('error', () => { sourceClient = null; });

        // Resposta exata que o aperto de mão do Icecast exige para iniciar o streaming
        res.writeHead(200, {
            'Icecast-Login': '1',
            'Connection': 'Keep-Alive'
        });
        res.write('\r\n');
        return;
    }

    // 2. ENVIAR O ÁUDIO PARA A AUTOMAÇÃO DA RÁDIO (ZARARADIO / RADIOBOSS)
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
        console.log(`Automação conectada ao fluxo de áudio. Total de ouvintes: ${listenerClients.size}`);

        req.on('close', () => {
            listenerClients.delete(res);
            console.log(`Automação desconectou. Restantes: ${listenerClients.size}`);
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
