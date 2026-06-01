/** 慢接口分级（与 SDK / server 一致） */
export const SLOW_API_LEVEL = {
  MILD: 'mild',
  MODERATE: 'moderate',
  SLOW: 'slow',
  CRITICAL: 'critical',
} as const;

export type SlowApiLevel = (typeof SLOW_API_LEVEL)[keyof typeof SLOW_API_LEVEL];

export const SLOW_API_LEVEL_LABELS: Record<SlowApiLevel, string> = {
  mild: '偏慢 (1s-3s)',
  moderate: '较慢 (3s-5s)',
  slow: '慢 (5s-10s)',
  critical: '严重慢 (>10s)',
};

export const SLOW_API_LEVEL_COLORS: Record<SlowApiLevel, string> = {
  mild: '#e6a23c',
  moderate: '#f39c12',
  slow: '#f56c6c',
  critical: '#c45656',
};

export const SLOW_API_LEVEL_ORDER: SlowApiLevel[] = [
  SLOW_API_LEVEL.MILD,
  SLOW_API_LEVEL.MODERATE,
  SLOW_API_LEVEL.SLOW,
  SLOW_API_LEVEL.CRITICAL,
];

export function resolveSlowApiLevel(duration: number): SlowApiLevel | null {
  const d = Number(duration);
  if (!Number.isFinite(d) || d < 1000) return null;
  if (d < 3000) return SLOW_API_LEVEL.MILD;
  if (d < 5000) return SLOW_API_LEVEL.MODERATE;
  if (d <= 10000) return SLOW_API_LEVEL.SLOW;
  return SLOW_API_LEVEL.CRITICAL;
}

export function formatSlowLevelLabel(level?: string | null): string {
  if (!level) return '-';
  return SLOW_API_LEVEL_LABELS[level as SlowApiLevel] || level;
}

export function tagTypeBySlowLevel(
  level?: string | null,
): '' | 'success' | 'warning' | 'danger' | 'info' {
  switch (level) {
    case SLOW_API_LEVEL.MILD:
      return 'warning';
    case SLOW_API_LEVEL.MODERATE:
      return 'warning';
    case SLOW_API_LEVEL.SLOW:
      return 'danger';
    case SLOW_API_LEVEL.CRITICAL:
      return 'danger';
    default:
      return 'info';
  }
}
