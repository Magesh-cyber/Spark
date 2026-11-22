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

const prisma = new PrismaClient({
  datasources: {
    db: {
      url: process.env.DATABASE_URL,
    },
  },
});

async function main() {
  console.log('Connecting to database...');
  console.log('Creating table chat_messages...');
  await prisma.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS "chat_messages" (
      "id" TEXT PRIMARY KEY,
      "workspace_id" UUID NOT NULL REFERENCES "workspaces"("id") ON DELETE CASCADE,
      "conversation_type" TEXT NOT NULL,
      "conversation_target_id" TEXT NOT NULL,
      "sender_id" UUID NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
      "sender_name" TEXT NOT NULL,
      "sender_avatar" TEXT,
      "text" TEXT NOT NULL,
      "message_type" TEXT NOT NULL DEFAULT 'RC:TxtMsg',
      "channel_type" INTEGER NOT NULL DEFAULT 1,
      "file_info" JSONB,
      "reply_to" JSONB,
      "is_handover" BOOLEAN NOT NULL DEFAULT FALSE,
      "handover_data" JSONB,
      "timestamp" BIGINT NOT NULL,
      "created_at" TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL
    )
  `);
  console.log('Table "chat_messages" created successfully!');

  console.log('Creating index idx_chat_messages_lookup...');
  await prisma.$executeRawUnsafe(`
    CREATE INDEX IF NOT EXISTS "idx_chat_messages_lookup" 
    ON "chat_messages" ("workspace_id", "conversation_type", "conversation_target_id", "timestamp")
  `);
  console.log('Index "idx_chat_messages_lookup" created successfully!');

  // Verify
  const count = await prisma.$queryRawUnsafe(`SELECT count(*) FROM "chat_messages"`);
  console.log('Verification query count in chat_messages:', count);
}

main()
  .catch((e) => {
    console.error('Migration error:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
