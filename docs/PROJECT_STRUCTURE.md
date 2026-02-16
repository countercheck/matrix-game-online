# Project Structure and How It Functions

This document describes the repository layout, request flow, data model, and how the frontend and backend work together. For a short navigation reference, see [PROJECT_REFERENCE.md](../PROJECT_REFERENCE.md).

---

## 1. Repository layout

```
.
├── client/                    # React SPA (Vite)
│   ├── src/
│   │   ├── main.tsx           # Entry: React root, providers, router
│   │   ├── App.tsx             # Route definitions, Protected/PublicRoute
│   │   ├── index.css           # Tailwind + theme
│   │   ├── components/         # Reusable UI
│   │   │   ├── layout/         # Layout, header, nav
│   │   │   ├── game/           # Game-specific (actions, votes, rounds, etc.)
│   │   │   └── ui/             # Generic (ErrorBoundary, ConfirmDialog, Skeleton, etc.)
│   │   ├── pages/              # One per route (Dashboard, GameView, Help, …)
│   │   ├── hooks/              # useAuth, useTheme
│   │   ├── services/           # api.ts (axios instance)
│   │   ├── utils/              # cn, formatTime, download
│   │   └── test/               # setup.ts, test-utils.tsx
│   ├── index.html
│   ├── vite.config.ts          # Proxy /api → backend
│   └── package.json
├── server/                     # Express API
│   ├── src/
│   │   ├── index.ts            # App entry: middleware, routes, listen
│   │   ├── config/             # database (Prisma), env, uploads, multer
│   │   ├── controllers/        # HTTP handlers (call services, send JSON)
│   │   ├── services/           # Business logic, Prisma access
│   │   ├── routes/             # Express routers (auth, users, games, actions, rounds, admin)
│   │   ├── middleware/         # auth, errorHandler, security, admin
│   │   ├── workers/            # timeout.worker.ts (action/round timeouts)
│   │   ├── utils/              # logger, validators (Zod)
│   │   └── types/              # express.d.ts (Request.user, etc.)
│   ├── prisma/
│   │   ├── schema.prisma       # Data model
│   │   ├── migrations/
│   │   └── seed.ts
│   ├── tests/                  # unit/, integration/, e2e/
│   └── package.json
├── docs/                       # API.md, DEPLOYMENT.md, this file
├── docker-compose.yml         # PostgreSQL for local dev
├── pnpm-workspace.yaml
└── package.json                # Root scripts: pnpm dev, test, db:* (delegated to server)
```

The repo is a **pnpm workspace**: root `package.json` runs scripts with `pnpm --filter client` / `pnpm --filter server`. The frontend is a single React app; the backend is a single Express app. There is no shared TypeScript package; API types are implied by usage and by `docs/API.md`.

---

## 2. How the frontend works

### 2.1 Entry and provider tree

- **`main.tsx`** creates the React root and wraps the app in, from the outside in:
  - `ThemeProvider` (theme/useTheme)
  - `QueryClientProvider` (TanStack Query; default staleTime 1 min, retry 1)
  - `BrowserRouter`
  - `AuthProvider` (useAuth: user, token, login, register, logout)
- **`App.tsx`** defines all routes and wraps them in `ProtectedRoute` or `PublicRoute` (which use `useAuth()` to redirect unauthenticated users to `/login` or authenticated users away from login/register).

So: **auth state is in React context** (AuthProvider); **server state (games, actions, rounds, profile) is in TanStack Query**, keyed by resource (e.g. `['game', gameId]`).

### 2.2 Routing

| Path | Component | Auth |
|------|-----------|------|
| `/login`, `/register`, `/forgot-password` | Login, Register, ForgotPassword | Public (redirect if logged in) |
| `/reset-password` | ResetPassword | Public, no redirect |
| `/` | Layout + `<Outlet />` | Protected |
| `/` (index) | Dashboard | Protected |
| `/profile` | Profile | Protected |
| `/create-game` | CreateGame | Protected |
| `/join/:gameId` | JoinGame | Protected |
| `/game/:gameId/lobby` | GameLobby | Protected |
| `/game/:gameId/play` | GameView | Protected |
| `/help` | Help | Protected |

