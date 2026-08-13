const http=require('http'),fs=require('fs'),path=require('path'),crypto=require('crypto');
const WebSocket=require('ws');
const PORT=process.env.PORT||10000, rooms=new Map();
const roles=['Role 1','Role 2','Role 3','Role 4','Role 5','Role 6','Role 7','Role 8'];
function code(){return crypto.randomBytes(3).toString('hex').toUpperCase()}
function send(ws,x){if(ws.readyState===1)ws.send(JSON.stringify(x))}
function snapshot(r){return {type:'state',room:r.code,started:r.started,video:r.video,playing:r.playing,position:r.position,players:r.players.map(p=>({id:p.id,name:p.name,role:p.role}))}}
function broadcast(r,x){r.players.forEach(p=>send(p.ws,x))}
function getRoom(p){return [...rooms.values()].find(r=>r.players.includes(p))}
const httpServer=http.createServer((req,res)=>{let u=(req.url||'/').split('?')[0];if(u==='/')u='/index.html';const f=path.join(__dirname,'public',path.normalize(u).replace(/^(\.\.[\/\\])+/,''));const types={'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8'};fs.readFile(f,(e,d)=>{if(e){res.writeHead(404);return res.end('Not found')}res.writeHead(200,{'Content-Type':types[path.extname(f)]||'application/octet-stream'});res.end(d)})});
const wss=new WebSocket.Server({server:httpServer});
wss.on('connection',ws=>{let p=null;ws.on('message',raw=>{let m;try{m=JSON.parse(raw)}catch{return}
if(m.type==='create'){let c;do c=code();while(rooms.has(c));const r={code:c,players:[],started:false,video:'',playing:false,position:0};rooms.set(c,r);p={id:crypto.randomUUID(),name:String(m.name||'Player').slice(0,24),role:null,ws};r.players.push(p);send(ws,{type:'joined',room:c,id:p.id,roles});broadcast(r,snapshot(r));return}
if(m.type==='join'){const r=rooms.get(String(m.room||'').toUpperCase());if(!r)return send(ws,{type:'error',message:'Room not found.'});if(r.players.length>=8)return send(ws,{type:'error',message:'Room is full (8 players).'});p={id:crypto.randomUUID(),name:String(m.name||'Player').slice(0,24),role:null,ws};r.players.push(p);send(ws,{type:'joined',room:r.code,id:p.id,roles});broadcast(r,snapshot(r));return}
if(!p)return;const r=getRoom(p);if(!r)return;
if(m.type==='role'){const n=Number(m.role);if(!Number.isInteger(n)||n<0||n>=8)return;if(r.players.some(x=>x!==p&&x.role===n))return send(ws,{type:'error',message:'That role is already taken.'});p.role=n;broadcast(r,snapshot(r));return}
if(m.type==='video'){if(r.players[0]!==p)return;r.video=String(m.url||'').trim();r.position=0;r.playing=false;broadcast(r,snapshot(r));return}
if(m.type==='start'){if(r.players[0]!==p)return;if(!r.video)return send(ws,{type:'error',message:'Add a direct video URL first.'});if(r.players.some(x=>x.role===null))return send(ws,{type:'error',message:'Everyone needs to choose a role.'});r.started=true;r.position=0;r.playing=false;broadcast(r,snapshot(r));return}
if(m.type==='play'){if(r.players[0]!==p)return;r.playing=true;r.position=Number(m.position)||0;broadcast(r,snapshot(r));return}
if(m.type==='pause'){if(r.players[0]!==p)return;r.playing=false;r.position=Number(m.position)||0;broadcast(r,snapshot(r));return}
if(m.type==='seek'){if(r.players[0]!==p)return;r.position=Number(m.position)||0;broadcast(r,snapshot(r));return}
});ws.on('close',()=>{if(!p)return;const r=getRoom(p);if(!r)return;r.players=r.players.filter(x=>x!==p);if(!r.players.length)rooms.delete(r.code);else broadcast(r,snapshot(r))})});
httpServer.listen(PORT,'0.0.0.0',()=>console.log('Choicer Duo Dub v2 online on port '+PORT));
