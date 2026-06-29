<?php
/**
 * API Gateway - Central entry point for all API calls
 * 
 * Features:
 * - Request validation (method, content-type)
 * - Authentication (Bearer token or session)
 * - Rate limiting (via rate_limit.php)
 * - Request logging (IP, UID, endpoint, timestamp, response time)
 * - Unified error response format
 * - Routes to specific handlers
 */

if (!defined('KORD_API_INIT')) {
    define('KORD_API_INIT', true);
}

// Load configuration
require_once __DIR__ . '/../config.php';
require_once __DIR__ . '/rate_limit.php';

// Error handling
error_reporting(DEBUG_MODE ? E_ALL : 0);
ini_set('display_errors', DEBUG_MODE ? '1' : '0');

// ============================================================
// HELPER FUNCTIONS
// ============================================================

/**
 * Send JSON response
 */
function jsonResponse($data, $statusCode = 200) {
    http_response_code($statusCode);
    header('Content-Type: application/json; charset=utf-8');
    header('X-Content-Type-Options: nosniff');
    
    if (!DEBUG_MODE) {
        header('X-Robots-Tag: noindex, nofollow');
    }
    
    echo json_encode($data, RESPONSE_JSON_FLAGS ?? 0);
    exit;
}

/**
 * Send error response in unified format
 */
function errorResponse($message, $code, $statusCode = 400) {
    jsonResponse([
        'error' => $message,
        'code' => $code
    ], $statusCode);
}

/**
 * Get client IP address
 */
function getClientIP() {
    $ip = $_SERVER['REMOTE_ADDR'] ?? '0.0.0.0';
    
    // Check for forwarded headers (reverse proxy)
    if (!empty($_SERVER['HTTP_X_FORWARDED_FOR'])) {
        $ips = explode(',', $_SERVER['HTTP_X_FORWARDED_FOR']);
        $ip = trim($ips[0]);
    } elseif (!empty($_SERVER['HTTP_X_REAL_IP'])) {
        $ip = $_SERVER['HTTP_X_REAL_IP'];
    }
    
    return filter_var($ip, FILTER_VALIDATE_IP) ? $ip : '0.0.0.0';
}

/**
 * Log API request
 */
function logRequest($ip, $uid, $endpoint, $method, $responseCode, $responseTime) {
    $logEntry = json_encode([
        'timestamp' => date('c'),
        'ip' => $ip,
        'uid' => $uid,
        'endpoint' => $endpoint,
        'method' => $method,
        'response_code' => $responseCode,
        'response_time_ms' => $responseTime,
        'user_agent' => $_SERVER['HTTP_USER_AGENT'] ?? ''
    ]) . "\n";
    
    $logFile = defined('LOG_FILE') ? LOG_FILE : __DIR__ . '/../logs/api_requests.log';
    
    @file_put_contents($logFile, $logEntry, FILE_APPEND | LOCK_EX);
}

/**
 * Log API error
 */
function logError($message, $context = []) {
    $logEntry = json_encode([
        'timestamp' => date('c'),
        'message' => $message,
        'context' => $context,
        'ip' => getClientIP()
    ]) . "\n";
    
    $logFile = defined('LOG_ERROR_FILE') ? LOG_ERROR_FILE : __DIR__ . '/../logs/api_errors.log';
    
    @file_put_contents($logFile, $logEntry, FILE_APPEND | LOCK_EX);
}

/**
 * Validate API endpoint
 */
function validateEndpoint($endpoint) {
    $allowed = defined('API_ENDPOINTS') ? json_decode(API_ENDPOINTS, true) : [];
    return in_array($endpoint, $allowed, true);
}

/**
 * Authenticate request
 */
