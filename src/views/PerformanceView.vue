<template>
  <div class="performance-view" v-loading="loading">
    <el-row :gutter="16" class="metric-row">
      <el-col :span="3" v-for="m in metricCards" :key="m.label">
        <el-card shadow="hover" class="metric-card">
          <div class="metric-label">{{ m.label }}</div>
          <div class="metric-value">{{ m.value }}</div>
        </el-card>
      </el-col>
    </el-row>

    <el-card class="vitals-guide" shadow="never">
      <div class="vitals-guide__title">
        <el-icon :size="16"><InfoFilled /></el-icon>
        <span>核心指标速查</span>
      </div>
      <div class="vitals-guide__chips">
        <div
          v-for="item in WEB_VITALS_TABLE_COLUMNS"
          :key="item.key"
          class="vital-chip"
        >
          <span class="vital-chip__abbr">{{ item.abbr }}</span>
          <span class="vital-chip__line">{{ item.oneLine }}</span>
        </div>
      </div>
      <div class="vitals-guide__footer">
        <div class="vitals-guide__priority">
          <span class="vitals-guide__priority-label">用户体验排序（最重要 → 次要）</span>
          <div class="priority-chain">
            <template v-for="(item, index) in WEB_VITALS_UX_PRIORITY" :key="item.key">
              <span v-if="index" class="priority-sep">&gt;</span>
              <el-tag
                :type="index < 3 ? 'danger' : index < 5 ? 'warning' : 'info'"
                size="small"
                effect="plain"
              >
                {{ item.key === 'fid' ? 'FID/INP' : item.abbr }}
              </el-tag>
            </template>
          </div>
        </div>
        <!-- <p class="vitals-guide__note">{{ CORE_WEB_VITALS_NOTE }}</p> -->
      </div>
    </el-card>

    <el-card shadow="never" style="margin-top: 16px">
      <template #header>
        <div class="card-header">
          <span>性能上报记录</span>
          <el-button type="primary" link @click="loadSummary">刷新指标</el-button>
        </div>
      </template>

      <el-form :inline="true" class="filter-form">
        <el-form-item label="关键词">
          <el-input v-model="keyword" clearable placeholder="页面 URL" style="width: 240px" />
        </el-form-item>
        <el-form-item>
          <el-button type="primary" @click="search">查询</el-button>
        </el-form-item>
      </el-form>

      <el-table :data="list" stripe>
        <el-table-column prop="apikey" label="项目" min-width="100" show-overflow-tooltip />
        <el-table-column label="页面" min-width="200" show-overflow-tooltip>
          <template #default="{ row }">{{ row.pageUrl || row.data?.pageUrl || '-' }}</template>
        </el-table-column>
        <el-table-column
          v-for="col in WEB_VITALS_TABLE_COLUMNS"
          :key="col.key"
          :min-width="col.key === 'cls' ? 130 : 150"
        >
          <template #header>
            <span class="vital-header">
              <span>{{ col.tableLabel }}</span>
              <el-tooltip placement="top" :show-after="200" popper-class="vital-tooltip">
                <template #content>
                  <div class="vital-tooltip__text">
                    {{ getVitalFullTooltip(col.tooltip, col.ratingGuide) }}
                  </div>
                </template>
                <el-icon class="vital-header__icon" :size="14">
                  <QuestionFilled />
                </el-icon>
              </el-tooltip>
            </span>
          </template>
          <template #default="{ row }">
            <span
              class="vital-cell"
              :class="vitalRatingClass(col.key, row.data?.[col.key])"
            >
              {{ fmt(row.data?.[col.key], col.key === 'cls' ? 3 : 0) }}
            </span>
          </template>
        </el-table-column>
        <el-table-column label="时间" min-width="170">
          <template #default="{ row }">{{ formatTime(row.timestamp) }}</template>
        </el-table-column>
        <el-table-column label="操作" min-width="100" fixed="right">
          <template #default="{ row }">
            <el-button link type="primary" @click="goDetail(row._id)">详情</el-button>
          </template>
        </el-table-column>
      </el-table>

      <el-pagination
        v-model:current-page="page"
        v-model:page-size="size"
        :total="total"
        :page-sizes="[10, 20, 50]"
        layout="total, sizes, prev, pager, next"
        style="margin-top: 16px; justify-content: flex-end"
        @change="fetchList"
      />
    </el-card>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, ref } from 'vue';
import { useRouter } from 'vue-router';
import { getDashboard, getList, type ReportItem } from '@/api';
import { useProject, useProjectWatch } from '@/composables/useProject';
import { REPORT_TYPE } from '@/constants/reportTypes';
import { InfoFilled, QuestionFilled } from '@element-plus/icons-vue';
import {
  getVitalFullTooltip,
  vitalRatingClass,
  WEB_VITALS,
  WEB_VITALS_TABLE_COLUMNS,
  WEB_VITALS_UX_PRIORITY,
} from '@/constants/webVitals';

const router = useRouter();
const { apikeyParam } = useProject();

const loading = ref(false);
const list = ref<ReportItem[]>([]);
const total = ref(0);
const page = ref(1);
const size = ref(20);
const keyword = ref('');
const summary = ref({
  count: 0,
  avgFcp: null as number | null,
  avgLcp: null as number | null,
  avgFid: null as number | null,
  avgCls: null as number | null,
  avgTtfb: null as number | null,
  avgLoadTime: null as number | null,
});

