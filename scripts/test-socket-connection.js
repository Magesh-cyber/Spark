const path = require('path');
const fs = require('fs');
const crypto = require('crypto');

// 1. Shims for Node environment
global.window = {
  addEventListener: () => {},
  removeEventListener: () => {},
  location: { protocol: 'https:' },
  localStorage: { getItem: () => null, setItem: () => {}, removeItem: () => {} },
  sessionStorage: { getItem: () => null, setItem: () => {}, removeItem: () => {} },
};
global.navigator = { userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36' };
global.location = global.window.location;
global.localStorage = global.window.localStorage;
global.sessionStorage = global.window.sessionStorage;

// XMLHttpRequest shim
class MockXHR {
  constructor() {
    this.headers = {};
    this.readyState = 0;
    this.status = 0;
    this.responseText = '';
    this.onreadystatechange = null;
    this.onerror = null;
    this.upload = { addEventListener: () => {} };
  }
  open(method, url) {
    this.method = method;
    this.url = url;
    this.readyState = 1;
  }
  setRequestHeader(key, val) {
    this.headers[key] = val;
  }
  send(body) {
    fetch(this.url, {
      method: this.method,
      headers: this.headers,
      body: body || undefined,
    }).then(async (res) => {
      this.status = res.status;
      this.responseText = await res.text();
      this.readyState = 4;
      if (this.onreadystatechange) this.onreadystatechange();
    }).catch((err) => {
      this.status = 500;
      if (this.onerror) this.onerror(err);
      if (this.onreadystatechange) this.onreadystatechange();
    });
  }
}
global.XMLHttpRequest = MockXHR;

// 2. Load .env.local
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

async function getLiveToken(userId, name) {
  const appKey = process.env.NEXCONN_APP_KEY;
  const appSecret = process.env.NEXCONN_APP_SECRET;
  const nonce = crypto.randomUUID().replace(/-/g, '');
  const timestamp = Date.now().toString();
  const signature = crypto.createHash('sha1').update(`${appSecret}${nonce}${timestamp}`).digest('hex');

  const res = await fetch('https://api.sg-light-api.com/user/getToken.json', {
    method: 'POST',
    headers: {
      'App-Key': appKey,
      Nonce: nonce,
      Timestamp: timestamp,
      Signature: signature,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: new URLSearchParams({
      userId,
      name,
      portraitUri: 'https://spark.workplace/default-avatar.png',
    }).toString(),
  });

  const data = await res.json();
  if (data.code !== 200 || !data.token) {
    throw new Error(`Nexconn Token API error: ${JSON.stringify(data)}`);
  }
  return data.token;
}

async function run() {
  console.log('[PROBE] Requesting real live token for test user...');
  const testUserId = 'test-user-probe-01';
  const token = await getLiveToken(testUserId, 'Probe User');
  console.log('[PROBE] Token successfully obtained! Length:', token.length);

  const { NCEngine, AreaCode, LogLevel, ConnectionStatusHandler } = require('@nexconn/chat');
  const appKey = process.env.NEXT_PUBLIC_NEXCONN_APP_KEY || process.env.NEXCONN_APP_KEY;

  console.log('[PROBE] Initializing NCEngine...');
  NCEngine.initialize({
    appKey,
    logLevel: LogLevel.WARN,
    areaCode: AreaCode.SG,
  });

  NCEngine.addConnectionStatusHandler(
    'test-status-handler',
    new ConnectionStatusHandler({
      onConnectionStatusChanged({ status }) {
        console.log('[PROBE] Connection status changed:', status);
      },
    })
  );

  console.log('[PROBE] Connecting to Nexconn with token...');
  const connectRes = await NCEngine.connect({ token });
  console.log('[PROBE] Connect result:', JSON.stringify(connectRes));

  const currentId = NCEngine.getCurrentUserId();
  console.log('[PROBE] Current user ID reported by NCEngine:', currentId);

  setTimeout(() => {
    console.log('[PROBE] Test complete, disconnecting...');
    NCEngine.disconnect();
    process.exit(0);
  }, 3000);
}

run().catch((err) => {
  console.error('[PROBE ERROR]:', err);
  process.exit(1);
});

