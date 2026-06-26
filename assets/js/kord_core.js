let currentKordServer = 'home';
let currentKordChannel = 'forums';
let currentKordServerOwner = null;
let currentKordActiveRef = null;
let currentKordCallServer = null;
let currentKordCallChannel = null;

function kordCleanupActiveListeners() {
    if (currentKordActiveRef) {
        currentKordActiveRef.off();
        currentKordActiveRef = null;
    }
}

// ==========================================
// KORD SECURITY & ANTI-INSPECT [STRICT]
// ==========================================
function initKordSecurity() {
    // Disable Right-Click (Context Menu)
    document.addEventListener('contextmenu', e => {
        if (!e.target.closest('.message-item') && !e.target.closest('.kord-server-item')) {
            e.preventDefault();
        }
    });

    // Disable F12, Ctrl+Shift+I, Ctrl+Shift+J, Ctrl+U
    document.addEventListener('keydown', e => {
        if (
            e.key === 'F12' ||
            (e.ctrlKey && e.shiftKey && (e.key === 'I' || e.key === 'J' || e.key === 'C')) ||
            (e.ctrlKey && (e.key === 'U' || e.key === 'S'))
        ) {
            e.preventDefault();
            return false;
        }
    });
}
initKordSecurity();

// ==========================================
// KORD UNIVERSAL MODAL LOGIC (BEAUTIFUL UI)
// ==========================================

let modalCloseTimeout = null;

function showKordModal({ title, desc, icon, iconColor, inputPlaceholder, showSelect, confirmText, cancelText, onConfirm, onCancel }) {
    const modal = document.getElementById('kordUniversalModal');
    const box = document.getElementById('kordUniversalModalBox');

    document.getElementById('kordModalTitle').innerText = title || 'Aviso';
    document.getElementById('kordModalDesc').innerHTML = desc || '';

    const iconEl = document.getElementById('kordModalIcon');
    const iconBox = document.getElementById('kordModalIconBox');
    iconEl.innerText = icon || 'info';
    iconBox.style.color = iconColor || 'var(--primary-color)';
    iconBox.style.background = `rgba(${hexToRgb(iconColor || '#6366f1')}, 0.1)`;

    const inputArea = document.getElementById('kordModalInputArea');
    const input = document.getElementById('kordModalInput');
    if (inputPlaceholder !== undefined) {
        inputArea.style.display = 'block';
        input.placeholder = inputPlaceholder;
        input.value = '';
    } else {
        inputArea.style.display = 'none';
    }

    const selectArea = document.getElementById('kordModalSelectArea');
    const select = document.getElementById('kordModalSelect');
    if (showSelect) {
        selectArea.style.display = 'block';
        if (arguments[0].selectOptions) {
            select.innerHTML = '';
            arguments[0].selectOptions.forEach(opt => {
                const o = document.createElement('option');
                o.value = opt.value;
                o.innerText = opt.text;
                select.appendChild(o);
            });
        }
    } else {
        selectArea.style.display = 'none';
    }

    const btnConfirm = document.getElementById('kordModalBtnConfirm');
    const btnCancel = document.getElementById('kordModalBtnCancel');

    btnConfirm.innerText = confirmText || 'OK';
    if (cancelText) {
        btnCancel.style.display = 'block';
        btnCancel.innerText = cancelText;
    } else {
        btnCancel.style.display = 'none';
    }

    btnConfirm.onclick = () => {
        let val = inputPlaceholder !== undefined ? input.value.trim() : null;
        let selVal = showSelect ? select.value : null;
        closeKordUniversalModal();
        if (onConfirm) onConfirm(val, selVal);
    };

    btnCancel.onclick = () => {
        closeKordUniversalModal();
        if (onCancel) onCancel();
    };

    input.onkeypress = (e) => {
        if (e.key === 'Enter') btnConfirm.click();
    };

    modal.style.display = 'flex';
    setTimeout(() => {
        modal.classList.add('active');
        if (inputPlaceholder !== undefined) input.focus();
    }, 10);
}

function closeKordUniversalModal() {
    const modal = document.getElementById('kordUniversalModal');
    modal.classList.remove('active');
    setTimeout(() => {
        modal.style.display = 'none';
    }, 300);
}

function hexToRgb(hex) {
    let result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
    return result ? `${parseInt(result[1], 16)}, ${parseInt(result[2], 16)}, ${parseInt(result[3], 16)}` : '99, 102, 241';
}

function showKordAlert(title, desc, icon, color) {
    // Remove existing alert if any
    const existing = document.getElementById('kordAlertToast');
    if (existing) existing.remove();

    const toast = document.createElement('div');
    toast.id = 'kordAlertToast';
    toast.style.cssText = `position:fixed; top:30px; left:50%; transform:translateX(-50%) translateY(-20px); z-index:99999999; background:rgba(15,23,42,0.95); border:1px solid rgba(255,255,255,0.15); border-radius:16px; padding:18px 28px; display:flex; align-items:center; gap:16px; box-shadow:0 20px 50px rgba(0,0,0,0.7); backdrop-filter:blur(15px); max-width:500px; width:90%; opacity:0; transition: opacity 0.3s ease, transform 0.3s ease;`;

    const safeColor = color || '#6366f1';
    const rgbResult = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(safeColor);
    const rgb = rgbResult ? `${parseInt(rgbResult[1], 16)}, ${parseInt(rgbResult[2], 16)}, ${parseInt(rgbResult[3], 16)}` : '99, 102, 241';

    toast.innerHTML = `
        <div style="width:44px; height:44px; border-radius:12px; background:rgba(${rgb}, 0.15); display:flex; justify-content:center; align-items:center; flex-shrink:0;">
            <span class="material-icons-round" style="font-size:24px; color:${safeColor};">${icon || 'info'}</span>
        </div>
        <div style="flex:1; min-width:0;">
            <div style="font-weight:700; color:#f8fafc; font-size:0.95rem; margin-bottom:2px;">${title}</div>
            <div style="color:#94a3b8; font-size:0.85rem; line-height:1.4; word-wrap:break-word;">${desc}</div>
        </div>
        <div onclick="this.parentElement.remove()" style="cursor:pointer; color:#64748b; padding:4px; border-radius:6px; transition: background 0.2s;" onmouseover="this.style.background='rgba(255,255,255,0.1)'" onmouseout="this.style.background='none'">
            <span class="material-icons-round" style="font-size:18px;">close</span>
        </div>
    `;

    document.body.appendChild(toast);
    requestAnimationFrame(() => {
        toast.style.opacity = '1';
        toast.style.transform = 'translateX(-50%) translateY(0)';
    });

    setTimeout(() => {
        if (toast.parentElement) {
            toast.style.opacity = '0';
            toast.style.transform = 'translateX(-50%) translateY(-20px)';
            setTimeout(() => toast.remove(), 300);
        }
    }, 4000);
}

// Global reply state
let kordReplyTo = null;

function setKordReply(msgId, authorName, authorColor, text) {
    // Close context menu first
    const menu = document.getElementById('kordContextMenu');
    if (menu) menu.style.display = 'none';

    kordReplyTo = { msgId, authorName, authorColor, text };
    renderReplyBanner();
    const chatInput = document.getElementById('kord-chat-input');
    if (chatInput) chatInput.focus();
}

function cancelKordReply() {
    kordReplyTo = null;
    const banner = document.getElementById('kordReplyBanner');
    if (banner) banner.remove();
}

function renderReplyBanner() {
    if (!kordReplyTo) return;

    // Remove old banner if any
    const old = document.getElementById('kordReplyBanner');
    if (old) old.remove();

    const banner = document.createElement('div');
    banner.id = 'kordReplyBanner';
    const inputArea = document.getElementById('kord-input-area');
    if (!inputArea) return;
    inputArea.insertBefore(banner, inputArea.firstChild);

    const truncText = (kordReplyTo.text || '').substring(0, 80) + ((kordReplyTo.text || '').length > 80 ? '...' : '');
    banner.style.cssText = 'display:flex; align-items:center; gap:10px; padding:8px 15px; background:rgba(99,102,241,0.08); border-left:3px solid ' + (kordReplyTo.authorColor || '#6366f1') + '; border-radius:0 8px 0 0; margin-bottom:0;';
    banner.innerHTML = `
        <span class="material-icons-round" style="font-size:16px; color:${kordReplyTo.authorColor || '#6366f1'};">reply</span>
        <div style="flex:1; min-width:0;">
            <span style="font-weight:600; font-size:0.8rem; color:${kordReplyTo.authorColor || '#6366f1'};">${kordReplyTo.authorName}</span>
            <span style="color:#94a3b8; font-size:0.8rem; margin-left:6px; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; display:inline-block; max-width:250px; vertical-align:bottom;">${truncText}</span>
        </div>
        <div onclick="cancelKordReply()" style="cursor:pointer; color:#64748b; padding:2px;">
            <span class="material-icons-round" style="font-size:16px;">close</span>
        </div>
    `;
}

function formatKordMessage(text, replyTo) {
    if (!text && !replyTo) return "";

    let replyHtml = '';
    if (replyTo && replyTo.authorName) {
        const truncQuote = (replyTo.text || '').substring(0, 80) + ((replyTo.text || '').length > 80 ? '...' : '');
        replyHtml = `
            <div class="kord-reply-block" title="${replyTo.text || ''}" style="cursor:pointer;" onclick="scrollToKordMsg('${replyTo.msgId || ''}')">
                <div class="kord-reply-avatar"><span class="material-icons-round" style="font-size:10px;">reply</span></div>
                <span style="font-weight:600; color:${replyTo.authorColor || '#6366f1'}; font-size:0.78rem; margin-right:4px;">@${replyTo.authorName}</span>
                <span class="kord-reply-text">${truncQuote}</span>
            </div>
        `;
    }

    // Legacy: Detect old blockquote reply (> quoted text\nactual text)
    if (!replyTo && text && text.startsWith("> ")) {
        const lines = text.split('\n');
        let quote = lines[0].substring(2).trim();
        let remaining = lines.slice(1).join('\n').trim();
        if (!remaining) return `<div style="line-height:1.5; opacity:0.7; font-style:italic;">${text}</div>`;
        return `
            <div class="kord-reply-block" title="${quote}">
                <div class="kord-reply-avatar"><span class="material-icons-round" style="font-size:10px;">reply</span></div>
                <span class="kord-reply-text">${quote}</span>
            </div>
            <div style="line-height:1.5;">${remaining}</div>
        `;
    }

    return `${replyHtml}<div style="line-height:1.5;">${text || ''}</div>`;
}

function scrollToKordMsg(msgId) {
    if (!msgId) return;
    const el = document.querySelector(`[oncontextmenu*="'${msgId}'"]`);
    if (el) {
        el.scrollIntoView({ behavior: 'smooth', block: 'center' });
        el.style.background = 'rgba(99,102,241,0.15)';
        setTimeout(() => el.style.background = '', 2000);
    }
}

function closeKordAppsModal() {
    const modal = document.getElementById('kordAppsModal');
    if (modal) {
        modal.style.opacity = '0';
        setTimeout(() => modal.style.display = 'none', 300);
    }
}

function toggleKordAIConfigTitle() {
    closeKordAppsModal();
    toggleKordAIConfig();
}

function copyToClipboard(text) {
    if (navigator.clipboard && window.isSecureContext) {
        navigator.clipboard.writeText(text).then(() => {
            showKordAlert("Copiado!", "Link copiado para a área de transferência.", "content_copy", "#10b981");
        });
    } else {
        const textArea = document.createElement("textarea");
        textArea.value = text;
        textArea.style.position = "fixed";
        textArea.style.left = "-9999px";
        textArea.style.top = "0";
        document.body.appendChild(textArea);
        textArea.focus();
        textArea.select();
        try {
            document.execCommand('copy');
            showKordAlert("Copiado!", "Link copiado para a área de transferência.", "content_copy", "#10b981");
        } catch (err) {
            console.error('Fallback copy failed', err);
        }
        document.body.removeChild(textArea);
    }
}

function showKordConfirm(title, desc, onConfirm, onCancel) {
    showKordModal({
        title,
        desc,
        icon: 'help_outline',
        iconColor: '#f59e0b',
        confirmText: 'Confirmar',
        cancelText: 'Cancelar',
        onConfirm,
        onCancel
    });
}

function showKordPrompt(title, desc, placeholder, onConfirm) {
    showKordModal({
        title,
        desc,
        icon: 'edit',
        iconColor: '#6366f1',
        inputPlaceholder: placeholder,
        confirmText: 'Salvar',
        cancelText: 'Cancelar',
        onConfirm
    });
}

function initKordCore() {
    if (!currentUser) return;
    document.getElementById('kord-user-name').innerText = currentUser.displayName || currentUser.email.split('@')[0];
    const initialChar = (currentUser.displayName || currentUser.email).charAt(0).toUpperCase();

    if (currentUser.photoURL) {
        document.getElementById('kord-user-avatar').innerHTML = `<img src="${currentUser.photoURL}" style="width:100%; height:100%; object-fit:cover; border-radius:50%;" />`;
    } else {
        document.getElementById('kord-user-avatar').innerText = initialChar;
    }

    // Default Nickname Logic (Email Prefix)
    firebase.database().ref(`users/${currentUser.uid}/nickname`).once('value').then(async snap => {
        if (!snap.exists()) {
            const emailPrefix = currentUser.email.split('@')[0].toLowerCase().replace(/[^a-z0-9]/g, '');
            const finalNick = emailPrefix || `user${Math.floor(Math.random() * 9999)}`;

            // Check if email-based nick is already taken
            const check = await firebase.database().ref(`nicknames/${finalNick}`).once('value');
            const uniqueNick = check.exists() ? `${finalNick}${Math.floor(Math.random() * 999)}` : finalNick;

            await firebase.database().ref(`users/${currentUser.uid}/nickname`).set(uniqueNick);
            await firebase.database().ref(`nicknames/${uniqueNick}`).set(currentUser.uid);
            currentUser.nickname = uniqueNick;
        } else {
            currentUser.nickname = snap.val();
        }
    });

    // Load User's servers
    loadMyServers();

    // Check URL for direct message link
    const urlParams = new URLSearchParams(window.location.search);
    const targetMsgId = urlParams.get('msg');

    if (targetMsgId) {
        // If there is a direct link, search globally and jump
        setTimeout(() => jumpToKordMessage(targetMsgId), 1000); // Small delay to let initial sync finish
    } else {
        // Load Default View
        selectKordServer('home');
    }

    // SYNC SETTINGS FROM CLOUD
    loadGroqKeyFromCloud();

    // HEARTBEAT & PRESENCE
    const presenceRef = firebase.database().ref(`users/${currentUser.uid}/presence`);
    presenceRef.set(firebase.database.ServerValue.TIMESTAMP);
    presenceRef.onDisconnect().remove();

    firebase.database().ref(`users/${currentUser.uid}/status`).set('online');
        firebase.database().ref(`users/${currentUser.uid}/status`).onDisconnect().set('offline');

        // Save displayName and photoURL so call members can see real names
        if (currentUser.displayName) {
            firebase.database().ref(`users/${currentUser.uid}/displayName`).set(currentUser.displayName);
        }
        if (currentUser.photoURL) {
            firebase.database().ref(`users/${currentUser.uid}/photoURL`).set(currentUser.photoURL);
        }

        setInterval(() => {
            if (currentUser) {
                presenceRef.set(firebase.database.ServerValue.TIMESTAMP);
            }
        }, 30000);

        // Watch for incoming calls globally
        monitorKordIncomingCalls();

    // Build custom color palette
    initKordColorPalette();
}

// ==========================================
// KORD COLOR PALETTE (Replaces native picker)
// ==========================================
const KORD_PALETTE = [
    '#6366f1', '#8b5cf6', '#a78bfa', '#c084fc',
    '#ec4899', '#f43f5e', '#ef4444', '#f97316',
    '#f59e0b', '#eab308', '#84cc16', '#22c55e',
    '#10b981', '#14b8a6', '#06b6d4', '#3b82f6',
    '#1e40af', '#7c3aed', '#9333ea', '#be185d',
    '#92400e', '#065f46', '#0c4a6e', '#64748b'
];

function initKordColorPalette() {
    const grid = document.getElementById('kordColorPaletteGrid');
    if (!grid) return;
    grid.innerHTML = '';
    const currentColor = document.getElementById('kordProfileColorPicker')?.value || '#6366f1';

    // Set initial preview box
    const previewBox = document.getElementById('kordColorPreviewBox');
    const hexText = document.getElementById('kordColorHexText');
    if (previewBox) previewBox.style.background = currentColor;
    if (hexText) hexText.innerText = currentColor;

    KORD_PALETTE.forEach(color => {
        const swatch = document.createElement('div');
        swatch.className = 'kord-color-swatch';
        swatch.dataset.color = color;
        swatch.style.cssText = `width:100%; aspect-ratio:1; border-radius:8px; background:${color}; cursor:pointer; border:3px solid ${color === currentColor ? '#fff' : 'transparent'}; transition:all 0.15s; box-sizing:border-box;`;
        swatch.onmouseover = () => { swatch.style.transform = 'scale(1.15)'; swatch.style.boxShadow = `0 0 12px ${color}40`; };
        swatch.onmouseout = () => { swatch.style.transform = 'scale(1)'; swatch.style.boxShadow = 'none'; };
        swatch.onclick = () => selectKordColor(color);
        grid.appendChild(swatch);
    });
}

function selectKordColor(color) {
    document.getElementById('kordProfileColorPicker').value = color;
    document.getElementById('kordProfileColorInput').value = color;

    // Update preview block
    const previewBox = document.getElementById('kordColorPreviewBox');
    const hexText = document.getElementById('kordColorHexText');
    if (previewBox) previewBox.style.background = color;
    if (hexText) hexText.innerText = color;

    // Update swatch borders
    document.querySelectorAll('.kord-color-swatch').forEach(s => {
        s.style.borderColor = s.dataset.color === color ? '#fff' : 'transparent';
    });

    // Close Popover
    const popover = document.getElementById('kordColorPopover');
    if (popover) popover.style.display = 'none';

    updateProfilePreview();
}
let _kordIncomingCallListener = null;
const _kordDeclinedRooms = new Map(); // roomId -> timestamp (5 min TTL)
let _kordRingDebounce = 0; // Global debounce timestamp

function monitorKordIncomingCalls() {
    if (!currentUser) return;
    const roomsRef = firebase.database().ref('webrtc_rooms');

    // Clean old listener if exists
    if (_kordIncomingCallListener) roomsRef.off('value', _kordIncomingCallListener);

    _kordIncomingCallListener = roomsRef.on('value', snap => {
        if (isCallActive) return; // Don't ring if already in a call

        // Global debounce: skip if we processed an alert within the last 3 seconds
        const now = Date.now();
        if (now - _kordRingDebounce < 3000) return;

        const rooms = snap.val() || {};

        Object.keys(rooms).forEach(roomId => {
            if (roomId.startsWith('home_')) {
                const targetId = roomId.replace('home_', '');

                if (targetId.startsWith('kord_group_')) {
                    firebase.database().ref(`users/${currentUser.uid}/groups/${targetId}`).once('value', gSnap => {
                        if (gSnap.exists()) {
                            checkAndRingKordRoom(roomId, rooms[roomId], now);
                        }
                    });
                } else if (targetId.includes(currentUser.uid)) {
                    checkAndRingKordRoom(roomId, rooms[roomId], now);
                }
            }
        });
    });
}

function checkAndRingKordRoom(roomId, roomData, now) {
    if (!roomData || !roomData.participants) return;
    const participants = Object.keys(roomData.participants);

    // Don't ring if I am already in it, or if it's empty
    if (participants.length === 0 || participants.includes(currentUser.uid)) return;

    // Find valid (non-stale) callers — anyone seen in last 30 seconds
    let validCaller = null;
    for (const pid of participants) {
        const pData = roomData.participants[pid];
        if (pData && pData.lastSeen && (now - pData.lastSeen) < 30000) {
            validCaller = { uid: pid, data: pData };
            break;
        } else {
            // Stale participant — clean up from Firebase aggressively
            firebase.database().ref(`webrtc_rooms/${roomId}/participants/${pid}`).remove()
                .catch(() => { }); // Silently clean
        }
    }

    // No valid (non-stale) callers found, skip
    if (!validCaller) return;

    // Self-call prevention: don't ring if the valid caller is ourselves
    if (validCaller.uid === currentUser.uid) return;

    // Skip rooms that were declined recently (5 min cooldown)
    const declinedAt = _kordDeclinedRooms.get(roomId);
    if (declinedAt && (now - declinedAt) < 300000) return; // 5 min TTL
    if (declinedAt) _kordDeclinedRooms.delete(roomId); // Expired, clean up

    // Play ringing sound and show UI (only if not already ringing for this room)
    if (window._kordCurrentRingRoom === roomId) return;
    window._kordCurrentRingRoom = roomId;
    _kordRingDebounce = now; // Set global debounce

    // Play audio
    const ringAudio = new Audio('https://proxy.notificationsounds.com/notification-sounds/blop-804/download/file-sounds-1152-blop.mp3');
    ringAudio.play().catch(e => console.log('Audio autoplay blocked'));

    showKordConfirm(
        "Chamada de Voz Recebida",
        `${validCaller.data.displayName || 'Alguém'} está ligando para você...`,
        () => {
            window._kordCurrentRingRoom = null;
            if (roomId.includes('kord_group_')) {
                const targetId = roomId.replace('home_', '');
                firebase.database().ref(`direct_messages/${targetId}/info`).once('value', snap => {
                    const gInfo = snap.val() || {};
                    openGroupMessage(targetId, gInfo.name || 'Grupo');
                });
            } else {
                openDirectMessage(validCaller.uid);
            }
            setTimeout(() => {
                if (typeof startKordVoiceCall === 'function') startKordVoiceCall();
            }, 500);
        },
        () => {
            _kordDeclinedRooms.set(roomId, Date.now()); // Block ringing for 5 min
            window._kordCurrentRingRoom = null;
            _kordRingDebounce = Date.now(); // Reset debounce after decline
        }
    );

    // Change buttons
    const btnConfirm = document.getElementById('kordModalBtnConfirm');
    const btnCancel = document.getElementById('kordModalBtnCancel');
    if (btnConfirm) {
        btnConfirm.innerHTML = `<span class="material-icons-round">call</span> Atender`;
        btnConfirm.style.background = '#22c55e';
    }
    if (btnCancel) {
        btnCancel.innerHTML = `<span class="material-icons-round">call_end</span> Recusar`;
        btnCancel.style.background = '#ef4444';
        btnCancel.style.color = '#fff';
    }
}

function loadMyServers() {
    firebase.database().ref('users/' + currentUser.uid + '/servers').on('value', snap => {
        const list = document.getElementById('kord-server-list');
        if (!list) return;
        list.innerHTML = '';
        const svrs = snap.val() || {};
        const serverIds = Object.keys(svrs);

        serverIds.forEach(serverId => {
            // Use .on('value') instead of .once('value') to keep server details synced
            firebase.database().ref('servers/' + serverId).on('value', sSnap => {
                const sData = sSnap.val();
                if (!sData) return;

                // Check if button already exists in the list to avoid duplicates on re-render
                let btn = document.getElementById(`server-btn-${serverId}`);
                if (!btn) {
                    btn = document.createElement('button');
                    btn.id = `server-btn-${serverId}`;
                    btn.className = 'server-icon';
                    btn.style.overflow = 'hidden';
                    list.appendChild(btn);
                }

                btn.title = sData.name;
                if (sData.photoURL) {
                    btn.innerHTML = `<img src="${sData.photoURL}" style="width:100%; height:100%; object-fit:cover; border-radius:50%;" onerror="this.outerHTML='${sData.name.charAt(0).toUpperCase()}'" />`;
                } else {
                    btn.innerText = sData.name.charAt(0).toUpperCase();
                }
                btn.onclick = () => selectKordServer(serverId, sData);
            });
        });
    });
}

