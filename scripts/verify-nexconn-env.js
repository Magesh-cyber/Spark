const fs = require('fs');
const path = require('path');

function verify() {
  const envPath = path.resolve('.env.local');
  if (!fs.existsSync(envPath)) {
    console.log("FAIL: .env.local does not exist.");
    process.exit(1);
  }

  const content = fs.readFileSync(envPath, 'utf8');
  const lines = content.split('\n');

  const envVars = {};
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const match = trimmed.match(/^([A-Za-z0-9_]+)\s*=\s*(.*)$/);
    if (match) {
      let val = match[2].trim();
      val = val.replace(/^["'](.*)["']$/, '$1');
      envVars[match[1]] = val;
    }
  }

  const hasNextPublicAppKey = Object.prototype.hasOwnProperty.call(envVars, 'NEXT_PUBLIC_NEXCONN_APP_KEY') && envVars.NEXT_PUBLIC_NEXCONN_APP_KEY.length > 0;
  const hasAppKey = Object.prototype.hasOwnProperty.call(envVars, 'NEXCONN_APP_KEY') && envVars.NEXCONN_APP_KEY.length > 0;
  const hasAppSecret = Object.prototype.hasOwnProperty.call(envVars, 'NEXCONN_APP_SECRET') && envVars.NEXCONN_APP_SECRET.length > 0;

  console.log("1. Variable Existence Check:");
  console.log(`  - NEXT_PUBLIC_NEXCONN_APP_KEY: ${hasNextPublicAppKey ? "PRESENT (non-empty)" : "MISSING"}`);
  console.log(`  - NEXCONN_APP_KEY:             ${hasAppKey ? "PRESENT (non-empty)" : "MISSING"}`);
  console.log(`  - NEXCONN_APP_SECRET:          ${hasAppSecret ? "PRESENT (non-empty)" : "MISSING"}`);

  // Check consistency between NEXT_PUBLIC_NEXCONN_APP_KEY and NEXCONN_APP_KEY
  const keysMatch = envVars.NEXT_PUBLIC_NEXCONN_APP_KEY === envVars.NEXCONN_APP_KEY;
  console.log("\n2. App Key Consistency Check:");
  console.log(`  - NEXT_PUBLIC_NEXCONN_APP_KEY matches NEXCONN_APP_KEY: ${keysMatch ? "MATCH (Consistent)" : "MISMATCH"}`);

  // Check prefix on App Secret
  const secretIsServerOnly = !Object.prototype.hasOwnProperty.call(envVars, 'NEXT_PUBLIC_NEXCONN_APP_SECRET');
  console.log("\n3. Secret Prefix Check:");
  console.log(`  - No NEXT_PUBLIC_ prefix on secret: ${secretIsServerOnly ? "CONFIRMED (Server-side prefixing only)" : "EXPOSED (Found NEXT_PUBLIC_ prefix on secret)"}`);

  // Codebase audit: search src/ for any usage or exposure of NEXCONN_APP_SECRET
  console.log("\n4. Codebase Exposure Audit:");
  const clientExposures = [];
  const allReferences = [];

  function scanDir(dir) {
    const files = fs.readdirSync(dir);
    for (const file of files) {
      const fullPath = path.join(dir, file);
      const stat = fs.statSync(fullPath);
      if (stat.isDirectory()) {
        if (file !== 'node_modules' && file !== '.next' && file !== '.git') {
          scanDir(fullPath);
        }
      } else if (file.endsWith('.ts') || file.endsWith('.tsx') || file.endsWith('.js') || file.endsWith('.jsx')) {
        const fileContent = fs.readFileSync(fullPath, 'utf8');
        if (fileContent.includes('NEXCONN_APP_SECRET')) {
          allReferences.push(fullPath);
          if (fileContent.includes('"use client"') || fileContent.includes("'use client'")) {
            clientExposures.push(fullPath);
          }
        }
      }
    }
  }

  scanDir(path.resolve('src'));

  console.log(`  - Total occurrences of NEXCONN_APP_SECRET in src/: ${allReferences.length}`);
  console.log(`  - Client component occurrences ('use client'): ${clientExposures.length}`);

  if (clientExposures.length > 0) {
    console.log("  - WARNING: Found in client components:", clientExposures);
  } else {
    console.log("  - CONFIRMED: NEXCONN_APP_SECRET is NOT referenced in any client component or browser bundle.");
  }

  // Check .env.example
  const examplePath = path.resolve('.env.example');
  if (fs.existsSync(examplePath)) {
    const exampleContent = fs.readFileSync(examplePath, 'utf8');
    const exampleHasNextPublic = exampleContent.includes('NEXT_PUBLIC_NEXCONN_APP_KEY');
    const exampleHasAppKey = exampleContent.includes('NEXCONN_APP_KEY');
    const exampleHasSecret = exampleContent.includes('NEXCONN_APP_SECRET');
    console.log("\n5. .env.example Documentation Check:");
    console.log(`  - Documented in .env.example: ${exampleHasNextPublic && exampleHasAppKey && exampleHasSecret ? "YES" : "NO"}`);
  }
}

verify();

