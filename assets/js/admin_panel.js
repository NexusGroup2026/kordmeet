// ============================================================
// KORD ADMIN PANEL v2.0
// Web-based admin dashboard (replaces changelog_admin.py)
// SECURITY: Only accessible to moisesvvanti@gmail.com
// CROSS-BROWSER COMPATIBLE (NO optional chaining, NO empty catch)
// ============================================================

var ADMIN_EMAIL = 'moisesvvanti@gmail.com';
var _adminListeners = [];
var _adminReady = false;
var _adminLoaded = false;

// ============================================================
// ADMIN INITIALIZATION & SECURITY
// ============================================================
function isAdmin() {
    return !!(window.currentUser && window.currentUser.email === ADMIN_EMAIL);
}

function initAdminPanel() {
    if (!isAdmin()) return;
    _adminReady = true;

    // Show admin nav items
    var adminNavDesktop = document.getElementById('admin-nav-desktop');
    var adminNavMobile = document.getElementById('admin-nav-mobile');
    if (adminNavDesktop) adminNavDesktop.style.display = 'flex';
    if (adminNavMobile) adminNavMobile.style.display = 'flex';

    console.log('[ADMIN] Panel initialized for', ADMIN_EMAIL);
}

function loadAdminView() {
    if (!isAdmin()) return;

    // Prevent duplicate listeners — only attach once
    if (_adminLoaded) return;
    _adminLoaded = true;

    // Detach any existing listeners first (safety)
    _detachAdminListeners();

    // Start real-time listeners
    loadAdminDashboard();
    loadAdminChangelog();
    loadAdminSupporters();
    loadAdminBugReports();
    loadAdminAccessLogs();
    loadAdminSearchActivity();
    loadAdminDiscoveryQueue();
    loadAdminMessageReports();

    console.log('[ADMIN] Real-time listeners attached');
}

// ============================================================
// DETACH ALL LISTENERS (prevents duplicates)
// ============================================================
function _detachAdminListeners() {
    try { firebase.database().ref('supporters').off('value'); } catch (e) { }
    try { firebase.database().ref('changelog').off('value'); } catch (e) { }
    try { firebase.database().ref('presence').off('value'); } catch (e) { }
    try { firebase.database().ref('bug_reports').off('value'); } catch (e) { }
    try { firebase.database().ref('access_logs').off('value'); } catch (e) { }
    try { firebase.database().ref('search_activity').off('value'); } catch (e) { }
    try { firebase.database().ref('discovery_queue').off('value'); } catch (e) { }
    try { firebase.database().ref('discovery_history').off('value'); } catch (e) { }
    try { firebase.database().ref('message_reports').off('value'); } catch (e) { }
}

// ============================================================
// DASHBOARD STATS
// ============================================================
function loadAdminDashboard() {
    if (!isAdmin()) return;

    // Supporters count + revenue
    firebase.database().ref('supporters').on('value', function (snap) {
        var data = snap.val() || {};
        var supporters = Object.values(data);
        var totalRevenue = 0;
        supporters.forEach(function (s) { totalRevenue += (s.total_amount || 0); });

        setAdminStat('admin-stat-revenue', 'R$ ' + totalRevenue.toFixed(2));
        setAdminStat('admin-stat-supporters', supporters.length);
    });

    // Changelog count
    firebase.database().ref('changelog').on('value', function (snap) {
        var data = snap.val() || {};
        var entries = Object.values(data);
        setAdminStat('admin-stat-updates', entries.length);
        if (entries.length > 0) {
            var latest = entries.sort(function (a, b) { return (b.timestamp || 0) - (a.timestamp || 0); })[0];
            setAdminStat('admin-stat-version', latest.version || '1.0.0');
        }
    });

    // Active users (presence)
    firebase.database().ref('presence').on('value', function (snap) {
        var data = snap.val() || {};
        var now = Date.now();
        var active = Object.values(data).filter(function (p) {
            return now - (p.lastSeen || p || 0) < 120000;
        });
        setAdminStat('admin-stat-online', active.length);
    });
}

function setAdminStat(id, value) {
    var el = document.getElementById(id);
    if (el) el.textContent = value;
}

