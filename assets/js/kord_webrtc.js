// ==========================================
// KORD WEBRTC ENGINE v2.0
// Firebase Audio Walkie-Talkie Architecture
// ==========================================
let localStream = null;
let mediaRecorder = null;
let audioChunksRef = null;
let remoteAudioPlayers = {};
let isAudioEnabled = true;
let isVideoEnabled = true;
let isDeafened = false;
let isCallActive = false;

// AI Translate State
let isAITranslatorActive = true;
let speechRecognition = null;
let localSpeakingInterval = null;
let localAudioAnalyser = null;
let currentAIUtterance = null;

// Firebase Refs for Presence Only
let roomRef = null;
let presenceRef = null;
let presenceHeartbeatInterval = null;

// ==========================================
// START VOICE CALL
// ==========================================
async function startKordVoiceCall() {
    if (!currentUser || !currentKordServer || !currentKordChannel) return;

    if (isCallActive) {
        disconnectKordCall();
        return;
    }

    // Call UI Blackout
    const chatWindow = document.getElementById('kord-chat-window');
    const mainArea = document.getElementById('kord-main-area');
    const videoGrid = document.getElementById('kord-video-grid');
    const callActions = document.getElementById('kord-header-call-actions');
    const rtcControls = document.getElementById('kord-webrtc-controls');

    if (chatWindow) chatWindow.style.display = 'none';
    if (mainArea) mainArea.style.background = '#000000';
    if (videoGrid) {
        videoGrid.style.height = '100%';
        videoGrid.style.flex = '1';
        videoGrid.style.borderTop = 'none';
        videoGrid.style.display = 'flex';
        videoGrid.style.flexWrap = 'wrap';
        videoGrid.style.justifyContent = 'center';
        videoGrid.style.alignItems = 'center';
        videoGrid.style.gap = '15px';
        videoGrid.style.padding = '20px';
    }

    // Hide "Entrar" button, show RTC controls
    if (callActions) callActions.style.display = 'none';
    if (rtcControls) rtcControls.style.display = 'flex';
    isCallActive = true;
    currentKordCallServer = currentKordServer;
    currentKordCallChannel = currentKordChannel;

    // Try get Media (Camera+Mic -> Mic Only -> Listener Mode)
    try {
        localStream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
    } catch (e) {
        console.warn("Sem câmera detectada ou recusada. Tentando apenas Microfone...");
        try {
            localStream = await navigator.mediaDevices.getUserMedia({ video: false, audio: true });
        } catch (e2) {
            console.warn("Sem Microfone também. Entrando apenas como Ouvinte/Espectador.");
            const AudioCtx = window.AudioContext || window.webkitAudioContext;
            const ctx = new AudioCtx();
            const dest = ctx.createMediaStreamDestination();
            localStream = dest.stream;
        }
    }

    addLocalVideo(localStream);

    // CRITICAL FIX: Always use 'home_voice_lounge' as room ID
    // so everyone joins the SAME call regardless of their current server/channel
    const roomId = 'home_voice_lounge';
    roomRef = firebase.database().ref(`webrtc_rooms/${roomId}`);
    presenceRef = roomRef.child(`participants/${currentUser.uid}`);
    audioChunksRef = roomRef.child(`audio_chunks/${currentUser.uid}`);

    // Mark self present with profile data + heartbeat timestamp
    const displayName = currentUser.displayName || currentUser.email.split('@')[0];
    presenceRef.set({
        active: true,
        muted: !isAudioEnabled,
        deafened: isDeafened,
        displayName: displayName,
        photoURL: currentUser.photoURL || null,
        themeColor: currentUser.themeColor || '#6366f1',
        lastSeen: firebase.database.ServerValue.TIMESTAMP
    });
    presenceRef.onDisconnect().remove();
    audioChunksRef.onDisconnect().remove();

    // Start heartbeat to prevent ghost entries
    startPresenceHeartbeat();

    // 1. Send Audio Chunks (Walkie-Talkie Logic)
    if (localStream.getAudioTracks().length > 0) {
        // Determine supported MIME type for audio
        const mimeType = MediaRecorder.isTypeSupported('audio/webm;codecs=opus') ? 'audio/webm;codecs=opus'
            : MediaRecorder.isTypeSupported('audio/webm') ? 'audio/webm'
                : 'audio/ogg';

        mediaRecorder = new MediaRecorder(localStream, { mimeType: mimeType });
        mediaRecorder.ondataavailable = async (e) => {
            if (e.data.size > 0 && isAudioEnabled && isCallActive && !isDeafened) {
                const reader = new FileReader();
                reader.readAsDataURL(e.data);
                reader.onloadend = () => {
                    const base64Audio = reader.result;
                    if (audioChunksRef && isCallActive) {
                        audioChunksRef.push({
                            data: base64Audio,
                            mime: mimeType,
                            timestamp: firebase.database.ServerValue.TIMESTAMP
                        });
                    }
                };
            }
        };

        // Loop recording to force WebM headers on every chunk instead of corrupting playback
        mediaRecorder.start();
        window._kordMediaRecordLoop = setInterval(() => {
            if (!isCallActive) return clearInterval(window._kordMediaRecordLoop);
            if (mediaRecorder.state === 'recording') {
                mediaRecorder.stop();
                setTimeout(() => { if (isCallActive) mediaRecorder.start(); }, 10);
            }
        }, 1500);

        // Setup speaking detector for local user
        setupLocalSpeakingDetector(localStream);
    }

    // 2. Listen to Remote Participants - persistent value listener for real-time updates
    roomRef.child('participants').on('value', snap => {
        const participants = snap.val() || {};
        const currentPeers = Object.keys(participants).filter(uid => uid !== currentUser.uid);

        // Add new peers
        currentPeers.forEach(peerUid => {
            if (!document.getElementById(`video_${peerUid}`)) {
                addRemoteVideoPlaceholders(peerUid);
            }
            const p = participants[peerUid];
            updateRemoteMuteUI(peerUid, p.muted, p.deafened);

            // Handle screen share from peer
            if (p.screenShare === true && p.screenFrame) {
                updateRemoteScreenShareUI(peerUid, p.screenFrame, p.displayName || 'Usuário');
            }

            // Handle transcriptions
            if (isAITranslatorActive && p.lastTranscript && p.transcriptTime) {
                handleRemoteTranscription(peerUid, p.lastTranscript, p.transcriptTime);
            }
        });

        // Remove peers that left
        const allTiles = document.querySelectorAll('[id^="video_"]');
        allTiles.forEach(tile => {
            const tileUid = tile.id.replace('video_', '');
            if (tileUid !== 'local' && !participants[tileUid]) {
                removeRemoteVideo(tileUid);
                // Clean audio queue for departed peer
                if (audioQueues[tileUid]) delete audioQueues[tileUid];
                if (audioPlaying[tileUid]) delete audioPlaying[tileUid];
                if (_remoteAudioBuffers[tileUid]) delete _remoteAudioBuffers[tileUid];
            }
        });

        // Always rebuild member list
        updateCallMembersList();
    });

    // 3. Listen to Remote Audio Chunks - subscribe individually per peer
    const subscribedPeerAudio = {};
    roomRef.child('audio_chunks').on('child_added', userSnap => {
        const peerUid = userSnap.key;
        if (peerUid === currentUser.uid || subscribedPeerAudio[peerUid]) return;
        subscribedPeerAudio[peerUid] = true;

        // Only listen to NEW chunks (skip existing)
        let initialLoad = true;
        roomRef.child(`audio_chunks/${peerUid}`).limitToLast(1).once('value', () => {
            initialLoad = false;
        });

        roomRef.child(`audio_chunks/${peerUid}`).on('child_added', chunkSnap => {
            if (initialLoad) return; // Skip chunks that existed before we joined
            const chunkData = chunkSnap.val();
            if (chunkData && chunkData.data && !isDeafened && isCallActive) {
                queueRemoteAudio(peerUid, chunkData.data);
            }
        });
    });

    // Update member list
    updateCallMembersList();

    // Auto-enable AI Translator logic (always active, no need to toggle)
    if (typeof startRemoteAudioTranscription === 'function') {
        startRemoteAudioTranscription();
    }
}

