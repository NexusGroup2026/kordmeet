// ==========================================
// AI NEWS - Auto Updating News Feed
// ==========================================

const AINewsManager = {
    RSS_FEEDS: [
        'https://techcrunch.com/category/artificial-intelligence/feed/',
        'https://venturebeat.com/category/ai/feed/',
        'https://www.theverge.com/rss/ai-artificial-intelligence/index.xml'
    ],
    
    CACHE_KEY: 'kord_ai_news_cache',
    CACHE_DURATION: 6 * 60 * 60 * 1000, // 6 hours
    LAST_FETCH_KEY: 'kord_ai_news_last_fetch',
    
    async fetchRSS(feedUrl) {
        try {
            // Use RSS2JSON free API (no key required, 10k requests/month free)
            const apiUrl = `https://api.rss2json.com/v1/api.json?rss_url=${encodeURIComponent(feedUrl)}&api_key=&count=20`;
            const response = await fetch(apiUrl);
            if (!response.ok) throw new Error(`HTTP ${response.status}`);
            const data = await response.json();
            if (data.status !== 'ok') throw new Error('RSS parse error');
            return data.items || [];
        } catch (err) {
            console.warn(`AINews: Failed to fetch ${feedUrl}:`, err.message);
            return [];
        }
    },
    
    async fetchAllNews() {
        const allNews = [];
        for (const feed of this.RSS_FEEDS) {
            const items = await this.fetchRSS(feed);
            allNews.push(...items.map(item => ({
                ...item,
                source: feed.includes('techcrunch') ? 'TechCrunch' : 
                       feed.includes('venturebeat') ? 'VentureBeat' : 'The Verge'
            })));
        }
        
        // Sort by date, newest first
        allNews.sort((a, b) => new Date(b.pubDate) - new Date(a.pubDate));
        
        // Filter only today's news
        const today = new Date().toDateString();
        const todayNews = allNews.filter(item => {
            const itemDate = new Date(item.pubDate).toDateString();
            return itemDate === today;
        });
        
        // If no today's news, get last 24 hours
        if (todayNews.length === 0) {
            const yesterday = Date.now() - (24 * 60 * 60 * 1000);
            return allNews.filter(item => new Date(item.pubDate).getTime() > yesterday).slice(0, 30);
        }
        
        return todayNews.slice(0, 30);
    },
    
    async getNews() {
        const cached = localStorage.getItem(this.CACHE_KEY);
        const lastFetch = localStorage.getItem(this.LAST_FETCH_KEY);
        const now = Date.now();
        
        if (cached && lastFetch && (now - parseInt(lastFetch)) < this.CACHE_DURATION) {
            try {
                return JSON.parse(cached);
            } catch (e) {
                return await this.fetchAndCache();
            }
        }
        
        return await this.fetchAndCache();
    },
    
    async fetchAndCache() {
        const news = await this.fetchAllNews();
        localStorage.setItem(this.CACHE_KEY, JSON.stringify(news));
        localStorage.setItem(this.LAST_FETCH_KEY, Date.now().toString());
        return news;
    },
    
    formatTimeAgo(dateStr) {
        const now = Date.now();
        const date = new Date(dateStr).getTime();
        const diff = Math.floor((now - date) / 1000);
        
        if (diff < 60) return 'agora';
        if (diff < 3600) return `${Math.floor(diff / 60)}min atrás`;
        if (diff < 86400) return `${Math.floor(diff / 3600)}h atrás`;
        return `${Math.floor(diff / 86400)}d atrás`;
    },
    
    stripHtml(html) {
        const tmp = document.createElement('div');
        tmp.innerHTML = html || '';
        return tmp.textContent || tmp.innerText || '';
    },
    
    async renderNews(containerId) {
        const container = document.getElementById(containerId);
        if (!container) return;
        
        container.innerHTML = '<div class="ai-news-loading"><span class="material-icons-round spin">sync</span> Carregando notícias de IA...</div>';
        
        try {
            const news = await this.getNews();
            
            if (news.length === 0) {
                container.innerHTML = '<div class="ai-news-empty"><span class="material-icons-round">newspaper</span><p>Nenhuma notícia de IA hoje ainda.</p><small>Novas notícias aparecem automaticamente.</small></div>';
                return;
            }
            
            let html = '<div class="ai-news-header"><h3><span class="material-icons-round">psychology</span> News de IA</h3><button onclick="AINewsManager.refresh()" class="ai-news-refresh"><span class="material-icons-round">refresh</span></button></div>';
            html += '<div class="ai-news-grid">';
            
            news.forEach((item, i) => {
                const title = this.stripHtml(item.title);
                const desc = this.stripHtml(item.description).substring(0, 150) + '...';
                const time = this.formatTimeAgo(item.pubDate);
                const source = item.source || 'Unknown';
                const link = item.link || '#';
                const thumbnail = item.thumbnail || item.enclosure?.link || '';
                
                html += `<article class="ai-news-card" onclick="window.open('${link}', '_blank')">
                    ${thumbnail ? `<div class="ai-news-thumb" style="background-image:url('${thumbnail}')"></div>` : '<div class="ai-news-thumb ai-news-thumb-placeholder"><span class="material-icons-round">smart_toy</span></div>'}
                    <div class="ai-news-content">
                        <span class="ai-news-source">${source}</span>
                        <h4>${title}</h4>
                        <p>${desc}</p>
                        <div class="ai-news-meta">
                            <span class="ai-news-time"><span class="material-icons-round">schedule</span>${time}</span>
                        </div>
                    </div>
                </article>`;
            });
            
            html += '</div>';
            container.innerHTML = html;
            
        } catch (err) {
            console.error('AINews: Error rendering:', err);
            container.innerHTML = '<div class="ai-news-error"><span class="material-icons-round">error</span><p>Erro ao carregar notícias.</p><button onclick="AINewsManager.renderNews(\'' + containerId + '\')">Tentar novamente</button></div>';
        }
    },
    
    async refresh() {
        localStorage.removeItem(this.CACHE_KEY);
        localStorage.removeItem(this.LAST_FETCH_KEY);
        await this.fetchAndCache();
        this.renderNews('kord-ai-news-grid');
    }
};

