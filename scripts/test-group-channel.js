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

const workerScript = path.resolve('scripts/chat-client-worker.js');

let userAConnected = false;
let userBConnected = false;

const procA = fork(workerScript, ['--userId', userA.id, '--name', userA.name, '--role', 'UserA'], {
  stdio: ['inherit', 'pipe', 'pipe', 'ipc'],
});

const procB = fork(workerScript, ['--userId', userB.id, '--name', userB.name, '--role', 'UserB'], {
  stdio: ['inherit', 'pipe', 'pipe', 'ipc'],
});

procA.stdout.on('data', (d) => process.stdout.write(`[A]: ${d}`));
procA.stderr.on('data', (d) => process.stderr.write(`[A ERR]: ${d}`));
procB.stdout.on('data', (d) => process.stdout.write(`[B]: ${d}`));
procB.stderr.on('data', (d) => process.stderr.write(`[B ERR]: ${d}`));

let groupMsgReceived = false;

procA.on('message', (msg) => {
  if (msg.type === 'CONNECTED' && msg.isOk) {
    userAConnected = true;
    checkBothConnected();
  }
});

procB.on('message', (msg) => {
  if (msg.type === 'CONNECTED' && msg.isOk) {
    userBConnected = true;
    checkBothConnected();
  } else if (msg.type === 'MESSAGE_RECEIVED') {
    console.log(`[User B received group message]:`, msg);
    groupMsgReceived = true;
  }
});

let testStarted = false;
async function checkBothConnected() {
  if (userAConnected && userBConnected && !testStarted) {
    testStarted = true;
    console.log('\nBoth users connected! Sending group message to:', groupChannelId);

    procA.send({
      command: 'SEND_GROUP_MESSAGE',
      targetChannelId: groupChannelId,
      text: `Hello #general group! Timestamp: ${new Date().toISOString()}`,
    });

    setTimeout(() => {
      console.log('Group message received status by B:', groupMsgReceived);
      procA.send({ command: 'DISCONNECT' });
      procB.send({ command: 'DISCONNECT' });
      setTimeout(() => {
        procA.kill();
        procB.kill();
        process.exit(0);
      }, 1000);
    }, 5000);
  }
}

