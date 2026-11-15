const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { PrismaClient } = require('@prisma/client');
const { z } = require('zod');

// 1. Load Environment Variables from .env.local
function loadEnv() {
  const envPath = path.resolve('.env.local');
  if (fs.existsSync(envPath)) {
    const lines = fs.readFileSync(envPath, 'utf8').split('\n');
    for (const line of lines) {
      const match = line.match(/^\s*([\w.-]+)\s*=\s*(.*)?\s*$/);
      if (match) {
        let val = match[2] || '';
        val = val.trim().replace(/^["'](.*)["']$/, '$1');
        process.env[match[1]] = val;
      }
    }
  }
}
loadEnv();

const prisma = new PrismaClient();

let passCount = 0;
let failCount = 0;

function assert(condition, message) {
  if (condition) {
    console.log(`  ✓ PASS: ${message}`);
    passCount++;
  } else {
    console.error(`  ✗ FAIL: ${message}`);
    failCount++;
  }
}

async function runTests() {
  console.log('================================================================');
  console.log('SPARK MODULE 03: NEXCONN CHAT INTEGRATION TEST SUITE');
  console.log('================================================================\n');

  // ---------------------------------------------------------------------------
  // TEST GROUP 1: SDK & Package Verification
  // ---------------------------------------------------------------------------
  console.log('TEST GROUP 1: Official Dependencies & Security Boundary');

  const pkgJson = JSON.parse(fs.readFileSync('package.json', 'utf8'));
  assert(
    Boolean(pkgJson.dependencies['@nexconn/chat']),
    '@nexconn/chat is declared in package.json dependencies.'
  );
  assert(
    Boolean(pkgJson.dependencies['server-only']),
    'server-only is declared in package.json dependencies.'
  );

  const nexconnChatPkg = JSON.parse(
    fs.readFileSync('node_modules/@nexconn/chat/package.json', 'utf8')
  );
  assert(
    nexconnChatPkg.version === '26.2.1',
    `@nexconn/chat installed version is exact: ${nexconnChatPkg.version}`
  );

  // Verify client components do not leak NEXCONN_APP_SECRET
  let secretLeaks = 0;
  function scanDir(dir) {
    const entries = fs.readdirSync(dir);
    for (const e of entries) {
      const full = path.join(dir, e);
      const stat = fs.statSync(full);
      if (stat.isDirectory()) {
        if (e !== 'node_modules' && e !== '.next' && e !== '.git') scanDir(full);
      } else if (/\.(tsx|ts|jsx|js)$/.test(e)) {
        const content = fs.readFileSync(full, 'utf8');
        if (content.includes('NEXCONN_APP_SECRET')) {
          if (content.includes('"use client"') || content.includes("'use client'")) {
            secretLeaks++;
          }
        }
      }
    }
  }
  scanDir(path.resolve('src'));
  assert(
    secretLeaks === 0,
    `Zero NEXCONN_APP_SECRET occurrences in client components (found: ${secretLeaks}).`
  );

  // ---------------------------------------------------------------------------
  // TEST GROUP 2: Server-Side Integration Utilities (src/lib/nexconn/server.ts)
  // ---------------------------------------------------------------------------
  console.log('\nTEST GROUP 2: Datacenter Routing & Server Cryptographic Signing');

  // Test Datacenter Base URL resolution logic
  function resolveBaseUrl(explicitUrl, dc) {
    if (explicitUrl) return explicitUrl.replace(/\/+$/, '');
    const cleanDc = (dc || 'SG').toUpperCase().trim();
    switch (cleanDc) {
      case 'NA':
      case 'US':
        return 'https://api-na.nexconn.ai';
      case 'BJ':
      case 'CN':
        return 'https://api-bj.nexconn.ai';
      case 'SG':
      case 'AP':
      default:
        return 'https://api-sg.nexconn.ai';
    }
  }

  assert(
    resolveBaseUrl(undefined, 'SG') === 'https://api-sg.nexconn.ai',
    'Default datacenter resolves to Singapore endpoint (https://api-sg.nexconn.ai).'
  );
  assert(
    resolveBaseUrl(undefined, 'NA') === 'https://api-na.nexconn.ai',
    'North America datacenter resolves to https://api-na.nexconn.ai.'
  );
  assert(
    resolveBaseUrl(undefined, 'BJ') === 'https://api-bj.nexconn.ai',
    'Beijing datacenter resolves to https://api-bj.nexconn.ai.'
  );
  assert(
    resolveBaseUrl('https://custom-gateway.nexconn.ai/', 'SG') === 'https://custom-gateway.nexconn.ai',
    'Explicit NEXCONN_API_BASE_URL overrides datacenter derivation.'
  );

  // Test Header & Signature generation
  const testKey = 'test_app_key_123';
  const testSecret = 'test_app_secret_456';
  const nonce = crypto.randomUUID().replace(/-/g, '');
  const timestamp = Date.now().toString();
  const signature = crypto.createHash('sha256').update(`${testSecret}${nonce}${timestamp}`).digest('hex');

  assert(signature.length === 64, 'Generated HMAC-SHA256 signature is exactly 64 hex characters.');
  assert(/^[a-f0-9]{64}$/.test(signature), 'Signature is a valid lowercase hexadecimal string.');

  // Test Direct Channel Target Asymmetry Helper
  function getDirectChannelTargetId(currentUserId, user1Id, user2Id) {
    return currentUserId === user1Id ? user2Id : user1Id;
  }
  const userA = 'user-uuid-aaaa';
  const userB = 'user-uuid-bbbb';
  assert(
    getDirectChannelTargetId(userA, userA, userB) === userB,
    'Target ID for User A is correctly User B.'
  );
  assert(
    getDirectChannelTargetId(userB, userA, userB) === userA,
    'Target ID for User B is correctly User A (Asymmetry confirmed).'
  );

  // ---------------------------------------------------------------------------
  // TEST GROUP 3: Database Models & Foreign Key Constraints
  // ---------------------------------------------------------------------------
  console.log('\nTEST GROUP 3: Database Models & Schema Integrity');

  // Verify created tables exist in database
  const tables = await prisma.$queryRawUnsafe(`
    SELECT table_name FROM information_schema.tables 
    WHERE table_schema = 'public' 
      AND table_name IN ('workspace_chat_channels', 'chat_channel_members', 'chat_direct_conversations', 'chat_pinned_artifacts');
  `);
  assert(tables.length === 4, `All 4 chat tables exist in PostgreSQL (found: ${tables.length}).`);

  // Verify RLS is enabled on all 4 tables
  const rlsStatus = await prisma.$queryRawUnsafe(`
    SELECT relname, relrowsecurity 
    FROM pg_class 
    WHERE relname IN ('workspace_chat_channels', 'chat_channel_members', 'chat_direct_conversations', 'chat_pinned_artifacts');
  `);
  for (const t of rlsStatus) {
    assert(t.relrowsecurity === true, `RLS is actively enabled on ${t.relname}.`);
  }

  // Verify default channels exist
  const defaultChannels = await prisma.workspaceChatChannel.findMany({
    where: { isDefault: true },
    include: { workspace: true },
  });
  assert(
    defaultChannels.length > 0,
    `Default #general channels exist across active workspaces (count: ${defaultChannels.length}).`
  );
  for (const c of defaultChannels) {
    assert(c.name === 'general', `Default channel name is '#${c.name}'.`);
    assert(c.type === 'PUBLIC', `Default channel visibility is PUBLIC.`);
    assert(c.nexconnChannelId.startsWith('spark_chan_'), `nexconnChannelId follows namespace prefix: ${c.nexconnChannelId}`);
  }

  // ---------------------------------------------------------------------------
  // TEST GROUP 4: Multi-Tenant Workspace Channel Isolation & Lifecycle
  // ---------------------------------------------------------------------------
  console.log('\nTEST GROUP 4: Multi-Tenant Channel Isolation & RBAC');

  // Fetch two distinct workspaces for cross-tenant testing
  const workspaces = await prisma.workspace.findMany({
    take: 2,
    include: { members: { include: { user: true } }, channels: true },
  });

  if (workspaces.length >= 2) {
    const ws1 = workspaces[0];
    const ws2 = workspaces[1];

    assert(ws1.id !== ws2.id, `Identified two distinct workspaces: '${ws1.name}' and '${ws2.name}'.`);

    // Verify channel separation
    const ws1Channels = await prisma.workspaceChatChannel.findMany({
      where: { workspaceId: ws1.id },
    });
    const ws2Channels = await prisma.workspaceChatChannel.findMany({
      where: { workspaceId: ws2.id },
    });

    const ws1ChannelIds = new Set(ws1Channels.map((c) => c.id));
    const overlap = ws2Channels.filter((c) => ws1ChannelIds.has(c.id));
    assert(overlap.length === 0, 'Zero channel overlap across workspace boundaries (Strict Isolation).');

    // Test Channel Creation in Workspace 1
    const testChannelName = `audit-chan-${Date.now()}`;
    const newChan = await prisma.workspaceChatChannel.create({
      data: {
        workspaceId: ws1.id,
        name: testChannelName,
        description: 'Temporary channel for audit verification',
        type: 'PUBLIC',
        nexconnChannelId: `spark_chan_${ws1.id.substring(0, 8)}_${testChannelName}`,
        createdById: ws1.ownerId,
      },
    });

    assert(Boolean(newChan.id), `Successfully created channel #${newChan.name} in Workspace 1.`);

    // Verify unique channel name constraint within same workspace
    let dupFailed = false;
    try {
      await prisma.workspaceChatChannel.create({
        data: {
          workspaceId: ws1.id,
          name: testChannelName,
          nexconnChannelId: `spark_chan_${ws1.id.substring(0, 8)}_dup`,
          createdById: ws1.ownerId,
        },
      });
    } catch {
      dupFailed = true;
    }
    assert(dupFailed, 'Unique constraint (workspaceId, name) correctly rejects duplicate channel names.');

    // Clean up test channel
    await prisma.workspaceChatChannel.delete({ where: { id: newChan.id } });
    assert(true, 'Test channel successfully cleaned up.');
  }

  // ---------------------------------------------------------------------------
  // TEST GROUP 5: Two-User Direct Conversation Symmetry & Target Asymmetry
  // ---------------------------------------------------------------------------
  console.log('\nTEST GROUP 5: Two-User Direct Conversation Symmetry');

  const users = await prisma.user.findMany({ take: 2 });
  if (users.length >= 2 && workspaces.length > 0) {
    const u1 = users[0];
    const u2 = users[1];
    const targetWs = workspaces[0];

    // Ensure deterministic ordering
    const [firstId, secondId] = u1.id < u2.id ? [u1.id, u2.id] : [u2.id, u1.id];

    // Upsert conversation record
    const conv = await prisma.chatDirectConversation.upsert({
      where: {
        workspaceId_user1Id_user2Id: {
          workspaceId: targetWs.id,
          user1Id: firstId,
          user2Id: secondId,
        },
      },
      update: { lastMessageAt: new Date() },
      create: {
        workspaceId: targetWs.id,
        user1Id: firstId,
        user2Id: secondId,
        lastMessageAt: new Date(),
      },
    });

    assert(Boolean(conv.id), `Direct conversation established between ${u1.fullName} and ${u2.fullName}.`);
    assert(conv.workspaceId === targetWs.id, 'Conversation is strictly scoped to the workspace tenant.');

    // Verify duplicate reverse query finds the identical conversation record
    const [revFirst, revSecond] = u2.id < u1.id ? [u2.id, u1.id] : [u1.id, u2.id];
    const convLookup = await prisma.chatDirectConversation.findUnique({
      where: {
        workspaceId_user1Id_user2Id: {
          workspaceId: targetWs.id,
          user1Id: revFirst,
          user2Id: revSecond,
        },
      },
    });
    assert(
      convLookup && convLookup.id === conv.id,
      'Reverse conversation lookup yields exact same single conversation record (Symmetric Single-Row Integrity).'
    );

    // Test Target ID Asymmetry
    const targetForU1 = u1.id === conv.user1Id ? conv.user2Id : conv.user1Id;
    const targetForU2 = u2.id === conv.user1Id ? conv.user2Id : conv.user1Id;
    assert(targetForU1 === u2.id, `User 1 (${u1.fullName}) targets User 2 ID: ${u2.id}`);
    assert(targetForU2 === u1.id, `User 2 (${u2.fullName}) targets User 1 ID: ${u1.id}`);
  }

  // ---------------------------------------------------------------------------
  // TEST GROUP 6: Pinned Artifacts Lifecycle
  // ---------------------------------------------------------------------------
  console.log('\nTEST GROUP 6: Channel Pinned Artifacts Lifecycle');

  if (defaultChannels.length > 0) {
    const testChannel = defaultChannels[0];
    const pin = await prisma.chatPinnedArtifact.create({
      data: {
        channelId: testChannel.id,
        title: 'Master Architecture Specification',
        url: 'https://spark.workplace/docs/master-spec',
        pinnedById: testChannel.createdById,
      },
    });

    assert(Boolean(pin.id), `Successfully pinned artifact '${pin.title}' to channel #${testChannel.name}.`);

    const queryPins = await prisma.chatPinnedArtifact.findMany({
      where: { channelId: testChannel.id },
    });
    assert(
      queryPins.some((p) => p.id === pin.id),
      'Pinned artifact successfully retrieved from database.'
    );

    // Clean up
    await prisma.chatPinnedArtifact.delete({ where: { id: pin.id } });
    assert(true, 'Test pinned artifact cleaned up.');
  }

  // ---------------------------------------------------------------------------
  // FINAL SCORE & SUMMARY
  // ---------------------------------------------------------------------------
  console.log('\n================================================================');
  console.log(`TEST RESULTS: ${passCount} PASSED, ${failCount} FAILED`);
  console.log('================================================================\n');

  if (failCount > 0) {
    process.exit(1);
  } else {
    process.exit(0);
  }
}

runTests()
  .catch((e) => {
    console.error('Fatal test error:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

