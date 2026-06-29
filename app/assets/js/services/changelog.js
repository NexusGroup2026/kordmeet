/**
 * ============================================================
 * KORD CHANGELOG - Firebase Realtime System (Clean v7)
 * ============================================================
 */

const ChangelogManager = (() => {
    const CONFIG = {
            apiKey: "AIzaSyABiswBX4ox8Q-oTp7r83lSuMTLlCXqoa8",
            authDomain: "kakaxicenter.firebaseapp.com",
            databaseURL: "https://kakaxicenter-default-rtdb.firebaseio.com",
            projectId: "kakaxicenter",
            storageBucket: "kakaxicenter.firebasestorage.app",
            messagingSenderId: "174843553515",
            appId: "1:174843553515:web:6c0f625eea4e93c9e700ae"
        };

    const TYPE_CONFIG = {
        feature: { icon: 'auto_awesome', color: '#10b981', label: 'Novidade' },
        fix: { icon: 'build', color: '#f59e0b', label: 'Correção' },
        update: { icon: 'update', color: '#6366f1', label: 'Atualização' },
        security: { icon: 'security', color: '#22d3ee', label: 'Segurança' },
        performance: { icon: 'speed', color: '#ef4444', label: 'Performance' }
    };

    let entries = [];
    let currentFilter = 'all';
    let searchTerm = '';

    // =============================================
    // INIT: Fetch data via REST API (Simple & Reliable)
    // =============================================
    const startListening = async () => {
        const container = document.getElementById('changelogContainer');
        if (!container) return;

        container.innerHTML = '<div style="text-align:center;padding:40px;color:#888"><span class="material-icons-round" style="animation:spin 1s linear infinite">sync</span><p>Conectando ao servidor...</p></div>';

        try {
            // Fetch via REST API (Most Reliable)
            const url = `${CONFIG.databaseURL}/changelog.json`;
            console.log('[Changelog] Fetching:', url);

            const response = await fetch(url);
            if (!response.ok) throw new Error(`HTTP Error: ${response.status}`);

            const data = await response.json();
            console.log('[Changelog] Data received:', data);

            entries = [];
            if (data) {
                Object.keys(data).forEach(key => {
                    const item = data[key];
                    if (item && typeof item === 'object' && item.title) {
                        entries.push({ id: key, ...item });
                    }
                });
                // Sort by VERSION (highest first), not by timestamp
                entries.sort((a, b) => compareVersions(b.version || '0.0.0', a.version || '0.0.0'));

                // SYNC VERSION GLOBALLY (highest version)
                const highestVer = getHighestVersion();
                if (highestVer) {
                    syncGlobalVersion(highestVer);
                }
            }

            render();

            // Also setup real-time listener if Firebase SDK is available
            setupRealtimeListener();

        } catch (err) {
            console.error('[Changelog] Error:', err);
            container.innerHTML = `
                <div style="text-align:center;padding:40px;color:#ef4444">
                    <span class="material-icons-round" style="font-size:3rem">cloud_off</span>
                    <p>Erro ao carregar: ${err.message}</p>
                    <button onclick="ChangelogManager.startListening()" style="margin-top:15px;padding:10px 20px;border-radius:10px;background:#6366f1;color:white;border:none;cursor:pointer">
                        Tentar Novamente
                    </button>
                </div>
            `;
        }
    };

    // =============================================
    // SYNC VERSION ACROSS ENTIRE SITE
    // =============================================
    const syncGlobalVersion = (version) => {
        console.log('[Changelog] Syncing global version to:', version);

        // Update by ID
        const versionEl = document.getElementById('site-version');
        if (versionEl) {
            versionEl.textContent = `KORD v${version} - Premium AI Catalog`;
        }

        // Update all elements with class .site-version
        document.querySelectorAll('.site-version').forEach(el => {
            el.textContent = `v${version}`;
        });

        // Update page title
        document.title = `KORD v${version} - AI Curator`;

        // Store in localStorage for other pages
        localStorage.setItem('kord_current_version', version);
    };

    // Find the HIGHEST version (semantic versioning comparison)
    const getHighestVersion = () => {
        if (entries.length === 0) return null;

        let highest = entries[0].version || '0.0.0';

        entries.forEach(entry => {
            if (entry.version && compareVersions(entry.version, highest) > 0) {
                highest = entry.version;
            }
        });

        return highest;
    };

    // Compare two version strings (returns 1 if a > b, -1 if a < b, 0 if equal)
    const compareVersions = (a, b) => {
        const partsA = String(a).split('.').map(n => parseInt(n) || 0);
        const partsB = String(b).split('.').map(n => parseInt(n) || 0);

        for (let i = 0; i < Math.max(partsA.length, partsB.length); i++) {
            const numA = partsA[i] || 0;
            const numB = partsB[i] || 0;
            if (numA > numB) return 1;
            if (numA < numB) return -1;
        }
        return 0;
    };

    // Real-time updates (optional enhancement)
    const setupRealtimeListener = () => {
        if (typeof firebase === 'undefined') return;

        try {
            // Firebase should already be initialized globally
            if (typeof firebase === 'undefined' || !firebase.apps.length) {
                console.warn('[Changelog] Firebase app not initialized globally.');
                return;
            }

            firebase.database().ref('changelog').on('value', (snap) => {
                const data = snap.val();
                entries = [];
                if (data) {
                    Object.keys(data).forEach(key => {
                        const item = data[key];
                        if (item && typeof item === 'object' && item.title) {
                            entries.push({ id: key, ...item });
                        }
                    });
                    // Sort by VERSION (highest first)
                    entries.sort((a, b) => compareVersions(b.version || '0.0.0', a.version || '0.0.0'));

                    // SYNC VERSION on real-time update (highest)
                    const highestVer = getHighestVersion();
                    if (highestVer) {
                        syncGlobalVersion(highestVer);
                    }
                }
                render();
            });
        } catch (e) {
            console.warn('[Changelog] Real-time listener failed:', e);
        }
    };

    // =============================================
    // RENDER UI
    // =============================================
    const render = () => {
        const container = document.getElementById('changelogContainer');
        if (!container) return;

        // Filter entries
        let filtered = entries.filter(e => {
            const matchType = currentFilter === 'all' || e.type === currentFilter;
            const matchSearch = !searchTerm ||
                (e.title || '').toLowerCase().includes(searchTerm) ||
                (e.description || '').toLowerCase().includes(searchTerm);
            return matchType && matchSearch;
        });

        // Container Separation to preserve focus on Inputs
        let controls = document.getElementById('changelog-controls-wrapper');
        let timeline = document.getElementById('changelog-timeline-wrapper');

        if (!controls || !timeline) {
            container.innerHTML = `
                <div id="changelog-controls-wrapper"></div>
                <div id="changelog-timeline-wrapper"></div>
            `;
            controls = document.getElementById('changelog-controls-wrapper');
            timeline = document.getElementById('changelog-timeline-wrapper');

            // Render controls once
            controls.innerHTML = `
                <div class="changelog-controls" style="display:flex;justify-content:space-between;align-items:center;padding:20px;background:rgba(255,255,255,0.03);border-radius:16px;margin-bottom:30px;flex-wrap:wrap;gap:15px">
                    <div style="font-size:1.5rem;font-weight:700"><span id="changelog-count">0</span> <span style="font-size:0.8rem;color:#888">atualizações</span></div>
                    <div style="display:flex;gap:10px">
                        <input type="text" placeholder="Buscar..." oninput="ChangelogManager.setSearch(this.value)" style="padding:10px 15px;border-radius:10px;border:1px solid rgba(255,255,255,0.1);background:rgba(0,0,0,0.2);color:white">
                        <select onchange="ChangelogManager.setFilter(this.value)" style="padding:10px;border-radius:10px;border:1px solid rgba(255,255,255,0.1);background:rgba(0,0,0,0.2);color:white">
                            <option value="all">Todos</option>
                            <option value="feature">✨ Novidades</option>
                            <option value="fix">🔧 Correções</option>
                            <option value="update">📦 Updates</option>
                            <option value="security">🔒 Segurança</option>
                            <option value="performance">⚡ Performance</option>
                        </select>
                    </div>
                </div>
            `;
        }

        // Update count
        const countEl = document.getElementById('changelog-count');
        if (countEl) countEl.textContent = entries.length;

        // Empty state
        if (filtered.length === 0) {
            timeline.innerHTML = `
                <div style="text-align:center;padding:60px 20px;color:#666">
                    <span class="material-icons-round" style="font-size:4rem;display:block;margin-bottom:15px">inbox</span>
                    <p>${entries.length === 0 ? 'Nenhuma atualização cadastrada ainda.' : 'Nenhum resultado para o filtro.'}</p>
                </div>
            `;
            return;
        }

        // Timeline
        let html = '<div class="changelog-timeline">';

        const months = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];
        let lastMonth = '';

        filtered.forEach((entry, i) => {
            const type = TYPE_CONFIG[entry.type] || TYPE_CONFIG.update;
            const date = new Date(entry.timestamp || Date.now());
            const monthKey = `${months[date.getMonth()]} ${date.getFullYear()}`;

            // Month separator
            if (monthKey !== lastMonth) {
                html += `<div style="color:#6366f1;font-weight:700;margin:30px 0 15px 100px;font-size:0.85rem;letter-spacing:2px">${monthKey.toUpperCase()}</div>`;
                lastMonth = monthKey;
            }

            // Entry card
            html += `
                <div class="timeline-item" style="display:flex;gap:30px;margin-bottom:30px;animation:fadeIn 0.5s ease ${i * 0.1}s backwards">
                    <div style="width:70px;text-align:right">
                        <div style="font-size:1.8rem;font-weight:800;color:white">${date.getDate().toString().padStart(2, '0')}</div>
                        <div style="font-size:0.8rem;color:#6366f1;font-weight:600">${months[date.getMonth()]}</div>
                    </div>
                    <div style="width:12px;height:12px;border-radius:50%;background:${type.color};margin-top:10px;box-shadow:0 0 10px ${type.color}"></div>
                    <div style="flex:1;background:rgba(255,255,255,0.03);border:1px solid rgba(255,255,255,0.05);border-radius:16px;padding:25px">
                        <div style="display:flex;gap:10px;margin-bottom:15px;flex-wrap:wrap;align-items:center">
                            <span style="background:${type.color}22;color:${type.color};padding:6px 12px;border-radius:8px;font-size:0.75rem;font-weight:700;display:flex;align-items:center;gap:5px">
                                <span class="material-icons-round" style="font-size:14px">${type.icon}</span>
                                ${type.label}
                            </span>
                            <span style="background:rgba(0,0,0,0.3);padding:4px 10px;border-radius:6px;font-family:monospace;font-size:0.8rem;color:#888">v${entry.version || '1.0.0'}</span>
                            ${i === 0 && currentFilter === 'all' && !searchTerm ? '<span style="background:#10b981;color:white;padding:4px 10px;border-radius:6px;font-size:0.7rem;font-weight:700">NOVO</span>' : ''}
                        </div>
                        <h3 style="margin:0 0 10px 0;font-size:1.3rem;color:var(--text-primary)">${entry.title}</h3>
                        <p style="margin:0;color:var(--text-secondary);line-height:1.6">${(entry.description || '').replace(/\\n/g, '<br>')}</p>
                    </div>
                </div>
            `;
        });

        html += '</div>';
        timeline.innerHTML = html;
    };

    // Filter & Search
    const setFilter = (val) => { currentFilter = val; render(); };
    const setSearch = (val) => { searchTerm = val.toLowerCase(); render(); };

    // Init function (for external calls)
    const init = () => Promise.resolve(true);

    return { startListening, setFilter, setSearch, init };
})();

// Auto-start on page load
document.addEventListener('DOMContentLoaded', () => {
    ChangelogManager.startListening();
});

// CSS Animation
const style = document.createElement('style');
style.textContent = `
    @keyframes fadeIn { from { opacity: 0; transform: translateY(20px); } to { opacity: 1; transform: translateY(0); } }
    @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
`;
document.head.appendChild(style);
