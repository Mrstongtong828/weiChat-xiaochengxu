<template>
  <div ref="chartEl" class="line-chart"></div>
</template>

<script setup>
// 按需引入 echarts：折线图 + 网格/提示/图例 + Canvas 渲染器
import { ref, onMounted, onBeforeUnmount, watch, nextTick } from 'vue'
import * as echarts from 'echarts/core'
import { LineChart as ELineChart } from 'echarts/charts'
import { GridComponent, TooltipComponent, LegendComponent } from 'echarts/components'
import { CanvasRenderer } from 'echarts/renderers'

echarts.use([ELineChart, GridComponent, TooltipComponent, LegendComponent, CanvasRenderer])

const props = defineProps({
  // X 轴刻度：['07-01', '07-02', ...]
  categories: { type: Array, default: () => [] },
  // 多条曲线：[{ name, data:[..], color }]
  series: { type: Array, default: () => [] }
})

const chartEl = ref(null)
let chart = null

const buildOption = () => ({
  tooltip: { trigger: 'axis' },
  legend: {
    top: 0, left: 'center', itemWidth: 12, itemHeight: 8, itemGap: 18,
    textStyle: { fontSize: 12, color: '#536783' }
  },
  grid: { left: 40, right: 20, top: 40, bottom: 28 },
  xAxis: {
    type: 'category',
    boundaryGap: false,
    data: props.categories || [],
    axisLine: { lineStyle: { color: '#e2e8f0' } },
    axisLabel: { color: '#98a2b3', fontSize: 11 }
  },
  yAxis: {
    type: 'value',
    minInterval: 1,
    splitLine: { lineStyle: { color: '#eef2f7' } },
    axisLabel: { color: '#98a2b3', fontSize: 11 }
  },
  series: (props.series || []).map(s => ({
    name: s.name,
    type: 'line',
    smooth: true,
    symbol: 'circle',
    symbolSize: 6,
    showSymbol: (props.categories || []).length <= 14,
    data: s.data || [],
    lineStyle: { width: 3, color: s.color },
    itemStyle: { color: s.color },
    areaStyle: s.area ? { color: s.color, opacity: 0.08 } : undefined
  }))
})

const render = () => { if (chart) chart.setOption(buildOption(), true) }
const resize = () => { if (chart) chart.resize() }

onMounted(async () => {
  await nextTick()
  if (!chartEl.value) return
  chart = echarts.init(chartEl.value)
  render()
  window.addEventListener('resize', resize)
})

onBeforeUnmount(() => {
  window.removeEventListener('resize', resize)
  if (chart) { chart.dispose(); chart = null }
})

watch(() => [props.categories, props.series], render, { deep: true })
</script>

<style scoped>
.line-chart { width: 100%; height: 300px; }
</style>
