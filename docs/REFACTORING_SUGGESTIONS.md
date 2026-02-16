# Refactoring Suggestions: Structure and Maintainability

This document lists concrete refactoring ideas to improve code structure, reduce duplication, and make the codebase easier to navigate and change. Each item includes **what** to do, **why** it helps, and **where** it applies.

---

## 1. Client: Types and API contract

### 1.1 Centralize shared types (Game, Persona, Action, etc.)

**Current state:** `Game`, `Persona`, `Player`, and `Action` (and variants like `GameData`, `VoteInfo`) are defined locally in multiple files with slightly different shapes:

- **GameView.tsx** — `Game`, `Persona` (play view: currentRound, currentAction, myPlayer)
- **GameLobby.tsx** — `Game`, `Persona`, `Player` (lobby: players, personas, settings)
- **Dashboard.tsx** — `Game` (list view: playerCount, playerName, isHost, currentRound)
- **JoinGame.tsx** — `GameData`, `Persona`
- **VotingPanel.tsx**, **TokenDraw.tsx**, **NarrationForm.tsx**, **ArgumentationPhase.tsx**, **RoundSummary.tsx** — each has its own `Action` or related interface

**Suggestion:** Introduce a single source of truth for API response types used by the client.

- Add **`client/src/types/`** (or **`client/src/api/`**) with:
  - **`game.ts`** — `Game`, `GameListItem`, `GameLobby`, `GamePlay` (or one `Game` with optional fields / view-specific types) and shared `Persona`, `Player`, `Round`, `Action` types that match what the API returns.
  - **`action.ts`** — `Action`, `Argument`, `Vote`, `TokenDrawResult`, `Narration` (for action-phase components).
  - **`user.ts`** — `User`, `Profile` (align with useAuth and Profile page).
- Derive view-specific types from these (e.g. `GamePlay = Game & { currentRound: Round; currentAction: Action; myPlayer: MyPlayer }`) or document which endpoints return which shape in a single place.

**Why:** One place to update when the API changes; consistent types across pages and components; fewer mismatches between GameView and GameLobby/Dashboard/JoinGame.

---

### 1.2 Single API client layer with typed methods

**Current state:** Components and pages call `api.get(...)`, `api.post(...)` directly with string paths and manually unwrap `res.data`. Query keys like `['game', gameId]` are repeated in many files.

**Suggestion:**

- Add **`client/src/services/`** (or **`client/src/api/`**) modules that wrap the axios instance with typed functions, for example:
  - **`games.ts`** — `getGame(id)`, `getMyGames()`, `createGame(data)`, `joinGame(id, data)`, `startGame(id)`, etc., each returning the correct type and using a consistent response shape (e.g. `{ data: T }`).
  - **`actions.ts`** — `getAction(id)`, `getArguments(actionId)`, `submitVote(actionId, data)`, `drawTokens(actionId)`, `submitNarration(actionId, data)`, etc.
  - **`rounds.ts`** — `getRound(id)`, `getRoundSummary(roundId)`, `submitRoundSummary(roundId, data)`.
  - **`users.ts`** — `getProfile()`, `updateProfile(data)` (and auth if you want it in the same layer).
- Optionally add a small **query-keys** module (e.g. `queryKeys.games.detail(id)`, `queryKeys.games.list()`, `queryKeys.actions.votes(actionId)`) so invalidation and query keys stay in sync.

**Why:** Central place for URLs and response handling; easier to add retries, logging, or error mapping later; query keys defined once reduce mistakes when invalidating.

---

### 1.3 Reusable API error extraction

**Current state:** Error message extraction from failed API calls is duplicated with slight variations:

- **Dashboard.tsx** — `handleImport` / `handleExport` use a long inline extraction from `err.response?.data?.error?.message` (and fallbacks).
- **ActionProposal**, **VotingPanel**, **JoinGame**, and others use patterns like:  
  `(err as { response?: { data?: { error?: { message?: string } } } }).response?.data?.error?.message || 'Fallback'`.

**Suggestion:** Add a small **`client/src/utils/apiError.ts`** (or in `services/`) helper, e.g.:

- `getApiErrorMessage(error: unknown, fallback?: string): string`  
  that handles Axios-style `response.data.error.message` and common variants, and returns a safe string.

