<?php
/**
 * ============================================================
 * KORD EMAIL SENDER v2.0
 * Sistema de envio de emails via API (Mailgun, Resend, SMTP)
 * ============================================================
 */

error_reporting(0);
header('Content-Type: application/json');
header('X-Content-Type-Options: nosniff');
header('X-Frame-Options: DENY');

// Rate limiting por IP
$ip = $_SERVER['REMOTE_ADDR'] ?? '0.0.0.0';
$cacheFile = __DIR__ . '/.api_cache/mail_' . md5($ip) . '.json';
$now = time();
$cacheDir = __DIR__ . '/.api_cache';

if (!is_dir($cacheDir)) {
    @mkdir($cacheDir, 0700, true);
}

$data = ['count' => 0, 'first' => $now, 'codes' => []];
if (file_exists($cacheFile)) {
    $c = @file_get_contents($cacheFile);
    if ($c) $data = json_decode($c, true) ?: $data;
}

if ($now - $data['first'] > 300) { // 5 min window
    $data = ['count' => 0, 'first' => $now, 'codes' => []];
}

$data['count']++;
if ($data['count'] > 5) { // Max 5 emails por IP por 5 min
    http_response_code(429);
    echo json_encode(['error' => 'Muitas tentativas. Aguarde 5 minutos.']);
    exit;
}

@file_put_contents($cacheFile, json_encode($data), LOCK_EX);

// Validar método
if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    http_response_code(405);
    echo json_encode(['error' => 'Metodo nao permitido']);
    exit;
}

$rawInput = file_get_contents('php://input');
$input = json_decode($rawInput, true);

$action = isset($input['action']) ? $input['action'] : '';

// ============================================================
// CARREGAR CONFIGURAÇÕES DE EMAIL
// ============================================================
function getEmailConfig() {
    $configFile = __DIR__ . '/.email_config.json';
    $defaults = [
        'provider' => 'mailgun',
        'api_key' => '',
        'domain' => '',
        'from_email' => 'noreply@kord.app',
        'from_name' => 'Kord - Segurança',
        'resend_api_key' => '',
        'smtp_host' => '',
        'smtp_port' => 587,
        'smtp_user' => '',
        'smtp_pass' => '',
        'enabled' => false
    ];
    if (file_exists($configFile)) {
        $c = @file_get_contents($configFile);
        if ($c) {
            $saved = json_decode($c, true);
            return array_merge($defaults, $saved);
        }
    }
    return $defaults;
}

// ============================================================
// GERAR CÓDIGO 2FA (6 dígitos)
// ============================================================
function generate2FACode() {
    return str_pad((string)random_int(0, 999999), 6, '0', STR_PAD_LEFT);
}

// ============================================================
// SALVAR CÓDIGO NO FIREBASE (via REST API)
// ============================================================
function save2FACode($email, $code, $type, $uid = null) {
    $emailKey = str_replace('.', '_', strtolower($email));
    $expiresAt = (time() + 300) * 1000; // 5 minutos em milliseconds
    $data = [
        'code' => $code,
        'expiresAt' => $expiresAt,
        'type' => $type,
        'attempts' => 0
    ];
    if ($uid) $data['uid'] = $uid;
    
    $ch = curl_init('https://kakaxicenter-default-rtdb.firebaseio.com/email_verifications/' . $emailKey . '.json');
    curl_setopt_array($ch, [
        CURLOPT_RETURNTRANSFER => true,
        CURLOPT_CUSTOMREQUEST => 'PUT',
        CURLOPT_POSTFIELDS => json_encode($data),
        CURLOPT_HTTPHEADER => ['Content-Type: application/json'],
        CURLOPT_SSL_VERIFYPEER => true,
        CURLOPT_TIMEOUT => 10
    ]);
    $r = curl_exec($ch);
    $code_http = curl_getinfo($ch, CURLINFO_HTTP_CODE);
    curl_close($ch);
    return $code_http === 200;
}

