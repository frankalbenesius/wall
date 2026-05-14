import { useState, useRef, useEffect, useCallback, ReactNode } from 'react';
import { generateBlocks } from './generator';
import { renderScene, type RenderOptions } from './renderer';
import { PALETTES } from './colors';

// ── types ────────────────────────────────────────────────────────────────────

interface Params {
  seed: string;
  paletteIdx: number;
  depth: number;
  maxHeight: number;
  heightFreq: number;
  baseZAmplitude: number;
  baseZFreq: number;
  colorFreq: number;
  platformScale: number;
  gap: number;
  gapJitter: number;
  strokeWidth: number;
  strokeJitter: number;
}

const DEFAULTS: Params = {
  seed: 'wallpaper',
  paletteIdx: 0,
  depth: 5,
  maxHeight: 5,
  heightFreq: 3,
  baseZAmplitude: 0,
  baseZFreq: 2,
  colorFreq: 5,
  platformScale: 0.82,
  gap: 0.2,
  gapJitter: 0.3,
  strokeWidth: 0.06,
  strokeJitter: 0.4,
};

const GRID_N = 60;
const PREVIEW_W = 1200;
const PREVIEW_H = 750;
const EXPORT_W = 3840;
const EXPORT_H = 2400;
const MAX_HISTORY = 30;

// ── helpers ───────────────────────────────────────────────────────────────────

function buildGenOpts(p: Params) {
  return {
    seed: p.seed,
    gridN: GRID_N,
    maxDepth: p.depth,
    maxHeight: p.maxHeight,
    heightFreq: p.heightFreq,
    baseZAmplitude: p.baseZAmplitude,
    baseZFreq: p.baseZFreq,
    colorFreq: p.colorFreq,
    paletteSize: PALETTES[p.paletteIdx].colors.length,
  };
}

function buildRenderOpts(p: Params, w: number, h: number): RenderOptions {
  return {
    gridN: GRID_N,
    canvasWidth: w,
    canvasHeight: h,
    platformScale: p.platformScale,
    blockDepthFactor: 0.42,
    // Stable upper bound so origin doesn't shift as params change
    maxZ: p.maxHeight + p.baseZAmplitude + 2,
    gap: p.gap,
    gapJitter: p.gapJitter,
    strokeWidth: p.strokeWidth,
    strokeJitter: p.strokeJitter,
  };
}

function randomSeed() {
  return Math.random().toString(36).slice(2, 9);
}

// ── sub-components ────────────────────────────────────────────────────────────

function Section({ title, children }: { title: string; children: ReactNode }) {
  const [open, setOpen] = useState(true);
  return (
    <div style={{ borderBottom: '1px solid #2a2a3a' }}>
      <button
        onClick={() => setOpen(o => !o)}
        style={{
          width: '100%', textAlign: 'left', background: 'none', border: 'none',
          color: '#888', fontSize: 10, letterSpacing: 2, textTransform: 'uppercase',
          padding: '8px 12px', cursor: 'pointer', display: 'flex', justifyContent: 'space-between',
        }}
      >
        {title}
        <span style={{ color: '#555' }}>{open ? '▲' : '▼'}</span>
      </button>
      {open && <div style={{ padding: '4px 12px 12px' }}>{children}</div>}
    </div>
  );
}

function Row({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8, gap: 8 }}>
      <span style={{ color: '#666', fontSize: 11, minWidth: 80 }}>{label}</span>
      <div style={{ flex: 1, display: 'flex', justifyContent: 'flex-end' }}>{children}</div>
    </div>
  );
}

function Slider({
  value, min, max, step = 0.01, onChange, width = 120,
}: {
  value: number; min: number; max: number; step?: number; onChange: (v: number) => void; width?: number;
}) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
      <span style={{ color: '#aaa', fontSize: 11, minWidth: 30, textAlign: 'right' }}>
        {Number.isInteger(step) ? value : value.toFixed(2)}
      </span>
      <input
        type="range" min={min} max={max} step={step} value={value}
        onChange={e => onChange(Number(e.target.value))}
        style={{ width, cursor: 'pointer', accentColor: '#5b8dd9' }}
      />
    </div>
  );
}

