# Technical Specification
## Mosaic Strict Matrix Game - Web Application v1.0

**Document Version:** 1.0  
**Last Updated:** January 31, 2026  
**Technical Lead:** [Your Name]

---

## 1. Architecture Overview

### 1.1 System Architecture

**Architecture Pattern:** Three-tier web application with RESTful API

```
┌─────────────────────────────────────────────────────────┐
│                    CLIENT TIER                          │
│  ┌──────────────────────────────────────────────────┐  │
│  │   Web Browser (React SPA)                        │  │
│  │   - UI Components                                │  │
│  │   - State Management (React Query)               │  │
│  │   - Routing (React Router)                       │  │
│  └──────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────┘
                          ↕ HTTPS/REST
┌─────────────────────────────────────────────────────────┐
│                  APPLICATION TIER                       │
│  ┌──────────────────────────────────────────────────┐  │
│  │   API Server (Node.js/Express)                   │  │
│  │   - REST API Endpoints                           │  │
│  │   - Authentication & Authorization               │  │
│  │   - Business Logic                               │  │
│  │   - Game State Management                        │  │
│  └──────────────────────────────────────────────────┘  │
│  ┌──────────────────────────────────────────────────┐  │
│  │   Background Workers                              │  │
│  │   - Email Service                                │  │
│  │   - Timeout Processing                           │  │
│  │   - Cleanup Jobs                                 │  │
│  └──────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────┘
                          ↕ SQL
┌─────────────────────────────────────────────────────────┐
│                     DATA TIER                           │
│  ┌──────────────────────────────────────────────────┐  │
│  │   PostgreSQL Database                            │  │
│  │   - User data                                    │  │
│  │   - Game state                                   │  │
│  │   - Action history                               │  │
│  └──────────────────────────────────────────────────┘  │
│  ┌──────────────────────────────────────────────────┐  │
│  │   Redis Cache (Optional)                         │  │
│  │   - Session storage                              │  │
│  │   - Rate limiting                                │  │
│  └──────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────┘
```

### 1.2 Technology Stack

**Frontend:**
- Framework: React 18+ (with TypeScript)
- Build Tool: Vite
- State Management: React Query (TanStack Query)
- Routing: React Router v6
- UI Library: Tailwind CSS + Radix UI or shadcn/ui
- Form Handling: React Hook Form + Zod
- HTTP Client: Axios

**Backend:**
- Runtime: Node.js 20 LTS
- Framework: Express.js 4.x
- Language: TypeScript
- Validation: Zod
- ORM: Prisma or Drizzle ORM
- Authentication: JWT (jsonwebtoken)
- Email: Nodemailer + SendGrid/AWS SES

**Database:**
- Primary: PostgreSQL 14+
- Cache: Redis 7+ (optional for v1, recommended for production)

**DevOps:**
- Hosting: Railway, Render, or AWS (EC2 + RDS)
- CI/CD: GitHub Actions
- Containerization: Docker + Docker Compose
- Monitoring: Sentry (errors), LogTail (logs)

**Development:**
- Version Control: Git + GitHub
- Package Manager: pnpm
- Code Quality: ESLint, Prettier
- Testing: Vitest (unit), Playwright (e2e)

---

## 2. Frontend Architecture

### 2.1 Component Structure

```
src/
├── components/
│   ├── ui/                    # Reusable UI components
│   │   ├── Button.tsx
│   │   ├── Card.tsx
│   │   ├── Input.tsx
│   │   └── ...
│   ├── game/                  # Game-specific components
│   │   ├── ActionProposal.tsx
│   │   ├── ArgumentList.tsx
│   │   ├── VotingPanel.tsx
│   │   ├── TokenDraw.tsx
│   │   ├── NarrationForm.tsx
│   │   ├── RoundSummaryForm.tsx
│   │   ├── RoundStatus.tsx
│   │   ├── RoundHistory.tsx
│   │   ├── GameHistory.tsx
│   │   └── PhaseIndicator.tsx
│   ├── layout/                # Layout components
│   │   ├── Header.tsx
│   │   ├── Sidebar.tsx
│   │   └── Footer.tsx
│   └── common/                # Common components
│       ├── LoadingSpinner.tsx
│       ├── ErrorBoundary.tsx
│       └── NotificationBanner.tsx
├── pages/
│   ├── Dashboard.tsx
│   ├── GameLobby.tsx
│   ├── GameView.tsx
│   ├── Login.tsx
│   ├── Register.tsx
│   └── Profile.tsx
├── hooks/
│   ├── useAuth.ts
│   ├── useGame.ts
│   ├── useAction.ts
│   └── useNotifications.ts
├── services/
│   ├── api.ts                 # API client
│   ├── auth.ts                # Auth service
│   └── websocket.ts           # Future: WebSocket (v2)
├── types/
│   ├── game.ts
│   ├── user.ts
│   └── api.ts
├── utils/
│   ├── validation.ts
│   ├── formatters.ts
│   └── constants.ts
├── App.tsx
└── main.tsx
```

### 2.2 State Management Strategy

