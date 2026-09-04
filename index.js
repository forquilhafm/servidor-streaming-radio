const http = require('http');

const PORT = process.env.PORT || 8000;
const MOUNT_POINT = '/aovivo';
const PASSWORD = 'radiosenha123';

let sourceClient = null;
const listenerClients = new Set();

const server = http.createServer((req, res) => {
    // Permite que qualquer site (como o InfinityFree) acesse o áudio sem bloqueios de segurança
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, PUT, SOURCE, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', '*');

    if (req.method === 'OPTIONS') {
        res.writeHead(200);
        return res.end();
    }

    const url = req.url.split('?')[0];

    // 1. RECEBER ÁUDIO DO TRANSMISSOR
    if (req.method === 'SOURCE' || req.method === 'PUT') {
        const authHeader = req.headers['authorization'] || req.headers['ice-password'] || '';
        let isAuthorized = false;

        if (authHeader.startsWith('Basic ')) {
            try {
                const base64Token = authHeader.replace('Basic ', '').trim();
                const credentials = Buffer.from(base64Token, 'base64').toString('utf-8');
                isAuthorized = credentials.includes(PASSWORD) || credentials.endsWith(':' + PASSWORD);
            } catch (e) { isAuthorized = false; }
        } else if (authHeader) {
            isAuthorized = authHeader.trim() === PASSWORD;
        }

        if (url !== MOUNT_POINT || !isAuthorized) {
            res.writeHead(401, { 'WWW-Authenticate': 'Basic realm="Icecast"' });
            return res.end('Não autorizado');
        }

        if (sourceClient) sourceClient.destroy();
        
        console.log('Transmissor Conectado!');
        sourceClient = req;

        req.on('data', (chunk) => {
            for (const client of listenerClients) {
                client.write(chunk);
                // Força o envio imediato do som para o navegador sem acumular cache
                if (typeof client.flush === 'function') client.flush();
            }
        });

        req.on('end', () => {
            sourceClient = null;
            for (const client of listenerClients) client.end();
        });

        req.on('error', () => { sourceClient = null; });

        res.writeHead(200, { 'Icecast-Login': '1', 'Connection': 'Keep-Alive' });
        res.write('\r\n');
        return;
    }

    // 2. ENVIAR ÁUDIO PARA O PLAYER WEB (MUDADO PARA RESPOSTA IMEDIATA)
    if (url === MOUNT_POINT) {
        res.writeHead(200, {
            'Content-Type': 'audio/mpeg',
            'Connection': 'keep-alive',
            'Transfer-Encoding': 'chunked',
            'Cache-Control': 'no-cache, no-store, must-revalidate, private',
            'X-Content-Type-Options': 'nosniff',
            'Pragma': 'no-cache',
            'Expires': '0'
        });

        // Envia um pequeno bloco vazio inicial para destravar o "Play" do navegador na hora
        res.write(Buffer.alloc(0)); 

        listenerClients.add(res);

        req.on('close', () => {
            listenerClients.delete(res);
        });
        return;
    }

    res.writeHead(200, { 'Content-Type': 'text/plain; charset=utf-8' });
    res.end('Servidor de Rádio Online e Ativo.');
});

server.listen(PORT, () => {
    console.log(`Servidor rodando na porta ${PORT}`);
});
