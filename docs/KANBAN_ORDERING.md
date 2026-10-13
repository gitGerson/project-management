# Kanban Card Ordering and Realtime Drag-and-Drop

## Purpose

This guide defines a pragmatic, scalable card-ordering approach for a Trello-style Kanban board built with **Next.js**, **dnd-kit**, **Prisma**, **MySQL**, and **uWebSockets.js**.

**Recommended approach:** use **lexicographically sortable fractional indexing keys** (Base62-style strings) for card ranks. Reordering typically changes only the moved card's `rank` and, for cross-column moves, its `columnId`.

Fractional indexing is an ordering algorithm, **not** a full concurrency-control system. The server remains authoritative.

## 1. Why fractional indexing?

Avoid integer indices (`1, 2, 3, ...`) when frequent insertion or drag-and-drop would require renumbering many rows. Avoid floating-point midpoint ordering as repeated inserts can exhaust numerical precision.

Fractional indexing generates a sortable string between the preceding and following card ranks.

Example (illustrative keys only; the library controls the actual format):

```text
Before:
Design UI    a0
Build API    a1
Write Tests  a2

Move Write Tests between Design UI and Build API:
Design UI    a0
Write Tests  a0V  <- only this card's rank changes
Build API    a1
```

Use the maintained library API instead of manually concatenating characters.

```bash
npm install fractional-indexing @dnd-kit/core @dnd-kit/sortable @dnd-kit/utilities
```

```ts
import { generateKeyBetween, generateNKeysBetween } from 'fractional-indexing';

const first = generateKeyBetween(null, null);
const beforeFirst = generateKeyBetween(null, first);
const afterFirst = generateKeyBetween(first, null);
const between = generateKeyBetween(first, afterFirst);

// When creating or rebalancing a batch of cards:
const initialRanks = generateNKeysBetween(null, null, 10);
```

## 2. Database design

```prisma
model Column {
  id    String @id @default(cuid())
  title String
  cards Card[]
}

model Card {
  id        String @id @default(cuid())
  title     String
  columnId  String
  rank      String @db.VarChar(255)
  version   Int    @default(0)

  column    Column @relation(fields: [columnId], references: [id])

  @@index([columnId, rank])
}
```

**Important MySQL collation rule:** the ordering library assumes a consistent character-by-character lexical comparison. Configure the `rank` column to use a case-sensitive, binary collation such as `utf8mb4_bin` (or another verified collation whose ordering agrees with the library). Do not rely on a default case-insensitive MySQL collation. Prisma schema does not directly express per-column MySQL collations; add SQL to a Prisma migration and verify it on your database version:

```sql
ALTER TABLE `Card`
  MODIFY `rank` VARCHAR(255)
  CHARACTER SET utf8mb4 COLLATE utf8mb4_bin NOT NULL;
```

Keep an explicit secondary sort for deterministic reading if equal ranks ever occur:

```ts
const cards = await prisma.card.findMany({
  where: { columnId },
  orderBy: [{ rank: 'asc' }, { id: 'asc' }],
});
```

The secondary sort is a fallback, **not** a substitute for collision handling.

## 3. Drag-and-drop behavior with dnd-kit

On `onDragEnd`:

1. Determine the moved card and destination column.
2. Calculate the proposed insertion position from the **client's optimistic board state**.
3. Update local state immediately for a responsive interface.
4. Send the move intent to the server, preferably using neighbor **card IDs** rather than trusting a client-generated final rank.
5. Reconcile the client with the authoritative server response; revert/refetch on failure.

Suggested request:

```ts
type MoveCardRequest = {
  cardId: string;
  targetColumnId: string;
  previousCardId: string | null;
  nextCardId: string | null;
  // An optional request id helps deduplicate repeated sends.
  requestId?: string;
};
```

For moving to the beginning, `previousCardId = null`. For the end, `nextCardId = null`. For an empty column, both are `null`.

Do **not** take neighbor positions directly from a stale drag-start snapshot. Use the target layout as it will appear **after** insertion.

## 4. Server-side move algorithm

The following is a *conceptual implementation*. Authorization, request validation, idempotency, and concurrency serialization are intentionally called out rather than hidden behind an unsafe one-query example.

```ts
import { generateKeyBetween } from 'fractional-indexing';

async function moveCard(input: MoveCardRequest, actorId: string) {
  // 1. Authorize actor access to card, board and destination column.
  // 2. Serialize/reconcile concurrent moves for the affected board/column(s).
  // 3. In that protected operation, load current neighbors from DB.
  // 4. Verify that neighbors belong to targetColumnId, are distinct from
  //    cardId, and are adjacent (after excluding the moved card).
  // 5. Generate the new rank and persist the move atomically.
  // 6. Commit; only then publish the movement event.
  // 7. Return the authoritative card state to the caller.
}
```

Key generation within the protected operation:

```ts
const newRank = generateKeyBetween(
  previousCard?.rank ?? null,
  nextCard?.rank ?? null,
);

const moved = await tx.card.update({
  where: { id: cardId },
  data: {
    columnId: targetColumnId,
    rank: newRank,
    version: { increment: 1 },
  },
});
```