function authenticateRequest() {
    $uid = null;
    $isAuth = false;
    
    // Check Bearer token
    $authHeader = $_SERVER['HTTP_AUTHORIZATION'] ?? $_SERVER['HTTP_AUTH_BEARER'] ?? '';
    
    if (preg_match('/^Bearer\s+(.+)$/i', $authHeader, $matches)) {
        $token = $matches[1];
        
        // Validate token (implement your JWT/session validation here)
        $uid = validateBearerToken($token);
        if ($uid) {
            $isAuth = true;
        }
    }
    
    // Check API Key header
    if (!$isAuth) {
        $apiKey = $_SERVER['HTTP_X_API_KEY'] ?? '';
        if (!empty($apiKey)) {
            $uid = validateApiKey($apiKey);
            if ($uid) {
                $isAuth = true;
            }
        }
    }
    
    // Check session-based auth
    if (!$isAuth && session_status() === PHP_SESSION_ACTIVE) {
        $uid = $_SESSION['user_id'] ?? null;
        if ($uid) {
            $isAuth = true;
        }
    }
    
    return ['authenticated' => $isAuth, 'uid' => $uid];
}

/**
 * Validate Bearer token (placeholder - implement JWT validation)
 */
function validateBearerToken($token) {
    // TODO: Implement JWT validation
    // For now, accept tokens that start with 'kord_' and are at least 32 chars
    if (preg_match('/^kord_[a-zA-Z0-9]{27,}$/', $token)) {
        // In production, decode JWT and extract UID
        // For demo, extract UID from token hash
        return 'user_' . substr(md5($token), 0, 8);
    }
    return null;
}

/**
 * Validate API key (placeholder)
 */
function validateApiKey($key) {
    $validKeys = defined('API_KEYS') ? explode(',', API_KEYS) : [];
    
    foreach ($validKeys as $validKey) {
        $validKey = trim($validKey);
        if (!empty($validKey) && hash_equals($validKey, $key)) {
            return 'apikey_user';
        }
    }
    
    return null;
}

// ============================================================
// MAIN GATEWAY LOGIC
// ============================================================

$startTime = microtime(true);

// Get request details
$method = $_SERVER['REQUEST_METHOD'];
$requestUri = $_SERVER['REQUEST_URI'] ?? '/';
$clientIP = getClientIP();

// Parse endpoint from URL
$path = parse_url($requestUri, PHP_URL_PATH);
$path = trim(str_replace('/api/', '', $path), '/');
$parts = explode('/', $path);
$endpoint = $parts[0] ?? 'index';

// Default UID
$uid = null;

// ============================================================
// CORS PREFLIGHT
// ============================================================

if ($method === 'OPTIONS') {
    header('Access-Control-Allow-Origin: *');
    header('Access-Control-Allow-Methods: GET, POST, PUT, DELETE, OPTIONS');
    header('Access-Control-Allow-Headers: Content-Type, Authorization, X-API-Key');
    header('Access-Control-Max-Age: 86400');
    exit(0);
}

// ============================================================
// VALIDATE REQUEST METHOD
// ============================================================

$allowedMethods = ['GET', 'POST', 'PUT', 'DELETE'];
if (!in_array($method, $allowedMethods)) {
    errorResponse('Method not allowed', 'ERR_METHOD_NOT_ALLOWED', 405);
}

// ============================================================
// AUTHENTICATION
// ============================================================

$auth = authenticateRequest();
$uid = $auth['uid'];

// For protected endpoints, require auth
$protectedEndpoints = ['messages', 'channels', 'servers', 'user', 'upload'];
if (in_array($endpoint, $protectedEndpoints) && !$auth['authenticated']) {
    errorResponse('Authentication required', 'ERR_AUTH_REQUIRED', 401);
}

// ============================================================
// RATE LIMITING
// ============================================================

// Check IP rate limit first
$ipLimit = RateLimit::check($clientIP, 'ip');
if (!$ipLimit['allowed']) {
    header('Retry-After: ' . $ipLimit['retry_after']);
    header('X-RateLimit-Limit: ' . $ipLimit['limit']);
    header('X-RateLimit-Remaining: 0');
    header('X-RateLimit-Reset: ' . $ipLimit['reset']);
    errorResponse('Rate limit exceeded (IP)', 'ERR_RATE_LIMIT_IP', 429);
}

// Check UID rate limit if authenticated
if ($uid) {
    $uidLimit = RateLimit::check($uid, 'uid');
    if (!$uidLimit['allowed']) {
        header('Retry-After: ' . $uidLimit['retry_after']);
        header('X-RateLimit-Limit: ' . $uidLimit['limit']);
        header('X-RateLimit-Remaining: 0');
        header('X-RateLimit-Reset: ' . $uidLimit['reset']);
        errorResponse('Rate limit exceeded (UID)', 'ERR_RATE_LIMIT_UID', 429);
    }
}

