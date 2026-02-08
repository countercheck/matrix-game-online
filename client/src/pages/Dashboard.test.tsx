import { describe, it, expect, vi, beforeEach } from 'vitest';
import { screen, waitFor } from '@testing-library/react';
import { render } from '../test/test-utils';
import Dashboard from './Dashboard';

// Mock useAuth
vi.mock('../hooks/useAuth', () => ({
  useAuth: () => ({
    user: { id: 'user-1', email: 'test@example.com', displayName: 'Test User' },
  }),
  AuthProvider: ({ children }: { children: React.ReactNode }) => children,
}));

// Mock API
const mockGet = vi.fn();
vi.mock('../services/api', () => ({
  api: {
    get: (url: string) => mockGet(url),
  },
}));

describe('Dashboard Page', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should show loading state initially', () => {
    mockGet.mockImplementation(() => new Promise(() => {}));
    const { container } = render(<Dashboard />);

    // Skeleton loading components are shown
    expect(container.querySelector('.animate-pulse')).toBeInTheDocument();
  });

  it('should display game cards', async () => {
    mockGet.mockResolvedValue({
      data: {
        data: [
          {
            id: 'game-1',
            name: 'Test Game 1',
            status: 'ACTIVE',
            currentPhase: 'PROPOSAL',
            playerCount: 3,
            playerName: 'Player 1',
            isHost: true,
            updatedAt: '2024-01-01T00:00:00Z',
          },
          {
            id: 'game-2',
            name: 'Test Game 2',
            status: 'LOBBY',
            playerCount: 2,
            playerName: 'Player 2',
            isHost: false,
            updatedAt: '2024-01-02T00:00:00Z',
          },
        ],
      },
    });

    render(<Dashboard />);

    await waitFor(() => {
      expect(screen.getByText('Test Game 1')).toBeInTheDocument();
      expect(screen.getByText('Test Game 2')).toBeInTheDocument();
    });
  });

  it('should show empty state when no games', async () => {
    mockGet.mockResolvedValue({
      data: {
        data: [],
      },
    });

    render(<Dashboard />);

    await waitFor(() => {
      expect(screen.getByText(/no games yet/i)).toBeInTheDocument();
    });
  });

  it('should render markdown in game descriptions', async () => {
    mockGet.mockResolvedValue({
      data: {
        data: [
          {
            id: 'game-1',
            name: 'Markdown Game',
            description: 'A game with **bold text** and *italic text*.',
            status: 'LOBBY',
            playerCount: 2,
            playerName: 'Player 1',
            isHost: true,
            updatedAt: '2024-01-01T00:00:00Z',
          },
        ],
      },
    });

    const { container } = render(<Dashboard />);

    await waitFor(() => {
      // Check that markdown is rendered, not raw syntax
      expect(screen.getByText(/A game with/i)).toBeInTheDocument();
      
      // Verify bold and italic elements are present
      const boldElement = container.querySelector('strong');
      const italicElement = container.querySelector('em');
      
      expect(boldElement).toBeInTheDocument();
      expect(boldElement?.textContent).toBe('bold text');
      expect(italicElement).toBeInTheDocument();
      expect(italicElement?.textContent).toBe('italic text');
      
      // Verify raw markdown syntax is NOT displayed
      expect(screen.queryByText(/\*\*bold text\*\*/)).not.toBeInTheDocument();
      expect(screen.queryByText(/\*italic text\*/)).not.toBeInTheDocument();
    });
  });

  it('should not render links in game descriptions to avoid nested anchors', async () => {
    mockGet.mockResolvedValue({
      data: {
        data: [
          {
            id: 'game-1',
            name: 'Link Game',
            description: 'Check out [this link](https://example.com) and https://auto-link.com',
            status: 'LOBBY',
            playerCount: 2,
            playerName: 'Player 1',
            isHost: true,
            updatedAt: '2024-01-01T00:00:00Z',
          },
        ],
      },
    });

    const { container } = render(<Dashboard />);

    await waitFor(() => {
      // Verify links are rendered as plain text (span) not anchors
      const anchorElements = container.querySelectorAll('article a');
      
      // Should not have any <a> elements inside the article (game card)
      // The outer Link is present, but no nested links in description
      expect(anchorElements.length).toBe(0);
      
      // Verify the link text is still present
      expect(screen.getByText(/this link/i)).toBeInTheDocument();
    });
  });

  it('should display game status badges', async () => {
    mockGet.mockResolvedValue({
      data: {
        data: [
          {
            id: 'game-1',
            name: 'Active Game',
            status: 'ACTIVE',
            currentPhase: 'PROPOSAL',
            playerCount: 3,
            playerName: 'Player 1',
            isHost: true,
            updatedAt: '2024-01-01T00:00:00Z',
          },
          {
            id: 'game-2',
            name: 'Lobby Game',
            status: 'LOBBY',
            playerCount: 2,
            playerName: 'Player 2',
            isHost: false,
            updatedAt: '2024-01-02T00:00:00Z',
          },
        ],
      },
    });

    render(<Dashboard />);

    await waitFor(() => {
      expect(screen.getByText('ACTIVE')).toBeInTheDocument();
      expect(screen.getByText('LOBBY')).toBeInTheDocument();
    });
  });

  it('should show host badge for games where user is host', async () => {
    mockGet.mockResolvedValue({
      data: {
        data: [
          {
            id: 'game-1',
            name: 'My Game',
            status: 'LOBBY',
            playerCount: 2,
            playerName: 'Player 1',
            isHost: true,
            updatedAt: '2024-01-01T00:00:00Z',
          },
        ],
      },
    });

    render(<Dashboard />);

    await waitFor(() => {
      expect(screen.getByText('Host')).toBeInTheDocument();
    });
  });

  it('should handle error state', async () => {
    mockGet.mockRejectedValue(new Error('Failed to fetch'));

    render(<Dashboard />);

    await waitFor(() => {
      expect(screen.getByText(/failed to load games/i)).toBeInTheDocument();
    });
  });

  it('should allow markdown elements in game descriptions to use default prose styling', async () => {
    mockGet.mockResolvedValue({
      data: {
        data: [
          {
            id: 'game-1',
            name: 'Test Game',
            description: '## Quest\n\nFind the [ancient artifact](https://example.com)',
            status: 'LOBBY',
            currentPhase: 'WAITING',
            playerCount: 2,
            playerName: 'Player 1',
            isHost: true,
            updatedAt: '2024-01-01T00:00:00Z',
          },
        ],
      },
    });

    const { container } = render(<Dashboard />);

    await waitFor(() => {
      expect(screen.getByText('Test Game')).toBeInTheDocument();
    });

    // Find the RichTextDisplay wrapper within the game card
    const proseElement = container.querySelector('.prose');
    expect(proseElement).toBeInTheDocument();
    
    // Verify the wrapper className doesn't override non-paragraph markdown elements
    // The bug was that [&_h2]:text-muted-foreground etc. were neutralizing distinct styling
    const className = proseElement?.className || '';
    expect(className).not.toContain('[&_h2]:text-muted-foreground');
    expect(className).not.toContain('[&_h3]:text-muted-foreground');
    expect(className).not.toContain('[&_li]:text-muted-foreground');
    expect(className).not.toContain('[&_blockquote]:text-muted-foreground');
  });
});
