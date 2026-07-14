<template>
  <div class="error-stack-viewer">
    <div v-if="displayMessage" class="error-message">
      {{ displayMessage }}
    </div>

    <el-collapse v-model="expanded" class="stack-collapse">
      <el-collapse-item
        v-for="(frame, index) in frames"
        :key="index"
        :name="index"
      >
        <template #title>
          <span class="frame-title">
            <span class="frame-at">at</span>
            <span v-if="frame.functionName" class="frame-fn">{{ frame.functionName }}</span>
            <span class="frame-loc">
              ({{ shortFileName(frame.file) }}:{{ displayLine(frame, index) }}:{{ displayColumn(frame, index) }})
            </span>
          </span>
        </template>

        <div v-loading="loadingIndex === index" class="frame-body">
          <div v-if="sourceMap[index]?.length" class="source-panel">
            <div
              v-for="row in sourceMap[index]"
              :key="row.num"
              class="source-row"
              :class="{ 'is-error-line': row.isError }"
            >
              <span class="line-num">
                <span v-if="row.isError" class="line-error-icon" title="报错位置">×</span>
                <span v-else class="line-num-text">{{ row.num }}</span>
              </span>
              <span class="line-code">
                <template v-if="row.mark">
                  <span class="code-before">{{ row.text.slice(0, row.mark.start) }}</span>
                  <span class="code-error-mark">{{ row.text.slice(row.mark.start, row.mark.end) }}</span>
                  <span class="code-after">{{ row.text.slice(row.mark.end) }}</span>
                </template>
                <template v-else>{{ row.text || ' ' }}</template>
              </span>
            </div>
          </div>
          <pre v-else class="frame-fallback">{{ frame.raw }}</pre>
          <div v-if="loadErrors[index]" class="source-hint">{{ loadErrors[index] }}</div>
        </div>
      </el-collapse-item>
    </el-collapse>

    <el-collapse v-if="rawStack" class="raw-collapse">
      <el-collapse-item name="raw">
        <template #title>
          <span class="raw-title">完整堆栈文本</span>
        </template>
        <pre class="raw-stack">{{ rawStack }}</pre>
      </el-collapse-item>
    </el-collapse>
  </div>
</template>

<script setup lang="ts">
import { computed, ref, watch } from 'vue';
import {
  fetchSourceContext,
  getSourceProxySetupHint,
  parseStackFrames,
  shortFileName,
  type ParsedStackFrame,
  type SourceLine,
} from '@/utils/errorStack';

const props = defineProps<{
  message?: string;
  stack?: string;
  fileName?: string;
  line?: number;
  column?: number;
}>();

const expanded = ref<(number | string)[]>([0]);
const loadingIndex = ref<number | null>(null);
const sourceMap = ref<Record<number, SourceLine[]>>({});
const resolvedLoc = ref<Record<number, { line: number; column?: number }>>({});
const loadErrors = ref<Record<number, string>>({});

const parsed = computed(() => parseStackFrames(props.stack));
const displayMessage = computed(
  () => props.message || parsed.value.message || '未知错误',
);
const rawStack = computed(() => props.stack?.trim() || '');

const frames = computed<ParsedStackFrame[]>(() => {
  const list = [...parsed.value.frames];
  if (list.length === 0 && props.fileName && props.line) {
    list.push({
      raw: `at (${props.fileName}:${props.line}:${props.column ?? 0})`,
      file: props.fileName,
      line: props.line,
      column: props.column,
    });
  }
  return list;
});

function displayLine(frame: ParsedStackFrame, index: number): number | string {
  return resolvedLoc.value[index]?.line ?? frame.line ?? '-';
}

function displayColumn(frame: ParsedStackFrame, index: number): number | string {
  return resolvedLoc.value[index]?.column ?? frame.column ?? 0;
}

async function loadFrameSource(index: number, frame: ParsedStackFrame) {
  if (!frame.file || !frame.line || sourceMap.value[index]) return;

  loadingIndex.value = index;
  loadErrors.value[index] = '';
  try {
    const result = await fetchSourceContext(
      frame.file,
      frame.line,
      6,
      frame.column ?? props.column,
      displayMessage.value,
      frame.functionName,
      index === 0 ? props.line : undefined,
      index === 0 ? props.column : undefined,
    );
    if (result?.lines.length) {
      sourceMap.value = { ...sourceMap.value, [index]: result.lines };
      resolvedLoc.value = {
        ...resolvedLoc.value,
        [index]: { line: result.line, column: result.column },
      };
    } else {
      loadErrors.value[index] = `无法加载源码。${getSourceProxySetupHint()}`;
    }
  } catch {
    loadErrors.value[index] = '源码请求失败，请检查 /source-proxy 代理配置';
  } finally {
    loadingIndex.value = null;
  }
}

