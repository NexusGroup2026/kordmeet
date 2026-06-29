<?php
/**
 * Media Proxy - Secure image/media proxy
 * 
 * Acts as proxy: proxy.php?url=base64encoded_url
 * 
 * Security features:
 * - Validates URL is from allowed domains only
 * - Validates Content-Type matches allowed media types
 * - Enforces max file size (10MB)
 * - Adds security headers
 * - Adds CORS headers
 * 
 * Allowed domains: tenor, giphy, imgur, picsum, supabase, firebase storage
 */

if (!defined('KORD_API_INIT')) {
    define('KORD_API_INIT', true);
}

// Load configuration
require_once __DIR__ . '/config.php';

// Error handling
error_reporting(0);
ini_set('display_errors', 0);

/**
 * Get allowed media domains
 */
function getAllowedDomains() {
    if (defined('ALLOWED_MEDIA_DOMAINS')) {
        return json_decode(ALLOWED_MEDIA_DOMAINS, true);
    }
    return [
        'tenor.com',
        'tenor.googleapis.com',
        'giphy.com',
        'giphy.media',
        'imgur.com',
        'i.imgur.com',
        'picsum.photos',
        'supabase.co',
        'supabasecdn.com',
        'firebasestorage.googleapis.com',
        'firebasestorage.googleapis.com',
        'cdn.discordapp.com',
        'media.discordapp.net',
    ];
}

/**
 * Get allowed media types
 */
function getAllowedTypes() {
    if (defined('ALLOWED_MEDIA_TYPES')) {
        return json_decode(ALLOWED_MEDIA_TYPES, true);
    }
    return [
        'image/jpeg',
        'image/png',
        'image/gif',
        'image/webp',
        'image/avif',
        'image/svg+xml',
        'video/mp4',
        'video/webm',
        'video/ogg',
    ];
}

/**
 * Send error response
 */
function proxyError($message, $code, $statusCode = 400) {
    http_response_code($statusCode);
    header('Content-Type: application/json; charset=utf-8');
    echo json_encode([
        'error' => $message,
        'code' => $code
    ]);
    exit;
}

/**
 * Validate URL
 */
function validateUrl($url) {
    // Must be a valid URL
    if (!filter_var($url, FILTER_VALIDATE_URL)) {
        return false;
    }
    
    // Must be HTTP or HTTPS
    $scheme = parse_url($url, PHP_URL_SCHEME);
    if (!in_array($scheme, ['http', 'https'])) {
        return false;
    }
    
    // Must have a valid host
    $host = parse_url($url, PHP_URL_HOST);
    if (empty($host)) {
        return false;
    }
    
    // Host must be in allowed domains
    $allowedDomains = getAllowedDomains();
    $hostIsAllowed = false;
    
    foreach ($allowedDomains as $domain) {
        // Exact match or subdomain
        if ($host === $domain || str_ends_with($host, '.' . $domain)) {
            $hostIsAllowed = true;
            break;
        }
    }
    
    return $hostIsAllowed;
}

/**
 * Fetch remote media via cURL
 */
function fetchMedia($url) {
    $ch = curl_init();
    
    curl_setopt_array($ch, [
        CURLOPT_URL => $url,
        CURLOPT_RETURNTRANSFER => true,
        CURLOPT_FOLLOWLOCATION => true,
        CURLOPT_MAXREDIRS => 5,
        CURLOPT_TIMEOUT => 30,
        CURLOPT_CONNECTTIMEOUT => 10,
        CURLOPT_SSL_VERIFYPEER => true,
        CURLOPT_SSL_VERIFYHOST => 2,
        CURLOPT_USERAGENT => 'Kord-Media-Proxy/1.0',
        CURLOPT_HTTPHEADER => [
            'Accept: */*',
            'Accept-Language: en-US,en;q=0.5',
        ]
    ]);
    
    $response = curl_exec($ch);
    $httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
    $contentType = curl_getinfo($ch, CURLINFO_CONTENT_TYPE);
    $contentLength = curl_getinfo($ch, CURLINFO_SIZE_DOWNLOAD);
    $error = curl_error($ch);
    
    curl_close($ch);
    
    return [
        'body' => $response,
        'http_code' => $httpCode,
        'content_type' => $contentType,
        'content_length' => $contentLength,
        'error' => $error
    ];
}

/**
 * Validate content type
 */
