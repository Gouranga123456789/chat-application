const http = require('http');
const fs = require('fs');
const path = require('path');
const WebSocket = require('ws');

// --- Data Structures ---
const clients = new Map(); // Stores WebSocket connection -> {username, room}
const rooms = {
    'general': new Set(),
    'tech-talk': new Set(),
    'gaming-lounge': new Set()
};

// --- HTTP Server for Static Files ---
const server = http.createServer((req, res) => {
    const filePath = path.join(__dirname, 'public', req.url === '/' ? 'index.html' : req.url);
    const extname = String(path.extname(filePath)).toLowerCase();
    const mimeTypes = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css' };
    const contentType = mimeTypes[extname] || 'application/octet-stream';

    fs.readFile(filePath, (error, content) => {
        if (error) {
            res.writeHead(404);
            res.end('404: File Not Found');
        } else {
            res.writeHead(200, { 'Content-Type': contentType });
            res.end(content, 'utf-8');
        }
    });
});

// --- WebSocket Server ---
const wss = new WebSocket.Server({ server });

// --- Helper Functions ---
function broadcastRoomList() {
    const roomList = Object.keys(rooms);
    const message = JSON.stringify({ type: 'room_list', rooms: roomList });
    for (const client of wss.clients) {
        if (client.readyState === WebSocket.OPEN) client.send(message);
    }
}

function broadcastUserList(room) {
    if (!rooms[room]) return;
    const userList = Array.from(rooms[room]).map(ws => clients.get(ws).username);
    const message = JSON.stringify({ type: 'user_list', room, users: userList });
    rooms[room].forEach(ws => {
        if (ws.readyState === WebSocket.OPEN) ws.send(message);
    });
}

function broadcastToRoom(room, message, senderWs) {
    if (!rooms[room]) return;
    rooms[room].forEach(ws => {
        if (ws !== senderWs && ws.readyState === WebSocket.OPEN) {
            ws.send(message);
        }
    });
}

// --- WebSocket Connection Logic ---
wss.on('connection', ws => {
    console.log('Client connected');

    ws.on('message', message => {
        const data = JSON.parse(message);
        const clientData = clients.get(ws);

        switch (data.type) {
            case 'login':
                const isUsernameTaken = Array.from(clients.values()).some(c => c.username === data.username);
                if (isUsernameTaken) {
                    ws.send(JSON.stringify({ type: 'login_error', message: 'Username is already taken.' }));
                } else {
                    clients.set(ws, { username: data.username, room: null });
                    ws.send(JSON.stringify({ type: 'login_success', username: data.username }));
                    broadcastRoomList();
                }
                break;

            case 'join_room':
                if (clientData) {
                    // Leave previous room
                    if (clientData.room && rooms[clientData.room]) {
                        rooms[clientData.room].delete(ws);
                        broadcastUserList(clientData.room);
                    }
                    // Join new room
                    clientData.room = data.room;
                    rooms[data.room].add(ws);
                    const joinMsg = JSON.stringify({ type: 'system_message', message: `${clientData.username} has joined the room.` });
                    broadcastToRoom(data.room, joinMsg, ws);
                    broadcastUserList(data.room);
                }
                break;

            case 'create_room':
                if (!rooms[data.room]) {
                    rooms[data.room] = new Set();
                    broadcastRoomList();
                }
                break;

            case 'send_message':
                if (clientData && clientData.room) {
                    const msg = {
                        type: 'new_message',
                        username: clientData.username,
                        message: data.message,
                        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
                    };
                    const messageString = JSON.stringify(msg);
                    rooms[clientData.room].forEach(client => client.send(messageString));
                }
                break;
        }
    });

    ws.on('close', () => {
        const clientData = clients.get(ws);
        if (clientData && clientData.room) {
            rooms[clientData.room].delete(ws);
            const leaveMsg = JSON.stringify({ type: 'system_message', message: `${clientData.username} has left the room.` });
            broadcastToRoom(clientData.room, leaveMsg, null);
            broadcastUserList(clientData.room);
        }
        clients.delete(ws);
        console.log('Client disconnected');
    });
});

server.listen(8080, () => {
    console.log('Server is running on http://localhost:8080');
});