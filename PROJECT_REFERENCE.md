# Project Reference (quick navigation)

Short reference for finding your way around the codebase. For setup and workflow see [README.md](./README.md) and [CLAUDE.md](./CLAUDE.md).

## What this is

Web app for the **Mosaic Strict Matrix Game**: asynchronous play-by-post. Players create/join games, propose actions, argue and vote, then resolve outcomes via a token draw. **Stack:** React 18 + TS (Vite) frontend, Node 20 + Express + Prisma + PostgreSQL backend, JWT auth. **Tests:** Vitest (client + server).

---

## Repo layout

| Path | Purpose |
|------|--------|
| `client/` | React frontend (Vite). Entry: `src/main.tsx` → `App.tsx`. |
| `server/` | Express API. Entry: `src/index.ts`. Mounts routes under `/api/*`. |
| `server/prisma/` | Schema, migrations, seed. |
| `docs/` | API.md (endpoints), DEPLOYMENT.md. |

---

## Client (`client/src/`)

- **Routes** — Defined in `App.tsx`: `/` (Dashboard), `/login`, `/register`, `/forgot-password`, `/reset-password`, `/profile`, `/create-game`, `/join/:gameId`, `/game/:gameId/lobby`, `/game/:gameId/play`, `/help`. Protected vs public via `ProtectedRoute` / `PublicRoute`.
- **Pages** — `pages/`: Dashboard, Login, Register, ForgotPassword, ResetPassword, Profile, CreateGame, JoinGame, GameLobby, GameView, Help. One main page per route.
- **Layout** — `components/layout/Layout.tsx`: shell, nav, outlet for child routes.
- **Game UI** — `components/game/`: ActionProposal, ArgumentationPhase, ArgumentList, AddArgument, VotingPanel, TokenDraw, NarrationForm, RoundSummary, RoundHistory, GameHistory, HostControls, Edit* modals (Action, Argument, Game, Persona, Narration, RoundSummary).
- **Shared UI** — `components/ui/`: ErrorBoundary, ConfirmDialog, Skeleton, ThemeToggle, RichTextEditor, RichTextDisplay.
- **State** — `hooks/useAuth.tsx` (auth state); TanStack Query used for server state (games, actions, rounds). API calls in `services/api.ts`.
- **Content** — `content/help.yaml` (if present): help page content; rendered by `pages/Help.tsx`.
- **Tests** — `*.test.tsx` / `*.test.ts` next to source; shared setup in `test/setup.ts`, `test/test-utils.tsx`.

---

## Server (`server/src/`)

- **Routes** — `routes/*.routes.ts`: auth, users, games, actions, rounds, admin. Mounted in `index.ts` as `/api/auth`, `/api/users`, `/api/games`, `/api/actions`, `/api/rounds`, `/api/admin`.
- **Flow** — Route → controller → service → Prisma. Controllers in `controllers/`, business logic in `services/`.
- **Auth** — `middleware/auth.middleware.ts` (JWT); used by non-auth routes. Auth logic in `services/auth.service.ts`.
- **Other middleware** — `errorHandler.ts`, `security.middleware.ts` (rate limit, headers, sanitize, CSRF), `admin.middleware.ts`.
- **Workers** — `workers/timeout.worker.ts` (action/round timeouts); started from `index.ts`.
- **Config** — `config/env.ts`, `config/database.ts`, `config/uploads.ts`, `config/multer.ts`.
- **Tests** — `tests/`: `unit/`, `integration/`, `e2e/`. Use test DB; see test helpers in `tests/`.

---

## Data model (Prisma)

