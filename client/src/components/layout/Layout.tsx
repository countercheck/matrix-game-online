import { useState } from 'react';
import { Outlet, Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth';
import { ThemeToggle } from '../ui/ThemeToggle';
import { decodeHtmlEntities } from '../../utils/decodeEntities';

export default function Layout() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Skip to main content link for accessibility */}
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:absolute focus:top-4 focus:left-4 focus:z-50 focus:px-4 focus:py-2 focus:bg-primary focus:text-primary-foreground focus:rounded-md"
      >
        Skip to main content
      </a>

      <header className="border-b" role="banner">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between">
          <Link
            to="/"
            className="text-xl font-bold"
            aria-label="Mosaic Matrix Game - Go to dashboard"
          >
            Mosaic Matrix Game
          </Link>

          {/* Mobile menu button */}
          <button
            type="button"
            className="sm:hidden p-2 rounded-md hover:bg-muted"
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            aria-expanded={mobileMenuOpen}
            aria-controls="mobile-menu"
            aria-label={mobileMenuOpen ? 'Close menu' : 'Open menu'}
          >
            <svg
              className="h-6 w-6"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              aria-hidden="true"
            >
              {mobileMenuOpen ? (
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M6 18L18 6M6 6l12 12"
                />
              ) : (
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M4 6h16M4 12h16M4 18h16"
                />
              )}
            </svg>
          </button>

          {/* Desktop navigation */}
          <nav
            className="hidden sm:flex items-center gap-4"
            role="navigation"
            aria-label="Main navigation"
          >
            <Link
              to="/"
              className="text-sm hover:underline px-2 py-1 rounded-md focus:outline-none focus:ring-2 focus:ring-primary"
            >
              Dashboard
            </Link>
            <Link
              to="/profile"
              className="text-sm hover:underline px-2 py-1 rounded-md focus:outline-none focus:ring-2 focus:ring-primary"
            >
              Profile
            </Link>
            <Link
              to="/help"
              className="text-sm hover:underline px-2 py-1 rounded-md focus:outline-none focus:ring-2 focus:ring-primary"
            >
              Help
            </Link>
            <span
              className="text-sm text-muted-foreground"
              aria-label={`Logged in as ${user?.displayName}`}
            >
              {user?.displayName ? decodeHtmlEntities(user.displayName) : ''}
            </span>
            <button
              onClick={handleLogout}
              className="text-sm text-destructive hover:underline px-2 py-1 rounded-md focus:outline-none focus:ring-2 focus:ring-destructive"
              aria-label="Log out of your account"
            >
              Logout
            </button>
            <ThemeToggle />
          </nav>
        </div>

        {/* Mobile navigation */}
        {mobileMenuOpen && (
          <nav
            id="mobile-menu"
            className="sm:hidden border-t px-4 py-4 space-y-3"
            role="navigation"
            aria-label="Mobile navigation"
          >
            <Link
              to="/"
              className="block text-sm hover:underline py-2"
              onClick={() => setMobileMenuOpen(false)}
            >
              Dashboard
            </Link>
            <Link
              to="/profile"
              className="block text-sm hover:underline py-2"
              onClick={() => setMobileMenuOpen(false)}
            >
              Profile
            </Link>
            <Link
              to="/help"
              className="block text-sm hover:underline py-2"
              onClick={() => setMobileMenuOpen(false)}
            >
              Help
            </Link>
            <div className="text-sm text-muted-foreground py-2">
              {user?.displayName ? decodeHtmlEntities(user.displayName) : ''}
            </div>
            <button
              onClick={() => {
                setMobileMenuOpen(false);
                handleLogout();
              }}
              className="block text-sm text-destructive hover:underline py-2"
            >
              Logout
            </button>
            <div className="py-2">
              <ThemeToggle />
            </div>
          </nav>
        )}
      </header>

      <main id="main-content" className="container mx-auto px-4 py-8" role="main">
        <Outlet />
      </main>
    </div>
  );
}
