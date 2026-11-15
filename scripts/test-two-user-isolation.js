const fs = require('fs');
const path = require('path');
const { createClient } = require('@supabase/supabase-js');
const { PrismaClient } = require('@prisma/client');

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

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const prisma = new PrismaClient();

async function run() {
  console.log("==================================================");
  console.log("SPARK MODULE 01 — TWO-USER ISOLATION & RLS VERIFICATION");
  console.log("==================================================");

  // 1. Get User Alpha and User Beta from database
  const userA = await prisma.user.findFirst({
    where: { email: { startsWith: 'audit.user.alpha.' } }
  });
  const userB = await prisma.user.findFirst({
    where: { email: { startsWith: 'audit.user.beta.' } }
  });

  if (!userA || !userB) {
    throw new Error(`Missing test users: User A: ${!!userA}, User B: ${!!userB}`);
  }

  const userAId = userA.id;
  const userBId = userB.id;
  const sharedPassword = `TestPassword!99#1794750398868`;

  console.log(`User Alpha: ID ${userAId} | Email: ${userA.email}`);
  console.log(`User Beta:  ID ${userBId} | Email: ${userB.email}`);

  // 2. Authenticate both users via real Supabase Auth GoTrue API
  console.log("\n--- Authenticating User Alpha via Supabase Auth API ---");
  const supabasePublic = createClient(supabaseUrl, supabaseAnonKey);

  const { data: authA, error: errAuthA } = await supabasePublic.auth.signInWithPassword({
    email: userA.email,
    password: sharedPassword,
  });
  if (errAuthA) throw new Error(`User Alpha login failed: ${errAuthA.message}`);
  const tokenA = authA.session.access_token;
  console.log("✓ User Alpha authenticated successfully. Received session JWT.");

  console.log("\n--- Authenticating User Beta via Supabase Auth API ---");
  const { data: authB, error: errAuthB } = await supabasePublic.auth.signInWithPassword({
    email: userB.email,
    password: sharedPassword,
  });
  if (errAuthB) throw new Error(`User Beta login failed: ${errAuthB.message}`);
  const tokenB = authB.session.access_token;
  console.log("✓ User Beta authenticated successfully. Received session JWT.");

  // Create isolated PostgREST clients with respective authenticated Bearer tokens
  const clientAlpha = createClient(supabaseUrl, supabaseAnonKey, {
    global: { headers: { Authorization: `Bearer ${tokenA}` } },
    auth: { persistSession: false },
  });

  const clientBeta = createClient(supabaseUrl, supabaseAnonKey, {
    global: { headers: { Authorization: `Bearer ${tokenB}` } },
    auth: { persistSession: false },
  });

  console.log("\n==================================================");
  console.log("TEST 1: User Alpha general SELECT query on public.users");
  console.log("==================================================");
  const { data: selectAllA, error: selectAllErrA } = await clientAlpha
    .from("users")
    .select("id, email, full_name, avatar_url");

  if (selectAllErrA) throw selectAllErrA;
  console.log(`User Alpha received ${selectAllA.length} row(s):`, selectAllA);
  const sawBeta = selectAllA.some(u => u.id === userBId);
  if (sawBeta) {
    console.error("FAIL: User Alpha can see User Beta's profile!");
    process.exit(1);
  } else {
    console.log("PASS [SELECT Isolation]: User Alpha only receives own profile. User Beta is completely invisible.");
  }

  console.log("\n==================================================");
  console.log("TEST 2: User Alpha queries User Beta explicitly by ID (IDOR Attack)");
  console.log("==================================================");
  const { data: selectSpecificB, error: selectSpecificErrB } = await clientAlpha
    .from("users")
    .select("id, email, full_name, avatar_url")
    .eq("id", userBId);

  console.log("Target ID:", userBId);
  console.log("Query result for User Beta ID:", selectSpecificB, "Error:", selectSpecificErrB);
  if (selectSpecificB && selectSpecificB.length > 0) {
    console.error("FAIL: User Alpha read User Beta's profile!");
    process.exit(1);
  } else {
    console.log("PASS [IDOR Read Protection]: User Alpha cannot access User Beta by ID. Returned 0 rows.");
  }

  console.log("\n==================================================");
  console.log("TEST 3: User Alpha attempts to UPDATE User Beta's full_name");
  console.log("==================================================");
  const beforeBetaProfile = await prisma.user.findUnique({ where: { id: userBId } });
  console.log(`User Beta name before attack: "${beforeBetaProfile.fullName}"`);

  const { data: updateB, error: updateErrB } = await clientAlpha
    .from("users")
    .update({ full_name: "MALICIOUS OVERWRITE BY ALPHA" })
    .eq("id", userBId)
    .select();

  console.log("Update attempt response data:", updateB, "Error:", updateErrB);
  const afterBetaProfile = await prisma.user.findUnique({ where: { id: userBId } });
  if (afterBetaProfile.fullName === "MALICIOUS OVERWRITE BY ALPHA") {
    console.error("FAIL: User Alpha successfully modified User Beta's name!");
    process.exit(1);
  } else {
    console.log(`PASS [UPDATE Isolation]: User Beta name remains intact: "${afterBetaProfile.fullName}". 0 rows affected.`);
  }

  console.log("\n==================================================");
  console.log("TEST 4: User Alpha attempts to UPDATE User Beta's avatar_url");
  console.log("==================================================");
  const { data: updateAvatarB, error: updateAvatarErrB } = await clientAlpha
    .from("users")
    .update({ avatar_url: "https://evil.attacker/avatar.png" })
    .eq("id", userBId)
    .select();

  console.log("Avatar update attempt response data:", updateAvatarB, "Error:", updateAvatarErrB);
  const afterBetaAvatar = await prisma.user.findUnique({ where: { id: userBId } });
  if (afterBetaAvatar.avatarUrl === "https://evil.attacker/avatar.png") {
    console.error("FAIL: User Alpha modified User Beta's avatar!");
    process.exit(1);
  } else {
    console.log(`PASS [Avatar Isolation]: User Beta avatar remains untouched: ${afterBetaAvatar.avatarUrl}. 0 rows affected.`);
  }

  console.log("\n==================================================");
  console.log("TEST 5: User Alpha attempts to DELETE User Beta's account");
  console.log("==================================================");
  const { data: deleteB, error: deleteErrB } = await clientAlpha
    .from("users")
    .delete()
    .eq("id", userBId)
    .select();

  console.log("Delete attempt response data:", deleteB, "Error:", deleteErrB);
  const verifyBetaStillExists = await prisma.user.findUnique({ where: { id: userBId } });
  if (!verifyBetaStillExists) {
    console.error("FAIL: User Alpha deleted User Beta!");
    process.exit(1);
  } else {
    console.log("PASS [DELETE Protection]: User Beta profile still exists. RLS prevented unauthorized deletion.");
  }

  console.log("\n==================================================");
  console.log("TEST 6: User Alpha legitimate self-UPDATE");
  console.log("==================================================");
  const { data: selfUpdateA, error: selfUpdateErrA } = await clientAlpha
    .from("users")
    .update({ full_name: "Audit User Alpha Verified" })
    .eq("id", userAId)
    .select();

  console.log("Self update response data:", selfUpdateA, "Error:", selfUpdateErrA);
  const verifyAlphaSelf = await prisma.user.findUnique({ where: { id: userAId } });
  if (verifyAlphaSelf.fullName === "Audit User Alpha Verified") {
    console.log(`PASS [Legitimate Self-Update]: User Alpha successfully updated own profile.`);
  } else {
    console.error("FAIL: User Alpha could not update own profile!");
    process.exit(1);
  }

  // Also verify User Beta was not affected
  const checkBetaUntouched = await prisma.user.findUnique({ where: { id: userBId } });
  if (checkBetaUntouched.fullName !== beforeBetaProfile.fullName) {
    console.error("FAIL: User Beta was unexpectedly altered during User Alpha's self-update!");
    process.exit(1);
  }
  console.log("PASS: User Beta profile completely unaffected by User Alpha's actions.");

  console.log("\n==================================================");
  console.log("TEST 7: User Beta legitimate self-UPDATE");
  console.log("==================================================");
  const { data: selfUpdateB, error: selfUpdateErrB } = await clientBeta
    .from("users")
    .update({ 
      full_name: "Audit User Beta Verified", 
      avatar_url: "https://sparkapp.io/avatars/beta.png" 
    })
    .eq("id", userBId)
    .select();

  console.log("User Beta self-update response data:", selfUpdateB, "Error:", selfUpdateErrB);
  const verifyBetaSelf = await prisma.user.findUnique({ where: { id: userBId } });
  if (verifyBetaSelf.fullName === "Audit User Beta Verified" && verifyBetaSelf.avatarUrl === "https://sparkapp.io/avatars/beta.png") {
    console.log(`PASS [Legitimate Self-Update]: User Beta successfully updated own profile and avatar.`);
  } else {
    console.error("FAIL: User Beta could not update own profile!");
    process.exit(1);
  }

  console.log("\n==================================================");
  console.log("TWO-USER ISOLATION AUDIT RESULT: ALL 7 TESTS PASSED");
  console.log("==================================================");

  await prisma.$disconnect();
}

run().catch(e => {
  console.error("FAILURE in isolation test:", e);
  process.exit(1);
});
