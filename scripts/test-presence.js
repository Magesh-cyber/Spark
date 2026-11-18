const fs = require('fs');
for (const l of fs.readFileSync('.env.local', 'utf8').split('\n')) {
  const m = l.trim().match(/^([A-Za-z0-9_]+)\s*=\s*(.*)$/);
  if (m) process.env[m[1]] = m[2].trim().replace(/^["']|["']$/g, '');
}
const { createClient } = require('@supabase/supabase-js');
const sb = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);
const ch = sb.channel('spark_presence_test', { config: { presence: { key: 'probe-1' } } });
ch.on('presence', { event: 'sync' }, () => {
  const keys = Object.keys(ch.presenceState());
  if (keys.length > 0) {
    console.log('PRESENCE SYNC OK! Online keys:', keys);
    ch.unsubscribe().then(() => process.exit(0));
  }
});
ch.subscribe(async (status) => {
  console.log('Channel status:', status);
  if (status === 'SUBSCRIBED') {
    await ch.track({ userId: 'probe-1', onlineAt: Date.now() });
  }
});
setTimeout(() => { console.log('Timeout'); process.exit(1); }, 8000);
