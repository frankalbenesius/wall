import type { Params } from './App';
import { PALETTES } from './colors';

// Fixed-position bit-packed encoding of all sliders + seed into a base64url
// token. Each numeric field is quantized to the smallest int range that fits
// its (min, max, step) and packed with exactly enough bits. The seed is
// stored as a 5-bit length prefix plus raw UTF-8 bytes. A version byte at the
// start lets us evolve the schema; old URLs decode as null and fall back to
// defaults.

const VERSION = 1;
const MAX_SEED_LEN = 31; // 5 bits

interface NumField {
  key: keyof Omit<Params, 'seed'>;
  min: number;
  max: number;
  step: number;
  bits: number;
}

const FIELDS: NumField[] = [
  { key: 'paletteIdx',    min: 0,   max: 15,  step: 1,    bits: 4  },
  { key: 'depth',         min: 2,   max: 7,   step: 1,    bits: 3  },
  { key: 'minSize',       min: 2,   max: 15,  step: 1,    bits: 4  },
  { key: 'maxSize',       min: 4,   max: 60,  step: 1,    bits: 6  },
  { key: 'splitChance',   min: 0.3, max: 1,   step: 0.01, bits: 7  },
  { key: 'splitJitter',   min: 0,   max: 0.9, step: 0.01, bits: 7  },
  { key: 'maxHeight',     min: 1,   max: 10,  step: 1,    bits: 4  },
  { key: 'heightFreq',    min: 0.5, max: 10,  step: 0.01, bits: 10 },
  { key: 'liftAmplitude', min: 0,   max: 8,   step: 0.5,  bits: 5  },
  { key: 'liftFreq',      min: 0.5, max: 8,   step: 0.01, bits: 10 },
  { key: 'colorFreq',     min: 0.5, max: 12,  step: 0.01, bits: 11 },
  { key: 'platformScale', min: 0.3, max: 1.1, step: 0.01, bits: 7  },
  { key: 'gap',           min: 0,   max: 2,   step: 0.01, bits: 8  },
  { key: 'gapJitter',     min: 0,   max: 1,   step: 0.01, bits: 7  },
  { key: 'strokeWidth',   min: 0,   max: 0.2, step: 0.01, bits: 5  },
  { key: 'strokeJitter',  min: 0,   max: 1,   step: 0.01, bits: 7  },
  { key: 'strokeWobble',  min: 0,   max: 1,   step: 0.01, bits: 7  },
];

class BitWriter {
  private bytes: number[] = [];
  private current = 0;
  private bitPos = 0;

  write(value: number, bits: number): void {
    for (let i = bits - 1; i >= 0; i--) {
      this.current = (this.current << 1) | ((value >>> i) & 1);
      this.bitPos++;
      if (this.bitPos === 8) {
        this.bytes.push(this.current & 0xff);
        this.current = 0;
        this.bitPos = 0;
      }
    }
  }

  finish(): Uint8Array {
    if (this.bitPos > 0) {
      this.current <<= 8 - this.bitPos;
      this.bytes.push(this.current & 0xff);
    }
    return new Uint8Array(this.bytes);
  }
}

class BitReader {
  private bitPos = 0;
  constructor(private bytes: Uint8Array) {}

  read(bits: number): number {
    let value = 0;
    for (let i = 0; i < bits; i++) {
      const byteIdx = this.bitPos >>> 3;
      const bitInByte = 7 - (this.bitPos & 7);
      const bit = byteIdx < this.bytes.length ? (this.bytes[byteIdx] >> bitInByte) & 1 : 0;
      value = (value << 1) | bit;
      this.bitPos++;
    }
    return value;
  }
}

function bytesToBase64Url(bytes: Uint8Array): string {
  let s = '';
  for (let i = 0; i < bytes.length; i++) s += String.fromCharCode(bytes[i]);
  return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function base64UrlToBytes(s: string): Uint8Array {
  let normalized = s.replace(/-/g, '+').replace(/_/g, '/');
  while (normalized.length % 4) normalized += '=';
  const decoded = atob(normalized);
  const bytes = new Uint8Array(decoded.length);
  for (let i = 0; i < decoded.length; i++) bytes[i] = decoded.charCodeAt(i);
  return bytes;
}

function quantize(val: number, min: number, max: number, step: number): number {
  const clamped = Math.min(max, Math.max(min, val));
  return Math.round((clamped - min) / step);
}

function unquantize(q: number, min: number, max: number, step: number): number {
  const v = Math.min(max, Math.max(min, q * step + min));
  // Round away float noise (1e-9 dust) at slider precision.
  return Math.round(v * 1e6) / 1e6;
}

export function encodeParams(p: Params): string {
  const w = new BitWriter();
  w.write(VERSION, 8);
  for (const f of FIELDS) {
    w.write(quantize(p[f.key] as number, f.min, f.max, f.step), f.bits);
  }
  const seedBytes = new TextEncoder().encode(p.seed.slice(0, MAX_SEED_LEN));
  w.write(seedBytes.length, 5);
  for (let i = 0; i < seedBytes.length; i++) w.write(seedBytes[i], 8);
  return bytesToBase64Url(w.finish());
}

export function decodeParams(s: string): Params | null {
  try {
    const r = new BitReader(base64UrlToBytes(s));
    if (r.read(8) !== VERSION) return null;
    const out: Record<string, unknown> = {};
    for (const f of FIELDS) {
      out[f.key] = unquantize(r.read(f.bits), f.min, f.max, f.step);
    }
    const seedLen = r.read(5);
    if (seedLen > MAX_SEED_LEN) return null;
    const seedBytes = new Uint8Array(seedLen);
    for (let i = 0; i < seedLen; i++) seedBytes[i] = r.read(8);
    out.seed = new TextDecoder().decode(seedBytes);
    // Safety clamp: paletteIdx must point at a real palette.
    if (typeof out.paletteIdx === 'number' && out.paletteIdx >= PALETTES.length) {
      out.paletteIdx = 0;
    }
    return out as unknown as Params;
  } catch {
    return null;
  }
}
