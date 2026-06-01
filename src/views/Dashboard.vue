<template>
  <div class="dashboard" v-loading="loading">
    <div class="toolbar">
      <el-select v-model="days" style="width: 120px" @change="loadAll">
        <el-option :value="7" label="近 7 天" />
        <el-option :value="14" label="近 14 天" />
        <el-option :value="30" label="近 30 天" />
      </el-select>
      <el-button @click="loadAll">刷新</el-button>
    </div>

    <el-row :gutter="16" class="stat-row">
      <el-col :span="4" v-for="item in statCards" :key="item.label">
        <el-card
          shadow="hover"
          class="stat-card stat-card--link"
          @click="goTo(item.to)"
        >
          <div class="stat-label">{{ item.label }}</div>
          <div class="stat-value" :style="{ color: item.color }">{{ item.value }}</div>
          <div class="stat-hint">点击查看</div>
        </el-card>
      </el-col>
    </el-row>

    <el-row :gutter="16" style="margin-top: 16px">
      <el-col :span="14">
        <el-card shadow="never" class="chart-card">
          <template #header>
            <span>错误趋势（按天）</span>
            <span class="card-tip">点击折线区域查看错误列表</span>
          </template>
          <div ref="trendRef" class="chart chart--clickable"></div>
        </el-card>
      </el-col>
      <el-col :span="10">
        <el-card shadow="never" class="chart-card">
          <template #header>
            <span>上报类型分布</span>
            <span class="card-tip">点击扇区跳转</span>
          </template>
          <div ref="typePieRef" class="chart chart--clickable"></div>
        </el-card>
      </el-col>
    </el-row>

    <el-row :gutter="16" style="margin-top: 16px">
      <el-col :span="14">
        <el-card shadow="never" class="chart-card">
          <template #header>
            <span>错误趋势（按类型）</span>
            <span class="card-tip">点击图例或折线跳转</span>
          </template>
          <div ref="multiTrendRef" class="chart chart--clickable"></div>
        </el-card>
      </el-col>
      <el-col :span="10">
        <el-card shadow="never" class="chart-card">
          <template #header>
            <span>API 错误状态码</span>
            <span class="card-tip">点击查看 API 错误</span>
          </template>
          <div ref="apiPieRef" class="chart chart--clickable"></div>
        </el-card>
      </el-col>
    </el-row>

    <el-row :gutter="16" style="margin-top: 16px">
      <el-col :span="12">
        <el-card shadow="never" class="chart-card">
          <template #header>
            <span>Web Vitals 均值（近 {{ days }} 天）</span>
            <span class="card-tip">点击查看性能列表</span>
          </template>
          <div ref="vitalsRef" class="chart chart--clickable"></div>
        </el-card>
      </el-col>
      <el-col :span="12">
        <el-card shadow="never" class="chart-card">
          <template #header>
            <span>各项目上报量</span>
            <span class="card-tip">点击柱子筛选项目</span>
          </template>
          <div ref="projectRef" class="chart chart--clickable"></div>
        </el-card>
      </el-col>
    </el-row>

    <el-row :gutter="16" style="margin-top: 16px">
      <el-col :span="24">
        <el-card shadow="never">
          <template #header>
            <span>慢接口 TOP（响应 &gt; 1s）</span>
            <span class="card-tip">点击查看慢接口列表</span>
          </template>
          <el-table
            :data="data?.topSlowApis || []"
            stripe
            size="small"
            max-height="240"
            class="clickable-table"
            @row-click="onTopSlowApiClick"
          >
            <el-table-column prop="url" label="接口 URL" min-width="160" show-overflow-tooltip />
            <el-table-column prop="count" label="次数" min-width="100" />
            <el-table-column label="平均耗时(ms)" min-width="120">
              <template #default="{ row }">{{ row.avgDuration ?? '-' }}</template>
            </el-table-column>
          </el-table>
        </el-card>
      </el-col>
    </el-row>

    <el-row :gutter="16" style="margin-top: 16px">
      <el-col :span="12">
        <el-card shadow="never">
          <template #header>错误 TOP 页面</template>
          <el-table
            :data="data?.topPages || []"
            stripe
            size="small"
            max-height="280"
            class="clickable-table"
            @row-click="onTopPageClick"
          >
            <el-table-column prop="pageUrl" label="页面" min-width="160" show-overflow-tooltip />
            <el-table-column prop="count" label="次数" min-width="100" />
          </el-table>
        </el-card>
      </el-col>
      <el-col :span="12">
        <el-card shadow="never">
          <template #header>错误 TOP 消息</template>
          <el-table
            :data="data?.topMessages || []"
            stripe
            size="small"
            max-height="280"
            class="clickable-table"
            @row-click="onTopMessageClick"
          >
            <el-table-column prop="message" label="消息" min-width="160" show-overflow-tooltip />
            <el-table-column label="类型" min-width="200" show-overflow-tooltip>
              <template #default="{ row }">{{ formatReportTypeLabel(row.type) }}</template>
            </el-table-column>
            <el-table-column prop="count" label="次数" min-width="100" />
          </el-table>
        </el-card>
      </el-col>
    </el-row>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref } from 'vue';
