const { fork } = require('child_process');
const path = require('path');

const userA = {
  id: '79d57e19-c6d4-4e1a-96f7-e7775f002b5c',
  name: 'Vishal',
  email: 'vishal@gmail.com',
};

const userB = {
  id: '4854ec97-7917-4fc4-b7ac-2327bb184828',
  name: 'Magesh',
  email: 'mageshk.cse2024@citchennai.net',
};

const groupChannelId = 'spark_chan_spark-te_1794762736747_general';

console.log('================================================================');
console.log('SPARK — NEXCONN REAL-TIME FULL ACCEPTANCE VERIFICATION');
console.log('================================================================');
console.log(`User A (Vishal): ${userA.email} [${userA.id}]`);
console.log(`User B (Magesh): ${userB.email} [${userB.id}]`);
console.log(`Target Group: #${groupChannelId}\n`);

const workerScript = path.resolve('scripts/chat-client-worker.js');

let userAConnected = false;
let userBConnected = false;

const procA = fork(workerScript, ['--userId', userA.id, '--name', userA.name, '--role', 'UserA'], {
  stdio: ['inherit', 'pipe', 'pipe', 'ipc'],
});

const procB = fork(workerScript, ['--userId', userB.id, '--name', userB.name, '--role', 'UserB'], {
  stdio: ['inherit', 'pipe', 'pipe', 'ipc'],
});

procA.stdout.on('data', (d) => process.stdout.write(`[Vishal Client]: ${d}`));
procA.stderr.on('data', (d) => process.stdout.write(`[Vishal Client LOG]: ${d}`));
procB.stdout.on('data', (d) => process.stdout.write(`[Magesh Client]: ${d}`));
procB.stderr.on('data', (d) => process.stdout.write(`[Magesh Client LOG]: ${d}`));

let resolveDirectAtoB, resolveDirectBtoA;
let resolveGroupAtoB, resolveGroupBtoA;

const directAtoBPromise = new Promise((res) => { resolveDirectAtoB = res; });
const directBtoAPromise = new Promise((res) => { resolveDirectBtoA = res; });
const groupAtoBPromise = new Promise((res) => { resolveGroupAtoB = res; });
const groupBtoAPromise = new Promise((res) => { resolveGroupBtoA = res; });

procA.on('message', (msg) => {
  if (msg.type === 'CONNECTED' && msg.isOk) {
    userAConnected = true;
    console.log(`>>> [OK] User A (${userA.name}) connected to Nexconn Singapore WebSocket!`);
    checkBothConnected();
  } else if (msg.type === 'MESSAGE_RECEIVED') {
    if (msg.channelType === 1 && msg.senderUserId === userB.id) {
      if (resolveDirectBtoA) resolveDirectBtoA(msg);
    } else if (msg.channelType === 3 && msg.channelId === groupChannelId && msg.senderUserId === userB.id) {
      if (resolveGroupBtoA) resolveGroupBtoA(msg);
    }
  }
});

procB.on('message', (msg) => {
  if (msg.type === 'CONNECTED' && msg.isOk) {
    userBConnected = true;
    console.log(`>>> [OK] User B (${userB.name}) connected to Nexconn Singapore WebSocket!`);
    checkBothConnected();
  } else if (msg.type === 'MESSAGE_RECEIVED') {
    if (msg.channelType === 1 && msg.senderUserId === userA.id) {
      if (resolveDirectAtoB) resolveDirectAtoB(msg);
    } else if (msg.channelType === 3 && msg.channelId === groupChannelId && msg.senderUserId === userA.id) {
      if (resolveGroupAtoB) resolveGroupAtoB(msg);
    }
  }
});

let testStarted = false;
async function checkBothConnected() {
  if (userAConnected && userBConnected && !testStarted) {
    testStarted = true;
    console.log('\nBoth users authenticated & connected via WebSocket. Commencing bidirectional test suite...\n');
    await runSuite();
  }
}

