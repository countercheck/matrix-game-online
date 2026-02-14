# Mosaic Matrix Game - Server

Express.js backend API for the Mosaic Matrix Game.

## Tech Stack

- **Runtime**: Node.js 20
- **Framework**: Express.js
- **Language**: TypeScript
- **Database**: PostgreSQL with Prisma ORM
- **Auth**: JWT with bcrypt
- **Testing**: Vitest

## Quick Start

```bash
# Install dependencies
npm install

# Set up environment
cp .env.example .env
# Edit .env with your database URL

# Run migrations
npx prisma migrate dev

# Start development server
npm run dev
```

## Scripts

| Command         | Description           |
| --------------- | --------------------- |
| `npm run dev`   | Start with hot reload |
| `npm run build` | Build for production  |
| `npm start`     | Run production build  |
| `npm test`      | Run all tests         |
| `npm run lint`  | Run ESLint            |

## Project Structure

```
src/
├── config/          # Configuration (database, env)
├── controllers/     # Request handlers
├── middleware/      # Express middleware
│   ├── auth.middleware.ts
│   ├── errorHandler.ts
│   └── security.middleware.ts
├── routes/          # API route definitions
├── services/        # Business logic
├── utils/           # Utilities (logger, validators)
├── workers/         # Background workers (timeouts)
└── index.ts         # Application entry point

prisma/
├── schema.prisma    # Database schema
└── migrations/      # Migration files

tests/
├── unit/            # Unit tests
├── integration/     # Integration tests
└── e2e/             # End-to-end tests
```

## API Routes

| Prefix         | Description                      |
| -------------- | -------------------------------- |
| `/api/auth`    | Authentication (register, login) |
| `/api/users`   | User profile management          |
| `/api/games`   | Game CRUD and actions            |
| `/api/actions` | Action resolution flow           |
| `/api/rounds`  | Round management                 |

See [API Documentation](../docs/API.md) for full details.

## Database

### Setup

1. Create PostgreSQL database
2. Configure `DATABASE_URL` in `.env`
3. Run migrations: `npx prisma migrate dev`
4. (Optional) Seed database: `npm run db:seed`

**Note:** The NPC system user (`npc@system.local`) is automatically created when needed for games with NPC personas, so running the seed script is optional.

### Schema Overview

- **User** - Account information
- **Game** - Game sessions
- **GamePlayer** - Player participation
- **Round** - Game rounds
- **Action** - Proposed actions
- **Argument** - For/against arguments
- **Vote** - Player votes
- **TokenDraw** - Resolution results
- **Narration** - Outcome narrations

### Commands

```bash
# Generate Prisma client
npx prisma generate

# Create migration
npx prisma migrate dev --name description

# Deploy migrations (production)
npx prisma migrate deploy

# Open Prisma Studio
npx prisma studio
```

## Environment Variables

See `.env.example` for all options. Key variables:

| Variable       | Description                  |
| -------------- | ---------------------------- |
| `DATABASE_URL` | PostgreSQL connection string |
| `JWT_SECRET`   | Secret for signing tokens    |
| `APP_URL`      | Frontend URL (for CORS)      |
| `EMAIL_*`      | SMTP configuration           |

## Testing

```bash
# Run all tests
npm test

# Run with coverage
npm test -- --coverage

# Run specific test file
npm test -- auth.service.test.ts

# Watch mode
npm test -- --watch
```

## Security Features

- JWT authentication
- bcrypt password hashing
- Rate limiting
- Input sanitization
- CSRF protection (X-Requested-With header)
- Security headers (helmet)
