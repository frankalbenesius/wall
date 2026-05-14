import { createNoise2D } from 'simplex-noise';

export interface Block {
  x: number;
  y: number;
  w: number;
  h: number;
  height: number;
  colorIndex: number;
}

function fnv1a(s: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

function mulberry32(seed: number): () => number {
  let a = seed;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export interface GeneratorOptions {
  seed: string;
  gridN: number;
  maxDepth: number;
  maxHeight: number;
  paletteSize: number;
  noiseFreqHeight: number;
  noiseFreqColor: number;
}

export function generateBlocks(opts: GeneratorOptions): Block[] {
  const { seed, gridN, maxDepth, maxHeight, paletteSize, noiseFreqHeight, noiseFreqColor } = opts;
  const base = fnv1a(seed);

  // Two noise fields + one RNG, all seeded from the input
  const heightNoise = createNoise2D(mulberry32(base));
  const colorNoise = createNoise2D(mulberry32(base ^ 0xdeadbeef));
  const rng = mulberry32(base ^ 0xcafebabe);

  const minSplitSize = gridN / 12;
  const blocks: Block[] = [];

  function partition(x: number, y: number, w: number, h: number, depth: number): void {
    const canSplitW = w > minSplitSize * 2;
    const canSplitH = h > minSplitSize * 2;
    const splitChance = 0.90 - (maxDepth - depth) * 0.08;

    if (depth === 0 || (!canSplitW && !canSplitH) || rng() > splitChance) {
      const cx = (x + w * 0.5) / gridN;
      const cy = (y + h * 0.5) / gridN;
      const nv = heightNoise(cx * noiseFreqHeight, cy * noiseFreqHeight);
      const height = Math.max(1, Math.round(((nv + 1) / 2) * maxHeight));
      const cv = colorNoise(cx * noiseFreqColor, cy * noiseFreqColor);
      const colorIndex = Math.abs(Math.floor(((cv + 1) / 2) * paletteSize)) % paletteSize;
      blocks.push({ x, y, w, h, height, colorIndex });
      return;
    }

    const splitWide = canSplitW && (!canSplitH || (w >= h ? rng() < 0.62 : rng() < 0.38));

    if (splitWide) {
      const t = 0.33 + rng() * 0.34;
      const sx = x + Math.round(w * t);
      partition(x, y, sx - x, h, depth - 1);
      partition(sx, y, x + w - sx, h, depth - 1);
    } else {
      const t = 0.33 + rng() * 0.34;
      const sy = y + Math.round(h * t);
      partition(x, y, w, sy - y, depth - 1);
      partition(x, sy, w, y + h - sy, depth - 1);
    }
  }

  partition(0, 0, gridN, gridN, maxDepth);
  return blocks;
}
