export class Grid {
  readonly nx: number;
  readonly ny: number;
  readonly lx: number;
  readonly ly: number;
  readonly dx: number;
  readonly dy: number;
  readonly cellArea: number;
  readonly size: number;
  readonly x: Float64Array;
  readonly y: Float64Array;
  readonly kx: Float64Array;
  readonly ky: Float64Array;

  constructor(nx: number, ny: number, lx: number, ly: number) {
    if (!isPowerOfTwo(nx) || !isPowerOfTwo(ny)) {
      throw new Error('Grid sizes must be powers of two for radix-2 FFT.');
    }
    this.nx = nx;
    this.ny = ny;
    this.lx = lx;
    this.ly = ly;
    this.dx = lx / nx;
    this.dy = ly / ny;
    this.cellArea = this.dx * this.dy;
    this.size = nx * ny;
    this.x = new Float64Array(nx);
    this.y = new Float64Array(ny);
    this.kx = new Float64Array(nx);
    this.ky = new Float64Array(ny);

    this.initializeCoordinates();
    this.initializeWavenumbers();
  }

  index(i: number, j: number): number {
    return j * this.nx + i;
  }

  private initializeCoordinates(): void {
    for (let i = 0; i < this.nx; i += 1) {
      this.x[i] = (i - this.nx / 2) * this.dx;
    }
    for (let j = 0; j < this.ny; j += 1) {
      this.y[j] = (j - this.ny / 2) * this.dy;
    }
  }

  private initializeWavenumbers(): void {
    const twoPi = 2 * Math.PI;
    for (let i = 0; i < this.nx; i += 1) {
      const n = i <= this.nx / 2 ? i : i - this.nx;
      this.kx[i] = (twoPi * n) / this.lx;
    }
    for (let j = 0; j < this.ny; j += 1) {
      const n = j <= this.ny / 2 ? j : j - this.ny;
      this.ky[j] = (twoPi * n) / this.ly;
    }
  }
}

function isPowerOfTwo(value: number): boolean {
  return value > 0 && (value & (value - 1)) === 0;
}
