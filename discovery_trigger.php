<?php
/**
 * ============================================================
 * DISCOVERY TRIGGER - SECURE VERSION
 * ============================================================
 */

error_reporting(0);
header('Content-Type: application/json');
header('X-Content-Type-Options: nosniff');

define('FIREBASE_URL', 'https://kakaxicenter-default-rtdb.firebaseio.com');

// Rate limiting
$ip = $_SERVER['REMOTE_ADDR'] ?? '0.0.0.0';
$cacheFile = __DIR__ . '/.discovery_cache/' . md5($ip) . '.json';
$now = time();
$cacheDir = __DIR__ . '/.discovery_cache';

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
if ($data['count'] > 30) {
    http_response_code(429);
    echo json_encode(['error' => 'Rate limit exceeded']);
    exit;
}

@file_put_contents($cacheFile, json_encode($data), LOCK_EX);

// Get JSON input
$rawInput = file_get_contents('php://input');
$input = json_decode($rawInput, true);

if (!$input || !is_array($input)) {
    http_response_code(400);
    echo json_encode(['error' => 'Invalid JSON']);
    exit;
}

// Validate query term
$query = isset($input['query']) ? trim($input['query']) : '';
if (strlen($query) < 2 || strlen($query) > 100) {
    http_response_code(400);
    echo json_encode(['error' => 'Invalid query length']);
    exit;
}

// Sanitize query - only allow alphanumeric, spaces, hyphens
$query = preg_replace('/[^a-zA-Z0-9\s\-]/', '', $query);
if (empty($query)) {
    http_response_code(400);
    echo json_encode(['error' => 'Invalid query characters']);
    exit;
}

// Block inappropriate terms
$blockedTerms = ['porn', 'sex', 'nude', 'adult', 'gore', 'hitman', 'hack'];
$queryLower = strtolower($query);
foreach ($blockedTerms as $term) {
    if (strpos($queryLower, $term) !== false) {
        http_response_code(400);
        echo json_encode(['error' => 'Query blocked']);
        exit;
    }
}

// Add to Firebase discovery queue
$safeQuery = htmlspecialchars($query, ENT_QUOTES, 'UTF-8');
$entry = [
    'query' => $safeQuery,
    'added_at' => time(),
    'ip' => md5($ip), // Hash IP for privacy
    'user_agent' => substr($_SERVER['HTTP_USER_AGENT'] ?? 'Unknown', 0, 100)
];

$ch = curl_init(FIREBASE_URL . '/discovery_queue.json');
curl_setopt_array($ch, [
    CURLOPT_POST => true,
    CURLOPT_POSTFIELDS => json_encode($safeQuery),
    CURLOPT_RETURNTRANSFER => true,
    CURLOPT_SSL_VERIFYPEER => true,
    CURLOPT_HTTPHEADER => ['Content-Type: application/json']
]);

$result = curl_exec($ch);
$httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
curl_close($ch);

if ($httpCode === 200) {
    echo json_encode(['success' => true, 'message' => 'Query added to discovery queue']);
} else {
    http_response_code(500);
    echo json_encode(['error' => 'Failed to add query']);
}