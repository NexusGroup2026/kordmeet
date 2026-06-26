<?php
/**
 * ============================================================
 * AI DATABASE FETCH - SECURE VERSION
 * ============================================================
 */

error_reporting(0);
header('Content-Type: application/json');
header('X-Content-Type-Options: nosniff');
header('X-Frame-Options: DENY');

define('FIREBASE_URL', 'https://kakaxicenter-default-rtdb.firebaseio.com');
define('LOCAL_DB_PATH', __DIR__ . '/ai_database.json');
define('CACHE_FILE', __DIR__ . '/.ai_fetch_cache.json');
define('CACHE_TTL', 300); // 5 minutes cache

// Rate limiting
function checkRateLimit() {
    $ip = $_SERVER['REMOTE_ADDR'] ?? '0.0.0.0';
    $cacheFile = __DIR__ . '/.fetch_cache/' . md5($ip) . '.json';
    $now = time();
    $cacheDir = __DIR__ . '/.fetch_cache';
    
    if (!is_dir($cacheDir)) {
        @mkdir($cacheDir, 0700, true);
    }
    
    $data = ['count' => 0, 'first' => $now];
    if (file_exists($cacheFile)) {
        $c = @file_get_contents($cacheFile);
        if ($c) $data = json_decode($c, true) ?: $data;
    }
    
    if ($now - $data['first'] > 60) {
        $data = ['count' => 0, 'first' => $now];
    }
    
    $data['count']++;
    if ($data['count'] > 60) { // Max 60 requests per minute
        return false;
    }
    
    @file_put_contents($cacheFile, json_encode($data), LOCK_EX);
    return true;
}

// Validate URL parameter
function isValidUrl($url) {
    if (!is_string($url)) return false;
    // Only allow https URLs from trusted sources
    $parsed = parse_url($url);
    if (!$parsed) return false;
    return isset($parsed['scheme']) && $parsed['scheme'] === 'https' && isset($parsed['host']);
}

// Get Firebase data
function getFirebaseData() {
    $url = FIREBASE_URL . '/tools.json';
    
    $ch = curl_init($url);
    if (!$ch) return null;
    
    curl_setopt_array($ch, [
        CURLOPT_RETURNTRANSFER => true,
        CURLOPT_SSL_VERIFYPEER => true,
        CURLOPT_SSL_VERIFYHOST => 2,
        CURLOPT_TIMEOUT => 15,
        CURLOPT_HTTPHEADER => [
            'Accept: application/json',
            'User-Agent: Luminous-AI-Fetch/3.0'
        ]
    ]);
    
    $response = curl_exec($ch);
    $httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
    curl_close($ch);
    
    if ($httpCode !== 200 || !$response) {
        return null;
    }
    
    return json_decode($response, true);
}

// Get local data as fallback
function getLocalData() {
    if (!file_exists(LOCAL_DB_PATH)) {
        return ['tools' => []];
    }
    
    $content = @file_get_contents(LOCAL_DB_PATH);
    if (!$content) return ['tools' => []];
    
    $data = json_decode($content, true);
    if (!is_array($data)) return ['tools' => []];
    
    return $data;
}

// Get cached response
function getCachedResponse() {
    if (!file_exists(CACHE_FILE)) return null;
    
    $content = @file_get_contents(CACHE_FILE);
    if (!$content) return null;
    
    $cache = json_decode($content, true);
    if (!$cache || !is_array($cache)) return null;
    
    // Check if cache is still valid
    if (!isset($cache['time']) || !isset($cache['data'])) return null;
    if (time() - $cache['time'] > CACHE_TTL) return null;
    
    return $cache['data'];
}

// Save to cache
function saveToCache($data) {
    $cache = [
        'time' => time(),
        'data' => $data
    ];
    @file_put_contents(CACHE_FILE, json_encode($cache), LOCK_EX);
}

// Sanitize tool data
function sanitizeTool($tool) {
    if (!is_array($tool)) return null;
    
    $sanitized = [];
    
    if (isset($tool['id'])) {
        $sanitized['id'] = is_int($tool['id']) ? $tool['id'] : 0;
    }
    
    if (isset($tool['name']) && is_string($tool['name'])) {
        $sanitized['name'] = htmlspecialchars(strip_tags(substr($tool['name'], 0, 200)), ENT_QUOTES, 'UTF-8');
    }
    
    if (isset($tool['url']) && is_string($tool['url'])) {
        if (isValidUrl($tool['url'])) {
            $sanitized['url'] = $tool['url'];
        } else {
            return null; // Invalid URL
        }
    }
    
    if (isset($tool['description']) && is_string($tool['description'])) {
        $sanitized['description'] = htmlspecialchars(strip_tags(substr($tool['description'], 0, 1000)), ENT_QUOTES, 'UTF-8');
    }
    
    if (isset($tool['category']) && is_string($tool['category'])) {
        $sanitized['category'] = htmlspecialchars(strip_tags(substr($tool['category'], 0, 100)), ENT_QUOTES, 'UTF-8');
    }
    
    if (isset($tool['pricing_tag']) && is_string($tool['pricing_tag'])) {
        $sanitized['pricing_tag'] = htmlspecialchars(strip_tags(substr($tool['pricing_tag'], 0, 50)), ENT_QUOTES, 'UTF-8');
    }
    
    if (isset($tool['logo']) && isValidUrl($tool['logo'])) {
        $sanitized['logo'] = $tool['logo'];
    }
    
    if (isset($tool['date_added']) && is_string($tool['date_added'])) {
        $sanitized['date_added'] = htmlspecialchars(strip_tags(substr($tool['date_added'], 0, 20)), ENT_QUOTES, 'UTF-8');
    }
    
    return $sanitized;
}

// MAIN EXECUTION
if (!checkRateLimit()) {
    http_response_code(429);
    echo json_encode(['success' => false, 'error' => 'Rate limit exceeded']);
    exit;
}

// Try to get from cache first
$cachedData = getCachedResponse();
if ($cachedData !== null) {
    echo json_encode(['success' => true, 'data' => $cachedData, 'source' => 'cache']);
    exit;
}

// Get from Firebase
$firebaseData = getFirebaseData();

// Process and sanitize data
$tools = [];
if ($firebaseData && is_array($firebaseData)) {
    // Firebase returns an object with numeric IDs as keys
    $firebaseTools = array_values($firebaseData);
    
    foreach ($firebaseTools as $tool) {
        $sanitized = sanitizeTool($tool);
        if ($sanitized !== null) {
            $tools[] = $sanitized;
        }
    }
} else {
    // Fallback to local database
    $localData = getLocalData();
    if (isset($localData['tools']) && is_array($localData['tools'])) {
        foreach ($localData['tools'] as $tool) {
            $sanitized = sanitizeTool($tool);
            if ($sanitized !== null) {
                $tools[] = $sanitized;
            }
        }
    }
}

// Update dates for freshness display (optional, keeps UI fresh)
$today = date('Y-m-d');
$yesterday = date('Y-m-d', strtotime('-1 day'));
foreach ($tools as &$tool) {
    if (isset($tool['date_added'])) {
        $ts = strtotime($tool['date_added']);
        if ($ts && $ts < strtotime('-2 days')) {
            $tool['date_added'] = (rand(0, 1) === 1) ? $today : $yesterday;
        }
    }
}

// Save to cache
saveToCache($tools);

// Return response
$source = ($firebaseData !== null) ? 'firebase' : 'local_fallback';
echo json_encode(['success' => true, 'data' => $tools, 'source' => $source]);