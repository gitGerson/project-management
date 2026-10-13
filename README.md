# TTA Board Management v2

A high-performance, real-time enterprise Kanban project management system built with modern Next.js App Router, TypeScript, Prisma, MySQL, Redis, and WebSocket.

---

## 🛠 Technology Stack

- **Framework**: Next.js (App Router, Turbopack, React Server Components)
- **Language**: TypeScript (strict mode)
- **Database & ORM**: MySQL with Prisma ORM (v1 schema compatible)
- **Realtime Infrastructure**: Redis (Pub/Sub) + Unified WebSocket Server (`server.mjs` / uWebSockets.js pattern)
- **Drag-and-Drop & Ordering**: `dnd-kit` with Rocicorp `fractional-indexing`
- **Authentication & RBAC**: Session JWT + Database RBAC (Roles & Permissions) + Hybrid Board Membership access

---

## 📚 Key Architectural Documentation (`docs/`)

Please consult the following reference guides before designing or modifying features:

1. **[`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md)**:
   Comprehensive system architecture mapping Laravel v1 to Next.js App Router modular monolith (`modules/<feature>/`), dependency direction, and service boundaries.
2. **[`docs/UIUX.md`](docs/UIUX.md)**:
   Visual language, 4px base spacing system, semantic tokens, dialog/modal standards (`AppDialog`, `ConfirmDialog`), accessible touch targets, and subtle real-time interaction rules.
3. **[`docs/KANBAN_ORDERING.md`](docs/KANBAN_ORDERING.md)**:
   Pragmatic, scalable card ordering and real-time drag-and-drop:
   - **Fractional Indexing**: Base62 lexicographical rank keys via `fractional-indexing` to avoid integer renumbering (`1, 2, 3...`) and float precision exhaustion.
   - **Single-Row Mutation**: Moving a card only updates the moved card's `rank`, `columnId` / `listId`, and `version`.
   - **Server Authoritative**: Client sends neighbor card IDs (`previousCardId`, `nextCardId`). The server serializes concurrent moves per board (`SELECT ... FOR UPDATE`), verifies adjacency, generates the new rank, and commits before broadcasting.
   - **MySQL Collation**: `rank` column uses `utf8mb4_bin` collation to ensure database sorting strictly agrees with the JavaScript library.
   - **Maintenance Rebalance**: Occasional column rebalancing using `generateNKeysBetween` when rank strings grow.
4. **[`AGENTS.md`](AGENTS.md)**:
   Developer and AI Agent engineering contract, quality gates, database migration safeguards, and vertical-slice development conventions.

---

## 🚀 Getting Started

### 1. Environment Setup

Copy `.env.example` to `.env.local` and configure your database, Redis, LDAP, and AWS S3 credentials:

```bash
cp .env.example .env.local
```

### 2. Database Migrations

Apply existing reviewed Prisma migrations:

```bash
npx prisma migrate deploy
npx prisma generate
```

### 3. Run Development Server

Start the unified Next.js + WebSocket server:

```bash
node --env-file=.env.local server.mjs
```

The application and WebSocket server will be available at `http://localhost:3000`.

---

## 🧪 Quality Gates & Verification

Before committing changes, ensure all quality gates pass:

```bash
# 1. Typecheck
npx tsc --noEmit

# 2. Linting
npm run lint

# 3. Prisma Schema validation
npx prisma validate
```