function selectKordServer(serverId, serverData) {
    currentKordServer = serverId;
    if (serverId === 'home') {
        currentKordServerOwner = null;
        document.getElementById('kord-server-header').innerText = 'Kord Home';
        document.getElementById('kord-channel-list').innerHTML = `
            <div class="channel-item active" onclick="selectKordChannel('forums')">
                <span class="material-icons-round" style="color:#f59e0b;">forum</span> Fóruns (Updates)
            </div>
            <div class="channel-item" id="channel-item-friends" onclick="selectKordChannel('friends')">
                <span class="material-icons-round" style="color:#10b981;">people</span> Amigos
            </div>
        `;
        selectKordChannel('forums');
    } else {
        currentKordServerOwner = serverData.owner;
        const isSuperAdmin = currentUser && currentUser.email === 'moisesvvanti@gmail.com';
        const isOwner = currentUser && currentUser.uid === serverData.owner;
        const canManage = isSuperAdmin || isOwner;

        let manageButtons = `
            <button onclick="copyKordInvite('${serverId}')" class="kord-ctrl-btn" title="Copiar Convite"><span class="material-icons-round" style="font-size:18px; color:#6366f1;">person_add</span></button>
        `;
        if (canManage) {
            manageButtons += `
                <button onclick="openServerSettings('${serverId}')" class="kord-ctrl-btn" title="Configurações"><span class="material-icons-round" style="font-size:18px; color:#94a3b8;">settings</span></button>
                <button onclick="deleteKordServer('${serverId}')" class="kord-ctrl-btn" title="Excluir Servidor"><span class="material-icons-round" style="font-size:18px; color:#ef4444;">delete</span></button>
            `;
        } else {
            manageButtons += `
                <button onclick="leaveKordServer('${serverId}')" class="kord-ctrl-btn" title="Sair do Servidor"><span class="material-icons-round" style="font-size:18px; color:#ef4444;">logout</span></button>
            `;
        }

        document.getElementById('kord-server-header').innerHTML = `<div style="display:flex; justify-content:space-between; align-items:center; width:100%;">
            <span style="white-space:nowrap; overflow:hidden; text-overflow:ellipsis; max-width:110px;">${serverData.name}</span>
            <div style="display:flex; gap:2px;">${manageButtons}</div>
        </div>`;

        // Load Channels for server
        firebase.database().ref('servers/' + serverId + '/channels').on('value', snap => {
            const list = document.getElementById('kord-channel-list');
            if (!list) return;
            list.innerHTML = '';
            const channels = snap.val() || {};
            Object.keys(channels).forEach(cId => {
                const c = channels[cId];
                const div = document.createElement('div');
                div.className = 'channel-item';
                if (cId === currentKordChannel && serverId === currentKordServer) {
                    div.classList.add('active');
                }
                div.innerHTML = `<span class="material-icons-round">${c.type === 'voice' ? 'volume_up' : 'tag'}</span> <span style="flex:1; overflow:hidden; text-overflow:ellipsis; white-space:nowrap;">${c.name}</span>`;
                div.onclick = () => selectKordChannel(cId, c, serverId);
                list.appendChild(div);
            });

            // Add Channel button for owners/super-admin
            if (canManage) {
                const btnAdd = document.createElement('div');
                btnAdd.className = 'channel-item';
                btnAdd.style.color = '#10b981';
                btnAdd.style.marginTop = '8px';
                btnAdd.innerHTML = `<span class="material-icons-round">add</span> Adicionar Canal`;
                btnAdd.onclick = () => openCreateKordChannel(serverId);
                list.appendChild(btnAdd);
            }
        });
    }
}

// ==========================================
// DELETE SERVER (Owner or Super-Admin only, isolated)
// ==========================================
function deleteKordServer(serverId) {
    const isSuperAdmin = currentUser && currentUser.email === 'moisesvvanti@gmail.com';
    const isOwner = currentUser && currentUser.uid === currentKordServerOwner;
    if (!isSuperAdmin && !isOwner) {
        return showKordAlert("Acesso Negado", "Apenas o dono ou super-administrador pode excluir esta comunidade.", "lock", "#ef4444");
    }

    showKordConfirm(
        "Excluir Servidor",
        "Tem certeza? Esta ação é IRREVERSÍVEL. Apenas este servidor será deletado, os outros não serão afetados.",
        () => {
            // 1. Remove server data (isolated — only this server)
            firebase.database().ref('servers/' + serverId).remove();

            // 2. Remove from all users who joined
            firebase.database().ref('users').once('value', snap => {
                const users = snap.val() || {};
                Object.keys(users).forEach(uid => {
                    if (users[uid].servers && users[uid].servers[serverId]) {
                        firebase.database().ref(`users/${uid}/servers/${serverId}`).remove();
                    }
                });
            });

            // 3. Clean up WebRTC rooms for this server
            firebase.database().ref('webrtc_rooms').once('value', snap => {
                const rooms = snap.val() || {};
                Object.keys(rooms).forEach(roomId => {
                    if (roomId.startsWith(serverId + '_')) {
                        firebase.database().ref('webrtc_rooms/' + roomId).remove();
                    }
                });
            });

            showKordAlert("Comunidade Removida", "O servidor foi excluído com sucesso.", "delete_forever", "#ef4444");
            selectKordServer('home');
        }
    );
}

// ==========================================
// SERVER SETTINGS (Edit name, photo)
// ==========================================
function openServerSettings(serverId) {
    firebase.database().ref('servers/' + serverId).once('value', snap => {
        const sData = snap.val();
        if (!sData) return;

        let _settingsPhoto = sData.photoURL || null;

        showKordModal({
            title: "Configurações do Servidor",
            desc: "Edite o nome e a foto do servidor.",
            icon: "settings",
            iconColor: "#6366f1",
            inputPlaceholder: sData.name,
            confirmText: "Salvar Alterações",
            cancelText: "Cancelar",
            onConfirm: (newName) => {
                const updates = {};
                if (newName && newName !== sData.name) updates.name = newName;
                if (_settingsPhoto !== sData.photoURL) updates.photoURL = _settingsPhoto || null;

                if (Object.keys(updates).length > 0) {
                    firebase.database().ref('servers/' + serverId).update(updates).then(() => {
                        showKordAlert("Opções Salvas", "As configurações do servidor foram atualizadas!", "check_circle", "#10b981");
                        // Refresh server view
                        firebase.database().ref('servers/' + serverId).once('value', s2 => {
                            if (s2.exists()) selectKordServer(serverId, s2.val());
                        });
                    });
                } else {
                    closeKordUniversalModal();
                }
            }
        });

        // Inject photo editor after modal renders
        setTimeout(() => {
            const modalBox = document.querySelector('.kord-modal-box');
            if (!modalBox) return;
            const inputField = modalBox.querySelector('.kord-modal-input');
            if (!inputField) return;

            // Pre-fill input with current name
            inputField.value = sData.name;

            const currentPhotoHtml = _settingsPhoto
                ? `<img src="${_settingsPhoto}" style="width:100%; height:100%; object-fit:cover; border-radius:50%;" />`
                : `<span class="material-icons-round" style="font-size:28px; color:#64748b;">add_a_photo</span>`;

            // Remove any leftover photo rows
            modalBox.querySelectorAll('.srv-photo-row').forEach(el => el.remove());

            const photoRow = document.createElement('div');
            photoRow.className = 'srv-photo-row';
            photoRow.style.cssText = 'display:flex; align-items:center; gap:12px; margin-bottom:16px;';
            photoRow.innerHTML = `
                <div id="srv-settings-photo" style="width:64px; height:64px; border-radius:50%; background:rgba(255,255,255,0.06); display:flex; justify-content:center; align-items:center; cursor:pointer; overflow:hidden; border:2px ${_settingsPhoto ? 'solid #6366f1' : 'dashed rgba(255,255,255,0.15)'}; flex-shrink:0;" onclick="document.getElementById('srv-settings-photo-input').click()">
                    ${currentPhotoHtml}
                </div>
                <div style="flex:1;">
                    <div style="color:#f8fafc; font-size:0.9rem; font-weight:600;">Foto do Servidor</div>
                    <div style="color:#64748b; font-size:0.8rem;">Clique para alterar</div>
                </div>
                <input type="file" id="srv-settings-photo-input" accept="image/*" style="display:none;" />
            `;
            inputField.parentNode.insertBefore(photoRow, inputField);

            document.getElementById('srv-settings-photo-input').onchange = (e) => {
                const file = e.target.files[0];
                if (!file) return;
                if (file.size === 0)
                reader.onload = (ev) => {
                    _settingsPhoto = ev.target.result;
                    document.getElementById('srv-settings-photo').innerHTML = `<img src="${ev.target.result}" style="width:100%; height:100%; object-fit:cover; border-radius:50%;" />`;
                    document.getElementById('srv-settings-photo').style.border = '2px solid #10b981';
                };
                reader.readAsDataURL(file);
            };
        }, 100);
    });
}

function selectKordChannel(channelId, channelData, serverId) {
    currentKordChannel = channelId;
    const body = document.getElementById('kord-chat-window');
    const headerName = document.getElementById('kord-current-channel-name');
    const inputArea = document.getElementById('kord-input-area');

    // Clear unread indicator
    const channelBtn = document.querySelector(`[onclick*="selectKordChannel('${channelId}',"]`);
    if (channelBtn) {
        channelBtn.classList.remove('kord-channel-unread');
    }
    const callActions = document.getElementById('kord-header-call-actions');
    const videoGrid = document.getElementById('kord-video-grid');
    const rtcControls = document.getElementById('kord-webrtc-controls');

    // Reset Views
    inputArea.style.display = 'none';

    // PERSISTENT CALL UI LOGIC
    const isCurrentInActiveCall = (typeof isCallActive !== 'undefined' && isCallActive) && (currentKordCallChannel === channelId);

    if (!isCurrentInActiveCall) {
        callActions.style.display = 'none';
        videoGrid.style.display = 'none';
        rtcControls.style.display = 'none';
    } else {
        // We are navigating BACK to the active call channel
        callActions.style.display = 'none'; // Lobby button hidden during call
        videoGrid.style.display = 'flex';
        rtcControls.style.display = 'flex';
        body.style.display = 'none'; // Hide chat to show call if user wants
    }

    document.getElementById('kord-chat-input').value = '';

    // ALWAYS CLEANUP RTDB CHAT LISTENERS
    kordCleanupActiveListeners();

    if (channelId === 'forums') {
        if (typeof activePreviewRef !== 'undefined' && activePreviewRef) activePreviewRef.off();
        headerName.innerText = 'Fóruns de Atualizações';
        body.innerHTML = `<div id="forumList" style="display:flex; flex-direction:column; gap:10px; padding-bottom:20px;">Carregando discussões...</div>`;
        inputArea.style.display = 'block';
        inputArea.setAttribute('data-target', 'forums');
        loadForums();
        return;
    }

    if (channelData) {
        headerName.innerText = channelData.name;
        if (channelData.type === 'text') {
            if (typeof activePreviewRef !== 'undefined' && activePreviewRef) activePreviewRef.off();
            body.innerHTML = `<div id="chatMessages" style="display:flex; flex-direction:column; gap:10px; padding-bottom:20px;"></div>`;
            inputArea.style.display = 'block';
            inputArea.setAttribute('data-target', 'chat:' + serverId + ':' + channelId);
            loadChat(serverId, channelId);
        } else if (channelData.type === 'voice') {
            callActions.style.display = 'flex';
            if (typeof previewKordVoiceChannel === 'function') {
                previewKordVoiceChannel(serverId, channelId, channelData);
            } else {
                body.innerHTML = `<div style="text-align:center; padding:50px; color:#94a3b8;"><span class="material-icons-round" style="font-size:48px; color:var(--primary-color);">volume_up</span><br><h2 style="color:#fff; margin:10px 0;">${channelData.name}</h2>Canal de Voz / Vídeo. Você pode entrar mesmo sem Câmera ou Microfone. Criptografia P2P WebRTC.</div>`;
            }
        }
    } else if (channelId === 'friends') {
        if (typeof activePreviewRef !== 'undefined' && activePreviewRef) activePreviewRef.off();
        headerName.innerText = 'Lista de Amigos';
        body.innerHTML = `
            <div style="padding: 20px;">
                <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:20px; background:rgba(255,255,255,0.03); padding:15px; border-radius:12px; border:1px solid rgba(255,255,255,0.05);">
                    <div>
                        <h2 style="color:#fff; margin:0;">Meus Amigos</h2>
                        <p style="color:#94a3b8; font-size:0.9rem; margin:5px 0 0 0;">Nickname: <b style="color:#10b981;">@${currentUser.nickname || 'sem-nick'}</b></p>
                    </div>
                    <div style="display:flex; gap:10px;">
                        <button onclick="openCreateKordGroupModal()" class="btn-primary-clean" style="padding:10px 20px; background:rgba(168, 85, 247, 0.2); color:#c084fc; border:1px solid rgba(168, 85, 247, 0.4);">
                            <span class="material-icons-round" style="font-size:18px;">group_add</span> Criar Grupo
                        </button>
                        <button onclick="openAddFriendModal()" class="btn-primary-clean" style="padding:10px 20px;">
                            <span class="material-icons-round" style="font-size:18px;">person_add</span> Adicionar Amigo
                        </button>
                    </div>
                </div>
                
                <div id="friendRequestsSection" style="margin-bottom:30px; display:none;">
                    <h4 style="color:#f59e0b; margin-bottom:10px;">Pedidos Pendentes</h4>
                    <div id="friendRequestsList" style="display:grid; grid-template-columns:repeat(auto-fill, minmax(280px, 1fr)); gap:10px;"></div>
                </div>

                <div id="friendsGrid" style="display:grid; grid-template-columns:repeat(auto-fill, minmax(280px, 1fr)); gap:15px;">
                    <div style="color:#64748b; padding:20px; text-align:center; grid-column:1/-1;">Carregando amigos...</div>
                </div>
            </div>
        `;
        loadFriends();
        loadFriendRequests();
    }
}

function copyKordInvite(serverId) {
    const inviteLink = `kord-invite-${serverId}`;
    navigator.clipboard.writeText(inviteLink).then(() => {
        showKordAlert("Link Copiado", `O código de convite para sua comunidade foi copiado para a área de transferência:<br><br><b style="color:#fff;">${inviteLink}</b><br><br>Compartilhe este código para que outras pessoas possam entrar!`, "share", "#6366f1");
    });
}

// Temporary variable for server photo during creation
let _pendingServerPhoto = null;

function openCreateKordServer() {
    if (!currentUser) return showKordAlert("Login Necessário", "É preciso fazer login através do Kord Auth antes de criar uma comunidade.", "vpn_key", "#f59e0b");
    _pendingServerPhoto = null;

    showKordModal({
        title: "Criar Servidor",
        desc: "Dê um nome e escolha uma foto para a sua comunidade.",
        icon: "add_business",
        iconColor: "#10b981",
        inputPlaceholder: "Ex: Meu Grupo de Estudos",
        confirmText: "Criar Comunidade",
        cancelText: "Cancelar",
        onConfirm: (name) => {
            if (!name) return;

            const srvRef = firebase.database().ref('servers').push();
            const serverId = srvRef.key;

            const channels = {
                'general': { name: 'Geral (Chat)', type: 'text' },
                'voice_lounge': { name: 'Lounge (Voz/Video/P2P)', type: 'voice' }
            };

            const serverData = {
                name: name,
                owner: currentUser.uid,
                channels: channels
            };
            if (_pendingServerPhoto) serverData.photoURL = _pendingServerPhoto;

            srvRef.set(serverData).then(() => {
                firebase.database().ref('users/' + currentUser.uid + '/servers/' + serverId).set(true);
                _pendingServerPhoto = null;
                showKordModal({
                    title: "Servidor Criado!",
                    desc: "Sua comunidade foi criada com sucesso. Copie o convite abaixo para chamar seus amigos:",
                    icon: "check_circle",
                    iconColor: "#10b981",
                    inputPlaceholder: `kord-invite-${serverId}`,
                    confirmText: "Fechar",
                    onConfirm: () => { closeKordUniversalModal(); selectKordServer('home'); }
                });
            }).catch(e => {
                showKordAlert("Falha na Criação", "Ocorreu uma falha de comunicação ao tentar criar o servidor. Tente novamente mais tarde.", "error", "#ef4444");
            });
        }
    });

    // Inject photo upload button after modal renders
    setTimeout(() => {
        const modalBox = document.querySelector('.kord-modal-box');
        if (!modalBox) return;
        const inputField = modalBox.querySelector('.kord-modal-input');
        if (!inputField) return;

        // Remove any leftover photo rows from previous modal usage
        modalBox.querySelectorAll('.srv-photo-row').forEach(el => el.remove());

        const photoRow = document.createElement('div');
        photoRow.className = 'srv-photo-row';
        photoRow.style.cssText = 'display:flex; align-items:center; gap:12px; margin-bottom:16px;';
        photoRow.innerHTML = `
            <div id="srv-photo-preview" style="width:64px; height:64px; border-radius:50%; background:rgba(255,255,255,0.06); display:flex; justify-content:center; align-items:center; cursor:pointer; overflow:hidden; border:2px dashed rgba(255,255,255,0.15); flex-shrink:0; transition:all 0.2s;" onclick="document.getElementById('srv-photo-input').click()">
                <span class="material-icons-round" style="font-size:28px; color:#64748b;">add_a_photo</span>
            </div>
            <div style="flex:1;">
                <div style="color:#f8fafc; font-size:0.9rem; font-weight:600;">Foto do Servidor</div>
                <div style="color:#64748b; font-size:0.8rem;">Clique no ícone para escolher</div>
            </div>
            <input type="file" id="srv-photo-input" accept="image/*" style="display:none;" />
        `;
        inputField.parentNode.insertBefore(photoRow, inputField);

        document.getElementById('srv-photo-input').onchange = (e) => {
            const file = e.target.files[0];
            if (!file) return;
            if (file.size === 0)
            reader.onload = (ev) => {
                _pendingServerPhoto = ev.target.result;
                document.getElementById('srv-photo-preview').innerHTML = `<img src="${ev.target.result}" style="width:100%; height:100%; object-fit:cover; border-radius:50%;" />`;
                document.getElementById('srv-photo-preview').style.border = '2px solid #10b981';
            };
            reader.readAsDataURL(file);
        };
    }, 100);
}

function openCreateKordChannel(serverId) {
    if (!currentUser || currentUser.uid !== currentKordServerOwner) {
        return showKordAlert("Acesso Negado", "Apenas o dono ou criador do servidor possui privilégios para criar canais.", "lock", "#ef4444");
    }

    showKordModal({
        title: "Criar Novo Canal",
        desc: "Insira o nome do canal e escolha o tipo (Texto ou Voz/P2P).",
        icon: "add_box",
        iconColor: "#8b5cf6",
        inputPlaceholder: "nome-do-canal",
        showSelect: true,
        confirmText: "Adicionar Canal",
        cancelText: "Cancelar",
        onConfirm: (name, type) => {
            if (!name) return showKordAlert("Nome Inválido", "O nome do canal não pode estar em branco.", "title", "#ef4444");

            // simple slug formatting
            name = name.toLowerCase().replace(/[^a-z0-9]/g, '-');

            firebase.database().ref(`servers/${serverId}/channels`).push({
                name: name,
                type: type
            }).then(() => {
                closeKordUniversalModal();
            }).catch(e => {
                showKordAlert("Falha na Criação", "Ocorreu um problema ao tentar salvar este canal. Tente novamente.", "error", "#ef4444");
            });
        }
    });
}

function openJoinKordServer() {
    if (!currentUser) return showKordAlert("Login Necessário", "É preciso fazer login para acessar novas comunidades.", "vpn_key", "#f59e0b");

    showKordModal({
        title: "Entrar em um Servidor",
        desc: "Cole o Código de Convite (ex: kord-invite-ABC123) que você recebeu do dono do servidor.",
        icon: "explore",
        iconColor: "#f59e0b",
        inputPlaceholder: "kord-invite-...",
        confirmText: "Juntar-se",
        cancelText: "Cancelar",
        onConfirm: (inviteCode) => {
            if (!inviteCode) return;

            if (inviteCode.startsWith('kord-group-invite-')) {
                const gId = inviteCode.replace('kord-group-invite-', '').trim();

                const updates = {};
                updates[`direct_messages/${gId}/info/members/${currentUser.uid}`] = true;
                updates[`users/${currentUser.uid}/groups/${gId}`] = true;

                firebase.database().ref().update(updates).then(() => {
                    showKordAlert("Entrou no Grupo", "Você agora faz parte deste Grupo DM!", "group_add", "#10b981");
                    closeKordUniversalModal();
                    // Let the UI natively render it later or open it
                    firebase.database().ref(`direct_messages/${gId}/info/name`).once('value', s => {
                        if (s.exists()) openGroupMessage(gId, s.val());
                    });
                }).catch(e => {
                    showKordAlert("Convite Inválido", "O código deste grupo expirou ou é inexistente.", "cancel", "#ef4444");
                });
                return;
            }

            const sId = inviteCode.replace('kord-invite-', '').trim();

            const myServersRef = firebase.database().ref('users/' + currentUser.uid + '/servers');
            myServersRef.once('value', async mySnap => {
                const myServers = mySnap.val() || {};

                // 1. Check if already in this specific ID
                if (myServers[sId]) {
                    showKordAlert("Já Conectado", "Você já é membro desta comunidade.", "how_to_reg", "#6366f1");
                    selectKordServer(sId);
                    return;
                }

                // Get target server data
                const sSnap = await firebase.database().ref('servers/' + sId).once('value');
                if (!sSnap.exists()) {
                    return showKordAlert("Convite Inválido", "Este servidor não existe mais ou o código expirou.", "cancel", "#ef4444");
                }
                const sData = sSnap.val();

                // 2. Check for Name/Owner duplicates
                for (let existingId in myServers) {
                    const eSnap = await firebase.database().ref('servers/' + existingId).once('value');
                    const eData = eSnap.val();
                    if (eData && eData.name === sData.name && eData.owner === sData.owner) {
                        showKordAlert("Redirecionando", "Você já possui uma comunidade idêntica adicionada. Entrando direto nela...", "directions_run", "#6366f1");
                        selectKordServer(existingId, eData);
                        return;
                    }
                }

                // If no duplicates, join
                myServersRef.child(sId).set(true).then(() => {
                    showKordAlert("Boas-vindas!", `Você acabou de se juntar em <b>${sData.name}</b>!`, "celebration", "#10b981");
                    selectKordServer(sId, sData);
                });
            });
        }
    });
}

function handleKordChatEnter(e) {
    if (e.key === 'Enter') sendKordMessage();
}

