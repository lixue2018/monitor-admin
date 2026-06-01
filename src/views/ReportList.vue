<template>
  <div class="report-list">
    <el-card shadow="never">
      <el-form :inline="true" :model="query" class="filter-form">
        <el-form-item label="关键词">
          <el-input v-model="query.keyword" clearable placeholder="消息 / URL" style="width: 220px" />
        </el-form-item>
        <el-form-item v-if="showSlowLevelFilter" label="慢接口等级">
          <el-select v-model="query.slowLevel" clearable placeholder="全部等级" style="width: 160px">
            <el-option
              v-for="lv in SLOW_API_LEVEL_ORDER"
              :key="lv"
              :label="SLOW_API_LEVEL_LABELS[lv]"
              :value="lv"
            />
          </el-select>
        </el-form-item>
        <el-form-item>
          <el-button type="primary" @click="search">查询</el-button>
          <el-button @click="reset">重置</el-button>
          <el-button type="danger" :disabled="!selectedIds.length" @click="handleBatchDelete">
            批量删除
          </el-button>
        </el-form-item>
      </el-form>

      <el-table
        v-loading="loading"
        :data="list"
        stripe
        class="clickable-table"
        @selection-change="onSelect"
        @row-click="onRowClick"
      >
        <el-table-column type="selection" width="48" />
        <el-table-column prop="apikey" label="项目" min-width="110" show-overflow-tooltip />
        <el-table-column prop="type" label="类型" min-width="200" class-name="col-report-type">
          <template #default="{ row }">
            <el-tag size="small" class="report-type-tag" :type="tagTypeByReport(row.type)">
              {{ formatReportTypeLabel(row.type) }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column v-if="showSlowLevelCol" label="等级" min-width="140">
          <template #default="{ row }">
            <el-tag size="small" :type="tagTypeBySlowLevel(getRowSlowLevel(row))">
              {{ formatSlowLevelLabel(getRowSlowLevel(row)) }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column prop="message" label="信息" min-width="220" show-overflow-tooltip />
        <el-table-column
          v-if="showResourceUrl"
          label="资源地址"
          min-width="180"
          show-overflow-tooltip
        >
          <template #default="{ row }">
            {{ row.data?.resourceUrl || '-' }}
          </template>
        </el-table-column>
        <el-table-column v-if="showApiCols" prop="data.url" label="请求 URL" min-width="160" show-overflow-tooltip>
          <template #default="{ row }">{{ row.data?.url || row.url || '-' }}</template>
        </el-table-column>
        <el-table-column v-if="showApiCols" label="请求方式" min-width="100">
          <template #default="{ row }">{{ formatApiMethod(row) }}</template>
        </el-table-column>
        <el-table-column v-if="showApiCols" label="状态码" min-width="100">
          <template #default="{ row }">{{ row.data?.status ?? row.status ?? '-' }}</template>
        </el-table-column>
        <el-table-column v-if="showDurationCol" label="耗时(ms)" min-width="100">
          <template #default="{ row }">{{ row.data?.duration ?? '-' }}</template>
        </el-table-column>
        <el-table-column prop="pageUrl" label="页面" min-width="160" show-overflow-tooltip>
          <template #default="{ row }">{{ row.pageUrl || row.url || '-' }}</template>
        </el-table-column>
        <el-table-column prop="userId" label="用户 ID(itCode)" min-width="120" show-overflow-tooltip />
        <el-table-column label="时间" min-width="170">
          <template #default="{ row }">{{ formatTime(row.timestamp) }}</template>
        </el-table-column>
        <el-table-column label="操作" min-width="140" fixed="right" class-name="col-actions">
          <template #default="{ row }">
            <el-button link type="primary" @click.stop="goDetail(row._id)">详情</el-button>
            <el-button link type="danger" @click.stop="handleDelete(row._id)">删除</el-button>
          </template>
        </el-table-column>
      </el-table>

      <el-pagination
        v-model:current-page="query.page"
        v-model:page-size="query.size"
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
import { computed, onMounted, reactive, ref, watch } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { ElMessage, ElMessageBox } from 'element-plus';
import { getList, deleteReport, batchDelete, type ReportItem } from '@/api';
import { useProject, useProjectWatch } from '@/composables/useProject';
import {
  tagTypeByReport,
  formatReportTypeLabel,
  REPORT_TYPE,
  LEGACY_REPORT_TYPE,
} from '@/constants/reportTypes';
import {
  SLOW_API_LEVEL_LABELS,
  SLOW_API_LEVEL_ORDER,
  formatSlowLevelLabel,
  resolveSlowApiLevel,
  tagTypeBySlowLevel,
} from '@/constants/slowApiLevels';

const route = useRoute();
const router = useRouter();
const { apikeyParam } = useProject();

const reportTypes = computed(() => (route.meta.types as string[]) || []);

const showResourceUrl = computed(() =>
  reportTypes.value.some((t) =>
    [REPORT_TYPE.RESOURCE_ERROR, LEGACY_REPORT_TYPE.RESOURCE].includes(t),
  ),
);

const showApiCols = computed(() =>
  reportTypes.value.some((t) =>
    [
      REPORT_TYPE.API_ERROR,
      REPORT_TYPE.API_SLOW,
      REPORT_TYPE.PROMISE_ERROR,
      LEGACY_REPORT_TYPE.UNHANDLED_REJECTION,
      LEGACY_REPORT_TYPE.XHR,
      LEGACY_REPORT_TYPE.FETCH,
    ].includes(t),
  ),
);

const showDurationCol = computed(() =>
  reportTypes.value.some((t) => [REPORT_TYPE.API_SLOW, REPORT_TYPE.API_ERROR].includes(t)),
);

const showSlowLevelCol = computed(() => reportTypes.value.includes(REPORT_TYPE.API_SLOW));

const showSlowLevelFilter = showSlowLevelCol;

const loading = ref(false);
const list = ref<ReportItem[]>([]);
const total = ref(0);
const selectedIds = ref<string[]>([]);

const query = reactive({
  page: 1,
  size: 20,
  keyword: '',
  slowLevel: '' as string,
});

function getRowSlowLevel(row: ReportItem): string | null {
  const level = (row.data?.slowLevel as string) || row.status || null;
  if (level && SLOW_API_LEVEL_ORDER.includes(level as (typeof SLOW_API_LEVEL_ORDER)[number])) {
    return level;
  }
  const duration = Number(row.data?.duration);
  return resolveSlowApiLevel(duration);
}

function formatTime(ts: number) {
  return ts ? new Date(ts).toLocaleString('zh-CN') : '-';
}

function formatApiMethod(row: ReportItem) {
  const m = row.data?.method;
  if (m == null || m === '') return '-';
  return String(m).toUpperCase();
}

async function fetchList() {
  loading.value = true;
  try {
    const res = await getList({
      page: query.page,
      size: query.size,
      types: reportTypes.value.length ? reportTypes.value.join(',') : undefined,
      apikey: apikeyParam.value,
      keyword: query.keyword || undefined,
      slowLevel: query.slowLevel || undefined,
    });
    list.value = res.list;
    total.value = res.total;
  } finally {
    loading.value = false;
  }
}

function search() {
  query.page = 1;
  fetchList();
}

function reset() {
  query.keyword = '';
  query.slowLevel = '';
  query.page = 1;
  fetchList();
}

function onSelect(rows: ReportItem[]) {
  selectedIds.value = rows.map((r) => r._id);
}

function goDetail(id: string) {
  router.push({
    path: `/detail/${id}`,
    query: { from: route.path },
  });
}

function onRowClick(row: ReportItem, _column: unknown, event: MouseEvent) {
  const target = event.target as HTMLElement;
  if (target.closest('button, a, .el-button, .el-checkbox')) return;
  goDetail(row._id);
}

function applyRouteQuery() {
  const kw = route.query.keyword;
  query.keyword = typeof kw === 'string' ? kw : '';
  const lv = route.query.slowLevel;
  query.slowLevel = typeof lv === 'string' ? lv : '';
}

watch(() => [route.query.keyword, route.query.slowLevel], applyRouteQuery);

/** 同组件在不同 /reports/* 路由间切换时需重新按 meta.types 拉取 */
watch(
  () => route.path,
  () => {
    query.page = 1;
    selectedIds.value = [];
    applyRouteQuery();
    applyRouteQuery();
    fetchList();
  },
);

async function handleDelete(id: string) {
  await ElMessageBox.confirm('确定删除该条记录？', '提示', { type: 'warning' });
  await deleteReport(id);
  ElMessage.success('已删除');
  fetchList();
}

async function handleBatchDelete() {
  await ElMessageBox.confirm(`确定删除选中的 ${selectedIds.value.length} 条？`, '提示', {
    type: 'warning',
  });
  await batchDelete(selectedIds.value);
  ElMessage.success('已删除');
  selectedIds.value = [];
  fetchList();
}

useProjectWatch(fetchList);

onMounted(() => {
  applyRouteQuery();
  fetchList();
});
</script>

<style scoped>
.filter-form {
  margin-bottom: 8px;
}
.clickable-table :deep(.el-table__row) {
  cursor: pointer;
}
/* 类型列完整展示，避免 el-tag 被 110px 列宽截断 */
.clickable-table :deep(.col-report-type .cell) {
  overflow: visible;
}
.report-type-tag {
  max-width: none;
  white-space: nowrap;
}
</style>
