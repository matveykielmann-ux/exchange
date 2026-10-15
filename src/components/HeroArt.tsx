import { lazy, Suspense, useState } from 'react';

const HeroCoins = lazy(() => import('./hero/HeroCoins'));

/** True when the browser can create a WebGL context (not in tests, old devices or with WebGL disabled). */
function supportsWebGL(): boolean {
  if (typeof window === 'undefined' || !('WebGLRenderingContext' in window)) return false;
  try {
    const c = document.createElement('canvas');
    return !!(c.getContext('webgl2') ?? c.getContext('webgl'));
  } catch {
    return false;
  }
}

/**
 * Home hero art: a gold BTC coin and a silver USD coin rendered in 3D with
 * three.js (lazy-loaded). Falls back to the CryptoBit mark when WebGL is not
 * available or the context is lost. Decorative only.
 */
export function HeroArt() {
  const [webgl] = useState(supportsWebGL);
  const [failed, setFailed] = useState(false);
  if (!webgl || failed) {
    return (
      <div className="hero-globe">
        <img src="/brand/cryptobit-mark.webp" alt="" width="312" height="220" decoding="async" fetchPriority="high" />
      </div>
    );
  }
  return (
    <div className="hero-coins" aria-hidden="true">
      <Suspense fallback={null}>
        <HeroCoins onError={() => setFailed(true)} />
      </Suspense>
    </div>
  );
}
