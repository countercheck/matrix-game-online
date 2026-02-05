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
    global.URL.createObjectURL = vi.fn(() => 'blob:mock-url');
    global.URL.revokeObjectURL = vi.fn();
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
      expect(mockPost).toHaveBeenCalledWith('/games', {
        name: 'Test Game',
        description: undefined,
      }, undefined);
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
    expect(mockPost).toHaveBeenNthCalledWith(1, '/games', {
      name: 'Test Game',
      description: undefined,
    }, undefined);

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
});
