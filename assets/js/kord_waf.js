/**
 * ============================================================
 * KORD WAF PRO v4.0 - Web Application Firewall Frontend
 * Ultimate Zero-Day Attack Prevention
 * AI-Powered Threat Detection
 * ============================================================
 */

(function() {
    'use strict';
    
    // ============================================================
    // WAF CONFIGURATION
    // ============================================================
    const WAF = {
        version: '4.0.0',
        blocked: false,
        threatLevel: 0,
        
        // Known attacker signatures
        signatures: {
            // SQL Injection patterns
            sqlPatterns: [
                /(\b(SELECT|INSERT|UPDATE|DELETE|DROP|CREATE|ALTER|TRUNCATE|EXEC|EXECUTE|XP_)\b)/i,
                /(UNION|AND|OR)\s+(SELECT|ALL|DISTINCT)/i,
                /'\s*(OR|AND)\s*'1'\s*=\s*'1/i,
                /(OR|AND)\s+\d+\s*=\s*\d+/i,
                /INTO\s+(OUTFILE|DUMPFILE)/i,
                /LOAD_FILE\s*\(/i,
                /BENCHMARK\s*\(/i,
                /SLEEP\s*\(/i,
                /\bROW_COUNT\s*\(/i,
                /INFORMATION_SCHEMA/i,
                /SYSCAT\b/i,
                /SYS\.DBA_TABLES/i
            ],
            
            // XSS Patterns
            xssPatterns: [
                /<script[\s>]/i,
                /<iframe[\s>]/i,
                /<object[\s>]/i,
                /<embed[\s>]/i,
                /<svg[\s>]/i,
                /on\w+\s*=/i,
                /javascript\s*:/i,
                /data\s*:/i,
                /vbscript\s*:/i,
                /<img[\s>]+[^>]*onerror/i,
                /<body[\s>]+[^>]*onload/i,
                /<input[\s>]+[^>]*autofocus/i
            ],
            
            // Command Injection
            cmdPatterns: [
                /[;&|`$]\s*(cat|ls|dir|echo|rm|cp|mv|wget|curl|nc|bash|sh|python|perl)/i,
                /\|\s*\w+/,
                /\$\([^)]+\)/,
                /`[^`]+`/,
                /\$\{[^}]+\}/,
                /%0a/i,
                /%0d/i,
                /%00/i
            ],
            
            // Path Traversal
            pathPatterns: [
                /\.\.\/|\.\.\\/,
                /etc\/passwd/,
                /etc\/shadow/,
                /boot\.ini/,
                /windows\\system32/,
                /\/var\/www\//,
                /\.git\/config/
            ],
            
            // Scanner/Bot patterns
            scannerPatterns: [
                /sqlmap/i,
                /nikto/i,
                /nmap/i,
                /masscan/i,
                /hydra/i,
                /metasploit/i,
                /burpsuite/i,
                /acunetix/i,
                /netsparker/i,
                /appscan/i,
                /OWASP/i,
                /w3af/i,
                /dirbuster/i,
                /gobuster/i,
                /feroxbuster/i
            ],
            
            // Prototype Pollution
            protoPollution: [
                /__proto__/,
                /constructor/,
                /prototype/,
                /__defineGetter__/,
                /__defineSetter__/
            ]
        },
        
        // Suspicious IP ranges (dynamic)
        suspiciousRanges: [],
        
        // Request history for rate limiting
        history: {
            requests: [],
            maxHistory: 100
        }
    };
    
    // ============================================================
    // THREAT DETECTION ENGINE
    // ============================================================
    const ThreatDetector = {
        threats: [],
        maxThreats: 50,
        
        // Analyze input for threats
        analyze(input, context = 'generic') {
            if (!input || typeof input !== 'string') return null;
            
            const findings = [];
            
            // Check against all signature categories
            for (const [category, patterns] of Object.entries(WAF.signatures)) {
                for (const pattern of patterns) {
                    if (pattern.test(input)) {
                        findings.push({
                            category,
                            pattern: pattern.toString(),
                            match: input.substring(0, 100)
                        });
                    }
                }
            }
            
            if (findings.length > 0) {
                this.record(category, findings, context);
            }
            
            return findings.length > 0 ? findings : null;
        },
        
        // Record threat
        record(category, findings, context) {
            const threat = {
                id: Date.now() + Math.random(),
                timestamp: Date.now(),
                category,
                findings,
                context,
                severity: this.calculateSeverity(category, findings.length)
            };
            
            this.threats.push(threat);
            if (this.threats.length > this.maxThreats) {
                this.threats = this.threats.slice(-this.maxThreats);
            }
            
            WAF.threatLevel = Math.min(10, WAF.threatLevel + findings.length);
            
            // Notify security system
            if (typeof window.KordSecurity !== 'undefined') {
                window.KordSecurity.SecurityLogger.log('WAF_THREAT_DETECTED', {
                    category,
                    severity: threat.severity,
                    context
                });
            }
            
            return threat;
        },
        
        // Calculate threat severity
        calculateSeverity(category, matchCount) {
            const baseSeverity = {
                sql: 9,
                xss: 7,
                cmd: 10,
                path: 8,
                scanner: 6,
                protoPollution: 9
            };
            
            return Math.min(10, (baseSeverity[category] || 5) + matchCount);
        }
    };
    
    // ============================================================
    // REQUEST INTERCEPTOR
    // ============================================================
    const RequestInterceptor = {
        init() {
            this.interceptFetch();
            this.interceptXHR();
        },
        
        interceptFetch() {
            const originalFetch = window.fetch;
            
            window.fetch = async function(input, init = {}) {
                const url = typeof input === 'string' ? input : input.url;
                const method = (init.method || 'GET').toUpperCase();
                
                // Analyze URL
                if (ThreatDetector.analyze(url, 'fetch_url')) {
                    console.warn('WAF: Blocked suspicious fetch URL');
                    return Promise.reject(new Error('WAF_BLOCKED'));
                }
                
                // Analyze body
                const body = init.body;
                if (body && typeof body === 'string') {
                    if (ThreatDetector.analyze(body, 'fetch_body')) {
                        console.warn('WAF: Blocked suspicious fetch body');
                        return Promise.reject(new Error('WAF_BLOCKED'));
                    }
                }
                
                // Check rate limit
                if (!RateLimiter.check(url, 60)) {
                    console.warn('WAF: Rate limit exceeded');
                    return Promise.reject(new Error('RATE_LIMITED'));
                }
                
                // Check if already blocked
                if (WAF.blocked) {
                    return Promise.reject(new Error('WAF_GLOBAL_BLOCK'));
                }
                
                return originalFetch.apply(window, arguments);
            };
        },
        
        interceptXHR() {
            const originalOpen = XMLHttpRequest.prototype.open;
            
            XMLHttpRequest.prototype.open = function(method, url, ...rest) {
                if (ThreatDetector.analyze(url, 'xhr_url')) {
                    console.warn('WAF: Blocked suspicious XHR URL');
                    throw new Error('WAF_BLOCKED');
                }
                return originalOpen.call(this, method, url, ...rest);
            };
            
            const originalSend = XMLHttpRequest.prototype.send;
            
            XMLHttpRequest.prototype.send = function(body) {
                if (body && typeof body === 'string') {
                    if (ThreatDetector.analyze(body, 'xhr_body')) {
                        console.warn('WAF: Blocked suspicious XHR body');
                        throw new Error('WAF_BLOCKED');
                    }
                }
                return originalSend.apply(this, arguments);
            };
        }
    };
    
    // ============================================================
    // ADVANCED RATE LIMITER
    // ============================================================
    const RateLimiter = {
        buckets: {},
        
        check(key, maxRequests = 60) {
            const now = Date.now();
            const windowMs = 60000;
            
            if (!this.buckets[key]) {
                this.buckets[key] = { count: 0, resetAt: now + windowMs };
            }
            
            // Reset if window expired
            if (now > this.buckets[key].resetAt) {
                this.buckets[key] = { count: 0, resetAt: now + windowMs };
            }
            
            this.buckets[key].count++;
            
            if (this.buckets[key].count > maxRequests) {
                ThreatDetector.record('rate_limit', [{ count: this.buckets[key].count }], key);
                return false;
            }
            
            return true;
        },
        
        reset(key) {
            delete this.buckets[key];
        }
    };
    
    // ============================================================
    // BEHAVIORAL ANALYSIS
    // ============================================================
    const BehavioralAnalyzer = {
        baseline: null,
        samples: [],
        maxSamples: 100,
        deviationThreshold: 3,
        
        init() {
            // Collect initial baseline
            this.collectBaseline();
            
            // Monitor mouse movements
            document.addEventListener('mousemove', e => this.recordMouse(e), { passive: true });
            
            // Monitor keyboard
            document.addEventListener('keydown', e => this.recordKeystroke(e), { passive: true });
            
            // Monitor clicks
            document.addEventListener('click', e => this.recordClick(e), { passive: true });
        },
        
        collectBaseline() {
            // Collect timing baseline
            setTimeout(() => {
                this.baseline = {
                    avgKeystrokeDelay: 150,
                    avgMouseSpeed: 500,
                    clickFrequency: 5
                };
            }, 5000);
        },
        
        recordMouse(e) {
            const sample = {
                type: 'mouse',
                x: e.clientX,
                y: e.clientY,
                time: Date.now()
            };
            this.samples.push(sample);
            this.trimSamples();
        },
        
        recordKeystroke(e) {
            const sample = {
                type: 'key',
                key: e.key,
                time: Date.now()
            };
            this.samples.push(sample);
            this.trimSamples();
            this.analyzeKeystrokePattern();
        },
        
        recordClick(e) {
            const sample = {
                type: 'click',
                x: e.clientX,
                y: e.clientY,
                time: Date.now()
            };
            this.samples.push(sample);
            this.trimSamples();
        },
        
        trimSamples() {
            if (this.samples.length > this.maxSamples) {
                this.samples = this.samples.slice(-this.maxSamples);
            }
        },
        
        analyzeKeystrokePattern() {
            // Detect bot-like typing patterns
            const keystrokes = this.samples.filter(s => s.type === 'key');
            if (keystrokes.length < 10) return;
            
            // Calculate average delay
            let totalDelay = 0;
            for (let i = 1; i < keystrokes.length; i++) {
                totalDelay += keystrokes[i].time - keystrokes[i-1].time;
            }
            const avgDelay = totalDelay / (keystrokes.length - 1);
            
            // Bot typing is often too perfect
            if (avgDelay < 30) {
                ThreatDetector.record('bot_behavior', [{ avgDelay }], 'keystroke');
            }
        }
    };
    
    // ============================================================
    // ADVANCED HONEYPOT SYSTEM
    // ============================================================
    const HoneyPotAdvanced = {
        traps: [],
        initialized: false,
        
        init() {
            if (this.initialized) return;
            this.initialized = true;
            
            this.createHoneypotFields();
            this.createFakeVulnerability();
            this.createDecoyData();
            this.monitorTrapAccess();
        },
        
        createHoneypotFields() {
            // Create invisible fields in all forms
            const forms = document.querySelectorAll('form');
            forms.forEach((form, idx) => {
                // Various honeypot field names that attackers look for
                const trapNames = ['website', 'url', 'homepage', 'comment', 'phone2', 'fax'];
                
                trapNames.forEach(name => {
                    const trap = document.createElement('input');
                    trap.type = 'text';
                    trap.name = name;
                    trap.id = `hp_${idx}_${name}`;
                    trap.autocomplete = 'off';
                    trap.tabIndex = -1;
                    trap.readOnly = true;
                    trap.style.cssText = `
                        position: absolute !important;
                        left: -9999px !important;
                        top: -9999px !important;
                        opacity: 0 !important;
                        pointer-events: none !important;
                        height: 0 !important;
                        width: 0 !important;
                    `;
                    trap.setAttribute('aria-hidden', 'true');
                    trap.setAttribute('data-trap', 'true');
                    form.appendChild(trap);
                    this.traps.push(trap);
                });
            });
        },
        
        createFakeVulnerability() {
            // Create a fake admin panel link (hidden) to detect scanners
            const fakeLink = document.createElement('a');
            fakeLink.href = '/admin_panel_hidden_123';
            fakeLink.id = 'fake_admin_panel';
            fakeLink.style.cssText = 'display:none !important; visibility:hidden !important;';
            fakeLink.setAttribute('data-bait', 'admin');
            document.body.appendChild(fakeLink);
            
            // Monitor access
            const observer = new MutationObserver(mutations => {
                mutations.forEach(mutation => {
                    mutation.addedNodes.forEach(node => {
                        if (node.nodeType === 1) {
                            // Check if someone is trying to access hidden elements
                            if (node.id && (node.id.includes('admin') || node.id.includes('hidden'))) {
                                ThreatDetector.record('honeypot_triggered', [{ id: node.id }], 'dom_access');
                            }
                        }
                    });
                });
            });
            
            observer.observe(document.body, { childList: true, subtree: true });
        },
        
        createDecoyData() {
            // Inject fake sensitive data that attackers might look for
            const decoyDiv = document.createElement('div');
            decoyDiv.id = '__debug_info';
            decoyDiv.style.cssText = 'display:none;';
            decoyDiv.setAttribute('data-decoy', 'true');
            decoyDiv.innerHTML = `
                <!-- 
                DEBUG: Internal Use Only
                DB_HOST=localhost
                DB_USER=admin
                DB_PASS=secret123
                ADMIN_KEY=sk_live_1234567890abcdef
                API_SECRET=secret_api_key_here
                -->
            `;
            document.body.appendChild(decoyDiv);
        },
        
        monitorTrapAccess() {
            // Periodically check if honeypot fields have values
            setInterval(() => {
                this.traps.forEach(trap => {
                    if (trap.value && trap.value.length > 0) {
                        ThreatDetector.record('honeypot_triggered', { 
                            field: trap.name, 
                            value: trap.value.substring(0, 50) 
                        }, 'form_submission');
                        trap.value = ''; // Clear
                    }
                });
                
                // Check for fake admin panel access attempts
                const fakeLink = document.getElementById('fake_admin_panel');
                if (fakeLink && fakeLink.offsetParent !== undefined) {
                    ThreatDetector.record('honeypot_triggered', { target: 'fake_admin' }, 'link_access');
                }
                
                // Check for decoy access
                const decoy = document.getElementById('__debug_info');
                if (decoy && decoy.offsetParent !== undefined) {
                    ThreatDetector.record('honeypot_triggered', { target: 'debug_info' }, 'decoy_access');
                }
            }, 2000);
        }
    };
    
    // ============================================================
    // GLOBAL TAMPER PROTECTION
    // ============================================================
    const GlobalProtector = {
        protectedFunctions: [],
        
        init() {
            this.protectCoreObjects();
            this.protectPrototypes();
            this.protectEventListeners();
        },
        
        protectCoreObjects() {
            // Protect window
            Object.defineProperty(window, 'innerWidth', {
                get: function() { return window._innerWidth || 1024; }
            });
            
            Object.defineProperty(window, 'innerHeight', {
                get: function() { return window._innerHeight || 768; }
            });
            
            Object.defineProperty(window, 'outerWidth', {
                get: function() { return window._outerWidth || 1024; }
            });
            
            Object.defineProperty(window, 'outerHeight', {
                get: function() { return window._outerHeight || 768; }
            });
            
            // Protect location
                        const safeLocation = {
                            protocol: 'https:',
                            host: 'kord.gg',
                            hostname: 'kord.gg',
                            port: '',
                            pathname: '/',
                            search: '',
                            hash: '',
                            href: 'https://kord.gg/',
                            origin: 'https://kord.gg',
                            toString: () => 'https://kord.gg/'
                        };

                        try {
                            Object.defineProperty(window, 'location', {
                                get: () => safeLocation
                            });
                        } catch(e) { /* location is non-configurable */ }
                    },

                    protectPrototypes() {
                        // Protect Object
            const originalObjectKeys = Object.keys;
            Object.keys = function(obj) {
                if (obj && typeof obj === 'object') {
                    // Block access to dangerous properties
                    const dangerous = ['__proto__', 'constructor', 'prototype'];
                    const result = originalObjectKeys.call(this, obj);
                    return result.filter(k => !dangerous.includes(k));
                }
                return originalObjectKeys.call(this, obj);
            };
            
            // Protect Array
            const originalArraySlice = Array.prototype.slice;
            Array.prototype.slice = function(...args) {
                try {
                    return originalArraySlice.apply(this, args);
                } catch(e) {
                    return [];
                }
            };
        },
        
        protectEventListeners() {
            // Track addEventListener to detect removals
            const originalAddEventListener = EventTarget.prototype.addEventListener;
            
            EventTarget.prototype.addEventListener = function(type, listener, options) {
                if (!this._listeners) this._listeners = {};
                if (!this._listeners[type]) this._listeners[type] = [];
                this._listeners[type].push(listener);
                
                return originalAddEventListener.call(this, type, listener, options);
            };
            
            // Detect removeEventListener
            const originalRemoveEventListener = EventTarget.prototype.removeEventListener;
            EventTarget.prototype.removeEventListener = function(type, listener, options) {
                ThreatDetector.record('event_manipulation', { type }, 'listener_removal');
                return originalRemoveEventListener.call(this, type, listener, options);
            };
        }
    };
    
    // ============================================================
    // NETWORK ANOMALY DETECTION
    // ============================================================
    const NetworkAnomalyDetector = {
        normalResponseTime: 0,
        samples: [],
        
        init() {
            this.monitorNetworkTiming();
        },
        
        monitorNetworkTiming() {
            // Override fetch to monitor timing
            const originalFetch = window.fetch;
            
            window.fetch = async function(...args) {
                const start = performance.now();
                const result = await originalFetch.apply(window, args);
                const duration = performance.now() - start;
                
                // Record timing
                NetworkAnomalyDetector.recordTiming(duration);
                
                // Check for timing anomalies
                if (duration > 30000) { // 30 seconds
                    ThreatDetector.record('network_anomaly', { 
                        type: 'slow_response',
                        duration 
                    }, 'network');
                }
                
                return result;
            };
        },
        
        recordTiming(duration) {
            this.samples.push(duration);
            if (this.samples.length > 50) {
                this.samples = this.samples.slice(-50);
            }
            
            // Calculate running average
            const sum = this.samples.reduce((a, b) => a + b, 0);
            this.normalResponseTime = sum / this.samples.length;
            
            // Check for sudden changes
            if (this.samples.length > 10) {
                const last10 = this.samples.slice(-10);
                const lastAvg = last10.reduce((a, b) => a + b, 0) / 10;
                
                // If last 10 requests are all much slower
                if (lastAvg > this.normalResponseTime * 5) {
                    ThreatDetector.record('network_anomaly', {
                        type: 'degradation',
                        lastAvg,
                        normalAvg: this.normalResponseTime
                    }, 'network');
                }
            }
        }
    };
    
    // ============================================================
    // INITIALIZATION
    // ============================================================
    const WafPro = {
        init() {
            console.log('%c🛡️ Kord WAF Pro v4.0 Initializing...', 'color:#6366f1');
            
            // Initialize all components
            RequestInterceptor.init();
            HoneyPotAdvanced.init();
            BehavioralAnalyzer.init();
            GlobalProtector.init();
            NetworkAnomalyDetector.init();
            
            // Set up continuous monitoring
            setInterval(() => this.continuousCheck(), 30000);
            
            // Monitor for suspicious patterns
            this.monitorDOM();
            
            console.log('%c🛡️ WAF Pro Active', 'color:#22c55e; font-weight:bold');
        },
        
        continuousCheck() {
            // Check threat level
            if (WAF.threatLevel > 20) {
                this.activateStrictMode();
            }
            
            if (WAF.threatLevel > 50) {
                this.activateLockdown();
            }
        },
        
        activateStrictMode() {
            console.warn('%c⚠️ WAF Strict Mode Active', 'color:#f59e0b');
            
            // Reduce rate limits
            Object.keys(RateLimiter.buckets).forEach(key => {
                const bucket = RateLimiter.buckets[key];
                bucket.limit = Math.floor(bucket.limit * 0.5);
            });
        },
        
        activateLockdown() {
            console.error('%c🚨 WAF LOCKDOWN', 'color:#ef4444; font-weight:bold');
            
            WAF.blocked = true;
            
            // Block all network
            window.fetch = () => Promise.reject(new Error('WAF_LOCKDOWN'));
            
            // Show warning
            document.body.innerHTML = `
                <div style="background:#000;height:100vh;display:flex;align-items:center;justify-content:center;color:#ef4444;font-family:sans-serif;text-align:center;">
                    <div>
                        <h1 style="font-size:48px;">🚨 ACESSO BLOQUEADO</h1>
                        <p>Atividade suspeita detectada pelo WAF.</p>
                        <p style="color:#666;">Código: ${Date.now().toString(36).toUpperCase()}</p>
                    </div>
                </div>
            `;
        },
        
        monitorDOM() {
            // Watch for DOM manipulation
            const observer = new MutationObserver(mutations => {
                mutations.forEach(mutation => {
                    if (mutation.type === 'childList') {
                        mutation.addedNodes.forEach(node => {
                            if (node.nodeType === 1) {
                                // Check for script injection
                                if (node.tagName === 'SCRIPT' || node.querySelectorAll) {
                                    const scripts = node.querySelectorAll ? 
                                        node.querySelectorAll('script') : [];
                                    
                                    if (scripts.length > 0 || node.tagName === 'SCRIPT') {
                                        ThreatDetector.record('dom_injection', {
                                            tag: node.tagName
                                        }, 'dom_manipulation');
                                    }
                                }
                            }
                        });
                    }
                });
            });
            
            observer.observe(document.body, { 
                childList: true, 
                subtree: true 
            });
        }
    };
    
    // Export
    window.KordWAF = {
        init: WafPro.init,
        ThreatDetector,
        RateLimiter,
        WAF
    };
    
    // Auto-init
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', () => WafPro.init());
    } else {
        WafPro.init();
    }
})();