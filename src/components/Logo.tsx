import { BRAND } from '@/config/brand';

/** Original mark: three settled layers (an isometric stack) inside a rounded seal. */
export function LogoMark() {
  return (
    <svg viewBox="0 0 28 28" aria-hidden="true" focusable="false">
      <rect x="1" y="1" width="26" height="26" rx="8" style={{ fill: 'var(--logo-bg)' }} />
      <path d="M14 7.2 20.5 10.6 14 14 7.5 10.6Z" fill="#fff" />
      <path d="M7.5 14 14 17.4 20.5 14" fill="none" stroke="#fff" strokeWidth="1.6" strokeLinejoin="round" opacity=".7" />
      <path d="M7.5 17.4 14 20.8 20.5 17.4" fill="none" stroke="#a78bfa" strokeWidth="1.6" strokeLinejoin="round" />
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