// ============================================================
// CHANGELOG MANAGER
// ============================================================
function loadAdminChangelog() {
    if (!isAdmin()) return;

    firebase.database().ref('changelog').orderByChild('timestamp').on('value', function (snap) {
        var data = snap.val() || {};
        var entries = Object.entries(data).sort(function (a, b) { return (b[1].timestamp || 0) - (a[1].timestamp || 0); });
        var tbody = document.getElementById('admin-changelog-body');
        if (!tbody) return;

        tbody.innerHTML = entries.map(function (entry) {
            var id = entry[0], val = entry[1];
            var date = val.timestamp ? new Date(val.timestamp).toLocaleDateString('pt-BR') : '??';
            var typeColors = { feature: '#10b981', fix: '#f59e0b', security: '#ef4444', performance: '#22d3ee', ui: '#8b5cf6', database: '#f472b6' };
            var color = typeColors[val.type] || '#6366f1';
            return '<tr>' +
                '<td style="color:#94a3b8;">' + date + '</td>' +
                '<td><span style="color:' + color + '; font-weight:600;">' + (val.type || 'update').toUpperCase() + '</span></td>' +
                '<td style="color:#e2e8f0;">' + (val.version || '?') + '</td>' +
                '<td style="color:#f8fafc;">' + (val.title || '') + '</td>' +
                '<td><button onclick="adminDeleteChangelog(\'' + id + '\')" style="background:rgba(239,68,68,0.2); color:#ef4444; border:1px solid rgba(239,68,68,0.3); padding:4px 10px; border-radius:8px; cursor:pointer; font-size:12px;">🗑️</button></td>' +
                '</tr>';
        }).join('');
    });
}

function adminAddChangelog() {
    if (!isAdmin()) return;

    var title = document.getElementById('admin-cl-title').value.trim();
    var desc = document.getElementById('admin-cl-desc').value.trim();
    var type = document.getElementById('admin-cl-type').value;
    var version = document.getElementById('admin-cl-version').value.trim();

    if (!title) return showAdminToast('Preencha o título', '#ef4444');

    var data = {
        title: title,
        description: desc,
        type: type,
        version: version || '1.0.0',
        timestamp: Date.now()
    };

    firebase.database().ref('changelog').push(data).then(function () {
        showAdminToast('✅ Changelog publicado!', '#10b981');
        document.getElementById('admin-cl-title').value = '';
        document.getElementById('admin-cl-desc').value = '';
    }).catch(function (err) { showAdminToast('❌ Erro: ' + err.message, '#ef4444'); });
}

function adminDeleteChangelog(id) {
    if (!isAdmin() || !confirm('Deletar esta atualização?')) return;
    firebase.database().ref('changelog/' + id).remove();
}

function adminClearAllChangelog() {
    if (!isAdmin() || !confirm('⚠️ Apagar TODAS as atualizações? Isso não pode ser desfeito.')) return;
    firebase.database().ref('changelog').remove().then(function () { showAdminToast('Changelog limpo', '#f59e0b'); });
}

// ============================================================
// SUPPORTERS MANAGER
// ============================================================
function loadAdminSupporters() {
    if (!isAdmin()) return;

    firebase.database().ref('supporters').orderByChild('total_amount').on('value', function (snap) {
        var data = snap.val() || {};
        var supporters = Object.values(data).sort(function (a, b) { return (b.total_amount || 0) - (a.total_amount || 0); });
        var tbody = document.getElementById('admin-supporters-body');
        if (!tbody) return;

        tbody.innerHTML = supporters.map(function (s, i) {
            var medal = i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : '#' + (i + 1);
            return '<tr>' +
                '<td style="color:#fbbf24; font-weight:700;">' + medal + '</td>' +
                '<td style="color:#f8fafc;">' + (s.display_name || 'Anônimo') + '</td>' +
                '<td style="color:#10b981; font-weight:600;">R$ ' + (s.total_amount || 0).toFixed(2) + '</td>' +
                '<td style="color:#a78bfa;">' + (s.tier || 'bronze').toUpperCase() + '</td>' +
                '<td style="color:#94a3b8;">' + (s.donation_count || 1) + '</td>' +
                '</tr>';
        }).join('');
    });
}

