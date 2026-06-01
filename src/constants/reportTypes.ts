/** 与 @monitorx/core 上报 type 一致 */
export const REPORT_TYPE = {
  JS_ERROR: 'js_error',
  PROMISE_ERROR: 'promise_error',
  VUE_ERROR: 'vue_error',
  RESOURCE_ERROR: 'resource_error',
  API_ERROR: 'api_error',
  API_SLOW: 'api_slow',
  PERFORMANCE: 'performance',
  CUSTOM_EVENT: 'custom_event',
  PAGE_VIEW: 'page_view',
} as const;

/** web-see 等旧版 SDK 的 type，与 MonitorX 菜单合并展示 */
export const LEGACY_REPORT_TYPE = {
  ERROR: 'error',
  UNHANDLED_REJECTION: 'unhandledrejection',
  RESOURCE: 'resource',
  XHR: 'xhr',
  FETCH: 'fetch',
  WHITE_SCREEN: 'whiteScreen',
  RECORD_SCREEN: 'recordScreen',
  CUSTOM: 'custom',
} as const;

export type ReportType = (typeof REPORT_TYPE)[keyof typeof REPORT_TYPE];

export interface ReportMenuItem {
  path: string;
  /** 查询用的 type 列表（兼容旧版 + MonitorX） */
  types: string[];
  title: string;
  group: 'overview' | 'error' | 'performance';
}

export const ERROR_MENUS: ReportMenuItem[] = [
  {
    path: '/reports/js-error',
    types: [REPORT_TYPE.JS_ERROR, LEGACY_REPORT_TYPE.ERROR],
    title: 'JS 运行时错误',
    group: 'error',
  },
  {
    path: '/reports/promise-error',
    types: [REPORT_TYPE.PROMISE_ERROR, LEGACY_REPORT_TYPE.UNHANDLED_REJECTION],
    title: 'Promise 错误',
    group: 'error',
  },
//   { path: '/reports/vue-error', types: [REPORT_TYPE.VUE_ERROR], title: 'Vue 错误', group: 'error' },
  {
    path: '/reports/resource-error',
    types: [REPORT_TYPE.RESOURCE_ERROR, LEGACY_REPORT_TYPE.RESOURCE],
    title: '资源加载失败',
    group: 'error',
  },
  {
    path: '/reports/api-error',
    types: [REPORT_TYPE.API_ERROR, LEGACY_REPORT_TYPE.XHR, LEGACY_REPORT_TYPE.FETCH],
    title: '网络请求异常/API 错误',
    group: 'error',
  },
  {
    path: '/reports/api-slow',
    types: [REPORT_TYPE.API_SLOW],
    title: '慢接口分级',
    group: 'error',
  },
  {
    path: '/reports/custom-event',
    types: [REPORT_TYPE.CUSTOM_EVENT, LEGACY_REPORT_TYPE.CUSTOM],
    title: '自定义事件',
    group: 'error',
  },
//   { path: '/reports/page-view', types: [REPORT_TYPE.PAGE_VIEW], title: '页面访问', group: 'error' },
  {
    path: '/reports/white-screen',
    types: [LEGACY_REPORT_TYPE.WHITE_SCREEN],
    title: '白屏检测',
    group: 'error',
  },
//   {
//     path: '/reports/record-screen',
//     types: [LEGACY_REPORT_TYPE.RECORD_SCREEN],
//     title: '录屏',
//     group: 'error',
//   },
];

export const PERFORMANCE_MENU: ReportMenuItem = {
  path: '/performance',
  types: [REPORT_TYPE.PERFORMANCE],
  title: 'Web 性能',
  group: 'performance',
};

/** 图表/列表展示：英文（中文） */
export const REPORT_TYPE_LABELS: Record<string, string> = {
  js_error: 'js_error（JS 运行时错误）',
  promise_error: 'promise_error（Promise 错误）',
  vue_error: 'vue_error（Vue 错误）',
  resource_error: 'resource_error（资源加载失败）',
  api_error: 'api_error（API 错误）',
  api_slow: 'api_slow（慢接口）',
  performance: 'performance（性能）',
  custom_event: 'custom_event（自定义事件）',
  page_view: 'page_view（页面访问）',
  error: 'error（错误）',
  unhandledrejection: 'unhandledrejection（未捕获 Promise）',
  resource: 'resource（资源）',
  xhr: 'xhr（接口请求）',
  fetch: 'fetch（请求）',
  whiteScreen: 'whiteScreen（白屏）',
  recordScreen: 'recordScreen（录屏）',
  custom: 'custom（自定义）',
  unknown: 'unknown（未知）',
};

export function formatReportTypeLabel(type: string): string {
  return REPORT_TYPE_LABELS[type] || `${type}（未知类型）`;
}

/** 资源错误 category（与 SDK resourceType 一致） */
export const RESOURCE_CATEGORY_LABELS: Record<string, string> = {
  script: 'script（脚本）',
  link: 'link（样式）',
  img: 'img（图片）',
  font: 'font（字体）',
  media: 'media（音视频）',
  other: 'other（其他）',
};

export function formatResourceCategoryLabel(category: string): string {
  return RESOURCE_CATEGORY_LABELS[category] || category || '-';
}

/** 侧栏所有错误类 type（去重） */
export const ALL_ERROR_TYPES = [...new Set(ERROR_MENUS.flatMap((m) => m.types))];

/** 根据上报 type 解析列表页路由 */
export function resolvePathByReportType(type: string): string {
  if (type === REPORT_TYPE.PERFORMANCE) return PERFORMANCE_MENU.path;
  const menu = ERROR_MENUS.find((m) => m.types.includes(type));
  return menu?.path ?? '/reports/all-errors';
}

/** 首页统计卡片跳转 */
export const DASHBOARD_STAT_ROUTES: Record<string, string> = {
  区间内上报: '/reports/all',
  今日上报: '/reports/all',
  错误类: '/reports/all-errors',
  性能类: PERFORMANCE_MENU.path,
  'API 错误': '/reports/api-error',
  '慢接口 (>1s)': '/reports/api-slow',
};

export function tagTypeByReport(type: string): '' | 'success' | 'warning' | 'danger' | 'info' {
  if (
    [
      'js_error',
      'promise_error',
      'vue_error',
      'error',
      'unhandledrejection',
      'whiteScreen',
    ].includes(type)
  ) {
    return 'danger';
  }
  if (type === 'performance') return 'success';
  if (type === 'api_slow') return 'warning'; // 列表等级列单独用 tagTypeBySlowLevel
  if (type === 'api_error' || type === 'xhr' || type === 'fetch') return 'warning';
  return 'info';
}
