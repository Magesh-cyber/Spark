const path = require('path');
const fs = require('fs');
const crypto = require('crypto');
const https = require('https');

// 1. Browser globals shim for Node.js
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

// Parse args
const args = process.argv.slice(2);
function getArg(name) {
  const idx = args.indexOf(`--${name}`);
  return idx !== -1 ? args[idx + 1] : null;
}

const userId = getArg('userId') || 'test-user-a';
const userName = getArg('name') || 'User A';
const role = getArg('role') || 'CLIENT';

function getLiveToken(uId, name) {
  const key = process.env.NEXCONN_APP_KEY;
  const secret = process.env.NEXCONN_APP_SECRET;
  const nonce = crypto.randomUUID().replace(/-/g, '');
  const timestamp = Date.now().toString();
  const signature = crypto.createHash('sha1').update(`${secret}${nonce}${timestamp}`).digest('hex');

  const postData = new URLSearchParams({
    userId: uId,
    name,
    portraitUri: 'https://spark.workplace/default-avatar.png',
  }).toString();

  const candidateHosts = [
    'api-sg01.ronghub.com',
    'api.sg-light-api.com',
    'api-b.sg-light-api.com',
    '47.84.112.16',
    '47.84.107.146',
  ];

  return new Promise((resolve, reject) => {
    function tryHost(index) {
      if (index >= candidateHosts.length) {
        return reject(new Error('Failed to obtain token from all endpoints'));
      }
      const host = candidateHosts[index];
      const req = https.request({
        host,
        port: 443,
        path: '/user/getToken.json',
        method: 'POST',
        headers: {
          Host: host.match(/^\d/) ? 'api-sg01.ronghub.com' : host,
          'App-Key': key,
          Nonce: nonce,
          Timestamp: timestamp,
          Signature: signature,
          'Content-Type': 'application/x-www-form-urlencoded',
          'Content-Length': Buffer.byteLength(postData),
        },
        servername: host.match(/^\d/) ? 'api-sg01.ronghub.com' : host,
        timeout: 4000,
      }, (res) => {
        let raw = '';
        res.on('data', chunk => raw += chunk);
        res.on('end', () => {
          try {
            const data = JSON.parse(raw);
            if (data.code === 200 && data.token) return resolve(data.token);
            tryHost(index + 1);
          } catch {
            tryHost(index + 1);
          }
        });
      });

      req.on('error', () => tryHost(index + 1));
      req.on('timeout', () => {
        req.destroy();
        tryHost(index + 1);
      });

      req.write(postData);
      req.end();
    }

    tryHost(0);
  });
}

async function start() {
  const {
    NCEngine,
    AreaCode,
    LogLevel,
    ConnectionStatusHandler,
    MessageHandler,
    DirectChannel,
    GroupChannel,
    SendTextMessageParams,
  } = require('@nexconn/chat');

  const appKey = process.env.NEXT_PUBLIC_NEXCONN_APP_KEY || process.env.NEXCONN_APP_KEY;

  // 1. Initialize NCEngine
  NCEngine.initialize({
    appKey,
    logLevel: LogLevel.WARN,
    areaCode: AreaCode.SG,
  });

  // 2. Setup handlers
  NCEngine.addConnectionStatusHandler(
    `status-handler-${userId}`,
    new ConnectionStatusHandler({
      onConnectionStatusChanged({ status }) {
        if (process.send) {
          process.send({ type: 'STATUS_CHANGED', status, userId });
        }
      },
    })
  );

  NCEngine.addMessageHandler(
    `msg-handler-${userId}`,
    new MessageHandler({
      onMessageReceived(event) {
        const msgs = event.messages || [];
        for (const msg of msgs) {
          if (process.send) {
            process.send({
              type: 'MESSAGE_RECEIVED',
              recipientUserId: userId,
              senderUserId: msg.senderUserId,
              channelId: msg.channelIdentifier?.channelId,
              channelType: msg.channelIdentifier?.channelType,
              text: msg.content?.text || '',
              messageType: msg.messageType,
              messageId: msg.messageId,
              sentTime: msg.sentTime,
            });
          }
        }
      },
    })
  );

  // 3. Obtain token and connect
  const token = await getLiveToken(userId, userName);
  const connectRes = await NCEngine.connect({ token });

  if (process.send) {
    process.send({
      type: 'CONNECTED',
      userId,
      isOk: connectRes ? connectRes.isOk : false,
      result: connectRes,
    });
  }

  // 4. Handle commands from coordinator
  process.on('message', async (cmd) => {
    if (!cmd || !cmd.command) return;

    if (cmd.command === 'SEND_DIRECT_MESSAGE') {
      try {
        const channel = new DirectChannel(cmd.targetUserId);
        const params = new SendTextMessageParams({ text: cmd.text });
        const res = await channel.sendMessage(params);
        if (process.send) {
          process.send({
            type: 'MESSAGE_SENT',
            senderUserId: userId,
            targetUserId: cmd.targetUserId,
            text: cmd.text,
            isOk: res ? res.isOk : false,
            result: res,
          });
        }
      } catch (err) {
        if (process.send) {
          process.send({
            type: 'MESSAGE_SEND_ERROR',
            senderUserId: userId,
            error: err.message,
          });
        }
      }
    } else if (cmd.command === 'SEND_GROUP_MESSAGE') {
      try {
        const channel = new GroupChannel(cmd.targetChannelId);
        const params = new SendTextMessageParams({ text: cmd.text });
        const res = await channel.sendMessage(params);
        if (process.send) {
          process.send({
            type: 'GROUP_MESSAGE_SENT',
            senderUserId: userId,
            targetChannelId: cmd.targetChannelId,
            text: cmd.text,
            isOk: res ? res.isOk : false,
            result: res,
          });
        }
      } catch (err) {
        if (process.send) {
          process.send({
            type: 'GROUP_MESSAGE_SEND_ERROR',
            senderUserId: userId,
            error: err.message,
          });
        }
      }
    } else if (cmd.command === 'DISCONNECT') {
      try {
        NCEngine.disconnect();
      } catch {}
      process.exit(0);
    }
  });
}

start().catch((err) => {
  if (process.send) {
    process.send({ type: 'ERROR', error: err.message || String(err) });
  }
  process.exit(1);
});
