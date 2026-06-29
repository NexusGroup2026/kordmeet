<?php
/**
 * Kord Meet API Router
 * Routes all API requests to appropriate service handlers
 */

require_once __DIR__ . '/../config.php';
require_once __DIR__ . '/gateway.php';
require_once __DIR__ . '/rate_limit.php';

// Handle CORS preflight
if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    header('Access-Control-Allow-Origin: *');
    header('Access-Control-Allow-Methods: GET, POST, PUT, DELETE, OPTIONS');
    header('Access-Control-Allow-Headers: Content-Type, Authorization, X-Requested-With');
    header('Access-Control-Max-Age: 86400');
    exit(0);
}

// Gateway handles auth + rate limiting
$gateway = new KordGateway();
$gateway->handle();

$uri = parse_url($_SERVER['REQUEST_URI'], PHP_URL_PATH);
$method = $_SERVER['REQUEST_METHOD'];

// Route definitions: path => service file
$routes = [
    // Auth
    'POST' => [
        '/api/auth/register' => 'services/auth.php',
        '/api/auth/login' => 'services/auth.php',
        '/api/auth/logout' => 'services/auth.php',
        '/api/auth/2fa/setup' => 'services/auth.php',
        '/api/auth/2fa/verify' => 'services/auth.php',
        '/api/auth/password/reset' => 'services/auth.php',
        '/api/auth/refresh' => 'services/auth.php',
    ],
    // Users
    'GET' => [
        '/api/users/me' => 'services/users.php',
        '/api/users/profile' => 'services/users.php',
        '/api/users/search' => 'services/users.php',
        '/api/users/presence' => 'services/users.php',
    ],
    'PUT' => [
        '/api/users/profile' => 'services/users.php',
        '/api/users/settings' => 'services/users.php',
        '/api/users/avatar' => 'services/users.php',
        '/api/users/theme' => 'services/users.php',
    ],
    // Servers
    'GET' => [
        '/api/servers' => 'services/servers.php',
        '/api/servers/:id' => 'services/servers.php',
        '/api/servers/:id/channels' => 'services/servers.php',
    ],
    'POST' => [
        '/api/servers/create' => 'services/servers.php',
        '/api/servers/:id/channels' => 'services/servers.php',
    ],
    'DELETE' => [
        '/api/servers/:id' => 'services/servers.php',
        '/api/servers/:id/channels/:cid' => 'services/servers.php',
    ],
    // Messages (handled via Firebase RTDB, but track analytics here)
    'POST' => [
        '/api/messages/track' => 'services/messages.php',
    ],
    // Friends
    'GET' => [
        '/api/friends' => 'services/friends.php',
        '/api/friends/requests' => 'services/friends.php',
    ],
    'POST' => [
        '/api/friends/request' => 'services/friends.php',
        '/api/friends/accept' => 'services/friends.php',
        '/api/friends/reject' => 'services/friends.php',
        '/api/friends/block' => 'services/friends.php',
    ],
    // Media proxy
    '/api/proxy' => 'services/media.php',
    // Admin
    '/api/admin/stats' => 'services/admin.php',
    '/api/admin/users' => 'services/admin.php',
    '/api/admin/logs' => 'services/admin.php',
    '/api/admin/broadcast' => 'services/admin.php',
];

// Find matching route
$handler = null;
$params = [];

if (isset($routes[$method][$uri])) {
    $handler = $routes[$method][$uri];
} else {
    // Try pattern matching
    foreach ($routes[$method] ?? [] as $pattern => $h) {
        $regex = preg_replace('/:(\w+)/', '(?P<$1>[^/]+)', $pattern);
        if (preg_match("#^$regex$#", $uri, $m)) {
            $handler = $h;
            $params = array_filter($m, 'is_string', ARRAY_FILTER_USE_KEY);
            break;
        }
    }
    // Try generic routes (non-method-specific)
    if (!$handler && isset($routes[$uri])) {
        $handler = $routes[$uri];
    }
}

if ($handler) {
    require_once __DIR__ . '/' . $handler;
} else {
    header('Content-Type: application/json');
    http_response_code(404);
    echo json_encode(['error' => 'Endpoint not found', 'code' => 'ERR_NOT_FOUND', 'path' => $uri]);
}