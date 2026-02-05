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
Update game settings (host only, lobby status only).

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
  "actionDescription": "I attempt to pick the lock on the ancient door",
  "desiredOutcome": "The door opens revealing the treasure room",
  "initialArguments": [
    "I have lockpicking tools",
    "I've picked similar locks before"
  ]
}
```

---

## Actions

### GET /actions/:actionId
Get action details.

### POST /actions/:actionId/arguments
Add an argument to the current action.

**Request Body:**
```json
{
  "argumentType": "FOR",  // FOR, AGAINST, CLARIFICATION
  "content": "This should work because..."
}
```

### GET /actions/:actionId/arguments
Get all arguments for an action.

### POST /actions/:actionId/complete-argumentation
Mark argumentation as complete for current player.

### POST /actions/:actionId/votes
Submit a vote.

**Request Body:**
```json
{
  "voteType": "LIKELY_SUCCESS"  // LIKELY_SUCCESS, LIKELY_FAILURE, UNCERTAIN
}
```

**Vote Token Contribution:**
| Vote Type | Success Tokens | Failure Tokens |
|-----------|----------------|----------------|
| LIKELY_SUCCESS | 2 | 0 |
| LIKELY_FAILURE | 0 | 2 |
| UNCERTAIN | 1 | 1 |

### GET /actions/:actionId/votes
Get vote summary (individual votes hidden until resolution).

### POST /actions/:actionId/draw
Draw tokens to resolve the action (initiator only).

**Response:** `200 OK`
```json
{
  "success": true,
  "data": {
    "totalSuccessTokens": 5,
    "totalFailureTokens": 3,
    "drawnTokens": ["SUCCESS", "SUCCESS", "FAILURE"],
    "drawnSuccess": 2,
    "drawnFailure": 1,
    "resultValue": 1,
    "resultType": "SUCCESS_BUT"
  }
}
```

**Result Types:**
| Drawn | Result Value | Result Type |
|-------|--------------|-------------|
| SSS | +3 | TRIUMPH |
| SSF | +1 | SUCCESS_BUT |
| SFF | -1 | FAILURE_BUT |
| FFF | -3 | DISASTER |

### GET /actions/:actionId/draw
Get the token draw result.

### POST /actions/:actionId/narration
Submit narration for the action outcome (initiator only).

**Request Body:**
```json
{
  "content": "The lock clicks open, but as I push the door..."
}
```

### GET /actions/:actionId/narration
Get the narration for an action.

---

## Rounds

### GET /rounds/:roundId
Get round details.

### POST /rounds/:roundId/summary
Submit round summary (host only, when round complete).

**Request Body:**
```json
{
  "content": "This round saw significant progress...",
  "outcomes": {
    "key_events": ["Event 1", "Event 2"],
    "changes": ["Change 1"]
  }
}
```

### GET /rounds/:roundId/summary
Get the round summary.

---

## Error Responses

All errors follow this format:

```json
{
  "success": false,
  "error": {
    "code": "ERROR_CODE",
    "message": "Human-readable message"
  }
}
```

**Common Error Codes:**
| Code | HTTP Status | Description |
|------|-------------|-------------|
| `UNAUTHORIZED` | 401 | Missing or invalid token |
| `FORBIDDEN` | 403 | Not permitted to perform action |
| `NOT_FOUND` | 404 | Resource not found |
| `VALIDATION_ERROR` | 400 | Invalid request data |
| `CONFLICT` | 409 | Resource conflict (e.g., duplicate) |
| `RATE_LIMITED` | 429 | Too many requests |

---

## Rate Limits

| Endpoint | Limit |
|----------|-------|
| Auth endpoints | 5 requests per 15 minutes |
| General API | 100 requests per 15 minutes |

---

## Admin API

Admin endpoints require authentication with a user who has `MODERATOR` or `ADMIN` role.

### User Roles

| Role | Description |
|------|-------------|
| `USER` | Standard user (default) |
| `MODERATOR` | Can view users/games, ban/unban users, pause/resume games |
| `ADMIN` | Full access including role changes, game deletion, audit logs |

### Creating the First Admin

Use the CLI script to create or promote an admin:

```bash
# Create a new admin user
pnpm tsx server/scripts/create-admin.ts admin@example.com "Admin User" SecurePass123

