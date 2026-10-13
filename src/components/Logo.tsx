import { BRAND } from '@/config/brand';

/** Original mark: a settled ledger line inside a square-ish seal. */
export function LogoMark() {
  return (
    <svg viewBox="0 0 28 28" aria-hidden="true" focusable="false">
      <rect x="1" y="1" width="26" height="26" rx="8" fill="#0F1E36" />
      <path d="M7.5 17.5h13" stroke="#FAF8F4" strokeWidth="2" strokeLinecap="round" />
      <path d="M7.5 11.5h8" stroke="#FAF8F4" strokeWidth="2" strokeLinecap="round" opacity=".55" />
      <circle cx="20" cy="11.5" r="2.25" fill="#3FB98A" />
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
