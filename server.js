const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const path = require('path');
const multer = require('multer');
const fs = require('fs');

const app = express();
const server = http.createServer(app);
const io = new Server(server, { maxHttpBufferSize: 1e8 });

const uploadsDir = path.join(__dirname, 'public', 'uploads');
if (!fs.existsSync(uploadsDir)) fs.mkdirSync(uploadsDir, { recursive: true });

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, uploadsDir),
  filename: (req, file, cb) => cb(null, Date.now() + '-' + file.originalname)
});
const upload = multer({ storage });

app.use(express.static(path.join(__dirname, 'public')));
app.use(express.json());

const rooms = {};

app.post('/api/upload-video', upload.single('video'), (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'No video uploaded' });
  const videoUrl = `/uploads/${req.file.filename}`;
  res.json({ videoUrl });
});

io.on('connection', (socket) => {
  let currentRoom = null;
  let currentUser = null;

  socket.on('join_room', ({ roomId, username }) => {
    currentRoom = roomId;
    currentUser = username;
    socket.join(roomId);

    if (!rooms[roomId]) {
      rooms[roomId] = {
        host: socket.id,
        players: [],
        videoUrl: null,
        videoDuration: 0,
        turns: [],
        currentTurnIndex: 0,
        videoState: { isPlaying: false, currentTime: 0 },
        recordings: {}
      };
    }

    const room = rooms[roomId];
    const existingIndex = room.players.findIndex(p => p.id === socket.id);
    if (existingIndex === -1) {
      room.players.push({ id: socket.id, username, roleNumber: room.players.length + 1 });
    } else {
      room.players[existingIndex].username = username;
    }

    io.to(roomId).emit('room_updated', room);
  });

  socket.on('set_video_info', ({ videoUrl, duration }) => {
    if (!currentRoom || !rooms[currentRoom]) return;
    const room = rooms[currentRoom];
    if (socket.id !== room.host) return;

    room.videoUrl = videoUrl;
    room.videoDuration = duration || 30;

    const segmentLength = 5; // 5 ثوانٍ لكل دور تلقائياً
    const totalTurns = Math.max(2, Math.floor(room.videoDuration / segmentLength));
    
    room.turns = [];
    const playerCount = Math.max(1, room.players.length);

    for (let i = 0; i < totalTurns; i++) {
      const assignedPlayer = room.players[i % playerCount] || room.players[0];
      room.turns.push({
        index: i,
        startTime: i * segmentLength,
        endTime: Math.min((i + 1) * segmentLength, room.videoDuration),
        playerId: assignedPlayer ? assignedPlayer.id : null,
        playerUsername: assignedPlayer ? assignedPlayer.username : `لاعب ${i+1}`
      });
    }

    room.currentTurnIndex = 0;
    room.recordings = {};

    io.to(currentRoom).emit('room_updated', room);
  });

  socket.on('video_action', ({ action, currentTime }) => {
    if (!currentRoom || !rooms[currentRoom]) return;
    const room = rooms[currentRoom];
    room.videoState = { isPlaying: action === 'play', currentTime };
    socket.to(currentRoom).emit('sync_video', { action, currentTime });
  });

  socket.on('submit_turn_audio', ({ turnIndex, audioBase64 }) => {
    if (!currentRoom || !rooms[currentRoom]) return;
    const room = rooms[currentRoom];

    room.recordings[turnIndex] = {
      audioData: audioBase64,
      playerId: socket.id,
      username: currentUser
    };

    io.to(currentRoom).emit('turn_recorded', {
      turnIndex,
      recordings: room.recordings
    });
  });

  socket.on('next_turn', () => {
    if (!currentRoom || !rooms[currentRoom]) return;
    const room = rooms[currentRoom];
    if (room.currentTurnIndex < room.turns.length - 1) {
      room.currentTurnIndex++;
    } else {
      room.isCompleted = true;
    }
    io.to(currentRoom).emit('turn_changed', { 
      currentTurnIndex: room.currentTurnIndex, 
      isCompleted: room.isCompleted 
    });
  });

  socket.on('restart_dub', () => {
    if (!currentRoom || !rooms[currentRoom]) return;
    const room = rooms[currentRoom];
    room.currentTurnIndex = 0;
    room.isCompleted = false;
    io.to(currentRoom).emit('turn_changed', { currentTurnIndex: 0, isCompleted: false });
  });

  socket.on('disconnect', () => {
    if (currentRoom && rooms[currentRoom]) {
      const room = rooms[currentRoom];
      room.players = room.players.filter(p => p.id !== socket.id);
      if (room.players.length === 0) {
        delete rooms[currentRoom];
      } else {
        if (room.host === socket.id) room.host = room.players[0].id;
        io.to(currentRoom).emit('room_updated', room);
      }
    }
  });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`🚀 Choicer Dynamic Dubbing Server running at http://localhost:${PORT}`);
});
