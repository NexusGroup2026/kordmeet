// ==========================================
// NVIDIA AI API INTEGRATION
// Efficient token usage AI chat for Kord
// ==========================================

const NvidiaAI = {
    // NVIDIA AI API endpoint
    API_URL: 'https://integrate.api.nvidia.com/v1',
    
    // Free models available on NVIDIA (no subscription needed)
    MODELS: {
        'llama-3.1-nemotron': 'meta/llama-3.1-70b-instruct',
        'llama-3.3': 'meta/llama-3.3-70b-instruct',
        'mixtral': 'mistralai/mixtral-8x7b-instruct-v0.1',
        'gemma-2b': 'google/gemma-2-2b-it',
        'gemma-7b': 'google/gemma-2-7b-it',
        'phi-4': 'microsoft/phi-4-mini-instruct',
        'deepseek-32b': 'deepseek-ai/deepseek-llm-32b-chat'
    },
    
    // Current model (can be changed by user)
    currentModel: 'mixtral',
    
    // Token tracking for efficiency
    maxTokens: 1024, // Keep responses concise
    temperature: 0.6,
    
    // Get API key from settings
    getApiKey() {
        return localStorage.getItem('nvidia_api_key') || localStorage.getItem('groqApiKey') || '';
    },
    
    // Check if NVIDIA API is configured
    isConfigured() {
        return this.getApiKey().length > 0;
    },
    
    // Save API key
    saveApiKey(key) {
        localStorage.setItem('nvidia_api_key', key);
        showKordAlert('NVIDIA API', 'Chave salva com sucesso!', 'check_circle', '#10b981');
    },
    
    // Set model
    setModel(modelKey) {
        if (this.MODELS[modelKey]) {
            this.currentModel = modelKey;
            localStorage.setItem('nvidia_model', modelKey);
            return true;
        }
        return false;
    },
    
    // Load saved preferences
    init() {
        const savedModel = localStorage.getItem('nvidia_model');
        if (savedModel && this.MODELS[savedModel]) {
            this.currentModel = savedModel;
        }
    },
    
    // Count tokens (rough estimation for English/Portuguese)
    estimateTokens(text) {
        // Rough estimate: ~1 token per 4 chars for mixed text
        return Math.ceil(text.length / 4);
    },
    
    // Truncate message to fit token budget
    truncateToTokenBudget(messages, maxTotalTokens = 4096) {
        let totalTokens = 0;
        const result = [];
        
        // Process messages from newest to oldest
        for (let i = messages.length - 1; i >= 0; i--) {
            const msg = messages[i];
            const tokens = this.estimateTokens(msg.content) + 10; // +10 for role overhead
            
            if (totalTokens + tokens <= maxTotalTokens - this.maxTokens) {
                result.unshift(msg);
                totalTokens += tokens;
            } else {
                // If this is the user's message and we can't fit it, truncate it
                if (msg.role === 'user') {
                    const remainingTokens = maxTotalTokens - this.maxTokens - totalTokens;
                    const truncatedContent = msg.content.substring(0, remainingTokens * 4);
                    if (truncatedContent.length > 50) {
                        result.unshift({ ...msg, content: truncatedContent + '...' });
                    }
                }
                break;
            }
        }
        
        return result;
    },
    
    // Send chat completion request
    async chat(messages, options = {}) {
        if (!this.isConfigured()) {
            return { error: 'NVIDIA API key not configured. Get one free at https://build.nvidia.com/' };
        }
        
        const apiKey = this.getApiKey();
        const model = this.MODELS[this.currentModel] || this.MODELS['mixtral'];
        const maxTokens = options.maxTokens || this.maxTokens;
        const temperature = options.temperature || this.temperature;
        
        // Truncate messages to save tokens
        const truncatedMessages = this.truncateToTokenBudget(messages);
        
        try {
            const response = await fetch(`${this.API_URL}/chat/completions`, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${apiKey}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    model: model,
                    messages: truncatedMessages,
                    max_tokens: maxTokens,
                    temperature: temperature
                })
            });
            
            if (!response.ok) {
                const error = await response.json().catch(() => ({}));
                throw new Error(error.error?.message || `HTTP ${response.status}`);
            }
            
            const data = await response.json();
            return {
                content: data.choices[0]?.message?.content || '',
                usage: data.usage,
                model: data.model
            };
        } catch (err) {
            console.error('NVIDIA AI Error:', err);
            return { error: err.message };
        }
    },
    
    // Stream chat (if supported)
    async chatStream(messages, onChunk, onComplete, onError) {
        if (!this.isConfigured()) {
            onError('NVIDIA API key not configured');
            return;
        }
        
        const apiKey = this.getApiKey();
        const model = this.MODELS[this.currentModel] || this.MODELS['mixtral'];
        const truncatedMessages = this.truncateToTokenBudget(messages);
        
        try {
            const response = await fetch(`${this.API_URL}/chat/completions`, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${apiKey}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    model: model,
                    messages: truncatedMessages,
                    max_tokens: this.maxTokens,
                    temperature: this.temperature,
                    stream: true
                })
            });
            
            if (!response.ok) {
                throw new Error(`HTTP ${response.status}`);
            }
            
            const reader = response.body.getReader();
            const decoder = new TextDecoder();
            let fullContent = '';
            
            while (true) {
                const { done, value } = await reader.read();
                if (done) break;
                
                const chunk = decoder.decode(value);
                const lines = chunk.split('\n');
                
                for (const line of lines) {
                    if (line.startsWith('data: ')) {
                        const data = line.slice(6);
                        if (data === '[DONE]') continue;
                        
                        try {
                            const parsed = JSON.parse(data);
                            const content = parsed.choices?.[0]?.delta?.content || '';
                            if (content) {
                                fullContent += content;
                                onChunk(content);
                            }
                        } catch (e) {}
                    }
                }
            }
            
            onComplete(fullContent);
        } catch (err) {
            onError(err.message);
        }
    },
    
    // Generate image (for future use with Stable Diffusion on NVIDIA)
    async generateImage(prompt, options = {}) {
        // NVIDIA has image generation models, can be added later
        return { error: 'Image generation coming soon with NVIDIA Picasso API' };
    },
    
    // Open settings modal
    openSettings() {
        const currentKey = this.getApiKey();
        const modal = document.createElement('div');
        modal.id = 'nvidia-ai-modal';
        modal.className = 'kord-modal-overlay';
        modal.innerHTML = `
            <div class="kord-modal" style="max-width:500px;">
                <div class="kord-modal-header">
                    <h3><span class="material-icons-round">psychology</span> NVIDIA AI Config</h3>
                    <button onclick="this.closest('.kord-modal').remove(); document.getElementById('nvidia-ai-modal')?.remove();" class="kord-modal-close">
                        <span class="material-icons-round">close</span>
                    </button>
                </div>
                <div class="kord-modal-body">
                    <p style="color:#94a3b8; font-size:0.85rem; margin-bottom:16px;">
                        Obtenha sua API key gratuita em <a href="https://build.nvidia.com/" target="_blank" style="color:#6366f1;">build.nvidia.com</a>
                    </p>
                    <div class="kord-form-group">
                        <label>API Key:</label>
                        <input type="password" id="nvidia-api-key-input" value="${currentKey}" placeholder="nvapi-..." class="kord-input" />
                    </div>
                    <div class="kord-form-group">
                        <label>Modelo:</label>
                        <select id="nvidia-model-select" class="kord-input">
                            <option value="mixtral" ${this.currentModel === 'mixtral' ? 'selected' : ''}>Mixtral 8x7B (Rápido)</option>
                            <option value="gemma-2b" ${this.currentModel === 'gemma-2b' ? 'selected' : ''}>Gemma 2B (Econômico)</option>
                            <option value="gemma-7b" ${this.currentModel === 'gemma-7b' ? 'selected' : ''}>Gemma 7B (Equilibrado)</option>
                            <option value="llama-3.1-nemotron" ${this.currentModel === 'llama-3.1-nemotron' ? 'selected' : ''}>Llama 3.1 70B (Mais Poderoso)</option>
                            <option value="deepseek-32b" ${this.currentModel === 'deepseek-32b' ? 'selected' : ''}>DeepSeek 32B (Código)</option>
                        </select>
                    </div>
                    <div class="kord-form-group">
                        <label>Máx. Tokens por resposta:</label>
                        <input type="number" id="nvidia-max-tokens" value="${this.maxTokens}" min="128" max="4096" step="128" class="kord-input" />
                    </div>
                </div>
                <div class="kord-modal-footer">
                    <button onclick="NvidiaAI.testConnection()" class="kord-btn-secondary" style="background:rgba(99,102,241,0.1); color:#6366f1;">
                        Testar Conexão
                    </button>
                    <button onclick="NvidiaAI.saveSettings()" class="kord-btn-primary">
                        Salvar
                    </button>
                </div>
            </div>
        `;
        document.body.appendChild(modal);
    },
    
    saveSettings() {
        const keyInput = document.getElementById('nvidia-api-key-input');
        const modelSelect = document.getElementById('nvidia-model-select');
        const maxTokensInput = document.getElementById('nvidia-max-tokens');
        
        if (keyInput && keyInput.value.trim()) {
            this.saveApiKey(keyInput.value.trim());
        }
        if (modelSelect) {
            this.setModel(modelSelect.value);
        }
        if (maxTokensInput) {
            this.maxTokens = parseInt(maxTokensInput.value) || 1024;
            localStorage.setItem('nvidia_max_tokens', this.maxTokens);
        }
        
        const modal = document.getElementById('nvidia-ai-modal');
        if (modal) modal.remove();
    },
    
    async testConnection() {
        if (!this.isConfigured()) {
            showKordAlert('Erro', 'Configure a API key primeiro', 'error', '#ef4444');
            return;
        }
        
        showKordAlert('Testando...', 'Aguarde...', 'sync', '#6366f1');
        
        const result = await this.chat([
            { role: 'user', content: 'Reply with just "OK" if you can read this.' }
        ], { maxTokens: 10 });
        
        if (result.error) {
            showKordAlert('Erro de Conexão', result.error, 'wifi_off', '#ef4444');
        } else {
            showKordAlert('Sucesso!', 'Conexão com NVIDIA API funcionando!', 'check_circle', '#10b981');
        }
    }
};

