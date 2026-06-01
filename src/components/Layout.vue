<template>
  <el-container class="layout">
    <el-aside width="220px" class="aside">
      <div class="logo">
        <el-icon :size="22"><Monitor /></el-icon>
        <span>MonitorX</span>
      </div>
      <div class="aside-menu-scroll monitorx-scrollbar--dark">
        <el-menu
          :default-active="activeMenu"
          router
          background-color="#001529"
          text-color="#fff"
          active-text-color="#409eff"
        >
          <el-menu-item index="/dashboard">
            <el-icon><DataAnalysis /></el-icon>
            <span>数据统计</span>
          </el-menu-item>

          <el-menu-item-group title="错误监控">
            <el-menu-item
              v-for="item in ERROR_MENUS"
              :key="item.path"
              :index="item.path"
            >
              <el-icon><Warning /></el-icon>
              <span>{{ item.title }}</span>
            </el-menu-item>
          </el-menu-item-group>

          <el-menu-item-group title="性能监控">
            <el-menu-item :index="PERFORMANCE_MENU.path">
              <el-icon><Odometer /></el-icon>
              <span>{{ PERFORMANCE_MENU.title }}</span>
            </el-menu-item>
          </el-menu-item-group>
        </el-menu>
      </div>
    </el-aside>

    <el-container class="layout-body" direction="vertical">
      <el-header class="header">
        <span class="title">{{ pageTitle }}</span>
        <div class="header-right">
          <span class="label">项目</span>
          <el-select
            v-model="selectedApikey"
            placeholder="全部项目"
            style="width: 200px"
          >
            <el-option label="全部" value="" />
            <el-option
              v-for="p in projectList"
              :key="p.apikey"
              :label="projectLabel(p)"
              :value="p.apikey"
            />
          </el-select>
          <el-tag type="info" size="small">MonitorX + MySQL (Java) | MongoDB (Node)</el-tag>
        </div>
      </el-header>
      <el-main class="main">
        <router-view :key="route.path" />
      </el-main>
    </el-container>
  </el-container>
</template>

<script setup lang="ts">
import { computed, onMounted } from 'vue';
import { useRoute } from 'vue-router';
import { getProjects } from '@/api';
import { useProject } from '@/composables/useProject';
import { ERROR_MENUS, PERFORMANCE_MENU } from '@/constants/reportTypes';

const route = useRoute();
const { selectedApikey, projectList, setProjects } = useProject();
const activeMenu = computed(() => {
  const path = route.path;
  if (path.startsWith('/detail')) {
    const fromQuery = typeof route.query.from === 'string' ? route.query.from : '';
    if (fromQuery) return fromQuery;
    return (route.meta.fromMenu as string) || '/dashboard';
  }
  const menu = ERROR_MENUS.find((m) => path.startsWith(m.path));
  if (menu) return menu.path;
  if (path.startsWith('/performance')) return PERFORMANCE_MENU.path;
  return path;
});

const pageTitle = computed(() => (route.meta.title as string) || '前端监控');

function projectLabel(p: { apikey: string; count?: number }) {
  return p.count != null ? `${p.apikey} (${p.count})` : p.apikey;
}

onMounted(async () => {
  try {
    const proj = await getProjects();
    setProjects((proj as { apikey: string; count?: number }[]) || []);
  } catch {
    setProjects([]);
  }
});
</script>

<style scoped>
.layout {
  height: 100vh;
  overflow: hidden;
}
.layout-body {
  flex: 1;
  min-width: 0;
  overflow: hidden;
}
.aside {
  display: flex;
  flex-direction: column;
  height: 100vh;
  overflow: hidden;
  background: #001529;
}
.aside-menu-scroll {
  flex: 1;
  min-height: 0;
  overflow-x: hidden;
  overflow-y: auto;
}
.aside-menu-scroll :deep(.el-menu) {
  border-right: none;
}
.logo {
  height: 60px;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  color: #fff;
  font-size: 16px;
  font-weight: 600;
  border-bottom: 1px solid #0d2137;
}
:deep(.el-menu-item-group__title) {
  color: rgba(255, 255, 255, 0.45);
  padding: 12px 20px 4px;
  font-size: 12px;
}
.header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  background: #fff;
  border-bottom: 1px solid #eee;
}
.title {
  font-size: 18px;
  font-weight: 600;
}
.header-right {
  display: flex;
  align-items: center;
  gap: 12px;
}
.label {
  color: #606266;
  font-size: 14px;
}
.main {
  flex: 1;
  min-height: 0;
  overflow-x: hidden;
  overflow-y: auto;
  background: #f5f7fa;
}
</style>
