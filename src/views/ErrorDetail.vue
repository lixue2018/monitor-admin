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
        <el-descriptions-item v-if="!isApiError" label="行列">{{ displayLine }} : {{ displayColumn }}</el-descriptions-item>
        <el-descriptions-item label="页面 URL" :span="2">{{ detail.pageUrl || '-' }}</el-descriptions-item>
        <el-descriptions-item v-if="!isApiError && apiRequestUrl" label="接口 URL" :span="2">{{ apiRequestUrl }}</el-descriptions-item>
        <el-descriptions-item label="错误信息" :span="2">{{ detail.message || '-' }}</el-descriptions-item>
        <el-descriptions-item label="上报时间">{{ formatTime(detail.timestamp) }}</el-descriptions-item>
        <el-descriptions-item label="录屏 ID">
          <span>{{ detail.recordScreenId || '-' }}</span>
          <el-button
            v-if="detail.recordScreenId"
            type="primary"
            link
            size="small"
            style="margin-left: 8px"
            @click="showRecordScreen = true"
          >
            播放录屏
          </el-button>
        </el-descriptions-item>
        <el-descriptions-item label="错误 UID" :span="2">{{ detail.errorUid || '-' }}</el-descriptions-item>
        <el-descriptions-item label="User-Agent" :span="2">{{ detail.userAgent || '-' }}</el-descriptions-item>
      </el-descriptions>

      <div v-if="isApiError" class="section api-body-section">
        <h4 class="section-title">请求 / 响应</h4>
        <CollapsibleCodeBlock
          title="请求参数 (Request)"
          name="request-body"
          :content="apiRequestBody"
          :default-expanded="true"
        />
        <CollapsibleCodeBlock
          title="响应参数 (Response)"
          name="response-body"
          :content="apiResponse"
          :default-expanded="true"
        />
      </div>

      <div class="section" v-if="!isApiError && (detail.stack || detail.message)">
        <h4 class="section-title">错误堆栈</h4>
        <ErrorStackViewer
          :message="detail.message"
          :stack="detail.stack"
          :file-name="detail.fileName"
          :line="detail.line"
          :column="detail.column"
        />
      </div>

      <div class="section">
        <h4 class="section-title">原始上报数据</h4>
        <CollapsibleCodeBlock
          title="JSON 原文"
          name="raw-json"
          :content="rawJsonText"
          :default-expanded="true"
        />
      </div>
    </el-card>

    <RecordScreenPlayer
      v-if="detail?.recordScreenId"
      v-model:visible="showRecordScreen"
      :record-screen-id="detail.recordScreenId"
    />
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { getDetail, type ReportItem } from '@/api';
import CollapsibleCodeBlock from '@/components/CollapsibleCodeBlock.vue';
import ErrorStackViewer from '@/components/ErrorStackViewer.vue';
import RecordScreenPlayer from '@/components/RecordScreenPlayer.vue';
import { formatResourceCategoryLabel } from '@/constants/reportTypes';
import { fetchSourceContext, parseStackFrames } from '@/utils/errorStack';

const route = useRoute();
const router = useRouter();
const loading = ref(false);
const detail = ref<ReportItem | null>(null);
const resolvedLine = ref<number>();
const resolvedColumn = ref<number>();
const showRecordScreen = ref(false);

const API_ERROR_TYPES = new Set(['api_error', 'xhr', 'fetch']);

const displayLine = computed(() => resolvedLine.value ?? detail.value?.line ?? '-');
const displayColumn = computed(() => resolvedColumn.value ?? detail.value?.column ?? '-');

async function resolveDetailLocation(row: ReportItem) {
  resolvedLine.value = undefined;
  resolvedColumn.value = undefined;

  const frames = parseStackFrames(row.stack).frames;
  const fileUrl = frames[0]?.file || row.fileName;
  if (!fileUrl) return;

  const result = await fetchSourceContext(
    fileUrl,
    frames[0]?.line ?? row.line ?? 0,
    0,
    frames[0]?.column ?? row.column,
    row.message,
    frames[0]?.functionName,
    row.line,
    row.column,
  );
  if (result) {
    resolvedLine.value = result.line;
    resolvedColumn.value = result.column;
  }
}

watch(detail, (row) => {
  if (row && !API_ERROR_TYPES.has(row.type)) {
    resolveDetailLocation(row);
  }
});

const isApiError = computed(() => {
  const t = detail.value?.type;
  return t ? API_ERROR_TYPES.has(t) : false;
});

function pickBody(data: Record<string, unknown> | undefined, keys: string[]): string {
  if (!data) return '';
  for (const key of keys) {
    const v = data[key];
    if (v == null) continue;
    if (typeof v === 'string') return v.trim();
    try {
      return JSON.stringify(v, null, 2);
    } catch {
      return String(v);
    }
  }
  return '';
}

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

const apiRequestBody = computed(() => {
  const text = pickBody(detail.value?.data, [
    'requestParams',
    'requestBody',
    'request',
    'reqBody',
    'body',
  ]);
  if (text) return text;
  const url = apiRequestUrl.value;
  return url ? JSON.stringify({ url }, null, 2) : '';
});

const apiResponse = computed(() =>
  pickBody(detail.value?.data, ['response', 'responseBody', 'resBody']),
);

const rawJsonText = computed(() => {
  if (!detail.value?.data) return '';
  try {
    return JSON.stringify(detail.value.data, null, 2);
  } catch {
    return String(detail.value.data);
  }
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
.section-title {
  margin-bottom: 8px;
  color: #303133;
  font-size: 14px;
  font-weight: 600;
}
.api-body-section :deep(.collapsible-code-block + .collapsible-code-block) {
  margin-top: 8px;
}
</style>