// Initialize on load
NvidiaAI.init();

// Export for global use
window.NvidiaAI = NvidiaAI;

console.log('NvidiaAI loaded. Configure sua API key em https://build.nvidia.com/');
// ==========================================
// KORD AI CHAT UI
// Chat interface for Kord using NVIDIA AI
// ==========================================

let kordAIChatMessages = [];

function openKordAIChat() {
    if (!NvidiaAI.isConfigured()) {
        NvidiaAI.openSettings();
        return;
    }
    
    // Create or show chat modal
    let modal = document.getElementById('kord-ai-chat-modal');
    if (!modal) {
        modal = document.createElement('div');
        modal.id = 'kord-ai-chat-modal';
        modal.className = 'kord-modal-overlay';
        modal.innerHTML = `
            <div class="kord-ai-chat-container">
                <div class="kord-ai-chat-header">
                    <h3><span class="material-icons-round">psychology</span> Kord AI Chat</h3>
                    <div class="kord-ai-chat-controls">
                        <button onclick="NvidiaAI.openSettings()" class="kord-btn-icon" title="Configurações">
                            <span class="material-icons-round">settings</span>
                        </button>
                        <button onclick="closeKordAIChat()" class="kord-btn-icon">
                            <span class="material-icons-round">close</span>
                        </button>
                    </div>
                </div>
                <div id="kord-ai-chat-messages" class="kord-ai-chat-messages"></div>
                <div class="kord-ai-chat-input-area">
                    <input type="text" id="kord-ai-chat-input" placeholder="Pergunte algo..." onkeypress="handleKordAIChatEnter(event)">
                    <button onclick="sendKordAIChat()" class="kord-send-btn">
                        <span class="material-icons-round">send</span>
                    </button>
                </div>
            </div>
        `;
        document.body.appendChild(modal);
        
        // Add welcome message
        kordAIChatMessages = [{ role: 'assistant', content: 'Olá! Sou o Kord AI. Como posso ajudar você hoje?' }];
        renderKordAIChatMessages();
    }
    modal.style.display = 'flex';
    document.getElementById('kord-ai-chat-input').focus();
}

