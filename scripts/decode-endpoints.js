const fs = require('fs');
const c = fs.readFileSync('node_modules/@nexconn/engine/index.cjs.js', 'utf8');
const idx = c.indexOf('var xr=');
const sub = c.substring(idx, idx + 3500);

const regex = /"([A-Za-z0-9+/=]{12,})"/g;
let match;
const results = new Map();
while ((match = regex.exec(sub)) !== null) {
  const b64 = match[1];
  try {
    const text = Buffer.from(b64, 'base64').toString('utf8');
    if (/^[a-zA-Z0-9.:/_-]+$/.test(text)) {
      results.set(b64, text);
    }
  } catch {}
}

for (const [k, v] of results.entries()) {
  console.log(`${k}  =>  ${v}`);
}

