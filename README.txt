CHOICER DUO — ONE SERVICE

This version serves BOTH the website and the WebSocket server from one Render Web Service.

Files:
- server.js
- package.json
- public/index.html

Online deployment:
1. Put these 3 files/folders into one GitHub repository.
2. Render -> New -> Web Service -> select the repository.
3. Build Command: npm install
4. Start Command: npm start
5. Deploy.

Render gives the service an https://...onrender.com URL.
That URL is the game URL. Players only open it; they do not download anything.

The free Render web service can spin down after inactivity, so the first connection after a quiet period can take a little longer.
