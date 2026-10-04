const express = require("express");
const http = require("http");
const path = require("path");
const fs = require("fs");
const { Server } = require("socket.io");

const app = express();
const server = http.createServer(app);
const io = new Server(server);
const PORT = process.env.PORT || 3000;

const publicDir = path.join(__dirname, "public");
const chatFile = path.join(__dirname, "chat.json");
let messages = [];

try {
  if (fs.existsSync(chatFile)) {
    const data = JSON.parse(fs.readFileSync(chatFile, "utf8"));
    if (Array.isArray(data)) messages = data.slice(-300);
  }
} catch (e) {
  console.error("Could not read chat.json:", e.message);
}

function saveMessages() {
  try {
    fs.writeFileSync(chatFile, JSON.stringify(messages.slice(-300), null, 2), "utf8");
  } catch (e) {
    console.error("Could not save chat:", e.message);
  }
}

app.get("/health", (req, res) => {
  res.json({ ok: true, service: "class-701-online" });
});

app.use(express.static(publicDir));

app.get("*", (req, res) => {
  res.sendFile(path.join(publicDir, "index.html"));
});

io.on("connection", (socket) => {
  socket.emit("chat:history", messages);

  socket.on("join", (name) => {
    const safeName = String(name || "کاربر").trim().slice(0, 40);
    socket.data.name = safeName || "کاربر";
  });

  socket.on("chat:send", (payload) => {
    const name = String(payload?.name || socket.data.name || "کاربر").trim().slice(0, 40);
    const text = String(payload?.text || "").trim().slice(0, 500);
    if (!text) return;

    const msg = {
      id: Date.now().toString(36) + Math.random().toString(36).slice(2, 8),
      name: name || "کاربر",
      text,
      time: new Date().toLocaleTimeString("fa-IR", { hour: "2-digit", minute: "2-digit" })
    };

    messages.push(msg);
    messages = messages.slice(-300);
    saveMessages();
    io.emit("chat:new", msg);
  });

  socket.on("chat:delete", (payload) => {
    const id = String(payload?.id || "");
    const name = String(payload?.name || socket.data.name || "").trim();
    const msg = messages.find((m) => m.id === id);
    if (!msg || msg.name !== name) return;

    messages = messages.filter((m) => m.id !== id);
    saveMessages();
    io.emit("chat:delete", id);
  });
});

server.listen(PORT, "0.0.0.0", () => {
  console.log(`Class 701 online server running on port ${PORT}`);
});
