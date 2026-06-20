<template>
  <div class="glass-card">
    <div class="section-title">
      <div>
        <span>客户管理</span>
        <p class="section-desc">维护诊所、经销商和散户档案，统一查看客户资产、历史工单和服务标签。</p>
      </div>
      <div class="title-actions">
        <el-button v-if="canEdit" size="small" @click="tagMgrVisible = true">标签管理</el-button>
        <el-button v-if="canCreate" size="small" @click="importVisible = true">批量导入</el-button>
        <el-button v-if="canExport" size="small" @click="doExport" :loading="exporting">导出</el-button>
        <el-button v-if="canCreate" size="small" @click="confirmSync" :loading="syncing">同步小程序客户</el-button>
        <el-button v-if="canCreate" type="primary" size="small" @click="openEdit(null)">
          <el-icon><Plus /></el-icon> 新增客户
        </el-button>
      </div>
    </div>

    <!-- 筛选栏 -->
    <div class="filter-bar">
      <el-input v-model.trim="filters.keyword" placeholder="客户名称 / 联系人 / 手机号" clearable
        style="width:240px;" @keyup.enter="reload" @clear="reload" />
      <el-select v-model="filters.customer_type" placeholder="客户类型" clearable style="width:140px;" @change="reload">
        <el-option label="终端诊所" value="clinic" />
        <el-option label="经销商" value="dealer" />
        <el-option label="个人散户" value="individual" />
      </el-select>
      <el-select v-model="filters.status" style="width:130px;" @change="reload">
        <el-option label="正常客户" value="active" />
        <el-option label="已注销" value="cancelled" />
        <el-option label="全部" value="all" />
      </el-select>
      <el-select v-model="filters.tag" placeholder="按标签筛选" clearable filterable style="width:160px;" @change="reload">
        <el-option v-for="t in tags" :key="t._id" :label="t.name" :value="t.name" />
      </el-select>
      <el-button type="primary" @click="reload">查询</el-button>
    </div>

    <!-- 批量操作工具条 -->
    <div v-if="selectedRows.length" class="batch-bar">
      已选 <b>{{ selectedRows.length }}</b> 个客户
      <el-button v-if="canEdit" size="small" type="primary" @click="openBatchTag('add')">批量打标</el-button>
      <el-button v-if="canEdit" size="small" @click="openBatchTag('remove')">移除标签</el-button>
    </div>

    <div class="table-responsive">
      <el-table :data="list" class="modern-table" style="width:100%;" v-loading="loading" @selection-change="onSelectionChange">
        <template #empty>
          <div class="table-empty-guide">
            <strong>暂无客户数据</strong>
            <span>可以先新增线下客户，或通过“批量导入 / 同步小程序客户”建立客户档案。</span>
          </div>
        </template>
        <el-table-column type="selection" width="44" :selectable="(row) => row.status !== 'cancelled'" />
        <el-table-column prop="name" label="客户名称" min-width="150" show-overflow-tooltip>
          <template #default="{row}">
            <span class="cell-primary">{{ row.name }}</span>
            <el-tag v-if="row.status === 'cancelled'" size="small" type="info" effect="plain" style="margin-left:6px;">已注销</el-tag>
          </template>
        </el-table-column>
        <el-table-column prop="contact" label="联系人" width="110" show-overflow-tooltip />
        <el-table-column label="手机号" width="170">
          <template #default="{row}">
            <span>{{ row.phoneFull || row.phone_mask || '-' }}</span>
            <el-button v-if="canViewPhone && row.has_phone && !row.phoneFull" type="primary" link
              size="small" @click="revealPhone(row)">查看</el-button>
          </template>
        </el-table-column>
        <el-table-column label="类型" width="100">
          <template #default="{row}"><el-tag size="small" :type="typeTag(row.customer_type)">{{ typeLabel(row.customer_type) }}</el-tag></template>
        </el-table-column>
        <el-table-column label="标签" min-width="140">
          <template #default="{row}">
            <el-tag v-for="t in (row.tags || [])" :key="t" size="small" :type="tagColor(t)" effect="plain" class="row-tag">{{ t }}</el-tag>
            <span v-if="!(row.tags && row.tags.length)" class="muted">-</span>
          </template>
        </el-table-column>
        <el-table-column prop="order_count" label="工单数" width="80" align="center" />
        <el-table-column prop="device_count" label="设备数" width="80" align="center" />
        <el-table-column label="最后报修" width="120">
          <template #default="{row}">{{ row.last_order_time ? fmtDate(row.last_order_time) : '-' }}</template>
        </el-table-column>
        <el-table-column label="操作" width="220" fixed="right" align="right">
          <template #default="{row}">
            <el-button type="primary" link @click="openDetail(row)">详情</el-button>
            <el-button v-if="canEdit && row.status !== 'cancelled'" type="primary" link @click="openEdit(row)">编辑</el-button>
            <el-popconfirm v-if="canCancel && row.status !== 'cancelled'" width="240"
              title="注销后将脱敏手机号/地址并解绑微信，且不可恢复，确定？" @confirm="doCancel(row)">
              <template #reference><el-button type="danger" link>注销</el-button></template>
            </el-popconfirm>
          </template>
        </el-table-column>
      </el-table>
    </div>

    <div class="pager">
      <el-pagination layout="total, prev, pager, next" :total="total"
        :current-page="filters.page" :page-size="filters.pageSize" @current-change="onPage" />
    </div>
  </div>

  <!-- 新增 / 编辑弹窗 -->
  <el-dialog v-model="editVisible" :title="isEdit ? '编辑客户' : '新增客户'" width="520px" align-center>
    <el-form :model="form" label-width="100px">
      <el-form-item label="客户类型">
        <el-select v-model="form.customer_type" style="width:100%;">
          <el-option label="终端诊所" value="clinic" />
          <el-option label="经销商" value="dealer" />
          <el-option label="个人散户" value="individual" />
        </el-select>
      </el-form-item>
      <el-form-item label="客户名称" required>
        <el-input v-model.trim="form.name" placeholder="诊所名 / 经销商名 / 个人姓名" />
      </el-form-item>
      <el-form-item label="联系人"><el-input v-model.trim="form.contact" /></el-form-item>
      <el-form-item label="手机号"><el-input v-model.trim="form.phone" maxlength="11" placeholder="11位手机号" /></el-form-item>
      <el-form-item label="地址"><el-input v-model.trim="form.address" /></el-form-item>
      <el-form-item label="客户来源">
        <el-select v-model="form.source" style="width:100%;">
          <el-option label="线下导入" value="offline" />
          <el-option label="小程序注册" value="miniapp" />
          <el-option label="经销商推荐" value="dealer_referral" />
        </el-select>
      </el-form-item>
      <el-form-item label="归属经销商">
        <el-select v-model="form.dealer_id" clearable filterable placeholder="选填" style="width:100%;">
          <el-option v-for="d in dealers" :key="d._id" :label="d.name" :value="d._id" />
        </el-select>
      </el-form-item>
      <template v-if="form.customer_type === 'dealer'">
        <el-form-item label="信用代码"><el-input v-model.trim="form.credit_code" placeholder="统一社会信用代码" /></el-form-item>
        <el-form-item label="对接业务员"><el-input v-model.trim="form.biz_user" /></el-form-item>
        <el-form-item label="经销型号范围"><el-input v-model.trim="form.product_scope" /></el-form-item>
      </template>
      <el-form-item label="标签">
        <el-select v-model="form.tags" multiple filterable allow-create default-first-option placeholder="选择或输入标签" style="width:100%;">
          <el-option v-for="t in tags" :key="t._id" :label="t.name" :value="t.name" />
        </el-select>
      </el-form-item>
      <el-form-item label="备注"><el-input v-model.trim="form.remark" type="textarea" :rows="2" /></el-form-item>
    </el-form>
    <template #footer>
      <el-button @click="editVisible = false">取消</el-button>
      <el-button type="primary" :loading="saving" @click="saveCustomer">保存</el-button>
    </template>
  </el-dialog>

  <!-- 客户详情抽屉 -->
  <el-drawer v-model="detailVisible" :title="detail.name || '客户详情'" size="60%">
    <el-tabs v-model="activeTab" @tab-change="onTabChange">
      <el-tab-pane label="基础信息" name="base">
        <el-descriptions :column="2" border>
          <el-descriptions-item label="客户名称">{{ detail.name }}</el-descriptions-item>
          <el-descriptions-item label="客户类型">{{ typeLabel(detail.customer_type) }}</el-descriptions-item>
          <el-descriptions-item label="联系人">{{ detail.contact || '-' }}</el-descriptions-item>
          <el-descriptions-item label="手机号">
            {{ detail.phoneFull || detail.phone_mask || '-' }}
            <el-button v-if="canViewPhone && detail.has_phone && !detail.phoneFull" type="primary" link size="small" @click="revealPhone(detail, true)">查看完整</el-button>
          </el-descriptions-item>
          <el-descriptions-item label="地址" :span="2">{{ detail.address || '-' }}</el-descriptions-item>
          <el-descriptions-item label="客户来源">{{ sourceLabel(detail.source) }}</el-descriptions-item>
          <el-descriptions-item label="账号状态">{{ detail.has_account ? '已绑定小程序' : '线下客户' }}</el-descriptions-item>
          <el-descriptions-item v-if="detail.customer_type === 'dealer'" label="信用代码">{{ detail.credit_code || '-' }}</el-descriptions-item>
          <el-descriptions-item v-if="detail.customer_type === 'dealer'" label="对接业务员">{{ detail.biz_user || '-' }}</el-descriptions-item>
          <el-descriptions-item label="创建时间">{{ detail.create_time ? fmtDateTime(detail.create_time) : '-' }}</el-descriptions-item>
          <el-descriptions-item label="标签" :span="2">
            <el-tag v-for="t in (detail.tags || [])" :key="t" size="small" :type="tagColor(t)" effect="plain" class="row-tag">{{ t }}</el-tag>
            <span v-if="!(detail.tags && detail.tags.length)">-</span>
          </el-descriptions-item>
          <el-descriptions-item label="备注" :span="2">{{ detail.remark || '-' }}</el-descriptions-item>
        </el-descriptions>
      </el-tab-pane>

      <el-tab-pane label="客户资产/SN台账" name="device">
        <div class="asset-summary">
          <div><span>设备总数</span><b>{{ assetSummary.total }}</b></div>
          <div><span>在保/延保</span><b>{{ assetSummary.covered }}</b></div>
          <div><span>过保设备</span><b>{{ assetSummary.expired }}</b></div>
          <div><span>SN 完整率</span><b>{{ assetSummary.snRate }}%</b></div>
        </div>
        <div class="tab-toolbar" v-if="canDevice && detail.status !== 'cancelled'">
          <el-button type="primary" size="small" @click="openDevice(null)"><el-icon><Plus /></el-icon> 绑定设备</el-button>
        </div>
        <el-table :data="devices" v-loading="tabLoading" size="small">
          <el-table-column prop="product_category" label="分类" width="110" show-overflow-tooltip />
          <el-table-column prop="product_name" label="设备名称" min-width="120" show-overflow-tooltip />
          <el-table-column prop="model" label="型号" width="120" />
          <el-table-column prop="sn" label="SN序列号" min-width="140" />
          <el-table-column prop="purchase_channel" label="采购渠道" width="110" show-overflow-tooltip />
          <el-table-column prop="dealer_name" label="销售方" width="120" show-overflow-tooltip />
          <el-table-column prop="buy_date" label="采购日期" width="110" />
          <el-table-column label="质保月数" width="90">
            <template #default="{row}">{{ row.warranty_months ? `${row.warranty_months}个月` : '-' }}</template>
          </el-table-column>
          <el-table-column label="质保到期" width="120">
            <template #default="{row}"><span :class="{ 'text-danger': row.warranty_state === 'expired' }">{{ row.effective_expire || '-' }}</span></template>
          </el-table-column>
          <el-table-column label="质保状态" width="90">
            <template #default="{row}"><el-tag size="small" :type="warrantyTag(row.warranty_state)">{{ warrantyLabel(row.warranty_state) }}</el-tag></template>
          </el-table-column>
          <el-table-column label="延保" width="70" align="center">
            <template #default="{row}">{{ Array.isArray(row.ext_warranty) ? row.ext_warranty.length : 0 }}</template>
          </el-table-column>
          <el-table-column prop="maintenance_cycle" label="保养周期" width="110" show-overflow-tooltip />
          <el-table-column v-if="canDevice" label="操作" width="120" align="right">
            <template #default="{row}">
              <el-button type="primary" link size="small" @click="openDevice(row)">编辑</el-button>
              <el-popconfirm title="确定解绑该设备？" @confirm="removeDevice(row)">
                <template #reference><el-button type="danger" link size="small">解绑</el-button></template>
              </el-popconfirm>
            </template>
          </el-table-column>
        </el-table>
      </el-tab-pane>

      <el-tab-pane label="历史工单" name="order">
        <div class="order-summary" v-if="orderData.total">
          共 <b>{{ orderData.total }}</b> 单，累计维修消费 <b>¥{{ orderData.total_amount }}</b>
        </div>
        <el-table :data="orderData.list" v-loading="tabLoading" size="small">
          <el-table-column prop="order_no" label="工单号" min-width="160" />
          <el-table-column label="状态" width="100">
            <template #default="{row}"><el-tag size="small">{{ orderStatusLabel(row.status) }}</el-tag></template>
          </el-table-column>
          <el-table-column label="金额" width="100"><template #default="{row}">¥{{ row.total_price || 0 }}</template></el-table-column>
          <el-table-column label="报修时间" width="160"><template #default="{row}">{{ fmtDateTime(row.create_time) }}</template></el-table-column>
        </el-table>
        <el-empty v-if="!tabLoading && !orderData.list.length" description="该客户暂无历史工单（或未绑定小程序账号）" />
      </el-tab-pane>

      <el-tab-pane label="操作日志" name="log">
        <el-table :data="logs" v-loading="tabLoading" size="small">
          <el-table-column label="时间" width="160"><template #default="{row}">{{ fmtDateTime(row.create_time) }}</template></el-table-column>
          <el-table-column label="操作人" width="110"><template #default="{row}">{{ row.operator_name }}</template></el-table-column>
          <el-table-column label="操作" width="100"><template #default="{row}">{{ logActionLabel(row.action) }}</template></el-table-column>
          <el-table-column prop="detail" label="详情" min-width="180" show-overflow-tooltip />
        </el-table>
      </el-tab-pane>
    </el-tabs>
  </el-drawer>

  <!-- 设备绑定弹窗 -->
  <el-dialog v-model="deviceVisible" :title="deviceForm._id ? '编辑设备' : '绑定设备'" width="460px" align-center>
    <el-form :model="deviceForm" label-width="100px">
      <el-form-item label="产品分类"><el-input v-model.trim="deviceForm.product_category" placeholder="如 牙科手机 / 种植机" /></el-form-item>
      <el-form-item label="设备名称" required><el-input v-model.trim="deviceForm.product_name" /></el-form-item>
      <el-form-item label="型号"><el-input v-model.trim="deviceForm.model" /></el-form-item>
      <el-form-item label="SN序列号"><el-input v-model.trim="deviceForm.sn" placeholder="机身唯一序列号" /></el-form-item>
      <el-form-item label="采购渠道"><el-input v-model.trim="deviceForm.purchase_channel" placeholder="厂家 / 经销商 / 线下导入" /></el-form-item>
      <el-form-item label="销售方"><el-input v-model.trim="deviceForm.dealer_name" placeholder="经销商或来源单位" /></el-form-item>
      <el-form-item label="采购日期"><el-date-picker v-model="deviceForm.buy_date" type="date" value-format="YYYY-MM-DD" style="width:100%;" /></el-form-item>
      <el-form-item label="质保月数"><el-input-number v-model="deviceForm.warranty_months" :min="0" :precision="0" controls-position="right" style="width:100%;" /></el-form-item>
      <el-form-item label="质保到期"><el-date-picker v-model="deviceForm.warranty_expire" type="date" value-format="YYYY-MM-DD" style="width:100%;" /></el-form-item>
      <el-form-item label="保养周期"><el-input v-model.trim="deviceForm.maintenance_cycle" placeholder="如 6个月 / 12个月" /></el-form-item>
    </el-form>
    <template #footer>
      <el-button @click="deviceVisible = false">取消</el-button>
      <el-button type="primary" :loading="saving" @click="saveDevice">保存</el-button>
    </template>
  </el-dialog>

  <!-- 标签管理弹窗 -->
  <el-dialog v-model="tagMgrVisible" title="标签库管理" width="540px" align-center>
    <div class="tag-add-row">
      <el-input v-model.trim="tagForm.name" placeholder="标签名称" style="width:160px;" />
      <el-select v-model="tagForm.category" style="width:120px;">
        <el-option label="设备类" value="device" />
        <el-option label="运营类" value="ops" />
        <el-option label="售后类" value="service" />
      </el-select>
      <el-select v-model="tagForm.color" placeholder="颜色" style="width:110px;">
        <el-option label="默认" value="" />
        <el-option label="成功(绿)" value="success" />
        <el-option label="警告(橙)" value="warning" />
        <el-option label="危险(红)" value="danger" />
        <el-option label="信息(灰)" value="info" />
      </el-select>
      <el-button type="primary" :loading="saving" @click="submitTag">添加</el-button>
    </div>
    <el-table :data="tags" size="small" max-height="320">
      <el-table-column label="标签" min-width="140">
        <template #default="{row}"><el-tag size="small" :type="row.color || ''" effect="plain">{{ row.name }}</el-tag></template>
      </el-table-column>
      <el-table-column label="分类" width="100"><template #default="{row}">{{ tagCategoryLabel(row.category) }}</template></el-table-column>
      <el-table-column label="操作" width="90" align="right">
        <template #default="{row}">
          <el-popconfirm width="240" title="删除后将从所有客户档案移除该标签，确定？" @confirm="removeTag(row)">
            <template #reference><el-button type="danger" link size="small">删除</el-button></template>
          </el-popconfirm>
        </template>
      </el-table-column>
    </el-table>
  </el-dialog>

  <!-- 批量打标弹窗 -->
  <el-dialog v-model="batchTagVisible" :title="batchOp === 'add' ? '批量打标' : '批量移除标签'" width="460px" align-center>
    <p class="muted">将对已选 {{ selectedRows.length }} 个客户{{ batchOp === 'add' ? '添加' : '移除' }}以下标签：</p>
    <el-select v-model="batchTagNames" multiple filterable :allow-create="batchOp === 'add'" default-first-option placeholder="选择标签" style="width:100%;">
      <el-option v-for="t in tags" :key="t._id" :label="t.name" :value="t.name" />
    </el-select>
    <template #footer>
      <el-button @click="batchTagVisible = false">取消</el-button>
      <el-button type="primary" :loading="saving" @click="submitBatchTag">确定</el-button>
    </template>
  </el-dialog>

  <!-- 批量导入弹窗 -->
  <el-dialog v-model="importVisible" title="批量导入客户" width="560px" align-center @closed="importResult = null">
    <div class="import-tip">
      <el-button link type="primary" @click="downloadTemplate">下载导入模板</el-button>
      <span class="muted">支持 .xlsx；客户名称必填，手机号校验格式与重复。</span>
    </div>
    <el-upload drag :auto-upload="false" :show-file-list="true" :limit="1" accept=".xlsx,.xls" :on-change="onImportFile">
      <el-icon class="el-icon--upload"><UploadFilled /></el-icon>
      <div class="el-upload__text">拖拽文件到此处，或<em>点击选择文件</em></div>
    </el-upload>
    <div v-if="importPreview.length" class="muted" style="margin-top:8px;">已解析 {{ importPreview.length }} 条，点击「开始导入」提交。</div>
    <div v-if="importResult" class="import-result">
      <el-alert :title="`导入完成：成功 ${importResult.success} 条，失败 ${importResult.failed.length} 条`"
        :type="importResult.failed.length ? 'warning' : 'success'" :closable="false" />
      <el-table v-if="importResult.failed.length" :data="importResult.failed" size="small" max-height="200" style="margin-top:8px;">
        <el-table-column prop="row" label="行号" width="70" />
        <el-table-column prop="name" label="客户名称" min-width="120" />
        <el-table-column prop="reason" label="失败原因" min-width="140" />
      </el-table>
    </div>
    <template #footer>
      <el-button @click="importVisible = false">关闭</el-button>
      <el-button type="primary" :loading="importing" :disabled="!importPreview.length" @click="submitImport">开始导入</el-button>
    </template>
  </el-dialog>
