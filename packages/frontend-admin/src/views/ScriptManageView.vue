<template>
  <div>
    <div class="page-header">
      <h2>话术库管理</h2>
      <el-button type="primary" @click="openDialog()">+ 新增话术</el-button>
    </div>

    <el-table :data="scripts" stripe v-loading="loading">
      <el-table-column prop="title" label="话术标题" min-width="180" />
      <el-table-column prop="category" label="分类" width="120">
        <template #default="{ row }">{{ ObjectionCategoryLabels[row.category] }}</template>
      </el-table-column>
      <el-table-column prop="content" label="参考话术" min-width="300" show-overflow-tooltip />
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

    <el-dialog v-model="dialogVisible" :title="isEdit ? '编辑话术' : '新增话术'" width="600px">
      <el-form :model="form" :rules="formRules" ref="formRef" label-width="100px">
        <el-form-item label="话术标题" prop="title">
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
        <el-form-item label="参考话术" prop="content">
          <el-input v-model="form.content" type="textarea" :rows="4" />
        </el-form-item>
        <el-form-item label="要点拆解" prop="keyPoints">
          <el-input v-model="form.keyPoints" type="textarea" :rows="3" />
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
import { ObjectionCategoryLabels } from '@yycl/shared'
import { getScripts, createScript, updateScript, deleteScript, updateScriptStatus } from '@/api/script'

const scripts = ref([])
const loading = ref(false)
const dialogVisible = ref(false)
const isEdit = ref(false)
const formRef = ref()
const form = ref({
  id: undefined as number | undefined,
  title: '',
  category: '',
  content: '',
  keyPoints: ''
})
const formRules = {
  title: [{ required: true, message: '请输入话术标题', trigger: 'blur' }],
  category: [{ required: true, message: '请选择分类', trigger: 'change' }],
  content: [{ required: true, message: '请输入参考话术', trigger: 'blur' }]
}

async function loadScripts() {
  loading.value = true
  try {
    scripts.value = await getScripts({})
  } finally {
    loading.value = false
  }
}

function openDialog(row?: any) {
  isEdit.value = !!row
  if (row) {
    form.value = { ...row }
  } else {
    form.value = { id: undefined, title: '', category: '', content: '', keyPoints: '' }
  }
  dialogVisible.value = true
}

async function submitForm() {
  const valid = await formRef.value?.validate().catch(() => false)
  if (!valid) return
  try {
    if (isEdit.value && form.value.id) {
      await updateScript(form.value.id, form.value)
    } else {
      await createScript(form.value)
    }
    ElMessage.success('保存成功')
    dialogVisible.value = false
    loadScripts()
  } catch {
    // handled
  }
}

async function toggleStatus(row: any) {
  const newStatus = row.status === 'ACTIVE' ? 'INACTIVE' : 'ACTIVE'
  try {
    await updateScriptStatus(row.id, newStatus)
    ElMessage.success('操作成功')
    loadScripts()
  } catch {
    // handled
  }
}

async function handleDelete(id: number) {
  try {
    await ElMessageBox.confirm('确定删除该话术吗？', '提示', { type: 'warning' })
    await deleteScript(id)
    ElMessage.success('删除成功')
    loadScripts()
  } catch {
    // cancelled
  }
}

onMounted(loadScripts)
</script>

<style scoped>
.page-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 20px;
}
</style>