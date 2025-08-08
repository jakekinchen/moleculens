'use client';
import React, { useEffect, useMemo, useRef } from 'react';

type Variant = 'ring' | 'cluster' | 'benzene' | 'helix';
type Ramp = 'sine' | 'quint' | 'smoothstep';

export type LoadingAnimationProps = {
  size?: number;
  variant?: Variant;
  atoms?: number;
  speed?: number;           // rotations per second baseline
  wobble?: number;          // 0..1 radial modulation depth
  radius?: number;          // main ring radius in px
  atomRadius?: number;      // atom dot radius in px
  lineWidth?: number;
  atomColor?: string;       // e.g. '#9bd0ff'
  bondColor?: string;       // e.g. '#7aa6ff'
  glow?: number;            // 0..1
  background?: string | null;
  ramp?: Ramp;
  seed?: number | string;
  paused?: boolean;
  reduceMotion?: boolean;
  className?: string;
  style?: React.CSSProperties;
  ariaLabel?: string;
};

const TAU = Math.PI * 2;
const clamp = (x: number, a = 0, b = 1) => Math.max(a, Math.min(b, x));
const mix = (a: number, b: number, t: number) => a + (b - a) * t;
const smoothstep = (x: number) => x * x * (3 - 2 * x);
const easeQuint = (x: number) => (x < 0.5 ? 16 * x ** 5 : 1 - Math.pow(-2 * x + 2, 5) / 2);
const rampShape = (kind: Ramp, x: number) =>
  kind === 'quint' ? easeQuint(x) : kind === 'smoothstep' ? smoothstep(x) : 0.5 - 0.5 * Math.cos(TAU * x);