// Audio queue per peer to prevent overlap
let audioQueues = {};
let audioPlaying = {};

function queueRemoteAudio(peerUid, base64Data) {
    if (!audioQueues[peerUid]) audioQueues[peerUid] = [];
    audioQueues[peerUid].push(base64Data);
    if (!audioPlaying[peerUid]) {
        playNextInQueue(peerUid);
    }
}

function playNextInQueue(peerUid) {
    if (!audioQueues[peerUid] || audioQueues[peerUid].length === 0) {
        audioPlaying[peerUid] = false;
        return;
    }
    audioPlaying[peerUid] = true;
    const base64Data = audioQueues[peerUid].shift();
    playRemoteAudioChunk(peerUid, base64Data);
}

// Remote audio transcription buffers
let _remoteAudioBuffers = {};
let _remoteTranscribeInterval = null;

function startRemoteAudioTranscription() {
    if (_remoteTranscribeInterval) return;
    _remoteTranscribeInterval = setInterval(async () => {
        if (!isAITranslatorActive) {
            clearInterval(_remoteTranscribeInterval);
            _remoteTranscribeInterval = null;
            _remoteAudioBuffers = {};
            return;
        }
        // Process each peer's buffer
        const peers = Object.keys(_remoteAudioBuffers);
        for (const peerUid of peers) {
            const blobs = _remoteAudioBuffers[peerUid];
            if (!blobs || blobs.length === 0) continue;
            _remoteAudioBuffers[peerUid] = []; // Clear buffer

            // Combine all blobs into one
            const combined = new Blob(blobs, { type: blobs[0].type || 'audio/webm' });
            if (combined.size < 8000) continue; // Skip silence

            // Get peer name
            let peerName = 'Participante';
            const nameEl = document.querySelector(`#video_${peerUid} .kord-video-label`);
            if (nameEl) peerName = nameEl.innerText;

            // Transcribe via Whisper
            const transcript = await whisperTranscribe(combined);
            if (!transcript || transcript.length < 3) continue;
            if (typeof isWhisperHallucination === 'function' && isWhisperHallucination(transcript)) continue;

            // Check for sound effects (laughter, music, etc.)
            const soundEffect = detectSoundEffect(transcript);
            if (soundEffect !== false) {
                if (soundEffect !== null) {
                    // Show sound effect as subtitle (e.g. "😂 *risos*")
                    const subtitleText = document.getElementById('kord-subtitle-text');
                    if (subtitleText) subtitleText.innerHTML = `<span style="color:#94a3b8;">${peerName}:</span> <span style="font-size:1.2em;">${soundEffect}</span>`;
                    const subBox = document.getElementById('kord-ai-subtitles');
                    if (subBox) { subBox.style.display = 'block'; subBox.style.animation = 'none'; subBox.offsetHeight; subBox.style.animation = 'fadeSubtitles 4s ease forwards'; }
                }
                continue; // Don't translate sound effects
            }

            // Step 1: Show original transcription first
            const subtitleText = document.getElementById('kord-subtitle-text');
            if (subtitleText) {
                subtitleText.innerHTML = `<span style="color:#94a3b8;">🎧 ${peerName}:</span> <span style="color:#e2e8f0;">"${transcript}"</span>`;
            }
            const subBox = document.getElementById('kord-ai-subtitles');
            if (subBox) { subBox.style.display = 'block'; subBox.style.animation = 'none'; }

            // Step 2: Translate, then show translation + speak it (with small delay so original is seen first)
            const langTarget = document.getElementById('kordTranslateTarget')?.value || 'pt-BR';
            const translatedText = await processGroqTranslation(transcript, "Auto", langTarget);

            if (translatedText && translatedText !== transcript) {
                // Broadcast my original text to Firebase
                if (roomRef && isCallActive && currentUser) {
                    roomRef.child('participants/' + currentUser.uid).update({
                        lastTranscript: transcript,
                        transcriptTime: firebase.database.ServerValue.TIMESTAMP
                    });
                }

                // Show both original + translation
                if (subtitleText) {
                    subtitleText.innerHTML = `<span style="color:#94a3b8;">🎧 ${peerName}:</span> <span style="color:#64748b; font-size:0.85em;">"${transcript}"</span><br><span style="color:#a78bfa;">🌐 Tradução:</span> <span style="color:#f8fafc; font-weight:600;">"${translatedText}"</span>`;
                }
                if (subBox) {
                    subBox.style.animation = 'none';
                    subBox.offsetHeight;
                    subBox.style.animation = 'fadeSubtitles 8s ease forwards';
                }
                // Speak translation after brief pause (let original audio finish)
                setTimeout(() => {
                    if (isAITranslatorActive) kordSpeakText(translatedText, langTarget);
                }, 800);
            } else {
                // Same language - just show original
                finalizeSubtitle(transcript, peerName);
            }
        }
    }, 4000);
}

function stopRemoteAudioTranscription() {
    if (_remoteTranscribeInterval) {
        clearInterval(_remoteTranscribeInterval);
        _remoteTranscribeInterval = null;
    }
    _remoteAudioBuffers = {};
}

function playRemoteAudioChunk(peerUid, base64Data) {
    // Animate UI indicator (speaking glow - GREEN)
    const tile = document.getElementById(`video_${peerUid}`);
    if (tile) {
        tile.style.borderColor = '#22c55e';
        tile.style.boxShadow = '0 0 20px rgba(34, 197, 94, 0.4)';
        const avatarWrap = tile.querySelector('.avatar-wrap');
        if (avatarWrap) {
            avatarWrap.style.boxShadow = '0 0 15px #22c55e, 0 0 25px #22c55e';
        }
        clearTimeout(tile._speakTimeout);
        tile._speakTimeout = setTimeout(() => {
            tile.style.borderColor = 'rgba(99, 102, 241, 0.3)';
            tile.style.boxShadow = 'none';
            if (avatarWrap) avatarWrap.style.boxShadow = 'none';
        }, 1500);
    }

    // Convert base64 data URL to blob for reliable playback
    try {
        const byteString = atob(base64Data.split(',')[1]);
        const mimeString = base64Data.split(',')[0].split(':')[1].split(';')[0];
        const ab = new ArrayBuffer(byteString.length);
        const ia = new Uint8Array(ab);
        for (let i = 0; i < byteString.length; i++) {
            ia[i] = byteString.charCodeAt(i);
        }
        const blob = new Blob([ab], { type: mimeString });

        // Buffer blob for AI translator transcription
        if (isAITranslatorActive) {
            if (!_remoteAudioBuffers[peerUid]) _remoteAudioBuffers[peerUid] = [];
            _remoteAudioBuffers[peerUid].push(blob);
        }

        const blobUrl = URL.createObjectURL(blob);
        const audio = new Audio(blobUrl);
        audio.volume = 1.0;
        audio.onended = () => {
            URL.revokeObjectURL(blobUrl);
            playNextInQueue(peerUid);
        };
        audio.onerror = () => {
            URL.revokeObjectURL(blobUrl);
            playNextInQueue(peerUid);
        };
        audio.play().catch(e => {
            console.warn("Auto-play prevented", e);
            playNextInQueue(peerUid);
        });
    } catch (e) {
        console.warn("Audio chunk playback error:", e);
        playNextInQueue(peerUid);
    }
}

// ==========================================
// PRESENCE HEARTBEAT (Prevents Ghost Entries)
// ==========================================
function startPresenceHeartbeat() {
    if (presenceHeartbeatInterval) clearInterval(presenceHeartbeatInterval);
    presenceHeartbeatInterval = setInterval(() => {
        if (presenceRef && isCallActive) {
            presenceRef.update({ lastSeen: firebase.database.ServerValue.TIMESTAMP });
        }
    }, 10000); // Update every 10 seconds
}

