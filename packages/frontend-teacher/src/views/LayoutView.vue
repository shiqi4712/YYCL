<template>
  <el-container class="layout">
    <el-aside width="220px" class="sidebar">
      <div class="logo">
        <el-icon size="28" color="#fff"><ChatDotRound /></el-icon>
        <span>模拟训练</span>
      </div>
      <el-menu
        :default-active="$route.path"
        router
        background-color="#304156"
        text-color="#bfcbd9"
        active-text-color="#409EFF"
      >
        <el-menu-item index="/">
          <el-icon><Grid /></el-icon>
          <span>场景大厅</span>
        </el-menu-item>
        <el-menu-item index="/history">
          <el-icon><Clock /></el-icon>
          <span>练习记录</span>
        </el-menu-item>
        <el-menu-item index="/scripts">
          <el-icon><Document /></el-icon>
          <span>大神话术</span>
        </el-menu-item>
      </el-menu>
    </el-aside>
    <el-container>
      <el-header class="header">
        <div class="header-right">
          <span class="user-name">{{ userStore.user?.realName || userStore.user?.username }}</span>
          <el-button type="danger" link @click="handleLogout">退出</el-button>
        </div>
      </el-header>
      <el-main class="main">
        <router-view />
      </el-main>
    </el-container>
  </el-container>
</template>

<script setup lang="ts">
import { useRouter } from 'vue-router'
import { useUserStore } from '@/stores/user'

const router = useRouter()
const userStore = useUserStore()

function handleLogout() {
  userStore.logout()
  router.push('/login')
}
</script>

<style scoped>
.layout {
  height: 100vh;
}
.sidebar {
  background-color: #304156;
}
.logo {
  height: 60px;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 10px;
  color: #fff;
  font-size: 18px;
  font-weight: bold;
  border-bottom: 1px solid #1f2d3d;
}
.header {
  background: #fff;
  box-shadow: 0 1px 4px rgba(0,0,0,0.08);
  display: flex;
  align-items: center;
  justify-content: flex-end;
}
.header-right {
  display: flex;
  align-items: center;
  gap: 16px;
}
.user-name {
  color: #606266;
  font-size: 14px;
}
.main {
  background: #f5f7fa;
  padding: 20px;
  overflow-y: auto;
}
</style>
