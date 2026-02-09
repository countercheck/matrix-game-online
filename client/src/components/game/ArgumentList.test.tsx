import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ArgumentList } from './ArgumentList';

// Mock API
const mockGet = vi.fn();
vi.mock('../../services/api', () => ({
  api: {
    get: (url: string) => mockGet(url),
  },
}));

// Mock formatRelativeTime
vi.mock('../../utils/formatTime', () => ({
  formatRelativeTime: vi.fn(() => {
    // Return a predictable format for testing
    return '5m ago';
  }),
}));

function createWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });

  return function Wrapper({ children }: { children: React.ReactNode }) {
    return (
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    );
  };
}

describe('ArgumentList', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should show loading state initially', () => {
    mockGet.mockImplementation(() => new Promise(() => {}));

    render(<ArgumentList actionId="action-123" />, { wrapper: createWrapper() });

    expect(screen.getByText(/loading arguments/i)).toBeInTheDocument();
  });

  it('should show empty state when no arguments', async () => {
    mockGet.mockResolvedValue({ data: { data: [] } });

    render(<ArgumentList actionId="action-123" />, { wrapper: createWrapper() });

    await waitFor(() => {
      expect(screen.getByText(/no arguments yet/i)).toBeInTheDocument();
    });
  });

  it('should render arguments when data is loaded', async () => {
    const mockArguments = [
      {
        id: 'arg-1',
        argumentType: 'FOR',
        content: 'This is a good idea',
        sequence: 1,
        createdAt: new Date().toISOString(),
        player: {
          id: 'player-1',
          playerName: 'Alice',
          user: { displayName: 'Alice Smith' },
        },
      },
      {
        id: 'arg-2',
        argumentType: 'AGAINST',
        content: 'I disagree with this',
        sequence: 2,
        createdAt: new Date().toISOString(),
        player: {
          id: 'player-2',
          playerName: 'Bob',
          user: { displayName: 'Bob Jones' },
        },
      },
    ];

    mockGet.mockResolvedValue({ data: { data: mockArguments } });

    render(<ArgumentList actionId="action-123" />, { wrapper: createWrapper() });

    await waitFor(() => {
      expect(screen.getByText('This is a good idea')).toBeInTheDocument();
      expect(screen.getByText('I disagree with this')).toBeInTheDocument();
    });
  });

  it('should display player names', async () => {
    const mockArguments = [
      {
        id: 'arg-1',
        argumentType: 'FOR',
        content: 'Test content',
        sequence: 1,
        createdAt: new Date().toISOString(),
        player: {
          id: 'player-1',
          playerName: 'TestPlayer',
          user: { displayName: 'Test User' },
        },
      },
    ];

    mockGet.mockResolvedValue({ data: { data: mockArguments } });

    render(<ArgumentList actionId="action-123" />, { wrapper: createWrapper() });

    await waitFor(() => {
      expect(screen.getByText('TestPlayer')).toBeInTheDocument();
    });
  });

  it('should display argument type badges', async () => {
    const mockArguments = [
      {
        id: 'arg-1',
        argumentType: 'FOR',
        content: 'Supporting this proposal',
        sequence: 1,
        createdAt: new Date().toISOString(),
        player: { id: 'p1', playerName: 'P1', user: { displayName: 'P1' } },
      },
      {
        id: 'arg-2',
        argumentType: 'AGAINST',
        content: 'Opposing this proposal',
        sequence: 2,
        createdAt: new Date().toISOString(),
        player: { id: 'p2', playerName: 'P2', user: { displayName: 'P2' } },
      },
      {
        id: 'arg-3',
        argumentType: 'CLARIFICATION',
        content: 'Requesting more info',
        sequence: 3,
        createdAt: new Date().toISOString(),
        player: { id: 'p3', playerName: 'P3', user: { displayName: 'P3' } },
      },
    ];

    mockGet.mockResolvedValue({ data: { data: mockArguments } });

    render(<ArgumentList actionId="action-123" />, { wrapper: createWrapper() });

    // Wait for content to load first
    await screen.findByText('Supporting this proposal');

    // Then check for badges - use getAllByText since there may be multiple matches
    expect(screen.getByText('For')).toBeInTheDocument();
    expect(screen.getByText('Against')).toBeInTheDocument();
    expect(screen.getByText('Clarification')).toBeInTheDocument();
  });

  it('should show error state on fetch failure', async () => {
    mockGet.mockRejectedValue(new Error('Network error'));

    render(<ArgumentList actionId="action-123" />, { wrapper: createWrapper() });

    await waitFor(() => {
      expect(screen.getByText(/failed to load arguments/i)).toBeInTheDocument();
    });
  });

  it('should display argument count in header', async () => {
    const mockArguments = [
      {
        id: 'arg-1',
        argumentType: 'FOR',
        content: 'Test 1',
        sequence: 1,
        createdAt: new Date().toISOString(),
        player: { id: 'p1', playerName: 'P1', user: { displayName: 'P1' } },
      },
      {
        id: 'arg-2',
        argumentType: 'AGAINST',
        content: 'Test 2',
        sequence: 2,
        createdAt: new Date().toISOString(),
        player: { id: 'p2', playerName: 'P2', user: { displayName: 'P2' } },
      },
    ];

    mockGet.mockResolvedValue({ data: { data: mockArguments } });

    render(<ArgumentList actionId="action-123" />, { wrapper: createWrapper() });

    await waitFor(() => {
      expect(screen.getByText(/arguments \(2\)/i)).toBeInTheDocument();
    });
  });

  it('should call API with correct action ID', async () => {
    mockGet.mockResolvedValue({ data: { data: [] } });

    render(<ArgumentList actionId="test-action-id" />, { wrapper: createWrapper() });

    await waitFor(() => {
      expect(mockGet).toHaveBeenCalledWith('/actions/test-action-id/arguments');
    });
  });

  it('should display relative timestamps for arguments', async () => {
    const mockArguments = [
      {
        id: 'arg-1',
        argumentType: 'FOR',
        content: 'Supporting argument',
        sequence: 1,
        createdAt: new Date().toISOString(),
        player: {
          id: 'player-1',
          playerName: 'Alice',
          user: { displayName: 'Alice Smith' },
        },
      },
      {
        id: 'arg-2',
        argumentType: 'AGAINST',
        content: 'Counter argument',
        sequence: 2,
        createdAt: new Date().toISOString(),
        player: {
          id: 'player-2',
          playerName: 'Bob',
          user: { displayName: 'Bob Jones' },
        },
      },
    ];

    mockGet.mockResolvedValue({ data: { data: mockArguments } });

    render(<ArgumentList actionId="action-123" />, { wrapper: createWrapper() });

    await waitFor(() => {
      // Check that relative timestamps are displayed (mocked to return '5m ago')
      const timestamps = screen.getAllByText('5m ago');
      expect(timestamps).toHaveLength(2);
    });
  });

  it('should show edit buttons when isHost is true', async () => {
    const mockArguments = [
      {
        id: 'arg-1',
        argumentType: 'FOR',
        content: 'Test content',
        sequence: 1,
        createdAt: new Date().toISOString(),
        player: { id: 'p1', playerName: 'Alice', user: { displayName: 'Alice' } },
      },
    ];

    mockGet.mockResolvedValue({ data: { data: mockArguments } });

    render(<ArgumentList actionId="action-123" gameId="game-1" isHost={true} />, {
      wrapper: createWrapper(),
    });

    await waitFor(() => {
      expect(screen.getByTitle('Edit argument (host)')).toBeInTheDocument();
    });
  });

  it('should not show edit buttons when isHost is false', async () => {
    const mockArguments = [
      {
        id: 'arg-1',
        argumentType: 'FOR',
        content: 'Test content',
        sequence: 1,
        createdAt: new Date().toISOString(),
        player: { id: 'p1', playerName: 'Alice', user: { displayName: 'Alice' } },
      },
    ];

    mockGet.mockResolvedValue({ data: { data: mockArguments } });

    render(<ArgumentList actionId="action-123" />, { wrapper: createWrapper() });

    await waitFor(() => {
      expect(screen.getByText('Test content')).toBeInTheDocument();
    });

    expect(screen.queryByTitle('Edit argument (host)')).not.toBeInTheDocument();
  });
});
