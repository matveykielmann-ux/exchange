/**
 * Lean GSAP entry for UI motion: core + useGSAP only. `@/lib/gsap` registers
 * every plugin and is meant for pages that need them; importing it from shared
 * components would put all plugins in the main bundle.
 *
 * Motion rules (docs/design-spec.md §7): short opacity/transform moves that
 * explain a change, and nothing animates when the user prefers reduced motion
 * (wrap tweens in `gsap.matchMedia()` with REDUCED_OK).
 */
import { gsap } from 'gsap';
import { useGSAP } from '@gsap/react';

gsap.registerPlugin(useGSAP);

export const REDUCED_OK = '(prefers-reduced-motion: no-preference)';
export { gsap, useGSAP };
