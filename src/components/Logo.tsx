import { BRAND } from '@/config/brand';

/**
 * The CryptoBit mark: the gold digital globe wrapped by an orbit that ends in
 * an arrow. A raster cut from the approved brand board (public/brand/); it is
 * not redrawn, because the mark is a detailed 3D render.
 */
export function LogoMark({ size = 40 }: { size?: number }) {
  return (
    <img className="brand__mark" src="/brand/cryptobit-mark.webp" alt="" width={Math.round(size * 1.41)} height={size} decoding="async" />
  );
}

/** Horizontal lockup: mark, "CryptoBit" and "EXCHANGE". */
export function Logo() {
  return (
    <>
      <LogoMark />
      <span className="brand__word" aria-hidden="true">
        <span className="brand__name">
          Crypto<span className="brand__accent">Bit</span>
        </span>
        <span className="brand__sub">Exchange</span>
      </span>
      <span className="visually-hidden">{BRAND.name}</span>
    </>
  );
}
