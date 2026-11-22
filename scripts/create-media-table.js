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
  console.log('Target URL starts with:', (process.env.DATABASE_URL || '').slice(0, 30));

  console.log('Creating table chat_encrypted_media...');
  await prisma.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS "chat_encrypted_media" (
      "id" TEXT PRIMARY KEY,
      "workspace_id" UUID NOT NULL,
      "uploader_id" UUID NOT NULL,
      "conversation_type" TEXT,
      "conversation_target_id" TEXT,
      "original_name" TEXT NOT NULL,
      "mime_type" TEXT NOT NULL,
      "size" INTEGER NOT NULL,
      "kind" TEXT NOT NULL,
      "iv_hex" TEXT NOT NULL,
      "auth_tag_hex" TEXT NOT NULL,
      "sha256" TEXT NOT NULL,
      "encrypted_data" TEXT NOT NULL,
      "created_at" TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL
    )
  `);
  console.log('Table "chat_encrypted_media" created successfully!');

  console.log('Creating index idx_chat_encrypted_media_ws...');
  await prisma.$executeRawUnsafe(`
    CREATE INDEX IF NOT EXISTS "idx_chat_encrypted_media_ws" ON "chat_encrypted_media" ("workspace_id")
  `);
  console.log('Index "idx_chat_encrypted_media_ws" created successfully!');

  // Verify by querying
  const count = await prisma.$queryRawUnsafe(`SELECT count(*) FROM "chat_encrypted_media"`);
  console.log('Verification query count:', count);
}

main()
  .catch((e) => {
    console.error('Migration error:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
