const fs = require('fs');
for (const l of fs.readFileSync('.env.local', 'utf8').split('\n')) {
  const m = l.trim().match(/^([A-Za-z0-9_]+)\s*=\s*(.*)$/);
  if (m) process.env[m[1]] = m[2].trim().replace(/^["']|["']$/g, '');
}
console.log('Has SUPABASE_SERVICE_ROLE_KEY:', Boolean(process.env.SUPABASE_SERVICE_ROLE_KEY));
console.log('Has NEXT_PUBLIC_SUPABASE_URL:', Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL));
const { createClient } = require('@supabase/supabase-js');
const sb = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);
sb.storage.listBuckets().then(({ data, error }) => {
  console.log('Buckets:', data ? data.map((b) => ({ name: b.name, public: b.public })) : null, 'Error:', error ? error.message : null);
});
