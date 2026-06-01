/** Web Vitals 分级：good < goodMax；needs-improvement ∈ [goodMax, warnMax]；poor > warnMax */
export type VitalRating = 'good' | 'needs-improvement' | 'poor';

export interface VitalThreshold {
  goodMax: number;
  warnMax: number;
  /** 中间档文案，默认「需改进」；Load 为「可接受」 */
  warnLabel?: string;
}

export const VITAL_THRESHOLDS: Record<string, VitalThreshold> = {
  fcp: { goodMax: 1800, warnMax: 3000 },
  lcp: { goodMax: 2500, warnMax: 4000 },
  fid: { goodMax: 100, warnMax: 300 },
  cls: { goodMax: 0.1, warnMax: 0.25 },
  ttfb: { goodMax: 800, warnMax: 1800 },
  loadTime: { goodMax: 3000, warnMax: 5000, warnLabel: '可接受' },
};

export function getVitalRating(key: string, raw: unknown): VitalRating | null {
  if (raw == null || raw === '') return null;
  const n = Number(raw);
  if (Number.isNaN(n)) return null;
  const t = VITAL_THRESHOLDS[key];
  if (!t) return null;
  if (n < t.goodMax) return 'good';
  if (n <= t.warnMax) return 'needs-improvement';
  return 'poor';
}

export function vitalRatingClass(key: string, raw: unknown): string {
  const rating = getVitalRating(key, raw);
  return rating ? `vital-cell--${rating}` : '';
}

export function getVitalFullTooltip(tooltip: string, ratingGuide: string): string {
  return `${tooltip}\n\n${ratingGuide}`;
}

