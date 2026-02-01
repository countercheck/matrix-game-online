import { describe, it, expect, vi, beforeEach } from 'vitest';
import { screen, fireEvent } from '@testing-library/react';
import { render } from '../../test/test-utils';
import Layout from './Layout';

// Mock useNavigate
const mockNavigate = vi.fn();
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom');
  return {
    ...actual,
    useNavigate: () => mockNavigate,
    Outlet: () => <div data-testid="outlet">Page Content</div>,
  };
});

// Mock useAuth
const mockLogout = vi.fn();
vi.mock('../../hooks/useAuth', () => ({
  useAuth: () => ({
    user: { id: 'user-1', email: 'test@example.com', displayName: 'Test User' },
    logout: mockLogout,
  }),
  AuthProvider: ({ children }: { children: React.ReactNode }) => children,
}));

describe('Layout Component', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should render header with app name', () => {
    render(<Layout />);

    expect(screen.getByText(/mosaic matrix game/i)).toBeInTheDocument();
  });

  it('should render navigation links', () => {
    render(<Layout />);

    expect(screen.getByRole('link', { name: /dashboard/i })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /profile/i })).toBeInTheDocument();
  });

  it('should display user display name', () => {
    render(<Layout />);

    expect(screen.getByText('Test User')).toBeInTheDocument();
  });

  it('should render logout button', () => {
    render(<Layout />);

    expect(screen.getByRole('button', { name: /logout/i })).toBeInTheDocument();
  });

  it('should render outlet for child routes', () => {
    render(<Layout />);

    expect(screen.getByTestId('outlet')).toBeInTheDocument();
  });

  it('should call logout and navigate on logout click', () => {
    render(<Layout />);

    fireEvent.click(screen.getByRole('button', { name: /logout/i }));

    expect(mockLogout).toHaveBeenCalled();
    expect(mockNavigate).toHaveBeenCalledWith('/login');
  });

  it('should have correct link to dashboard', () => {
    render(<Layout />);

    const dashboardLink = screen.getByRole('link', { name: /dashboard/i });
    expect(dashboardLink).toHaveAttribute('href', '/');
  });

  it('should have correct link to profile', () => {
    render(<Layout />);

    const profileLink = screen.getByRole('link', { name: /profile/i });
    expect(profileLink).toHaveAttribute('href', '/profile');
  });
});
