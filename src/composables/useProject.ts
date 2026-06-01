import { ref, computed, watch, type Ref } from 'vue';

export const ALL_PROJECT = '';

const selectedApikey = ref<string>(ALL_PROJECT);
const projectList = ref<{ apikey: string; count?: number; name?: string }[]>([]);

export function useProject() {
  const apikeyParam = computed(() =>
    selectedApikey.value ? selectedApikey.value : undefined,
  );

  function setApikey(key: string) {
    selectedApikey.value = key;
  }

  function setProjects(list: { apikey: string; count?: number; name?: string }[]) {
    projectList.value = list;
  }

  return {
    selectedApikey,
    projectList,
    apikeyParam,
    setApikey,
    setProjects,
  };
}

/** 监听项目切换后刷新页面数据 */
export function useProjectWatch(callback: () => void, extra?: Ref<unknown>[]) {
  const { selectedApikey } = useProject();
  watch(
    [selectedApikey, ...(extra || [])],
    () => callback(),
    { deep: true },
  );
}
