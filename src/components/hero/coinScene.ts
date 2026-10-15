import {
  ACESFilmicToneMapping,
  AmbientLight,
  CanvasTexture,
  CircleGeometry,
  Color,
  CylinderGeometry,
  DirectionalLight,
  DoubleSide,
  Group,
  LatheGeometry,
  MathUtils,
  Mesh,
  MeshBasicMaterial,
  MeshPhysicalMaterial,
  NoColorSpace,
  PerspectiveCamera,
  PlaneGeometry,
  PMREMGenerator,
  RepeatWrapping,
  Scene,
  SRGBColorSpace,
  Vector2,
  WebGLRenderer,
  type BufferGeometry,
  type Material,
  type Texture,
} from 'three';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';

/**
 * The home hero's two coins, drawn with three.js: a gold BTC coin and a silver
 * USD coin. Each coin is real geometry (a reeded edge, bevelled rims and a
 * recessed field) with an embossed face generated on a canvas, lit by an
 * environment map so the metal picks up moving specular highlights. Kept free of
 * React so the component only wires it to a canvas.
 */

export interface CoinScene {
  /** Start or resume the animation loop. */
  start(): void;
  /** Pause the loop (off-screen, hidden tab). */
  stop(): void;
  /** Pointer position in -1…1 on both axes, for parallax. */
  setPointer(x: number, y: number): void;
  /** Match the drawing buffer to the canvas's CSS size. */
  resize(): void;
  dispose(): void;
}

export interface CoinSceneOptions {
  /** Render one still frame at a three-quarter angle and never animate. */
  reducedMotion: boolean;
  fontFamily: string;
}

interface CoinSpec {
  glyph: 'btc' | 'usd';
  legend: string;
  radius: number;
  color: string;
  position: [number, number, number];
  spin: number;
  phase: number;
  /** Pose used when motion is reduced: turned enough to show the edge. */
  stillYaw: number;
}

const COINS: CoinSpec[] = [
  {
    glyph: 'btc',
    legend: 'BITCOIN · BTC · BITCOIN · BTC · ',
    radius: 1.22,
    color: '#e3ad46',
    position: [-0.78, 0.22, 0.35],
    spin: 0.42,
    phase: 0,
    stillYaw: -0.45,
  },
  {
    glyph: 'usd',
    legend: 'US DOLLAR · USD · US DOLLAR · USD · ',
    radius: 1.02,
    color: '#cfd5de',
    position: [1.2, -0.12, -0.75],
    spin: -0.34,
    phase: 2.1,
    stillYaw: 0.62,
  },
];

const THICKNESS_RATIO = 0.15;
const FIELD_RATIO = 0.86;
const GROUND_Y = -1.72;
const TEX = 1024;

