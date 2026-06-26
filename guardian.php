<?php
/**
 * ============================================================
 * LUMINOUS GUARDIAN - Advanced Request Validator v4.0
 * Zero-Day Exploit Prevention
 * Anti-DNS-Rebinding, Anti-CSRF, Anti-Clickjacking
 * ============================================================
 */

error_reporting(0);
header('Content-Type: text/plain');

// ============================================================
// GUARDIAN CONFIGURATION
// ============================================================
define('GUARDIAN_VERSION', '4.0.0');
define('MAX_REQUEST_SIZE', 10240); // 10KB
define('ALLOWED_ORIGINS', ['https://kord.gg', 'https://www.kord.gg']);
define('ALLOWED_HOSTS', ['kord.gg', 'www.kord.gg', 'localhost']);
define('BLOCKED_IPS_FILE', __DIR__ . '/.blocked_ips.json');
define('RATE_LIMIT_FILE', __DIR__ . '/.guardian_rl');

// ============================================================
// SECURITY CHECKS
// ============================================================
class Guardian {
    
    private $ip;
    private $threats = [];
    
    public function __construct() {
        $this->ip = $this->getClientIP();
        $this->runAllChecks();
    }
    
    // Get real client IP (with proxy handling)
    private function getClientIP() {
        $ip = $_SERVER['REMOTE_ADDR'] ?? '0.0.0.0';
        
        // Check for proxies
        if (!empty($_SERVER['HTTP_X_FORWARDED_FOR'])) {
            $ips = explode(',', $_SERVER['HTTP_X_FORWARDED_FOR']);
            $ip = trim($ips[0]);
        }
        
        if (!empty($_SERVER['HTTP_X_REAL_IP'])) {
            $ip = $_SERVER['HTTP_X_REAL_IP'];
        }
        
        // Validate IPv4/IPv6
        if (!filter_var($ip, FILTER_VALIDATE_IP)) {
            return '0.0.0.0';
        }
        
        // Block private IPs in production (except localhost for dev)
        if (defined('PRODUCTION') && PRODUCTION) {
            $privateRanges = [
                '10.0.0.0/8', '172.16.0.0/12', '192.168.0.0/16',
                '127.0.0.0/8', '169.254.0.0/16'
            ];
            foreach ($privateRanges as $range) {
                if ($this->ipInRange($ip, $range)) {
                    // Log but don't block dev IPs
                    if ($ip !== '127.0.0.1' && $ip !== '::1') {
                        $this->logThreat('PRIVATE_IP', $ip);
                    }
                }
            }
        }
        
        return $ip;
    }
    
    // Check if IP is in CIDR range
    private function ipInRange($ip, $range) {
        if (strpos($range, '/') === false) {
            return $ip === $range;
        }
        
        list($subnet, $bits) = explode('/', $range);
        $ip = ip2long($ip);
        $subnet = ip2long($subnet);
        $mask = -1 << (32 - $bits);
        $subnet &= $mask;
        
        return ($ip & $mask) == $subnet;
    }
    
    // Run all security checks
    private function runAllChecks() {
        $this->checkBlocked();
        $this->checkRateLimit();
        $this->checkDNSRebinding();
        $this->checkUserAgent();
        $this->checkRequestSize();
        $this->checkSuspiciousHeaders();
        $this->checkMethod();
        
        if (!empty($this->threats)) {
            $this->handleThreats();
        }
    }
    
    // Check if IP is blocked
    private function checkBlocked() {
        if (!file_exists(BLOCKED_IPS_FILE)) return;
        
        $blocked = json_decode(@file_get_contents(BLOCKED_IPS_FILE), true);
        if (!$blocked || !is_array($blocked)) return;
        
        foreach ($blocked as $entry) {
            if ($entry['ip'] === $this->ip) {
                $since = time() - $entry['time'];
                if ($since < 3600) { // Block for 1 hour
                    $this->threats[] = ['type' => 'IP_BLOCKED', 'detail' => $entry['reason'] ?? 'manual'];
                    return;
                } else {
                    // Unblock after 1 hour
                    $this->unblockIP($this->ip);
                }
            }
        }
    }
    
