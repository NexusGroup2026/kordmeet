<?php
/**
 * Kord Gateway WebSocket Server
 * Handles: P2P signaling, WebRTC ICE, call management, presence
 * 
 * Run: php server.php
 * Requires: Ratchet (composer require cboden/ratchet)
 */

require_once __DIR__ . '/../config.php';

use Ratchet\MessageComponentInterface;
use Ratchet\ConnectionInterface;
use Ratchet\Server\IoServer;
use Ratchet\Http\HttpServer;
use Ratchet\WebSocket\WsServer;

class KordGateway implements MessageComponentInterface {
    protected $clients;
    protected $rooms = [];        // roomId => [connId => conn]
    protected $users = [];        // uid => connId
    protected $presence = [];     // uid => ['status' => 'online', 'lastSeen' => timestamp]

    public function __construct() {
        $this->clients = new \SplObjectStorage;
        echo "[KordGateway] Started on 0.0.0.0:8080\n";
    }

    public function onOpen(ConnectionInterface $conn) {
        $this->clients->attach($conn);
        $conn->kordRoom = null;
        $conn->kordUid = null;
        $conn->kordSessionId = uniqid('sess_');
        echo "[OPEN] {$conn->kordSessionId}\n";
    }

    public function onMessage(ConnectionInterface $from, $msg) {
        $data = json_decode($msg, true);
        if (!$data) return;

        $type = $data['type'] ?? 'unknown';
        $roomId = $data['roomId'] ?? null;

        switch ($type) {
            case 'join':
                // Client joins a room (P2P call room)
                $this->handleJoin($from, $data);
                break;

            case 'leave':
                $this->handleLeave($from, $data);
                break;

            case 'offer':
            case 'answer':
            case 'ice':
                // WebRTC signaling — forward to specific peer(s) in room
                $this->handleSignaling($from, $data, $type);
                break;

            case 'call_invite':
                // Direct call invite
                $this->handleCallInvite($from, $data);
                break;

            case 'call_accept':
            case 'call_reject':
            case 'call_end':
                $this->handleCallControl($from, $data);
                break;

            case 'presence':
                $this->handlePresence($from, $data);
                break;

            case 'typing':
                $this->handleTyping($from, $data);
                break;

            case 'ping':
                $from->send(json_encode(['type' => 'pong', 'ts' => time()]));
                break;

            default:
                // Broadcast to room
                if ($roomId && isset($this->rooms[$roomId])) {
                    foreach ($this->rooms[$roomId] as $conn) {
                        if ($conn !== $from) {
                            $conn->send($msg);
                        }
                    }
                }
        }
    }

    protected function handleJoin($conn, $data) {
        $roomId = $data['roomId'] ?? null;
        $uid = $data['uid'] ?? 'guest_' . substr($conn->kordSessionId, 5);

        if (!$roomId) return;

        // Leave previous room
        if ($conn->kordRoom) {
            unset($this->rooms[$conn->kordRoom][$conn->kordSessionId]);
            if (empty($this->rooms[$conn->kordRoom])) {
                unset($this->rooms[$conn->kordRoom]);
            }
        }

        // Join new room
        $conn->kordRoom = $roomId;
        $conn->kordUid = $uid;
        $this->users[$uid] = $conn->kordSessionId;

        if (!isset($this->rooms[$roomId])) {
            $this->rooms[$roomId] = [];
        }
        $this->rooms[$roomId][$conn->kordSessionId] = $conn;

        // Update presence
        $this->presence[$uid] = ['status' => 'online', 'lastSeen' => time()];

        // Send join ack
        $conn->send(json_encode([
            'type' => 'joined',
            'roomId' => $roomId,
            'uid' => $uid,
            'sessionId' => $conn->kordSessionId,
            'participants' => array_values(array_map(fn($c) => $c->kordUid, $this->rooms[$roomId]))
        ]));

        // Notify others
        $this->broadcastToRoom($roomId, [
            'type' => 'user_joined',
            'uid' => $uid,
            'participants' => array_values(array_map(fn($c) => $c->kordUid, $this->rooms[$roomId]))
        ], $conn);

        echo "[JOIN] uid=$uid room=$roomId\n";
    }

    protected function handleLeave($conn, $data) {
        if ($conn->kordRoom) {
            $roomId = $conn->kordRoom;
            $uid = $conn->kordUid;

            unset($this->rooms[$roomId][$conn->kordSessionId]);
            if (empty($this->rooms[$roomId])) {
                unset($this->rooms[$roomId]);
            }

            // Notify others
            $this->broadcastToRoom($roomId, [
                'type' => 'user_left',
                'uid' => $uid
            ], $conn);

            $conn->kordRoom = null;
            $conn->kordUid = null;

            echo "[LEAVE] uid=$uid room=$roomId\n";
        }
    }