**React Query for Server State:**
- All API data fetched via React Query
- Automatic caching, refetching, and invalidation
- Optimistic updates for better UX

**Context API for Global UI State:**
- Auth context (user, login/logout)
- Theme context (optional)
- Notification context

**Local State (useState):**
- Form inputs
- UI toggles (modals, dropdowns)
- Ephemeral state

**Example React Query Hook:**

```typescript
// hooks/useAction.ts
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../services/api';

export function useAction(actionId: string) {
  return useQuery({
    queryKey: ['action', actionId],
    queryFn: () => api.getAction(actionId),
    refetchInterval: 5000, // Poll every 5s for updates
  });
}

export function useSubmitVote() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: (data: VoteSubmission) => api.submitVote(data),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries(['action', variables.actionId]);
      queryClient.invalidateQueries(['game', variables.gameId]);
    },
  });
}
```

### 2.3 Routing Structure

```typescript
// App.tsx routes
const router = createBrowserRouter([
  {
    path: '/',
    element: <Layout />,
    children: [
      { index: true, element: <Dashboard /> },
      { path: 'login', element: <Login /> },
      { path: 'register', element: <Register /> },
      { path: 'profile', element: <Profile /> },
    ],
  },
  {
    path: '/game/:gameId',
    element: <GameLayout />,
    children: [
      { path: 'lobby', element: <GameLobby /> },
      { path: 'play', element: <GameView /> },
    ],
  },
]);
```

### 2.4 Key Frontend Components

#### ActionProposal Component

```typescript
interface ActionProposalProps {
  gameId: string;
  onSubmit: (data: ActionProposalData) => void;
}

function ActionProposal({ gameId, onSubmit }: ActionProposalProps) {
  const { control, handleSubmit } = useForm<ActionProposalData>({
    resolver: zodResolver(actionProposalSchema),
  });

  return (
    <form onSubmit={handleSubmit(onSubmit)}>
      <Controller
        name="actionDescription"
        control={control}
        render={({ field }) => (
          <Textarea
            {...field}
            label="What action is being taken?"
            maxLength={500}
          />
        )}
      />
      {/* More fields... */}
      <Button type="submit">Propose Action</Button>
    </form>
  );
}
```

#### VotingPanel Component

```typescript
interface VotingPanelProps {
  actionId: string;
  onVote: (voteType: VoteType) => void;
}

function VotingPanel({ actionId, onVote }: VotingPanelProps) {
  const { data: action } = useAction(actionId);
  const [selectedVote, setSelectedVote] = useState<VoteType | null>(null);

  return (
    <div className="voting-panel">
      <h3>Vote on Likelihood of Success</h3>
      <div className="vote-options">
        <VoteButton
          type="LIKELY_SUCCESS"
          selected={selectedVote === 'LIKELY_SUCCESS'}
          onClick={() => setSelectedVote('LIKELY_SUCCESS')}
        >
          <TokenIcon type="success" count={2} />
          Likely Success
        </VoteButton>
        {/* Other vote buttons... */}
      </div>
      <Button
        onClick={() => selectedVote && onVote(selectedVote)}
        disabled={!selectedVote}
      >
        Submit Vote
      </Button>
    </div>
  );
}
```

---

## 3. Backend Architecture

### 3.1 API Structure

```
server/
├── src/
│   ├── routes/
│   │   ├── auth.routes.ts
│   │   ├── users.routes.ts
│   │   ├── games.routes.ts
│   │   ├── actions.routes.ts
│   │   ├── arguments.routes.ts
│   │   ├── votes.routes.ts
│   │   └── narrations.routes.ts
│   ├── controllers/
│   │   ├── auth.controller.ts
│   │   ├── games.controller.ts
│   │   ├── actions.controller.ts
│   │   └── ...
│   ├── services/
│   │   ├── auth.service.ts
│   │   ├── game.service.ts
│   │   ├── round.service.ts        # Round management logic
│   │   ├── action.service.ts
│   │   ├── token.service.ts       # Token drawing logic
│   │   ├── notification.service.ts
│   │   └── email.service.ts
│   ├── middleware/
│   │   ├── auth.middleware.ts
│   │   ├── validation.middleware.ts
│   │   ├── errorHandler.middleware.ts
│   │   └── rateLimit.middleware.ts
│   ├── models/                     # Prisma schema
│   │   └── schema.prisma
│   ├── utils/
│   │   ├── crypto.ts               # RNG utilities
│   │   ├── logger.ts
│   │   └── validators.ts
│   ├── types/
│   │   ├── express.d.ts
│   │   └── models.ts
│   ├── config/
│   │   ├── database.ts
│   │   ├── email.ts
│   │   └── app.ts
│   ├── workers/
│   │   ├── timeout.worker.ts       # Handle phase timeouts
│   │   └── cleanup.worker.ts
│   └── index.ts
├── prisma/
│   ├── schema.prisma
│   └── migrations/
├── tests/
│   ├── unit/
│   └── integration/
├── package.json
└── tsconfig.json
```

### 3.2 API Endpoints

#### Authentication Endpoints

