import type { PotentialDefinition } from './simulation/potentials';

export type PotentialName =
  | 'harmonic'
  | 'periodicWells'
  | 'doubleWell'
  | 'squareWell'
  | 'free'
  | 'formula'
  | 'drawn';

export type ColormapName = 'ember' | 'plasma' | 'viridis';

export interface AppState {
  playing: boolean;
  dt: number;
  stepsPerFrame: number;
  confinementRadius: number;
  potentialName: PotentialName;
  potentialParams: Record<string, number>;
  formulaExpression: string;
  colormap: ColormapName;
  glow: number;
  alpha: number;
  drawMode: boolean;
  showPotentialOverlay: boolean;
  brushValue: number;
  brushRadius: number;
}

export interface RenderSettings {
  colormap: ColormapName;
  glow: number;
  alpha: number;
}

export interface ControlsCallbacks {
  onTogglePlay: (value: boolean) => void;
  onReset: () => void;
  onConfinementChange: (value: number) => void;
  onDtChange: (value: number) => void;
  onStepsPerFrameChange: (value: number) => void;
  onPotentialChange: (name: PotentialName) => void;
  onPotentialParamChange: (key: string, value: number) => void;
  onFormulaChange: (expression: string) => void;
  onColormapChange: (name: ColormapName) => void;
  onGlowChange: (value: number) => void;
  onAlphaChange: (value: number) => void;
  onDrawModeChange: (value: boolean) => void;
  onShowPotentialOverlayChange: (value: boolean) => void;
  onBrushValueChange: (value: number) => void;
  onBrushRadiusChange: (value: number) => void;
  onSaveConfig: () => void;
  onLoadConfig: () => void;
}

export interface ControlsApi {
  setStatus: (message: string) => void;
  renderPotentialParamSliders: (
    potentialName: PotentialName,
    params: Record<string, number>,
  ) => void;
  setReadouts: (timeValue: string, hoverValue: string) => void;
}

export interface ControlsFactoryInput {
  mount: HTMLElement;
  state: AppState;
  potentials: PotentialDefinition[];
  callbacks: ControlsCallbacks;
}