const lerpExp = (a: number, b: number, dt: number, lambda: number) => a + (1 - Math.exp(-lambda * dt)) * (b - a);
const hash = (s: string) => {
  let h = 2166136261 >>> 0;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
};
const mulberry32 = (a: number) => {
  return () => {
    let t = (a += 0x6d2b79f5);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
};
const rgba = (hex: string, alpha = 1) => {
  const h = hex.replace('#', '');
  const n = parseInt(h.length === 3 ? h.split('').map(c => c + c).join('') : h, 16);
  const r = (n >> 16) & 255,
    g = (n >> 8) & 255,
    b = n & 255;
  return `rgba(${r},${g},${b},${alpha})`;
};

export default function LoadingAnimation({
  size = 220,
  variant = 'ring',
  atoms = 12,
  speed = 0.25,
  wobble = 0.45,
  radius,
  atomRadius,
  lineWidth,
  atomColor = '#9bd0ff',
  bondColor = '#7aa6ff',
  glow = 0.5,
  background = null,
  ramp = 'quint',
  seed = 7,
  paused = false,
  reduceMotion,
  className,
  style,
  ariaLabel = 'Loading'
}: LoadingAnimationProps) {
  const ref = useRef<HTMLCanvasElement>(null);
  const cfg = useMemo(() => {
    const R = radius ?? Math.floor(size * 0.38);
    const dotR = atomRadius ?? Math.max(2, Math.floor(size * 0.04));
    const lw = lineWidth ?? Math.max(1, Math.floor(size * 0.012));
    const n = variant === 'benzene' ? 6 : Math.max(3, atoms);
    const s = typeof seed === 'number' ? seed : hash(String(seed));
    const rand = mulberry32(s);
    const baseAngles = Array.from({ length: n }, (_, i) => (i / n) * TAU + rand() * 0.08);
    const phase = Array.from({ length: n }, () => rand() * TAU);
    const rings =
      variant === 'cluster'
        ? Array.from({ length: n }, () => mix(0.65, 1.1, rand()) * R)
        : variant === 'helix'
        ? Array.from({ length: n }, (_, i) => mix(0.5, 1.15, (i % 2) / 1) * R)
        : Array.from({ length: n }, () => R);
    const bonds: [number, number][] = [];
    for (let i = 0; i < n; i++) bonds.push([i, (i + 1) % n]);
    if (variant !== 'ring') for (let i = 0; i < n; i++) bonds.push([i, (i + 2) % n]);
    return { R, dotR, lw, n, baseAngles, phase, rings, rand };
  }, [size, atoms, variant, radius, atomRadius, lineWidth, seed]);

  useEffect(() => {
    const c = ref.current;
    if (!c) return;
    const ctx = c.getContext('2d', { alpha: true });
    if (!ctx) return;

    const dpr = Math.max(1, Math.min(3, window.devicePixelRatio || 1));
    c.width = Math.floor(size * dpr);
    c.height = Math.floor(size * dpr);
    c.style.width = `${size}px`;
    c.style.height = `${size}px`;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    const reduced =
      reduceMotion ??
      (typeof window !== 'undefined' &&
        window.matchMedia &&
        window.matchMedia('(prefers-reduced-motion: reduce)').matches);

    const cx = size / 2;
    const cy = size / 2;
    const pos = new Float32Array(cfg.n * 2);
    const tmp = new Float32Array(cfg.n * 2);
    for (let i = 0; i < cfg.n; i++) {
      const ang = cfg.baseAngles[i];
      pos[i * 2] = cx + Math.cos(ang) * cfg.rings[i];
      pos[i * 2 + 1] = cy + Math.sin(ang) * cfg.rings[i];
    }

    let raf = 0;
    let tPrev = performance.now() / 1000;
    const lambda = 10; // smoothing strength
    const glowPx = Math.floor(mix(0, size * 0.08, clamp(glow)));
    const atomInner = rgba('#ffffff', 0.9);
    const bondStroke = rgba(bondColor, 0.9);
    const atomStroke = rgba(atomColor, 0.85);

    const draw = (now: number) => {
      const t = now / 1000;
      const dt = Math.min(0.033, Math.max(0.001, t - tPrev));
      tPrev = t;

      if (background) {
        ctx.globalAlpha = 1;
        ctx.fillStyle = background;
        ctx.fillRect(0, 0, size, size);
      } else {
        ctx.clearRect(0, 0, size, size);
      }

      const lfo = rampShape(ramp, (t * 0.25) % 1); // slow envelope
      const w = mix(0.7, 1.35, lfo) * speed * TAU;

      for (let i = 0; i < cfg.n; i++) {
        const base = cfg.baseAngles[i] + w * t;
        const wob = wobble * 0.18 * cfg.rings[i] * Math.sin(t * 1.2 + cfg.phase[i]);
        const z = variant === 'helix' ? Math.sin(base * 1.5 + cfg.phase[i]) : 0; // pseudo depth
        const r = cfg.rings[i] + wob + z * (cfg.R * 0.12);
        const ang = base + Math.sin(t * 0.9 + cfg.phase[i]) * 0.15;
        tmp[i * 2] = cx + Math.cos(ang) * r;
        tmp[i * 2 + 1] = cy + Math.sin(ang) * r;
      }

      for (let i = 0; i < cfg.n; i++) {
        pos[i * 2] = reduced || paused ? tmp[i * 2] : lerpExp(pos[i * 2], tmp[i * 2], dt, lambda);
        pos[i * 2 + 1] = reduced || paused ? tmp[i * 2 + 1] : lerpExp(pos[i * 2 + 1], tmp[i * 2 + 1], dt, lambda);
      }

      ctx.save();
      ctx.lineWidth = cfg.lw;
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      ctx.shadowBlur = glowPx;
      ctx.shadowColor = rgba(atomColor, 0.6);
      ctx.globalCompositeOperation = 'lighter';
      ctx.strokeStyle = bondStroke;

      for (let b = 0; b < cfg.n * (variant === 'ring' ? 1 : 2); b++) {
        const pair = b < cfg.n ? [b, (b + 1) % cfg.n] : [b - cfg.n, (b - cfg.n + 2) % cfg.n];
        const i = pair[0],
          j = pair[1];
        const x1 = pos[i * 2],
          y1 = pos[i * 2 + 1],
          x2 = pos[j * 2],
          y2 = pos[j * 2 + 1];
        ctx.globalAlpha = mix(0.35, 0.9, lfo);
        ctx.beginPath();
        if (variant === 'helix') {
          // slight curve for helix bonds
          const mx = (x1 + x2) / 2,
            my = (y1 + y2) / 2;
          const nx = my - y1,
            ny = x1 - mx;
          ctx.moveTo(x1, y1);
          ctx.quadraticCurveTo(mx + nx * 0.06, my + ny * 0.06, x2, y2);
        } else {
          ctx.moveTo(x1, y1);
          ctx.lineTo(x2, y2);
        }
        ctx.stroke();

        if (variant === 'benzene') {
          // hint of double bond
          const dx = x2 - x1,
            dy = y2 - y1;
          const len = Math.hypot(dx, dy) || 1;
          const ox = (-dy / len) * cfg.lw * 1.6;
          const oy = (dx / len) * cfg.lw * 1.6;
          ctx.globalAlpha = mix(0.25, 0.6, lfo);
          ctx.beginPath();
          ctx.moveTo(x1 + ox, y1 + oy);
          ctx.lineTo(x2 + ox, y2 + oy);
          ctx.stroke();
        }
      }
      ctx.restore();

      for (let i = 0; i < cfg.n; i++) {
        const x = pos[i * 2],
          y = pos[i * 2 + 1];
        const r = cfg.dotR * mix(0.8, 1.25, 0.5 + 0.5 * Math.sin(t * 1.7 + cfg.phase[i]));
        const g = ctx.createRadialGradient(x, y, 0, x, y, r * 1.6);
        g.addColorStop(0, atomInner);
        g.addColorStop(0.25, rgba(atomColor, 0.95));
        g.addColorStop(1, rgba(atomColor, 0.02));
        ctx.fillStyle = g;
        ctx.beginPath();
        ctx.arc(x, y, r, 0, TAU);
        ctx.fill();

        ctx.globalAlpha = 1;
        ctx.strokeStyle = atomStroke;
        ctx.lineWidth = Math.max(1, cfg.lw * 0.75);
        ctx.beginPath();
        ctx.arc(x, y, r * 0.75, 0, TAU);
        ctx.stroke();
      }

      if (!paused && !reduced) raf = requestAnimationFrame(draw);
    };

    draw(performance.now());
    return () => cancelAnimationFrame(raf);
  }, [
    size,
    atomColor,
    bondColor,
    background,
    glow,
    wobble,
    speed,
    ramp,
    paused,
    reduceMotion,
    cfg.n,
    cfg.R,
    cfg.lw,
    cfg.dotR,
    cfg.baseAngles,
    cfg.phase,
    cfg.rings
  ]);

  return (
    <canvas
      ref={ref}
      role="img"
      aria-label={ariaLabel}
      className={className}
      style={{ display: 'block', width: size, height: size, ...style }}
    />
  );
}
