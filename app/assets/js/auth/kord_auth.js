var currentUser = null;

document.addEventListener("DOMContentLoaded", () => {
    // Listen for auth state changes
    firebase.auth().onAuthStateChanged((user) => {
        if (user) {
            currentUser = user;
            console.log("Usuário logado:", user.email);
            document.getElementById('kordAuthModal').style.display = 'none';
            loadUserProfile(user.uid);

            if (typeof initAdminPanel === 'function') initAdminPanel();

            if (document.getElementById('view-kord').style.display === 'flex') {
                initKordCore();
            }
        } else {
            currentUser = null;
            console.log("Nenhum usuário logado.");
            document.getElementById('kordAuthModal').style.display = 'flex';
        }
    });

    // Patch switchView to enforce login on ALL views
    const originalSwitchView = window.switchView;
    if (originalSwitchView) {
        window.switchView = function (viewId) {
            if (!currentUser) {
                document.getElementById('kordAuthModal').style.display = 'flex';
                return;
            }
            originalSwitchView(viewId);
            if (viewId === 'kord' && currentUser) {
                initKordCore();
            }
        }
    }
});

// ============================================================
// 2FA PENDING DATA STORE
// ============================================================
let _pendingRegData = null;    // Store registration data during 2FA flow
let _pendingLoginEmail = null; // Store login email for 2FA
let _2faCooldown = 0;          // Prevent spam clicking

// ============================================================
// AJAX HELPER
// ============================================================
async function kordFetch(url, data) {
    const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data)
    });
    return res.json();
}

// ============================================================
// SHOW 2FA MODAL
// ============================================================
function showKord2FAModal(type, email, userName = '') {
    const existing = document.getElementById('kord-2fa-modal');
    if (existing) existing.remove();

    const modal = document.createElement('div');
    modal.id = 'kord-2fa-modal';
    modal.style.cssText = 'position:fixed;top:0;left:0;width:100%;height:100%;background:rgba(0,0,0,0.8);z-index:10000;display:flex;align-items:center;justify-content:center;';
    modal.innerHTML = `
        <div style="background:#1a1a2e;border-radius:16px;padding:40px;max-width:420px;width:90%;border:1px solid #2a2a4e;position:relative;">
            <button onclick="closeKord2FAModal()" style="position:absolute;top:16px;right:16px;background:none;border:none;color:#64748b;font-size:24px;cursor:pointer;">&times;</button>
            <h2 style="margin:0 0 8px 0;color:#fff;text-align:center;">${type === 'register' ? '🔐' : type === 'login' ? '🔒' : '🔑'} Verificação de Email</h2>
            <p id="kord-2fa-msg" style="color:#94a3b8;text-align:center;font-size:14px;margin:0 0 24px 0;">Enviamos um código de 6 dígitos para<br><strong style="color:#6366f1;">${email}</strong></p>
            <div style="display:flex;gap:8px;justify-content:center;margin-bottom:16px;">
                <input type="text" id="kord-2fa-code" maxlength="6" placeholder="000000" autocomplete="one-time-code"
                    style="width:140px;padding:14px;font-size:24px;text-align:center;letter-spacing:8px;
                           background:#0f0f23;border:2px solid #2a2a4e;border-radius:12px;
                           color:#fff;font-family:monospace;outline:none;"
                    onkeydown="if(event.key==='Enter')verifyKord2FACode('${type}','${email}')">
            </div>
            <button id="kord-2fa-submit" onclick="verifyKord2FACode('${type}','${email}')"
                style="width:100%;padding:14px;background:#6366f1;color:#fff;border:none;border-radius:10px;
                       font-size:15px;font-weight:600;cursor:pointer;margin-bottom:12px;">
                Verificar Código
            </button>
            <div style="text-align:center;">
                <span id="kord-2fa-timer" style="color:#64748b;font-size:13px;"></span>
                <button id="kord-2fa-resend" onclick="resendKord2FACode('${type}','${email}','${userName}')" disabled
                    style="background:none;border:none;color:#6366f1;font-size:13px;cursor:pointer;margin-left:8px;">
                    Reenviar código
                </button>
            </div>
            <p id="kord-2fa-error" style="color:#ef4444;text-align:center;font-size:13px;margin:12px 0 0 0;display:none;"></p>
        </div>
    `;
    document.body.appendChild(modal);

    // Start cooldown timer
    _2faCooldown = 60;
    startKord2FAtimer();

    // Auto-focus
    setTimeout(() => document.getElementById('kord-2fa-code')?.focus(), 100);
}

