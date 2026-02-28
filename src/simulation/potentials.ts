import type { PotentialName } from '../types';
import { Grid } from './grid';

export interface PotentialParameterSpec {
  key: string;
  label: string;
  min: number;
  max: number;
  step: number;
  defaultValue: number;
}

export interface PotentialDefinition {
  name: PotentialName;
  label: string;
  params: PotentialParameterSpec[];
}

interface BuildContext {
  formulaExpression?: string;
  drawnPotential?: Float64Array;
}

interface BuildResult {
  ok: true;
  field: Float64Array;
}

interface BuildError {
  ok: false;
  error: string;
}

type PotentialBuildResult = BuildResult | BuildError;

export const potentialList: PotentialDefinition[] = [
  {
    name: 'harmonic',
    label: 'Harmonic Oscillator',
    params: [{ key: 'omega', label: 'omega', min: 0.1, max: 3, step: 0.05, defaultValue: 1 }],
  },
  {
    name: 'periodicWells',
    label: 'Periodic Wells',
    params: [
      { key: 'v0', label: 'V0', min: 0.1, max: 8, step: 0.1, defaultValue: 2 },
      { key: 'period', label: 'period', min: 0.5, max: 6, step: 0.1, defaultValue: 3 },
    ],
  },
  {
    name: 'doubleWell',
    label: 'Double Well',
    params: [
      { key: 'v0', label: 'V0', min: 0.1, max: 8, step: 0.1, defaultValue: 2.5 },
      { key: 'separation', label: 'separation', min: 0.3, max: 6, step: 0.1, defaultValue: 2 },
      { key: 'width', label: 'width', min: 0.1, max: 3, step: 0.05, defaultValue: 0.7 },
    ],
  },
  {
    name: 'squareWell',
    label: 'Square Well',
    params: [
      { key: 'inside', label: 'inside', min: -6, max: 0, step: 0.1, defaultValue: -3 },
      { key: 'outside', label: 'outside', min: 0, max: 12, step: 0.1, defaultValue: 4 },
      { key: 'halfWidth', label: 'half-width', min: 0.5, max: 6, step: 0.1, defaultValue: 2 },
    ],
  },
  {
    name: 'free',
    label: 'Free Particle',
    params: [],
  },
  {
    name: 'formula',
    label: 'Custom Formula',
    params: [{ key: 'scale', label: 'scale', min: -5, max: 5, step: 0.1, defaultValue: 1 }],
  },
  {
    name: 'drawn',
    label: 'Custom Drawing',
    params: [{ key: 'scale', label: 'scale', min: -5, max: 5, step: 0.1, defaultValue: 1 }],
  },
];

export const potentialDefinitionsByName = Object.fromEntries(
  potentialList.map((definition) => [definition.name, definition]),
) as Record<PotentialName, PotentialDefinition>;

export function getDefaultPotentialParams(potentialName: PotentialName): Record<string, number> {
  const definition = potentialDefinitionsByName[potentialName];
  const params: Record<string, number> = {};
  for (const param of definition.params) {
    params[param.key] = param.defaultValue;
  }
  return params;
}

export function buildPotentialField(
  grid: Grid,
  potentialName: PotentialName,
  params: Record<string, number>,
  context: BuildContext,
): PotentialBuildResult {
  const field = new Float64Array(grid.size);

  switch (potentialName) {
    case 'harmonic':
      return { ok: true, field: buildHarmonic(field, grid, params.omega ?? 1) };
    case 'periodicWells':
      return {
        ok: true,
        field: buildPeriodicWells(field, grid, params.v0 ?? 2, params.period ?? 3),
      };
    case 'doubleWell':
      return {
        ok: true,
        field: buildDoubleWell(
          field,
          grid,
          params.v0 ?? 2.5,
          params.separation ?? 2,
          params.width ?? 0.7,
        ),
      };
    case 'squareWell':
      return {
        ok: true,
        field: buildSquareWell(
          field,
          grid,
          params.inside ?? -3,
          params.outside ?? 4,
          params.halfWidth ?? 2,
        ),
      };
    case 'free':
      return { ok: true, field };
    case 'formula':
      return buildFormula(field, grid, context.formulaExpression ?? '0', params.scale ?? 1);
    case 'drawn':
      return buildDrawn(field, context.drawnPotential, params.scale ?? 1);
    default:
      return { ok: false, error: 'Unsupported potential selected.' };
  }
}

function buildHarmonic(field: Float64Array, grid: Grid, omega: number): Float64Array {
  const prefactor = 0.5 * omega * omega;
  for (let j = 0; j < grid.ny; j += 1) {
    const y = grid.y[j];
    for (let i = 0; i < grid.nx; i += 1) {
      const x = grid.x[i];
      field[grid.index(i, j)] = prefactor * (x * x + y * y);
    }
  }
  return field;
}

