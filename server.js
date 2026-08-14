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
const dataDir = path.join(__dirname, 'data');
const libraryFile = path.join(dataDir, 'scenes.json');
if (!fs.existsSync(uploadsDir)) fs.mkdirSync(uploadsDir, { recursive: true });
if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir, { recursive: true });
if (!fs.existsSync(libraryFile)) fs.writeFileSync(libraryFile, '[]', 'utf8');

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, uploadsDir),
  filename: (req, file, cb) => cb(null, Date.now() + '-' + file.originalname.replace(/[^a-zA-Z0-9._-]/g, '_'))
});
const upload = multer({ storage, limits: { fileSize: 1024 * 1024 * 1024 } });

app.use(express.static(path.join(__dirname, 'public')));
app.use(express.json({ limit: '20mb' }));

const presetScenes = [
  { id: 'preset-1', title: '🔥 مواجهة كوميدية بين شخصيتين', videoUrl: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerBlazes.mp4', duration: 15, characters: ['المهاجم','المدافع'], turns: [
    { index: 0, startTime: 1, endTime: 5, characterName: 'المهاجم' }, { index: 1, startTime: 5.5, endTime: 9.5, characterName: 'المدافع' }, { index: 2, startTime: 10, endTime: 14, characterName: 'المهاجم' }
  ]},
  { id: 'preset-2', title: '🎬 حوار ثلاثي درامي سريع', videoUrl: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/BigBuckBunny.mp4', duration: 20, characters: ['البطل','الشرير','الصديق'], turns: [
    { index: 0, startTime: 2, endTime: 6, characterName: 'البطل' }, { index: 1, startTime: 6.5, endTime: 11, characterName: 'الشرير' }, { index: 2, startTime: 11.5, endTime: 16, characterName: 'الصديق' }, { index: 3, startTime: 16.5, endTime: 19.5, characterName: 'البطل' }
  ]}
];

function readLibrary() { try { return JSON.parse(fs.readFileSync(libraryFile, 'utf8')); } catch { return []; } }
function writeLibrary(items) { fs.writeFileSync(libraryFile, JSON.stringify(items, null, 2), 'utf8'); }
function makeInviteCode() { return Math.random().toString(36).slice(2, 8).toUpperCase(); }

const rooms = {};
app.get('/api/presets', (req,res)=>res.json(presetScenes));
app.get('/api/scenes', (req,res)=>res.json(readLibrary().sort((a,b)=>b.createdAt-a.createdAt)));
app.post('/api/upload-video', upload.single('video'), (req,res)=>{
  if (!req.file) return res.status(400).json({error:'No video uploaded'});
  res.json({ videoUrl:`/uploads/${req.file.filename}` });
});

app.post('/api/scenes', (req,res)=>{
  const { title, videoUrl, turns, characters, creatorName, roomId, recordings } = req.body || {};
  if (!videoUrl || !Array.isArray(turns) || !turns.length) return res.status(400).json({error:'بيانات المشهد ناقصة'});
  const scenes = readLibrary();
  const scene = {
    id: 'scene-' + Date.now() + '-' + Math.random().toString(36).slice(2,7),
    title: String(title || 'مشهد بدون اسم').slice(0,120),
    videoUrl, turns, characters: Array.isArray(characters)?characters:[],
    creatorName: String(creatorName || 'مؤدي'), roomId: roomId || null,
    recordings: recordings || {}, createdAt: Date.now()
  };
  scenes.unshift(scene); writeLibrary(scenes);
  res.json(scene);
});

