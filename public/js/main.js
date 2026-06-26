// ─── DOM Elements ──────────────────────────
const chatForm = document.getElementById('chat-form');
const chatMessages = document.querySelector('.chat-messages');
const roomName = document.getElementById('room-name');
const userList = document.getElementById('users');
const inputMessage = document.getElementById('msg');
const videoGrid = document.getElementById('video-grid');
const muteBtn = document.getElementById('mute-btn');
const videoBtn = document.getElementById('video-btn');
const shareBtn = document.getElementById('screenshare-btn');
const videoControls = document.getElementById('video-controls');
const typingDiv = document.getElementById('is-typing');

const TYPING_TIMER = 500;
let typing = false;
let lastTypingTime;

// ─── Query Params ──────────────────────────
const { username, room } = Qs.parse(location.search, { ignoreQueryPrefix: true });
if (!username || !room) {
  alert('Nome e sala são obrigatórios.');
  window.location.href = 'index.html';
}

// ─── Socket.IO ─────────────────────────────
const socket = io();

socket.on('sameName', () => {
  alert('Este nome já está em uso nesta sala. Escolha outro.');
  window.history.back();
});

socket.on('error', (msg) => {
  alert(msg);
  window.history.back();
});

// ─── CryptoClient Init ─────────────────────
let myPublicKey;
(async () => {
  myPublicKey = await CryptoClient.init();
  console.log('[Crypto] KeyPair gerado:', myPublicKey.substring(0, 20) + '...');
})();

// ─── PeerJS (integrado no servidor) ────────
const myPeer = new Peer(undefined, {
  host: location.hostname,
  port: location.port || (location.protocol === 'https:' ? 443 : 80),
  path: '/peerjs',
  secure: location.protocol === 'https:'
});

const peers = {};
let myVideo;
let myStream;

// ─── Capturar mídia ───────────────────────
navigator.mediaDevices.getUserMedia({ video: true, audio: true })
  .then(stream => {
    myStream = stream;
    myVideo = document.createElement('video');
    myVideo.muted = true;
    addVideoStream(myVideo, stream);

    myPeer.on('call', call => {
      call.answer(stream);
      const video = document.createElement('video');
      call.on('stream', userVideoStream => {
        addVideoStream(video, userVideoStream);
      });
      call.on('close', () => video.remove());
      call.on('error', () => video.remove());
    });

    socket.on('user-connected', userId => {
      setTimeout(() => connectToNewUser(userId, stream), 500);
    });
  })
  .catch(err => {
    console.error('Erro ao acessar mídia:', err);
    alert('Permita acesso à câmera e microfone para usar o vídeo.');
  });

// ─── PeerJS: meu ID pronto → joinRoom ─────
myPeer.on('open', userPeerId => {
  socket.emit('joinRoom', { userPeerId, username, room });
});

// ─── Key Exchange (E2EE) ──────────────────
socket.on('key-exchange', ({ userId, publicKey }) => {
  if (publicKey && userId !== myPeer.id && !CryptoClient.hasKeyFor(userId)) {
    CryptoClient.computeSharedSecret(publicKey, userId);
    console.log('[Crypto] Chave compartilhada com:', userId);
  }
});

socket.on('roomUsers', ({ room: roomName_, users }) => {
  outputRoomName(roomName_);
  outputUsers(users);
  if (myPublicKey) {
    socket.emit('key-exchange', { publicKey: myPublicKey, room: roomName_ });
  }
});

// ─── Conectar a novo peer ─────────────────
function connectToNewUser(userId, stream) {
  if (peers[userId]) return;
  const call = myPeer.call(userId, stream);
  const video = document.createElement('video');
  call.on('stream', userVideoStream => {
    addVideoStream(video, userVideoStream);
  });
  call.on('close', () => video.remove());
  call.on('error', () => video.remove());
  peers[userId] = call;
}

function addVideoStream(video, stream) {
  video.srcObject = stream;
  video.addEventListener('loadedmetadata', () => video.play().catch(() => {}));
  videoGrid.append(video);
  if (videoControls) {
    videoControls.classList.add('show');
    videoControls.style.display = 'flex';
  }
}