- **User** — email, passwordHash, displayName, role, etc. Relations: createdGames, gamePlayers.
- **Game** — name, description, status (LOBBY, ACTIVE, PAUSED, COMPLETED), currentPhase (WAITING, PROPOSAL, ARGUMENTATION, VOTING, RESOLUTION, NARRATION, ROUND_SUMMARY), currentRoundId, currentActionId, creatorId, playerCount. Relations: creator, players (GamePlayer), rounds, actions, currentRound, currentAction.
- **GamePlayer** — gameId, userId, personaId, playerName, isHost, isNpc, joinOrder. Links User to Game; optional Persona.
- **Persona** — name, gameId; character identity in a game.
- **Round** — gameId, roundNumber, status, actionsCompleted, totalActionsRequired. Has many Actions; optional RoundSummary.
- **Action** — roundId, initiatorId (GamePlayer), actionDescription, desiredOutcome, status (PROPOSED, ARGUING, VOTING, RESOLVED, NARRATED). Has Arguments, Vote(s), token draw result.
- **Argument** — actionId, authorId, stance (FOR/AGAINST/CLARIFICATION), content.
- **Vote** — actionId, voterId, voteType (LIKELY_SUCCESS, LIKELY_FAILURE, UNCERTAIN).
- **RoundSummary** — roundId, authorId, content (narrative summary).

Game flow: Game has Rounds; each Round has multiple Actions; each Action goes through phases and ends with a token result and narration.

---

## Where to look for…

| Goal | Look in |
|------|--------|
| API contract | `docs/API.md` |
| DB schema / relations | `server/prisma/schema.prisma` |
| Auth (login, JWT, refresh) | `server/src/routes/auth.routes.ts`, `controllers/auth.controller.ts`, `services/auth.service.ts`; client `useAuth`, `api.ts` |
| Create/join game, lobby | `server/src/services/game.service.ts`, `controllers/game.controller.ts`; client `CreateGame.tsx`, `JoinGame.tsx`, `GameLobby.tsx` |
| Propose action, argue, vote, draw, narrate | `server/src/services/action.service.ts`, `controllers/action.controller.ts`; client `ActionProposal.tsx`, `ArgumentationPhase.tsx`, `VotingPanel.tsx`, `TokenDraw.tsx`, `NarrationForm.tsx` |
| Rounds and summaries | `server/src/services/round.service.ts`, `controllers/round.controller.ts`; client `RoundSummary.tsx`, `RoundHistory.tsx`, `GameHistory.tsx` |
| Help / static copy | `client/src/pages/Help.tsx`; optional `client/src/content/help.yaml` |
| Env and deployment | `server/.env.example`, `docs/DEPLOYMENT.md` |

---

## Testing

- **Run all tests:** `pnpm test` (runs client + server from repo root). Client: `pnpm --filter client test`; server: `pnpm --filter server test`.
- **Server scripts:** `test` (unit + integration), `test:watch`, `test:coverage`, `test:e2e` (separate config, uses real DB), `test:all` (unit + integration + e2e). E2e requires test DB: `pnpm --filter server db:migrate:test` (uses `mosaic_game_test`).

**Client** — Vitest + React Testing Library. Tests live next to source (`*.test.tsx`, `*.test.ts`). `test/setup.ts`: `@testing-library/jest-dom`, cleanup, mocks (matchMedia, localStorage, clipboard, ProseMirror/TipTap DOM). `test/test-utils.tsx`: custom `render()` wrapping app in ThemeProvider, QueryClientProvider, BrowserRouter, AuthProvider — use this for component tests so routing and auth work.

**Server** — Vitest; unit and integration use default config, e2e uses `vitest.config.e2e.ts`.
- **Unit** (`server/tests/unit/`): services, validators, middleware. Prisma and deps usually mocked with `vi.mock`.
- **Integration** (`server/tests/integration/`): route tests with supertest against a test app; may use test DB or mocks depending on file.
- **E2E** (`server/tests/e2e/`): full app + real PostgreSQL. `setup.js`: sets `DATABASE_URL` to test DB, exports `testDb` (Prisma), `cleanDatabase`. `test-app.js`: `createTestApp()` for express app. Tests: game flow, actions, uploads, NPC. Run after `db:migrate:test`.

**Where to look:** Client test helpers → `client/src/test/setup.ts`, `client/src/test/test-utils.tsx`. Server test DB setup and app factory → `server/tests/e2e/setup.js`, `server/tests/e2e/test-app.js`.

---

## Game phases (reminder)

`WAITING` → `PROPOSAL` → `ARGUMENTATION` → `VOTING` → `RESOLUTION` → `NARRATION` → `ROUND_SUMMARY`. One action at a time; phase stored on Game and/or Action. Token pool built from votes; 3 tokens drawn for result (+3, +1, -1, -3).
