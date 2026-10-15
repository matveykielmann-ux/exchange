import { useCallback, useSyncExternalStore } from 'react';

/**
 * Colour theme. Dark is the CryptoBit default; a choice made with the header
 * toggle is stored on this device and set as data-theme on <html>, which
 * tokens.css reads. public/theme-init.js applies the stored choice before first
 * paint so there is no flash.
 */
export type Theme = 'light' | 'dark';
const KEY = 'cryptobit.theme';

function current(): Theme {
  return document.documentElement.dataset.theme === 'light' ? 'light' : 'dark';
}

const listeners = new Set<() => void>();
function subscribe(cb: () => void) {
  listeners.add(cb);
  return () => {
    listeners.delete(cb);
  };
}

export function useTheme(): [Theme, (t: Theme) => void] {
  const theme = useSyncExternalStore(subscribe, current, () => 'dark' as Theme);
  const setTheme = useCallback((t: Theme) => {
    document.documentElement.dataset.theme = t;
    document.querySelector('meta[name="theme-color"]')?.setAttribute('content', t === 'light' ? '#F7F4EE' : '#080808');
    try {
      window.localStorage.setItem(KEY, t);
    } catch {
      /* storage unavailable: the choice lasts for this page view */
    }
    listeners.forEach((l) => l());
  }, []);
  return [theme, setTheme];
}
