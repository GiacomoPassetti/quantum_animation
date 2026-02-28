import type {
  AppState,
  ColormapName,
  ControlsApi,
  ControlsCallbacks,
  PotentialName,
} from '../types';
import type { PotentialDefinition } from '../simulation/potentials';

export function createControls(
  mount: HTMLElement,
  state: AppState,
  potentials: PotentialDefinition[],
  callbacks: ControlsCallbacks,
): ControlsApi {
  const panel = document.createElement('div');
  panel.className = 'ui-panel';

  const playbackRow = document.createElement('div');
  playbackRow.className = 'row';
  const playButton = document.createElement('button');
  playButton.type = 'button';
  playButton.textContent = 'Play';
  const resetButton = document.createElement('button');
  resetButton.type = 'button';
  resetButton.textContent = 'Reset';
  playbackRow.append(playButton, resetButton);
  panel.append(playbackRow);

  const confinementRow = createRangeRow('Confinement radius', 0.5, 6, 0.1, state.confinementRadius);
  const dtRow = createRangeRow('dt', 0.001, 0.03, 0.001, state.dt);
  const stepsRow = createRangeRow('Steps/frame', 1, 12, 1, state.stepsPerFrame);
  panel.append(confinementRow.root, dtRow.root, stepsRow.root);

  const potentialRow = document.createElement('div');
  potentialRow.className = 'row';
  const potentialLabel = document.createElement('label');
  potentialLabel.textContent = 'Potential';
  const potentialSelect = document.createElement('select');
  for (const potential of potentials) {
    const option = document.createElement('option');
    option.value = potential.name;
    option.textContent = potential.label;
    if (potential.name === state.potentialName) {
      option.selected = true;
    }
    potentialSelect.append(option);
  }
  potentialRow.append(potentialLabel, potentialSelect);
  panel.append(potentialRow);

  const paramsHost = document.createElement('div');
  panel.append(paramsHost);

  const formulaRow = document.createElement('div');
  formulaRow.className = 'row';
  const formulaLabel = document.createElement('label');
  formulaLabel.textContent = 'Formula V(x,y)';
  const formulaInput = document.createElement('input');
  formulaInput.type = 'text';
  formulaInput.value = state.formulaExpression;
  formulaRow.append(formulaLabel, formulaInput);
  panel.append(formulaRow);

  const drawModeRow = document.createElement('div');
  drawModeRow.className = 'row';
  const drawModeLabel = document.createElement('label');
  drawModeLabel.textContent = 'Draw mode';
  const drawModeInput = document.createElement('input');
  drawModeInput.type = 'checkbox';
  drawModeInput.checked = state.drawMode;
  drawModeRow.append(drawModeLabel, drawModeInput);
  panel.append(drawModeRow);

  const overlayRow = document.createElement('div');
  overlayRow.className = 'row';
  const overlayLabel = document.createElement('label');
  overlayLabel.textContent = 'Show potential overlay';
  const overlayInput = document.createElement('input');
  overlayInput.type = 'checkbox';
  overlayInput.checked = state.showPotentialOverlay;
  overlayRow.append(overlayLabel, overlayInput);
  panel.append(overlayRow);

  const brushValueRow = createRangeRow('Brush value', -5, 5, 0.1, state.brushValue);
  const brushRadiusRow = createRangeRow('Brush radius', 1, 24, 1, state.brushRadius);
  panel.append(brushValueRow.root, brushRadiusRow.root);

  const colormapRow = document.createElement('div');
  colormapRow.className = 'row';
  const colormapLabel = document.createElement('label');
  colormapLabel.textContent = 'Colormap';
  const colormapSelect = document.createElement('select');
  for (const colormap of ['ember', 'plasma', 'viridis'] as ColormapName[]) {
    const option = document.createElement('option');
    option.value = colormap;
    option.textContent = colormap;
    if (colormap === state.colormap) {
      option.selected = true;
    }
    colormapSelect.append(option);
  }
  colormapRow.append(colormapLabel, colormapSelect);
  panel.append(colormapRow);

  const glowRow = createRangeRow('Glow', 0, 2, 0.01, state.glow);
  const alphaRow = createRangeRow('Alpha', 0.1, 2, 0.01, state.alpha);
  panel.append(glowRow.root, alphaRow.root);

  const persistenceRow = document.createElement('div');
  persistenceRow.className = 'row';
  const saveButton = document.createElement('button');
  saveButton.type = 'button';
  saveButton.textContent = 'Save config';
  const loadButton = document.createElement('button');
  loadButton.type = 'button';
  loadButton.textContent = 'Load config';
  persistenceRow.append(saveButton, loadButton);
  panel.append(persistenceRow);

  const readout = document.createElement('div');
  readout.className = 'row';
  const timeLabel = document.createElement('span');
  timeLabel.textContent = 't = 0.000';
  timeLabel.className = 'value';
  timeLabel.style.width = 'auto';
  const hoverLabel = document.createElement('span');
  hoverLabel.textContent = '|psi|² = -';
  hoverLabel.className = 'value';
  hoverLabel.style.width = 'auto';
  readout.append(timeLabel, hoverLabel);
  panel.append(readout);

  const status = document.createElement('div');
  status.className = 'status';
  panel.append(status);

  mount.innerHTML = '';
  mount.append(panel);

  const updateVisibility = (): void => {
    const selected = potentialSelect.value as PotentialName;
    formulaRow.style.display = selected === 'formula' ? '' : 'none';
    const drawingRelated = selected === 'drawn' || drawModeInput.checked;
    brushValueRow.root.style.display = drawingRelated ? '' : 'none';
    brushRadiusRow.root.style.display = drawingRelated ? '' : 'none';
  };

  const renderPotentialParamSliders = (potentialName: PotentialName, values: Record<string, number>): void => {
    paramsHost.innerHTML = '';
    const definition = potentials.find((item) => item.name === potentialName);
    if (!definition || definition.params.length === 0) {
      return;
    }
    for (const param of definition.params) {
      const row = createRangeRow(
        param.label,
        param.min,
        param.max,
        param.step,
        values[param.key] ?? param.defaultValue,
      );
      row.input.addEventListener('input', () => {
        row.value.textContent = Number(row.input.value).toFixed(2);
      });
      row.input.addEventListener('change', () => {
        callbacks.onPotentialParamChange(param.key, Number(row.input.value));
      });
      paramsHost.append(row.root);
    }
  };

  renderPotentialParamSliders(state.potentialName, state.potentialParams);
  updateVisibility();

  playButton.addEventListener('click', () => {
    const next = playButton.textContent !== 'Pause';
    playButton.textContent = next ? 'Pause' : 'Play';
    callbacks.onTogglePlay(next);
  });
  resetButton.addEventListener('click', () => callbacks.onReset());
  confinementRow.input.addEventListener('input', () => {
    confinementRow.value.textContent = Number(confinementRow.input.value).toFixed(2);
    callbacks.onConfinementChange(Number(confinementRow.input.value));
  });
  dtRow.input.addEventListener('input', () => {
    dtRow.value.textContent = Number(dtRow.input.value).toFixed(3);
    callbacks.onDtChange(Number(dtRow.input.value));
  });
  stepsRow.input.addEventListener('input', () => {
    stepsRow.value.textContent = String(Math.round(Number(stepsRow.input.value)));
    callbacks.onStepsPerFrameChange(Math.round(Number(stepsRow.input.value)));
  });
  potentialSelect.addEventListener('change', () => {
    callbacks.onPotentialChange(potentialSelect.value as PotentialName);
    renderPotentialParamSliders(potentialSelect.value as PotentialName, state.potentialParams);
    updateVisibility();
  });
  formulaInput.addEventListener('change', () => callbacks.onFormulaChange(formulaInput.value));
  drawModeInput.addEventListener('change', () => {
    callbacks.onDrawModeChange(drawModeInput.checked);
    updateVisibility();
  });
  overlayInput.addEventListener('change', () =>
    callbacks.onShowPotentialOverlayChange(overlayInput.checked),
  );
  brushValueRow.input.addEventListener('input', () => {
    brushValueRow.value.textContent = Number(brushValueRow.input.value).toFixed(2);
    callbacks.onBrushValueChange(Number(brushValueRow.input.value));
  });
  brushRadiusRow.input.addEventListener('input', () => {
    brushRadiusRow.value.textContent = String(Math.round(Number(brushRadiusRow.input.value)));
    callbacks.onBrushRadiusChange(Math.round(Number(brushRadiusRow.input.value)));
  });
  colormapSelect.addEventListener('change', () => callbacks.onColormapChange(colormapSelect.value as ColormapName));
  glowRow.input.addEventListener('input', () => {
    glowRow.value.textContent = Number(glowRow.input.value).toFixed(2);
    callbacks.onGlowChange(Number(glowRow.input.value));
  });
  alphaRow.input.addEventListener('input', () => {
    alphaRow.value.textContent = Number(alphaRow.input.value).toFixed(2);
    callbacks.onAlphaChange(Number(alphaRow.input.value));
  });
  saveButton.addEventListener('click', () => callbacks.onSaveConfig());
  loadButton.addEventListener('click', () => callbacks.onLoadConfig());

  return {
    setStatus(message: string) {
      status.textContent = message;
    },
    renderPotentialParamSliders,
    setReadouts(timeValue: string, hoverValue: string) {
      timeLabel.textContent = timeValue;
      hoverLabel.textContent = hoverValue;
    },
  };
}

function createRangeRow(
  label: string,
  min: number,
  max: number,
  step: number,
  value: number,
): {
  root: HTMLDivElement;
  input: HTMLInputElement;
  value: HTMLSpanElement;
} {
  const root = document.createElement('div');
  root.className = 'row';
  const text = document.createElement('label');
  text.textContent = label;
  const input = document.createElement('input');
  input.type = 'range';
  input.min = String(min);
  input.max = String(max);
  input.step = String(step);
  input.value = String(value);
  const valueElement = document.createElement('span');
  valueElement.className = 'value';
  valueElement.textContent = Number(value).toFixed(2);
  root.append(text, input, valueElement);
  return { root, input, value: valueElement };
}
