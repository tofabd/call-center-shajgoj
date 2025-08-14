<?php

require_once __DIR__ . '/vendor/autoload.php';

use App\Models\FacebookPage;

// Bootstrap Laravel
$app = require_once __DIR__ . '/bootstrap/app.php';
$app->make('Illuminate\Contracts\Console\Kernel')->bootstrap();

echo "🔧 Facebook Token Update Tool\n";
echo "============================\n\n";

// Check if token is provided via command line or environment variable
$newToken = null;

if ($argc >= 2) {
    $newToken = $argv[1];
    echo "📝 Using token from command line argument\n";
} else {
    // Try to get token from environment variable
    $envToken = env('FACEBOOK_PAGE_ACCESS_TOKEN');
    if (!empty($envToken) && $envToken !== 'your_facebook_page_access_token_here') {
        $newToken = $envToken;
        echo "🌍 Using token from environment variable (FACEBOOK_PAGE_ACCESS_TOKEN)\n";
    }
}

if (empty($newToken)) {
    echo "Usage: php update-facebook-token.php <NEW_ACCESS_TOKEN>\n";
    echo "   OR: Set FACEBOOK_PAGE_ACCESS_TOKEN in your .env file\n\n";
    echo "Steps to get a new token:\n";
    echo "1. Go to https://developers.facebook.com/\n";
    echo "2. Select your app\n";
    echo "3. Go to 'Tools' > 'Graph API Explorer'\n";
    echo "4. Select your page from the dropdown\n";
    echo "5. Generate a Page Access Token (not User Access Token)\n";
    echo "6. Copy the token and either:\n";
    echo "   - Run: php update-facebook-token.php <token>\n";
    echo "   - Add FACEBOOK_PAGE_ACCESS_TOKEN=<token> to your .env file and run: php update-facebook-token.php\n\n";

    echo "Current pages in database:\n";
    $pages = FacebookPage::all();
    foreach ($pages as $page) {
        echo "- {$page->page_name} (ID: {$page->page_id})\n";
    }

    // Check if .env file exists and has the variable
    $envPath = __DIR__ . '/.env';
    if (file_exists($envPath)) {
        $envContent = file_get_contents($envPath);
        if (strpos($envContent, 'FACEBOOK_PAGE_ACCESS_TOKEN') !== false) {
            echo "\n💡 Found FACEBOOK_PAGE_ACCESS_TOKEN in .env file, but it appears to be empty or placeholder\n";
        } else {
            echo "\n💡 Add FACEBOOK_PAGE_ACCESS_TOKEN=<your_token> to your .env file\n";
        }
    } else {
        echo "\n💡 Create a .env file and add FACEBOOK_PAGE_ACCESS_TOKEN=<your_token>\n";
    }

    exit(1);
}

// Validate token format
if (!preg_match('/^(EAA|EAAG|EAB)[A-Za-z0-9_-]+$/', $newToken)) {
    echo "❌ Invalid token format. Facebook tokens should start with EAA, EAAG, or EAB\n";
    exit(1);
}

try {
    // Get the first page (or you can modify this to select specific page)
    $page = FacebookPage::first();

    if (!$page) {
        echo "❌ No Facebook pages found in database\n";
        exit(1);
    }

    echo "Updating token for page: {$page->page_name} (ID: {$page->page_id})\n";

    // Test the new token first
    echo "🌐 Testing new token with Facebook API...\n";
    $testResult = testFacebookToken($newToken);

    if (!$testResult['valid']) {
        echo "❌ New token is invalid: " . $testResult['error'] . "\n";
        exit(1);
    }

    echo "✅ New token is valid!\n";
    echo "   Page Info: " . json_encode($testResult['page_info']) . "\n\n";

    // Update the token
    $page->setAccessToken($newToken);
    $page->save();

    echo "✅ Token updated successfully!\n";

    // Verify the update worked
    $decryptedToken = $page->getDecryptedAccessToken();
    if ($decryptedToken === $newToken) {
        echo "✅ Token verification: Success\n";
    } else {
        echo "❌ Token verification: Failed\n";
    }

    echo "\n🎯 Now test message sending: php test-message-send.php\n";

} catch (Exception $e) {
    echo "❌ Error: " . $e->getMessage() . "\n";
}

function testFacebookToken($token) {
    try {
        $url = "https://graph.facebook.com/v23.0/me?access_token=" . urlencode($token);

        $ch = curl_init();
        curl_setopt($ch, CURLOPT_URL, $url);
        curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
        curl_setopt($ch, CURLOPT_SSL_VERIFYPEER, false);
        curl_setopt($ch, CURLOPT_TIMEOUT, 10);

        $response = curl_exec($ch);
        $httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
        curl_close($ch);

        if ($httpCode === 200) {
            $data = json_decode($response, true);
            if (isset($data['id'])) {
                return ['valid' => true, 'page_info' => $data];
            }
        }

        $errorData = json_decode($response, true);
        return [
            'valid' => false,
            'error' => $errorData['error']['message'] ?? 'Unknown error'
        ];

    } catch (Exception $e) {
        return ['valid' => false, 'error' => $e->getMessage()];
    }
}
