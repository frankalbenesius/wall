import { useState, useRef, useEffect, useCallback } from 'react';
import { generateBlocks } from './generator';
import { renderScene, type RenderOptions } from './renderer';
import { PALETTES } from './colors';

const GRID_N = 60;
const PREVIEW_W = 960;
const PREVIEW_H = 600;
const EXPORT_W = 3840;
const EXPORT_H = 2400;

const BASE_RENDER_OPTS: Omit<RenderOptions, 'canvasWidth' | 'canvasHeight'> = {
  gridN: GRID_N,
  platformScale: 0.82,
  blockDepthFactor: 0.42,
};

const s: Record<string, React.CSSProperties> = {
  root: {
    minHeight: '100vh',
    background: '#111',
    color: '#ddd',
    fontFamily: 'ui-monospace, monospace',
    fontSize: 13,
    padding: 20,
    display: 'flex',
    flexDirection: 'column',
    gap: 16,
  },
  title: { fontSize: 16, fontWeight: 'bold', color: '#fff' },
  canvas: { display: 'block', maxWidth: '100%', border: '1px solid #333' },
  controls: { display: 'flex', gap: 16, flexWrap: 'wrap', alignItems: 'flex-end' },
  field: { display: 'flex', flexDirection: 'column', gap: 4 },
  label: { color: '#888', fontSize: 11, textTransform: 'uppercase', letterSpacing: 1 },
  input: {
    background: '#222', color: '#fff', border: '1px solid #444',
    padding: '5px 8px', fontFamily: 'inherit', fontSize: 13, width: 140,
  },
  select: {
    background: '#222', color: '#fff', border: '1px solid #444',
    padding: '5px 8px', fontFamily: 'inherit', fontSize: 13, cursor: 'pointer',
  },
  range: { width: 120, cursor: 'pointer' },
  btn: {
    background: '#3a7bd5', color: '#fff', border: 'none',
    padding: '7px 16px', cursor: 'pointer', fontFamily: 'inherit', fontSize: 13,
  },
  btnSecondary: {
    background: '#333', color: '#ccc', border: '1px solid #555',
    padding: '7px 16px', cursor: 'pointer', fontFamily: 'inherit', fontSize: 13,
  },
  hint: { color: '#555', fontSize: 11 },
};

export default function App() {
  const [seed, setSeed] = useState('wallpaper');
  const [paletteIdx, setPaletteIdx] = useState(0);
  const [depth, setDepth] = useState(5);
  const [maxHeight, setMaxHeight] = useState(5);
  const [noiseFreqH, setNoiseFreqH] = useState(3);
  const [noiseFreqC, setNoiseFreqC] = useState(5);
  const [exporting, setExporting] = useState(false);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  const buildGenOpts = useCallback(() => ({
    seed,
    gridN: GRID_N,
    maxDepth: depth,
    maxHeight,
    paletteSize: PALETTES[paletteIdx].colors.length,
    noiseFreqHeight: noiseFreqH,
    noiseFreqColor: noiseFreqC,
  }), [seed, paletteIdx, depth, maxHeight, noiseFreqH, noiseFreqC]);

  const paint = useCallback((
    canvas: HTMLCanvasElement,
    w: number,
    h: number,
  ) => {
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const blocks = generateBlocks(buildGenOpts());
    renderScene(ctx, blocks, PALETTES[paletteIdx], {
      ...BASE_RENDER_OPTS,
      canvasWidth: w,
      canvasHeight: h,
    });
  }, [buildGenOpts, paletteIdx]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    paint(canvas, PREVIEW_W, PREVIEW_H);
  }, [paint]);

  const download = useCallback(() => {
    setExporting(true);
    // yield to let React re-render the button state first
    setTimeout(() => {
      const offscreen = document.createElement('canvas');
      offscreen.width = EXPORT_W;
      offscreen.height = EXPORT_H;
      paint(offscreen, EXPORT_W, EXPORT_H);
      offscreen.toBlob((blob) => {
        setExporting(false);
        if (!blob) return;
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `wallpaper-${seed}-${Date.now()}.png`;
        a.click();
        URL.revokeObjectURL(url);
      }, 'image/png');
    }, 50);
  }, [paint, seed]);

  const randomSeed = () => setSeed(Math.random().toString(36).slice(2, 8));

  return (
    <div style={s.root}>
      <div style={s.title}>wallpaper gen</div>

      <canvas
        ref={canvasRef}
        width={PREVIEW_W}
        height={PREVIEW_H}
        style={s.canvas}
      />

      <div style={s.controls}>
        <div style={s.field}>
          <span style={s.label}>seed</span>
          <div style={{ display: 'flex', gap: 6 }}>
            <input
              value={seed}
              onChange={(e) => setSeed(e.target.value)}
              style={s.input}
            />
            <button onClick={randomSeed} style={s.btnSecondary}>⟳</button>
          </div>
        </div>

        <div style={s.field}>
          <span style={s.label}>palette</span>
          <select
            value={paletteIdx}
            onChange={(e) => setPaletteIdx(Number(e.target.value))}
            style={s.select}
          >
            {PALETTES.map((p, i) => (
              <option key={i} value={i}>{p.name}</option>
            ))}
          </select>
        </div>

        <div style={s.field}>
          <span style={s.label}>depth {depth}</span>
          <input
            type="range" min={2} max={7} step={1}
            value={depth}
            onChange={(e) => setDepth(Number(e.target.value))}
            style={s.range}
          />
        </div>

        <div style={s.field}>
          <span style={s.label}>max height {maxHeight}</span>
          <input
            type="range" min={1} max={8} step={1}
            value={maxHeight}
            onChange={(e) => setMaxHeight(Number(e.target.value))}
            style={s.range}
          />
        </div>

        <div style={s.field}>
          <span style={s.label}>height freq {noiseFreqH}</span>
          <input
            type="range" min={1} max={8} step={0.5}
            value={noiseFreqH}
            onChange={(e) => setNoiseFreqH(Number(e.target.value))}
            style={s.range}
          />
        </div>

        <div style={s.field}>
          <span style={s.label}>color freq {noiseFreqC}</span>
          <input
            type="range" min={1} max={10} step={0.5}
            value={noiseFreqC}
            onChange={(e) => setNoiseFreqC(Number(e.target.value))}
            style={s.range}
          />
        </div>

        <button onClick={download} disabled={exporting} style={s.btn}>
          {exporting ? 'rendering…' : 'download 4k'}
        </button>
      </div>

      <div style={s.hint}>
        preview 960×600 · export 3840×2400 (16:10, fits MacBook Pro)
      </div>
    </div>
  );
}