io.on('connection', socket => {
  let currentRoom = null, currentUser = null, currentPlayerKey = null;

  function autoAssignCharacters(room) {
    if (!room.players.length || !room.characters.length) {
      room.players.forEach(p=>{p.assignedCharacters=[];p.assignedCharacter=null;});
      return;
    }
    room.players.forEach(p=>{p.assignedCharacters=[];p.assignedCharacter=null;});
    room.characters.forEach((character,index)=>room.players[index % room.players.length].assignedCharacters.push(character));
    room.players.forEach(p=>p.assignedCharacter=p.assignedCharacters[0]||null);
    room.turns.forEach(turn=>{
      const p=room.players.find(x=>(x.assignedCharacters||[]).includes(turn.characterName));
      turn.playerId=p?p.id:null;
      turn.playerUsername=p?p.username:'بانتظار مؤدي';
    });
  }

  socket.on('join_room', ({roomId,username,playerKey})=>{
    currentRoom=String(roomId||'').toUpperCase(); currentUser=username; currentPlayerKey=playerKey;
    socket.join(currentRoom);
    if(!rooms[currentRoom]) rooms[currentRoom]={host:null,players:[],videoUrl:null,turns:[],characters:[],currentTurnIndex:0,recordings:{},isCompleted:false,createdAt:Date.now()};
    const room=rooms[currentRoom];
    let p=room.players.find(x=>x.playerKey===playerKey);
    if(p){ p.id=socket.id; p.username=username; }
    else { p={id:socket.id,playerKey,username,assignedCharacters:[]}; room.players.push(p); }
    if(!room.host || !room.players.some(x=>x.id===room.host)) room.host=p.id;
    autoAssignCharacters(room);
    socket.emit('room_updated',room); socket.emit('library_updated',readLibrary());
    io.to(currentRoom).emit('room_updated',room);
  });

  socket.on('set_custom_scene',({videoUrl,turns,characters,title})=>{
    if(!currentRoom||!rooms[currentRoom])return; const room=rooms[currentRoom]; if(socket.id!==room.host)return;
    room.videoUrl=videoUrl; room.turns=(turns||[]).map((t,i)=>({...t,index:i})); room.characters=characters||[]; room.title=title||'مشهد جديد'; room.currentTurnIndex=0; room.recordings={}; room.isCompleted=false;
    autoAssignCharacters(room); io.to(currentRoom).emit('room_updated',room);
  });

  socket.on('load_library_scene',({sceneId})=>{
    if(!currentRoom||!rooms[currentRoom])return; const room=rooms[currentRoom]; if(socket.id!==room.host)return;
    const scene=readLibrary().find(s=>s.id===sceneId); if(!scene)return;
    room.videoUrl=scene.videoUrl; room.turns=scene.turns.map((t,i)=>({...t,index:i})); room.characters=scene.characters||[]; room.title=scene.title; room.currentTurnIndex=0; room.recordings={}; room.isCompleted=false;
    autoAssignCharacters(room); io.to(currentRoom).emit('room_updated',room);
  });

  socket.on('start_recording_sync',()=>{const room=rooms[currentRoom]; if(!room)return; const turn=room.turns[room.currentTurnIndex]; if(!turn)return; io.to(currentRoom).emit('on_start_recording',{turn,recorderSocketId:socket.id});});
  socket.on('stop_recording_sync',({audioBase64,duration,metrics})=>{const room=rooms[currentRoom];if(!room)return;if(audioBase64)room.recordings[room.currentTurnIndex]={audioData:audioBase64,duration:Math.max(0,Number(duration)||0),metrics:metrics||{},playerId:socket.id,username:currentUser};io.to(currentRoom).emit('on_stop_recording',{turnIndex:room.currentTurnIndex,recordings:room.recordings});});
  socket.on('broadcast_listen_turn',()=>{const room=rooms[currentRoom];if(!room)return;const turn=room.turns[room.currentTurnIndex],rec=room.recordings[room.currentTurnIndex];if(rec)io.to(currentRoom).emit('on_play_listen_turn',{turn,audioData:rec.audioData});});
  socket.on('next_turn',()=>{const room=rooms[currentRoom];if(!room)return;if(room.currentTurnIndex<room.turns.length-1)room.currentTurnIndex++;else room.isCompleted=true;io.to(currentRoom).emit('turn_changed',{currentTurnIndex:room.currentTurnIndex,isCompleted:room.isCompleted});});
  socket.on('start_full_dub_sync',()=>{const room=rooms[currentRoom];if(room)io.to(currentRoom).emit('on_start_full_dub',{recordings:room.recordings,turns:room.turns});});

  socket.on('publish_room_scene',({title})=>{
    const room=rooms[currentRoom]; if(!room||socket.id!==room.host||!room.videoUrl||!room.turns.length)return;
    const scenes=readLibrary(); const scene={id:'scene-'+Date.now()+'-'+Math.random().toString(36).slice(2,7),title:String(title||room.title||'مشهد منشور').slice(0,120),videoUrl:room.videoUrl,turns:room.turns,characters:room.characters,creatorName:currentUser||'مؤدي',roomId:currentRoom,recordings:room.recordings,createdAt:Date.now()};
    scenes.unshift(scene);writeLibrary(scenes);io.emit('library_updated',scenes);io.to(currentRoom).emit('scene_published',scene);
  });

  socket.on('invite_room',()=>{const room=rooms[currentRoom];if(room)socket.emit('invite_code',{code:currentRoom});});

  socket.on('disconnect',()=>{
    if(currentRoom&&rooms[currentRoom]){
      const room=rooms[currentRoom]; const p=room.players.find(x=>x.playerKey===currentPlayerKey); if(p)p.id=null;
      if(room.host===socket.id)room.host=room.players.find(x=>x.id)?.id||null;
      autoAssignCharacters(room); io.to(currentRoom).emit('room_updated',room);
    }
  });
});

const PORT=process.env.PORT||3000;server.listen(PORT,()=>console.log(`🚀 Choicer Studio v4 running at http://localhost:${PORT}`));
