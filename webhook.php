<?php
/**
 * ============================================================
 * WEBHOOK HANDLER - MAXIMUM SECURITY
 * ============================================================
 */

error_reporting(0);
header('Content-Type: application/json');
header('X-Content-Type-Options: nosniff');
header('X-Frame-Options: DENY');

// Configuration
define('FIREBASE_URL', 'https://kakaxicenter-default-rtdb.firebaseio.com');
define('LOG_FILE', __DIR__ . '/webhook_log.txt');
define('MAX_REQUESTS_PER_MINUTE', 20);

// Rate limiting
function checkRateLimit($ip) {
    $cacheFile = __DIR__ . '/.webhook_cache/' . md5($ip) . '.json';
    $now = time();
    $cacheDir = __DIR__ . '/.webhook_cache';
    if (!is_dir($cacheDir)) {
        mkdir($cacheDir, 0700, true);
    }
    
    $data = ['count' => 0, 'first_request' => $now];
    if (file_exists($cacheFile)) {
        $content = @file_get_contents($cacheFile);
        if ($content) $data = json_decode($content, true) ?: $data;
    }
    
    if ($now - $data['first_request'] > 60) {
        $data = ['count' => 0, 'first_request' => $now];
    }
    
    $data['count']++;
    if ($data['count'] > MAX_REQUESTS_PER_MINUTE) return false;
    
    file_put_contents($cacheFile, json_encode($data), LOCK_EX);
    return true;
}

// Sanitization
function sanitizeKey($key) {
    if (!$key || !is_string($key)) return '';
    $key = preg_replace('/[.#$\[\]\/]/', '_', $key);
    return preg_replace('/[^a-zA-Z0-9_-]/', '', substr($key, 0, 100));
}

function validateJson($data) {
    if (!is_array($data)) return false;
    $json = json_encode($data);
    if (!$json) return false;
    // Check for suspicious patterns
    if (preg_match('/(<script|javascript:|on\w+=|\$\{)/i', $json)) return false;
    return true;
}

function logWebhook($msg) {
    $msg = preg_replace('/[^\x20-\x7E]/', '', $msg);
    @file_put_contents(LOG_FILE, date('Y-m-d H:i:s') . " - " . $msg . "\n", FILE_APPEND);
}

function firebasePut($path, $data) {
    $url = FIREBASE_URL . $path . ".json";
    if (!preg_match('/^\/[a-zA-Z0-9_\/]+$/', $path)) return null;
    
    $ch = curl_init($url);
    if (!$ch) return null;
    
    $jsonData = json_encode($data, JSON_HEX_TAG | JSON_HEX_APOS | JSON_HEX_QUOT | JSON_HEX_AMP);
    
    curl_setopt_array($ch, [
        CURLOPT_CUSTOMREQUEST => 'PUT',
        CURLOPT_POSTFIELDS => $jsonData,
        CURLOPT_RETURNTRANSFER => true,
        CURLOPT_SSL_VERIFYPEER => true,
        CURLOPT_HTTPHEADER => ['Content-Type: application/json'],
        CURLOPT_TIMEOUT => 30
    ]);
    
    $result = curl_exec($ch);
    curl_close($ch);
    return json_decode($result, true);
}

function firebaseGet($path) {
    $url = FIREBASE_URL . $path . ".json";
    if (!preg_match('/^\/[a-zA-Z0-9_\/]+$/', $path)) return null;
    
    $ch = curl_init($url);
    if (!$ch) return null;
    
    curl_setopt_array($ch, [
        CURLOPT_RETURNTRANSFER => true,
        CURLOPT_SSL_VERIFYPEER => true,
        CURLOPT_TIMEOUT => 30
    ]);
    
    $result = curl_exec($ch);
    curl_close($ch);
    return json_decode($result, true);
}

// Rate limit check
$clientIP = $_SERVER['REMOTE_ADDR'] ?? '0.0.0.0';
if (!checkRateLimit($clientIP)) {
    logWebhook("Rate limit exceeded for IP: $clientIP");
    http_response_code(429);
    echo json_encode(['status' => 'error', 'message' => 'Rate limit exceeded']);
    exit;
}

// Get input
$rawInput = file_get_contents('php://input');
if (strlen($rawInput) > 10240) {
    http_response_code(400);
    echo json_encode(['status' => 'error', 'message' => 'Request too large']);
    exit;
}

$data = json_decode($rawInput, true);
if (!$data || !validateJson($data)) {
    http_response_code(400);
    echo json_encode(['status' => 'error', 'message' => 'Invalid JSON']);
    exit;
}

// Validate required fields
$status = isset($data['status']) ? strtoupper(sanitizeKey($data['status'])) : '';
$externalId = isset($data['external_id']) ? sanitizeKey($data['external_id']) : (isset($data['reference_id']) ? sanitizeKey($data['reference_id']) : '');

if (!$externalId) {
    http_response_code(400);
    echo json_encode(['status' => 'error', 'message' => 'Missing external_id']);
    exit;
}

if (!in_array($status, ['PAID', 'COMPLETED', 'PENDING', 'FAILED'])) {
    logWebhook("Invalid status: $status");
    http_response_code(400);
    echo json_encode(['status' => 'error', 'message' => 'Invalid status']);
    exit;
}

if ($status === 'PAID' || $status === 'COMPLETED') {
    // Get transaction from Firebase
    $txData = firebaseGet("/transactions/$externalId");
    
    if ($txData && is_array($txData)) {
        // Update transaction status
        $txData['status'] = $status;
        $txData['updated_at'] = time();
        firebasePut("/transactions/$externalId", $txData);
        
        // Update user subscription if applicable
        $userEmail = $txData['userid'] ?? null;
        
        if ($userEmail && is_string($userEmail) && strpos($userEmail, '@') !== false) {
            $safeKey = str_replace(['.', '$', '#', '[', ']', '/'], '_', $userEmail);
            $safeKey = preg_replace('/[^a-zA-Z0-9_-]/', '', substr($safeKey, 0, 100));
            
            if ($safeKey) {
                $userData = firebaseGet("/users/$safeKey") ?: [];
                
                $currentExpires = $userData['subscription_expires_at'] ?? 0;
                $now = time();
                
                if ($currentExpires > $now) {
                    $newExpires = $currentExpires + (30 * 24 * 60 * 60);
                } else {
                    $newExpires = $now + (30 * 24 * 60 * 60);
                }
                
                // Validate and sanitize email
                $safeEmail = filter_var($userEmail, FILTER_SANITIZE_EMAIL);
                if ($safeEmail && filter_var($safeEmail, FILTER_VALIDATE_EMAIL)) {
                    $userData['email'] = $safeEmail;
                    $userData['subscription_expires_at'] = $newExpires;
                    $userData['last_payment_date'] = time();
                    $userData['last_tx_id'] = $externalId;
                    
                    firebasePut("/users/$safeKey", $userData);
                    logWebhook("Subscription updated for: $safeEmail. New Expiry: " . date('Y-m-d', $newExpires));
                }
            }
        }
    }
}

echo json_encode(['status' => 'success']);
logWebhook("Webhook processed: $externalId - $status");