// ============================================================
// ENVIAR EMAIL VIA PROVIDER CONFIGURADO
// ============================================================
function sendEmail($to, $subject, $htmlBody, $config) {
    if (!$config['enabled']) {
        // Modo demo: salvar no log
        $log = __DIR__ . '/.email_log.json';
        $logs = [];
        if (file_exists($log)) $logs = json_decode(file_get_contents($log), true) ?: [];
        $logs[] = ['to' => $to, 'subject' => $subject, 'body' => $htmlBody, 'time' => date('c')];
        file_put_contents($log, json_encode($logs, JSON_PRETTY_PRINT));
        return ['success' => true, 'mode' => 'demo', 'demo_code' => preg_match('/(\d{6})/', $htmlBody, $m) ? $m[1] : null];
    }

    // Mailgun
    if ($config['provider'] === 'mailgun' && $config['api_key']) {
        $ch = curl_init('https://api.mailgun.net/v3/' . $config['domain'] . '/messages');
        $post = [
            'from' => $config['from_name'] . ' <' . $config['from_email'] . '>',
            'to' => $to,
            'subject' => $subject,
            'html' => $htmlBody
        ];
        curl_setopt_array($ch, [
            CURLOPT_USERPWD => 'api:' . $config['api_key'],
            CURLOPT_POST => true,
            CURLOPT_POSTFIELDS => $post,
            CURLOPT_RETURNTRANSFER => true,
            CURLOPT_TIMEOUT => 15
        ]);
        $r = curl_exec($ch);
        curl_close($ch);
        return json_decode($r, true) ?: ['success' => false];
    }

    // Resend
    if ($config['provider'] === 'resend' && $config['resend_api_key']) {
        $ch = curl_init('https://api.resend.com/emails');
        curl_setopt_array($ch, [
            CURLOPT_RETURNTRANSFER => true,
            CURLOPT_POST => true,
            CURLOPT_POSTFIELDS => json_encode([
                'from' => $config['from_name'] . ' <' . $config['from_email'] . '>',
                'to' => [$to],
                'subject' => $subject,
                'html' => $htmlBody
            ]),
            CURLOPT_HTTPHEADER => [
                'Authorization: Bearer ' . $config['resend_api_key'],
                'Content-Type: application/json'
            ],
            CURLOPT_SSL_VERIFYPEER => true,
            CURLOPT_TIMEOUT => 15
        ]);
        $r = curl_exec($ch);
        curl_close($ch);
        return json_decode($r, true) ?: ['success' => false];
    }

    return ['success' => false, 'error' => 'Provedor de email nao configurado'];
}