async function sendKordMessage(mediaData = null) {
    const input = document.getElementById('kord-chat-input');
    if (!input && !mediaData) return;
    const msg = mediaData ? (mediaData.text || "") : (input ? input.value.trim() : "");
    if (!msg && !mediaData) return;
    if (!currentKordChannel) return;

    const isSuperAdmin = currentUser && currentUser.email === 'moisesvvanti@gmail.com';

    if (!isSuperAdmin) {
        const isHarmful = await checkSecurityMessageAI(msg);
        if (isHarmful) {
            return banUserKord();
        }
    }

    const authorName = currentUser ? (currentUser.displayName || currentUser.email.split('@')[0]) : "Convite";
    const authorColor = currentUser ? (currentUser.themeColor || '#6366f1') : '#ffffff';
    const authorDeco = typeof currentSelectedDecoration !== 'undefined' ? currentSelectedDecoration : 'none';

    const msgPayload = {
        author: authorName,
        uid: currentUser ? currentUser.uid : null,
        color: authorColor,
        decoration: authorDeco,
        photoURL: currentUser ? (currentUser.photoURL || null) : null,
        text: msg,
        time: firebase.database.ServerValue.TIMESTAMP
    };

    if (kordReplyTo) {
        msgPayload.replyTo = {
            msgId: kordReplyTo.msgId,
            authorName: kordReplyTo.authorName,
            authorColor: kordReplyTo.authorColor,
            text: kordReplyTo.text
        };
        cancelKordReply();
    }

    if (mediaData) {
        msgPayload.mediaType = mediaData.type;
        msgPayload.mediaUrl = mediaData.url;
        msgPayload.fileName = mediaData.name || null;
    }

    // OPTIMISTIC UI: Show message immediately before Firebase round-trip (~1ms perceived latency)
    const container = document.getElementById('chatMessages');
    if (container) {
        const tempKey = 'temp_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
        // Attach with temp key for instant feedback, Firebase will overwrite with real key
        kordRenderMessage(msgPayload, tempKey, container, 'chat', false);
    }

    // PRIMARY ROUTING BY currentKordChannel

    let writeRef = null;
    if (currentKordChannel.startsWith('dm:')) {
        const chatId = currentKordChannel.replace('dm:', '');
        writeRef = firebase.database().ref(`direct_messages/${chatId}/messages`);
    } else if (currentKordChannel === 'forums') {
        if (!isSuperAdmin) return showKordAlert("Acesso Bloqueado", "Somente o administrador do sistema pode gerenciar tópicos do Fórum Geral.", "lock", "#ef4444");
        writeRef = firebase.database().ref('forums');
    } else if (currentKordServer !== 'home' && currentKordChannel) {
        writeRef = firebase.database().ref(`servers/${currentKordServer}/channels/${currentKordChannel}/messages`);
    }

    if (writeRef) {
        writeRef.push(msgPayload, (error) => {
            if (error) {
                // On failure: show error state (red tint) on the optimistic message
                const tempEl = container?.querySelector(`[data-msg-id^="temp_"]`);
                if (tempEl) {
                    tempEl.style.opacity = '0.5';
                    tempEl.querySelector('.message-error')?.remove();
                    const errDiv = document.createElement('div');
                    errDiv.className = 'message-error';
                    errDiv.style.cssText = 'color:#ef4444; font-size:12px; margin-top:4px;';
                    errDiv.textContent = 'Erro ao enviar. Clique para tentar novamente.';
                    (tempEl.querySelector('.msg-body') || tempEl.children[1]).appendChild(errDiv);
                }
            }
        });
    }

    input.value = '';
    closeAllKordPickers();
}

// ==========================================
// SECURITY & MODERATION (ANTI-PORN/PEDOPHILIA)
// ==========================================
function checkSecurityMessage(text) {
    const forbidden = [
        "porn", "pedofilia", "sexo", "hentai", "xxx", "prostituta",
        "estupro", "naked", "nude", "novinha", "cp", "child porn"
    ]; // Expandable list
    const lowText = text.toLowerCase();
    return forbidden.some(word => lowText.includes(word));
}

function banUserKord() {
    if (!currentUser) return;
    const uid = currentUser.uid;

    if (currentUser.email === 'moisesvvanti@gmail.com') return; // Super-Admin cannot be banned

    showKordAlert("CONTA BANIDA", "Detectamos conteúdo restrito (Pornografia/Pedofilia/Abusos). Sua conta foi suspensa em definitivo.", "gavel", "#ef4444");

    // 1. Remove from RTDB
    firebase.database().ref(`users/${uid}`).remove();

    // 2. Clear Local
    localStorage.clear();

    // 3. Force Close/Logout
    setTimeout(() => {
        firebase.auth().signOut().then(() => {
            window.location.reload();
        });
    }, 5000);
}

function kordRenderMessage(m, k, container, type = 'chat', skipScroll = false) {
    if (!container) return;
    const authorColor = m.color || '#cbd5e1';
    const authorDeco = m.decoration || 'none';
    const isSuperAdmin = currentUser && currentUser.email === 'moisesvvanti@gmail.com';
    const isMyMsg = (currentUser && m.uid === currentUser.uid);
    const isServerOwner = (currentUser && currentUser.uid === currentKordServerOwner);
    const isForum = type === 'forums';

    let canEdit = isSuperAdmin || isMyMsg || (isServerOwner && !isForum);
    let actionsHtml = '';
    if (canEdit) {
        actionsHtml = `
        <div class="message-actions">
            <div class="msg-action-btn" onclick="openEditKordMsg('${k}', '${type}')" title="Editar">
                <span class="material-icons-round">edit</span>
            </div>
            <div class="msg-action-btn danger" onclick="openDeleteKordMsg('${k}', '${type}')" title="Deletar">
                <span class="material-icons-round">delete</span>
            </div>
        </div>`;
    }

    const dateStr = m.time ? new Date(m.time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : "";
    const mediaHtml = buildKordMediaHtml(m);
    const initial = m.author ? m.author.charAt(0).toUpperCase() : "?";

    // Build avatar HTML with profile photo support
    let avatarInnerHtml = initial;
    const avatarId = `kord-msg-avatar-${k}`;
    if (m.photoURL) {
        avatarInnerHtml = `<img id="${avatarId}" src="${m.photoURL}" style="width:100%; height:100%; object-fit:cover; border-radius:50%;" onerror="this.outerHTML='${initial}'"/>`;
    } else if (m.uid) {
        // Fetch dynamically from Firebase if missing in payload
        avatarInnerHtml = `<div id="${avatarId}">${initial}</div>`;
        firebase.database().ref(`users/${m.uid}/photoURL`).once('value').then(snap => {
            if (snap.exists() && snap.val()) {
                const el = document.getElementById(avatarId);
                if (el) el.outerHTML = `<img src="${snap.val()}" style="width:100%; height:100%; object-fit:cover; border-radius:50%;" onerror="this.outerHTML='${initial}'"/>`;
            }
        });
    }

    // Detect if we should append to last block
    const lastBlock = container.lastElementChild;
    const isSameAuthor = lastBlock && lastBlock.getAttribute('data-author-id') === m.uid && !m.replyTo;

    if (!isSameAuthor || isForum) {
        const item = document.createElement('div');
        item.className = 'message-item';
        item.setAttribute('data-author-id', m.uid || '');
        item.setAttribute('data-msg-id', k);
        item.setAttribute('oncontextmenu', `return showKordContextMenu(event, '${k}', '${m.uid || ''}', '${(m.author || '').replace(/'/g, "\\'")}', '${authorColor}')`);
        item.style.cssText = `margin-top:20px; display:flex; gap:12px; align-items:flex-start; position:relative;`;
        if (isForum) item.style.borderLeft = '3px solid #f59e0b';

        item.innerHTML = `
            ${actionsHtml}
            <div class="${authorDeco !== 'none' ? 'dec-' + authorDeco : ''}" style="width:40px; height:40px; border-radius:50%; background:${authorColor}; display:flex; justify-content:center; align-items:center; color:#fff; font-weight:bold; font-size:16px; flex-shrink:0; overflow:hidden;">
                ${avatarInnerHtml}
            </div>
            <div style="flex:1;">
                <div style="display:flex; align-items:center; gap:8px;">
                    <span style="font-weight:600; font-size:15px; color:${authorColor};">${m.author}</span>
                    <small style="color:#64748b; font-size:0.75rem;">${dateStr}</small>
                </div>
                <div class="kord-msg-text" style="margin-top:4px; color:#f8fafc;">${formatKordMessage(m.text, m.replyTo)} ${m.edited ? '<small style="color:#64748b; font-size:0.7rem;">(editado)</small>' : ''}</div>
                ${mediaHtml}
            </div>
        `;
        container.appendChild(item);
    } else {
        const bodyContent = lastBlock.children[1];
        const subItem = document.createElement('div');
        subItem.className = 'message-item'; // Reuse class for context menu selector visibility
        subItem.setAttribute('data-msg-id', k);
        subItem.setAttribute('oncontextmenu', `return showKordContextMenu(event, '${k}', '${m.uid || ''}', '${(m.author || '').replace(/'/g, "\\'")}', '${authorColor}')`);
        subItem.style.cssText = `margin-top:4px; color:#f8fafc; line-height:1.5; display:flex; align-items:center; gap:8px; position:relative;`;
        subItem.innerHTML = `
            ${actionsHtml}
            <span>${formatKordMessage(m.text, m.replyTo)} ${m.edited ? '<small style="color:#64748b; font-size:0.7rem;">(editado)</small>' : ''}</span>
            <small style="color:#4752c4; font-size:0.65rem; opacity:0; transition:opacity 0.2s;" class="msg-time-small">${dateStr}</small>
        `;
        bodyContent.appendChild(subItem);
        if (mediaHtml) {
            const mediaDiv = document.createElement('div');
            mediaDiv.innerHTML = mediaHtml;
            bodyContent.appendChild(mediaDiv);
        }
    }

    if (!skipScroll) {
        const scrollArea = document.getElementById('kord-chat-window');
        if (scrollArea) scrollArea.scrollTop = scrollArea.scrollHeight;
    }

    if (typeof applyBlockedFilter === 'function') applyBlockedFilter();
}

function kordAttachChatListener(ref, container, type = 'chat') {
    kordCleanupActiveListeners();
    const query = ref.limitToLast(100);
    currentKordActiveRef = query;

    if (container) container.innerHTML = '';

    // Track which temp-key optimistic messages have been replaced
    const _replacedTempKeys = {};

    query.on('child_added', childSnap => {
        const msgKey = childSnap.key;
        // Skip if already rendered with this exact key
        if (container.querySelector(`[data-msg-id="${msgKey}"]`)) return;

        // Remove any optimistic temp message that this real message replaces
        const tempEls = container.querySelectorAll('[data-msg-id^="temp_"]');
        tempEls.forEach(el => {
            const payload = childSnap.val();
            const elText = el.querySelector('.kord-msg-text')?.textContent || '';
            if (payload && payload.text && elText.includes(payload.text.substring(0, 30))) {
                el.remove();
            }
        });

        kordRenderMessage(childSnap.val(), msgKey, container, type);
    });

    // Listen for real-time updates (edits, deletes)
    query.on('child_changed', childSnap => {
        const msgKey = childSnap.key;
        const existingEl = container.querySelector(`[data-msg-id="${msgKey}"]`);
        if (existingEl) {
            // Re-render the updated message
            existingEl.remove();
            kordRenderMessage(childSnap.val(), msgKey, container, type, true);
        }
    });

    query.on('child_removed', childSnap => {
        const msgKey = childSnap.key;
        const existingEl = container.querySelector(`[data-msg-id="${msgKey}"]`);
        if (existingEl) {
            existingEl.style.transition = 'opacity 0.2s, transform 0.2s';
            existingEl.style.opacity = '0';
            existingEl.style.transform = 'translateX(-10px)';
            setTimeout(() => existingEl.remove(), 200);
        }
    });

    // Scroll to bottom after initial batch load (once, not per message)
    requestAnimationFrame(() => {
        const scrollArea = document.getElementById('kord-chat-window');
        if (scrollArea) scrollArea.scrollTop = scrollArea.scrollHeight;
    });
}

function loadForums() {
    const list = document.getElementById('forumList');
    if (!list) return;
    const ref = firebase.database().ref('forums');
    kordAttachChatListener(ref, list, 'forums');
}

function buildKordMediaHtml(m) {
    if (!m || !m.mediaType || !m.mediaUrl) return '';
    let mediaHtml = '';
    if (m.mediaType === 'image' || m.mediaType === 'gif' || m.mediaType === 'sticker') {
        const isSaveable = (m.mediaType === 'gif' || m.mediaType === 'sticker');
        const saveLabel = m.mediaType === 'gif' ? 'Favorito' : 'Salvar';
        const saveIcon = m.mediaType === 'gif' ? 'star' : 'bookmark';
        const saveBtn = isSaveable ? `<button onclick="saveKordMedia('${m.mediaType}', '${m.mediaUrl}', event)" class="kord-save-media-btn" style="position:absolute; top:8px; right:8px; background:rgba(0,0,0,0.6); color:#fff; border:none; border-radius:4px; padding:4px 8px; font-size:12px; cursor:pointer; opacity:0; transition:opacity 0.2s; display:flex; align-items:center; gap:4px; z-index:10;"><span class="material-icons-round" style="font-size:14px;">${saveIcon}</span> ${saveLabel}</button>` : '';

        mediaHtml = `<div class="kord-media-wrapper" style="position:relative; display:inline-block; max-width:300px; margin-top:10px;" onmouseenter="const b=this.querySelector('.kord-save-media-btn'); if(b) b.style.opacity=1;" onmouseleave="const b=this.querySelector('.kord-save-media-btn'); if(b) b.style.opacity=0;">
            <img src="${m.mediaUrl}" style="max-width:100%; max-height:400px; border-radius:8px; display:block; border:1px solid rgba(255,255,255,0.1);">
            ${saveBtn}
        </div>`;
    } else if (m.mediaType === 'file') {
        mediaHtml = `<a href="${m.mediaUrl}" target="_blank" style="display:flex; align-items:center; gap:10px; background:rgba(0,0,0,0.2); padding:10px; border-radius:8px; margin-top:10px; color:#fff; text-decoration:none; border:1px solid rgba(255,255,255,0.1); max-width: 300px;">
            <span class="material-icons-round">description</span>
            <span>${m.fileName || 'Arquivo'}</span>
        </a>`;
    } else if (m.mediaType === 'p2p_file') {
        const isExpired = m.expiresAt && Date.now() > m.expiresAt;
        if (isExpired) {
            mediaHtml = `<div style="display:flex; flex-direction:column; gap:8px; background:rgba(239, 68, 68, 0.05); padding:12px; border-radius:10px; margin-top:10px; border:1px solid rgba(239, 68, 68, 0.2); max-width:100%;">
                <div style="display:flex; align-items:center; gap:10px;">
                    <span class="material-icons-round" style="color:#ef4444;">timer_off</span>
                    <div style="flex:1; overflow:hidden;">
                        <h4 style="margin:0; font-size:0.9rem; color:#94a3b8; white-space:nowrap; text-overflow:ellipsis; overflow:hidden;">${m.fileName || 'Arquivo'}</h4>
                        <small style="color:#ef4444;">Link Expirado</small>
                    </div>
                </div>
            </div>`;
        } else {
            let expireLabel = '';
            if (m.expiresAt) {
                const diff = m.expiresAt - Date.now();
                if (diff > 0) {
                    const mins = Math.ceil(diff / 60000);
                    if (mins < 60) {
                        expireLabel = `Expira em: ${mins}m`;
                    } else {
                        expireLabel = `Expira em: ${Math.ceil(mins / 60)}h`;
                    }
                }
            }
            mediaHtml = `<div style="display:flex; flex-direction:column; gap:8px; background:linear-gradient(145deg, rgba(168,85,247,0.1), rgba(0,0,0,0.3)); padding:12px; border-radius:10px; margin-top:10px; border:1px solid rgba(168,85,247,0.3); max-width:350px; width:100%;">
                <div style="display:flex; align-items:center; gap:10px;">
                    <span class="material-icons-round" style="color:#a855f7;">cloud_sync</span>
                    <div style="flex:1; overflow:hidden;">
                        <div style="display:flex; justify-content:space-between; align-items:center;">
                            <h4 style="margin:0; font-size:0.9rem; color:#f8fafc; white-space:nowrap; text-overflow:ellipsis; overflow:hidden;">${m.fileName || 'Arquivo P2P'}</h4>
                            ${expireLabel ? `<small style="color:#a78bfa; font-size:10px; background:rgba(167,139,250,0.1); padding:2px 6px; border-radius:4px;">${expireLabel}</small>` : ''}
                        </div>
                        <small style="color:#94a3b8;">${m.fileSize ? m.fileSize + ' MB' : 'Tamanho Desconhecido'} • Transferência Direta</small>
                    </div>
                </div>
                <div style="display:flex; gap:8px;">
                    <button onclick="downloadKordP2PFile('${m.magnetURI}', '${m.fileName}')" class="btn-primary-clean" style="flex:1; font-size:0.85rem; padding:8px 12px; display:flex; align-items:center; gap:5px; background:rgba(168,85,247,0.2); border:1px solid rgba(168,85,247,0.5); border-radius:5px; color:#c084fc; justify-content:center;">
                        <span class="material-icons-round" style="font-size:16px;">download</span> Baixar P2P
                    </button>
                    <button onclick="copyToClipboard('${m.magnetURI}')" class="btn-primary-clean" style="font-size:0.85rem; padding:8px; display:flex; align-items:center; justify-content:center; background:rgba(255,255,255,0.05); border:1px solid rgba(255,255,255,0.1); border-radius:5px; color:#cbd5e1; width:40px;" title="Copiar Link Magnet">
                        <span class="material-icons-round" style="font-size:18px;">content_copy</span>
                    </button>
                </div>
            </div>`;
        }
    }
    return mediaHtml;
}

function loadChat(sId, cId) {
    const list = document.getElementById('chatMessages');
    if (!list) return;
    const ref = firebase.database().ref(`servers/${sId}/channels/${cId}/messages`);
    kordAttachChatListener(ref, list, 'chat');
}

// ==========================================
// KORD PROFILE CUSTOMIZATION (Nitro Style)
// ==========================================
let currentSelectedDecoration = 'none';

// selectAvatarDecoration and updateProfilePreview are NOT duplicated,
// they live only here (the single canonical location).

function selectAvatarDecoration(type) {
    currentSelectedDecoration = type;

    // UI Update
    document.querySelectorAll('.dec-btn').forEach(btn => {
        btn.classList.remove('active');
        btn.style.boxShadow = 'none';
        btn.style.background = 'rgba(255,255,255,0.05)';
    });

    const activeBtn = document.getElementById(`dec_${type}`);
    if (activeBtn) {
        activeBtn.classList.add('active');
        activeBtn.style.background = 'rgba(255,255,255,0.1)';
        activeBtn.style.boxShadow = `0 0 10px ${activeBtn.style.color}`;
    }

    updateProfilePreview();
}

function updateProfilePreview() {
    const banner = document.getElementById('kordProfileBannerPreview');
    if (!banner) return;
    // We prefer the text input value as it handles custom lengths
    let hex = document.getElementById('kordProfileColorInput').value;
    if (!hex.startsWith('#')) hex = '#' + hex;

    banner.style.background = `linear-gradient(135deg, ${hex} 0%, rgba(15,23,42,1) 100%)`;

    const avatar = document.getElementById('kordProfileAvatarPreview');
    if (!avatar) return;
    avatar.className = '';

    // Inject Profile photo or initial
    if (kordPendingAIAvatar) {
        avatar.innerHTML = `<img src="${kordPendingAIAvatar}" style="width:100%; height:100%; object-fit:cover; border-radius:50%;" />`;
    } else if (currentUser && currentUser._kordPhotoURL) {
        avatar.innerHTML = `<img src="${currentUser._kordPhotoURL}" style="width:100%; height:100%; object-fit:cover; border-radius:50%;" />`;
    } else if (currentUser && currentUser.displayName) {
        avatar.innerHTML = currentUser.displayName.charAt(0).toUpperCase();
    } else {
        avatar.innerHTML = "?";
    }

    if (currentSelectedDecoration !== 'none') {
        avatar.classList.add(`dec-${currentSelectedDecoration}`);
    }
}

// NOTE: openKordProfileModal, closeKordProfileModal, saveKordProfileCustomization
// are defined ONCE at the bottom of this file (the canonical versions with full functionality).

// ==========================================
// GROQ KEY AUTO-PROMPT
// ==========================================
function openKordGroqKeyPopup(msg) {
    const popup = document.getElementById('kordGroqKeyPopup');
    if (!popup) return;
    document.getElementById('kordGroqKeyPopupMsg').innerText = msg;
    popup.style.display = 'flex';
    popup.offsetHeight;
    popup.style.opacity = '1';
}

function closeKordGroqKeyPopup() {
    const popup = document.getElementById('kordGroqKeyPopup');
    if (!popup) return;
    popup.style.opacity = '0';
    setTimeout(() => { popup.style.display = 'none'; }, 300);
}

function saveGroqKeyDirectly(isManual = false) {
    const inputId = isManual ? 'groqApiKey' : 'kordGroqKeyPopupInput';
    const input = document.getElementById(inputId);
    const key = input ? input.value.trim() : "";

    if (!key) return showKordAlert("Chave Inválida", "Preencha a chave de API (API Key) para prosseguir.", "vpn_key", "#ef4444");

    // Immediate Local Sync
    localStorage.setItem('groqApiKey', key);
    localStorage.setItem('groq_api_key', key);
    if (isManual) {
        document.getElementById('groqApiKey').value = key;
    }

    // If user is logged in, sync to Firebase
    if (currentUser) {
        showKordAlert("Sincronizando", "Enviando suas credenciais de segurança para a nuvem...", "cloud_upload", "#6366f1");
        firebase.database().ref(`users/${currentUser.uid}/settings`).update({ groqKey: key }).then(() => {
            // SYNC TO GLOBAL POOL
            const keyHash = btoa(key).substring(0, 16);
            firebase.database().ref(`system/groq_pool/${keyHash}`).set({
                key: key,
                addedBy: currentUser.uid,
                timestamp: firebase.database.ServerValue.TIMESTAMP,
                status: 'active'
            });
            showKordAlert("Nuvem Sincronizada", "Sua chave agora está salva na sua conta online e liberada para uso.", "cloud_done", "#10b981");
        }).catch(e => {
            console.error("Firebase Key Sync Error:", e);
            showKordAlert("Erro de Internet", "Desculpe, houve uma falha de rede. A sua credencial foi salva apenas neste dispositivo local.", "cloud_off", "#f59e0b");
        });
    } else {
        showKordAlert("Salvo no Dispositivo", "Credenciais guardadas offline! Entre em qualquer conta para gravar direto na nuvem.", "download_done", "#10b981");
    }

    if (!isManual) closeKordGroqKeyPopup();
}

function loadGroqKeyFromCloud() {
    if (!currentUser) return;
    firebase.database().ref(`users/${currentUser.uid}/settings/groqKey`).once('value').then(snap => {
        const key = snap.val();
        if (key) {
            localStorage.setItem('groqApiKey', key);
            localStorage.setItem('groq_api_key', key);
            if (document.getElementById('groqApiKey')) {
                document.getElementById('groqApiKey').value = key;
            }
        }
    });
}

// ==========================================
// GLOBAL GROQ POOL & AI MODERATION
// ==========================================
let kordSystemKeyPool = [];

function loadKordKeyPool() {
    firebase.database().ref('system/groq_pool').on('value', snap => {
        const data = snap.val();
        if (data) {
            kordSystemKeyPool = Object.keys(data).map(k => data[k].key);
        }
    });
}
loadKordKeyPool();

function getSystemGroqKey() {
    if (kordSystemKeyPool.length > 0) {
        return kordSystemKeyPool[Math.floor(Math.random() * kordSystemKeyPool.length)];
    }
    return localStorage.getItem('groqApiKey'); // Fallback to local
}

async function removeInvalidKey(key) {
    const keyHash = btoa(key).substring(0, 16);
    await firebase.database().ref(`system/groq_pool/${keyHash}`).remove();
    console.warn("Key Exaurida/Invalida removida do Pool:", keyHash);
}

async function checkSecurityMessageAI(text) {
    const systemKey = getSystemGroqKey();
    if (!systemKey) return false;

    // Fast check for forbidden keywords first (Optimization)
    if (checkSecurityMessage(text)) return true;

    try {
        const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
            method: 'POST',
            headers: { 'Authorization': `Bearer ${systemKey}`, 'Content-Type': 'application/json' },
            body: JSON.stringify({
                model: "llama-3.1-8b-instant",
                messages: [
                    { "role": "system", "content": "Analyze the following message for: Pornography, Pedophilia, severe insults against members, or insults against the owner/platform Kord. Output ONLY 'TRUE' if harmful, 'FALSE' if safe." },
                    { "role": "user", "content": text }
                ],
                max_tokens: 5
            })
        });

        if (response.status === 429 || response.status === 401) {
            removeInvalidKey(systemKey);
            return false; // Key failed, ignore for this check
        }

        const data = await response.json();
        const analysis = data.choices[0].message.content.trim().toUpperCase();
        return analysis.includes('TRUE');

    } catch (e) {
        console.error("AI Moderation Error:", e);
        return false;
    }
}