const metricCards = computed(() => [
  { label: '样本数', value: summary.value.count },
  { label: WEB_VITALS.fcp.avgLabel, value: fmt(summary.value.avgFcp) },
  { label: WEB_VITALS.lcp.avgLabel, value: fmt(summary.value.avgLcp) },
  { label: WEB_VITALS.fid.avgLabel, value: fmt(summary.value.avgFid) },
  { label: WEB_VITALS.cls.avgLabel, value: fmt(summary.value.avgCls, 3) },
  { label: WEB_VITALS.ttfb.avgLabel, value: fmt(summary.value.avgTtfb) },
  { label: WEB_VITALS.loadTime.avgLabel, value: fmt(summary.value.avgLoadTime) },
]);

function fmt(v: unknown, digits = 0) {
  if (v == null || v === '') return '-';
  const n = Number(v);
  if (Number.isNaN(n)) return '-';
  return digits ? n.toFixed(digits) : Math.round(n);
}

function formatTime(ts: number) {
  return ts ? new Date(ts).toLocaleString('zh-CN') : '-';
}

async function loadSummary() {
  const data = await getDashboard({ apikey: apikeyParam.value, days: 7 });
  summary.value = data.performanceSummary;
}

async function fetchList() {
  loading.value = true;
  try {
    const res = await getList({
      page: page.value,
      size: size.value,
      type: REPORT_TYPE.PERFORMANCE,
      apikey: apikeyParam.value,
      keyword: keyword.value || undefined,
    });
    list.value = res.list;
    total.value = res.total;
  } finally {
    loading.value = false;
  }
}

function search() {
  page.value = 1;
  fetchList();
}

function goDetail(id: string) {
  router.push({ path: `/detail/${id}`, query: { from: '/performance' } });
}

async function loadAll() {
  loading.value = true;
  try {
    await Promise.all([loadSummary(), fetchList()]);
  } finally {
    loading.value = false;
  }
}

useProjectWatch(loadAll);

onMounted(loadAll);
</script>

<style scoped>
.metric-row :deep(.el-col) {
  display: flex;
}
.metric-row .metric-card {
  width: 100%;
  height: 100%;
  text-align: center;
}
.metric-row :deep(.metric-card .el-card__body) {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  box-sizing: border-box;
  min-height: 80px;
  padding: 14px 8px;
}
.metric-label {
  font-size: 12px;
  color: #909399;
  line-height: 1.4;
  min-height: 2.8em;
  display: flex;
  align-items: center;
  justify-content: center;
}
.metric-value {
  font-size: 20px;
  font-weight: 600;
  margin-top: 6px;
  color: #409eff;
  line-height: 1.2;
}
.card-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
}
.filter-form {
  margin-bottom: 8px;
}
.vitals-guide {
  margin-top: 16px;
  border: 1px solid #e4e7ed;
  background: linear-gradient(180deg, #f8fafc 0%, #fff 100%);
}
.vitals-guide :deep(.el-card__body) {
  padding: 14px 16px 12px;
}
.vitals-guide__title {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 13px;
  font-weight: 600;
  color: #303133;
  margin-bottom: 12px;
}
.vitals-guide__title .el-icon {
  color: #409eff;
}
.vitals-guide__chips {
  display: grid;
  grid-template-columns: repeat(6, minmax(0, 1fr));
  gap: 10px;
}
@media (max-width: 1200px) {
  .vitals-guide__chips {
    grid-template-columns: repeat(3, minmax(0, 1fr));
  }
}
@media (max-width: 768px) {
  .vitals-guide__chips {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
}
.vital-chip {
  padding: 10px 12px;
  background: #fff;
  border: 1px solid #ebeef5;
  border-radius: 8px;
  text-align: center;
}
.vital-chip__abbr {
  display: block;
  font-size: 13px;
  font-weight: 700;
  color: #409eff;
  letter-spacing: 0.02em;
}
.vital-chip__line {
  display: block;
  margin-top: 4px;
  font-size: 12px;
  color: #606266;
  line-height: 1.4;
}
.vitals-guide__footer {
  margin-top: 14px;
  padding-top: 12px;
  border-top: 1px dashed #dcdfe6;
}
.vitals-guide__priority {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 8px 10px;
}
.vitals-guide__priority-label {
  font-size: 12px;
  color: #909399;
  flex-shrink: 0;
}
.priority-chain {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 4px;
}
.priority-sep {
  color: #c0c4cc;
  font-size: 12px;
  font-weight: 600;
  user-select: none;
}
.vitals-guide__note {
  margin: 10px 0 0;
  font-size: 12px;
  color: #909399;
  line-height: 1.5;
}
.vital-header {
  display: inline-flex;
  align-items: center;
  gap: 4px;
}
.vital-header__icon {
  color: #909399;
  cursor: help;
  vertical-align: middle;
}
.vital-header__icon:hover {
  color: #409eff;
}
.vital-cell {
  font-variant-numeric: tabular-nums;
}
.vital-cell--good {
  color: #67c23a;
  font-weight: 600;
}
.vital-cell--needs-improvement {
  color: #e6a23c;
  font-weight: 600;
}
.vital-cell--poor {
  color: #f56c6c;
  font-weight: 600;
}
</style>

<style>
.vital-tooltip {
  max-width: 360px;
}
.vital-tooltip__text {
  line-height: 1.6;
  font-size: 13px;
  white-space: pre-wrap;
}
</style>