function stopPresenceHeartbeat() {
    if (presenceHeartbeatInterval) {
        clearInterval(presenceHeartbeatInterval);
        presenceHeartbeatInterval = null;
    }
}

// ==========================================
// LOCAL SPEAKING DETECTOR (Green glow on your avatar)
// ==========================================
function setupLocalSpeakingDetector(stream) {
    try {
        const AudioCtx = window.AudioContext || window.webkitAudioContext;
        const audioCtx = new AudioCtx();
        const source = audioCtx.createMediaStreamSource(stream);
        const analyser = audioCtx.createAnalyser();
        analyser.fftSize = 512;
        analyser.smoothingTimeConstant = 0.4;
        source.connect(analyser);
        localAudioAnalyser = analyser;

        const dataArray = new Uint8Array(analyser.frequencyBinCount);
        let isSpeaking = false;

        localSpeakingInterval = setInterval(() => {
            if (!isCallActive || !localAudioAnalyser) return;
            analyser.getByteFrequencyData(dataArray);

            // Calculate average volume
            let sum = 0;
            for (let i = 0; i < dataArray.length; i++) sum += dataArray[i];
            const avg = sum / dataArray.length;

            const localTile = document.getElementById('kord-local-video');
            if (!localTile) return;

            if (avg > 30 && isAudioEnabled) { // Speaking threshold (stricter to avoid hallucinations)
                _aiTranslatorHadSpeech = true;
                if (!isSpeaking) {
                    isSpeaking = true;
                    localTile.style.borderColor = '#22c55e';
                    localTile.style.boxShadow = '0 0 20px rgba(34, 197, 94, 0.4)';
                    const aw = localTile.querySelector('.avatar-wrap');
                    if (aw) aw.style.boxShadow = '0 0 15px #22c55e, 0 0 25px #22c55e';
                }
            } else {
                if (isSpeaking) {
                    isSpeaking = false;
                    // Keep _aiTranslatorHadSpeech true briefly so pending transcripts process
                    setTimeout(() => { _aiTranslatorHadSpeech = false; }, 800);
                    localTile.style.borderColor = 'rgba(99, 102, 241, 0.3)';
                    localTile.style.boxShadow = 'none';
                    const aw = localTile.querySelector('.avatar-wrap');
                    if (aw) aw.style.boxShadow = 'none';
                }
            }
        }, 100);
    } catch (e) {
        console.warn("Speaking detector setup failed:", e);
    }
}

// ==========================================
// DISCONNECT CALL (GLOBAL SCOPE – Fixed!)
// ==========================================
function disconnectKordCall() {
    isCallActive = false;

    // Blacklist current room so incoming call alert doesn't re-trigger after leaving
    if (roomRef && roomRef.key) {
        if (typeof _kordDeclinedRooms !== 'undefined') {
            _kordDeclinedRooms.set(roomRef.key, Date.now());
        }
    }

    // Stop heartbeat
    stopPresenceHeartbeat();

    // Stop speaking detector
    if (localSpeakingInterval) {
        clearInterval(localSpeakingInterval);
        localSpeakingInterval = null;
    }
    localAudioAnalyser = null;

    // Revert Call UI
    const chatWindow = document.getElementById('kord-chat-window');
    const mainArea = document.getElementById('kord-main-area');
    const videoGrid = document.getElementById('kord-video-grid');
    const rtcControls = document.getElementById('kord-webrtc-controls');
    const callActions = document.getElementById('kord-header-call-actions');

    if (chatWindow) chatWindow.style.display = 'flex';
    if (mainArea) mainArea.style.background = '#0f172a';
    if (videoGrid) {
        videoGrid.innerHTML = '';
        videoGrid.style.display = 'none';
        videoGrid.style.height = '240px';
        videoGrid.style.flex = 'none';
    }
    if (rtcControls) rtcControls.style.display = 'none';

    // Show "Entrar na Call" button again
    if (callActions) {
        callActions.style.display = 'flex';
        callActions.innerHTML = `<button onclick="startKordVoiceCall()" class="kord-join-call-btn">
            <span class="material-icons-round">call</span> Entrar na Call
        </button>`;
    }

    // Stop media
    if (mediaRecorder && mediaRecorder.state !== 'inactive') {
        mediaRecorder.stop();
    }

    // Clean Firebase
    if (presenceRef) presenceRef.remove();
    if (audioChunksRef) audioChunksRef.remove();
    if (roomRef) {
        roomRef.child('participants').off();
        roomRef.child('audio_chunks').off();
    }

    // Detach member list listener and clear cache
    if (_memberListListenerRef) {
        _memberListListenerRef.off();
        _memberListListenerRef = null;
    }
    // Clear member cache so fresh data on next call
    Object.keys(_memberCache).forEach(k => delete _memberCache[k]);

    remoteAudioPlayers = {};

    if (localStream) {
        localStream.getTracks().forEach(track => track.stop());
        localStream = null;
    }

    currentKordCallServer = null;
    currentKordCallChannel = null;

    if (isAITranslatorActive) {
        toggleAITranslator();
    }

    // Update member list to show we left
    updateCallMembersList();
}

// ==========================================
// ADD LOCAL VIDEO (GLOBAL SCOPE – Fixed!)
// ==========================================
function addLocalVideo(stream) {
    const existing = document.getElementById('kord-local-video');
    if (existing) existing.remove();

    const grid = document.getElementById('kord-video-grid');
    if (!grid) return;

    const wrap = document.createElement('div');
    wrap.id = 'kord-local-video';
    wrap.className = 'kord-video-tile';

    const hasVideo = stream && stream.getVideoTracks().length > 0;

    if (hasVideo) {
        const v = document.createElement('video');
        v.srcObject = stream;
        v.autoplay = true;
        v.muted = true;
        v.style.cssText = "width:100%; height:100%; object-fit:cover; pointer-events:auto;";

        // Fullscreen btn
        const fsBtn = document.createElement('button');
        fsBtn.innerHTML = '<span class="material-icons-round" style="font-size:16px;">fullscreen</span>';
        fsBtn.className = 'kord-video-fs-btn';
        fsBtn.onclick = (e) => { e.stopPropagation(); toggleKordFullscreen(v); };
        wrap.appendChild(fsBtn);

        wrap.appendChild(v);
    } else {
        let color = (currentUser && currentUser.themeColor) || '#6366f1';
        if (color === 'transparent') color = '#6366f1';

        const name = (currentUser && currentUser.displayName) || (currentUser && currentUser.email ? currentUser.email.split('@')[0] : '?');
        const initial = name.charAt(0).toUpperCase();
        const dec = typeof currentSelectedDecoration !== 'undefined' ? currentSelectedDecoration : 'none';

        const avatarWrap = document.createElement('div');
        avatarWrap.className = (dec !== 'none' ? `dec-${dec} avatar-wrap` : 'avatar-wrap');
        avatarWrap.style.cssText = `width:80px; height:80px; border-radius:50%; background:${color}; display:flex; justify-content:center; align-items:center; color:#fff; font-weight:bold; font-size:32px; transition: box-shadow 0.2s ease-in-out; position:relative; overflow:hidden;`;

        if (currentUser && currentUser._kordPhotoURL) {
            avatarWrap.innerHTML = `<img src="${currentUser._kordPhotoURL}" style="width:100%; height:100%; object-fit:cover; border-radius:50%;" onerror="this.outerHTML='${initial}'" />`;
        } else {
            avatarWrap.innerHTML = initial;
        }
        wrap.appendChild(avatarWrap);
    }

    const label = document.createElement('span');
    label.className = 'kord-video-label';
    const userName = (currentUser && currentUser.displayName) || (currentUser && currentUser.email ? currentUser.email.split('@')[0] : '?');
    label.innerText = userName + ' (Você)';
    wrap.appendChild(label);

    // Mute Icon Overlay
    const muteIcon = document.createElement('div');
    muteIcon.id = 'kord-local-mute-icon';
    muteIcon.className = 'kord-mute-icon';

    if (isDeafened) {
        muteIcon.style.display = 'flex';
        muteIcon.innerHTML = `<span class="material-icons-round" style="font-size:18px;">headset_off</span>`;
    } else if (!isAudioEnabled) {
        muteIcon.style.display = 'flex';
        muteIcon.innerHTML = `<span class="material-icons-round" style="font-size:18px;">mic_off</span>`;
    }

    wrap.appendChild(muteIcon);
    grid.appendChild(wrap);

    if (hasVideo) {
        wrap.querySelector('video').play().catch(e => console.warn("Local video autoplay blocked"));
    }
}