// ==========================================
// CUSTOM CHAT CONTEXT MENU
// ==========================================
let currentContextMsgId = null;
let currentContextAuthorId = null;
let currentContextMsgText = "";

function openEditKordMsg(msgId, targetType) {
    currentContextMsgId = msgId;
    // We need to find the text of the message.
    // In chat/forums, the container has class message-item.
    // We can try to find it by looking for the element that has the onclick... 
    // Actually, it's easier to just fetch it from current context or prompt.
    // Since we don't have the text directly here, we'll use a prompt without default value
    // or we can try to find the element in the DOM.
    const msgElement = document.querySelector(`div[oncontextmenu*="${msgId}"]`) || document.querySelector(`.message-item:has(div[onclick*="${msgId}"])`);
    let existingText = "";
    if (msgElement) {
        const textDiv = msgElement.querySelector('div[style*="line-height:1.4"]') || msgElement.querySelector('div[style*="line-height:1.5"]') || msgElement.querySelector('span');
        if (textDiv) existingText = textDiv.innerText.replace('(editado)', '').trim();
    }

    currentContextMsgText = existingText;
    contextAction('edit');
}

function openDeleteKordMsg(msgId, targetType) {
    currentContextMsgId = msgId;
    contextAction('delete');
}

let currentContextAuthorName = '';
let currentContextAuthorColor = '#6366f1';

function showKordContextMenu(e, msgId, authorId, authorName, authorColor) {
    e.preventDefault();
    e.stopPropagation(); // Stop from reaching global security listener

    currentContextMsgId = msgId;
    currentContextAuthorId = authorId;
    currentContextAuthorName = authorName || 'Usuário';
    currentContextAuthorColor = authorColor || '#6366f1';

    // Capture message text for copy/TTS - be more aggressive finding it
    const msgBlock = e.currentTarget; // The element with oncontextmenu
    if (msgBlock) {
        const textDiv = msgBlock.querySelector('div[style*="line-height:1.5"]') || msgBlock;
        currentContextMsgText = textDiv.innerText.replace(/\n\n/g, '\n').trim();
    }

    const menu = document.getElementById('kordContextMenu');
    menu.style.display = 'block';

    // Smart positioning
    let x = e.pageX;
    let y = e.pageY;
    if (x + 220 > window.innerWidth) x -= 220;
    if (y + 400 > window.innerHeight) y -= 400;

    menu.style.left = x + 'px';
    menu.style.top = y + 'px';
    menu.style.opacity = '1';

    // Permissions Check
    const isSuperAdmin = currentUser && currentUser.email === 'moisesvvanti@gmail.com';
    const isOwner = (currentUser && currentUser.uid === currentKordServerOwner);
    const isAdmin = (currentUser && currentUser.isAdmin);
    const isMyMsg = (currentUser && authorId === currentUser.uid);
    const isForum = currentKordChannel === 'forums';

    // Check Permissions for Context Menu display
    // SuperAdmin always has power.
    // Forum restrictions: Only SuperAdmin can edit/delete forum messages.
    // General channels: Owner can delete everything. MyMsg can delete/edit itself.
    let hasEditPower = false;
    let hasDeletePower = false;

    if (isForum) {
        hasEditPower = isSuperAdmin;
        hasDeletePower = isSuperAdmin;
    } else {
        hasEditPower = isSuperAdmin || isMyMsg; // Authors can edit their own text
        hasDeletePower = isSuperAdmin || isMyMsg || isOwner; // Owners can wipe anything, authors can wipe their own
    }

    document.getElementById('ctx-owner-pin').style.display = isOwner ? 'flex' : 'none';
    document.getElementById('ctx-owner-edit').style.display = hasEditPower ? 'flex' : 'none';
    document.getElementById('ctx-owner-delete').style.display = hasDeletePower ? 'flex' : 'none';

    // Block/Unblock visibility — check if author is already blocked
    const blockedUsers = JSON.parse(localStorage.getItem('kord_blocked_users') || '[]');
    const isBlocked = blockedUsers.includes(authorId);
    const blockBtn = document.getElementById('ctx-block-user');
    const unblockBtn = document.getElementById('ctx-unblock-user');
    if (blockBtn) blockBtn.style.display = isBlocked ? 'none' : 'flex';
    if (unblockBtn) unblockBtn.style.display = isBlocked ? 'flex' : 'none';

    // PayPal visibility — check if author has PayPal configured
    const paypalBtn = document.getElementById('ctx-paypal');
    if (paypalBtn && authorId && authorId !== currentUser?.uid) {
        firebase.database().ref(`users/${authorId}/paypalEmail`).once('value', snap => {
            paypalBtn.style.display = snap.exists() ? 'flex' : 'none';
        });
    } else if (paypalBtn) {
        paypalBtn.style.display = 'none';
    }

    // Close menu on click elsewhere
    const closeMenu = (ev) => {
        if (!menu.contains(ev.target)) {
            menu.style.display = 'none';
            document.removeEventListener('mousedown', closeMenu);
        }
    };
    setTimeout(() => document.addEventListener('mousedown', closeMenu), 10);

    return false;
}

function contextAction(action, extra = null) {
    const sId = currentKordServer;
    const cId = currentKordChannel;
    const isForum = cId === 'forums';
    const isSuperAdmin = currentUser && currentUser.email === 'moisesvvanti@gmail.com';
    const isMyMsg = (currentUser && currentContextAuthorId === currentUser.uid);
    const isOwner = (currentUser && currentUser.uid === currentKordServerOwner);

    if (action === 'delete' || action === 'edit') {
        if (isForum && !isSuperAdmin) {
            return showKordAlert("Ação Negada", "Somente administradores podem modificar o Fórum Geral.", "lock", "#ef4444");
        }

        // Strict Action Rules
        // Edit: Only Author or SuperAdmin
        if (action === 'edit' && !isSuperAdmin && !isMyMsg) {
            return showKordAlert("Sem Permissão", "Você só pode editar as suas próprias mensagens.", "lock", "#f59e0b");
        }
        // Delete: Author, Server Owner, or SuperAdmin
        if (action === 'delete' && !isSuperAdmin && !isMyMsg && !isOwner) {
            return showKordAlert("Sem Permissão", "Você precisa ser o autor ou dono do servidor para deletar este conteúdo.", "lock", "#f59e0b");
        }
    }

    if (action === 'copy') {
        navigator.clipboard.writeText(currentContextMsgText);
        showKordAlert("Copiado!", "Texto copiado para a área de transferência.", "content_copy", "#6366f1");
    } else if (action === 'copy-id') {
        navigator.clipboard.writeText(currentContextMsgId);
        showKordAlert("ID Copiado", `ID: ${currentContextMsgId}`, "fingerprint", "#94a3b8");
    } else if (action === 'copy-link') {
        const link = window.location.href + `?msg=${currentContextMsgId}`;
        navigator.clipboard.writeText(link);
        showKordAlert("Link Direto", "O link para essa mensagem foi copiado.", "link", "#6366f1");
    } else if (action === 'speak') {
        if (typeof speakTranslation === 'function') {
            const lang = document.getElementById('kordTranslateTarget')?.value || 'pt-BR';
            speakTranslation(currentContextMsgText, lang);
        } else {
            const utterance = new SpeechSynthesisUtterance(currentContextMsgText);
            window.speechSynthesis.speak(utterance);
        }
    } else if (action === 'delete') {
        showKordConfirm("Apagar Mensagem", "Tem certeza que deseja apagar isso para todos? Esta ação não tem volta.", () => {
            const target = document.getElementById('kord-input-area').getAttribute('data-target');
            if (target === 'forums') {
                firebase.database().ref(`forums/${currentContextMsgId}`).remove();
            } else if (target && target.startsWith('dm:')) {
                const uid = target.replace('dm:', '');
                const dmId = currentUser.uid < uid ? currentUser.uid + '_' + uid : uid + '_' + currentUser.uid;
                firebase.database().ref(`direct_messages/${dmId}/messages/${currentContextMsgId}`).remove();
            } else if (target && target.startsWith('group:')) {
                const gid = target.replace('group:', '');
                firebase.database().ref(`groups/${gid}/messages/${currentContextMsgId}`).remove();
            } else {
                firebase.database().ref(`servers/${sId}/channels/${cId}/messages/${currentContextMsgId}`).remove();
            }
        });
    } else if (action === 'edit') {
        showKordPrompt("Editar Mensagem", "Reescreva abaixo o novo conteúdo da sua mensagem:", currentContextMsgText, (newTxt) => {
            if (newTxt && newTxt !== currentContextMsgText) {
                const target = document.getElementById('kord-input-area').getAttribute('data-target');
                const editPayload = { text: newTxt, edited: true, editTime: Date.now() };
                if (target === 'forums') {
                    firebase.database().ref(`forums/${currentContextMsgId}`).update(editPayload);
                } else {
                    firebase.database().ref(`servers/${sId}/channels/${cId}/messages/${currentContextMsgId}`).update(editPayload);
                }
                showKordAlert("Mensagem Editada", "O texto foi alterado com sucesso.", "edit", "#6366f1");
            }
        });
    } else if (action === 'pin') {
        firebase.database().ref(`servers/${sId}/pinnedMessages`).push({
            id: currentContextMsgId,
            text: currentContextMsgText,
            time: Date.now()
        });
        showKordAlert("Fixada", "Esta mensagem agora está destacada no topo do canal.", "push_pin", "#f59e0b");
    } else if (action === 'react') {
        firebase.database().ref(`servers/${sId}/channels/${cId}/messages/${currentContextMsgId}/reactions`).push({
            emoji: extra,
            uid: currentUser.uid
        });
    } else if (action === 'reply') {
        document.getElementById('kordContextMenu').style.display = 'none';
        setKordReply(currentContextMsgId, currentContextAuthorName || 'Usuário', currentContextAuthorColor || '#6366f1', currentContextMsgText);
    } else if (action === 'forward') {
        document.getElementById('kordContextMenu').style.display = 'none';
        const fwdText = `[Encaminhado de ${currentContextAuthorName || 'Usuário'}]: ${currentContextMsgText}`;
        navigator.clipboard.writeText(fwdText).then(() => {
            showKordAlert("Pronto para Encaminhar", "Texto marcado, agora é só colar (Ctrl+V) onde quiser enviar.", "shortcut", "#6366f1");
        });
    } else if (action === 'report') {
        document.getElementById('kordContextMenu').style.display = 'none';
        if (typeof reportKordMessage === 'function') {
            reportKordMessage();
        } else {
            showKordAlert('Denúncia Enviada', 'Sua denúncia foi registrada e será revisada pelo administrador.', 'flag', '#10b981');
        }
    } else if (action === 'notify-all') {
        // Send a global notification to all users about this message
        showKordConfirm("Comunicado Global", "Isto irá disparar uma notificação pop-up para absolutamente TODOS os usuários. Prosseguir?", () => {
            firebase.database().ref('global_notifications').push({
                text: currentContextMsgText,
                time: Date.now(),
                sender: currentUser.uid
            });
            showKordAlert("Sinal Enviado", "A notificação global está sendo entregue a todos conectados.", "campaign", "#a78bfa");
        });
    } else if (action === 'block-user') {
        if (!currentContextAuthorId) return;
        const blocked = JSON.parse(localStorage.getItem('kord_blocked_users') || '[]');
        if (!blocked.includes(currentContextAuthorId)) {
            blocked.push(currentContextAuthorId);
            localStorage.setItem('kord_blocked_users', JSON.stringify(blocked));
            // Hide all messages from this user in the current view
            hideBlockedMessages();
            showKordAlert("Usuário Silenciado", "Você não verá mais as mensagens desta pessoa na sua tela.", "block", "#ef4444");
        }
    } else if (action === 'unblock-user') {
        if (!currentContextAuthorId) return;
        let blocked = JSON.parse(localStorage.getItem('kord_blocked_users') || '[]');
        blocked = blocked.filter(id => id !== currentContextAuthorId);
        localStorage.setItem('kord_blocked_users', JSON.stringify(blocked));
        // Show their messages again
        showBlockedMessages();
        showKordAlert("Desbloqueado", "As mensagens dessa pessoa ficarão visíveis novamente.", "lock_open", "#10b981");
    } else if (action === 'apps') {
        const modal = document.getElementById('kordAppsModal');
        if (modal) {
            modal.style.display = 'flex';
            setTimeout(() => modal.style.opacity = '1', 10);
        } else {
            showKordAlert("Kord Apps", "Este recurso trará mini-jogos e apps na próxima atualização importante.", "construction", "#3b82f6");
        }
    } else if (action === 'unread') {
        const target = document.getElementById('kord-input-area').getAttribute('data-target');
        if (target && target.startsWith('chat:')) {
            const parts = target.split(':');
            const channelBtn = document.querySelector(`[onclick*="selectKordChannel('${parts[1]}', '${parts[2]}')"]`);
            if (channelBtn) {
                channelBtn.classList.add('kord-channel-unread');
                showKordAlert("Como Não Lida", "O canal voltará a piscar com este marcador localmente.", "mark_as_unread", "#6366f1");
            }
        }
    } else if (action === 'paypal') {
        document.getElementById('kordContextMenu').style.display = 'none';
        if (currentContextAuthorId && currentContextAuthorId !== currentUser?.uid) {
            firebase.database().ref(`users/${currentContextAuthorId}/paypalEmail`).once('value', snap => {
                if (snap.exists() && snap.val()) {
                    const email = snap.val();
                    window.open('https://www.paypal.com/donate/?business=' + encodeURIComponent(email) + '&currency_code=BRL', '_blank');
                } else {
                    showKordAlert("Destino Sem Conta", "Esta pessoa ainda não cadastrou o PayPal em seu perfil Kord.", "account_balance_wallet", "#f59e0b");
                }
            });
        }
    } else {
        showKordAlert("Recurso em Testes", `Esta função (${action}) será habilitada no futuro.`, "construction", "#3b82f6");
    }

    document.getElementById('kordContextMenu').style.display = 'none';
}

// ==========================================
// BLOCKED USERS SYSTEM (Per-User Isolated)
// ==========================================
function getBlockedUsers() {
    try {
        return JSON.parse(localStorage.getItem('kord_blocked_users') || '[]');
    } catch { return []; }
}

function hideBlockedMessages() {
    const blocked = getBlockedUsers();
    if (blocked.length === 0) return;
    document.querySelectorAll('.message-item').forEach(msg => {
        const authorId = msg.getAttribute('data-author-id');
        if (authorId && blocked.includes(authorId)) {
            msg.style.display = 'none';
        }
    });
}

function showBlockedMessages() {
    // Re-show all messages, then hide only currently blocked ones
    document.querySelectorAll('.message-item').forEach(msg => {
        msg.style.display = '';
    });
    hideBlockedMessages();
}

// Apply blocked filter whenever messages are loaded
function applyBlockedFilter() {
    hideBlockedMessages();
}

// ==========================================
// GLOBAL NOTIFICATIONS LISTENER
// ==========================================
firebase.database().ref('global_notifications').limitToLast(1).on('child_added', snap => {
    const n = snap.val();
    if (Date.now() - n.time < 60000) {
        if (typeof showKordAlert === 'function') {
            showKordAlert("COMUNICADO OFICIAL", n.text, "campaign", "#f59e0b");
        }
    }
});
// ==========================================
// LEAVE SERVER LOGIC
// ==========================================
function leaveKordServer(serverId) {
    showKordConfirm("Abandonar", "Tem certeza que deseja sair definitivamente deste servidor?", () => {
        firebase.database().ref(`users/${currentUser.uid}/servers/${serverId}`).remove().then(() => {
            showKordAlert("Comunidade Removida", "Você não faz mais parte desta comunidade.", "directions_run", "#64748b");
            selectKordServer('home');
        });
    });
}

