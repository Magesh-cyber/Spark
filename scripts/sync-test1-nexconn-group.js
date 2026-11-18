process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';
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

async function main() {
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

  const groupId = 'spark_chan_spark-te_1794762736747_general';
  const test1UserId = '9a10bc03-d539-4933-a64e-b22f75e43197';

  const params = new URLSearchParams();
  params.append('userId', test1UserId);
  params.append('groupId', groupId);
  params.append('groupName', 'general');

  const res = await fetch('https://api.sg-light-api.com/group/join.json', {
    method: 'POST',
    headers,
    body: params.toString(),
  });

  const data = await res.text();
  console.log('Joined test1 to #general on Nexconn:', data);
}

main().catch(console.error);
