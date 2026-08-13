const http = require("http");
const fs = require("fs");
const path = require("path");
const crypto = require("crypto");
const WebSocket = require("ws");

const PORT = process.env.PORT || 10000;
const rooms = new Map();

const SCENE = {
  title: "The Missing Pizza",
  roles: ["Detective", "Suspect"],
  lines: [
    { role: 0, text: "Where is the last slice of pizza?" },
    { role: 1, text: "I have absolutely no idea what you're talking about." },
    { role: 0, text: "Really? Then why is there pizza sauce on your sleeve?" },
    { role: 1, text: "Okay, okay... maybe I know something." },
    { role: 0, text: "Talk. And make it convincing." },
    { role: 1, text: "Fine. I ate it. It was worth it." }
  ]
};

function roomCode() {
  return crypto.randomBytes(3).toString("hex").toUpperCase();
}
function send(ws, obj) {
  if (ws.readyState === WebSocket.OPEN) ws.send(JSON.stringify(obj));
}
function state(room) {
  return {
    type: "state",
    room: room.code,
    started: room.started,
    line: room.line,
    players: room.players.map(p => ({ id: p.id, name: p.name, role: p.role }))
  };
}
function broadcast(room, obj) {
  room.players.forEach(p => send(p.ws, obj));
}

const httpServer = http.createServer((req, res) => {
  let urlPath = (req.url || "/").split("?")[0];
  if (urlPath === "/") urlPath = "/index.html";
  const safePath = path.normalize(urlPath).replace(/^(\.\.[\/\\])+/, "");
  const file = path.join(__dirname, "public", safePath);
  const ext = path.extname(file);
  const types = {
    ".html": "text/html; charset=utf-8",
    ".js": "text/javascript; charset=utf-8",
    ".css": "text/css; charset=utf-8"
  };
  fs.readFile(file, (err, data) => {
    if (err) {
      res.writeHead(404, {"Content-Type": "text/plain"});
      return res.end("Not found");
    }
    res.writeHead(200, {"Content-Type": types[ext] || "application/octet-stream"});
    res.end(data);
  });
});

const wss = new WebSocket.Server({ server: httpServer });

wss.on("connection", ws => {
  let player = null;

  ws.on("message", raw => {
    let m;
    try { m = JSON.parse(raw.toString()); } catch { return; }

    if (m.type === "create") {
      let code;
      do code = roomCode(); while (rooms.has(code));
      const room = { code, players: [], started: false, line: -1 };
      rooms.set(code, room);
      player = {
        id: crypto.randomUUID(),
        name: String(m.name || "Player").slice(0, 24),
        role: 0,
        ws
      };
      room.players.push(player);
      send(ws, { type: "joined", room: code, id: player.id, role: 0, scene: SCENE });
      broadcast(room, state(room));
      return;
    }

    if (m.type === "join") {
      const code = String(m.room || "").toUpperCase();
      const room = rooms.get(code);
      if (!room) return send(ws, { type: "error", message: "Room not found." });
      if (room.players.length >= 2) return send(ws, { type: "error", message: "Room is full." });
      if (room.started) return send(ws, { type: "error", message: "Scene already started." });

      player = {
        id: crypto.randomUUID(),
        name: String(m.name || "Player").slice(0, 24),
        role: 1,
        ws
      };
      room.players.push(player);
      send(ws, { type: "joined", room: code, id: player.id, role: 1, scene: SCENE });
      broadcast(room, state(room));
      return;
    }

    if (!player) return;
    const room = [...rooms.values()].find(r => r.players.includes(player));
    if (!room) return;

    if (m.type === "start") {
      if (player.role !== 0) return;
      if (room.players.length !== 2)
        return send(ws, { type: "error", message: "Waiting for the second player." });
      room.started = true;
      room.line = 0;
      broadcast(room, state(room));
      return;
    }

    if (m.type === "done") {
      if (!room.started || room.line < 0 || room.line >= SCENE.lines.length) return;
      if (SCENE.lines[room.line].role !== player.role) return;
      room.line++;
      if (room.line >= SCENE.lines.length) room.started = false;
      broadcast(room, state(room));
      return;
    }
  });

  ws.on("close", () => {
    if (!player) return;
    const room = [...rooms.values()].find(r => r.players.includes(player));
    if (!room) return;
    room.players = room.players.filter(p => p !== player);
    if (room.players.length === 0) rooms.delete(room.code);
    else {
      room.started = false;
      room.line = -1;
      broadcast(room, state(room));
    }
  });
});

httpServer.listen(PORT, "0.0.0.0", () => {
  console.log("Choicer Duo online on port " + PORT);
});
