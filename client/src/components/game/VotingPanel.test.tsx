import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { VotingPanel } from './VotingPanel';

// Mock API
const mockGet = vi.fn();
const mockPost = vi.fn();
vi.mock('../../services/api', () => ({
  api: {
    get: (url: string) => mockGet(url),
    post: (url: string, body: unknown) => mockPost(url, body),
  },
}));

// Mock RichTextDisplay to render plain text
vi.mock('../ui/RichTextDisplay', () => ({
  RichTextDisplay: ({ content }: { content: string }) => <span>{content}</span>,
}));

// Mock formatRelativeTime (used by ArgumentList)
vi.mock('../../utils/formatTime', () => ({
  formatRelativeTime: vi.fn(() => '5m ago'),
}));

// Mock EditArgumentModal (used by ArgumentList)
vi.mock('./EditArgumentModal', () => ({
  EditArgumentModal: () => null,
}));

const mockAction = {
  id: 'action-123',
  actionDescription: 'Storm the castle gates',
  desiredOutcome: 'Gain entry to the fortress',
  initiator: {
    playerName: 'Alice',
  },
};

const mockVoteInfo = {
  hasVoted: false,
  votesSubmitted: 1,
  totalVoters: 3,
};

const mockArguments = [
  {
    id: 'arg-1',
    argumentType: 'FOR',
    content: 'This plan is solid',
    sequence: 1,
    createdAt: new Date().toISOString(),
    player: { id: 'p1', playerName: 'Bob', user: { displayName: 'Bob' } },
  },
  {
    id: 'arg-2',
    argumentType: 'AGAINST',
    content: 'Too risky at night',
    sequence: 2,
    createdAt: new Date().toISOString(),
    player: { id: 'p2', playerName: 'Carol', user: { displayName: 'Carol' } },
  },
];

function createWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return function Wrapper({ children }: { children: React.ReactNode }) {
    return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
  };
}

function setupMocks({
  voteInfo = mockVoteInfo,
  args = mockArguments,
}: {
  voteInfo?: typeof mockVoteInfo & { myVote?: { voteType: string } };
  args?: typeof mockArguments;
} = {}) {
  mockGet.mockImplementation((url: string) => {
    if (url === `/actions/${mockAction.id}/votes`) {
      return Promise.resolve({ data: { data: voteInfo } });
    }
    if (url === `/actions/${mockAction.id}/arguments`) {
      return Promise.resolve({ data: { data: args } });
    }
    return Promise.reject(new Error(`Unexpected GET: ${url}`));
  });
}

