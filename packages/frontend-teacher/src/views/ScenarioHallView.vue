<template>
  <div>
    <h2 class="page-title">场景大厅</h2>
    <p class="page-desc">选择一个训练场景，开始与 AI 家长进行异议处理模拟对话</p>

    <div class="filters">
      <el-select v-model="filterCategory" placeholder="异议分类" clearable style="width: 160px">
        <el-option
          v-for="(label, key) in ObjectionCategoryLabels"
          :key="key"
          :label="label"
          :value="key"
        />
      </el-select>
      <el-select v-model="filterDifficulty" placeholder="难度" clearable style="width: 140px">
        <el-option
          v-for="(label, key) in DifficultyLabels"
          :key="key"
          :label="label"
          :value="key"
        />
      </el-select>
    </div>

    <el-row :gutter="20">
      <el-col :xs="24" :sm="12" :md="8" :lg="6" v-for="s in filteredScenarios" :key="s.id">
        <el-card class="scenario-card" shadow="hover">
          <div class="scenario-header">
            <el-tag :type="difficultyType(s.difficulty)" size="small">{{ DifficultyLabels[s.difficulty] }}</el-tag>
            <el-tag type="info" size="small">{{ ObjectionCategoryLabels[s.category] }}</el-tag>
          </div>
          <h3 class="scenario-title">{{ s.title }}</h3>
          <p class="scenario-profile">{{ s.parentProfile }}</p>
          <div class="scenario-footer">
            <el-button type="primary" @click="startChat(s.id)">开始练习</el-button>
          </div>
        </el-card>
      </el-col>
    </el-row>

    <el-empty v-if="filteredScenarios.length === 0" description="暂无匹配场景" />
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { ElMessage } from 'element-plus'
import type { Scenario } from '@yycl/shared'
import { ObjectionCategoryLabels, DifficultyLabels } from '@yycl/shared'
import { getScenarios } from '@/api/scenario'
import { createSession } from '@/api/chat'

const router = useRouter()
const scenarios = ref<Scenario[]>([])
const filterCategory = ref('')
const filterDifficulty = ref('')

const filteredScenarios = computed(() => {
  return scenarios.value.filter(s => {
    const matchCategory = !filterCategory.value || s.category === filterCategory.value
    const matchDifficulty = !filterDifficulty.value || s.difficulty === filterDifficulty.value
    return matchCategory && matchDifficulty
  })
})

function difficultyType(d: string) {
  const map: Record<string, any> = { EASY: 'success', MEDIUM: 'warning', HARD: 'danger' }
  return map[d] || 'info'
}

async function loadScenarios() {
  try {
    scenarios.value = await getScenarios()
  } catch {
    scenarios.value = []
  }
}

async function startChat(scenarioId: number) {
  try {
    const res = await createSession(scenarioId)
    router.push(`/chat/${res.sessionId}`)
  } catch {
    ElMessage.error('创建对话失败')
  }
}

onMounted(loadScenarios)
</script>

<style scoped>
.page-title { font-size: 22px; margin-bottom: 4px; }
.page-desc { color: #909399; font-size: 14px; margin-bottom: 20px; }
.filters { display: flex; gap: 12px; margin-bottom: 20px; }
.scenario-card { margin-bottom: 20px; }
.scenario-header { display: flex; gap: 8px; margin-bottom: 12px; }
.scenario-title { font-size: 16px; margin-bottom: 8px; color: #303133; }
.scenario-profile {
  color: #606266;
  font-size: 13px;
  line-height: 1.6;
  height: 60px;
  overflow: hidden;
  text-overflow: ellipsis;
  display: -webkit-box;
  -webkit-line-clamp: 3;
  -webkit-box-orient: vertical;
  margin-bottom: 12px;
}
.scenario-footer { text-align: right; }
</style>
