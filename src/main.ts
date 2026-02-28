import './style.css';
import { createControls } from './ui/controls';
import { SplitOperatorEvolver } from './simulation/evolve';
import { Grid } from './simulation/grid';
import {
  buildPotentialField,
  getDefaultPotentialParams,
  potentialList,
} from './simulation/potentials';
import { WaveFunction } from './simulation/wavefunction';
import { QuantumRenderer } from './rendering/renderer';
import type { AppState } from './types';

const CONFIG_STORAGE_KEY = 'quantum-animation-config-v1';

const app = document.querySelector<HTMLDivElement>('#app');
if (!app) {
  throw new Error('Missing #app element');
}

app.innerHTML = `
  <div class="app-shell">
    <div class="viewport">
      <canvas id="sim-canvas"></canvas>
      <canvas id="draw-canvas"></canvas>
    </div>
    <aside id="controls" class="controls-host"></aside>
  </div>
`;

const simCanvas = document.querySelector<HTMLCanvasElement>('#sim-canvas');
const drawCanvas = document.querySelector<HTMLCanvasElement>('#draw-canvas');
const controlsHost = document.querySelector<HTMLDivElement>('#controls');

if (!simCanvas || !drawCanvas || !controlsHost) {
  throw new Error('Application containers are not available');
}
const simulationCanvas: HTMLCanvasElement = simCanvas;
const overlayCanvas: HTMLCanvasElement = drawCanvas;

// Size canvases as a centered square before creating the renderer
function resizeCanvasesInit(): void {
  const viewport = document.querySelector('.viewport') as HTMLElement | null;
  if (!viewport) return;
  const w = viewport.clientWidth;
  const h = viewport.clientHeight;
  const side = Math.min(w, h);
  const left = Math.floor((w - side) / 2);
  const top = Math.floor((h - side) / 2);
  for (const c of [simulationCanvas, overlayCanvas]) {
    c.style.width = `${side}px`;
    c.style.height = `${side}px`;
    c.style.left = `${left}px`;
    c.style.top = `${top}px`;
  }
}
resizeCanvasesInit();

const grid = new Grid(256, 256, 16, 16);
const wavefunction = new WaveFunction(grid);
const drawnPotential = new Float64Array(grid.size);
const renderer = new QuantumRenderer(simulationCanvas, grid.nx, grid.ny);
const evolver = new SplitOperatorEvolver(grid, { dt: 0.005, mass: 1, hbar: 1, renormalizeEachStep: true });

const state: AppState = {
  playing: false,
  dt: 0.005,
  stepsPerFrame: 2,
  confinementRadius: 2,
  potentialName: 'harmonic',
  potentialParams: getDefaultPotentialParams('harmonic'),
  formulaExpression: '0.5*(x*x + y*y)',
  colormap: 'ember',
  glow: 0.9,
  alpha: 0.9,
  drawMode: false,
  showPotentialOverlay: false,
  brushValue: 2,
  brushRadius: 6,
};

let activePotential: Float64Array = new Float64Array(grid.size);
const rawDensity = new Float32Array(grid.size);
const displayDensity = new Float32Array(grid.size);
let simulationTime = 0;
let hoverDensityText = '|psi|² = -';
const drawContext = overlayCanvas.getContext('2d');
if (!drawContext) {
  throw new Error('Unable to initialize draw overlay context');
}
const drawLayer: CanvasRenderingContext2D = drawContext;
overlayCanvas.width = grid.nx;
overlayCanvas.height = grid.ny;

