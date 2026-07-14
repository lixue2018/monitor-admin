import axios from 'axios';

const http = axios.create({ baseURL: '', timeout: 30000 });

http.interceptors.response.use(
  (res) => {
    const body = res.data;
    if (body?.code === 0 || body?.code === 200) return body.data ?? body;
    return Promise.reject(new Error(body?.msg || '请求失败'));
  },
  (err) => {
    const msg =
      err.response?.data?.msg ||
      (err.response?.status === 503
        ? '数据库未连接，请先启动 MySQL（monitor-server-java）| MongoDB（monitor-server）'
        : err.message);
    return Promise.reject(new Error(msg));
  },
);

export interface ReportItem {
  _id: string;
  apikey: string;
  type: string;
  category: string;
  status?: string;
  fileName?: string;
  line?: number;
  column?: number;
  message: string;
  stack: string;
  url: string;
  userAgent: string;
  userId: string;
  pageUrl: string;
  recordScreenId: string;
  errorUid: string;
  timestamp: number;
  data: Record<string, unknown>;
  createdAt?: string;
}

export interface ListResult {
  list: ReportItem[];
  total: number;
  page: number;
  size: number;
}

export interface DashboardData {
  summary: {
    totalInRange: number;
    todayCount: number;
    errorCount: number;
    performanceCount: number;
    apiErrorCount: number;
    apiSlowCount: number;
    apiSlowMildCount: number;
    apiSlowModerateCount: number;
    apiSlowSlowCount: number;
    apiSlowCriticalCount: number;
  };
  slowLevelDistribution: { level: string; label: string; count: number }[];
  slowApiSummary: {
    count: number;
    avgDuration: number | null;
    maxDuration: number | null;
  };
  topSlowApis: { url: string; count: number; avgDuration: number | null }[];
  typeDistribution: { type: string; count: number }[];
  errorTrend: { date: string; count: number }[];
  errorTrendByType: { dates: string[]; series: { type: string; data: number[] }[] };
  performanceSummary: {
    count: number;
    avgFp: number | null;
    avgFcp: number | null;
    avgLcp: number | null;
    avgFid: number | null;
    avgCls: number | null;
    avgTtfb: number | null;
    avgDomReady: number | null;
    avgLoadTime: number | null;
  };
  apiStatusDistribution: { status: string; count: number }[];
  topPages: { pageUrl: string; count: number }[];
  topMessages: { message: string; count: number; type: string }[];
  projectBreakdown: { apikey: string; count: number }[];
}

export const getOverview = (params?: { apikey?: string }) =>
  http.get('/api/overview', { params });

export const getDashboard = (params?: { apikey?: string; days?: number }) =>
  http.get<DashboardData>('/api/dashboard', { params });

export const getStats = (params?: { apikey?: string; days?: number }) =>
  http.get('/api/stats', { params });

export const getTrend = (params?: { apikey?: string; days?: number }) =>
  http.get('/api/trend', { params });

export const getProjects = () =>
  http.get<{ apikey: string; count: number; name?: string }[]>('/api/projects');

export const getList = (params: Record<string, string | number | undefined>) =>
  http.get<ListResult>('/api/list', { params });

export const getDetail = (id: string) => http.get<ReportItem>(`/api/detail/${id}`);

export const deleteReport = (id: string) => http.delete(`/api/detail/${id}`);

export const batchDelete = (ids: string[]) => http.post('/api/batch-delete', { ids });

export interface RecordScreenRow {
  _id: string;
  type: string;
  recordScreenId?: string;
  events?: string;
  timestamp?: number;
  data?: Record<string, unknown>;
}

function pickEncodedEvents(row: RecordScreenRow): string | undefined {
  if (typeof row.events === 'string' && row.events.length > 0) return row.events;
  const nested = row.data?.events;
  if (typeof nested === 'string' && nested.length > 0) return nested;
  return undefined;
}


function isPlayableRrwebEvents(events: unknown[]): boolean {
  if (events.length === 0) return false;
  const first = events[0] as { type?: number };
  // rrweb EventType.FullSnapshot = 2
  return events.length >= 2 || first?.type === 2;
}