    protected function handleSignaling($conn, $data, $type) {
        $roomId = $conn->kordRoom;
        if (!$roomId) return;

        // Broadcast signaling data to all others in room
        $this->broadcastToRoom($roomId, [
            'type' => $type,
            'from' => $conn->kordUid,
            'to' => $data['to'] ?? null,
            'data' => $data['data'] ?? null,
            'roomId' => $roomId
        ], $conn);
    }

    protected function handleCallInvite($conn, $data) {
        $targetUid = $data['to'] ?? null;
        if (!$targetUid) return;

        // Find target connection
        $targetSessionId = $this->users[$targetUid] ?? null;
        if ($targetSessionId) {
            // Find target conn
            foreach ($this->clients as $client) {
                if ($client->kordSessionId === $targetSessionId) {
                    $client->send(json_encode([
                        'type' => 'call_invite',
                        'from' => $conn->kordUid,
                        'roomId' => $data['roomId'] ?? null,
                        'callType' => $data['callType'] ?? 'video'
                    ]));
                    break;
                }
            }
        }

        // Also store in Firebase for when target is offline
        // (Firebase real-time DB handles this)

        echo "[CALL_INVITE] from={$conn->kordUid} to=$targetUid\n";
    }

    protected function handleCallControl($conn, $data) {
        $targetUid = $data['to'] ?? null;
        $action = $data['type']; // call_accept, call_reject, call_end

        if ($targetUid && isset($this->users[$targetUid])) {
            $targetSessionId = $this->users[$targetUid];
            foreach ($this->clients as $client) {
                if ($client->kordSessionId === $targetSessionId) {
                    $client->send(json_encode([
                        'type' => $action,
                        'from' => $conn->kordUid,
                        'roomId' => $data['roomId'] ?? null
                    ]));
                    break;
                }
            }
        }

        // Broadcast to room as well
        if ($conn->kordRoom) {
            $this->broadcastToRoom($conn->kordRoom, [
                'type' => $action,
                'from' => $conn->kordUid,
                'roomId' => $conn->kordRoom
            ], $conn);
        }

        echo "[CALL_CONTROL] {$action} from={$conn->kordUid} to=$targetUid\n";
    }

    protected function handlePresence($conn, $data) {
        $uid = $conn->kordUid;
        if (!$uid) return;

        $this->presence[$uid] = [
            'status' => $data['status'] ?? 'online',
            'lastSeen' => time()
        ];

        // Broadcast presence to room
        if ($conn->kordRoom) {
            $this->broadcastToRoom($conn->kordRoom, [
                'type' => 'presence_update',
                'uid' => $uid,
                'status' => $data['status'] ?? 'online'
            ], $conn);
        }
    }

    protected function handleTyping($conn, $data) {
        if ($conn->kordRoom) {
            $this->broadcastToRoom($conn->kordRoom, [
                'type' => 'typing',
                'uid' => $conn->kordUid,
                'channelId' => $data['channelId'] ?? null,
                'isTyping' => $data['isTyping'] ?? false
            ], $conn);
        }
    }

    protected function broadcastToRoom($roomId, $msg, $exclude = null) {
        if (!isset($this->rooms[$roomId])) return;
        $msgStr = json_encode($msg);
        foreach ($this->rooms[$roomId] as $conn) {
            if ($conn !== $exclude) {
                $conn->send($msgStr);
            }
        }
    }

    public function onClose(ConnectionInterface $conn) {
        // Clean up
        if ($conn->kordRoom) {
            $this->handleLeave($conn, []);
        }
        if ($conn->kordUid && isset($this->users[$conn->kordUid])) {
            unset($this->users[$conn->kordUid]);
        }
        $this->clients->detach($conn);
        echo "[CLOSE] {$conn->kordSessionId}\n";
    }

    public function onError(ConnectionInterface $conn, \Exception $e) {
        echo "[ERROR] {$e->getMessage()}\n";
        $conn->close();
    }
}

// Start server
$server = IoServer::factory(
    new HttpServer(new WsServer(new KordGateway())),
    8080,
    '0.0.0.0'
);

echo "[KordGateway] WebSocket server running on ws://0.0.0.0:8080\n";
$server->run();