describe('VotingPanel', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('action proposal', () => {
    it('shows action description', async () => {
      setupMocks();
      render(<VotingPanel gameId="game-1" action={mockAction} />, {
        wrapper: createWrapper(),
      });

      expect(screen.getByText('Storm the castle gates')).toBeInTheDocument();
    });

    it('shows desired outcome', async () => {
      setupMocks();
      render(<VotingPanel gameId="game-1" action={mockAction} />, {
        wrapper: createWrapper(),
      });

      expect(screen.getByText('Gain entry to the fortress')).toBeInTheDocument();
    });

    it('shows proposer name', async () => {
      setupMocks();
      render(<VotingPanel gameId="game-1" action={mockAction} />, {
        wrapper: createWrapper(),
      });

      expect(screen.getByText(/Proposed by Alice/)).toBeInTheDocument();
    });
  });

  describe('arguments section', () => {
    it('renders arguments from the argumentation phase', async () => {
      setupMocks();
      render(<VotingPanel gameId="game-1" action={mockAction} />, {
        wrapper: createWrapper(),
      });

      await waitFor(() => {
        expect(screen.getByText('This plan is solid')).toBeInTheDocument();
        expect(screen.getByText('Too risky at night')).toBeInTheDocument();
      });
    });

    it('shows argument author names', async () => {
      setupMocks();
      render(<VotingPanel gameId="game-1" action={mockAction} />, {
        wrapper: createWrapper(),
      });

      await waitFor(() => {
        expect(screen.getByText('Bob')).toBeInTheDocument();
        expect(screen.getByText('Carol')).toBeInTheDocument();
      });
    });

    it('shows FOR and AGAINST badges', async () => {
      setupMocks();
      render(<VotingPanel gameId="game-1" action={mockAction} />, {
        wrapper: createWrapper(),
      });

      await waitFor(() => {
        expect(screen.getByText('For')).toBeInTheDocument();
        expect(screen.getByText('Against')).toBeInTheDocument();
      });
    });

    it('shows argument count in header', async () => {
      setupMocks();
      render(<VotingPanel gameId="game-1" action={mockAction} />, {
        wrapper: createWrapper(),
      });

      await waitFor(() => {
        expect(screen.getByText(/Arguments \(2\)/i)).toBeInTheDocument();
      });
    });

    it('shows empty state when there are no arguments', async () => {
      setupMocks({ args: [] });
      render(<VotingPanel gameId="game-1" action={mockAction} />, {
        wrapper: createWrapper(),
      });

      await waitFor(() => {
        expect(screen.getByText(/no arguments yet/i)).toBeInTheDocument();
      });
    });

    it('does not show edit buttons on arguments (read-only during voting)', async () => {
      setupMocks();
      render(<VotingPanel gameId="game-1" action={mockAction} />, {
        wrapper: createWrapper(),
      });

      await waitFor(() => {
        expect(screen.getByText('This plan is solid')).toBeInTheDocument();
      });

      expect(screen.queryByTitle('Edit argument (host)')).not.toBeInTheDocument();
    });

    it('fetches arguments using the correct action ID', async () => {
      setupMocks();
      render(<VotingPanel gameId="game-1" action={mockAction} />, {
        wrapper: createWrapper(),
      });

      await waitFor(() => {
        expect(mockGet).toHaveBeenCalledWith(`/actions/${mockAction.id}/arguments`);
      });
    });
  });

  describe('voting status', () => {
    it('shows vote count when vote info is loaded', async () => {
      setupMocks();
      render(<VotingPanel gameId="game-1" action={mockAction} />, {
        wrapper: createWrapper(),
      });

      await waitFor(() => {
        expect(screen.getByText('1 / 3')).toBeInTheDocument();
      });
    });
  });

  describe('voting controls', () => {
    it('shows vote options when user has not voted', async () => {
      setupMocks();
      render(<VotingPanel gameId="game-1" action={mockAction} />, {
        wrapper: createWrapper(),
      });

      await waitFor(() => {
        expect(screen.getByText('Likely to Succeed')).toBeInTheDocument();
        expect(screen.getByText('Uncertain')).toBeInTheDocument();
        expect(screen.getByText('Likely to Fail')).toBeInTheDocument();
      });
    });

    it('shows submit button when a vote option is selected', async () => {
      setupMocks();
      const user = userEvent.setup();
      render(<VotingPanel gameId="game-1" action={mockAction} />, {
        wrapper: createWrapper(),
      });

      await waitFor(() => {
        expect(screen.getByText('Likely to Succeed')).toBeInTheDocument();
      });

      await user.click(screen.getByRole('radio', { name: /Likely to Succeed/i }));
      expect(screen.getByRole('button', { name: /Submit Vote/i })).not.toBeDisabled();
    });

    it('shows confirmation when user has already voted', async () => {
      setupMocks({
        voteInfo: {
          hasVoted: true,
          myVote: { voteType: 'LIKELY_SUCCESS' },
          votesSubmitted: 2,
          totalVoters: 3,
        },
      });

      render(<VotingPanel gameId="game-1" action={mockAction} />, {
        wrapper: createWrapper(),
      });

      await waitFor(() => {
        expect(screen.getByText('Vote Submitted')).toBeInTheDocument();
        expect(screen.getByText(/Likely to Succeed/)).toBeInTheDocument();
      });
    });

    it('shows Submit Vote button as disabled when no vote is selected', async () => {
      setupMocks();
      render(<VotingPanel gameId="game-1" action={mockAction} />, {
        wrapper: createWrapper(),
      });

      await waitFor(() => {
        expect(screen.getByRole('button', { name: /Submit Vote/i })).toBeDisabled();
      });
    });
  });
});