Layout (`components/layout/Layout.tsx`) renders the header (logo, nav: Dashboard, Profile, Help, user name, Logout, ThemeToggle) and a mobile menu; the main content is `<Outlet />` (the matched child route).

### 2.3 API client and auth

- **`services/api.ts`** creates an axios instance:
  - `baseURL`: `${VITE_API_URL}/api` when `VITE_API_URL` is set (e.g. production), otherwise `/api` (dev/test).
  - Sets `Content-Type: application/json` and `X-Requested-With: XMLHttpRequest` (for CSRF).
  - Response interceptor: on **401**, clears `localStorage` auth and redirects to `/login`.
- **Auth** is stored in `localStorage` (`auth_token`, `auth_user`). On load, `useAuth` reads these and sets `api.defaults.headers.common['Authorization'] = 'Bearer ' + token`. Login/register set the same header and localStorage; logout clears them.

So every API call from the client is sent to an `/api/...` path—either via the dev proxy (`/api` → `http://localhost:3000`) or via `${VITE_API_URL}/api` in production; the backend sees the JWT in the `Authorization` header.

### 2.4 Data flow (TanStack Query)

- **Reads**: Pages and components use `useQuery({ queryKey: [...], queryFn: () => api.get(...).then(res => res.data) })`. Example: `GameView` uses `queryKey: ['game', gameId]` and polls every 5s; Dashboard uses `['games']`; JoinGame uses `['game', gameId]` for preview.
- **Writes**: Components use `useMutation({ mutationFn: ... })` and on success call `queryClient.invalidateQueries({ queryKey: ['game', gameId] })` (or similar) so the next read refetches. Mutations use the same `api` instance (with JWT).
- **No global Redux/store**: Only auth in context and server state in React Query.

### 2.5 Client directories in practice

