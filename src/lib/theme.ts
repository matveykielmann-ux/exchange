import { useCallback, useSyncExternalStore } from 'react';

/**
 * Colour theme. With no stored choice the page follows the OS (prefers-color-scheme);
 * a choice made with the header toggle is stored on this device and set as
 * data-theme on <html>, which tokens.css reads. index.html applies the stored
 * choice before first paint so there is no flash.
 */
export type Theme = 'light' | 'dark';
const KEY = 'settlewell.theme';
const media = () => window.matchMedia('(prefers-color-scheme: dark)');

function current(): Theme {
  const set = document.documentElement.dataset.theme;
  if (set === 'light' || set === 'dark') return set;
  return media().matches ? 'dark' : 'light';
}

const listeners = new Set<() => void>();
function subscribe(cb: () => void) {
  listeners.add(cb);
  const mq = media();
  mq.addEventListener('change', cb);
  return () => {
    listeners.delete(cb);
    mq.removeEventListener('change', cb);
  };
}

export function useTheme(): [Theme, (t: Theme) => void] {
  const theme = useSyncExternalStore(subscribe, current, () => 'light' as Theme);
  const setTheme = useCallback((t: Theme) => {
    document.documentElement.dataset.theme = t;
    try {
      window.localStorage.setItem(KEY, t);
    } catch {
      /* storage unavailable: the choice lasts for this page view */
    }
    listeners.forEach((l) => l());
  }, []);
  return [theme, setTheme];
}
