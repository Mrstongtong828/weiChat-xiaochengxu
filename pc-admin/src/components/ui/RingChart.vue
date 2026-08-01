<template>
  <div class="ring-chart">
    <div ref="chartEl" class="ring-canvas"></div>
    <div v-if="centerLabel || centerValue" class="ring-center" :style="{ top: showLegend ? '44%' : '50%' }">
      <div class="ring-center-value" :style="centerValueStyle">{{ centerValue }}</div>
      <div v-if="centerLabel" class="ring-center-label">{{ centerLabel }}</div>
    </div>
  </div>
</template>

<script setup>
// 按需引入 echarts：只打包饼图 + Canvas 渲染器 + 需要的组件，控制体积
import { ref, computed, onMounted, onBeforeUnmount, watch, nextTick } from 'vue'
import * as echarts from 'echarts/core'
import { PieChart } from 'echarts/charts'
import { TooltipComponent, LegendComponent } from 'echarts/components'
import { CanvasRenderer } from 'echarts/renderers'

echarts.use([PieChart, TooltipComponent, LegendComponent, CanvasRenderer])

const props = defineProps({
  // [{ name, value, color }]
  data: { type: Array, default: () => [] },
  // 环中心显示的大数字与说明
  centerValue: { type: [String, Number], default: '' },
  centerLabel: { type: String, default: '' },
  centerColor: { type: String, default: '' },
  // 环的粗细：['62%','86%'] 内外半径
  radius: { type: Array, default: () => ['62%', '86%'] },
  showLegend: { type: Boolean, default: true }
})

const chartEl = ref(null)
let chart = null

const centerValueStyle = computed(() => (props.centerColor ? { color: props.centerColor } : {}))

const buildOption = () => ({
  tooltip: {
    trigger: 'item',
    formatter: '{b}: {c} ({d}%)'
  },
  legend: props.showLegend
    ? { bottom: 0, left: 'center', itemWidth: 10, itemHeight: 10, itemGap: 14, textStyle: { fontSize: 12, color: '#536783' } }
    : { show: false },
  series: [
    {
      type: 'pie',
      radius: props.radius,
      center: ['50%', props.showLegend ? '44%' : '50%'],
      avoidLabelOverlap: false,
      label: { show: false },
      labelLine: { show: false },
      itemStyle: { borderColor: '#ffffff', borderWidth: 2 },
      data: (props.data || []).map(d => ({
        name: d.name,
        value: Number(d.value) || 0,
        itemStyle: d.color ? { color: d.color } : undefined
      }))
    }
  ]
})

const render = () => {
  if (!chart) return
  chart.setOption(buildOption(), true)
}

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

watch(() => props.data, render, { deep: true })
</script>

<style scoped>
.ring-chart { position: relative; width: 100%; height: 240px; }
.ring-canvas { width: 100%; height: 100%; }
.ring-center {
  position: absolute;
  left: 0; right: 0;
  transform: translateY(-50%);
  pointer-events: none;
  text-align: center;
}
.ring-center-value { font-size: 30px; font-weight: 900; line-height: 1.05; color: #0f172a; }
.ring-center-label { margin-top: 4px; font-size: 13px; color: #64748b; }
</style>
