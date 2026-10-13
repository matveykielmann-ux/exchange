import { useEffect } from 'react';
import { BRAND } from '@/config/brand';

export function useDocumentTitle(title: string) {
  useEffect(() => {
    document.title = title ? `${title} · ${BRAND.name}` : `${BRAND.name} — Sell crypto for US dollars`;
  }, [title]);
}