// ============================================================
// GLOBAL NOTIFICATIONS
// ============================================================
function adminPushNotification() {
    if (!isAdmin()) return;

    var msg = document.getElementById('admin-push-msg').value.trim();
    if (!msg) return showAdminToast('Digite uma mensagem', '#f59e0b');

    var data = {
        message: msg,
        timestamp: Date.now(),
        id: Math.floor(Date.now() / 1000)
    };

    firebase.database().ref('system_config/announcement').update(data).then(function () {
        showAdminToast('⚡ Notificação enviada para todos!', '#10b981');
        document.getElementById('admin-push-msg').value = '';
    }).catch(function (err) { showAdminToast('❌ ' + err.message, '#ef4444'); });
}

// ============================================================
// ACCESS LOGS
// ============================================================
function loadAdminAccessLogs() {
    if (!isAdmin()) return;

    firebase.database().ref('access_logs').orderByChild('timestamp').limitToLast(100).on('value', function (snap) {
        var data = snap.val() || {};
        var logs = Object.entries(data).sort(function (a, b) { return (b[1].timestamp || 0) - (a[1].timestamp || 0); });
        var tbody = document.getElementById('admin-access-body');
        if (!tbody) return;

        tbody.innerHTML = logs.map(function (entry) {
            var id = entry[0], val = entry[1];
            var date = val.timestamp ? new Date(val.timestamp).toLocaleString('pt-BR') : '??';
            var ua = val.userAgent || '';
            var device = ua.indexOf('Mobi') !== -1 ? '📱' : '💻';
            var browser = 'Unknown';
            if (ua.indexOf('Chrome') !== -1) browser = 'Chrome';
            else if (ua.indexOf('Firefox') !== -1) browser = 'Firefox';
            else if (ua.indexOf('Safari') !== -1) browser = 'Safari';

            return '<tr>' +
                '<td style="color:#94a3b8; font-size:12px;">' + date + '</td>' +
                '<td style="color:#e2e8f0;">' + device + ' ' + browser + '</td>' +
                '<td style="color:#64748b; font-size:11px;">' + (val.screen || '') + '</td>' +
                '</tr>';
        }).join('');
    });
}

function adminClearAccessLogs() {
    if (!isAdmin() || !confirm('Limpar todos os logs de acesso?')) return;
    firebase.database().ref('access_logs').remove().then(function () { showAdminToast('Logs limpos', '#10b981'); });
}

// ============================================================
// SEARCH ACTIVITY & DISCOVERY
// ============================================================
function loadAdminSearchActivity() {
    if (!isAdmin()) return;

    firebase.database().ref('search_activity').orderByChild('timestamp').limitToLast(50).on('value', function (snap) {
        var data = snap.val() || {};
        var items = Object.values(data).sort(function (a, b) { return (b.timestamp || 0) - (a.timestamp || 0); });

        // Ranking (most searched)
        var counts = {};
        items.forEach(function (e) {
            var q = (e.query || '').toUpperCase().trim();
            if (q) counts[q] = (counts[q] || 0) + 1;
        });
        var sorted = Object.entries(counts).sort(function (a, b) { return b[1] - a[1]; }).slice(0, 10);

        var rankEl = document.getElementById('admin-search-ranking');
        if (rankEl) {
            rankEl.innerHTML = sorted.map(function (pair) {
                return '<div style="display:flex; justify-content:space-between; padding:8px 12px; background:rgba(255,255,255,0.03); border-radius:8px; margin-bottom:4px;">' +
                    '<span style="color:#e2e8f0; font-weight:600;">' + pair[0] + '</span>' +
                    '<span style="color:#6366f1; font-weight:700;">' + pair[1] + 'x</span>' +
                    '</div>';
            }).join('') || '<div style="color:#64748b; padding:10px;">Nenhuma busca registrada.</div>';
        }

        // Activity list
        var actEl = document.getElementById('admin-search-activity');
        if (actEl) {
            actEl.innerHTML = items.slice(0, 20).map(function (e) {
                var time = e.timestamp ? new Date(e.timestamp).toLocaleTimeString('pt-BR') : '??';
                var device = e.is_mobile ? '📱' : '💻';
                return '<div style="display:flex; gap:10px; padding:6px 10px; border-bottom:1px solid rgba(255,255,255,0.03); font-size:13px;">' +
                    '<span style="color:#64748b; min-width:60px;">' + time + '</span>' +
                    '<span>' + device + '</span>' +
                    '<span style="color:#f8fafc; font-weight:500;">' + (e.query || '').toUpperCase() + '</span>' +
                    '</div>';
            }).join('') || '<div style="color:#64748b; padding:10px;">Sem atividade.</div>';
        }
    });
}

