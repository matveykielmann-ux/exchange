import { BRAND } from '@/config/brand';
import { errorMessage } from '@/lib/errors';
import { Logo } from './Logo';
import { t } from '@/i18n';

/** Shown when the API can't be reached at start-up. The site never falls back to simulated data. */
export function BootError({ error }: { error: unknown }) {
  return (
    <main id="main" className="container boot-error">
      <div className="stack stack--lg" style={{ maxWidth: 560 }}>
        <div className="brand">
          <Logo />
        </div>
        <h1 className="display-l">
          {t("We can't reach")} {BRAND.name} {t('right now')}
        </h1>
        <p className="lead">{errorMessage(error)}</p>
        <p className="muted">{t('Nothing has changed with any request you made. Reload the page in a moment.')}</p>
        <div>
          <button type="button" className="btn btn--lg" onClick={() => window.location.reload()}>
            {t('Reload')}
          </button>
        </div>
      </div>
    </main>
  );
}
