import { createRouter, createWebHistory } from 'vue-router'
import { useUserStore } from '@/stores/user'

const router = createRouter({
  history: createWebHistory(),
  routes: [
    {
      path: '/login',
      name: 'Login',
      component: () => import('@/views/LoginView.vue')
    },
    {
      path: '/',
      component: () => import('@/views/LayoutView.vue'),
      meta: { requiresAuth: true },
      children: [
        {
          path: '',
          name: 'ScenarioHall',
          component: () => import('@/views/ScenarioHallView.vue')
        },
        {
          path: 'chat/:conversationId',
          name: 'Chat',
          component: () => import('@/views/ChatView.vue')
        },
        {
          path: 'review/:conversationId',
          name: 'Review',
          component: () => import('@/views/ReviewView.vue')
        },
        {
          path: 'history',
          name: 'History',
          component: () => import('@/views/HistoryView.vue')
        },
        {
          path: 'scripts',
          name: 'ScriptLibrary',
          component: () => import('@/views/ScriptLibraryView.vue')
        }
      ]
    }
  ]
})

router.beforeEach((to, from, next) => {
  const userStore = useUserStore()
  if (to.meta.requiresAuth && !userStore.token) {
    next('/login')
  } else if (to.path === '/login' && userStore.token) {
    next('/')
  } else {
    next()
  }
})

export default router