// ── main component ────────────────────────────────────────────────────────────

export default function App() {
  const [history, setHistory] = useState<Params[]>([DEFAULTS]);
  const [histIdx, setHistIdx] = useState(0);
  const [panelOpen, setPanelOpen] = useState(true);
  const [exporting, setExporting] = useState(false);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  const params = history[histIdx];

  const push = useCallback((updates: Partial<Params>) => {
    setHistory(prev => {
      const next = { ...prev[histIdx], ...updates };
      const trimmed = prev.slice(0, histIdx + 1);
      return [...trimmed.slice(-MAX_HISTORY + 1), next];
    });
    setHistIdx(prev => Math.min(prev + 1, MAX_HISTORY - 1));
  }, [histIdx]);

  const undo = () => setHistIdx(i => Math.max(0, i - 1));
  const redo = () => setHistIdx(i => Math.min(history.length - 1, i + 1));

  const paint = useCallback((canvas: HTMLCanvasElement, w: number, h: number, p: Params) => {
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const blocks = generateBlocks(buildGenOpts(p));
    renderScene(ctx, blocks, PALETTES[p.paletteIdx], buildRenderOpts(p, w, h));
  }, []);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    paint(canvas, PREVIEW_W, PREVIEW_H, params);
  }, [paint, params]);

  const download = useCallback(() => {
    setExporting(true);
    setTimeout(() => {
      const c = document.createElement('canvas');
      c.width = EXPORT_W;
      c.height = EXPORT_H;
      paint(c, EXPORT_W, EXPORT_H, params);
      c.toBlob(blob => {
        setExporting(false);
        if (!blob) return;
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `wallpaper-${params.seed}-${Date.now()}.png`;
        a.click();
        URL.revokeObjectURL(url);
      }, 'image/png');
    }, 50);
  }, [paint, params]);

  const set = (key: keyof Params) => (val: number | string) => push({ [key]: val } as Partial<Params>);

  // ── render ────────────────────────────────────────────────────────────────

  return (
    <div style={{ display: 'flex', height: '100vh', overflow: 'hidden', background: '#0d0d0f', fontFamily: 'ui-monospace, monospace' }}>
      {/* Canvas area */}
      <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden' }}>
        <canvas
          ref={canvasRef}
          width={PREVIEW_W}
          height={PREVIEW_H}
          style={{ maxWidth: '100%', maxHeight: '100%', display: 'block' }}
        />
      </div>

      {/* Toggle button */}
      <button
        onClick={() => setPanelOpen(o => !o)}
        style={{
          position: 'fixed', top: 12, right: panelOpen ? 284 : 12, zIndex: 10,
          background: '#1a1a2a', border: '1px solid #333', color: '#888',
          width: 28, height: 28, cursor: 'pointer', fontSize: 14,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}
        title={panelOpen ? 'hide controls' : 'show controls'}
      >
        {panelOpen ? '→' : '←'}
      </button>

      {/* Control panel */}
      {panelOpen && (
        <div style={{
          width: 272, flexShrink: 0, background: '#0f0f18', borderLeft: '1px solid #222',
          overflowY: 'auto', fontSize: 12, color: '#ccc',
        }}>
          {/* Header */}
          <div style={{ padding: '10px 12px 8px', borderBottom: '1px solid #2a2a3a', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: 11, color: '#555', letterSpacing: 1 }}>WALLPAPER GEN</span>
            <span style={{ color: '#444', fontSize: 10 }}>{PREVIEW_W}×{PREVIEW_H}</span>
          </div>

          {/* Seed & palette */}
          <Section title="seed">
            <Row label="seed">
              <div style={{ display: 'flex', gap: 4 }}>
                <input
                  value={params.seed}
                  onChange={e => push({ seed: e.target.value })}
                  style={{ background: '#1a1a2a', color: '#ddd', border: '1px solid #333', padding: '3px 6px', fontFamily: 'inherit', fontSize: 11, width: 100 }}
                />
                <button onClick={() => push({ seed: randomSeed() })}
                  style={{ background: '#1a1a2a', border: '1px solid #333', color: '#888', padding: '3px 6px', cursor: 'pointer', fontSize: 12 }}>⟳</button>
              </div>
            </Row>
            <Row label="palette">
              <select
                value={params.paletteIdx}
                onChange={e => push({ paletteIdx: Number(e.target.value) })}
                style={{ background: '#1a1a2a', color: '#ddd', border: '1px solid #333', padding: '3px 6px', fontFamily: 'inherit', fontSize: 11 }}
              >
                {PALETTES.map((p, i) => <option key={i} value={i}>{p.name}</option>)}
              </select>
            </Row>
          </Section>

          {/* Layout */}
          <Section title="layout">
            <Row label="depth">
              <Slider value={params.depth} min={2} max={7} step={1} onChange={set('depth')} />
            </Row>
            <Row label="field size">
              <Slider value={params.platformScale} min={0.3} max={1.1} onChange={set('platformScale')} />
            </Row>
            <Row label="gap">
              <Slider value={params.gap} min={0} max={2} onChange={set('gap')} />
            </Row>
            <Row label="gap jitter">
              <Slider value={params.gapJitter} min={0} max={1} onChange={set('gapJitter')} />
            </Row>
          </Section>

          {/* Noise */}
          <Section title="noise">
            <Row label="max height">
              <Slider value={params.maxHeight} min={1} max={10} step={1} onChange={set('maxHeight')} />
            </Row>
            <Row label="height freq">
              <Slider value={params.heightFreq} min={0.5} max={10} onChange={set('heightFreq')} />
            </Row>
            <Row label="base Z amp">
              <Slider value={params.baseZAmplitude} min={0} max={8} step={0.5} onChange={set('baseZAmplitude')} />
            </Row>
            <Row label="base Z freq">
              <Slider value={params.baseZFreq} min={0.5} max={8} onChange={set('baseZFreq')} />
            </Row>
            <Row label="color freq">
              <Slider value={params.colorFreq} min={0.5} max={12} onChange={set('colorFreq')} />
            </Row>
          </Section>

          {/* Style */}
          <Section title="style">
            <Row label="stroke">
              <Slider value={params.strokeWidth} min={0} max={0.2} onChange={set('strokeWidth')} />
            </Row>
            <Row label="stroke jitter">
              <Slider value={params.strokeJitter} min={0} max={1} onChange={set('strokeJitter')} />
            </Row>
          </Section>

          {/* History */}
          <Section title="history">
            <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
              <button
                onClick={undo} disabled={histIdx === 0}
                style={{ flex: 1, background: '#1a1a2a', border: '1px solid #333', color: histIdx > 0 ? '#ccc' : '#444', padding: '5px', cursor: histIdx > 0 ? 'pointer' : 'default', fontFamily: 'inherit', fontSize: 11 }}
              >← undo</button>
              <span style={{ color: '#444', fontSize: 10 }}>{histIdx + 1}/{history.length}</span>
              <button
                onClick={redo} disabled={histIdx === history.length - 1}
                style={{ flex: 1, background: '#1a1a2a', border: '1px solid #333', color: histIdx < history.length - 1 ? '#ccc' : '#444', padding: '5px', cursor: histIdx < history.length - 1 ? 'pointer' : 'default', fontFamily: 'inherit', fontSize: 11 }}
              >redo →</button>
            </div>
          </Section>

          {/* Export */}
          <Section title="export">
            <button
              onClick={download} disabled={exporting}
              style={{
                width: '100%', background: exporting ? '#2a2a3a' : '#3060b0', color: '#fff',
                border: 'none', padding: '8px', cursor: exporting ? 'default' : 'pointer',
                fontFamily: 'inherit', fontSize: 11, letterSpacing: 1,
              }}
            >
              {exporting ? 'rendering…' : `↓ download 4k  (${EXPORT_W}×${EXPORT_H})`}
            </button>
            <div style={{ color: '#444', fontSize: 10, marginTop: 6, textAlign: 'center' }}>
              fits MacBook Pro 16" native
            </div>
          </Section>
        </div>
      )}
    </div>
  );
}
