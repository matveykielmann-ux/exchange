/**
 * Single GSAP setup module: import `gsap` / `useGSAP` from here (not from
 * "gsap" directly) so every plugin is registered exactly once before use.
 *
 * For shared UI components prefer the lean `@/lib/motion`.
 *
 * Motion rules (docs/design-spec.md §7): short opacity/transform moves
 * (≤0.5s) that explain a change, never counting money up from zero, and
 * nothing animates when the user prefers reduced motion (use
 * `gsap.matchMedia()` with "(prefers-reduced-motion: no-preference)").
 */
import { gsap } from 'gsap';
import { useGSAP } from '@gsap/react';

import { CustomEase } from 'gsap/CustomEase';
// CustomBounce requires CustomEase
import { CustomBounce } from 'gsap/CustomBounce';
// CustomWiggle requires CustomEase
import { CustomWiggle } from 'gsap/CustomWiggle';
import { RoughEase, ExpoScaleEase, SlowMo } from 'gsap/EasePack';

import { Draggable } from 'gsap/Draggable';
import { DrawSVGPlugin } from 'gsap/DrawSVGPlugin';
import { EaselPlugin } from 'gsap/EaselPlugin';
import { Flip } from 'gsap/Flip';
import { GSDevTools } from 'gsap/GSDevTools';
import { InertiaPlugin } from 'gsap/InertiaPlugin';
import { MotionPathHelper } from 'gsap/MotionPathHelper';
import { MotionPathPlugin } from 'gsap/MotionPathPlugin';
import { MorphSVGPlugin } from 'gsap/MorphSVGPlugin';
import { Observer } from 'gsap/Observer';
import { Physics2DPlugin } from 'gsap/Physics2DPlugin';
import { PhysicsPropsPlugin } from 'gsap/PhysicsPropsPlugin';
import { PixiPlugin } from 'gsap/PixiPlugin';
import { ScrambleTextPlugin } from 'gsap/ScrambleTextPlugin';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
// ScrollSmoother requires ScrollTrigger
import { ScrollSmoother } from 'gsap/ScrollSmoother';
import { ScrollToPlugin } from 'gsap/ScrollToPlugin';
import { SplitText } from 'gsap/SplitText';
import { TextPlugin } from 'gsap/TextPlugin';

gsap.registerPlugin(
  useGSAP,
  Draggable,
  DrawSVGPlugin,
  EaselPlugin,
  Flip,
  GSDevTools,
  InertiaPlugin,
  MotionPathHelper,
  MotionPathPlugin,
  MorphSVGPlugin,
  Observer,
  Physics2DPlugin,
  PhysicsPropsPlugin,
  PixiPlugin,
  ScrambleTextPlugin,
  ScrollTrigger,
  ScrollSmoother,
  ScrollToPlugin,
  SplitText,
  TextPlugin,
  RoughEase,
  ExpoScaleEase,
  SlowMo,
  CustomEase,
  CustomBounce,
  CustomWiggle,
);

export {
  gsap,
  useGSAP,
  CustomEase,
  CustomBounce,
  CustomWiggle,
  RoughEase,
  ExpoScaleEase,
  SlowMo,
  Draggable,
  DrawSVGPlugin,
  EaselPlugin,
  Flip,
  GSDevTools,
  InertiaPlugin,
  MotionPathHelper,
  MotionPathPlugin,
  MorphSVGPlugin,
  Observer,
  Physics2DPlugin,
  PhysicsPropsPlugin,
  PixiPlugin,
  ScrambleTextPlugin,
  ScrollTrigger,
  ScrollSmoother,
  ScrollToPlugin,
  SplitText,
  TextPlugin,
};