// ============================================================
// TEMPLATES DE EMAIL
// ============================================================
function getEmailTemplate($type, $code, $userName = '') {
    $styles = 'style="font-family:Arial,sans-serif;background:#0f0f23;color:#fff;margin:0;padding:0;">
        <table width="100%" cellpadding="0" cellspacing="0" style="background:#0f0f23;">
            <tr><td align="center" style="padding:40px 20px;">
                <div style="max-width:480px;background:#1a1a2e;border-radius:16px;overflow:hidden;border:1px solid #2a2a4e;">
                    <div style="background:linear-gradient(135deg,#6366f1,#8b5cf6);padding:32px;text-align:center;">
                        <h1 style="margin:0;font-size:28px;color:#fff;">🔐 Kord</h1>
                    </div>
                    <div style="padding:32px;">';

    $footer = '       <div style="padding:20px 32px;background:#13132b;text-align:center;font-size:12px;color:#64748b;">
                        Kord — Plataforma de Comunicação<br>
                        Se você não solicitou este email, ignore-o.
                    </div>
                </div>
            </td></tr>
        </table>';

    if ($type === 'register') {
        return $styles . "
            <h2 style='margin:0 0 16px 0;font-size:22px;color:#fff;'>Verifique seu Email</h2>
            <p style='color:#94a3b8;font-size:15px;line-height:1.6;'>Olá$userName, seja bem-vindo ao Kord!</p>
            <p style='color:#94a3b8;font-size:15px;'>Seu código de verificação é:</p>
            <div style='background:#0f0f23;border-radius:12px;padding:20px;text-align:center;margin:24px 0;'>
                <span style='font-size:36px;font-weight:bold;color:#6366f1;letter-spacing:8px;'>$code</span>
            </div>
            <p style='color:#64748b;font-size:13px;'>Este código expira em <strong>5 minutos</strong>.</p>
            <p style='color:#ef4444;font-size:13px;'>Não compartilhe este código com ninguém.</p>
        " . $footer;
    }

    if ($type === 'login') {
        return $styles . "
            <h2 style='margin:0 0 16px 0;font-size:22px;color:#fff;'>Login Detectado</h2>
            <p style='color:#94a3b8;font-size:15px;line-height:1.6;'>Olá$userName,</p>
            <p style='color:#94a3b8;font-size:15px;'>Você está tentando fazer login na sua conta Kord.</p>
            <p style='color:#94a3b8;font-size:15px;'>Seu código de verificação é:</p>
            <div style='background:#0f0f23;border-radius:12px;padding:20px;text-align:center;margin:24px 0;'>
                <span style='font-size:36px;font-weight:bold;color:#10b981;letter-spacing:8px;'>$code</span>
            </div>
            <p style='color:#64748b;font-size:13px;'>Se foi você, use o código acima. Se não foi você, ignore este email.</p>
        " . $footer;
    }

    if ($type === 'passwordReset') {
        return $styles . "
            <h2 style='margin:0 0 16px 0;font-size:22px;color:#fff;'>Redefinir Senha</h2>
            <p style='color:#94a3b8;font-size:15px;line-height:1.6;'>Olá$userName,</p>
            <p style='color:#94a3b8;font-size:15px;'>Você solicitou a redefinição da sua senha.</p>
            <p style='color:#94a3b8;font-size:15px;'>Seu código de verificação é:</p>
            <div style='background:#0f0f23;border-radius:12px;padding:20px;text-align:center;margin:24px 0;'>
                <span style='font-size:36px;font-weight:bold;color:#f59e0b;letter-spacing:8px;'>$code</span>
            </div>
            <p style='color:#ef4444;font-size:13px;'>Se você não solicitou, ignore este email.</p>
        " . $footer;
    }

    return $styles . "<p>Código: <strong>$code</strong></p>" . $footer;
}

// ============================================================
// AÇÕES
// ============================================================
$config = getEmailConfig();

