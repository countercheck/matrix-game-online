# GitHub Copilot Instructions

## Project Summary

This is a web-based implementation of the Mosaic Strict Matrix Game's Action Resolution system. The application enables asynchronous, play-by-post gameplay for distributed groups using a full-stack TypeScript architecture with React frontend and Express backend.

## Tech Stack & Architecture

### Frontend

- **React 18** with TypeScript (strict mode)
- **Vite** for development and building
- **TanStack Query** for server state management
- **Tailwind CSS** for styling (no CSS modules)
- **React Router** for navigation

### Backend

- **Node.js 20** with TypeScript (strict mode)
- **Express.js** REST API
- **Prisma ORM** for database operations (all DB access must use Prisma)
- **PostgreSQL** database
- **JWT authentication** with bcrypt password hashing

### Testing

- **Vitest** for both client and server tests
- Server tests: `server/tests/` (unit in `unit/`, integration in `integration/`)
- Client tests: colocated with components (e.g., `Login.test.tsx`)

## Project Structure

```
client/           # React frontend (Vite)
  src/
    components/   # UI components
    hooks/        # Custom React hooks (useAuth)
    pages/        # Page components
    services/     # API client
server/           # Express backend
  src/
    controllers/  # Request handlers
    services/     # Business logic
    routes/       # API routes
    middleware/   # Auth, error handling
    utils/        # Logger, validators
  prisma/         # Database schema
  tests/          # Unit and integration tests
```

## Coding Conventions

### TypeScript

- Always use TypeScript strict mode
- Never use `any` type unless absolutely necessary and well-justified
- Prefer interfaces over types for object shapes
- Use proper typing for all function parameters and return values

### Backend Architecture

- Follow existing patterns in controllers/services/routes
- Controllers handle HTTP requests/responses only
- Services contain business logic
- Use Prisma for all database operations
- Never write raw SQL queries

### Frontend

- Use TanStack Query for all server state
- Use Tailwind CSS for styling (no CSS modules)
- Follow existing component patterns
- Colocate tests with components

### Code Style

- Don't add comments unless they match the style of other comments in the file or are necessary to explain complex logic
- Use existing libraries whenever possible
- Only add new libraries or update library versions if absolutely necessary

## Testing Requirements

### MANDATORY

- **Always write tests** for new functionality
- **Update existing tests** when modifying code behavior
- Run `pnpm test` before completing work to ensure all tests pass

### Test Organization

- Server tests go in `server/tests/` directory
  - Unit tests in `server/tests/unit/`
  - Integration tests in `server/tests/integration/`
- Client tests are colocated with components
- Follow existing test patterns and naming conventions

### Test Coverage

- All new API endpoints must have tests
- All new business logic must have unit tests
- Update tests when behavior changes

## Build & Validation Steps

### Before Making Changes