import { useRouter } from 'vue-router';
import * as echarts from 'echarts';
import { getDashboard, type DashboardData } from '@/api';
import { useProject, useProjectWatch } from '@/composables/useProject';
import { WEB_VITALS_CHART_LABELS } from '@/constants/webVitals';
import {
  DASHBOARD_STAT_ROUTES,
  formatReportTypeLabel,
  PERFORMANCE_MENU,
  resolvePathByReportType,
} from '@/constants/reportTypes';
const router = useRouter();
const { apikeyParam, setApikey } = useProject();
const loading = ref(false);
const days = ref(7);
const data = ref<DashboardData | null>(null);

const trendRef = ref<HTMLElement>();
const typePieRef = ref<HTMLElement>();
const multiTrendRef = ref<HTMLElement>();
const apiPieRef = ref<HTMLElement>();
const vitalsRef = ref<HTMLElement>();
const projectRef = ref<HTMLElement>();

let charts: echarts.ECharts[] = [];
/** 多折线图 series 下标 -> 原始 type */
let trendByTypeMap: string[] = [];

const statCards = computed(() => {
  const s = data.value?.summary;
  if (!s) return [];
  return [
    { label: '区间内上报', value: s.totalInRange, color: '#409eff', to: DASHBOARD_STAT_ROUTES['区间内上报'] },
    { label: '今日上报', value: s.todayCount, color: '#67c23a', to: DASHBOARD_STAT_ROUTES['今日上报'] },
    { label: '错误类', value: s.errorCount, color: '#f56c6c', to: DASHBOARD_STAT_ROUTES['错误类'] },
    { label: '性能类', value: s.performanceCount, color: '#e6a23c', to: DASHBOARD_STAT_ROUTES['性能类'] },
    { label: 'API 错误', value: s.apiErrorCount, color: '#909399', to: DASHBOARD_STAT_ROUTES['API 错误'] },
    {
      label: '慢接口 (>1s)',
      value: s.apiSlowCount,
      color: '#b88230',
      to: DASHBOARD_STAT_ROUTES['慢接口 (>1s)'],
    },
  ];
});

function goTo(path: string, query?: Record<string, string>) {
  router.push({ path, query });
}

function onTopPageClick(row: { pageUrl: string }) {
  goTo('/reports/all-errors', { keyword: row.pageUrl });
}

function onTopMessageClick(row: { message: string; type: string }) {
  goTo(resolvePathByReportType(row.type), { keyword: row.message });
}

function onTopSlowApiClick(row: { url: string }) {
  goTo(DASHBOARD_STAT_ROUTES['慢接口 (>1s)'], { keyword: row.url });
}

function initCharts() {
  charts.forEach((c) => c.dispose());
  charts = [];
  const refs = [trendRef, typePieRef, multiTrendRef, apiPieRef, vitalsRef, projectRef];
  refs.forEach((r) => {
    if (r.value) charts.push(echarts.init(r.value));
  });
}

function bindChartClicks() {
  const [trendChart, typePie, multiTrend, apiPie, vitals, project] = charts;

  trendChart?.off('click');
  trendChart?.on('click', () => {
    goTo('/reports/all-errors');
  });

  typePie?.off('click');
  typePie?.on('click', (params: { data?: { type?: string } }) => {
    const type = params.data?.type;
    if (type) goTo(resolvePathByReportType(type));
  });

  multiTrend?.off('click');
  multiTrend?.on('click', (params: { seriesIndex?: number; componentType?: string }) => {
    if (params.componentType === 'series' && params.seriesIndex != null) {
      const type = trendByTypeMap[params.seriesIndex];
      if (type) goTo(resolvePathByReportType(type));
    }
  });

  apiPie?.off('click');
  apiPie?.on('click', () => {
    goTo('/reports/api-error');
  });

  vitals?.off('click');
  vitals?.on('click', () => {
    goTo(PERFORMANCE_MENU.path);
  });

  project?.off('click');
  project?.on('click', (params: { name?: string }) => {
    const apikey = params.name;
    if (apikey && apikey !== '当前项目') {
      setApikey(apikey);
      goTo('/reports/all-errors');
    }
  });
}

