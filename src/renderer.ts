import type { Block } from './generator';
import type { Palette } from './colors';
import { darkenHex } from './colors';

export interface RenderOptions {
  gridN: number;
  canvasWidth: number;
  canvasHeight: number;
  platformScale: number;
  blockDepthFactor: number;
  // Stable z-range bounds for layout — must stay constant as noise/seed
  // params change so the platform doesn't jump on slider drag.
  maxZ: number;        // worst-case top of any block
  minZ: number;        // worst-case bottom; negative when boxes dip below floor
  gap: number;         // shrink per block in grid units (0 = flush)
  gapJitter: number;   // 0-1 fraction of gap to randomize per block
  strokeWidth: number; // outline as fraction of tileW (0 = no outline)
  strokeJitter: number; // 0-1 width variation along each edge
  strokeWobble: number; // 0-1 perpendicular wobble of the edge centerline
}

interface Layout {
  tileW: number;
  tileH: number;
  blockDepth: number;
  originX: number;
  originY: number;
}

function computeLayout(opts: RenderOptions): Layout {
  const { gridN, canvasWidth, canvasHeight, platformScale, blockDepthFactor, maxZ, minZ } = opts;
  const tileW = (canvasWidth * platformScale) / gridN;
  const tileH = tileW / 2;
  const blockDepth = tileW * blockDepthFactor;
  const zHeadroomTop = blockDepth * (maxZ + 2);
  const zHeadroomBottom = minZ < 0 ? blockDepth * (-minZ + 2) : 0;
  const diamondH = gridN * tileH;
  const totalH = diamondH + zHeadroomTop + zHeadroomBottom;
  const originX = canvasWidth / 2;
  const originY = (canvasHeight - totalH) / 2 + zHeadroomTop;
  return { tileW, tileH, blockDepth, originX, originY };
}

function p(gx: number, gy: number, gz: number, l: Layout): [number, number] {
  return [
    l.originX + (gx - gy) * (l.tileW / 2),
    l.originY + (gx + gy) * (l.tileH / 2) - gz * l.blockDepth,
  ];
}

// Deterministic per-block jitter — position-based, seed-independent
function bHash(x: number, y: number): number {
  let h = (Math.imul(x + 1, 2654435761) ^ Math.imul(y + 1, 2246822519)) >>> 0;
  h = ((h ^ (h >>> 16)) * 0x45d9f3b) >>> 0;
  return h / 4294967296;
}

// Indexed hash for sampling along an edge. Combines a 32-bit edge seed with a
// sample index to give per-sample float in [0, 1).
function rHash(seed: number, idx: number): number {
  let h = (Math.imul(seed | 0, 2654435761) ^ Math.imul(idx | 0, 2246822519)) >>> 0;
  h = ((h ^ (h >>> 16)) * 0x45d9f3b) >>> 0;
  return h / 4294967296;
}

// Stroke one edge as a filled "ribbon" polygon. Width is sampled at N points
// along the edge — variation between samples gives the dynamic thickness, and
// each sample is also shifted perpendicular to the edge by a small amount,
// making the centerline itself wobble. Endpoints stay anchored at the true
// corners so adjacent edges still meet (the polygons just overlap slightly
// there, which mimics real pens over-pressuring at direction changes).
function strokeEdgeRibbon(
  ctx: CanvasRenderingContext2D,
  p1: [number, number],
  p2: [number, number],
  baseW: number,
  jitter: number,
  wobble: number,
  seed: number,
): void {
  const dx = p2[0] - p1[0];
  const dy = p2[1] - p1[1];
  const len = Math.hypot(dx, dy);
  if (len < 0.5) return;

  const nx = -dy / len;
  const ny = dx / len;
  const samples = Math.max(3, Math.min(18, Math.round(len / 6)));

  // Precompute center and half-width per sample so the forward (top) and
  // backward (bottom) ribbon passes see identical values.
  const cxs = new Float32Array(samples + 1);
  const cys = new Float32Array(samples + 1);
  const hws = new Float32Array(samples + 1);

  for (let i = 0; i <= samples; i++) {
    const t = i / samples;
    const bx = p1[0] + dx * t;
    const by = p1[1] + dy * t;
    if (i === 0 || i === samples) {
      cxs[i] = bx;
      cys[i] = by;
      hws[i] = baseW / 2;
    } else {
      const wr = rHash(seed, i) - 0.5;
      hws[i] = Math.max(0.05, baseW * (1 + 2 * jitter * wr)) / 2;
      const wob = (rHash(seed, i + 0x1000) - 0.5) * baseW * wobble;
      cxs[i] = bx + nx * wob;
      cys[i] = by + ny * wob;
    }
  }

  ctx.beginPath();
  ctx.moveTo(cxs[0] + nx * hws[0], cys[0] + ny * hws[0]);
  for (let i = 1; i <= samples; i++) ctx.lineTo(cxs[i] + nx * hws[i], cys[i] + ny * hws[i]);
  for (let i = samples; i >= 0; i--) ctx.lineTo(cxs[i] - nx * hws[i], cys[i] - ny * hws[i]);
  ctx.closePath();
  ctx.fill();
}

