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

// أسماء أداور الشخصيات الافتراضية للتنسيق
const characterNames = ["الشخصية الأولى (البطل)", "الشخصية الثانية (الرفيق)", "الشخصية الثالثة", "الشخصية الرابعة"];

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
        recordings: {},
        isCompleted: false
      };
    }

    const room = rooms[roomId];
    const existingIndex = room.players.findIndex(p => p.id === socket.id);
    
    if (existingIndex === -1) {
      // تعيين شخصية ثابتة ومحددة لكل لاعب بناءً على ترتيب انضمامه
      const charIndex = room.players.length;
      const assignedCharName = characterNames[charIndex % characterNames.length] || `شخصية ${charIndex + 1}`;
      
      room.players.push({ 
        id: socket.id, 
        username,
        characterIndex: charIndex,
        characterName: assignedCharName
      });
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

    const segmentLength = 5; // 5 ثوانٍ لكل حوار
    const totalTurns = Math.max(2, Math.floor(room.videoDuration / segmentLength));
    
    room.turns = [];
    const players = room.players;
    const playerCount = Math.max(1, players.length);

    // تقسيم المشهد وتخصيص كل حوار لشخصية اللاعب المحددة حصراً لمنع التداخل أو العشوائية
    for (let i = 0; i < totalTurns; i++) {
      const playerForThisTurn = players[i % playerCount];

      room.turns.push({
        index: i,
        startTime: i * segmentLength,
        endTime: Math.min((i + 1) * segmentLength, room.videoDuration),
        playerId: playerForThisTurn ? playerForThisTurn.id : null,
        playerUsername: playerForThisTurn ? playerForThisTurn.username : `لاعب ${i+1}`,
        characterName: playerForThisTurn ? playerForThisTurn.characterName : `شخصية ${i+1}`
      });
    }

    room.currentTurnIndex = 0;
    room.recordings = {};
    room.isCompleted = false;

    io.to(currentRoom).emit('room_updated', room);
    io.to(currentRoom).emit('sync_turn_setup', { currentTurnIndex: 0 });
  });

  socket.on('start_recording_sync', () => {
    if (!currentRoom || !rooms[currentRoom]) return;
    const room = rooms[currentRoom];
    const turn = room.turns[room.currentTurnIndex];
    io.to(currentRoom).emit('on_start_recording', { turn, recorderSocketId: socket.id });
  });

  socket.on('stop_recording_sync', ({ audioBase64 }) => {
    if (!currentRoom || !rooms[currentRoom]) return;
    const room = rooms[currentRoom];
    
    if (audioBase64) {
      room.recordings[room.currentTurnIndex] = {
        audioData: audioBase64,
        playerId: socket.id,
        username: currentUser
      };
    }

    io.to(currentRoom).emit('on_stop_recording', {
      turnIndex: room.currentTurnIndex,
      recordings: room.recordings
    });
  });

  socket.on('broadcast_listen_turn', () => {
    if (!currentRoom || !rooms[currentRoom]) return;
    const room = rooms[currentRoom];
    const turn = room.turns[room.currentTurnIndex];
    const rec = room.recordings[room.currentTurnIndex];
    
    if (rec) {
      io.to(currentRoom).emit('on_play_listen_turn', { turn, audioData: rec.audioData });
    }
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

  socket.on('start_full_dub_sync', () => {
    if (!currentRoom || !rooms[currentRoom]) return;
    io.to(currentRoom).emit('on_start_full_dub', { recordings: rooms[currentRoom].recordings, turns: rooms[currentRoom].turns });
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
  console.log(`🚀 Choicer Dubbing Server running at http://localhost:${PORT}`);
});