function closeKord2FAModal() {
    const m = document.getElementById('kord-2fa-modal');
    if (m) m.remove();
    _pendingRegData = null;
    _pendingLoginEmail = null;
}

function showKord2FAError(msg) {
    const el = document.getElementById('kord-2fa-error');
    if (el) { el.textContent = msg; el.style.display = 'block'; }
}

function clearKord2FAError() {
    const el = document.getElementById('kord-2fa-error');
    if (el) { el.textContent = ''; el.style.display = 'none'; }
}

function startKord2FAtimer() {
    const timerEl = document.getElementById('kord-2fa-timer');
    const resendBtn = document.getElementById('kord-2fa-resend');
    if (!timerEl) return;

    const tick = () => {
        if (_2faCooldown <= 0) {
            timerEl.textContent = '';
            if (resendBtn) resendBtn.disabled = false;
            return;
        }
        timerEl.textContent = `Aguarde ${_2faCooldown}s`;
        _2faCooldown--;
        setTimeout(tick, 1000);
    };
    tick();
}

// ============================================================
// VERIFY 2FA CODE
// ============================================================
async function verifyKord2FACode(type, email) {
    clearKord2FAError();
    const codeInput = document.getElementById('kord-2fa-code');
    const submitBtn = document.getElementById('kord-2fa-submit');
    if (!codeInput) return;

    const code = codeInput.value.trim();
    if (!code || code.length !== 6) {
        showKord2FAError('Digite o código de 6 dígitos.');
        return;
    }

    submitBtn.disabled = true;
    submitBtn.textContent = 'Verificando...';

    try {
        const result = await kordFetch('/api_email.php', { action: 'verify_2fa_code', email, code, type });

        if (result.success && result.verified) {
            closeKord2FAModal();

            if (type === 'register' && _pendingRegData) {
                // Complete registration
                await completeKordRegistration(_pendingRegData);
                _pendingRegData = null;
            } else if (type === 'login') {
                // 2FA verified — sign in now
                const pass = sessionStorage.getItem('_kord_login_pass');
                sessionStorage.removeItem('_kord_login_pass');
                if (pass) {
                    firebase.auth().signInWithEmailAndPassword(email, pass)
                        .then(() => showKordAlert("Sucesso", "Login bem-sucedido!", "check_circle", "#10b981"))
                        .catch(() => showKordAlert("Erro", "Login falhou após verificação.", "error", "#ef4444"));
                }
            } else if (type === 'passwordReset') {
                showKordAlert("Email Verificado", "Agora você pode redefinir sua senha.", "check_circle", "#10b981");
            }
        } else {
            showKord2FAError(result.error || 'Código incorreto.');
            submitBtn.disabled = false;
            submitBtn.textContent = 'Verificar Código';
        }
    } catch (e) {
        showKord2FAError('Erro de conexão. Tente novamente.');
        submitBtn.disabled = false;
        submitBtn.textContent = 'Verificar Código';
    }
}

// ============================================================
// RESEND 2FA CODE
// ============================================================
async function resendKord2FACode(type, email, userName = '') {
    if (_2faCooldown > 0) return;
    clearKord2FAError();
    _2faCooldown = 60;

    try {
        const result = await kordFetch('/api_email.php', {
            action: 'send_2fa_code', email, type, name: userName
        });

        if (result.success) {
            const msg = document.getElementById('kord-2fa-msg');
            if (msg) msg.innerHTML = `Novo código enviado para<br><strong style="color:#6366f1;">${email}</strong>`;
            startKord2FAtimer();
        } else {
            showKord2FAError(result.error || 'Falha ao reenviar.');
        }
    } catch (e) {
        showKord2FAError('Erro de conexão.');
    }
}

// ============================================================
// SEND 2FA CODE
// ============================================================
async function sendKord2FACode(type, email, userName = '', uid = null) {
    try {
        return await kordFetch('/api_email.php', {
            action: 'send_2fa_code', email, type, name: userName, uid
        });
    } catch (e) {
        return { error: 'Erro de conexão' };
    }
}

