import { useEffect, useRef, useState } from 'react';
import { createCoinScene, type CoinScene } from './coinScene';

/**
 * Canvas host for the 3D coins. Loaded lazily so three.js stays out of the main
 * bundle. Renders only while on screen and the tab is visible; with reduced
 * motion it draws one still frame and ignores the pointer.
 */
export default function HeroCoins({ onError }: { onError: () => void }) {
  const ref = useRef<HTMLCanvasElement>(null);
  const [ready, setReady] = useState(false);
  const onErrorRef = useRef(onError);
  useEffect(() => {
    onErrorRef.current = onError;
  });

  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;
    const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const fontFamily = getComputedStyle(document.documentElement).getPropertyValue('--font-sans').trim() || 'sans-serif';
    let scene: CoinScene | null = null;
    let disposed = false;
    let visible = true;
    const cleanups: Array<() => void> = [];

    const sync = () => {
      if (!scene) return;
      if (visible && document.visibilityState === 'visible') scene.start();
      else scene.stop();
    };

    // Draw the faces with the site's font once it has loaded.
    const fontReady = document.fonts ? document.fonts.load(`800 100px ${fontFamily}`).catch(() => undefined) : Promise.resolve();
    void fontReady.then(() => {
      if (disposed) return;
      try {
        scene = createCoinScene(canvas, { reducedMotion, fontFamily });
      } catch {
        onErrorRef.current();
        return;
      }
      scene.resize();
      sync();
      setReady(true);

      const resize = new ResizeObserver(() => scene?.resize());
      resize.observe(canvas);
      const io = new IntersectionObserver(([entry]) => {
        visible = entry?.isIntersecting ?? true;
        sync();
      });
      io.observe(canvas);
      document.addEventListener('visibilitychange', sync);
      const onPointer = (e: PointerEvent) => {
        const r = canvas.getBoundingClientRect();
        scene?.setPointer(
          (e.clientX - (r.left + r.width / 2)) / (window.innerWidth / 2),
          (e.clientY - (r.top + r.height / 2)) / (window.innerHeight / 2),
        );
      };
      if (!reducedMotion) window.addEventListener('pointermove', onPointer, { passive: true });
      const onLost = (e: Event) => {
        e.preventDefault();
        onErrorRef.current();
      };
      canvas.addEventListener('webglcontextlost', onLost);
      cleanups.push(
        () => resize.disconnect(),
        () => io.disconnect(),
        () => document.removeEventListener('visibilitychange', sync),
        () => window.removeEventListener('pointermove', onPointer),
        () => canvas.removeEventListener('webglcontextlost', onLost),
      );
    });

    return () => {
      disposed = true;
      for (const c of cleanups) c();
      scene?.dispose();
    };
  }, []);

  return <canvas ref={ref} className={`hero-coins__canvas${ready ? ' is-ready' : ''}`} />;
}