// ==========================================
// UPDATE REMOTE MUTE UI (GLOBAL SCOPE – Fixed!)
// ==========================================
// ==========================================
// REMOTE SCREEN SHARE UI
// ==========================================
function updateRemoteScreenShareUI(peerUid, frameData, displayName) {
    const wrap = document.getElementById(`video_${peerUid}`);
    if (!wrap) return;

    // Show screen share frame instead of placeholder
    const videoEl = wrap.querySelector('video');
    if (!videoEl) return;

    // Replace video with screen frame image
    const existingImg = wrap.querySelector('.kord-screen-frame');
    if (existingImg) {
        existingImg.src = frameData;
    } else {
        // Hide video, show screen frame
        if (videoEl) videoEl.style.display = 'none';
        const img = document.createElement('img');
        img.className = 'kord-screen-frame';
        img.src = frameData;
        img.style.cssText = 'width:100%; height:100%; object-fit:contain; border-radius:12px;';
        wrap.appendChild(img);

        // Update label
        const labelEl = wrap.querySelector('.kord-screen-share-label');
        if (!labelEl) {
            const label = document.createElement('div');
            label.className = 'kord-screen-share-label';
            label.style.cssText = 'position:absolute; top:10px; left:10px; background:rgba(99,102,241,0.85); color:#fff; padding:4px 10px; border-radius:6px; font-size:12px; z-index:20;';
            label.innerText = `${displayName} - Tela`;
            wrap.appendChild(label);
        }
    }
}

function updateRemoteMuteUI(peerUid, isMuted, isRemoteDeafened) {
    const wrap = document.getElementById(`video_${peerUid}`);
    if (!wrap) return;

    let muteIcon = document.getElementById(`mute_${peerUid}`);
    if (!muteIcon) {
        muteIcon = document.createElement('div');
        muteIcon.id = `mute_${peerUid}`;
        muteIcon.className = 'kord-mute-icon';
        wrap.appendChild(muteIcon);
    }

    if (isRemoteDeafened) {
        muteIcon.style.display = 'flex';
        muteIcon.innerHTML = `<span class="material-icons-round" style="font-size:18px;">headset_off</span>`;
    } else if (isMuted) {
        muteIcon.style.display = 'flex';
        muteIcon.innerHTML = `<span class="material-icons-round" style="font-size:18px;">mic_off</span>`;
    } else {
        muteIcon.style.display = 'none';
    }
}

// ==========================================
// FULLSCREEN TOGGLE
// ==========================================
function toggleKordFullscreen(element) {
    if (!element) return;
    if (document.fullscreenElement) {
        document.exitFullscreen();
        element.style.backgroundColor = '';
        // Restore cursor when exiting fullscreen
        element.style.cursor = '';
        document.body.style.cursor = '';
        document.documentElement.style.cursor = '';
    } else {
        // CRITICAL FIX: Do NOT hide cursor via CSS — it creates a ghost trail
        // of cursor icons because getDisplayMedia captures the real cursor AND
        // the browser renders another one. Instead, let the browser handle it
        // naturally. The screen share video already has the cursor embedded.
        
        if (element.requestFullscreen) {
            element.requestFullscreen().then(() => {
                element.style.backgroundColor = '#0f172a';
            }).catch(err => console.error(err));
        } else if (element.webkitRequestFullscreen) {
            element.webkitRequestFullscreen();
            element.style.backgroundColor = '#0f172a';
        } else if (element.msRequestFullscreen) {
            element.msRequestFullscreen();
            element.style.backgroundColor = '#0f172a';
        }
    }
}

// ==========================================
// ADD REMOTE VIDEO PLACEHOLDERS (GLOBAL SCOPE – Fixed!)
// ==========================================
function addRemoteVideoPlaceholders(peerUid) {
    if (document.getElementById(`video_${peerUid}`)) return;

    const grid = document.getElementById('kord-video-grid');
    if (!grid) return;

    const wrap = document.createElement('div');
    wrap.id = `video_${peerUid}`;
    wrap.className = 'kord-video-tile';

    // Create Avatar Wrapper
    const avatarWrap = document.createElement('div');
    avatarWrap.className = 'avatar-wrap';
    avatarWrap.style.cssText = `width:80px; height:80px; border-radius:50%; background:#475569; display:flex; justify-content:center; align-items:center; color:#fff; font-weight:bold; font-size:32px; transition: box-shadow 0.2s ease-in-out; margin: 0 auto;`;
    wrap.appendChild(avatarWrap);

    const label = document.createElement('span');
    label.className = 'kord-video-label';
    label.innerText = 'Conectando...';

    // Fetch Full Profile Display Data
    firebase.database().ref(`users/${peerUid}`).once('value', snap => {
        if (snap.exists()) {
            const data = snap.val();
            const name = data.displayName || (data.email ? data.email.split('@')[0] : 'Usuário');
            let color = data.themeColor || '#6366f1';
            if (color === 'transparent') color = '#6366f1';
            const reqDeco = data.avatarDecoration || 'none';
            const photoURL = data.photoURL;
            const initial = name.charAt(0).toUpperCase();

            label.innerText = name;
            avatarWrap.style.backgroundColor = color;

            if (photoURL) {
                avatarWrap.innerHTML = `<img src="${photoURL}" style="width:100%; height:100%; object-fit:cover; border-radius:50%;" onerror="this.outerHTML='${initial}'" />`;
            } else {
                avatarWrap.innerHTML = initial;
            }

            if (reqDeco !== 'none') {
                avatarWrap.classList.add(`dec-${reqDeco}`);
            }
        }
    });
    wrap.appendChild(label);
    grid.appendChild(wrap);
}

// ==========================================
// REMOVE REMOTE VIDEO
// ==========================================
function removeRemoteVideo(peerUid) {
    const el = document.getElementById(`video_${peerUid}`);
    if (el) el.remove();

    if (remoteAudioPlayers[peerUid]) {
        delete remoteAudioPlayers[peerUid];
    }
}

// ==========================================
// UPDATE CALL MEMBERS LIST (Sidebar Presence) — Real-time, 1ms latency
// ==========================================
// Cache for member data to avoid Firebase reads on every ping
const _memberCache = {};
let _memberListListenerRef = null;

