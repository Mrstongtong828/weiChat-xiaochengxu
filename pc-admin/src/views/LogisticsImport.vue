<template>
  <div class="logistics-import">
    <el-alert
      title="签收单用于客户寄入（导入后更新为已签收）；回寄单用于后台发货（导入后更新为已回寄）。均按工单编号匹配。"
      type="info" show-icon :closable="false" class="li-alert"
    />
    <div class="li-form">
      <el-radio-group v-model="importType" size="small">
        <el-radio-button value="inbound">导入签收单（客户寄入）</el-radio-button>
        <el-radio-button value="return">导入回寄单（后台发货）</el-radio-button>
      </el-radio-group>
      <div class="li-row">
        <span class="li-label">业务日期</span>
        <el-date-picker v-model="shipDate" type="date" value-format="YYYY-MM-DD" size="small" style="width: 160px" />
      </div>
      <div class="li-actions">
        <el-button plain @click="downloadTemplate"><el-icon><Document /></el-icon>下载规范模板</el-button>
        <el-upload action="#" :auto-upload="false" :show-file-list="false" accept=".xlsx,.xls" :on-change="handleFile">
          <el-button type="primary" :loading="importing"><el-icon><Upload /></el-icon>选择 Excel 导入</el-button>
        </el-upload>
      </div>
    </div>

    <div v-if="result" class="li-result">
      <div class="li-stats">
        <div class="li-stat"><span>总计</span><strong>{{ result.total }}</strong></div>
        <div class="li-stat ok"><span>成功</span><strong>{{ result.success }}</strong></div>
        <div class="li-stat fail"><span>失败</span><strong>{{ result.fail }}</strong></div>
      </div>
      <el-table v-if="result.errors && result.errors.length" :data="result.errors" max-height="320" size="small" style="width:100%">
        <el-table-column prop="orderNo" label="失败工单号" min-width="160" show-overflow-tooltip />
        <el-table-column prop="reason" label="失败原因" min-width="240" show-overflow-tooltip />
      </el-table>
      <el-empty v-else description="全部导入成功" :image-size="60" />
    </div>
  </div>
</template>

<script setup>
import { ref } from 'vue'
import { ElMessage } from 'element-plus'
import { batchImportLogistics } from '../api/order.js'
import { downloadShippingTemplate, parseShippingExcelFile } from '../utils/shippingImport.js'

const getToken = () => localStorage.getItem('adminToken')
const importType = ref('return')
const shipDate = ref(new Date().toISOString().slice(0, 10))
const importing = ref(false)
const result = ref(null)

const downloadTemplate = () => downloadShippingTemplate(importType.value).catch(e => ElMessage.error(e.message || '下载失败'))

const handleFile = async (uploadFile) => {
  const file = uploadFile && uploadFile.raw
  if (!file) return
  importing.value = true
  try {
    const rows = await parseShippingExcelFile(file, importType.value)
    if (!rows.length) { ElMessage.warning('Excel 中没有可导入的数据'); return }
    const data = await batchImportLogistics(getToken(), importType.value, rows, shipDate.value)
    result.value = data
    ElMessage.success(`导入完成：成功 ${data.success} 条，失败 ${data.fail} 条`)
  } catch (e) {
    ElMessage.error(e.message || '导入失败')
  } finally {
    importing.value = false
  }
}
</script>

<style scoped>
.logistics-import { display: flex; flex-direction: column; gap: 18px; }
.li-alert { border-radius: 8px; }
.li-form { display: flex; flex-direction: column; gap: 14px; }
.li-row { display: flex; align-items: center; gap: 10px; }
.li-label { font-size: 13px; color: #606266; }
.li-actions { display: flex; align-items: center; gap: 12px; }
.li-result { margin-top: 4px; }
.li-stats { display: grid; grid-template-columns: repeat(3, 1fr); gap: 12px; margin-bottom: 14px; max-width: 480px; }
.li-stat { border-radius: 12px; padding: 14px; background: #f7f8fa; text-align: center; }
.li-stat span { display: block; color: #86909c; font-size: 13px; margin-bottom: 6px; }
.li-stat strong { display: block; font-size: 26px; line-height: 1; color: #1d2129; }
.li-stat.ok { background: #e6f7f0; } .li-stat.ok strong { color: #52c41a; }
.li-stat.fail { background: #fff1f0; } .li-stat.fail strong { color: #f56c6c; }
</style>