function closeKordAIChat() {
    const modal = document.getElementById('kord-ai-chat-modal');
    if (modal) modal.style.display = 'none';
}

function handleKordAIChatEnter(e) {
    if (e.key === 'Enter') sendKordAIChat();
}

function renderKordAIChatMessages() {
    const container = document.getElementById('kord-ai-chat-messages');
    if (!container) return;
    
    container.innerHTML = kordAIChatMessages.map(msg => {
        const isUser = msg.role === 'user';
        const avatar = isUser ? '😊' : '🤖';
        const name = isUser ? 'Você' : 'Kord AI';
        return `
            <div class="kord-ai-message ${isUser ? 'kord-ai-message-user' : 'kord-ai-message-ai'}">
                <div class="kord-ai-avatar">${avatar}</div>
                <div class="kord-ai-bubble">
                    <div class="kord-ai-name">${name}</div>
                    <div class="kord-ai-content">${escapeHtml(msg.content)}</div>
                </div>
            </div>
        `;
    }).join('');
    
    container.scrollTop = container.scrollHeight;
}

function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

async function sendKordAIChat() {
    const input = document.getElementById('kord-ai-chat-input');
    const message = input.value.trim();
    if (!message) return;
    
    input.value = '';
    
    // Add user message
    kordAIChatMessages.push({ role: 'user', content: message });
    renderKordAIChatMessages();
    
    // Show typing indicator
    const messagesDiv = document.getElementById('kord-ai-chat-messages');
    const typingId = 'typing-indicator';
    messagesDiv.innerHTML += `<div id="${typingId}" class="kord-ai-message kord-ai-message-ai">
        <div class="kord-ai-avatar">🤖</div>
        <div class="kord-ai-bubble"><div class="kord-ai-typing">digitando...</div></div>
    </div>`;
    messagesDiv.scrollTop = messagesDiv.scrollHeight;
    
    // Call NVIDIA AI
    const result = await NvidiaAI.chat(kordAIChatMessages);
    
    // Remove typing indicator
    const typing = document.getElementById(typingId);
    if (typing) typing.remove();
    
    if (result.error) {
        kordAIChatMessages.push({ role: 'assistant', content: `Erro: ${result.error}` });
    } else {
        kordAIChatMessages.push({ role: 'assistant', content: result.content });
    }
    
    renderKordAIChatMessages();
}

