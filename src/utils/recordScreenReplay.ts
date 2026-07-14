/** rrweb EventType：Meta=4、FullSnapshot=2 */
const RRWEB_META = 4;
const RRWEB_FULL_SNAPSHOT = 2;

function countSerializedNodes(node: unknown): number {
  if (!node || typeof node !== 'object') return 0;
  let count = 1;
  const children = (node as { childNodes?: unknown[] }).childNodes;
  if (Array.isArray(children)) {
    for (const child of children) {
      count += countSerializedNodes(child);
    }
  }
  return count;
}

function snapshotNodeCount(event: unknown): number {
  const root = (event as { data?: { node?: unknown } })?.data?.node;
  return countSerializedNodes(root);
}

function eventType(event: unknown): number | undefined {
  return (event as { type?: number }).type;
}

function eventTimestamp(event: unknown): number | undefined {
  return (event as { timestamp?: number }).timestamp;
}

/** 仅跳过开头空白首帧，不裁掉报错前的操作记录 */
function trimLeadingBlankSnapshots(events: unknown[], minNodes = 5): unknown[] {
  const firstSnapIdx = events.findIndex(
    (e) => eventType(e) === RRWEB_FULL_SNAPSHOT,
  );
  if (firstSnapIdx < 0) return events;
  if (snapshotNodeCount(events[firstSnapIdx]) >= minNodes) return events;

  let firstValidIdx = -1;
  for (let i = firstSnapIdx + 1; i < events.length; i += 1) {
    if (eventType(events[i]) !== RRWEB_FULL_SNAPSHOT) continue;
    if (snapshotNodeCount(events[i]) >= minNodes) {
      firstValidIdx = i;
      break;
    }
  }

  if (firstValidIdx <= 0) return events;

  const meta = events.find((e) => eventType(e) === RRWEB_META);
  const tail = events.slice(firstValidIdx).filter((e) => eventType(e) !== RRWEB_META);
  return meta ? [meta, ...tail] : tail;
}

function rebaseTimestamps(events: unknown[]): unknown[] {
  const stamps = events
    .map(eventTimestamp)
    .filter((t): t is number => typeof t === 'number');
  if (stamps.length === 0) return events;
  const base = Math.min(...stamps);
  return events.map((event) => {
    const ts = eventTimestamp(event);
    if (ts == null) return event;
    return { ...(event as Record<string, unknown>), timestamp: ts - base };
  });
}

export function prepareEventsForReplay(events: unknown[]): unknown[] {
  const sorted = [...events].sort(
    (a, b) => (eventTimestamp(a) ?? 0) - (eventTimestamp(b) ?? 0),
  );

  const trimmed = trimLeadingBlankSnapshots(sorted);

  let metaSeen = false;
  const deduped = trimmed.filter((event) => {
    const type = eventType(event);
    if (type === RRWEB_META) {
      if (metaSeen) return false;
      metaSeen = true;
    }
    return true;
  });

  return rebaseTimestamps(deduped);
}

function eventTimeSpanMs(events: unknown[]): number {
  const stamps = events
    .map(eventTimestamp)
    .filter((t): t is number => typeof t === 'number');
  if (stamps.length < 2) return 0;
  return Math.max(...stamps) - Math.min(...stamps);
}

export function analyzeReplayEvents(events: unknown[]): {
  eventCount: number;
  fullSnapshotCount: number;
  richestSnapshotNodes: number;
  durationMs: number;
  likelyBlank: boolean;
  likelyFrozen: boolean;
} {
  const fullSnapshots = events.filter(
    (e) => eventType(e) === RRWEB_FULL_SNAPSHOT,
  );
  let richest = 0;
  for (const snap of fullSnapshots) {
    richest = Math.max(richest, snapshotNodeCount(snap));
  }
  const durationMs = eventTimeSpanMs(events);
  const incremental = events.filter((e) => {
    const t = eventType(e);
    return t !== RRWEB_META && t !== RRWEB_FULL_SNAPSHOT;
  }).length;
  return {
    eventCount: events.length,
    fullSnapshotCount: fullSnapshots.length,
    richestSnapshotNodes: richest,
    durationMs,
    likelyBlank: fullSnapshots.length === 0 || richest < 5,
    likelyFrozen: durationMs < 1500 || incremental < 5,
  };
}

function resolveReplaySize(events: unknown[], maxWidth: number) {
  const maxHeight = Math.min(window.innerHeight * 0.68, 620);

  const meta = events.find((e) => eventType(e) === RRWEB_META) as
    | { data?: { width?: number; height?: number } }
    | undefined;
  const snap = events.find((e) => eventType(e) === RRWEB_FULL_SNAPSHOT) as
    | { data?: { width?: number; height?: number } }
    | undefined;

  const srcW = snap?.data?.width ?? meta?.data?.width ?? 1280;
  const srcH = snap?.data?.height ?? meta?.data?.height ?? 720;
  const ratio = srcH / srcW;

  let width = Math.min(maxWidth, srcW);
  let height = Math.round(width * ratio);
  if (height > maxHeight) {
    height = maxHeight;
    width = Math.round(height / ratio);
  }
  return { width, height, srcW, srcH };
}

export { resolveReplaySize };
