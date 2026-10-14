import { BRAND } from '@/config/brand';

/** Original mark: an arc over a vale (a shallow valley), inside a rounded seal. */
export function LogoMark() {
  return (
    <svg viewBox="0 0 28 28" aria-hidden="true" focusable="false">
      <rect x="1" y="1" width="26" height="26" rx="8" style={{ fill: 'var(--logo-bg)' }} />
      <path d="M7.5 16.5a6.5 6.5 0 0 1 13 0" fill="none" stroke="#fff" strokeWidth="2" strokeLinecap="round" />
      <path d="M8 20.2 14 17.2l6 3" fill="none" stroke="#a78bfa" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export function Logo() {
  return (
    <>
      <LogoMark />
      <span>{BRAND.name}</span>
    </>
  );
}
