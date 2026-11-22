const fs = require('fs');
const { createClient } = require('@supabase/supabase-js');

const envFile = fs.readFileSync('.env.local', 'utf8');
const env = {};
for (const line of envFile.split('\n')) {
  const trimmed = line.trim();
  if (!trimmed || trimmed.startsWith('#')) continue;
  const idx = trimmed.indexOf('=');
  if (idx > 0) {
    const k = trimmed.slice(0, idx).trim();
    let v = trimmed.slice(idx + 1).trim();
    if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) {
      v = v.slice(1, -1);
    }
    env[k] = v;
  }
}

const url = env.NEXT_PUBLIC_SUPABASE_URL;
const key = env.NEXT_PUBLIC_SUPABASE_ANON_KEY || env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;

console.log('Connecting to Supabase at:', url);
const client = createClient(url, key);

const channel = client.channel('spark_presence_test_ws', {
  config: {
    presence: { key: 'user_123' },
  },
});

channel
  .on('presence', { event: 'sync' }, () => {
    console.log('PRESENCE SYNC EVENT! State:', JSON.stringify(channel.presenceState()));
  })
  .on('presence', { event: 'join' }, ({ key, newPresences }) => {
    console.log('PRESENCE JOIN:', key, newPresences);
  })
  .subscribe(async (status) => {
    console.log('Subscription status:', status);
    if (status === 'SUBSCRIBED') {
      console.log('Tracking user_123...');
      const res = await channel.track({ userId: 'user_123', onlineAt: Date.now() });
      console.log('Track result:', res);
    }
  });

setTimeout(() => {
  console.log('Final presenceState:', JSON.stringify(channel.presenceState()));
  client.removeChannel(channel);
  process.exit(0);
}, 4000);
