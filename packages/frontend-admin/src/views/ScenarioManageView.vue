<template>
  <div>
    <div class="page-header">
      <h2>场景管理</h2>
      <el-button type="primary" @click="openDialog()">+ 新建场景</el-button>
    </div>

    <el-table :data="scenarios" stripe v-loading="loading">
      <el-table-column prop="title" label="场景名称" min-width="180" />
      <el-table-column prop="category" label="分类" width="120">
        <template #default="{ row }">{{ ObjectionCategoryLabels[row.category] }}</template>
      </el-table-column>
      <el-table-column prop="difficulty" label="难度" width="100">
        <template #default="{ row }">{{ DifficultyLabels[row.difficulty] }}</template>
      </el-table-column>
      <el-table-column prop="status" label="状态" width="100">
        <template #default="{ row }">
          <el-tag :type="row.status === 'ACTIVE' ? 'success' : 'info'">{{ row.status === 'ACTIVE' ? '已上线' : '已下线' }}</el-tag>
        </template>
      </el-table-column>
      <el-table-column label="操作" width="200">
        <template #default="{ row }">
          <el-button link type="primary" @click="openDialog(row)">编辑</el-button>
          <el-button link @click="toggleStatus(row)">{{ row.status === 'ACTIVE' ? '下线' : '上线' }}</el-button>
          <el-button link type="danger" @click="handleDelete(row.id)">删除</el-button>
        </template>
      </el-table-column>
    </el-table>

    <el-dialog v-model="dialogVisible" :title="isEdit ? '编辑场景' : '新建场景'" width="600px">
      <el-form :model="form" :rules="formRules" ref="formRef" label-width="100px">
        <el-form-item label="场景名称" prop="title">
          <el-input v-model="form.title" />
        </el-form-item>
        <el-form-item label="异议分类" prop="category">
          <el-select v-model="form.category">
            <el-option
              v-for="(label, key) in ObjectionCategoryLabels"
              :key="key"
              :label="label"
              :value="key"
            />
          </el-select>
        </el-form-item>
        <el-form-item label="难度" prop="difficulty">
          <el-select v-model="form.difficulty">
            <el-option
              v-for="(label, key) in DifficultyLabels"
              :key="key"
              :label="label"
              :value="key"
            />
          </el-select>
        </el-form-item>
        <el-form-item label="家长画像" prop="parentProfile">
          <el-input v-model="form.parentProfile" type="textarea" :rows="3" />
        </el-form-item>
        <el-form-item label="初始话术" prop="initialMessage">
          <el-input v-model="form.initialMessage" type="textarea" :rows="2" />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="dialogVisible = false">取消</el-button>
        <el-button type="primary" @click="submitForm">保存</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { ObjectionCategoryLabels, DifficultyLabels } from '@yycl/shared'
import { getScenarios, createScenario, updateScenario, deleteScenario, updateScenarioStatus } from '@/api/scenario'

const scenarios = ref([])
const loading = ref(false)
const dialogVisible = ref(false)
const isEdit = ref(false)
const formRef = ref()
const form = ref({
  id: undefined as number | undefined,
  title: '',
  category: '',
  difficulty: '',
  parentProfile: '',
  initialMessage: ''
})
const formRules = {
  title: [{ required: true, message: '请输入场景名称', trigger: 'blur' }],
  category: [{ required: true, message: '请选择分类', trigger: 'change' }],
  difficulty: [{ required: true, message: '请选择难度', trigger: 'change' }],
  parentProfile: [{ required: true, message: '请输入家长画像', trigger: 'blur' }],
  initialMessage: [{ required: true, message: '请输入初始话术', trigger: 'blur' }]
}

async function loadScenarios() {
  loading.value = true
  try {
    scenarios.value = await getScenarios({})
  } finally {
    loading.value = false
  }
}

function openDialog(row?: any) {
  isEdit.value = !!row
  if (row) {
    form.value = { ...row }
  } else {
    form.value = { id: undefined, title: '', category: '', difficulty: '', parentProfile: '', initialMessage: '' }
  }
  dialogVisible.value = true
}

async function submitForm() {
  const valid = await formRef.value?.validate().catch(() => false)
  if (!valid) return
  try {
    if (isEdit.value && form.value.id) {
      await updateScenario(form.value.id, form.value)
    } else {
      await createScenario(form.value)
    }
    ElMessage.success('保存成功')
    dialogVisible.value = false
    loadScenarios()
  } catch {
    // handled
  }
}

async function toggleStatus(row: any) {
  const newStatus = row.status === 'ACTIVE' ? 'INACTIVE' : 'ACTIVE'
  try {
    await updateScenarioStatus(row.id, newStatus)
    ElMessage.success('操作成功')
    loadScenarios()
  } catch {
    // handled
  }
}

async function handleDelete(id: number) {
  try {
    await ElMessageBox.confirm('确定删除该场景吗？', '提示', { type: 'warning' })
    await deleteScenario(id)
    ElMessage.success('删除成功')
    loadScenarios()
  } catch {
    // cancelled
  }
}

onMounted(loadScenarios)
</script>

<style scoped>
.page-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 20px;
}
</style>