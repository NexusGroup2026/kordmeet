/**
 * ============================================================
 * KORD DONATION ENGINE v3.0
 * Secure PayPal + Auto-Verification + Ranking
 * ============================================================
 */

'use strict';

// ============================================================
// SECURITY ENGINE
// ============================================================
const SecurityEngine = (() => {
    const state = {
        token: null,
        session: null,
        requests: 0,
        lastRequest: 0
    };

    const generateToken = (len = 32) => {
        const arr = new Uint8Array(len);
        crypto.getRandomValues(arr);
        return Array.from(arr, b => b.toString(16).padStart(2, '0')).join('');
    };

    const getFingerprint = () => {
        const data = [
            navigator.userAgent,
            navigator.language,
            screen.width + 'x' + screen.height,
            new Date().getTimezoneOffset()
        ].join('|');
        return btoa(data).slice(0, 24);
    };

    const checkRateLimit = () => {
        const now = Date.now();
        if (now - state.lastRequest > 60000) state.requests = 0;
        if (state.requests >= 5) return false;
        state.requests++;
        state.lastRequest = now;
        return true;
    };

    const validateAmount = (amount) => {
        const num = parseFloat(amount);
        if (isNaN(num) || num < 1 || num > 10000) {
            return { valid: false, error: 'Valor deve ser entre R$1 e R$10.000' };
        }
        return { valid: true, amount: Math.round(num * 100) / 100 };
    };

    const init = () => {
        state.token = generateToken();
        state.session = generateToken(16);
    };

    init();

    return { checkRateLimit, validateAmount, getFingerprint, getSession: () => state.session };
})();

// ============================================================
// PAYPAL CONFIG
// ============================================================
const PAYPAL_CONFIG = Object.freeze({
    EMAIL: 'moisesvvanti@gmail.com',
    CURRENCY: 'BRL',
    LOCALE: 'pt_BR',
    IPN_URL: window.location.origin + '/iacurator/paypal_ipn.php'
});

const TIERS = {
    5: { name: 'Apoiador', emoji: '☕' },
    15: { name: 'Impulsionador', emoji: '🚀' },
    50: { name: 'Patrocinador', emoji: '💎' }
};

// ============================================================
// DONATION PROCESSOR
// ============================================================
const KordDonate = (() => {

    const buildPayPalURL = (amount) => {
        const tier = TIERS[amount] || { name: 'Apoio', emoji: '✨' };
        const itemName = `${tier.emoji} Kord AI Curator - ${tier.name} (R$${amount})`;

        const params = new URLSearchParams({
            cmd: '_donations',
            business: PAYPAL_CONFIG.EMAIL,
            item_name: itemName,
            amount: amount.toFixed(2),
            currency_code: PAYPAL_CONFIG.CURRENCY,
            return: window.location.origin + '/iacurator/?donation=success',
            cancel_return: window.location.origin + '/iacurator/?donation=cancelled',
            notify_url: PAYPAL_CONFIG.IPN_URL,
            no_shipping: '1',
            lc: PAYPAL_CONFIG.LOCALE,
            custom: JSON.stringify({
                session: SecurityEngine.getSession(),
                fp: SecurityEngine.getFingerprint(),
                tier: tier.name,
                ts: Date.now()
            })
        });

        return `https://www.paypal.com/cgi-bin/webscr?${params.toString()}`;
    };

    const process = (amount) => {
        if (!SecurityEngine.checkRateLimit()) {
            showToast('⏱️ Aguarde um momento antes de tentar novamente', 'warning');
            return;
        }

        const validation = SecurityEngine.validateAmount(amount);
        if (!validation.valid) {
            showToast(`❌ ${validation.error}`, 'error');
            return;
        }

        // Visual feedback
        const btn = document.querySelector(`[data-amount="${amount}"] .tier-btn`);
        if (btn) {
            btn.innerHTML = '<span class="loading-spinner"></span> Aguarde...';
            btn.disabled = true;
        }

        showToast('🔒 Redirecionando para PayPal...', 'info');

        setTimeout(() => {
            window.location.href = buildPayPalURL(validation.amount);
        }, 800);
    };

    const processCustom = () => {
        const input = document.getElementById('customAmount');
        if (!input) return;

        const amount = parseFloat(input.value);
        if (!amount || amount < 1) {
            showToast('❌ Digite um valor válido (mínimo R$1)', 'error');
            input.classList.add('shake');
            setTimeout(() => input.classList.remove('shake'), 500);
            return;
        }

        process(amount);
    };

    return { process, processCustom };
})();

// ============================================================
// TOAST NOTIFICATIONS
// ============================================================
function showToast(message, type = 'info') {
    const existing = document.querySelector('.toast-notification');
    if (existing) existing.remove();

    const colors = {
        info: 'linear-gradient(135deg, #6366f1, #8b5cf6)',
        success: 'linear-gradient(135deg, #10b981, #059669)',
        warning: 'linear-gradient(135deg, #f59e0b, #d97706)',
        error: 'linear-gradient(135deg, #ef4444, #dc2626)'
    };

    const toast = document.createElement('div');
    toast.className = 'toast-notification';
    toast.innerHTML = message;
    toast.style.cssText = `
        position: fixed;
        top: 24px;
        right: 24px;
        padding: 16px 28px;
        background: ${colors[type]};
        color: white;
        border-radius: 14px;
        font-weight: 600;
        font-size: 0.95rem;
        z-index: 99999;
        box-shadow: 0 20px 60px rgba(0,0,0,0.4);
        animation: toastIn 0.4s ease-out;
    `;

    document.body.appendChild(toast);

    setTimeout(() => {
        toast.style.animation = 'toastOut 0.3s ease-in forwards';
        setTimeout(() => toast.remove(), 300);
    }, 4000);
}

