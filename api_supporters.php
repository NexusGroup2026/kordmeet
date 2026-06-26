<?php
/**
 * ============================================================
 * API SUPPORTES - SECURE VERSION
 * ============================================================
 */

error_reporting(0);
header('Content-Type: application/json');
header('X-Content-Type-Options: nosniff');

define('FIREBASE_URL', 'https://kakaxicenter-default-rtdb.firebaseio.com');

// Rate limiting
$ip = $_SERVER['REMOTE_ADDR'] ?? '0.0.0.0';
$cacheFile = __DIR__ . '/.api_cache/' . md5($ip) . '.json';
$now = time();
$cacheDir = __DIR__ . '/.api_cache';

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
if ($data['count'] > 100) {
    http_response_code(429);
    echo json_encode(['error' => 'Rate limit exceeded']);
    exit;
}

@file_put_contents($cacheFile, json_encode($data), LOCK_EX);

// Get supporters data
$ch = curl_init(FIREBASE_URL . '/supporters.json');
curl_setopt_array($ch, [
    CURLOPT_RETURNTRANSFER => true,
    CURLOPT_SSL_VERIFYPEER => true,
    CURLOPT_TIMEOUT => 15
]);

$response = curl_exec($ch);
$httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
curl_close($ch);

if ($httpCode !== 200) {
    http_response_code(500);
    echo json_encode(['error' => 'Database unavailable']);
    exit;
}

$supporters = json_decode($response, true);
if (!$supporters || !is_array($supporters)) {
    echo json_encode(['supporters' => []]);
    exit;
}

// Sort by total_amount descending
$sorted = [];
foreach ($supporters as $key => $s) {
    if (is_array($s)) {
        $s['_key'] = $key;
        $sorted[] = $s;
    }
}

usort($sorted, function($a, $b) {
    return ($b['total_amount'] ?? 0) - ($a['total_amount'] ?? 0);
});

// Return top 50
$top = array_slice($sorted, 0, 50);

echo json_encode(['supporters' => $top]);