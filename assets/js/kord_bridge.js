let backend = null;

document.addEventListener("DOMContentLoaded", function () {
    // Setup QWebChannel
    if (typeof QWebChannel !== "undefined") {
        new QWebChannel(qt.webChannelTransport, function (channel) {
            backend = channel.objects.backend;

            // Connect to Signals
            backend.aiResponseReceived.connect(function (response) {
                removeTypingIndicator();
                addChatMessage("Kord AI", response, true);
            });

            backend.optimizationStatus.connect(function (status) {
                showKordAlert("PC Otimizado", status, "speed", "#10b981");
                addChatMessage("Sistema", status, true);
            });

            console.log("Kord Bridge Conectada!");
        });
    } else {
        console.warn("QWebChannel não encontrado. Rodando no browser comum?");
    }

    // Load saved Groq Key
    const savedKey = localStorage.getItem('groq_api_key');
    if (savedKey && document.getElementById('groqApiKey')) {
        document.getElementById('groqApiKey').value = savedKey;
    }
});

function saveGroqKey() {
    if (typeof saveGroqKeyDirectly === 'function') {
        saveGroqKeyDirectly(true);
    } else {
        const input = document.getElementById('groqApiKey');
        const key = input ? input.value.trim() : "";
        if (!key) return;
        localStorage.setItem('groqApiKey', key);
        localStorage.setItem('groq_api_key', key);
        showKordAlert("Salvo", "Sua Groq API Key foi salva com sucesso.", "save", "#10b981");
    }
}

function triggerOptimization() {
    if (!backend) {
        showKordAlert("Servidor Offline", "Dificuldade na comunicação com a API local.", "link_off", "#ef4444");
        return;
    }
    backend.optimize_pc();
    addChatMessage("Você", "Otimizando PC...", false);
}

function handleAIChatEnter(e) {
    if (e.key === 'Enter') {
        sendAIChat();
    }
}

function sendAIChat() {
    const input = document.getElementById('aiInput');
    const msg = input.value.trim();
    if (!msg) return;

    // Show user msg
    addChatMessage("Você", msg, false);
    input.value = '';

    const apiKey = localStorage.getItem('groq_api_key') || '';

    if (!backend) {
        addChatMessage("Sistema", "Backend não conectado. Resposta mockada para '" + msg + "'.", true);
        return;
    }

    showTypingIndicator();
    backend.ask_ai(apiKey, msg);
}

function addChatMessage(sender, text, isAi) {
    const chatWindow = document.getElementById('aiChatWindow');
    if (!chatWindow) return;

    const msgDiv = document.createElement('div');
    msgDiv.style.padding = '10px 15px';
    msgDiv.style.borderRadius = '15px';
    msgDiv.style.maxWidth = '80%';
    msgDiv.innerHTML = `<strong>${sender}:</strong> <span style="display:block; margin-top:5px;">${text.replace(/\n/g, '<br>')}</span>`;

    if (isAi) {
        msgDiv.style.alignSelf = 'flex-start';
        msgDiv.style.background = 'rgba(99,102,241,0.1)';
        msgDiv.style.border = '1px solid rgba(99,102,241,0.2)';
        msgDiv.style.borderBottomLeftRadius = '2px';
    } else {
        msgDiv.style.alignSelf = 'flex-end';
        msgDiv.style.background = 'rgba(16,185,129,0.1)';
        msgDiv.style.border = '1px solid rgba(16,185,129,0.2)';
        msgDiv.style.borderBottomRightRadius = '2px';
    }

    chatWindow.appendChild(msgDiv);
    chatWindow.scrollTop = chatWindow.scrollHeight;
}

function showTypingIndicator() {
    const chatWindow = document.getElementById('aiChatWindow');
    if (!chatWindow) return;

    const msgDiv = document.createElement('div');
    msgDiv.id = 'typingIndicator';
    msgDiv.style.alignSelf = 'flex-start';
    msgDiv.style.background = 'rgba(99,102,241,0.1)';
    msgDiv.style.border = '1px solid rgba(99,102,241,0.2)';
    msgDiv.style.padding = '10px 15px';
    msgDiv.style.borderRadius = '15px';
    msgDiv.style.borderBottomLeftRadius = '2px';
    msgDiv.style.fontStyle = 'italic';
    msgDiv.style.color = '#94a3b8';
    msgDiv.innerHTML = 'Kord AI está digitando...';

    chatWindow.appendChild(msgDiv);
    chatWindow.scrollTop = chatWindow.scrollHeight;
}

function removeTypingIndicator() {
    const el = document.getElementById('typingIndicator');
    if (el) el.remove();
}