function adminClearSearchActivity() {
    if (!isAdmin() || !confirm('Limpar atividade de pesquisa e ranking?')) return;
    firebase.database().ref('search_activity').remove().then(function () { showAdminToast('Atividade limpa', '#10b981'); });
}

function loadAdminDiscoveryQueue() {
    if (!isAdmin()) return;

    firebase.database().ref('discovery_queue').on('value', function (snap) {
        var data = snap.val() || {};
        var items = Object.values(data);
        var el = document.getElementById('admin-discovery-queue');
        if (!el) return;

        el.innerHTML = items.map(function (term) {
            return '<div style="padding:8px 12px; background:rgba(168,85,247,0.1); border:1px solid rgba(168,85,247,0.2); border-radius:8px; margin-bottom:4px; color:#c084fc; font-weight:600; text-transform:uppercase;">' +
                term +
                '</div>';
        }).join('') || '<div style="color:#64748b; padding:10px;">Fila vazia — nenhuma demanda pendente.</div>';
    });

    // Discovery history
    firebase.database().ref('discovery_history').orderByChild('date').limitToLast(30).on('value', function (snap) {
        var data = snap.val() || {};
        var items = Object.values(data).sort(function (a, b) { return (b.date || '').localeCompare(a.date || ''); }).slice(0, 20);
        var el = document.getElementById('admin-discovery-history');
        if (!el) return;

        el.innerHTML = items.map(function (e) {
            var isSuccess = e.status && e.status.indexOf('Adicionada') !== -1;
            return '<div style="display:flex; justify-content:space-between; padding:6px 10px; border-bottom:1px solid rgba(255,255,255,0.03); font-size:13px;">' +
                '<span style="color:#94a3b8;">' + (e.date || '??') + '</span>' +
                '<span style="color:#e2e8f0; font-weight:500;">' + (e.query || '').toUpperCase() + '</span>' +
                '<span style="color:' + (isSuccess ? '#10b981' : '#ef4444') + ';">' + (isSuccess ? '✅' : '❌') + '</span>' +
                '</div>';
        }).join('') || '<div style="color:#64748b; padding:10px;">Sem histórico.</div>';
    });
}

// ============================================================
// BUG REPORTS
// ============================================================
function loadAdminBugReports() {
    if (!isAdmin()) return;

    firebase.database().ref('bug_reports').on('value', function (snap) {
        var data = snap.val() || {};
        var reports = Object.entries(data).sort(function (a, b) { return (b[1].timestamp || 0) - (a[1].timestamp || 0); });
        var tbody = document.getElementById('admin-bugs-body');
        if (!tbody) return;

        tbody.innerHTML = reports.map(function (entry) {
            var id = entry[0], val = entry[1];
            var date = val.timestamp ? new Date(val.timestamp).toLocaleDateString('pt-BR') : '??';
            return '<tr>' +
                '<td><span style="color:#f59e0b; font-weight:600; text-transform:uppercase;">' + (val.type || '?') + '</span></td>' +
                '<td style="color:#e2e8f0; max-width:300px; overflow:hidden; text-overflow:ellipsis; white-space:nowrap;">' + (val.description || '') + '</td>' +
                '<td style="color:#94a3b8;">' + (val.page || '') + '</td>' +
                '<td style="color:#64748b;">' + date + '</td>' +
                '<td><button onclick="adminDeleteBug(\'' + id + '\')" style="background:rgba(239,68,68,0.2); color:#ef4444; border:1px solid rgba(239,68,68,0.3); padding:4px 10px; border-radius:8px; cursor:pointer;">🗑️</button></td>' +
                '</tr>';
        }).join('');
    });
}

