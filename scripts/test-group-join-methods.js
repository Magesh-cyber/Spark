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

async function testServerGroupAPI() {
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
  const user1 = '79d57e19-c6d4-4e1a-96f7-e7775f002b5c';
  const user2 = '4854ec97-7917-4fc4-b7ac-2327bb184828';

  // Try /group/create.json
  console.log('Testing /group/create.json on Nexconn Server API...');
  try {
    const createParams = new URLSearchParams();
    createParams.append('userId', user1);
    createParams.append('userId', user2);
    createParams.append('groupId', groupId);
    createParams.append('groupName', 'general');

    const res = await fetch('https://api.sg-light-api.com/group/create.json', {
      method: 'POST',
      headers,
      body: createParams.toString(),
    });

    const data = await res.json();
    console.log('/group/create.json response:', data);
  } catch (err) {
    console.error('Error on /group/create.json:', err);
  }

  // Try /group/join.json
  console.log('Testing /group/join.json on Nexconn Server API...');
  try {
    const joinParams = new URLSearchParams();
    joinParams.append('userId', user1);
    joinParams.append('userId', user2);
    joinParams.append('groupId', groupId);
    joinParams.append('groupName', 'general');

    const res = await fetch('https://api.sg-light-api.com/group/join.json', {
      method: 'POST',
      headers,
      body: joinParams.toString(),
    });

    const data = await res.json();
    console.log('/group/join.json response:', data);
  } catch (err) {
    console.error('Error on /group/join.json:', err);
  }
}

testServerGroupAPI();

