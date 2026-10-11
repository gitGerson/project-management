# Next.js Architecture — Laravel-like, without Laravel ceremony

## Intent
A maintainable **modular monolith** for Next.js App Router + TypeScript + MySQL + Prisma. Separate transport/UI, validation, domain workflows, and data access. Start thin; split responsibilities only when they earn their existence.

## Recommended tree

```text
.
├── AGENTS.md
├── docs/
│   └── ARCHITECTURE.md
├── prisma/
│   ├── schema.prisma
│   ├── migrations/
│   └── seed.ts
├── src/
│   ├── app/
│   │   ├── (auth)/login/page.tsx
│   │   ├── (dashboard)/layout.tsx
│   │   ├── (dashboard)/assets/page.tsx
│   │   ├── (dashboard)/assets/[id]/page.tsx
│   │   └── api/v1/assets/route.ts
│   ├── modules/
│   │   ├── assets/
│   │   │   ├── actions.ts
│   │   │   ├── components/
│   │   │   │   ├── asset-form.tsx
│   │   │   │   └── asset-table.tsx
│   │   │   ├── schemas/
│   │   │   │   └── asset.schema.ts
│   │   │   ├── services/
│   │   │   │   └── asset.service.ts
│   │   │   ├── repositories/
│   │   │   │   └── asset.repository.ts
│   │   │   ├── types.ts
│   │   │   └── __tests__/
│   │   ├── maintenance/
│   │   └── users/
│   └── lib/
│       ├── prisma.ts
│       ├── auth.ts
│       ├── access.ts
│       ├── errors.ts
│       └── env.ts
└── package.json
```

Folders are **guidelines**, not placeholders to create unnecessarily. For a simple read-only feature, a query service plus a page may be enough. For complex transactional modules, create repositories and schemas when useful.

## Laravel correspondence

| Laravel | Next.js equivalent | Responsibility |
|---|---|---|
| `routes/web.php` and Blade / Inertia page | `src/app/**/page.tsx` | route + server-rendered UI |
| API Controller | `src/app/api/**/route.ts` | HTTP boundary: request/response |
| Form Request | `schemas/*.schema.ts` (e.g. Zod) | validation at boundary |
| Service / Action class | `modules/*/services/*.service.ts` | business processes, state transitions |
| Eloquent model/query layer | Prisma schema/client + optional repository | persistence and filtering |
| Policy / Gate | `src/lib/access.ts` and service checks | RBAC + tenant access |
| Middleware | `proxy.ts` / framework-compatible edge entry, plus secure DAL checks | optional early redirects; NOT final authorization |
| Resource / Transformer | typed DTO mapping | bounded server-to-client contracts |
| Database migration | `prisma/migrations/` | schema change history |
| Seeder / Factory | `prisma/seed.ts` + fixtures | development-only test data |

## Recommended request flow

**Server-rendered list**

```text
GET /assets
  -> app/(dashboard)/assets/page.tsx
  -> auth() + server-side access context
  -> listAssetsService(context, filters)
  -> assetRepository.findMany({ company scope, filters, pagination })
  -> Prisma -> MySQL
  -> minimal DTOs -> React Server Component
```

**Internal form mutation**

```text
AssetForm (client only if needed)
  -> createAssetAction(formData)  [Server Action]
  -> auth() + permission/tenant authorization + Zod
  -> createAssetService(context, input)
  -> Prisma transaction / repository
  -> revalidatePath or revalidateTag where appropriate
  -> UI result
```

**Third-party API**

```text
POST /api/v1/assets
  -> route.ts (API key/session, parse, validate, rate-limit if appropriate)
  -> same createAssetService(context, input)
  -> DTO / structured HTTP response
```

## Core architecture decisions

### 1. Modules follow business domains
Prefer `assets`, `maintenance`, `employees`, `records`, `reports` rather than global directories `controllers`, `services`, `repositories` that grow indefinitely. Put private logic inside the module; cross-module orchestration happens through a public service function.

### 2. Services own transactions and invariants
A service checks permission, validates domain state, enforces uniqueness/availability, coordinates repositories, and commits multi-step updates atomically. Read services may be very small. Don't use framework HTTP objects inside services.

### 3. Repositories are optional, focused query helpers
Use repositories for repeated, complex, scoped queries or testable access boundaries. Avoid a generic `BaseRepository<T>` and unnecessary CRUD pass-through methods. Direct Prisma in a small service is acceptable if it is the only persistence entry and the module has no need for another layer; never query from page components or client components.

