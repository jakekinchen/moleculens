import { createHash } from 'crypto';
import type { FigureSpec } from './spec';

function roundNumber(n: number): number {
  // canonical float rounding to 6 decimals
  return Math.round(n * 1e6) / 1e6;
}

function canonicalize(value: any): any {
  if (value === null || typeof value !== 'object') {
    if (typeof value === 'number' && Number.isFinite(value)) return roundNumber(value);
    return value;
  }
  if (Array.isArray(value)) return value.map(canonicalize);
  const out: Record<string, any> = {};
  for (const k of Object.keys(value).sort()) out[k] = canonicalize(value[k]);
  return out;
}

export function canonicalJSONString(spec: FigureSpec): string {
  const canon = canonicalize(spec);
  // no whitespace; deterministic key order
  return JSON.stringify(canon);
}

export function specId(spec: FigureSpec): string {
  const s = canonicalJSONString(spec);
  return createHash('sha256').update(s).digest('hex');
}

// content-addressed keys
export function assetKey(spec_id: string, name: '2d.svg'|'2d.png'|'3d.png'|'scene.glb'|'meta.json'): string {
  return `figures/${spec_id}/${name}`;
}


