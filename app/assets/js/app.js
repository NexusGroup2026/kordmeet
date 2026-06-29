/**
 * Kord Meet — App Entry Point
 * Initializes Firebase + mounts the chat platform
 */

// Firebase config injected by public/index.php or index.html
const firebaseConfig = window.KORD_FIREBASE_CONFIG || {
    apiKey: "",
    authDomain: "",
    databaseURL: "",
    projectId: "",
    storageBucket: "",
    messagingSenderId: "",
    appId: ""
};

// Initialize Firebase
if (!firebase.apps.length) {
    firebase.initializeApp(firebaseConfig);
}
const db = firebase.database();
const auth = firebase.auth();

// Mount point
const app = document.getElementById('app');
if (!app) {
    console.error('[Kord] #app element not found');
}

// ============================================================
// THEME ENGINE
// ============================================================
const ThemeEngine = {
    themes: {
        dark: { bg: '#1a1a2e', surface: '#16213e', accent: '#5865F2', text: '#e0e0e0' },
        light: { bg: '#f0f2f5', surface: '#ffffff', accent: '#5865F2', text: '#1a1a2e' },
        midnight: { bg: '#0d0d0d', surface: '#1a1a1a', accent: '#00d4ff', text: '#e0e0e0' },
    },

    apply(name) {
        const t = this.themes[name] || this.themes.dark;
        document.documentElement.style.setProperty('--bg', t.bg);
        document.documentElement.style.setProperty('--surface', t.surface);
        document.documentElement.style.setProperty('--accent', t.accent);
        document.documentElement.style.setProperty('--text', t.text);
        localStorage.setItem('kord_theme', name);
    },

    init() {
        const saved = localStorage.getItem('kord_theme') || 'dark';
        this.apply(saved);
    }
};

// ============================================================
// AUTH
// ============================================================
const KordAuth = {
    user: null,

    async init() {
        return new Promise((resolve) => {
            auth.onAuthStateChanged((user) => {
                this.user = user;
                if (user) {
                    // Save displayName/photoURL to RTDB
                    db.ref(`users/${user.uid}`).update({
                        displayName: user.displayName || 'Usuário',
                        photoURL: user.photoURL || '',
                        lastSeen: firebase.database.ServerValue.TIMESTAMP,
                        online: true
                    });
                }
                resolve(user);
            });
        });
    },

    async signIn(email, password) {
        return auth.signInWithEmailAndPassword(email, password);
    },

    async signUp(email, password, displayName) {
        const cred = await auth.createUserWithEmailAndPassword(email, password);
        await cred.user.updateProfile({ displayName });
        db.ref(`users/${cred.user.uid}`).set({
            displayName, email, photoURL: '', joinedAt: Date.now(), online: true
        });
        return cred;
    },

    signOut() {
        if (this.user) {
            db.ref(`users/${this.user.uid}`).update({ online: false, lastSeen: Date.now() });
        }
        return auth.signOut();
    }
};

// ============================================================
// TOAST
// ============================================================
function showToast(message, type = 'info', duration = 3000) {
    const existing = document.querySelector('.kord-toast');
    if (existing) existing.remove();
    const toast = document.createElement('div');
    toast.className = 'kord-toast';
    toast.textContent = message;
    const colors = { success: '#10b981', error: '#ef4444', info: '#5865F2', warning: '#f59e0b' };
    toast.style.cssText = `
        position:fixed;bottom:24px;left:50%;transform:translateX(-50%);
        padding:12px 24px;background:${colors[type] || colors.info};color:white;
        border-radius:12px;font-weight:500;z-index:99999;cursor:pointer;
        animation:fadeIn .2s ease;
    `;
    toast.onclick = () => toast.remove();
    document.body.appendChild(toast);
    setTimeout(() => { toast.style.opacity = '0'; setTimeout(() => toast.remove(), 300); }, duration);
}

// ============================================================
// MAIN MOUNT — renders login or chat UI
// ============================================================
async function mountApp() {
    ThemeEngine.init();

    const user = await KordAuth.init();

    if (!user) {
        mountLogin();
    } else {
        mountChat(user);
    }
}

