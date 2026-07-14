<template>
  <el-dialog
    :model-value="visible"
    title="播放录屏"
    width="90%"
    top="5vh"
    class="record-screen-dialog"
    destroy-on-close
    append-to-body
    @update:model-value="emit('update:visible', $event)"
    @opened="onDialogOpened"
    @closed="destroyPlayer"
  >
    <div v-loading="loading" class="record-screen-wrap">
      <div v-if="!loading && loadFailed" class="record-screen-empty">
        暂无录屏数据。请确认已开启 SDK 录屏（enableRecordScreen），并在触发错误后查看。
      </div>
      <div ref="playerRef" class="record-player" />
    </div>
  </el-dialog>
</template>

<script setup lang="ts">
import { nextTick, ref } from 'vue';
import { ElMessage } from 'element-plus';
import rrwebPlayer from 'rrweb-player';
import 'rrweb-player/dist/style.css';
import { getRecordScreenEvents } from '@/api';
import { prepareEventsForReplay, resolveReplaySize, analyzeReplayEvents } from '@/utils/recordScreenReplay';

const props = defineProps<{
  visible: boolean;
  recordScreenId: string;
}>();

const emit = defineEmits<{
  'update:visible': [boolean];
}>();

const playerRef = ref<HTMLElement>();
const loading = ref(false);
const loadFailed = ref(false);
// eslint-disable-next-line @typescript-eslint/no-explicit-any
let player: any = null;

async function mountPlayer() {
  destroyPlayer();
  loadFailed.value = false;

  if (!props.recordScreenId) {
    loadFailed.value = true;
    return;
  }

  await nextTick();
  if (!playerRef.value) {
    loadFailed.value = true;
    return;
  }

  loading.value = true;
  try {
    const raw = await getRecordScreenEvents(props.recordScreenId);
    if (!raw?.length) {
      loadFailed.value = true;
      return;
    }

    const events = prepareEventsForReplay(raw);
    const analysis = analyzeReplayEvents(events);
    if (import.meta.env.DEV) {
      console.info('[MonitorX Admin] 录屏回放分析', analysis);
    }
    if (analysis.likelyBlank) {
      ElMessage.warning(
        '录屏首帧可能为空（路由尚未渲染）。请重启业务页后重新触发错误，或使用最新 SDK 录屏后再试。',
      );
    } else if (analysis.likelyFrozen) {
      ElMessage.warning(
        `录屏时长仅约 ${Math.round(analysis.durationMs / 1000)}s，可能停在加载页。请等表格加载完成并操作几秒后再触发错误。`,
      );
    }

    await nextTick();
    if (!playerRef.value) return;

    const containerWidth = Math.max(playerRef.value.clientWidth - 16, 320);
    const { width, height } = resolveReplaySize(events, containerWidth);

    playerRef.value.innerHTML = '';
    player = new rrwebPlayer({
      target: playerRef.value,
      props: {
        events,
        width,
        height,
        UNSAFE_replayCanvas: false,
        showWarning: true,
        autoPlay: true,
        showController: true,
        skipInactive: false,
        speedOption: [1, 2, 4, 8],
        mouseTail: {
          strokeStyle: 'red',
          lineWidth: 3,
          lineCap: 'round',
          duration: 500,
        },
      },
    });
  } catch {
    loadFailed.value = true;
    ElMessage.warning('暂无录屏数据：请确认 SDK 已开启录屏，并在页面停留数秒后重新触发错误再查看');
  } finally {
    loading.value = false;
  }
}

function onDialogOpened() {
  void mountPlayer();
}

function destroyPlayer() {
  if (player && typeof player.$destroy === 'function') {
    player.$destroy();
  }
  player = null;
  if (playerRef.value) {
    playerRef.value.innerHTML = '';
  }
}
</script>

<style scoped>
.record-screen-wrap {
  width: 100%;
  overflow: auto;
}

.record-player {
  width: 100%;
  display: flex;
  justify-content: center;
  overflow: hidden;
}

.record-player :deep(.rr-player) {
  margin: 0 auto;
  max-width: 100%;
}

.record-player :deep(.replayer-wrapper) {
  margin: 0 auto;
  background: #f5f5f5;
}

.record-player :deep(.replayer-mouse-tail) {
  z-index: 100;
  pointer-events: none;
}

.record-screen-empty {
  padding: 48px 0;
  text-align: center;
  color: #909399;
}
</style>

<style>
.record-screen-dialog {
  max-width: 96vw;
}
.record-screen-dialog .el-dialog__body {
  padding: 8px 12px 16px;
  overflow: auto;
}
</style>
