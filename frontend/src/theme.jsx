import { createContext, useContext, useState, useEffect } from 'react';

const ThemeContext = createContext();

const OVERRIDE_KEY = 'pika-theme-override';
const DARK_QUERY = '(prefers-color-scheme: dark)';

export function ThemeProvider({ children }) {
  // Only an explicit toggle counts as an override. v3 wrote `pika-theme` on every page
  // load, so a value left there says nothing about what the user actually chose —
  // dropping it is what lets system preference win again for existing visitors.
  const [override, setOverride] = useState(() => {
    localStorage.removeItem('pika-theme');
    return localStorage.getItem(OVERRIDE_KEY);
  });
  const [systemDark, setSystemDark] = useState(() => window.matchMedia(DARK_QUERY).matches);

  const dark = override ? override === 'dark' : systemDark;

  useEffect(() => {
    document.documentElement.dataset.theme = document.documentElement.style.colorScheme =
      dark ? 'dark' : 'light';
  }, [dark]);

  // Keep following the OS while the page is open, unless overridden
  useEffect(() => {
    const mq = window.matchMedia(DARK_QUERY);
    const onChange = (e) => setSystemDark(e.matches);
    mq.addEventListener('change', onChange);
    return () => mq.removeEventListener('change', onChange);
  }, []);

  const toggle = () => {
    const next = dark ? 'light' : 'dark';
    localStorage.setItem(OVERRIDE_KEY, next);
    setOverride(next);
  };

  return (
    <ThemeContext.Provider value={{ dark, toggle }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  return useContext(ThemeContext);
}
