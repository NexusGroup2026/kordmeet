/**
 * ============================================================
 * KORD CONNECT v6.0 - P2P Enhancement for existing Kord Call
 * Works WITH kord_webrtc.js, adds WebRTC P2P video
 * Member display handled by updateCallMembersList() in kord_webrtc.js
 * ============================================================
 */

(function() {
    'use strict';

    const CONFIG = {
        iceServers: [
            { urls: 'stun:stun.l.google.com:19302' },
            { urls: 'stun:stun1.l.google.com:19302' }
        ]
    };

    // ============================================================
    // CRYPTO
    // ============================================================
    class Crypto {
        static generateKey() {
            const arr = new Uint8Array(32);
            crypto.getRandomValues(arr);
            return Array.from(arr).map(b => b.toString(16).padStart(2, '0')).join('');
        }
    }

    // ============================================================
    // PEER CONNECTION
    // ============================================================
    class KordPeer {
        constructor(peerId, localStream) {
            this.peerId = peerId;
            this.localStream = localStream;
            this.pc = new RTCPeerConnection({ iceServers: CONFIG.iceServers });
            this.dataChannel = null;
            this.remoteStream = null;
            this.onStream = null;
            this.onSignal = null;
            this.setup();
        }

        setup() {
            if (this.localStream) {
                this.localStream.getTracks().forEach(track => {
                    this.pc.addTrack(track, this.localStream);
                });
            }

            this.pc.ontrack = (event) => {
                this.remoteStream = event.streams[0];
                if (this.onStream) this.onStream(this.remoteStream);
            };

            this.pc.onicecandidate = (event) => {
                if (event.candidate && this.onSignal) {
                    this.onSignal({ type: 'ice', candidate: event.candidate });
                }
            };

            this.dataChannel = this.pc.createDataChannel('kordData', { ordered: true });
            this.dataChannel.onopen = () => console.log('P2P channel open');
            this.dataChannel.onmessage = (e) => this.onMessage?.(JSON.parse(e.data));
            
            this.pc.ondatachannel = (e) => {
                this.dataChannel = e.channel;
                this.dataChannel.onmessage = (ev) => this.onMessage?.(JSON.parse(ev.data));
            };
        }

        async createOffer() {
            const offer = await this.pc.createOffer();
            await this.pc.setLocalDescription(offer);
            return { sdp: offer.sdp };
        }

        async createAnswer(offer) {
            await this.pc.setRemoteDescription(new RTCSessionDescription(offer));
            const answer = await this.pc.createAnswer();
            await this.pc.setLocalDescription(answer);
            return { sdp: answer.sdp };
        }

        async handleAnswer(answer) {
            await this.pc.setRemoteDescription(new RTCSessionDescription(answer));
        }

        async addIce(candidate) {
            await this.pc.addIceCandidate(new RTCIceCandidate(candidate));
        }

        send(data) {
            if (this.dataChannel?.readyState === 'open') {
                this.dataChannel.send(JSON.stringify(data));
            }
        }

        close() {
            this.dataChannel?.close();
            this.pc.close();
        }
    }

    // ============================================================
    // SIGNALING (Firebase-based, room-based)
    // ============================================================
    class KordSignaling {
        constructor(roomId, userId) {
            this.roomId = roomId;
            this.userId = userId;
            this.ref = firebase.database().ref('kord_p2p/' + roomId);
            this.handlers = [];
        }

        send(signal) {
            const ref = this.ref.child('signals').push();
            ref.set({
                from: this.userId,
                type: signal.type,
                data: signal.sdp || signal.candidate,
                timestamp: Date.now()
            });
            setTimeout(() => ref.remove(), 15000);
        }

        listen(callback) {
            const handler = this.ref.child('signals')
                .orderByChild('timestamp')
                .startAt(Date.now() - 60000)
                .on('child_added', (snap) => {
                    const sig = snap.val();
                    if (sig.from !== this.userId) callback(sig);
                });
            this.handlers.push(handler);
        }

        stop() {
            this.handlers.forEach(h => this.ref.child('signals').off('child_added', h));
        }
    }

    // ============================================================
    // CALL MANAGER
    // ============================================================
    class KordConnect {
        constructor() {
            this.roomId = null;
            this.userId = null;
            this.userName = null;
            this.localStream = null;
            this.peer = null;
            this.signaling = null;
            this.isInCall = false;
            this.isInitiator = false;
            
            // Callbacks
            this.onRemoteStream = null;
            this.onMemberUpdate = null;
        }

        async init() {
            const user = firebase.auth()?.currentUser;
            if (user) {
                this.userId = user.uid;
                this.userName = user.displayName || user.email?.split('@')[0] || 'Usuário';
            } else {
                this.userId = 'guest_' + Date.now();
                this.userName = 'Usuário';
            }
        }

        async createRoom() {
            await this.init();
            this.roomId = 'kp2p_' + Math.random().toString(36).slice(2, 8);
            this.isInitiator = true;
            await firebase.database().ref('p2p_rooms/' + this.roomId).set({
                created: Date.now(),
                by: this.userId,
                name: this.userName
            });
            return this.roomId;
        }

        async joinRoom(roomId) {
            await this.init();
            this.roomId = roomId;
            this.isInitiator = false;
            const snap = await firebase.database().ref('p2p_rooms/' + roomId).once('value');
            if (!snap.exists()) throw new Error('Sala não existe');
            return { roomId };
        }

        async startCall() {
            if (this.isInCall) return;
            this.isInCall = true;

            try {
                this.localStream = await navigator.mediaDevices.getUserMedia({
                    video: { width: { ideal: 1280 }, height: { ideal: 720 }, facingMode: 'user' },
                    audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true }
                });
            } catch (e) {
                console.error('Media error:', e);
            }

            this.signaling = new KordSignaling(this.roomId, this.userId);
            this.peer = new KordPeer(this.userId, this.localStream);
            
            this.peer.onSignal = (s) => this.signaling.send(s);
            this.peer.onStream = (stream) => {
                this.remoteStream = stream;
                if (this.onRemoteStream) this.onRemoteStream(stream);
            };
            this.peer.onMessage = (data) => {
                if (data.type === 'member_update' && this.onMemberUpdate) {
                    this.onMemberUpdate(data);
                }
            };

            this.signaling.listen(async (sig) => {
                if (sig.type === 'offer') {
                    const ans = await this.peer.createAnswer(sig.data);
                    this.signaling.send({ type: 'answer', sdp: ans.sdp });
                } else if (sig.type === 'answer') {
                    await this.peer.handleAnswer(sig.data);
                } else if (sig.type === 'ice') {
                    await this.peer.addIce(sig.data);
                }
            });

            if (this.isInitiator) {
                const offer = await this.peer.createOffer();
                this.signaling.send({ type: 'offer', sdp: offer.sdp });
            }

            return true;
        }

        // Broadcast status update to peer
        broadcastStatus(status) {
            this.peer?.send({ type: 'member_update', ...status });
        }

        // Get local stream for video
        getLocalStream() {
            return this.localStream;
        }

        async endCall() {
            this.peer?.close();
            this.signaling?.stop();
            this.localStream?.getTracks().forEach(t => t.stop());
            this.isInCall = false;
        }
    }

    // ============================================================
    // TRANSLATOR (Google Translate - free)
    // ============================================================
    class KordTranslator {
        static async translate(text, from = 'auto', to = 'pt') {
            try {
                const url = `https://translate.googleapis.com/translate_a/single?client=gtx&sl=${from}&tl=${to}&dt=t&q=${encodeURIComponent(text)}`;
                const res = await fetch(url);
                const data = await res.json();
                if (data?.[0]) return data[0].map(s => s[0]).join('');
                return text;
            } catch { return text; }
        }

        static async detect(text) {
            try {
                const url = `https://translate.googleapis.com/translate_a/single?client=gtx&sl=auto&tl=en&dt=t&q=${encodeURIComponent(text.slice(0, 100))}`;
                const res = await fetch(url);
                const data = await res.json();
                return data[2] || 'en';
            } catch { return 'en'; }
        }
    }

    // ============================================================
    // EXPORT
    // ============================================================
    window.KordConnect = KordConnect;
    window.KordTranslator = KordTranslator;

    // Auto-join from URL
    document.addEventListener('DOMContentLoaded', () => {
        const params = new URLSearchParams(location.search);
        const callRoom = params.get('call');
        if (callRoom) {
            setTimeout(async () => {
                try {
                    const conn = new KordConnect();
                    await conn.joinRoom(callRoom);
                    await conn.startCall();
                } catch (e) {
                    console.error('P2P join error:', e);
                }
            }, 3000);
        }
    });
})();