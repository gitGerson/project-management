# UI/UX Design Standards

> General-purpose standards for a minimalist, whitespace-driven, modal-heavy, responsive Next.js application with direct manipulation and real-time collaboration.

**Status:** Design and implementation guideline  
**Scope:** Presentation, interaction, reusable components, accessibility, drag-and-drop, and real-time UX.  
**Out of scope:** Business domains, data models, user roles, product workflows, and feature-specific requirements.

## 1. Design philosophy

**Calm interface. Clear interaction. Minimum cognitive load.**

- Favor understanding over decoration and predictable behavior over novelty.
- Use generous *intentional* whitespace to separate concepts; group related controls closely.
- Preserve the user's context. Prefer an overlay or inline edit to navigation for bounded tasks.
- Make the primary action obvious. Secondary actions should remain discoverable without competing visually.
- Apply progressive disclosure: simple options first, advanced options when relevant.
- Use familiar labels. Do not rely on color, motion, or icons alone to convey meaning.
- Provide immediate, accurate feedback. Never imply an operation succeeded before confirmation.
- Optimize for keyboard, mouse, touch, and assistive technology equally.
- Minimalism must not hide essential functions or make interactive affordances ambiguous.

## 2. Visual language

### 2.1 Whitespace and density

Use a **4px base spacing system** (`4, 8, 12, 16, 24, 32, 48, 64`). Default to:

| Context | Guideline |
| --- | --- |
| Between label and control | 6–8px |
| Between related controls | 12–16px |
| Between distinct sections | 24–32px |
| Dialog content padding | 24px desktop, 16px mobile |
| Form control height | 36–44px desktop; touch targets at least 44×44px where practical |
| Card padding | 12–16px |
| Page content width | Constrained for reading; allow full width for spatial canvases |

Avoid both dense clusters and large meaningless gaps. Use whitespace as hierarchy rather than filling every area with cards or borders.

### 2.2 Color, typography, and surfaces

- Prefer neutral backgrounds, restrained accent color, and clear text contrast.
- Use semantic design tokens instead of hard-coded colors in feature components: `background`, `foreground`, `surface`, `muted`, `border`, `primary`, `destructive`, `success`, `warning`, and `focus`.
- Use borders subtly; avoid repeated heavy shadows and decorative gradients.
- Use one font family and a limited type scale. Maintain a clear heading/body/caption hierarchy.
- Use one consistent radius scale (typically 6–10px on ordinary controls).
- Support light and dark themes using the same token semantics.
- Meet WCAG 2.2 AA contrast and focus expectations; do not depend solely on low-contrast gray text.
- Prefer responsive layout over arbitrary fixed pixel widths.

### 2.3 Motion

- Motion must explain transitions, hierarchy, or direct manipulation.
- Use short, restrained transitions (approximately 120–220ms for ordinary state changes).
- Avoid animation on routine text/data updates when it adds noise.
- Respect `prefers-reduced-motion`: remove nonessential movement and provide instant state changes.

## 3. Interaction surface decision rules

| User intent | Preferred surface |
| --- | --- |
| Small field change | Inline edit |
| Single lightweight choice | Popover, menu, or combobox |
| Short, focused create/edit flow | Small/medium dialog |
| Rich details or multi-section editing | Large detail dialog |
| Critical, irreversible decision | Alert dialog |
| Non-blocking auxiliary information | Tooltip (never the only place for essential information) |
| Persistent exploration | Main page/canvas |
| Reorder or relocate visual items | dnd-kit drag-and-drop **and** a non-drag equivalent |

**Modal-first, not modal-for-everything.** A modal should preserve context and reduce navigation; it must not turn simple actions into multi-step obstacles.

## 4. Modal-heavy interaction standard

### 4.1 Reusable modal variants

- `AppDialog`: standard focused content, reusable header/body/footer.
- `DetailDialog`: large, structured content with optional secondary metadata panel.
- `FormDialog`: validation, dirty tracking, save/cancel, pending state.
- `ConfirmDialog`: dangerous or irreversible actions only.
- `ResponsiveDialog`: desktop dialog with full-screen or near-full-screen mobile presentation where needed.

Implement these as compositions/wrappers of your chosen accessible primitives, not as a second competing dialog framework.

### 4.2 Modal layout and rules

