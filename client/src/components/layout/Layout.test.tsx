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

    // Dashboard link in nav (not the logo which also links to dashboard)
    const dashboardLinks = screen.getAllByRole('link', { name: /dashboard/i });
    expect(dashboardLinks.length).toBeGreaterThanOrEqual(1);
    expect(screen.getByRole('link', { name: /profile/i })).toBeInTheDocument();
  });

  it('should display user display name', () => {
    render(<Layout />);

    expect(screen.getByText('Test User')).toBeInTheDocument();
  });

  it('should render logout button', () => {
    render(<Layout />);

    // Look for desktop logout button (there may be mobile one too when menu is open)
    const logoutButtons = screen.getAllByRole('button', { name: /log.*out/i });
    expect(logoutButtons.length).toBeGreaterThanOrEqual(1);
  });

  it('should render outlet for child routes', () => {
    render(<Layout />);

    expect(screen.getByTestId('outlet')).toBeInTheDocument();
  });

  it('should call logout and navigate on logout click', () => {
    render(<Layout />);

    // Click the first logout button found
    const logoutButtons = screen.getAllByRole('button', { name: /log.*out/i });
    fireEvent.click(logoutButtons[0]);

    expect(mockLogout).toHaveBeenCalled();
    expect(mockNavigate).toHaveBeenCalledWith('/login');
  });

  it('should have correct link to dashboard', () => {
    render(<Layout />);

    // Multiple links go to dashboard (logo + nav link), check at least one has correct href
    const dashboardLinks = screen.getAllByRole('link', { name: /dashboard/i });
    const linkWithCorrectHref = dashboardLinks.find((link) => link.getAttribute('href') === '/');
    expect(linkWithCorrectHref).toBeTruthy();
  });

  it('should have correct link to profile', () => {
    render(<Layout />);

    const profileLink = screen.getByRole('link', { name: /profile/i });
    expect(profileLink).toHaveAttribute('href', '/profile');
  });

  it('should have correct link to help', () => {
    render(<Layout />);

    const helpLinks = screen.getAllByRole('link', { name: /help/i });
    const linkWithCorrectHref = helpLinks.find((link) => link.getAttribute('href') === '/help');
    expect(linkWithCorrectHref).toBeTruthy();
  });
});
