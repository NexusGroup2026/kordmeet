/**
 * ============================================================
 * KORD SECURITY - Simple & Friendly
 * No blocking, just protection
 * ============================================================
 */

(function() {
    'use strict';
    
    // ============================================================
    // BASIC XSS PROTECTION
    // ============================================================
    function sanitize(str) {
        if (!str || typeof str !== 'string') return '';
        return str
            .replace(/&/g, '&')
            .replace(/</g, '<')
            .replace(/>/g, '>')
            .replace(/"/g, '"')
            .replace(/'/g, '&#039;');
    }
    
    // ============================================================
    // RIGHT-CLICK BLOCK (Optional, can be disabled)
    // ============================================================
    function initRightClickBlock() {
        document.addEventListener('contextmenu', e => {
            // Allow right-click on text inputs
            if (e.target.closest('input, textarea, [contenteditable]')) return;
            e.preventDefault();
        });
    }
    
    // ============================================================
    // KEYBOARD SHORTCUTS (F12 only, for accessibility)
    // ============================================================
    function initKeyboardBlock() {
        document.addEventListener('keydown', e => {
            // Only block F12 (dev tools) - not ctrl+u, ctrl+shift+i etc
            if (e.keyCode === 123) {
                e.preventDefault();
                return false;
            }
        });
    }
    
    // ============================================================
    // NETWORK ERROR HANDLING
    // ============================================================
    function initNetworkHandler() {
        const originalFetch = window.fetch;
        window.fetch = function(url, options) {
            return originalFetch.apply(this, arguments).catch(err => {
                console.log('Erro de conexão');
                return Promise.reject(err);
            });
        };
    }
    
    // ============================================================
    // RATE LIMIT CHECK
    // ============================================================
    const requestCounts = {};
    function checkRate(key, limit = 100) {
        const now = Date.now();
        if (!requestCounts[key]) requestCounts[key] = [];
        requestCounts[key] = requestCounts[key].filter(t => now - t < 60000);
        if (requestCounts[key].length >= limit) return false;
        requestCounts[key].push(now);
        return true;
    }
    
    // ============================================================
    // LOG SECURITY EVENT (for monitoring, not blocking)
    // ============================================================
    function logSecurity(type, data) {
        try {
            if (window.firebase && firebase.apps && firebase.apps.length > 0) {
                firebase.database().ref('_logs/security').push({
                    type: type,
                    data: data,
                    timestamp: Date.now()
                }).catch(() => {});
            }
        } catch (e) {}
    }
    
    // ============================================================
    // INIT
    // ============================================================
    function init() {
        initRightClickBlock();
        initKeyboardBlock();
        initNetworkHandler();
        
        console.log('%c Kord Shield Active', 'color: #6366f1; font-weight: bold;');
    }
    
    // Run on DOM ready
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }
    
    // Export for use in other scripts
    window.KordShield = {
        sanitize: sanitize,
        checkRate: checkRate,
        log: logSecurity
    };
})();