// ============================================================
// RANKING LOADER
// ============================================================
const RankingManager = (() => {
    const container = () => document.getElementById('rankingGrid');

    const loadRanking = async () => {
        const grid = container();
        if (!grid) return;

        grid.innerHTML = `
            <div class="ranking-loading">
                <span class="material-icons-round rotating">sync</span>
                <p>Carregando apoiadores...</p>
            </div>
        `;

        try {
            const response = await fetch('/iacurator/api_supporters.php');
            const data = await response.json();

            if (!data.success || !data.ranking || data.ranking.length === 0) {
                grid.innerHTML = `
                    <div class="ranking-empty">
                        <span class="material-icons-round">emoji_events</span>
                        <p>Seja o primeiro apoiador!</p>
                    </div>
                `;
                return;
            }

            renderRanking(data.ranking);

        } catch (error) {
            console.error('Ranking error:', error);
            grid.innerHTML = `
                <div class="ranking-empty">
                    <span class="material-icons-round">cloud_off</span>
                    <p>Não foi possível carregar o ranking</p>
                </div>
            `;
        }
    };

    const renderRanking = (ranking) => {
        const grid = container();
        if (!grid) return;

        let html = '';
        ranking.forEach((supporter, i) => {
            const rankClass = i === 0 ? 'gold' : i === 1 ? 'silver' : i === 2 ? 'bronze' : 'normal';
            const initial = (supporter.display_name || 'A')[0].toUpperCase();
            const tier = supporter.tier || 'bronze';

            html += `
                <div class="supporter-card" style="animation-delay: ${i * 0.05}s">
                    <div class="supporter-rank ${rankClass}">${i < 3 ? ['🥇', '🥈', '🥉'][i] : i + 1}</div>
                    <div class="supporter-avatar">${initial}</div>
                    <div class="supporter-info">
                        <div class="supporter-name">
                            ${escapeHtml(supporter.display_name || 'Apoiador')}
                            <span class="supporter-tier-badge ${tier}">${tier.toUpperCase()}</span>
                        </div>
                        <div class="supporter-stats">${supporter.donation_count || 1} doação(ões)</div>
                    </div>
                    <div class="supporter-amount">
                        <div class="supporter-total">R$${(supporter.total_amount || 0).toFixed(2)}</div>
                        <div class="supporter-count">verificado ✓</div>
                    </div>
                </div>
            `;
        });

        grid.innerHTML = html;
    };

    const escapeHtml = (str) => {
        const div = document.createElement('div');
        div.textContent = str;
        return div.innerHTML;
    };

    return { loadRanking };
})();

// ============================================================
// URL HANDLER (Success/Cancel)
// ============================================================
function handleURLParams() {
    const params = new URLSearchParams(window.location.search);
    const status = params.get('donation');

    if (status === 'success') {
        setTimeout(() => {
            showToast('🎉 Obrigado pelo seu apoio! Você será adicionado ao ranking após a verificação.', 'success');
        }, 500);
        window.history.replaceState({}, '', window.location.pathname);
    } else if (status === 'cancelled') {
        setTimeout(() => {
            showToast('ℹ️ Doação cancelada. Volte quando quiser!', 'info');
        }, 500);
        window.history.replaceState({}, '', window.location.pathname);
    }
}

// ============================================================
// INIT
// ============================================================
document.addEventListener('DOMContentLoaded', () => {
    handleURLParams();

    // Load ranking when support view is shown
    const supportView = document.getElementById('view-support');
    if (supportView) {
        const observer = new MutationObserver((mutations) => {
            mutations.forEach((mutation) => {
                if (supportView.style.display !== 'none') {
                    RankingManager.loadRanking();
                }
            });
        });

        observer.observe(supportView, { attributes: true, attributeFilter: ['style'] });
    }

    // Add animation styles
    const style = document.createElement('style');
    style.textContent = `
        @keyframes toastIn {
            from { opacity: 0; transform: translateX(100px) scale(0.8); }
            to { opacity: 1; transform: translateX(0) scale(1); }
        }
        @keyframes toastOut {
            to { opacity: 0; transform: translateX(100px) scale(0.8); }
        }
        @keyframes shake {
            0%, 100% { transform: translateX(0); }
            25% { transform: translateX(-8px); }
            75% { transform: translateX(8px); }
        }
        @keyframes rotating {
            from { transform: rotate(0deg); }
            to { transform: rotate(360deg); }
        }
        .shake { animation: shake 0.4s ease; }
        .rotating { animation: rotating 1s linear infinite; }
        .loading-spinner {
            display: inline-block;
            width: 18px;
            height: 18px;
            border: 2px solid rgba(255,255,255,0.3);
            border-top-color: white;
            border-radius: 50%;
            animation: rotating 0.8s linear infinite;
        }
    `;
    document.head.appendChild(style);
});

// Expose to global
window.KordDonate = KordDonate;
