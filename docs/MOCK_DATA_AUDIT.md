# SPARK — Complete Mock Data & Simulated Logic Audit
## Phase 1: Full Application Audit Report

**Date:** 2026-11-15  
**Auditor:** Principal SaaS Architect & Application Security Specialist  
**Status:** COMPLETE AUDIT  
**Scope:** Entire repository inspection (`src/app`, `src/components`, `src/lib`, `prisma`)

---

## Executive Summary

An exhaustive audit of the SPARK codebase identified **14 distinct locations** where runtime mock data, fictional employees (Alex Morgan, Sarah Chen, David Miller, Elena Rostova), simulated video calls, fabricated metrics, or hardcoded notifications were present.

The application contains genuine, production-grade PostgreSQL database tables and Prisma server actions for **Authentication (Module 01)**, **Workspace Multi-Tenancy (Module 02)**, and **Chat Channels & DMs (Module 03)**. However, downstream screens (People & Teams, Dashboard, Tasks, Projects, Meet, Calendar, Docs, AI, Insights, Notifications, and Sidebar badges) were relying on hardcoded arrays and simulated state.

This document details every instance found, its classification, and the exact architectural replacement required.

---

## Detailed Findings Matrix

| # | File Path | Module | Type of Mock Data | Runtime vs Test | Required Replacement |
|---|-----------|--------|-------------------|-----------------|----------------------|
| 1 | `src/lib/mock-data.ts` | Core Shared Library | Static mock arrays `MOCK_TASKS`, `MOCK_PROJECTS`, `MOCK_MEETINGS` featuring fictional users (Alex Morgan, Sarah Chen, David Miller, Elena Rostova). | Runtime | Deprecate runtime mocks. Consumer modules must query real PostgreSQL records or render truthful empty states. |
| 2 | `src/app/teams/page.tsx` | People & Teams | Hardcoded `members` array containing 4 fictional employees with simulated roles, departments, online statuses, and inert action buttons. | Runtime | Connect directly to `getWorkspaceMembers(activeWorkspace.id)`. Query `WorkspaceMember` and `User` from PostgreSQL. Display actual roles (`OWNER`, `ADMIN`, etc.). Implement real member invitation modal via `inviteWorkspaceMember`. Display truthful empty state: *"No team members yet — Invite your colleagues to start collaborating in this workspace."* |
| 3 | `src/app/page.tsx` | Dashboard / Home | Hardcoded summary metrics (`3`, `24`, `MOCK_PROJECTS.length`, `MOCK_MEETINGS.length`, `94%`), static tasks table using `MOCK_TASKS`, fake upcoming meetings, fake active initiatives. | Runtime | Implement `getWorkspaceDashboardData(workspaceId)` server action. Aggregate real database counts (active members, chat channels, direct conversations). Render genuine empty states for unprovisioned tasks/projects/meetings. |
| 4 | `src/app/tasks/page.tsx` | Task Management | Local state initialized with `MOCK_TASKS`. Simulated priority/status boards and inert `alert()` dialogs on "Create Task". | Runtime | Remove `MOCK_TASKS`. Since task database tables are planned for Module 04, render an honest empty state: *"No tasks in this workspace — Task tracking will populate once tasks are created."* Remove fake alert handlers. |
| 5 | `src/app/projects/page.tsx` | Projects | In-memory filtering of `MOCK_PROJECTS` with fictional owners and fabricated completion percentages. Inert `alert()` handlers. | Runtime | Remove `MOCK_PROJECTS`. Display truthful empty state: *"No active projects — Project tracking will appear here once initiatives are initialized."* |
| 6 | `src/app/meet/page.tsx` | Video Meetings | Simulated live video call with 3 fictional participants (Alex Morgan, Sarah Chen, David Miller) claiming fake "Nexconn Call SDK Active". Mapped `MOCK_MEETINGS`. | Runtime | Remove simulated video call and fake participant tiles. Render truthful empty state: *"No scheduled meetings — Audio & video meeting rooms will be enabled for this workspace in an upcoming release."* |
| 7 | `src/app/calendar/page.tsx` | Calendar | Hardcoded calendar events ("Sprint Planning", "SPK-104 Deadline", "Design System Review") mapped to static days. | Runtime | Remove hardcoded events. Render clean calendar grid with truthful empty state: *"No scheduled events for this week."* |
| 8 | `src/app/docs/page.tsx` | Docs & Knowledge Base | Static `docs` array with fictional authors ("Alex Morgan", "David Miller", "Sarah Chen"). Inert `alert()` handler. | Runtime | Remove hardcoded documents. Render honest empty state: *"No workspace documents yet — Product specifications and knowledge documents will be indexed here."* |
| 9 | `src/app/ai/page.tsx` | AI Assistant | Hardcoded initial message ("Hello Alex...") and simulated assistant responses pretending to inspect fictional task "SPK-104" and workspace "Acme Technologies". | Runtime | Remove simulated conversation and fake response logic. Bind context selector dynamically to the real workspace and authenticated user. Render truthful status explaining AI model integration status. |
| 10 | `src/app/insights/page.tsx` | Insights & Analytics | Hardcoded metrics ("78%", "32", "1", "3.2d"), fabricated deliverable distributions (45%, 20%, 25%, 10%), and fake initiative health statuses. | Runtime | Remove fabricated figures. Replace with real workspace metrics (active members, active channels, direct conversations) or truthful unpopulated state: *"No activity data recorded yet."* |
| 11 | `src/lib/workspace-context.tsx` | Notifications & Context | `INITIAL_NOTIFICATIONS` hardcodes mentions from Sarah Chen and task assignments from David Miller. | Runtime | Initialize notifications to empty array `[]`. Render honest empty state: *"No notifications right now."* |
| 12 | `src/components/layout/AppSidebar.tsx` | Navigation & Shell | Hardcoded badge counts (`badge: "3"` on Tasks, `badge: "4"` on Chat, `badge: "7"` on My Tasks). | Runtime | Remove hardcoded badges. Only show badges when backed by real unread counts. |
| 13 | `src/components/layout/GlobalSearchModal.tsx` | Global Search | Quick links hardcode fictional items ("Spark Design System Architecture", "Master UI/UX Specification", "Product Strategy & Q4 Roadmap"). | Runtime | Replace fictional document/meeting links with genuine application navigation commands (e.g., Tasks, Projects, Chat, Team Directory, Settings). |
| 14 | `src/app/settings/page.tsx` & `signup/page.tsx` | Settings / Auth | Input placeholders referencing "Alex Morgan". | Runtime (Cosmetic) | Replace with neutral placeholder values (e.g., "e.g. Jane Doe"). |