# Promote an existing user to admin
pnpm tsx server/scripts/create-admin.ts existing@example.com
```

---

### GET /admin/dashboard
Get admin dashboard statistics. (Moderator+)

**Response:** `200 OK`
```json
{
  "success": true,
  "data": {
    "stats": {
      "totalUsers": 100,
      "bannedUsers": 5,
      "activeGames": 20,
      "completedGames": 50
    },
    "recentUsers": [...],
    "recentGames": [...]
  }
}
```

---

### GET /admin/users
List all users with pagination and filtering. (Moderator+)

**Query Parameters:**
| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `page` | number | 1 | Page number |
| `limit` | number | 20 | Items per page (max 100) |
| `search` | string | - | Search by email or display name |
| `role` | string | - | Filter by role: USER, MODERATOR, ADMIN |
| `isBanned` | boolean | - | Filter by ban status |
| `sortBy` | string | createdAt | Sort field: createdAt, lastLogin, displayName, email |
| `sortOrder` | string | desc | Sort order: asc, desc |

**Response:** `200 OK`
```json
{
  "success": true,
  "data": {
    "users": [
      {
        "id": "uuid",
        "email": "user@example.com",
        "displayName": "User",
        "role": "USER",
        "isBanned": false,
        "createdAt": "2024-01-01T00:00:00Z",
        "_count": { "gamePlayers": 5, "createdGames": 2 }
      }
    ],
    "pagination": {
      "page": 1,
      "limit": 20,
      "total": 100,
      "totalPages": 5
    }
  }
}
```

---

### GET /admin/users/:userId
Get detailed user information. (Moderator+)

**Response:** `200 OK`

---

### PUT /admin/users/:userId/role
Update a user's role. (Admin only)

**Request Body:**
```json
{
  "role": "MODERATOR"
}
```

**Note:** Cannot change your own role.

---

### POST /admin/users/:userId/ban
Ban a user. (Moderator+)

**Request Body:**
```json
{
  "reason": "Violation of terms of service"
}
```

**Notes:**
- Cannot ban yourself
- Cannot ban admin users
- Banned users receive 403 on all authenticated requests

---

### POST /admin/users/:userId/unban
Unban a user. (Moderator+)

---

### GET /admin/games
List all games with pagination and filtering. (Moderator+)

**Query Parameters:**
| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `page` | number | 1 | Page number |
| `limit` | number | 20 | Items per page (max 100) |
| `status` | string | - | Filter by status: LOBBY, ACTIVE, PAUSED, COMPLETED |
| `creatorId` | string | - | Filter by creator user ID |
| `search` | string | - | Search by game name |
| `sortBy` | string | createdAt | Sort field: createdAt, updatedAt, name, playerCount |
| `sortOrder` | string | desc | Sort order: asc, desc |

---

### GET /admin/games/:gameId
Get detailed game information. (Moderator+)

---

### DELETE /admin/games/:gameId
Delete a game and all related data. (Admin only)

---

### POST /admin/games/:gameId/pause
Pause an active game. (Moderator+)

---

### POST /admin/games/:gameId/resume
Resume a paused game. (Moderator+)

---

### POST /admin/games/:gameId/players/:playerId/remove
Remove a player from a game. (Moderator+)

---

### GET /admin/audit-logs
View admin action audit logs. (Admin only)

**Query Parameters:**
| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `page` | number | 1 | Page number |
| `limit` | number | 50 | Items per page (max 100) |
| `adminId` | string | - | Filter by admin user ID |
| `action` | string | - | Filter by action type |
| `targetType` | string | - | Filter by target type: USER, GAME, GAME_PLAYER |
| `targetId` | string | - | Filter by target ID |
| `startDate` | date | - | Filter from date |
| `endDate` | date | - | Filter to date |

**Response:** `200 OK`
```json
{
  "success": true,
  "data": {
    "logs": [
      {
        "id": "uuid",
        "action": "BAN_USER",
        "targetType": "USER",
        "targetId": "uuid",
        "details": { "reason": "...", "userEmail": "..." },
        "ipAddress": "127.0.0.1",
        "createdAt": "2024-01-01T00:00:00Z",
        "admin": { "id": "uuid", "email": "admin@example.com", "displayName": "Admin" }
      }
    ],
    "pagination": { ... }
  }
}
```

**Audit Actions:**
- `UPDATE_ROLE` - User role changed
- `BAN_USER` - User banned
- `UNBAN_USER` - User unbanned
- `DELETE_GAME` - Game deleted
- `PAUSE_GAME` - Game paused
- `RESUME_GAME` - Game resumed
- `REMOVE_PLAYER` - Player removed from game

---

## Webhooks & Polling

The API uses polling for real-time updates. Recommended intervals:
- Game state: 5 seconds
- Action details: 5 seconds
- Player list: 10 seconds
