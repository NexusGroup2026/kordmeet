/**
 * ============================================================
 * KORD KORD - Light Security (No Blocking)
 * ============================================================
 */

(function() {
    'use strict';
    
    // ============================================================
    // INPUT SANITIZATION
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
    // RATE LIMITER (Friendly)
    // ============================================================
    const buckets = {};
    function rateLimit(key, max = 100) {
        const now = Date.now();
        if (!buckets[key]) buckets[key] = { count: 0, reset: now + 60000 };
        if (now > buckets[key].reset) {
            buckets[key] = { count: 0, reset: now + 60000 };
        }
        buckets[key].count++;
        return buckets[key].count <= max;
    }
    
    // ============================================================
    // SIMPLE HONEYPOT (Invisible, doesn't block)
    // ============================================================
    function initHoneypot() {
        // Just create trap fields, don't block anyone
        document.querySelectorAll('form').forEach((form, idx) => {
            const trap = document.createElement('input');
            trap.type = 'text';
            trap.name = 'website';
            trap.style.cssText = 'position:absolute;left:-9999px;top:-9999px;';
            trap.setAttribute('aria-hidden', 'true');
            form.appendChild(trap);
        });
    }
    
    // ============================================================
    // SECURITY LOGGER (For monitoring only)
    // ============================================================
    const logs = [];
    function log(type, data) {
        const entry = { type, data, time: Date.now() };
        logs.push(entry);
        if (logs.length > 100) logs.shift();
        
        // Try to send to server silently
        try {
            if (window.firebase && firebase.apps && firebase.apps.length > 0) {
                firebase.database().ref('_security_events').push(entry).catch(() => {});
            }
        } catch (e) {}
    }
    
    // ============================================================
    // DETERMINE IF USER AGENT IS SUSPICIOUS
    // ============================================================
    function isBot() {
        const ua = navigator.userAgent.toLowerCase();
        const bots = ['sqlmap', 'nikto', 'nmap', 'masscan', 'hydra', 'metasploit', 'burpsuite'];
        return bots.some(bot => ua.includes(bot));
    }
    
    // ============================================================
    // INIT
    // ============================================================
    function init() {
        initHoneypot();
        
        // Log if bot detected (but don't block)
        if (isBot()) {
            log('BOT_DETECTED', { ua: navigator.userAgent.substring(0, 50) });
        }
        
        // Block only actual dangerous code execution attempts
        const originalEval = window.eval;
        window.eval = function(code) {
            // Only block if it's clearly malicious
            if (code && typeof code === 'string' && code.includes('<script')) {
                log('EVAL_BLOCKED', { code: code.substring(0, 50) });
                return;
            }
            return originalEval.apply(this, arguments);
        };
    }
    
    // Auto init
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }
    
    // Export
    window.Kord = {
        sanitize,
        rateLimit,
        log
    };
})();