</template>

<script setup>
import { ref, reactive, computed, onMounted } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import {
  listCustomers, getCustomerDetail, getCustomerPhone, createCustomer, updateCustomer,
  cancelCustomer, listDealers, syncCustomersFromUsers,
  listCustomerDevices, saveCustomerDevice, deleteCustomerDevice,
  listCustomerOrders, getCustomerLogs,
  listTags, saveTag, deleteTag, batchTag, exportCustomers, batchImportCustomers
} from '../api/customer.js'
import { downloadCustomerTemplate, exportCustomerWorkbook, parseCustomerExcelFile } from '../utils/customerExcel.js'

const TYPE_LABELS = { clinic: '终端诊所', dealer: '经销商', individual: '个人散户' }
const SOURCE_LABELS = { miniapp: '小程序注册', offline: '线下导入', dealer_referral: '经销商推荐' }
const WARRANTY_LABELS = { in_warranty: '在保', extended: '已延保', expired: '过保', unknown: '未知' }
const ORDER_STATUS_LABELS = { pending: '待寄出', sent: '已寄出', received: '已收货', inspecting: '检测中', fixing: '维修中', shipped: '已寄回', completed: '已完成', cancelled: '已取消' }
const LOG_ACTION_LABELS = { create: '新增', edit: '编辑', cancel: '注销', view_phone: '查看手机号', device_save: '设备变更', device_delete: '解绑设备', sync: '同步', export: '导出' }