Use it in mutation `onError` callbacks and in handlers like `handleImport` / `handleExport`.

**Why:** One place to adjust if the API error shape changes; consistent user-facing messages; less noisy component code.

---

## 2. Client: Hooks and data fetching

### 2.1 Custom hook for “current game” query

**Current state:** Multiple components need the same game query with the same key and similar options:

- **GameView**, **GameLobby**, **JoinGame** (and child components that receive `gameId`) all use `useQuery({ queryKey: ['game', gameId], queryFn: () => api.get(\`/games/${gameId}\`).then(res => res.data), refetchInterval: ... })` with different refetch intervals or no polling.

**Suggestion:** Add **`useGame(gameId: string | undefined, options?: { refetchInterval?: number; enabled?: boolean })`** that:

- Uses a single query key factory (e.g. `['game', gameId]`).
- Calls the games API (via the typed API layer when you have it).
- Returns `{ data, isLoading, error, refetch, game }` (with `game = data?.data`).

Use this in GameView, GameLobby, JoinGame, and anywhere else that only needs “the current game.” Components that need to invalidate can use the same key from the query-keys module or from the hook’s key.

**Why:** One place to change polling or key shape; consistent loading/error handling; less duplication.

---

### 2.2 Invalidate game query in one place

**Current state:** Many components call `queryClient.invalidateQueries({ queryKey: ['game', gameId] })` after a mutation. The string key `['game', gameId]` is repeated in 15+ places.

**Suggestion:** Once you have a query-keys helper (see 1.2), use it everywhere:

- e.g. `queryClient.invalidateQueries({ queryKey: queryKeys.game(gameId) })`.

Optionally, a small **`useInvalidateGame(gameId)`** that returns `() => invalidateQueries(...)` so call sites stay minimal.

**Why:** Changing the key shape (e.g. namespacing) only requires updating one module; fewer typos and inconsistencies.

---

## 3. Client: Components and pages

### 3.1 Break up GameView

**Current state:** **GameView.tsx** is large (600+ lines): it owns the game query, phase switch, header with image, player list, phase content, round history modal, host controls, and export.

**Suggestion:** Split by responsibility:

- **GameView.tsx** — Keeps route, `useGame`, and top-level layout; delegates to:
  - **GameViewHeader** — Image, title, back link, phase badge.
  - **GameViewPlayers** — Player list / personas (and any “expanded persona” state if it stays here).
  - **GameViewPhase** or **GamePhaseContent** — The `renderPhaseContent()` switch (PROPOSAL → … → ROUND_SUMMARY); can live in its own file and receive `game`, `myPlayer`, `currentUserId`.
  - **GameViewSidebar** (optional) — Round history button, host controls, export; or keep host controls in layout and “Round history” as a modal trigger in header/sidebar.

**Why:** Smaller files are easier to read and test; phase logic can be tested in isolation; header/sidebar can change without touching phase logic.

---

### 3.2 Reusable “loading / error / retry” patterns

**Current state:** Loading and error UIs are implemented inline in Dashboard, GameView, GameLobby, etc. (skeletons, “Failed to load”, “Try again” button). Patterns are similar but not shared.

**Suggestion:** Add small presentational components or a single **`QueryState`** (or **`DataState`**) component, e.g.:

- `QueryState<T>({ isLoading, error, refetch, data, children })`  
  Renders skeleton when loading, error + retry when error, or `children(data)` when data exists.

Use it for game query, games list, and other main data fetches so layout and copy are consistent.

**Why:** Consistent loading/error UX; one place to improve accessibility or styling for those states.

---

### 3.3 Export all game components from barrel

**Current state:** **`components/game/index.ts`** exports phase components and edit modals but **GameLobby** imports **EditGameModal** and **EditPersonaModal** directly from `'../components/game/EditGameModal'` (and EditPersonaModal). The barrel doesn’t export them.

**Suggestion:** Export **EditGameModal** and **EditPersonaModal** from **`components/game/index.ts`** and use the barrel in GameLobby (e.g. `import { EditGameModal, EditPersonaModal } from '../components/game'`).

**Why:** Single entry point for “game” components; clearer that these modals belong to the game feature.

---

## 4. Server: Controllers and services

### 4.1 Reduce controller boilerplate (try/catch and params)

