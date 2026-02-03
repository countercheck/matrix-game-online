# Contributing to Mosaic Matrix Game

Thank you for your interest in contributing!

## Getting Started

### Prerequisites

- Node.js 20.x
- pnpm (recommended) or npm
- PostgreSQL 14+
- Docker (optional, for local database)

### Setup

1. **Clone the repository**
   ```bash
   git clone https://github.com/countercheck/matrix-game-online.git
   cd matrix-game-online
   ```

2. **Start PostgreSQL** (using Docker)
   ```bash
   docker-compose up -d
   ```

3. **Install dependencies**
   ```bash
   pnpm install
   ```

4. **Set up environment**
   ```bash
   cp server/.env.example server/.env
   # Edit server/.env with your database credentials
   ```

5. **Run database migrations**
   ```bash
   pnpm db:migrate
   ```

6. **Start development servers**
   ```bash
   pnpm dev
   ```

   - Frontend: http://localhost:5173
   - Backend: http://localhost:3000

## Development Workflow

### Branch Strategy

Use feature branches for all changes:

```bash
git checkout -b feature/your-feature-name
# or
git checkout -b fix/bug-description
```

### Making Changes

1. Create a feature branch
2. Make your changes
3. Write/update tests
4. Ensure all tests pass: `pnpm test`
5. Commit with a clear message
6. Push and create a pull request

### Commit Messages

Write clear, descriptive commit messages:

```
Add user authentication middleware

- Implement JWT token verification
- Add role-based access control
- Include rate limiting for auth endpoints
```

### Code Style

- **TypeScript**: Strict mode enabled
- **Formatting**: Prettier (run `pnpm format`)
- **Linting**: ESLint (run `pnpm lint`)

## Project Structure

```
client/                 # React frontend
├── src/
│   ├── components/     # Reusable UI components
│   ├── pages/          # Route pages
│   ├── hooks/          # Custom React hooks
│   └── services/       # API client

server/                 # Express backend
├── src/
│   ├── controllers/    # Request handlers
│   ├── services/       # Business logic
│   ├── routes/         # API route definitions
│   ├── middleware/     # Express middleware
│   └── utils/          # Utilities
├── prisma/             # Database schema
└── tests/              # Test files
```

## Testing

### Running Tests

```bash
# All tests
pnpm test

# Server tests only
cd server && npm test

# Client tests only
cd client && npm test

# Watch mode
npm test -- --watch
```

### Writing Tests

- **Server**: Place tests in `server/tests/`
  - Unit tests: `server/tests/unit/`
  - Integration tests: `server/tests/integration/`
  - E2E tests: `server/tests/e2e/`

- **Client**: Colocate with components
  - `Component.tsx` → `Component.test.tsx`

### Test Requirements

- All new features must include tests
- Bug fixes should include regression tests
- Maintain test coverage for critical paths

## API Development

### Adding a New Endpoint

1. **Define the route** in `server/src/routes/`
2. **Create controller** in `server/src/controllers/`
3. **Implement service logic** in `server/src/services/`
4. **Add validation schema** in `server/src/utils/validators.ts`
5. **Write tests** in `server/tests/`
6. **Update API docs** in `docs/API.md`

### Database Changes

1. Update `server/prisma/schema.prisma`
2. Create migration: `pnpm db:migrate --name description`
3. Update ERD documentation if needed

## Frontend Development

### Adding a New Page

1. Create page component in `client/src/pages/`
2. Add route in `client/src/App.tsx`
3. Use TanStack Query for data fetching
4. Follow existing component patterns

### Styling

- Use Tailwind CSS classes
- Follow existing design patterns
- Support dark mode where applicable

## Documentation

Update documentation when:
- Adding new features
- Changing API endpoints
- Modifying database schema
- Updating configuration options

Key documentation files:
- `README.md` - Project overview
- `docs/API.md` - API reference
- `docs/DEPLOYMENT.md` - Deployment guide
- `CLAUDE.md` - Development conventions

## Getting Help

- Check existing issues and PRs
- Review the documentation
- Open an issue for questions

## Code of Conduct

Be respectful and constructive in all interactions.
