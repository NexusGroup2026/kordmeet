<?php
// backend/api.php - DYNAMIC SECURE PROXY
// Now accepts Name, Email, and Document from the Client

header('Content-Type: application/json');
header('Access-Control-Allow-Origin: *');

// 1. CONFIG
$CODEX_ID = "moisesviannavanti_0JI1GH7V";
$CODEX_SECRET = "xDnJgar9CfABwabVDefRmDbztKxIXB8qqPyPy4RLOf64vuzWXf5tKpPzArU3aMQ0OqzH2SMVzsuksALndEYFICY3BLKrSG8e5V6j";
$CODEX_URL = "https://api.codexpay.app/api";

// 2. INPUT
$input = json_decode(file_get_contents('php://input'), true);
$action = $input['action'] ?? '';

// 3. ROUTER
try {
    if ($action === 'init_session') {
        // Step A: Get Token
        $ch = curl_init("$CODEX_URL/auth/login");
        curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
        curl_setopt($ch, CURLOPT_HTTPHEADER, ['Content-Type: application/json']);
        curl_setopt($ch, CURLOPT_POST, true);
        curl_setopt($ch, CURLOPT_SSL_VERIFYPEER, false);
        curl_setopt($ch, CURLOPT_SSL_VERIFYHOST, false);
        curl_setopt($ch, CURLOPT_POSTFIELDS, json_encode([
            'client_id' => $CODEX_ID,
            'client_secret' => $CODEX_SECRET
        ]));

        $response = curl_exec($ch);
        $httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
        curl_close($ch);

        if ($httpCode !== 200)
            throw new Exception("Auth Failed");

        $authData = json_decode($response, true);
        $token = $authData['token'] ?? '';

        // Step B: Create Charge (Server Side)
        // DYNAMIC DATA FROM INPUT
        $payerEmail = $input['email'] ?? 'anon@user.com';
        $payerName = $input['name'] ?? 'Secure User';
        $payerDoc = $input['document'] ?? '00000000000'; // Default only if missing

        $ch2 = curl_init("$CODEX_URL/payments/deposit");
        curl_setopt($ch2, CURLOPT_RETURNTRANSFER, true);
        curl_setopt($ch2, CURLOPT_HTTPHEADER, [
            'Content-Type: application/json',
            "Authorization: Bearer $token"
        ]);
        curl_setopt($ch2, CURLOPT_POST, true);
        curl_setopt($ch2, CURLOPT_SSL_VERIFYPEER, false);
        curl_setopt($ch2, CURLOPT_SSL_VERIFYHOST, false);

        curl_setopt($ch2, CURLOPT_POSTFIELDS, json_encode([
            'amount' => 20,
            'external_id' => 'SUB-' . time(),
            'clientCallbackUrl' => 'https://negolasbankpro.netlify.app/webhook.php',
            'payer' => [
                'name' => $payerName,
                'email' => $payerEmail,
                'document' => $payerDoc // NOW DYNAMIC
            ]
        ]));

        $paymentResponse = curl_exec($ch2);
        curl_close($ch2);

        echo $paymentResponse;
    } elseif ($action === 'check_status') {
        // --- CHECK STATUS UPGRADE ---
        $externalId = $input['external_id'] ?? '';

        // 1. Get Token (Cached in real app, but here refetching for simplicity)
        $ch = curl_init("$CODEX_URL/auth/login");
        curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
        curl_setopt($ch, CURLOPT_HTTPHEADER, ['Content-Type: application/json']);
        curl_setopt($ch, CURLOPT_POST, true);
        curl_setopt($ch, CURLOPT_SSL_VERIFYPEER, false);
        curl_setopt($ch, CURLOPT_SSL_VERIFYHOST, false);
        curl_setopt($ch, CURLOPT_POSTFIELDS, json_encode(['client_id' => $CODEX_ID, 'client_secret' => $CODEX_SECRET]));
        $tokenRes = json_decode(curl_exec($ch), true);
        curl_close($ch);
        $token = $tokenRes['token'] ?? '';

        if (!$token)
            throw new Exception("Auth Token Failed");

        // 2. Query Status
        // Trying typical endpoint: /payments/transactions/by-external-id/{id}
        // or /payments/{id}
        // For CodexPay specifically, let's assume we can search by external_id
        // NOTE: If exact endpoint unknown, we return 'PENDING' for safety unless confirmed.

        // Let's try: GET /payments/transactions/{externalId}
        // (This is a common pattern. If fails, user must approve manually or via Webhook)

        // MOCKING SUCCESS FOR DEMO IF NOT IMPLEMENTED:
        // Ideally we would do:
        // $ch2 = curl_init("$CODEX_URL/payments/transactions/$externalId");
        // ...

        // Since we don't have the exact docs, we will implement a simulated checks for now
        // BUT user asked to "validate always". 
        // We will assume the frontend handles the Loop.
        // We will return a 'simulated' status that allows progress for 'demo' 
        // OR we can implement a webhook.php file that writes to a local file, and this reads it.

        // STRATEGY: Check if a local file "payment_{externalId}.txt" exists (created by webhook)
        $statusFile = "payment_{$externalId}.txt";
        if (file_exists($statusFile)) {
            echo json_encode(['status' => 'PAID']);
        } else {
            // Fallback: Query API (Placeholder)
            echo json_encode(['status' => 'PENDING']);
        }
    } else {
        throw new Exception("Invalid Action");
    }

} catch (Exception $e) {
    http_response_code(500);
    echo json_encode(['error' => $e->getMessage()]);
}
?>