// Add CSS for AI Chat
const aiChatCSS = `
.kord-ai-chat-container {
    background: #1e293b;
    border-radius: 12px;
    width: 90%;
    max-width: 600px;
    max-height: 80vh;
    display: flex;
    flex-direction: column;
    box-shadow: 0 20px 60px rgba(0,0,0,0.5);
}

.kord-ai-chat-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 16px;
    border-bottom: 1px solid rgba(71,85,105,0.5);
}

.kord-ai-chat-header h3 {
    display: flex;
    align-items: center;
    gap: 8px;
    margin: 0;
    color: #f1f5f9;
    font-size: 1.1rem;
}

.kord-ai-chat-header h3 .material-icons-round {
    color: #6366f1;
}

.kord-ai-chat-controls {
    display: flex;
    gap: 8px;
}

.kord-btn-icon {
    background: rgba(71,85,105,0.5);
    border: none;
    color: #94a3b8;
    border-radius: 8px;
    padding: 8px;
    cursor: pointer;
    display: flex;
    align-items: center;
}

.kord-btn-icon:hover {
    background: rgba(99,102,241,0.3);
    color: #f1f5f9;
}

.kord-ai-chat-messages {
    flex: 1;
    overflow-y: auto;
    padding: 16px;
    display: flex;
    flex-direction: column;
    gap: 12px;
}

.kord-ai-message {
    display: flex;
    gap: 12px;
    max-width: 85%;
}

.kord-ai-message-user {
    align-self: flex-end;
    flex-direction: row-reverse;
}

.kord-ai-avatar {
    width: 36px;
    height: 36px;
    border-radius: 50%;
    background: #475569;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 18px;
    flex-shrink: 0;
}

.kord-ai-message-ai .kord-ai-avatar {
    background: linear-gradient(135deg, #6366f1, #8b5cf6);
}

.kord-ai-bubble {
    background: rgba(51,65,85,0.8);
    padding: 12px 16px;
    border-radius: 12px;
    max-width: 100%;
}

.kord-ai-message-user .kord-ai-bubble {
    background: rgba(99,102,241,0.3);
}

.kord-ai-name {
    font-size: 0.75rem;
    color: #64748b;
    margin-bottom: 4px;
}

.kord-ai-content {
    color: #f1f5f9;
    line-height: 1.5;
    font-size: 0.95rem;
}

.kord-ai-typing {
    color: #94a3b8;
    font-style: italic;
}

.kord-ai-chat-input-area {
    display: flex;
    gap: 8px;
    padding: 16px;
    border-top: 1px solid rgba(71,85,105,0.5);
}

.kord-ai-chat-input-area input {
    flex: 1;
    background: rgba(30,41,59,0.8);
    border: 1px solid rgba(71,85,105,0.5);
    border-radius: 8px;
    padding: 12px 16px;
    color: #f1f5f9;
    font-size: 0.95rem;
}

.kord-ai-chat-input-area input:focus {
    outline: none;
    border-color: #6366f1;
}

.kord-ai-chat-input-area .kord-send-btn {
    background: #6366f1;
    border: none;
    border-radius: 8px;
    padding: 10px 16px;
    cursor: pointer;
    color: white;
    display: flex;
    align-items: center;
}

.kord-ai-chat-input-area .kord-send-btn:hover {
    background: #5558e8;
}
`;

// Inject AI Chat CSS
if (!document.getElementById('kord-ai-chat-styles')) {
    const style = document.createElement('style');
    style.id = 'kord-ai-chat-styles';
    style.textContent = aiChatCSS;
    document.head.appendChild(style);
}

console.log('Kord AI Chat UI loaded.');