function updateCallMembersList() {
    if (!roomRef) return;
    const membersContainer = document.getElementById('kord-call-members');

    // If local user is no longer in the call, wipe their UI
    if (!isCallActive) {
        if (membersContainer) {
            membersContainer.innerHTML = '';
            membersContainer.style.display = 'none';
        }
        // Detach the persistent listener
        if (_memberListListenerRef) {
            _memberListListenerRef.off();
            _memberListListenerRef = null;
        }
        return;
    }

    // Use a persistent 'value' listener — fires at ~1ms latency on Firebase
    // This replaces the old once() approach which had network round-trip delay
    if (_memberListListenerRef) {
        _memberListListenerRef.off();
    }
    _memberListListenerRef = roomRef.child('participants');

    // Build member HTML directly from snapshot (no async per-member Firebase reads)
    const buildMembersHtml = (participants) => {
        if (!membersContainer) return;

        const uids = Object.keys(participants || {});
        if (uids.length === 0) {
            membersContainer.innerHTML = '';
            membersContainer.style.display = 'none';
            return;
        }

        // Build HTML string in one pass — avoid per-member DOM queries
        let html = `<div class="kord-call-members-header">
            <span class="material-icons-round" style="font-size:16px; color:#10b981;">call</span>
            <span>Na Call — ${uids.length}</span>
        </div>`;

        uids.forEach(uid => {
            const p = participants[uid];
            if (!p) return;

            // Use presence data FIRST, cache as fallback
            const cached = _memberCache[uid] || {};
            const dName = p.displayName || cached.displayName || 'Usuário';
            const photoURL = p.photoURL || cached.photoURL || null;
            const tColor = p.themeColor || cached.themeColor || '#6366f1';
            const isMe = currentUser && uid === currentUser.uid;

            const initial = dName.charAt(0).toUpperCase();
            const avatarHtml = photoURL
                ? `<img src="${photoURL}" style="width:100%; height:100%; object-fit:cover; border-radius:50%;" />`
                : initial;

            let stateIcon = '';
            if (p.deafened) {
                stateIcon = `<span class="material-icons-round kord-member-state" style="color:#ef4444;">headset_off</span>`;
            } else if (p.muted) {
                stateIcon = `<span class="material-icons-round kord-member-state" style="color:#ef4444;">mic_off</span>`;
            }

            html += `<div class="kord-call-member">
                <div class="kord-call-member-avatar" style="background:${tColor === 'transparent' ? '#6366f1' : tColor};">${avatarHtml}</div>
                <span class="kord-call-member-name">${dName}${isMe ? ' (Você)' : ''}</span>
                ${stateIcon}
            </div>`;
        });

        membersContainer.innerHTML = html;
        membersContainer.style.display = 'block';
    };

    // Listen for real-time participant changes with ~1ms Firebase push latency
    _memberListListenerRef.on('value', snap => {
        const participants = snap.val() || {};
        buildMembersHtml(participants);

        // Background refresh of member cache from Firebase (async, non-blocking)
        Object.keys(participants).forEach(uid => {
            // Always refresh cache with latest data (remove stale guard)
            if (true) {
                firebase.database().ref(`users/${uid}`).once('value').then(uSnap => {
                    if (uSnap.exists()) {
                        const d = uSnap.val();
                        _memberCache[uid] = {
                            displayName: d.displayName || d.email?.split('@')[0] || 'Usuário',
                            photoURL: d.photoURL || null,
                            themeColor: d.themeColor || '#6366f1'
                        };
                    }
                });
            }
        });
    }, err => console.warn('Members listener error:', err));
}

// ==========================================
// TOGGLE MICROPHONE
// ==========================================
function toggleKordMic() {
    if (!localStream || localStream.getAudioTracks().length === 0) return showKordAlert("Equipamento Ausente", "Nenhum microfone foi detectado em seu sistema.", "mic_off", "#ef4444");
    if (isDeafened) return showKordAlert("Aviso", "Ative primeiro o som para poder usar o microfone.", "headset_off", "#f59e0b");

    isAudioEnabled = !isAudioEnabled;
    const btn = document.getElementById('kord-btn-mic');
    localStream.getAudioTracks().forEach(t => t.enabled = isAudioEnabled);

    if (presenceRef) {
        presenceRef.update({ muted: !isAudioEnabled });
    }

    const localMuteIcon = document.getElementById('kord-local-mute-icon');
    if (localMuteIcon) {
        if (!isAudioEnabled) {
            localMuteIcon.style.display = 'flex';
            localMuteIcon.innerHTML = `<span class="material-icons-round" style="font-size:18px;">mic_off</span>`;
        } else {
            localMuteIcon.style.display = 'none';
        }
    }

    if (isAudioEnabled) {
        btn.innerHTML = `<span class="material-icons-round">mic</span>`;
        btn.classList.remove('kord-rtc-btn--active');
    } else {
        btn.innerHTML = `<span class="material-icons-round">mic_off</span>`;
        btn.classList.add('kord-rtc-btn--active');
    }
}

// ==========================================
// TOGGLE DEAFEN
// ==========================================
function toggleKordDeafen() {
    isDeafened = !isDeafened;
    const btn = document.getElementById('kord-btn-deafen');
    const micBtn = document.getElementById('kord-btn-mic');

    if (isDeafened) {
        isAudioEnabled = false;
        if (localStream && localStream.getAudioTracks().length > 0) {
            localStream.getAudioTracks().forEach(t => t.enabled = false);
        }
        if (micBtn) {
            micBtn.innerHTML = `<span class="material-icons-round">mic_off</span>`;
            micBtn.classList.add('kord-rtc-btn--active');
        }
    }

    if (presenceRef) {
        presenceRef.update({ deafened: isDeafened, muted: !isAudioEnabled });
    }

    const localMuteIcon = document.getElementById('kord-local-mute-icon');
    if (localMuteIcon) {
        localMuteIcon.style.display = 'flex';
        if (isDeafened) {
            localMuteIcon.innerHTML = `<span class="material-icons-round" style="font-size:18px;">headset_off</span>`;
        } else if (!isAudioEnabled) {
            localMuteIcon.innerHTML = `<span class="material-icons-round" style="font-size:18px;">mic_off</span>`;
        } else {
            localMuteIcon.style.display = 'none';
        }
    }

    if (isDeafened) {
        btn.innerHTML = `<span class="material-icons-round">headset_off</span>`;
        btn.classList.add('kord-rtc-btn--active');
    } else {
        btn.innerHTML = `<span class="material-icons-round">headphones</span>`;
        btn.classList.remove('kord-rtc-btn--active');
    }
}

// ==========================================
// TOGGLE CAMERA
// ==========================================
function toggleKordCam() {
    if (!localStream || localStream.getVideoTracks().length === 0) return showKordAlert("Equipamento Ausente", "Nenhuma webcam foi detectada no dispositivo.", "videocam_off", "#ef4444");
    isVideoEnabled = !isVideoEnabled;
    const btn = document.getElementById('kord-btn-cam');
    localStream.getVideoTracks().forEach(t => t.enabled = isVideoEnabled);

    if (isVideoEnabled) {
        btn.innerHTML = '<span class="material-icons-round">videocam</span>';
        btn.classList.remove('kord-rtc-btn--active');
    } else {
        btn.innerHTML = '<span class="material-icons-round">videocam_off</span>';
        btn.classList.add('kord-rtc-btn--active');
    }
}

// ==========================================
// TOGGLE SCREEN SHARE
// ==========================================
let isScreenSharing = false;
let originalVideoTrack = null;

let _screenShareInterval = null;
let _screenShareCanvas = null;

