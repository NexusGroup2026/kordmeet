<?php
/**
 * ============================================================
 * API ENDPOINT - SECURE VERSION
 * ============================================================
 */

error_reporting(0);
header('Content-Type: application/json');
header('X-Content-Type-Options: nosniff');
header('X-Frame-Options: DENY');

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

// Get input
$method = $_SERVER['REQUEST_METHOD'];
$rawInput = file_get_contents('php://input');
$input = json_decode($rawInput, true);

// Validate action
$action = isset($_GET['action']) ? preg_replace('/[^a-zA-Z0-9_]/', '', $_GET['action']) : '';

if (empty($action)) {
    http_response_code(400);
    echo json_encode(['error' => 'Missing action']);
    exit;
}

switch ($action) {
    case 'get_tools':
        // Rate limited elsewhere in ia_fetch.php
        $ch = curl_init(FIREBASE_URL . '/tools.json');
        curl_setopt_array($ch, [
            CURLOPT_RETURNTRANSFER => true,
            CURLOPT_SSL_VERIFYPEER => true,
            CURLOPT_TIMEOUT => 15
        ]);
        $response = curl_exec($ch);
        curl_close($ch);
        $tools = json_decode($response, true) ?: [];
        echo json_encode(['success' => true, 'tools' => array_values($tools)]);
        break;
        
    case 'get_changelog':
        $ch = curl_init(FIREBASE_URL . '/changelog.json?orderBy="timestamp"&limitToLast=20');
        curl_setopt_array($ch, [
            CURLOPT_RETURNTRANSFER => true,
            CURLOPT_SSL_VERIFYPEER => true,
            CURLOPT_TIMEOUT => 15
        ]);
        $response = curl_exec($ch);
        curl_close($ch);
        $changelog = json_decode($response, true) ?: [];
        echo json_encode(['success' => true, 'changelog' => array_values($changelog)]);
        break;
        
    case 'get_supporters':
        $ch = curl_init(FIREBASE_URL . '/supporters.json');
        curl_setopt_array($ch, [
            CURLOPT_RETURNTRANSFER => true,
            CURLOPT_SSL_VERIFYPEER => true,
            CURLOPT_TIMEOUT => 15
        ]);
        $response = curl_exec($ch);
        curl_close($ch);
        $supporters = json_decode($response, true) ?: [];
        
        // Sort by amount
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
        
        echo json_encode(['success' => true, 'supporters' => array_slice($sorted, 0, 50)]);
        break;
        
    case 'get_stats':
        $ch = curl_init(FIREBASE_URL . '/popular_stats.json');
        curl_setopt_array($ch, [
            CURLOPT_RETURNTRANSFER => true,
            CURLOPT_SSL_VERIFYPEER => true,
            CURLOPT_TIMEOUT => 15
        ]);
        $response = curl_exec($ch);
        curl_close($ch);
        $stats = json_decode($response, true) ?: [];
        echo json_encode(['success' => true, 'stats' => $stats]);
        break;
        
    case 'record_bug':
        if ($method !== 'POST') {
            http_response_code(405);
            echo json_encode(['error' => 'Method not allowed']);
            exit;
        }
        
        if (!$input || !is_array($input)) {
            http_response_code(400);
            echo json_encode(['error' => 'Invalid input']);
            exit;
        }
        
        // Validate and sanitize
        $type = isset($input['type']) ? preg_replace('/[^a-zA-Z0-9_\s]/', '', substr($input['type'], 0, 50)) : '';
        $description = isset($input['description']) ? strip_tags(substr($input['description'], 0, 2000)) : '';
        $page = isset($input['page']) ? preg_replace('/[^a-zA-Z0-9_\-\.\/]/', '', substr($input['page'], 0, 100)) : '';
        
        if (empty($type) || empty($description)) {
            http_response_code(400);
            echo json_encode(['error' => 'Missing required fields']);
            exit;
        }
        
        $report = [
            'type' => htmlspecialchars($type, ENT_QUOTES, 'UTF-8'),
            'description' => htmlspecialchars($description, ENT_QUOTES, 'UTF-8'),
            'page' => htmlspecialchars($page, ENT_QUOTES, 'UTF-8'),
            'timestamp' => time(),
            'user_agent' => substr($_SERVER['HTTP_USER_AGENT'] ?? 'Unknown', 0, 200)
        ];
        
        $ch = curl_init(FIREBASE_URL . '/bug_reports.json');
        curl_setopt_array($ch, [
            CURLOPT_POST => true,
            CURLOPT_POSTFIELDS => json_encode($report),
            CURLOPT_RETURNTRANSFER => true,
            CURLOPT_SSL_VERIFYPEER => true,
            CURLOPT_HTTPHEADER => ['Content-Type: application/json']
        ]);
        curl_exec($ch);
        curl_close($ch);
        
        echo json_encode(['success' => true]);
        break;
        
    case 'log_security':
        // Internal security logging - no input validation needed
        if ($method !== 'POST') {
            http_response_code(405);
            echo json_encode(['error' => 'Method not allowed']);
            exit;
        }
        // Silent acknowledge - don't reveal internal details
        echo json_encode(['success' => true]);
        break;
        
    default:
        http_response_code(400);
        echo json_encode(['error' => 'Unknown action']);
}