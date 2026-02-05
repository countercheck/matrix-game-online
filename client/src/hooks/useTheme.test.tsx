import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { ReactNode } from 'react';
import { ThemeProvider, useTheme } from './useTheme';

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
    Object.keys(mockLocalStorage).forEach((key) => delete mockLocalStorage[key]);
  }),
};
Object.defineProperty(window, 'localStorage', { value: localStorageMock });

// Mock matchMedia
let mediaQueryMatches = false;
const mediaQueryListeners: ((event: MediaQueryListEvent) => void)[] = [];

const mockMatchMedia = vi.fn((query: string) => ({
  matches: mediaQueryMatches,
  media: query,
  onchange: null,
  addListener: vi.fn(), // deprecated
  removeListener: vi.fn(), // deprecated
  addEventListener: vi.fn((event: string, handler: (e: MediaQueryListEvent) => void) => {
    if (event === 'change') {
      mediaQueryListeners.push(handler);
    }
  }),
  removeEventListener: vi.fn((event: string, handler: (e: MediaQueryListEvent) => void) => {
    if (event === 'change') {
      const index = mediaQueryListeners.indexOf(handler);
      if (index > -1) {
        mediaQueryListeners.splice(index, 1);
      }
    }
  }),
  dispatchEvent: vi.fn(),
}));

Object.defineProperty(window, 'matchMedia', { value: mockMatchMedia, writable: true });

// Mock document.documentElement for classList manipulation
const mockClassList = {
  add: vi.fn(),
  remove: vi.fn(),
};
Object.defineProperty(document.documentElement, 'classList', {
  value: mockClassList,
  writable: true,
});

function createWrapper() {
  return function Wrapper({ children }: { children: ReactNode }) {
    return <ThemeProvider>{children}</ThemeProvider>;
  };
}

// Helper to trigger system preference change
function triggerSystemPreferenceChange(prefersDark: boolean) {
  mediaQueryMatches = prefersDark;
  mediaQueryListeners.forEach((listener) => {
    listener({ matches: prefersDark } as MediaQueryListEvent);
  });
}

describe('useTheme Hook', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorageMock.clear();
    mediaQueryMatches = false;
    mediaQueryListeners.length = 0;
    mockClassList.add.mockClear();
    mockClassList.remove.mockClear();
  });

  afterEach(() => {
    mediaQueryListeners.length = 0;
  });

  it('should default to bright theme when no system preference', () => {
    const { result } = renderHook(() => useTheme(), {
      wrapper: createWrapper(),
    });

    expect(result.current.theme).toBe('bright');
    expect(mockClassList.remove).toHaveBeenCalledWith('dark');
  });

  it('should use system preference (dark) on initial load when user has not set preference', () => {
    mediaQueryMatches = true;

    const { result } = renderHook(() => useTheme(), {
      wrapper: createWrapper(),
    });

    expect(result.current.theme).toBe('dark');
    expect(mockClassList.add).toHaveBeenCalledWith('dark');
  });

  it('should use stored theme when user has explicitly set it', () => {
    mockLocalStorage['mosaic-theme'] = 'dark';
    mockLocalStorage['mosaic-theme-user-set'] = 'true';
    mediaQueryMatches = false; // System prefers bright, but user set dark

    const { result } = renderHook(() => useTheme(), {
      wrapper: createWrapper(),
    });

    expect(result.current.theme).toBe('dark');
    expect(mockClassList.add).toHaveBeenCalledWith('dark');
  });

  it('should toggle theme and mark as user-set', () => {
    const { result } = renderHook(() => useTheme(), {
      wrapper: createWrapper(),
    });

    expect(result.current.theme).toBe('bright');

    act(() => {
      result.current.toggleTheme();
    });

    expect(result.current.theme).toBe('dark');
    expect(localStorageMock.setItem).toHaveBeenCalledWith('mosaic-theme', 'dark');
    expect(localStorageMock.setItem).toHaveBeenCalledWith('mosaic-theme-user-set', 'true');
    expect(mockClassList.add).toHaveBeenCalledWith('dark');
  });

  it('should set theme directly and mark as user-set', () => {
    const { result } = renderHook(() => useTheme(), {
      wrapper: createWrapper(),
    });

    act(() => {
      result.current.setTheme('dark');
    });

    expect(result.current.theme).toBe('dark');
    expect(localStorageMock.setItem).toHaveBeenCalledWith('mosaic-theme', 'dark');
    expect(localStorageMock.setItem).toHaveBeenCalledWith('mosaic-theme-user-set', 'true');
  });

  it('should auto-switch theme when system preference changes and user has not explicitly set theme', () => {
    const { result } = renderHook(() => useTheme(), {
      wrapper: createWrapper(),
    });

    expect(result.current.theme).toBe('bright');

    // Simulate system preference change to dark
    act(() => {
      triggerSystemPreferenceChange(true);
    });

    expect(result.current.theme).toBe('dark');

    // Simulate system preference change back to bright
    act(() => {
      triggerSystemPreferenceChange(false);
    });

    expect(result.current.theme).toBe('bright');
  });

  it('should NOT auto-switch theme when system preference changes after user explicitly set theme', () => {
    const { result } = renderHook(() => useTheme(), {
      wrapper: createWrapper(),
    });

    // User explicitly sets theme to dark
    act(() => {
      result.current.setTheme('dark');
    });

    expect(result.current.theme).toBe('dark');

    // System preference changes to bright
    act(() => {
      triggerSystemPreferenceChange(false);
    });

    // Theme should remain dark because user explicitly set it
    expect(result.current.theme).toBe('dark');

    // System preference changes back to dark
    act(() => {
      triggerSystemPreferenceChange(true);
    });

    // Theme should still be dark
    expect(result.current.theme).toBe('dark');
  });

  it('should throw error if used outside ThemeProvider', () => {
    expect(() => {
      renderHook(() => useTheme());
    }).toThrow('useTheme must be used within a ThemeProvider');
  });

  it('should persist theme to localStorage on change', () => {
    const { result } = renderHook(() => useTheme(), {
      wrapper: createWrapper(),
    });

    act(() => {
      result.current.toggleTheme();
    });

    expect(localStorageMock.setItem).toHaveBeenCalledWith('mosaic-theme', 'dark');
    expect(localStorageMock.setItem).toHaveBeenCalledWith('mosaic-theme-user-set', 'true');

    act(() => {
      result.current.toggleTheme();
    });

    expect(localStorageMock.setItem).toHaveBeenCalledWith('mosaic-theme', 'bright');
    expect(localStorageMock.setItem).toHaveBeenCalledWith('mosaic-theme-user-set', 'true');
  });
});
