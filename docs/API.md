# API Documentation

Base URL: `/api`

All endpoints except authentication require a valid JWT token in the `Authorization` header:
```
Authorization: Bearer <token>
```

---

## Authentication

### POST /auth/register
Create a new user account.

**Request Body:**
```json
{
  "email": "user@example.com",
  "password": "securePassword123",
  "displayName": "PlayerOne"
}
```

**Response:** `201 Created`
```json
{
  "success": true,
  "data": {
    "user": {
      "id": "uuid",
      "email": "user@example.com",
      "displayName": "PlayerOne"
    },
    "token": "jwt-token"
  }
}
```

### POST /auth/login
Authenticate and receive a token.

**Request Body:**
```json
{
  "email": "user@example.com",
  "password": "securePassword123"
}
```

**Response:** `200 OK`
```json
{
  "success": true,
  "data": {
    "user": { "id": "uuid", "email": "...", "displayName": "..." },
    "token": "jwt-token"
  }
}
```

### POST /auth/logout
Invalidate current session.

**Response:** `200 OK`

### POST /auth/refresh
Refresh an expiring token.

**Request Body:**
```json
{
  "token": "current-jwt-token"
}
```

**Response:** `200 OK`
```json
{
  "success": true,
  "data": { "token": "new-jwt-token" }
}
```

### POST /auth/forgot-password
Request a password reset email. Returns success even if email doesn't exist (prevents email enumeration).

**Request Body:**
```json
{
  "email": "user@example.com"
}
```

**Response:** `200 OK`
```json
{
  "success": true,
  "data": {
    "message": "If that email exists, a password reset link has been sent."
  }
}
```

### POST /auth/reset-password
Reset password using a valid reset token from email.

**Request Body:**
```json
{
  "token": "reset-token-from-email",
  "newPassword": "NewSecurePassword123"
}
```

**Response:** `200 OK`
```json
{
  "success": true,
  "data": {
    "message": "Password has been reset successfully"
  }
}
```

**Error Responses:**
- `400 Bad Request` - Invalid or expired token
- `400 Bad Request` - Password doesn't meet requirements (min 8 chars, uppercase, lowercase, number)

---

## Users

### GET /users/me
Get current user's profile.

**Response:** `200 OK`
```json
{
  "success": true,
  "data": {
    "id": "uuid",
    "email": "user@example.com",
    "displayName": "PlayerOne",
    "avatarUrl": null,
    "notificationPreferences": {}
  }
}
```

### PUT /users/me
Update current user's profile.

**Request Body:**
```json
{
  "displayName": "NewName",
  "avatarUrl": "https://..."
}
```

### GET /users/me/games
Get all games the current user is participating in.

**Response:** `200 OK`
```json
{
  "success": true,
  "data": [
    {
      "id": "uuid",
      "name": "Game Name",
      "status": "ACTIVE",
      "currentPhase": "PROPOSAL",
      "playerCount": 4
    }
  ]
}
```

### PUT /users/me/notifications
Update notification preferences.

**Request Body:**
```json
{
  "emailOnActionProposed": true,
  "emailOnVotingStart": true,
  "emailOnResolution": false
}
```

---

## Games

### POST /games
Create a new game.

**Request Body:**
```json
{
  "name": "My Game",
  "description": "Optional description",
  "playerName": "HostPlayer",
  "settings": {
    "maxPlayers": 6,
    "argumentationTimeoutHours": 24,
    "votingTimeoutHours": 24,
    "personasRequired": false
  },
  "personas": [
    { "name": "The Detective", "description": "Investigates mysteries" },
    { "name": "The Scholar", "description": "Knows ancient lore" },
    {
      "name": "The Dragon",
      "description": "A fearsome beast threatening the realm",
      "isNpc": true,
      "npcActionDescription": "The dragon attacks the village",
      "npcDesiredOutcome": "The village suffers significant losses"
    }
  ]
}
```

