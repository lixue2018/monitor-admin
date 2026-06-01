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