const controls = createControls(controlsHost, state, potentialList, {
  onTogglePlay(value) {
    state.playing = value;
  },
  onReset() {
    simulationTime = 0;
    initializeWavefunction();
  },
  onConfinementChange(value) {
    state.confinementRadius = value;
    initializeWavefunction();
  },
  onDtChange(value) {
    state.dt = value;
    evolver.setTimeStep(value);
  },
  onStepsPerFrameChange(value) {
    state.stepsPerFrame = value;
  },
  onPotentialChange(name) {
    state.potentialName = name;
    state.potentialParams = getDefaultPotentialParams(name);
    controls.renderPotentialParamSliders(state.potentialName, state.potentialParams);
    rebuildPotential();
    updateDrawOverlay();
  },
  onPotentialParamChange(key, value) {
    state.potentialParams[key] = value;
    rebuildPotential();
  },
  onFormulaChange(value) {
    state.formulaExpression = value;
    rebuildPotential();
  },
  onColormapChange(value) {
    state.colormap = value;
  },
  onGlowChange(value) {
    state.glow = value;
  },
  onAlphaChange(value) {
    state.alpha = value;
  },
  onDrawModeChange(value) {
    state.drawMode = value;
    overlayCanvas.style.pointerEvents = value ? 'auto' : 'none';
    updateDrawOverlay();
  },
  onShowPotentialOverlayChange(value) {
    state.showPotentialOverlay = value;
    updateDrawOverlay();
  },
  onBrushValueChange(value) {
    state.brushValue = value;
  },
  onBrushRadiusChange(value) {
    state.brushRadius = value;
  },
  onSaveConfig() {
    const payload = {
      potentialName: state.potentialName,
      potentialParams: state.potentialParams,
      formulaExpression: state.formulaExpression,
      confinementRadius: state.confinementRadius,
      dt: state.dt,
      stepsPerFrame: state.stepsPerFrame,
      colormap: state.colormap,
      glow: state.glow,
      alpha: state.alpha,
      showPotentialOverlay: state.showPotentialOverlay,
      drawnPotential: Array.from(drawnPotential),
    };
    localStorage.setItem(CONFIG_STORAGE_KEY, JSON.stringify(payload));
    controls.setStatus('Configuration saved.');
  },
  onLoadConfig() {
    const raw = localStorage.getItem(CONFIG_STORAGE_KEY);
    if (!raw) {
      controls.setStatus('No saved configuration found.');
      return;
    }
    let parsed: unknown;
    try {
      parsed = JSON.parse(raw);
    } catch (error) {
      const reason = error instanceof Error ? error.message : 'Unknown parse error';
      controls.setStatus(`Failed to parse saved configuration: ${reason}`);
      return;
    }
    if (!parsed || typeof parsed !== 'object') {
      controls.setStatus('Saved configuration is invalid.');
      return;
    }

    const candidate = parsed as {
      potentialName?: AppState['potentialName'];
      potentialParams?: Record<string, number>;
      formulaExpression?: string;
      confinementRadius?: number;
      dt?: number;
      stepsPerFrame?: number;
      colormap?: AppState['colormap'];
      glow?: number;
      alpha?: number;
      showPotentialOverlay?: boolean;
      drawnPotential?: number[];
    };

    const potentialNames = new Set(potentialList.map((item) => item.name));
    if (!candidate.potentialName || !potentialNames.has(candidate.potentialName)) {
      controls.setStatus('Saved configuration has an invalid potential.');
      return;
    }
    state.potentialName = candidate.potentialName;
    state.potentialParams = candidate.potentialParams ?? getDefaultPotentialParams(state.potentialName);
    state.formulaExpression = candidate.formulaExpression ?? state.formulaExpression;
    state.confinementRadius = candidate.confinementRadius ?? state.confinementRadius;
    state.dt = candidate.dt ?? state.dt;
    state.stepsPerFrame = candidate.stepsPerFrame ?? state.stepsPerFrame;
    state.colormap = candidate.colormap ?? state.colormap;
    state.glow = candidate.glow ?? state.glow;
    state.alpha = candidate.alpha ?? state.alpha;
    state.showPotentialOverlay = candidate.showPotentialOverlay ?? state.showPotentialOverlay;
    if (candidate.drawnPotential && candidate.drawnPotential.length === drawnPotential.length) {
      for (let i = 0; i < drawnPotential.length; i += 1) {
        drawnPotential[i] = candidate.drawnPotential[i];
      }
    }
    evolver.setTimeStep(state.dt);
    controls.renderPotentialParamSliders(state.potentialName, state.potentialParams);
    initializeWavefunction();
    simulationTime = 0;
    if (!rebuildPotential()) {
      return;
    }
    updateDrawOverlay();
    controls.setStatus('Configuration loaded.');
  },
});

function rebuildPotential(): boolean {
  const next = buildPotentialField(grid, state.potentialName, state.potentialParams, {
    formulaExpression: state.formulaExpression,
    drawnPotential,
  });
  if (!next.ok) {
    controls.setStatus(next.error);
    return false;
  }
  activePotential = next.field;
  controls.setStatus('');
  updateDrawOverlay();
  return true;
}

function initializeWavefunction(): void {
  wavefunction.initializeUniformCircle(state.confinementRadius);
  wavefunction.normalize();
}

