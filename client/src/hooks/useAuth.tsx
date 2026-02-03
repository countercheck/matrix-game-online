import { createContext, useContext, useState, ReactNode } from 'react';
import { api } from '../services/api';

interface User {
  id: string;
  email: string;
  displayName: string;
}

interface AuthContextType {
  user: User | null;
  token: string | null;
  isLoading: boolean;
  login: (email: string, password: string) => Promise<void>;
  register: (email: string, password: string, displayName: string) => Promise<void>;
  logout: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

const TOKEN_KEY = 'auth_token';
const USER_KEY = 'auth_user';

// Initialize auth state from localStorage
function getInitialAuthState(): { user: User | null; token: string | null } {
  const storedToken = localStorage.getItem(TOKEN_KEY);
  const storedUser = localStorage.getItem(USER_KEY);

  if (storedToken && storedUser) {
    api.defaults.headers.common['Authorization'] = `Bearer ${storedToken}`;
    return { user: JSON.parse(storedUser), token: storedToken };
  }

  return { user: null, token: null };
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(() => getInitialAuthState().user);
  const [token, setToken] = useState<string | null>(() => getInitialAuthState().token);
  const [isLoading] = useState(false);

  const login = async (email: string, password: string) => {
    const response = await api.post('/auth/login', { email, password });
    const { user: userData, token: authToken } = response.data.data;

    localStorage.setItem(TOKEN_KEY, authToken);
    localStorage.setItem(USER_KEY, JSON.stringify(userData));
    api.defaults.headers.common['Authorization'] = `Bearer ${authToken}`;

    setToken(authToken);
    setUser(userData);
  };

  const register = async (email: string, password: string, displayName: string) => {
    const response = await api.post('/auth/register', { email, password, displayName });
    const { user: userData, token: authToken } = response.data.data;

    localStorage.setItem(TOKEN_KEY, authToken);
    localStorage.setItem(USER_KEY, JSON.stringify(userData));
    api.defaults.headers.common['Authorization'] = `Bearer ${authToken}`;

    setToken(authToken);
    setUser(userData);
  };

  const logout = () => {
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(USER_KEY);
    delete api.defaults.headers.common['Authorization'];

    setToken(null);
    setUser(null);
  };

  return (
    <AuthContext.Provider value={{ user, token, isLoading, login, register, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