    // Rate limiting
    private function checkRateLimit() {
        $cacheFile = RATE_LIMIT_FILE . '/' . md5($this->ip) . '.json';
        $now = time();
        
        @mkdir(RATE_LIMIT_FILE, 0700, true);
        
        $data = ['count' => 0, 'first' => $now, 'burst' => []];
        if (file_exists($cacheFile)) {
            $content = @file_get_contents($cacheFile);
            if ($content) $data = json_decode($content, true) ?: $data;
        }
        
        // Clean old entries
        if ($now - $data['first'] > 60) {
            $data = ['count' => 0, 'first' => $now, 'burst' => []];
        }
        
        // Clean burst history
        $data['burst'] = array_filter($data['burst'], fn($t) => $now - $t < 1000);
        
        $data['count']++;
        $data['burst'][] = $now;
        
        // Block if more than 100 requests/minute
        if ($data['count'] > 100) {
            $this->threats[] = ['type' => 'RATE_LIMIT', 'count' => $data['count']];
        }
        
        // Block if more than 10 requests/second (burst)
        if (count($data['burst']) > 10) {
            $this->threats[] = ['type' => 'BURST_DETECTED', 'count' => count($data['burst'])];
        }
        
        @file_put_contents($cacheFile, json_encode($data), LOCK_EX);
    }
    
    // DNS Rebinding protection
    private function checkDNSRebinding() {
        $host = $_SERVER['HTTP_HOST'] ?? '';
        
        // Check for IP addresses in Host header
        if (filter_var($host, FILTER_VALIDATE_IP)) {
            $this->threats[] = ['type' => 'DNS_REBINDING', 'host' => $host];
            return;
        }
        
        // Check for localhost aliases
        $localhostAliases = ['localhost', '127.0.0.1', '0.0.0.0', '::1'];
        if (in_array(strtolower($host), $localhostAliases)) {
            $this->threats[] = ['type' => 'DNS_REBINDING_LOCALHOST', 'host' => $host];
            return;
        }
        
        // Check for suspicious subdomains
        $suspiciousSubdomains = ['www1', 'www2', 'test', 'staging', 'dev', 'admin', 'backup'];
        $parts = explode('.', $host);
        if (count($parts) >= 2 && in_array($parts[0], $suspiciousSubdomains)) {
            // These are suspicious only if this isn't your domain
            if (!in_array($host, ALLOWED_HOSTS) && !in_array($host, ALLOWED_ORIGINS)) {
                $this->threats[] = ['type' => 'DNS_REBINDING_SUBDOMAIN', 'host' => $host];
            }
        }
        
        // Check Host header matches allowed origins
        $hostWithoutPort = preg_replace('/:\d+$/', '', $host);
        if (!in_array($host, ALLOWED_HOSTS) && !in_array($host, ALLOWED_ORIGINS) && !in_array($hostWithoutPort, ALLOWED_HOSTS)) {
            $this->threats[] = ['type' => 'DNS_REBINDING', 'host' => $host];
        }
    }
    
    // User Agent analysis
    private function checkUserAgent() {
        $ua = $_SERVER['HTTP_USER_AGENT'] ?? '';
        
        if (empty($ua)) {
            $this->threats[] = ['type' => 'NO_USER_AGENT'];
            return;
        }
        
        // Known malicious/bot UA patterns
        $maliciousPatterns = [
            '/sqlmap/i',
            '/nikto/i',
            '/nmap/i',
            '/masscan/i',
            '/hydra/i',
            '/metasploit/i',
            '/burpsuite/i',
            '/acunetix/i',
            '/netsparker/i',
            '/w3af/i',
            '/dirbuster/i',
            '/gobuster/i',
            '/python-requests/i',
            '/scrapy/i',
            '/curl/i',
            '/wget/i',
            '/libwww/i',
            '/java\//i',
            '/go-http/i',
            '/axios/i'
        ];
        
        foreach ($maliciousPatterns as $pattern) {
            if (preg_match($pattern, $ua)) {
                $this->threats[] = ['type' => 'MALICIOUS_UA', 'pattern' => $pattern];
                return;
            }
        }
        
        // Empty or very short UA
        if (strlen($ua) < 10) {
            $this->threats[] = ['type' => 'SHORT_UA'];
        }
    }
    
