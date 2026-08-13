const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const path = require('path');
const multer = require('multer');
const fs = require('fs');

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  maxHttpBufferSize: 1e8 // 100 MB max file size for uploads
});

// إعداد مجلدات التخزين
const uploadsDir = path.join(__dirname, 'public', 'uploads');
if (!fs.existsSync(uploadsDir)) fs.mkdirSync(uploadsDir, { recursive: true });

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, uploadsDir),
  filename: (req, file, cb) => cb(null, Date.now() + '-' + file.originalname)
});
const upload = multer({ storage });

app.use(express.static(path.join(__dirname, 'public')));
app.use(express.json());

// قاعدة بيانات الغرف في الذاكرة (In-Memory Rooms Store)
const rooms = {};

// API لرفع الفيديو من قبل الـ Host
app.post('/api/upload-video', upload.single('video'), (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'No video uploaded' });
  const videoUrl = `/uploads/${req.file.filename}`;
  res.json({ videoUrl });
});

// إدارة اتصالات Socket.io Real-time
io.on('connection', (socket) => {
  let currentRoom = null;
  let currentUser = null;

  // 1. إنشاء غرف جديدة أو الانضمام لغرفة قائمة
  socket.on('join_room', ({ roomId, username }) => {
    currentRoom = roomId;
    currentUser = username;
    socket.join(roomId);

    if (!rooms[roomId]) {
      rooms[roomId] = {
        host: socket.id,
        players: {},
        roles: {},
        videoUrl: null,
        videoState: { isPlaying: false, currentTime: 0 },
        dialogueLines: [
          { id: 1, character: 'Sherry', start: 2, end: 5, text: 'Where am I?' },
          { id: 2, character: 'Nozomi', start: 6, end: 10, text: 'You finally woke up!' }
        ],
        recordings: {} // { lineId: { audioUrl, playerId, username } }
      };
    }

    rooms[roomId].players[socket.id] = { id: socket.id, username };
    io.to(roomId).emit('room_updated', rooms[roomId]);
  });

  // 2. حجز الشخصية/الدور
  socket.on('select_role', ({ character }) => {
    if (!currentRoom || !rooms[currentRoom]) return;
    const room = rooms[currentRoom];

    // التأكد أن الدور غير محجوز للاعب آخر
    const existingHolder = Object.keys(room.roles).find(role => room.roles[role] === socket.id);
    if (existingHolder) delete room.roles[existingHolder];

    room.roles[character] = socket.id;
    io.to(currentRoom).emit('room_updated', room);
  });

  // 3. تعيين الفيديو وتوزيعه للجميع
  socket.on('set_video_url', ({ videoUrl }) => {
    if (!currentRoom || !rooms[currentRoom]) return;
    const room = rooms[currentRoom];
    if (socket.id !== room.host) return; // الـ Host فقط يحدد الفيديو

    room.videoUrl = videoUrl;
    io.to(currentRoom).emit('room_updated', room);
  });

  // 4. مزامنة التشغيل والإيقاف (Video Sync)
  socket.on('video_action', ({ action, currentTime }) => {
    if (!currentRoom || !rooms[currentRoom]) return;
    const room = rooms[currentRoom];

    room.videoState = { isPlaying: action === 'play', currentTime };
    socket.to(currentRoom).emit('sync_video', { action, currentTime });
  });

  // 5. حفظ التسجيل الصوتي للجملة
  socket.on('submit_audio', ({ lineId, audioBase64 }) => {
    if (!currentRoom || !rooms[currentRoom]) return;
    const room = rooms[currentRoom];

    room.recordings[lineId] = {
      audioData: audioBase64,
      playerId: socket.id,
      username: currentUser
    };

    io.to(currentRoom).emit('audio_recorded', {
      lineId,
      audioData: audioBase64,
      username: currentUser
    });
  });

  // 6. عند خروج اللاعب
  socket.on('disconnect', () => {
    if (currentRoom && rooms[currentRoom]) {
      delete rooms[currentRoom].players[socket.id];
      Object.keys(rooms[currentRoom].roles).forEach(char => {
        if (rooms[currentRoom].roles[char] === socket.id) delete rooms[currentRoom].roles[char];
      });
      io.to(currentRoom).emit('room_updated', rooms[currentRoom]);
    }
  });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`🚀 Choicer Server running at http://localhost:${PORT}`);
});
