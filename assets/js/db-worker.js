// --- DATABASE WORKER ---
// Handles the 300k item database in a separate thread to prevent UI freezing.

let db = [];

self.onmessage = async function (e) {
    const { type, payload } = e.data;

    if (type === 'LOAD_DB') {
        try {
            // Fetch the massive file
            const response = await fetch('../../ai_database.json');
            db = await response.json();

            // Send back stats and first chunk
            self.postMessage({
                type: 'DB_READY',
                count: db.length,
                firstChunk: db.slice(0, 50)
            });
        } catch (err) {
            // Fallback if file missing
            self.postMessage({ type: 'ERROR', error: 'Failed to load database.' });

            // Use mock data
            const MOCK = [
                { name: "ChatGPT 4o", category: "Chatbot", desc: "OpenAI Leader." },
                { name: "Midjourney", category: "Image", desc: "Art Generator." }
            ];
            db = MOCK;
            self.postMessage({ type: 'DB_READY', count: 2, firstChunk: MOCK });
        }
    }

    if (type === 'GET_FULL') {
        self.postMessage({ type: 'FULL_DB', db: db });
    }

    if (type === 'GET_CHUNK') {
        // payload: { start, end }
        const chunk = db.slice(payload.start, payload.end);
        self.postMessage({ type: 'CHUNK_DATA', chunk, reqId: payload.reqId });
    }

    if (type === 'SEARCH') {
        const query = payload.toLowerCase();
        if (!query) {
            // Reset to full DB
            self.postMessage({ type: 'SEARCH_VIRTUAL', count: db.length });
            return;
        }

        // Filter massive array
        const results = db.filter(item =>
            item.name.toLowerCase().includes(query) ||
            item.category.toLowerCase().includes(query)
        );

        // We can't send all results if huge, but we can send the "Filtered View"
        // For the worker version of Virtual Scroll, we'd need to keep "currentView" state here.
        // For simplicity in this optimization step, we return top 500 matches immediately
        self.postMessage({
            type: 'SEARCH_RESULTS',
            results: results.slice(0, 500),
            totalMatch: results.length
        });
    }
};