// ─── User disconnect ──────────────────────
socket.on('user-disconnected', userId => {
  if (peers[userId]) {
    peers[userId].close();
    delete peers[userId];
  }
});

// ─── Typing Indicators ────────────────────
inputMessage.addEventListener('input', updateTyping);

function updateTyping() {
  if (!typing) {
    typing = true;
    socket.emit('typing');
  }
  lastTypingTime = Date.now();
  setTimeout(() => {
    if (Date.now() - lastTypingTime >= TYPING_TIMER && typing) {
      socket.emit('stop typing');
      typing = false;
    }
  }, TYPING_TIMER);
}

socket.on('typing', (data) => addChatTyping(data));
socket.on('stop typing', () => removeChatTyping());

function addChatTyping(data) {
  removeChatTyping();
  const div = document.createElement('div');
  div.className = 'typing';
  div.innerHTML = `<i>${escapeHTML(data.username)} está digitando...</i>`;
  typingDiv.appendChild(div);
}

function removeChatTyping() {
  typingDiv.innerHTML = '';
}

// ─── Messages ─────────────────────────────
socket.on('message', message => {
  outputMessage(message);
  chatMessages.scrollTop = chatMessages.scrollHeight;
});

chatForm.addEventListener('submit', (e) => {
  e.preventDefault();
  const msg = e.target.elements.msg.value.trim();
  if (!msg) return;

  socket.emit('chatMessage', msg);
  socket.emit('stop typing');
  typing = false;
  e.target.elements.msg.value = '';
  e.target.elements.msg.focus();
  removeChatTyping();
});

function outputMessage(message) {
  const div = document.createElement('div');
  div.classList.add('message');

  const meta = document.createElement('p');
  meta.classList.add('meta');
  meta.innerHTML = `${escapeHTML(message.username)} <span>${escapeHTML(message.time || '')}</span>`;
  div.appendChild(meta);

  const text = document.createElement('p');
  text.classList.add('text');
  if (message.encrypted) {
    text.innerHTML = `🔒 <em>Mensagem criptografada</em>`;
  } else {
    text.innerText = message.text || '';
  }
  div.appendChild(text);

  chatMessages.appendChild(div);
}

// ─── Room Info ────────────────────────────
function outputRoomName(room) {
  roomName.innerText = room;
}

function outputUsers(users) {
  userList.innerHTML = users
    .map(u => `<li><i class="fas fa-circle" style="color:var(--success);font-size:8px;"></i> ${escapeHTML(u.username)}</li>`)
    .join('');
}

// ─── Video Controls ───────────────────────
if (muteBtn) {
  let muted = false;
  muteBtn.addEventListener('click', () => {
    if (myStream) {
      myStream.getAudioTracks().forEach(t => { t.enabled = muted; });
      muted = !muted;
      muteBtn.innerHTML = muted
        ? '<i class="fas fa-microphone-slash"></i>'
        : '<i class="fas fa-microphone"></i>';
    }
  });
}

if (videoBtn) {
  let videoOff = false;
  videoBtn.addEventListener('click', () => {
    if (myStream) {
      myStream.getVideoTracks().forEach(t => { t.enabled = videoOff; });
      videoOff = !videoOff;
      videoBtn.innerHTML = videoOff
        ? '<i class="fas fa-video-slash"></i>'
        : '<i class="fas fa-video"></i>';
    }
  });
}

if (shareBtn) {
  shareBtn.addEventListener('click', async () => {
    try {
      const screenStream = await navigator.mediaDevices.getDisplayMedia({ video: true });
      const screenVideo = document.createElement('video');
      addVideoStream(screenVideo, screenStream);
      screenStream.getVideoTracks()[0].onended = () => screenVideo.remove();
    } catch (err) {
      console.log('Screen share cancelado ou não suportado');
    }
  });
}

// ─── Utils ─────────────────────────────────
function escapeHTML(str) {
  const div = document.createElement('div');
  div.appendChild(document.createTextNode(str));
  return div.innerHTML;
}