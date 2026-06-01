<template>
  <div class="error-detail" v-loading="loading">
    <el-page-header @back="goBack" content="上报详情" style="margin-bottom: 16px" />

    <el-card v-if="detail" shadow="never">
      <el-descriptions :column="2" border>
        <el-descriptions-item label="项目">{{ detail.apikey || '-' }}</el-descriptions-item>
        <el-descriptions-item label="类型">
          <el-tag size="small">{{ detail.type }}</el-tag>
        </el-descriptions-item>
        <el-descriptions-item label="分类">{{ formatCategory(detail) }}</el-descriptions-item>
        <el-descriptions-item label="状态">{{ detail.status || '-' }}</el-descriptions-item>
        <el-descriptions-item label="用户 ID(itCode)">{{ detail.userId || '-' }}</el-descriptions-item>
        <template v-if="isApiError">
          <el-descriptions-item label="请求 URL" :span="2">{{ apiRequestUrl || '-' }}</el-descriptions-item>
          <el-descriptions-item label="请求方式">{{ apiMethod }}</el-descriptions-item>
          <el-descriptions-item label="状态码">{{ apiStatus }}</el-descriptions-item>
        </template>
        <el-descriptions-item v-else label="文件">{{ detail.fileName || '-' }}</el-descriptions-item>
        <el-descriptions-item v-if="!isApiError" label="行列">{{ detail.line || '-' }} : {{ detail.column || '-' }}</el-descriptions-item>
        <el-descriptions-item label="页面 URL" :span="2">{{ detail.pageUrl || '-' }}</el-descriptions-item>
        <el-descriptions-item v-if="!isApiError && apiRequestUrl" label="接口 URL" :span="2">{{ apiRequestUrl }}</el-descriptions-item>
        <el-descriptions-item label="错误信息" :span="2">{{ detail.message || '-' }}</el-descriptions-item>
        <el-descriptions-item label="上报时间">{{ formatTime(detail.timestamp) }}</el-descriptions-item>
        <el-descriptions-item label="录屏 ID">{{ detail.recordScreenId || '-' }}</el-descriptions-item>
        <el-descriptions-item label="错误 UID" :span="2">{{ detail.errorUid || '-' }}</el-descriptions-item>
        <el-descriptions-item label="User-Agent" :span="2">{{ detail.userAgent || '-' }}</el-descriptions-item>
      </el-descriptions>

      <div class="section" v-if="isApiError && apiResponse">
        <h4>响应体 (Response)</h4>
        <pre class="code-block">{{ apiResponse }}</pre>
      </div>

      <div class="section" v-if="detail.stack || detail.message">
        <h4>错误堆栈</h4>
        <ErrorStackViewer
          :message="detail.message"
          :stack="detail.stack"
          :file-name="detail.fileName"
          :line="detail.line"
          :column="detail.column"
        />
      </div>

      <div class="section">
        <h4>原始上报数据</h4>
        <pre class="code-block">{{ JSON.stringify(detail.data, null, 2) }}</pre>
      </div>
    </el-card>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, ref } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { getDetail, type ReportItem } from '@/api';
import ErrorStackViewer from '@/components/ErrorStackViewer.vue';
import { formatResourceCategoryLabel } from '@/constants/reportTypes';

const route = useRoute();
const router = useRouter();
const loading = ref(false);
const detail = ref<ReportItem | null>(null);

const API_ERROR_TYPES = new Set(['api_error', 'xhr', 'fetch']);

const isApiError = computed(() => {
  const t = detail.value?.type;
  return t ? API_ERROR_TYPES.has(t) : false;
});

/** 接口请求地址（与页面 URL 区分） */
const apiRequestUrl = computed(() => {
  const d = detail.value;
  if (!d) return '';
  const fromData = d.data?.url as string | undefined;
  const fromTop = d.url;
  const candidate = fromData || fromTop || '';
  if (!candidate) return '';
  if (d.pageUrl && candidate === d.pageUrl) return '';
  return candidate;
});

const apiMethod = computed(() => {
  const d = detail.value;
  if (!d) return '-';
  const m = (d.data?.method as string) || '';
  return m ? m.toUpperCase() : '-';
});

const apiStatus = computed(() => {
  const d = detail.value;
  if (!d) return '-';
  const s = d.data?.status ?? d.status;
  return s != null && s !== '' ? String(s) : '-';
});

const apiResponse = computed(() => {
  const d = detail.value;
  if (!d) return '';
  const raw = (d.data?.response as string) || (d.data?.responseBody as string) || '';
  return raw.trim();
});

function goBack() {
  const from = route.query.from as string;
  if (from) router.push(from);
  else router.back();
}

function formatTime(ts: number) {
  return ts ? new Date(ts).toLocaleString('zh-CN') : '-';
}

function formatCategory(row: ReportItem) {
  const isResource = row.type === 'resource_error' || row.type === 'resource';
  if (!isResource) return row.category || '-';
  const raw =
    (row.category && row.category !== 'unknown'
      ? row.category
      : (row.data?.resourceType as string)) || row.category;
  return formatResourceCategoryLabel(raw || 'unknown');
}

onMounted(async () => {
  loading.value = true;
  try {
    detail.value = await getDetail(route.params.id as string);
  } finally {
    loading.value = false;
  }
});
</script>

<style scoped>
.section {
  margin-top: 20px;
}
.section h4 {
  margin-bottom: 8px;
  color: #303133;
}
.code-block {
  background: #1e1e1e;
  color: #d4d4d4;
  padding: 16px;
  border-radius: 6px;
  overflow: auto;
  max-height: 400px;
  font-size: 13px;
  line-height: 1.5;
  white-space: pre-wrap;
  word-break: break-all;
}
</style>
