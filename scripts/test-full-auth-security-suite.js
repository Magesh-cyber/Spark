const fs = require('fs');
const path = require('path');
const { createClient } = require('@supabase/supabase-js');
const { PrismaClient } = require('@prisma/client');
const { z } = require('zod');

const loginSchema = z.object({
  email: z.string().trim().email("Please enter a valid work email address."),
  password: z.string().min(1, "Password is required."),
  rememberMe: z.boolean().optional(),
});

const signupSchema = z
  .object({
    fullName: z
      .string()
      .trim()
      .min(2, "Full name must be at least 2 characters.")
      .max(100, "Full name cannot exceed 100 characters."),
    email: z.string().trim().email("Please enter a valid work email address."),
    password: z
      .string()
      .min(8, "Password must be at least 8 characters.")
      .regex(/[a-zA-Z]/, "Password must contain at least one letter.")
      .regex(/[0-9]/, "Password must contain at least one number."),
    confirmPassword: z.string().min(1, "Please confirm your password."),
    agreeTerms: z.literal(true, {
      errorMap: () => ({ message: "You must accept the Terms of Service to proceed." }),
    }),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: "Passwords do not match.",
    path: ["confirmPassword"],
  });

const profileUpdateSchema = z.object({
  fullName: z
    .string()
    .trim()
    .min(2, "Full name must be at least 2 characters.")
    .max(100, "Full name cannot exceed 100 characters."),
  avatarUrl: z.string().url("Invalid avatar URL.").optional().or(z.literal("")),
});

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