**Current state:** Every controller method follows the same pattern: `try { const gameId = req.params.gameId; const userId = req.user!.id; const data = schema.parse(req.body); const result = await service.method(...); res.json({ success: true, data: result }); } catch (e) { next(e); }`. This is repeated dozens of times.

**Suggestion:** Introduce a small **handler wrapper** or **asyncHandler**:

- A higher-order function or wrapper that:
  - Invokes an async handler with `(req, res)` (or with extracted `params`, `user`, `body`).
  - Catches errors and calls `next(error)`.
  - Optionally standardizes success JSON (e.g. `res.json({ success: true, data })`).

Then controller functions become thin: extract params/user, validate body (Zod), call service, send response. No repeated try/catch in each.

**Why:** Less noise; consistent error forwarding; easier to add logging or metrics in one place.

---

### 4.2 Param and body extraction helpers

**Current state:** Controllers repeatedly do `const gameId = req.params.gameId as string` and `const userId = req.user!.id`. Some routes use `actionId`, `roundId`, etc.

**Suggestion:** Optional small helpers (or use inside the async handler wrapper), e.g.:

- `getUserId(req)` → `req.user!.id`
- `getGameId(req)` → `req.params.gameId`
- `getActionId(req)` → `req.params.actionId`

Or a single `req.ctx = { userId, gameId?, actionId?, roundId? }` set by middleware for routes that have these params. Then controllers use `req.ctx` instead of repeating param extraction.

**Why:** Fewer magic strings; one place to type `params`; optional future validation of UUIDs in one place.

---

### 4.3 Split large services

**Current state:** **game.service.ts** and **action.service.ts** are large (hundreds of lines each) and host many unrelated concerns (CRUD, phase transitions, NPC logic, notifications, export/import, etc.).

**Suggestion:** Split by domain or flow, while keeping the same public API for controllers:

- **game.service.ts** — Keep game CRUD, join/leave, start; optionally move “get game for play” vs “get game for lobby” into small helpers or a sub-module.
- **game-phase.service.ts** or **phase.service.ts** — Phase transitions, “next action,” “next round,” and any logic that advances `Game.currentPhase` / `currentActionId` / `currentRoundId`. Called from game.service and action.service.
- **action.service.ts** — Action CRUD, arguments, votes, draw, narration; can call phase.service when an action completes.
- **npc.service.ts** (optional) — NPC user lookup, NPC proposal logic (currently in action.service). Keeps “game rules” and “NPC behavior” separate.
- **export.service.ts** / **import** — Already separate; keep export/import and YAML parsing there.

**Why:** Easier to locate logic (e.g. “where is phase advanced?”); smaller files; clearer boundaries for testing and for future features (e.g. timeouts, replays).

---

## 5. Validation and errors

### 5.1 Align Zod schemas with API docs and client types

**Current state:** Request validation lives in **server/src/utils/validators.ts** (Zod). Response shapes are not codified in a shared package; client types are defined per-component.

**Suggestion:** (Optional but high impact.)