export function createCoinScene(canvas: HTMLCanvasElement, options: CoinSceneOptions): CoinScene {
  const renderer = new WebGLRenderer({ canvas, antialias: true, alpha: true, powerPreference: 'low-power' });
  renderer.setClearColor(0x000000, 0);
  renderer.outputColorSpace = SRGBColorSpace;
  renderer.toneMapping = ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.05;
  let pixelRatio = Math.min(window.devicePixelRatio || 1, 2);
  renderer.setPixelRatio(pixelRatio);

  const scene = new Scene();
  const pmrem = new PMREMGenerator(renderer);
  const room = new RoomEnvironment();
  const envTexture = pmrem.fromScene(room, 0.04).texture;
  scene.environment = envTexture;

  const camera = new PerspectiveCamera(27, 1, 0.1, 50);
  camera.position.set(0, 0.85, 9.6);
  camera.lookAt(0, 0, 0);

  scene.add(new AmbientLight(0xffffff, 0.25));
  const key = new DirectionalLight(0xfff1dc, 2.2);
  key.position.set(3, 4, 6);
  scene.add(key);
  const rim = new DirectionalLight(new Color('#a78bfa'), 1.6);
  rim.position.set(-4, 2, -5);
  scene.add(rim);

  const disposables: Array<BufferGeometry | Material | Texture> = [envTexture];
  const track = <T extends BufferGeometry | Material | Texture>(x: T): T => {
    disposables.push(x);
    return x;
  };

  const reeding = track(makeReedingNormalMap());
  const shadowTexture = track(makeShadowTexture());
  const root = new Group();
  scene.add(root);

  const coins = COINS.map((spec) => {
    const coin = buildCoin(spec, options.fontFamily, reeding, track);
    coin.group.position.set(...spec.position);
    root.add(coin.group);
    const shadow = new Mesh(
      track(new PlaneGeometry(spec.radius * 2.6, spec.radius * 2.6)),
      track(new MeshBasicMaterial({ map: shadowTexture, transparent: true, depthWrite: false, opacity: 0.5 })),
    );
    shadow.rotation.x = -Math.PI / 2;
    shadow.position.set(spec.position[0], GROUND_Y, spec.position[2]);
    root.add(shadow);
    return { spec, group: coin.group, shadow };
  });

  const pointer = new Vector2();
  const eased = new Vector2();
  let frame = 0;
  let running = false;
  let last = performance.now();
  let elapsed = 0;
  let slowFrames = 0;

  function pose(t: number) {
    for (const { spec, group, shadow } of coins) {
      const yaw = options.reducedMotion ? spec.stillYaw : spec.phase + t * spec.spin;
      const bob = options.reducedMotion ? 0 : Math.sin(t * 1.05 + spec.phase) * 0.12;
      group.rotation.set(
        0.14 + (options.reducedMotion ? 0 : Math.sin(t * 0.55 + spec.phase) * 0.16),
        yaw,
        options.reducedMotion ? -0.06 : Math.sin(t * 0.4 + spec.phase) * 0.07,
      );
      group.position.y = spec.position[1] + bob;
      // The shadow follows the coin's footprint: long when face-on, short edge-on, fainter when higher.
      const height = group.position.y - GROUND_Y;
      shadow.rotation.z = -yaw;
      shadow.scale.set(0.9, 0.22 + Math.abs(Math.sin(yaw)) * 0.1, 1);
      (shadow.material as MeshBasicMaterial).opacity = MathUtils.clamp(0.75 - height * 0.12, 0.25, 0.6);
    }
    // A slowly travelling key light sweeps highlights across the metal.
    key.position.set(Math.cos(t * 0.3) * 5, 4, 6 + Math.sin(t * 0.3) * 2);
    eased.lerp(pointer, options.reducedMotion ? 1 : 0.06);
    root.rotation.y = eased.x * 0.16;
    root.rotation.x = eased.y * 0.08;
    camera.position.x = eased.x * 0.35;
    camera.lookAt(0, 0, 0);
  }

  function render() {
    renderer.render(scene, camera);
  }

  function tick(now: number) {
    const dt = Math.min((now - last) / 1000, 0.1);
    last = now;
    elapsed += dt;
    // Drop to 1x pixels if the device struggles to hold ~25 fps.
    if (dt > 0.04 && pixelRatio > 1) {
      if (++slowFrames > 45) {
        pixelRatio = 1;
        renderer.setPixelRatio(1);
        resize();
      }
    } else slowFrames = Math.max(0, slowFrames - 1);
    pose(elapsed);
    render();
    frame = requestAnimationFrame(tick);
  }

  function resize() {
    const w = canvas.clientWidth;
    const h = canvas.clientHeight;
    if (!w || !h) return;
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    // Keep both coins in frame on narrow, tall layouts.
    camera.position.z = w / h < 1 ? 9.6 / Math.max(w / h, 0.7) : 9.6;
    camera.updateProjectionMatrix();
    if (!running) {
      pose(elapsed);
      render();
    }
  }

  return {
    start() {
      if (running || options.reducedMotion) {
        pose(elapsed);
        render();
        return;
      }
      running = true;
      last = performance.now();
      frame = requestAnimationFrame(tick);
    },
    stop() {
      running = false;
      cancelAnimationFrame(frame);
    },
    setPointer(x, y) {
      if (options.reducedMotion) return;
      pointer.set(MathUtils.clamp(x, -1, 1), MathUtils.clamp(y, -1, 1));
    },
    resize,
    dispose() {
      running = false;
      cancelAnimationFrame(frame);
      for (const d of disposables) d.dispose();
      room.dispose();
      pmrem.dispose();
      renderer.dispose();
      renderer.forceContextLoss();
    },
  };
}