1. Provide a specific title, concise description when needed, and an obvious close control.
2. Place the primary action consistently, typically bottom-right; keep secondary actions visually quieter.
3. For long content, **scroll the body inside the modal**; consider a sticky header and footer.
4. Focus a meaningful element on open; trap focus appropriately; restore focus to the original trigger on close.
5. Support `Escape` when safe. Clicking the backdrop may close a read-only dialog, but never silently discard edited content.
6. Track unsaved changes. On attempted dismissal, prompt only if loss is real; offer **Keep editing** and **Discard changes**.
7. Avoid nested modal stacks. Prefer a popover inside a dialog; replace content or use a single managed overlay route when more depth is required.
8. Do not trigger opening/closing as a side effect of unrelated real-time updates.
9. Keep background content visually recognizable but inert and inaccessible to interaction while modal is active.
10. Use responsive widths based on content, not a single universal maximum width. On small screens, use stacked content, safe-area padding, and reachable action controls.
11. When possible, retain draft state during temporary network loss. Avoid accidental double submission.
12. Use semantic dialog labels and clear inline validation errors.

### 4.3 Modal anatomy

```text
┌──────────────────────────────────────────────────────┐
│ Icon  Meaningful title                         Close  │  ← stable header
│       Optional short context                         │
├──────────────────────────────────────────────────────┤
│                                                      │
│  Primary content               Optional properties  │  ← body scrolls
│  Descriptive inputs            / secondary actions  │
│  Progressive sections                                │
│                                                      │
├──────────────────────────────────────────────────────┤
│ Status / validation              Cancel   Save       │  ← stable footer
└──────────────────────────────────────────────────────┘
```

### 4.4 Interaction states

Every actionable modal must define: `idle`, `dirty`, `validating`, `submitting`, `success`, `error`, and (if relevant) `conflict` or `offline` states. Disable duplicate submits while a mutation is pending. Acknowledge persistence, not just a button press.

## 5. Component library and ownership

### 5.1 Preferred stack

| Concern | Default | Notes |
| --- | --- | --- |
| UI components | shadcn/ui | Own source code; compose rather than fork unnecessarily |
| Accessible foundation | Base UI **or** Radix UI | Choose one per project; check installed shadcn registry choice |
| Styling/tokens | Tailwind CSS 4 + CSS variables | Semantic tokens, centralized themes |
| Icons | Lucide React | Consistent stroke/size; label ambiguous actions |
| Drag-and-drop | dnd-kit (`@dnd-kit/react` for current API) | Verify version before adopting examples |
| Structured data | TanStack Table | Keep styling within the shared design system |
| Form validation | React Hook Form + Zod | Shared schema, per-field feedback |
| Toasts | Sonner | Use sparingly, not for every micro-interaction |
| Optional animation | Motion | Only when CSS is insufficient and behavior benefits |
| Client state/cache | Local React state; TanStack Query when warranted | Separate transient UI state from server state |

Do not install the entire stack upfront. Avoid duplicate libraries that solve the same primitive problem.

### 5.2 General-purpose components

```text
components/
  ui/                      # Installed shadcn-owned primitives
  layout/                  # AppShell, Header, Sidebar, Breadcrumbs
  overlays/                # AppDialog, DetailDialog, FormDialog, ConfirmDialog
  inputs/                  # InlineEdit, SearchCombobox, DatePicker, Field
  feedback/                # EmptyState, LoadingState, ErrorState, ConnectionStatus
  drag-drop/               # DragHandle, SortableList, DropIndicator, DragOverlay
  realtime/                # SyncIndicator, RemoteChangeHint, PresenceIndicator
  typography/              # PageHeading, SectionHeading, MutedText
```

- Components accept typed props, callbacks, and data; no direct Prisma access or hidden network side effects inside presentational components.
- Favor composition, slots, and small explicit variants over giant configuration-driven components.
- Provide disabled, pending, loading, empty, focus, error, and success states where relevant.
- Use accessible names and stable interaction patterns across the application.

## 6. dnd-kit interaction standards

### 6.1 Behavior

- Use drag-and-drop where spatial reordering makes the interface clearer; never make it the sole way to perform an action.
- Prefer a dedicated drag handle when cards contain buttons, links, text selection, or form inputs.
- Show a clear **active item**, **drop destination**, and **insertion position**. Provide an appropriately sized drag overlay.
- Support pointer/touch and keyboard sensors or equivalent accessible keyboard interactions.
- Prevent accidental dragging with appropriate activation constraints or handles.
- Allow scrolling while dragging, including horizontal overflow containers where applicable.
- Keep layout stable during drag; avoid excessive animations, jumping, or scroll hijacking.
- On invalid drop or cancellation, restore the prior order clearly.
- Announce start/move/drop/cancel states to screen readers; enable keyboard-driven relocation.
- Provide a menu action such as **Move to…** or **Move up/down** for users who cannot drag.

