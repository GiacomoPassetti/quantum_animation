export function fft2d(
  real: Float64Array,
  imag: Float64Array,
  width: number,
  height: number,
  inverse = false,
): void {
  const rowReal = new Float64Array(width);
  const rowImag = new Float64Array(width);
  for (let y = 0; y < height; y += 1) {
    const offset = y * width;
    for (let x = 0; x < width; x += 1) {
      rowReal[x] = real[offset + x];
      rowImag[x] = imag[offset + x];
    }
    fft1d(rowReal, rowImag, inverse);
    for (let x = 0; x < width; x += 1) {
      real[offset + x] = rowReal[x];
      imag[offset + x] = rowImag[x];
    }
  }

  const colReal = new Float64Array(height);
  const colImag = new Float64Array(height);
  for (let x = 0; x < width; x += 1) {
    for (let y = 0; y < height; y += 1) {
      const index = y * width + x;
      colReal[y] = real[index];
      colImag[y] = imag[index];
    }
    fft1d(colReal, colImag, inverse);
    for (let y = 0; y < height; y += 1) {
      const index = y * width + x;
      real[index] = colReal[y];
      imag[index] = colImag[y];
    }
  }
}

function fft1d(real: Float64Array, imag: Float64Array, inverse: boolean): void {
  const n = real.length;
  if (!isPowerOfTwo(n)) {
    throw new Error('FFT length must be a power of two.');
  }

  for (let i = 1, j = 0; i < n; i += 1) {
    let bit = n >> 1;
    while (j & bit) {
      j ^= bit;
      bit >>= 1;
    }
    j ^= bit;
    if (i < j) {
      const realValue = real[i];
      real[i] = real[j];
      real[j] = realValue;
      const imagValue = imag[i];
      imag[i] = imag[j];
      imag[j] = imagValue;
    }
  }

  for (let length = 2; length <= n; length <<= 1) {
    const angle = ((inverse ? 2 : -2) * Math.PI) / length;
    const lengthCos = Math.cos(angle);
    const lengthSin = Math.sin(angle);
    const half = length >> 1;

    for (let i = 0; i < n; i += length) {
      let waveReal = 1;
      let waveImag = 0;
      for (let j = 0; j < half; j += 1) {
        const even = i + j;
        const odd = even + half;
        const oddReal = real[odd] * waveReal - imag[odd] * waveImag;
        const oddImag = real[odd] * waveImag + imag[odd] * waveReal;

        real[odd] = real[even] - oddReal;
        imag[odd] = imag[even] - oddImag;
        real[even] += oddReal;
        imag[even] += oddImag;

        const nextWaveReal = waveReal * lengthCos - waveImag * lengthSin;
        waveImag = waveReal * lengthSin + waveImag * lengthCos;
        waveReal = nextWaveReal;
      }
    }
  }

  if (inverse) {
    for (let i = 0; i < n; i += 1) {
      real[i] /= n;
      imag[i] /= n;
    }
  }
}

function isPowerOfTwo(value: number): boolean {
  return value > 0 && (value & (value - 1)) === 0;
}
