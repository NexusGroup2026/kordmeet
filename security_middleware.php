<?php
/**
 * ============================================================
 * LUMINOUS SECURITY MIDDLEWARE v4.0
 * Include at the top of every PHP file
 * ============================================================
 */

// Prevent direct access
if (basename($_SERVER['PHP_SELF']) === basename(__FILE__)) {
    http_response_code(403);
    exit('Direct access forbidden');
}

// ============================================================
// 1. SECURE SESSION CONFIGURATION
// ============================================================
if (session_status() === PHP_SESSION_NONE) {
    ini_set('session.cookie_httponly', 1);
    ini_set('session.cookie_secure', 1);
    ini_set('session.cookie_samesite', 'Strict');
    ini_set('session.use_strict_mode', 1);
    ini_set('session.gc_maxlifetime', 1800);
    ini_set('session.cookie_lifetime', 0);
    session_start();
}

// Regenerate session ID periodically
if (!isset($_SESSION['_last_regen'])) {
    $_SESSION['_last_regen'] = time();
} elseif (time() - $_SESSION['_last_regen'] > 300) {
    session_regenerate_id(true);
    $_SESSION['_last_regen'] = time();
}

// ============================================================
// 2. INPUT SANITIZATION FUNCTIONS
// ============================================================
function secureSanitize($input, $type = 'string') {
    if ($input === null || $input === '') return '';
    
    if (is_array($input)) {
        return array_map('secureSanitize', $input);
    }
    
    $input = trim($input);
    
    switch ($type) {
        case 'email':
            $input = filter_var($input, FILTER_SANITIZE_EMAIL);
            if (!filter_var($input, FILTER_VALIDATE_EMAIL)) return '';
            return strtolower($input);
            
        case 'int':
        case 'integer':
            return intval($input);
            
        case 'float':
        case 'double':
            return floatval($input);
            
        case 'url':
            $input = filter_var($input, FILTER_SANITIZE_URL);
            if (!filter_var($input, FILTER_VALIDATE_URL)) return '';
            if (!preg_match('/^https?:\/\//', $input)) return '';
            return $input;
            
        case 'html':
            return htmlspecialchars(strip_tags($input, '<b><i><u><strong><em><a><ul><ol><li>'), ENT_QUOTES | ENT_HTML5, 'UTF-8');
            
        case 'key':
            // Firebase-safe key
            return preg_replace('/[.#$\[\]\/]/', '_', substr($input, 0, 100));
            
        case 'alnum':
            return preg_replace('/[^a-zA-Z0-9]/', '', $input);
            
        case 'username':
            return preg_replace('/[^a-zA-Z0-9_-]/', '', substr($input, 0, 32));
            
        case 'filename':
            return preg_replace('/[^a-zA-Z0-9._-]/', '', substr($input, 0, 255));
            
        case 'path':
            // Only allow safe path characters
            return preg_replace('/[^\w\s\/. -]/', '', $input);
            
        default: // string
            return htmlspecialchars($input, ENT_QUOTES | ENT_HTML5, 'UTF-8');
    }
}

// ============================================================
// 3. CSRF PROTECTION
// ============================================================
function csrfGenerateToken() {
    if (!isset($_SESSION['csrf_token'])) {
        $_SESSION['csrf_token'] = bin2hex(random_bytes(32));
    }
    return $_SESSION['csrf_token'];
}

function csrfValidateToken($token) {
    if (!isset($_SESSION['csrf_token']) || !isset($token)) {
        return false;
    }
    return hash_equals($_SESSION['csrf_token'], $token);
}

function csrfField() {
    return '<input type="hidden" name="csrf_token" value="' . csrfGenerateToken() . '">';
}

// Generate CSRF token for AJAX
if (isset($_SESSION['csrf_token']) === false) {
    csrfGenerateToken();
}
$csrf_token_js = $_SESSION['csrf_token'] ?? '';

// ============================================================
// 4. PASSWORD HASHING (For reference, use bcrypt)
// ============================================================
function secureHash($password) {
    return password_hash($password, PASSWORD_ARGON2ID, [
        'memory_cost' => 65536,
        'time_cost' => 4,
        'threads' => 3
    ]);
}

