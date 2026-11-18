const { fork } = require('child_process');
const path = require('path');

const userA = {
  id: '79d57e19-c6d4-4e1a-96f7-e7775f002b5c',
  name: 'Vishal',
  email: 'vishal@gmail.com',
};

const userB = {
  id: '9a10bc03-d539-4933-a64e-b22f75e43197',
  name: 'test1',
  email: 'test1@gmail.com',
};

const groupChannelId = 'spark_chan_spark-te_1794762736747_general';

console.log('================================================================');
console.log('SPARK — LIVE REAL-TIME CHAT TEST: VISHAL & TEST1');
console.log('================================================================');
console.log(`User A: ${userA.name} (${userA.email}, ID: ${userA.id})`);
console.log(`User B: ${userB.name} (${userB.email}, ID: ${userB.id})`);
console.log(`Shared Group Channel: #${groupChannelId}\n`);

const workerScript = path.resolve('scripts/chat-client-worker.js');

let userAConnected = false;
let userBConnected = false;

const procA = fork(workerScript, ['--userId', userA.id, '--name', userA.name, '--role', 'Vishal'], {
  stdio: ['inherit', 'pipe', 'pipe', 'ipc'],
});

const procB = fork(workerScript, ['--userId', userB.id, '--name', userB.name, '--role', 'Test1'], {
  stdio: ['inherit', 'pipe', 'pipe', 'ipc'],
});

procA.stdout.on('data', (d) => process.stdout.write(`[Vishal Client]: ${d}`));
procA.stderr.on('data', (d) => process.stdout.write(`[Vishal LOG]: ${d}`));
procB.stdout.on('data', (d) => process.stdout.write(`[test1 Client]: ${d}`));
procB.stderr.on('data', (d) => process.stdout.write(`[test1 LOG]: ${d}`));

let resolveDirectStep1;
const directStep1Promise = new Promise((res) => { resolveDirectStep1 = res; });

let resolveDirectStep2;
const directStep2Promise = new Promise((res) => { resolveDirectStep2 = res; });

let resolveGroupStep1;
const groupStep1Promise = new Promise((res) => { resolveGroupStep1 = res; });

procA.on('message', (msg) => {
  if (msg.type === 'CONNECTED' && msg.isOk) {
    userAConnected = true;
    console.log(`>>> [OK] User A (${userA.name}) connected to Nexconn WebSocket!`);
    checkBothConnected();
  } else if (msg.type === 'MESSAGE_RECEIVED') {
    if (msg.channelType === 1 && msg.senderUserId === userB.id) {
      console.log(`>>> [LIVE RECEIVE] Vishal received DM reply from test1: "${msg.text}"`);
      if (resolveDirectStep2) resolveDirectStep2(msg);
    }
  }
});

procB.on('message', (msg) => {
  if (msg.type === 'CONNECTED' && msg.isOk) {
    userBConnected = true;
    console.log(`>>> [OK] User B (${userB.name}) connected to Nexconn WebSocket!`);
    checkBothConnected();
  } else if (msg.type === 'MESSAGE_RECEIVED') {
    if (msg.channelType === 1 && msg.senderUserId === userA.id) {
      console.log(`>>> [LIVE RECEIVE] test1 received DM from Vishal: "${msg.text}"`);
      if (resolveDirectStep1) resolveDirectStep1(msg);
    } else if (msg.channelType === 3 && msg.senderUserId === userA.id) {
      console.log(`>>> [LIVE RECEIVE] test1 received #general broadcast from Vishal: "${msg.text}"`);
      if (resolveGroupStep1) resolveGroupStep1(msg);
    }
  }
});

let testStarted = false;
async function checkBothConnected() {
  if (userAConnected && userBConnected && !testStarted) {
    testStarted = true;
    console.log('\nBoth users actively connected! Commencing live tests...\n');
    await runMessageExchange();
  }
}

async function runMessageExchange() {
  try {
    // 1. Direct Message Vishal -> test1
    console.log('--- TEST 1: 1-on-1 Direct Message: Vishal -> test1 ---');
    const msg1 = `Hello test1! Welcome to SPARK! (Sent at ${Date.now()})`;
    const t1 = Date.now();
    procA.send({ command: 'SEND_DIRECT_MESSAGE', targetUserId: userB.id, text: msg1 });

    const rec1 = await Promise.race([
      directStep1Promise,
      new Promise((_, r) => setTimeout(() => r(new Error('Timeout waiting for test1 to receive DM')), 10000)),
    ]);
    const lat1 = Date.now() - t1;
    console.log(`✓ PASS: test1 received Vishal's DM in ${lat1}ms! (Msg ID: ${rec1.messageId})`);

    // 2. Direct Reply test1 -> Vishal
    console.log('\n--- TEST 2: 1-on-1 Direct Message: test1 -> Vishal [REPLY] ---');
    const reply1 = `Hey Vishal, test1 is live and chatting! (Sent at ${Date.now()})`;
    const t2 = Date.now();
    procB.send({ command: 'SEND_DIRECT_MESSAGE', targetUserId: userA.id, text: reply1 });

    const rec2 = await Promise.race([
      directStep2Promise,
      new Promise((_, r) => setTimeout(() => r(new Error('Timeout waiting for Vishal to receive reply')), 10000)),
    ]);
    const lat2 = Date.now() - t2;
    console.log(`✓ PASS: Vishal received test1's reply in ${lat2}ms! (Msg ID: ${rec2.messageId})`);

    // 3. Group Channel Message Vishal -> #general -> test1
    console.log('\n--- TEST 3: Group Channel Broadcast: Vishal -> #general -> test1 ---');
    const grpMsg = `Welcome test1 to #general team channel! (Sent at ${Date.now()})`;
    const t3 = Date.now();
    procA.send({ command: 'SEND_GROUP_MESSAGE', targetChannelId: groupChannelId, text: grpMsg });

    const rec3 = await Promise.race([
      groupStep1Promise,
      new Promise((_, r) => setTimeout(() => r(new Error('Timeout waiting for test1 to receive #general message')), 10000)),
    ]);
    const lat3 = Date.now() - t3;
    console.log(`✓ PASS: test1 received #general message in ${lat3}ms! (Msg ID: ${rec3.messageId})`);

    console.log('\n================================================================');
    console.log('>>> ALL TESTS PASSED: VISHAL & TEST1 REAL-TIME CHAT VERIFIED <<<');
    console.log('================================================================');
  } catch (err) {
    console.error('Test error:', err.message);
  } finally {
    procA.send({ command: 'DISCONNECT' });
    procB.send({ command: 'DISCONNECT' });
    setTimeout(() => {
      procA.kill();
      procB.kill();
      process.exit(0);
    }, 2000);
  }
}

setTimeout(() => {
  console.error('FATAL: Timeout after 30 seconds');
  procA.kill();
  procB.kill();
  process.exit(1);
}, 30000);