function buildCoin(
  spec: CoinSpec,
  fontFamily: string,
  reeding: Texture,
  track: <T extends BufferGeometry | Material | Texture>(x: T) => T,
) {
  const r = spec.radius;
  const t = r * THICKNESS_RATIO;
  const group = new Group();
  const color = new Color(spec.color);

  const metal = { color, metalness: 1, roughness: 0.28, clearcoat: 0.35, clearcoatRoughness: 0.25 };

  // Reeded edge: an open cylinder whose normal map carries the milling.
  const edgeMap = reeding.clone();
  edgeMap.repeat.set(Math.round(150 * r), 1);
  edgeMap.needsUpdate = true;
  track(edgeMap);
  const edge = new Mesh(
    track(new CylinderGeometry(r, r, t * 0.8, 192, 1, true).rotateX(Math.PI / 2)),
    track(new MeshPhysicalMaterial({ ...metal, roughness: 0.34, normalMap: edgeMap, normalScale: new Vector2(1.4, 1.4) })),
  );
  group.add(edge);

  // Rim profile, revolved: from the edge, up a bevel, across the raised rim, down into the field.
  const fieldR = r * FIELD_RATIO;
  const profile = [
    new Vector2(r, t * 0.4),
    new Vector2(r * 0.988, t * 0.5),
    new Vector2(r * 0.93, t * 0.52),
    new Vector2(r * 0.9, t * 0.5),
    new Vector2(fieldR, t * 0.4),
  ];
  const rimGeometry = track(new LatheGeometry(profile, 192).rotateX(Math.PI / 2));
  const rimMaterial = track(new MeshPhysicalMaterial({ ...metal, roughness: 0.2, side: DoubleSide }));

  const { normal, rough } = makeFaceMaps(spec, fontFamily);
  track(normal);
  track(rough);
  const faceMaterial = track(
    new MeshPhysicalMaterial({
      ...metal,
      roughness: 1,
      roughnessMap: rough,
      normalMap: normal,
      normalScale: new Vector2(1.1, 1.1),
    }),
  );
  const faceGeometry = track(new CircleGeometry(fieldR, 160));

  for (const side of [1, -1]) {
    const rimMesh = new Mesh(rimGeometry, rimMaterial);
    const face = new Mesh(faceGeometry, faceMaterial);
    face.position.z = t * 0.4;
    const half = new Group();
    half.add(rimMesh, face);
    if (side < 0) half.rotation.y = Math.PI;
    group.add(half);
  }
  return { group };
}

