import { useEffect } from 'react';
import { BRAND } from '@/config/brand';
import { t } from '@/i18n';

export function useDocumentTitle(title: string) {
  useEffect(() => {
    document.title = title ? `${t(title)} · ${BRAND.name}` : `${BRAND.name} — ${t('Sell crypto for US dollars')}`;
  }, [title]);
}