function secureVerify($password, $hash) {
    return password_verify($password, $hash);
}

// ============================================================
// 5. SECURE OUTPUT
// ============================================================
function secureJson($data, $code = 200) {
    http_response_code($code);
    header('Content-Type: application/json');
    header('X-Content-Type-Options: nosniff');
    echo json_encode($data, JSON_HEX_TAG | JSON_HEX_APOS | JSON_HEX_QUOT | JSON_HEX_AMP);
    exit;
}

function secureText($text, $code = 200) {
    http_response_code($code);
    header('Content-Type: text/plain');
    header('X-Content-Type-Options: nosniff');
    echo $text;
    exit;
}

// ============================================================
// 6. RATE LIMITING HELPERS
// ============================================================
function rateLimit($ip, $maxPerMinute = 60, $maxPerHour = 1000) {
    $cacheDir = __DIR__ . '/.rl_cache';
    if (!is_dir($cacheDir)) mkdir($cacheDir, 0700, true);
    
    $file = $cacheDir . '/' . md5($ip) . '.json';
    $now = time();
    $data = ['min' => [], 'hour' => []];
    
    if (file_exists($file)) {
        $content = file_get_contents($file);
        if ($content) $data = json_decode($content, true) ?: $data;
    }
    
    // Clean old entries
    $data['min'] = array_values(array_filter($data['min'], fn($t) => $now - $t < 60));
    $data['hour'] = array_values(array_filter($data['hour'], fn($t) => $now - $t < 3600));
    
    // Check limits
    if (count($data['min']) >= $maxPerMinute) {
        return ['allowed' => false, 'reason' => 'minute_limit', 'retry' => 60 - ($now - end($data['min']))];
    }
    
    if (count($data['hour']) >= $maxPerHour) {
        return ['allowed' => false, 'reason' => 'hour_limit', 'retry' => 3600 - ($now - end($data['hour']))];
    }
    
    // Add current request
    $data['min'][] = $now;
    $data['hour'][] = $now;
    
    file_put_contents($file, json_encode($data), LOCK_EX);
    
    return ['allowed' => true, 'remaining_min' => $maxPerMinute - count($data['min']), 'remaining_hour' => $maxPerHour - count($data['hour'])];
}

// ============================================================
// 7. SECURITY HEADERS
// ============================================================
function setSecurityHeaders() {
    header('X-Content-Type-Options: nosniff');
    header('X-Frame-Options: SAMEORIGIN');
    header('X-XSS-Protection: 1; mode=block');
    header('X-Robots-Tag: noindex, nofollow');
    header('Referrer-Policy: strict-origin-when-cross-origin');
    header('Permissions-Policy: accelerometer=(), camera=(), microphone=(), geolocation=()');
    header('Cache-Control: no-store, no-cache, must-revalidate');
    header('Pragma: no-cache');
}

// Apply headers
setSecurityHeaders();

// ============================================================
// 8. IP BLOCKING HELPER
// ============================================================
function isIPBlocked($ip = null) {
    $ip = $ip ?? ($_SERVER['REMOTE_ADDR'] ?? '0.0.0.0');
    $file = __DIR__ . '/.blocked_ips.json';
    
    if (!file_exists($file)) return false;
    
    $blocked = json_decode(file_get_contents($file), true) ?: [];
    
    foreach ($blocked as $entry) {
        if ($entry['ip'] === $ip) {
            // Check if block expired (1 hour)
            if (time() - $entry['time'] < 3600) {
                return true;
            }
        }
    }
    
    return false;
}

function blockIP($ip, $reason = 'manual') {
    $file = __DIR__ . '/.blocked_ips.json';
    $blocked = file_exists($file) ? json_decode(file_get_contents($file), true) ?: [] : [];
    
    $blocked[$ip] = ['ip' => $ip, 'reason' => $reason, 'time' => time()];
    
    file_put_contents($file, json_encode($blocked), LOCK_EX);
}

