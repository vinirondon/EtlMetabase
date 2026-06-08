import { createContext, useContext, useState, useEffect } from 'react';

const THEMES = {
  dark: {
    label: 'Dark',
    '--bg-base':      '#0f1117',
    '--bg-surface':   '#161b27',
    '--bg-elevated':  '#1e2535',
    '--bg-hover':     '#242f45',
    '--bg-input':     '#0f1117',
    '--border':       '#1e2535',
    '--border-hover': '#2d3748',
    '--text-primary': '#e2e8f0',
    '--text-muted':   '#8892a4',
    '--text-hint':    '#4a5568',
    '--scrollbar-track': '#0f1117',
    '--scrollbar-thumb': '#2d3748',
  },
  light: {
    label: 'Light',
    '--bg-base':      '#f1f5f9',
    '--bg-surface':   '#ffffff',
    '--bg-elevated':  '#f8fafc',
    '--bg-hover':     '#e2e8f0',
    '--bg-input':     '#ffffff',
    '--border':       '#e2e8f0',
    '--border-hover': '#cbd5e1',
    '--text-primary': '#0f172a',
    '--text-muted':   '#64748b',
    '--text-hint':    '#94a3b8',
    '--scrollbar-track': '#f1f5f9',
    '--scrollbar-thumb': '#cbd5e1',
  },
  darkblue: {
    label: 'Dark Blue',
    '--bg-base':      '#060d1f',
    '--bg-surface':   '#0d1b35',
    '--bg-elevated':  '#132040',
    '--bg-hover':     '#1a2d55',
    '--bg-input':     '#060d1f',
    '--border':       '#1a2d55',
    '--border-hover': '#2a4070',
    '--text-primary': '#cdd9f0',
    '--text-muted':   '#7a96c2',
    '--text-hint':    '#3d5580',
    '--scrollbar-track': '#060d1f',
    '--scrollbar-thumb': '#2a4070',
  },
};

const ThemeContext = createContext(null);

export function ThemeProvider({ children }) {
  const [theme, setTheme] = useState(() => localStorage.getItem('etl_theme') || 'dark');

  useEffect(() => {
    const vars = THEMES[theme] || THEMES.dark;
    const root = document.documentElement;
    Object.entries(vars).forEach(([k, v]) => root.style.setProperty(k, v));
    root.setAttribute('data-theme', theme);
    localStorage.setItem('etl_theme', theme);
  }, [theme]);

  return (
    <ThemeContext.Provider value={{ theme, setTheme, themes: THEMES }}>
      {children}
    </ThemeContext.Provider>
  );
}

export const useTheme = () => useContext(ThemeContext);