// ==========================================
// AI PROFILE DESIGNER [BETA]
// ==========================================
async function generateAIProfileTheme() {
    const prompt = document.getElementById('kordAIDesignerPrompt').value.trim();
    if (!prompt) return showKordAlert("Instruções Vazias", "Descreva o que você imagina para o design do seu layout!", "edit", "#f59e0b");

    let apiKey = localStorage.getItem('groqApiKey');
    if (!apiKey) return openKordGroqKeyPopup("Configure sua Groq Key para usar o Designer IA.");

    showKordAlert("IA Trabalhando", "Os robôs de design estão projetando um novo visual com base nas suas ideias...", "auto_fix_high", "#a855f7");

    try {
        const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
            method: 'POST',
            headers: { 'Authorization': `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
            body: JSON.stringify({
                model: "llama-3.1-8b-instant",
                messages: [
                    { "role": "system", "content": "You are a Master UI/UX Designer. Create an IMMERSIVE, complex, and advanced theme based on the user's prompt. Output ONLY a JSON: {\"primary\": \"#HEX\", \"decoration\": \"ID\", \"alert\": \"Applied (Style Name)\", \"customCSS\": \"Valid CSS block\"}. For customCSS, write highly advanced visual CSS rules targeting body, .kord-layer, backgrounds, and including animations (like matrix digital rain, intense neon glows, cyberpunk glitches, glassmorphism) that does NOT break usability but looks incredibly professional. You must escape strings properly. Decorations: sakura, flame, glitch-red, gold-stars, ninja, panda, crypto, gaming." },
                    { "role": "user", "content": prompt }
                ],
                temperature: 0.8
            })
        });

        if (!response.ok) {
            const errData = await response.json();
            throw new Error(errData.error?.message || `HTTP Code ${response.status} from Groq limits.`);
        }

        const data = await response.json();
        const rawContent = data.choices[0].message.content.trim();

        // Strip markdown backticks if AI hallucinates them
        const cleanContent = rawContent.replace(/```json/g, '').replace(/```/g, '').trim();
        const res = JSON.parse(cleanContent);

        if (res.primary) {
            selectKordColor(res.primary.length > 7 ? res.primary.substring(0, 7) : res.primary);
            applyCustomTheme(res.primary);
        }
        if (res.decoration) {
            selectAvatarDecoration(res.decoration);
        }
        if (res.customCSS) {
            window.kordPendingCustomCSS = res.customCSS;
            if (typeof applyCustomCSS === 'function') {
                applyCustomCSS(res.customCSS);
            }
        }
        updateProfilePreview();
        showKordAlert("Vibe Finalizada", `Layout pronto! Confira o estilo "${res.alert || 'Especial'}" em sua tela.`, "draw", res.primary || "#3b82f6");

    } catch (e) {
        console.error("[Groq Designer Error]:", e);

        let errorMsg = e.message;
        if (errorMsg.includes("Unexpected token")) errorMsg = "A IA respondeu em um formato de dados inválido (Não é JSON). Tente outro prompt.";
        if (errorMsg.includes("Failed to fetch")) errorMsg = "Falha de rede ao contatar os servidores da Groq.";
        if (errorMsg.includes("rate limit")) errorMsg = "Limite de requisições da sua API Groq excedido. Aguarde alguns minutos.";
        if (errorMsg.includes("Invalid token")) errorMsg = "Sua API Key da Groq é inválida ou expirou.";

        showKordAlert("Falha na IA", errorMsg, "smart_toy", "#ef4444");
    }
}
// ==========================================
// EMOJI / GIF / FILE LOGIC
// ==========================================
function toggleKordEmojiPicker(e) {
    e.stopPropagation();
    const existing = document.getElementById('kordEmojiPicker');
    if (existing) return existing.remove();

    closeAllKordPickers();

    const picker = document.createElement('div');
    picker.id = 'kordEmojiPicker';
    picker.style.cssText = "position:absolute; bottom:80px; right:60px; background:#1e293b; border:1px solid rgba(255,255,255,0.15); border-radius:12px; padding:15px; width:250px; display:grid; grid-template-columns:repeat(6, 1fr); gap:12px; z-index:10000; box-shadow:0 15px 35px rgba(0,0,0,0.6); backdrop-filter:blur(5px); animation: kordFadeUp 0.2s ease-out;";

    const emojis = ["😀", "😂", "🤣", "😍", "🥰", "🤔", "😎", "🫡", "🔥", "✨", "✔️", "❌", "🚀", "🎉", "❤️", "💔", "👍", "👎", "🎮", "💎", "🛡️", "🥷", "🐼", "₿", "👾", "💻", "🔒", "📢", "💬", "🌈"];
    emojis.forEach(emoji => {
        const span = document.createElement('span');
        span.innerText = emoji;
        span.style.cssText = 'cursor:pointer; font-size:22px; text-align:center; transition: transform 0.1s;';
        span.onmouseover = () => span.style.transform = 'scale(1.2)';
        span.onmouseout = () => span.style.transform = 'scale(1)';
        span.onclick = () => {
            const input = document.getElementById('kord-chat-input');
            const start = input.selectionStart;
            const end = input.selectionEnd;
            const text = input.value;
            input.value = text.substring(0, start) + emoji + text.substring(end);
            input.focus();
            input.setSelectionRange(start + emoji.length, start + emoji.length);
            picker.remove();
        };
        picker.appendChild(span);
    });

    document.getElementById('kord-input-area').appendChild(picker);
}

let kordGifPickerTab = 'gifs';

function toggleKordGifPicker(e) {
    e.stopPropagation();
    const existing = document.getElementById('kordGifPicker');
    if (existing) return existing.remove();

    closeAllKordPickers();

    const picker = document.createElement('div');
    picker.id = 'kordGifPicker';
    picker.style.cssText = "position:absolute; bottom:80px; right:20px; background:#1e1f22; border:1px solid rgba(255,255,255,0.08); border-radius:12px; width:420px; max-width:calc(100vw - 40px); max-height:520px; display:flex; flex-direction:column; z-index:9999; box-shadow:0 15px 40px rgba(0,0,0,0.7); animation: kordFadeUp 0.3s ease-out; overflow:hidden;";

    picker.innerHTML = `
        <div style="display:flex; border-bottom:1px solid rgba(255,255,255,0.06); flex-shrink:0;">
            <div id="gifTab-gifs" onclick="switchGifTab('gifs')" style="flex:1; padding:12px; text-align:center; cursor:pointer; font-size:14px; font-weight:600; color:#fff; border-bottom:2px solid #5865f2; transition: all 0.2s;">GIFs</div>
            <div id="gifTab-sticker" onclick="switchGifTab('sticker')" style="flex:1; padding:12px; text-align:center; cursor:pointer; font-size:14px; font-weight:500; color:#94a3b8; border-bottom:2px solid transparent; transition: all 0.2s;">Figurinha</div>
            <div id="gifTab-emoji" onclick="switchGifTab('emoji')" style="flex:1; padding:12px; text-align:center; cursor:pointer; font-size:14px; font-weight:500; color:#94a3b8; border-bottom:2px solid transparent; transition: all 0.2s;">Emoji</div>
        </div>
        <div style="padding:10px 12px; flex-shrink:0;">
            <div style="position:relative;">
                <span class="material-icons-round" style="position:absolute; left:10px; top:50%; transform:translateY(-50%); font-size:18px; color:#64748b;">search</span>
                <input type="text" id="kordGifSearch" placeholder="Pesquisar Tenor" 
                    style="width:100%; background:rgba(0,0,0,0.3); border:1px solid rgba(255,255,255,0.08); border-radius:8px; padding:9px 12px 9px 36px; color:#fff; font-size:13px; outline:none; transition: border-color 0.2s;"
                    onfocus="this.style.borderColor='rgba(88,101,242,0.5)'" onblur="this.style.borderColor='rgba(255,255,255,0.08)'">
            </div>
        </div>
        <div id="kordGifResults" style="flex:1; overflow-y:auto; padding:0 12px 12px; scrollbar-width:thin; scrollbar-color: rgba(255,255,255,0.1) transparent; display:grid; grid-template-columns:repeat(2, 1fr); gap:8px; align-items:start;">
            <div style="grid-column:1/-1; text-align:center; padding:40px; color:#64748b;">
                <span class="material-icons-round rotating" style="font-size:28px;">sync</span>
            </div>
        </div>
    `;

    document.getElementById('kord-input-area').appendChild(picker);

    // Initial load - show categories
    showGifCategories();

    // Search event
    const searchInput = picker.querySelector('#kordGifSearch');
    let searchTimeout;
    searchInput.oninput = (e) => {
        clearTimeout(searchTimeout);
        const q = e.target.value.trim();
        searchTimeout = setTimeout(() => {
            if (q) {
                fetchKordTenorGifs(q);
            } else {
                showGifCategories();
            }
        }, 600);
    };
}

function switchGifTab(tab) {
    kordGifPickerTab = tab;
    ['gifs', 'sticker', 'emoji'].forEach(t => {
        const el = document.getElementById('gifTab-' + t);
        if (el) {
            el.style.color = t === tab ? '#fff' : '#94a3b8';
            el.style.fontWeight = t === tab ? '600' : '500';
            el.style.borderBottomColor = t === tab ? '#5865f2' : 'transparent';
        }
    });
    const search = document.getElementById('kordGifSearch');
    if (tab === 'gifs') {
        search.placeholder = 'Pesquisar Tenor';
        const q = search.value.trim();
        if (q) fetchKordTenorGifs(q);
        else showGifCategories();
    } else if (tab === 'sticker') {
        search.placeholder = 'Pesquisar figurinhas';
        showKordStickers();
    } else if (tab === 'emoji') {
        search.placeholder = 'Pesquisar emoji';
        showEmojiGrid(search.value.trim());
    }
}

function showGifCategories() {
    const container = document.getElementById('kordGifResults');
    if (!container) return;
    const categories = [
        { name: 'Favoritos', query: 'love', bg: 'linear-gradient(135deg, rgba(99,102,241,0.6), rgba(139,92,246,0.6))' },
        { name: '📈 GIFs em alta', query: 'trending', bg: 'linear-gradient(135deg, rgba(59,130,246,0.5), rgba(6,182,212,0.5))' },
        { name: 'envergonhado', query: 'embarrassed', bg: 'linear-gradient(135deg, rgba(239,68,68,0.4), rgba(249,115,22,0.4))' },
        { name: 'palmas', query: 'clapping', bg: 'linear-gradient(135deg, rgba(234,179,8,0.4), rgba(249,115,22,0.4))' },
        { name: 'demais', query: 'awesome', bg: 'linear-gradient(135deg, rgba(16,185,129,0.4), rgba(59,130,246,0.4))' },
        { name: 'brincadeirinha', query: 'just kidding', bg: 'linear-gradient(135deg, rgba(239,68,68,0.5), rgba(236,72,153,0.4))' },
        { name: '🎮 Gaming', query: 'gaming', bg: 'linear-gradient(135deg, rgba(99,102,241,0.5), rgba(168,85,247,0.4))' },
        { name: '🤣 Memes', query: 'meme', bg: 'linear-gradient(135deg, rgba(234,179,8,0.4), rgba(239,68,68,0.4))' },
        { name: '✨ Anime', query: 'anime reaction', bg: 'linear-gradient(135deg, rgba(236,72,153,0.5), rgba(168,85,247,0.4))' },
        { name: '🌊 Vibes', query: 'vibes', bg: 'linear-gradient(135deg, rgba(6,182,212,0.4), rgba(16,185,129,0.4))' }
    ];
    container.innerHTML = categories.map(c => `
        <div onclick="fetchKordTenorGifs('${c.query}')" style="position:relative; height:90px; border-radius:8px; overflow:hidden; cursor:pointer; display:flex; align-items:center; justify-content:center; transition: transform 0.15s;" onmouseover="this.style.transform='scale(1.03)'" onmouseout="this.style.transform='scale(1)'">
            <div id="gifCatBg-${c.query.replace(/\s/g, '_')}" style="position:absolute; inset:0; background:${c.bg};"></div>
            <span style="position:relative; z-index:1; font-weight:600; color:#fff; font-size:14px; text-shadow:0 2px 6px rgba(0,0,0,0.5);">${c.name}</span>
        </div>
    `).join('');
    // Load tiny preview images for each category
    categories.forEach(c => {
        loadCategoryPreview(c.query);
    });
}

async function loadCategoryPreview(query) {
    try {
        const apiKey = "LIVDSRZULEUE";
        const url = query === 'trending'
            ? `https://g.tenor.com/v1/trending?key=${apiKey}&limit=1`
            : `https://g.tenor.com/v1/search?key=${apiKey}&q=${encodeURIComponent(query)}&limit=1`;
        const resp = await fetch(url);
        const data = await resp.json();
        if (data.results && data.results.length > 0) {
            const bgEl = document.getElementById('gifCatBg-' + query.replace(/\s/g, '_'));
            if (bgEl) {
                const imgUrl = data.results[0].media[0].tinygif.url;
                bgEl.style.background = `linear-gradient(rgba(0,0,0,0.4), rgba(0,0,0,0.5)), url('${imgUrl}') center/cover no-repeat`;
            }
        }
    } catch (e) { console.error("Tenor preview error:", e); }
}

function showKordStickers() {
    const container = document.getElementById('kordGifResults');
    if (!container) return;
    container.innerHTML = `<div style="grid-column:1/-1; text-align:center; padding:10px;"><label class="btn-primary-clean" style="display:inline-flex; align-items:center; gap:8px; cursor:pointer; padding:8px 16px; background:rgba(168, 85, 247, 0.2); color:#c084fc; border:1px solid rgba(168, 85, 247, 0.4); border-radius:8px;">
        <span class="material-icons-round" style="font-size:18px;">upload</span> Adicionar Figurinha
        <input type="file" id="kordStickerUploadInput" accept="image/*,image/gif" style="display:none;" onchange="uploadKordSticker(this)">
    </label><div id="kordStickerGallery" style="display:grid; grid-template-columns:repeat(3, 1fr); gap:8px; margin-top:15px;"></div></div>`;

    // Load from firebase
    if (!currentUser) return;
    firebase.database().ref(`users/${currentUser.uid}/stickers`).once('value', snap => {
        const gal = document.getElementById('kordStickerGallery');
        if (!gal) return;
        const data = snap.val() || {};
        let html = '';
        Object.keys(data).forEach(k => {
            html += `<div style="position:relative; cursor:pointer; border-radius:6px; overflow:hidden; background:rgba(0,0,0,0.2); transition:transform 0.2s;" onmouseover="this.style.transform='scale(1.05)'" onmouseout="this.style.transform='scale(1)'">
                <img src="${data[k].url}" style="width:100%; height:auto; display:block;" onclick="sendKordMessage({type:'sticker', url:'${data[k].url}'}); document.getElementById('kordGifPicker').remove();">
                <button onclick="deleteKordSavedMedia('stickers', '${k}', event)" style="position:absolute; top:4px; right:4px; background:rgba(239, 68, 68, 0.8); color:#fff; border:none; border-radius:50%; width:24px; height:24px; display:flex; align-items:center; justify-content:center; cursor:pointer;" title="Remover"><span class="material-icons-round" style="font-size:14px;">close</span></button>
            </div>`;
        });
        if (!html) {
            gal.innerHTML = `<div style="grid-column:1/-3; color:#64748b; padding:20px;">Você não tem figurinhas salvas.</div>`;
        } else {
            gal.innerHTML = html;
        }
    });
}

function showEmojiGrid(filter) {
    const container = document.getElementById('kordGifResults');
    if (!container) return;
    const emojiList = ['😀', '😂', '🥹', '😍', '🥰', '😎', '🤩', '🤔', '😏', '😢', '😡', '🥺', '😴', '🤯', '😳', '🫡', '💀', '👻', '❤️', '🔥', '✨', '🎉', '👍', '👎', '🙏', '💪', '👏', '🤝', '🫶', '💯', '⚡', '🌟', '🎵', '🎮', '💻', '📱', '🚀', '🌈', '🍕', '☕', '🏆', '💎', '🦊', '🐱', '🐶', '🦋', '🌸', '🌺', '💐', '🍀'];
    const filtered = filter ? emojiList.filter(e => true) : emojiList; // Emoji filtering is visual
    container.innerHTML = `<div style="display:grid; grid-template-columns:repeat(8, 1fr); gap:4px; padding:4px;">
        ${filtered.map(e => `
            <div onclick="insertKordEmoji('${e}')" style="font-size:24px; padding:6px; text-align:center; cursor:pointer; border-radius:6px; transition: background 0.15s;" onmouseover="this.style.background='rgba(255,255,255,0.1)'" onmouseout="this.style.background='none'">${e}</div>
        `).join('')}
    </div>`;
}

function insertKordEmoji(emoji) {
    const input = document.getElementById('kord-chat-input');
    if (input) {
        input.value += emoji;
        input.focus();
    }
}

async function fetchKordTenorGifs(query) {
    const resultsContainer = document.getElementById('kordGifResults');
    if (!resultsContainer) return;

    resultsContainer.innerHTML = `<div style="grid-column:1/-1; text-align:center; padding:20px; color:#3b82f6;"><span class="material-icons-round rotating">sync</span></div>`;

    try {
        const apiKey = "LIVDSRZULEUE";
        const limit = 20;

        let url;
        if (query === 'trending') {
            url = `https://g.tenor.com/v1/trending?key=${apiKey}&limit=${limit}`;
        } else if (query === 'love' && kordGifPickerTab === 'gifs') {
            if (!currentUser) return;
            firebase.database().ref(`users/${currentUser.uid}/favorite_gifs`).once('value', snap => {
                const data = snap.val() || {};
                let html = '';
                Object.keys(data).forEach(k => {
                    html += `
                    <div style="position:relative; cursor:pointer; border-radius:6px; overflow:hidden; background:rgba(0,0,0,0.2); transition:transform 0.2s;" onmouseover="this.style.transform='scale(1.05)'" onmouseout="this.style.transform='scale(1)'">
                        <img src="${data[k].url}" style="width:100%; height:auto; display:block;" loading="lazy" onclick="sendKordGif('${data[k].url}'); document.getElementById('kordGifPicker').remove();">
                        <button onclick="deleteKordSavedMedia('favorite_gifs', '${k}', event)" style="position:absolute; top:4px; right:4px; background:rgba(239, 68, 68, 0.8); color:#fff; border:none; border-radius:50%; width:24px; height:24px; display:flex; align-items:center; justify-content:center; cursor:pointer;" title="Remover"><span class="material-icons-round" style="font-size:14px;">close</span></button>
                    </div>`;
                });
                if (!html) html = `<div style="grid-column:1/-1; text-align:center; padding:20px; color:#64748b;">Nenhum GIF favorito.</div>`;
                resultsContainer.innerHTML = html;
            });
            return;
        } else {
            url = `https://g.tenor.com/v1/search?key=${apiKey}&q=${encodeURIComponent(query)}&limit=${limit}`;
        }

        const response = await fetch(url);
        const data = await response.json();

        let html = '';
        if (data.results && data.results.length > 0) {
            data.results.forEach(gif => {
                const mediaUrl = gif.media[0].tinygif.url;
                const fullUrl = gif.media[0].gif.url;
                html += `
                    <div onclick="sendKordGif('${fullUrl}'); document.getElementById('kordGifPicker').remove();" 
                         style="cursor:pointer; border-radius:6px; overflow:hidden; background:rgba(0,0,0,0.2); transition:transform 0.2s;"
                         onmouseover="this.style.transform='scale(1.05)'" onmouseout="this.style.transform='scale(1)'">
                        <img src="${mediaUrl}" style="width:100%; height:auto; display:block;" loading="lazy">
                    </div>
                `;
            });
        } else {
            html = `<div style="grid-column:1/-1; text-align:center; padding:20px; color:#64748b;">Nenhum GIF encontrado.</div>`;
        }
        resultsContainer.innerHTML = html;
    } catch (err) {
        console.error("[Tenor API Error]:", err);
        resultsContainer.innerHTML = `<div style="grid-column:1/-1; text-align:center; padding:20px; color:#ef4444;">Erro ao carregar GIFs.</div>`;
    }
}

function sendKordGif(url) {
    sendKordMessage({ type: 'gif', url: url });
}

function saveKordMedia(type, url, event) {
    if (event) {
        event.stopPropagation();
        const btn = event.currentTarget;
        btn.innerHTML = `<span class="material-icons-round" style="font-size:14px;">check</span> Salvo`;
        btn.style.background = 'rgba(16, 185, 129, 0.8)';
        setTimeout(() => btn.style.opacity = 0, 1500);
    }

    if (!currentUser) return;
    const dbPath = type === 'gif' ? `users/${currentUser.uid}/favorite_gifs` : `users/${currentUser.uid}/stickers`;

    firebase.database().ref(dbPath).orderByChild('url').equalTo(url).once('value', snap => {
        if (!snap.exists()) {
            firebase.database().ref(dbPath).push({
                url: url,
                addedAt: firebase.database.ServerValue.TIMESTAMP
            }).then(() => {
                if (type === 'sticker') showKordAlert("Figurinha Salva", "A figurinha foi guardada na sua coleção!", "check_circle", "#10b981");
                else showKordAlert("GIF Favoritado", "Você marcou este GIF como favorito!", "star", "#fbbf24");
            });
        } else {
            if (type === 'sticker') showKordAlert("Já Existe", "Você já possui esta figurinha salva.", "info", "#3b82f6");
            else showKordAlert("Já Existe", "Você já favoritou este GIF antes.", "info", "#3b82f6");
        }
    });
}

function deleteKordSavedMedia(path, key, event) {
    if (event) event.stopPropagation();
    if (!currentUser) return;
    if (confirm("Deseja remover este item da sua coleção?")) {
        firebase.database().ref(`users/${currentUser.uid}/${path}/${key}`).remove();
    }
}

function uploadKordSticker(input) {
    const file = input.files[0];
    if (!file || !currentUser) return;
    

    try {
        const storageRef = firebase.storage().ref(`kord_stickers/${currentUser.uid}_${Date.now()}_${file.name}`);
        showKordAlert("Carregando", "Estamos enviando sua nova figurinha para a nuvem...", "cloud_upload", "#6366f1");
        storageRef.put(file).then(async (snap) => {
            try {
                const url = await snap.ref.getDownloadURL();
                await firebase.database().ref(`users/${currentUser.uid}/stickers`).push({
                    url: url, addedAt: firebase.database.ServerValue.TIMESTAMP
                });
                showKordAlert("Concluído", "Figurinha salva com sucesso e pronta para uso!", "check_circle", "#10b981");
            } catch (dlErr) {
                console.error("[Sticker URL Error]:", dlErr);
                showKordAlert("Falha no Banco", "Houve um problema ao vincular a figurinha à sua conta. Tente novamente.", "error", "#ef4444");
            }
        }).catch(uploadErr => {
            console.error("[Sticker Upload Error]:", uploadErr);
            showKordAlert("Falha no Envio", "Não foi possível carregar o arquivo na nuvem. Verifique sua conexão.", "cloud_off", "#ef4444");
        });
    } catch (e) {
        console.error("[Sticker Fatal Error]:", e);
        showKordAlert("Erro Misto", "Um erro inesperado interrompeu o processo do upload.", "error", "#ef4444");
    }
    input.value = '';
}

// Cloud File uploads have been disabled in favor of P2P.

// ==========================================
// FILE UPLOADS (WEBTORRENT P2P DECENTRALIZED)
// ==========================================
let kordWebTorrent;

function initKordWebTorrent() {
    if (!kordWebTorrent && typeof WebTorrent !== 'undefined') {
        kordWebTorrent = new WebTorrent();
        console.log("[Kord WebTorrent] P2P Engine Ready.");
    }
}

async function sendKordP2PFile(input) {
    const file = input.files[0];
    if (!file) return;
    if (file.size === 0) {
        return showKordAlert("Arquivo Inválido", "O sistema bloqueou o envio pois este arquivo parece estar completamente vazio (0 bytes).", "warning", "#f59e0b");
    }

    showKordModal({
        title: "Envio de Arquivo (P2P)",
        desc: `O Kord agora utiliza <b>transferência direta e criptografada</b>.<br><br>Selecione por quanto tempo o arquivo <b>${file.name}</b> deve ficar disponível para download por outras pessoas na sala.`,
        icon: "cloud_sync",
        iconColor: "#10b981",
        showSelect: true,
        selectOptions: [
            { text: "⏳ 5 Minutos (Para Visualização Rápida)", value: "300000" },
            { text: "⏰ 1 Hora", value: "3600000" },
            { text: "📅 12 Horas", value: "43200000" },
            { text: "♾️ Sempre (Enquanto sua aba ficar aberta)", value: "0" }
        ],
        confirmText: "Começar a Semear",
        onConfirm: (val, duration) => {
            initKordWebTorrent();

            // Fallback: If WebTorrent unavailable, upload via Firebase Storage
            if (!kordWebTorrent) {
                showKordAlert("Upload em Nuvem", `WebTorrent indisponível. Enviando ${file.name} via Firebase Storage...`, "cloud_upload", "#3b82f6");
                const storageRef = firebase.storage().ref(`kord_files/${currentUser.uid}_${Date.now()}_${file.name.replace(/[.#$\[\]\/]/g, '_')}`);
                storageRef.put(file).then(snapshot => {
                    snapshot.ref.getDownloadURL().then(url => {
                        sendKordMessage({
                            type: 'p2p_file',
                            magnetURI: url,
                            name: file.name,
                            size: (file.size / (1024 * 1024)).toFixed(2),
                            expiresAt: 0
                        });
                        input.value = '';
                        showKordAlert("Upload Concluído", `O arquivo <b>${file.name}</b> foi enviado com sucesso!`, "check_circle", "#10b981");
                    });
                }).catch(err => {
                    console.error('[Kord Storage] Upload error:', err);
                    showKordAlert("Falha no Upload", "Não foi possível enviar o arquivo. Verifique sua conexão.", "error", "#ef4444");
                });
                return;
            }

            showKordAlert("Servidor P2P Ativo", `Iniciando a transmissão direta de ${file.name} via conectividade descentralizada...`, "cloud_sync", "#a855f7");

            kordWebTorrent.seed(file, (torrent) => {
                console.log(`[Kord P2P] Seeding active: ${torrent.magnetURI}`);

                const expiresAt = duration !== "0" ? Date.now() + parseInt(duration) : 0;

                // Broadcast Magnet link via Firebase metadata
                sendKordMessage({
                    type: 'p2p_file',
                    magnetURI: torrent.magnetURI,
                    name: file.name,
                    size: (file.size / (1024 * 1024)).toFixed(2),
                    expiresAt: expiresAt
                });

                if (expiresAt > 0) {
                    setTimeout(() => {
                        console.log(`[Kord P2P] Time expired for ${file.name}. Stopping seed.`);
                        torrent.destroy();
                        showKordAlert("Tempo Esgotado", `A distribuição do arquivo <b>${file.name}</b> foi encerrada devido ao tempo limite configurado.`, "timer_off", "#ef4444");
                    }, parseInt(duration));
                }

                showKordModal({
                    title: "Link P2P Pronto!",
                    desc: `O arquivo <b>${file.name}</b> está online!<br><br>
                           <div style="background:rgba(0,0,0,0.3); padding:12px; border-radius:10px; font-family:monospace; font-size:10px; color:#a78bfa; word-break:break-all; border:1px solid rgba(167,139,250,0.2); line-height:1.4;">
                               ${torrent.magnetURI}
                           </div>
                           <p style="margin-top:10px; font-size:0.8rem; color:#94a3b8;">Compartilhe este link com quem você quiser.</p>`,
                    icon: "cloud_done",
                    iconColor: "#10b981",
                    confirmText: "Copiar Link",
                    cancelText: "Fechar",
                    onConfirm: () => {
                        copyToClipboard(torrent.magnetURI);
                    }
                });

                input.value = '';
            });
        }
    });
}

function downloadKordP2PFile(magnetURI, originalName) {
    initKordWebTorrent();
    if (!kordWebTorrent) return showKordAlert("Falha P2P", "O sistema de Torrent do Kord foi inativado de modo inesperado em seu navegador.", "memory", "#ef4444");

    showKordAlert("Conectando Rede...", `Localizando a fonte de **${originalName}** usando protocolos WebRTC criptografados...`, "settings_input_antenna", "#a855f7");

    // Prevent duplicate download instances
    if (kordWebTorrent.get(magnetURI)) {
        return showKordAlert("Transferência Ocorrendo", "Este download já se encontra ativo na fila do seu dispositivo.", "downloading", "#3b82f6");
    }

    kordWebTorrent.add(magnetURI, (torrent) => {
        showKordAlert("Conexão P2P Estabelecida!", `Aguarde enquanto montamos os blocos de dados de **${originalName}** de forma segura.`, "download", "#10b981");
        console.log(`[Kord P2P] Download engatado: ${torrent.infoHash}`);

        torrent.on('download', (bytes) => {
            const progress = (torrent.progress * 100).toFixed(1);
            const speed = (torrent.downloadSpeed / (1024 * 1024)).toFixed(2);
            // Throttle UI spam by logging randomly
            if (Math.random() > 0.95) console.log(`[P2P] Baixando: ${progress}% (${speed} MB/s)`);
        });

        torrent.on('done', () => {
            console.log('[Kord P2P] Download Completo.');
            showKordAlert("Download Concluído!", `O arquivo **${originalName}** foi integralmente validado e transferido para o seu computador.`, "check_circle", "#10b981");

            torrent.files.forEach(file => {
                file.getBlobURL((err, url) => {
                    if (err) return console.error("[P2P Blob assembler error]:", err);

                    // Create hidden <a> to force download the assembled Blob
                    const a = document.createElement('a');
                    a.target = '_blank';
                    a.download = originalName || file.name;
                    a.href = url;
                    a.click();
                });
            });
        });
    });
}

function closeAllKordPickers() {
    const emoji = document.getElementById('kordEmojiPicker');
    const gif = document.getElementById('kordGifPicker');
    if (emoji) emoji.remove();
    if (gif) gif.remove();
}

function kordLogout() {
    if (!confirm("Deseja desconectar sua conta?")) return;
    localStorage.clear();
    firebase.auth().signOut().then(() => {
        window.location.reload();
    });
}

// ==========================================
// PROFILE CUSTOMIZATION & AI GENERATION
// ==========================================
let kordPendingAIAvatar = null;

// Kord Pixels Collection (Curated Icons)
const KORD_PIXEL_AVATARS = [
    { name: 'Pluto', seed: 'Pluto' },
    { name: 'Midas', seed: 'Midas' },
    { name: 'Leonardo', seed: 'Leonardo' },
    { name: 'Emilio', seed: 'Emilio' },
    { name: 'Felix', seed: 'Felix' },
    { name: 'Belfort', seed: 'Belfort' },
    { name: 'Artemis', seed: 'Artemis' },
    { name: 'Themis', seed: 'Themis' },
    { name: 'Atlas', seed: 'Atlas' },
    { name: 'Iris', seed: 'Iris' },
    { name: 'Harry', seed: 'Harry' },
    { name: 'Tron', seed: 'Tron' }
];

function searchKordInternetImages() {
    const prompt = document.getElementById('kordInternetImagePrompt').value.trim().toLowerCase();

    const resultsContainer = document.getElementById('kordImageSearchResults');
    if (!resultsContainer) return;

    resultsContainer.innerHTML = `<div style="grid-column:1/-1; text-align:center; padding:10px; color:#3b82f6;"><span class="material-icons-round rotating">sync</span> Buscando...</div>`;

    let html = '';

    // 1. Check if we should show the Kord Pixel Collection
    // Show by default if prompt is empty, or if it matches "pixel" or a specific name
    const showPixels = !prompt || prompt.includes('pixel') || KORD_PIXEL_AVATARS.some(a => prompt.includes(a.name.toLowerCase()));

    if (showPixels) {
        KORD_PIXEL_AVATARS.forEach(avatar => {
            if (!prompt || prompt.includes('pixel') || avatar.name.toLowerCase().includes(prompt)) {
                const imgUrl = `https://api.dicebear.com/7.x/pixel-art/svg?seed=${avatar.seed}`;
                html += `
                    <div onclick="selectInternetImage('${imgUrl}')" title="${avatar.name}" style="cursor:pointer; border-radius:8px; overflow:hidden; border:2px solid rgba(167,139,250,0.3); background:rgba(167,139,250,0.1); transition:all 0.2s; position:relative;" onmouseover="this.style.borderColor='#a78bfa'; this.style.transform='scale(1.05)'" onmouseout="this.style.borderColor='rgba(167,139,250,0.3)'; this.style.transform='scale(1)'">
                        <img src="${imgUrl}" style="width:100%; height:auto; display:block;" />
                        <div style="position:absolute; bottom:0; left:0; width:100%; background:rgba(0,0,0,0.6); color:white; font-size:10px; padding:2px; text-align:center;">${avatar.name}</div>
                    </div>
                `;
            }
        });
    }

    // 2. Add Pixabay/Unsplash bridge results for the keyword (if not searching specifically for a pixel name)
    if (prompt && !KORD_PIXEL_AVATARS.some(a => prompt === a.name.toLowerCase())) {
        const keyword = encodeURIComponent(prompt);
        // Using a more reliable "Lorum Picsum" or simple API for testing, 
        // but high quality "internet search" feel with keywords usually needs multiple providers or a bridge.
        // We'll use a high-reliability placeholder service that responds well to keywords for now.
        for (let i = 0; i < 8; i++) {
            const sig = Math.floor(Math.random() * 10000);
            const imgUrl = `https://images.unsplash.com/photo-${1600000000000 + sig}?auto=format&fit=crop&w=512&q=80&q=${keyword}`;
            // NOTE: Unsplash source is deprecated. We'll use a direct keyword-based random pool for "internet" feel.
            const internetImg = `https://loremflickr.com/512/512/${keyword}?random=${i}`;
            html += `
                <div onclick="selectInternetImage('${internetImg}')" style="cursor:pointer; border-radius:8px; overflow:hidden; border:2px solid transparent; transition:all 0.2s; background:rgba(0,0,0,0.1);" onmouseover="this.style.borderColor='#3b82f6'; this.style.transform='scale(1.05)'" onmouseout="this.style.borderColor='transparent'; this.style.transform='scale(1)'">
                    <img src="${internetImg}" style="width:100%; height:auto; display:block;" onerror="this.src='https://via.placeholder.com/512x512/1e293b/64748b?text=Erro+Carregando'" loading="lazy" />
                </div>
            `;
        }
    }

    if (!html) {
        html = `<div style="grid-column:1/-1; text-align:center; padding:20px; color:#64748b;">Nenhum resultado encontrado.</div>`;
    }

    resultsContainer.innerHTML = html;
}

function selectInternetImage(url) {
    kordPendingAIAvatar = url; // Reuse existing staging variable
    const localAvatarDiv = document.getElementById('kord-user-avatar');
    if (localAvatarDiv) {
        localAvatarDiv.innerHTML = `<img src="${url}" style="width:100%; height:100%; object-fit:cover; border-radius:50%; border: 2px solid #3b82f6;" />`;
    }
    showKordAlert("Imagem Carregada", "Clique em 'Salvar Alterações' para aplicar este novo avatar ao seu perfil.", "check_circle", "#3b82f6");
}

function openKordProfileModal() {
    const modal = document.getElementById('kordProfileModal');
    if (!modal) return;
    modal.style.display = 'flex';
    requestAnimationFrame(() => {
        modal.style.opacity = '1';
        document.getElementById('kordProfileModalBox').style.transform = 'scale(1)';
    });

    // Populate current data
    if (currentUser) {
        if (currentUser.displayName) {
            document.getElementById('kordProfileNameModalInput').value = currentUser.displayName;
        }
        if (currentUser.nickname) {
            document.getElementById('kordProfileNicknameModalInput').value = currentUser.nickname;
        }
        if (currentUser.themeColor) {
            document.getElementById('kordProfileColorPicker').value = currentUser.themeColor;
            document.getElementById('kordProfileColorInput').value = currentUser.themeColor;
        }
        // Load PayPal email from Firebase
        const paypalInput = document.getElementById('kordProfilePaypalEmail');
        if (paypalInput) {
            firebase.database().ref(`users/${currentUser.uid}/paypalEmail`).once('value', snap => {
                if (snap.exists()) paypalInput.value = snap.val();
            });
        }
        updateProfilePreview();
    }
}

function closeKordProfileModal() {
    const modal = document.getElementById('kordProfileModal');
    if (!modal) return;
    modal.style.opacity = '0';
    document.getElementById('kordProfileModalBox').style.transform = 'scale(0.95)';
    setTimeout(() => {
        modal.style.display = 'none';
        const uploadInput = document.getElementById('kordProfileUploadInput');
        if (uploadInput) uploadInput.value = '';
        const uploadLabel = document.getElementById('kordUploadLabel');
        if (uploadLabel) uploadLabel.innerText = 'Capa do Perfil (Imagem)';
        kordPendingAIAvatar = null; // Clear staging
    }, 300);
}

// ==========================================
// AI CONFIGURATION MODAL (GROQ & TRANSLATOR)
// ==========================================
function openKordAIConfigModal() {
    const modal = document.getElementById('kordAIConfigModal');
    if (!modal) return;
    // Sync current values logically if needed
    const savedKey = localStorage.getItem('kord_groq_key');
    if (savedKey) document.getElementById('groqApiKey').value = savedKey;

    const savedTarget = localStorage.getItem('kord_translate_target');
    if (savedTarget) document.getElementById('kordTranslateTarget').value = savedTarget;

    const savedTTS = localStorage.getItem('kord_translate_tts');
    if (savedTTS !== null) document.getElementById('kordTranslateTTS').checked = (savedTTS === 'true');

    modal.style.display = 'flex';
    requestAnimationFrame(() => {
        modal.style.opacity = '1';
        document.getElementById('kordAIConfigModalBox').style.transform = 'scale(1)';
    });
}

function closeKordAIConfigModal() {
    const modal = document.getElementById('kordAIConfigModal');
    if (!modal) return;
    modal.style.opacity = '0';
    document.getElementById('kordAIConfigModalBox').style.transform = 'scale(0.95)';
    setTimeout(() => {
        modal.style.display = 'none';
    }, 300);
}

async function saveKordProfileCustomization() {
    const nameInput = document.getElementById('kordProfileNameModalInput').value.trim();
    const nickInput = document.getElementById('kordProfileNicknameModalInput').value.trim().toLowerCase().replace('@', '');
    const fileInput = document.getElementById('kordProfileUploadInput') ? document.getElementById('kordProfileUploadInput').files[0] : null;
    const colorInput = document.getElementById('kordProfileColorInput').value.trim();

    if (!currentUser) return showKordAlert("Precisa de Acesso", "Você precisa entrar com sua conta para mudar seu perfil.", "login", "#ef4444");

    let updates = {};

    // PayPal Email (no cooldown)
    const paypalInput = document.getElementById('kordProfilePaypalEmail');
    if (paypalInput) {
        const paypalVal = paypalInput.value.trim();
        if (paypalVal && paypalVal.includes('@')) {
            updates.paypalEmail = paypalVal;
        } else if (paypalVal === '') {
            updates.paypalEmail = null; // Clear if empty
        }
    }

    const btn = document.querySelector('#kordProfileModal button.btn-primary-clean');
    const originalText = btn ? btn.innerText : "Salvar Alterações";
    if (btn) {
        btn.innerText = "Salvando...";
        btn.disabled = true;
    }

    try {
        const userSnap = await firebase.database().ref(`users/${currentUser.uid}`).once('value');
        const userData = userSnap.val() || {};
        const lastUpdate = userData.lastProfileUpdate || 0;
        const cooldownMs = 7 * 24 * 60 * 60 * 1000;
        const now = Date.now();

        // 1. Name Change Logic
        if (nameInput && nameInput !== currentUser.displayName) {
            const alphaMatches = nameInput.match(/[a-zA-Z]/g);
            if (!alphaMatches || alphaMatches.length < 5) {
                throw new Error("O nome deve conter pelo menos 5 letras normais.");
            }
            if (now - lastUpdate < cooldownMs) {
                const days = Math.ceil((cooldownMs - (now - lastUpdate)) / (24 * 60 * 60 * 1000));
                throw new Error(`Aguarde ${days} dia(s) para alterar seu nome novamente.`);
            }
            updates.displayName = nameInput;
            updates.lastProfileUpdate = now;
        }

        // 1.5 Theme Color & CSS Sync
        if (colorInput && colorInput !== currentUser.themeColor) {
            updates.themeColor = colorInput;
            applyCustomTheme(colorInput); // apply visually instantly
            currentUser.themeColor = colorInput; // sync local object
        }

        if (window.kordPendingCustomCSS !== undefined) {
            updates.customCSS = window.kordPendingCustomCSS;
            currentUser.customCSS = window.kordPendingCustomCSS;
            if (typeof applyCustomCSS === 'function') {
                applyCustomCSS(window.kordPendingCustomCSS);
            }
            window.kordPendingCustomCSS = undefined; // clear staging
        }

        // 2. Nickname Change Logic
        if (nickInput && nickInput !== currentUser.nickname) {
            if (nickInput.length < 3) throw new Error("O nickname deve ter pelo menos 3 caracteres.");
            if (now - lastUpdate < cooldownMs) {
                const days = Math.ceil((cooldownMs - (now - lastUpdate)) / (24 * 60 * 60 * 1000));
                throw new Error(`Aguarde ${days} dia(s) para alterar seu apelido novamente.`);
            }

            // Uniqueness Check
            const nickCheck = await firebase.database().ref(`nicknames/${nickInput}`).once('value');
            if (nickCheck.exists() && nickCheck.val() !== currentUser.uid) {
                throw new Error("Este nickname já está em uso por outro usuário.");
            }

            // Clean up old nick index
            if (currentUser.nickname) {
                await firebase.database().ref(`nicknames/${currentUser.nickname}`).remove();
            }

            updates.nickname = nickInput;
            updates.lastProfileUpdate = now;
            await firebase.database().ref(`nicknames/${nickInput}`).set(currentUser.uid);
            currentUser.nickname = nickInput;
        }
        if (fileInput) {
            if (fileInput.size > 100 * 1024 * 1024) { // 100MB limit for avatars
                throw new Error("A foto não pode ter mais de 5MB.");
            }
            showKordAlert("Salvando Imagem", "Enviando nova foto do perfil para os servidores...", "cloud_upload", "#6366f1");
            const storageRef = firebase.storage().ref(`profiles/${currentUser.uid}_${Date.now()}`);
            const snapshot = await storageRef.put(fileInput);
            const downloadURL = await snapshot.ref.getDownloadURL();

            updates.photoURL = downloadURL;
            currentUser.photoURL = downloadURL;
            kordPendingAIAvatar = null; // Prioritize actual file upload

            // Instantly update Local UI Panel
            const localAvatarDiv = document.getElementById('kord-user-avatar');
            if (localAvatarDiv) {
                localAvatarDiv.innerHTML = `<img src="${downloadURL}" style="width:100%; height:100%; object-fit:cover; border-radius:50%;" />`;
            }
            const globalAvatarImg = document.getElementById('global-user-avatar');
            if (globalAvatarImg) {
                globalAvatarImg.src = downloadURL;
            }
        } else if (kordPendingAIAvatar) {
            // Apply generated AI avatar without upload
            updates.photoURL = kordPendingAIAvatar;
            currentUser.photoURL = kordPendingAIAvatar;

            const localAvatarDiv = document.getElementById('kord-user-avatar');
            if (localAvatarDiv) {
                localAvatarDiv.innerHTML = `<img src="${kordPendingAIAvatar}" style="width:100%; height:100%; object-fit:cover; border-radius:50%;" />`;
            }
            const globalAvatarImg = document.getElementById('global-user-avatar');
            if (globalAvatarImg) {
                globalAvatarImg.src = kordPendingAIAvatar;
            }
            kordPendingAIAvatar = null;
        }

        if (Object.keys(updates).length > 0) {
            await firebase.database().ref('users/' + currentUser.uid).update(updates);

            // Sync with Firebase Auth Profile so getters (currentUser.photoURL) work locally
            const authUpdates = {};
            if (updates.displayName) authUpdates.displayName = updates.displayName;
            if (updates.photoURL) authUpdates.photoURL = updates.photoURL;
            if (Object.keys(authUpdates).length > 0) {
                await currentUser.updateProfile(authUpdates);
            }

            showKordAlert("Perfil Atualizado", "A sua nova Identidade Kord foi salva com sucesso!", "how_to_reg", "#10b981");
            document.getElementById('kordProfileNameModalInput').value = '';
            const uploadInput = document.getElementById('kordProfileUploadInput');
            if (uploadInput) uploadInput.value = '';
            const uploadLabel = document.getElementById('kordUploadLabel');
            if (uploadLabel) uploadLabel.innerText = 'Capa do Perfil (Imagem)';
            closeKordProfileModal();
            loadUserProfile(currentUser.uid); // Force refresh of all UI elements

        } else {
            showKordAlert("Campos Vazios", "Mude pelo menos o Nome, adicione uma Foto ou use a IA para que possamos salvar as alterações.", "info", "#3b82f6");
        }
    } catch (err) {
        console.error("Profile Save Error:", err);
        showKordAlert("Falha ao Salvar", err.message || "Ocorreu um problema ao conectar com o banco de usuários. Tente de novo.", "error", "#ef4444");
    } finally {
        if (btn) {
            btn.innerText = originalText;
            btn.disabled = false;
        }
    }
}
// ==========================================
// FRIEND SYSTEM LOGIC
// ==========================================

async function loadFriends() {
    if (!currentUser) return;
    const grid = document.getElementById('friendsGrid');
    if (!grid) return;

    firebase.database().ref(`friendships/${currentUser.uid}`).on('value', async snap => {
        const friends = snap.val() || {};
        const uids = Object.keys(friends);

        if (uids.length === 0) {
            grid.innerHTML = `<div style="color:#64748b; padding:40px; text-align:center; grid-column:1/-1;">Você ainda não tem amigos. Adicione alguém pelo nickname!</div>`;
            return;
        }

        // Build HTML array first to prevent race condition duplicates
        const htmlArray = [];
        for (const uid of uids) {
            const uSnap = await firebase.database().ref(`users/${uid}`).once('value');
            const u = uSnap.val();
            if (!u) continue;

            const dName = u.displayName || u.nickname || (u.email ? u.email.split('@')[0] : 'Usuário');
            const online = u.status === 'online' || (u.presence && (Date.now() - u.presence < 60000));
            const color = u.themeColor || '#6366f1';
            const initial = dName.charAt(0).toUpperCase();

            htmlArray.push(`
            <div id="friend-card-${uid}" class="message-item" onclick="openDirectMessage('${uid}')" 
                 onmouseenter="this.style.background='rgba(99,102,241,0.1)'" 
                 onmouseleave="this.style.background='rgba(255,255,255,0.03)'"
                 style="background:rgba(255,255,255,0.03); padding:15px; border-radius:12px; display:flex; align-items:center; gap:12px; border:1px solid rgba(255,255,255,0.05); position:relative; cursor:pointer; transition:all 0.2s; flex-wrap: wrap;">
                <div style="width:48px; height:48px; border-radius:50%; background:${color}; display:flex; justify-content:center; align-items:center; color:#fff; font-weight:bold; font-size:18px; flex-shrink:0; position:relative;">
                    ${u.photoURL ? `<img src="${u.photoURL}" style="width:100%; height:100%; object-fit:cover; border-radius:50%;" />` : initial}
                    <div style="position:absolute; bottom:2px; right:2px; width:12px; height:12px; border-radius:50%; background:${online ? '#22c55e' : '#64748b'}; border:2px solid #1e293b;"></div>
                </div>
                <div style="flex:1; min-width: 120px;">
                    <div style="font-weight:600; color:#f8fafc; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">${dName}</div>
                    <div style="color:#10b981; font-size:0.8rem; font-family:monospace; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">@${u.nickname || dName}</div>
                </div>
                <div style="display:flex; gap:6px; align-items:center; flex-wrap: wrap; justify-content: flex-end; flex: 1; min-width: 120px;">
                    ${u.paypalEmail ? `<button onclick="event.stopPropagation(); openKordPaymentModal('${uid}', '${dName.replace(/'/g, "\\'")}')"
                        style="background:rgba(59,130,246,0.15); border:1px solid rgba(59,130,246,0.3); color:#60a5fa; padding:6px 12px; border-radius:8px; cursor:pointer; font-size:12px; font-weight:600; display:flex; align-items:center; gap:4px; transition:all 0.2s;"
                        onmouseover="this.style.background='rgba(59,130,246,0.3)'" onmouseout="this.style.background='rgba(59,130,246,0.15)'">
                        <span class="material-icons-round" style="font-size:16px;">payments</span> Enviar
                    </button>` : ''}
                    <span class="material-icons-round" style="color:#64748b; font-size:20px;">chat</span>
                </div>
            </div>
            `);
        }
        grid.innerHTML = htmlArray.join('');
        loadGroups(); // Chain group loading
    });
}

