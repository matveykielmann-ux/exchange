/**
 * Original isometric illustration for the home hero: a settlement platform with
 * a coin above it, wired to wallets and bank nodes. Pure SVG + CSS animation
 * (coin turns and floats, pulses run along the wires, the platform glows); all
 * of it stops under prefers-reduced-motion. Decorative only.
 */

const COS = Math.cos(Math.PI / 6);
const SIN = 0.5;

/** Isometric projection of a ground point (x, y) raised by z. */
function iso(x: number, y: number, z = 0): [number, number] {
  return [(x - y) * COS, (x + y) * SIN - z];
}
const pt = (p: [number, number]) => `${p[0].toFixed(1)},${p[1].toFixed(1)}`;

interface BoxProps {
  x: number;
  y: number;
  z?: number;
  w: number;
  d: number;
  h: number;
  top: string;
  left: string;
  right: string;
  className?: string;
}

function Box({ x, y, z = 0, w, d, h, top, left, right, className }: BoxProps) {
  const t = [iso(x, y, z + h), iso(x + w, y, z + h), iso(x + w, y + d, z + h), iso(x, y + d, z + h)];
  const l = [iso(x, y + d, z + h), iso(x + w, y + d, z + h), iso(x + w, y + d, z), iso(x, y + d, z)];
  const r = [iso(x + w, y, z + h), iso(x + w, y + d, z + h), iso(x + w, y + d, z), iso(x + w, y, z)];
  return (
    <g className={className}>
      <polygon points={l.map(pt).join(' ')} fill={left} />
      <polygon points={r.map(pt).join(' ')} fill={right} />
      <polygon points={t.map(pt).join(' ')} fill={top} />
    </g>
  );
}

/** A flat square inset drawn on top of a box (the violet "screen" on each node). */
function Inset({ x, y, z, s, fill, className }: { x: number; y: number; z: number; s: number; fill: string; className?: string }) {
  const p = [iso(x, y, z), iso(x + s, y, z), iso(x + s, y + s, z), iso(x, y + s, z)];
  return <polygon className={className} points={p.map(pt).join(' ')} fill={fill} />;
}

const WHITE = { top: 'var(--art-white-top)', left: 'var(--art-white-left)', right: 'var(--art-white-right)' };
const DARK = { top: 'var(--art-dark-top)', left: 'var(--art-dark-left)', right: 'var(--art-dark-right)' };

/** Node positions on the ground plane, and where their wire meets the platform. */
const NODES = [
  { x: -150, y: -20, kind: 'white' as const, to: [-60, 10] },
  { x: -40, y: -150, kind: 'dark' as const, to: [10, -60] },
  { x: 150, y: -40, kind: 'white' as const, to: [70, 0] },
  { x: 140, y: 110, kind: 'white' as const, to: [70, 50] },
  { x: 30, y: 160, kind: 'dark' as const, to: [30, 70] },
  { x: -130, y: 120, kind: 'dark' as const, to: [-60, 50] },
];

export function HeroArt() {
  const coin = iso(5, 5, 150);
  return (
    <svg className="hero-art" viewBox="-260 -230 520 440" role="presentation" aria-hidden="true" focusable="false">
      <defs>
        <radialGradient id="art-glow" cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor="var(--art-glow)" stopOpacity="0.9" />
          <stop offset="100%" stopColor="var(--art-glow)" stopOpacity="0" />
        </radialGradient>
        <linearGradient id="art-coin" x1="0" x2="1" y1="0" y2="1">
          <stop offset="0%" stopColor="#f7d98b" />
          <stop offset="55%" stopColor="#d4a446" />
          <stop offset="100%" stopColor="#9a6b1f" />
        </linearGradient>
      </defs>

      {/* Wires (under everything) with travelling pulses */}
      <g className="hero-art__wires">
        {NODES.map((n, i) => {
          const a = iso(n.x + 25, n.y + 25, 8);
          const b = iso(n.to[0] ?? 0, n.to[1] ?? 0, 30);
          const d = `M${pt(a)} L${pt(b)}`;
          return (
            <g key={i}>
              <path d={d} className="hero-art__wire" />
              <path d={d} className="hero-art__pulse" style={{ animationDelay: `${i * 0.45}s` }} />
            </g>
          );
        })}
      </g>

      {/* Platform */}
      <ellipse className="hero-art__glow" cx={iso(5, 5, 60)[0]} cy={iso(5, 5, 60)[1]} rx="150" ry="80" fill="url(#art-glow)" />
      <Box x={-80} y={-80} w={170} d={170} h={18} {...DARK} />
      <Box
        x={-74}
        y={-74}
        z={18}
        w={158}
        d={158}
        h={30}
        top="var(--art-dark-top)"
        left="var(--art-dark-left)"
        right="var(--art-dark-right)"
      />
      <Inset x={-50} y={-50} z={48.5} s={110} fill="var(--art-screen)" className="hero-art__screen" />
      <path
        d={`M${pt(iso(-74, 84, 30))} L${pt(iso(84, 84, 30))} L${pt(iso(84, -74, 30))}`}
        fill="none"
        stroke="var(--art-accent)"
        strokeWidth="2"
        className="hero-art__seam"
      />

      {/* Nodes */}
      {NODES.map((n, i) => {
        const c = n.kind === 'white' ? WHITE : DARK;
        return (
          <g key={i} className="hero-art__node" style={{ animationDelay: `${i * 0.3}s` }}>
            <Box x={n.x} y={n.y} w={50} d={50} h={n.kind === 'white' ? 34 : 46} {...c} />
            <Inset x={n.x + 15} y={n.y + 15} z={n.kind === 'white' ? 34.5 : 46.5} s={20} fill="var(--art-accent)" />
          </g>
        );
      })}

      {/* Coin */}
      <g className="hero-art__coin-float">
        <ellipse cx={coin[0]} cy={iso(5, 5, 52)[1]} rx="34" ry="12" fill="var(--art-shadow)" className="hero-art__coin-shadow" />
        <g className="hero-art__coin" style={{ transformOrigin: `${coin[0]}px ${coin[1]}px` }}>
          <circle cx={coin[0]} cy={coin[1]} r="46" fill="#b07f2c" />
          <circle cx={coin[0] - 3} cy={coin[1]} r="46" fill="url(#art-coin)" />
          <circle cx={coin[0] - 3} cy={coin[1]} r="36" fill="none" stroke="#fff3c9" strokeOpacity="0.55" strokeWidth="2" />
          <text x={coin[0] - 3} y={coin[1] + 15} textAnchor="middle" className="hero-art__coin-sign">
            $
          </text>
        </g>
      </g>
    </svg>
  );
}
