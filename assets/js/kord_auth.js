var currentUser = null;

document.addEventListener("DOMContentLoaded", () => {
    // Listen for auth state changes
    firebase.auth().onAuthStateChanged((user) => {
        if (user) {
            currentUser = user;
            console.log("Usuário logado:", user.email);
            document.getElementById('kordAuthModal').style.display = 'none';
            // Load user profile from DB
            loadUserProfile(user.uid);

            // Initialize admin panel if admin user
            if (typeof initAdminPanel === 'function') initAdminPanel();

            // If in kord view, fetch communities or update UI
            if (document.getElementById('view-kord').style.display === 'flex') {
                initKordCore();
            }
        } else {
            currentUser = null;
            console.log("Nenhum usuário logado.");
            // Show login modal globally - login required for entire site
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

function kordLogin() {
    const email = document.getElementById('kordAuthEmail').value;
    const pass = document.getElementById('kordAuthPassword').value;
    if (!email || !pass) return showKordAlert("Campos Vazios", "Preencha todos os campos para prosseguir.", "warning", "#f59e0b");

    firebase.auth().signInWithEmailAndPassword(email, pass)
        .then(() => {
            showKordAlert("Sucesso", "Login bem-sucedido!", "check_circle", "#10b981");
        })
        .catch(error => {
            showKordAlert("Falha no Acesso", "As credenciais informadas estão incorretas ou a conta não existe.", "error", "#ef4444");
        });
}

let _regAvatarBase64 = null;

function kordRegister() {
    const name = document.getElementById('kordRegName').value.trim();
    const email = document.getElementById('kordRegEmail').value.trim();
    const pass = document.getElementById('kordRegPassword').value;
    const bio = (document.getElementById('kordRegBio').value || '').trim();

    if (!email || !pass) return showKordAlert("Campos Obrigatórios", "Preencha email e senha.", "warning", "#f59e0b");
    if (pass.length < 6) return showKordAlert("Senha Fraca", "A senha deve ter no mínimo 6 caracteres.", "warning", "#f59e0b");

    firebase.auth().createUserWithEmailAndPassword(email, pass)
        .then(async (userCredential) => {
            const uid = userCredential.user.uid;
            const displayName = name || email.split('@')[0];
            const baseNick = email.split('@')[0].toLowerCase().replace(/[^a-z0-9]/g, '');
            let nickname = baseNick;

            // Ensure unique nickname on registration
            const nickSnap = await firebase.database().ref('nicknames/' + nickname).once('value');
            if (nickSnap.exists()) {
                nickname = baseNick + Math.floor(1000 + Math.random() * 9000);
            }

            // Create profile with all data
            const userData = {
                email: email,
                displayName: displayName,
                nickname: nickname,
                themeColor: '#6366f1',
                bio: bio || '',
                createdAt: firebase.database.ServerValue.TIMESTAMP
            };

            // Save avatar if uploaded
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
            showKordAlert("Conta Criada!", `Bem-vindo ${displayName}! Seu perfil foi criado com sucesso.`, "celebration", "#10b981");
        })
        .catch(error => {
            showKordAlert("Falha no Registro", "Não foi possível criar sua conta. O e-mail informado já pode estar em uso ou ser inválido.", "error", "#ef4444");
        });
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

function previewRegAvatar(input) {
    const file = input.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (e) => {
        // Compress large images to avoid RTDB bloat (max ~200KB base64)
        if (file.size > 500000) {
            const img = new Image();
            img.onload = () => {
                const canvas = document.createElement('canvas');
                const MAX_W = 300;
                const MAX_H = 300;
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
                if (avatarDiv) {
                    avatarDiv.innerHTML = `<img src="${_regAvatarBase64}" style="width:100%; height:100%; object-fit:cover; border-radius:50%;">`;
                }
            };
            img.src = e.target.result;
        } else {
            _regAvatarBase64 = e.target.result;
            const avatarDiv = document.getElementById('kordRegAvatar');
            if (avatarDiv) {
                avatarDiv.innerHTML = `<img src="${_regAvatarBase64}" style="width:100%; height:100%; object-fit:cover; border-radius:50%;">`;
            }
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
    // Only allow closing if user is logged in
    if (currentUser) {
        document.getElementById('kordAuthModal').style.display = 'none';
    }
}

function loadUserProfile(uid) {
    // Basic User Node
    firebase.database().ref('users/' + uid).once('value').then((snapshot) => {
        const data = snapshot.val();
        if (data) {
            currentUser.displayName = data.displayName || currentUser.email.split('@')[0];
            currentUser.nickname = data.nickname || null;

            // Sync database photoURL to Firebase Auth object for legacy users
            if (data.photoURL && currentUser.photoURL !== data.photoURL) {
                currentUser.updateProfile({ photoURL: data.photoURL }).catch(e => console.error(e));
            }

            // For immediate local use, we attach it to a custom property _photoURL as a fallback
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
                // Auto-sync existing nickname to index (ensures discoverability)
                firebase.database().ref('nicknames/' + data.nickname.toLowerCase()).set(uid);
            }

            document.getElementById('kord-user-name').innerText = currentUser.displayName;

            // Kord View Avatar
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

            // Global Top Right Avatar (Explore / Curation View)
            const globAv = document.getElementById('global-user-avatar');
            if (globAv) {
                if (currentUser._kordPhotoURL) {
                    globAv.src = currentUser._kordPhotoURL;
                } else {
                    globAv.src = `https://ui-avatars.com/api/?name=${encodeURIComponent(currentUser.displayName)}&background=3b82f6&color=fff&rounded=true&font-size=0.45`;
                }
            }

            // Load complex profile data (Nitro Settings)
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
                    // Fallback for old simple data
                    currentUser.themeColor = data.themeColor;
                    if (typeof applyCustomTheme === 'function') applyCustomTheme(data.themeColor);
                }

                // Add Custom CSS Injection loader
                if (data.customCSS) {
                    currentUser.customCSS = data.customCSS;
                    if (typeof applyCustomCSS === 'function') applyCustomCSS(data.customCSS);
                }
            });
        }
    });
}

/**
 * Check if a nickname is available
 * @param {string} nick 
 * @returns {Promise<boolean>} true if available
 */
async function isKordNicknameAvailable(nick) {
    const cleanNick = nick.toLowerCase().trim();
    if (cleanNick.length < 3) return false;
    const snap = await firebase.database().ref('nicknames/' + cleanNick).once('value');
    return !snap.exists();
}