// ============================================================
// LOGIN SCREEN
// ============================================================
function mountLogin() {
    app.innerHTML = `
    <div class="kord-auth-bg">
        <div class="kord-auth-card">
            <h1>🔥 Kord Meet</h1>
            <p style="color:var(--text-secondary);margin-bottom:24px">Chat em tempo real, criptografado, P2P</p>
            <div id="auth-error" style="color:#ef4444;margin-bottom:12px;display:none"></div>
            <input type="email" id="email" placeholder="Email" class="kord-input" autocomplete="email">
            <input type="password" id="password" placeholder="Senha" class="kord-input" style="margin-top:8px" autocomplete="current-password">
            <button onclick="KordAuth.signIn(document.getElementById('email').value, document.getElementById('password').value).then(()=>location.reload()).catch(e=>{document.getElementById('auth-error').textContent=e.message;document.getElementById('auth-error').style.display='block'})" class="kord-btn-primary" style="margin-top:16px;width:100%">Entrar</button>
            <div style="text-align:center;margin-top:16px">
                <a href="#" onclick="document.querySelector('.kord-auth-card').innerHTML=document.getElementById('signup-tmpl').innerHTML;return false" style="color:var(--accent)">Criar conta</a>
            </div>
            <template id="signup-tmpl">
                <h2 style="margin-bottom:16px">Criar Conta</h2>
                <input type="text" id="reg-name" placeholder="Nome" class="kord-input" autocomplete="name">
                <input type="email" id="reg-email" placeholder="Email" class="kord-input" style="margin-top:8px" autocomplete="email">
                <input type="password" id="reg-pass" placeholder="Senha (8+ caracteres)" class="kord-input" style="margin-top:8px" autocomplete="new-password">
                <button onclick="KordAuth.signUp(document.getElementById('reg-email').value,document.getElementById('reg-pass').value,document.getElementById('reg-name').value).then(()=>location.reload()).catch(e=>{document.getElementById('auth-error').textContent=e.message;document.getElementById('auth-error').style.display='block'})" class="kord-btn-primary" style="margin-top:16px;width:100%">Registrar</button>
            </template>
        </div>
    </div>`;
}

// ============================================================
// CHAT UI (loads core + mounts full UI)
// ============================================================
async function mountChat(user) {
    app.innerHTML = `
    <div class="kord-chat-layout">
        <!-- Sidebar -->
        <aside class="kord-sidebar">
            <div class="kord-sidebar-header">
                <span class="material-icons-round" style="color:var(--accent)">hub</span>
                <span style="font-weight:700;font-size:1.1rem">Kord Meet</span>
            </div>
            <div class="kord-sidebar-section">
                <div class="kord-sidebar-title">CANAIS</div>
                <div id="channels-list"></div>
                <button class="kord-sidebar-add" onclick="KordUI.createChannel()">+ Adicionar canal</button>
            </div>
            <div class="kord-sidebar-section" style="margin-top:auto">
                <div class="kord-user-info">
                    <img src="${user.photoURL || 'https://api.dicebear.com/7.x/initials/svg?seed=' + user.uid}" class="kord-avatar-sm">
                    <span>${user.displayName || 'Usuário'}</span>
                    <button onclick="KordAuth.signOut().then(()=>location.reload())" title="Sair" style="margin-left:auto;background:none;border:none;color:var(--text-secondary);cursor:pointer">✕</button>
                </div>
            </div>
        </aside>

        <!-- Main content -->
        <main class="kord-main">
            <div id="kord-header"></div>
            <div id="kord-messages" class="kord-messages"></div>
            <div id="kord-compose" class="kord-compose-area">
                <input type="text" id="msg-input" placeholder="Mensagem #geral" class="kord-compose-input">
                <button onclick="KordCore.sendMessage()" class="kord-btn-send">Enviar</button>
            </div>
        </main>

        <!-- Members panel -->
        <aside class="kord-members" id="members-panel" style="display:none">
            <div class="kord-members-header">MEMBROS</div>
            <div id="members-list"></div>
        </aside>
    </div>

    <!-- Call UI -->
    <div id="call-ui" style="display:none;position:fixed;bottom:80px;right:20px;background:var(--surface);border-radius:16px;padding:12px;box-shadow:0 8px 32px rgba(0,0,0,.5);z-index:9998">
        <video id="localVideo" autoplay muted style="width:120px;border-radius:8px;object-fit:cover"></video>
        <video id="remoteVideo" autoplay style="width:240px;border-radius:8px;margin-top:8px"></video>
        <div style="margin-top:8px;display:flex;gap:8px">
            <button onclick="KordP2P.toggleMic()" id="mic-btn">🎤</button>
            <button onclick="KordP2P.toggleCam()" id="cam-btn">📹</button>
            <button onclick="KordP2P.endCall()" style="background:#ef4444;border:none;color:white;padding:6px 12px;border-radius:8px;cursor:pointer">✕</button>
        </div>
    </div>`;

    // Load core
    const { KordCore } = await import('./core/kord_core.js');
    const { KordP2P } = await import('../p2p/kord_connect.js');
    const { KordCrypto } = await import('../crypto/kord_crypto.js');

    window.KordCore = KordCore;
    window.KordP2P = KordP2P;
    window.KordCrypto = KordCrypto;

    // Init core with current user
    KordCore.init(user, db);

    // Keyboard: Enter sends message
    document.getElementById('msg-input').addEventListener('keydown', (e) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            KordCore.sendMessage();
        }
    });
}

// ============================================================
// BOOT
// ============================================================
document.addEventListener('DOMContentLoaded', mountApp);