<?php
/**
 * Rate Limiter - Token Bucket Algorithm with Sliding Window
 * 
 * Two tiers: per-IP (100 req/min) and per-UID (200 req/min)
 * File-based storage in temp/rate_limits/
 */

if (!defined('KORD_API_INIT')) {
    die('Direct access forbidden');
}

class RateLimit {
    
    // Configuration
    private static $ipLimit = 100;
    private static $ipWindow = 60;
    private static $ipBurst = 20;
    
    private static $uidLimit = 200;
    private static $uidWindow = 60;
    private static $uidBurst = 40;
    
    private static $storagePath;
    private static $cleanupProbability = 0.01; // 1% chance to cleanup on each request
    
    /**
     * Initialize rate limiter
     */
    public static function init() {
        self::$storagePath = defined('RATE_LIMIT_PATH') ? RATE_LIMIT_PATH : __DIR__ . '/../temp/rate_limits/';
        
        // Ensure storage directory exists
        if (!is_dir(self::$storagePath)) {
            mkdir(self::$storagePath, 0755, true);
        }
        
        // Load config if available
        if (defined('RATE_LIMIT_IP_REQUESTS')) {
            self::$ipLimit = RATE_LIMIT_IP_REQUESTS;
            self::$ipWindow = RATE_LIMIT_IP_WINDOW;
            self::$uidLimit = RATE_LIMIT_UID_REQUESTS;
            self::$uidWindow = RATE_LIMIT_UID_WINDOW;
            self::$ipBurst = defined('RATE_LIMIT_BURST_IP') ? RATE_LIMIT_BURST_IP : 20;
            self::$uidBurst = defined('RATE_LIMIT_BURST_UID') ? RATE_LIMIT_BURST_UID : 40;
        }
        
        // Random cleanup to prevent file accumulation
        if (mt_rand(1, 100) <= (self::$cleanupProbability * 100)) {
            self::cleanup();
        }
    }
    
    /**
     * Check rate limit for an identifier
     * 
     * @param string $identifier IP address or UID
     * @param string $tier 'ip' or 'uid'
     * @return array ['allowed' => bool, 'remaining' => int, 'reset' => int, 'retry_after' => int]
     */
    public static function check($identifier, $tier = 'ip') {
        if ($tier === 'uid') {
            $limit = self::$uidLimit;
            $window = self::$uidWindow;
            $burst = self::$uidBurst;
        } else {
            $limit = self::$ipLimit;
            $window = self::$ipWindow;
            $burst = self::$ipBurst;
        }
        
        $hash = md5($identifier . '_' . $tier);
        $file = self::$storagePath . $hash . '.json';
        
        $now = time();
        $data = self::loadBucket($file);
        
        // Calculate tokens using sliding window algorithm
        $tokensPerSecond = $limit / $window;
        $timePassed = $now - $data['last_update'];
        $newTokens = $timePassed * $tokensPerSecond;
        
        // Add burst bonus
        $maxTokens = $limit + $burst;
        $data['tokens'] = min($maxTokens, $data['tokens'] + $newTokens);
        $data['last_update'] = $now;
        
        // Check if request is allowed
        if ($data['tokens'] >= 1) {
            $data['tokens'] -= 1;
            $allowed = true;
            $remaining = (int) floor($data['tokens']);
        } else {
            $allowed = false;
            $remaining = 0;
        }
        
        // Calculate reset time and retry-after
        if ($allowed) {
            $reset = $data['last_update'] + (int) ceil(($limit - $data['tokens']) / $tokensPerSecond);
            $retryAfter = 0;
        } else {
            $reset = $data['last_update'] + (int) ceil((1 - $data['tokens']) / $tokensPerSecond);
            $retryAfter = max(1, $reset - $now);
        }
        
        // Save bucket state
        self::saveBucket($file, $data);
        
        return [
            'allowed' => $allowed,
            'remaining' => max(0, $remaining),
            'reset' => $reset,
            'retry_after' => $retryAfter,
            'limit' => $limit
        ];
    }
    
    /**
     * Load bucket data from file
     */
    private static function loadBucket($file) {
        if (file_exists($file)) {
            $content = file_get_contents($file);
            $data = json_decode($content, true);
            
            // Validate data structure
            if (is_array($data) && isset($data['tokens'], $data['last_update'])) {
                return $data;
            }
        }
        
        // Return fresh bucket
        return [
            'tokens' => 0,
            'last_update' => time()
        ];
    }
    
    /**
     * Save bucket data to file
     */
    private static function saveBucket($file, $data) {
        $json = json_encode($data);
        file_put_contents($file, $json, LOCK_EX);
    }
    
    /**
     * Clean up expired rate limit files
     * Removes files older than 2 * window time
     */
    public static function cleanup() {
        if (!is_dir(self::$storagePath)) {
            return;
        }
        
        $maxAge = self::$uidWindow * 2; // Use larger window for cleanup
        $now = time();
        
        $files = glob(self::$storagePath . '*.json');
        
        foreach ($files as $file) {
            if (is_file($file)) {
                $mtime = filemtime($file);
                if (($now - $mtime) > $maxAge) {
                    @unlink($file);
                }
            }
        }
    }
    
    /**
     * Get current rate limit status without consuming tokens
     */
    public static function status($identifier, $tier = 'ip') {
        $hash = md5($identifier . '_' . $tier);
        $file = self::$storagePath . $hash . '.json';
        
        if ($tier === 'uid') {
            $limit = self::$uidLimit;
        } else {
            $limit = self::$ipLimit;
        }
        
        $data = self::loadBucket($file);
        $tokensPerSecond = $limit / self::$uidWindow;
        $timePassed = time() - $data['last_update'];
        $currentTokens = min($limit + self::$uidBurst, $data['tokens'] + ($timePassed * $tokensPerSecond));
        
        return [
            'limit' => $limit,
            'remaining' => (int) max(0, floor($currentTokens)),
            'reset' => $data['last_update'] + (int) ceil(($limit - $currentTokens) / $tokensPerSecond)
        ];
    }
    
    /**
     * Reset rate limit for an identifier
     */
    public static function reset($identifier, $tier = 'ip') {
        $hash = md5($identifier . '_' . $tier);
        $file = self::$storagePath . $hash . '.json';
        
        if (file_exists($file)) {
            @unlink($file);
        }
        
        return true;
    }
}

// Initialize on include
RateLimit::init();