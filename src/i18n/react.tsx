import { Fragment, type ReactNode } from 'react';
import { LANGS, setLang, t } from './index';
import { useLang } from './useLang';

/** Re-renders the whole interface when the language changes; routes, session and the exchange draft are kept. */
export function LanguageRoot({ children }: { children: ReactNode }) {
  const lang = useLang();
  return <Fragment key={lang}>{children}</Fragment>;
}

/** The EN / RU switch in the site header and the admin bar. */
export function LanguageSwitch({ className = '' }: { className?: string }) {
  const lang = useLang();
  return (
    <div className={`lang-switch ${className}`} role="group" aria-label={t('Language')}>
      {LANGS.map((l) => (
        <button
          key={l}
          type="button"
          lang={l}
          aria-pressed={lang === l}
          aria-label={l === 'en' ? 'English' : 'Русский'}
          onClick={() => setLang(l)}
        >
          {l.toUpperCase()}
        </button>
      ))}
    </div>
  );
}