function adminDeleteBug(id) {
    if (!isAdmin()) return;
    firebase.database().ref('bug_reports/' + id).remove();
}

function adminClearBugs() {
    if (!isAdmin() || !confirm('Apagar todos os bugs?')) return;
    firebase.database().ref('bug_reports').remove().then(function () { showAdminToast('Bugs limpos', '#10b981'); });
}

// ============================================================
// MESSAGE REPORTS (Real-time inbox)
// ============================================================
function loadAdminMessageReports() {
    if (!isAdmin()) return;

    firebase.database().ref('message_reports').orderByChild('timestamp').on('value', function (snap) {
        var data = snap.val() || {};
        var reports = Object.entries(data).sort(function (a, b) { return (b[1].timestamp || 0) - (a[1].timestamp || 0); });
        var el = document.getElementById('admin-reports-body');
        if (!el) return;

        var countEl = document.getElementById('admin-reports-count');
        if (countEl) countEl.textContent = reports.length;

        el.innerHTML = reports.map(function (entry) {
            var id = entry[0], r = entry[1];
            var date = r.timestamp ? new Date(r.timestamp).toLocaleString('pt-BR') : '??';
            return '<div style="background:rgba(239,68,68,0.05); border:1px solid rgba(239,68,68,0.15); border-radius:12px; padding:14px; margin-bottom:8px;">' +
                '<div style="display:flex; justify-content:space-between; margin-bottom:8px;">' +
                '<span style="color:#ef4444; font-weight:700;">🚩 Report #' + id.substring(0, 6) + '</span>' +
                '<span style="color:#64748b; font-size:12px;">' + date + '</span>' +
                '</div>' +
                '<div style="color:#94a3b8; font-size:12px; margin-bottom:4px;">Denunciado por: <span style="color:#e2e8f0;">' + (r.reporterName || '?') + '</span></div>' +
                '<div style="color:#94a3b8; font-size:12px; margin-bottom:4px;">Autor: <span style="color:#f59e0b;">' + (r.authorName || '?') + '</span> (' + (r.authorId || '?') + ')</div>' +
                '<div style="background:rgba(0,0,0,0.3); padding:10px; border-radius:8px; color:#e2e8f0; font-size:13px; margin:8px 0; word-break:break-word;">"' + (r.messageText || '(sem texto)') + '"</div>' +
                '<div style="display:flex; gap:6px;">' +
                '<button onclick="adminDeleteReport(\'' + id + '\')" style="background:rgba(16,185,129,0.2); color:#10b981; border:1px solid rgba(16,185,129,0.3); padding:4px 12px; border-radius:8px; cursor:pointer; font-size:12px;">✅ Resolvido</button>' +
                '<button onclick="adminDeleteMsg(\'' + (r.msgPath || '') + '\')" style="background:rgba(239,68,68,0.2); color:#ef4444; border:1px solid rgba(239,68,68,0.3); padding:4px 12px; border-radius:8px; cursor:pointer; font-size:12px;">🗑️ Apagar Msg</button>' +
                '</div>' +
                '</div>';
        }).join('') || '<div style="color:#64748b; padding:20px; text-align:center;">Nenhuma denúncia pendente. 🎉</div>';
    });
}

function adminDeleteReport(id) {
    if (!isAdmin()) return;
    firebase.database().ref('message_reports/' + id).remove();
}

function adminDeleteMsg(path) {
    if (!isAdmin() || !path) return;
    if (!confirm('Apagar esta mensagem do servidor?')) return;
    firebase.database().ref(path).remove().then(function () { showAdminToast('Mensagem apagada', '#10b981'); });
}

// ============================================================
// DANGER ZONE
// ============================================================
function adminResetPopularity() {
    if (!isAdmin() || !confirm('⚠️ Resetar todos os dados de popularidade da semana?')) return;
    firebase.database().ref('popular_stats').remove().then(function () { showAdminToast('Popularidade resetada', '#f59e0b'); });
}

