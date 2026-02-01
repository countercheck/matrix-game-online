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
    post: (url: string, data: unknown) => mockPost(url, data),
  },
}));

describe('CreateGame Page', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockPost.mockReset();
  });

  it('should render create game form', () => {
    render(<CreateGame />);

    expect(screen.getByLabelText(/game name/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/description/i)).toBeInTheDocument();
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

  it('should update description input on change', async () => {
    const user = userEvent.setup();
    render(<CreateGame />);

    const descInput = screen.getByLabelText(/description/i);
    await user.type(descInput, 'A test game description');

    expect(descInput).toHaveValue('A test game description');
  });

  it('should show character count for description', async () => {
    const user = userEvent.setup();
    render(<CreateGame />);

    const descInput = screen.getByLabelText(/description/i);
    await user.type(descInput, 'Hello');

    expect(screen.getByText(/5\/1000/)).toBeInTheDocument();
  });

  it('should call API on form submit', async () => {
    mockPost.mockResolvedValue({
      data: { data: { id: 'game-123' } },
    });
    const user = userEvent.setup();
    render(<CreateGame />);

    await user.type(screen.getByLabelText(/game name/i), 'Test Game');
    await user.type(screen.getByLabelText(/description/i), 'A test');
    await user.click(screen.getByRole('button', { name: /create game/i }));

    await waitFor(() => {
      expect(mockPost).toHaveBeenCalledWith('/games', {
        name: 'Test Game',
        description: 'A test',
      });
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
});