**Response:** `201 Created`
```json
{
  "success": true,
  "data": {
    "id": "uuid",
    "name": "My Game",
    "status": "LOBBY",
    "inviteCode": "ABC123"
  }
}
```

---

### POST /games/:gameId/image
Upload an image for a game. Only the game creator can upload images.

**Request:**
- Content-Type: `multipart/form-data`
- Body: Form data with `image` field containing the image file

**Constraints:**
- Maximum file size: 5MB
- Allowed formats: JPEG, JPG, PNG, GIF, WebP

**Response:** `200 OK`
```json
{
  "success": true,
  "data": {
    "imageUrl": "http://localhost:3000/uploads/image-1234567890-123456789.jpg",
    "game": {
      "id": "uuid",
      "name": "My Game",
      "imageUrl": "http://localhost:3000/uploads/image-1234567890-123456789.jpg",
      "status": "LOBBY",
      "currentPhase": "WAITING"
    }
  }
}
```

**Errors:**
- `400 Bad Request` - No file uploaded or invalid file type/size
- `403 Forbidden` - User is not the game creator
- `404 Not Found` - Game not found

---

### GET /games/:gameId
Get game details.

**Response:** `200 OK`
```json
{
  "success": true,
  "data": {
    "id": "uuid",
    "name": "My Game",
    "status": "ACTIVE",
    "currentPhase": "ARGUMENTATION",
    "npcMomentum": 3,
    "currentRound": { "id": "uuid", "roundNumber": 1 },
    "currentAction": { "id": "uuid", "actionDescription": "..." },
    "players": [...],
    "personas": [...]
  }
}
```

### PUT /games/:gameId
Update game name/description (host only). Can be used at any time, including during active gameplay.

### DELETE /games/:gameId
Delete a game (host only, lobby status only). This performs a soft delete by marking the game as deleted while preserving the data.

**Response:** `200 OK`
```json
{
  "success": true,
  "data": {
    "message": "Game deleted successfully"
  }
}
```

**Error Responses:**
- `403 Forbidden` - Not the game host
- `400 Bad Request` - Game has already started (status is not LOBBY)
- `404 Not Found` - Game not found or already deleted

### POST /games/:gameId/join
Join a game.

**Request Body:**
```json
{
  "playerName": "NewPlayer",
  "personaId": "uuid"  // optional
}
```

### POST /games/:gameId/select-persona
Select or change persona (lobby only).

**Request Body:**
```json
{
  "personaId": "uuid"  // or null to deselect
}
```

**Note:** NPC personas (`isNpc: true`) cannot be selected by players. They are automatically assigned to an NPC player when the game starts.

#### NPC Personas

When a persona is marked as `isNpc: true`, the system:
1. Creates an NPC player automatically when the game starts using a dedicated NPC system user
2. The NPC always proposes last each round
3. Uses the scripted `npcActionDescription` and `npcDesiredOutcome` for proposals
4. Tracks cumulative success/failure in `game.npcMomentum` (sum of all NPC action result values)
5. NPC does not participate in argumentation or voting
6. Any player can draw tokens and narrate NPC actions

**Note:** The NPC system user must be seeded in the database before games with NPC personas can be started. Run `pnpm db:seed` to create the NPC user.

### PUT /games/:gameId/personas/:personaId
Update a persona's details (host only). Can be used at any time, including during active gameplay.

**Request Body:**
```json
{
  "name": "Updated Persona Name",
  "description": "Updated persona description in markdown",
  "npcActionDescription": "Updated NPC action description (NPC personas only)",
  "npcDesiredOutcome": "Updated NPC desired outcome (NPC personas only)"
}
```

**Notes:**
- All fields are optional - only include fields you want to update
- `name` must be unique within the game (max 50 characters)
- `description` max 1800 characters (supports markdown)
- `npcActionDescription` and `npcDesiredOutcome` only apply to NPC personas
- Send empty string or null to clear a description field