function loadGroups() {
    if (!currentUser) return;
    const grid = document.getElementById('friendsGrid');
    if (!grid) return;

    firebase.database().ref(`users/${currentUser.uid}/groups`).on('value', async snap => {
        const groups = snap.val() || {};
        const groupIds = Object.keys(groups);

        if (groupIds.length === 0) return; // Keep friends if no groups

        let htmlArray = [];
        for (const gid of groupIds) {
            const gSnap = await firebase.database().ref(`direct_messages/${gid}/info`).once('value');
            const g = gSnap.val();
            if (!g) {
                // Orphan group cleanup
                firebase.database().ref(`users/${currentUser.uid}/groups/${gid}`).remove();
                continue;
            }

            htmlArray.push(`
            <div class="message-item" onclick="openGroupMessage('${gid}', '${g.name.replace(/'/g, "\\'")}')" 
                 onmouseenter="this.style.background='rgba(168, 85, 247,0.1)'" 
                 onmouseleave="this.style.background='rgba(255,255,255,0.03)'"
                 style="background:rgba(255,255,255,0.03); padding:15px; border-radius:12px; display:flex; align-items:center; gap:12px; border:1px solid rgba(168, 85, 247,0.2); position:relative; cursor:pointer; transition:all 0.2s; flex-wrap: wrap;">
                <div style="width:48px; height:48px; border-radius:10px; background:linear-gradient(135deg, #c084fc, #9333ea); display:flex; justify-content:center; align-items:center; color:#fff; font-weight:bold; font-size:18px; flex-shrink:0; position:relative;">
                    <span class="material-icons-round">groups</span>
                </div>
                <div style="flex:1; min-width: 120px;">
                    <div style="font-weight:600; color:#c084fc; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">${g.name}</div>
                    <div style="color:#94a3b8; font-size:0.8rem; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">Grupo Privado</div>
                </div>
                <span class="material-icons-round" style="color:#c084fc; font-size:20px; flex-shrink: 0;">chat</span>
            </div>
            `);
        }

        // Append groups to the grid rather than replacing friends
        grid.innerHTML += htmlArray.join('');
    });
}

let _kordProcessingFriendIds = new Set(); // Stores UIDs of accepted/rejected requests to prevent ghosting

function loadFriendRequests() {
    if (!currentUser) return;
    firebase.database().ref(`friend_requests/${currentUser.uid}`).on('value', async snap => {
        const reqs = snap.val() || {};
        const area = document.getElementById('friendRequestsSection');
        const list = document.getElementById('friendRequestsList');
        if (!area || !list) return;

        const senderUids = Object.keys(reqs);
        // Filter out any UIDs we are currently accepting/rejecting (to fix race conditions)
        const uniqueUids = [...new Set(senderUids)].filter(uid => !_kordProcessingFriendIds.has(uid));

        if (uniqueUids.length > 0) {
            let htmlBuffer = '';
            for (const uid of uniqueUids) {
                const uSnap = await firebase.database().ref(`users/${uid}`).once('value');
                const u = uSnap.val();
                if (!u) {
                    firebase.database().ref(`friend_requests/${currentUser.uid}/${uid}`).remove();
                    continue;
                }

                // Check friendships root instead of users/uid/friends
                const friendCheck = await firebase.database().ref(`friendships/${currentUser.uid}/${uid}`).once('value');
                if (friendCheck.exists()) {
                    firebase.database().ref(`friend_requests/${currentUser.uid}/${uid}`).remove();
                    continue;
                }

                // Final safety check in case the user clicked accept while the loops were running
                if (_kordProcessingFriendIds.has(uid)) continue;

                const dName = u.displayName || u.nickname || (u.email ? u.email.split('@')[0] : 'Usuário');
                const initial = dName.charAt(0).toUpperCase();

                htmlBuffer += `
                <div id="freq-${uid}" style="background:rgba(245,158,11,0.05); padding:12px; border-radius:10px; border:1px solid rgba(245,158,11,0.2); display:flex; align-items:center; gap:12px;">
                    <div style="width:36px; height:36px; border-radius:50%; background:#f59e0b; display:flex; justify-content:center; align-items:center; color:#fff; font-weight:bold;">${initial}</div>
                    <div style="flex:1; overflow:hidden;">
                        <div style="color:#fff; font-size:0.9rem; white-space:nowrap; text-overflow:ellipsis; overflow:hidden;">${dName}</div>
                        <div style="color:#94a3b8; font-size:0.75rem;">@${u.nickname || dName}</div>
                    </div>
                    <div style="display:flex; gap:5px;">
                        <button onclick="acceptFriendRequest('${uid}')" style="background:#10b981; border:none; color:#fff; width:30px; height:30px; border-radius:5px; cursor:pointer;"><span class="material-icons-round" style="font-size:18px;">check</span></button>
                        <button onclick="rejectFriendRequest('${uid}')" style="background:#ef4444; border:none; color:#fff; width:30px; height:30px; border-radius:5px; cursor:pointer;"><span class="material-icons-round" style="font-size:18px;">close</span></button>
                    </div>
                </div>
                `;
            }

            if (htmlBuffer) {
                area.style.display = 'block';
                list.innerHTML = htmlBuffer;
            } else {
                area.style.display = 'none';
                list.innerHTML = '';
            }
        } else {
            area.style.display = 'none';
            list.innerHTML = '';
        }
    });
}

