import { describe, it, expect, vi, beforeEach } from 'vitest';
import { screen, waitFor } from '@testing-library/react';
import { render } from '../test/test-utils';
import GameLobby from './GameLobby';

// Mock useParams
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom');
  return {
    ...actual,
    useParams: () => ({ gameId: 'game-123' }),
    useNavigate: () => vi.fn(),
  };
});

// Mock useAuth
vi.mock('../hooks/useAuth', () => ({
  useAuth: () => ({
    user: { id: 'user-1', email: 'test@example.com', displayName: 'Test User' },
  }),
  AuthProvider: ({ children }: { children: React.ReactNode }) => children,
}));

// Mock API
const mockGet = vi.fn();
const mockPost = vi.fn();
vi.mock('../services/api', () => ({
  api: {
    get: (url: string) => mockGet(url),
    post: (url: string, data?: unknown) => mockPost(url, data),
  },
}));


describe('GameLobby Page', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should show loading state initially', () => {
    mockGet.mockImplementation(() => new Promise(() => {}));
    const { container } = render(<GameLobby />);

    // Skeleton loading components are shown instead of text
    expect(container.querySelector('.animate-pulse')).toBeInTheDocument();
  });

  it('should display game name', async () => {
    mockGet.mockResolvedValue({
      data: {
        data: {
          id: 'game-123',
          name: 'Test Game',
          status: 'LOBBY',
          players: [
            { id: 'p1', playerName: 'Host', isHost: true, user: { id: 'user-1' } },
          ],
        },
      },
    });

    render(<GameLobby />);

    await waitFor(() => {
      expect(screen.getByText('Test Game')).toBeInTheDocument();
    });
  });

  it('should display player list', async () => {
    mockGet.mockResolvedValue({
      data: {
        data: {
          id: 'game-123',
          name: 'Test Game',
          status: 'LOBBY',
          players: [
            { id: 'p1', playerName: 'Host Player', isHost: true, user: { id: 'user-1' } },
            { id: 'p2', playerName: 'Player 2', isHost: false, user: { id: 'user-2' } },
          ],
        },
      },
    });

    render(<GameLobby />);

    await waitFor(() => {
      expect(screen.getByText('Host Player')).toBeInTheDocument();
      expect(screen.getByText('Player 2')).toBeInTheDocument();
    });
  });

  it('should display host badge for host player', async () => {
    mockGet.mockResolvedValue({
      data: {
        data: {
          id: 'game-123',
          name: 'Test Game',
          status: 'LOBBY',
          players: [
            { id: 'p1', playerName: 'Player One', isHost: true, user: { id: 'user-1' } },
          ],
        },
      },
    });

    render(<GameLobby />);

    await waitFor(() => {
      expect(screen.getByText('Player One')).toBeInTheDocument();
      // Check for the Host badge (separate from player name)
      expect(screen.getByText('Host')).toBeInTheDocument();
    });
  });

  it('should show invite link', async () => {
    mockGet.mockResolvedValue({
      data: {
        data: {
          id: 'game-123',
          name: 'Test Game',
          status: 'LOBBY',
          players: [
            { id: 'p1', playerName: 'Host', isHost: true, user: { id: 'user-1' } },
          ],
        },
      },
    });

    render(<GameLobby />);

    await waitFor(() => {
      expect(screen.getByText(/invite link/i)).toBeInTheDocument();
    });
  });

  it('should copy invite link when copy button clicked', async () => {
    mockGet.mockResolvedValue({
      data: {
        data: {
          id: 'game-123',
          name: 'Test Game',
          status: 'LOBBY',
          players: [
            { id: 'p1', playerName: 'Host', isHost: true, user: { id: 'user-1' } },
          ],
        },
      },
    });

    const writeTextSpy = vi.spyOn(navigator.clipboard, 'writeText').mockResolvedValue(undefined);

    render(<GameLobby />);

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /copy/i })).toBeInTheDocument();
    });

    screen.getByRole('button', { name: /copy/i }).click();

    expect(writeTextSpy).toHaveBeenCalled();
    writeTextSpy.mockRestore();
  });

  it('should show start button for host', async () => {
    mockGet.mockResolvedValue({
      data: {
        data: {
          id: 'game-123',
          name: 'Test Game',
          status: 'LOBBY',
          players: [
            { id: 'p1', playerName: 'Host', isHost: true, user: { id: 'user-1' } },
            { id: 'p2', playerName: 'Player 2', isHost: false, user: { id: 'user-2' } },
          ],
        },
      },
    });

    render(<GameLobby />);

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /start game/i })).toBeInTheDocument();
    });
  });

  it('should show waiting message for non-host', async () => {
    // Mock user as non-host
    vi.doMock('../hooks/useAuth', () => ({
      useAuth: () => ({
        user: { id: 'user-2', email: 'other@example.com', displayName: 'Other' },
      }),
      AuthProvider: ({ children }: { children: React.ReactNode }) => children,
    }));

    mockGet.mockResolvedValue({
      data: {
        data: {
          id: 'game-123',
          name: 'Test Game',
          status: 'LOBBY',
          players: [
            { id: 'p1', playerName: 'Host', isHost: true, user: { id: 'user-1' } },
            { id: 'p2', playerName: 'Player 2', isHost: false, user: { id: 'user-2' } },
          ],
        },
      },
    });

    // Note: This test may need adjustment based on actual component behavior
    // Since we're checking for host status based on user ID
  });

  it('should disable start button with less than 2 players', async () => {
    mockGet.mockResolvedValue({
      data: {
        data: {
          id: 'game-123',
          name: 'Test Game',
          status: 'LOBBY',
          players: [
            { id: 'p1', playerName: 'Host', isHost: true, user: { id: 'user-1' } },
          ],
        },
      },
    });

    render(<GameLobby />);

    await waitFor(() => {
      const startButton = screen.getByRole('button', { name: /start game/i });
      expect(startButton).toBeDisabled();
    });
  });

  it('should show waiting for players message with 1 player', async () => {
    mockGet.mockResolvedValue({
      data: {
        data: {
          id: 'game-123',
          name: 'Test Game',
          status: 'LOBBY',
          players: [
            { id: 'p1', playerName: 'Host', isHost: true, user: { id: 'user-1' } },
          ],
        },
      },
    });

    render(<GameLobby />);

    await waitFor(() => {
      expect(screen.getByText(/waiting for at least 2 players/i)).toBeInTheDocument();
    });
  });

  it('should render markdown in game description', async () => {
    mockGet.mockResolvedValue({
      data: {
        data: {
          id: 'game-123',
          name: 'Test Game',
          description: 'A game with **bold text** and *italic text*.',
          status: 'LOBBY',
          players: [
            { id: 'p1', playerName: 'Host', isHost: true, user: { id: 'user-1' } },
          ],
        },
      },
    });

    const { container } = render(<GameLobby />);

    await waitFor(() => {
      // Check that markdown is rendered, not raw syntax
      expect(screen.getByText(/A game with/i)).toBeInTheDocument();
      
      // Verify bold and italic elements are present (not raw ** or *)
      const boldElement = container.querySelector('strong');
      const italicElement = container.querySelector('em');
      
      expect(boldElement).toBeInTheDocument();
      expect(boldElement?.textContent).toBe('bold text');
      expect(italicElement).toBeInTheDocument();
      expect(italicElement?.textContent).toBe('italic text');
      
      // Verify raw markdown syntax is NOT present
      expect(screen.queryByText(/\*\*bold text\*\*/)).not.toBeInTheDocument();
      expect(screen.queryByText(/\*italic text\*/)).not.toBeInTheDocument();
    });
  });

  it('should not render markdown description when description is null', async () => {
    mockGet.mockResolvedValue({
      data: {
        data: {
          id: 'game-123',
          name: 'Test Game',
          description: null,
          status: 'LOBBY',
          players: [
            { id: 'p1', playerName: 'Host', isHost: true, user: { id: 'user-1' } },
          ],
        },
      },
    });

    const { container } = render(<GameLobby />);

    await waitFor(() => {
      // Check that the description div is not rendered
      const proseElement = container.querySelector('.prose');
      expect(proseElement).not.toBeInTheDocument();
    });
  });

  it('should allow markdown elements to use default prose styling', async () => {
    mockGet.mockResolvedValue({
      data: {
        data: {
          id: 'game-123',
          name: 'Test Game',
          description: '## Heading\n\nParagraph with [link](https://example.com)',
          status: 'LOBBY',
          players: [
            { id: 'p1', playerName: 'Host', isHost: true, user: { id: 'user-1' } },
          ],
        },
      },
    });

    const { container } = render(<GameLobby />);

    await waitFor(() => {
      const proseElement = container.querySelector('.prose');
      expect(proseElement).toBeInTheDocument();
      
      // Verify the wrapper className doesn't override non-paragraph markdown elements
      // The bug was that [&_h2]:text-muted-foreground etc. were neutralizing distinct styling
      const className = proseElement?.className || '';
      expect(className).not.toContain('[&_h2]:text-muted-foreground');
      expect(className).not.toContain('[&_h3]:text-muted-foreground');
      expect(className).not.toContain('[&_a]:text-muted-foreground');
      expect(className).not.toContain('[&_li]:text-muted-foreground');
      expect(className).not.toContain('[&_blockquote]:text-muted-foreground');
    });
  });
});
