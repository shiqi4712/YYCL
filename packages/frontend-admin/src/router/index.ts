import { createRouter, createWebHistory } from 'vue-router'
import { useUserStore } from '@/stores/user'

const router = createRouter({
  history: createWebHistory(),
  routes: [
    { path: '/login', name: 'Login', component: () => import('@/views/LoginView.vue') },
    {
      path: '/',
      component: () => import('@/views/LayoutView.vue'),
      meta: { requiresAuth: true, requiresTrainer: true },
      children: [
        { path: '', name: 'Dashboard', component: () => import('@/views/DashboardView.vue') },
        { path: 'teachers', name: 'TeacherManage', component: () => import('@/views/TeacherManageView.vue') },
        { path: 'scenarios', name: 'ScenarioManage', component: () => import('@/views/ScenarioManageView.vue') },
        { path: 'scripts', name: 'ScriptManage', component: () => import('@/views/ScriptManageView.vue') }
      ]
    }
  ]
})

router.beforeEach((to, from, next) => {
  const userStore = useUserStore()
  if (to.meta.requiresAuth && !userStore.token) {
    next('/login')
  } else if (to.meta.requiresTrainer && userStore.user?.role !== 'TRAINER') {
    next('/login')
  } else if (to.path === '/login' && userStore.token) {
    next('/')
  } else {
    next()
  }
})

export default router