// ============================================================
// 9. LOGGING
// ============================================================
function securityLog($type, $data = [], $ip = null) {
    $logFile = __DIR__ . '/.security_log.txt';
    $entry = [
        'time' => date('Y-m-d H:i:s'),
        'type' => $type,
        'ip' => $ip ?? ($_SERVER['REMOTE_ADDR'] ?? 'unknown'),
        'user' => $_SESSION['user_email'] ?? 'anon',
        'data' => $data
    ];
    
    // Sanitize for log
    $entry['data'] = array_map(function($v) {
        if (is_string($v)) return preg_replace('/[^\x20-\x7E]/', '', substr($v, 0, 200));
        return $v;
    }, $entry['data']);
    
    $line = json_encode($entry) . "\n";
    
    @file_put_contents($logFile, $line, FILE_APPEND);
}

// ============================================================
// 10. VALIDATION HELPERS
// ============================================================
function validateRequired($data, $fields) {
    $missing = [];
    foreach ($fields as $field) {
        if (!isset($data[$field]) || $data[$field] === '' || $data[$field] === null) {
            $missing[] = $field;
        }
    }
    return empty($missing) ? true : $missing;
}

function validateLength($str, $min = 0, $max = PHP_INT_MAX) {
    $len = strlen($str);
    return $len >= $min && $len <= $max;
}

function validatePattern($str, $pattern) {
    return preg_match($pattern, $str) === 1;
}

function validateEmailList($emails) {
    if (!is_array($emails)) $emails = [$emails];
    foreach ($emails as $email) {
        if (!filter_var($email, FILTER_VALIDATE_EMAIL)) return false;
    }
    return true;
}

// ============================================================
// 11. FIREBASE SAFE KEY GENERATION
// ============================================================
function firebaseKey($email) {
    $key = strtolower(trim($email));
    $key = preg_replace('/[.#$\[\]\/]/', '_', $key);
    $key = preg_replace('/[^a-z0-9@._-]/', '', $key);
    return substr($key, 0, 100);
}

// ============================================================
// 12. REQUEST VALIDATION
// ============================================================
function validateRequestOrigin() {
    $origin = $_SERVER['HTTP_ORIGIN'] ?? '';
    $allowed = ['https://kord.gg', 'https://www.kord.gg'];
    
    if (!empty($origin) && !in_array($origin, $allowed)) {
        securityLog('INVALID_ORIGIN', ['origin' => $origin]);
        return false;
    }
    
    return true;
}

// Check for common attack patterns
function detectInjection($input) {
    if (!is_string($input)) return false;
    
    $patterns = [
        '/\b(SELECT|INSERT|UPDATE|DELETE|DROP|UNION|EXEC)\b/i',
        '/<script/i',
        '/javascript:/i',
        '/on\w+=/i',
        '/\.\.\//i',
        '/\x00/i',
        '/\r\n/i'
    ];
    
    foreach ($patterns as $pattern) {
        if (preg_match($pattern, $input)) return true;
    }
    
    return false;
}

// ============================================================
// 13. ANTI-automation
// ============================================================
function checkAutomation() {
    // Check for automation tools
    $ua = $_SERVER['HTTP_USER_AGENT'] ?? '';
    
    $bots = ['curl', 'wget', 'python', 'scrapy', 'requests', 'java/', 'go-http', 'axios'];
    
    foreach ($bots as $bot) {
        if (stripos($ua, $bot) !== false) {
            securityLog('BOT_DETECTED', ['ua' => $ua]);
            return true;
        }
    }
    
    // Check for missing Accept-Language (humans usually have this)
    if (!isset($_SERVER['HTTP_ACCEPT_LANGUAGE']) && !isset($_SERVER['HTTP_ACCEPT'])) {
        securityLog('NO_ACCEPT_HEADERS', []);
        // Don't block, just log
    }
    
    return false;
}

// ============================================================
// EXPORT CSRF TOKEN FOR JS
// ============================================================
$_csrf_js = $csrf_token_js ?? '';
$_sec_version = '4.0.0';