import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';
import { ReactNode } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { BrowserRouter } from 'react-router-dom';

// Mock localStorage
const mockLocalStorage: Record<string, string> = {};
const localStorageMock = {
  getItem: vi.fn((key: string) => mockLocalStorage[key] || null),
  setItem: vi.fn((key: string, value: string) => {
    mockLocalStorage[key] = value;
  }),
  removeItem: vi.fn((key: string) => {
    delete mockLocalStorage[key];
  }),
  clear: vi.fn(() => {
    Object.keys(mockLocalStorage).forEach(key => delete mockLocalStorage[key]);
  }),
};
Object.defineProperty(window, 'localStorage', { value: localStorageMock });

// Mock API
const mockPost = vi.fn();
vi.mock('../services/api', () => ({
  api: {
    post: (url: string, data: unknown) => mockPost(url, data),
    defaults: {
      headers: {
        common: {} as Record<string, string>,
      },
    },
  },
}));

// Import after mocking
import { AuthProvider, useAuth } from './useAuth';

function createWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });

  return function Wrapper({ children }: { children: ReactNode }) {
    return (
      <QueryClientProvider client={queryClient}>
        <BrowserRouter>
          <AuthProvider>{children}</AuthProvider>
        </BrowserRouter>
      </QueryClientProvider>
    );
  };
}

describe('useAuth Hook', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorageMock.clear();
    mockPost.mockReset();
  });

  it('should start with null user when not logged in', () => {
    const { result } = renderHook(() => useAuth(), {
      wrapper: createWrapper(),
    });

    expect(result.current.user).toBeNull();
    expect(result.current.token).toBeNull();
  });

  it('should load user from localStorage on mount', () => {
    const storedUser = { id: 'user-1', email: 'test@example.com', displayName: 'Test' };
    mockLocalStorage['auth_token'] = 'stored-token';
    mockLocalStorage['auth_user'] = JSON.stringify(storedUser);

    const { result } = renderHook(() => useAuth(), {
      wrapper: createWrapper(),
    });

    // Wait for useEffect to run
    expect(result.current.user).toEqual(storedUser);
    expect(result.current.token).toBe('stored-token');
  });

  it('should login and store credentials', async () => {
    const userData = { id: 'user-1', email: 'test@example.com', displayName: 'Test' };
    mockPost.mockResolvedValue({
      data: {
        data: {
          user: userData,
          token: 'new-token',
        },
      },
    });

    const { result } = renderHook(() => useAuth(), {
      wrapper: createWrapper(),
    });

    await act(async () => {
      await result.current.login('test@example.com', 'password123');
    });

    expect(mockPost).toHaveBeenCalledWith('/auth/login', {
      email: 'test@example.com',
      password: 'password123',
    });
    expect(result.current.user).toEqual(userData);
    expect(result.current.token).toBe('new-token');
    expect(localStorageMock.setItem).toHaveBeenCalledWith('auth_token', 'new-token');
  });

  it('should register and store credentials', async () => {
    const userData = { id: 'user-1', email: 'new@example.com', displayName: 'New User' };
    mockPost.mockResolvedValue({
      data: {
        data: {
          user: userData,
          token: 'new-token',
        },
      },
    });

    const { result } = renderHook(() => useAuth(), {
      wrapper: createWrapper(),
    });

    await act(async () => {
      await result.current.register('new@example.com', 'password123', 'New User');
    });

    expect(mockPost).toHaveBeenCalledWith('/auth/register', {
      email: 'new@example.com',
      password: 'password123',
      displayName: 'New User',
    });
    expect(result.current.user).toEqual(userData);
  });

  it('should logout and clear credentials', async () => {
    // Start logged in
    const storedUser = { id: 'user-1', email: 'test@example.com', displayName: 'Test' };
    mockLocalStorage['auth_token'] = 'stored-token';
    mockLocalStorage['auth_user'] = JSON.stringify(storedUser);

    const { result } = renderHook(() => useAuth(), {
      wrapper: createWrapper(),
    });

    // Verify logged in
    expect(result.current.user).toEqual(storedUser);

    // Logout
    act(() => {
      result.current.logout();
    });

    expect(result.current.user).toBeNull();
    expect(result.current.token).toBeNull();
    expect(localStorageMock.removeItem).toHaveBeenCalledWith('auth_token');
    expect(localStorageMock.removeItem).toHaveBeenCalledWith('auth_user');
  });

  it('should throw error if used outside AuthProvider', () => {
    // This test verifies the error is thrown
    // Note: This will actually throw in the test, so we need to handle it
    expect(() => {
      renderHook(() => useAuth());
    }).toThrow('useAuth must be used within an AuthProvider');
  });

  it('should handle login failure', async () => {
    mockPost.mockRejectedValue(new Error('Invalid credentials'));

    const { result } = renderHook(() => useAuth(), {
      wrapper: createWrapper(),
    });

    await expect(
      act(async () => {
        await result.current.login('test@example.com', 'wrongpassword');
      })
    ).rejects.toThrow('Invalid credentials');

    expect(result.current.user).toBeNull();
  });
});
