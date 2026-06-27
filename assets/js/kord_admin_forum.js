// ============================================================
// ADMIN FORUM TAB FUNCTIONS
// ============================================================

// Post to forum from admin panel
async function adminPostForum() {
    const title = document.getElementById('admin-forum-title').value.trim();
    const category = document.getElementById('admin-forum-cat').value;
    const text = document.getElementById('admin-forum-text').value.trim();

    if (!title || !text) {
        showKordAlert("Campos Vazios", "Preencha título e mensagem.", "warning", "#f59e0b");
        return;
    }

    const isSuperAdmin = currentUser && ['moisesvvanti@gmail.com', 'vitortrader2017@gmail.com', 'rafebrlz1@hotmail.com'].includes(currentUser.email);
    if (!isSuperAdmin) {
        showKordAlert("Sem Permissão", "Apenas admins podem postar no forum.", "error", "#ef4444");
        return;
    }

    const forumId = firebase.database().ref().push().key;
    const forumData = {
        author: currentUser.displayName || currentUser.email,
        authorUid: currentUser.uid,
        title: title.substring(0, 200),
        text: text.substring(0, 10000),
        category: category,
        time: firebase.database.ServerValue.TIMESTAMP,
        pinned: false,
        locked: false
    };

    await firebase.database().ref('forums/' + forumId).set(forumData);
    document.getElementById('admin-forum-title').value = '';
    document.getElementById('admin-forum-text').value = '';
    showKordAlert("Publicado!", "Post enviado para o forum.", "celebration", "#10b981");
    adminLoadForum();
}

// Load forum posts in admin panel
async function adminLoadForum() {
    const container = document.getElementById('admin-forum-list');
    if (!container) return;

    const snap = await firebase.database().ref('forums').orderByChild('time').limitToLast(20).once('value');
    const forums = snap.val() || {};
    const entries = Object.entries(forums).sort((a, b) => (b[1].time || 0) - (a[1].time || 0));

    if (entries.length === 0) {
        container.innerHTML = '<p style="color:#64748b;text-align:center;">Nenhum post ainda.</p>';
        return;
    }

    const cats = {
        announcement: { icon: '📢', color: '#ef4444', label: 'Anúncio' },
        activity: { icon: '🏅', color: '#f59e0b', label: 'Atividade' },
        update: { icon: '🚀', color: '#6366f1', label: 'Atualização' },
        security: { icon: '🛡️', color: '#10b981', label: 'Segurança' },
        community: { icon: '👥', color: '#8b5cf6', label: 'Comunidade' }
    };

    container.innerHTML = entries.map(([id, f]) => {
        const cat = cats[f.category] || cats.announcement;
        const date = f.time ? new Date(f.time).toLocaleDateString('pt-BR') : '—';
        return `
            <div style="background:rgba(0,0,0,0.2);border-radius:10px;padding:14px;border-left:3px solid ${cat.color};">
                <div style="display:flex;justify-content:space-between;align-items:start;margin-bottom:6px;">
                    <span style="color:#fff;font-weight:600;font-size:13px;">${f.title}</span>
                    <span style="color:${cat.color};font-size:12px;">${cat.icon} ${cat.label}</span>
                </div>
                <p style="color:#94a3b8;font-size:12px;margin:0 0 4px 0;">${f.author} · ${date}</p>
                <p style="color:#64748b;font-size:12px;margin:0;overflow:hidden;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;">${f.text}</p>
                <button onclick="adminDeleteForum('${id}')" style="margin-top:8px;background:rgba(239,68,68,0.15);color:#ef4444;border:1px solid rgba(239,68,68,0.3);padding:4px 10px;border-radius:6px;cursor:pointer;font-size:11px;">🗑️ Remover</button>
            </div>
        `;
    }).join('');
}

// Delete forum post
async function adminDeleteForum(forumId) {
    if (!confirm('Remover este post?')) return;
    await firebase.database().ref('forums/' + forumId).remove();
    adminLoadForum();
}

// ============================================================
// ADMIN ACTIVITY REWARDS FUNCTIONS
// ============================================================