```
POST   /api/auth/register          Create new user account
POST   /api/auth/login             Login user
POST   /api/auth/logout            Logout user
POST   /api/auth/refresh           Refresh JWT token
POST   /api/auth/forgot-password   Request password reset
POST   /api/auth/reset-password    Reset password with token
GET    /api/auth/verify-email      Verify email address
```

#### User Endpoints

```
GET    /api/users/me               Get current user profile
PUT    /api/users/me               Update user profile
GET    /api/users/me/games         Get user's games
PUT    /api/users/me/notifications Update notification preferences
```

#### Game Endpoints

```
POST   /api/games                  Create new game
GET    /api/games/:gameId          Get game details
PUT    /api/games/:gameId          Update game settings
DELETE /api/games/:gameId          Delete game (if allowed)
POST   /api/games/:gameId/join     Join game
POST   /api/games/:gameId/leave    Leave game
POST   /api/games/:gameId/start    Start game (host only)
GET    /api/games/:gameId/players  Get players in game
GET    /api/games/:gameId/history  Get action history
GET    /api/games/:gameId/events   Get game event log
GET    /api/games/:gameId/rounds   Get all rounds
GET    /api/games/:gameId/rounds/:roundId  Get specific round
```

#### Round Endpoints

```
GET    /api/rounds/:roundId                 Get round details
GET    /api/rounds/:roundId/actions         Get all actions in round
POST   /api/rounds/:roundId/summary         Submit round summary
GET    /api/rounds/:roundId/summary         Get round summary
GET    /api/rounds/:roundId/eligible-players Get players who can still propose
```

#### Action Endpoints

```
POST   /api/games/:gameId/actions              Create action proposal
GET    /api/games/:gameId/actions/:actionId    Get action details
PUT    /api/games/:gameId/actions/:actionId    Update action (limited)
POST   /api/actions/:actionId/arguments        Add argument
GET    /api/actions/:actionId/arguments        Get all arguments
POST   /api/actions/:actionId/votes            Submit vote
GET    /api/actions/:actionId/votes            Get vote summary
POST   /api/actions/:actionId/draw             Draw tokens (initiator)
GET    /api/actions/:actionId/draw             Get draw results
POST   /api/actions/:actionId/narration        Submit narration
GET    /api/actions/:actionId/narration        Get narration
```

### 3.3 API Response Format

**Success Response:**
```typescript
{
  success: true,
  data: {
    // Response payload
  },
  meta?: {
    // Pagination, etc.
  }
}
```

**Error Response:**
```typescript
{
  success: false,
  error: {
    code: 'VALIDATION_ERROR',
    message: 'Invalid input data',
    details?: {
      // Field-specific errors
    }
  }
}
```

**Example Endpoint Implementation:**

```typescript
// controllers/actions.controller.ts
export async function proposeAction(req: Request, res: Response) {
  try {
    const { gameId } = req.params;
    const userId = req.user!.id; // From auth middleware
    const actionData = req.body;

    // Validate
    const validated = actionProposalSchema.parse(actionData);

    // Check game state
    const game = await gameService.getGame(gameId);
    if (game.currentPhase !== 'PROPOSAL') {
      throw new BadRequestError('Game is not in proposal phase');
    }

    // Create action
    const action = await actionService.createAction({
      gameId,
      initiatorId: userId,
      ...validated,
    });

    // Transition to argumentation
    await gameService.updatePhase(gameId, 'ARGUMENTATION');

    // Send notifications
    await notificationService.notifyPlayersArgumentationStarted(gameId, action.id);

    res.json({
      success: true,
      data: action,
    });
  } catch (error) {
    next(error);
  }
}
```

### 3.4 Authentication & Authorization

**JWT Token Strategy:**

```typescript
// middleware/auth.middleware.ts
export async function authenticateToken(
  req: Request,
  res: Response,
  next: NextFunction
) {
  const token = req.headers.authorization?.split(' ')[1];
  
  if (!token) {
    throw new UnauthorizedError('No token provided');
  }

  try {
    const payload = jwt.verify(token, config.jwtSecret) as JWTPayload;
    const user = await userService.findById(payload.userId);
    
    if (!user) {
      throw new UnauthorizedError('User not found');
    }

    req.user = user;
    next();
  } catch (error) {
    throw new UnauthorizedError('Invalid token');
  }
}

// Authorization middleware
export function requireGameMembership(
  req: Request,
  res: Response,
  next: NextFunction
) {
  const { gameId } = req.params;
  const userId = req.user!.id;

  const isMember = await gameService.isPlayerInGame(gameId, userId);
  
  if (!isMember) {
    throw new ForbiddenError('Not a member of this game');
  }

  next();
}
```

**Password Hashing:**

```typescript
// services/auth.service.ts
import bcrypt from 'bcrypt';

const SALT_ROUNDS = 12;

export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, SALT_ROUNDS);
}

export async function verifyPassword(
  password: string,
  hash: string
): Promise<boolean> {
  return bcrypt.compare(password, hash);
}
```

### 3.5 Token Drawing Algorithm

**Cryptographically Secure Randomness:**

