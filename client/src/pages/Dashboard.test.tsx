import { describe, it, expect, vi, beforeEach } from 'vitest';
import { screen, waitFor } from '@testing-library/react';
import { render } from '../test/test-utils';
import Dashboard from './Dashboard';
import userEvent from '@testing-library/user-event';

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
    get: (url: string, config?: unknown) => mockGet(url, config),
    post: (url: string, data?: unknown, config?: unknown) => mockPost(url, data, config),
  },
}));

// Mock download utility
const mockDownloadBlob = vi.fn();
vi.mock('../utils/download', () => ({
  downloadBlob: (blob: Blob, filename: string, contentDisposition?: string) =>
    mockDownloadBlob(blob, filename, contentDisposition),
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

  it('should render export button for each game', async () => {
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
        ],
      },
    });

    render(<Dashboard />);

    await waitFor(() => {
      expect(screen.getByText('Test Game 1')).toBeInTheDocument();
      expect(screen.getByLabelText(/export test game 1 as yaml/i)).toBeInTheDocument();
    });
  });

  it('should call export API with correct parameters when export button is clicked', async () => {
    const user = userEvent.setup();

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
        ],
      },
    });

    render(<Dashboard />);

    await waitFor(() => {
      expect(screen.getByText('Test Game 1')).toBeInTheDocument();
    });

    // Mock export API call
    const mockBlob = new Blob(['test yaml content'], { type: 'text/yaml' });
    mockGet.mockResolvedValueOnce({
      data: mockBlob,
      headers: {
        'content-type': 'text/yaml',
        'content-disposition': 'attachment; filename="test-game-1-export.yaml"',
      },
    });

    const exportButton = screen.getByLabelText(/export test game 1 as yaml/i);
    await user.click(exportButton);

    await waitFor(() => {
      expect(mockGet).toHaveBeenCalledWith('/games/game-1/export', {
        responseType: 'blob',
      });
      expect(mockDownloadBlob).toHaveBeenCalledWith(
        expect.any(Blob),
        'Test Game 1-export.yaml',
        'attachment; filename="test-game-1-export.yaml"'
      );
    });
  });

  it('should display error message when export fails', async () => {
    const user = userEvent.setup();

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
        ],
      },
    });

    render(<Dashboard />);

    await waitFor(() => {
      expect(screen.getByText('Test Game 1')).toBeInTheDocument();
    });

    // Mock export API failure
    mockGet.mockRejectedValueOnce({
      response: {
        data: {
          error: {
            message: 'Failed to export game',
          },
        },
      },
    });

    const exportButton = screen.getByLabelText(/export test game 1 as yaml/i);
    await user.click(exportButton);

    await waitFor(() => {
      expect(screen.getByText('Failed to export game')).toBeInTheDocument();
      expect(screen.getByLabelText('Dismiss export error message')).toBeInTheDocument();
    });
  });

  it('should dismiss export error when dismiss button is clicked', async () => {
    const user = userEvent.setup();

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
        ],
      },
    });

    render(<Dashboard />);

    await waitFor(() => {
      expect(screen.getByText('Test Game 1')).toBeInTheDocument();
    });

    // Mock export API failure
    mockGet.mockRejectedValueOnce({
      response: {
        data: {
          error: {
            message: 'Failed to export game',
          },
        },
      },
    });

    const exportButton = screen.getByLabelText(/export test game 1 as yaml/i);
    await user.click(exportButton);

    await waitFor(() => {
      expect(screen.getByText('Failed to export game')).toBeInTheDocument();
    });

    // Click dismiss button
    const dismissButton = screen.getByLabelText('Dismiss export error message');
    await user.click(dismissButton);

    await waitFor(() => {
      expect(screen.queryByText('Failed to export game')).not.toBeInTheDocument();
    });
  });
});