// Post activity reward
async function adminPostReward() {
    const email = document.getElementById('admin-reward-user').value.trim();
    const type = document.getElementById('admin-reward-type').value;
    const title = document.getElementById('admin-reward-title').value.trim();
    const msg = document.getElementById('admin-reward-msg').value.trim();

    if (!email || !title) {
        showKordAlert("Campos Vazios", "Preencha email e título.", "warning", "#f59e0b");
        return;
    }

    const isSuperAdmin = currentUser && ['moisesvvanti@gmail.com', 'vitortrader2017@gmail.com', 'rafebrlz1@hotmail.com'].includes(currentUser.email);
    if (!isSuperAdmin) {
        showKordAlert("Sem Permissão", "Apenas admins.", "error", "#ef4444");
        return;
    }

    // Find user by email
    const snap = await firebase.database().ref('users').orderByChild('email').equalTo(email).once('value');
    const users = snap.val();
    if (!users) {
        showKordAlert("Usuário Não Encontrado", "Email não cadastrado.", "error", "#ef4444");
        return;
    }

    const uid = Object.keys(users)[0];
    const rewardId = firebase.database().ref().push().key;
    const rewardData = {
        email: email,
        uid: uid,
        type: type,
        title: title,
        message: msg,
        awardedBy: currentUser.displayName,
        awardedAt: firebase.database.ServerValue.TIMESTAMP
    };

    await firebase.database().ref('activity_rewards/' + rewardId).set(rewardData);

    // Also post to changelog as activity
    const clId = firebase.database().ref().push().key;
    await firebase.database().ref('changelog/' + clId).set({
        title: `🏅 ${title}`,
        description: `${msg} — Para ${email}`,
        timestamp: firebase.database.ServerValue.TIMESTAMP,
        type: 'activity'
    });

    document.getElementById('admin-reward-user').value = '';
    document.getElementById('admin-reward-title').value = '';
    document.getElementById('admin-reward-msg').value = '';
    showKordAlert("Recompensa Publicada!", "Atividade recompensada com sucesso.", "celebration", "#f59e0b");
    adminLoadRewards();
}

// Load activity rewards in admin panel
async function adminLoadRewards() {
    const container = document.getElementById('admin-rewards-list');
    if (!container) return;

    const snap = await firebase.database().ref('activity_rewards').orderByChild('awardedAt').limitToLast(20).once('value');
    const rewards = snap.val() || {};
    const entries = Object.entries(rewards).sort((a, b) => (b[1].awardedAt || 0) - (a[1].awardedAt || 0));

    const types = {
        top_contributor: { icon: '🏆', color: '#fbbf24', label: 'Top Contribuidor' },
        active_member: { icon: '💬', color: '#6366f1', label: 'Membro Ativo' },
        helper: { icon: '🤝', color: '#10b981', label: 'Ajudante' },
        early_adopter: { icon: '🚀', color: '#f59e0b', label: 'Early Adopter' },
        bug_hunter: { icon: '🐛', color: '#ef4444', label: 'Caçador de Bugs' },
        translator: { icon: '🌍', color: '#22d3ee', label: 'Tradutor' },
        special: { icon: '⭐', color: '#a78bfa', label: 'Especial' }
    };

    if (entries.length === 0) {
        container.innerHTML = '<p style="color:#64748b;text-align:center;">Nenhuma recompensa ainda.</p>';
        return;
    }

    container.innerHTML = entries.map(([id, r]) => {
        const t = types[r.type] || types.special;
        const date = r.awardedAt ? new Date(r.awardedAt).toLocaleDateString('pt-BR') : '—';
        return `
            <div style="background:rgba(0,0,0,0.2);border-radius:10px;padding:12px;border-left:3px solid ${t.color};">
                <div style="display:flex;align-items:center;gap:8px;margin-bottom:4px;">
                    <span style="font-size:18px;">${t.icon}</span>
                    <span style="color:#fff;font-weight:600;font-size:13px;">${r.title}</span>
                </div>
                <p style="color:#94a3b8;font-size:12px;margin:0;">${r.email} · ${t.label}</p>
                <p style="color:#64748b;font-size:11px;margin:4px 0 0 0;">${r.message || ''} — Por ${r.awardedBy} em ${date}</p>
            </div>
        `;
    }).join('');
}