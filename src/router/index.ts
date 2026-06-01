import { createRouter, createWebHistory } from 'vue-router';
import Layout from '@/components/Layout.vue';
import { ALL_ERROR_TYPES, ERROR_MENUS, PERFORMANCE_MENU } from '@/constants/reportTypes';

const errorRoutes = ERROR_MENUS.map((item) => ({
  path: item.path.replace(/^\//, ''),
  name: item.path.replace(/\//g, '-').slice(1),
  component: () => import('@/views/ReportList.vue'),
  meta: { title: item.title, types: item.types, fromMenu: item.path },
}));

const router = createRouter({
  history: createWebHistory(),
  routes: [
    {
      path: '/',
      component: Layout,
      redirect: '/dashboard',
      children: [
        {
          path: 'dashboard',
          name: 'Dashboard',
          component: () => import('@/views/Dashboard.vue'),
          meta: { title: '数据统计' },
        },
        ...errorRoutes,
        {
          path: 'reports/all-errors',
          name: 'reports-all-errors',
          component: () => import('@/views/ReportList.vue'),
          meta: { title: '全部错误类', types: ALL_ERROR_TYPES, fromMenu: '/reports/all-errors' },
        },
        {
          path: 'reports/all',
          name: 'reports-all',
          component: () => import('@/views/ReportList.vue'),
          meta: { title: '全部上报', types: [], fromMenu: '/reports/all' },
        },
        {
          path: 'performance',
          name: 'Performance',
          component: () => import('@/views/PerformanceView.vue'),
          meta: { title: PERFORMANCE_MENU.title, fromMenu: PERFORMANCE_MENU.path },
        },
        {
          path: 'detail/:id',
          name: 'Detail',
          component: () => import('@/views/ErrorDetail.vue'),
          meta: { title: '上报详情' },
        },
        { path: 'errors', redirect: '/reports/js-error' },
        { path: 'errors/:id', redirect: (to) => `/detail/${to.params.id}` },
      ],
    },
  ],
});

export default router;
