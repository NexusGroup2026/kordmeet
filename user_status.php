<?php
/**
 * ============================================================
 * USER STATUS CHECK - SECURE VERSION
 * ============================================================
 */

error_reporting(0);
header('Content-Type: application/json');
header('X-Content-Type-Options: nosniff');

// Allow CORS only from your own domain
$allowedOrigins = ['https://kord.gg', 'https://www.kord.gg'];
$origin = $_SERVER['HTTP_ORIGIN'] ?? '';
if (in_array($origin, $allowedOrigins)) {
    header("Access-Control-Allow-Origin: $origin");
} else {
    // Default to restrictive
    header('Access-Control-Allow-Origin: https://kord.gg');
}

// Rate limiting
$ip = $_SERVER['REMOTE_ADDR'] ?? '0.0.0.0';
$cacheFile = __DIR__ . '/.status_cache/' . md5($ip) . '.json';
$now = time();
$cacheDir = __DIR__ . '/.status_cache';

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
if ($data['count'] > 60) {
    http_response_code(429);
    echo json_encode(['success' => false, 'error' => 'Rate limit exceeded']);
    exit;
}

@file_put_contents($cacheFile, json_encode($data), LOCK_EX);

// Get JSON input
$rawInput = file_get_contents('php://input');
$input = json_decode($rawInput, true);

if (!$input || !is_array($input)) {
    echo json_encode(['success' => false, 'error' => 'Invalid request']);
    exit;
}

// Validate and sanitize email
$email = $input['email'] ?? '';
if (empty($email)) {
    echo json_encode(['success' => false, 'error' => 'Email required']);
    exit;
}

// Strict email validation
$email = filter_var($email, FILTER_SANITIZE_EMAIL);
if (!$email || !filter_var($email, FILTER_VALIDATE_EMAIL)) {
    echo json_encode(['success' => false, 'error' => 'Invalid email format']);
    exit;
}

// Block disposable email domains
$blockedDomains = ['tempmail.com', 'throwaway.com', 'mailinator.com', 'guerrillamail.com', 'temp-mail.org'];
$emailDomain = strtolower(explode('@', $email)[1] ?? '');
if (in_array($emailDomain, $blockedDomains)) {
    echo json_encode(['success' => false, 'error' => 'Email domain not allowed']);
    exit;
}

// Sanitize for Firebase key
$safeKey = preg_replace('/[.#$\[\]\/]/', '_', $email);
$safeKey = preg_replace('/[^a-zA-Z0-9_-]/', '', substr($safeKey, 0, 100));

if (empty($safeKey)) {
    echo json_encode(['success' => false, 'error' => 'Invalid email']);
    exit;
}

// Firebase URL with validation
$firebaseUrl = "https://kakaxicenter-default-rtdb.firebaseio.com/users/{$safeKey}.json";
if (!preg_match('/^https:\/\/kakaxicenter-[a-z0-9-]+\.firebaseio\.com\/users\/[a-zA-Z0-9_-]+\.json$/', $firebaseUrl)) {
    echo json_encode(['success' => false, 'error' => 'Invalid request']);
    exit;
}

$ch = curl_init($firebaseUrl);
curl_setopt_array($ch, [
    CURLOPT_RETURNTRANSFER => true,
    CURLOPT_SSL_VERIFYPEER => true, // Changed to true for security
    CURLOPT_SSL_VERIFYHOST => 2,
    CURLOPT_TIMEOUT => 15,
    CURLOPT_HTTPHEADER => [
        'Accept: application/json',
        'User-Agent: Luminous-Status-Check/3.0'
    ]
]);

$response = curl_exec($ch);
$httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
$error = curl_error($ch);
curl_close($ch);

if ($error || $httpCode !== 200) {
    echo json_encode(['success' => false, 'error' => 'Service unavailable']);
    exit;
}

$userData = json_decode($response, true);

if (!$userData || !is_array($userData)) {
    echo json_encode([
        'success' => true,
        'active' => false,
        'days_left' => 0,
        'expires_date' => null
    ]);
    exit;
}

$active = false;
$expiresAt = 0;
$daysLeft = 0;

if (isset($userData['subscription_expires_at'])) {
    $expiresAt = intval($userData['subscription_expires_at']);
    $now = time();

    if ($expiresAt > $now) {
        $active = true;
        $diff = $expiresAt - $now;
        $daysLeft = ceil($diff / (60 * 60 * 24));
    }
}

echo json_encode([
    'success' => true,
    'active' => $active,
    'days_left' => $daysLeft,
    'expires_date' => $expiresAt > 0 ? date('d/m/Y', $expiresAt) : null
]);