// Auto-refresh every 6 hours
setInterval(() => {
    if (document.getElementById('kord-ai-news-grid')) {
        AINewsManager.refresh();
    }
}, 6 * 60 * 60 * 1000);

// CSS for AI News
const aiNewsCSS = `
.ai-news-container { padding: 16px; max-width: 1200px; margin: 0 auto; }
.ai-news-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px; }
.ai-news-header h3 { display: flex; align-items: center; gap: 8px; color: #6366f1; font-size: 1.5rem; margin: 0; }
.ai-news-refresh { background: rgba(99,102,241,0.1); border: 1px solid rgba(99,102,241,0.3); color: #6366f1; border-radius: 8px; padding: 8px 12px; cursor: pointer; display: flex; align-items: center; gap: 4px; transition: all 0.2s; }
.ai-news-refresh:hover { background: rgba(99,102,241,0.2); }
.ai-news-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(320px, 1fr)); gap: 16px; }
.ai-news-card { background: rgba(30,41,59,0.8); border: 1px solid rgba(71,85,105,0.5); border-radius: 12px; overflow: hidden; cursor: pointer; transition: all 0.2s; }
.ai-news-card:hover { border-color: #6366f1; transform: translateY(-2px); box-shadow: 0 8px 25px rgba(99,102,241,0.15); }
.ai-news-thumb { height: 140px; background-size: cover; background-position: center; background-color: #1e293b; }
.ai-news-thumb-placeholder { display: flex; align-items: center; justify-content: center; background: linear-gradient(135deg, #6366f1, #8b5cf6); }
.ai-news-thumb-placeholder .material-icons-round { font-size: 48px; color: rgba(255,255,255,0.7); }
.ai-news-content { padding: 16px; }
.ai-news-source { font-size: 0.7rem; color: #6366f1; text-transform: uppercase; font-weight: 600; letter-spacing: 0.5px; }
.ai-news-card h4 { margin: 8px 0; font-size: 1rem; color: #f1f5f9; line-height: 1.4; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden; }
.ai-news-card p { font-size: 0.85rem; color: #94a3b8; margin: 0 0 12px; line-height: 1.5; }
.ai-news-meta { display: flex; justify-content: space-between; align-items: center; }
.ai-news-time { display: flex; align-items: center; gap: 4px; font-size: 0.75rem; color: #64748b; }
.ai-news-time .material-icons-round { font-size: 14px; }
.ai-news-loading, .ai-news-empty, .ai-news-error { display: flex; flex-direction: column; align-items: center; justify-content: center; padding: 60px 20px; color: #94a3b8; text-align: center; }
.ai-news-loading .material-icons-round, .ai-news-empty .material-icons-round, .ai-news-error .material-icons-round { font-size: 48px; margin-bottom: 16px; color: #6366f1; }
.spin { animation: spin 1s linear infinite; }
@keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
`;

// Inject CSS
if (!document.getElementById('ai-news-styles')) {
    const style = document.createElement('style');
    style.id = 'ai-news-styles';
    style.textContent = aiNewsCSS;
    document.head.appendChild(style);
}

console.log('AINewsManager loaded. Auto-updates every 6 hours.');