watch(
  frames,
  (list) => {
    if (list.length && !expanded.value.length) {
      expanded.value = [0];
    }
    list.forEach((frame, index) => {
      if (expanded.value.includes(index)) {
        loadFrameSource(index, frame);
      }
    });
  },
  { immediate: true },
);

watch(expanded, (names) => {
  frames.value.forEach((frame, index) => {
    if (names.includes(index)) {
      loadFrameSource(index, frame);
    }
  });
});
</script>

<style scoped>
.error-stack-viewer {
  border-radius: 6px;
  overflow: hidden;
  background: #1e1e1e;
  border: 1px solid #333;
}

.error-message {
  padding: 12px 16px;
  color: #f56c6c;
  font-size: 14px;
  font-weight: 500;
  border-bottom: 1px solid #333;
  word-break: break-word;
}

.stack-collapse {
  border: none;
  --el-collapse-header-bg-color: #252526;
  --el-collapse-content-bg-color: #1e1e1e;
  --el-collapse-border-color: #333;
}

.stack-collapse :deep(.el-collapse-item__header) {
  color: #d4d4d4;
  font-family: Consolas, Monaco, 'Courier New', monospace;
  font-size: 13px;
  padding: 0 12px;
  height: 40px;
  line-height: 40px;
}

.stack-collapse :deep(.el-collapse-item__wrap) {
  border-bottom-color: #333;
}

.stack-collapse :deep(.el-collapse-item__content) {
  padding: 0;
}

.frame-title {
  display: flex;
  align-items: center;
  gap: 6px;
  min-width: 0;
}

.frame-at {
  color: #858585;
}

.frame-fn {
  color: #dcdcaa;
}

.frame-loc {
  color: #9cdcfe;
}

.frame-body {
  min-height: 48px;
}

.source-panel {
  font-family: Consolas, Monaco, 'Courier New', monospace;
  font-size: 13px;
  line-height: 1.6;
  overflow: auto;
}

.source-row {
  display: flex;
  min-height: 22px;
}

.source-row.is-error-line .line-num {
  background: #2a1f1f;
}

.line-num {
  flex: 0 0 52px;
  padding: 0 8px;
  text-align: right;
  color: #858585;
  user-select: none;
  background: #1a1a1a;
  border-right: 1px solid #333;
  display: flex;
  align-items: center;
  justify-content: flex-end;
}

.line-num-text {
  width: 100%;
  text-align: right;
}

.line-error-icon {
  color: #f56c6c;
  font-size: 14px;
  font-weight: 700;
  line-height: 1;
}

.line-code {
  flex: 1;
  padding: 0 12px;
  color: #d4d4d4;
  white-space: pre;
  overflow-x: auto;
}

.code-error-mark {
  color: #f56c6c;
  text-decoration: underline wavy #f56c6c;
  text-underline-offset: 3px;
  text-decoration-thickness: 1.5px;
}

.frame-fallback {
  margin: 0;
  padding: 12px 16px;
  color: #d4d4d4;
  font-size: 13px;
  white-space: pre-wrap;
  word-break: break-all;
}

.source-hint {
  padding: 8px 16px 12px;
  color: #909399;
  font-size: 12px;
}

.raw-collapse {
  border-top: 1px solid #333;
  --el-collapse-header-bg-color: #252526;
  --el-collapse-content-bg-color: #1e1e1e;
  --el-collapse-border-color: #333;
}

.raw-collapse :deep(.el-collapse-item__header) {
  color: #909399;
  font-size: 12px;
  padding: 0 12px;
  height: 36px;
}

.raw-title {
  color: #909399;
}

.raw-stack {
  margin: 0;
  padding: 12px 16px;
  color: #d4d4d4;
  font-size: 12px;
  line-height: 1.5;
  white-space: pre-wrap;
  word-break: break-all;
}
</style>
