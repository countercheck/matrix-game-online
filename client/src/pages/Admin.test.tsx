import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import Admin from './Admin';

vi.mock('../services/api', () => ({
  api: {
    post: vi.fn(),
  },
}));

import { api } from '../services/api';

describe('Admin page', () => {
  it('renders the test email form', () => {
    render(<Admin />);
    expect(screen.getByText('Admin Panel')).toBeInTheDocument();
    expect(screen.getByLabelText(/email address/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /send test email/i })).toBeInTheDocument();
  });

  it('shows success message on successful send', async () => {
    vi.mocked(api.post).mockResolvedValueOnce({
      data: { success: true, message: 'Test email sent to test@example.com' },
    });

    render(<Admin />);
    fireEvent.change(screen.getByLabelText(/email address/i), {
      target: { value: 'test@example.com' },
    });
    fireEvent.click(screen.getByRole('button', { name: /send test email/i }));

    await waitFor(() => {
      expect(screen.getByText(/test email sent/i)).toBeInTheDocument();
    });
  });

  it('shows error message on failed send', async () => {
    vi.mocked(api.post).mockRejectedValueOnce(new Error('Network error'));

    render(<Admin />);
    fireEvent.change(screen.getByLabelText(/email address/i), {
      target: { value: 'test@example.com' },
    });
    fireEvent.click(screen.getByRole('button', { name: /send test email/i }));

    await waitFor(() => {
      expect(screen.getByText(/failed to send/i)).toBeInTheDocument();
    });
  });
});
