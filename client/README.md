# Mosaic Matrix Game - Client

React frontend for the Mosaic Matrix Game.

## Tech Stack

- **Framework**: React 18
- **Build Tool**: Vite
- **Language**: TypeScript
- **Styling**: Tailwind CSS
- **State**: TanStack Query (server state)
- **Routing**: React Router v6
- **Testing**: Vitest + React Testing Library

## Quick Start

```bash
# Install dependencies
npm install

# Start development server
npm run dev
```

Open http://localhost:5173

## Scripts

| Command | Description |
|---------|-------------|
| `npm run dev` | Start dev server |
| `npm run build` | Build for production |
| `npm run preview` | Preview production build |
| `npm test` | Run tests |
| `npm run lint` | Run ESLint |

## Project Structure

```
src/
├── components/
│   ├── game/        # Game-specific components
│   │   ├── ActionProposal.tsx
│   │   ├── ArgumentList.tsx
│   │   ├── VotingPanel.tsx
│   │   ├── TokenDraw.tsx
│   │   └── ...
│   ├── layout/      # Layout components
│   │   └── Layout.tsx
│   └── ui/          # Reusable UI components
│       ├── Button.tsx
│       ├── Card.tsx
│       ├── Skeleton.tsx
│       └── ...
├── hooks/           # Custom React hooks
│   └── useAuth.tsx
├── pages/           # Route pages
│   ├── Dashboard.tsx
│   ├── CreateGame.tsx
│   ├── GameLobby.tsx
│   ├── GameView.tsx
│   └── ...
├── services/        # API client
│   └── api.ts
├── utils/           # Utilities
│   └── cn.ts
├── App.tsx          # Root component + routing
└── main.tsx         # Entry point
```

## Key Features

### Authentication
- JWT-based auth with context provider
- Protected routes
- Auto-redirect on auth state change

### Game Flow
- Game creation with personas
- Lobby with real-time player updates
- Full action resolution cycle:
  - Proposal → Argumentation → Voting → Resolution → Narration

### UI/UX
- Dark mode support
- Loading skeletons
- Error boundaries
- Toast notifications
- Mobile responsive

## Data Fetching

Uses TanStack Query for server state:

```tsx
// Fetching data
const { data, isLoading } = useQuery({
  queryKey: ['game', gameId],
  queryFn: () => api.get(`/games/${gameId}`),
  refetchInterval: 5000,  // Polling for updates
});

// Mutations
const mutation = useMutation({
  mutationFn: (data) => api.post('/games', data),
  onSuccess: () => queryClient.invalidateQueries(['games']),
});
```

## Styling

Uses Tailwind CSS with custom configuration:

```tsx
// Using the cn utility for conditional classes
import { cn } from '../utils/cn';

<div className={cn(
  'p-4 rounded-lg',
  isActive && 'bg-primary',
  isDisabled && 'opacity-50'
)} />
```

## Testing

Tests are colocated with components:

```
Component.tsx
Component.test.tsx
```

Run tests:
```bash
# All tests
npm test

# Watch mode
npm test -- --watch

# With coverage
npm test -- --coverage
```

## Environment Variables

### Development

In development, Vite proxies `/api` requests to the backend server (default: `http://localhost:3000`). No environment variables needed.

### Production

For production builds, set `VITE_API_URL` to your API server URL:

```bash
# Build with production API URL
VITE_API_URL=https://your-api-domain.com npm run build
```

The client will automatically append `/api` to the URL. For example:
- `VITE_API_URL=https://api.example.com` → API calls go to `https://api.example.com/api/auth/register`

If `VITE_API_URL` is not set, the client will use relative paths (`/api`), which works when the client and server are served from the same domain.

See `.env.example` for configuration reference.
