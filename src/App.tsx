import { useState, useRef, useEffect, useCallback, ReactNode } from 'react';
import { generateBlocks } from './generator';
import { renderScene, type RenderOptions } from './renderer';
import { PALETTES } from './colors';
import { encodeParams, decodeParams } from './urlState';

// ── types ────────────────────────────────────────────────────────────────────

export interface Params {
  seed: string;
  paletteIdx: number;
  depth: number;
  minSize: number;
  maxSize: number;
  splitChance: number;
  splitJitter: number;
  maxHeight: number;
  heightFreq: number;
  liftAmplitude: number;
  liftFreq: number;
  colorFreq: number;
  platformScale: number;
  gap: number;
  gapJitter: number;
  strokeWidth: number;
  strokeJitter: number;
  strokeWobble: number;
}

const DEFAULTS: Params = {
  seed: 'wallpaper',
  paletteIdx: 0,
  depth: 5,
  minSize: 5,
  maxSize: 20,
  splitChance: 0.85,
  splitJitter: 0.34,
  maxHeight: 5,
  heightFreq: 3,
  liftAmplitude: 1.5,
  liftFreq: 2,
  colorFreq: 5,
  platformScale: 0.6,
  gap: 0.2,
  gapJitter: 0.3,
  strokeWidth: 0.1,
  strokeJitter: 0.05,
  strokeWobble: 0.3,
};

const GRID_N = 60;
const PREVIEW_W = 1200;
const PREVIEW_H = 750;
const EXPORT_W = 3840;
const EXPORT_H = 2400;

// ── helpers ───────────────────────────────────────────────────────────────────

function buildGenOpts(p: Params) {
  return {
    seed: p.seed,
    gridN: GRID_N,
    maxDepth: p.depth,
    minSize: p.minSize,
    maxSize: p.maxSize,
    splitChance: p.splitChance,
    splitJitter: p.splitJitter,
    maxHeight: p.maxHeight,
    heightFreq: p.heightFreq,
    liftAmplitude: p.liftAmplitude,
    liftFreq: p.liftFreq,
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
    // Stable z-range bounds so the platform doesn't jump as params change.
    // centerZ = maxHeight/2 + noise * liftAmp, so worst case top is
    // maxHeight + liftAmp and worst case bottom is -liftAmp.
    maxZ: p.maxHeight + p.liftAmplitude,
    minZ: -p.liftAmplitude,
    gap: p.gap,
    gapJitter: p.gapJitter,
    strokeWidth: p.strokeWidth,
    strokeJitter: p.strokeJitter,
    strokeWobble: p.strokeWobble,
  };
}

function randomSeed() {
  return Math.random().toString(36).slice(2, 9);
}

function chaosParams(): Params {
  const r = Math.random;
  return {
    seed: randomSeed(),
    paletteIdx: Math.floor(r() * PALETTES.length),
    depth: 2 + Math.floor(r() * 6),
    minSize: 2 + Math.floor(r() * 14),
    maxSize: 4 + Math.floor(r() * (GRID_N - 4)),
    splitChance: 0.3 + r() * 0.7,
    splitJitter: r() * 0.9,
    maxHeight: 1 + Math.floor(r() * 10),
    heightFreq: 0.5 + r() * 9.5,
    liftAmplitude: r() * 8,
    liftFreq: 0.5 + r() * 7.5,
    colorFreq: 0.5 + r() * 11.5,
    platformScale: 0.5 + r() * 0.6,
    gap: r() * 2,
    gapJitter: r(),
    strokeWidth: 0.02 + r() * 0.16,
    strokeJitter: r(),
    strokeWobble: r() * 0.7,
  };
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
          color: '#888', fontSize: 11, letterSpacing: 2,
          padding: '10px 12px', cursor: 'pointer', display: 'flex', justifyContent: 'space-between', alignItems: 'center',
        }}
      >
        {title}
        <span style={{ color: '#555', fontSize: 14 }}>{open ? '−' : '+'}</span>
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

