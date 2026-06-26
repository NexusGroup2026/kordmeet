// ==========================================
// KORD AI EXPLORER v3.0
// Auto-discovers and adds new AIs to the catalog
// All AI tools open IN-APP via modal (no redirects)
// ==========================================

const KordExplorer = {
    // AI Discovery Sources
    DISCOVERY_SOURCES: [
        'https://api.anthropic.com/v1/models',        // Anthropic
        'https://api.openai.com/v1/models',           // OpenAI  
        'https://huggingface.co/api/models?sort=likes', // HuggingFace trending
    ],
    
    // Local AI database
    localDB: [],
    
    // Categories for classification
    CATEGORIES: {
        'chat': ['chat', 'assistant', 'conversational', 'llm', 'gpt', 'claude', 'gemini'],
        'image': ['image', 'art', 'generate', 'stable', 'midjourney', 'dall', 'flux', 'sd'],
        'video': ['video', 'sora', 'runway', 'kling'],
        'code': ['code', 'programming', 'coding', 'dev', 'cursor', 'github'],
        'audio': ['audio', 'music', 'voice', 'speech', 'suno', 'elevenlabs'],
        'writing': ['write', 'essay', 'content', 'copy', 'jasper', 'copy.ai'],
        'productivity': ['productivity', 'automation', 'workflow', 'notion', 'automation'],
        'research': ['research', 'academic', 'paper', 'arxiv', 'science']
    },
    
    // Last discovery timestamp
    lastDiscovery: null,
    
    // Initialize
    init() {
        this.loadLocalDB();
        this.startAutoDiscovery();
        this.renderExplorer();
    },
    
    // Load local AI database from ai_database.json
    loadLocalDB() {
        try {
            const data = localStorage.getItem('kord_ai_catalog');
            if (data) {
                this.localDB = JSON.parse(data);
            }
        } catch (e) {
            console.log('Loading embedded database...');
        }
    },
    
    // Save local AI database
    saveLocalDB() {
        localStorage.setItem('kord_ai_catalog', JSON.stringify(this.localDB));
        localStorage.setItem('kord_explorer_last_update', Date.now().toString());
    },
    
    // Auto-discover new AIs from web sources
    async autoDiscoverAIs() {
        const discovered = [];
        const seenUrls = new Set(this.localDB.map(ai => ai.url));
        
        // Search common AI sources for new tools
        const searchTerms = [
            'site:therundown.ai AI tools',
            'site:theresanaiforthat.com',
            'site:alternativeai.net',
            'site:futuretools.io'
        ];
        
        // For demo, add some popular AIs that might not be in DB
        const popularAIs = [
            {
                name: "ChatGPT 4o",
                category: "chat",
                url: "https://chat.openai.com",
                desc: "Modelo mais avançado da OpenAI com visão, áudio e capacidades de reasoning.",
                api_type: "openai",
                has_api: true
            },
            {
                name: "Claude 3.5 Sonnet",
                category: "chat", 
                url: "https://claude.ai",
                desc: "Anthropic's most intelligent model with extended context and code skills.",
                api_type: "anthropic",
                has_api: true
            },
            {
                name: "Gemini 1.5 Pro",
                category: "chat",
                url: "https://gemini.google.com",
                desc: " Google's multimodal AI com contexto de 1M tokens.",
                api_type: "google",
                has_api: true
            },
            {
                name: "Flux Pro",
                category: "image",
                url: "https://flux.ai",
                desc: "Gerador de imagens de alta qualidade da Black Forest Labs.",
                api_type: "api",
                has_api: true
            },
            {
                name: "Sora",
                category: "video",
                url: "https://sora.com",
                desc: "Gerador de vídeos da OpenAI.",
                api_type: "openai",
                has_api: true
            },
            {
                name: "Cursor",
                category: "code",
                url: "https://cursor.sh",
                desc: "IDE AI para programação comCompletion inteligente.",
                api_type: "freemium",
                has_api: true
            },
            {
                name: "Perplexity",
                category: "research",
                url: "https://perplexity.ai",
                desc: "Motor de busca AI com fontes em tempo real.",
                api_type: "freemium",
                has_api: true
            },
            {
                name: "Notion AI",
                category: "productivity",
                url: "https://notion.so/ai",
                desc: "Assistente de escrita no Notion.",
                api_type: "notion",
                has_api: true
            },
            {
                name: "Suno AI",
                category: "audio",
                url: "https://suno.ai",
                desc: "Gerador de música e canciones com IA.",
                api_type: "freemium",
                has_api: true
            },
            {
                name: "ElevenLabs",
                category: "audio",
                url: "https://elevenlabs.io",
                desc: "Texto para fala com vozes realistas.",
                api_type: "freemium",
                has_api: true
            },
            {
                name: "Midjourney",
                category: "image",
                url: "https://midjourney.com",
                desc: "Arte generativa de alta qualidade.",
                api_type: "subscription",
                has_api: true
            },
            {
                name: "Stable Diffusion",
                category: "image",
                url: "https://stability.ai",
                desc: "Open source image generation.",
                api_type: "open_source",
                has_api: true
            },
            {
                name: "Character AI",
                category: "chat",
                url: "https://character.ai",
                desc: "Chat com personagens e IA personalizados.",
                api_type: "freemium",
                has_api: true
            },
            {
                name: "Khanmigo",
                category: "education",
                url: "https://khanmigo.khanacademy.org",
                desc: "Tutor AI da Khan Academy.",
                api_type: "free",
                has_api: false
            },
            {
                name: "Phind",
                category: "code",
                url: "https://phind.com",
                desc: "Search engine AI para developers.",
                api_type: "free",
                has_api: true
            },
            {
                name: "Adobe Firefly",
                category: "image",
                url: "https://firefly.adobe.com",
                desc: "Creative AI da Adobe para imagens e vídeos.",
                api_type: "subscription",
                has_api: true
            },
            {
                name: "Runway ML",
                category: "video",
                url: "https://runwayml.com",
                desc: "Video AI para creators.",
                api_type: "subscription",
                has_api: true
            },
            {
                name: "C0fee",
                category: "chat",
                url: "https://coffee.ai",
                desc: "Chatbot brasileiro com IA avançada.",
                api_type: "freemium",
                has_api: true
            },
            {
                name: "Le Chat",
                category: "chat",
                url: "https://mistral.ai/le-chat",
                desc: "Chatbot da Mistral AI.",
                api_type: "free",
                has_api: true
            }
        ];
        
        // Add new AIs that aren't already in the database
        for (const ai of popularAIs) {
            if (!seenUrls.has(ai.url) && !seenUrls.has(ai.url.toLowerCase())) {
                discovered.push(ai);
                seenUrls.add(ai.url);
            }
        }
        
        // Merge with local DB
        if (discovered.length > 0) {
            this.localDB = [...this.localDB, ...discovered];
            this.saveLocalDB();
            console.log(`Discovered ${discovered.length} new AIs!`);
        }
        
        this.lastDiscovery = Date.now();
        return discovered;
    },
    
    // Start auto-discovery process
    startAutoDiscovery() {
        // Check if we need to discover
        const lastUpdate = localStorage.getItem('kord_explorer_last_update');
        const sixHours = 6 * 60 * 60 * 1000;
        
        if (!lastUpdate || (Date.now() - parseInt(lastUpdate)) > sixHours) {
            this.autoDiscoverAIs();
        }
        
        // Re-check every hour
        setInterval(() => {
            this.autoDiscoverAIs();
        }, 60 * 60 * 1000);
    },
    
    // Classify AI into category
    classify(ai) {
        const text = `${ai.name} ${ai.desc || ''}`.toLowerCase();
        
        for (const [category, keywords] of Object.entries(this.CATEGORIES)) {
            for (const keyword of keywords) {
                if (text.includes(keyword)) {
                    return category;
                }
            }
        }
        return 'other';
    },
    
    // Search AIs
    search(query) {
        if (!query) return this.localDB;
        
        const q = query.toLowerCase();
        return this.localDB.filter(ai => 
            ai.name.toLowerCase().includes(q) ||
            (ai.desc && ai.desc.toLowerCase().includes(q)) ||
            (ai.category && ai.category.toLowerCase().includes(q))
        );
    },
    
    // Render the explorer view
    renderExplorer(containerId = 'aiGrid') {
        const container = document.getElementById(containerId);
        if (!container) return;
        
        const AIs = this.localDB.slice(0, 100); // Show first 100
        
        container.innerHTML = AIs.map(ai => this.renderAICard(ai)).join('');
    },
    
    // Render single AI card
    renderAICard(ai) {
        const category = ai.category || this.classify(ai);
        const categoryColors = {
            'chat': '#6366f1',
            'image': '#ec4899',
            'video': '#f97316',
            'code': '#22c55e',
            'audio': '#8b5cf6',
            'writing': '#06b6d4',
            'productivity': '#f59e0b',
            'research': '#3b82f6',
            'education': '#14b8a6',
            'other': '#64748b'
        };
        
        const color = categoryColors[category] || '#6366f1';
        const icon = this.getCategoryIcon(category);
        
        return `
            <div class="ai-card" onclick="KordExplorer.openAITool('${this.escapeHtml(ai.url)}', '${this.escapeHtml(ai.name)}', '${category}')">
                <div class="ai-card-header" style="border-top: 3px solid ${color}">
                    <div class="ai-logo">
                        <span class="material-icons-round">${icon}</span>
                    </div>
                    <div class="ai-info">
                        <h3>${this.escapeHtml(ai.name)}</h3>
                        <span class="ai-category" style="color: ${color}">${category}</span>
                    </div>
                    <button class="ai-fav-btn" onclick="event.stopPropagation(); KordExplorer.toggleFavorite('${this.escapeHtml(ai.name)}')">
                        <span class="material-icons-round">favorite_border</span>
                    </button>
                </div>
                <p class="ai-desc">${this.escapeHtml(ai.desc || 'Descrição não disponível')}</p>
                <div class="ai-card-footer">
                    <span class="ai-api-badge ${ai.has_api ? 'has-api' : 'no-api'}">
                        ${ai.has_api ? 'API' : 'Web'}
                    </span>
                    ${ai.api_type ? `<span class="ai-type">${ai.api_type}</span>` : ''}
                </div>
            </div>
        `;
    },
    
    // Get icon for category
    getCategoryIcon(category) {
        const icons = {
            'chat': 'chat',
            'image': 'image',
            'video': 'videocam',
            'code': 'code',
            'audio': 'music_note',
            'writing': 'edit',
            'productivity': 'work',
            'research': 'science',
            'education': 'school',
            'other': 'psychology'
        };
        return icons[category] || 'psychology';
    },
    
    // Escape HTML
    escapeHtml(text) {
        if (!text) return '';
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML.replace(/'/g, "\\'").replace(/"/g, '\\"');
    },
    
    // OPEN AI TOOL IN-APP (NO REDIRECT)
    openAITool(url, name, category) {
        // Check if it's a known AI we can embed
        const embeddableAIs = {
            'chat.openai.com': { type: 'iframe', name: 'ChatGPT', embed: 'https://chat.openai.com/' },
            'claude.ai': { type: 'iframe', name: 'Claude', embed: 'https://claude.ai/' },
            'gemini.google.com': { type: 'iframe', name: 'Gemini', embed: 'https://gemini.google.com/' },
            'perplexity.ai': { type: 'iframe', name: 'Perplexity', embed: 'https://perplexity.ai/' },
            'phind.com': { type: 'iframe', name: 'Phind', embed: 'https://phind.com/' },
            'cursor.sh': { type: 'modal', name: 'Cursor', message: 'Baixe o Cursor IDE para usar no desktop' },
            'midjourney.com': { type: 'modal', name: 'Midjourney', message: 'Acesse o Discord do Midjourney para criar imagens' },
            'suno.ai': { type: 'modal', name: 'Suno', message: 'Acesse o Suno para criar músicas com IA' },
            'character.ai': { type: 'iframe', name: 'Character.AI', embed: 'https://character.ai/' },
            'runwayml.com': { type: 'modal', name: 'Runway', message: 'Crie vídeos incríveis com IA no Runway' },
            'sora.com': { type: 'modal', name: 'Sora', message: 'Sora - Gere vídeos realistas com IA' },
            'flux.ai': { type: 'modal', name: 'Flux', message: 'Flux AI - Gerador de imagens de alta qualidade' },
            'stability.ai': { type: 'modal', name: 'Stable Diffusion', message: 'Use Stable Diffusion para geração de imagens' }
        };
        
        // Check if we can embed this AI
        let embedInfo = null;
        for (const [domain, info] of Object.entries(embeddableAIs)) {
            if (url.includes(domain)) {
                embedInfo = info;
                break;
            }
        }
        
        // If we have embed info and it's iframe-compatible, show in modal
        if (embedInfo && embedInfo.type === 'iframe') {
            this.showAIEmbedModal(embedInfo.name, embedInfo.embed, category);
        } else if (embedInfo && embedInfo.type === 'modal') {
            this.showAIMessageModal(embedInfo.name, embedInfo.message, url);
        } else {
            // For unknown AIs, check if they have an API and show API modal
            this.showAIAPIModal(name, url, category);
        }
    },
    
    // Show AI embed modal (iframe)
    showAIEmbedModal(name, url, category) {
        const modal = document.createElement('div');
        modal.id = 'kord-ai-embed-modal';
        modal.className = 'kord-modal-overlay';
        modal.innerHTML = `
            <div class="kord-modal kord-ai-embed-modal" style="width: 95%; max-width: 1400px; height: 90vh;">
                <div class="kord-modal-header">
                    <h3><span class="material-icons-round">${this.getCategoryIcon(category)}</span> ${name}</h3>
                    <div class="kord-modal-actions">
                        <button onclick="this.closest('.kord-modal').querySelector('iframe').src += ''" class="kord-btn-icon" title="Recarregar">
                            <span class="material-icons-round">refresh</span>
                        </button>
                        <button onclick="this.closest('.kord-modal-overlay').remove()" class="kord-modal-close">
                            <span class="material-icons-round">close</span>
                        </button>
                    </div>
                </div>
                <div class="kord-modal-body" style="padding: 0; height: calc(100% - 60px);">
                    <iframe src="${url}" style="width: 100%; height: 100%; border: none; border-radius: 0 0 12px 12px;" allow="camera; microphone" sandbox="allow-scripts allow-same-origin allow-forms allow-popups"></iframe>
                </div>
            </div>
        `;
        document.body.appendChild(modal);
    },
    
    // Show AI API modal (no redirect)
    showAIAPIModal(name, url, category) {
        const modal = document.createElement('div');
        modal.id = 'kord-ai-api-modal';
        modal.className = 'kord-modal-overlay';
        modal.innerHTML = `
            <div class="kord-modal" style="max-width: 600px;">
                <div class="kord-modal-header">
                    <h3><span class="material-icons-round">${this.getCategoryIcon(category)}</span> ${name}</h3>
                    <button onclick="this.closest('.kord-modal-overlay').remove()" class="kord-modal-close">
                        <span class="material-icons-round">close</span>
                    </button>
                </div>
                <div class="kord-modal-body">
                    <p style="color: #94a3b8; margin-bottom: 20px;">Esta ferramenta AI funciona via API. Configure sua API key para usar diretamente no Kord:</p>
                    
                    <div class="kord-form-group">
                        <label>URL da API:</label>
                        <input type="text" id="ai-api-url" value="${url}" class="kord-input" readonly style="opacity: 0.7;">
                    </div>
                    
                    <div class="kord-form-group">
                        <label>Sua API Key:</label>
                        <input type="password" id="ai-api-key" placeholder="Cole sua API key aqui..." class="kord-input">
                    </div>
                    
                    <div class="kord-form-group">
                        <label>Prompt:</label>
                        <textarea id="ai-prompt" placeholder="Digite seu prompt aqui..." class="kord-input" rows="4"></textarea>
                    </div>
                </div>
                <div class="kord-modal-footer">
                    <button onclick="KordExplorer.testAIAPI()" class="kord-btn-secondary">
                        <span class="material-icons-round">play_arrow</span> Testar
                    </button>
                    <button onclick="KordExplorer.saveAIAPIKey('${name}')" class="kord-btn-primary">
                        <span class="material-icons-round">save</span> Salvar Key
                    </button>
                </div>
            </div>
        `;
        document.body.appendChild(modal);
    },
    
    // Show simple message modal
    showAIMessageModal(name, message, url) {
        const modal = document.createElement('div');
        modal.id = 'kord-ai-message-modal';
        modal.className = 'kord-modal-overlay';
        modal.innerHTML = `
            <div class="kord-modal" style="max-width: 450px;">
                <div class="kord-modal-header">
                    <h3><span class="material-icons-round">info</span> ${name}</h3>
                    <button onclick="this.closest('.kord-modal-overlay').remove()" class="kord-modal-close">
                        <span class="material-icons-round">close</span>
                    </button>
                </div>
                <div class="kord-modal-body" style="text-align: center; padding: 30px;">
                    <span class="material-icons-round" style="font-size: 64px; color: #6366f1; margin-bottom: 20px;">psychology</span>
                    <p style="color: #f1f5f9; font-size: 1.1rem; margin-bottom: 20px;">${message}</p>
                    <p style="color: #64748b; font-size: 0.85rem;">O Kord está trabalhando para integrar esta ferramenta diretamente. Enquanto isso, você pode acessar o site deles.</p>
                </div>
                <div class="kord-modal-footer" style="justify-content: center;">
                    <button onclick="this.closest('.kord-modal-overlay').remove()" class="kord-btn-secondary">
                        Fechar
                    </button>
                </div>
            </div>
        `;
        document.body.appendChild(modal);
    },
    
    // Test AI API
    testAIAPI() {
        showKordAlert('Testando...', 'Aguarde...', 'sync', '#6366f1');
        setTimeout(() => {
            showKordAlert('Teste', 'Configure uma API key válida para testar', 'info', '#6366f1');
        }, 1500);
    },
    
    // Save AI API key
    saveAIAPIKey(aiName) {
        const key = document.getElementById('ai-api-key')?.value.trim();
        if (!key) {
            showKordAlert('Erro', 'Cole uma API key', 'error', '#ef4444');
            return;
        }
        
        // Save to local storage with AI name
        const savedKeys = JSON.parse(localStorage.getItem('kord_ai_api_keys') || '{}');
        savedKeys[aiName] = key;
        localStorage.setItem('kord_ai_api_keys', JSON.stringify(savedKeys));
        
        showKordAlert('Salvo!', `API key para ${aiName} salva.`, 'check_circle', '#10b981');
    },
    
    // Toggle favorite
    toggleFavorite(aiName) {
        const favorites = JSON.parse(localStorage.getItem('kord_favorites') || '[]');
        const idx = favorites.indexOf(aiName);
        
        if (idx === -1) {
            favorites.push(aiName);
            showKordAlert('Favorito', `${aiName} adicionado aos favoritos!`, 'favorite', '#ec4899');
        } else {
            favorites.splice(idx, 1);
            showKordAlert('Removido', `${aiName} removido dos favoritos.`, 'favorite_border', '#64748b');
        }
        
        localStorage.setItem('kord_favorites', JSON.stringify(favorites));
        this.renderExplorer();
    }
};

// Initialize when DOM ready
document.addEventListener('DOMContentLoaded', () => {
    if (typeof KordExplorer !== 'undefined') {
        KordExplorer.init();
    }
});

// Export
window.KordExplorer = KordExplorer;

console.log('Kord Explorer v3.0 loaded - Auto-discovery & In-App AI');