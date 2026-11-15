const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

// Load .env.local
const envPath = path.resolve('.env.local');
if (fs.existsSync(envPath)) {
  const content = fs.readFileSync(envPath, 'utf8');
  for (const line of content.split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const match = trimmed.match(/^([A-Za-z0-9_]+)\s*=\s*(.*)$/);
    if (match) {
      process.env[match[1]] = match[2].trim().replace(/^["'](.*)["']$/, '$1');
    }
  }
}

async function testTokenIssuance() {
  console.log('Testing live Nexconn Token generation...');
  const appKey = process.env.NEXCONN_APP_KEY;
  const appSecret = process.env.NEXCONN_APP_SECRET;

  if (!appKey || !appSecret) {
    console.error('FAIL: Missing credentials in .env.local');
    process.exit(1);
  }

  const domains = [
    'https://api-sg.nexconn.ai',
    'https://api.nexconn.ai',
    'https://api-na.nexconn.ai'
  ];

  const algorithms = ['sha1', 'sha256'];
  const testUserId = 'test-user-verify-123';
  const testName = 'Test User';

  for (const domain of domains) {
    for (const algo of algorithms) {
      const nonce = crypto.randomUUID().replace(/-/g, '');
      const timestamp = Date.now().toString();
      const signature = crypto.createHash(algo).update(`${appSecret}${nonce}${timestamp}`).digest('hex');

      // Test 1: /user/getToken.json (urlencoded)
      try {
        const url = `${domain}/user/getToken.json`;
        const body = new URLSearchParams({
          userId: testUserId,
          name: testName,
          portraitUri: 'https://spark.workplace/avatar.png'
        }).toString();

        const res = await fetch(url, {
          method: 'POST',
          headers: {
            'App-Key': appKey,
            'Nonce': nonce,
            'Timestamp': timestamp,
            'Signature': signature,
            'Content-Type': 'application/x-www-form-urlencoded'
          },
          body
        });

        const status = res.status;
        const text = await res.text();
        console.log(`[URL] ${url} | Algo: ${algo} | Status: ${status} | Body length: ${text.length}`);
        if (res.ok) {
          try {
            const json = JSON.parse(text);
            if (json.token) {
              console.log(`>>> SUCCESS: Valid token obtained using ${algo} on ${url}! Code: ${json.code}`);
              return;
            }
          } catch {}
        }
      } catch (e) {
        console.log(`[ERR] ${domain} ${algo}: ${e.message}`);
      }

      // Test 2: /v4/auth/access-token/issue (json)
      try {
        const url = `${domain}/v4/auth/access-token/issue`;
        const body = JSON.stringify({
          userId: testUserId,
          name: testName,
          portraitUri: 'https://spark.workplace/avatar.png'
        });

        const res = await fetch(url, {
          method: 'POST',
          headers: {
            'App-Key': appKey,
            'Nonce': nonce,
            'Timestamp': timestamp,
            'Signature': signature,
            'Content-Type': 'application/json'
          },
          body
        });

        const status = res.status;
        const text = await res.text();
        console.log(`[URL] ${url} | Algo: ${algo} | Status: ${status} | Body length: ${text.length}`);
        if (res.ok) {
          try {
            const json = JSON.parse(text);
            if (json.token) {
              console.log(`>>> SUCCESS: Valid token obtained using ${algo} on ${url}! Code: ${json.code}`);
              return;
            }
          } catch {}
        }
      } catch (e) {
        console.log(`[ERR] ${domain} ${algo}: ${e.message}`);
      }
    }
  }
}

testTokenIssuance().catch(console.error);

