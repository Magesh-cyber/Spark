const fs = require('fs');
const path = require('path');
const { PrismaClient } = require('@prisma/client');

// Load .env.local
const envPath = path.resolve(__dirname, '..', '.env.local');
if (fs.existsSync(envPath)) {
  const content = fs.readFileSync(envPath, 'utf8');
  for (const line of content.split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const match = trimmed.match(/^([A-Za-z0-9_]+)\s*=\s*(.*)$/);
    if (match) {
      process.env[match[1]] = match[2].trim().replace(/^['"]|['"]$/g, '');
    }
  }
}

const prisma = new PrismaClient();

async function seed() {
  const wsId = '35c436f1-4879-40a2-97f2-256534d44533';
  const testId = '9a10bc03-d539-4933-a64e-b22f75e43197';
  const vishalId = '79d57e19-c6d4-4e1a-96f7-e7775f002b5c';
  const canonicalTarget = [testId, vishalId].sort().join(':');

  const baseTime = Date.now() - 3600 * 1000;

  const msgs = [
    {
      id: 'msg_seed_1',
      sender_id: testId,
      sender_name: 'test',
      text: 'Hi this is test',
      timestamp: baseTime,
    },
    {
      id: 'msg_seed_2',
      sender_id: vishalId,
      sender_name: 'Vishal',
      text: 'Yeah goog to go frd',
      timestamp: baseTime + 10000,
    },
    {
      id: 'msg_seed_3',
      sender_id: vishalId,
      sender_name: 'Vishal',
      text: 'Test received 👍',
      timestamp: baseTime + 20000,
    },
  ];

  for (const m of msgs) {
    await prisma.$executeRawUnsafe(
      `INSERT INTO "chat_messages" (
        "id", "workspace_id", "conversation_type", "conversation_target_id",
        "sender_id", "sender_name", "text", "message_type", "channel_type", "timestamp"
      ) VALUES (
        $1, $2::uuid, 'direct', $3,
        $4::uuid, $5, $6, 'RC:TxtMsg', 1, $7
      ) ON CONFLICT ("id") DO NOTHING`,
      m.id,
      wsId,
      canonicalTarget,
      m.sender_id,
      m.sender_name,
      m.text,
      BigInt(m.timestamp)
    );
  }

  console.log('Seeded previous messages successfully!');
}

seed()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