- **pages/** — Top-level route components. They use `useParams`, `useAuth`, and `useQuery`/`useMutation`; they often import game components and pass `gameId`, `game`, `myPlayer`, etc.
- **components/game/** — Game flow UI: `ActionProposal`, `ArgumentationPhase`, `ArgumentList`, `AddArgument`, `VotingPanel`, `TokenDraw`, `NarrationForm`, `RoundSummary`, `RoundHistory`, `GameHistory`, `HostControls`, and several `Edit*Modal` components. These typically take `gameId`, `actionId`, and/or game/round data and call the actions and rounds APIs via mutations, then invalidate the game query.
- **components/ui/** — Shared pieces: `ErrorBoundary`, `ConfirmDialog`, `Skeleton`, `ThemeToggle`, `RichTextEditor`, `RichTextDisplay`.
- **hooks/** — `useAuth` (context consumer), `useTheme` (theme + system preference).
- **utils/** — `cn` (classnames), `formatTime`, `download` (blob download for export).

---

## 3. How the backend works

### 3.1 Entry and middleware order

**`server/src/index.ts`**:

1. Load env (`dotenv.config()`).
2. **securityHeaders** — Sets security-related HTTP headers.
3. **cors** — Origin from `APP_URL` or `http://localhost:5173`, `credentials: true`.
4. **express.json** — Body parsing, limit 10kb.
5. **Static** — `/uploads` served from `getUploadsDir()` (game images, etc.).
6. **Rate limiting** — On `/api` (skipped in `NODE_ENV=test`).
7. **sanitizeInput** — Input sanitization.
8. **csrfProtection** — CSRF checks (skipped in test).
9. **Routes** — See below.
10. **errorHandler** — Catches errors passed to `next()` and returns JSON (uses `AppError` subclasses for status/code).
11. **404 handler** — JSON `NOT_FOUND` for unmatched routes.

After `app.listen`, the **timeout worker** is started (unless `ENABLE_TIMEOUT_WORKER=false`) to advance stuck actions/rounds.

### 3.2 API route mounting

All under `/api`:

| Prefix | Router | Purpose |
|--------|--------|---------|
| `/api/auth` | auth.routes | register, login, logout, refresh, forgot-password, reset-password |
| `/api/users` | user.routes | profile (get/update), avatar |
| `/api/games` | game.routes | CRUD games, join, leave, start, players, history, rounds, propose action, image upload, export, import, host skip/skip-proposals, personas |
| `/api/actions` | action.routes | get action, arguments (get/add), complete-argumentation, votes (get/submit), draw (post/get), narration (get/post), host edit/skip (argumentation, voting) |
| `/api/rounds` | round.routes | get round, summary (get/post/put) |
| `/api/admin` | admin.routes | Admin-only: users, games, audit, ban, etc. |

Health check: **GET /health** (no prefix) returns `{ status: 'ok', timestamp }`.

### 3.3 Request flow (authenticated routes)

1. **Route** — e.g. `router.get('/:gameId', authenticateToken, gameController.getGame)`.
2. **authenticateToken** — Reads `Authorization: Bearer <token>`, verifies JWT with `JWT_SECRET`, loads user from DB (rejects if missing or banned). Sets **`req.user`** (id, email, displayName, role, isBanned).
3. **Optional role middleware** — e.g. `requireGameMember('gameId')` (user must be an active player, sets `req.gamePlayer`), `requireGameHost`, `requireActionInitiator` (sets `req.action`). Used on selected routes.
4. **Controller** — Extracts params/body, optionally validates with Zod (e.g. `createGameSchema.parse(req.body)`), calls **service** functions.
5. **Service** — Uses **`db`** (Prisma client from `config/database.ts`) for all DB access. Throws errors from `middleware/errorHandler` (e.g. `NotFoundError`, `ForbiddenError`).
6. **Controller** — Sends `res.json({ success: true, data: ... })` or lets errors propagate to `errorHandler`.

So: **routes → middleware (auth/role) → controller → service → Prisma**. Controllers are thin; business logic lives in services.

### 3.4 Auth and role helpers

- **authenticateToken** — Required on almost all routes except auth and health. Ensures `req.user` is set.
- **requireGameMember(gameIdParam)** — Ensures the user is an active player in the game; sets `req.gamePlayer`.
- **requireGameHost(gameIdParam)** — Ensures the user is the host of the game (used for start, skip, some edits).
- **requireActionInitiator(actionIdParam)** — Ensures the user is the initiator of the action (used for draw, narration, edit narration).

Custom error classes (`BadRequestError`, `UnauthorizedError`, `ForbiddenError`, `NotFoundError`, `ConflictError`) are used in services and middleware; `errorHandler` maps them to HTTP status and a consistent JSON shape.

### 3.5 Server config and workers

- **config/database.ts** — Single Prisma client; in dev/test reused via `globalThis` to avoid too many connections.
- **config/env.ts** — Validates/reads env vars.
- **config/uploads.ts** — Directory for uploaded files (e.g. game images); can be overridden for deployment.
- **config/multer.ts** — Multer config for file uploads.
- **workers/timeout.worker.ts** — Periodically checks for actions or rounds that have been in a phase too long and advances or resolves them (env: `ENABLE_TIMEOUT_WORKER`, `TIMEOUT_CHECK_INTERVAL_MS`).

---

## 4. Database and data model

### 4.1 Prisma

- **Schema**: `server/prisma/schema.prisma`. Migrations in `server/prisma/migrations/`. Commands: `pnpm db:generate`, `pnpm db:migrate`, `pnpm db:push`, `pnpm db:studio` (run from root or `pnpm --filter server ...`).
- **Usage**: All server code uses the singleton `db` from `config/database.ts` (PrismaClient). No raw SQL in application code; all access via Prisma models.

### 4.2 Main entities and relationships

- **User** — id, email, passwordHash, displayName, role (USER/MODERATOR/ADMIN), isBanned, resetToken for password reset, etc. Relations: createdGames, gamePlayers, gameEvents, adminActions.
- **Game** — name, description, imageUrl, creatorId, status (LOBBY | ACTIVE | PAUSED | COMPLETED), **currentPhase** (WAITING | PROPOSAL | ARGUMENTATION | VOTING | RESOLUTION | NARRATION | ROUND_SUMMARY), currentRoundId, currentActionId, playerCount, settings (JSON), npcMomentum. Relations: creator (User), currentRound (Round), currentAction (Action), players (GamePlayer), personas (Persona), rounds, actions, events.
- **GamePlayer** — gameId, userId, personaId (optional), playerName, joinOrder, isHost, isNpc, isActive. Links User to Game; optionally to a Persona. Relations: game, user, persona, initiatedActions, arguments, votes, narrations, roundSummaries.
- **Persona** — gameId, name, description, isNpc, npcActionDescription, npcDesiredOutcome, sortOrder. One per game; optionally claimed by one GamePlayer (personaId).
- **Round** — gameId, roundNumber, status (IN_PROGRESS | COMPLETED), actionsCompleted, totalActionsRequired. Relations: game, actions (Action[]), summary (RoundSummary?).
- **RoundSummary** — roundId, authorId (GamePlayer), content (text), outcomes (JSON).
- **Action** — gameId, roundId, initiatorId (GamePlayer), sequenceNumber, actionDescription, desiredOutcome, status (PROPOSED | ARGUING | VOTING | RESOLVED | NARRATED), argumentationWasSkipped, votingWasSkipped, timestamps. Relations: game, round, initiator, arguments, votes, tokenDraw, narration.
- **Argument** — actionId, playerId, argumentType (INITIATOR_FOR | FOR | AGAINST | CLARIFICATION), content, sequence.
- **Vote** — actionId, playerId, voteType (LIKELY_SUCCESS | LIKELY_FAILURE | UNCERTAIN), successTokens, failureTokens, wasSkipped.
- **TokenDraw** — actionId, totalSuccessTokens, totalFailureTokens, randomSeed, drawnSuccess, drawnFailure, resultValue, resultType (TRIUMPH | SUCCESS_BUT | FAILURE_BUT | DISASTER). Has DrawnToken records for the three drawn tokens.
- **Narration** — actionId, authorId (GamePlayer), content.
- **GameEvent** — gameId, userId?, eventType, eventData (JSON); for activity/history.
- **AdminAuditLog** — adminId, action, targetType, targetId, details, ipAddress.

Game state is driven by **Game.currentPhase**, **Game.currentRoundId**, and **Game.currentActionId**. The backend advances phase and current action/round as players complete proposal → argumentation → voting → resolution → narration; then round summary; then next round or back to proposal for the next action.

---

## 5. End-to-end flow examples

### 5.1 User signs in

1. User opens `/login`, submits email/password.
2. **Login** page calls `login(email, password)` from `useAuth`, which `api.post('/auth/login', { email, password })`.
3. Server **auth.routes** → **auth.controller** → **auth.service**: validate credentials, create JWT, return `{ user, token }`.
4. Client stores token and user in localStorage and sets `Authorization` on the axios instance; `AuthProvider` state updates; user is redirected (e.g. to `/`).
5. Subsequent API calls send `Authorization: Bearer <token>`. **authenticateToken** validates the token and attaches `req.user`.

### 5.2 Create game and open lobby

1. User goes to `/create-game`, submits name/description (and optional settings). **CreateGame** uses `useMutation` to `api.post('/games', body)`.
2. **game.routes** → **game.controller.createGame** → **game.service.createGame**: create Game, create GamePlayer (host), optionally create Personas; log GameEvent. Response includes full game with players.
3. Client invalidates `['games']` and navigates to `/game/:gameId/lobby`.
4. **GameLobby** uses `useQuery({ queryKey: ['game', gameId] })` to load game (and optionally poll). Renders players, personas, host “Start game” and “Edit game” etc. Join link is something like `/join/:gameId` (same origin or full URL).

### 5.3 Join and start

1. Another user opens `/join/:gameId`. **JoinGame** fetches game (read-only) with `useQuery`, then submits join with `useMutation` → `POST /games/:gameId/join` (optionally with playerName, personaId). **game.service.joinGame** adds a GamePlayer, maybe assigns a Persona.
2. Host clicks “Start”. **GameLobby** calls `useMutation` → `POST /games/:gameId/start`. **game.service.startGame** sets game status to ACTIVE, creates first Round, sets currentRoundId, sets phase to PROPOSAL (or similar). All players can then go to `/game/:gameId/play`.

### 5.4 Playing a round (propose → argue → vote → draw → narrate)

1. **GameView** loads with `useQuery(['game', gameId])` (refetch every 5s). It reads `game.currentPhase`, `game.currentRound`, `game.currentAction`, `game.players`, `game.myPlayer` (computed or included by backend).
2. **Proposal phase**: Each player proposes one action. **ActionProposal** submits `POST /games/:gameId/actions` with action description and desired outcome. Backend creates Action, ties to current round, may set phase/currentAction. Client invalidates `['game', gameId]`.
3. When all have proposed (or host skips), backend advances to **argumentation**. **ArgumentationPhase** and **AddArgument** use `POST /actions/:actionId/arguments`, **ArgumentList** uses `GET /actions/:actionId/arguments`. **completeArgumentation** is called when a player is done. Backend advances to **voting** when appropriate.
4. **Voting**: **VotingPanel** loads votes with `GET /actions/:actionId/votes`, submits with `POST /actions/:actionId/votes`. Backend builds token pool from votes; when all voted (or skip), advances to **resolution**.
5. **Resolution**: **TokenDraw** loads draw result (if any) with `GET /actions/:actionId/draw`, initiator submits `POST /actions/:actionId/draw`. Backend performs random draw, stores TokenDraw and DrawnToken, sets result; advances to **narration**.
6. **Narration**: **NarrationForm** loads narration with `GET /actions/:actionId/narration`, initiator submits with `POST /actions/:actionId/narration`. Backend stores Narration; when all actions in the round are narrated, backend advances to ROUND_SUMMARY or starts next round.
7. **Round summary**: Someone writes the round summary via **RoundSummary** component → `POST /rounds/:roundId/summary`. Backend attaches RoundSummary to Round; then next round begins (new Round, phase back to PROPOSAL for the next set of actions).

Throughout, **GameView** re-renders from the same `useQuery(['game', gameId])`; mutations invalidate that key so the next refetch (or the 5s poll) returns updated phase, currentAction, and related data.

### 5.5 Export / import

- **Export**: `GET /games/:gameId/export` returns a YAML (or similar) representation of the game. Client uses **download** util to save as file.
- **Import**: `POST /games/import` with body (YAML/text) and auth creates a new game from that data; **game.service** (or **export.service**) parses and creates Game, Rounds, Actions, etc., as appropriate.

---

## 6. Security and configuration

- **JWT**: Signed with `JWT_SECRET`; payload includes userId (and email). Refresh endpoint can issue a new token.
- **Passwords**: Hashed with bcrypt (rounds configurable; lower in test).
- **CSRF**: Custom header or cookie checked by **csrfProtection** (disabled in test).
- **Rate limiting**: General limit on `/api`; stricter on auth and upload routes; skipped in test.
- **Input**: **sanitizeInput** and Zod validation in controllers; Prisma parameterizes queries.
- **Admin**: Admin routes use **admin.middleware** to require `req.user.role === ADMIN` (or MODERATOR where allowed). Audit log (AdminAuditLog) records admin actions.

Configuration is via environment variables; see **server/.env.example** and **docs/DEPLOYMENT.md**. Frontend only needs `VITE_API_URL` when the API is on a different origin.

---

## 7. Summary

| Layer | Responsibility |
|-------|----------------|
| **Client** | React SPA: auth in context, server state in TanStack Query, axios to `/api` with JWT. Routes and layout in App/Layout; game flow in GameView + game components. |
| **Server** | Express: middleware (security, auth, roles), then routes → controllers → services → Prisma. Single app; no separate “worker” process except the in-process timeout worker. |
| **DB** | PostgreSQL; Prisma for schema and access. Game state is in Game (phase, currentRound, currentAction), Round, Action, and related tables. |
| **Auth** | JWT in Authorization header; stored in localStorage on client; validated on each request; optional role middleware (game member, host, action initiator). |

For file-by-file navigation and “where to look for X”, use [PROJECT_REFERENCE.md](../PROJECT_REFERENCE.md). For API contracts, see [API.md](./API.md).