function face(
  ctx: CanvasRenderingContext2D,
  pts: [number, number][],
  fill: string,
  outline: string,
  baseSw: number,
  jitter: number,
  wobble: number,
  faceSeed: number,
): void {
  ctx.beginPath();
  ctx.moveTo(pts[0][0], pts[0][1]);
  for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i][0], pts[i][1]);
  ctx.closePath();
  ctx.fillStyle = fill;
  ctx.fill();
  if (baseSw <= 0) return;

  ctx.fillStyle = outline;
  for (let i = 0; i < pts.length; i++) {
    const a = pts[i];
    const b = pts[(i + 1) % pts.length];
    const edgeSeed = (faceSeed ^ Math.imul(i + 1, 0x9e3779b1)) >>> 0;
    strokeEdgeRibbon(ctx, a, b, baseSw, jitter, wobble, edgeSeed);
  }
}

// Pairwise depth order for two non-overlapping axis-aligned footprints in
// this iso projection. Returns -1 if a must draw before b, 1 if after, 0 if
// unconstrained (truly diagonal — no on-screen overlap is possible).
function depthOrder(a: Block, b: Block): -1 | 0 | 1 {
  const aLeftB = a.x + a.w <= b.x;
  const bLeftA = b.x + b.w <= a.x;
  const aAboveB = a.y + a.h <= b.y;
  const bAboveA = b.y + b.h <= a.y;
  const xSep = aLeftB || bLeftA;
  const ySep = aAboveB || bAboveA;

  // Overlap on one axis, separated on the other → separated axis decides.
  if (xSep && !ySep) return aLeftB ? -1 : 1;
  if (ySep && !xSep) return aAboveB ? -1 : 1;
  // Separated on both axes → diagonal. Only the "agreeing" diagonals are
  // unambiguous; conflicting diagonals never overlap on screen so leave free.
  if (xSep && ySep) {
    if (aLeftB && aAboveB) return -1;
    if (bLeftA && bAboveA) return 1;
  }
  return 0;
}

// Painter's order via topological sort. A comparator-based Array.sort isn't
// safe here: the depth relation is a partial order, and JS sort can split a
// transitive chain when some pairs return 0, producing wrong stacking.
function painterSort(blocks: Block[]): Block[] {
  const n = blocks.length;
  const succ: number[][] = Array.from({ length: n }, () => []);
  const inDeg = new Array<number>(n).fill(0);

  for (let i = 0; i < n; i++) {
    for (let j = i + 1; j < n; j++) {
      const o = depthOrder(blocks[i], blocks[j]);
      if (o < 0) { succ[i].push(j); inDeg[j]++; }
      else if (o > 0) { succ[j].push(i); inDeg[i]++; }
    }
  }

  const result: Block[] = [];
  const queue: number[] = [];
  for (let i = 0; i < n; i++) if (inDeg[i] === 0) queue.push(i);
  while (queue.length) {
    const i = queue.shift()!;
    result.push(blocks[i]);
    for (const j of succ[i]) if (--inDeg[j] === 0) queue.push(j);
  }
  return result;
}

export function renderScene(
  ctx: CanvasRenderingContext2D,
  blocks: Block[],
  palette: Palette,
  opts: RenderOptions,
): void {
  const { canvasWidth, canvasHeight, gap, gapJitter, strokeWidth, strokeJitter, strokeWobble } = opts;

  const layout = computeLayout(opts);
  const { tileW } = layout;
  const baseStroke = tileW * strokeWidth;

  ctx.fillStyle = palette.bgColor;
  ctx.fillRect(0, 0, canvasWidth, canvasHeight);

  const sorted = painterSort(blocks);

  for (const block of sorted) {
    const { x, y, w, h, height, baseZ, colorIndex } = block;

    const jv1 = bHash(x, y);
    const effectiveGap = Math.max(0, gap * (1 + gapJitter * (jv1 - 0.5) * 2));

    const gx0 = x + effectiveGap;
    const gy0 = y + effectiveGap;
    const gx1 = x + w - effectiveGap;
    const gy1 = y + h - effectiveGap;

    if (gx1 <= gx0 || gy1 <= gy0) continue;

    const base = palette.colors[colorIndex % palette.colors.length];
    const leftColor = darkenHex(base, palette.leftDarken);
    const rightColor = darkenHex(base, palette.rightDarken);
    const oc = palette.outlineColor;

    // Side faces span the box's actual vertical extent. Bottom face is
    // always invisible in this isometric projection (faces away from camera),
    // so we don't draw it even when boxes float clear of the floor.
    const zB = baseZ;
    const zT = baseZ + height;

    // Per-face seed: stroke ribbons sample width from rHash(faceSeed^edgeIdx).
    const blockSeed = (Math.imul(x + 1, 0x85ebca6b) ^ Math.imul(y + 1, 0xc2b2ae35)) >>> 0;

    face(ctx, [p(gx0, gy1, zB, layout), p(gx1, gy1, zB, layout), p(gx1, gy1, zT, layout), p(gx0, gy1, zT, layout)], leftColor, oc, baseStroke, strokeJitter, strokeWobble, blockSeed ^ 0x1);
    face(ctx, [p(gx1, gy0, zB, layout), p(gx1, gy1, zB, layout), p(gx1, gy1, zT, layout), p(gx1, gy0, zT, layout)], rightColor, oc, baseStroke, strokeJitter, strokeWobble, blockSeed ^ 0x2);
    face(ctx, [p(gx0, gy0, zT, layout), p(gx1, gy0, zT, layout), p(gx1, gy1, zT, layout), p(gx0, gy1, zT, layout)], base, oc, baseStroke, strokeJitter, strokeWobble, blockSeed ^ 0x3);
  }
}