### 4. Explicit auth, RBAC, and multi-company rules
Treat **identity**, **permission**, and **record/company scope** as separate checks. Use `AccessContext` from trusted server auth; `tenant-bypass` must be explicit and narrowly authorized. Apply scope to both collections and individual item modifications. Avoid trusting a form-submitted `companyId` without verifying access to that target. Deny by default.

### 5. Schema ownership and migration policy
MySQL is the source of persistence; Prisma schema/migrations describe it. Use unique indexes, foreign keys, and indexes for frequent company/status/date filters. Review migration SQL. Never destructively reset a pre-existing or production database. Keep seed data separate from production and idempotent where possible.

### 6. Version-aware Prisma
Prisma 7 requires a driver adapter for `PrismaClient` and generally moves the connection URL into `prisma.config.ts`. MySQL uses provider `mysql`; for local MySQL/MariaDB use the appropriate adapter. Prisma 6 installations can differ. Match actual installed version, generator output path, and runtime imports rather than hardcoding examples.

### 7. Runtime/caching conventions
Use Node.js runtime on code paths requiring Prisma. Server Components can query services directly; do not create self-fetching internal API calls. Mutations invalidate the relevant cache/path deliberately, and UI components don't assume automatic freshness. Be explicit about dynamic/personalized data; never cache tenant-specific responses across users by mistake.

### 8. Schema/DTO examples
Use Zod input schemas at the edges. Return DTOs with only necessary fields. Prisma `Decimal`, `BigInt`, and `Date` may need deliberate serialization for client props and JSON APIs.

### 9. Testing pyramid
Unit-test domain services and validation; integration-test Prisma queries and tenant scoping against a **dedicated test DB**; route/action tests cover adapter contracts, status codes, auth, and invalid inputs. Include duplicate, unauthorized, cross-company, and concurrency cases.

## Example feature: asset registration (pseudocode)

```ts
// src/modules/assets/schemas/asset.schema.ts
import { z } from 'zod'

export const createAssetSchema = z.object({
  name: z.string().trim().min(1).max(120),
  serial: z.string().trim().min(1).max(120),
  companyId: z.string().min(1), // verify access on server
})
export type CreateAssetInput = z.infer<typeof createAssetSchema>
```

```ts
// src/modules/assets/services/asset.service.ts
// Illustrative interface; adapt `AccessContext`, `db`, and Prisma IDs to your app.
export async function createAsset(context: AccessContext, input: CreateAssetInput) {
  requirePermission(context, 'assets.create')
  await requireCompanyAccess(context, input.companyId)

  // Unique serial + company scope must also be enforced by database constraints.
  return db.asset.create({
    data: {
      name: input.name,
      serial: input.serial,
      companyId: input.companyId,
      createdById: context.userId,
    },
    select: { id: true, name: true, serial: true, companyId: true },
  })
}
```

```ts
// src/modules/assets/actions.ts
'use server'
// Illustrative: implement auth, error mapping, and cache invalidation with project APIs.
export async function createAssetAction(raw: unknown) {
  const context = await requireAccessContext()
  const input = createAssetSchema.parse(raw)
  const result = await createAsset(context, input)
  revalidatePath('/assets')
  return result
}
```

The snippets show *responsibility boundaries*, not copy-paste-ready application code. The actual `AccessContext`, DB model names, auth library, and Prisma client setup depend on your repository.

## Add a new module: agent checklist
1. Find nearby module and permission naming conventions.
2. Decide whether this is UI-only, full-stack, or public API.
3. Define minimal schema + constraints and migration when necessary.
4. Implement server-side access controls and tenant scoping.
5. Add service and focused Prisma query helpers as complexity warrants.
6. Wire Server Action or Route Handler, page, client components, and cache refresh.
7. Write happy-path and negative tests; validate typecheck/lint/build.
8. Document noteworthy decisions in a short note, not a large speculative design document.

## When NOT to add layers
- A static page needs no module service.
- A one-off simple query doesn't require a repository class.
- A local form doesn't require a global state manager.
- A private page doesn't require a public REST API.
- A few related packages do not justify a monorepo.
- Shared code should move to `src/lib` only after there are genuinely multiple consumers.

## References
- https://nextjs.org/docs/app
- https://nextjs.org/docs/app/guides/authentication
- https://nextjs.org/docs/app/getting-started/mutating-data
- https://www.prisma.io/docs/orm/v7/core-concepts/supported-databases/mysql
- https://www.prisma.io/docs/orm/v7/prisma-client/queries/transactions
