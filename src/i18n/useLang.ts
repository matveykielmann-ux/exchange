import { useSyncExternalStore } from 'react';
import { getLang, subscribeLang, type Lang } from './index';

export function useLang(): Lang {
  return useSyncExternalStore(subscribeLang, getLang, () => 'en' as Lang);
}
