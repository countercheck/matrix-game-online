# Mosaic Matrix Game - Claude Code Configuration

## Project Overview

Web-based implementation of the Mosaic Strict Matrix Game's Action Resolution system. Enables asynchronous, play-by-post gameplay for distributed groups.

## Tech Stack

- **Frontend**: React 18 + TypeScript, Vite, TanStack Query, Tailwind CSS, React Router
- **Backend**: Node.js 20 + TypeScript, Express.js, Prisma ORM, PostgreSQL
- **Auth**: JWT-based authentication with bcrypt password hashing
- **Testing**: Vitest for both client and server

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

## Common Commands

```bash
# Development
pnpm dev              # Start both frontend and backend
pnpm build            # Build for production
pnpm test             # Run all tests
pnpm lint             # Lint all packages
pnpm format           # Format with Prettier

# Database
pnpm db:generate      # Generate Prisma client
pnpm db:migrate       # Run migrations
pnpm db:push          # Push schema changes
pnpm db:studio        # Open Prisma Studio

# Docker
docker-compose up -d  # Start PostgreSQL
```

## Development URLs

- Frontend: http://localhost:5173
- Backend: http://localhost:3000

## Communication Style

- **Always explain what you are about to do and why** before making changes
- Describe the proposed change and its purpose
- This helps with understanding, review, and catching potential issues early

## Git Workflow

Use feature branches for development, then merge to `main`.

```bash
# 1. Create feature branch
git checkout main
git pull origin main
git checkout -b feature/your-feature-name

# 2. Make changes and commit
git add <files>
git commit -m "Description of change"

# 3. Push branch and merge
git push -u origin feature/your-feature-name
gh pr create --fill && gh pr merge --merge
# Or merge locally: git checkout main && git merge feature/your-feature-name
```

### Commit Guidelines

- **Commit after every change** - Each meaningful change should be committed immediately
- Write clear, descriptive commit messages explaining the "why"
- Keep commits focused and atomic (one logical change per commit)

## Code Conventions

- Use TypeScript strict mode
- Follow existing patterns in controllers/services/routes
- Use Prisma for all database operations
- Use TanStack Query for server state on frontend
- Tailwind CSS for styling (no CSS modules)
- Vitest for testing

## Testing Requirements

- **Always write tests** for new functionality
- **Update existing tests** when modifying code behavior
- Server tests: `server/tests/` (unit in `unit/`, integration in `integration/`)
- Client tests: colocated with components (e.g., `Login.test.tsx`)
- Run `pnpm test` before committing to ensure all tests pass

## Documentation Requirements

- **Update documentation** when adding features or changing behavior
- Keep `README.md` current with setup instructions and project info
- Update `PRD_Mosaic_Matrix_Game.md` for requirement changes
- Update `Technical_Spec_Mosaic_Matrix_Game.md` for architecture changes
- Update `CLAUDE.md` when adding new commands, conventions, or project structure changes
- Update `DEVELOPMENT_PLAN.md` when adding or completing work

## Game Domain

### Action Resolution Phases
```
WAITING -> PROPOSAL -> ARGUMENTATION -> VOTING -> RESOLUTION -> NARRATION -> COMPLETE
```

### Token Mechanics
- Base pool: 1 Success + 1 Failure
- Per player vote: adds 2 tokens based on vote type
- Draw: 3 tokens randomly
- Results: +3 (SSS), +1 (SSF), -1 (SFF), -3 (FFF)

### Key Entities
- User, Game, GamePlayer, Round, Action, Argument, Vote

## Environment

Server env vars are in `server/.env` (see `server/.env.example` for reference).

## Documentation

- PRD: `PRD_Mosaic_Matrix_Game.md`
- Technical Spec: `Technical_Spec_Mosaic_Matrix_Game.md`
- ERD: `ERD_Mosaic_Matrix_Game.md`
- Development Plan: `DEVELOPMENT_PLAN.md`
