<?php
/**
 * Admin Service - Stats, user management, broadcast, logs
 */
header('Content-Type: application/json');
$uri = parse_url($_SERVER['REQUEST_URI'], PHP_URL_PATH);
$method = $_SERVER['REQUEST_METHOD'];
$body = json_decode(file_get_contents('php://input'), true) ?? [];

// Admin check (in production, verify isAdmin from Firebase token)
$isAdmin = false; // TODO: implement admin verification from Firebase token

// GET /api/admin/stats
if ($method === 'GET' && $uri === '/api/admin/stats') {
    return json_encode([
        'success' => true,
        'stats' => [
            'totalUsers' => 0, // Fetched from Firebase
            'totalServers' => 0,
            'totalMessages' => 0,
            'activeNow' => 0,
            'timestamp' => time()
        ]
    ]);
}

// GET /api/admin/users
if ($method === 'GET' && $uri === '/api/admin/users') {
    $page = (int)($_GET['page'] ?? 1);
    $limit = min((int)($_GET['limit'] ?? 50), 100);
    return json_encode([
        'success' => true,
        'page' => $page,
        'limit' => $limit,
        'source' => 'firebase'
    ]);
}

// GET /api/admin/logs
if ($method === 'GET' && $uri === '/api/admin/logs') {
    $type = $_GET['type'] ?? 'access';
    $logs = [];
    $logFile = __DIR__ . '/../../logs/' . $type . '.log';
    if (file_exists($logFile)) {
        $lines = file($logFile, FILE_IGNORE_NEW_LINES | FILE_SKIP_EMPTY_LINES);
        $logs = array_slice($lines, -100);
    }
    return json_encode(['success' => true, 'type' => $type, 'logs' => $logs, 'count' => count($logs)]);
}

// POST /api/admin/broadcast
if ($method === 'POST' && $uri === '/api/admin/broadcast') {
    $message = trim($body['message'] ?? '');
    if (strlen($message) < 1 || strlen($message) > 500) {
        http_response_code(400);
        return json_encode(['error' => 'Mensagem 1-500 caracteres', 'code' => 'ERR_INVALID']);
    }
    return json_encode(['success' => true, 'broadcast' => true, 'message' => htmlspecialchars($message)]);
}

http_response_code(404); echo json_encode(['error' => 'Not found', 'code' => 'ERR_NOT_FOUND']);