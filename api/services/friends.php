<?php
/**
 * Friends Service - Friends, requests, block
 */
header('Content-Type: application/json');
$uri = parse_url($_SERVER['REQUEST_URI'], PHP_URL_PATH);
$method = $_SERVER['REQUEST_METHOD'];
$body = json_decode(file_get_contents('php://input'), true) ?? [];

// GET /api/friends
if ($method === 'GET' && $uri === '/api/friends') {
    return json_encode(['success' => true, 'source' => 'firebase']);
}
// GET /api/friends/requests
if ($method === 'GET' && $uri === '/api/friends/requests') {
    return json_encode(['success' => true, 'source' => 'firebase']);
}
// POST /api/friends/request
if ($method === 'POST' && $uri === '/api/friends/request') {
    $toUid = trim($body['toUid'] ?? '');
    if (empty($toUid)) { http_response_code(400); return json_encode(['error' => 'toUid required', 'code' => 'ERR_MISSING']); }
    return json_encode(['success' => true, 'toUid' => $toUid]);
}
// POST /api/friends/accept
if ($method === 'POST' && $uri === '/api/friends/accept') {
    $fromUid = trim($body['fromUid'] ?? '');
    if (empty($fromUid)) { http_response_code(400); return json_encode(['error' => 'fromUid required', 'code' => 'ERR_MISSING']); }
    return json_encode(['success' => true, 'accepted' => true]);
}
// POST /api/friends/reject
if ($method === 'POST' && $uri === '/api/friends/reject') {
    $fromUid = trim($body['fromUid'] ?? '');
    return json_encode(['success' => true, 'rejected' => true]);
}
// POST /api/friends/block
if ($method === 'POST' && $uri === '/api/friends/block') {
    $uid = trim($body['uid'] ?? '');
    if (empty($uid)) { http_response_code(400); return json_encode(['error' => 'uid required', 'code' => 'ERR_MISSING']); }
    return json_encode(['success' => true, 'blocked' => true]);
}
http_response_code(404); echo json_encode(['error' => 'Not found', 'code' => 'ERR_NOT_FOUND']);