```typescript
// services/token.service.ts
import { randomBytes } from 'crypto';

interface TokenPool {
  successTokens: number;
  failureTokens: number;
}

interface DrawResult {
  drawnSuccess: number;
  drawnFailure: number;
  resultValue: number;
  resultType: 'TRIUMPH' | 'SUCCESS_BUT' | 'FAILURE_BUT' | 'DISASTER';
  seed: string;
}

export async function drawTokens(pool: TokenPool): Promise<DrawResult> {
  // Generate random seed for auditability
  const seed = randomBytes(32).toString('hex');
  
  // Create array representing token pool
  const tokens: ('S' | 'F')[] = [
    ...Array(pool.successTokens).fill('S'),
    ...Array(pool.failureTokens).fill('F'),
  ];
  
  // Fisher-Yates shuffle with crypto randomness
  for (let i = tokens.length - 1; i > 0; i--) {
    const j = getSecureRandomInt(0, i + 1);
    [tokens[i], tokens[j]] = [tokens[j], tokens[i]];
  }
  
  // Draw first 3 tokens
  const drawn = tokens.slice(0, 3);
  const drawnSuccess = drawn.filter(t => t === 'S').length;
  const drawnFailure = 3 - drawnSuccess;
  
  // Calculate result
  const resultValue = (drawnSuccess * 2) - 3; // Maps to -3, -1, +1, +3
  const resultType = getResultType(drawnSuccess, drawnFailure);
  
  return {
    drawnSuccess,
    drawnFailure,
    resultValue,
    resultType,
    seed,
  };
}

function getSecureRandomInt(min: number, max: number): number {
  const range = max - min + 1;
  const bytesNeeded = Math.ceil(Math.log2(range) / 8);
  const maxValid = Math.floor(256 ** bytesNeeded / range) * range - 1;
  
  let randomInt;
  do {
    const randomBytes = crypto.randomBytes(bytesNeeded);
    randomInt = randomBytes.readUIntBE(0, bytesNeeded);
  } while (randomInt > maxValid);
  
  return min + (randomInt % range);
}

function getResultType(success: number, failure: number): DrawResult['resultType'] {
  if (success === 3) return 'TRIUMPH';
  if (success === 2) return 'SUCCESS_BUT';
  if (success === 1) return 'FAILURE_BUT';
  return 'DISASTER';
}
```

### 3.6 Game State Machine

**State Transitions:**

```typescript
// services/game.service.ts
type GamePhase = 
  | 'WAITING'
  | 'PROPOSAL' 
  | 'ARGUMENTATION'
  | 'VOTING'
  | 'RESOLUTION'
  | 'NARRATION'
  | 'ROUND_SUMMARY';

const VALID_TRANSITIONS: Record<GamePhase, GamePhase[]> = {
  WAITING: ['PROPOSAL'],
  PROPOSAL: ['ARGUMENTATION'],
  ARGUMENTATION: ['VOTING'],
  VOTING: ['RESOLUTION'],
  RESOLUTION: ['NARRATION'],
  NARRATION: ['PROPOSAL', 'ROUND_SUMMARY'], // Can go back to proposal or to round summary
  ROUND_SUMMARY: ['PROPOSAL'], // After summary, start new round
};

export async function transitionPhase(
  gameId: string,
  newPhase: GamePhase
): Promise<void> {
  const game = await db.game.findUnique({ where: { id: gameId } });
  
  if (!game) {
    throw new NotFoundError('Game not found');
  }
  
  // Validate transition
  const validNextPhases = VALID_TRANSITIONS[game.currentPhase];
  if (!validNextPhases.includes(newPhase)) {
    throw new BadRequestError(
      `Cannot transition from ${game.currentPhase} to ${newPhase}`
    );
  }
  
  // Update game
  await db.game.update({
    where: { id: gameId },
    data: { 
      currentPhase: newPhase,
      updatedAt: new Date(),
    },
  });
  
  // Log event
  await logGameEvent(gameId, 'PHASE_CHANGED', {
    from: game.currentPhase,
    to: newPhase,
  });
  
  // Handle phase-specific logic
  await handlePhaseTransition(gameId, newPhase);
}

async function handlePhaseTransition(
  gameId: string,
  phase: GamePhase
): Promise<void> {
  switch (phase) {
    case 'ARGUMENTATION':
      await scheduleTimeout(gameId, 'ARGUMENTATION', 24 * 60 * 60 * 1000);
      await notificationService.notifyArgumentationPhase(gameId);
      break;
    case 'VOTING':
      await scheduleTimeout(gameId, 'VOTING', 24 * 60 * 60 * 1000);
      await notificationService.notifyVotingPhase(gameId);
      break;
    case 'RESOLUTION':
      await notificationService.notifyResolutionPhase(gameId);
      break;
    // ... other phases
  }
}
```

### 3.7 Timeout Processing

**Background Worker:**

