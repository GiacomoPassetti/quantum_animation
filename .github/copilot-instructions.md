# Copilot Instructions

## Project Overview

This is a **quantum wave function visualizer** — an interactive real-time simulation of a single-particle wave function spreading in 2D real space.

### Core Concept

- The user defines a **potential landscape** (e.g., harmonic oscillator, periodic wells) or draws a custom one.
- The user sets the **initial confinement radius** — the wave function at t=0 is a uniform distribution inside a circle centered at the origin.
- Pressing play runs real-time evolution of the Schrödinger equation, showing the wave function spread.

### Visual Requirements

- **Background:** black.
- **Wave function rendering:** soft orange/red colormap with transparency and a glowing effect. Colors and effects are user-configurable via meta-settings.

## Architecture Notes

This project is in early development — the README.txt contains the full specification. When adding code:

- The simulation must solve the time-dependent Schrödinger equation in 2D. Spectral/split-operator FFT methods are well-suited for this.
- The UI needs two modes: **setup** (define potential + confinement) and **playback** (real-time evolution).
- Provide a set of **built-in potentials** (harmonic oscillator, periodic wells/waves) plus a custom potential editor.
- Keep the physics engine decoupled from the rendering layer so either can be swapped independently.