### 6.2 State and persistence

A reorder is **one user intention** even if many item positions change.

```text
User drops item
    ↓
Validate local destination
    ↓
Show optimistic position (pending indicator if needed)
    ↓
Send mutation with operation ID + base revision
    ↓
Server checks authorization and version, persists once
    ↓
Server acknowledges and emits canonical order/version
    ↓
All relevant clients reconcile to canonical state
```

- Avoid emitting a network mutation for every pointer movement. Commit on successful drop.
- Keep stable IDs distinct from display indices; use deterministic ordering keys, not array positions as identity.
- Debounce/throttle *visual* pointer work where necessary, not the final committed drop.
- If persistence fails, restore or reconcile the canonical order and show a useful message with retry or Undo where safe.
- If a remote update arrives while dragging, preserve the active interaction, flag the conflict as needed, and rebase or reconcile on drop; never let items unexpectedly jump under the pointer.
- Reject stale writes or resolve them with an explicit server concurrency policy.

Reference: https://dndkit.com/react/quickstart/ and https://dndkit.com/react/guides/sortable-state-management/

## 7. Real-time UX over WebSockets (uWebSockets.js)

### 7.1 Experience goals

Real-time events should keep users informed **without interrupting their focus**. The interface should feel synchronized, not noisy.

- Apply remote changes quietly when they do not affect active editing.
- Do not replace text inside a field currently being edited.
- Do not close dialogs, steal focus, reset scroll position, or cancel drags due to remote messages.
- Surface a subtle *Updated elsewhere* hint if remote changes overlap with an active draft.
- Show connection health only when the state affects trust in displayed data.
- Use presence and “someone is editing” indicators only where actionable, with restrained visuals and privacy-aware scope.
- Never use a success toast for every received event; use inline changes, badges, and selective announcements instead.

### 7.2 Transport boundaries

- Browser clients use the **native WebSocket API**; `uWebSockets.js` runs on the server, not in a browser.
- For Next.js, run the uWebSockets.js gateway in a compatible **long-lived Node.js process/service**. Do not assume serverless route handlers support persistent upgrade connections.
- Keep UI components transport-agnostic; a shared real-time client/service translates events into cache or store updates.
- Authenticate WebSocket upgrades; authorize every subscription and mutation. Do not trust client-selected topic names or room IDs.
- Use WSS in deployed environments, verify allowed origins, rate-limit incoming messages, constrain payload sizes, and sanitize rendered content.
- Treat WebSockets as the **delivery mechanism**, not the system of record. Persist accepted changes before broadcasting their canonical results.
- uWebSockets.js offers topic `subscribe`/`unsubscribe`/`publish`; coordinate across instances through an external message bus when scaling beyond one process.
- Handle backpressure (`getBufferedAmount`, `drain`, dropped messages); slow consumers may need a fresh snapshot instead of replaying everything.

### 7.3 Event envelope (illustrative contract)

```ts
type RealtimeEvent<T = unknown> = {
  eventId: string;       // unique; supports deduplication
  type: string;          // e.g. "entity.updated" or "order.changed"
  scope: string;         // authorized subscription scope
  entityId?: string;
  revision: number;      // monotonic within the relevant entity/scope
  occurredAt: string;    // ISO 8601 timestamp
  actorId?: string;
  operationId?: string;  // matches initiating mutation for acknowledgement
  payload: T;            // validated, minimal, permitted data
};
```

Events are schema-validated and versioned. Only deliver fields the recipient is authorized to see. Event IDs support dedupe; revision numbers support ordering checks and gap detection. They are different concepts.

### 7.4 Mutation and reconciliation contract

1. User makes a change. UI may display an optimistic version immediately.
2. Client sends a mutation through the authorized write path with `operationId` and expected revision.
3. Server validates, persists, increments revision, acknowledges, and broadcasts the accepted event.
4. Client matches the acknowledgement to the optimistic operation; other clients apply the event.
5. Clients ignore duplicate `eventId` values. If a revision is missing/out of order, re-fetch a canonical snapshot or replay from a supported cursor.
6. On rejection, conflict, or timeout, remove the incorrect optimistic assumption and reconcile from the server.

**Never treat broadcast delivery as proof of persistence.** Acknowledgement should identify the committed operation or otherwise provide authoritative state.

### 7.5 Connection lifecycle and visual signals

