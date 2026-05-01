import type { ColorName } from './@types/terminal.js';
import type {
  WatermarkLevel,
  WatermarkMetric,
  Watermarks,
} from './@types/watermarks.js';

const DEFAULT_WATERMARKS: Watermarks = {
  statements: [50, 80],
  branches: [50, 80],
  functions: [50, 80],
  lines: [50, 80],

  // Types
  used: [50, 80],
  tested: [50, 80],
};

const METRICS: readonly WatermarkMetric[] = [
  'statements',
  'branches',
  'functions',
  'lines',

  // Types
  'used',
  'tested',
];

const isValidEntry = (entry: unknown): entry is readonly [number, number] => {
  if (!Array.isArray(entry) || entry.length !== 2) return false;

  const [lowMax, highMin] = entry;

  if (typeof lowMax !== 'number' || typeof highMin !== 'number') return false;
  if (!Number.isFinite(lowMax) || !Number.isFinite(highMin)) return false;
  return lowMax < highMin;
};

const getDefault = (): Watermarks => ({
  statements: DEFAULT_WATERMARKS.statements,
  branches: DEFAULT_WATERMARKS.branches,
  functions: DEFAULT_WATERMARKS.functions,
  lines: DEFAULT_WATERMARKS.lines,

  // Types
  used: DEFAULT_WATERMARKS.used,
  tested: DEFAULT_WATERMARKS.tested,
});

const classForPercent = (
  resolved: Watermarks,
  metric: WatermarkMetric,
  value: number | null
): WatermarkLevel | null => {
  if (value === null) return null;

  const [lowMax, highMin] = resolved[metric];

  if (value < lowMax) return 'low';
  if (value >= highMin) return 'high';
  return 'medium';
};

const LEVEL_COLORS: Record<WatermarkLevel, ColorName> = {
  low: 'pink',
  medium: 'purple',
  high: 'white',
};

const colorForPercent = (
  resolved: Watermarks,
  metric: WatermarkMetric,
  value: number | null
): ColorName => {
  if (value === null) return 'dimGray';

  const level = classForPercent(resolved, metric, value);

  if (level === null) return 'white';
  return LEVEL_COLORS[level];
};

const normalize = (custom: Partial<Watermarks> | undefined): Watermarks => {
  const resolved = getDefault();
  if (!custom) return resolved;

  for (const metric of METRICS) {
    const entry = custom[metric];
    if (isValidEntry(entry)) resolved[metric] = entry;
  }

  return resolved;
};

export const watermarks = {
  getDefault,
  classForPercent,
  colorForPercent,
  normalize,
} as const;
