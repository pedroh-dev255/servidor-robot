const WebSocket = require('ws');
const dotenv = require('dotenv');
const fs = require('fs');

dotenv.config();
port = process.env.PORT;

const wss = new WebSocket.Server({ port: port });


// Chave secreta gerada e armazenada no .env
const SECRET_KEY = process.env.SECRET_KEY;
if (!SECRET_KEY) {
    console.error('Erro: SECRET_KEY não definida no arquivo .env');
    process.exit(1);
}

// Estrutura para armazenar conexões e status
let clients = {
    app: null,   // Conexão do app Flutter
    esp: null,   // Conexão do ESP8266
    espcam: null // Conexão da ESP-CAM
};

let status = {
    ping: null,       // Tempo de resposta entre dispositivos
    roboStatus: 'offline', // Status do robô (online/offline)
    cameraStatus: 'offline' // Status da câmera (online/offline)
};

// Evento de conexão
wss.on('connection', (ws, req) => {
    console.log('Nova conexão recebida');

    // Autenticar a conexão
    ws.on('message', (message) => {
        try {
            const data = JSON.parse(message);

            if (data.type === 'authenticate' && data.secretKey) {
                // Validar a chave secreta
                if (data.secretKey === SECRET_KEY) {
                    console.log('Cliente autenticado com sucesso');
                    ws.send(JSON.stringify({ status: 'authenticated' }));
                } else {
                    console.log('Falha na autenticação: chave incorreta');
                    ws.send(JSON.stringify({ status: 'authentication_failed' }));
                    ws.close();
                }
                return;
            }

            // Processar mensagens apenas se autenticado
            if (data.type === 'register') {
                if (data.client === 'app') {
                    clients.app = ws;
                    console.log('App registrado');
                } else if (data.client === 'esp') {
                    clients.esp = ws;
                    status.roboStatus = 'online';
                    console.log('ESP registrado');
                } else if (data.client === 'espcam') {
                    clients.espcam = ws;
                    status.cameraStatus = 'online';
                    console.log('ESP-CAM registrado');
                }
                ws.send(JSON.stringify({ status: 'registered', client: data.client }));
            } else if (data.type === 'movement' && clients.esp) {
                // Comando de movimentação enviado pelo app
                clients.esp.send(JSON.stringify({ command: 'move', value: data.value }));
            } else if (data.type === 'sensorData' && clients.app) {
                // Dados dos sensores enviados pelo ESP para o app
                clients.app.send(JSON.stringify({ sensorData: data.sensorData }));
            } else if (data.type === 'cameraFrame' && clients.app) {
                // Frame da câmera enviado pela ESP-CAM para o app
                clients.app.send(JSON.stringify({ frame: data.frame }));
            } else if (data.type === 'ping') {
                // Atualizar ping
                status.ping = data.value;
                console.log('Ping atualizado:', status.ping);
            }
        } catch (err) {
            console.error('Erro ao processar mensagem:', err);
        }
    });

    // Enviar informações de status periodicamente para o app
    const sendStatusUpdates = setInterval(() => {
        if (clients.app) {
            clients.app.send(JSON.stringify({
                type: 'statusUpdate',
                status: {
                    ping: status.ping,
                    roboStatus: status.roboStatus,
                    cameraStatus: status.cameraStatus
                }
            }));
        }
    }, 5000); // Atualização a cada 5 segundos

    // Evento de desconexão
    ws.on('close', () => {
        if (clients.app === ws) clients.app = null;
        if (clients.esp === ws) {
            clients.esp = null;
            status.roboStatus = 'offline';
        }
        if (clients.espcam === ws) {
            clients.espcam = null;
            status.cameraStatus = 'offline';
        }
        clearInterval(sendStatusUpdates);
        console.log('Conexão encerrada');
    });
});

console.log(`Servidor WebSocket rodando na porta ${port}`);