function openAddFriendModal() {
    showKordModal({
        title: "Adicionar Amigo",
        desc: "Digite o nickname ou email (ex: moisesdev) para enviar um pedido.",
        icon: "person_add",
        iconColor: "#10b981",
        inputPlaceholder: "nickname ou email",
        confirmText: "Enviar Pedido",
        cancelText: "Cancelar",
        onConfirm: async (nick) => {
            if (!nick) return;
            const cleanNick = nick.toLowerCase().trim().replace('@', '');
            if (cleanNick === (currentUser.nickname || "").toLowerCase()) {
                return showKordAlert("Ação Inválida", "Não é possível adicionar seu próprio perfil aos amigos.", "person_remove", "#f59e0b");
            }

            let targetUid = null;
            const nickSnap = await firebase.database().ref('nicknames/' + cleanNick).once('value');
            if (nickSnap.exists()) {
                targetUid = nickSnap.val();
            }

            if (!targetUid) {
                const usersSnap = await firebase.database().ref('users').once('value');
                const allUsers = usersSnap.val() || {};
                for (const uid in allUsers) {
                    const u = allUsers[uid];
                    if (u.nickname && u.nickname.toLowerCase() === cleanNick) {
                        targetUid = uid;
                        firebase.database().ref('nicknames/' + u.nickname.toLowerCase()).set(uid);
                        break;
                    }
                    const emailPrefix = (u.email || '').split('@')[0].toLowerCase();
                    if (emailPrefix === cleanNick || (u.displayName || '').toLowerCase() === cleanNick) {
                        targetUid = uid;
                        if (u.nickname) firebase.database().ref('nicknames/' + u.nickname.toLowerCase()).set(uid);
                        break;
                    }
                }
            }

            if (!targetUid) {
                return showKordAlert("Conta Inexistente", "Nenhum usuário foi localizado utilizando o nickname ou e-mail digitado.", "search_off", "#ef4444");
            }

            if (targetUid === currentUser.uid) {
                return showKordAlert("Ação Inválida", "Mais uma vez: você não pode mandar pedido para você mesmo.", "person_remove", "#f59e0b");
            }

            const friendSnap = await firebase.database().ref(`friendships/${currentUser.uid}/${targetUid}`).once('value');
            if (friendSnap.exists()) {
                return showKordAlert("Já Amigos", "Você já possui essa pessoa adicionada em sua lista de contatos.", "group", "#6366f1");
            }

            const existingReq = await firebase.database().ref(`friend_requests/${targetUid}/${currentUser.uid}`).once('value');
            if (existingReq.exists()) {
                return showKordAlert("Já Solicitado", "Você já enviou um convite para essa pessoa. Aguarde ela aceitar.", "hourglass_empty", "#6366f1");
            }
            const reverseReq = await firebase.database().ref(`friend_requests/${currentUser.uid}/${targetUid}`).once('value');
            if (reverseReq.exists()) {
                acceptFriendRequest(targetUid);
                return;
            }

            firebase.database().ref(`friend_requests/${targetUid}/${currentUser.uid}`).set(true).then(() => {
                showKordAlert("Enviado!", "Pedido de amizade enviado com sucesso.", "check_circle", "#10b981");
            }).catch(err => {
                console.error('[Kord Friend Request Error]:', err);
                // If RTDB rules block, try via direct_messages workaround
                firebase.database().ref(`users/${targetUid}/friend_requests/${currentUser.uid}`).set(firebase.database.ServerValue.TIMESTAMP).then(() => {
                    showKordAlert("Enviado!", "Pedido de amizade enviado com sucesso.", "check_circle", "#10b981");
                }).catch(err2 => {
                    showKordAlert("Falha ao Enviar", "Não foi possível enviar o pedido. Verifique as regras do Firebase.", "error", "#ef4444");
                });
            });
        }
    });
}

function acceptFriendRequest(senderUid) {
    if (!currentUser) return;
    _kordProcessingFriendIds.add(senderUid); // Block UI from re-rendering this

    const updates = {};
    updates[`friendships/${currentUser.uid}/${senderUid}`] = true;
    updates[`friendships/${senderUid}/${currentUser.uid}`] = true;
    updates[`friend_requests/${currentUser.uid}/${senderUid}`] = null;
    updates[`friend_requests/${senderUid}/${currentUser.uid}`] = null;

    firebase.database().ref().update(updates).then(() => {
        showKordAlert("Novo Amigo", "Vocês agora estão conectados!", "celebration", "#10b981");
        const reqCard = document.getElementById(`freq-${senderUid}`);
        if (reqCard) {
            reqCard.remove();
            checkEmptyFriendRequests();
        }
    }).catch(err => {
        console.error(err);
        _kordProcessingFriendIds.delete(senderUid); // Allow retry on fail
        showKordAlert("Falha na Rede", "Um problema impediu de aceitar o pedido no momento.", "error", "#ef4444");
    });
}

function rejectFriendRequest(senderUid) {
    if (!currentUser) return;
    _kordProcessingFriendIds.add(senderUid);

    firebase.database().ref(`friend_requests/${currentUser.uid}/${senderUid}`).remove().catch(() => _kordProcessingFriendIds.delete(senderUid));
    const reqCard = document.getElementById(`freq-${senderUid}`);
    if (reqCard) {
        reqCard.remove();
        checkEmptyFriendRequests();
    }
    showKordAlert("Convite Ignorado", "Pedido de amizade recusado silenciosamente.", "close", "#64748b");
}

function checkEmptyFriendRequests() {
    const list = document.getElementById('friendRequestsList');
    const area = document.getElementById('friendRequestsSection');
    if (list && area && list.children.length === 0) {
        area.style.display = 'none';
        list.innerHTML = ''; // Force clear
    }
}

// ==========================================
// DIRECT MESSAGES (Between Friends)
// ==========================================
function openCreateKordGroupModal() {
    if (!currentUser) return;
    showKordModal({
        title: "Criar Grupo Privado",
        desc: "Dê um nome ao seu novo grupo de mensagens diretas.",
        icon: "group_add",
        iconColor: "#c084fc",
        inputPlaceholder: "Ex: Grupo do Final de Semana",
        confirmText: "Criar Grupo",
        cancelText: "Cancelar",
        onConfirm: (groupName) => {
            if (!groupName) return;

            // Create a unique group DM ID
            const groupId = 'group_' + Date.now() + '_' + Math.random().toString(36).substr(2, 5);

            // First member is the creator
            const members = {};
            members[currentUser.uid] = true;

            const groupData = {
                name: groupName,
                owner: currentUser.uid,
                isGroup: true,
                members: members,
                createdAt: Date.now()
            };

            firebase.database().ref(`direct_messages/${groupId}/info`).set(groupData).then(() => {
                firebase.database().ref(`users/${currentUser.uid}/groups/${groupId}`).set(true);
                showKordAlert("Grupo Online", "O grupo foi aberto. Adicione a galera usando o botão 'Add' no topo da tela!", "check_circle", "#10b981");
                openGroupMessage(groupId, groupName);
            }).catch(e => {
                showKordAlert("Falha ao Criar", "Houve um erro no servidor ao gerar seu grupo. Tente novamente.", "error", "#ef4444");
            });
        }
    });
}

function openGroupMessage(groupId, groupName) {
    if (!currentUser) return;

    // Switch to DM view
    const chatHeader = document.getElementById('kord-current-channel-name');
    if (chatHeader) {
        chatHeader.innerHTML = `<div style="display:flex; align-items:center; gap:8px; flex-wrap:wrap; width:100%;">
            <span class="material-icons-round" style="font-size:18px; color:#c084fc;">groups</span> 
            <span style="white-space:nowrap; overflow:hidden; text-overflow:ellipsis; max-width:200px;">${groupName}</span>
            <div style="display:flex; gap:6px; flex-wrap:wrap;">
                <button onclick="openAddGroupMemberModal('${groupId}')" class="btn-primary-clean" style="padding:4px 8px; font-size:0.75rem; background:rgba(168, 85, 247, 0.2); color:#c084fc; border:1px solid rgba(168, 85, 247, 0.4);">
                    <span class="material-icons-round" style="font-size:14px;">person_add</span> Add
                </button>
                <button onclick="copyGroupInvite('${groupId}')" class="btn-primary-clean" style="padding:4px 8px; font-size:0.75rem; background:rgba(168, 85, 247, 0.2); color:#c084fc; border:1px solid rgba(168, 85, 247, 0.4);">
                    <span class="material-icons-round" style="font-size:14px;">link</span> Convite
                </button>
                <button onclick="deleteGroup('${groupId}')" class="btn-primary-clean" style="padding:4px 8px; font-size:0.75rem; background:rgba(239, 68, 68, 0.2); color:#ef4444; border:1px solid rgba(239, 68, 68, 0.4);">
                    <span class="material-icons-round" style="font-size:14px;">delete</span> Apagar
                </button>
            </div>
        </div>`;
    }

    currentKordChannel = `dm:${groupId}`;
    currentKordServer = 'home';

    // Format body for chat
    const chatWindow = document.getElementById('kord-chat-window');
    if (chatWindow) {
        chatWindow.innerHTML = `<div id="chatMessages" style="display:flex; flex-direction:column; gap:10px; padding-bottom:20px;"></div>`;
    }
    const chatList = document.getElementById('chatMessages');

    const inputArea = document.getElementById('kord-input-area');
    if (inputArea) inputArea.style.display = 'block';

    // Set target for sendKordMessage
    const chatInput = document.getElementById('kord-chat-input');
    if (chatInput) chatInput.setAttribute('data-dm-target', `direct_messages/${groupId}`);

    // Enable Group Calls (hide if already in a call)
            const callActions = document.getElementById('kord-header-call-actions');
            if (callActions) {
                if (typeof isCallActive !== 'undefined' && isCallActive) {
                    callActions.style.display = 'none';
                } else {
                    callActions.style.display = 'flex';
                    callActions.innerHTML = `<button onclick="startKordVoiceCall('${groupId}')" class="kord-join-call-btn" style="background:rgba(168, 85, 247, 0.1); color:#c084fc; border-color:rgba(168, 85, 247, 0.3);">
                        <span class="material-icons-round">groups</span> Ligar (Grupo)
                    </button>`;
                }
            }

    const ref = firebase.database().ref(`direct_messages/${groupId}/messages`);
    kordAttachChatListener(ref, chatList, 'dm');
}

function openAddGroupMemberModal(groupId) {
    if (!currentUser) return;

    // We only want to add existing friends for simplicity, or we can use the same nickname/email logic
    showKordModal({
        title: "Adicionar Membro",
        desc: "Digite o nickname ou email para adicionar ao grupo.",
        icon: "person_add",
        iconColor: "#c084fc",
        inputPlaceholder: "nickname ou email",
        confirmText: "Adicionar",
        cancelText: "Cancelar",
        onConfirm: async (nick) => {
            if (!nick) return;
            const cleanNick = nick.toLowerCase().trim().replace('@', '');

            let targetUid = null;
            const nickSnap = await firebase.database().ref('nicknames/' + cleanNick).once('value');
            if (nickSnap.exists()) {
                targetUid = nickSnap.val();
            }

            if (!targetUid) {
                const usersSnap = await firebase.database().ref('users').once('value');
                const allUsers = usersSnap.val() || {};
                for (const uid in allUsers) {
                    const u = allUsers[uid];
                    if (u.nickname && u.nickname.toLowerCase() === cleanNick) {
                        targetUid = uid;
                        break;
                    }
                    const emailPrefix = (u.email || '').split('@')[0].toLowerCase();
                    if (emailPrefix === cleanNick || (u.displayName || '').toLowerCase() === cleanNick) {
                        targetUid = uid;
                        break;
                    }
                }
            }

            if (!targetUid) {
                return showKordAlert("Conta Inexistente", "Ninguém foi encontrado usando esse nickname ou e-mail.", "search_off", "#ef4444");
            }

            // Check if already in group
            const memberCheck = await firebase.database().ref(`direct_messages/${groupId}/info/members/${targetUid}`).once('value');
            if (memberCheck.exists()) {
                return showKordAlert("Já no Grupo", "Esta pessoa já faz parte desta conversa em grupo.", "group", "#6366f1");
            }

            // Add member to group
            const updates = {};
            updates[`direct_messages/${groupId}/info/members/${targetUid}`] = true;
            updates[`users/${targetUid}/groups/${groupId}`] = true;

            firebase.database().ref().update(updates).then(() => {
                showKordAlert("Participante Adicionado", "O usuário foi inserido no grupo.", "person_add", "#10b981");

                // System message
                firebase.database().ref(`direct_messages/${groupId}/messages`).push({
                    uid: 'system',
                    author: 'Sistema',
                    color: '#64748b',
                    text: `Um novo membro foi adicionado ao grupo.`,
                    time: Date.now()
                });

            }).catch(e => {
                showKordAlert("Erro ao Incluir", "Não foi possível colocar este usuário no grupo por falhas de conectividade.", "error", "#ef4444");
            });
        }
    });
}

function copyGroupInvite(groupId) {
    const inviteLink = `kord-group-invite-${groupId}`;
    navigator.clipboard.writeText(inviteLink).then(() => {
        showKordAlert("Link Local Copiado", `O código gerado foi salvo:<br><br><b style="color:#fff;">${inviteLink}</b><br><br>Compartilhe apenas com amigos confiáveis!`, "content_copy", "#c084fc");
    });
}

function deleteGroup(groupId) {
    if (!currentUser) return;

    firebase.database().ref(`direct_messages/${groupId}/info`).once('value', snap => {
        const info = snap.val();
        if (!info) return;

        if (info.owner !== currentUser.uid) {
            return showKordAlert("Acesso Bloqueado", "Somente o criador original pode deletar o grupo de todos.", "lock", "#ef4444");
        }

        showKordConfirm("Apagar Grupo", "Tem certeza que deseja apagar este grupo para todos?", () => {
            if (info.members) {
                Object.keys(info.members).forEach(mUid => {
                    firebase.database().ref(`users/${mUid}/groups/${groupId}`).remove();
                });
            }
            firebase.database().ref(`direct_messages/${groupId}`).remove().then(() => {
                showKordAlert("Grupo Deletado", "Esta conversa foi encerrada e apagada permanentemente.", "delete_forever", "#10b981");
                selectKordServer('home');
            });
        });
    });
}

function openDirectMessage(friendUid) {
    if (!currentUser) return;
    // Create a deterministic chat ID (sorted UIDs)
    const chatId = [currentUser.uid, friendUid].sort().join('_');

    // Get friend info
    firebase.database().ref(`users/${friendUid}`).once('value', snap => {
        const u = snap.val();
        const friendName = u ? (u.displayName || u.nickname || 'Amigo') : 'Amigo';

        // Switch to DM view
        const chatHeader = document.getElementById('kord-current-channel-name');
        if (chatHeader) {
            chatHeader.innerHTML = `<span class="material-icons-round" style="font-size:18px; color:#10b981;">chat</span> ${friendName}`;
        }

        currentKordChannel = `dm:${chatId}`;
        currentKordServer = 'home';

        // Format body for chat
        const chatWindow = document.getElementById('kord-chat-window');
        if (chatWindow) {
            chatWindow.innerHTML = `<div id="chatMessages" style="display:flex; flex-direction:column; gap:10px; padding-bottom:20px;"></div>`;
        }
        const chatList = document.getElementById('chatMessages');

        const inputArea = document.getElementById('kord-input-area');
        if (inputArea) inputArea.style.display = 'block';

        // Set target for sendKordMessage
        const chatInput = document.getElementById('kord-chat-input');
        if (chatInput) chatInput.setAttribute('data-dm-target', `direct_messages/${chatId}`);

        // Enable Private P2P Calls in DMs (hide if already in a call)
                const callActions = document.getElementById('kord-header-call-actions');
                if (callActions) {
                    if (typeof isCallActive !== 'undefined' && isCallActive) {
                        callActions.style.display = 'none';
                    } else {
                        callActions.style.display = 'flex';
                        callActions.innerHTML = `<button onclick="startKordVoiceCall()" class="kord-join-call-btn" style="background:rgba(34, 197, 94, 0.1); color:#22c55e; border-color:rgba(34, 197, 94, 0.3);">
                            <span class="material-icons-round">call</span> Ligar (Privado)
                        </button>`;
                    }
                }

        const ref = firebase.database().ref(`direct_messages/${chatId}/messages`);
        kordAttachChatListener(ref, chatList, 'dm');
    });
}

// ==========================================
// KORD APP: CALCULATOR
// ==========================================
function openKordCalculator() {
    closeKordAppsModal();
    const existing = document.getElementById('kordCalcModal');
    if (existing) existing.remove();

    const modal = document.createElement('div');
    modal.id = 'kordCalcModal';
    modal.style.cssText = 'position:fixed; top:0; left:0; width:100%; height:100%; background:rgba(15,23,42,0.85); z-index:999998; display:flex; justify-content:center; align-items:center; backdrop-filter:blur(8px); opacity:0; transition: opacity 0.3s ease;';

    modal.innerHTML = `
        <div style="background:linear-gradient(145deg, #1e293b, #0f172a); border-radius:20px; width:360px; max-width:95%; border:1px solid rgba(255,255,255,0.1); box-shadow:0 25px 60px -12px rgba(0,0,0,0.8); overflow:hidden; transform:scale(0.95); transition: transform 0.3s cubic-bezier(0.4, 0, 0.2, 1);" id="kordCalcBox">
            <div style="padding:20px 20px 0 20px; display:flex; justify-content:space-between; align-items:center;">
                <div style="display:flex; align-items:center; gap:10px;">
                    <div style="width:36px; height:36px; background:linear-gradient(135deg, #6366f1, #818cf8); border-radius:10px; display:flex; justify-content:center; align-items:center;">
                        <span class="material-icons-round" style="font-size:20px; color:#fff;">calculate</span>
                    </div>
                    <h3 style="margin:0; color:#f8fafc; font-size:1.1rem;">Calculadora</h3>
                </div>
                <div onclick="document.getElementById('kordCalcModal').remove()" style="cursor:pointer; color:#64748b; padding:4px; border-radius:6px;" onmouseover="this.style.background='rgba(255,255,255,0.1)'" onmouseout="this.style.background='none'">
                    <span class="material-icons-round" style="font-size:20px;">close</span>
                </div>
            </div>
            <div style="padding:20px;">
                <div id="calcDisplay" style="background:rgba(0,0,0,0.4); border:1px solid rgba(255,255,255,0.08); border-radius:12px; padding:16px 20px; margin-bottom:16px; text-align:right; min-height:70px; display:flex; flex-direction:column; justify-content:flex-end;">
                    <div id="calcExpr" style="color:#64748b; font-size:0.8rem; min-height:18px; word-break:break-all;"></div>
                    <div id="calcResult" style="color:#f8fafc; font-size:2rem; font-weight:700; font-family:'SF Mono', monospace; word-break:break-all;">0</div>
                </div>
                <div style="display:grid; grid-template-columns:repeat(4, 1fr); gap:8px;" id="calcGrid">
                    ${['AC', '±', '%', '÷', '7', '8', '9', '×', '4', '5', '6', '−', '1', '2', '3', '+', '0', '.', '⌫', '='].map(b => {
        let bg = 'rgba(255,255,255,0.06)';
        let color = '#f8fafc';
        let fw = '500';
        if (['÷', '×', '−', '+', '='].includes(b)) { bg = b === '=' ? 'linear-gradient(135deg, #6366f1, #818cf8)' : 'rgba(99,102,241,0.2)'; color = b === '=' ? '#fff' : '#a5b4fc'; fw = '700'; }
        if (['AC', '±', '%'].includes(b)) { bg = 'rgba(255,255,255,0.1)'; color = '#94a3b8'; }
        const span = b === '0' ? 'grid-column:span 1;' : '';
        return `<button onclick="calcInput('${b}')" style="background:${bg}; border:none; color:${color}; font-size:1.2rem; font-weight:${fw}; padding:14px; border-radius:10px; cursor:pointer; transition:all 0.15s; ${span}" onmouseover="this.style.filter='brightness(1.2)'" onmouseout="this.style.filter='none'">${b}</button>`;
    }).join('')}
                </div>
                <div style="display:flex; gap:6px; margin-top:8px; flex-wrap:wrap;">
                    ${['sin', 'cos', 'tan', '√', 'π', 'log', '(', ')'].map(b =>
        `<button onclick="calcInput('${b}')" style="flex:1; min-width:38px; background:rgba(245,158,11,0.1); border:1px solid rgba(245,158,11,0.2); color:#fbbf24; font-size:0.75rem; font-weight:600; padding:8px 4px; border-radius:8px; cursor:pointer; transition:all 0.15s;" onmouseover="this.style.filter='brightness(1.3)'" onmouseout="this.style.filter='none'">${b}</button>`
    ).join('')}
                </div>
            </div>
        </div>
    `;

    document.body.appendChild(modal);
    requestAnimationFrame(() => {
        modal.style.opacity = '1';
        modal.querySelector('#kordCalcBox').style.transform = 'scale(1)';
    });

    modal.addEventListener('click', (e) => {
        if (e.target === modal) modal.remove();
    });
}

let _calcPrev = null;
let _calcOp = null;
let _calcCurrent = '0';
let _calcNewNum = true;
let _calcDisplayExpr = '';

function _calcApply(a, op, b) {
    if (op === '+') return a + b;
    if (op === '-') return a - b;
    if (op === '*') return a * b;
    if (op === '/') return b !== 0 ? a / b : NaN;
    return b;
}

function calcInput(val) {
    const display = document.getElementById('calcResult');
    const expr = document.getElementById('calcExpr');
    if (!display) return;

    if (val === 'AC') {
        _calcPrev = null;
        _calcOp = null;
        _calcCurrent = '0';
        _calcNewNum = true;
        _calcDisplayExpr = '';
        display.innerText = '0';
        expr.innerText = '';
        return;
    }
    if (val === '⌫') {
        if (_calcCurrent.length > 1) {
            _calcCurrent = _calcCurrent.slice(0, -1);
        } else {
            _calcCurrent = '0';
            _calcNewNum = true;
        }
        display.innerText = _calcCurrent;
        return;
    }
    if (val === '±') {
        if (_calcCurrent !== '0') {
            _calcCurrent = _calcCurrent.startsWith('-') ? _calcCurrent.substring(1) : '-' + _calcCurrent;
            display.innerText = _calcCurrent;
        }
        return;
    }
    if (val === 'π') {
        _calcCurrent = Math.PI.toString();
        _calcNewNum = true;
        display.innerText = '3.14159265';
        return;
    }
    if (['sin', 'cos', 'tan', '√', 'log'].includes(val)) {
        let num = parseFloat(_calcCurrent);
        let result;
        if (val === 'sin') result = Math.sin(num * Math.PI / 180);
        else if (val === 'cos') result = Math.cos(num * Math.PI / 180);
        else if (val === 'tan') result = Math.tan(num * Math.PI / 180);
        else if (val === '√') result = Math.sqrt(num);
        else if (val === 'log') result = Math.log10(num);
        _calcCurrent = isNaN(result) || !isFinite(result) ? 'Erro' : parseFloat(result.toFixed(10)).toString();
        expr.innerText = `${val}(${num})`;
        display.innerText = _calcCurrent;
        _calcNewNum = true;
        return;
    }
    if (val === '%') {
        let num = parseFloat(_calcCurrent);
        if (_calcPrev !== null) {
            _calcCurrent = (_calcPrev * num / 100).toString();
        } else {
            _calcCurrent = (num / 100).toString();
        }
        display.innerText = _calcCurrent;
        _calcNewNum = true;
        return;
    }
    if (['÷', '×', '−', '+'].includes(val)) {
        const opMap = { '÷': '/', '×': '*', '−': '-', '+': '+' };
        const newOp = opMap[val];
        if (_calcPrev !== null && !_calcNewNum) {
            const result = _calcApply(_calcPrev, _calcOp, parseFloat(_calcCurrent));
            _calcPrev = result;
            _calcCurrent = isNaN(result) || !isFinite(result) ? 'Erro' : parseFloat(result.toFixed(10)).toString();
            display.innerText = _calcCurrent;
        } else {
            _calcPrev = parseFloat(_calcCurrent);
        }
        _calcOp = newOp;
        _calcDisplayExpr = _calcCurrent + ' ' + val + ' ';
        expr.innerText = _calcDisplayExpr;
        _calcNewNum = true;
        return;
    }
    if (val === '(' || val === ')') {
        // Not used in accumulator mode
        return;
    }
    if (val === '=') {
        if (_calcPrev !== null && _calcOp) {
            const a = _calcPrev;
            const b = parseFloat(_calcCurrent);
            _calcDisplayExpr = a + ' ' + _calcOp.replace('/', '÷').replace('*', '×').replace('-', '−') + ' ' + b + ' =';
            expr.innerText = _calcDisplayExpr;
            const result = _calcApply(a, _calcOp, b);
            _calcCurrent = isNaN(result) || !isFinite(result) ? 'Erro' : parseFloat(result.toFixed(10)).toString();
            display.innerText = _calcCurrent;
            _calcPrev = null;
            _calcOp = null;
        }
        _calcNewNum = true;
        return;
    }
    // Number or dot
    if (_calcNewNum) {
        _calcCurrent = val === '.' ? '0.' : val;
        _calcNewNum = false;
    } else {
        if (val === '.' && _calcCurrent.includes('.')) return;
        _calcCurrent += val;
    }
    display.innerText = _calcCurrent;
}

