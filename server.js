const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const fs = require('fs');
const path = require('path');

const app = express();
const server = http.createServer(app);
const io = new Server(server, { cors: { origin: true, credentials: true } });

const PORT = process.env.PORT || 3000;
const DATA_FILE = path.join(__dirname, 'chat.json');

app.use(express.static(path.join(__dirname, 'public')));

function loadMessages() {
  try {
    if (!fs.existsSync(DATA_FILE)) return [];
    const data = JSON.parse(fs.readFileSync(DATA_FILE, 'utf8'));
    return Array.isArray(data) ? data.slice(-300) : [];
  } catch (_) { return []; }
}
function saveMessages(messages) {
  fs.writeFileSync(DATA_FILE, JSON.stringify(messages.slice(-300), null, 2), 'utf8');
}

let messages = loadMessages();
const users = new Map();

io.on('connection', socket => {
  socket.emit('chat:history', messages);
  socket.emit('online:count', users.size);

  socket.on('user:join', rawName => {
    const name = String(rawName || '').trim().slice(0, 40);
    if (!name) return;
    users.set(socket.id, name);
    socket.data.name = name;
    io.emit('online:count', users.size);
    io.emit('user:list', Array.from(users.values()));
  });

  socket.on('chat:send', rawText => {
    const name = socket.data.name;
    const text = String(rawText || '').trim().slice(0, 500);
    if (!name || !text) return;
    const msg = {
      id: `${Date.now()}-${Math.random().toString(16).slice(2)}`,
      name,
      text,
      createdAt: Date.now()
    };
    messages.push(msg);
    messages = messages.slice(-300);
    saveMessages(messages);
    io.emit('chat:new', msg);
  });

  socket.on('chat:delete', id => {
    const name = socket.data.name;
    const msg = messages.find(m => m.id === id);
    if (!name || !msg || msg.name !== name) return;
    messages = messages.filter(m => m.id !== id);
    saveMessages(messages);
    io.emit('chat:deleted', id);
  });

  socket.on('disconnect', () => {
    users.delete(socket.id);
    io.emit('online:count', users.size);
    io.emit('user:list', Array.from(users.values()));
  });
});

app.get('/health', (_, res) => res.json({ ok: true, online: users.size }));

server.listen(PORT, () => console.log(`Class 701 online server running on port ${PORT}`));
