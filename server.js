const http=require('http'),fs=require('fs'),path=require('path'),crypto=require('crypto');const WebSocket=require('ws');
const PORT=process.env.PORT||10000,rooms=new Map(),roles=Array.from({length:8},(_,i)=>'Role '+(i+1));
const send=(w,x)=>w.readyState===1&&w.send(JSON.stringify(x)),code=()=>crypto.randomBytes(3).toString('hex').toUpperCase();
const snap=r=>({type:'state',room:r.code,started:r.started,video:r.video,players:r.players.map(p=>({id:p.id,name:p.name,role:p.role}))});
const bc=(r,x)=>r.players.forEach(p=>send(p.ws,x)),roomOf=p=>[...rooms.values()].find(r=>r.players.includes(p));
const server=http.createServer((req,res)=>{let u=(req.url||'/').split('?')[0];if(u==='/')u='/index.html';let f=path.join(__dirname,'public',path.normalize(u).replace(/^(\.\.[/\\])+/,''));let t={'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8'}[path.extname(f)]||'application/octet-stream';fs.readFile(f,(e,d)=>{if(e){res.writeHead(404);return res.end('Not found')}res.writeHead(200,{'Content-Type':t,'Cache-Control':'no-cache'});res.end(d)})});
const wss=new WebSocket.Server({server});wss.on('connection',ws=>{let p=null;ws.on('message',raw=>{let m;try{m=JSON.parse(raw)}catch{return}
if(m.type==='create'){let c;do c=code();while(rooms.has(c));let r={code:c,players:[],started:false,video:null};rooms.set(c,r);p={id:crypto.randomUUID(),name:String(m.name||'Player').slice(0,30),role:null,ws};r.players.push(p);send(ws,{type:'joined',room:c,id:p.id,roles});bc(r,snap(r));return}
if(m.type==='join'){let r=rooms.get(String(m.room||'').toUpperCase());if(!r)return send(ws,{type:'error',message:'Room not found.'});if(r.players.length>=8)return send(ws,{type:'error',message:'Room is full (8 players).'});p={id:crypto.randomUUID(),name:String(m.name||'Player').slice(0,30),role:null,ws};r.players.push(p);send(ws,{type:'joined',room:r.code,id:p.id,roles});bc(r,snap(r));return}
if(!p)return;let r=roomOf(p);if(!r)return;
if(m.type==='role'){let n=Number(m.role);if(!Number.isInteger(n)||n<0||n>7)return;if(r.players.some(x=>x!==p&&x.role===n))return send(ws,{type:'error',message:'That role is already taken.'});p.role=n;bc(r,snap(r));return}
if(m.type==='video'){if(r.players[0]!==p)return send(ws,{type:'error',message:'Only the host can load the video.'});r.video={name:String(m.name||'video'),data:String(m.video||'')};r.started=false;bc(r,snap(r));return}
if(m.type==='start'){if(r.players[0]!==p)return;if(!r.video)return send(ws,{type:'error',message:'Upload a video first.'});if(r.players.some(x=>x.role===null))return send(ws,{type:'error',message:'Everyone must choose a role.'});r.started=true;bc(r,snap(r));return}
if(m.type==='sync'){if(r.players[0]!==p)return;bc(r,{type:'sync',action:m.action,position:Number(m.position)||0})}
});ws.on('close',()=>{if(!p)return;let r=roomOf(p);if(!r)return;r.players=r.players.filter(x=>x!==p);if(!r.players.length)rooms.delete(r.code);else bc(r,snap(r))})});
server.listen(PORT,'0.0.0.0',()=>console.log('Choicer Duo Dub v3 on '+PORT));