async function toggleKordScreenShare() {
    const btn = document.getElementById('kord-btn-screen');
    if (!isCallActive) return;

    if (isScreenSharing) {
        // Stop screen share interval
        if (_screenShareInterval) {
            clearInterval(_screenShareInterval);
            _screenShareInterval = null;
        }
        if (_screenShareCanvas) {
            _screenShareCanvas = null;
        }

        // Stop screen track and revert to camera
        const screenTrack = localStream.getVideoTracks()[0];
        if (screenTrack) {
            screenTrack.stop();
            localStream.removeTrack(screenTrack);
        }
        if (originalVideoTrack) {
            localStream.addTrack(originalVideoTrack);
            originalVideoTrack.enabled = isVideoEnabled;
        }

        // Clear screen share from presence
        if (presenceRef) {
            presenceRef.child('screenShare').remove();
        }

        addLocalVideo(localStream);
        isScreenSharing = false;

        if (btn) {
            btn.innerHTML = '<span class="material-icons-round">present_to_all</span>';
            btn.classList.remove('kord-rtc-btn--active');
        }
        return;
    }

    try {
        const displayStream = await navigator.mediaDevices.getDisplayMedia({ video: true, audio: false });
        const screenTrack = displayStream.getVideoTracks()[0];

        if (localStream && localStream.getVideoTracks().length > 0) {
            originalVideoTrack = localStream.getVideoTracks()[0];
            localStream.removeTrack(originalVideoTrack);
        }
        localStream.addTrack(screenTrack);
        addLocalVideo(localStream);

        isScreenSharing = true;

        // === CRITICAL FIX: Broadcast screen via Firebase screenshots ===
        // Other users can't see the stream, so we capture and push frames
        if (presenceRef) {
            presenceRef.child('screenShare').set(true);
            presenceRef.child('screenShare').onDisconnect().remove();
        }

        // Capture screen every 2 seconds and push to Firebase RTDB
        const videoEl = document.querySelector('#kord-local-video video');
        _screenShareCanvas = document.createElement('canvas');
        const ctx = _screenShareCanvas.getContext('2d');

        // Capture screen every 1.5 seconds for lower latency
        _screenShareInterval = setInterval(() => {
            if (!isScreenSharing || !videoEl) return;
            try {
                _screenShareCanvas.width = Math.min(videoEl.videoWidth || 1280, 640);
                _screenShareCanvas.height = Math.min(videoEl.videoHeight || 720, 360);
                ctx.drawImage(videoEl, 0, 0, _screenShareCanvas.width, _screenShareCanvas.height);
                const frameData = _screenShareCanvas.toDataURL('image/jpeg', 0.25);
                if (presenceRef) {
                    presenceRef.child('screenFrame').set(frameData);
                    presenceRef.child('screenFrameTime').set(firebase.database.ServerValue.TIMESTAMP);
                }
            } catch (e) { /* ignore canvas errors */ }
        }, 1500);

        screenTrack.onended = () => {
            if (isScreenSharing) toggleKordScreenShare();
        };

        if (btn) {
            btn.innerHTML = '<span class="material-icons-round" style="color:#ef4444;">cancel_presentation</span>';
            btn.classList.add('kord-rtc-btn--active');
        }

    } catch (err) {
        console.warn('Screen share cancelled or failed:', err);
        showKordAlert('Falha na Captura', 'Não foi possível compartilhar a sua tela.', 'cancel_presentation', '#ef4444');
    }
}

// ==========================================
// AI REAL-TIME SPEECH TRANSLATOR [BETA]
// Universal: Uses native SpeechRecognition if
// available, otherwise falls back to Groq Whisper
// ==========================================
let whisperTranscribeRecorder = null;
let _aiTranslatorHadSpeech = false; // VAD flag
let _whisperInterval = null;

function toggleAITranslator() {
    isAITranslatorActive = !isAITranslatorActive;
    const btn = document.getElementById('kord-btn-ai-translate');
    const label = document.getElementById('kord-ai-translate-label');
    const subtitleBox = document.getElementById('kord-ai-subtitles');
    const subtitleText = document.getElementById('kord-subtitle-text');

    if (isAITranslatorActive) {
        const apiKey = localStorage.getItem('groqApiKey');
        if (!apiKey) {
            isAITranslatorActive = false;
            return showKordAlert("Recurso Inativo", "Configure sua chave Groq nas configurações para ativar a Tradução Simultânea.", "vpn_key", "#f59e0b");
        }

        if (btn) {
            btn.style.background = 'rgba(139,92,246,0.3)';
            btn.style.color = '#fff';
        }
        if (label) label.innerText = 'IA Ativa (Ouvindo)';
        if (subtitleBox) subtitleBox.style.display = 'block';
        if (subtitleText) subtitleText.innerText = 'Aguardando sua voz...';

        // Use native SpeechRecognition if available, otherwise Whisper API
        const SpeechRec = window.SpeechRecognition || window.webkitSpeechRecognition;
        if (SpeechRec) {
            startAIObservationStream();
        } else {
            startWhisperObservationStream();
        }

        // Start transcribing remote audio too
        startRemoteAudioTranscription();
    } else {
        if (btn) {
            btn.style.background = 'rgba(139,92,246,0.1)';
            btn.style.color = '#a78bfa';
        }
        if (label) label.innerText = 'IA Tradutor';
        if (subtitleBox) subtitleBox.style.display = 'none';

        if (speechRecognition) {
            speechRecognition.stop();
            speechRecognition = null;
        }
        if (whisperTranscribeRecorder) {
            whisperTranscribeRecorder.stop();
            whisperTranscribeRecorder = null;
        }
        if (_whisperInterval) {
            clearInterval(_whisperInterval);
            _whisperInterval = null;
        }
        stopRemoteAudioTranscription();
        if (currentAIUtterance) {
            window.speechSynthesis.cancel();
            currentAIUtterance = null;
        }
    }
}

// ==========================================
// Native SpeechRecognition (Chrome/Edge)
// ==========================================
function startAIObservationStream() {
    const SpeechRec = window.SpeechRecognition || window.webkitSpeechRecognition;
    speechRecognition = new SpeechRec();

    const browserLang = navigator.language || navigator.userLanguage || "pt-BR";
    speechRecognition.lang = browserLang;
    speechRecognition.interimResults = false;
    speechRecognition.continuous = true;

    speechRecognition.onresult = async (event) => {
        const last = event.results.length - 1;
        const transcript = event.results[last][0].transcript.trim();
        const confidence = event.results[last][0].confidence || 0;
        if (transcript.length > 3 && _aiTranslatorHadSpeech && confidence > 0.6 && !isWhisperHallucination(transcript)) {
            await handleLocalTranscript(transcript);
        }
    };

    speechRecognition.onerror = (e) => {
        console.warn("SpeechRec Error:", e.error);
        if (e.error === 'network') {
            speechRecognition.stop();
        }
    };

    speechRecognition.onend = () => {
        if (isAITranslatorActive) {
            speechRecognition.start();
        }
    };

    speechRecognition.start();
}

// ==========================================
// Whisper-Based Fallback (Firefox/Safari/All)
// Records audio chunks and sends to Groq Whisper
// ==========================================
function startWhisperObservationStream() {
    if (!localStream || localStream.getAudioTracks().length === 0) {
        return showKordAlert("Microfone Desativado", "A tradução automática necessita do uso do microfone ativado.", "mic_off", "#f59e0b");
    }

    const mimeType = MediaRecorder.isTypeSupported('audio/webm;codecs=opus') ? 'audio/webm;codecs=opus'
        : MediaRecorder.isTypeSupported('audio/webm') ? 'audio/webm'
            : MediaRecorder.isTypeSupported('audio/ogg;codecs=opus') ? 'audio/ogg;codecs=opus'
                : 'audio/mp4';

    whisperTranscribeRecorder = new MediaRecorder(localStream, { mimeType });
    let audioChunks = [];

    whisperTranscribeRecorder.ondataavailable = (e) => {
        if (e.data.size > 0) {
            audioChunks.push(e.data);
        }
    };

    whisperTranscribeRecorder.onstop = async () => {
        if (audioChunks.length === 0 || !isAITranslatorActive) return;

        const blob = new Blob(audioChunks, { type: mimeType });
        audioChunks = [];

        // Restart recording immediately for next chunk
        if (isAITranslatorActive && whisperTranscribeRecorder) {
            try { whisperTranscribeRecorder.start(4000); } catch (e) { }
        }

        // Skip small audio (likely silence) - 15KB minimum (stricter)
        if (blob.size < 15000) return;

        // Only process if VAD detected speech
        if (!_aiTranslatorHadSpeech) return;

        // Send to Groq Whisper for transcription
        const transcript = await whisperTranscribe(blob);
        if (transcript && transcript.length > 2 && !isWhisperHallucination(transcript)) {
            await handleLocalTranscript(transcript);
        }
    };

    // Record 4-second chunks
    whisperTranscribeRecorder.start(4000);

    // When a chunk interval fires, stop recorder to process audio
    _whisperInterval = setInterval(() => {
        if (!isAITranslatorActive) {
            clearInterval(_whisperInterval);
            _whisperInterval = null;
            return;
        }
        if (whisperTranscribeRecorder && whisperTranscribeRecorder.state === 'recording') {
            whisperTranscribeRecorder.stop();
        }
    }, 4000);
}