function pickPartIndex(row: RecordScreenRow): number {
  const part = row.data?.eventsPart;
  return typeof part === 'number' ? part : 0;
}

function pickPartTotal(row: RecordScreenRow): number {
  const total = row.data?.eventsTotal;
  return typeof total === 'number' ? total : 1;
}

function eventsTimeSpanMs(events: unknown[]): number {
  const stamps = events
    .map((e) => (e as { timestamp?: number }).timestamp)
    .filter((t): t is number => typeof t === 'number');
  if (stamps.length < 2) return 0;
  return Math.max(...stamps) - Math.min(...stamps);
}

function pickBestPlayableEvents(
  rows: RecordScreenRow[],
  unzip: (s: string) => unknown[],
): unknown[] | null {
  let best: unknown[] | null = null;
  let bestSpan = 0;
  let bestLen = 0;

  for (const row of rows) {
    const encoded = pickEncodedEvents(row);
    if (!encoded) continue;
    try {
      const events = unzip(encoded);
      if (!isPlayableRrwebEvents(events)) continue;
      const span = eventsTimeSpanMs(events);
      if (span > bestSpan || (span === bestSpan && events.length > bestLen)) {
        best = events;
        bestSpan = span;
        bestLen = events.length;
      }
    } catch {
      // try next
    }
  }
  return best;
}

async function tryMergeMultipartEvents(
  recordRows: RecordScreenRow[],
  unzip: (s: string) => unknown[],
): Promise<unknown[] | null> {
  const multipartGroups = new Map<number, RecordScreenRow[]>();
  for (const row of recordRows) {
    const total = pickPartTotal(row);
    if (total <= 1) continue;
    const list = multipartGroups.get(total) ?? [];
    list.push(row);
    multipartGroups.set(total, list);
  }

  let best: unknown[] | null = null;
  for (const rows of multipartGroups.values()) {
    const total = pickPartTotal(rows[0]);
    const sorted = [...rows].sort((a, b) => pickPartIndex(a) - pickPartIndex(b));
    if (sorted.length !== total) continue;

    let merged: unknown[] = [];
    for (const row of sorted) {
      const encoded = pickEncodedEvents(row);
      if (!encoded) continue;
      merged = merged.concat(unzip(encoded));
    }
    if (isPlayableRrwebEvents(merged)) {
      const span = eventsTimeSpanMs(merged);
      if (
        !best
        || span > eventsTimeSpanMs(best)
        || (span === eventsTimeSpanMs(best) && merged.length > best.length)
      ) {
        best = merged;
      }
    }
  }
  return best;
}

/** 按录屏 ID 拉取并解压 rrweb events（支持分片合并；同 ID 多条时取最优可播放） */
export async function getRecordScreenEvents(id: string): Promise<unknown[] | null> {
  const list = await http.get<RecordScreenRow[]>('/getRecordScreenId', { params: { id } });
  if (!Array.isArray(list) || list.length === 0) return null;

  const withEvents = list.filter((item) => pickEncodedEvents(item));
  if (withEvents.length === 0) {
    const types = list.map((item) => item.type).join(', ');
    console.warn(
      `[MonitorX Admin] recordScreenId=${id} 无 events 字段，接口返回 type: [${types}]。`
      + '请展开 data 查看是否入库，或重新触发错误后再试。',
    );
    return null;
  }

  const { unzipRecordScreen } = await import('@/utils/recordScreen');
  const { prepareEventsForReplay } = await import('@/utils/recordScreenReplay');

  const recordRows = withEvents.filter((item) => item.type === 'recordScreen');
  const merged = await tryMergeMultipartEvents(recordRows, unzipRecordScreen);
  if (merged) return prepareEventsForReplay(merged);

  const best = pickBestPlayableEvents(recordRows, unzipRecordScreen);
  if (best) return prepareEventsForReplay(best);

  console.warn(`[MonitorX Admin] recordScreenId=${id} 有 ${recordRows.length} 条 events，但均无法解压/播放`);
  return null;
}