const typeLabel = (t) => TYPE_LABELS[t] || t || '-'
const sourceLabel = (s) => SOURCE_LABELS[s] || '-'
const warrantyLabel = (s) => WARRANTY_LABELS[s] || '未知'
const orderStatusLabel = (s) => ORDER_STATUS_LABELS[s] || s
const logActionLabel = (a) => LOG_ACTION_LABELS[a] || a
const typeTag = (t) => (t === 'dealer' ? 'warning' : t === 'individual' ? 'info' : 'success')
const warrantyTag = (s) => (s === 'expired' ? 'danger' : s === 'unknown' ? 'info' : 'success')

const pad = (n) => String(n).padStart(2, '0')
const fmtDate = (ts) => { if (!ts) return '-'; const d = new Date(ts); return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}` }
const fmtDateTime = (ts) => { if (!ts) return '-'; const d = new Date(ts); return `${fmtDate(ts)} ${pad(d.getHours())}:${pad(d.getMinutes())}` }

const currentRole = (() => {
  try { return (JSON.parse(localStorage.getItem('adminUser') || '{}').role) || '' } catch (e) { return '' }
})()
const canCreate = computed(() => ['admin', 'support'].includes(currentRole))
const canEdit = computed(() => ['admin', 'support'].includes(currentRole))
const canCancel = computed(() => currentRole === 'admin')
const canViewPhone = computed(() => currentRole === 'admin')
const canDevice = computed(() => ['admin', 'engineer', 'support'].includes(currentRole))
const canExport = computed(() => currentRole === 'admin')

const loading = ref(false)
const saving = ref(false)
const syncing = ref(false)
const exporting = ref(false)
const importing = ref(false)
const list = ref([])
const total = ref(0)
const dealers = ref([])
const tags = ref([])
const selectedRows = ref([])
const filters = reactive({ keyword: '', customer_type: '', status: 'active', tag: '', page: 1, pageSize: 20 })

const TAG_CATEGORY_LABELS = { device: '设备类', ops: '运营类', service: '售后类' }
const tagCategoryLabel = (c) => TAG_CATEGORY_LABELS[c] || '运营类'
const tagColorMap = computed(() => {
  const m = {}
  tags.value.forEach(t => { m[t.name] = t.color || '' })
  return m
})
const tagColor = (name) => tagColorMap.value[name] || ''

const load = async () => {
  loading.value = true
  try {
    const data = await listCustomers({ ...filters })
    list.value = data.list || []
    total.value = data.total || 0
  } catch (e) { /* 拦截器已提示 */ } finally { loading.value = false }
}
const reload = () => { filters.page = 1; load() }
const onPage = (p) => { filters.page = p; load() }

const loadDealers = async () => { try { dealers.value = await listDealers() } catch (e) { /* ignore */ } }

const revealPhone = async (row, isDetail = false) => {
  try {
    const data = await getCustomerPhone(row._id)
    row.phoneFull = data.phone
    if (isDetail) detail.phoneFull = data.phone
  } catch (e) { /* ignore */ }
}

const confirmSync = async () => {
  try {
    await ElMessageBox.confirm('将从小程序注册用户回填客户档案（已存在的不会重复创建），确定执行？', '同步小程序客户', { type: 'info' })
    syncing.value = true
    const data = await syncCustomersFromUsers()
    ElMessage.success(`同步完成，新增 ${data.created} 条（扫描 ${data.scanned} 个用户）`)
    reload()
  } catch (e) { if (e !== 'cancel') { /* ignore */ } } finally { syncing.value = false }
}

// ===== 新增/编辑 =====
const editVisible = ref(false)
const isEdit = ref(false)
const form = reactive({ _id: null, customer_type: 'clinic', name: '', contact: '', phone: '', address: '', source: 'offline', dealer_id: '', credit_code: '', biz_user: '', product_scope: '', tags: [], remark: '' })

const openEdit = (row) => {
  isEdit.value = !!row
  Object.assign(form, {
    _id: row ? row._id : null,
    customer_type: row ? row.customer_type : 'clinic',
    name: row ? row.name : '',
    contact: row ? row.contact : '',
    phone: '',
    address: row ? row.address : '',
    source: row ? (row.source || 'offline') : 'offline',
    dealer_id: row ? (row.dealer_id || '') : '',
    credit_code: row ? (row.credit_code || '') : '',
    biz_user: row ? (row.biz_user || '') : '',
    product_scope: row ? (row.product_scope || '') : '',
    tags: row && Array.isArray(row.tags) ? [...row.tags] : [],
    remark: row ? (row.remark || '') : ''
  })
  editVisible.value = true
}

const saveCustomer = async () => {
  if (!form.name) { ElMessage.warning('请填写客户名称'); return }
  if (form.phone && !/^1\d{10}$/.test(form.phone)) { ElMessage.warning('手机号格式不正确'); return }
  saving.value = true
  try {
    const payload = { ...form }
    delete payload._id
    if (isEdit.value) {
      // 手机号留空表示不修改，避免覆盖脱敏号
      if (!payload.phone) delete payload.phone
      await updateCustomer(form._id, payload)
      ElMessage.success('已保存')
    } else {
      await createCustomer(payload)
      ElMessage.success('客户已新增')
    }
    editVisible.value = false
    load()
    if (form.customer_type === 'dealer') loadDealers()
  } catch (e) { /* ignore */ } finally { saving.value = false }
}

const doCancel = async (row) => {
  try { await cancelCustomer(row._id); ElMessage.success('客户已注销'); load() } catch (e) { /* ignore */ }
}

// ===== 详情抽屉 =====
const detailVisible = ref(false)
const activeTab = ref('base')
const tabLoading = ref(false)
const detail = reactive({})
const devices = ref([])
const orderData = reactive({ list: [], total: 0, total_amount: 0 })
const logs = ref([])
const assetSummary = computed(() => {
  const total = devices.value.length
  const covered = devices.value.filter(d => ['in_warranty', 'extended'].includes(d.warranty_state)).length
  const expired = devices.value.filter(d => d.warranty_state === 'expired').length
  const snCount = devices.value.filter(d => d.sn).length
  return {
    total,
    covered,
    expired,
    snRate: total ? Math.round((snCount / total) * 100) : 0
  }
})

const openDetail = async (row) => {
  activeTab.value = 'base'
  Object.keys(detail).forEach(k => delete detail[k])
  devices.value = []; logs.value = []
  Object.assign(orderData, { list: [], total: 0, total_amount: 0 })
  detailVisible.value = true
  try {
    const data = await getCustomerDetail(row._id)
    Object.assign(detail, data)
  } catch (e) { /* ignore */ }
}

const onTabChange = (name) => {
  if (!detail._id) return
  if (name === 'device') loadDevices()
  else if (name === 'order') loadOrders()
  else if (name === 'log') loadLogs()
}
const loadDevices = async () => { tabLoading.value = true; try { devices.value = await listCustomerDevices(detail._id) } catch (e) { /* ignore */ } finally { tabLoading.value = false } }
const loadOrders = async () => { tabLoading.value = true; try { Object.assign(orderData, await listCustomerOrders(detail._id)) } catch (e) { /* ignore */ } finally { tabLoading.value = false } }
const loadLogs = async () => { tabLoading.value = true; try { logs.value = await getCustomerLogs(detail._id) } catch (e) { /* ignore */ } finally { tabLoading.value = false } }

// ===== 设备弹窗 =====
const deviceVisible = ref(false)
const deviceForm = reactive({ _id: null, product_category: '', product_name: '', model: '', sn: '', purchase_channel: '', dealer_name: '', buy_date: '', warranty_months: 0, warranty_expire: '', maintenance_cycle: '' })
const openDevice = (row) => {
  Object.assign(deviceForm, {
    _id: row ? row._id : null,
    product_category: row ? (row.product_category || '') : '',
    product_name: row ? row.product_name : '',
    model: row ? (row.model || '') : '',
    sn: row ? (row.sn || '') : '',
    purchase_channel: row ? (row.purchase_channel || '') : '',
    dealer_name: row ? (row.dealer_name || '') : '',
    buy_date: row ? (row.buy_date || '') : '',
    warranty_months: row ? (Number(row.warranty_months || 0) || 0) : 0,
    warranty_expire: row ? (row.warranty_expire || '') : '',
    maintenance_cycle: row ? (row.maintenance_cycle || '') : ''
  })
  deviceVisible.value = true
}
const saveDevice = async () => {
  if (!deviceForm.product_name) { ElMessage.warning('请填写设备名称'); return }
  saving.value = true
  try {
    await saveCustomerDevice(detail._id, { ...deviceForm })
    ElMessage.success('已保存')
    deviceVisible.value = false
    loadDevices()
  } catch (e) { /* ignore */ } finally { saving.value = false }
}
const removeDevice = async (row) => {
  try { await deleteCustomerDevice(detail._id, row._id); ElMessage.success('已解绑'); loadDevices() } catch (e) { /* ignore */ }
}

// ===== 选择 =====
const onSelectionChange = (rows) => { selectedRows.value = rows }

// ===== 标签库 =====
const loadTags = async () => { try { tags.value = await listTags() } catch (e) { /* ignore */ } }
const tagMgrVisible = ref(false)
const tagForm = reactive({ name: '', category: 'ops', color: '' })
const submitTag = async () => {
  if (!tagForm.name) { ElMessage.warning('请输入标签名称'); return }
  saving.value = true
  try {
    await saveTag({ name: tagForm.name, category: tagForm.category, color: tagForm.color, sort: tags.value.length })
    ElMessage.success('已添加')
    tagForm.name = ''
    await loadTags()
  } catch (e) { /* ignore */ } finally { saving.value = false }
}
const removeTag = async (row) => {
  try { await deleteTag(row._id); ElMessage.success('已删除'); await loadTags(); load() } catch (e) { /* ignore */ }
}

// ===== 批量打标 =====
const batchTagVisible = ref(false)
const batchOp = ref('add')
const batchTagNames = ref([])
const openBatchTag = (op) => { batchOp.value = op; batchTagNames.value = []; batchTagVisible.value = true }
const submitBatchTag = async () => {
  if (!batchTagNames.value.length) { ElMessage.warning('请选择标签'); return }
  saving.value = true
  try {
    const ids = selectedRows.value.map(r => r._id)
    const data = await batchTag(ids, batchTagNames.value, batchOp.value)
    ElMessage.success(`已更新 ${data.updated} 个客户`)
    batchTagVisible.value = false
    if (batchOp.value === 'add') await loadTags() // allow-create 可能产生新标签名（仅写入客户档案，标签库需手动登记）
    load()
  } catch (e) { /* ignore */ } finally { saving.value = false }
}

// ===== 导出 =====
const doExport = async () => {
  exporting.value = true
  try {
    const data = await exportCustomers({ keyword: filters.keyword, customer_type: filters.customer_type, status: filters.status, tag: filters.tag })
    if (!data.length) { ElMessage.warning('没有可导出的数据'); return }
    await exportCustomerWorkbook(data)
    ElMessage.success(`已导出 ${data.length} 条`)
  } catch (e) { /* ignore */ } finally { exporting.value = false }
}

// ===== 导入 =====
const importVisible = ref(false)
const importPreview = ref([])
const importResult = ref(null)
const downloadTemplate = async () => { try { await downloadCustomerTemplate() } catch (e) { ElMessage.error('模板下载失败') } }
const onImportFile = async (file) => {
  importResult.value = null
  try {
    const rows = await parseCustomerExcelFile(file.raw)
    importPreview.value = rows
    if (!rows.length) ElMessage.warning('未解析到有效数据，请检查表头是否与模板一致')
  } catch (e) { ElMessage.error('文件解析失败：' + (e.message || '')); importPreview.value = [] }
}
const submitImport = async () => {
  if (!importPreview.value.length) return
  importing.value = true
  try {
    importResult.value = await batchImportCustomers(importPreview.value)
    importPreview.value = []
    load()
  } catch (e) { /* ignore */ } finally { importing.value = false }
}

onMounted(() => { load(); loadDealers(); loadTags() })
</script>

<style scoped>
.glass-card { background: #fff; border-radius: 12px; padding: 24px; box-shadow: 0 2px 12px rgba(0,0,0,0.03); margin-bottom: 20px; }
.section-title { font-size: 16px; font-weight: 600; color: #1d2129; margin-bottom: 16px; display: flex; align-items: center; justify-content: space-between; }
.title-actions { display: flex; gap: 8px; }
.filter-bar { display: flex; gap: 12px; flex-wrap: wrap; margin-bottom: 16px; }
.table-responsive { width: 100%; overflow-x: auto; }
.modern-table { min-width: 980px; }
.modern-table :deep(.el-table__inner-wrapper::before) { display: none; }
.modern-table :deep(th.el-table__cell) { background-color: #f7f8fa !important; color: #4e5969; font-weight: 600; border-bottom: none; }
.modern-table :deep(td.el-table__cell) { border-bottom: 1px solid #f0f2f5; padding: 12px 0; }
.pager { display: flex; justify-content: flex-end; margin-top: 16px; }
.tab-toolbar { margin-bottom: 12px; }
.asset-summary { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 10px; margin-bottom: 12px; }
.asset-summary div { padding: 10px 12px; border: 1px solid #e5eefb; border-radius: 8px; background: #f7fbff; }
.asset-summary span { display: block; color: #86909c; font-size: 12px; margin-bottom: 4px; }
.asset-summary b { color: #1d2129; font-size: 18px; }
.order-summary { margin-bottom: 12px; color: #4e5969; }
.order-summary b { color: #f56c6c; }
.text-danger { color: #f56c6c; font-weight: 600; }
.batch-bar { display: flex; align-items: center; gap: 10px; padding: 10px 14px; margin-bottom: 12px; background: #ecf5ff; border-radius: 8px; color: #4e5969; }
.batch-bar b { color: #409eff; }
.row-tag { margin-right: 4px; margin-bottom: 2px; }
.muted { color: #909399; font-size: 13px; }
.tag-add-row { display: flex; gap: 8px; margin-bottom: 14px; flex-wrap: wrap; }
.import-tip { display: flex; align-items: center; gap: 8px; margin-bottom: 12px; }
.import-result { margin-top: 12px; }
</style>