// Whisper often hallucinates these on silence
const _whisperSoundEffects = {
    '[laughter]': '😂 *risos*',
    '[laughing]': '😂 *risos*',
    '[laughter.]': '😂 *risos*',
    '[music]': '🎵 *música*',
    '[music playing]': '🎵 *música*',
    '[applause]': '👏 *aplausos*',
    '[clapping]': '👏 *aplausos*',
    '[silence]': null,
    '[inaudible]': null,
    '[noise]': null,
    '[background noise]': null,
    '[coughing]': '🤧 *tosse*',
    '[sighing]': '😮‍💨 *suspiro*',
    '[sigh]': '😮‍💨 *suspiro*',
    '[crying]': '😢 *choro*',
    '[gasping]': '😨 *espanto*',
    '[singing]': '🎤 *cantando*',
    '[humming]': '🎶 *cantarolando*',
    '[whistle]': '😗 *assobio*',
    '[snoring]': '😴 *ronco*',
};

function isWhisperHallucination(text) {
    const t = text.toLowerCase().trim();
    if (t.length < 3) return true; // Ignore stray characters
    const hallucinations = [
        'thank you', 'thanks', 'bye', 'goodbye', 'obrigado', 'obrigada',
        'tchau', 'you', 'the end', 'subtitle', 'subtitles', 'legendas',
        'subscribe', 'inscreva', 'like', 'share',
        '...', '…', '.', 'thank you for watching', 'thanks for watching',
        'you\'re welcome', 'de nada', 'ok', 'okay',
        'silence', 'silêncio', 'audio', 'som', 'to', 'um', 'ah', 'uh'
    ];
    return hallucinations.some(h => t === h || t === h + '.' || t.startsWith(h + ' ') && t.length < h.length + 5);
}

function detectSoundEffect(text) {
    const t = text.toLowerCase().trim();
    // Check for bracketed sound effects like [laughter], [music], etc.
    for (const [pattern, emoji] of Object.entries(_whisperSoundEffects)) {
        if (t === pattern || t.includes(pattern)) {
            return emoji; // null means silence/skip, string means show it
        }
    }
    // Also detect unbracketed laughter indicators
    if (/^(ha){2,}/i.test(t) || /^(he){2,}/i.test(t) || /^(rs){2,}/i.test(t) || /^(kk)+/i.test(t)) {
        return '😂 *risos*';
    }
    return false; // Not a sound effect
}