function Swatches({ colors, w = 10, h = 14 }: { colors: string[]; w?: number; h?: number }) {
  return (
    <div style={{ display: 'flex', flexShrink: 0 }}>
      {colors.map((c, i) => (
        <div key={i} style={{ width: w, height: h, background: c }} />
      ))}
    </div>
  );
}

function PaletteDropdown({ value, onChange }: { value: number; onChange: (i: number) => void }) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const wrapRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onClickOutside = (e: MouseEvent) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) {
        setOpen(false);
        setQuery('');
      }
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') { setOpen(false); setQuery(''); }
    };
    document.addEventListener('mousedown', onClickOutside);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onClickOutside);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  const current = PALETTES[value];
  const q = query.trim().toLowerCase();
  const filtered = PALETTES
    .map((p, i) => ({ p, i }))
    .filter(({ p }) => !q || p.name.toLowerCase().includes(q));

  return (
    <div ref={wrapRef} style={{ position: 'relative' }}>
      <button
        onClick={() => setOpen(o => !o)}
        style={{
          background: '#1a1a2a', border: '1px solid #333', color: '#ddd',
          padding: '3px 6px', cursor: 'pointer', fontFamily: 'inherit', fontSize: 11,
          display: 'flex', alignItems: 'center', gap: 6, width: 160,
        }}
      >
        <Swatches colors={current.colors} w={8} h={12} />
        <span style={{ flex: 1, textAlign: 'left' }}>{current.name}</span>
        <span style={{ fontSize: 10, color: '#888', lineHeight: 1 }}>▾</span>
      </button>

      {open && (
        <div style={{
          position: 'absolute', top: '100%', right: 0, marginTop: 4,
          width: 240, background: '#0f0f18', border: '1px solid #333',
          boxShadow: '0 6px 20px rgba(0,0,0,0.6)', zIndex: 100,
        }}>
          <input
            value={query}
            onChange={e => setQuery(e.target.value)}
            placeholder="search palettes…"
            autoFocus
            style={{
              width: '100%', boxSizing: 'border-box',
              background: '#1a1a2a', color: '#ddd', border: 'none',
              borderBottom: '1px solid #333', padding: '6px 8px',
              fontFamily: 'inherit', fontSize: 11, outline: 'none',
            }}
          />
          <div style={{ maxHeight: 320, overflowY: 'auto' }}>
            {filtered.length === 0 ? (
              <div style={{ padding: 12, color: '#555', fontSize: 11, textAlign: 'center' }}>
                no matches
              </div>
            ) : filtered.map(({ p, i }) => (
              <button
                key={i}
                onClick={() => { onChange(i); setOpen(false); setQuery(''); }}
                style={{
                  width: '100%', display: 'flex', alignItems: 'center', gap: 8,
                  padding: '6px 8px', background: i === value ? '#1f1f2e' : 'transparent',
                  border: 'none', borderBottom: '1px solid #1f1f2a',
                  color: '#ccc', cursor: 'pointer', fontFamily: 'inherit', fontSize: 11,
                  textAlign: 'left',
                }}
                onMouseEnter={e => { e.currentTarget.style.background = '#1f1f2e'; }}
                onMouseLeave={e => { e.currentTarget.style.background = i === value ? '#1f1f2e' : 'transparent'; }}
              >
                <Swatches colors={p.colors} w={12} h={16} />
                <span style={{ flex: 1 }}>{p.name}</span>
                {i === value && <span style={{ color: '#5b8dd9', fontSize: 10 }}>●</span>}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ── main component ────────────────────────────────────────────────────────────

function initialParams(): Params {
  if (typeof window === 'undefined') return DEFAULTS;
  const v = new URLSearchParams(window.location.search).get('v');
  if (v) {
    const decoded = decodeParams(v);
    if (decoded) return decoded;
  }
  return DEFAULTS;
}

export default function App() {
  const [params, setParams] = useState<Params>(initialParams);
  const [panelOpen, setPanelOpen] = useState(true);
  const [exporting, setExporting] = useState(false);
  const [shared, setShared] = useState(false);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  // On mount: clear the ?v=... token from the address bar so the default URL
  // stays clean. State is already loaded from the token via initialParams().
  useEffect(() => {
    if (typeof window === 'undefined') return;
    if (new URLSearchParams(window.location.search).has('v')) {
      window.history.replaceState({}, '', window.location.pathname);
    }
  }, []);

  const share = useCallback(() => {
    const encoded = encodeParams(params);
    const url = `${window.location.origin}${window.location.pathname}?v=${encoded}`;
    void navigator.clipboard.writeText(url);
    setShared(true);
    window.setTimeout(() => setShared(false), 1800);
  }, [params]);

  const push = useCallback((updates: Partial<Params>) => {
    setParams(prev => ({ ...prev, ...updates }));
  }, []);

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
          background: '#1a1a2a', border: '1px solid #333', color: '#aaa',
          width: 32, height: 32, cursor: 'pointer', fontSize: 20, lineHeight: 1,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}
        title={panelOpen ? 'hide controls' : 'show controls'}
      >
        {panelOpen ? '›' : '‹'}
      </button>

      {/* Control panel */}
      {panelOpen && (
        <div style={{
          width: 272, flexShrink: 0, background: '#0f0f18', borderLeft: '1px solid #222',
          overflowY: 'auto', overflowX: 'hidden', fontSize: 12, color: '#ccc',
        }}>
          {/* Header */}
          <div style={{ padding: '10px 12px 8px', borderBottom: '1px solid #2a2a3a', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: 11, color: '#555', letterSpacing: 2 }}>wall</span>
            <span style={{ color: '#444', fontSize: 10 }}>{PREVIEW_W}×{PREVIEW_H}</span>
          </div>

          {/* Seed & palette */}
          <Section title="seed">
            <Row label="seed">
              <div style={{ display: 'flex', gap: 4 }}>
                <input
                  value={params.seed}
                  onChange={e => push({ seed: e.target.value })}
                  style={{ background: '#1a1a2a', color: '#ddd', border: '1px solid #333', padding: '4px 6px', fontFamily: 'inherit', fontSize: 11, width: 90 }}
                />
                <button onClick={() => push({ seed: randomSeed() })}
                  title="reroll seed"
                  style={{ background: '#1a1a2a', border: '1px solid #333', color: '#aaa', padding: '0 8px', cursor: 'pointer', fontSize: 18, lineHeight: 1, minWidth: 28 }}>⟳</button>
              </div>
            </Row>
            <Row label="palette">
              <PaletteDropdown
                value={params.paletteIdx}
                onChange={i => push({ paletteIdx: i })}
              />
            </Row>
            <div style={{ display: 'flex', gap: 6, marginTop: 4 }}>
              <button
                onClick={() => push(chaosParams())}
                title="randomize every parameter"
                style={{
                  flex: 1, background: '#2a1a2a', color: '#e0c2e8',
                  border: '1px solid #5a3a5a', padding: '8px', cursor: 'pointer',
                  fontFamily: 'inherit', fontSize: 12, letterSpacing: 1,
                  display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
                }}
              >
                <span style={{ fontSize: 16, lineHeight: 1 }}>🎲</span>
                chaos
              </button>
              <button
                onClick={() => push(DEFAULTS)}
                title="reset to defaults"
                style={{
                  flex: 1, background: '#1a1a2a', color: '#bbb',
                  border: '1px solid #3a3a4a', padding: '8px', cursor: 'pointer',
                  fontFamily: 'inherit', fontSize: 12, letterSpacing: 1,
                  display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
                }}
              >
                <span style={{ fontSize: 16, lineHeight: 1 }}>↺</span>
                reset
              </button>
            </div>
          </Section>

          {/* Tiling — how the field is cut into rectangles */}
          <Section title="tiling">
            <Row label="max splits">
              <Slider value={params.depth} min={2} max={7} step={1} onChange={set('depth')} />
            </Row>
            <Row label="min size">
              <Slider value={params.minSize} min={2} max={15} step={1} onChange={set('minSize')} />
            </Row>
            <Row label="max size">
              <Slider value={params.maxSize} min={4} max={GRID_N} step={1} onChange={set('maxSize')} />
            </Row>
            <Row label="split %">
              <Slider value={params.splitChance} min={0.3} max={1} onChange={set('splitChance')} />
            </Row>
            <Row label="split Δ">
              <Slider value={params.splitJitter} min={0} max={0.9} onChange={set('splitJitter')} />
            </Row>
          </Section>

          {/* Boxes — per-tile presentation: height + color */}
          <Section title="boxes">
            <Row label="max height">
              <Slider value={params.maxHeight} min={1} max={10} step={1} onChange={set('maxHeight')} />
            </Row>
            <Row label="height ƒ">
              <Slider value={params.heightFreq} min={0.5} max={10} onChange={set('heightFreq')} />
            </Row>
            <Row label="color ƒ">
              <Slider value={params.colorFreq} min={0.5} max={12} onChange={set('colorFreq')} />
            </Row>
          </Section>

          {/* Field — where boxes sit: canvas fill, vertical lift, gaps */}
          <Section title="field">
            <Row label="field size">
              <Slider value={params.platformScale} min={0.3} max={1.1} onChange={set('platformScale')} />
            </Row>
            <Row label="lift amp">
              <Slider value={params.liftAmplitude} min={0} max={8} step={0.5} onChange={set('liftAmplitude')} />
            </Row>
            <Row label="lift ƒ">
              <Slider value={params.liftFreq} min={0.5} max={8} onChange={set('liftFreq')} />
            </Row>
            <Row label="gap">
              <Slider value={params.gap} min={0} max={2} onChange={set('gap')} />
            </Row>
            <Row label="gap Δ">
              <Slider value={params.gapJitter} min={0} max={1} onChange={set('gapJitter')} />
            </Row>
          </Section>

          {/* Stroke — the lines around faces */}
          <Section title="stroke">
            <Row label="thickness">
              <Slider value={params.strokeWidth} min={0} max={0.2} onChange={set('strokeWidth')} />
            </Row>
            <Row label="splotchy">
              <Slider value={params.strokeJitter} min={0} max={1} onChange={set('strokeJitter')} />
            </Row>
            <Row label="wobble">
              <Slider value={params.strokeWobble} min={0} max={1} onChange={set('strokeWobble')} />
            </Row>
          </Section>

          {/* Export */}
          <Section title="export">
            <button
              onClick={download} disabled={exporting}
              style={{
                width: '100%', background: exporting ? '#2a2a3a' : '#3060b0', color: '#fff',
                border: 'none', padding: '10px', cursor: exporting ? 'default' : 'pointer',
                fontFamily: 'inherit', fontSize: 12, letterSpacing: 1,
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
              }}
            >
              {exporting
                ? 'rendering…'
                : <><span style={{ fontSize: 16, lineHeight: 1 }}>⬇</span> download 4k ({EXPORT_W}×{EXPORT_H})</>}
            </button>
            <button
              onClick={share}
              style={{
                width: '100%', marginTop: 6, background: shared ? '#1a3a2a' : '#1a1a2a',
                color: shared ? '#9be0b3' : '#bbb',
                border: `1px solid ${shared ? '#3a6a4a' : '#3a3a4a'}`,
                padding: '8px', cursor: 'pointer',
                fontFamily: 'inherit', fontSize: 12, letterSpacing: 1,
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
                transition: 'background 0.2s, color 0.2s, border-color 0.2s',
              }}
            >
              <span style={{ fontSize: 16, lineHeight: 1 }}>{shared ? '✓' : '🔗'}</span>
              {shared ? 'copied to clipboard' : 'share link'}
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
