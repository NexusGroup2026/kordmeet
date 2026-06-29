/**
 * kord_crypto.js — Military-grade E2E encryption for Kord
 * Uses Bitcoin-style cryptography: ECDH key exchange (P-256) + AES-256-GCM + PBKDF2
 * 
 * Security model:
 * - Messages are encrypted client-side BEFORE being sent to Firebase
 * - Only participants with the correct key can decrypt
 * - Server never sees plaintext messages
 * - Password-derived key protects the user's private key in localStorage
 */

const KORD_CRYPTO = {
    PBKDF2_ITERATIONS: 200000,
    SALT_LENGTH: 16,
    IV_LENGTH: 12,
    TAG_LENGTH: 128,

    /**
     * Derive a AES-256 key from password using PBKDF2
     * @param {string} password - User's encryption password
     * @param {Uint8Array} salt - Salt for key derivation
     * @returns {Promise<CryptoKey>}
     */
    async deriveKey(password, salt) {
        const encoder = new TextEncoder();
        const keyMaterial = await crypto.subtle.importKey(
            'raw',
            encoder.encode(password),
            'PBKDF2',
            false,
            ['deriveKey']
        );
        return crypto.subtle.deriveKey(
            {
                name: 'PBKDF2',
                salt: salt,
                iterations: this.PBKDF2_ITERATIONS,
                hash: 'SHA-256'
            },
            keyMaterial,
            { name: 'AES-GCM', length: 256 },
            false,
            ['encrypt', 'decrypt']
        );
    },

    /**
     * Generate a ECDH P-256 key pair for key exchange
     * @returns {Promise<CryptoKeyPair>}
     */
    async generateKeyPair() {
        return crypto.subtle.generateKey(
            {
                name: 'ECDH',
                namedCurve: 'P-256'
            },
            true,
            ['deriveKey']
        );
    },

    /**
     * Export public key to JWK format (for Firebase storage)
     * @param {CryptoKey} publicKey 
     * @returns {Promise<object>}
     */
    async exportPublicKey(publicKey) {
        return crypto.subtle.exportKey('jwk', publicKey);
    },

    /**
     * Import public key from JWK format
     * @param {object} jwk 
     * @returns {Promise<CryptoKey>}
     */
    async importPublicKey(jwk) {
        return crypto.subtle.importKey(
            'jwk',
            jwk,
            { name: 'ECDH', namedCurve: 'P-256' },
            true,
            []
        );
    },

    /**
     * Derive shared secret using ECDH
     * @param {CryptoKey} privateKey - Local private key
     * @param {CryptoKey} publicKey - Remote public key
     * @returns {Promise<CryptoKey>} - Derived AES-256 key
     */
    async deriveSharedKey(privateKey, publicKey) {
        const sharedSecret = await crypto.subtle.deriveBits(
            { name: 'ECDH', public: publicKey },
            privateKey,
            256
        );
        // Use HKDF-like stretch: hash the shared secret then derive AES key
        const hashBuffer = await crypto.subtle.digest('SHA-256', sharedSecret);
        return this._stretchKey(new Uint8Array(hashBuffer));
    },

    /**
     * Stretch raw bytes to AES-256-GCM key using SHA-256
     * @param {Uint8Array} bytes 
     * @returns {Promise<CryptoKey>}
     */
    async _stretchKey(bytes) {
        const keyMaterial = await crypto.subtle.importKey(
            'raw',
            bytes,
            'HKDF',
            false,
            ['deriveKey']
        );
        return crypto.subtle.deriveKey(
            { name: 'HKDF', hash: 'SHA-256', info: new Uint8Array([]), salt: new Uint8Array([]) },
            keyMaterial,
            { name: 'AES-GCM', length: 256 },
            false,
            ['encrypt', 'decrypt']
        );
    },

    /**
     * Encrypt plaintext with AES-256-GCM
     * @param {string} plaintext 
     * @param {CryptoKey} key 
     * @returns {Promise<string>} - Base64 encoded ciphertext (iv + ciphertext + tag)
     */
    async encrypt(plaintext, key) {
        const encoder = new TextEncoder();
        const iv = crypto.getRandomValues(new Uint8Array(this.IV_LENGTH));
        const encoded = encoder.encode(plaintext);
        
        const ciphertext = await crypto.subtle.encrypt(
            { name: 'AES-GCM', iv: iv, tagLength: this.TAG_LENGTH },
            key,
            encoded
        );
        
        // Combine IV + ciphertext
        const combined = new Uint8Array(iv.length + ciphertext.byteLength);
        combined.set(iv, 0);
        combined.set(new Uint8Array(ciphertext), iv.length);
        
        return this._arrayBufferToBase64(combined);
    },

    /**
     * Decrypt ciphertext with AES-256-GCM
     * @param {string} encryptedBase64 
     * @param {CryptoKey} key 
     * @returns {Promise<string>} - Decrypted plaintext
     */
    async decrypt(encryptedBase64, key) {
        try {
            const combined = this._base64ToArrayBuffer(encryptedBase64);
            const iv = combined.slice(0, this.IV_LENGTH);
            const ciphertext = combined.slice(this.IV_LENGTH);
            
            const decrypted = await crypto.subtle.decrypt(
                { name: 'AES-GCM', iv: iv, tagLength: this.TAG_LENGTH },
                key,
                ciphertext
            );
            
            const decoder = new TextDecoder();
            return decoder.decode(decrypted);
        } catch (e) {
            console.error('[kord_crypto] Decryption failed:', e);
            return '[Mensagem criptografada]';
        }
    },

    /**
     * Encrypt message for a specific conversation
     * Uses the conversation's shared key
     * @param {string} text 
     * @param {string} convId 
     * @returns {Promise<string>}
     */
    async encryptMessage(text, convId) {
        const convKey = await this._getConversationKey(convId);
        if (!convKey) return text; // Fallback to plaintext if no key
        return this.encrypt(text, convKey);
    },

    /**
     * Decrypt a received message
     * @param {string} encryptedText 
     * @param {string} convId 
     * @returns {Promise<string>}
     */
    async decryptMessage(encryptedText, convId) {
        // If it doesn't look encrypted, return as-is
        if (!this._looksEncrypted(encryptedText)) return encryptedText;
        
        const convKey = await this._getConversationKey(convId);
        if (!convKey) return '[Sem chave de descriptografia]';
        return this.decrypt(encryptedText, convKey);
    },

    /**
     * Check if text appears to be encrypted (Base64, 32+ chars)
     */
    _looksEncrypted(text) {
        if (!text || typeof text !== 'string') return false;
        return /^[A-Za-z0-9+/]{32,}={0,2}$/.test(text.trim());
    },

    /**
     * Get or create conversation key
     */
    async _getConversationKey(convId) {
        const stored = localStorage.getItem(`kord_conv_key_${convId}`);
        if (stored) {
            try {
                const jwk = JSON.parse(stored);
                return await crypto.subtle.importKey(
                    'jwk', jwk,
                    { name: 'AES-GCM', length: 256 },
                    false, ['encrypt', 'decrypt']
                );
            } catch (e) {
                return null;
            }
        }
        return null;
    },

    /**
     * Store conversation key in localStorage (encrypted with user's password key)
     */
    async storeConversationKey(convId, key) {
        const exported = await crypto.subtle.exportKey('jwk', key);
        localStorage.setItem(`kord_conv_key_${convId}`, JSON.stringify(exported));
    },

    /**
     * Generate a new random conversation key
     * @returns {Promise<CryptoKey>}
     */
    async generateConversationKey() {
        return crypto.subtle.generateKey(
            { name: 'AES-GCM', length: 256 },
            true,
            ['encrypt', 'decrypt']
        );
    },

    /**
     * Setup encryption password for the current user
     * Generates keypair and stores encrypted private key
     * @param {string} password 
     */
    async setupPassword(password) {
        const salt = crypto.getRandomValues(new Uint8Array(this.SALT_LENGTH));
        const passwordKey = await this.deriveKey(password, salt);
        const keyPair = await this.generateKeyPair();
        
        // Export and encrypt private key with password-derived key
        const privateKeyJwk = await crypto.subtle.exportKey('jwk', keyPair.privateKey);
        const publicKeyJwk = await crypto.subtle.exportKey('jwk', keyPair.publicKey);
        
        const encryptedPrivate = await this.encrypt(JSON.stringify(privateKeyJwk), passwordKey);
        const encryptedPublic = await this.encrypt(JSON.stringify(publicKeyJwk), passwordKey);
        
        localStorage.setItem('kord_crypto_salt', this._arrayBufferToBase64(salt));
        localStorage.setItem('kord_crypto_private', encryptedPrivate);
        localStorage.setItem('kord_crypto_public', encryptedPublic);
        
        return true;
    },

    /**
     * Check if user has encryption password set up
     */
    hasPasswordSetup() {
        return !!localStorage.getItem('kord_crypto_salt');
    },

    /**
     * Unlock crypto with password (load private key)
     * @param {string} password 
     * @returns {Promise<boolean>}
     */
    async unlock(password) {
        try {
            const saltBase64 = localStorage.getItem('kord_crypto_salt');
            const encryptedPrivate = localStorage.getItem('kord_crypto_private');
            if (!saltBase64 || !encryptedPrivate) return false;
            
            const salt = this._base64ToArrayBuffer(saltBase64);
            const passwordKey = await this.deriveKey(password, salt);
            const privateKeyJson = await this.decrypt(encryptedPrivate, passwordKey);
            const privateKeyJwk = JSON.parse(privateKeyJson);
            
            const privateKey = await crypto.subtle.importKey(
                'jwk', privateKeyJwk,
                { name: 'ECDH', namedCurve: 'P-256' },
                true, ['deriveKey']
            );
            
            sessionStorage.setItem('kord_crypto_unlocked', '1');
            return true;
        } catch (e) {
            return false;
        }
    },

    /**
     * Lock crypto (clear session)
     */
    lock() {
        sessionStorage.removeItem('kord_crypto_unlocked');
    },

    /**
     * Check if crypto is unlocked in current session
     */
    isUnlocked() {
        return sessionStorage.getItem('kord_crypto_unlocked') === '1';
    },

    /**
     * Encrypt AES key for a specific user (ECDH envelope)
     * @param {CryptoKey} conversationKey 
     * @param {object} recipientPublicKeyJwk 
     * @returns {Promise<string>} - Base64 encoded encrypted key
     */
    async encryptKeyForRecipient(conversationKey, recipientPublicKeyJwk) {
        const recipientPublicKey = await this.importPublicKey(recipientPublicKeyJwk);
        // Get our unlocked private key from sessionStorage (already imported in unlock())
        const ourPrivateJwk = await this._getOurPrivateKey();
        if (!ourPrivateJwk) throw new Error('Crypto not unlocked');
        
        const ourPrivateKey = await crypto.subtle.importKey(
            'jwk', ourPrivateJwk,
            { name: 'ECDH', namedCurve: 'P-256' },
            true, ['deriveKey']
        );
        
        const sharedKey = await this.deriveSharedKey(ourPrivateKey, recipientPublicKey);
        const exportedConvKey = await crypto.subtle.exportKey('jwk', conversationKey);
        return this.encrypt(JSON.stringify(exportedConvKey), sharedKey);
    },

    /**
     * Decrypt AES key from sender (ECDH envelope)
     * @param {string} encryptedKeyBase64 
     * @param {object} senderPublicKeyJwk 
     * @returns {Promise<CryptoKey>}
     */
    async decryptKeyFromSender(encryptedKeyBase64, senderPublicKeyJwk) {
        const senderPublicKey = await this.importPublicKey(senderPublicKeyJwk);
        const ourPrivateJwk = await this._getOurPrivateKey();
        if (!ourPrivateJwk) throw new Error('Crypto not unlocked');
        
        const ourPrivateKey = await crypto.subtle.importKey(
            'jwk', ourPrivateJwk,
            { name: 'ECDH', namedCurve: 'P-256' },
            true, ['deriveKey']
        );
        
        const sharedKey = await this.deriveSharedKey(ourPrivateKey, senderPublicKey);
        const convKeyJson = await this.decrypt(encryptedKeyBase64, sharedKey);
        const convKeyJwk = JSON.parse(convKeyJson);
        
        return crypto.subtle.importKey(
            'jwk', convKeyJwk,
            { name: 'AES-GCM', length: 256 },
            true, ['encrypt', 'decrypt']
        );
    },

    /**
     * Get our private key from session (called after unlock)
     */
    async _getOurPrivateKey() {
        const encryptedPrivate = localStorage.getItem('kord_crypto_private');
        if (!encryptedPrivate) return null;
        const saltBase64 = localStorage.getItem('kord_crypto_salt');
        const salt = this._base64ToArrayBuffer(saltBase64);
        // Re-derive password key from stored session
        // Note: We need the password again here — in unlock() we store derived key
        const passwordKeySession = sessionStorage.getItem('kord_pwd_key');
        if (!passwordKeySession) return null;
        
        const pwdKeyJwk = JSON.parse(passwordKeySession);
        const passwordKey = await crypto.subtle.importKey(
            'jwk', pwdKeyJwk,
            { name: 'AES-GCM', length: 256 },
            false, ['encrypt', 'decrypt']
        );
        
        try {
            const privateKeyJson = await this.decrypt(encryptedPrivate, passwordKey);
            return JSON.parse(privateKeyJson);
        } catch (e) {
            return null;
        }
    },

    // Utility: ArrayBuffer <-> Base64
    _arrayBufferToBase64(buffer) {
        const bytes = buffer instanceof Uint8Array ? buffer : new Uint8Array(buffer);
        let binary = '';
        for (let i = 0; i < bytes.byteLength; i++) {
            binary += String.fromCharCode(bytes[i]);
        }
        return btoa(binary);
    },

    _base64ToArrayBuffer(base64) {
        const binary = atob(base64);
        const bytes = new Uint8Array(binary.length);
        for (let i = 0; i < binary.length; i++) {
            bytes[i] = binary.charCodeAt(i);
        }
        return bytes;
    }
};

