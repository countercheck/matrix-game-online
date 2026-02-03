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
    { "name": "The Scholar", "description": "Knows ancient lore" }
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

## Webhooks & Polling

The API uses polling for real-time updates. Recommended intervals:
- Game state: 5 seconds
- Action details: 5 seconds
- Player list: 10 seconds