function validateContentType($contentType) {
    if (empty($contentType)) {
        return false;
    }
    
    // Extract base type (remove charset and other params)
    $parts = explode(';', $contentType);
    $baseType = trim($parts[0]);
    
    $allowedTypes = getAllowedTypes();
    
    // Check exact match
    if (in_array($baseType, $allowedTypes, true)) {
        return true;
    }
    
    // Check wildcard (e.g., image/* matches image/png)
    foreach ($allowedTypes as $allowed) {
        if (strpos($allowed, '*') !== false) {
            $pattern = '/^' . str_replace('*', '.*', preg_quote($allowed, '/')) . '$/i';
            if (preg_match($pattern, $baseType)) {
                return true;
            }
        }
    }
    
    // Also check if base type starts with allowed prefix
    foreach (['image/', 'video/'] as $prefix) {
        if (strpos($baseType, $prefix) === 0) {
            // Check if this prefix type is allowed
            foreach ($allowedTypes as $allowed) {
                if (strpos($allowed, $prefix) === 0) {
                    return true;
                }
            }
        }
    }
    
    return false;
}

// ============================================================
// MAIN PROXY LOGIC
// ============================================================

// Only allow GET requests
if ($_SERVER['REQUEST_METHOD'] !== 'GET') {
    proxyError('Method not allowed', 'ERR_METHOD_NOT_ALLOWED', 405);
}

// Get URL from query parameter
$encodedUrl = $_GET['url'] ?? '';

if (empty($encodedUrl)) {
    proxyError('URL parameter is required', 'ERR_URL_REQUIRED', 400);
}

// Decode URL
$url = base64_decode($encodedUrl, true);

if ($url === false || empty($url)) {
    proxyError('Invalid URL encoding', 'ERR_INVALID_URL', 400);
}

// Validate URL format and domain
if (!validateUrl($url)) {
    proxyError('URL domain not allowed', 'ERR_DOMAIN_NOT_ALLOWED', 403);
}

// Fetch the media
$result = fetchMedia($url);

// Check for cURL errors
if (!empty($result['error'])) {
    proxyError('Failed to fetch media', 'ERR_FETCH_FAILED', 502);
}

// Check HTTP status code
if ($result['http_code'] < 200 || $result['http_code'] >= 400) {
    proxyError('Remote server returned error', 'ERR_REMOTE_ERROR', 502);
}

// Validate content type
if (!validateContentType($result['content_type'])) {
    proxyError('Content-Type not allowed: ' . $result['content_type'], 'ERR_TYPE_NOT_ALLOWED', 403);
}

// Check content length
$maxSize = defined('MAX_MEDIA_SIZE') ? MAX_MEDIA_SIZE : 10 * 1024 * 1024;
if ($result['content_length'] > $maxSize) {
    proxyError('File too large (max ' . ($maxSize / 1024 / 1024) . 'MB)', 'ERR_FILE_TOO_LARGE', 403);
}

// Validate content is not empty
if (empty($result['body']) || strlen($result['body']) < 100) {
    proxyError('Empty or invalid media content', 'ERR_INVALID_CONTENT', 502);
}

// ============================================================
// SEND PROXIED RESPONSE
// ============================================================

// Security headers
header('X-Content-Type-Options: nosniff');
header('X-Content-Type-Options: nosniff');
header('Cache-Control: public, max-age=86400, stale-while-revalidate=3600');

// Content Security Policy for media
$csp = "default-src 'none'; img-src 'self' data: https://*; style-src 'unsafe-inline'; media-src 'self' https://*; connect-src 'none';";
header("Content-Security-Policy: $csp");

// CORS headers
$allowedOrigins = defined('CORS_ALLOWED_ORIGINS') ? json_decode(CORS_ALLOWED_ORIGINS, true) : ['https://kord.gg', 'https://www.kord.gg'];
$origin = $_SERVER['HTTP_ORIGIN'] ?? '';

if (in_array($origin, $allowedOrigins)) {
    header("Access-Control-Allow-Origin: $origin");
    header('Access-Control-Allow-Credentials: true');
}

header('Access-Control-Allow-Methods: GET, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type');

// Content type header
$contentType = $result['content_type'];
// Ensure proper MIME type
if (strpos($contentType, 'text/html') !== false) {
    $contentType = 'application/octet-stream';
}
header("Content-Type: $contentType");

// Content length
header('Content-Length: ' . strlen($result['body']));

// ETag for caching
$etag = '"' . md5($result['body']) . '"';
header("ETag: $etag");

// Send the media content
echo $result['body'];
exit;