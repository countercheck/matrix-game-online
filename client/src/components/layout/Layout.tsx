import { Outlet, Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth';

export default function Layout() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between">
          <Link to="/" className="text-xl font-bold">
            Mosaic Matrix Game
          </Link>
          <nav className="flex items-center gap-4">
            <Link to="/" className="text-sm hover:underline">
              Dashboard
            </Link>
            <Link to="/profile" className="text-sm hover:underline">
              Profile
            </Link>
            <span className="text-sm text-muted-foreground">{user?.displayName}</span>
            <button
              onClick={handleLogout}
              className="text-sm text-destructive hover:underline"
            >
              Logout
            </button>
          </nav>
        </div>
      </header>
      <main className="container mx-auto px-4 py-8">
        <Outlet />
      </main>
    </div>
  );
}