/** Web Vitals / 性能指标中文说明 */
export const WEB_VITALS = {  fcp: {
    key: 'fcp',
    abbr: 'FCP',
    name: '首次内容绘制',
    unit: 'ms',
    tableLabel: '首次内容绘制 FCP(ms)',
    avgLabel: '均 首次内容绘制 FCP',
    oneLine: '屏幕第一次有东西出现',
    tooltip:
      '从用户输入网址到浏览器画出第一个有意义内容（文字、图片、SVG）的时间。时机：浏览器渲染出任何一个非空白的元素时，就会触发这个指标。通俗理解："用户看到屏幕从白屏变成有东西的时刻"。',
    ratingGuide: `参考分级：
🟢 优秀：< 1800ms（1.8 秒）
🟡 需改进：1800 - 3000ms
🔴 差：> 3000ms`,
  },
  lcp: {
    key: 'lcp',
    abbr: 'LCP',
    name: '最大内容绘制',
    unit: 'ms',
    tableLabel: '最大内容绘制 LCP(ms)',
    avgLabel: '均 最大内容绘制 LCP',
    oneLine: '主要内容加载完了',
    tooltip:
      '页面上最大的元素（通常是首屏的大图、视频、大段文字块）渲染完成的时间。时机：当前最大的可见元素每次更大元素出现就会更新，直到用户开始交互或页面加载完。通俗理解："用户感觉这个页面主要内容已经出来了"。比 FCP 更接近真实用户体感。',
    ratingGuide: `参考分级：
🟢 优秀：< 2500ms（2.5 秒）
🟡 需改进：2500 - 4000ms
🔴 差：> 4000ms`,
  },
  fid: {
    key: 'fid',
    abbr: 'FID',
    name: '首次输入延迟',
    unit: 'ms',
    tableLabel: '首次输入延迟 FID(ms)',
    avgLabel: '均 首次输入延迟 FID',
    oneLine: '点击响应快不快',
    tooltip:
      '用户第一次点击/输入到浏览器响应的时间差。只在用户主动交互时才会触发（点击按钮、输入文字、点链接等）。通俗理解："用户点了按钮，多久后页面才有反应"。',
    ratingGuide: `参考分级：
🟢 优秀：< 100ms
🟡 需改进：100 - 300ms
🔴 差：> 300ms`,
  },
  cls: {
    key: 'cls',
    abbr: 'CLS',
    name: '累积布局偏移',
    unit: '',
    tableLabel: '累积布局偏移 CLS',
    avgLabel: '均 累积布局偏移 CLS',
    oneLine: '页面晃不晃',
    tooltip:
      '页面元素"突然乱跳"的总程度。例如正要点按钮时顶部加载广告把按钮挤下去导致误点，这就是布局偏移。时机：页面整个生命周期内累计计算，每次元素位置变动都加权累加。通俗理解："页面元素晃不晃"。',
    ratingGuide: `参考分级：
🟢 优秀：< 0.1
🟡 需改进：0.1 - 0.25
🔴 差：> 0.25`,
  },
  ttfb: {
    key: 'ttfb',
    abbr: 'TTFB',
    name: '首字节时间',
    unit: 'ms',
    tableLabel: '首字节时间 TTFB(ms)',
    avgLabel: '均 首字节时间 TTFB',
    oneLine: '服务器响应快不快',
    tooltip:
      '浏览器发出请求到收到服务器返回的第一个字节的时间。时机：浏览器发起 HTML 请求的瞬间开始计时，收到响应的第一字节时停止。通俗理解："服务器响应快不快"。主要反映后端性能和网络速度。',
    ratingGuide: `参考分级：
🟢 优秀：< 800ms
🟡 需改进：800 - 1800ms
🔴 差：> 1800ms`,
  },
  loadTime: {
    key: 'loadTime',
    abbr: 'Load',
    name: '页面加载完成',
    unit: 'ms',
    tableLabel: '页面加载完成(ms)',
    avgLabel: '均 页面加载完成',
    oneLine: '浏览器小圈圈停下来的时刻',
    tooltip: `页面加载完成 = 浏览器 window.load 事件触发的时间。时机：浏览器认为页面"完全加载完毕"时触发。

包括：HTML 文档解析完成；所有同步 JS 执行完成；所有 CSS 加载并应用完成；所有 <img> 图片下载完成；所有同步加载的资源（fonts、iframe）完成；所有同步 AJAX 请求完成。

不包括：异步懒加载图片；load 之后才发起的 AJAX；用 JS 动态 append 的资源；视频缓冲（<video> 不会卡 load 事件）。

通俗理解："浏览器右上角转圈圈停下来的时刻"。对 React/Vue/Angular 单页应用意义有限：HTML 加载完后可能只是空壳，真正内容由 JS 异步渲染，window.load 时页面可能仍无内容，SPA 更应关注 LCP、FCP。`,
    ratingGuide: `参考分级：
🟢 优秀：< 3000ms
🟡 可接受：3000 - 5000ms
🔴 差：> 5000ms`,
  },
} as const;

export const WEB_VITALS_TABLE_COLUMNS = [
  WEB_VITALS.fcp,
  WEB_VITALS.lcp,
  WEB_VITALS.fid,
  WEB_VITALS.cls,
  WEB_VITALS.ttfb,
  WEB_VITALS.loadTime,
];

/** 用户体验重要性排序（最重要 → 次要） */
export const WEB_VITALS_UX_PRIORITY = [
  WEB_VITALS.lcp,
  WEB_VITALS.cls,
  WEB_VITALS.fid,
  WEB_VITALS.fcp,
  WEB_VITALS.ttfb,
  WEB_VITALS.loadTime,
] as const;

export const CORE_WEB_VITALS_NOTE =
  '这就是 Google 提出的 Core Web Vitals（核心网页指标），现在 SEO 排名也会参考这些指标。';

export const WEB_VITALS_CHART_LABELS = [
  { key: 'fp', label: '首次绘制 FP' },
  { key: 'fcp', label: '首次内容绘制 FCP' },
  { key: 'lcp', label: '最大内容绘制 LCP' },
  { key: 'fid', label: '首次输入延迟 FID' },
  { key: 'ttfb', label: '首字节时间 TTFB' },
  { key: 'domReady', label: 'DOM 就绪' },
  { key: 'loadTime', label: '页面加载完成' },
];
