const https = require('https');
const crypto = require('crypto');
const path = require('path');
const fs = require('fs');

const envPath = path.resolve('.env.local');
let appKey = '', appSecret = '';
if (fs.existsSync(envPath)) {
  const content = fs.readFileSync(envPath, 'utf8');
  for (const line of content.split('\n')) {
    const trimmed = line.trim();
    if (trimmed.startsWith('NEXCONN_APP_KEY=')) appKey = trimmed.split('=')[1].trim().replace(/^["'](.*)["']$/, '$1');
    if (trimmed.startsWith('NEXCONN_APP_SECRET=')) appSecret = trimmed.split('=')[1].trim().replace(/^["'](.*)["']$/, '$1');
  }
}

const nonce = crypto.randomUUID().replace(/-/g, '');
const timestamp = Date.now().toString();
const signature = crypto.createHash('sha1').update(appSecret + nonce + timestamp).digest('hex');

const body = new URLSearchParams({
  userId: '9a10bc03-d539-4933-a64e-b22f75e43197',
  name: 'test',
  portraitUri: 'https://spark.workplace/default-avatar.png'
}).toString();

const req = https.request({
  host: '47.84.112.16', // Real Singapore IP
  port: 443,
  path: '/user/getToken.json',
  method: 'POST',
  headers: {
    'Host': 'api.sg-light-api.com',
    'App-Key': appKey,
    'Nonce': nonce,
    'Timestamp': timestamp,
    'Signature': signature,
    'Content-Type': 'application/x-www-form-urlencoded',
    'Content-Length': Buffer.byteLength(body)
  },
  servername: 'api.sg-light-api.com' // SNI for TLS certificate validation
}, (res) => {
  let data = '';
  res.on('data', chunk => data += chunk);
  res.on('end', () => console.log('HTTP Status:', res.statusCode, 'Data:', data));
});

req.on('error', err => console.error('Req error:', err));
req.write(body);
req.end();

