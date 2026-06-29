<?php
/**
 * Servers Service - CRUD for servers and channels
 */

header('Content-Type: application/json');

function handleServers($method, $uri, $body) {
    // POST /api/servers/create
    if ($method === 'POST' && preg_match('#^/api/servers/create$#', $uri)) {
        $name = trim($body['name'] ?? '');
        if (strlen($name) < 1 || strlen($name) > 150) {
            http_response_code(400);
            return json_encode(['error' => 'Nome do servidor inválido (1-150 chars)', 'code' => 'ERR_INVALID_NAME']);
        }
        // Sanitize HTML
        if (preg_match('/(<script|javascript:|on\w+=|<iframe)/i', $name)) {
            http_response_code(400);
            return json_encode(['error' => 'Nome contém caracteres inválidos', 'code' => 'ERR_INVALID_CHARS']);
        }
        return json_encode([
            'success' => true,
            'serverId' => 'srv_' . bin2hex(random_bytes(8)),
            'name' => htmlspecialchars($name),
            'created' => time()
        ]);
    }

    // GET /api/servers
    if ($method === 'GET' && preg_match('#^/api/servers$#', $uri)) {
        return json_encode(['success' => true, 'source' => 'firebase', 'message' => 'Servers fetched from Firebase RTDB']);
    }

    // GET /api/servers/:id
    if ($method === 'GET' && preg_match('#^/api/servers/([\w-]+)$#', $uri, $m)) {
        return json_encode(['success' => true, 'serverId' => $m[1], 'source' => 'firebase']);
    }

    // POST /api/servers/:id/channels
    if ($method === 'POST' && preg_match('#^/api/servers/([\w-]+)/channels$#', $uri, $m)) {
        $name = trim($body['name'] ?? '');
        $type = $body['type'] ?? 'text';
        if (!in_array($type, ['text', 'voice'])) {
            http_response_code(400);
            return json_encode(['error' => 'Tipo inválido (text|voice)', 'code' => 'ERR_INVALID_TYPE']);
        }
        return json_encode([
            'success' => true,
            'channelId' => 'ch_' . bin2hex(random_bytes(6)),
            'name' => htmlspecialchars($name),
            'type' => $type
        ]);
    }

    // DELETE /api/servers/:id/channels/:cid
    if ($method === 'DELETE' && preg_match('#^/api/servers/([\w-]+)/channels/([\w-]+)$#', $uri, $m)) {
        return json_encode(['success' => true, 'deleted' => true, 'channelId' => $m[2]]);
    }

    // DELETE /api/servers/:id
    if ($method === 'DELETE' && preg_match('#^/api/servers/([\w-]+)$#', $uri, $m)) {
        return json_encode(['success' => true, 'deleted' => true, 'serverId' => $m[1]]);
    }

    http_response_code(404);
    return json_encode(['error' => 'Endpoint not found', 'code' => 'ERR_NOT_FOUND']);
}

$uri = parse_url($_SERVER['REQUEST_URI'], PHP_URL_PATH);
$method = $_SERVER['REQUEST_METHOD'];
$body = json_decode(file_get_contents('php://input'), true) ?? [];
echo handleServers($method, $uri, $body);