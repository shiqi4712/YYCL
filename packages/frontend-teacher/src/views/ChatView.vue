<template>
  <div class="chat-page">
    <div class="chat-header">
      <el-button link @click="$router.back()"><Back /> 返回大厅</el-button>
      <span class="chat-title">{{ scenario?.title || '模拟对话' }}</span>
      <el-button type="danger" plain size="small" @click="endChat">结束对话</el-button>
    </div>

    <div class="chat-messages" ref="msgContainer">
      <div
        v-for="msg in messages"
        :key="msg.id"
        class="message-row"
        :class="msg.role === 'TEACHER' ? 'teacher' : 'ai'"
      >
        <div class="message-bubble">
          <div class="message-role">{{ msg.role === 'TEACHER' ? '我' : '家长' }}</div>
          <div class="message-content">{{ msg.content }}</div>
          <div class="message-time">{{ formatTime(msg.createdAt) }}</div>
        </div>
      </div>
      <div v-if="aiLoading" class="message-row ai">
        <div class="message-bubble">
          <el-skeleton :rows="2" animated />
        </div>
      </div>
    </div>

    <div class="chat-input-area">
      <el-alert
        v-if="scenario?.recommendedScripts?.length"
        :title="`推荐话术：${recommendedScriptTitles}`"
        type="info"
        :closable="false"
        style="margin-bottom: 12px"
      />
      <div class="input-row">
        <el-input
          v-model="inputText"
          type="textarea"
          :rows="2"
          placeholder="输入回复..."
          @keyup.enter.exact.prevent="sendText"
          :disabled="aiLoading"
        />
        <div class="input-actions">
          <el-button
            type="primary"
            circle
            :icon="Microphone"
            :loading="voiceListening"
            @click="toggleVoice"
            title="语音输入"
          />
          <el-button type="primary" :icon="Promotion" :loading="aiLoading" @click="sendText">发送</el-button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, nextTick, computed } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { ElMessage, ElMessageBox } from 'element-plus'
import { Back, Promotion, Microphone } from '@element-plus/icons-vue'
import type { Scenario, Message } from '@yycl/shared'
import { sendMessage, getConversation, endConversation } from '@/api/chat'
import { getScenario } from '@/api/scenario'

const route = useRoute()
const router = useRouter()
const conversationId = Number(route.params.conversationId)

const scenario = ref<Scenario | null>(null)
const messages = ref<Message[]>([])
const inputText = ref('')
const aiLoading = ref(false)
const msgContainer = ref<HTMLDivElement>()
const voiceListening = ref(false)

let recognition: any = null

const recommendedScriptTitles = computed(() => {
  // mock: 实际应从话术库接口获取标题
  return scenario.value?.recommendedScripts?.join(', ') || ''
})

async function loadChat() {
  try {
    const conv = await getConversation(conversationId)
    messages.value = conv.messages
    if (messages.value.length > 0 && messages.value[0].conversationId) {
      // load scenario detail
    }
    scrollBottom()
  } catch {
    ElMessage.error('加载对话失败')
  }
}

async function sendText() {
  const text = inputText.value.trim()
  if (!text || aiLoading.value) return
  inputText.value = ''
  aiLoading.value = true
  try {
    const msg = await sendMessage(conversationId, text)
    messages.value.push(msg)
    scrollBottom()
  } catch {
    // handled by interceptor
  } finally {
    aiLoading.value = false
  }
}

async function endChat() {
  try {
    await ElMessageBox.confirm('确定要结束当前对话吗？', '提示', { type: 'warning' })
    const conv = await endConversation(conversationId)
    ElMessage.success('对话已结束')
    router.push(`/review/${conv.id}`)
  } catch {
    // cancelled
  }
}

function scrollBottom() {
  nextTick(() => {
    msgContainer.value && (msgContainer.value.scrollTop = msgContainer.value.scrollHeight)
  })
}

function formatTime(iso: string) {
  const d = new Date(iso)
  return `${d.getHours()}:${String(d.getMinutes()).padStart(2, '0')}`
}

function toggleVoice() {
  if (!('webkitSpeechRecognition' in window || 'SpeechRecognition' in window)) {
    ElMessage.warning('当前浏览器不支持语音输入')
    return
  }
  if (voiceListening.value) {
    recognition?.stop()
    voiceListening.value = false
    return
  }
  const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition
  recognition = new SpeechRecognition()
  recognition.lang = 'zh-CN'
  recognition.continuous = false
  recognition.interimResults = false
  recognition.onstart = () => { voiceListening.value = true }
  recognition.onend = () => { voiceListening.value = false }
  recognition.onresult = (event: any) => {
    const transcript = event.results[0][0].transcript
    inputText.value += transcript
  }
  recognition.onerror = () => {
    voiceListening.value = false
    ElMessage.error('语音识别失败')
  }
  recognition.start()
}

onMounted(async () => {
  await loadChat()
  // 尝试加载场景信息（若接口支持从 conversation 反查 scenario）
  try {
    const firstMsg = messages.value.find(m => m.role === 'AI')
    if (firstMsg) {
      // 这里假设场景信息需要单独获取，实际可优化
    }
  } catch {}
})
</script>

<style scoped>
.chat-page {
  display: flex;
  flex-direction: column;
  height: calc(100vh - 100px);
  background: #fff;
  border-radius: 8px;
  overflow: hidden;
}
.chat-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 12px 20px;
  border-bottom: 1px solid #e4e7ed;
}
.chat-title {
  font-weight: bold;
  font-size: 16px;
}
.chat-messages {
  flex: 1;
  overflow-y: auto;
  padding: 20px;
  background: #f5f7fa;
}
.message-row {
  display: flex;
  margin-bottom: 16px;
}
.message-row.teacher {
  justify-content: flex-end;
}
.message-bubble {
  max-width: 70%;
  padding: 12px 16px;
  border-radius: 12px;
  background: #fff;
  box-shadow: 0 1px 4px rgba(0,0,0,0.06);
}
.message-row.teacher .message-bubble {
  background: #409eff;
  color: #fff;
}
.message-role {
  font-size: 12px;
  color: #909399;
  margin-bottom: 4px;
}
.message-row.teacher .message-role {
  color: #e6f2ff;
}
.message-content {
  font-size: 14px;
  line-height: 1.6;
  word-break: break-word;
}
.message-time {
  font-size: 11px;
  color: #c0c4cc;
  margin-top: 4px;
  text-align: right;
}
.message-row.teacher .message-time {
  color: #b3d8ff;
}
.chat-input-area {
  padding: 16px 20px;
  border-top: 1px solid #e4e7ed;
  background: #fff;
}
.input-row {
  display: flex;
  gap: 12px;
  align-items: flex-end;
}
.input-row .el-textarea {
  flex: 1;
}
.input-actions {
  display: flex;
  gap: 8px;
}
</style>