```typescript
// workers/timeout.worker.ts
import { CronJob } from 'cron';

// Run every 5 minutes
export const timeoutWorker = new CronJob('*/5 * * * *', async () => {
  console.log('Checking for timed-out phases...');
  
  const now = new Date();
  const timeoutThreshold = 24 * 60 * 60 * 1000; // 24 hours
  
  // Find actions in argumentation that timed out
  const timedOutArgumentation = await db.action.findMany({
    where: {
      status: 'ARGUING',
      argumentationStartedAt: {
        lt: new Date(now.getTime() - timeoutThreshold),
      },
    },
    include: { game: true },
  });
  
  for (const action of timedOutArgumentation) {
    await handleArgumentationTimeout(action);
  }
  
  // Find actions in voting that timed out
  const timedOutVoting = await db.action.findMany({
    where: {
      status: 'VOTING',
      votingStartedAt: {
        lt: new Date(now.getTime() - timeoutThreshold),
      },
    },
    include: { game: true },
  });
  
  for (const action of timedOutVoting) {
    await handleVotingTimeout(action);
  }
});

async function handleArgumentationTimeout(action: Action): Promise<void> {
  // Players who haven't marked argumentation complete just proceed
  await gameService.transitionPhase(action.gameId, 'VOTING');
  await logGameEvent(action.gameId, 'TIMEOUT_TRIGGERED', {
    phase: 'ARGUMENTATION',
    actionId: action.id,
  });
}

async function handleVotingTimeout(action: Action): Promise<void> {
  // Get all players who haven't voted
  const game = await db.game.findUnique({
    where: { id: action.gameId },
    include: { players: true },
  });
  
  const votes = await db.vote.findMany({
    where: { actionId: action.id },
  });
  
  const votedPlayerIds = votes.map(v => v.playerId);
  const missingPlayers = game.players.filter(
    p => !votedPlayerIds.includes(p.id)
  );
  
  // Cast default "UNCERTAIN" votes for missing players
  for (const player of missingPlayers) {
    await db.vote.create({
      data: {
        actionId: action.id,
        playerId: player.id,
        voteType: 'UNCERTAIN',
        successTokens: 1,
        failureTokens: 1,
      },
    });
  }
  
  // Transition to resolution
  await gameService.transitionPhase(action.gameId, 'RESOLUTION');
  await logGameEvent(action.gameId, 'TIMEOUT_TRIGGERED', {
    phase: 'VOTING',
    actionId: action.id,
    defaultVotes: missingPlayers.length,
  });
}
```

### 3.8 Email Notifications

```typescript
// services/email.service.ts
import nodemailer from 'nodemailer';

const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST,
  port: parseInt(process.env.SMTP_PORT || '587'),
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS,
  },
});

export async function sendActionRequiredEmail(
  user: User,
  game: Game,
  actionType: string
): Promise<void> {
  const emailBody = `
    Hi ${user.displayName},
    
    It's your turn in "${game.name}"!
    
    Action required: ${actionType}
    
    Click here to continue: ${process.env.APP_URL}/game/${game.id}/play
    
    Happy gaming!
  `;
  
  await transporter.sendMail({
    from: process.env.EMAIL_FROM,
    to: user.email,
    subject: `Your turn in ${game.name}`,
    text: emailBody,
    html: emailBody.replace(/\n/g, '<br>'),
  });
}

// Batch notifications
export async function notifyPlayersArgumentationStarted(
  gameId: string,
  actionId: string
): Promise<void> {
  const game = await db.game.findUnique({
    where: { id: gameId },
    include: { 
      players: { 
        where: { isActive: true },
        include: { user: true },
      },
    },
  });
  
  const action = await db.action.findUnique({
    where: { id: actionId },
  });
  
  for (const player of game.players) {
    if (player.user.notificationPreferences.email !== false) {
      await sendActionRequiredEmail(
        player.user,
        game,
        'Add arguments for or against the proposed action'
      );
    }
  }
}
```

---

## 4. Data Validation

### 4.1 Validation Schemas (Zod)

```typescript
// utils/validators.ts
import { z } from 'zod';

export const createGameSchema = z.object({
  name: z.string().min(1).max(100),
  description: z.string().max(1000).optional(),
  settings: z.object({
    argumentLimit: z.number().int().min(1).max(10).default(3),
    argumentationTimeoutHours: z.number().int().min(1).max(72).default(24),
    votingTimeoutHours: z.number().int().min(1).max(72).default(24),
    narrationMode: z.enum(['initiator_only', 'collaborative']).default('initiator_only'),
  }).optional(),
});

export const actionProposalSchema = z.object({
  actionDescription: z.string().min(1).max(500),
  desiredOutcome: z.string().min(1).max(300),
  initialArguments: z.array(
    z.string().min(1).max(200)
  ).min(1).max(3),
});

export const argumentSchema = z.object({
  argumentType: z.enum(['FOR', 'AGAINST', 'CLARIFICATION']),
  content: z.string().min(1).max(200),
});

export const voteSchema = z.object({
  voteType: z.enum(['LIKELY_SUCCESS', 'LIKELY_FAILURE', 'UNCERTAIN']),
});

export const narrationSchema = z.object({
  content: z.string().min(1).max(1000),
});

export const roundSummarySchema = z.object({
  content: z.string().min(1).max(2000),
  outcomes: z.object({
    totalTriumphs: z.number().int().min(0).optional(),
    totalDisasters: z.number().int().min(0).optional(),
    netMomentum: z.number().int().optional(),
    keyEvents: z.array(z.string()).max(10).optional(),
  }).optional(),
});

// Validation middleware
export function validateRequest(schema: z.ZodSchema) {
  return (req: Request, res: Response, next: NextFunction) => {
    try {
      schema.parse(req.body);
      next();
    } catch (error) {
      if (error instanceof z.ZodError) {
        throw new ValidationError('Invalid request data', error.errors);
      }
      throw error;
    }
  };
}
```