- Keep Zod on the server as the source of truth for **request** body shapes.
- Document response shapes in **docs/API.md** (or OpenAPI) and, if you add **client/src/types/** (see 1.1), keep those types in sync with the docs (or generate client types from OpenAPI if you introduce it).
- For a few critical payloads (e.g. create game, join game, action proposal), consider exporting Zod schemas or a minimal “API types” file from the server that the client can import (e.g. via a shared workspace package or a build-time step). This is a bigger step but reduces drift.

**Why:** Fewer bugs from “server changed the field name and client didn’t”; clearer contract.

---

### 5.2 Standardize error codes and messages

**Current state:** Services throw **BadRequestError**, **NotFoundError**, **ForbiddenError**, **ConflictError** with ad-hoc messages. The client often only shows `error.message`.

**Suggestion:** Optionally introduce a small set of **error codes** (e.g. `GAME_NOT_FOUND`, `NOT_GAME_MEMBER`, `ALREADY_PROPOSED`) and use them in services and in the API response body. Client can map codes to user-facing copy or fall back to message. Document codes in **docs/API.md**.

**Why:** Enables i18n or consistent messaging; client can branch on code when needed without parsing strings.

---

## 6. Cross-cutting and repo structure

### 6.1 Game phase and status constants

**Current state:** Phase and status strings (`'PROPOSAL'`, `'ARGUMENTATION'`, `'ACTIVE'`, etc.) appear as literals in client and server. Prisma enums exist on the server but the client re-defines or uses strings.

**Suggestion:** Add a small **shared constants** module (or a **shared** workspace package if you want to go that far):

- **Client:** e.g. **`client/src/constants/game.ts`** — `GAME_PHASES`, `GAME_STATUS`, or a union type + array of phases for iteration. Use these in GameView’s switch and in any status badges.
- **Server:** Already has Prisma enums; ensure services use `GamePhase.PROPOSAL` etc. and don’t duplicate string literals.

If you add a **shared** package later, move phase/status enums and any shared constants there so client and server both import from one place.

**Why:** Single source of truth; refactors (e.g. renaming a phase) are safer; TypeScript can enforce exhaustiveness in phase switches.

---

### 6.2 Optional shared package for types/constants

**Current state:** No shared code between client and server; types and constants are duplicated or implied.

**Suggestion:** (Larger refactor.) Add a **`packages/shared`** (or **`shared/`**) workspace package containing:

- **Constants** — Game phases, statuses, vote types, result types (if useful on both sides).
- **Types** — Only those that truly define the “contract” (e.g. API request/response types derived from Zod or hand-written). Client and server both depend on `@repo/shared` and import from it.

Build the package with `tsc` or a bundler; client and server consume it. Start small (e.g. only constants and 2–3 key types) and grow if it pays off.

**Why:** Guarantees client and server stay in sync for those types and constants; no duplicate enums or magic strings.

---

## 7. Testing and documentation

### 7.1 Test utilities for API and auth

**Current state:** Server integration/e2e tests build a test app and seed or clean the DB; client tests use **test-utils** with providers. There’s no shared “create test user + get token” or “create test game” helper used across multiple tests.

**Suggestion:** On the server, add (or expand) **test helpers** that:

- Create a test user and return a valid JWT (and optionally the user record).
- Create a game with N players (and optionally advance to a given phase).  
Use these in integration and e2e tests so setup is one-liners and consistent.

On the client, if you add **useGame** or typed API functions, add unit tests or integration tests that mock the API layer and assert on query keys and invalidation.

**Why:** Faster test writing; less duplication in test setup; consistent “test game” state.

---

### 7.2 Document refactors in DEVELOPMENT_PLAN or CHANGELOG

**Suggestion:** When you implement any of the above, note it in **DEVELOPMENT_PLAN.md** (or a CHANGELOG) under a “Refactoring” or “Tech debt” section: what was changed, which files, and any migration notes for future contributors.

**Why:** Keeps the “why” and “what” of structural changes visible and helps avoid reverting good structure by accident.

---

## 8. Priority overview

| Priority | Suggestion | Impact | Effort |
|---------|------------|--------|--------|
| High | 1.1 Centralize client types (Game, Persona, Action, etc.) | Fewer bugs, easier API changes | Medium |
| High | 1.3 Reusable API error extraction | Consistency, less duplication | Low |
| High | 2.1 `useGame(gameId)` hook | Less duplication, single place for game fetch | Low |
| High | 4.1 Controller async handler wrapper | Cleaner controllers, consistent error handling | Low–Medium |
| Medium | 1.2 Typed API client layer + query keys | Maintainability, type safety | Medium |
| Medium | 2.2 Centralized query keys for invalidation | Fewer mistakes, easier refactors | Low |
| Medium | 3.1 Split GameView into smaller components | Readability, testability | Medium |
| Medium | 4.3 Split game.service / action.service | Navigability, testing | Medium |
| Lower | 3.2 Reusable loading/error/retry UI | UX consistency | Low |
| Lower | 3.3 Export EditGameModal/EditPersonaModal from barrel | Consistency | Low |
| Lower | 4.2 Param extraction helpers | Slightly cleaner controllers | Low |
| Lower | 5.1 / 5.2 Align schemas, error codes | Better contract, i18n potential | Medium |
| Optional | 6.1 / 6.2 Phase constants, shared package | Single source of truth, type safety | Medium–High |

Implementing the high-priority items first will give the biggest structural improvement with manageable effort; the rest can be adopted incrementally as you touch the relevant areas.