function buildPeriodicWells(
  field: Float64Array,
  grid: Grid,
  v0: number,
  period: number,
): Float64Array {
  const twoPiOverPeriod = (2 * Math.PI) / Math.max(0.0001, period);
  for (let j = 0; j < grid.ny; j += 1) {
    const y = grid.y[j];
    for (let i = 0; i < grid.nx; i += 1) {
      const x = grid.x[i];
      const termX = Math.cos(twoPiOverPeriod * x);
      const termY = Math.cos(twoPiOverPeriod * y);
      field[grid.index(i, j)] = v0 * (termX * termX + termY * termY);
    }
  }
  return field;
}

function buildDoubleWell(
  field: Float64Array,
  grid: Grid,
  v0: number,
  separation: number,
  width: number,
): Float64Array {
  const sigmaSquared = Math.max(0.0001, width * width);
  for (let j = 0; j < grid.ny; j += 1) {
    const ySquared = grid.y[j] * grid.y[j];
    for (let i = 0; i < grid.nx; i += 1) {
      const x = grid.x[i];
      const left = Math.exp(-((x + separation * 0.5) * (x + separation * 0.5) + ySquared) / sigmaSquared);
      const right = Math.exp(-((x - separation * 0.5) * (x - separation * 0.5) + ySquared) / sigmaSquared);
      field[grid.index(i, j)] = -v0 * (left + right);
    }
  }
  return field;
}

function buildSquareWell(
  field: Float64Array,
  grid: Grid,
  inside: number,
  outside: number,
  halfWidth: number,
): Float64Array {
  for (let j = 0; j < grid.ny; j += 1) {
    const y = Math.abs(grid.y[j]);
    for (let i = 0; i < grid.nx; i += 1) {
      const x = Math.abs(grid.x[i]);
      field[grid.index(i, j)] = x <= halfWidth && y <= halfWidth ? inside : outside;
    }
  }
  return field;
}

function buildFormula(
  field: Float64Array,
  grid: Grid,
  expression: string,
  scale: number,
): PotentialBuildResult {
  const evaluator = compileExpression(expression);
  if (!evaluator.ok) {
    return evaluator;
  }

  for (let j = 0; j < grid.ny; j += 1) {
    const y = grid.y[j];
    for (let i = 0; i < grid.nx; i += 1) {
      const x = grid.x[i];
      let value: number;
      try {
        value = evaluator.evaluate(x, y);
      } catch (error) {
        const reason = error instanceof Error ? error.message : 'Unknown formula evaluation error';
        return { ok: false, error: `Formula error at grid point (${i}, ${j}): ${reason}` };
      }
      field[grid.index(i, j)] = value * scale;
    }
  }

  return { ok: true, field };
}

function buildDrawn(
  field: Float64Array,
  drawnPotential: Float64Array | undefined,
  scale: number,
): PotentialBuildResult {
  if (!drawnPotential) {
    return { ok: false, error: 'Drawn potential buffer is not available.' };
  }
  for (let i = 0; i < field.length; i += 1) {
    field[i] = drawnPotential[i] * scale;
  }
  return { ok: true, field };
}

function compileExpression(
  expression: string,
): { ok: true; evaluate: (x: number, y: number) => number } | BuildError {
  const trimmed = expression.trim();
  if (!trimmed) {
    return { ok: false, error: 'Formula expression cannot be empty.' };
  }
  if (!/^[A-Za-z0-9_+\-*/^().,\s]*$/.test(trimmed)) {
    return { ok: false, error: 'Formula contains invalid characters.' };
  }

  const identifierMatches = trimmed.match(/[A-Za-z_]\w*/g) ?? [];
  const allowed = new Set(['x', 'y', 'sin', 'cos', 'tan', 'exp', 'sqrt', 'abs', 'log', 'pow', 'PI', 'E']);
  for (const identifier of identifierMatches) {
    if (!allowed.has(identifier)) {
      return { ok: false, error: `Unsupported symbol in formula: ${identifier}` };
    }
  }

  const jsExpression = trimmed.replaceAll('^', '**');
  const evaluator = new Function(
    'x',
    'y',
    'sin',
    'cos',
    'tan',
    'exp',
    'sqrt',
    'abs',
    'log',
    'pow',
    'PI',
    'E',
    `return ${jsExpression};`,
  ) as (
    x: number,
    y: number,
    sin: (value: number) => number,
    cos: (value: number) => number,
    tan: (value: number) => number,
    exp: (value: number) => number,
    sqrt: (value: number) => number,
    abs: (value: number) => number,
    log: (value: number) => number,
    pow: (value: number, exponent: number) => number,
    PI: number,
    E: number,
  ) => unknown;

  return {
    ok: true,
    evaluate(x: number, y: number): number {
      const value = Number(
        evaluator(
          x,
          y,
          Math.sin,
          Math.cos,
          Math.tan,
          Math.exp,
          Math.sqrt,
          Math.abs,
          Math.log,
          Math.pow,
          Math.PI,
          Math.E,
        ),
      );
      if (!Number.isFinite(value)) {
        throw new Error('Formula returned a non-finite value.');
      }
      return value;
    },
  };
}
