# SPARK — MASTER UI/UX DESIGN SPECIFICATION

**Document Version:** 1.0.0  
**Status:** Permanent Design Authority  
**Author:** Principal Product Designer, Senior UI/UX Engineer & Design Systems Architect

---

## 1. Product Identity

- **Product Name:** SPARK
- **Tagline:** One workspace. Every conversation. Every project. Every possibility.
- **Product Category:** All-in-one AI-powered workplace collaboration and productivity platform.
- **Core Principle:** Conversation → Intelligence → Execution.
- **Product Vision:** Bring communication, video meetings, project management, tasks, documentation, and AI-powered intelligence into one connected workplace environment.
- **Design Personality:**
  - Professional
  - Minimal
  - Elegant
  - Structured
  - Intelligent
  - Reliable
  - Modern
  - Calm
  - Enterprise-ready

*The product communicates trust, clarity, productivity, and technical sophistication. Never look like a gaming interface, crypto dashboard, AI chatbot template, or experimental concept.*

---

## 2. Design Inspiration & References

- **Linear:** Information hierarchy, project navigation, task management.
- **Notion:** Workspace organization, content layouts.
- **Slack:** Communication & channel organization.
- **Microsoft Teams:** Enterprise collaboration.
- **Asana:** Task organization and project workflows.
- **Stripe Dashboard:** Professional data presentation.
- **Raycast:** Clean interaction patterns.

*SPARK retains its own distinct, unified visual identity.*

---

## 3. Visual Design System

### Color Palette
- **Primary:**
  - Primary Blue: `#2563EB` (Tailwind `blue-600`)
  - Primary Hover: `#1D4ED8` (Tailwind `blue-700`)
  - Primary Subtle: `#EFF6FF` (Tailwind `blue-50`)
- **Secondary:**
  - Accent Violet: `#7C3AED` (Tailwind `violet-600`)
  - Violet Subtle: `#F5F3FF` (Tailwind `violet-50`)
- **Backgrounds & Surfaces:**
  - Application Background: `#F8FAFC` (Tailwind `slate-50`)
  - Main Surface: `#FFFFFF` (`white`)
  - Secondary Surface: `#F1F5F9` (Tailwind `slate-100`)
- **Typography:**
  - Primary Text: `#0F172A` (Tailwind `slate-900`)
  - Secondary Text: `#475569` (Tailwind `slate-600`)
  - Muted Text: `#94A3B8` (Tailwind `slate-400`)
- **Borders:**
  - Default Border: `#E2E8F0` (Tailwind `slate-200`)
  - Strong Border: `#CBD5E1` (Tailwind `slate-300`)
- **Semantic Status Colors:**
  - Success: `#16A34A` (Tailwind `emerald-600` / `green-600`)
  - Warning: `#D97706` (Tailwind `amber-600`)
  - Error: `#DC2626` (Tailwind `red-600`)
  - Information: `#2563EB` (Tailwind `blue-600`)

*Rule: Use status colors only when communicating meaningful status. No decorative violet/blue gradients. No arbitrary colors.*

### Typography
- **Font Family:** `Inter, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif`
- **Scale:**
  - Page Title: 24–28px, font-semibold, tracking-tight
  - Section Title: 16–20px, font-semibold
  - Card Title: 14–16px, font-medium / font-semibold
  - Body: 14px, leading-normal
  - Secondary Text: 12–13px, leading-snug
  - Labels & Badges: 12–13px, font-medium

---

## 4. Spacing, Geometry & Component Tokens

- **Grid Base:** 4px
  - 4px (`p-1`, `gap-1`): very tight inline spacing
  - 8px (`p-2`, `gap-2`): compact element spacing
  - 12px (`p-3`, `gap-3`): standard control spacing
  - 16px (`p-4`, `gap-4`): normal component spacing
  - 20px (`p-5`, `gap-5`): section spacing
  - 24px (`p-6`, `gap-6`): standard content spacing
  - 32px (`p-8`, `gap-8`): large section spacing
  - 40px (`p-10`, `gap-10`): major page separation
- **Border Radius:**
  - Inputs & Buttons: 7–8px (`rounded-md` / `rounded-lg`)
  - Cards: 10px (`rounded-[10px]`)
  - Dialogs & Large Containers: 12px (`rounded-xl`)
- **Elevation & Shadows:**
  - Minimal elevation (`shadow-xs` / `shadow-sm`).
  - Reserve shadows for dropdowns, popovers, and modal dialogs.
  - Cards use crisp `border border-slate-200` rather than heavy drop shadows.

---

## 5. Global Application Layout

- **Desktop (>= 1024px):**
  - Left Sidebar: Fixed/sticky, ~240px, pure white surface (`#FFFFFF`), subtle right border (`#E2E8F0`), SPARK brand header, workspace switcher, module navigation, user account footer.
  - Top Header: ~60px height, breadcrumb / page title, global search (`Ctrl+K`), quick actions, notification center trigger, user avatar.
  - Main Canvas: Background `#F8FAFC`, responsive max-width padding, clean hierarchy without nested box syndrome.
- **Tablet (768px - 1023px):**
  - Collapsible sidebar with quick toggle, retaining header search and context.
- **Mobile (< 768px):**
  - Compact 56px header with drawer sheet navigation, full touch-target compliance (>= 44px), zero accidental horizontal scroll.

---

## 6. Brand Mark & Typography Treatment

- Simple, geometric, sharp geometric mark: Crisp minimalist SVG spark symbol.
- Wordmark: "SPARK" in Inter Bold with tight letter-spacing (`tracking-tight font-bold text-slate-900`).
- Consistent across Auth screens, Shell navigation, and system messaging.

---

## 7. Workspace & Navigation Architecture

### Workspace Switcher:
- Current active workspace with badge (Personal vs Organization).
- List of available workspaces (Personal + Joined Organizations).
- Quick actions: Create Workspace, Workspace Settings.

### Personal Workspace Navigation:
- Home / Dashboard
- My Tasks
- Projects
- Chat
- Meet
- AI Assistant
- Docs
- Settings

### Organization Workspace Navigation:
- Overview
- Chat
- Meetings
- Projects
- My Tasks
- Calendar
- AI Assistant
- Docs & Knowledge
- People & Teams
- Insights
- Settings

*Icons: Exclusively Lucide icons, accompanying crisp text labels. Active state: subtle blue background (`bg-blue-50 text-blue-700 font-medium`).*

---

## 8. Technical Stack & Standards

- Next.js (App Router, React 19 / 18, TypeScript)
- Tailwind CSS
- shadcn/ui design patterns
- Lucide React
- Real-world ready state management: Empty, Loading (Skeletons), Error, Success states.
- Strict No-AI-Slop policy: zero useless glow, no fake charts, no bloated cards.