---

## Test & Development Fixture Isolation

The following files are verified as **non-runtime development scripts or automated tests** and are preserved without modification:
- `scripts/test-module-03-suite.js`: Integration test suite for real database and Nexconn signature checks.
- `scripts/test-live-rongcloud.js`: External network diagnostic script.
- `scripts/apply-module-03-migration.js`: Database migration runner.

No test scripts or seed endpoints are exposed to production routes.

---

## Next Steps: Phase 2–7 Execution Plan

1. **Phase 2 & 3:** Connect `src/app/teams/page.tsx` to real `WorkspaceMember` and `User` records with real invite modal and truthful empty states.
2. **Phase 4 & 6:** Build `src/lib/actions/dashboard.ts` to compute real workspace metrics; update Dashboard (`src/app/page.tsx`) and Insights (`src/app/insights/page.tsx`) with genuine database records and truthful empty states.
3. **Phase 2 (Continued):** Clean up Tasks, Projects, Meet, Calendar, Docs, AI, Notifications, Global Search, and Sidebar badges to eliminate all fictional employees and simulated state.
4. **Phase 5:** Verify Chat and Nexconn remain strictly bound to authenticated database members.
5. **Phase 7 & 8:** Multi-user isolation verification, TypeScript check, ESLint check, production build, and generate `docs/MOCK_DATA_CLEANUP_REPORT.md`.

