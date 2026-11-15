const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

// Load environment variables from .env.local
const envPath = path.resolve('.env.local');
let appKey = '';
let appSecret = '';

if (fs.existsSync(envPath)) {
  const content = fs.readFileSync(envPath, 'utf8');
  for (const line of content.split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const match = trimmed.match(/^([A-Za-z0-9_]+)\s*=\s*(.*)$/);
    if (match) {
      const val = match[2].trim().replace(/^["'](.*)["']$/, '$1');
      if (match[1] === 'NEXCONN_APP_KEY') appKey = val;
      if (match[1] === 'NEXCONN_APP_SECRET') appSecret = val;
    }
  }
}

async function testLiveToken() {
  console.log('Testing live token issuance with credentials from .env.local...');
  console.log('App Key present:', Boolean(appKey));
  console.log('App Secret present:', Boolean(appSecret));

  const endpoints = [
    'https://api.rong-api.com/user/getToken.json',
    'https://api-sg.rongcloud.net/user/getToken.json',
    'https://api.cn.ronghub.com/user/getToken.json',
    'https://api-sg.ronghub.com/user/getToken.json',
    'https://api-na.ronghub.com/user/getToken.json',
    'https://api.rongcloud.net/user/getToken.json',
    'https://api-sg.nexconn.ai/user/getToken.json',
    'https://api.nexconn.ai/user/getToken.json'
  ];

  const nonce = crypto.randomUUID().replace(/-/g, '');
  const timestamp = Date.now().toString();
  const signature = crypto.createHash('sha1').update(`${appSecret}${nonce}${timestamp}`).digest('hex');

  const body = new URLSearchParams({
    userId: 'spark_test_user_001',
    name: 'Spark Tester',
    portraitUri: 'https://spark.workplace/avatar.png'
  }).toString();

  for (const url of endpoints) {
    try {
      console.log(`\nAttempting: ${url}`);
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

      console.log(`HTTP Status: ${res.status}`);
      const text = await res.text();
      console.log(`Response length: ${text.length}`);
      try {
        const json = JSON.parse(text);
        console.log(`Response JSON code: ${json.code}`);
        if (json.code === 200 && json.token) {
          console.log(`>>> SUCCESS! Live token received successfully! Token length: ${json.token.length}`);
          return json;
        } else {
          console.log(`Response message / error: ${json.errorMessage || json.msg || text.substring(0, 100)}`);
        }
      } catch {
        console.log(`Raw response: ${text.substring(0, 100)}`);
      }
    } catch (e) {
      console.log(`Fetch error on ${url}: ${e.message}`);
    }
  }
}

testLiveToken().catch(console.error);
