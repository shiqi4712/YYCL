<template>
  <div>
    <h2 class="page-title">大神话术库</h2>
    <p class="page-desc">学习销冠应对各类异议的标准话术，支持收藏常用话术</p>

    <div class="filters">
      <el-input
        v-model="keyword"
        placeholder="搜索话术关键词"
        clearable
        style="width: 240px"
        @change="loadScripts"
      >
        <template #prefix><Search /></template>
      </el-input>
      <el-select v-model="filterCategory" placeholder="异议分类" clearable style="width: 160px" @change="loadScripts">
        <el-option
          v-for="(label, key) in ObjectionCategoryLabels"
          :key="key"
          :label="label"
          :value="key"
        />
      </el-select>
      <el-radio-group v-model="showMode" @change="onModeChange">
        <el-radio-button label="all">全部话术</el-radio-button>
        <el-radio-button label="favorites">我的收藏</el-radio-button>
      </el-radio-group>
    </div>

    <el-empty v-if="scripts.length === 0" description="暂无话术" />

    <el-collapse v-model="activeNames" v-else>
      <el-collapse-item v-for="s in scripts" :key="s.id" :name="String(s.id)">
        <template #title>
          <div class="script-title-row">
            <span>{{ s.title }}</span>
            <el-tag size="small" type="info">{{ ObjectionCategoryLabels[s.category] }}</el-tag>
          </div>
        </template>

        <div class="script-content">
          <div class="script-section">
            <label>参考话术</label>
            <div class="script-text">{{ s.content }}</div>
          </div>
          <div class="script-section">
            <label>要点拆解</label>
            <div class="script-keypoints">{{ s.keyPoints }}</div>
          </div>
          <div class="script-actions">
            <el-button
              v-if="s.isFavorited"
              type="warning"
              link
              :icon="StarFilled"
              @click.stop="unfavorite(s.id)"
            >
              已收藏
            </el-button>
            <el-button v-else type="primary" link :icon="Star" @click.stop="favorite(s.id)">收藏</el-button>
          </div>
        </div>
      </el-collapse-item>
    </el-collapse>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { ElMessage } from 'element-plus'
import { Search, Star, StarFilled } from '@element-plus/icons-vue'
import type { Script } from '@yycl/shared'
import { ObjectionCategoryLabels } from '@yycl/shared'
import { getScripts, favoriteScript, unfavoriteScript, getFavorites } from '@/api/script'

const scripts = ref<Script[]>([])
const keyword = ref('')
const filterCategory = ref('')
const showMode = ref('all')
const activeNames = ref<string[]>([])

async function loadScripts() {
  try {
    if (showMode.value === 'favorites') {
      scripts.value = await getFavorites()
    } else {
      scripts.value = await getScripts({
        keyword: keyword.value || undefined,
        category: filterCategory.value || undefined
      })
    }
  } catch {
    scripts.value = []
  }
}

function onModeChange() {
  loadScripts()
}

async function favorite(id: number) {
  try {
    await favoriteScript(id)
    const item = scripts.value.find(s => s.id === id)
    if (item) item.isFavorited = true
    ElMessage.success('收藏成功')
  } catch {
    // handled
  }
}

async function unfavorite(id: number) {
  try {
    await unfavoriteScript(id)
    const item = scripts.value.find(s => s.id === id)
    if (item) item.isFavorited = false
    if (showMode.value === 'favorites') {
      scripts.value = scripts.value.filter(s => s.id !== id)
    }
    ElMessage.success('取消收藏')
  } catch {
    // handled
  }
}

onMounted(loadScripts)
</script>

<style scoped>
.page-title { font-size: 22px; margin-bottom: 4px; }
.page-desc { color: #909399; font-size: 14px; margin-bottom: 20px; }
.filters { display: flex; gap: 12px; margin-bottom: 20px; align-items: center; }
.script-title-row {
  display: flex;
  align-items: center;
  gap: 10px;
  font-weight: 500;
}
.script-content { padding: 8px 0; }
.script-section { margin-bottom: 16px; }
.script-section label {
  display: block;
  font-size: 13px;
  color: #909399;
  margin-bottom: 6px;
}
.script-text {
  background: #f5f7fa;
  padding: 12px;
  border-radius: 6px;
  font-size: 14px;
  line-height: 1.6;
  color: #303133;
}
.script-keypoints {
  font-size: 13px;
  color: #606266;
  line-height: 1.6;
}
.script-actions { text-align: right; }
</style>