// ============================================================
// REPORT MESSAGE (Called from context menu)
// ============================================================
function reportKordMessage() {
    if (!window.currentUser) return;

    var inputArea = document.getElementById('kord-input-area');
    var target = inputArea ? inputArea.getAttribute('data-target') : null;
    var sId = window.currentKordServer;
    var cId = window.currentKordChannel;
    var msgId = window.currentContextMsgId;
    var msgPath = '';

    try {
        if (target === 'forums') {
            msgPath = 'forums/' + msgId;
        } else if (target && target.indexOf('dm:') === 0) {
            var uid = target.replace('dm:', '');
            var dmId = window.currentUser.uid < uid ? window.currentUser.uid + '_' + uid : uid + '_' + window.currentUser.uid;
            msgPath = 'direct_messages/' + dmId + '/messages/' + msgId;
        } else if (target && target.indexOf('group:') === 0) {
            msgPath = 'groups/' + target.replace('group:', '') + '/messages/' + msgId;
        } else {
            msgPath = 'servers/' + sId + '/channels/' + cId + '/messages/' + msgId;
        }
    } catch (e) {
        msgPath = '';
    }

    var report = {
        messageText: window.currentContextMsgText || '(sem texto)',
        authorId: window.currentContextAuthorId || '',
        authorName: window.currentContextAuthorName || '',
        reporterId: window.currentUser.uid,
        reporterName: window.currentUser.displayName || window.currentUser.email,
        timestamp: Date.now(),
        msgPath: msgPath
    };

    firebase.database().ref('message_reports').push(report).then(function () {
        if (typeof showKordAlert === 'function') {
            showKordAlert('Denúncia Enviada', 'Sua denúncia foi encaminhada para os administradores em tempo real. Obrigado por reportar.', 'flag', '#10b981');
        }
    }).catch(function (err) {
        if (typeof showKordAlert === 'function') {
            showKordAlert('Erro ao Reportar', err.message, 'error', '#ef4444');
        }
    });
}

// ============================================================
// ADMIN UI TAB SWITCHING
// ============================================================
function switchAdminTab(tabName) {
    if (!isAdmin()) return;

    var contents = document.querySelectorAll('.admin-tab-content');
    for (var i = 0; i < contents.length; i++) {
        contents[i].style.display = 'none';
    }
    var btns = document.querySelectorAll('.admin-tab-btn');
    for (var j = 0; j < btns.length; j++) {
        btns[j].classList.remove('active');
        btns[j].style.background = 'rgba(255,255,255,0.04)';
        btns[j].style.color = '#94a3b8';
        btns[j].style.borderColor = 'rgba(255,255,255,0.08)';
    }

    var target = document.getElementById('admin-tab-' + tabName);
    if (target) target.style.display = 'block';

    var btn = document.querySelector('.admin-tab-btn[data-tab="' + tabName + '"]');
    if (btn) {
        btn.classList.add('active');
        btn.style.background = 'rgba(99,102,241,0.15)';
        btn.style.color = '#a78bfa';
        btn.style.borderColor = 'rgba(99,102,241,0.3)';
    }
}

// ============================================================
// TOAST NOTIFICATIONS
// ============================================================
function showAdminToast(message, color) {
    color = color || '#6366f1';
    var toast = document.createElement('div');
    toast.style.cssText = 'position:fixed; bottom:30px; right:30px; background:rgba(15,23,42,0.95); color:' + color + '; padding:14px 24px; border-radius:12px; border:1px solid ' + color + '40; font-weight:600; font-size:14px; z-index:999999; backdrop-filter:blur(10px); transition:opacity 0.3s;';
    toast.textContent = message;
    document.body.appendChild(toast);
    setTimeout(function () {
        toast.style.opacity = '0';
        setTimeout(function () { toast.remove(); }, 300);
    }, 3000);
}

// ============================================================
// CLEANUP ON LOGOUT
// ============================================================
function cleanupAdminListeners() {
    _detachAdminListeners();
    _adminReady = false;
    _adminLoaded = false;
}
