/**
 * Interface language (EN / RU). English is the default and the source text:
 * every visible string is written in English and passed through `t()`, which
 * looks it up in the Russian dictionary when Russian is selected and falls
 * back to the English text otherwise. One dictionary, no duplicated pages.
 *
 * Placeholders: `t('Order {0} placed', [ref])` or `t('Hi {name}', { name })`.
 * Technical identifiers, asset codes, addresses and amounts are passed in as
 * values and never translated.
 *
 * The choice is kept in localStorage and on <html lang>. Changing it
 * re-renders the app (see LanguageRoot), so plain `t()` calls are enough.
 */
import { RU, RU_PATTERNS } from './ru';

export type Lang = 'en' | 'ru';
export const LANGS: readonly Lang[] = ['en', 'ru'];
const STORAGE_KEY = 'cryptobit.lang';

function stored(): Lang {
  try {
    const v = globalThis.localStorage?.getItem(STORAGE_KEY);
    return v === 'ru' ? 'ru' : 'en';
  } catch {
    return 'en';
  }
}

let current: Lang = stored();
const listeners = new Set<() => void>();

function applyDocumentLang(lang: Lang) {
  if (typeof document !== 'undefined') document.documentElement.lang = lang;
}
applyDocumentLang(current);

export function getLang(): Lang {
  return current;
}

export function setLang(lang: Lang) {
  if (lang === current) return;
  current = lang;
  try {
    globalThis.localStorage?.setItem(STORAGE_KEY, lang);
  } catch {
    // Private mode or blocked storage: the choice lasts for this page only.
  }
  applyDocumentLang(lang);
  listeners.forEach((l) => l());
}

export function subscribeLang(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

type Vars = readonly unknown[] | Record<string, unknown>;

function fill(text: string, vars?: Vars): string {
  if (!vars) return text;
  return text.replace(/\{(\w+)\}/g, (m, k: string) => {
    const v = (vars as Record<string, unknown>)[k];
    return v === undefined || v === null ? m : String(v);
  });
}

/** Russian for an English source string, or undefined when there is none. */
export function lookupRu(text: string): string | undefined {
  const exact = RU[text];
  if (exact !== undefined) return exact;
  for (const [re, to] of RU_PATTERNS) {
    const m = re.exec(text);
    if (m) return to(m.slice(1), (inner) => lookupRu(inner) ?? inner);
  }
  return undefined;
}

/** Translates an English interface string into the selected language. */
export function t(text: string, vars?: Vars): string {
  if (current === 'ru') return fill(lookupRu(text) ?? text, vars);
  return fill(text, vars);
}

/** Translates a node when it is a plain string (labels and messages passed into shared components). */
export function tNode<T>(node: T): T | string {
  return typeof node === 'string' ? t(node) : node;
}

/** Translates a string that may be absent (server text, optional labels). */
export function tMaybe(text: string | null | undefined): string {
  return text ? t(text) : '';
}