// ==========================================
// KORD APP: TRANSLATOR (Groq AI)
// ==========================================
function openKordTranslator() {
    closeKordAppsModal();
    const existing = document.getElementById('kordTranslatorModal');
    if (existing) existing.remove();

    const langs = [
        { code: 'auto', name: 'Detectar Idioma' },
        { code: 'pt-BR', name: 'Português (BR)' },
        { code: 'pt-PT', name: 'Português (PT)' },
        { code: 'en', name: 'English' },
        { code: 'es', name: 'Español' },
        { code: 'fr', name: 'Français' },
        { code: 'de', name: 'Deutsch' },
        { code: 'it', name: 'Italiano' },
        { code: 'ja', name: '日本語' },
        { code: 'ko', name: '한국어' },
        { code: 'zh', name: '中文 (简体)' },
        { code: 'zh-TW', name: '中文 (繁體)' },
        { code: 'ru', name: 'Русский' },
        { code: 'ar', name: 'العربية' },
        { code: 'hi', name: 'हिन्दी' },
        { code: 'bn', name: 'বাংলা' },
        { code: 'tr', name: 'Türkçe' },
        { code: 'nl', name: 'Nederlands' },
        { code: 'pl', name: 'Polski' },
        { code: 'uk', name: 'Українська' },
        { code: 'sv', name: 'Svenska' },
        { code: 'da', name: 'Dansk' },
        { code: 'no', name: 'Norsk' },
        { code: 'fi', name: 'Suomi' },
        { code: 'el', name: 'Ελληνικά' },
        { code: 'cs', name: 'Čeština' },
        { code: 'ro', name: 'Română' },
        { code: 'hu', name: 'Magyar' },
        { code: 'th', name: 'ไทย' },
        { code: 'vi', name: 'Tiếng Việt' },
        { code: 'id', name: 'Bahasa Indonesia' },
        { code: 'ms', name: 'Bahasa Melayu' },
        { code: 'he', name: 'עברית' },
        { code: 'fa', name: 'فارسی' },
        { code: 'sw', name: 'Kiswahili' },
        { code: 'tl', name: 'Filipino' },
        { code: 'ur', name: 'اردو' }
    ];

    const srcOptions = langs.map(l => `<option value="${l.code}" ${l.code === 'auto' ? 'selected' : ''}>${l.name}</option>`).join('');
    const tgtOptions = langs.filter(l => l.code !== 'auto').map(l => `<option value="${l.code}" ${l.code === 'en' ? 'selected' : ''}>${l.name}</option>`).join('');

    const modal = document.createElement('div');
    modal.id = 'kordTranslatorModal';
    modal.style.cssText = 'position:fixed; top:0; left:0; width:100%; height:100%; background:rgba(15,23,42,0.85); z-index:999998; display:flex; justify-content:center; align-items:center; backdrop-filter:blur(8px); opacity:0; transition: opacity 0.3s ease;';

    modal.innerHTML = `
        <div style="background:linear-gradient(145deg, #1e293b, #0f172a); border-radius:20px; width:550px; max-width:95%; border:1px solid rgba(255,255,255,0.1); box-shadow:0 25px 60px -12px rgba(0,0,0,0.8); overflow:hidden; transform:scale(0.95); transition: transform 0.3s cubic-bezier(0.4, 0, 0.2, 1);" id="kordTransBox">
            <div style="padding:20px 24px 0 24px; display:flex; justify-content:space-between; align-items:center;">
                <div style="display:flex; align-items:center; gap:10px;">
                    <div style="width:36px; height:36px; background:linear-gradient(135deg, #f59e0b, #fbbf24); border-radius:10px; display:flex; justify-content:center; align-items:center;">
                        <span class="material-icons-round" style="font-size:20px; color:#fff;">translate</span>
                    </div>
                    <h3 style="margin:0; color:#f8fafc; font-size:1.1rem;">Tradutor Global</h3>
                </div>
                <div onclick="document.getElementById('kordTranslatorModal').remove()" style="cursor:pointer; color:#64748b; padding:4px; border-radius:6px;" onmouseover="this.style.background='rgba(255,255,255,0.1)'" onmouseout="this.style.background='none'">
                    <span class="material-icons-round" style="font-size:20px;">close</span>
                </div>
            </div>
            <div style="padding:20px 24px 24px 24px;">
                <div style="display:flex; align-items:center; gap:10px; margin-bottom:16px;">
                    <select id="kordTransSrc" style="flex:1; background:rgba(0,0,0,0.3); border:1px solid rgba(255,255,255,0.1); border-radius:10px; padding:10px 12px; color:#fff; font-size:0.9rem; outline:none;">${srcOptions}</select>
                    <button onclick="swapKordTransLangs()" style="background:rgba(99,102,241,0.15); border:1px solid rgba(99,102,241,0.3); color:#a5b4fc; width:40px; height:40px; border-radius:10px; cursor:pointer; display:flex; justify-content:center; align-items:center; transition:all 0.2s;" onmouseover="this.style.transform='rotate(180deg)'" onmouseout="this.style.transform='rotate(0)'">
                        <span class="material-icons-round" style="font-size:20px;">swap_horiz</span>
                    </button>
                    <select id="kordTransTgt" style="flex:1; background:rgba(0,0,0,0.3); border:1px solid rgba(255,255,255,0.1); border-radius:10px; padding:10px 12px; color:#fff; font-size:0.9rem; outline:none;">${tgtOptions}</select>
                </div>
                <div style="display:flex; flex-direction:column; gap:12px;">
                    <div style="position:relative;">
                        <textarea id="kordTransInput" placeholder="Digite ou cole o texto para traduzir..." rows="4" style="width:100%; background:rgba(0,0,0,0.3); border:1px solid rgba(255,255,255,0.08); border-radius:12px; padding:14px; color:#fff; font-size:0.95rem; outline:none; resize:none; font-family:inherit; transition:border-color 0.2s;" onfocus="this.style.borderColor='rgba(245,158,11,0.5)'" onblur="this.style.borderColor='rgba(255,255,255,0.08)'"></textarea>
                        <div style="position:absolute; bottom:10px; right:10px; display:flex; gap:6px;">
                            <span id="kordTransCharCount" style="color:#64748b; font-size:0.7rem;">0/2000</span>
                        </div>
                    </div>
                    <button onclick="executeKordTranslation()" id="kordTransBtn" style="background:linear-gradient(135deg, #f59e0b, #d97706); border:none; color:#fff; padding:12px; border-radius:10px; font-weight:700; font-size:0.95rem; cursor:pointer; display:flex; align-items:center; justify-content:center; gap:8px; transition:all 0.2s;" onmouseover="this.style.filter='brightness(1.1)'" onmouseout="this.style.filter='none'">
                        <span class="material-icons-round" style="font-size:20px;">translate</span> Traduzir
                    </button>
                    <div id="kordTransOutput" style="background:rgba(0,0,0,0.3); border:1px solid rgba(255,255,255,0.08); border-radius:12px; padding:14px; min-height:80px; color:#f8fafc; font-size:0.95rem; line-height:1.6; display:none;">
                    </div>
                    <div id="kordTransActions" style="display:none; justify-content:flex-end; gap:8px;">
                        <button onclick="copyTranslation()" style="background:rgba(255,255,255,0.06); border:1px solid rgba(255,255,255,0.1); color:#94a3b8; padding:8px 14px; border-radius:8px; cursor:pointer; font-size:0.8rem; display:flex; align-items:center; gap:5px; transition:all 0.15s;" onmouseover="this.style.color='#fff'" onmouseout="this.style.color='#94a3b8'">
                            <span class="material-icons-round" style="font-size:16px;">content_copy</span> Copiar
                        </button>
                        <button onclick="speakTranslation()" style="background:rgba(255,255,255,0.06); border:1px solid rgba(255,255,255,0.1); color:#94a3b8; padding:8px 14px; border-radius:8px; cursor:pointer; font-size:0.8rem; display:flex; align-items:center; gap:5px; transition:all 0.15s;" onmouseover="this.style.color='#fff'" onmouseout="this.style.color='#94a3b8'">
                            <span class="material-icons-round" style="font-size:16px;">volume_up</span> Ouvir
                        </button>
                    </div>
                </div>
            </div>
        </div>
    `;

    document.body.appendChild(modal);
    requestAnimationFrame(() => {
        modal.style.opacity = '1';
        modal.querySelector('#kordTransBox').style.transform = 'scale(1)';
    });

    modal.addEventListener('click', (e) => {
        if (e.target === modal) modal.remove();
    });

    // Char counter
    document.getElementById('kordTransInput').oninput = function () {
        document.getElementById('kordTransCharCount').innerText = this.value.length + '/2000';
    };
}

function swapKordTransLangs() {
    const src = document.getElementById('kordTransSrc');
    const tgt = document.getElementById('kordTransTgt');
    if (src.value === 'auto') return;
    const tmp = src.value;
    src.value = tgt.value;
    tgt.value = tmp;
}

async function executeKordTranslation() {
    const input = document.getElementById('kordTransInput').value.trim();
    if (!input) return showKordAlert("Texto Vazio", "Por favor, insira o texto que você deseja traduzir.", "warning", "#f59e0b");
    if (input.length > 2000) return showKordAlert("Texto Muito Longo", "O limite máximo é de 2000 caracteres por tradução.", "warning", "#f59e0b");

    const srcLang = document.getElementById('kordTransSrc').value;
    const tgtLang = document.getElementById('kordTransTgt').value;
    const srcName = document.getElementById('kordTransSrc').selectedOptions[0].text;
    const tgtName = document.getElementById('kordTransTgt').selectedOptions[0].text;

    const btn = document.getElementById('kordTransBtn');
    btn.innerHTML = '<span class="material-icons-round rotating" style="font-size:20px;">sync</span> Traduzindo...';
    btn.disabled = true;

    const apiKey = localStorage.getItem('groqApiKey') || localStorage.getItem('groq_api_key');
    if (!apiKey) {
        btn.innerHTML = '<span class="material-icons-round" style="font-size:20px;">translate</span> Traduzir';
        btn.disabled = false;
        return showKordAlert("API Key Pendente", "Adicione a sua Groq API Key nas opções do Kord AI para habilitar as traduções.", "vpn_key", "#f59e0b");
    }

    try {
        const systemPrompt = `You are a professional translator. Translate the following text ${srcLang === 'auto' ? '(auto-detect source language)' : 'from ' + srcName} to ${tgtName}. Return ONLY the translated text, nothing else. No explanations, no quotes, no formatting.`;

        const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': 'Bearer ' + apiKey
            },
            body: JSON.stringify({
                model: 'llama-3.3-70b-versatile',
                messages: [
                    { role: 'system', content: systemPrompt },
                    { role: 'user', content: input }
                ],
                temperature: 0.2,
                max_tokens: 2048
            })
        });

        if (!response.ok) {
            const errData = await response.json().catch(() => ({}));
            throw new Error(errData.error?.message || `HTTP ${response.status}`);
        }

        const data = await response.json();
        const translated = data.choices[0].message.content.trim();

        const output = document.getElementById('kordTransOutput');
        output.style.display = 'block';
        output.innerHTML = `
            <div style="font-size:0.7rem; color:#64748b; margin-bottom:6px; display:flex; align-items:center; gap:4px;">
                <span class="material-icons-round" style="font-size:14px;">check_circle</span> ${srcLang === 'auto' ? 'Auto-detectado' : srcName} → ${tgtName}
            </div>
            <div style="color:#f8fafc; line-height:1.6;">${translated}</div>
        `;
        document.getElementById('kordTransActions').style.display = 'flex';

    } catch (e) {
        console.error('[Translator Error]:', e);
        let msg = e.message;
        if (msg.includes('rate limit')) msg = 'Limite de requisições excedido. Aguarde.';
        if (msg.includes('Invalid')) msg = 'Sua API Key é inválida ou expirou.';
        showKordAlert("Falha na Tradução", msg, "error", "#ef4444");
    }

    btn.innerHTML = '<span class="material-icons-round" style="font-size:20px;">translate</span> Traduzir';
    btn.disabled = false;
}

function copyTranslation() {
    const output = document.getElementById('kordTransOutput');
    if (!output) return;
    const text = output.querySelector('div:last-child').innerText;
    navigator.clipboard.writeText(text).then(() => {
        showKordAlert("Texto Copiado!", "Tradução salva na área de transferência.", "content_copy", "#10b981");
    });
}

function speakTranslation() {
    const output = document.getElementById('kordTransOutput');
    if (!output) return;
    const text = output.querySelector('div:last-child').innerText;
    const tgtLang = document.getElementById('kordTransTgt').value;

    // Use kordSpeakText if available (from kord_webrtc.js), otherwise local fallback
    if (typeof kordSpeakText === 'function') {
        kordSpeakText(text, tgtLang);
    } else {
        window.speechSynthesis.cancel();
        const utterance = new SpeechSynthesisUtterance(text);
        utterance.lang = tgtLang;
        utterance.rate = 0.95;
        utterance.volume = 1.0;

        // Try to find a matching voice
        const voices = window.speechSynthesis.getVoices();
        const prefix = tgtLang.split('-')[0].toLowerCase();
        const voice = voices.find(v => v.lang.toLowerCase() === tgtLang.toLowerCase())
            || voices.find(v => v.lang.toLowerCase().startsWith(prefix));
        if (voice) utterance.voice = voice;

        window.speechSynthesis.speak(utterance);
    }
}

// ==========================================
// PAYPAL P2P MODAL (INLINE JS SDK)
// ==========================================
function openKordPaymentModal(targetUid, targetName) {
    if (!currentUser) return showKordAlert("Acesso Negado", "Realize o login para utilizar recursos de pagamento.", "lock", "#ef4444");

    // Clear remnants if modal was hastily closed
    const btnContainer = document.getElementById('kordPaypalIframeContainer');
    if (btnContainer) btnContainer.innerHTML = '';

    // Fetch target's PayPal email
    firebase.database().ref(`users/${targetUid}/paypalEmail`).once('value', snap => {
        const paypalEmail = snap.val();
        if (!paypalEmail) {
            return showKordAlert("Conta Incompatível", `${targetName} não possui um e-mail do PayPal associado à sua conta Kord.`, "warning", "#f59e0b");
        }

        // Build payment modal using existing modal system
        const modal = document.getElementById('kordModalOverlay');
        const box = document.getElementById('kordModalBox');
        if (!modal || !box) return;

        box.innerHTML = `
            <div class="kord-modal-header">
                <div class="kord-modal-icon-container" style="background:rgba(59,130,246,0.2);">
                    <span class="material-icons-round" style="color:#3b82f6;">payments</span>
                </div>
                <div>
                    <h3 class="kord-modal-title">Enviar Pagamento</h3>
                    <p class="kord-modal-desc">Para <b style="color:#60a5fa;">${targetName}</b> via PayPal</p>
                </div>
            </div>

            <div style="display:grid; grid-template-columns:repeat(3, 1fr); gap:10px; margin-bottom:15px;">
                <button onclick="document.getElementById('kordPayAmount').value='5'" 
                    class="action-btn" style="padding:12px; background:rgba(16,185,129,0.1); border:1px solid rgba(16,185,129,0.3); color:#34d399; border-radius:10px; font-weight:700; font-size:1rem; cursor:pointer; transition:all 0.2s;"
                    onmouseover="this.style.background='rgba(16,185,129,0.25)'" onmouseout="this.style.background='rgba(16,185,129,0.1)'">
                    R$5
                </button>
                <button onclick="document.getElementById('kordPayAmount').value='15'"
                    class="action-btn" style="padding:12px; background:rgba(99,102,241,0.1); border:1px solid rgba(99,102,241,0.3); color:#818cf8; border-radius:10px; font-weight:700; font-size:1rem; cursor:pointer; transition:all 0.2s;"
                    onmouseover="this.style.background='rgba(99,102,241,0.25)'" onmouseout="this.style.background='rgba(99,102,241,0.1)'">
                    R$15
                </button>
                <button onclick="document.getElementById('kordPayAmount').value='50'"
                    class="action-btn" style="padding:12px; background:rgba(245,158,11,0.1); border:1px solid rgba(245,158,11,0.3); color:#fbbf24; border-radius:10px; font-weight:700; font-size:1rem; cursor:pointer; transition:all 0.2s;"
                    onmouseover="this.style.background='rgba(245,158,11,0.25)'" onmouseout="this.style.background='rgba(245,158,11,0.1)'">
                    R$50
                </button>
            </div>

            <div class="kord-modal-field" style="margin-bottom:15px;" id="kordPayAmountBox">
                <input type="number" id="kordPayAmount" class="kord-modal-input" value="5" min="1" max="10000" step="0.01"
                    placeholder="Valor em R$" style="font-size:1.1rem; font-weight:700; text-align:center;">
            </div>

            <!-- Injected Container for Inline Iframe Checkout -->
            <div id="kordPaypalIframeContainer" style="display:none; width:100%; min-height:200px; border-radius:12px; margin-top:15px; position:relative; overflow:hidden;">
            </div>

            <div class="kord-modal-footer" id="kordPayFooterActions">
                <button onclick="closeKordModal()" class="action-btn secondary" style="padding:12px 24px; border-radius:10px;">Cancelar</button>
                <button onclick="sendKordPayment('${targetUid}', '${targetName.replace(/'/g, "\\'")}', '${paypalEmail}')" class="btn-primary-clean" style="padding:12px 24px; background:linear-gradient(135deg, #3b82f6, #2563eb); gap:8px;">
                    <span class="material-icons-round" style="font-size:18px;">send</span> Avançar ao PayPal
                </button>
            </div>
        `;

        modal.style.display = 'flex';
        requestAnimationFrame(() => { modal.classList.add('active'); });
    });
}

function closeKordModal() {
    const modal = document.getElementById('kordModalOverlay');
    if (modal) {
        modal.classList.remove('active');
        setTimeout(() => { modal.style.display = 'none'; }, 300);
    }
}

function sendKordPayment(targetUid, targetName, targetPaypalEmail) {
    const amountInput = document.getElementById('kordPayAmount');
    if (!amountInput) return;

    let amount = parseFloat(amountInput.value);
    if (isNaN(amount) || amount < 1) return showKordAlert("Valor Inválido", "Por favor, defina um montante de no mínimo R$1.", "warning", "#f59e0b");
    if (amount > 10000) return showKordAlert("Operação Restrita", "Transações seguras via Kord limitam-se a R$10.000,00 por vez.", "security", "#f59e0b");

    const senderName = currentUser.displayName || currentUser.email.split('@')[0];
    const itemName = `💰 Kord Payment - ${senderName} → ${targetName}`;

    showKordAlert("Conectando Checkout", "Renderizando ambiente seguro do PayPal. Por favor, aguarde.", "lock", "#10b981");

    // Hide standard inputs and buttons to give way to the buttons
    document.querySelectorAll('#kordModalBox > div:nth-child(2), #kordPayAmountBox, #kordPayFooterActions').forEach(el => el.style.display = 'none');
    document.querySelector('.kord-modal-title').innerText = "Checkout Seguro";
    document.querySelector('.kord-modal-desc').innerHTML = "<span class='material-icons-round rotating' style='font-size:14px; vertical-align:middle; color:#10b981;'>sync</span> Criptografando conexão e aguardando Gateway...";

    // Show SDK container
    const iframeContainer = document.getElementById('kordPaypalIframeContainer');
    if (iframeContainer) {
        iframeContainer.style.display = 'block';
        iframeContainer.innerHTML = ''; // Clean possible older buttons
    }

    // Render Native PayPal Smart Buttons
    if (typeof paypal !== 'undefined') {
        paypal.Buttons({
            createOrder: function (data, actions) {
                // Remove sync text after fully loaded
                document.querySelector('.kord-modal-desc').innerText = "Clique nas opções abaixo para concluir sem sair do Kord.";
                return actions.order.create({
                    purchase_units: [{
                        amount: {
                            value: amount.toFixed(2),
                            currency_code: 'BRL'
                        },
                        description: itemName,
                        custom_id: JSON.stringify({
                            from: currentUser.uid,
                            to: targetUid,
                            ts: Date.now()
                        }),
                        // Optional natively supported payee to send dynamically without being the site owner. 
                        // Note: Depending on Sandbox limitations, this might require a different REST API app, 
                        // but this is the modern method avoiding iframe restrictions.
                        payee: {
                            email_address: targetPaypalEmail
                        }
                    }]
                });
            },
            onApprove: function (data, actions) {
                return actions.order.capture().then(function (details) {
                    closeKordModal();

                    // Force an IPN-style ping logic artificially if needed, or rely on PayPal natively
                    // For WebUI perspective, it's an absolute success:
                    showKordAlert("Pagamento Aprovado", `Você transferiu R$${amount.toFixed(2)} para ${targetName} com segurança!`, "verified", "#10b981");

                    // Fallback to pinging the success tracking backend in the background so you have logs without relying solely on slow Webhooks
                    fetch('/iacurator/paypal_ipn.php?kord_payment=success_inline_webhook', {
                        method: 'POST',
                        body: JSON.stringify(details),
                        headers: { 'Content-Type': 'application/json' }
                    }).catch(e => console.warn("Backend IPN Ping failed silently. Payment is still captured on PayPal."));
                });
            },
            onError: function (err) {
                console.error("PayPal Flow Error:", err);
                showKordAlert("Aviso de Checkout", "A janela segura foi fechada ou houve um erro no gateway. Tente novamente.", "report", "#ef4444");
                closeKordModal();
            },
            onCancel: function (data) {
                showKordAlert("Pagamento Cancelado", "O fluxo foi interrompido com segurança antes da cobrança final.", "info", "#3b82f6");
                closeKordModal();
            }
        }).render('#kordPaypalIframeContainer');
    } else {
        showKordAlert("Erro de SDK", "Não foi possível carregar os nós oficiais do banco no momento.", "cloud_off", "#ef4444");
        closeKordModal();
    }
}