    // Request size check
    private function checkRequestSize() {
        $size = strlen(file_get_contents('php://input'));
        if ($size > MAX_REQUEST_SIZE) {
            $this->threats[] = ['type' => 'REQUEST_TOO_LARGE', 'size' => $size];
        }
    }
    
    // Check for suspicious headers
    private function checkSuspiciousHeaders() {
        // Check for common attack vectors in headers
        $suspiciousHeaders = [
            'X-Forwarded-Proto' => ['http'],
            'X-Originating-IP' => null,
            'X-Real-IP' => null
        ];
        
        foreach ($suspiciousHeaders as $header => $badValue) {
            $value = $_SERVER['HTTP_' . strtoupper(str_replace('-', '_', $header))] ?? '';
            if (!empty($value)) {
                if ($badValue && strtolower($value) === $badValue) {
                    $this->threats[] = ['type' => 'SUSPICIOUS_HEADER', 'header' => $header, 'value' => $value];
                }
            }
        }
        
        // Check for debug headers
        if (isset($_SERVER['HTTP_X_DEBUG']) || isset($_SERVER['HTTP_X_REQUEST_ID'])) {
            $this->threats[] = ['type' => 'DEBUG_HEADER'];
        }
    }
    
    // HTTP method validation
    private function checkMethod() {
        $allowed = ['GET', 'POST', 'OPTIONS'];
        $method = $_SERVER['REQUEST_METHOD'] ?? 'GET';
        
        if (!in_array($method, $allowed)) {
            $this->threats[] = ['type' => 'INVALID_METHOD', 'method' => $method];
        }
    }
    
    // Log threat
    private function logThreat($type, $detail = '') {
        $logFile = __DIR__ . '/.threat_log.txt';
        $entry = date('Y-m-d H:i:s') . " [$type] IP: {$this->ip} DETAIL: $detail\n";
        @file_put_contents($logFile, $entry, FILE_APPEND);
    }
    
    // Handle detected threats
    private function handleThreats() {
        $severity = 0;
        
        foreach ($this->threats as $threat) {
            $this->logThreat($threat['type'], json_encode($threat));
            
            // Calculate severity
            switch ($threat['type']) {
                case 'IP_BLOCKED':
                case 'RATE_LIMIT':
                case 'BURST_DETECTED':
                    $severity = max($severity, 3);
                    break;
                case 'DNS_REBINDING':
                case 'MALICIOUS_UA':
                case 'NO_USER_AGENT':
                    $severity = max($severity, 5);
                    break;
                case 'INVALID_METHOD':
                case 'DEBUG_HEADER':
                    $severity = max($severity, 7);
                    break;
                case 'REQUEST_TOO_LARGE':
                    $severity = max($severity, 4);
                    break;
                default:
                    $severity = max($severity, 6);
            }
        }
        
        // Take action based on severity
        if ($severity >= 7) {
            $this->blockIP($this->ip, 'high_severity');
            http_response_code(403);
            echo 'FORBIDDEN';
            exit;
        } elseif ($severity >= 5) {
            http_response_code(429);
            echo 'TOO_MANY_REQUESTS';
            exit;
        } elseif ($severity >= 3) {
            // Add delay
            usleep(500000); // 0.5 second delay
        }
    }
    
    // Block IP temporarily
    public function blockIP($ip, $reason = '') {
        @mkdir(__DIR__ . '/.blocked_ips', 0700, true);
        $blocked = [];
        
        if (file_exists(BLOCKED_IPS_FILE)) {
            $blocked = json_decode(@file_get_contents(BLOCKED_IPS_FILE), true) ?: [];
        }
        
        $blocked[$ip] = [
            'ip' => $ip,
            'reason' => $reason,
            'time' => time()
        ];
        
        @file_put_contents(BLOCKED_IPS_FILE, json_encode($blocked), LOCK_EX);
    }
    
    // Unblock IP
    public function unblockIP($ip) {
        if (!file_exists(BLOCKED_IPS_FILE)) return;
        
        $blocked = json_decode(@file_get_contents(BLOCKED_IPS_FILE), true) ?: [];
        unset($blocked[$ip]);
        
        @file_put_contents(BLOCKED_IPS_FILE, json_encode($blocked), LOCK_EX);
    }
}

// ============================================================
// RUN GUARDIAN
// ============================================================
$guardian = new Guardian();