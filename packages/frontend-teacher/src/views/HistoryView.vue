<template>
  <div>
    <h2 class="page-title">练习记录</h2>

    <div class="stats-cards">
      <el-row :gutter="20">
        <el-col :span="6">
          <el-statistic title="累计练习" :value="stats.totalCount" />
        </el-col>
        <el-col :span="6">
          <el-statistic title="平均评分" :value="stats.averageScore" :precision="1" />
        </el-col>
        <el-col :span="6">
          <el-statistic title="最高评分" :value="stats.highestScore" />
        </el-col>
        <el-col :span="6">
          <el-statistic title="覆盖场景" :value="stats.coveredScenarios" />
        </el-col>
      </el-row>
    </div>

    <el-divider />

    <el-table :data="historyList" stripe style="width: 100%" @expand-change="handleExpand">
      <el-table-column type="expand" width="40">
        <template #default="{ row }">
          <div v-if="loadingChat[row.id]" class="chat-summary-loading">
            <el-skeleton :rows="3" animated />
          </div>
          <div v-else-if="chatMessages[row.id]?.length" class="chat-summary">
            <div
              v-for="msg in chatMessages[row.id]"
              :key="msg.id"
              class="summary-msg"
              :class="msg.role === 'TEACHER' ? 'teacher' : 'ai'"
            >
              <span class="msg-role">{{ msg.role === 'TEACHER' ? '教师' : '家长' }}</span>
              <span class="msg-content">{{ msg.content }}</span>
            </div>
          </div>
          <div v-else class="chat-summary-empty">暂无对话内容</div>
        </template>
      </el-table-column>
      <el-table-column prop="scenario.title" label="场景" min-width="180">
        <template #default="{ row }">
          {{ row.scenario?.title || '-' }}
        </template>
      </el-table-column>
      <el-table-column prop="startedAt" label="练习时间" width="160">
        <template #default="{ row }">
          {{ formatDate(row.startedAt) }}
        </template>
      </el-table-column>
      <el-table-column prop="status" label="状态" width="100">
        <template #default="{ row }">
          <el-tag :type="statusType(row.status)">{{ ConversationStatusLabels[row.status] }}</el-tag>
        </template>
      </el-table-column>
      <el-table-column prop="finalScore" label="评分" width="100">
        <template #default="{ row }">
          <span v-if="row.finalScore !== undefined">{{ row.finalScore }}分</span>
          <span v-else class="no-score">--</span>
        </template>
      </el-table-column>
      <el-table-column label="操作" width="180" fixed="right">
        <template #default="{ row }">
          <el-button link type="primary" @click="viewChat(row.id)">回放</el-button>
          <el-button v-if="row.finalScore" link type="success" @click="viewReview(row.id)">点评</el-button>
        </template>
      </el-table-column>
    </el-table>

    <div class="pagination">
      <el-pagination
        v-model:current-page="page"
        v-model:page-size="pageSize"
        :total="total"
        layout="prev, pager, next"
        @change="loadHistory"
      />
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import type { Conversation, TeacherStats, Message } from '@yycl/shared'
import { ConversationStatusLabels, formatDate } from '@yycl/shared'
import { getHistory, getOverview } from '@/api/stats'
import { getConversation } from '@/api/chat'

const router = useRouter()
const historyList = ref<Conversation[]>([])
const stats = ref<TeacherStats>({
  totalCount: 0,
  totalDuration: 0,
  coveredScenarios: 0,
  categoryBreakdown: {} as any,
  averageScore: 0,
  highestScore: 0
})
const page = ref(1)
const pageSize = ref(10)
const total = ref(0)
const chatMessages = ref<Record<number, Message[]>>({})
const loadingChat = ref<Record<number, boolean>>({})

function statusType(status: string) {
  const map: Record<string, any> = {
    COMPLETED: 'success',
    FAILED: 'danger',
    TIMEOUT: 'warning',
    ACTIVE: 'primary'
  }
  return map[status] || 'info'
}

async function loadHistory() {
  try {
    const res = await getHistory({ page: page.value, pageSize: pageSize.value })
    historyList.value = res.list
    total.value = res.total
  } catch {
    historyList.value = []
  }
}

async function loadStats() {
  try {
    const res = await getOverview()
    stats.value = res
  } catch {
    // ignore
  }
}

function viewChat(id: number) {
  router.push(`/chat/${id}`)
}

async function handleExpand(row: Conversation, expandedRows: Conversation[]) {
  if (expandedRows.includes(row) && !chatMessages.value[row.id]) {
    loadingChat.value[row.id] = true
    try {
      const data = await getConversation(row.id)
      chatMessages.value[row.id] = data.messages
    } catch {
      // handled by interceptor
    } finally {
      loadingChat.value[row.id] = false
    }
  }
}

function viewReview(id: number) {
  router.push(`/review/${id}`)
}

onMounted(() => {
  loadHistory()
  loadStats()
})
</script>

<style scoped>
.page-title { font-size: 22px; margin-bottom: 20px; }
.stats-cards { margin-bottom: 20px; }
.no-score { color: #c0c4cc; }
.pagination { margin-top: 20px; display: flex; justify-content: flex-end; }
.chat-summary-loading { padding: 16px; }
.chat-summary { padding: 12px 16px; background: #f5f7fa; border-radius: 8px; }
.chat-summary-empty { padding: 16px; color: #909399; text-align: center; }
.summary-msg { display: flex; gap: 12px; padding: 8px 0; border-bottom: 1px dashed #e4e7ed; }
.summary-msg:last-child { border-bottom: none; }
.summary-msg.teacher { flex-direction: row-reverse; text-align: right; }
.msg-role { flex-shrink: 0; width: 40px; font-size: 12px; color: #909399; font-weight: 500; }
.msg-content { font-size: 14px; color: #303133; line-height: 1.5; word-break: break-word; }
.summary-msg.teacher .msg-content { color: #409eff; }
</style>