switch ($action) {
    // ------------------------------------------------------
    // ENVIAR CÓDIGO 2FA (registro, login, redefinir senha)
    // ------------------------------------------------------
    case 'send_2fa_code':
        $email = isset($input['email']) ? filter_var($input['email'], FILTER_VALIDATE_EMAIL) : '';
        $type = isset($input['type']) ? preg_replace('/[^a-zA-Z]/', '', $input['type']) : '';
        $uid = isset($input['uid']) ? preg_replace('/[^a-zA-Z0-9]/', '', $input['uid']) : null;
        $userName = isset($input['name']) ? htmlspecialchars($input['name']) : '';

        if (!$email || !$type) {
            echo json_encode(['error' => 'Email e tipo sao obrigatorios']);
            exit;
        }
        if (!in_array($type, ['register', 'login', 'passwordReset'])) {
            echo json_encode(['error' => 'Tipo invalido']);
            exit;
        }

        $code = generate2FACode();
        $saved = save2FACode($email, $code, $type, $uid);
        
        if (!$saved) {
            echo json_encode(['error' => 'Falha ao salvar codigo']);
            exit;
        }

        $subject = $type === 'register' ? 'Verifique seu email - Kord'
            : ($type === 'login' ? 'Codigo de Login - Kord' : 'Redefinir Senha - Kord');

        $html = getEmailTemplate($type, $code, $userName ? " $userName" : '');
        $result = sendEmail($email, $subject, $html, $config);

        if ($result['success'] || isset($result['demo_code'])) {
            echo json_encode([
                'success' => true,
                'message' => 'Codigo enviado para ' . substr($email, 0, 3) . '***@' . explode('@', $email)[1],
                'mode' => $result['mode'] ?? 'live'
            ]);
        } else {
            echo json_encode(['error' => 'Falha ao enviar email: ' . ($result['error'] ?? 'provider error')]);
        }
        break;

    // ------------------------------------------------------
    // VERIFICAR CÓDIGO 2FA
    // ------------------------------------------------------
    case 'verify_2fa_code':
        $email = isset($input['email']) ? filter_var($input['email'], FILTER_VALIDATE_EMAIL) : '';
        $code = isset($input['code']) ? preg_replace('/[^0-9]/', '', $input['code']) : '';
        $type = isset($input['type']) ? preg_replace('/[^a-zA-Z]/', '', $input['type']) : '';

        if (!$email || strlen($code) !== 6) {
            echo json_encode(['error' => 'Codigo invalido']);
            exit;
        }

        $emailKey = str_replace('.', '_', strtolower($email));
        
        // Buscar código no Firebase
        $ch = curl_init('https://kakaxicenter-default-rtdb.firebaseio.com/email_verifications/' . $emailKey . '.json');
        curl_setopt_array($ch, [
            CURLOPT_RETURNTRANSFER => true,
            CURLOPT_SSL_VERIFYPEER => true,
            CURLOPT_TIMEOUT => 10
        ]);
        $r = curl_exec($ch);
        curl_close($ch);

        $stored = json_decode($r, true);

        if (!$stored || !isset($stored['code'])) {
            echo json_encode(['error' => 'Codigo expirado ou invalido']);
            exit;
        }

        $now = time() * 1000;
        if ($stored['expiresAt'] < $now) {
            echo json_encode(['error' => 'Codigo expirado']);
            exit;
        }

        if ($type && isset($stored['type']) && $stored['type'] !== $type) {
            echo json_encode(['error' => 'Tipo de codigo incorreto']);
            exit;
        }

        if ($stored['code'] !== $code) {
            // Incrementar tentativas
            $attempts = ($stored['attempts'] ?? 0) + 1;
            if ($attempts >= 5) {
                // Bloquear após 5 tentativas
                $ch2 = curl_init('https://kakaxicenter-default-rtdb.firebaseio.com/email_verifications/' . $emailKey . '.json');
                curl_setopt_array($ch2, [
                    CURLOPT_RETURNTRANSFER => true,
                    CURLOPT_CUSTOMREQUEST => 'DELETE',
                    CURLOPT_SSL_VERIFYPEER => true
                ]);
                curl_exec($ch2);
                curl_close($ch2);
                echo json_encode(['error' => 'Muitas tentativas. Solicite um novo codigo.']);
            } else {
                // Atualizar tentativas
                $ch2 = curl_init('https://kakaxicenter-default-rtdb.firebaseio.com/email_verifications/' . $emailKey . '.json');
                curl_setopt_array($ch2, [
                    CURLOPT_RETURNTRANSFER => true,
                    CURLOPT_CUSTOMREQUEST => 'PATCH',
                    CURLOPT_POSTFIELDS => json_encode(['attempts' => $attempts]),
                    CURLOPT_HTTPHEADER => ['Content-Type: application/json']
                ]);
                curl_exec($ch2);
                curl_close($ch2);
                echo json_encode(['error' => 'Codigo incorreto', 'attempts_left' => 5 - $attempts]);
            }
            exit;
        }

        // Código correto — limpar e retornar sucesso
        $ch3 = curl_init('https://kakaxicenter-default-rtdb.firebaseio.com/email_verifications/' . $emailKey . '.json');
        curl_setopt_array($ch3, [
            CURLOPT_RETURNTRANSFER => true,
            CURLOPT_CUSTOMREQUEST => 'DELETE',
            CURLOPT_SSL_VERIFYPEER => true
        ]);
        curl_exec($ch3);
        curl_close($ch3);

        echo json_encode(['success' => true, 'verified' => true]);
        break;

    // ------------------------------------------------------
    // VERIFICAR SE EMAIL JÁ ESTÁ REGISTRADO
    // ------------------------------------------------------
    case 'check_email':
        $email = isset($input['email']) ? filter_var($input['email'], FILTER_VALIDATE_EMAIL) : '';
        if (!$email) {
            echo json_encode(['error' => 'Email invalido']);
            exit;
        }

        // Checar Firebase Auth (precisa de API key)
        $firebase_api_key = 'AIzaSyBOqC6LuU-T4VdTJaI3j6L3R5hBVUPg5rM'; // Firebase Web API Key
        
        $ch = curl_init('https://www.googleapis.com/identitytoolkit/v3/relyingparty/getAccountInfo?key=' . $firebase_api_key);
        curl_setopt_array($ch, [
            CURLOPT_RETURNTRANSFER => true,
            CURLOPT_POST => true,
            CURLOPT_POSTFIELDS => json_encode(['email' => [$email]]),
            CURLOPT_HTTPHEADER => ['Content-Type: application/json'],
            CURLOPT_TIMEOUT => 10
        ]);
        $r = curl_exec($ch);
        curl_close($ch);

        $resp = json_decode($r, true);
        $exists = isset($resp['users']) && count($resp['users']) > 0;

        echo json_encode(['email' => $email, 'registered' => $exists]);
        break;

    // ------------------------------------------------------
    // CONFIGURAR SMTP (apenas admins)
    // ------------------------------------------------------
    case 'configure_email':
        $admin_email = $input['admin_email'] ?? '';
        $admins = ['moisesvvanti@gmail.com', 'vitortrader2017@gmail.com', 'rafebrlz1@hotmail.com'];
        if (!in_array($admin_email, $admins)) {
            echo json_encode(['error' => 'Nao autorizado']);
            exit;
        }

        $newConfig = [
            'provider' => $input['provider'] ?? 'mailgun',
            'api_key' => $input['api_key'] ?? '',
            'domain' => $input['domain'] ?? '',
            'from_email' => $input['from_email'] ?? 'noreply@kord.app',
            'from_name' => $input['from_name'] ?? 'Kord',
            'resend_api_key' => $input['resend_api_key'] ?? '',
            'smtp_host' => $input['smtp_host'] ?? '',
            'smtp_port' => (int)($input['smtp_port'] ?? 587),
            'smtp_user' => $input['smtp_user'] ?? '',
            'smtp_pass' => $input['smtp_pass'] ?? '',
            'enabled' => !empty($input['api_key']) || !empty($input['resend_api_key'])
        ];

        file_put_contents(__DIR__ . '/.email_config.json', json_encode($newConfig));
        echo json_encode(['success' => true, 'message' => 'Configuracao salva']);
        break;

    // ------------------------------------------------------
    // OBTER STATUS DO EMAIL (para admin)
    // ------------------------------------------------------
    case 'get_email_status':
        $admin_email = $input['admin_email'] ?? '';
        $admins = ['moisesvvanti@gmail.com', 'vitortrader2017@gmail.com', 'rafebrlz1@hotmail.com'];
        if (!in_array($admin_email, $admins)) {
            echo json_encode(['error' => 'Nao autorizado']);
            exit;
        }
        $cfg = getEmailConfig();
        $cfg['api_key'] = $cfg['api_key'] ? '***' : '';
        $cfg['resend_api_key'] = $cfg['resend_api_key'] ? '***' : '';
        $cfg['smtp_pass'] = $cfg['smtp_pass'] ? '***' : '';
        echo json_encode(['config' => $cfg]);
        break;

    default:
        http_response_code(400);
        echo json_encode(['error' => 'Acao desconhecida']);
}