const http = require('http');

const PORT = process.env.PORT || 8000;
const MOUNT_POINT = '/aovivo';
const PASSWORD = 'radiosenha123'; // Senha para colocar no programa BUTT

let sourceClient = null;
const listenerClients = new Set();

const server = http.createServer((req, res) => {
    // 1. PONTO DE ENTRADA: Onde o programa BUTT vai injetar o áudio do estúdio externo
    if (req.method === 'SOURCE' || req.method === 'PUT') {
        const auth = req.headers['authorization'];
        const isAuthorized = auth && Buffer.from(auth.split(' ')[1], 'base64').toString().includes(PASSWORD);

        if (req.url !== MOUNT_POINT || (!isAuthorized && PASSWORD)) {
            res.writeHead(401, { 'WWW-Authenticate': 'Basic realm="Icecast"' });
            return res.end('Não autorizado');
        }

        if (sourceClient) {
            sourceClient.destroy();
        }

        console.log('Estúdio externo conectado! Transmitindo...');
        sourceClient = req;

        // Encaminha os dados brutos de áudio recebidos para todos os ouvintes/automação
        req.on('data', (chunk) => {
            for (const client of listenerClients) {
                client.write(chunk);
            }
        });

        req.on('end', () => {
            console.log('Estúdio externo desconectado.');
            sourceClient = null;
            for (const client of listenerClients) client.end();
        });

        req.on('error', () => { sourceClient = null; });
        
        res.writeHead(200, { 'Connection': 'keep-alive' });
        return;
    }

    // 2. PONTO DE SAÍDA: O link que você vai colar dentro do ZaraRadio / RadioBOSS
    if (req.url === MOUNT_POINT) {
        res.writeHead(200, {
            'Content-Type': 'audio/mpeg',
            'Connection': 'keep-alive',
            'Transfer-Encoding': 'chunked'
        });

        listenerClients.add(res);
        console.log(`Nova automação/ouvinte conectado. Total: ${listenerClients.size}`);

        req.on('close', () => {
            listenerClients.delete(res);
            console.log(`Automação desconectada. Restantes: ${listenerClients.size}`);
        });
        return;
    }

    // Página inicial simples
    res.writeHead(200, { 'Content-Type': 'text/plain; charset=utf-8' });
    res.end('Servidor de Transmissão de Rádio Ativo.');
});

server.listen(PORT, () => {
    console.log(`Servidor Icecast Nativo rodando na porta ${PORT}`);
});