function renderAll() {
  const d = data.value;
  if (!d || !charts.length) return;

  const [trendChart, typePie, multiTrend, apiPie, vitals, project] = charts;

  trendChart?.setOption({
    tooltip: { trigger: 'axis' },
    grid: { left: 40, right: 20, top: 30, bottom: 30 },
    xAxis: { type: 'category', data: d.errorTrend.map((x) => x.date) },
    yAxis: { type: 'value', minInterval: 1 },
    series: [{
      name: '错误数',
      type: 'line',
      smooth: true,
      areaStyle: { opacity: 0.12 },
      data: d.errorTrend.map((x) => x.count),
      itemStyle: { color: '#f56c6c' },
    }],
  });

  typePie?.setOption({
    tooltip: { trigger: 'item' },
    legend: { bottom: 0, type: 'scroll' },
    series: [{
      type: 'pie',
      radius: ['38%', '62%'],
      data: d.typeDistribution.map((t) => ({
        name: formatReportTypeLabel(t.type),
        value: t.count,
        type: t.type,
      })),
    }],
  });

  const { dates, series } = d.errorTrendByType;
  trendByTypeMap = series.map((s) => s.type);
  multiTrend?.setOption({
    tooltip: { trigger: 'axis' },
    legend: { bottom: 0, type: 'scroll' },
    grid: { left: 40, right: 20, top: 30, bottom: 50 },
    xAxis: { type: 'category', data: dates },
    yAxis: { type: 'value', minInterval: 1 },
    series: series.map((s) => ({
      name: formatReportTypeLabel(s.type),
      type: 'line',
      smooth: true,
      data: s.data,
    })),
  });

  apiPie?.setOption({
    tooltip: { trigger: 'item' },
    series: [{
      type: 'pie',
      radius: '60%',
      data: d.apiStatusDistribution.map((x) => ({
        name: `HTTP ${x.status}`,
        value: x.count,
      })),
    }],
  });

  const p = d.performanceSummary;
  const vitalsKeys = ['avgFp', 'avgFcp', 'avgLcp', 'avgFid', 'avgTtfb', 'avgDomReady', 'avgLoadTime'] as const;
  vitals?.setOption({
    tooltip: { trigger: 'axis' },
    grid: { left: 80, right: 20, top: 30, bottom: 80 },
    xAxis: {
      type: 'category',
      data: WEB_VITALS_CHART_LABELS.map((x) => x.label),
      axisLabel: { interval: 0, rotate: 25, fontSize: 11 },
    },
    yAxis: { type: 'value' },
    series: [{
      name: '均值(ms)',
      type: 'bar',
      data: vitalsKeys.map((k) => p[k] ?? 0),
      itemStyle: { color: '#67c23a' },
    }],
  });

  const projects = d.projectBreakdown.length
    ? d.projectBreakdown
    : [{ apikey: apikeyParam.value || '当前项目', count: d.summary.totalInRange }];

  project?.setOption({
    tooltip: { trigger: 'axis' },
    grid: { left: 80, right: 20, top: 20, bottom: 30 },
    xAxis: { type: 'value' },
    yAxis: {
      type: 'category',
      data: projects.map((x) => x.apikey).reverse(),
    },
    series: [{
      type: 'bar',
      data: projects.map((x) => x.count).reverse(),
      itemStyle: { color: '#409eff' },
    }],
  });

  bindChartClicks();
}

async function loadAll() {
  loading.value = true;
  try {
    data.value = await getDashboard({ apikey: apikeyParam.value, days: days.value });
    initCharts();
    renderAll();
  } finally {
    loading.value = false;
  }
}

function onResize() {
  charts.forEach((c) => c.resize());
}

useProjectWatch(loadAll);

onMounted(async () => {
  await loadAll();
  window.addEventListener('resize', onResize);
});

onUnmounted(() => {
  window.removeEventListener('resize', onResize);
  charts.forEach((c) => c.dispose());
});
</script>

<style scoped>
.toolbar {
  display: flex;
  gap: 12px;
  margin-bottom: 16px;
}
.stat-card {
  text-align: center;
}
.stat-card--link {
  cursor: pointer;
  transition: transform 0.15s, box-shadow 0.15s;
}
.stat-card--link:hover {
  transform: translateY(-2px);
}
.stat-label {
  color: #909399;
  font-size: 13px;
}
.stat-value {
  font-size: 28px;
  font-weight: 700;
  margin-top: 8px;
}
.stat-hint {
  font-size: 11px;
  color: #c0c4cc;
  margin-top: 6px;
}
.chart {
  height: 300px;
}
.chart--clickable {
  cursor: pointer;
}
.card-tip {
  float: right;
  font-size: 12px;
  color: #909399;
  font-weight: normal;
}
.clickable-table :deep(.el-table__row) {
  cursor: pointer;
}
</style>
