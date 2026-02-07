# Plan: Game State YAML Export

## Overview

Add a new API endpoint and frontend button to export the complete state of a game as a downloadable YAML file. The export tells the "story" of the game when read top-to-bottom — game info, players, then rounds with their actions in chronological order.

## YAML Library Choice

**`yaml`** (npm package) — the modern, spec-compliant YAML 1.2 library. Better TypeScript support and more actively maintained than `js-yaml`. Small footprint, no dependencies.

## YAML Output Shape

```yaml
# Mosaic Matrix Game — State Export
exported_at: "2025-01-15T10:30:00.000Z"

game:
  name: "The Fall of Empires"
  description: "A story of political intrigue..."
  status: ACTIVE
  current_phase: ARGUMENTATION
  npc_momentum: -2
  settings:
    argument_limit: 3
    argumentation_timeout_hours: 24
    voting_timeout_hours: 24
    narration_mode: initiator_only
    personas_required: true
  created_at: "2025-01-10T..."
  started_at: "2025-01-10T..."

personas:
  - name: "The Chancellor"
    description: "A cunning political operator..."
    is_npc: false
    claimed_by: "Alice"
  - name: "The Shadow"
    description: "A mysterious force..."
    is_npc: true
    npc_action_description: "Undermines the ruling class..."
    npc_desired_outcome: "Chaos reigns..."

players:
  - player_name: "Alice"
    display_name: "alice123"
    persona: "The Chancellor"
    is_host: true
    is_npc: false
    join_order: 1
  - player_name: "Bob"
    display_name: "bob456"
    persona: null
    is_host: false
    is_npc: false
    join_order: 2

rounds:
  - round_number: 1
    status: COMPLETED
    actions:
      - sequence: 1
        initiator: "Alice"
        description: "Attempt to forge an alliance with..."
        desired_outcome: "The northern lords pledge..."
        status: NARRATED
        argumentation_skipped: false
        voting_skipped: false
        arguments:
          - player: "Alice"
            type: INITIATOR_FOR
            content: "The northern lords have long..."
          - player: "Bob"
            type: AGAINST
            content: "The alliance is doomed because..."
        votes:
          - player: "Bob"
            vote: LIKELY_FAILURE
            success_tokens: 0
            failure_tokens: 2
        token_draw:
          pool: { success: 1, failure: 3 }
          drawn: [FAILURE, SUCCESS, FAILURE]
          result: FAILURE_BUT  # (+1 = 1 success drawn)
          result_value: -1
        narration:
          author: "Alice"
          content: "The northern lords listened, but..."
    summary:
      author: "Alice"
      content: "Round 1 saw the beginning of..."
      outcomes:
        net_momentum: -1
        key_events: ["Alliance attempt failed"]
```

Key design decisions:
- **No internal IDs** — uses player names/persona names as references (human-readable)
- **Snake_case keys** — YAML convention, more readable than camelCase
- **Chronological ordering** — rounds → actions → arguments (by sequence)
- **Drawn tokens as array** — shows the actual draw sequence: `[FAILURE, SUCCESS, FAILURE]`
- **Strips sensitive data** — no emails, no password hashes, no user IDs
- **Includes computed data** — token pool totals, result type labels

## Implementation Steps

### 1. Install `yaml` package
```bash
cd server && pnpm add yaml
```

### 2. New service: `server/src/services/export.service.ts`

Single function `exportGameState(gameId, userId)` that:
- Validates game membership (reuse `requireMember` pattern)
- Does one deep Prisma query for the game with all nested relations
- Transforms the data into the clean export shape (strips IDs, maps names, snake_cases)
- Serializes to YAML string using `yaml.stringify()`
- Returns `{ yaml: string, filename: string }`

The Prisma query will include:
```
game → {
  personas (with claimedBy),
  players (with user, persona),
  rounds (ordered by roundNumber) → {
    actions (ordered by sequenceNumber) → {
      initiator (with user),
      arguments (ordered by sequence, with player),
      votes (with player),
      tokenDraw → { drawnTokens (ordered by drawSequence) },
      narration (with author)
    },
    summary (with author)
  }
}
```

### 3. New controller function in `server/src/controllers/game.controller.ts`

`exportGame()` handler that:
- Calls `exportService.exportGameState(gameId, userId)`
- Sets response headers for YAML download:
  - `Content-Type: text/yaml`
  - `Content-Disposition: attachment; filename="game-name-export-2025-01-15.yaml"`