---

## 5. Testing Strategy

### 5.1 Unit Tests

```typescript
// tests/unit/token.service.test.ts
import { describe, it, expect } from 'vitest';
import { drawTokens } from '../../src/services/token.service';

describe('Token Service', () => {
  describe('drawTokens', () => {
    it('should draw exactly 3 tokens', async () => {
      const pool = { successTokens: 5, failureTokens: 5 };
      const result = await drawTokens(pool);
      
      expect(result.drawnSuccess + result.drawnFailure).toBe(3);
    });
    
    it('should return TRIUMPH for 3 success tokens', async () => {
      // Mock pool with only success tokens
      const pool = { successTokens: 10, failureTokens: 0 };
      const result = await drawTokens(pool);
      
      expect(result.drawnSuccess).toBe(3);
      expect(result.resultType).toBe('TRIUMPH');
      expect(result.resultValue).toBe(3);
    });
    
    it('should return DISASTER for 3 failure tokens', async () => {
      const pool = { successTokens: 0, failureTokens: 10 };
      const result = await drawTokens(pool);
      
      expect(result.drawnFailure).toBe(3);
      expect(result.resultType).toBe('DISASTER');
      expect(result.resultValue).toBe(-3);
    });
    
    it('should generate unique seeds', async () => {
      const pool = { successTokens: 5, failureTokens: 5 };
      const result1 = await drawTokens(pool);
      const result2 = await drawTokens(pool);
      
      expect(result1.seed).not.toBe(result2.seed);
    });
  });
});
```

### 5.2 Integration Tests

```typescript
// tests/integration/action.test.ts
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import { app } from '../../src/index';
import { setupTestDb, teardownTestDb } from '../helpers/db';

describe('Action API', () => {
  beforeAll(async () => {
    await setupTestDb();
  });
  
  afterAll(async () => {
    await teardownTestDb();
  });
  
  it('should create action proposal', async () => {
    const game = await createTestGame();
    const user = await createTestUser();
    const token = generateTestToken(user);
    
    const response = await request(app)
      .post(`/api/games/${game.id}/actions`)
      .set('Authorization', `Bearer ${token}`)
      .send({
        actionDescription: 'Attack the enemy fortress',
        desiredOutcome: 'Fortress is captured',
        initialArguments: [
          'We have superior numbers',
          'Element of surprise',
          'Better equipment',
        ],
      });
    
    expect(response.status).toBe(201);
    expect(response.body.success).toBe(true);
    expect(response.body.data.status).toBe('ARGUING');
  });
  
  it('should enforce voting after all players vote', async () => {
    // Test implementation...
  });
});
```

### 5.3 E2E Tests (Playwright)

```typescript
// tests/e2e/game-flow.spec.ts
import { test, expect } from '@playwright/test';

test('complete action resolution flow', async ({ page, context }) => {
  // Create two users
  const page1 = page;
  const page2 = await context.newPage();
  
  // User 1: Create game
  await page1.goto('/');
  await page1.click('text=Create Game');
  await page1.fill('[name=gameName]', 'Test Game');
  await page1.click('text=Create');
  
  // Get invite link
  const inviteLink = await page1.locator('[data-testid=invite-link]').textContent();
  
  // User 2: Join game
  await page2.goto(inviteLink);
  await page2.fill('[name=playerName]', 'Player 2');
  await page2.click('text=Join');
  
  // User 1: Start game
  await page1.click('text=Start Game');
  
  // User 1: Propose action
  await page1.fill('[name=actionDescription]', 'Attack fortress');
  await page1.fill('[name=desiredOutcome]', 'Victory');
  await page1.fill('[name=argument1]', 'We have numbers');
  await page1.click('text=Propose Action');
  
  // Both users: Add arguments
  await page2.click('text=Add Argument');
  await page2.fill('[name=content]', 'Enemy has fortifications');
  await page2.select('[name=type]', 'AGAINST');
  await page2.click('text=Submit');
  await page2.click('text=Done Arguing');
  
  await page1.click('text=Done Arguing');
  
  // Both users: Vote
  await page1.click('[data-testid=vote-likely-success]');
  await page2.click('[data-testid=vote-uncertain]');
  
  // User 1: Draw tokens
  await page1.click('text=Draw Tokens');
  
  // Verify result displayed
  await expect(page1.locator('[data-testid=result]')).toBeVisible();
  
  // User 1: Narrate
  await page1.fill('[name=narration]', 'We captured the fortress!');
  await page1.click('text=Submit Narration');
  
  // Verify action complete
  await expect(page1.locator('text=Attack fortress')).toBeVisible();
  await expect(page1.locator('text=We captured the fortress!')).toBeVisible();
});
```

