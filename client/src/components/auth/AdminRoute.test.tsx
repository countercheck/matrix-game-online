import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import AdminRoute from './AdminRoute';

vi.mock('../../hooks/useAuth', () => ({
  useAuth: vi.fn(),
}));

import { useAuth } from '../../hooks/useAuth';

describe('AdminRoute', () => {
  it('renders children for ADMIN users', () => {
    vi.mocked(useAuth).mockReturnValue({
      user: { id: '1', email: 'a@b.com', displayName: 'Admin', role: 'ADMIN' },
      token: 'tok',
      isLoading: false,
      login: vi.fn(),
      register: vi.fn(),
      logout: vi.fn(),
    });

    render(
      <MemoryRouter>
        <AdminRoute><div>Admin content</div></AdminRoute>
      </MemoryRouter>
    );

    expect(screen.getByText('Admin content')).toBeInTheDocument();
  });

  it('redirects non-admins away', () => {
    vi.mocked(useAuth).mockReturnValue({
      user: { id: '2', email: 'u@b.com', displayName: 'User', role: 'USER' },
      token: 'tok',
      isLoading: false,
      login: vi.fn(),
      register: vi.fn(),
      logout: vi.fn(),
    });

    render(
      <MemoryRouter initialEntries={['/admin']}>
        <AdminRoute><div>Admin content</div></AdminRoute>
      </MemoryRouter>
    );

    expect(screen.queryByText('Admin content')).not.toBeInTheDocument();
  });
});
