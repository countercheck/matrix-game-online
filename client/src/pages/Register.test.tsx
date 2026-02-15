import { describe, it, expect, vi, beforeEach } from 'vitest';
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { render } from '../test/test-utils';
import Register from './Register';

// Mock useNavigate
const mockNavigate = vi.fn();
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom');
  return {
    ...actual,
    useNavigate: () => mockNavigate,
  };
});

// Mock useAuth
const mockRegister = vi.fn();
vi.mock('../hooks/useAuth', () => ({
  useAuth: () => ({
    user: null,
    isLoading: false,
    register: mockRegister,
  }),
  AuthProvider: ({ children }: { children: React.ReactNode }) => children,
}));

describe('Register Page', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockRegister.mockReset();
  });

  it('should render registration form', () => {
    render(<Register />);

    expect(screen.getByLabelText(/display name/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/email/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/password/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /create account/i })).toBeInTheDocument();
  });

  it('should render link to login page', () => {
    render(<Register />);

    expect(screen.getByText(/already have an account/i)).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /sign in/i })).toBeInTheDocument();
  });

  it('should show password requirements', () => {
    render(<Register />);

    expect(screen.getByText(/8 characters/i)).toBeInTheDocument();
  });

  it('should update display name input on change', async () => {
    const user = userEvent.setup();
    render(<Register />);

    const nameInput = screen.getByLabelText(/display name/i);
    await user.type(nameInput, 'John Doe');

    expect(nameInput).toHaveValue('John Doe');
  });

  it('should call register on form submit', async () => {
    mockRegister.mockResolvedValue(undefined);
    const user = userEvent.setup();
    render(<Register />);

    await user.type(screen.getByLabelText(/display name/i), 'John Doe');
    await user.type(screen.getByLabelText(/email/i), 'john@example.com');
    await user.type(screen.getByLabelText(/password/i), 'Password123');
    await user.click(screen.getByRole('button', { name: /create account/i }));

    await waitFor(() => {
      expect(mockRegister).toHaveBeenCalledWith('john@example.com', 'Password123', 'John Doe');
    });
  });

  it('should navigate to dashboard on successful registration', async () => {
    mockRegister.mockResolvedValue(undefined);
    const user = userEvent.setup();
    render(<Register />);

    await user.type(screen.getByLabelText(/display name/i), 'John Doe');
    await user.type(screen.getByLabelText(/email/i), 'john@example.com');
    await user.type(screen.getByLabelText(/password/i), 'Password123');
    await user.click(screen.getByRole('button', { name: /create account/i }));

    await waitFor(() => {
      expect(mockNavigate).toHaveBeenCalledWith('/');
    });
  });

  it('should display error on registration failure', async () => {
    mockRegister.mockRejectedValue({
      response: { data: { error: { message: 'Email already registered' } } },
    });
    const user = userEvent.setup();
    render(<Register />);

    await user.type(screen.getByLabelText(/display name/i), 'John Doe');
    await user.type(screen.getByLabelText(/email/i), 'john@example.com');
    await user.type(screen.getByLabelText(/password/i), 'Password123');
    await user.click(screen.getByRole('button', { name: /create account/i }));

    await waitFor(() => {
      expect(screen.getByText(/email already registered/i)).toBeInTheDocument();
    });
  });

  it('should show loading state while submitting', async () => {
    mockRegister.mockImplementation(() => new Promise(() => {}));
    const user = userEvent.setup();
    render(<Register />);

    await user.type(screen.getByLabelText(/display name/i), 'John');
    await user.type(screen.getByLabelText(/email/i), 'john@example.com');
    await user.type(screen.getByLabelText(/password/i), 'Password123');
    await user.click(screen.getByRole('button', { name: /create account/i }));

    expect(screen.getByRole('button', { name: /creating account/i })).toBeInTheDocument();
  });
});
