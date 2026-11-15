# SPARK — Workplace Collaboration & Productivity SaaS

> **One workspace. Every conversation. Every project. Every possibility.**  
> SPARK brings communication, video meetings, project management, tasks, documentation, and AI-powered intelligence into one connected workplace environment.

---

## 1. Tech Stack

- **Framework:** [Next.js 14.2](https://nextjs.org/) (App Router)
- **UI & Styling:** React 18, [Tailwind CSS](https://tailwindcss.com/), [Lucide React](https://lucide.dev/)
- **Authentication:** [Supabase Auth](https://supabase.com/auth) (Sole Identity Authority)
- **Database:** Supabase PostgreSQL with [Prisma 5.22](https://www.prisma.io/) ORM
- **Validation:** [Zod](https://zod.dev/)
- **Type Safety:** TypeScript 5.7 (Strict Mode)

---

## 2. Getting Started Locally

### Prerequisites
- Node.js `20.x` or `22.x`
- npm `10.x`
- Supabase Project (PostgreSQL database & Auth)

### Setup Instructions

1. **Clone the repository and install dependencies:**
   ```bash
   npm install
   ```

2. **Configure Environment Variables:**
   Copy `.env.example` to `.env.local`:
   ```bash
   cp .env.example .env.local
   ```
   Populate your `.env.local` with your Supabase credentials:
   ```env
   NEXT_PUBLIC_APP_URL="http://localhost:3000"
   NEXT_PUBLIC_SUPABASE_URL="https://[YOUR-PROJECT-REF].supabase.co"
   NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY="[YOUR-ANON-KEY]"
   DATABASE_URL="postgresql://postgres.[REF]:[PASSWORD]@aws-0-[REGION].pooler.supabase.com:6543/postgres?pgbouncer=true"
   DIRECT_URL="postgresql://postgres.[REF]:[PASSWORD]@aws-0-[REGION].pooler.supabase.com:5432/postgres"
   ```

3. **Generate Prisma Client & Synchronize Database:**
   ```bash
   npx prisma generate
   npx prisma db push
   ```

4. **Run the Development Server:**
   ```bash
   npm run dev
   ```
   Open [http://localhost:3000](http://localhost:3000) in your browser.

---

## 3. Architecture & Documentation

- **Design System Specification:** [docs/SPARK_DESIGN_SPECIFICATION.md](docs/SPARK_DESIGN_SPECIFICATION.md)
- **Initial Technical Audit:** [docs/SPARK_INITIAL_AUDIT.md](docs/SPARK_INITIAL_AUDIT.md)
- **Module 01: Authentication & User Management:** [docs/MODULE_01_AUTHENTICATION.md](docs/MODULE_01_AUTHENTICATION.md)

---

## 4. Quality & Build Verification

```bash
# Type check
npx tsc --noEmit

# Lint
npm run lint

# Production build
npm run build
```

