<template>
  <div class="collapsible-code-block">
    <el-collapse v-model="activeNames" class="code-collapse">
      <el-collapse-item :name="name">
        <template #title>
          <span class="collapse-title">
            {{ title }}
            <el-tag v-if="!hasContent" size="small" type="info" class="empty-tag">无</el-tag>
            <span v-else class="size-hint">{{ sizeHint }}</span>
          </span>
        </template>
        <pre v-if="hasContent" class="code-pre">{{ displayText }}</pre>
        <div v-else class="code-empty">暂无数据</div>
      </el-collapse-item>
    </el-collapse>
  </div>
</template>

<script setup lang="ts">
import { computed, ref, watch } from 'vue';

const props = withDefaults(
  defineProps<{
    title: string;
    content?: string;
    name?: string;
    defaultExpanded?: boolean;
  }>(),
  {
    content: '',
    name: 'panel',
    defaultExpanded: true,
  },
);

const activeNames = ref<string[]>(props.defaultExpanded ? [props.name] : []);

watch(
  () => props.defaultExpanded,
  (v) => {
    activeNames.value = v ? [props.name] : [];
  },
);

const hasContent = computed(() => Boolean(props.content?.trim()));

const displayText = computed(() => {
  const raw = props.content?.trim() || '';
  if (!raw) return '';
  try {
    const parsed = JSON.parse(raw);
    return JSON.stringify(parsed, null, 2);
  } catch {
    return raw;
  }
});

const sizeHint = computed(() => {
  const len = displayText.value.length;
  if (len < 1024) return `${len} 字符`;
  return `${(len / 1024).toFixed(1)} KB`;
});
</script>

<style scoped>
.collapsible-code-block {
  margin-top: 8px;
}

.code-collapse {
  border: 1px solid #333;
  border-radius: 6px;
  overflow: hidden;
  --el-collapse-header-bg-color: #252526;
  --el-collapse-content-bg-color: #1e1e1e;
  --el-collapse-border-color: #333;
}

.code-collapse :deep(.el-collapse-item__header) {
  padding: 0 12px;
  height: 40px;
  line-height: 40px;
  color: #d4d4d4;
  font-size: 13px;
}

.code-collapse :deep(.el-collapse-item__wrap),
.code-collapse :deep(.el-collapse-item__content) {
  padding: 0;
  border: none;
}

.collapse-title {
  display: inline-flex;
  align-items: center;
  gap: 8px;
}

.empty-tag {
  margin-left: 4px;
}

.size-hint {
  color: #888;
  font-size: 12px;
  font-weight: normal;
}

.code-pre {
  margin: 0;
  padding: 12px 16px;
  background: #1e1e1e;
  color: #d4d4d4;
  font-size: 13px;
  line-height: 1.5;
  white-space: pre-wrap;
  word-break: break-all;
  max-height: 480px;
  overflow: auto;
}

.code-empty {
  padding: 12px 16px;
  color: #888;
  font-size: 13px;
  background: #1e1e1e;
}
</style>
