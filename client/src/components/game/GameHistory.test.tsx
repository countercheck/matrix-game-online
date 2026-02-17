import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { GameHistory } from './GameHistory';

// Mock API
const mockGet = vi.fn();
vi.mock('../../services/api', () => ({
  api: {
    get: (url: string) => mockGet(url),
    put: vi.fn(),
  },
}));

// Mock formatRelativeTime
vi.mock('../../utils/formatTime', () => ({
  formatRelativeTime: vi.fn(() => '5m ago'),
}));

// Mock RichTextDisplay to render plain text (avoids react-markdown dep issues)
vi.mock('../ui/RichTextDisplay', () => ({
  RichTextDisplay: ({ content }: { content: string }) => <span>{content}</span>,
}));

// Mock edit modals to avoid rendering complexity
vi.mock('./EditActionModal', () => ({
  EditActionModal: () => null,
}));
vi.mock('./EditArgumentModal', () => ({
  EditArgumentModal: () => null,
}));
vi.mock('./EditNarrationModal', () => ({
  EditNarrationModal: () => null,
}));

function createWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });

  return function Wrapper({ children }: { children: React.ReactNode }) {
    return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
  };
}

const mockActions = [
  {
    id: 'action-1',
    sequenceNumber: 1,
    actionDescription: 'Storm the castle',
    desiredOutcome: 'Capture the flag',
    proposedAt: new Date().toISOString(),
    initiator: {
      playerName: 'Alice',
      user: { displayName: 'Alice Smith' },
    },
    arguments: [],
    voteTotals: {
      totalSuccessTokens: 3,
      totalFailureTokens: 1,
      voteCount: 2,
    },
    tokenDraw: {
      resultValue: 3,
      resultType: 'TRIUMPH' as const,
      drawnSuccess: 3,
      drawnFailure: 0,
      drawnAt: new Date().toISOString(),
    },
    narration: {
      content: 'The castle was stormed successfully.',
      createdAt: new Date().toISOString(),
    },
  },
];

describe('GameHistory', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should show loading state initially', () => {
    mockGet.mockImplementation(() => new Promise(() => {}));

    render(<GameHistory gameId="game-1" compact />, { wrapper: createWrapper() });

    expect(document.querySelector('.animate-pulse')).toBeInTheDocument();
  });

  it('should show empty state when no actions', async () => {
    mockGet.mockResolvedValue({ data: { data: [] } });

    render(<GameHistory gameId="game-1" compact />, { wrapper: createWrapper() });

    await waitFor(() => {
      expect(screen.getByText(/no completed actions yet/i)).toBeInTheDocument();
    });
  });

  describe('compact mode expand/collapse', () => {
    it('should show compact collapsed view with action description', async () => {
      mockGet.mockResolvedValue({ data: { data: mockActions } });

      render(<GameHistory gameId="game-1" compact />, { wrapper: createWrapper() });

      await waitFor(() => {
        expect(screen.getByText('Storm the castle')).toBeInTheDocument();
      });

      // Should show compact summary, not full expanded details
      expect(screen.getByText('Alice')).toBeInTheDocument();
      expect(screen.queryByText('Triumph')).not.toBeInTheDocument();
    });

    it('should not expand when clicking the card body', async () => {
      const user = userEvent.setup();
      mockGet.mockResolvedValue({ data: { data: mockActions } });

      render(<GameHistory gameId="game-1" compact />, { wrapper: createWrapper() });

      await waitFor(() => {
        expect(screen.getByText('Storm the castle')).toBeInTheDocument();
      });

      // Click the action description text (card body)
      await user.click(screen.getByText('Storm the castle'));

      // Should remain collapsed — "Triumph" label only shows in expanded view
      expect(screen.queryByText('Triumph')).not.toBeInTheDocument();
    });

    it('should expand when clicking the expand chevron button', async () => {
      const user = userEvent.setup();
      mockGet.mockResolvedValue({ data: { data: mockActions } });

      render(<GameHistory gameId="game-1" compact />, { wrapper: createWrapper() });

      await waitFor(() => {
        expect(screen.getByText('Storm the castle')).toBeInTheDocument();
      });

      // Click the expand chevron
      await user.click(screen.getByLabelText('Expand action'));

      // Should now show expanded details
      await waitFor(() => {
        expect(screen.getByText('Triumph')).toBeInTheDocument();
      });
    });

    it('should collapse when clicking the collapse chevron button', async () => {
      const user = userEvent.setup();
      mockGet.mockResolvedValue({ data: { data: mockActions } });

      render(<GameHistory gameId="game-1" compact />, { wrapper: createWrapper() });

      await waitFor(() => {
        expect(screen.getByText('Storm the castle')).toBeInTheDocument();
      });

      // Expand first
      await user.click(screen.getByLabelText('Expand action'));
      await waitFor(() => {
        expect(screen.getByText('Triumph')).toBeInTheDocument();
      });

      // Click the collapse chevron
      await user.click(screen.getByLabelText('Collapse action'));

      // Should return to collapsed state
      await waitFor(() => {
        expect(screen.queryByText('Triumph')).not.toBeInTheDocument();
      });
    });

    it('should not have cursor-pointer on the card container', async () => {
      mockGet.mockResolvedValue({ data: { data: mockActions } });

      const { container } = render(<GameHistory gameId="game-1" compact />, {
        wrapper: createWrapper(),
      });

      await waitFor(() => {
        expect(screen.getByText('Storm the castle')).toBeInTheDocument();
      });

      // The card container should not have cursor-pointer class
      const card = container.querySelector('.bg-muted\\/30');
      expect(card?.className).not.toContain('cursor-pointer');
    });
  });

  describe('full (non-compact) mode', () => {
    it('should render expanded view by default without chevron buttons', async () => {
      mockGet.mockResolvedValue({ data: { data: mockActions } });

      render(<GameHistory gameId="game-1" />, { wrapper: createWrapper() });

      await waitFor(() => {
        expect(screen.getByText('Triumph')).toBeInTheDocument();
      });

      // No expand/collapse chevrons in full mode
      expect(screen.queryByLabelText('Expand action')).not.toBeInTheDocument();
      expect(screen.queryByLabelText('Collapse action')).not.toBeInTheDocument();
    });
  });
});
