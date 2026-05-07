<template>
  <div>
    <h2>数据看板</h2>
    <p style="color: #909399; margin-bottom: 20px;">团队练习数据总览（演示数据）</p>

    <el-row :gutter="20" style="margin-bottom: 20px">
      <el-col :span="6">
        <el-card>
          <el-statistic title="教师总数" :value="12" />
        </el-card>
      </el-col>
      <el-col :span="6">
        <el-card>
          <el-statistic title="本周练习次数" :value="86" />
        </el-card>
      </el-col>
      <el-col :span="6">
        <el-card>
          <el-statistic title="人均评分" :value="72.5" :precision="1" />
        </el-card>
      </el-col>
      <el-col :span="6">
        <el-card>
          <el-statistic title="活跃教师" :value="8" />
        </el-card>
      </el-col>
    </el-row>

    <el-card title="练习热度分布">
      <div ref="chartRef" style="height: 300px"></div>
    </el-card>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue'
import * as echarts from 'echarts'

const chartRef = ref<HTMLDivElement>()

onMounted(() => {
  if (!chartRef.value) return
  const chart = echarts.init(chartRef.value)
  chart.setOption({
    tooltip: { trigger: 'item' },
    legend: { bottom: '0%' },
    series: [
      {
        type: 'pie',
        radius: ['40%', '70%'],
        avoidLabelOverlap: false,
        itemStyle: { borderRadius: 10, borderColor: '#fff', borderWidth: 2 },
        label: { show: false, position: 'center' },
        emphasis: { label: { show: true, fontSize: 18, fontWeight: 'bold' } },
        data: [
          { value: 35, name: '价格异议' },
          { value: 28, name: '效果异议' },
          { value: 15, name: '时间异议' },
          { value: 12, name: '决策异议' },
          { value: 10, name: '信任异议' }
        ]
      }
    ]
  })
})
</script>