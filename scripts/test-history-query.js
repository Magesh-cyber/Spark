const path = require('path');
const fs = require('fs');
const crypto = require('crypto');
const https = require('https');

global.window = {
  addEventListener: () => {},
  removeEventListener: () => {},
  location: { protocol: 'https:' },
  localStorage: { getItem: () => null, setItem: () => {}, removeItem: () => {} },
  sessionStorage: { getItem: () => null, setItem: () => {}, removeItem: () => {} },
};
global.navigator = { userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)' };
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
  open(method, url) { this.method = method; this.url = url; this.readyState = 1; }
  setRequestHeader(k, v) { this.headers[k] = v; }
  send(body) {
    fetch(this.url, { method: this.method, headers: this.headers, body: body || undefined })
      .then(async (res) => {
        this.status = res.status;
        this.responseText = await res.text();
        this.readyState = 4;
        if (this.onreadystatechange) this.onreadystatechange();
      })
      .catch((err) => {
        this.status = 500;
        if (this.onerror) this.onerror(err);
        if (this.onreadystatechange) this.onreadystatechange();
      });
  }
}
global.XMLHttpRequest = MockXHR;

const envPath = path.resolve('.env.local');
if (fs.existsSync(envPath)) {
  for (const line of fs.readFileSync(envPath, 'utf8').split('\n')) {
    const m = line.trim().match(/^([A-Za-z0-9_]+)\s*=\s*(.*)$/);
    if (m) process.env[m[1]] = m[2].trim().replace(/^["'](.*)["']$/, '$1');
  }
}

function getLiveToken(userId, name) {
  const key = process.env.NEXCONN_APP_KEY;
  const secret = process.env.NEXCONN_APP_SECRET;
  const nonce = crypto.randomUUID().replace(/-/g, '');
  const timestamp = Date.now().toString();
  const signature = crypto.createHash('sha1').update(`${secret}${nonce}${timestamp}`).digest('hex');
  const postData = new URLSearchParams({ userId, name, portraitUri: 'https://spark.workplace/default-avatar.png' }).toString();

  return new Promise((resolve, reject) => {
    const req = https.request({
      host: '47.84.112.16',
      port: 443,
      path: '/user/getToken.json',
      method: 'POST',
      headers: {
        Host: 'api.sg-light-api.com',
        'App-Key': key, Nonce: nonce, Timestamp: timestamp, Signature: signature,
        'Content-Type': 'application/x-www-form-urlencoded',
        'Content-Length': Buffer.byteLength(postData),
      },
      servername: 'api.sg-light-api.com',
    }, (res) => {
      let raw = '';
      res.on('data', (c) => (raw += c));
      res.on('end', () => resolve(JSON.parse(raw).token));
    });
    req.on('error', reject);
    req.write(postData);
    req.end();
  });
}

async function run() {
  const vishalId = '79d57e19-c6d4-4e1a-96f7-e7775f002b5c';
  const test1Id = '9a10bc03-d539-4933-a64e-b22f75e43197';
  const generalId = 'spark_chan_spark-te_1794762736747_general';

  const {
    NCEngine, AreaCode, LogLevel, BaseChannel,
    DirectChannelIdentifier, GroupChannelIdentifier,
  } = require('@nexconn/chat');

  NCEngine.initialize({
    appKey: process.env.NEXT_PUBLIC_NEXCONN_APP_KEY || process.env.NEXCONN_APP_KEY,
    logLevel: LogLevel.WARN,
    areaCode: AreaCode.SG,
  });

  const token = await getLiveToken(vishalId, 'Vishal');
  const conn = await NCEngine.connect({ token });
  console.log('Connected as Vishal:', conn.isOk, conn.code);

  // 1. Test Direct Messages history (Vishal <-> test1)
  const dmQuery = BaseChannel.createMessagesQuery({
    channelIdentifier: new DirectChannelIdentifier(test1Id),
    pageSize: 20,
  });
  const dmRes = await dmQuery.loadNextPage();
  console.log('\nDM Query Result isOk:', dmRes.isOk, 'code:', dmRes.code, 'msg:', dmRes.msg);
  console.log('DM Result data keys:', dmRes.data ? Object.keys(dmRes.data) : null);
  console.log('DM Result data.data length:', dmRes.data?.data?.length);
  if (dmRes.data?.data?.length) {
    console.log('Latest 3 DM messages:', dmRes.data.data.slice(-3).map((m) => ({
      id: m.messageId, sender: m.senderUserId, text: m.content?.text, time: new Date(m.sentTime).toISOString(),
    })));
  }

  // 2. Test Group Messages history (#general)
  const grpQuery = BaseChannel.createMessagesQuery({
    channelIdentifier: new GroupChannelIdentifier(generalId),
    pageSize: 20,
  });
  const grpRes = await grpQuery.loadNextPage();
  console.log('\nGroup Query Result isOk:', grpRes.isOk, 'code:', grpRes.code, 'msg:', grpRes.msg);
  console.log('Group Result data.data length:', grpRes.data?.data?.length);
  if (grpRes.data?.data?.length) {
    console.log('Latest 3 Group messages:', grpRes.data.data.slice(-3).map((m) => ({
      id: m.messageId, sender: m.senderUserId, text: m.content?.text, time: new Date(m.sentTime).toISOString(),
    })));
  }

  // 3. Test Channels Query (conversations summary)
  const chQuery = BaseChannel.createChannelsQuery({ pageSize: 20 });
  const chRes = await chQuery.loadNextPage();
  console.log('\nChannels Query isOk:', chRes.isOk, 'code:', chRes.code, 'count:', chRes.data?.data?.length);
  if (chRes.data?.data?.length) {
    console.log('Channels:', chRes.data.data.map((ch) => ({
      id: ch.channelId, type: ch.channelType, unread: ch.unreadCount, latestText: ch.latestMessage?.content?.text,
    })));
  }

  NCEngine.disconnect();
  process.exit(0);
}

run().catch((e) => { console.error(e); process.exit(1); });