// ============================================================
// REGISTRATION FLOW (with 2FA)
// ============================================================
async function kordRegister() {
    const name = document.getElementById('kordRegName').value.trim();
    const email = document.getElementById('kordRegEmail').value.trim();
    const pass = document.getElementById('kordRegPassword').value;
    const bio = (document.getElementById('kordRegBio').value || '').trim();

    if (!email || !pass) return showKordAlert("Campos Obrigatórios", "Preencha email e senha.", "warning", "#f59e0b");
    if (pass.length < 6) return showKordAlert("Senha Fraca", "A senha deve ter no mínimo 6 caracteres.", "warning", "#f59e0b");

    // Store pending data
    _pendingRegData = { name, email, pass, bio };

    // Send 2FA code
    showKordAlert("Enviando Código...", "Aguarde enquanto enviamos o código de verificação.", "info", "#6366f1");

    const result = await sendKord2FACode('register', email, name);

    if (result.success) {
        showKord2FAModal('register', email, name);
    } else {
        showKordAlert("Erro", result.error || 'Não foi possível enviar o código de verificação.', "error", "#ef4444");
        _pendingRegData = null;
    }
}

// ============================================================
// COMPLETE REGISTRATION (after 2FA verified)
// ============================================================
async function completeKordRegistration(data) {
    const { name, email, pass, bio } = data;

    try {
        // Create Firebase Auth account
        const userCredential = await firebase.auth().createUserWithEmailAndPassword(email, pass);
        const uid = userCredential.user.uid;
        const displayName = name || email.split('@')[0];
        const baseNick = email.split('@')[0].toLowerCase().replace(/[^a-z0-9]/g, '');
        let nickname = baseNick;

        // Unique nickname
        const nickSnap = await firebase.database().ref('nicknames/' + nickname).once('value');
        if (nickSnap.exists()) {
            nickname = baseNick + Math.floor(1000 + Math.random() * 9000);
        }

        // Save registered_emails (unique email index)
        await firebase.database().ref('registered_emails/' + email.toLowerCase().replace('.', '_')).set(uid);

        // Create user profile
        const userData = {
            email: email,
            displayName: displayName,
            nickname: nickname,
            themeColor: '#6366f1',
            bio: bio || '',
            verified: true,
            twoFactorEnabled: false,
            createdAt: firebase.database.ServerValue.TIMESTAMP
        };

        if (_regAvatarBase64) {
            userData.photoURL = _regAvatarBase64;
        }

        await firebase.database().ref('users/' + uid).set(userData);
        await firebase.database().ref('nicknames/' + nickname).set(uid);

        // Update Firebase Auth profile
        await userCredential.user.updateProfile({
            displayName: displayName,
            photoURL: _regAvatarBase64 || null
        });

        _regAvatarBase64 = null;
        showKordAlert("Conta Criada!", `Bem-vindo ${displayName}! Seu email foi verificado.`, "celebration", "#10b981");

    } catch (error) {
        // If Firebase Auth fails (e.g. email already exists), clear registered_emails
        if (error.code === 'auth/email-already-in-use') {
            await firebase.database().ref('registered_emails/' + email.toLowerCase().replace('.', '_')).remove().catch(() => {});
        }
        showKordAlert("Falha no Registro", error.message || "Não foi possível criar sua conta.", "error", "#ef4444");
    }
}

