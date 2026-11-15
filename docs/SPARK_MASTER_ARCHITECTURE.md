# SPARK — MASTER ARCHITECTURE SPECIFICATION
## Full-Stack SaaS Platform Architecture, Module Roadmap & Dependencies

**Product:** SPARK — AI-Powered Workplace Collaboration & Productivity SaaS  
**Tagline:** One workspace. Every conversation. Every project. Every possibility.  
**Architecture Version:** 2.0.0  
**Last Updated:** November 15, 2026  

---

## 1. Core Product Architecture & Invariants

SPARK is designed as a unified workplace collaboration platform built on a strict multi-tenant foundation. The architecture links **Communication ➔ Intelligence ➔ Execution** within a single tenant boundary.

### Core Architectural Decisions
- **Framework:** Next.js 14.2.x (React 18.3.1, TypeScript, App Router).
- **Authentication:** Supabase Auth (GoTrue) as the sole identity provider.
- **Database:** Supabase PostgreSQL with Row Level Security (RLS).
- **ORM & Data Layer:** Prisma 5.22.x with explicit server-side tenant scoping.
- **Input Validation:** Zod schemas for all actions, API endpoints, and form submissions.
- **Design System:** Tailored commercial SaaS design tokens following `docs/SPARK_DESIGN_SPECIFICATION.md`.

---

## 2. Multi-Tenant Boundary Model

The **Workspace** is the fundamental tenant boundary of SPARK:
```
[Global User Identity (public.users)]
           │
           ▼
[Workspace Member (public.workspace_members)] ── Role: OWNER | ADMIN | MANAGER | MEMBER | GUEST
           │
           ▼
[Workspace Tenant (public.workspaces)]
           │
   ┌───────┼───────────────────────────┬───────────────────────────┐
   ▼       ▼                           ▼                           ▼
[Channels] [Projects & Tasks] [Documents & Notes] [Meetings & Recordings]
(Mod 03)     (Mod 05)                 (Mod 06)                  (Mod 04)
```

Every future entity created within SPARK requires a `workspaceId` foreign key and must be guarded by `verifyWorkspaceAccess(workspaceId, minRole)`.

---

## 3. Master Module Roadmap & Implementation Status

| Module # | Module Title | Status | Primary Responsibilities |
| :---: | :--- | :---: | :--- |
| **01** | **Authentication & Global Identity** | **`COMPLETED`** | Supabase Auth, PKCE session exchange, user profiles, trigger sync, password recovery, open redirect defense. |
| **02** | **Workspace Management & Multi-Tenancy** | **`COMPLETED`** | Personal/Org workspace lifecycle, 5-tier RBAC, cryptographic invitations, switcher UI, tenant isolation. |
| **03** | **Real-Time Communication & Chat** | **`COMPLETED`** | Channels, DMs, thread replies, Nexconn real-time chat SDK integration, media attachments. |
| **04** | **Video Meetings & Presence** | `PLANNED` | Live meetings, screen sharing, meeting agendas, participant states. |
| **05** | **Projects & Task Management** | `PLANNED` | Linear-style issue tracking, Kanban boards, sprint cycles, priority matrices. |
| **06** | **Docs & Knowledge Base** | `PLANNED` | Notion-style rich text docs, markdown sync, workspace knowledge graphs. |
| **07** | **AI Assistant & Automation** | `PLANNED` | Thread summarization, task extraction, meeting transcripts, workflow automation. |

---

## 4. Module Dependencies & Inter-Module Contracts

### Module 01 ➔ Module 02 Contract
- Module 01 produces the canonical `public.users.id` (UUID).
- Module 02 uses `public.users.id` as foreign key `ownerId` in `workspaces` and `userId` in `workspace_members`.
- Database trigger `public.handle_new_user()` provisions `public.users` and immediately provisions the user's `PERSONAL` workspace.

### Module 02 ➔ Module 03 (Next Module: Chat & Channels) Contract
- Every channel and direct conversation created in Module 03 must possess `workspaceId`.
- Channel permissions map directly to `WorkspaceMember.role`.
- Suspended or removed members in Module 02 immediately lose read and write access to workspace channels.
- Server-side helper `verifyWorkspaceAccess(workspaceId)` must be invoked on all WebSocket/API connection handshakes.

---

## 5. Security & Authorization Architecture

### Dual-Layer Security Model
1. **Application-Level RBAC:**  
   Centralized in `src/lib/permissions.ts` and `src/lib/workspace-guard.ts`. Every Server Action derives caller identity from `supabase.auth.getUser()`, looks up active membership in PostgreSQL, and enforces numerical hierarchy permissions.
2. **Database-Level Row Level Security (RLS):**  
   Configured across all tables in `prisma/migrations/`. Enforces tenant isolation for direct PostgREST or Supabase Client queries.

### Cryptographic Safeguards
- **Invitation Tokens:** 32-byte cryptographic random entropy, hashed with SHA-256 before storage.
- **Open Redirect Protection:** Strict internal route sanitization (`getSafeRedirectUrl`) preventing backslash and protocol-relative evasions.
- **IDOR Protection:** Zero acceptance of arbitrary `userId` parameters from client requests.

---

## 6. Directory Structure & Key Files

```
SPARK/
├── prisma/
│   ├── schema.prisma                       # Canonical Prisma models & enums
│   └── migrations/
│       ├── 20261115_init_users/            # Module 01 SQL migration
│       └── 20261115_module_02_workspaces/  # Module 02 SQL migration
├── src/
│   ├── app/
│   │   ├── auth/                           # Authentication routes (login, signup, callback, reset)
│   │   ├── workspaces/                     # Workspace directory & creation
│   │   │   ├── [slug]/                     # Workspace overview
│   │   │   │   ├── settings/               # Workspace settings & danger zone
│   │   │   │   ├── members/                # Member directory & role management
│   │   │   │   └── invitations/            # Pending invitations & resend/revoke
│   │   │   └── create/                     # Organization creation form
│   │   └── invitations/
│   │       └── accept/                     # Public/auth invitation acceptance page
│   ├── components/
│   │   ├── layout/                         # AppHeader, AppSidebar, ShellLayout, WorkspaceSwitcher, UserMenu
│   │   └── ui/                             # Button, Input, Badge, Avatar, Checkbox, Card primitives
│   ├── lib/
│   │   ├── actions/                        # Server actions (workspaces, members, invitations, profile)
│   │   ├── permissions.ts                  # Centralized RBAC permission service
│   │   ├── workspace-guard.ts              # Server-side tenant isolation guard
│   │   ├── workspace-context.tsx           # React workspace state & switcher context
│   │   └── email.ts                        # Email dispatch abstraction
│   └── middleware.ts                       # Edge session refresh & route protection
└── docs/
    ├── SPARK_DESIGN_SPECIFICATION.md       # UI/UX design tokens & visual standards
    ├── MODULE_01_AUTHENTICATION.md         # Module 01 architecture & manual
    ├── MODULE_01_SECURITY_AUDIT.md         # Independent security audit report
    ├── MODULE_02_WORKSPACE_MANAGEMENT.md   # Module 02 architecture & specifications
    └── SPARK_MASTER_ARCHITECTURE.md        # Master system roadmap & specifications
```