| Transport state | UI response |
| --- | --- |
| Connected and synchronized | No permanent visual noise; optional subtle status on demand |
| Reconnecting | Small non-blocking connection hint, if materially relevant |
| Offline | Clearly indicate live updates are unavailable; do not suggest changes are synchronized |
| Pending local write | Inline saving/syncing state near the affected control |
| Write confirmed | Clear pending state; avoid excessive success notifications |
| Conflict | Contextual message and safe resolution/reload choices |
| Revision gap / stale data | Quiet re-sync, with message only if user action is required |

- Reconnect with exponential backoff and jitter, with a bounded delay. Reauthenticate/re-authorize after reconnect.
- On reconnect, re-establish authorized subscriptions and obtain missing changes or a fresh snapshot.
- Manage subscriptions on mount/scope change and clean up on unmount; avoid duplicate listeners.
- Consider browser visibility to reduce unnecessary presence broadcasts, but refresh/reconcile on return.
- Do not promise offline writes unless a dedicated durable offline queue and conflict strategy have been implemented.

### 7.6 Real-time + modal and drag-and-drop rules

**While a dialog is open:**
- Keep the draft isolated from incoming canonical updates.
- Non-conflicting remote changes can refresh read-only detail areas unobtrusively.
- If the same editable fields change remotely, preserve the draft and offer an explicit review/reload/overwrite decision, according to permissions and revision checks.
- Validate revision at save; prevent silent last-write-wins overwrites unless explicitly designed.

**While dragging:**
- Keep the drag gesture deterministic; queue/rebase overlapping remote order changes.
- On drop, commit a revision-aware mutation and reconcile server order.
- Never duplicate a visual item when the server broadcasts an event already optimistically applied locally.

### 7.7 Presence and rate control

- Presence indicators are ephemeral, never a replacement for durable records.
- Throttle cursor, typing, hover, and drag-presence events; do not persist or broadcast each keystroke or pointer movement indiscriminately.
- Coalesce frequent visual updates and batch React state changes as appropriate.
- Enforce server-side topic authorization and connection cleanup to prevent stale presence.

References: https://github.com/uNetworking/uWebSockets.js and https://unetworking.github.io/uWebSockets.js/generated/interfaces/WebSocket.html

## 8. Accessibility and usability requirements

- Fully usable with keyboard, including dialogs, menus, forms, and reorder alternatives.
- Logical focus order, visible focus ring, dialog focus management, and Escape behavior.
- Accessible labels and errors; do not substitute placeholder text for labels.
- Correct semantic HTML and announcement of meaningful asynchronous results.
- Touch targets large enough for practical use; do not depend exclusively on hover.
- Test narrow mobile screens, browser zoom, high contrast, and reduced-motion settings.
- Use loading skeletons only when they clarify structure; avoid layout shifts.
- Confirm destructive actions based on risk, not frequency of UI code patterns.

## 9. Definition of done: UI/UX review checklist

- [ ] Main action is clear without an onboarding explanation.
- [ ] Whitespace communicates grouping and priority.
- [ ] Components use semantic tokens and shared primitives.
- [ ] Every interaction has appropriate idle/loading/success/error feedback.
- [ ] Dialog maintains context, keyboard/focus access, and unsaved-draft safety.
- [ ] Drag-and-drop has a visible destination and a non-drag alternative.
- [ ] Mutations do not duplicate after retries or echoed WebSocket events.
- [ ] Remote updates do not overwrite active drafts or interrupt dragging.
- [ ] Reconnect, stale data, conflict, and failure behavior are defined and tested.
- [ ] Layout works on mobile, desktop, zoomed, dark mode, and reduced motion.
- [ ] Keyboard and screen-reader accessibility have been tested.
- [ ] No redundant toast, modal, or animation introduces unnecessary friction.

## 10. Agent implementation rules

1. Follow this document for UI work unless an explicit user requirement supersedes it.
2. Prefer existing primitives before introducing another UI dependency.
3. Favor a composed, modal-first workflow while maintaining simple direct actions.
4. Separate UI state, transport state, server state, and optimistic state.
5. Never couple presentational components directly to uWebSockets.js server APIs.
6. Use the installed dnd-kit generation's actual API; do not mix legacy and current examples.
7. Make real-time events revision-aware, idempotent to apply, and safe during editing.
8. Prioritize predictability, accessibility, and recoverability over animation or visual novelty.
9. Keep examples generic; do not introduce domain-specific concepts into these standards.
10. Review accessibility and failure cases before considering an interaction complete.

---

**Principle:** The interface should feel quiet when everything is working and precise when the user needs to act.
