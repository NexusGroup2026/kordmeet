const path = require('path');
const http = require('http');
const express = require('express');
const socketIO = require('socket.io');
const { ExpressPeerServer } = require('peer');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const cors = require('cors');

const formatMessage = require('./utils/messages');
const { userJoin, getCurrentUser, userLeave, getRoomUsers, userExists } = require('./utils/users');

const app = express();
const PORT = process.env.PORT || 3000;

// ─── Segurança ───────────────────────────────────────────
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'", "'unsafe-inline'", "https://unpkg.com", "https://cdnjs.cloudflare.com"],
      styleSrc: ["'self'", "'unsafe-inline'", "https://cdnjs.cloudflare.com", "https://fonts.googleapis.com"],
      fontSrc: ["'self'", "https://cdnjs.cloudflare.com", "https://fonts.gstatic.com"],
      imgSrc: ["'self'", "data:"],
      mediaSrc: ["'self'", "blob:"],
      connectSrc: ["'self'", "ws:", "wss:"]
    }
  }
}));
app.use(cors());

const limiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 200,
  standardHeaders: true,
  legacyHeaders: false,
  message: 'Muitas requisições, tente novamente mais tarde.'
});
app.use('/api/', limiter);

// ─── Servidor HTTP + Socket.IO ───────────────────────────
const server = http.createServer(app);
const io = socketIO(server, {
  cors: { origin: '*', methods: ['GET', 'POST'] },
  pingTimeout: 60000,
  pingInterval: 25000
});

// ─── PeerJS Server (integrado) ───────────────────────────
const peerServer = ExpressPeerServer(server, {
  path: '/peerjs',
  allow_discovery: true,
  proxied: false
});
app.use('/peerjs', peerServer);

peerServer.on('connection', (client) => {
  console.log(`[PeerJS] Conectado: ${client.getId()}`);
});
peerServer.on('disconnect', (client) => {
  console.log(`[PeerJS] Desconectado: ${client.getId()}`);
});

// ─── Rotas ───────────────────────────────────────────────
app.use(express.static(path.join(__dirname, 'public')));

app.get('/api/health', (req, res) => {
  const { getAllUsers } = require('./utils/users');
  const allUsers = getAllUsers();
  const rooms = [...new Set(allUsers.map(u => u.room))];
  res.json({ status: 'ok', timestamp: Date.now(), rooms, users: allUsers.length });
});

// ─── Socket.IO Events ────────────────────────────────────
const BOT_NAME = 'ZoomCord Bot';

io.on('connection', (socket) => {
  console.log(`[Socket] Nova conexão: ${socket.id}`);

  socket.on('key-exchange', ({ publicKey, room }) => {
    socket.broadcast.to(room).emit('key-exchange', {
      userId: socket.id,
      publicKey
    });
  });

  socket.on('joinRoom', ({ userPeerId, username, room }) => {
    if (!username || !room || !username.trim() || !room.trim()) {
      socket.emit('error', 'Username e room são obrigatórios.');
      return;
    }

    const cleanUsername = username.trim().substring(0, 30);
    const cleanRoom = room.trim().substring(0, 50);

    if (userExists(cleanRoom, cleanUsername)) {
      socket.emit('sameName');
      return;
    }

    const user = userJoin(socket.id, userPeerId, cleanUsername, cleanRoom);
    socket.join(user.room);

    socket.emit('message', formatMessage(BOT_NAME, `Bem-vindo ao ZoomCord! Sala: ${user.room}`));
    socket.emit('message', formatMessage(BOT_NAME, '🔒 Criptografia ponta-a-ponta ativada.'));

    socket.broadcast.to(user.room).emit(
      'message',
      formatMessage(BOT_NAME, `${user.username} entrou na sala`)
    );

    socket.broadcast.to(user.room).emit('user-connected', userPeerId);

    io.to(user.room).emit('roomUsers', {
      room: user.room,
      users: getRoomUsers(user.room)
    });

    socket.on('typing', () => {
      socket.broadcast.to(user.room).emit('typing', { username: user.username });
    });

    socket.on('stop typing', () => {
      socket.broadcast.to(user.room).emit('stop typing', { username: user.username });
    });

    socket.on('chatMessage', (payload) => {
      const currentUser = getCurrentUser(socket.id);
      if (!currentUser) return;

      let msgData;
      if (typeof payload === 'object' && payload !== null && payload.encrypted) {
        msgData = {
          username: currentUser.username,
          encrypted: true,
          ciphertext: payload.ciphertext,
          time: new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }),
          timestamp: Date.now()
        };
      } else {
        const text = typeof payload === 'string' ? payload : (payload && payload.text) || '';
        msgData = formatMessage(currentUser.username, text);
      }

      io.to(currentUser.room).emit('message', msgData);
    });

    socket.on('disconnect', () => {
      const leftUser = userLeave(socket.id);
      if (leftUser) {
        io.to(leftUser.room).emit(
          'message',
          formatMessage(BOT_NAME, `${leftUser.username} saiu da sala`)
        );
        io.to(leftUser.room).emit('roomUsers', {
          room: leftUser.room,
          users: getRoomUsers(leftUser.room)
        });
        socket.broadcast.to(leftUser.room).emit('user-disconnected', leftUser.peerId);
      }
    });
  });
});

// ─── Iniciar servidor ────────────────────────────────────
server.listen(PORT, () => {
  console.log('');
  console.log('╔════════════════════════════════════════════╗');
  console.log('║        🔒 ZoomCord v2.0 — E2EE            ║');
  console.log('╠════════════════════════════════════════════╣');
  console.log(`║  Web:    http://localhost:${PORT}            ║`);
  console.log(`║  PeerJS: ws://localhost:${PORT}/peerjs      ║`);
  console.log('║  Crypto: tweetnacl (NaCl/Curve25519)      ║');
  console.log('╚════════════════════════════════════════════╝');
  console.log('');
});

process.on('SIGTERM', () => {
  console.log('Encerrando servidor...');
  server.close(() => process.exit(0));
});