// ============================================================
// LOGIN FLOW (with 2FA)
// ============================================================
function kordLogin() {
    const email = document.getElementById('kordAuthEmail').value.trim();
    const pass = document.getElementById('kordAuthPassword').value;

    if (!email || !pass) return showKordAlert("Campos Vazios", "Preencha todos os campos.", "warning", "#f59e0b");

    // Store password temporarily for after 2FA
    sessionStorage.setItem('_kord_login_pass', pass);
    _pendingLoginEmail = email;

    // Check if user has 2FA enabled
    firebase.database().ref('users').orderByChild('email').equalTo(email).once('value').then(snap => {
        const users = snap.val();
        let has2FA = false;
        if (users) {
            for (const uid in users) {
                if (users[uid].twoFactorEnabled) { has2FA = true; break; }
            }
        }

        if (has2FA) {
            // Send login 2FA code
            showKordAlert("Verificação", "Enviando código para seu email...", "info", "#6366f1");
            sendKord2FACode('login', email).then(result => {
                if (result.success) {
                    showKord2FAModal('login', email);
                } else {
                    showKordAlert("Erro", result.error || "Falha ao enviar código.", "error", "#ef4444");
                    sessionStorage.removeItem('_kord_login_pass');
                }
            });
        } else {
            // No 2FA — direct login
            firebase.auth().signInWithEmailAndPassword(email, pass)
                .then(() => {
                    sessionStorage.removeItem('_kord_login_pass');
                    showKordAlert("Sucesso", "Login bem-sucedido!", "check_circle", "#10b981");
                })
                .catch(error => {
                    sessionStorage.removeItem('_kord_login_pass');
                    showKordAlert("Falha no Acesso", error.message, "error", "#ef4444");
                });
        }
    }).catch(() => {
        // User not found — try direct login to get proper error
        firebase.auth().signInWithEmailAndPassword(email, pass)
            .then(() => showKordAlert("Sucesso", "Login bem-sucedido!", "check_circle", "#10b981"))
            .catch(error => showKordAlert("Falha no Acesso", error.message, "error", "#ef4444"));
    });
}

// ============================================================
// FORGOT PASSWORD (with 2FA)
// ============================================================
async function kordResetPassword() {
    const email = prompt("Digite seu email para redefinir a senha:");
    if (!email) return;

    // Send reset 2FA code first
    showKordAlert("Enviando Código...", "Aguarde...", "info", "#6366f1");

    const result = await sendKord2FACode('passwordReset', email);

    if (result.success) {
        showKord2FAModal('passwordReset', email);
    } else {
        showKordAlert("Erro", result.error || "Falha ao enviar código.", "error", "#ef4444");
    }
}

// ============================================================
// FORGOT PASSWORD - VERIFIED (after 2FA)
// ============================================================
async function kordResetPasswordConfirmed(email, newPassword) {
    // Re-verify user has valid session
    const user = firebase.auth().currentUser;
    if (!user || user.email !== email) {
        showKordAlert("Erro", "Sessão inválida. Faça login novamente.", "error", "#ef4444");
        return;
    }

    try {
        await user.updatePassword(newPassword);
        showKordAlert("Sucesso", "Senha atualizada com sucesso!", "check_circle", "#10b981");
    } catch (e) {
        showKordAlert("Erro", "Não foi possível alterar a senha.", "error", "#ef4444");
    }
}

function switchAuthTab(tab) {
    const loginForm = document.getElementById('kordLoginForm');
    const registerForm = document.getElementById('kordRegisterForm');
    const tabLogin = document.getElementById('kordTabLogin');
    const tabRegister = document.getElementById('kordTabRegister');

    if (tab === 'login') {
        loginForm.style.display = 'flex';
        registerForm.style.display = 'none';
        tabLogin.style.background = 'rgba(99,102,241,0.3)';
        tabLogin.style.color = '#fff';
        tabRegister.style.background = 'transparent';
        tabRegister.style.color = '#94a3b8';
    } else {
        loginForm.style.display = 'none';
        registerForm.style.display = 'flex';
        tabRegister.style.background = 'rgba(16,185,129,0.3)';
        tabRegister.style.color = '#fff';
        tabLogin.style.background = 'transparent';
        tabLogin.style.color = '#94a3b8';
    }
}

let _regAvatarBase64 = null;

function previewRegAvatar(input) {
    const file = input.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (e) => {
        if (file.size > 500000) {
            const img = new Image();
            img.onload = () => {
                const canvas = document.createElement('canvas');
                const MAX_W = 300, MAX_H = 300;
                let w = img.width, h = img.height;
                if (w > MAX_W || h > MAX_H) {
                    const ratio = Math.min(MAX_W / w, MAX_H / h);
                    w = Math.round(w * ratio);
                    h = Math.round(h * ratio);
                }
                canvas.width = w;
                canvas.height = h;
                canvas.getContext('2d').drawImage(img, 0, 0, w, h);
                _regAvatarBase64 = canvas.toDataURL('image/jpeg', 0.7);
                const avatarDiv = document.getElementById('kordRegAvatar');
                if (avatarDiv) avatarDiv.innerHTML = `<img src="${_regAvatarBase64}" style="width:100%; height:100%; object-fit:cover; border-radius:50%;">`;
            };
            img.src = e.target.result;
        } else {
            _regAvatarBase64 = e.target.result;
            const avatarDiv = document.getElementById('kordRegAvatar');
            if (avatarDiv) avatarDiv.innerHTML = `<img src="${_regAvatarBase64}" style="width:100%; height:100%; object-fit:cover; border-radius:50%;">`;
        }
    };
    reader.readAsDataURL(file);
}