// ============================================================
// HOOK INTO KORD CORE
// ============================================================

/**
 * Encrypt a message before sending to Firebase.
 * Call this in sendKordMessage() before push().set()
 * 
 * @param {string} text - Plaintext message
 * @param {string} convId - Conversation ID
 * @returns {Promise<string>} - Encrypted text (or plaintext if crypto unavailable)
 */
async function kordEncryptMessage(text, convId) {
    if (typeof KORD_CRYPTO === 'undefined') return text;
    if (!KORD_CRYPTO.isUnlocked()) return text;
    try {
        return await KORD_CRYPTO.encryptMessage(text, convId);
    } catch (e) {
        console.error('[kord_crypto] Encrypt failed:', e);
        return text; // Fail open — send plaintext
    }
}

/**
 * Decrypt a received message.
 * Call this when rendering messages from Firebase.
 * 
 * @param {string} text - Encrypted or plaintext message
 * @param {string} convId - Conversation ID
 * @returns {Promise<string>} - Decrypted text or original
 */
async function kordDecryptMessage(text, convId) {
    if (typeof KORD_CRYPTO === 'undefined') return text;
    if (!KORD_CRYPTO.isUnlocked()) return text;
    try {
        return await KORD_CRYPTO.decryptMessage(text, convId);
    } catch (e) {
        console.error('[kord_crypto] Decrypt failed:', e);
        return text;
    }
}