async function whisperTranscribe(audioBlob) {
    const apiKey = localStorage.getItem('groqApiKey');
    if (!apiKey) return null;

    try {
        // Determine file extension from blob type
        const ext = audioBlob.type.includes('webm') ? 'webm' : audioBlob.type.includes('ogg') ? 'ogg' : 'mp4';
        const file = new File([audioBlob], `audio.${ext}`, { type: audioBlob.type });

        const formData = new FormData();
        formData.append('file', file);
        formData.append('model', 'whisper-large-v3-turbo');
        formData.append('response_format', 'json');

        const response = await fetch('https://api.groq.com/openai/v1/audio/transcriptions', {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${apiKey}`
            },
            body: formData
        });

        if (!response.ok) return null;
        const data = await response.json();
        return data.text ? data.text.trim() : null;
    } catch (e) {
        console.warn("Whisper transcription error:", e);
        return null;
    }
}

// ==========================================
// Shared handler for local transcripts
// ==========================================
async function handleLocalTranscript(transcript) {
    // Check for sound effects first
    const soundEffect = detectSoundEffect(transcript);
    if (soundEffect !== false) {
        if (soundEffect !== null) {
            const subtitleText = document.getElementById('kord-subtitle-text');
            if (subtitleText) subtitleText.innerHTML = `<span style="color:#94a3b8;">Você:</span> <span style="font-size:1.2em;">${soundEffect}</span>`;
            const subBox = document.getElementById('kord-ai-subtitles');
            if (subBox) { subBox.style.display = 'block'; subBox.style.animation = 'none'; subBox.offsetHeight; subBox.style.animation = 'fadeSubtitles 4s ease forwards'; }
        }
        return; // Don't translate sound effects
    }

    const subtitleText = document.getElementById('kord-subtitle-text');
    if (subtitleText) subtitleText.innerHTML = `<span style="color:#94a3b8;">🎙️ Você:</span> <span style="color:#e2e8f0;">"${transcript}"</span>`;

    if (presenceRef) {
        presenceRef.update({
            lastTranscript: transcript,
            transcriptTime: Date.now()
        });
    }

    // Translate and speak locally
    const langTarget = document.getElementById('kordTranslateTarget')?.value || 'en';
    const translatedText = await processGroqTranslation(transcript, "Auto", langTarget);

    // Check if the translation is basically just the original text (same language)
    const isSameText = translatedText && (
        translatedText.toLowerCase().replace(/[^a-z0-9]/g, '') === transcript.toLowerCase().replace(/[^a-z0-9]/g, '')
    );

    if (translatedText && !isSameText) {
        // Show both original + translation
        if (subtitleText) {
            subtitleText.innerHTML = `<span style="color:#94a3b8;">🎙️ Você:</span> <span style="color:#64748b; font-size:0.85em;">"${transcript}"</span><br><span style="color:#a78bfa;">🌐 Tradução:</span> <span style="color:#f8fafc; font-weight:600;">"${translatedText}"</span>`;
        }
        const subBox = document.getElementById('kord-ai-subtitles');
        if (subBox) {
            subBox.style.display = 'block';
            subBox.style.animation = 'none';
            subBox.offsetHeight;
            subBox.style.animation = 'fadeSubtitles 8s ease forwards';
        }
        kordSpeakText(translatedText, langTarget);
    } else {
        finalizeSubtitle(transcript);
    }
}


function finalizeSubtitle(text, author = 'Você') {
    const subtitleText = document.getElementById('kord-subtitle-text');
    if (subtitleText) subtitleText.innerText = `${author}: "${text}"`;
    const subBox = document.getElementById('kord-ai-subtitles');
    if (subBox) {
        subBox.style.display = 'block';
        subBox.style.animation = 'none';
        subBox.offsetHeight;
        subBox.style.animation = 'fadeSubtitles 6s ease forwards';
    }
}

let lastProcessedTranscripts = {};

async function handleRemoteTranscription(peerUid, text, time) {
    if (lastProcessedTranscripts[peerUid] === time) return;
    lastProcessedTranscripts[peerUid] = time;

    const langTarget = document.getElementById('kordTranslateTarget')?.value || 'pt-BR';

    let author = 'Participante';
    const nameEl = document.querySelector(`#video_${peerUid} .kord-video-label`);
    if (nameEl) author = nameEl.innerText;

    const translatedText = await processGroqTranslation(text, "Auto", langTarget);

    const isSameText = translatedText && (
        translatedText.toLowerCase().replace(/[^a-z0-9]/g, '') === text.toLowerCase().replace(/[^a-z0-9]/g, '')
    );

    if (translatedText && !isSameText) {
        finalizeSubtitle(translatedText, author);
        kordSpeakText(translatedText, langTarget);
    } else {
        finalizeSubtitle(text, author);
    }
}

async function processGroqTranslation(text, src, target) {
    let apiKey = localStorage.getItem('groqApiKey');
    if (!apiKey) return null;

    try {
        const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
            method: 'POST',
            headers: { 'Authorization': `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
            body: JSON.stringify({
                model: "llama-3.3-70b-versatile",
                messages: [
                    {
                        "role": "system",
                        "content": `You are a professional real-time translator. Detect the source language. If the source language is already ${target} or extremely similar to it, output ONLY the exact original text. Otherwise, translate to ${target} and output ONLY the translated text. DO NOT add explanations, notes, or quotes. Just the raw text.`
                    },
                    { "role": "user", "content": text }
                ],
                temperature: 0,
                max_tokens: 150
            })
        });

        if (response.status === 429) {
            if (typeof removeInvalidKey === 'function') removeInvalidKey(apiKey);
            return null;
        }

        if (!response.ok) return null;
        const data = await response.json();
        return data.choices[0].message.content.trim();
    } catch (e) {
        return null;
    }
}

// Garbage Collector: Removes audio chunks older than 10 seconds to prevent DB bloat
function runAudioGarbageCollector() {
    if (!roomRef || !isCallActive) return;
    const now = Date.now();
    const MAX_AGE = 10000; // 10s

    roomRef.child('audio_chunks').once('value', snap => {
        const audioData = snap.val();
        if (!audioData) return;

        Object.keys(audioData).forEach(uid => {
            const userChunks = audioData[uid];
            Object.keys(userChunks).forEach(chunkId => {
                const chunk = userChunks[chunkId];
                if (chunk.timestamp && (now - chunk.timestamp) > MAX_AGE) {
                    roomRef.child(`audio_chunks/${uid}/${chunkId}`).remove();
                }
            });
        });
    });
}

// Run collector every 5 seconds while in a call
setInterval(runAudioGarbageCollector, 5000);

function speakTranslation(text, targetLang) {
    kordSpeakText(text, targetLang);
}

// Robust TTS with voice matching
let _kordVoicesLoaded = false;
let _kordVoices = [];

function _loadKordVoices() {
    _kordVoices = window.speechSynthesis.getVoices();
    _kordVoicesLoaded = _kordVoices.length > 0;
}
_loadKordVoices();
if (window.speechSynthesis.onvoiceschanged !== undefined) {
    window.speechSynthesis.onvoiceschanged = _loadKordVoices;
}

function _findBestVoice(langCode) {
    if (!_kordVoicesLoaded) _loadKordVoices();
    if (_kordVoices.length === 0) return null;

    // Exact match
    let v = _kordVoices.find(v => v.lang.toLowerCase() === langCode.toLowerCase());
    if (v) return v;

    // Partial match (e.g. 'pt' matches 'pt-BR')
    const prefix = langCode.split('-')[0].toLowerCase();
    v = _kordVoices.find(v => v.lang.toLowerCase().startsWith(prefix));
    if (v) return v;

    // Any voice with same lang prefix
    v = _kordVoices.find(v => v.lang.toLowerCase().split('-')[0] === prefix);
    return v || null;
}

function kordSpeakText(text, langCode) {
    if (!text) return;
    window.speechSynthesis.cancel();

    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = langCode || 'en';
    utterance.rate = 0.95;
    utterance.volume = 1.0;
    utterance.pitch = 1.0;

    const voice = _findBestVoice(langCode || 'en');
    if (voice) utterance.voice = voice;

    currentAIUtterance = utterance;
    window.speechSynthesis.speak(utterance);
}

window.speechSynthesis.onvoiceschanged = () => { window.speechSynthesis.getVoices(); };

// ==========================================
// VOICE CHANNEL PREVIEW (LOBBY)
// ==========================================
let activePreviewRef = null;

function previewKordVoiceChannel(serverId, channelId, channelData) {
    const chatBody = document.getElementById('kord-chat-window');
    if (!chatBody) return;

    if (typeof isCallActive !== 'undefined' && isCallActive && currentKordCallChannel === channelId) {
        // Restore Active Call UI
        const mainArea = document.getElementById('kord-main-area');
        const videoGrid = document.getElementById('kord-video-grid');
        const rtcControls = document.getElementById('kord-webrtc-controls');

        if (chatBody) chatBody.style.display = 'none';
        if (mainArea) mainArea.style.background = '#000000';
        if (videoGrid) videoGrid.style.display = 'flex';
        if (rtcControls) rtcControls.style.display = 'flex';
        return;
    }

    chatBody.innerHTML = `
        <div class="kord-voice-preview">
            <span class="material-icons-round kord-voice-preview-icon">volume_up</span>
            <h2>${channelData.name}</h2>
            <p style="color:#94a3b8; margin:0 0 30px 0;">Pré-visualização da Sala de Voz</p>
            <div id="kord-voice-preview-grid" class="kord-voice-preview-grid">
                <div style="color:#64748b; width:100%;">Conectando ao lobby...</div>
            </div>
            <p style="color:#64748b; font-size:0.85rem; margin-top:40px;">
                Você não está conectado. Ninguém pode te ouvir.<br>Clique em "Entrar na Call" para participar.
            </p>
        </div>
    `;

    if (activePreviewRef) {
        activePreviewRef.off();
    }

    const roomId = `${serverId}_${channelId}`;
    activePreviewRef = firebase.database().ref(`webrtc_rooms/${roomId}/participants`);

    activePreviewRef.on('value', async (snap) => {
        const grid = document.getElementById('kord-voice-preview-grid');
        if (!grid) {
            activePreviewRef.off();
            return;
        }

        if (!snap.exists()) {
            grid.innerHTML = `<div class="kord-voice-empty">A sala está vazia. Seja o primeiro a entrar!</div>`;
            return;
        }

        const participants = snap.val();
        grid.innerHTML = '';
        const now = Date.now();
        const STALE_THRESHOLD = 30000; // 30 seconds

        for (const uid in participants) {
            const data = participants[uid];

            // Filter out stale/ghost entries
            // No lastSeen = legacy ghost entry, or lastSeen > 30s = stale
            const isStale = !data.lastSeen || (now - data.lastSeen) > STALE_THRESHOLD;
            if (isStale) {
                // Auto-clean ghost from Firebase
                firebase.database().ref(`webrtc_rooms/${serverId}_${channelId}/participants/${uid}`).remove();
                continue;
            }

            const userSnap = await firebase.database().ref(`users/${uid}`).once('value');
            if (userSnap.exists()) {
                const uData = userSnap.val();
                const dName = uData.displayName || (uData.email ? uData.email.split('@')[0] : 'Usuário');
                const photoURL = uData.photoURL;
                let tColor = uData.themeColor || '#6366f1';
                if (tColor === 'transparent') tColor = '#6366f1';
                const initial = dName.charAt(0).toUpperCase();

                const avatarHtml = photoURL
                    ? `<img src="${photoURL}" style="width:100%; height:100%; object-fit:cover; border-radius:50%;" onerror="this.outerHTML='${initial}'" />`
                    : initial;

                let stateIconHtml = '';
                if (data.deafened) {
                    stateIconHtml = `<div class="kord-preview-state kord-preview-state--muted"><span class="material-icons-round" style="font-size:14px; color:white;">headset_off</span></div>`;
                } else if (data.muted !== false) {
                    stateIconHtml = `<div class="kord-preview-state kord-preview-state--muted"><span class="material-icons-round" style="font-size:14px; color:white;">mic_off</span></div>`;
                } else {
                    stateIconHtml = `<div class="kord-preview-state kord-preview-state--active"><span class="material-icons-round" style="font-size:14px; color:white;">mic</span></div>`;
                }

                const cardHtml = `
                    <div class="kord-preview-member">
                        <div class="kord-preview-member-avatar-wrap">
                            <div class="kord-preview-member-avatar" style="background:${tColor};">${avatarHtml}</div>
                            ${stateIconHtml}
                        </div>
                        <span class="kord-preview-member-name">${dName}</span>
                    </div>
                `;
                grid.insertAdjacentHTML('beforeend', cardHtml);
            }
        }
    });
}