function updateDrawOverlay(): void {
  drawLayer.clearRect(0, 0, overlayCanvas.width, overlayCanvas.height);
  const shouldRenderOverlay =
    state.showPotentialOverlay || state.potentialName === 'drawn' || state.drawMode;
  if (!shouldRenderOverlay) {
    return;
  }

  const source = state.showPotentialOverlay ? activePotential : drawnPotential;
  let minValue = Number.POSITIVE_INFINITY;
  let maxValue = Number.NEGATIVE_INFINITY;
  for (let i = 0; i < source.length; i += 1) {
    minValue = Math.min(minValue, source[i]);
    maxValue = Math.max(maxValue, source[i]);
  }
  const range = Math.max(1e-9, maxValue - minValue);

  const pixels = drawLayer.createImageData(grid.nx, grid.ny);
  const data = pixels.data;
  for (let index = 0; index < grid.size; index += 1) {
    const normalized = (source[index] - minValue) / range;
    const signed = normalized * 2 - 1;
    const offset = index * 4;
    if (signed >= 0) {
      data[offset] = Math.round(255 * signed);
      data[offset + 1] = Math.round(120 * signed);
      data[offset + 2] = 0;
    } else {
      const magnitude = Math.abs(signed);
      data[offset] = 0;
      data[offset + 1] = Math.round(96 * magnitude);
      data[offset + 2] = Math.round(255 * magnitude);
    }
    data[offset + 3] = Math.round(state.showPotentialOverlay ? 120 : 180 * Math.abs(signed));
  }
  drawLayer.putImageData(pixels, 0, 0);
}

let drawing = false;

function applyBrush(event: PointerEvent): void {
  const rect = overlayCanvas.getBoundingClientRect();
  const x = ((event.clientX - rect.left) / rect.width) * grid.nx;
  const y = ((event.clientY - rect.top) / rect.height) * grid.ny;
  const centerX = Math.floor(x);
  const centerY = Math.floor(y);
  const radius = Math.max(1, Math.floor(state.brushRadius));
  const radiusSquared = radius * radius;

  for (let dy = -radius; dy <= radius; dy += 1) {
    for (let dx = -radius; dx <= radius; dx += 1) {
      if (dx * dx + dy * dy > radiusSquared) {
        continue;
      }
      const i = centerX + dx;
      const j = centerY + dy;
      if (i < 0 || i >= grid.nx || j < 0 || j >= grid.ny) {
        continue;
      }
      const index = grid.index(i, j);
      drawnPotential[index] = state.brushValue;
    }
  }

  updateDrawOverlay();
  if (state.potentialName === 'drawn') {
    rebuildPotential();
  }
}

function updateHoverFromEvent(event: PointerEvent): void {
  const rect = simulationCanvas.getBoundingClientRect();
  const x = ((event.clientX - rect.left) / rect.width) * grid.nx;
  const y = ((event.clientY - rect.top) / rect.height) * grid.ny;
  const i = Math.max(0, Math.min(grid.nx - 1, Math.floor(x)));
  const j = Math.max(0, Math.min(grid.ny - 1, Math.floor(y)));
  const densityValue = rawDensity[grid.index(i, j)];
  hoverDensityText = `|psi|² = ${densityValue.toExponential(3)} @ (${i}, ${j})`;
}

overlayCanvas.addEventListener('pointerdown', (event) => {
  if (!state.drawMode) {
    return;
  }
  drawing = true;
  applyBrush(event);
});

overlayCanvas.addEventListener('pointermove', (event) => {
  if (!drawing || !state.drawMode) {
    updateHoverFromEvent(event);
    return;
  }
  applyBrush(event);
});

simulationCanvas.addEventListener('pointermove', (event) => {
  updateHoverFromEvent(event);
});

simulationCanvas.addEventListener('pointerleave', () => {
  hoverDensityText = '|psi|² = -';
});

window.addEventListener('pointerup', () => {
  drawing = false;
});

function resizeCanvases(): void {
  resizeCanvasesInit();
  renderer.resize();
}

window.addEventListener('resize', resizeCanvases);

initializeWavefunction();
if (!rebuildPotential()) {
  throw new Error('Failed to initialize potential');
}
updateDrawOverlay();

function animate(): void {
  if (state.playing) {
    evolver.step(wavefunction, activePotential, state.stepsPerFrame);
    simulationTime += state.dt * state.stepsPerFrame;
  }

  wavefunction.probabilityDensity(rawDensity);
  let maxDensity = 0;
  for (let i = 0; i < rawDensity.length; i += 1) {
    maxDensity = Math.max(maxDensity, rawDensity[i]);
  }
  const scale = maxDensity > 0 ? 1 / maxDensity : 1;
  for (let i = 0; i < rawDensity.length; i += 1) {
    displayDensity[i] = rawDensity[i] * scale;
  }

  renderer.render(displayDensity, {
    colormap: state.colormap,
    glow: state.glow,
    alpha: state.alpha,
  });
  controls.setReadouts(`t = ${simulationTime.toFixed(3)}`, hoverDensityText);

  requestAnimationFrame(animate);
}

requestAnimationFrame(animate);