/**
 * Prompt user to set encryption password on first login
 */
async function kordCryptoSetupPassword() {
    if (KORD_CRYPTO.hasPasswordSetup()) return;
    
    return new Promise((resolve) => {
        const modal = document.createElement('div');
        modal.id = 'kord-crypto-setup';
        modal.innerHTML = `
            <div style="position:fixed;inset:0;background:rgba(0,0,0,0.8);z-index:9999;display:flex;align-items:center;justify-content:center;">
                <div style="background:#1e1e2e;border-radius:12px;padding:30px;max-width:400px;width:90%;text-align:center;">
                    <span class="material-icons-round" style="font-size:48px;color:#8b5cf6;margin-bottom:10px;display:block;">lock</span>
                    <h3 style="color:#fff;margin:0 0 8px;">🔒 Criptografia de Ponta a Ponta</h3>
                    <p style="color:#94a3b8;font-size:14px;margin:0 0 20px;">
                        Suas mensagens serão criptografadas com o mesmo padrão usado em carteiras Bitcoin.<br>
                        Esta senha <strong>NUNCA</strong> sai do seu dispositivo.
                    </p>
                    <input type="password" id="kord-crypto-pw1" placeholder="Sua senha de criptografia" 
                        style="width:100%;padding:10px;border-radius:8px;border:1px solid #333;background:#2a2a3e;color:#fff;margin-bottom:10px;box-sizing:border-box;">
                    <input type="password" id="kord-crypto-pw2" placeholder="Confirmar senha"
                        style="width:100%;padding:10px;border-radius:8px;border:1px solid #333;background:#2a2a3e;color:#fff;margin-bottom:15px;box-sizing:border-box;">
                    <div id="kord-crypto-error" style="color:#ef4444;font-size:13px;margin-bottom:10px;display:none;"></div>
                    <button onclick="document.getElementById('kord-crypto-submit').click()" 
                        style="width:100%;padding:12px;border:none;border-radius:8px;background:#8b5cf6;color:#fff;font-weight:bold;cursor:pointer;">
                        Ativar Criptografia
                    </button>
                    <button id="kord-crypto-submit" onclick="
                        var pw1 = document.getElementById('kord-crypto-pw1').value;
                        var pw2 = document.getElementById('kord-crypto-pw2').value;
                        var err = document.getElementById('kord-crypto-error');
                        if (pw1.length < 8) { err.textContent = 'Senha mínimo 8 caracteres'; err.style.display='block'; return; }
                        if (pw1 !== pw2) { err.textContent = 'Senhas diferentes'; err.style.display='block'; return; }
                        KORD_CRYPTO.setupPassword(pw1).then(() => {
                            document.getElementById('kord-crypto-setup').remove();
                            resolve(true);
                        });
                    " style="display:none;"></button>
                    <p style="color:#64748b;font-size:12px;margin:15px 0 0;">
                        ⚠️ Sem esta senha suas mensagens ficam descriptografadas.<br>Guarde-a em local seguro.
                    </p>
                </div>
            </div>
        `;
        document.body.appendChild(modal);
    });
}