const path = require('path');
const fs = require('fs');
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

async function testTokenOnRongcloud() {
  const appKey = process.env.NEXCONN_APP_KEY;
  const appSecret = process.env.NEXCONN_APP_SECRET;
  const nonce = crypto.randomUUID().replace(/-/g, '');
  const timestamp = Date.now().toString();
  const signature = crypto.createHash('sha1').update(`${appSecret}${nonce}${timestamp}`).digest('hex');

  const headers = {
    'App-Key': appKey,
    Nonce: nonce,
    Timestamp: timestamp,
    Signature: signature,
    'Content-Type': 'application/x-www-form-urlencoded',
  };

  const body = new URLSearchParams({
    userId: '9a10bc03-d539-4933-a64e-b22f75e43197', // test1
    name: 'test',
    portraitUri: 'https://spark.workplace/default-avatar.png',
  }).toString();

  const url = 'https://api-sg.rongcloud.net/user/getToken.json';
  console.log('Sending request to:', url);
  const res = await fetch(url, {
    method: 'POST',
    headers,
    body,
  });

  console.log('Status:', res.status);
  const data = await res.json();
  console.log('Result:', data);
}

testTokenOnRongcloud().catch(console.error);

