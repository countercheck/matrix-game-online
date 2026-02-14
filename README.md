# Mosaic Matrix Game

A web-based implementation of the Mosaic Strict Matrix Game's Action Resolution system, enabling asynchronous, play-by-post gameplay for distributed groups.

## Overview

This application allows players to:

- Create and join games with invite links
- Propose actions and argue for their success
- Vote on action outcomes using a token-based system
- Draw tokens to resolve actions
- Narrate results collaboratively

## Tech Stack

**Frontend:**

- React 18 with TypeScript
- Vite for development and building
- TanStack Query for server state
- Tailwind CSS for styling
- React Router for navigation

**Backend:**

- Node.js 20 with TypeScript
- Express.js REST API
- Prisma ORM
- PostgreSQL database
- JWT authentication

## Prerequisites

- Node.js 20+
- pnpm 8+
- Docker and Docker Compose (for local database)

## Getting Started

### 1. Clone and install dependencies

```bash
git clone <repository-url>
cd matrix-game-online
pnpm install
```

### 2. Start the database

```bash
docker-compose up -d
```

### 3. Set up the database

```bash
# Generate Prisma client
pnpm db:generate

# Run migrations
pnpm db:migrate

# (Optional) Seed the database (pre-creates NPC system user)
pnpm db:seed
```

### 4. Start development servers

```bash
pnpm dev
```

This starts both the frontend (http://localhost:5173) and backend (http://localhost:3000) in development mode.

## Project Structure

```
.
├── client/                 # React frontend
│   ├── src/
│   │   ├── components/     # UI components
│   │   ├── hooks/          # Custom React hooks
│   │   ├── pages/          # Page components
│   │   ├── services/       # API client
│   │   └── types/          # TypeScript types
│   └── ...
├── server/                 # Express backend
│   ├── src/
│   │   ├── controllers/    # Request handlers
│   │   ├── services/       # Business logic
│   │   ├── routes/         # API routes
│   │   ├── middleware/     # Express middleware
│   │   └── utils/          # Utilities
│   └── prisma/
│       └── schema.prisma   # Database schema
├── docker-compose.yml      # Local development services
└── package.json           # Root workspace config
```

## Available Scripts

### Root level

- `pnpm dev` - Start both frontend and backend in development mode
- `pnpm build` - Build both frontend and backend for production
- `pnpm lint` - Run linting across all packages
- `pnpm format` - Format code with Prettier

### Database

- `pnpm db:generate` - Generate Prisma client
- `pnpm db:migrate` - Run database migrations
- `pnpm db:push` - Push schema changes to database
- `pnpm db:studio` - Open Prisma Studio

## Game Flow

1. **Create Game**: A host creates a game and shares the invite link
2. **Join Game**: Players join using the invite link
3. **Start Game**: Host starts the game (minimum 2 players)
4. **Each Round**: Every player proposes one action
5. **Action Resolution**:
   - **Proposal**: Initiator proposes an action with arguments
   - **Argumentation**: Other players argue for/against
   - **Voting**: All players vote (Likely Success, Likely Failure, or Uncertain)
   - **Resolution**: Initiator draws tokens to determine outcome
   - **Narration**: Initiator narrates what happens
6. **Round Summary**: After all actions complete, someone writes a round summary
7. **New Round**: Process repeats

## Token Mechanics

- **Base Pool**: 1 Success + 1 Failure token
- **Per Player Vote**: Adds 2 tokens based on vote type
- **Draw**: 3 tokens are drawn randomly
- **Results**:
  - 3 Success = +3 Triumph!
  - 2 Success, 1 Failure = +1 Success, but...
  - 1 Success, 2 Failure = -1 Failure, but...
  - 3 Failure = -3 Disaster!

## Environment Variables

See `server/.env.example` for all available configuration options.

## Documentation

- [Product Requirements (PRD)](./PRD_Mosaic_Matrix_Game.md)
- [Technical Specification](./Technical_Spec_Mosaic_Matrix_Game.md)
- [Entity Relationship Diagram](./ERD_Mosaic_Matrix_Game.md)
- [Development Plan](./DEVELOPMENT_PLAN.md)
- [GitHub Copilot Instructions](./.github/copilot-instructions.md)

## License

MIT