async function main() {
  console.log("==================================================");
  console.log("SPARK MODULE 01 — FULL SECURITY & FLOW AUDIT SUITE");
  console.log("==================================================");

  const supabase = createClient(supabaseUrl, supabaseAnonKey);

  // ----------------------------------------------------
  // SECTION 1: VALIDATION SCHEMAS & INPUT SANITIZATION
  // ----------------------------------------------------
  console.log("\n[TEST GROUP 1] Input Validation & Sanitization");
  
  // 1. Signup Schema validation
  const badSignup1 = signupSchema.safeParse({
    fullName: "A", // too short
    email: "not-an-email",
    password: "short",
    confirmPassword: "short",
    agreeTerms: true,
  });
  assert(!badSignup1.success && badSignup1.error.issues.length >= 3, "Signup rejects short names, invalid emails, and short passwords");

  const mismatchSignup = signupSchema.safeParse({
    fullName: "Valid Name",
    email: "valid@sparkplatform.com",
    password: "Password123!",
    confirmPassword: "Password456!",
    agreeTerms: true,
  });
  assert(!mismatchSignup.success && mismatchSignup.error.issues[0].message.includes("match"), "Signup rejects mismatched passwords");

  const noTermsSignup = signupSchema.safeParse({
    fullName: "Valid Name",
    email: "valid@sparkplatform.com",
    password: "Password123!",
    confirmPassword: "Password123!",
    agreeTerms: false,
  });
  assert(!noTermsSignup.success && noTermsSignup.error.issues[0].message.includes("Terms"), "Signup enforces Terms of Service acceptance");

  // 2. Profile Update Schema & Avatar URL Validation
  const validProfile = profileUpdateSchema.safeParse({
    fullName: "Jane Doe",
    avatarUrl: "https://images.unsplash.com/photo-1494790108377-be9c29b29330",
  });
  assert(validProfile.success, "Profile update accepts valid full name and HTTPS avatar URL");

  const emptyAvatar = profileUpdateSchema.safeParse({
    fullName: "Jane Doe",
    avatarUrl: "",
  });
  assert(emptyAvatar.success, "Profile update accepts empty avatar URL (clearing avatar)");

  const maliciousAvatar = profileUpdateSchema.safeParse({
    fullName: "Jane Doe",
    avatarUrl: "<script>alert('xss')</script>",
  });
  assert(!maliciousAvatar.success, "Profile update rejects non-URL / script strings for avatar");

  const arbitraryFieldPayload = {
    fullName: "Jane Doe",
    avatarUrl: "https://example.com/avatar.jpg",
    userId: "some-arbitrary-id",
    role: "admin",
    isSuperAdmin: true,
  };
  const parsedProfile = profileUpdateSchema.safeParse(arbitraryFieldPayload);
  assert(parsedProfile.success && parsedProfile.data.userId === undefined, "Zod strips arbitrary injected fields (userId, role, isSuperAdmin)");

  // ----------------------------------------------------
  // SECTION 2: OPEN REDIRECT DEFENSE AUDIT
  // ----------------------------------------------------
  console.log("\n[TEST GROUP 2] Open Redirect Defense");

  function getSafeRedirectUrl(target, fallback = "/") {
    if (!target || typeof target !== "string") {
      return fallback;
    }
    const trimmed = target.trim();
    if (
      trimmed.startsWith("/") &&
      !trimmed.startsWith("//") &&
      !trimmed.startsWith("/\\") &&
      !trimmed.includes("\\") &&
      !trimmed.includes(":")
    ) {
      return trimmed;
    }
    return fallback;
  }

  assert(getSafeRedirectUrl("/tasks") === "/tasks", "Safe internal path '/tasks' is preserved");
  assert(getSafeRedirectUrl("/settings/profile") === "/settings/profile", "Safe nested path '/settings/profile' is preserved");
  assert(getSafeRedirectUrl("https://attacker.com") === "/", "Absolute URL 'https://attacker.com' falls back to '/'");
  assert(getSafeRedirectUrl("//attacker.com") === "/", "Protocol-relative URL '//attacker.com' falls back to '/'");
  assert(getSafeRedirectUrl("javascript:alert(1)") === "/", "Javascript URI 'javascript:alert(1)' falls back to '/'");
  assert(getSafeRedirectUrl("/\\attacker.com") === "/", "Backslash bypass '/\\attacker.com' falls back to '/'");
  assert(getSafeRedirectUrl("/tasks\\attacker") === "/", "Embedded backslash '/tasks\\attacker' falls back to '/'");
  assert(getSafeRedirectUrl(null) === "/", "Null input falls back to '/'");

  // ----------------------------------------------------
  // SECTION 3: AUTHENTICATION FLOW TESTS
  // ----------------------------------------------------
  console.log("\n[TEST GROUP 3] Authentication Flows with Supabase");

  // Get test user from database
  const userA = await prisma.user.findFirst({
    where: { email: { startsWith: 'audit.user.alpha.' } }
  });
  assert(!!userA, "Test User Alpha exists in public.users");

  // Test invalid login
  const { data: badLogin, error: badLoginErr } = await supabase.auth.signInWithPassword({
    email: userA.email,
    password: "WrongPassword999!",
  });
  assert(badLoginErr && badLoginErr.message.toLowerCase().includes("invalid"), "Login correctly rejects wrong password");

  // Test valid login
  const { data: goodLogin, error: goodLoginErr } = await supabase.auth.signInWithPassword({
    email: userA.email,
    password: `TestPassword!99#1794750398868`,
  });
  assert(!goodLoginErr && !!goodLogin.session, "Login succeeds with valid credentials and issues JWT session");

  const accessToken = goodLogin?.session?.access_token;

  // Test token validation
  const { data: tokenUser, error: tokenErr } = await supabase.auth.getUser(accessToken);
  assert(!tokenErr && tokenUser.user?.id === userA.id, "Supabase server validates JWT and returns user ID");

  // Test expired/invalid token
  const fakeToken = "eyJhbGciOiJFUzI1NiIsInR5cCI6IkpXVCJ9.e30.fakeSignature";
  const { data: fakeUser, error: fakeTokenErr } = await supabase.auth.getUser(fakeToken);
  assert(fakeTokenErr !== null || fakeUser.user === null, "Supabase server rejects forged/invalid JWT tokens");

  // Test logout
  const { error: logoutErr } = await supabase.auth.signOut();
  assert(!logoutErr, "Logout successfully terminates session");

  // ----------------------------------------------------
  // SECTION 4: ROUTE PROTECTION (MIDDLEWARE SIMULATION)
  // ----------------------------------------------------
  console.log("\n[TEST GROUP 4] Middleware Route Protection Logic");

  function simulateMiddleware(pathname, user) {
    const isAuthPage =
      pathname.startsWith("/auth/login") ||
      pathname.startsWith("/auth/signup") ||
      pathname.startsWith("/auth/forgot-password") ||
      pathname.startsWith("/auth/reset-password") ||
      pathname.startsWith("/auth/verify");

    const isAuthCallback = pathname.startsWith("/auth/callback");

    const isProtectedRoute =
      pathname === "/" ||
      pathname.startsWith("/tasks") ||
      pathname.startsWith("/projects") ||
      pathname.startsWith("/chat") ||
      pathname.startsWith("/meet") ||
      pathname.startsWith("/ai") ||
      pathname.startsWith("/docs") ||
      pathname.startsWith("/settings") ||
      pathname.startsWith("/teams") ||
      pathname.startsWith("/calendar") ||
      pathname.startsWith("/insights");

    if (isProtectedRoute && !user) {
      const returnTo = pathname !== "/" ? `?returnTo=${pathname}` : "";
      return { action: "redirect", target: `/auth/login${returnTo}` };
    }

    if (isAuthPage && !isAuthCallback && user) {
      if (pathname.startsWith("/auth/login") || pathname.startsWith("/auth/signup")) {
        return { action: "redirect", target: "/" };
      }
    }

    return { action: "next" };
  }

  assert(simulateMiddleware("/", null).target === "/auth/login", "Unauthenticated request to '/' redirects to '/auth/login'");
  assert(simulateMiddleware("/tasks", null).target === "/auth/login?returnTo=/tasks", "Unauthenticated request to '/tasks' redirects to '/auth/login?returnTo=/tasks'");
  assert(simulateMiddleware("/settings", null).target === "/auth/login?returnTo=/settings", "Unauthenticated request to '/settings' redirects with returnTo");
  assert(simulateMiddleware("/tasks", { id: "user_123" }).action === "next", "Authenticated request to '/tasks' is allowed");
  assert(simulateMiddleware("/auth/login", { id: "user_123" }).target === "/", "Authenticated request to '/auth/login' redirects to '/'");
  assert(simulateMiddleware("/auth/signup", { id: "user_123" }).target === "/", "Authenticated request to '/auth/signup' redirects to '/'");
  assert(simulateMiddleware("/auth/reset-password", { id: "user_123" }).action === "next", "Authenticated request to '/auth/reset-password' is permitted (needed for recovery)");
  assert(simulateMiddleware("/auth/verify", null).action === "next", "Unauthenticated request to '/auth/verify' is permitted");

  // ----------------------------------------------------
  // SECTION 5: SERVER ACTIONS & IDOR DEFENSE
  // ----------------------------------------------------
  console.log("\n[TEST GROUP 5] Server Actions & Authorization Boundaries");

  // Inspect profile action code for IDOR vulnerability:
  const profileActionsSrc = fs.readFileSync(path.resolve('src/lib/actions/profile.ts'), 'utf8');
  
  const hasGetUserCall = profileActionsSrc.includes("supabase.auth.getUser()");
  assert(hasGetUserCall, "Server actions verify identity via supabase.auth.getUser()");

  const doesNotAcceptArbitraryUserId = !profileActionsSrc.includes("userId: string") && !profileActionsSrc.includes("input.userId");
  assert(doesNotAcceptArbitraryUserId, "updateUserProfile does not accept arbitrary user ID from client");

  const usesServerSideOwnership = profileActionsSrc.includes("where: { id: user.id }");
  assert(usesServerSideOwnership, "Database query strictly binds ownership to authenticated user.id");

  // ----------------------------------------------------
  // SUMMARY
  // ----------------------------------------------------
  console.log("\n==================================================");
  console.log(`AUDIT TEST RESULTS: ${passCount} PASSED, ${failCount} FAILED`);
  console.log("==================================================");

  await prisma.$disconnect();

  if (failCount > 0) {
    process.exit(1);
  }
}

main().catch(e => {
  console.error(e);
  process.exit(1);
});