// ============================================================
// VALIDATE ENDPOINT
// ============================================================

if (!validateEndpoint($endpoint) && $endpoint !== 'index') {
    errorResponse('Unknown endpoint', 'ERR_UNKNOWN_ENDPOINT', 404);
}

// ============================================================
// CONTENT TYPE VALIDATION
// ============================================================

if (in_array($method, ['POST', 'PUT'])) {
    $contentType = $_SERVER['CONTENT_TYPE'] ?? '';
    
    if (stripos($contentType, 'application/json') === false && 
        stripos($contentType, 'multipart/form-data') === false &&
        stripos($contentType, 'application/x-www-form-urlencoded') === false) {
        errorResponse('Content-Type must be application/json or form data', 'ERR_INVALID_CONTENT_TYPE', 415);
    }
}

// ============================================================
// PROCESS REQUEST
// ============================================================

$responseData = [];
$responseCode = 200;

try {
    switch ($endpoint) {
        case 'auth':
            // Handle auth endpoints
            $responseData = handleAuth($method, $parts);
            break;
            
        case 'user':
            $responseData = handleUser($method, $uid, $parts);
            break;
            
        case 'messages':
            $responseData = handleMessages($method, $uid, $parts);
            break;
            
        case 'channels':
            $responseData = handleChannels($method, $uid, $parts);
            break;
            
        case 'servers':
            $responseData = handleServers($method, $uid, $parts);
            break;
            
        case 'media':
            // Media proxy handled separately
            $responseData = ['endpoint' => 'media', 'status' => 'use_proxy'];
            break;
            
        case 'health':
            $responseData = [
                'status' => 'ok',
                'timestamp' => date('c'),
                'version' => '1.0.0'
            ];
            break;
            
        case 'index':
            $responseData = [
                'api' => 'Kord API Gateway',
                'version' => '1.0.0',
                'endpoints' => json_decode(API_ENDPOINTS, true),
                'status' => 'operational'
            ];
            break;
            
        default:
            $responseCode = 404;
            $responseData = ['error' => 'Endpoint not found', 'code' => 'ERR_NOT_FOUND'];
    }
} catch (Exception $e) {
    logError($e->getMessage(), [
        'endpoint' => $endpoint,
        'method' => $method,
        'trace' => $e->getTraceAsString()
    ]);
    
    $responseCode = 500;
    $responseData = [
        'error' => DEBUG_MODE ? $e->getMessage() : 'Internal server error',
        'code' => 'ERR_INTERNAL'
    ];
}

// ============================================================
// SEND RESPONSE
// ============================================================

// Calculate response time
$responseTime = round((microtime(true) - $startTime) * 1000);

// Add rate limit headers
header('X-RateLimit-Limit: ' . $ipLimit['limit']);
header('X-RateLimit-Remaining: ' . $ipLimit['remaining']);
header('X-RateLimit-Reset: ' . $ipLimit['reset']);

// Log request
logRequest($clientIP, $uid, $endpoint, $method, $responseCode, $responseTime);

// Send response
jsonResponse($responseData, $responseCode);

// ============================================================
// REQUEST HANDLERS (Placeholder implementations)
// ============================================================

function handleAuth($method, $parts) {
    if ($method === 'POST') {
        return [
            'action' => 'auth',
            'status' => 'Token issued',
            'token_type' => 'Bearer'
        ];
    }
    return ['error' => 'Method not allowed', 'code' => 'ERR_METHOD_NOT_ALLOWED'];
}

function handleUser($method, $uid, $parts) {
    if ($method === 'GET') {
        return [
            'user_id' => $uid,
            'action' => 'get_profile'
        ];
    }
    return ['error' => 'Method not allowed', 'code' => 'ERR_METHOD_NOT_ALLOWED'];
}

function handleMessages($method, $uid, $parts) {
    return ['action' => 'messages', 'method' => $method];
}

function handleChannels($method, $uid, $parts) {
    return ['action' => 'channels', 'method' => $method];
}

function handleServers($method, $uid, $parts) {
    return ['action' => 'servers', 'method' => $method];
}