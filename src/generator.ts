import { createNoise2D } from 'simplex-noise';

export interface Block {
  x: number;
  y: number;
  w: number;
  h: number;
  height: number;
  baseZ: number; // bottom of box in world z; may be fractional or negative
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
  minSize: number;
  maxSize: number;
  splitChance: number;
  splitJitter: number;
  maxHeight: number;
  heightFreq: number;
  liftAmplitude: number;
  liftFreq: number;
  colorFreq: number;
  paletteSize: number;
}

export function generateBlocks(opts: GeneratorOptions): Block[] {
  const { seed, gridN, maxDepth, minSize, maxSize, splitChance, splitJitter, maxHeight, heightFreq, liftAmplitude, liftFreq, colorFreq, paletteSize } = opts;
  const base = fnv1a(seed);

  const heightNoise = createNoise2D(mulberry32(base));
  const liftNoise = createNoise2D(mulberry32(base ^ 0x12345678));
  const colorNoise = createNoise2D(mulberry32(base ^ 0xdeadbeef));

  // Position-hashed rng: each region derives its own random state from its
  // identity (x, y, w, h) instead of sharing a sequence consumed in DFS order.
  // Removes the traversal-order gradient where one side of the field tends
  // to fragment more than the other.
  function regionRng(x: number, y: number, w: number, h: number): () => number {
    let s = base ^ 0xcafebabe;
    s = Math.imul(s ^ x, 0x01000193) >>> 0;
    s = Math.imul(s ^ y, 0x01000193) >>> 0;
    s = Math.imul(s ^ w, 0x01000193) >>> 0;
    s = Math.imul(s ^ h, 0x01000193) >>> 0;
    return mulberry32(s);
  }

  const blocks: Block[] = [];

  function partition(x: number, y: number, w: number, h: number, depth: number): void {
    const rng = regionRng(x, y, w, h);
    const canSplitW = w > minSize * 2;
    const canSplitH = h > minSize * 2;
    const tooLarge = w > maxSize || h > maxSize;

    // Always advance rng so subsequent draws are stable when tooLarge overrides.
    const chanceRoll = rng();
    if (depth === 0 || (!canSplitW && !canSplitH) || (!tooLarge && chanceRoll > splitChance)) {
      const cx = (x + w * 0.5) / gridN;
      const cy = (y + h * 0.5) / gridN;

      const hn = heightNoise(cx * heightFreq, cy * heightFreq);
      const height = Math.max(1, Math.round(((hn + 1) / 2) * maxHeight));

      // Center-aligned: all boxes share a horizontal centerline at maxHeight/2,
      // and noise drifts the center bidirectionally. baseZ = bottom of the box.
      const ln = liftNoise(cx * liftFreq, cy * liftFreq);
      const centerZ = maxHeight / 2 + ln * liftAmplitude;
      const baseZ = centerZ - height / 2;

      const cv = colorNoise(cx * colorFreq, cy * colorFreq);
      const colorIndex = Math.abs(Math.floor(((cv + 1) / 2) * paletteSize)) % paletteSize;

      blocks.push({ x, y, w, h, height, baseZ, colorIndex });
      return;
    }

    const splitWide = canSplitW && (!canSplitH || (w >= h ? rng() < 0.62 : rng() < 0.38));

    if (splitWide) {
      const t = 0.5 + (rng() - 0.5) * splitJitter;
      const sx = x + Math.round(w * t);
      partition(x, y, sx - x, h, depth - 1);
      partition(sx, y, x + w - sx, h, depth - 1);
    } else {
      const t = 0.5 + (rng() - 0.5) * splitJitter;
      const sy = y + Math.round(h * t);
      partition(x, y, w, sy - y, depth - 1);
      partition(x, sy, w, y + h - sy, depth - 1);
    }
  }

  partition(0, 0, gridN, gridN, maxDepth);
  return blocks;
}
