import type { Block } from './generator';
import type { Palette } from './colors';
import { darkenHex } from './colors';

export interface RenderOptions {
  gridN: number;
  canvasWidth: number;
  canvasHeight: number;
  platformScale: number;
  blockDepthFactor: number;
  // Fixed max Z for layout — must stay constant as params change so platform
  // position doesn't jump. Set to maxHeight + maxBaseZAmplitude + buffer.
  maxZ: number;
  gap: number;         // shrink per block in grid units (0 = flush)
  gapJitter: number;   // 0-1 fraction of gap to randomize per block
  strokeWidth: number; // outline as fraction of tileW (0 = no outline)
  strokeJitter: number; // 0-1 fraction of strokeWidth to randomize per block
}

interface Layout {
  tileW: number;
  tileH: number;
  blockDepth: number;
  originX: number;
  originY: number;
}

function computeLayout(opts: RenderOptions): Layout {
  const { gridN, canvasWidth, canvasHeight, platformScale, blockDepthFactor, maxZ } = opts;
  const tileW = (canvasWidth * platformScale) / gridN;
  const tileH = tileW / 2;
  const blockDepth = tileW * blockDepthFactor;
  const zHeadroom = blockDepth * (maxZ + 2);
  const diamondH = gridN * tileH;
  const totalH = diamondH + zHeadroom;
  const originX = canvasWidth / 2;
  const originY = (canvasHeight - totalH) / 2 + zHeadroom;
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

function face(
  ctx: CanvasRenderingContext2D,
  pts: [number, number][],
  fill: string,
  outline: string,
  sw: number,
): void {
  ctx.beginPath();
  ctx.moveTo(pts[0][0], pts[0][1]);
  for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i][0], pts[i][1]);
  ctx.closePath();
  ctx.fillStyle = fill;
  ctx.fill();
  if (sw > 0) {
    ctx.strokeStyle = outline;
    ctx.lineWidth = sw;
    ctx.stroke();
  }
}

// Correct sort for guillotine-partitioned axis-aligned blocks.
// Two blocks from a guillotine cut are always separated on at least one axis.
// We determine render order directly from that separation rather than using
// the x+y heuristic, which breaks down when block heights differ significantly.
function compareBlocks(a: Block, b: Block): number {
  const aLeftOfB = a.x + a.w <= b.x;
  const bLeftOfA = b.x + b.w <= a.x;
  const aAboveB = a.y + a.h <= b.y;
  const bAboveA = b.y + b.h <= a.y;

  // A is clearly behind B (A ends before B starts on both-or-one axis)
  if ((aLeftOfB || aAboveB) && !bLeftOfA && !bAboveA) return -1;
  // B is clearly behind A
  if ((bLeftOfA || bAboveA) && !aLeftOfB && !aAboveB) return 1;
  // Diagonal adjacency (shared corner only) — x+y is fine here
  return (a.x + a.y) - (b.x + b.y);
}

export function renderScene(
  ctx: CanvasRenderingContext2D,
  blocks: Block[],
  palette: Palette,
  opts: RenderOptions,
): void {
  const { canvasWidth, canvasHeight, gap, gapJitter, strokeWidth, strokeJitter } = opts;

  const layout = computeLayout(opts);
  const { tileW } = layout;
  const baseStroke = tileW * strokeWidth;

  ctx.fillStyle = palette.bgColor;
  ctx.fillRect(0, 0, canvasWidth, canvasHeight);

  const sorted = [...blocks].sort(compareBlocks);

  for (const block of sorted) {
    const { x, y, w, h, height, baseZ, colorIndex } = block;

    const jv1 = bHash(x, y);
    const jv2 = bHash(y, x);
    const effectiveGap = Math.max(0, gap * (1 + gapJitter * (jv1 - 0.5) * 2));
    const sw = Math.max(0, baseStroke * (1 + strokeJitter * (jv2 - 0.5) * 2));

    const gx0 = x + effectiveGap;
    const gy0 = y + effectiveGap;
    const gx1 = x + w - effectiveGap;
    const gy1 = y + h - effectiveGap;

    if (gx1 <= gx0 || gy1 <= gy0) continue;

    const base = palette.colors[colorIndex % palette.colors.length];
    const leftColor = darkenHex(base, palette.leftDarken);
    const rightColor = darkenHex(base, palette.rightDarken);
    const foundL = darkenHex(base, palette.leftDarken * 0.55);
    const foundR = darkenHex(base, palette.rightDarken * 0.55);
    const oc = palette.outlineColor;

    const zB = baseZ;
    const zT = baseZ + height;

    // Foundation columns (the "pedestal" from z=0 up to baseZ)
    if (baseZ > 0) {
      face(ctx, [p(gx0, gy1, 0, layout), p(gx1, gy1, 0, layout), p(gx1, gy1, zB, layout), p(gx0, gy1, zB, layout)], foundL, oc, sw);
      face(ctx, [p(gx1, gy0, 0, layout), p(gx1, gy1, 0, layout), p(gx1, gy1, zB, layout), p(gx1, gy0, zB, layout)], foundR, oc, sw);
    }

    // Block faces
    face(ctx, [p(gx0, gy1, zB, layout), p(gx1, gy1, zB, layout), p(gx1, gy1, zT, layout), p(gx0, gy1, zT, layout)], leftColor, oc, sw);
    face(ctx, [p(gx1, gy0, zB, layout), p(gx1, gy1, zB, layout), p(gx1, gy1, zT, layout), p(gx1, gy0, zT, layout)], rightColor, oc, sw);
    face(ctx, [p(gx0, gy0, zT, layout), p(gx1, gy0, zT, layout), p(gx1, gy1, zT, layout), p(gx0, gy1, zT, layout)], base, oc, sw);
  }
}
