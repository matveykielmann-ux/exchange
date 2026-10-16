import { useCallback, useSyncExternalStore } from 'react';

/**
 * Colour theme. Dark is the customer-site default; CRM defaults to light.
 * A choice made with the header toggle is stored on this device and set as
 * data-theme on <html>, which tokens.css reads. public/theme-init.js applies
 * the stored choice before first paint so there is no flash.
 */
export type Theme = 'light' | 'dark';
export type ThemeScope = 'site' | 'crm';

const KEYS: Record<ThemeScope, string> = {
  site: 'cryptobit.theme',
  crm: 'cryptobit.crm-theme',
};

const DEFAULTS: Record<ThemeScope, Theme> = {
  site: 'dark',
  crm: 'light',
};

function scopeFromPath(pathname = typeof location !== 'undefined' ? location.pathname : '/'): ThemeScope {
  return pathname.startsWith('/admin') ? 'crm' : 'site';
}

function storageKey(scope: ThemeScope = scopeFromPath()) {
  return KEYS[scope];
}

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

function applyTheme(t: Theme) {
  document.documentElement.dataset.theme = t;
  document.querySelector('meta[name="theme-color"]')?.setAttribute('content', t === 'light' ? '#F7F4EE' : '#080808');
}

/** Apply theme for the current route scope (used when entering CRM vs customer site). */
export function syncThemeForScope(scope: ThemeScope = scopeFromPath()) {
  let t: Theme = DEFAULTS[scope];
  try {
    const stored = window.localStorage.getItem(storageKey(scope));
    if (stored === 'light' || stored === 'dark') t = stored;
  } catch {
    /* storage unavailable */
  }
  if (current() !== t) {
    applyTheme(t);
    listeners.forEach((l) => l());
  }
}

export function useTheme(scope: ThemeScope = 'site'): [Theme, (t: Theme) => void] {
  const theme = useSyncExternalStore(subscribe, current, () => DEFAULTS[scope]);
  const setTheme = useCallback(
    (t: Theme) => {
      applyTheme(t);
      try {
        window.localStorage.setItem(storageKey(scope), t);
      } catch {
        /* storage unavailable: the choice lasts for this page view */
      }
      listeners.forEach((l) => l());
    },
    [scope],
  );
  return [theme, setTheme];
}