function kordLogout() {
    firebase.auth().signOut().then(() => {
        showKordAlert("Sessão Encerrada", "Logout realizado com sucesso.", "logout", "#94a3b8");
    });
}

function closeKordAuthModal() {
    if (currentUser) {
        document.getElementById('kordAuthModal').style.display = 'none';
    }
}

function loadUserProfile(uid) {
    firebase.database().ref('users/' + uid).once('value').then((snapshot) => {
        const data = snapshot.val();
        if (data) {
            currentUser.displayName = data.displayName || currentUser.email.split('@')[0];
            currentUser.nickname = data.nickname || null;

            if (data.photoURL && currentUser.photoURL !== data.photoURL) {
                currentUser.updateProfile({ photoURL: data.photoURL }).catch(e => console.error(e));
            }

            currentUser._kordPhotoURL = data.photoURL || currentUser.photoURL || null;

            if (!data.nickname) {
                const baseNick = currentUser.email.split('@')[0].toLowerCase().replace(/[^a-z0-9]/g, '');
                let nickname = baseNick;
                firebase.database().ref('nicknames/' + nickname).once('value').then(snap => {
                    if (snap.exists()) {
                        nickname = baseNick + Math.floor(1000 + Math.random() * 9000);
                    }
                    firebase.database().ref('users/' + uid).update({ nickname: nickname });
                    firebase.database().ref('nicknames/' + nickname).set(uid);
                    currentUser.nickname = nickname;
                });
            } else {
                firebase.database().ref('nicknames/' + data.nickname.toLowerCase()).set(uid);
            }

            document.getElementById('kord-user-name').innerText = currentUser.displayName;

            const kordAv = document.getElementById('kord-user-avatar');
            if (kordAv) {
                if (currentUser._kordPhotoURL) {
                    kordAv.innerHTML = `<img src="${currentUser._kordPhotoURL}" style="width:100%; height:100%; border-radius:50%; object-fit:cover;">`;
                    kordAv.style.background = 'transparent';
                } else {
                    kordAv.innerHTML = '';
                    kordAv.innerText = currentUser.displayName.charAt(0).toUpperCase();
                }
            }

            const globAv = document.getElementById('global-user-avatar');
            if (globAv) {
                if (currentUser._kordPhotoURL) {
                    globAv.src = currentUser._kordPhotoURL;
                } else {
                    globAv.src = `https://ui-avatars.com/api/?name=${encodeURIComponent(currentUser.displayName)}&background=3b82f6&color=fff&rounded=true&font-size=0.45`;
                }
            }

            firebase.database().ref(`users/${uid}/profile`).once('value').then(profSnap => {
                const pData = profSnap.val();
                if (pData) {
                    if (pData.themeColor) {
                        currentUser.themeColor = pData.themeColor;
                        if (typeof applyCustomTheme === 'function') applyCustomTheme(pData.themeColor);
                    }
                    if (pData.avatarDecoration && pData.avatarDecoration !== 'none') {
                        if (typeof currentSelectedDecoration !== 'undefined') currentSelectedDecoration = pData.avatarDecoration;
                        const avatar = document.getElementById('kord-user-avatar');
                        avatar.className = `dec-${pData.avatarDecoration}`;
                    }
                } else if (data.themeColor) {
                    currentUser.themeColor = data.themeColor;
                    if (typeof applyCustomTheme === 'function') applyCustomTheme(data.themeColor);
                }

                if (data.customCSS) {
                    currentUser.customCSS = data.customCSS;
                    if (typeof applyCustomCSS === 'function') applyCustomCSS(data.customCSS);
                }
            });
        }
    });
}

async function isKordNicknameAvailable(nick) {
    const cleanNick = nick.toLowerCase().trim();
    if (cleanNick.length < 3) return false;
    const snap = await firebase.database().ref('nicknames/' + cleanNick).once('value');
    return !snap.exists();
}