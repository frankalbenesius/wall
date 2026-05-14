import type { Block } from './generator';
import type { Palette } from './colors';
import { darkenHex } from './colors';

export interface RenderOptions {
  gridN: number;
  canvasWidth: number;
  canvasHeight: number;
  // fraction of canvas width the platform diamond should span
  platformScale: number;
  // z-extrusion depth per height unit, expressed as fraction of tileW
  blockDepthFactor: number;
}

interface Layout {
  tileW: number;
  tileH: number;
  blockDepth: number;
  originX: number;
  originY: number;
}

function computeLayout(opts: RenderOptions): Layout {
  const { gridN, canvasWidth, canvasHeight, platformScale, blockDepthFactor } = opts;
  const tileW = (canvasWidth * platformScale) / gridN;
  const tileH = tileW / 2;
  const blockDepth = tileW * blockDepthFactor;

  // Diamond height = gridN * tileH; add room above for max z-height
  const diamondH = gridN * tileH;
  const totalH = diamondH + blockDepth * 6; // headroom for tallest blocks
  const originX = canvasWidth / 2;
  const originY = (canvasHeight - totalH) / 2 + blockDepth * 6;

  return { tileW, tileH, blockDepth, originX, originY };
}

function proj(
  gx: number, gy: number, gz: number,
  { originX, originY, tileW, tileH, blockDepth }: Layout,
): [number, number] {
  return [
    originX + (gx - gy) * (tileW / 2),
    originY + (gx + gy) * (tileH / 2) - gz * blockDepth,
  ];
}

function drawFace(
  ctx: CanvasRenderingContext2D,
  pts: [number, number][],
  fill: string,
  outlineColor: string,
  outlineWidth: number,
): void {
  ctx.beginPath();
  ctx.moveTo(pts[0][0], pts[0][1]);
  for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i][0], pts[i][1]);
  ctx.closePath();
  ctx.fillStyle = fill;
  ctx.fill();
  ctx.strokeStyle = outlineColor;
  ctx.lineWidth = outlineWidth;
  ctx.stroke();
}

export function renderScene(
  ctx: CanvasRenderingContext2D,
  blocks: Block[],
  palette: Palette,
  opts: RenderOptions,
): void {
  const { canvasWidth, canvasHeight } = opts;
  ctx.fillStyle = palette.bgColor;
  ctx.fillRect(0, 0, canvasWidth, canvasHeight);

  const layout = computeLayout(opts);
  const outlineWidth = Math.max(0.5, layout.tileW * 0.03);

  // Painter's algorithm: lower x+y = further from viewer
  const sorted = [...blocks].sort((a, b) => (a.x + a.y) - (b.x + b.y));

  const p = (gx: number, gy: number, gz: number) => proj(gx, gy, gz, layout);

  for (const { x, y, w, h, height, colorIndex } of sorted) {
    const base = palette.colors[colorIndex % palette.colors.length];
    const leftColor = darkenHex(base, palette.leftDarken);
    const rightColor = darkenHex(base, palette.rightDarken);

    // Left face — y=y+h side, descends to bottom-left in screen
    drawFace(
      ctx,
      [p(x, y + h, 0), p(x + w, y + h, 0), p(x + w, y + h, height), p(x, y + h, height)],
      leftColor,
      palette.outlineColor,
      outlineWidth,
    );

    // Right face — x=x+w side, descends to bottom-right in screen
    drawFace(
      ctx,
      [p(x + w, y, 0), p(x + w, y + h, 0), p(x + w, y + h, height), p(x + w, y, height)],
      rightColor,
      palette.outlineColor,
      outlineWidth,
    );

    // Top face
    drawFace(
      ctx,
      [p(x, y, height), p(x + w, y, height), p(x + w, y + h, height), p(x, y + h, height)],
      base,
      palette.outlineColor,
      outlineWidth,
    );
  }
}
