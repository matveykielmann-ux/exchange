import { Icon } from '@/components/Icon';
import { t } from '@/i18n';
import { useTheme, type ThemeScope } from '@/lib/theme';

/** Light/dark control for the customer header or the CRM bar. */
export function ThemeToggle({ scope = 'site' }: { scope?: ThemeScope }) {
  const [theme, setTheme] = useTheme(scope);
  const next = theme === 'dark' ? 'light' : 'dark';
  return (
    <button
      type="button"
      className="btn btn--ghost theme-toggle"
      aria-label={t('Switch to {0} theme', [next])}
      onClick={() => setTheme(next)}
    >
      <Icon name={theme === 'dark' ? 'sun' : 'moon'} width={18} height={18} />
    </button>
  );
}
