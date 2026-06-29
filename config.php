<?php
/**
 * Kord API Configuration
 * Environment-based configuration management
 */

// Prevent direct access
if (!defined('KORD_API_INIT')) {
    define('KORD_API_INIT', true);
}

// Environment detection
$env = getenv('KORD_ENV') ?: 'production';
define('KORD_ENV', $env);
define('DEBUG_MODE', $env !== 'production');

// ============================================================
// RATE LIMITING CONFIGURATION
// ============================================================

// Per-IP rate limiting (requests per minute)
define('RATE_LIMIT_IP_REQUESTS', 100);
define('RATE_LIMIT_IP_WINDOW', 60); // seconds

// Per-UID rate limiting (requests per minute)
define('RATE_LIMIT_UID_REQUESTS', 200);
define('RATE_LIMIT_UID_WINDOW', 60); // seconds

// Burst allowance (token bucket)
define('RATE_LIMIT_BURST_IP', 20);
define('RATE_LIMIT_BURST_UID', 40);

// ============================================================
// ALLOWED MEDIA DOMAINS
// ============================================================

define('ALLOWED_MEDIA_DOMAINS', json_encode([
    'tenor.com',
    'tenorusercontent.com',
    'giphy.com',
    'giphy.media',
    'imgur.com',
    'i.imgur.com',
    'picsum.photos',
    'picsum.photos',
    'supabase.co',
    'supabasecdn.com',
    'firebasestorage.googleapis.com',
    'firebasestorage.googleapis.com',
    'cdn.discordapp.com',
    'media.discordapp.net',
]));

// ============================================================
// MEDIA PROXY CONFIGURATION
// ============================================================

define('MAX_MEDIA_SIZE', 10 * 1024 * 1024); // 10MB
define('ALLOWED_MEDIA_TYPES', json_encode([
    'image/jpeg',
    'image/png',
    'image/gif',
    'image/webp',
    'image/avif',
    'image/svg+xml',
    'video/mp4',
    'video/webm',
    'video/ogg',
]));

// ============================================================
// API SECURITY
// ============================================================

// API Keys (comma-separated for multiple keys)
define('API_KEYS', 'kord_live_' . getenv('KORD_API_KEY') ?: 'kord_live_default_key_change_me');
define('API_KEY_HEADER', 'X-API-Key');
define('AUTH_BEARER_HEADER', 'Authorization');

// JWT Secret for token validation
define('JWT_SECRET', getenv('KORD_JWT_SECRET') ?: 'change_this_secret_in_production');

// Session secret
define('SESSION_SECRET', getenv('KORD_SESSION_SECRET') ?: 'change_this_session_secret');

// ============================================================
// LOGGING
// ============================================================

define('LOG_PATH', __DIR__ . '/logs/');
define('LOG_FILE', LOG_PATH . 'api_requests.log');
define('LOG_ERROR_FILE', LOG_PATH . 'api_errors.log');
define('LOG_MAX_SIZE', 10 * 1024 * 1024); // 10MB rotation

// ============================================================
// PATHS
// ============================================================

define('TEMP_PATH', __DIR__ . '/temp/');
define('RATE_LIMIT_PATH', TEMP_PATH . 'rate_limits/');

// ============================================================
// CORS SETTINGS
// ============================================================

define('CORS_ALLOWED_ORIGINS', json_encode([
    'https://kord.gg',
    'https://www.kord.gg',
    'https://app.kord.gg',
]));

// ============================================================
// API ENDPOINTS WHITELIST
// ============================================================

define('API_ENDPOINTS', json_encode([
    'auth',
    'user',
    'messages',
    'channels',
    'servers',
    'media',
    'upload',
]));

// ============================================================
// RESPONSE SETTINGS
// ============================================================

define('RESPONSE_JSON_FLAGS', JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
define('RESPONSE_DEBUG', DEBUG_MODE);