import { Grid } from './grid';

export class WaveFunction {
  readonly grid: Grid;
  readonly real: Float64Array;
  readonly imag: Float64Array;

  constructor(grid: Grid) {
    this.grid = grid;
    this.real = new Float64Array(grid.size);
    this.imag = new Float64Array(grid.size);
  }

  initializeUniformCircle(radius: number): void {
    const radiusSquared = radius * radius;
    for (let j = 0; j < this.grid.ny; j += 1) {
      const y = this.grid.y[j];
      for (let i = 0; i < this.grid.nx; i += 1) {
        const x = this.grid.x[i];
        const index = this.grid.index(i, j);
        this.real[index] = x * x + y * y <= radiusSquared ? 1 : 0;
        this.imag[index] = 0;
      }
    }
  }

  norm(): number {
    let sum = 0;
    for (let i = 0; i < this.real.length; i += 1) {
      sum += this.real[i] * this.real[i] + this.imag[i] * this.imag[i];
    }
    return sum * this.grid.cellArea;
  }

  normalize(): void {
    const currentNorm = this.norm();
    if (currentNorm <= 0) {
      throw new Error('Cannot normalize wave function with zero norm.');
    }
    const factor = 1 / Math.sqrt(currentNorm);
    for (let i = 0; i < this.real.length; i += 1) {
      this.real[i] *= factor;
      this.imag[i] *= factor;
    }
  }

  probabilityDensity(target: Float32Array): Float32Array {
    for (let i = 0; i < this.real.length; i += 1) {
      target[i] = this.real[i] * this.real[i] + this.imag[i] * this.imag[i];
    }
    return target;
  }
}