---

## 6. Security Considerations

### 6.1 Input Sanitization

```typescript
// middleware/sanitization.middleware.ts
import DOMPurify from 'isomorphic-dompurify';

export function sanitizeInput(req: Request, res: Response, next: NextFunction) {
  // Sanitize all string inputs
  const sanitizeObject = (obj: any): any => {
    if (typeof obj === 'string') {
      return DOMPurify.sanitize(obj, { ALLOWED_TAGS: [] }); // Strip all HTML
    }
    if (Array.isArray(obj)) {
      return obj.map(sanitizeObject);
    }
    if (obj && typeof obj === 'object') {
      return Object.keys(obj).reduce((acc, key) => {
        acc[key] = sanitizeObject(obj[key]);
        return acc;
      }, {} as any);
    }
    return obj;
  };
  
  req.body = sanitizeObject(req.body);
  next();
}
```

### 6.2 Rate Limiting

```typescript
// middleware/rateLimit.middleware.ts
import rateLimit from 'express-rate-limit';

export const generalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // Limit each IP to 100 requests per windowMs
  message: 'Too many requests, please try again later',
});

export const authLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 5, // Limit each IP to 5 login attempts per hour
  message: 'Too many login attempts, please try again later',
  skipSuccessfulRequests: true,
});

export const actionLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 10, // Max 10 actions per minute per user
  keyGenerator: (req) => req.user?.id || req.ip,
});
```

### 6.3 CSRF Protection

```typescript
// middleware/csrf.middleware.ts
import csrf from 'csurf';

export const csrfProtection = csrf({
  cookie: {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'strict',
  },
});

// Add CSRF token to responses
export function addCsrfToken(req: Request, res: Response, next: NextFunction) {
  res.locals.csrfToken = req.csrfToken();
  next();
}
```

---

## 7. Deployment

### 7.1 Docker Configuration

**Dockerfile:**
```dockerfile
# Backend Dockerfile
FROM node:20-alpine AS builder

WORKDIR /app

# Install dependencies
COPY package.json pnpm-lock.yaml ./
RUN npm install -g pnpm && pnpm install --frozen-lockfile

# Copy source
COPY . .

# Build
RUN pnpm build

# Production image
FROM node:20-alpine

WORKDIR /app

COPY --from=builder /app/dist ./dist
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/package.json ./

EXPOSE 3000

CMD ["node", "dist/index.js"]
```

**docker-compose.yml:**
```yaml
version: '3.8'

services:
  postgres:
    image: postgres:14-alpine
    environment:
      POSTGRES_DB: mosaic_game
      POSTGRES_USER: postgres
      POSTGRES_PASSWORD: ${DB_PASSWORD}
    volumes:
      - postgres_data:/var/lib/postgresql/data
    ports:
      - "5432:5432"

  redis:
    image: redis:7-alpine
    ports:
      - "6379:6379"

  api:
    build:
      context: ./server
      dockerfile: Dockerfile
    environment:
      DATABASE_URL: postgresql://postgres:${DB_PASSWORD}@postgres:5432/mosaic_game
      REDIS_URL: redis://redis:6379
      JWT_SECRET: ${JWT_SECRET}
      SMTP_HOST: ${SMTP_HOST}
      SMTP_PORT: ${SMTP_PORT}
      SMTP_USER: ${SMTP_USER}
      SMTP_PASS: ${SMTP_PASS}
    ports:
      - "3000:3000"
    depends_on:
      - postgres
      - redis

  frontend:
    build:
      context: ./client
      dockerfile: Dockerfile
    ports:
      - "80:80"
    depends_on:
      - api

volumes:
  postgres_data:
```

### 7.2 Environment Variables

**.env.example:**
```bash
# Application
NODE_ENV=production
APP_URL=https://yourdomain.com
PORT=3000

# Database
DATABASE_URL=postgresql://user:password@localhost:5432/mosaic_game

# Redis
REDIS_URL=redis://localhost:6379

# JWT
JWT_SECRET=your-super-secret-jwt-key-change-this
JWT_EXPIRY=7d

# Email
SMTP_HOST=smtp.sendgrid.net
SMTP_PORT=587
SMTP_USER=apikey
SMTP_PASS=your-sendgrid-api-key
EMAIL_FROM=noreply@yourdomain.com

# Security
BCRYPT_ROUNDS=12
RATE_LIMIT_WINDOW_MS=900000
RATE_LIMIT_MAX_REQUESTS=100
```

### 7.3 CI/CD Pipeline (GitHub Actions)

**.github/workflows/deploy.yml:**
```yaml
name: Deploy

on:
  push:
    branches: [main]

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: pnpm/action-setup@v2
      - uses: actions/setup-node@v3
        with:
          node-version: '20'
          cache: 'pnpm'
      
      - name: Install dependencies
        run: pnpm install
      
      - name: Run tests
        run: pnpm test
      
      - name: Run linter
        run: pnpm lint

  deploy:
    needs: test
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      
      - name: Deploy to Railway
        run: |
          npm install -g @railway/cli
          railway up
        env:
          RAILWAY_TOKEN: ${{ secrets.RAILWAY_TOKEN }}
```

