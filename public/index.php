<?php
/**
 * Kord Meet - Entry Point
 * All traffic goes through here in production
 */

require_once __DIR__ . '/../config.php';

// Route: serve app for all non-API, non-asset requests
$uri = parse_url($_SERVER['REQUEST_URI'], PHP_URL_PATH);
$path = parse_url($uri, PHP_URL_PATH);

// Static assets
if (preg_match('/\.(css|js|png|jpg|jpeg|gif|svg|ico|woff2?|ttf|eot|map)$/', $path)) {
    $file = __DIR__ . '/../app/' . $path;
    if (file_exists($file)) {
        $ext = pathinfo($file, PATHINFO_EXTENSION);
        $mime = [
            'css' => 'text/css', 'js' => 'application/javascript',
            'png' => 'image/png', 'jpg' => 'image/jpeg', 'jpeg' => 'image/jpeg',
            'gif' => 'image/gif', 'svg' => 'image/svg+xml', 'ico' => 'image/x-icon',
            'woff2' => 'font/woff2', 'woff' => 'font/woff', 'ttf' => 'font/ttf',
            'map' => 'application/json'
        ];
        header('Content-Type: ' . ($mime[$ext] ?? 'application/octet-stream'));
        header('Cache-Control: public, max-age=604800'); // 1 week
        readfile($file);
        exit;
    }
}

// API routes
if (strpos($path, '/api/') === 0 || strpos($path, '/proxy.php') === 0) {
    require_once __DIR__ . '/../api/routes/index.php';
    exit;
}

// SPA fallback — serve app/index.html
$appHtml = __DIR__ . '/../app/index.html';
if (file_exists($appHtml)) {
    // Inject config into page
    $configJs = '<script>window.KORD_FIREBASE_CONFIG = ' . json_encode([
        'apiKey' => FIREBASE_API_KEY,
        'authDomain' => FIREBASE_AUTH_DOMAIN,
        'databaseURL' => FIREBASE_DATABASE_URL,
        'projectId' => FIREBASE_PROJECT_ID,
        'storageBucket' => FIREBASE_STORAGE_BUCKET,
        'messagingSenderId' => FIREBASE_MESSAGING_SENDER_ID,
        'appId' => FIREBASE_APP_ID,
    ]) . ';</script>';
    
    $html = file_get_contents($appHtml);
    $html = str_replace('</head>', $configJs . '</head>', $html);
    echo $html;
} else {
    http_response_code(503);
    echo '<h1>503 Service Unavailable</h1><p>App not deployed. Run build first.</p>';
}