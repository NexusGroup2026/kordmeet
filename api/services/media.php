<?php
/**
 * Media Service - Image proxy, upload handling
 */
header('Content-Type: application/json');
$uri = parse_url($_SERVER['REQUEST_URI'], PHP_URL_PATH);
$method = $_SERVER['REQUEST_METHOD'];
$body = json_decode(file_get_contents('php://input'), true) ?? [];

// GET /api/proxy?url=base64encoded
if ($method === 'GET' && $uri === '/api/proxy') {
    $encoded = $_GET['url'] ?? '';
    if (empty($encoded)) {
        http_response_code(400);
        return json_encode(['error' => 'URL required', 'code' => 'ERR_MISSING_URL']);
    }
    $url = base64_decode($encoded);
    if (!$url || !filter_var($url, FILTER_VALIDATE_URL)) {
        http_response_code(400);
        return json_encode(['error' => 'URL inválida', 'code' => 'ERR_INVALID_URL']);
    }
    // Allowed domains check
    $allowed = ['tenor.com', 'giphy.com', 'media.giphy.com', 'i.imgur.com', 'picsum.photos', 'supabase.co', 'firebasestorage.googleapis.com'];
    $host = parse_url($url, PHP_URL_HOST);
    $allowed_host = false;
    foreach ($allowed as $a) {
        if (strpos($host, $a) !== false) { $allowed_host = true; break; }
    }
    if (!$allowed_host) {
        http_response_code(403);
        return json_encode(['error' => 'Domínio não permitido', 'code' => 'ERR_FORBIDDEN']);
    }
    // Return proxy URL (actual proxying done by proxy.php)
    return json_encode(['success' => true, 'proxyUrl' => '/proxy.php?url=' . $encoded, 'originalUrl' => $url]);
}

http_response_code(404); echo json_encode(['error' => 'Not found', 'code' => 'ERR_NOT_FOUND']);