---

## 8. Monitoring & Logging

### 8.1 Application Logging

```typescript
// utils/logger.ts
import winston from 'winston';

export const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.errors({ stack: true }),
    winston.format.json()
  ),
  transports: [
    new winston.transports.File({ filename: 'error.log', level: 'error' }),
    new winston.transports.File({ filename: 'combined.log' }),
  ],
});

if (process.env.NODE_ENV !== 'production') {
  logger.add(new winston.transports.Console({
    format: winston.format.simple(),
  }));
}

// Usage
logger.info('Game created', { gameId, userId });
logger.error('Failed to draw tokens', { error, actionId });
```

### 8.2 Error Tracking (Sentry)

```typescript
// config/sentry.ts
import * as Sentry from '@sentry/node';

Sentry.init({
  dsn: process.env.SENTRY_DSN,
  environment: process.env.NODE_ENV,
  tracesSampleRate: 0.1,
});

// Error handler middleware
export function sentryErrorHandler(
  err: Error,
  req: Request,
  res: Response,
  next: NextFunction
) {
  Sentry.captureException(err, {
    user: req.user ? { id: req.user.id, email: req.user.email } : undefined,
    extra: {
      body: req.body,
      params: req.params,
      query: req.query,
    },
  });
  
  next(err);
}
```

---

## 9. Performance Optimization

### 9.1 Database Indexes

See ERD document for full index strategy.

### 9.2 Query Optimization

```typescript
// Use select to fetch only needed fields
const games = await db.game.findMany({
  where: { status: 'ACTIVE' },
  select: {
    id: true,
    name: true,
    currentPhase: true,
    updatedAt: true,
  },
});

// Use pagination
const actions = await db.action.findMany({
  where: { gameId },
  orderBy: { sequenceNumber: 'desc' },
  take: 20,
  skip: page * 20,
});

// Eager load related data
const action = await db.action.findUnique({
  where: { id: actionId },
  include: {
    initiator: {
      include: { user: true },
    },
    arguments: {
      include: { player: { include: { user: true } } },
    },
    votes: true,
    tokenDraw: {
      include: { drawnTokens: true },
    },
    narration: {
      include: { author: { include: { user: true } } },
    },
  },
});
```

### 9.3 Caching Strategy (Redis)

```typescript
// services/cache.service.ts
import Redis from 'ioredis';

const redis = new Redis(process.env.REDIS_URL);

const CACHE_TTL = {
  GAME: 60 * 5, // 5 minutes
  ACTION: 60, // 1 minute
  USER: 60 * 30, // 30 minutes
};

export async function getCachedGame(gameId: string): Promise<Game | null> {
  const cached = await redis.get(`game:${gameId}`);
  return cached ? JSON.parse(cached) : null;
}

export async function setCachedGame(game: Game): Promise<void> {
  await redis.setex(
    `game:${game.id}`,
    CACHE_TTL.GAME,
    JSON.stringify(game)
  );
}

export async function invalidateGameCache(gameId: string): Promise<void> {
  await redis.del(`game:${gameId}`);
}
```

---

## 10. Migration from Physical Play

### 10.1 Differences from Tabletop

**Advantages of Digital:**
- Automated token management
- Automatic result calculation
- Complete game history/audit trail
- Remote asynchronous play
- No physical components needed

**Considerations:**
- Must maintain "feel" of physical randomness
- Ensure transparency in token drawing
- Preserve social deliberation aspects
- Support text-based argumentation

### 10.2 Tutorial/Onboarding

Create interactive tutorial that walks through:
1. Action proposal
2. Argumentation
3. Voting mechanics
4. Token drawing
5. Narration

---

## Appendix A: Technology Alternatives

**Frontend Framework:**
- React (recommended) - Large ecosystem, excellent TypeScript support
- Vue 3 - Simpler learning curve, good TypeScript support
- Svelte - Smaller bundle size, less tooling overhead

**Backend Framework:**
- Express (recommended) - Battle-tested, huge ecosystem
- Fastify - Better performance, similar API
- NestJS - More opinionated, better for large teams

**Database:**
- PostgreSQL (recommended) - Best for relational data, JSON support
- MySQL - Slightly simpler, wide hosting support
- MongoDB - NoSQL, flexible schema (not ideal for this use case)

**ORM:**
- Prisma (recommended) - Excellent TypeScript support, migrations
- Drizzle - Lighter weight, type-safe
- TypeORM - More features, steeper learning curve

---

## Appendix B: Future Technical Considerations (v2+)

**Real-time Features:**
- WebSocket integration (Socket.io or native)
- Live presence indicators
- Real-time vote updates

**Advanced Features:**
- AI suggestion system for actions
- Rich text editor for narration
- Image upload for game history
- Voice integration
- Mobile apps (React Native)

**Scalability:**
- Microservices architecture
- Message queue (RabbitMQ, Redis Pub/Sub)
- Horizontal scaling with load balancer
- CDN for static assets
- Database read replicas

---

**Document End**
