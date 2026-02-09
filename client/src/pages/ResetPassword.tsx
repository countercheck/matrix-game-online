import { useState, useEffect, useRef } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { api } from '../services/api';

export default function ResetPassword() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const [token, setToken] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const redirectTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    const tokenParam = searchParams.get('token');
    if (tokenParam) {
      setToken(tokenParam);
      setError(''); // Clear error when valid token is found
    } else {
      setError('Invalid reset link. Please request a new password reset.');
    }
  }, [searchParams]);

  // Cleanup timeout on unmount
  useEffect(() => {
    return () => {
      if (redirectTimeoutRef.current) {
        clearTimeout(redirectTimeoutRef.current);
      }
    };
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError('');
    setMessage('');

    // Validate passwords match
    if (newPassword !== confirmPassword) {
      setError('Passwords do not match');
      setIsLoading(false);
      return;
    }

    // Client-side password strength validation
    const passwordErrors: string[] = [];
    if (newPassword.length < 8) {
      passwordErrors.push('at least 8 characters');
    }
    if (!/[a-z]/.test(newPassword)) {
      passwordErrors.push('one lowercase letter');
    }
    if (!/[A-Z]/.test(newPassword)) {
      passwordErrors.push('one uppercase letter');
    }
    if (!/[0-9]/.test(newPassword)) {
      passwordErrors.push('one number');
    }

    if (passwordErrors.length > 0) {
      setError(`Password must contain ${passwordErrors.join(', ')}`);
      setIsLoading(false);
      return;
    }

    try {
      const response = await api.post('/auth/reset-password', { token, newPassword });
      setMessage(response.data.data.message);
      // Redirect to login after 2 seconds
      redirectTimeoutRef.current = setTimeout(() => {
        navigate('/login');
      }, 2000);
    } catch (err: unknown) {
      const axiosError = err as { response?: { data?: { error?: { message?: string } } } };
      setError(axiosError.response?.data?.error?.message || 'Failed to reset password');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-background">
      <div className="w-full max-w-md p-8 space-y-6 bg-card rounded-lg border shadow-sm">
        <div className="text-center">
          <h1 className="text-2xl font-bold">Reset Password</h1>
          <p className="text-muted-foreground mt-2">Enter your new password</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4" aria-label="Reset password form">
          {error && (
            <div
              id="reset-error"
              role="alert"
              aria-live="polite"
              className="p-3 text-sm text-destructive bg-destructive/10 rounded-md"
            >
              {error}
            </div>
          )}

          {message && (
            <div
              id="reset-success"
              role="alert"
              aria-live="polite"
              className="p-3 text-sm text-green-700 bg-green-50 rounded-md"
            >
              {message}
              <p className="mt-1">Redirecting to login...</p>
            </div>
          )}

          <div className="space-y-2">
            <label htmlFor="newPassword" className="text-sm font-medium">
              New Password
            </label>
            <input
              id="newPassword"
              type="password"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              required
              disabled={!token || isLoading}
              aria-describedby={error ? 'reset-error' : undefined}
              aria-invalid={!!error}
              className="w-full px-3 py-2 border rounded-md bg-background focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent disabled:opacity-50"
              placeholder="********"
              autoComplete="new-password"
            />
            <p className="text-xs text-muted-foreground">
              Must be at least 8 characters with uppercase, lowercase, and numbers
            </p>
          </div>

          <div className="space-y-2">
            <label htmlFor="confirmPassword" className="text-sm font-medium">
              Confirm Password
            </label>
            <input
              id="confirmPassword"
              type="password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              required
              disabled={!token || isLoading}
              aria-describedby={error ? 'reset-error' : undefined}
              aria-invalid={!!error}
              className="w-full px-3 py-2 border rounded-md bg-background focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent disabled:opacity-50"
              placeholder="********"
              autoComplete="new-password"
            />
          </div>

          <button
            type="submit"
            disabled={!token || isLoading}
            aria-disabled={!token || isLoading}
            className="w-full py-2 px-4 bg-primary text-primary-foreground rounded-md hover:bg-primary/90 disabled:opacity-50 focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2"
          >
            {isLoading ? 'Resetting...' : 'Reset Password'}
          </button>
        </form>

        <p className="text-center text-sm text-muted-foreground">
          Remember your password?{' '}
          <Link to="/login" className="text-primary hover:underline">
            Sign in
          </Link>
        </p>
      </div>
    </div>
  );
}
