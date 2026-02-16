import { describe, it, expect, vi, beforeEach } from 'vitest';
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { render } from '../test/test-utils';
import CreateGame from './CreateGame';

// Mock useNavigate
const mockNavigate = vi.fn();
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom');
  return {
    ...actual,
    useNavigate: () => mockNavigate,
  };
});

// Mock API
const mockPost = vi.fn();
vi.mock('../services/api', () => ({
  api: {
    post: (url: string, data: unknown, config?: unknown) => mockPost(url, data, config),
  },
}));

describe('CreateGame Page', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockPost.mockReset();

    // Mock URL.createObjectURL for image preview
    globalThis.URL.createObjectURL = vi.fn(() => 'blob:mock-url');
    globalThis.URL.revokeObjectURL = vi.fn();
  });

  it('should render create game form', () => {
    render(<CreateGame />);

    expect(screen.getByLabelText(/game name/i)).toBeInTheDocument();
    expect(screen.getByText(/description/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /create game/i })).toBeInTheDocument();
  });

  it('should render cancel button', () => {
    render(<CreateGame />);

    expect(screen.getByRole('button', { name: /cancel/i })).toBeInTheDocument();
  });

  it('should update game name input on change', async () => {
    const user = userEvent.setup();
    render(<CreateGame />);

    const nameInput = screen.getByLabelText(/game name/i);
    await user.type(nameInput, 'My Awesome Game');

    expect(nameInput).toHaveValue('My Awesome Game');
  });

  it('should call API on form submit', async () => {
    mockPost.mockResolvedValue({
      data: { data: { id: 'game-123' } },
    });
    const user = userEvent.setup();
    render(<CreateGame />);

    await user.type(screen.getByLabelText(/game name/i), 'Test Game');
    await user.click(screen.getByRole('button', { name: /create game/i }));

    await waitFor(() => {
      expect(mockPost).toHaveBeenCalledWith(
        '/games',
        {
          name: 'Test Game',
          description: undefined,
          settings: {
            proposalTimeoutHours: -1,
            argumentationTimeoutHours: -1,
            votingTimeoutHours: -1,
            narrationTimeoutHours: -1,
          },
        },
        undefined
      );
    });
  });

  it('should navigate to lobby on successful creation', async () => {
    mockPost.mockResolvedValue({
      data: { data: { id: 'game-123' } },
    });
    const user = userEvent.setup();
    render(<CreateGame />);

    await user.type(screen.getByLabelText(/game name/i), 'Test Game');
    await user.click(screen.getByRole('button', { name: /create game/i }));

    await waitFor(() => {
      expect(mockNavigate).toHaveBeenCalledWith('/game/game-123/lobby');
    });
  });

  it('should display error on creation failure', async () => {
    mockPost.mockRejectedValue({
      response: { data: { error: { message: 'Game name already exists' } } },
    });
    const user = userEvent.setup();
    render(<CreateGame />);

    await user.type(screen.getByLabelText(/game name/i), 'Test Game');
    await user.click(screen.getByRole('button', { name: /create game/i }));

    await waitFor(() => {
      expect(screen.getByText(/game name already exists/i)).toBeInTheDocument();
    });
  });

  it('should navigate home on cancel', async () => {
    const user = userEvent.setup();
    render(<CreateGame />);

    await user.click(screen.getByRole('button', { name: /cancel/i }));

    expect(mockNavigate).toHaveBeenCalledWith('/');
  });

  it('should disable submit button when name is empty', () => {
    render(<CreateGame />);

    const submitButton = screen.getByRole('button', { name: /create game/i });
    expect(submitButton).toBeDisabled();
  });

  it('should enable submit button when name is provided', async () => {
    const user = userEvent.setup();
    render(<CreateGame />);

    await user.type(screen.getByLabelText(/game name/i), 'My Game');

    const submitButton = screen.getByRole('button', { name: /create game/i });
    expect(submitButton).not.toBeDisabled();
  });

  it('should show loading state while creating', async () => {
    mockPost.mockImplementation(() => new Promise(() => {}));
    const user = userEvent.setup();
    render(<CreateGame />);

    await user.type(screen.getByLabelText(/game name/i), 'Test Game');
    await user.click(screen.getByRole('button', { name: /create game/i }));

    expect(screen.getByRole('button', { name: /creating/i })).toBeInTheDocument();
  });

  it('should upload image with FormData and Content-Type undefined when image is selected', async () => {
    // Mock successful game creation
    mockPost.mockResolvedValueOnce({
      data: { data: { id: 'game-123' } },
    });
    // Mock successful image upload
    mockPost.mockResolvedValueOnce({
      data: { success: true },
    });

    const user = userEvent.setup();
    render(<CreateGame />);

    // Create a mock image file
    const imageFile = new File(['dummy content'], 'test-image.png', {
      type: 'image/png',
    });

    // Get the file input and simulate file selection
    const fileInput = screen.getByLabelText(/upload game image/i) as HTMLInputElement;
    await user.upload(fileInput, imageFile);

    // Fill in the game name and submit
    await user.type(screen.getByLabelText(/game name/i), 'Test Game');
    await user.click(screen.getByRole('button', { name: /create game/i }));

    // Wait for both API calls
    await waitFor(() => {
      expect(mockPost).toHaveBeenCalledTimes(2);
    });

    // Verify first call is game creation
    expect(mockPost).toHaveBeenNthCalledWith(
      1,
      '/games',
      {
        name: 'Test Game',
        description: undefined,
        settings: {
          proposalTimeoutHours: -1,
          argumentationTimeoutHours: -1,
          votingTimeoutHours: -1,
          narrationTimeoutHours: -1,
        },
      },
      undefined
    );

    // Verify second call is image upload with FormData and Content-Type undefined
    const secondCall = mockPost.mock.calls[1];
    expect(secondCall[0]).toBe('/games/game-123/image');
    expect(secondCall[1]).toBeInstanceOf(FormData);
    expect(secondCall[2]).toEqual({
      headers: {
        'Content-Type': undefined,
      },
    });

    // Verify the FormData contains the image file
    const formData = secondCall[1] as FormData;
    expect(formData.get('image')).toBe(imageFile);
  });

  it('should render phase timeouts section', () => {
    render(<CreateGame />);

    expect(screen.getByRole('button', { name: /phase timeouts/i })).toBeInTheDocument();
  });

  it('should expand and collapse timeout section on click', async () => {
    const user = userEvent.setup();
    render(<CreateGame />);

    const timeoutButton = screen.getByRole('button', { name: /phase timeouts/i });

    // Section should be collapsed initially
    expect(screen.queryByText(/time for players to propose actions/i)).not.toBeInTheDocument();

    // Click to expand
    await user.click(timeoutButton);
    expect(screen.getByText(/time for players to propose actions/i)).toBeInTheDocument();

    // Click to collapse
    await user.click(timeoutButton);
    expect(screen.queryByText(/time for players to propose actions/i)).not.toBeInTheDocument();
  });

  it('should show "No limits" status when all timeouts are set to -1', () => {
    render(<CreateGame />);

    expect(screen.getByText('No limits')).toBeInTheDocument();
  });

  it('should show "Configured" status when any timeout is not -1', async () => {
    const user = userEvent.setup();
    render(<CreateGame />);

    const timeoutButton = screen.getByRole('button', { name: /phase timeouts/i });
    await user.click(timeoutButton);

    // Find and change one of the timeout selects
    const selects = screen.getAllByRole('combobox');
    const proposalSelect = selects[0]; // First select should be Proposal
    await user.selectOptions(proposalSelect, '24');

    expect(screen.getByText('Configured')).toBeInTheDocument();
  });

  it('should include timeout settings in POST request', async () => {
    mockPost.mockResolvedValue({
      data: { data: { id: 'game-123' } },
    });
    const user = userEvent.setup();
    render(<CreateGame />);

    // Expand timeout section
    await user.click(screen.getByRole('button', { name: /phase timeouts/i }));

    // Set some timeout values - use getAllByRole to get all selects
    const selects = screen.getAllByRole('combobox');
    const proposalSelect = selects[0]; // First is Proposal
    const argumentationSelect = selects[1]; // Second is Argumentation

    await user.selectOptions(proposalSelect, '24');
    await user.selectOptions(argumentationSelect, '48');

    // Fill in game name and submit
    await user.type(screen.getByLabelText(/game name/i), 'Test Game');
    await user.click(screen.getByRole('button', { name: /create game/i }));

    await waitFor(() => {
      expect(mockPost).toHaveBeenCalledWith(
        '/games',
        {
          name: 'Test Game',
          description: undefined,
          settings: {
            proposalTimeoutHours: 24,
            argumentationTimeoutHours: 48,
            votingTimeoutHours: -1,
            narrationTimeoutHours: -1,
          },
        },
        undefined
      );
    });
  });

  it('should render all four timeout selects when expanded', async () => {
    const user = userEvent.setup();
    render(<CreateGame />);

    await user.click(screen.getByRole('button', { name: /phase timeouts/i }));

    const selects = screen.getAllByRole('combobox');
    expect(selects.length).toBe(4);

    // Verify the labels are present
    expect(screen.getByText('Proposal')).toBeInTheDocument();
    expect(screen.getByText('Argumentation')).toBeInTheDocument();
    expect(screen.getByText('Voting')).toBeInTheDocument();
    expect(screen.getByText('Narration')).toBeInTheDocument();
  });
});
