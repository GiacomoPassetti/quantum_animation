import { fft2d } from './fft2d';
import { Grid } from './grid';
import { WaveFunction } from './wavefunction';

interface EvolverOptions {
  dt: number;
  mass: number;
  hbar: number;
  renormalizeEachStep: boolean;
}

export class SplitOperatorEvolver {
  private readonly grid: Grid;
  private readonly mass: number;
  private readonly hbar: number;
  private readonly renormalizeEachStep: boolean;
  private dt: number;
  private readonly kineticPhase: Float64Array;

  constructor(grid: Grid, options: EvolverOptions) {
    this.grid = grid;
    this.mass = options.mass;
    this.hbar = options.hbar;
    this.renormalizeEachStep = options.renormalizeEachStep;
    this.dt = options.dt;
    this.kineticPhase = new Float64Array(grid.size);
    this.recomputeKineticPhase();
  }

  setTimeStep(dt: number): void {
    this.dt = dt;
    this.recomputeKineticPhase();
  }

  step(wavefunction: WaveFunction, potential: Float64Array, steps: number): void {
    const safeSteps = Math.max(1, Math.floor(steps));
    for (let iteration = 0; iteration < safeSteps; iteration += 1) {
      this.applyPotentialHalfStep(wavefunction, potential);
      fft2d(wavefunction.real, wavefunction.imag, this.grid.nx, this.grid.ny, false);
      this.applyKineticFullStep(wavefunction);
      fft2d(wavefunction.real, wavefunction.imag, this.grid.nx, this.grid.ny, true);
      this.applyPotentialHalfStep(wavefunction, potential);
      if (this.renormalizeEachStep) {
        wavefunction.normalize();
      }
    }
  }

  private recomputeKineticPhase(): void {
    const prefactor = (this.hbar * this.dt) / (2 * this.mass);
    for (let j = 0; j < this.grid.ny; j += 1) {
      const kySquared = this.grid.ky[j] * this.grid.ky[j];
      for (let i = 0; i < this.grid.nx; i += 1) {
        const kxSquared = this.grid.kx[i] * this.grid.kx[i];
        this.kineticPhase[this.grid.index(i, j)] = prefactor * (kxSquared + kySquared);
      }
    }
  }

  private applyPotentialHalfStep(wavefunction: WaveFunction, potential: Float64Array): void {
    const halfStepScale = this.dt / (2 * this.hbar);
    for (let i = 0; i < wavefunction.real.length; i += 1) {
      const phase = potential[i] * halfStepScale;
      const cosine = Math.cos(phase);
      const sine = Math.sin(phase);
      const real = wavefunction.real[i];
      const imag = wavefunction.imag[i];
      wavefunction.real[i] = real * cosine + imag * sine;
      wavefunction.imag[i] = imag * cosine - real * sine;
    }
  }

  private applyKineticFullStep(wavefunction: WaveFunction): void {
    for (let i = 0; i < wavefunction.real.length; i += 1) {
      const phase = this.kineticPhase[i];
      const cosine = Math.cos(phase);
      const sine = Math.sin(phase);
      const real = wavefunction.real[i];
      const imag = wavefunction.imag[i];
      wavefunction.real[i] = real * cosine + imag * sine;
      wavefunction.imag[i] = imag * cosine - real * sine;
    }
  }
}
