<?php
/**
 * Messages Service - Message tracking for analytics
 */
header('Content-Type: application/json');
$method = $_SERVER['REQUEST_METHOD'];

// POST /api/messages/track
if ($method === 'POST') {
    $body = json_decode(file_get_contents('php://input'), true) ?? [];
    $serverId = trim($body['serverId'] ?? '');
    $channelId = trim($body['channelId'] ?? '');
    $msgId = trim($body['msgId'] ?? '');
    // Log to file for analytics (Firebase handles real storage)
    $logEntry = json_encode([
        'serverId' => $serverId,
        'channelId' => $channelId,
        'msgId' => $msgId,
        'timestamp' => time(),
        'ip' => $_SERVER['REMOTE_ADDR'] ?? 'unknown'
    ]) . "\n";
    @file_put_contents(__DIR__ . '/../../logs/messages.log', $logEntry, FILE_APPEND);
    return json_encode(['success' => true, 'tracked' => true]);
}
http_response_code(404); echo json_encode(['error' => 'Not found', 'code' => 'ERR_NOT_FOUND']);