**Concurrency policy:** for the initial implementation, serialize conflicting reorder operations per board (e.g., via a dedicated board lock row locked with `SELECT ... FOR UPDATE` inside a MySQL transaction). Locking only the moved card is insufficient: different cards can target the same gap. Lock all affected boards in a deterministic order if cross-board moves are allowed. Once the lock is acquired, read the current target neighbors, verify adjacency, then generate and persist the rank. If the intent is stale, return a conflict with the latest order or recompute according to a clearly documented policy.

Avoid network calls or WebSocket sends inside the database transaction. For stronger delivery guarantees, persist an outbox event in the same transaction and publish it asynchronously through a worker.

## 5. Realtime synchronization with uWebSockets.js

Recommended flow:

```text
User drags card (dnd-kit)
  -> Optimistic local reorder
  -> Next.js server endpoint / server action
  -> Authorization + serialized DB transaction
  -> Prisma updates card.rank and card.columnId
  -> Commit
  -> uWebSockets.js broadcasts card.moved
  -> Other clients patch local board state
  -> Initiator reconciles authoritative response/event
```

Example event payload:

```json
{
  "type": "card.moved",
  "eventId": "evt_123",
  "boardId": "board_1",
  "cardId": "card_9",
  "fromColumnId": "todo",
  "toColumnId": "doing",
  "rank": "a0V",
  "version": 8
}
```

Event consumers should:

- Subscribe only to boards they are authorized to see.
- Apply moves idempotently using `eventId` or a suitable version/sequence policy.
- Ignore older card versions when newer state is already applied.
- Remove a moved card from the source column and insert it into the target column in rank order.
- Refetch board state when detecting a missed event, unexpected version gap, or reconnection.

**Deployment:** if Next.js and uWebSockets.js run as separate processes/services, use an explicit connection between them (or an event bus). Do not assume an in-memory broadcast in a Next.js process reaches a separate WS service or multiple server instances. WebSocket endpoint routing may require a separate port behind your reverse proxy.

## 6. Handling ties, rank growth, and rebalance

### Rank collisions

Concurrent insertions can create the same fractional key. Use serialization/conflict handling; never assume the library guarantees uniqueness across clients or concurrent requests. If a collision is detected, retry with freshly loaded neighbors or rebalance the affected column under the same lock.

### Rebalancing

Repeatedly inserting cards into a narrow gap can make rank strings longer. Define a reasonable maximum rank length (for example, alert or consider rebalancing when ranks exceed 64 characters; tune based on actual use). Under exclusive ordering control for the column, regenerate keys in current visible order:

```ts
const orderedCards = await tx.card.findMany({
  where: { columnId },
  orderBy: [{ rank: 'asc' }, { id: 'asc' }],
});

const ranks = generateNKeysBetween(null, null, orderedCards.length);

for (const [index, card] of orderedCards.entries()) {
  await tx.card.update({
    where: { id: card.id },
    data: { rank: ranks[index], version: { increment: 1 } },
  });
}
```

This is an occasional maintenance operation, **not** the default action on every drag. Clients should refetch or receive a batch reorder event after rebalancing. For very large columns, use a carefully designed batch update and transaction size policy.

## 7. API and UX contracts

- **One canonical ordering:** the database `rank` is authoritative; the client array index is presentation-only.
- **Stable identities:** dnd-kit draggable IDs must be stable card IDs, never ranks or array offsets.
- **One write per ordinary move:** update `columnId`, `rank`, and `version` together.
- **Optimistic but recoverable:** on an API error, rollback the optimistic move or refetch.
- **Server validates placement:** confirm the target column and neighbor IDs are valid and authorized.
- **No silent stale writes:** detect changed ordering and return a conflict or intentional rebase behavior.
- **Scoped broadcasts:** event audience must follow board authorization.
- **Cross-column move:** persist destination column and rank atomically.
- **Empty destination:** `generateKeyBetween(null, null)` provides a first key.
- **Top/bottom placement:** use a `null` lower/upper bound as appropriate.

## 8. Testing checklist

- [ ] Insert into empty, beginning, middle, and end of a column.
- [ ] Move within the same column, including one-position and no-op moves.
- [ ] Move between columns and verify source/destination membership.
- [ ] Confirm UI order matches MySQL `ORDER BY rank ASC, id ASC`.
- [ ] Test ranks containing both uppercase and lowercase letters under the configured collation.
- [ ] Simulate concurrent users moving different cards into the same gap.
- [ ] Simulate stale neighbor IDs and deleted/relocated neighbor cards.
- [ ] Test authorization for cards and destination columns.
- [ ] Test optimistic rollback on server failure.
- [ ] Test duplicate, delayed, out-of-order, and missing WebSocket events.
- [ ] Test reconnect/refetch and multi-instance message delivery.
- [ ] Trigger rank-length rebalance and confirm consistent order afterward.

## 9. Implementation decision

For this project, choose **Rocicorp `fractional-indexing` + dnd-kit + Prisma/MySQL + uWebSockets.js**. This keeps normal drag-and-drop writes small, supports smooth optimistic UI, and permits realtime updates.

**Do not introduce full LexoRank complexity unless requirements justify it.** Fractional indexing is sufficient for ordinary Kanban ordering when paired with server-side concurrency control, binary-compatible database sorting, conflict handling, and occasional rebalancing.

## References

- Fractional indexing library: https://github.com/rocicorp/fractional-indexing
- dnd-kit: https://dndkit.com/
- Prisma: https://www.prisma.io/docs
- uWebSockets.js: https://github.com/uNetworking/uWebSockets.js
