import { describe, it, expect, vi, beforeEach } from 'vitest';
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { render } from '../test/test-utils';
import ForgotPassword from './ForgotPassword';
import { api } from '../services/api';

// Mock API
vi.mock('../services/api', () => ({
  api: {
    post: vi.fn(),
  },
}));

// Mock useNavigate
const mockNavigate = vi.fn();
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom');
  return {
    ...actual,
    useNavigate: () => mockNavigate,
  };
});

describe('ForgotPassword Page', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should render forgot password form', () => {
    render(<ForgotPassword />);

    expect(screen.getByRole('heading', { name: /forgot password/i })).toBeInTheDocument();
    expect(screen.getByLabelText(/email/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /send reset link/i })).toBeInTheDocument();
  });

  it('should render links to login and register', () => {
    render(<ForgotPassword />);

    expect(screen.getByText(/remember your password/i)).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /sign in/i })).toBeInTheDocument();
    expect(screen.getByText(/don't have an account/i)).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /register/i })).toBeInTheDocument();
  });

  it('should update email input on change', async () => {
    const user = userEvent.setup();
    render(<ForgotPassword />);

    const emailInput = screen.getByLabelText(/email/i);
    await user.type(emailInput, 'test@example.com');

    expect(emailInput).toHaveValue('test@example.com');
  });

  it('should send reset request on form submit', async () => {
    vi.mocked(api.post).mockResolvedValue({
      data: {
        success: true,
        data: {
          message: 'If that email exists, a password reset link has been sent.',
        },
      },
    });

    const user = userEvent.setup();
    render(<ForgotPassword />);

    await user.type(screen.getByLabelText(/email/i), 'test@example.com');
    await user.click(screen.getByRole('button', { name: /send reset link/i }));

    await waitFor(() => {
      expect(api.post).toHaveBeenCalledWith('/auth/forgot-password', {
        email: 'test@example.com',
      });
    });
  });

  it('should display success message after submission', async () => {
    vi.mocked(api.post).mockResolvedValue({
      data: {
        success: true,
        data: {
          message: 'If that email exists, a password reset link has been sent.',
        },
      },
    });

    const user = userEvent.setup();
    render(<ForgotPassword />);

    await user.type(screen.getByLabelText(/email/i), 'test@example.com');
    await user.click(screen.getByRole('button', { name: /send reset link/i }));

    await waitFor(() => {
      expect(
        screen.getByText(/password reset link has been sent/i)
      ).toBeInTheDocument();
    });
  });

  it('should clear email field after successful submission', async () => {
    vi.mocked(api.post).mockResolvedValue({
      data: {
        success: true,
        data: {
          message: 'If that email exists, a password reset link has been sent.',
        },
      },
    });

    const user = userEvent.setup();
    render(<ForgotPassword />);

    const emailInput = screen.getByLabelText(/email/i) as HTMLInputElement;
    await user.type(emailInput, 'test@example.com');
    await user.click(screen.getByRole('button', { name: /send reset link/i }));

    await waitFor(() => {
      expect(emailInput).toHaveValue('');
    });
  });

  it('should display error on request failure', async () => {
    vi.mocked(api.post).mockRejectedValue({
      response: {
        data: {
          error: { message: 'Failed to send reset email' },
        },
      },
    });

    const user = userEvent.setup();
    render(<ForgotPassword />);

    await user.type(screen.getByLabelText(/email/i), 'test@example.com');
    await user.click(screen.getByRole('button', { name: /send reset link/i }));

    await waitFor(() => {
      expect(screen.getByText(/failed to send reset email/i)).toBeInTheDocument();
    });
  });

  it('should show loading state while submitting', async () => {
    // Make the request hang
    vi.mocked(api.post).mockImplementation(() => new Promise(() => {}));
    const user = userEvent.setup();
    render(<ForgotPassword />);

    await user.type(screen.getByLabelText(/email/i), 'test@example.com');
    await user.click(screen.getByRole('button', { name: /send reset link/i }));

    expect(screen.getByRole('button', { name: /sending/i })).toBeInTheDocument();
  });

  it('should disable button while submitting', async () => {
    vi.mocked(api.post).mockImplementation(() => new Promise(() => {}));
    const user = userEvent.setup();
    render(<ForgotPassword />);

    await user.type(screen.getByLabelText(/email/i), 'test@example.com');
    await user.click(screen.getByRole('button', { name: /send reset link/i }));

    expect(screen.getByRole('button')).toBeDisabled();
  });

  it('should require email field', () => {
    render(<ForgotPassword />);

    const emailInput = screen.getByLabelText(/email/i);
    expect(emailInput).toBeRequired();
  });

  it('should have email type for email input', () => {
    render(<ForgotPassword />);

    const emailInput = screen.getByLabelText(/email/i);
    expect(emailInput).toHaveAttribute('type', 'email');
  });
});
