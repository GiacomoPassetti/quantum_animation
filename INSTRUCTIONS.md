# Quantum Wave Function Visualizer — User Guide

An interactive browser-based simulator that visualizes the time evolution of a single-particle quantum wave function spreading in 2D real space.

---

## Getting Started

### Prerequisites

- **Node.js** ≥ 18 (with npm)

### Install & Run

```bash
# Install dependencies
npm install

# Start the development server
npm run dev
```

Open the URL printed in the terminal (usually `http://localhost:5173/`).

> **Windows PowerShell note:** If you see a script execution policy error, run
> `npm.cmd run dev` instead, or enable scripts with
> `Set-ExecutionPolicy -ExecutionPolicy RemoteSigned -Scope CurrentUser`.

### Production Build

```bash
npm run build      # outputs to dist/
npm run preview    # preview the production build locally
```

---

## How It Works

The simulator solves the time-dependent Schrödinger equation on a 256×256 grid using the **split-operator FFT method** (natural units: ℏ = m = 1). The probability density |ψ(x, y, t)|² is rendered in real time with WebGL2, including a multi-pass bloom post-processing effect.

**Initial state:** A uniform probability distribution inside a circle of configurable radius centered at the origin.

Press **Play** and watch the wave function spread and evolve under your chosen potential.

---

## Controls Reference

### Simulation

| Control | Description |
|---|---|
| **Play / Pause** | Start or pause the time evolution |
| **Reset** | Re-initialize the wave function to its starting state |
| **Confinement radius** | Radius of the initial circular wave packet (default: 2) |
| **dt** | Time step per evolution step — smaller = more accurate, slower |
| **Steps/frame** | Number of evolution steps computed per animation frame |

### Potentials

Choose a potential from the dropdown. Each potential has its own tunable parameters that appear as sliders below:

| Potential | Description |
|---|---|
| **Harmonic Oscillator** | Parabolic well V = ½ ω²(x² + y²). Tune ω to change confinement strength. |
| **Periodic Wells** | Lattice of cosine wells. Adjust amplitude and spacing. |
| **Double Well** | Two symmetric minima separated by a barrier. Adjust separation and barrier height. |
| **Square Well** | Hard-wall box. Adjust the box half-width. |
| **Free Particle** | V = 0 everywhere — pure free-space spreading. |
| **Custom Formula** | Type a math expression using `x`, `y`, and standard functions (`sin`, `cos`, `exp`, `sqrt`, `abs`, `log`, `pow`, `PI`, `E`). Use `^` for exponentiation. Example: `0.5*(x^2 + y^2) + 10*sin(x)` |
| **Custom Drawing** | Paint a potential landscape directly onto the grid (see Drawing below). |

### Drawing Mode

1. Select **Custom Drawing** from the potential dropdown, or enable **Draw mode**.
2. Click and drag on the canvas to paint potential values.
3. Adjust **Brush value** (potential height) and **Brush radius** (brush size) in the controls.
4. The drawn potential is applied immediately.

Toggle **Show potential overlay** to see a colored overlay of the active potential on top of the wave function (works with any potential type).

### Visual Settings

| Control | Description |
|---|---|
| **Colormap** | Choose between `ember` (orange/red), `plasma` (purple/yellow), or `viridis` (green/yellow) |
| **Glow** | Intensity of the bloom/glow post-processing effect (0 = off, 1 = full) |
| **Alpha** | Base opacity of the probability density rendering |

### Save / Load

- **Save config** stores your current settings (potential, parameters, visual tweaks, drawn potential) in the browser's local storage.
- **Load config** restores them.

---

## Hover Readout

Move the mouse over the canvas to see the local probability density value and grid coordinates displayed in the bottom-right of the control panel:

```
|ψ|² = 1.234e-03 @ (128, 128)
```

---

## Architecture Overview

```
src/
├── main.ts                  App entry point, animation loop, event wiring
├── types.ts                 Shared TypeScript interfaces
├── simulation/
│   ├── grid.ts              2D spatial & wavenumber grids
│   ├── fft2d.ts             Radix-2 2D FFT / inverse FFT
│   ├── wavefunction.ts      Complex wave function storage & operations
│   ├── potentials.ts        Potential builders & registry
│   └── evolve.ts            Split-operator time evolution
├── rendering/
│   └── renderer.ts          WebGL2 multi-pass bloom renderer
└── ui/
    └── controls.ts          Dynamic control panel generation
```

### Rendering Pipeline

1. **Density extraction** — probability density is uploaded as a float texture
2. **Bloom extract** — bright regions are isolated and downsampled to a half-resolution FBO
3. **Gaussian blur** — two-pass separable blur on the bloom buffer
4. **Composite** — density + bloom are combined with the selected colormap, glow, and alpha

---

## Tips

- Start with **Free Particle** to see pure quantum spreading.
- Use **Harmonic Oscillator** to observe the breathing mode — the wave packet contracts and expands periodically.
- Try **Double Well** with a small confinement radius to watch tunneling between the two wells.
- Lower **dt** and increase **Steps/frame** for smoother, more accurate evolution.
- Set **Glow** to 0 for a clean density view; raise it for the signature glowing aesthetic.

---

## Troubleshooting

| Issue | Solution |
|---|---|
| Black screen | Your browser may not support `OES_texture_float_linear`. The app falls back to nearest-neighbor filtering automatically. Try updating your browser or GPU drivers. |
| Script execution error on Windows | Use `npm.cmd run dev` or set `Set-ExecutionPolicy RemoteSigned -Scope CurrentUser` in PowerShell. |
| Simulation is slow | Reduce **Steps/frame** or increase **dt**. The FFT runs on the CPU, so performance scales with grid size. |
| Canvas appears blank after resize | Click **Reset** to reinitialize. |