/** Height field for one face: the raised design is white on a black field. */
function drawHeight(ctx: CanvasRenderingContext2D, spec: CoinSpec, fontFamily: string) {
  const c = TEX / 2;
  ctx.fillStyle = '#000';
  ctx.fillRect(0, 0, TEX, TEX);
  ctx.fillStyle = '#fff';
  ctx.strokeStyle = '#fff';

  // Beaded border and an inner ring.
  const beads = 96;
  for (let i = 0; i < beads; i++) {
    const a = (i / beads) * Math.PI * 2;
    ctx.beginPath();
    ctx.arc(c + Math.cos(a) * c * 0.93, c + Math.sin(a) * c * 0.93, TEX * 0.0085, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.lineWidth = TEX * 0.008;
  ctx.beginPath();
  ctx.arc(c, c, c * 0.62, 0, Math.PI * 2);
  ctx.stroke();

  // Legend around the ring.
  const chars = [...spec.legend];
  ctx.font = `600 ${Math.round(TEX * 0.062)}px ${fontFamily}`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  chars.forEach((ch, i) => {
    ctx.save();
    ctx.translate(c, c);
    ctx.rotate((i / chars.length) * Math.PI * 2);
    ctx.fillText(ch, 0, -c * 0.77);
    ctx.restore();
  });

  // Central glyph.
  ctx.save();
  ctx.translate(c, c);
  if (spec.glyph === 'btc') {
    ctx.rotate((14 * Math.PI) / 180);
    const size = TEX * 0.5;
    ctx.font = `800 ${size}px ${fontFamily}`;
    const m = ctx.measureText('B');
    const w = m.actualBoundingBoxLeft + m.actualBoundingBoxRight;
    ctx.textBaseline = 'alphabetic';
    const baseline = (m.actualBoundingBoxAscent - m.actualBoundingBoxDescent) / 2;
    ctx.fillText('B', 0, baseline);
    // The two strokes that make a B into the bitcoin sign.
    const bar = size * 0.075;
    const reach = size * 0.11;
    const capTop = baseline - m.actualBoundingBoxAscent;
    for (const x of [-w * 0.24, w * 0.08]) {
      ctx.fillRect(x - bar / 2, capTop - reach, bar, reach + 2);
      ctx.fillRect(x - bar / 2, baseline - 2, bar, reach + 2);
    }
  } else {
    ctx.font = `700 ${TEX * 0.5}px ${fontFamily}`;
    const m = ctx.measureText('$');
    ctx.textBaseline = 'alphabetic';
    ctx.fillText('$', 0, (m.actualBoundingBoxAscent - m.actualBoundingBoxDescent) / 2);
  }
  ctx.restore();
}

/** Normal map (from a softened height field) and roughness map (frosted field, polished relief) for one face. */
function makeFaceMaps(spec: CoinSpec, fontFamily: string) {
  const height = document.createElement('canvas');
  height.width = height.height = TEX;
  const hctx = height.getContext('2d')!;
  drawHeight(hctx, spec, fontFamily);

  // Soften the relief so the sides read as bevels rather than cliffs.
  const soft = document.createElement('canvas');
  soft.width = soft.height = TEX;
  const sctx = soft.getContext('2d', { willReadFrequently: true })!;
  sctx.filter = 'blur(5px)';
  sctx.drawImage(height, 0, 0);
  const src = sctx.getImageData(0, 0, TEX, TEX).data;

  const normalCanvas = document.createElement('canvas');
  normalCanvas.width = normalCanvas.height = TEX;
  const nctx = normalCanvas.getContext('2d')!;
  const out = nctx.createImageData(TEX, TEX);
  const k = 3.2 / 255;
  const h = (x: number, y: number) => src[(Math.min(TEX - 1, Math.max(0, y)) * TEX + Math.min(TEX - 1, Math.max(0, x))) * 4]!;
  for (let y = 0; y < TEX; y++) {
    for (let x = 0; x < TEX; x++) {
      const dx = (h(x + 1, y) - h(x - 1, y)) * k;
      const dy = (h(x, y + 1) - h(x, y - 1)) * k;
      // Image y runs down while texture v runs up, so the y slope flips sign.
      const len = Math.hypot(dx, dy, 1);
      const i = (y * TEX + x) * 4;
      out.data[i] = ((-dx / len) * 0.5 + 0.5) * 255;
      out.data[i + 1] = ((dy / len) * 0.5 + 0.5) * 255;
      out.data[i + 2] = ((1 / len) * 0.5 + 0.5) * 255;
      out.data[i + 3] = 255;
    }
  }
  nctx.putImageData(out, 0, 0);

  // Roughness: frosted field (~0.55), mirror-polished relief (~0.16), like a proof coin.
  const roughCanvas = document.createElement('canvas');
  roughCanvas.width = roughCanvas.height = TEX;
  const rctx = roughCanvas.getContext('2d')!;
  const img = rctx.createImageData(TEX, TEX);
  const hs = hctx.getImageData(0, 0, TEX, TEX).data;
  for (let i = 0; i < img.data.length; i += 4) {
    const v = hs[i]! / 255;
    img.data[i] = img.data[i + 1] = img.data[i + 2] = 140 * (1 - v) + 40 * v;
    img.data[i + 3] = 255;
  }
  rctx.putImageData(img, 0, 0);

  const normal = new CanvasTexture(normalCanvas);
  normal.colorSpace = NoColorSpace;
  normal.anisotropy = 4;
  const rough = new CanvasTexture(roughCanvas);
  rough.colorSpace = NoColorSpace;
  return { normal, rough };
}

/** One period of a reeded edge as a normal map; repeated around the circumference. */
function makeReedingNormalMap() {
  const w = 32;
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = 4;
  const ctx = canvas.getContext('2d')!;
  const img = ctx.createImageData(w, 4);
  for (let x = 0; x < w; x++) {
    // A rounded ridge: slope of a half-sine across the period.
    const slope = Math.cos((x / w) * Math.PI * 2) * 0.9;
    const len = Math.hypot(slope, 1);
    for (let y = 0; y < 4; y++) {
      const i = (y * w + x) * 4;
      img.data[i] = ((-slope / len) * 0.5 + 0.5) * 255;
      img.data[i + 1] = 128;
      img.data[i + 2] = ((1 / len) * 0.5 + 0.5) * 255;
      img.data[i + 3] = 255;
    }
  }
  ctx.putImageData(img, 0, 0);
  const tex = new CanvasTexture(canvas);
  tex.colorSpace = NoColorSpace;
  tex.wrapS = RepeatWrapping;
  tex.wrapT = RepeatWrapping;
  return tex;
}

/** A soft elliptical contact shadow. */
function makeShadowTexture() {
  const s = 256;
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = s;
  const ctx = canvas.getContext('2d')!;
  const g = ctx.createRadialGradient(s / 2, s / 2, 0, s / 2, s / 2, s / 2);
  g.addColorStop(0, 'rgba(12,10,30,0.55)');
  g.addColorStop(0.45, 'rgba(12,10,30,0.22)');
  g.addColorStop(1, 'rgba(12,10,30,0)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, s, s);
  const tex = new CanvasTexture(canvas);
  tex.colorSpace = SRGBColorSpace;
  return tex;
}
