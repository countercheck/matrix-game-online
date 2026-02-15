import { describe, it, expect, vi, beforeEach } from 'vitest';
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { render } from '../test/test-utils';
import ResetPassword from './ResetPassword';
import { api } from '../services/api';

// Mock API
vi.mock('../services/api', () => ({
  api: {
    post: vi.fn(),
  },
}));

// Mock useNavigate and useSearchParams
const mockNavigate = vi.fn();
const mockSearchParams = new URLSearchParams('?token=valid-token');
const mockSetSearchParams = vi.fn();

vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom');
  return {
    ...actual,
    useNavigate: () => mockNavigate,
    useSearchParams: () => [mockSearchParams, mockSetSearchParams],
  };
});

describe('ResetPassword Page', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockSearchParams.set('token', 'valid-token');
    vi.useRealTimers(); // Reset to real timers before each test
  });

  it('should render reset password form', () => {
    render(<ResetPassword />);

    expect(screen.getByRole('heading', { name: /reset password/i })).toBeInTheDocument();
    expect(screen.getByLabelText(/new password/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/confirm password/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /reset password/i })).toBeInTheDocument();
  });

  it('should render link to login', () => {
    render(<ResetPassword />);

    expect(screen.getByText(/remember your password/i)).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /sign in/i })).toBeInTheDocument();
  });

  it('should display password requirements hint', () => {
    render(<ResetPassword />);

    expect(
      screen.getByText(/must be at least 8 characters with uppercase, lowercase, and numbers/i)
    ).toBeInTheDocument();
  });

  it('should extract token from URL query parameter', () => {
    render(<ResetPassword />);

    // Button should be enabled when token is present
    expect(screen.getByRole('button', { name: /reset password/i })).not.toBeDisabled();
  });

  it('should show error when token is missing', () => {
    mockSearchParams.delete('token');
    render(<ResetPassword />);

    expect(
      screen.getByText(/invalid reset link.*request a new password reset/i)
    ).toBeInTheDocument();
  });

  it('should disable form when token is missing', () => {
    mockSearchParams.delete('token');
    render(<ResetPassword />);

    expect(screen.getByLabelText(/new password/i)).toBeDisabled();
    expect(screen.getByLabelText(/confirm password/i)).toBeDisabled();
    expect(screen.getByRole('button', { name: /reset password/i })).toBeDisabled();
  });

  it('should update password inputs on change', async () => {
    const user = userEvent.setup();
    render(<ResetPassword />);

    const newPasswordInput = screen.getByLabelText(/new password/i);
    const confirmPasswordInput = screen.getByLabelText(/confirm password/i);

    await user.type(newPasswordInput, 'NewPassword123');
    await user.type(confirmPasswordInput, 'NewPassword123');

    expect(newPasswordInput).toHaveValue('NewPassword123');
    expect(confirmPasswordInput).toHaveValue('NewPassword123');
  });

  it('should validate passwords match before submitting', async () => {
    const user = userEvent.setup();
    render(<ResetPassword />);

    await user.type(screen.getByLabelText(/new password/i), 'Password123');
    await user.type(screen.getByLabelText(/confirm password/i), 'DifferentPassword123');
    await user.click(screen.getByRole('button', { name: /reset password/i }));

    await waitFor(() => {
      expect(screen.getByText(/passwords do not match/i)).toBeInTheDocument();
    });

    // Should not call API
    expect(api.post).not.toHaveBeenCalled();
  });

  it('should send reset request with matching passwords', async () => {
    vi.mocked(api.post).mockResolvedValue({
      data: {
        success: true,
        data: {
          message: 'Password has been reset successfully',
        },
      },
    });

    const user = userEvent.setup();
    render(<ResetPassword />);

    await user.type(screen.getByLabelText(/new password/i), 'NewPassword123');
    await user.type(screen.getByLabelText(/confirm password/i), 'NewPassword123');
    await user.click(screen.getByRole('button', { name: /reset password/i }));

    await waitFor(() => {
      expect(api.post).toHaveBeenCalledWith('/auth/reset-password', {
        token: 'valid-token',
        newPassword: 'NewPassword123',
      });
    });
  });

  it('should display success message after successful reset', async () => {
    vi.mocked(api.post).mockResolvedValue({
      data: {
        success: true,
        data: {
          message: 'Password has been reset successfully',
        },
      },
    });

    const user = userEvent.setup();
    render(<ResetPassword />);

    await user.type(screen.getByLabelText(/new password/i), 'NewPassword123');
    await user.type(screen.getByLabelText(/confirm password/i), 'NewPassword123');
    await user.click(screen.getByRole('button', { name: /reset password/i }));

    await waitFor(() => {
      expect(screen.getByText(/password has been reset successfully/i)).toBeInTheDocument();
    });
  });

  it('should redirect to login after successful reset', async () => {
    vi.mocked(api.post).mockResolvedValue({
      data: {
        success: true,
        data: {
          message: 'Password has been reset successfully',
        },
      },
    });

    const user = userEvent.setup();
    render(<ResetPassword />);

    await user.type(screen.getByLabelText(/new password/i), 'NewPassword123');
    await user.type(screen.getByLabelText(/confirm password/i), 'NewPassword123');
    await user.click(screen.getByRole('button', { name: /reset password/i }));

    // Wait for the success message
    await waitFor(() => {
      expect(screen.getByText(/password has been reset successfully/i)).toBeInTheDocument();
    });

    // Wait for redirect (2 second delay + buffer)
    await waitFor(
      () => {
        expect(mockNavigate).toHaveBeenCalledWith('/login');
      },
      { timeout: 3000 }
    );
  });

  it('should display error on reset failure', async () => {
    vi.mocked(api.post).mockRejectedValue({
      response: {
        data: {
          error: { message: 'Invalid or expired reset token' },
        },
      },
    });

    const user = userEvent.setup();
    render(<ResetPassword />);

    await user.type(screen.getByLabelText(/new password/i), 'NewPassword123');
    await user.type(screen.getByLabelText(/confirm password/i), 'NewPassword123');
    await user.click(screen.getByRole('button', { name: /reset password/i }));

    await waitFor(() => {
      expect(screen.getByText(/invalid or expired reset token/i)).toBeInTheDocument();
    });
  });

  it('should show loading state while submitting', async () => {
    vi.mocked(api.post).mockImplementation(() => new Promise(() => {}));
    const user = userEvent.setup();
    render(<ResetPassword />);

    await user.type(screen.getByLabelText(/new password/i), 'NewPassword123');
    await user.type(screen.getByLabelText(/confirm password/i), 'NewPassword123');
    await user.click(screen.getByRole('button', { name: /reset password/i }));

    expect(screen.getByRole('button', { name: /resetting/i })).toBeInTheDocument();
  });

  it('should disable button while submitting', async () => {
    vi.mocked(api.post).mockImplementation(() => new Promise(() => {}));
    const user = userEvent.setup();
    render(<ResetPassword />);

    await user.type(screen.getByLabelText(/new password/i), 'NewPassword123');
    await user.type(screen.getByLabelText(/confirm password/i), 'NewPassword123');
    await user.click(screen.getByRole('button', { name: /reset password/i }));

    expect(screen.getByRole('button')).toBeDisabled();
  });

  it('should require both password fields', () => {
    render(<ResetPassword />);

    expect(screen.getByLabelText(/new password/i)).toBeRequired();
    expect(screen.getByLabelText(/confirm password/i)).toBeRequired();
  });

  it('should have password type for password inputs', () => {
    render(<ResetPassword />);

    expect(screen.getByLabelText(/new password/i)).toHaveAttribute('type', 'password');
    expect(screen.getByLabelText(/confirm password/i)).toHaveAttribute('type', 'password');
  });
});