**Response:** `200 OK`
```json
{
  "success": true,
  "data": {
    "id": "uuid",
    "gameId": "uuid",
    "name": "Updated Persona Name",
    "description": "Updated persona description",
    "isNpc": false,
    "npcActionDescription": null,
    "npcDesiredOutcome": null,
    "sortOrder": 0,
    "createdAt": "2024-01-15T10:00:00.000Z"
  }
}
```

**Error Responses:**
- `400 Bad Request` - Validation failed
- `403 Forbidden` - Not the game host
- `404 Not Found` - Game or persona not found
- `409 Conflict` - Persona name already exists in this game

### POST /games/:gameId/leave
Leave a game (lobby only).

### POST /games/:gameId/start
Start the game (host only, minimum 2 players).

**Response:** `200 OK`
```json
{
  "success": true,
  "data": {
    "status": "ACTIVE",
    "currentPhase": "PROPOSAL",
    "currentRound": { "id": "uuid", "roundNumber": 1 }
  }
}
```

### GET /games/:gameId/players
Get list of players in the game.

### GET /games/:gameId/history
Get complete action history for the game.

### GET /games/:gameId/rounds
Get all rounds for the game.

### POST /games/:gameId/actions
Propose a new action (one per player per round).

**Request Body:**
```json
{

---

## Host Edit Endpoints

These endpoints allow the game host to edit any content at any point during the game. All edits are logged as GameEvents for audit trail.

### PUT /actions/:actionId
Update an action's description or desired outcome (host only).

**Request Body:**
```json
{
  "actionDescription": "Updated action description",
  "desiredOutcome": "Updated desired outcome"
}
```

**Notes:**
- At least one field must be provided
- `actionDescription` max 1800 characters
- `desiredOutcome` max 1200 characters

**Response:** `200 OK`
```json
{
  "success": true,
  "data": { "id": "uuid", "actionDescription": "...", "desiredOutcome": "..." }
}
```

**Errors:** `403 Forbidden` (not host), `404 Not Found`

### PUT /actions/:actionId/arguments/:argumentId
Update an argument's content (host only).

**Request Body:**
```json
{
  "content": "Updated argument content"
}
```

**Notes:** `content` max 900 characters.

**Response:** `200 OK`

**Errors:** `403 Forbidden` (not host), `404 Not Found`

### PUT /actions/:actionId/narration
Update a narration's content (host only).

**Request Body:**
```json
{
  "content": "Updated narration content"
}
```

**Notes:** `content` max 3600 characters.

**Response:** `200 OK`

**Errors:** `403 Forbidden` (not host), `404 Not Found`

### PUT /rounds/:roundId/summary
Update a round summary's content (host only).

**Request Body:**
```json
{
  "content": "Updated round summary content"
}
```

**Notes:** `content` max 7500 characters.

**Response:** `200 OK`

**Errors:** `403 Forbidden` (not host), `404 Not Found`

---

### GET /games/:gameId/export
Export the full game state as a downloadable YAML file. Includes game info, personas, players, and complete round/action history.

**Response:** `200 OK` (Content-Type: `text/yaml`)

Returns a YAML file as an attachment. The filename is derived from the game name and current date, e.g. `my-game-export-2025-01-15.yaml`.

**Errors:**
- `403 Forbidden` - Not a member of the game
- `404 Not Found` - Game not found

---

### POST /games/import
Create a new game from an exported YAML file. Imports game name, description, settings, and personas as a fresh LOBBY game. Historical data (rounds, actions, etc.) is ignored. The game name is appended with " (Copy)".

**Request:**
- Content-Type: `text/yaml` (raw YAML body) or `application/json` with `{ "yaml": "..." }`

**Response:** `201 Created`
```json
{
  "success": true,
  "data": {
    "id": "uuid",
    "name": "Original Name (Copy)",
    "status": "LOBBY"
  }
}
```

**Errors:**
- `400 Bad Request` - Invalid YAML or missing required fields
- `401 Unauthorized` - Not authenticated

---