- Sends the YAML string as the response body

### 4. New route in `server/src/routes/game.routes.ts`

```
GET /games/:gameId/export
```

Protected by `authenticateToken` middleware (same as all game routes).

### 5. Frontend: Export button in GameView sidebar

Add an "Export Game" button to the sidebar in `client/src/pages/GameView.tsx`. On click:
- Makes a GET request to `/games/:gameId/export`
- Creates a Blob from the response, triggers download via a temporary `<a>` tag
- Uses `responseType: 'blob'` on the axios request

Small, unobtrusive button — likely at the bottom of the sidebar, styled to match existing UI patterns.

### 6. Tests

**Unit test**: `server/tests/unit/services/export.service.test.ts`
- Mock the database, provide a full game fixture
- Verify the YAML output shape (parse it back and check structure)
- Verify sensitive data is stripped (no emails, IDs, password hashes)
- Verify correct ordering (rounds by number, actions by sequence)
- Verify non-members are rejected

**Integration test**: Add to existing `server/tests/integration/routes/game.routes.test.ts`
- Test the endpoint returns YAML with correct content-type
- Test 403 for non-members
- Test 404 for missing games

### 7. Documentation updates

Per CLAUDE.md rules:
- **`docs/API.md`** — Add the new `GET /games/:gameId/export` endpoint
- **`DEVELOPMENT_PLAN.md`** — Mark task complete if tracked

---

## Phase 2: Import Game from YAML

### Overview

Allow creating a new game from an exported YAML file. This acts as a **setup template** — it imports the game name, description, settings, and personas, then creates a fresh LOBBY game. All historical data (rounds, actions, votes, etc.) in the YAML is ignored.

This means users can:
- Export a completed game, tweak the personas/settings in a text editor, and start a new game from it
- Share game templates as YAML files
- Back up game configurations

### New endpoint

```
POST /games/import
```

- Protected by `authenticateToken`
- Accepts `Content-Type: text/yaml` or `multipart/form-data` (file upload)
- The requesting user becomes the host of the new game

### Import logic: `server/src/services/export.service.ts`

New function `importGameFromYaml(yamlString, userId)` that:
1. Parses the YAML string
2. Validates the required fields exist (`game.name`, `game.settings`)
3. Extracts only the template data:
   - `game.name` (appended with " (Copy)" to avoid confusion)
   - `game.description`
   - `game.settings`
   - `personas[]` (name, description, is_npc, npc_action_description, npc_desired_outcome)
4. Calls the existing `createGame()` service with the extracted data
5. Returns the new game

Key decisions:
- **Reuses `createGame()`** — no new database logic, just parsing + mapping
- **Validates with Zod** — parse YAML, then validate through existing `createGameSchema`
- **Ignores players/rounds/history** — clean LOBBY game, creator is auto-added as host
- **Appends " (Copy)"** to game name so it's clear it's derived from an export

### Frontend

Add an "Import Game" option on the dashboard/game list page:
- File upload input (accepts `.yaml`, `.yml`)
- Reads the file client-side, POSTs the content to `/games/import`
- On success, navigates to the new game's lobby

### Tests

**Unit test** additions to `server/tests/unit/services/export.service.test.ts`:
- Valid YAML creates a game with correct name, settings, personas
- Invalid YAML (missing required fields) returns validation error
- History data in YAML is ignored (rounds, actions, etc.)
- Name gets " (Copy)" suffix

**Integration test** additions:
- POST valid YAML → 201 with new game in LOBBY
- POST invalid YAML → 400
- POST without auth → 401

### Documentation

- **`docs/API.md`** — Add `POST /games/import` endpoint

## Files Changed (Both Phases)

| File | Change |
|------|--------|
| `server/package.json` | Add `yaml` dependency |
| `server/src/services/export.service.ts` | **New** — export + import logic |
| `server/src/controllers/game.controller.ts` | Add `exportGame` + `importGame` handlers |
| `server/src/routes/game.routes.ts` | Add GET export + POST import routes |
| `client/src/pages/GameView.tsx` | Add export button in sidebar |
| `client/src/pages/Dashboard.tsx` (or game list) | Add import button + file upload |
| `server/tests/unit/services/export.service.test.ts` | **New** — unit tests for both |
| `docs/API.md` | Document both new endpoints |
