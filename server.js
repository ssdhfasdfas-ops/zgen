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

// مكتبة مشاهد جاهزة ومقصقصة مسبقاً (Presets Library)
const presetScenes = [
  {
    id: "preset-1",
    title: "🔥 مواجهة كوميدية بين شخصيتين",
    videoUrl: "https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerBlazes.mp4",
    duration: 15,
    characters: ["الشخصية الأولى (المهاجم)", "الشخصية الثانية (المدافع)"],
    turns: [
      { index: 0, startTime: 1, endTime: 5, characterName: "الشخصية الأولى (المهاجم)" },
      { index: 1, startTime: 5.5, endTime: 9.5, characterName: "الشخصية الثانية (المدافع)" },
      { index: 2, startTime: 10, endTime: 14, characterName: "الشخصية الأولى (المهاجم)" }
    ]
  },
  {
    id: "preset-2",
    title: "🎬 حوار ثلاثي درامي سريع",
    videoUrl: "https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/BigBuckBunny.mp4",
    duration: 20,
    characters: ["البطل", "الشرير", "الصديق"],
    turns: [
      { index: 0, startTime: 2, endTime: 6, characterName: "البطل" },
      { index: 1, startTime: 6.5, endTime: 11, characterName: "الشرير" },
      { index: 2, startTime: 11.5, endTime: 16, characterName: "الصديق" },
      { index: 3, startTime: 16.5, endTime: 19.5, characterName: "البطل" }
    ]
  }
];

const rooms = {};

app.get('/api/presets', (req, res) => {
  res.json(presetScenes);
});

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
        turns: [],
        characters: [],
        currentTurnIndex: 0,
        recordings: {},
        isCompleted: false
      };
    }

    const room = rooms[roomId];
    const existingIndex = room.players.findIndex(p => p.id === socket.id);
    
    if (existingIndex === -1) {
      room.players.push({ 
        id: socket.id, 
        username,
        assignedCharacter: null
      });
    } else {
      room.players[existingIndex].username = username;
    }

    autoAssignCharacters(room);
    io.to(roomId).emit('room_updated', room);
  });

  // تكييف توزيع الشخصيات على اللاعبين في الغرفة تلقائياً ودون عشوائية
  function autoAssignCharacters(room) {
    if (!room.characters || room.characters.length === 0) return;
    
    room.players.forEach((player, idx) => {
      const charName = room.characters[idx % room.characters.length];
      player.assignedCharacter = charName;
    });

    // ربط الحوارات برقم معرف اللاعب المحدد لشخصيته
    room.turns.forEach(turn => {
      const assignedPlayer = room.players.find(p => p.assignedCharacter === turn.characterName);
      if (assignedPlayer) {
        turn.playerId = assignedPlayer.id;
        turn.playerUsername = assignedPlayer.username;
      } else {
        turn.playerId = null;
        turn.playerUsername = "بانتظار مؤدي الشخصية";
      }
    });
  }

  // اعتماد مشهد مخصص يدوي أو من المكتبة
  socket.on('set_custom_scene', ({ videoUrl, turns, characters }) => {
    if (!currentRoom || !rooms[currentRoom]) return;
    const room = rooms[currentRoom];
    if (socket.id !== room.host) return;

    room.videoUrl = videoUrl;
    room.turns = turns;
    room.characters = characters;
    room.currentTurnIndex = 0;
    room.recordings = {};
    room.isCompleted = false;

    autoAssignCharacters(room);

    io.to(currentRoom).emit('room_updated', room);
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
        autoAssignCharacters(room);
        io.to(currentRoom).emit('room_updated', room);
      }
    }
  });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`🚀 Choicer Studio v3.0 running at http://localhost:${PORT}`);
});
