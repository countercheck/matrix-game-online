import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';

type Theme = 'bright' | 'dark';

interface ThemeContextType {
  theme: Theme;
  setTheme: (theme: Theme) => void;
  toggleTheme: () => void;
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

const THEME_KEY = 'mosaic-theme';
const USER_SET_KEY = 'mosaic-theme-user-set';

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [theme, setThemeState] = useState<Theme>(() => {
    // Check if user explicitly set a preference
    if (typeof window !== 'undefined') {
      const userSet = localStorage.getItem(USER_SET_KEY);
      if (userSet === 'true') {
        const stored = localStorage.getItem(THEME_KEY);
        if (stored === 'bright' || stored === 'dark') {
          return stored;
        }
      }
      // Use system preference if user hasn't explicitly set a theme
      if (window.matchMedia('(prefers-color-scheme: dark)').matches) {
        return 'dark';
      }
    }
    return 'bright';
  });

  useEffect(() => {
    const root = document.documentElement;

    if (theme === 'dark') {
      root.classList.add('dark');
    } else {
      root.classList.remove('dark');
    }

    localStorage.setItem(THEME_KEY, theme);
  }, [theme]);

  // Listen for system preference changes
  useEffect(() => {
    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');

    const handleChange = (e: MediaQueryListEvent) => {
      const userSet = localStorage.getItem(USER_SET_KEY);
      // Only auto-switch if user hasn't explicitly set a preference
      if (userSet !== 'true') {
        setThemeState(e.matches ? 'dark' : 'bright');
      }
    };

    mediaQuery.addEventListener('change', handleChange);
    return () => mediaQuery.removeEventListener('change', handleChange);
  }, []);

  const setTheme = (newTheme: Theme) => {
    setThemeState(newTheme);
    localStorage.setItem(USER_SET_KEY, 'true');
  };

  const toggleTheme = () => {
    setThemeState((prev) => (prev === 'bright' ? 'dark' : 'bright'));
    localStorage.setItem(USER_SET_KEY, 'true');
  };

  return (
    <ThemeContext.Provider value={{ theme, setTheme, toggleTheme }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  const context = useContext(ThemeContext);
  if (context === undefined) {
    throw new Error('useTheme must be used within a ThemeProvider');
  }
  return context;
}
