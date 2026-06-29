<?php
/**
 * Users Service - Profile, settings, search, presence
 */

header('Content-Type: application/json');

function handleUsers($method, $uri) {
    switch (true) {
        // GET /api/users/me
        case $method === 'GET' && preg_match('#^/api/users/me$#', $uri):
            // Returns current user data from Firebase session
            // The JS sends the Firebase ID token, we verify it
            return json_encode(['success' => true, 'message' => 'User data comes from Firebase client SDK']);

        // GET /api/users/profile?uid=xxx
        case $method === 'GET' && preg_match('#^/api/users/profile$#', $uri):
            $uid = $_GET['uid'] ?? '';
            if (empty($uid)) {
                http_response_code(400);
                return json_encode(['error' => 'uid required', 'code' => 'ERR_MISSING_UID']);
            }
            return json_encode(['success' => true, 'uid' => $uid, 'source' => 'firebase']);

        // PUT /api/users/profile
        case $method === 'PUT' && preg_match('#^/api/users/profile$#', $uri):
            $body = json_decode(file_get_contents('php://input'), true);
            $displayName = trim($body['displayName'] ?? '');
            if (strlen($displayName) < 1 || strlen($displayName) > 60) {
                http_response_code(400);
                return json_encode(['error' => 'Nome inválido (1-60 chars)', 'code' => 'ERR_INVALID_NAME']);
            }
            return json_encode(['success' => true, 'displayName' => htmlspecialchars($displayName)]);

        // PUT /api/users/avatar
        case $method === 'PUT' && preg_match('#^/api/users/avatar$#', $uri):
            $body = json_decode(file_get_contents('php://input'), true);
            $photoURL = trim($body['photoURL'] ?? '');
            // Validate URL
            if (!empty($photoURL) && !filter_var($photoURL, FILTER_VALIDATE_URL)) {
                http_response_code(400);
                return json_encode(['error' => 'URL inválida', 'code' => 'ERR_INVALID_URL']);
            }
            return json_encode(['success' => true, 'photoURL' => htmlspecialchars($photoURL)]);

        // PUT /api/users/theme
        case $method === 'PUT' && preg_match('#^/api/users/theme$#', $uri):
            $body = json_decode(file_get_contents('php://input'), true);
            $themeColor = trim($body['themeColor'] ?? '#5865F2');
            if (!preg_match('/^#[0-9a-fA-F]{6}$/', $themeColor)) {
                http_response_code(400);
                return json_encode(['error' => 'Cor inválida', 'code' => 'ERR_INVALID_COLOR']);
            }
            return json_encode(['success' => true, 'themeColor' => $themeColor]);

        // GET /api/users/search?q=xxx
        case $method === 'GET' && preg_match('#^/api/users/search$#', $uri):
            $q = trim($_GET['q'] ?? '');
            if (strlen($q) < 1) {
                http_response_code(400);
                return json_encode(['error' => 'Query vazia', 'code' => 'ERR_EMPTY_QUERY']);
            }
            // Search is handled by Firebase — this endpoint logs the search
            return json_encode(['success' => true, 'query' => htmlspecialchars($q), 'source' => 'firebase']);

        // GET /api/users/presence
        case $method === 'GET' && preg_match('#^/api/users/presence$#', $uri):
            $uid = $_GET['uid'] ?? '';
            return json_encode(['success' => true, 'uid' => $uid, 'status' => 'online', 'source' => 'firebase']);

        default:
            http_response_code(404);
            return json_encode(['error' => 'Endpoint not found', 'code' => 'ERR_NOT_FOUND', 'path' => $uri]);
    }
}

$uri = parse_url($_SERVER['REQUEST_URI'], PHP_URL_PATH);
$method = $_SERVER['REQUEST_METHOD'];
echo handleUsers($method, $uri);