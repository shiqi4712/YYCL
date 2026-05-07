<template>
  <div class="review-page">
    <div class="review-header">
      <el-button link @click="$router.push('/history')"><Back /> 返回记录</el-button>
      <span>AI 点评报告</span>
    </div>

    <el-empty v-if="loading" description="点评生成中...">
      <template #image>
        <el-icon size="48" color="#409EFF"><Loading /></el-icon>
      </template>
    </el-empty>

    <template v-else-if="review">
      <div class="score-section">
        <div class="overall-score">
          <div class="score-number">{{ review.overallScore }}</div>
          <el-rate v-model="review.overallStar" disabled show-score text-color="#ff9900" />
          <p class="score-label">总体评分</p>
        </div>
      </div>

      <el-divider />

      <h3>维度评分</h3>
      <el-row :gutter="16" style="margin-top: 12px">
        <el-col :span="12" v-for="(dim, key) in review.dimensions" :key="key">
          <el-card class="dim-card" shadow="never">
            <div class="dim-header">
              <span>{{ ReviewDimensionLabels[key] }}</span>
              <el-tag :type="dim.score >= 80 ? 'success' : dim.score >= 60 ? 'warning' : 'danger'">
                {{ dim.score }}分
              </el-tag>
            </div>
            <p class="dim-comment">{{ dim.comment }}</p>
          </el-card>
        </el-col>
      </el-row>

      <el-divider />

      <h3>改进建议</h3>
      <el-timeline style="margin-top: 12px">
        <el-timeline-item
          v-for="(suggestion, idx) in review.suggestions"
          :key="idx"
          :icon="InfoFilled"
          type="primary"
        >
          {{ suggestion }}
        </el-timeline-item>
      </el-timeline>

      <el-divider />

      <div class="feedback-actions">
        <span>这份点评对您有帮助吗？</span>
        <el-button link :icon="CircleCheck" @click="submitFeedback('helpful')">有帮助</el-button>
        <el-button link :icon="CircleClose" @click="submitFeedback('inaccurate')">不准确</el-button>
      </div>

      <div style="text-align: center; margin-top: 24px">
        <el-button type="primary" size="large" @click="$router.push('/')">继续练习</el-button>
      </div>
    </template>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { useRoute } from 'vue-router'
import { ElMessage } from 'element-plus'
import { Back, Loading, InfoFilled, CircleCheck, CircleClose } from '@element-plus/icons-vue'
import type { AIReview } from '@yycl/shared'
import { ReviewDimensionLabels } from '@yycl/shared'
import { getReview, submitReviewFeedback } from '@/api/chat'

const route = useRoute()
const conversationId = Number(route.params.conversationId)

const review = ref<AIReview | null>(null)
const loading = ref(true)

async function loadReview() {
  try {
    loading.value = true
    const data = await getReview(conversationId)
    review.value = data
  } catch {
    // handled by interceptor
  } finally {
    loading.value = false
  }
}

async function submitFeedback(feedback: 'helpful' | 'inaccurate') {
  try {
    await submitReviewFeedback(conversationId, feedback)
    ElMessage.success('反馈已提交')
  } catch {
    // handled
  }
}

onMounted(loadReview)
</script>

<style scoped>
.review-page {
  max-width: 800px;
  margin: 0 auto;
  background: #fff;
  padding: 24px;
  border-radius: 8px;
}
.review-header {
  display: flex;
  align-items: center;
  gap: 12px;
  margin-bottom: 20px;
  font-weight: bold;
}
.score-section {
  text-align: center;
  padding: 20px 0;
}
.overall-score .score-number {
  font-size: 56px;
  font-weight: bold;
  color: #409eff;
  line-height: 1;
}
.score-label {
  color: #909399;
  margin-top: 8px;
}
.dim-card {
  margin-bottom: 12px;
}
.dim-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 8px;
  font-weight: 500;
}
.dim-comment {
  color: #606266;
  font-size: 13px;
  line-height: 1.5;
}
.feedback-actions {
  display: flex;
  align-items: center;
  gap: 12px;
  color: #606266;
}
</style>