1. Run existing linters, builds, and tests to understand baseline
2. Document any pre-existing failures (you're not responsible for fixing unrelated issues)

### During Development

```bash
pnpm lint              # Lint all packages
pnpm format            # Format with Prettier
pnpm test              # Run all tests
pnpm build             # Build for production
```

### Before Completing Work

1. Run `pnpm lint` to check code style
2. Run `pnpm test` to ensure all tests pass
3. Run `pnpm build` to verify production build works
4. Only fix linting/build/test failures related to your changes

### Database Changes

```bash
pnpm db:generate       # Generate Prisma client after schema changes
pnpm db:migrate        # Run database migrations
pnpm db:push           # Push schema changes (development only)
```

## Documentation Requirements

**MANDATORY: Update documentation after every code change.**

| Change Type              | Required Documentation Updates                   |
| ------------------------ | ------------------------------------------------ |
| New API endpoint         | Update `docs/API.md`                             |
| Database schema change   | Update `docs/API.md` and run migration           |
| New environment variable | Update `.env.example` and `docs/DEPLOYMENT.md`   |
| New feature              | Update `README.md` and relevant component README |
| Bug fix                  | Update `DEVELOPMENT_PLAN.md` if tracked          |
| Completed task           | Update `DEVELOPMENT_PLAN.md`                     |

### Documentation Files

- `README.md` - Project overview and setup
- `CLAUDE.md` - Development conventions
- `CONTRIBUTING.md` - Contribution guidelines
- `DEVELOPMENT_PLAN.md` - Task tracking
- `docs/API.md` - API reference
- `docs/DEPLOYMENT.md` - Deployment guide
- `server/README.md` - Backend documentation
- `client/README.md` - Frontend documentation

## Git Workflow

### Branch Strategy

- **NEVER commit directly to `main`**
- Always create a feature branch first
- Branch naming conventions: `feature/`, `fix/`, `refactor/`, `docs/` prefixes
- Keep branches short-lived and focused on a single change

### Commit Guidelines

- Commit after every meaningful change
- Write clear, descriptive commit messages explaining the "why"
- Keep commits focused and atomic (one logical change per commit)

## Game Domain Knowledge

### Action Resolution Phases

```
WAITING -> PROPOSAL -> ARGUMENTATION -> VOTING -> RESOLUTION -> NARRATION -> COMPLETE
```

### Token Mechanics

- **Base pool**: 1 Success + 1 Failure token
- **Per player vote**: adds 2 tokens based on vote type
  - Likely Success vote: +2 Success tokens
  - Likely Failure vote: +2 Failure tokens
  - Uncertain vote: +1 Success, +1 Failure tokens
- **Draw**: 3 tokens are drawn randomly
- **Results**:
  - 3 Success (SSS) = +3 (Triumph!)
  - 2 Success, 1 Failure (SSF) = +1 (Success, but...)
  - 1 Success, 2 Failure (SFF) = -1 (Failure, but...)
  - 3 Failure (FFF) = -3 (Disaster!)

### Key Entities

The database schema includes these core entities:

- **User** - Player accounts
- **Game** - Game instances
- **GamePlayer** - Player participation in games
- **Round** - Game rounds
- **Action** - Player actions within rounds
- **Argument** - Arguments for/against actions
- **Vote** - Player votes on actions

## Environment Setup

### Prerequisites

- Node.js 20+
- pnpm 8+
- Docker and Docker Compose (for local database)

### Local Development

```bash
# Start database
docker-compose up -d

# Install dependencies
pnpm install

# Generate Prisma client
pnpm db:generate

# Run migrations
pnpm db:migrate

# Start development servers (both frontend and backend)
pnpm dev
```

### Development URLs

- Frontend: http://localhost:5173
- Backend: http://localhost:3000

### Environment Variables

Server environment variables are in `server/.env`. See `server/.env.example` for all available options.

## Important Constraints

### Security

- Never commit secrets to source code
- Always validate and sanitize user input
- Use proper authentication/authorization checks
- Follow existing JWT authentication patterns

### Code Changes

- Make minimal, surgical changes
- Don't refactor unrelated code
- Don't fix unrelated bugs or broken tests
- Only modify what's necessary for your specific task
- Preserve all working functionality unless explicitly changing it

### Dependency Management

- Use `pnpm` for package management (not npm or yarn)
- Only add new dependencies if absolutely necessary
- Check for existing solutions in current dependencies first
- Document why new dependencies are needed

### File Operations

- Never delete or remove working files unless absolutely necessary
- Always back up or verify before making destructive changes
- Use version control to track all modifications

## Communication Style

When working on tasks:

1. **Explain what you're about to do and why** before making changes
2. Describe the proposed change and its purpose
3. This helps with understanding, review, and catching potential issues early
4. Ask for clarification if requirements are unclear

## Common Errors and Workarounds

### Error: `docker-compose: command not found`

**Cause:** Newer versions of Docker use `docker compose` (with a space) instead of `docker-compose` (hyphenated).

**Solution:** Use `docker compose` instead:

```bash
# Old syntax (may not work)
docker-compose up -d

# New syntax (recommended)
docker compose up -d
```

### Error: `Environment variable not found: DATABASE_URL`

**Cause:** The `server/.env` file doesn't exist. Prisma requires this file to access the database.

**Solution:** Copy the example environment file:

```bash
cp server/.env.example server/.env
```

Then verify the `DATABASE_URL` matches your local database setup (default: `postgresql://postgres:postgres@localhost:5432/mosaic_game?schema=public`).

### Error: E2E Tests Are Skipped

**Expected Behavior:** E2E tests are skipped by default when running `pnpm test`. They require a separate command.

**Solution:** To run E2E tests:

```bash
# From root
pnpm --filter server test:e2e

# From server directory
npm run test:e2e
```

**Note:** E2E tests run sequentially to avoid database conflicts and may take longer than unit tests.

### Error: Code Formatting Issues

**Cause:** Code doesn't match Prettier formatting rules.

**Solution:** Run Prettier to auto-format:

```bash
pnpm format
```

To check formatting without changing files:

```bash
pnpm format:check
```

### Error: Prisma Client Not Generated

**Cause:** The Prisma client hasn't been generated after schema changes.

**Solution:** Generate the Prisma client:

```bash
pnpm db:generate
```

This is required after:

- Fresh clone of the repository
- Any changes to `server/prisma/schema.prisma`
- Running `git pull` if schema was updated

### Error: Port 3000 or 5173 Already in Use

**Cause:** Another process is using the development server ports.

**Solution:** Find and kill the process:

```bash
# Find process on port 3000
lsof -ti:3000 | xargs kill -9

# Find process on port 5173
lsof -ti:5173 | xargs kill -9
```

Or use different ports by modifying the env files.

## Backend Architecture Patterns

### Controller → Service → Prisma Pattern

All backend code follows a strict layered architecture:

```typescript
// 1. Route (routes/*.routes.ts) - defines HTTP endpoints
router.post('/', authenticateToken, gameController.createGame);

// 2. Controller (controllers/*.controller.ts) - handles HTTP request/response
export async function createGame(req: Request, res: Response, next: NextFunction) {
  try {
    const userId = req.user!.id;
    const data = createGameSchema.parse(req.body); // Zod validation
    const game = await gameService.createGame(userId, data);
    res.status(201).json({ success: true, data: game });
  } catch (error) {
    next(error); // Pass to error handler middleware
  }
}

// 3. Service (services/*.service.ts) - contains business logic
export async function createGame(userId: string, data: CreateGameInput) {
  // Business logic here
  const game = await db.game.create({
    /* ... */
  });
  return game;
}
```

**Rules:**

- **Routes** only define paths and middleware
- **Controllers** only handle HTTP (req/res), validation, and calling services
- **Services** contain all business logic and database operations
- **All database access** must use Prisma (never raw SQL)
- **Input validation** uses Zod schemas from `utils/validators.ts`
- **Error handling** uses custom error classes (`BadRequestError`, `NotFoundError`, etc.)

### Input Validation Pattern

Always use Zod schemas for validation:

```typescript
// Define schema in utils/validators.ts
export const createGameSchema = z.object({
  name: z.string().min(1).max(100),
  description: z.string().optional(),
  // ...
});

// Use in controller
const data = createGameSchema.parse(req.body);
```

### Error Handling Pattern

Use custom error classes from `middleware/errorHandler.ts`:

```typescript
import { BadRequestError, NotFoundError, ForbiddenError } from '../middleware/errorHandler.js';

// In service
if (!game) {
  throw new NotFoundError('Game not found');
}

if (game.creatorId !== userId) {
  throw new ForbiddenError('Only the game creator can perform this action');
}
```

These are caught by the error handler middleware and return appropriate HTTP status codes.

## Frontend Architecture Patterns

### TanStack Query for Server State

All API calls use TanStack Query hooks:

```typescript
// In pages or components
const { data, isLoading, error } = useQuery({
  queryKey: ['game', gameId],
  queryFn: () => api.getGame(gameId),
});

// For mutations
const mutation = useMutation({
  mutationFn: (data) => api.createGame(data),
  onSuccess: () => {
    queryClient.invalidateQueries({ queryKey: ['games'] });
  },
});
```

**Rules:**

- Never use `useState` for server data
- Use `queryKey` arrays for automatic cache management
- Invalidate relevant queries after mutations
- API client functions are in `services/api.ts`

### Component Patterns

- **Pages** (`pages/`) - Route-level components, handle data fetching
- **Components** (`components/`) - Reusable UI components
- **Layout** (`components/layout/`) - App shell, navigation
- **UI** (`components/ui/`) - Base UI components (buttons, dialogs, etc.)
- **Game** (`components/game/`) - Game-specific components

### Styling with Tailwind

```typescript
// Use Tailwind utility classes
<div className="flex items-center gap-4 p-4 bg-gray-100 rounded-lg">

// For conditional classes, use the cn() utility
import { cn } from '@/utils/cn';

<button className={cn(
  "px-4 py-2 rounded",
  isActive && "bg-blue-500 text-white",
  isDisabled && "opacity-50 cursor-not-allowed"
)}>
```

**Rules:**

- Never use CSS modules or separate CSS files
- Use Tailwind's built-in classes
- Use `cn()` utility for conditional classes
- Follow existing component patterns for consistency

## Testing Patterns

### Test File Organization

```
server/
  tests/
    unit/           # Fast, isolated unit tests
      services/
      middleware/
      validators.test.ts
    integration/    # Tests with database
      routes/
      services/
    e2e/           # End-to-end workflow tests (skipped by default)
    setup.ts       # Test setup/teardown

client/
  src/
    components/
      Component.tsx
      Component.test.tsx  # Colocated with component
```

### Running Tests

```bash
# All unit + integration tests
pnpm test

# Only server tests
cd server && npm test

# Only client tests
cd client && npm test

# E2E tests (server only)
pnpm --filter server test:e2e

# With coverage
pnpm --filter server test:coverage

# Watch mode
pnpm --filter server test:watch
```

### Test Patterns

**Unit tests** - Mock all dependencies:

```typescript
import { describe, it, expect, vi } from 'vitest';

vi.mock('../config/database.js', () => ({
  db: {
    game: {
      findUnique: vi.fn(),
      create: vi.fn(),
    },
  },
}));
```

**Integration tests** - Use real database, clean up after:

```typescript
import { beforeEach, afterEach } from 'vitest';
import { db } from '../config/database.js';

beforeEach(async () => {
  // Set up test data
});

afterEach(async () => {
  // Clean up test data
  await db.game.deleteMany();
});
```

## Additional Resources

- [Product Requirements (PRD)](../PRD_Mosaic_Matrix_Game.md)
- [Technical Specification](../Technical_Spec_Mosaic_Matrix_Game.md)
- [Entity Relationship Diagram](../ERD_Mosaic_Matrix_Game.md)
- [Development Plan](../DEVELOPMENT_PLAN.md)
