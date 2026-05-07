<template>
  <div>
    <div class="page-header">
      <h2>教师账号管理</h2>
      <el-button type="primary" @click="dialogVisible = true">+ 新建教师账号</el-button>
    </div>

    <el-table :data="teachers" stripe v-loading="loading">
      <el-table-column prop="username" label="用户名" />
      <el-table-column prop="realName" label="姓名" />
      <el-table-column prop="status" label="状态" width="100">
        <template #default="{ row }">
          <el-tag :type="row.status === 'ACTIVE' ? 'success' : 'danger'">{{ row.status === 'ACTIVE' ? '正常' : '禁用' }}</el-tag>
        </template>
      </el-table-column>
      <el-table-column prop="createdAt" label="创建时间" width="180">
        <template #default="{ row }">{{ formatDate(row.createdAt) }}</template>
      </el-table-column>
      <el-table-column label="操作" width="120">
        <template #default="{ row }">
          <el-button
            :type="row.status === 'ACTIVE' ? 'danger' : 'success'"
            link
            @click="toggleStatus(row)"
          >
            {{ row.status === 'ACTIVE' ? '禁用' : '启用' }}
          </el-button>
        </template>
      </el-table-column>
    </el-table>

    <el-dialog v-model="dialogVisible" title="新建教师账号" width="400px">
      <el-form :model="form" :rules="formRules" ref="formRef" label-width="80px">
        <el-form-item label="用户名" prop="username">
          <el-input v-model="form.username" placeholder="请输入用户名" />
        </el-form-item>
        <el-form-item label="密码" prop="password">
          <el-input v-model="form.password" type="password" placeholder="请输入初始密码" />
        </el-form-item>
        <el-form-item label="姓名">
          <el-input v-model="form.realName" placeholder="请输入真实姓名" />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="dialogVisible = false">取消</el-button>
        <el-button type="primary" @click="submitCreate">确认</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { ElMessage } from 'element-plus'
import { formatDate } from '@yycl/shared'
import { getTeachers, createTeacher, updateTeacherStatus } from '@/api/user'

const teachers = ref([])
const loading = ref(false)
const dialogVisible = ref(false)
const formRef = ref()
const form = ref({ username: '', password: '', realName: '' })
const formRules = {
  username: [{ required: true, message: '请输入用户名', trigger: 'blur' }],
  password: [{ required: true, message: '请输入密码', trigger: 'blur' }]
}

async function loadTeachers() {
  loading.value = true
  try {
    teachers.value = await getTeachers()
  } finally {
    loading.value = false
  }
}

async function submitCreate() {
  const valid = await formRef.value?.validate().catch(() => false)
  if (!valid) return
  try {
    await createTeacher(form.value)
    ElMessage.success('创建成功')
    dialogVisible.value = false
    form.value = { username: '', password: '', realName: '' }
    loadTeachers()
  } catch {
    // handled
  }
}

async function toggleStatus(row: any) {
  const newStatus = row.status === 'ACTIVE' ? 'DISABLED' : 'ACTIVE'
  try {
    await updateTeacherStatus(row.id, newStatus)
    ElMessage.success('操作成功')
    loadTeachers()
  } catch {
    // handled
  }
}

onMounted(loadTeachers)
</script>

<style scoped>
.page-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 20px;
}
</style>