async function runSuite() {
  try {
    // -------------------------------------------------------------
    // TEST 1: Direct Message (User A -> User B)
    // -------------------------------------------------------------
    console.log('----------------------------------------------------------------');
    console.log('TEST 1: 1-on-1 Direct Message: Vishal -> Magesh');
    console.log('----------------------------------------------------------------');
    const dmText1 = `Hi Magesh, direct ping at ${Date.now()}`;
    const t0 = Date.now();
    procA.send({ command: 'SEND_DIRECT_MESSAGE', targetUserId: userB.id, text: dmText1 });

    const receivedDM1 = await Promise.race([
      directAtoBPromise,
      new Promise((_, reject) => setTimeout(() => reject(new Error('Timeout waiting for Direct Message 1')), 10000)),
    ]);
    const dm1Latency = Date.now() - t0;
    console.log(`✓ PASS: Magesh received Vishal's Direct Message in ${dm1Latency} ms`);
    console.log(`  Message ID: ${receivedDM1.messageId}`);
    console.log(`  Payload: "${receivedDM1.text}"`);

    // -------------------------------------------------------------
    // TEST 2: Direct Message Reply (User B -> User A)
    // -------------------------------------------------------------
    console.log('\n----------------------------------------------------------------');
    console.log('TEST 2: 1-on-1 Direct Message Reply: Magesh -> Vishal');
    console.log('----------------------------------------------------------------');
    const dmText2 = `Got it Vishal! Replying directly at ${Date.now()}`;
    const t1 = Date.now();
    procB.send({ command: 'SEND_DIRECT_MESSAGE', targetUserId: userA.id, text: dmText2 });

    const receivedDM2 = await Promise.race([
      directBtoAPromise,
      new Promise((_, reject) => setTimeout(() => reject(new Error('Timeout waiting for Direct Reply 2')), 10000)),
    ]);
    const dm2Latency = Date.now() - t1;
    console.log(`✓ PASS: Vishal received Magesh's Direct Reply in ${dm2Latency} ms`);
    console.log(`  Message ID: ${receivedDM2.messageId}`);
    console.log(`  Payload: "${receivedDM2.text}"`);

    // -------------------------------------------------------------
    // TEST 3: Group Channel Message (User A -> #general -> User B)
    // -------------------------------------------------------------
    console.log('\n----------------------------------------------------------------');
    console.log('TEST 3: Group Channel Broadcast: Vishal -> #general -> Magesh');
    console.log('----------------------------------------------------------------');
    const groupText1 = `Team update from Vishal in #general at ${Date.now()}`;
    const t2 = Date.now();
    procA.send({ command: 'SEND_GROUP_MESSAGE', targetChannelId: groupChannelId, text: groupText1 });

    const receivedGroup1 = await Promise.race([
      groupAtoBPromise,
      new Promise((_, reject) => setTimeout(() => reject(new Error('Timeout waiting for Group Message 1')), 10000)),
    ]);
    const group1Latency = Date.now() - t2;
    console.log(`✓ PASS: Magesh received #general broadcast in ${group1Latency} ms`);
    console.log(`  Message ID: ${receivedGroup1.messageId}`);
    console.log(`  Payload: "${receivedGroup1.text}"`);

    // -------------------------------------------------------------
    // TEST 4: Group Channel Reply (User B -> #general -> User A)
    // -------------------------------------------------------------
    console.log('\n----------------------------------------------------------------');
    console.log('TEST 4: Group Channel Reply: Magesh -> #general -> Vishal');
    console.log('----------------------------------------------------------------');
    const groupText2 = `Ack team update from Magesh in #general at ${Date.now()}`;
    const t3 = Date.now();
    procB.send({ command: 'SEND_GROUP_MESSAGE', targetChannelId: groupChannelId, text: groupText2 });

    const receivedGroup2 = await Promise.race([
      groupBtoAPromise,
      new Promise((_, reject) => setTimeout(() => reject(new Error('Timeout waiting for Group Reply 2')), 10000)),
    ]);
    const group2Latency = Date.now() - t3;
    console.log(`✓ PASS: Vishal received #general reply in ${group2Latency} ms`);
    console.log(`  Message ID: ${receivedGroup2.messageId}`);
    console.log(`  Payload: "${receivedGroup2.text}"`);

    // -------------------------------------------------------------
    // FINAL RESULTS SUMMARY
    // -------------------------------------------------------------
    console.log('\n================================================================');
    console.log('SPARK LIVE ACCEPTANCE REPORT: NEXCONN CHAT SDK VERIFIED 100%');
    console.log('================================================================');
    console.table([
      { Test: 'DM Vishal -> Magesh', Status: 'PASS', Latency: `${dm1Latency} ms`, MsgId: receivedDM1.messageId },
      { Test: 'DM Magesh -> Vishal', Status: 'PASS', Latency: `${dm2Latency} ms`, MsgId: receivedDM2.messageId },
      { Test: '#general Vishal -> Magesh', Status: 'PASS', Latency: `${group1Latency} ms`, MsgId: receivedGroup1.messageId },
      { Test: '#general Magesh -> Vishal', Status: 'PASS', Latency: `${group2Latency} ms`, MsgId: receivedGroup2.messageId },
    ]);
    console.log('All real-time message tests completed successfully with zero mock data!\n');
  } catch (err) {
    console.error('\n✗ TEST FAILED:', err.message);
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
  console.error('\nFATAL: Overall test timed out after 35 seconds.');
  procA.kill();
  procB.kill();
  process.exit(1);
}, 35000);
