<template>
  <div class="customer-asset-center">
    <section class="customer-overview" aria-labelledby="customer-overview-title">
      <div class="overview-heading">
        <div><h2 id="customer-overview-title">客户资产概览</h2><p>客户、设备与售后维护统一统计</p></div>
        <span>更新于 {{ overviewUpdatedAt || '--:--' }}</span>
      </div>
      <div class="customer-metric-grid" v-loading="overviewLoading">
        <button v-for="metric in customerMetrics" :key="metric.key" type="button" class="customer-metric" :class="[`is-${metric.tone}`, { 'is-expanded': metric.key === 'maintenance' && maintenancePanelVisible }]" :aria-expanded="metric.key === 'maintenance' ? maintenancePanelVisible : undefined" @click="applyMetric(metric.key)">
          <span>{{ metric.label }}</span><strong>{{ metric.value }}</strong><small>{{ metric.key === 'maintenance' && maintenancePanelVisible ? '点击收起维护明细' : metric.note }}</small>
          <i><el-icon><component :is="metric.icon" /></el-icon></i>
          <em v-if="metric.key === 'maintenance'" class="metric-toggle-cue"><span>{{ maintenancePanelVisible ? '收起' : '查看' }}</span><el-icon><ArrowDown /></el-icon></em>
        </button>
      </div>
    </section>

    <section class="customer-ledger" aria-labelledby="customer-ledger-title">
      <div class="ledger-heading">
        <div><h2 id="customer-ledger-title">客户资产台账</h2><p>从客户档案进入设备、工单与售后记录</p></div>
        <div class="title-actions">
          <el-button v-if="canEdit" @click="tagMgrVisible = true">标签管理</el-button>
          <el-button v-if="canImport" @click="importVisible = true"><el-icon><Upload /></el-icon>批量导入</el-button>
          <el-button v-if="canExport" :loading="exporting" @click="doExport"><el-icon><Download /></el-icon>导出</el-button>
          <el-dropdown v-if="canCreate" trigger="click" @command="handleCreateCommand">
            <el-button>更多<el-icon class="el-icon--right"><ArrowDown /></el-icon></el-button>
            <template #dropdown><el-dropdown-menu><el-dropdown-item command="sync">同步小程序客户</el-dropdown-item></el-dropdown-menu></template>
          </el-dropdown>
          <el-button v-if="canCreate" type="primary" @click="openEdit(null)"><el-icon><Plus /></el-icon>新增客户</el-button>
        </div>
      </div>

      <div class="customer-filter-bar">
        <el-input v-model.trim="filters.keyword" class="customer-search" placeholder="客户名称 / 联系人 / 手机号" clearable @keyup.enter="reload" @clear="reload"><template #prefix><el-icon><Search /></el-icon></template></el-input>
        <el-select v-model="filters.customer_type" placeholder="全部客户类型" clearable filterable allow-create default-first-option @change="reload"><el-option v-for="option in customerTypeOptionsWithCurrent(filters.customer_type)" :key="option.value" :label="option.label" :value="option.value" /></el-select>
        <el-select v-model="filters.tag" placeholder="全部客户标签" clearable filterable @change="reload"><el-option v-for="t in tags" :key="t._id" :label="t.name" :value="t.name" /></el-select>
        <el-select v-model="filters.status" @change="reload"><el-option label="正常客户" value="active" /><el-option label="已注销" value="cancelled" /><el-option label="全部状态" value="all" /></el-select>
        <el-button type="primary" @click="reload">查询</el-button><el-button @click="resetFilters">重置</el-button>
      </div>

      <transition name="maintenance-reveal">
        <div v-if="maintenancePanelVisible" class="maintenance-panel" v-loading="warrantyLoading">
          <div class="maintenance-head">
            <div><strong>待维护客户</strong><span>按保修资料与到期状态生成</span></div>
            <div><el-radio-group v-model="warrantyCategory" size="small" @change="loadWarrantyAlerts"><el-radio-button label="">全部 {{ warrantyCounts.all }}</el-radio-button><el-radio-button label="missing">待补充 {{ warrantyCounts.missing }}</el-radio-button><el-radio-button label="expiring">30天内到期 {{ warrantyCounts.expiring }}</el-radio-button><el-radio-button label="expired">已过保 {{ warrantyCounts.expired }}</el-radio-button></el-radio-group><el-button text circle aria-label="收起待维护客户明细" @click="maintenancePanelVisible = false"><el-icon><Close /></el-icon></el-button></div>
          </div>
          <el-table :data="warrantyAlerts" size="small" empty-text="当前没有需要处理的维护事项">
            <el-table-column prop="customer_name" label="客户" min-width="150" show-overflow-tooltip /><el-table-column label="设备" min-width="170" show-overflow-tooltip><template #default="{ row }">{{ [row.product_name, row.model].filter(Boolean).join(' / ') || '-' }}</template></el-table-column>
            <el-table-column label="提醒" width="110"><template #default="{ row }"><el-tag size="small" :type="warrantyAlertTag(row.category)">{{ warrantyAlertLabel(row.category) }}</el-tag></template></el-table-column>
            <el-table-column label="质保到期" width="120"><template #default="{ row }">{{ row.effective_expire || '待补充' }}</template></el-table-column><el-table-column prop="next_action" label="下一步" min-width="210" show-overflow-tooltip />
            <el-table-column label="操作" width="90" align="right"><template #default="{ row }"><el-button type="primary" link @click="openWarrantyAlert(row)">去处理</el-button></template></el-table-column>
          </el-table>
        </div>
      </transition>

      <div v-if="selectedRows.length" class="batch-bar">已选 <b>{{ selectedRows.length }}</b> 个客户<el-button v-if="canEdit" size="small" type="primary" @click="openBatchTag('add')">批量打标</el-button><el-button v-if="canEdit" size="small" @click="openBatchTag('remove')">移除标签</el-button></div>

      <div class="table-responsive">
        <el-table :data="list" class="modern-table" v-loading="loading" @selection-change="onSelectionChange">
          <template #empty><div class="table-empty-guide"><strong>暂无客户数据</strong><span>新增客户或调整筛选条件后，客户资产会显示在这里。</span></div></template>
          <el-table-column type="selection" width="44" :selectable="row => row.status !== 'cancelled'" />
          <el-table-column label="客户信息" min-width="220">
            <template #default="{ row }"><div class="customer-identity"><span class="customer-avatar">{{ customerInitial(row.name) }}</span><div><strong>{{ row.name }}</strong><span><el-tag v-for="tag in (row.tags || []).slice(0, 2)" :key="tag" size="small" :type="tagColor(tag)" effect="plain">{{ tag }}</el-tag><small v-if="!(row.tags || []).length">{{ sourceLabel(row.source) }}</small></span></div></div></template>
          </el-table-column>
          <el-table-column label="客户类型" min-width="110"><template #default="{ row }"><el-tag class="customer-type-cell-tag" size="small" :type="typeTag(row.customer_type)" effect="plain">{{ typeLabel(row.customer_type) }}</el-tag></template></el-table-column>
          <el-table-column label="联系人 / 手机号" min-width="150"><template #default="{ row }"><div class="contact-cell"><strong>{{ row.contact || '联系人待补充' }}</strong><span>{{ row.phoneFull || row.phone_mask || '手机号待补充' }}<el-button v-if="canViewPhone && row.has_phone && !row.phoneFull" type="primary" link size="small" @click="revealPhone(row)">查看</el-button></span></div></template></el-table-column>
          <el-table-column label="客户资产" width="125"><template #default="{ row }"><button type="button" class="asset-count" @click="openDetailTab(row, 'device')"><strong>{{ row.device_count || 0 }}</strong><span>台设备</span></button><small class="order-count">{{ row.order_count || 0 }} 个历史工单</small></template></el-table-column>
          <el-table-column label="最后报修" width="115"><template #default="{ row }"><span class="last-service">{{ row.last_order_time ? fmtDate(row.last_order_time) : '暂无报修' }}</span></template></el-table-column>
          <el-table-column label="状态" width="90"><template #default="{ row }"><span class="customer-status" :class="{ disabled: row.status === 'cancelled' }">{{ row.status === 'cancelled' ? '已停用' : '正常' }}</span></template></el-table-column>
          <el-table-column label="操作" width="175" fixed="right" align="right">
            <template #default="{ row }"><el-button type="primary" link @click="openDetail(row)">详情</el-button><el-button v-if="canEdit && row.status !== 'cancelled'" type="primary" link @click="openEdit(row)">编辑</el-button><el-dropdown trigger="click" @command="command => handleRowCommand(command, row)"><el-button type="primary" link>更多<el-icon><ArrowDown /></el-icon></el-button><template #dropdown><el-dropdown-menu><el-dropdown-item command="device">查看设备</el-dropdown-item><el-dropdown-item command="order">查看工单</el-dropdown-item><el-dropdown-item command="log">操作记录</el-dropdown-item><el-dropdown-item v-if="canCancel && row.status !== 'cancelled'" command="cancel" divided>停用客户</el-dropdown-item></el-dropdown-menu></template></el-dropdown></template>
          </el-table-column>
        </el-table>
      </div>
      <div class="pager"><el-pagination background layout="total, sizes, prev, pager, next" :page-sizes="[10, 20, 50]" :total="total" :current-page="filters.page" :page-size="filters.pageSize" @current-change="onPage" @size-change="onPageSize" /></div>
    </section>
  </div>

  <!-- 新增 / 编辑弹窗 -->
  <el-dialog v-model="editVisible" :title="isEdit ? '编辑客户' : '新增客户'" width="520px" align-center>
    <el-form :model="form" label-width="100px">
      <el-form-item label="客户类型">
        <el-select v-model="form.customer_type" filterable allow-create default-first-option placeholder="选择或输入客户类型" style="width:100%;">
          <el-option v-for="option in customerTypeOptionsWithCurrent(form.customer_type)" :key="option.value" :label="option.label" :value="option.value" />
        </el-select>
      </el-form-item>
      <el-form-item label="客户名称" required>
        <el-input v-model.trim="form.name" placeholder="门诊、经销商或客户名称" />
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
  <el-drawer v-model="detailVisible" size="min(980px, 92vw)" class="customer-archive-drawer">
    <template #header>
      <div class="archive-header">
        <span class="customer-avatar is-large">{{ customerInitial(detail.name) }}</span>
        <div class="archive-identity">
          <div><h2>{{ detail.name || '客户档案' }}</h2><span class="customer-status" :class="{ disabled: detail.status === 'cancelled' }">{{ detail.status === 'cancelled' ? '已停用' : '正常' }}</span></div>
          <p>{{ typeLabel(detail.customer_type) }} · {{ detail.contact || '联系人待补充' }} · {{ detail.phoneFull || detail.phone_mask || '手机号待补充' }}</p>
          <div><el-tag v-for="tag in (detail.tags || [])" :key="tag" size="small" :type="tagColor(tag)" effect="plain">{{ tag }}</el-tag><span v-if="!(detail.tags || []).length">{{ sourceLabel(detail.source) }}</span></div>
        </div>
      </div>
    </template>

    <div class="archive-summary" v-loading="detailLoading">
      <div><span>设备档案</span><strong>{{ detail.device_count ?? devices.length ?? 0 }}</strong><small>台</small></div>
      <div><span>历史工单</span><strong>{{ detail.order_count ?? orderData.total ?? 0 }}</strong><small>单</small></div>
      <div><span>已完成工单</span><strong>{{ completedOrderCount }}</strong><small>单</small></div>
      <div><span>最后报修</span><strong class="is-date">{{ detail.last_order_time ? fmtDate(detail.last_order_time) : '暂无报修' }}</strong></div>
    </div>

    <el-tabs v-model="activeTab" class="archive-tabs" @tab-change="onTabChange">
      <el-tab-pane label="客户概览" name="base">
        <div class="archive-section-heading"><div><strong>基本档案</strong><span>客户身份、联系信息与合作属性</span></div><el-button v-if="canEdit && detail.status !== 'cancelled'" @click="openEdit(detail)">编辑档案</el-button></div>
        <el-descriptions :column="2" border class="archive-descriptions">
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

      <el-tab-pane label="设备档案" name="device">
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
          <el-table-column label="质保月数" width="100">
            <template #default="{row}">{{ row.warranty_months ? `${row.warranty_months}个月` : '待补充' }}</template>
          </el-table-column>
          <el-table-column label="质保到期" width="120">
            <template #default="{row}"><span :class="{ 'text-danger': row.warranty_state === 'expired' }">{{ row.effective_expire || '待补充' }}</span></template>
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

      <el-tab-pane label="售后记录" name="order">
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
      <div class="warranty-form-block">
        <div class="warranty-form-head">
          <strong>质保信息（可后补）</strong>
          <el-tag :type="deviceWarrantyPreview.type" size="small">{{ deviceWarrantyPreview.label }}</el-tag>
        </div>
        <p>有效发票签收日优先；无发票时按SN出厂日期顺延30天起算。质保月数未填时统一按12个月计算。</p>
        <el-form-item label="发票签收日"><el-date-picker v-model="deviceForm.invoice_received_date" type="date" value-format="YYYY-MM-DD" placeholder="有效发票日期" clearable style="width:100%;" /></el-form-item>
        <el-form-item label="SN出厂日"><el-date-picker v-model="deviceForm.manufacture_date" type="date" value-format="YYYY-MM-DD" placeholder="无发票时填写" clearable style="width:100%;" /></el-form-item>
        <el-form-item label="整机质保"><span>统一12个月</span></el-form-item>
        <el-form-item label="质保到期"><el-date-picker v-model="deviceForm.warranty_expire" type="date" value-format="YYYY-MM-DD" placeholder="可直接选择截止日期" clearable style="width:100%;" /></el-form-item>
        <div class="warranty-preview">{{ deviceWarrantyPreview.detail }}</div>
      </div>
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
import { ref, reactive, computed, onMounted, watch } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { Close } from '@element-plus/icons-vue'
import { useRoute } from 'vue-router'
import {
  getCustomerPermissionConfig,
  listCustomers, getCustomerDetail, getCustomerPhone, createCustomer, updateCustomer,
  cancelCustomer, listDealers, syncCustomersFromUsers,
  listCustomerDevices, getWarrantyAlerts, saveCustomerDevice, deleteCustomerDevice,
  listCustomerOrders, getCustomerLogs,
  listTags, saveTag, deleteTag, batchTag, exportCustomers, batchImportCustomers
} from '../api/customer.js'
import { customerTypeLabel, customerTypeMeta, customerTypeOptionsWithCurrent, resolveCustomerTypeValue } from '../config/customerTypes.js'
import { downloadCustomerTemplate, exportCustomerWorkbook, parseCustomerExcelFile } from '../utils/customerExcel.js'
import { createCurrentMonthRange, dateRangeShortcuts, toApiDateRange } from '../utils/dateRange.js'

const route = useRoute()
const SOURCE_LABELS = { miniapp: '小程序注册', offline: '线下导入', dealer_referral: '经销商推荐' }
const WARRANTY_LABELS = { in_warranty: '在保', extended: '已延保', expired: '过保', unknown: '待补充' }
const ORDER_STATUS_LABELS = { pending: '待寄出', sent: '已寄出', received: '已收货', inspecting: '检测中', fixing: '维修中', shipped: '已寄回', completed: '已完成', cancelled: '已取消' }
const LOG_ACTION_LABELS = { create: '新增', edit: '编辑', cancel: '注销', view_phone: '查看手机号', device_save: '设备变更', device_delete: '解绑设备', sync: '同步', export: '导出' }

const typeLabel = (t) => customerTypeLabel(t) || '-'
const sourceLabel = (s) => SOURCE_LABELS[s] || '-'
const warrantyLabel = (s) => WARRANTY_LABELS[s] || '待补充'
const orderStatusLabel = (s) => ORDER_STATUS_LABELS[s] || s
const logActionLabel = (a) => LOG_ACTION_LABELS[a] || a
const typeTag = (t) => (customerTypeMeta(t) || {}).type || 'info'
const warrantyTag = (s) => (s === 'expired' ? 'danger' : (!s || s === 'unknown') ? 'warning' : 'success')
const warrantyAlertLabel = (category) => ({ missing: '资料待补充', expiring: '即将到期', expired: '已过保' }[category] || '待处理')
const warrantyAlertTag = (category) => (category === 'expired' ? 'danger' : category === 'expiring' ? 'warning' : 'info')

const pad = (n) => String(n).padStart(2, '0')
const fmtDate = (ts) => { if (!ts) return '-'; const d = new Date(ts); return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}` }
const fmtDateTime = (ts) => { if (!ts) return '-'; const d = new Date(ts); return `${fmtDate(ts)} ${pad(d.getHours())}:${pad(d.getMinutes())}` }

const currentRole = (() => {
  try { return (JSON.parse(localStorage.getItem('adminUser') || '{}').role) || '' } catch (e) { return '' }
})()
const permissionConfig = ref(null)
const hasCustomerPermission = (action, fallback) => {
  const permissions = permissionConfig.value && permissionConfig.value.permissions
  if (permissions && Object.prototype.hasOwnProperty.call(permissions, action)) return !!permissions[action]
  return fallback
}
const hasFallbackRole = (...roles) => currentRole === 'superadmin' || roles.includes(currentRole)
const canCreate = computed(() => hasCustomerPermission('create', hasFallbackRole('admin', 'support')))
const canEdit = computed(() => hasCustomerPermission('edit', hasFallbackRole('admin', 'support')))
const canCancel = computed(() => hasCustomerPermission('cancel', hasFallbackRole('admin')))
const canViewPhone = computed(() => hasCustomerPermission('view_phone', hasFallbackRole('admin')))
const canDevice = computed(() => hasCustomerPermission('device', hasFallbackRole('admin', 'engineer', 'support')))
const canImport = computed(() => hasCustomerPermission('import', hasFallbackRole('admin')))
const canExport = computed(() => hasCustomerPermission('export', hasFallbackRole('admin')))

const loading = ref(false)
const saving = ref(false)
const syncing = ref(false)
const exporting = ref(false)
const exportDateRange = ref(createCurrentMonthRange())
const importing = ref(false)
const list = ref([])
const total = ref(0)
const dealers = ref([])
const tags = ref([])
const selectedRows = ref([])
const filters = reactive({ keyword: '', customer_type: '', status: 'active', tag: '', page: 1, pageSize: 20 })
const warrantyAlerts = ref([])
const warrantyLoading = ref(false)
const warrantyCounts = ref({ all: 0, missing: 0, expiring: 0, expired: 0 })
const warrantyTruncated = ref(false)
const warrantyCategory = ref('')
const overviewLoading = ref(false)
const overviewUpdatedAt = ref('')
const overviewCustomers = ref([])
const maintenancePanelVisible = ref(false)
const maintenanceCustomerCount = ref(0)

const customerMetrics = computed(() => {
  const recentThreshold = Date.now() - (30 * 24 * 60 * 60 * 1000)
  const customers = overviewCustomers.value
  return [
    { key: 'all', label: '客户总数', value: customers.length, note: '有效客户档案', icon: 'User', tone: 'blue' },
    { key: 'clinic', label: '合作机构', value: customers.filter(item => item.customer_type === 'clinic').length, note: '门诊与医院客户', icon: 'HomeFilled', tone: 'green' },
    { key: 'devices', label: '设备总数', value: customers.reduce((sum, item) => sum + Number(item.device_count || 0), 0), note: '客户名下设备资产', icon: 'Box', tone: 'violet' },
    { key: 'maintenance', label: '待维护客户', value: maintenanceCustomerCount.value, note: '存在保修待办事项', icon: 'Warning', tone: 'orange' },
    { key: 'recent', label: '30天内报修', value: customers.filter(item => Number(item.last_order_time || 0) >= recentThreshold).length, note: '近期产生售后需求', icon: 'DataAnalysis', tone: 'red' }
  ]
})

const loadOverview = async () => {
  overviewLoading.value = true
  try {
    const pageSize = 100
    const customers = []
    let page = 1
    let customerTotal = 0
    do {
      const data = await listCustomers({ status: 'active', page, pageSize })
      const rows = data.list || []
      customerTotal = Number(data.total || 0)
      customers.push(...rows)
      page += 1
      if (rows.length < pageSize) break
    } while (customers.length < customerTotal && page <= 100)

    const maintenanceIds = new Set()
    let alertPage = 1
    let alertTotal = 0
    do {
      const data = await getWarrantyAlerts({ page: alertPage, pageSize })
      const rows = data.list || []
      alertTotal = Number(data.total || 0)
      rows.forEach(item => { if (item.customer_id) maintenanceIds.add(item.customer_id) })
      alertPage += 1
      if (rows.length < pageSize) break
    } while (((alertPage - 1) * pageSize) < alertTotal && alertPage <= 100)

    overviewCustomers.value = customers
    maintenanceCustomerCount.value = maintenanceIds.size
    const now = new Date()
    overviewUpdatedAt.value = `${pad(now.getHours())}:${pad(now.getMinutes())}`
  } catch (e) { /* request interceptor handles errors */ } finally { overviewLoading.value = false }
}

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
    const data = await listCustomers({ ...filters, customer_type: resolveCustomerTypeValue(filters.customer_type) })
    list.value = data.list || []
    total.value = data.total || 0
  } catch (e) { /* 拦截器已提示 */ } finally { loading.value = false }
}
const reload = () => { filters.page = 1; load() }
const onPage = (p) => { filters.page = p; load() }
const onPageSize = (size) => { filters.pageSize = size; filters.page = 1; load() }
const resetFilters = () => {
  Object.assign(filters, { keyword: '', customer_type: '', status: 'active', tag: '', page: 1 })
  load()
}
const customerInitial = (name) => String(name || '客').trim().slice(0, 1).toUpperCase()
const applyMetric = (key) => {
  if (key === 'all') resetFilters()
  else if (key === 'clinic') { filters.customer_type = 'clinic'; filters.status = 'active'; reload() }
  else if (key === 'maintenance') {
    maintenancePanelVisible.value = !maintenancePanelVisible.value
    if (maintenancePanelVisible.value) loadWarrantyAlerts()
  }
  else document.getElementById('customer-ledger-title')?.scrollIntoView({ behavior: 'smooth', block: 'start' })
}

const loadWarrantyAlerts = async () => {
  warrantyLoading.value = true
  try {
    const data = await getWarrantyAlerts({ category: warrantyCategory.value, page: 1, pageSize: 20 })
    warrantyAlerts.value = data.list || []
    warrantyCounts.value = { ...warrantyCounts.value, ...(data.counts || {}) }
    warrantyTruncated.value = Boolean(data.truncated)
  } catch (e) { /* request interceptor handles errors */ } finally { warrantyLoading.value = false }
}
const applyWarrantyRouteFilter = () => {
  const category = String(route.query.alert || '')
  warrantyCategory.value = ['missing', 'expiring', 'expired'].includes(category) ? category : ''
}

const loadPermissionConfig = async () => {
  try { permissionConfig.value = await getCustomerPermissionConfig() } catch (e) { /* keep local role fallback */ }
}
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
    reload(); loadOverview()
  } catch (e) { if (e !== 'cancel') { /* ignore */ } } finally { syncing.value = false }
}
const handleCreateCommand = (command) => { if (command === 'sync') confirmSync() }

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
  const customerType = resolveCustomerTypeValue(form.customer_type)
  if (!customerType) { ElMessage.warning('请选择或输入客户类型'); return }
  if (customerType.length > 40) { ElMessage.warning('客户类型不能超过 40 个字符'); return }
  form.customer_type = customerType
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
    load(); loadOverview()
    if (form.customer_type === 'dealer') loadDealers()
  } catch (e) { /* ignore */ } finally { saving.value = false }
}

const doCancel = async (row) => {
  try { await cancelCustomer(row._id); ElMessage.success('客户已停用'); load(); loadOverview() } catch (e) { /* ignore */ }
}
const handleRowCommand = async (command, row) => {
  if (['device', 'order', 'log'].includes(command)) { await openDetailTab(row, command); return }
  if (command !== 'cancel') return
  try {
    await ElMessageBox.confirm(`停用后“${row.name}”将不能继续关联新设备，确定停用？`, '停用客户', { type: 'warning', confirmButtonText: '确定停用' })
    await doCancel(row)
  } catch (e) { if (e !== 'cancel') { /* ignore */ } }
}

// ===== 详情抽屉 =====
const detailVisible = ref(false)
const activeTab = ref('base')
const tabLoading = ref(false)
const detailLoading = ref(false)
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
const completedOrderCount = computed(() => orderData.list.filter(order => order.status === 'completed').length)

const openDetail = async (row, targetTab = 'base') => {
  activeTab.value = targetTab
  Object.keys(detail).forEach(k => delete detail[k])
  devices.value = []; logs.value = []
  Object.assign(orderData, { list: [], total: 0, total_amount: 0 })
  detailVisible.value = true
  detailLoading.value = true
  try {
    const data = await getCustomerDetail(row._id)
    Object.assign(detail, data)
    const [deviceRows, orders] = await Promise.all([
      listCustomerDevices(row._id),
      listCustomerOrders(row._id)
    ])
    devices.value = deviceRows || []
    Object.assign(orderData, orders || {})
  } catch (e) { /* ignore */ } finally { detailLoading.value = false }
}
const openDetailTab = (row, tab) => openDetail(row, tab)

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
const deviceForm = reactive({ _id: null, product_category: '', product_name: '', model: '', sn: '', purchase_channel: '', dealer_name: '', buy_date: '', warranty_start_date: '', invoice_received_date: '', manufacture_date: '', warranty_months: null, warranty_expire: '', maintenance_cycle: '' })
const addMonthsToDate = (dateStr, months) => {
  const amount = Number(months)
  if (!dateStr || !Number.isFinite(amount) || amount <= 0) return ''
  const date = new Date(`${dateStr}T00:00:00`)
  if (Number.isNaN(date.getTime())) return ''
  const day = date.getDate()
  date.setDate(1)
  date.setMonth(date.getMonth() + amount)
  const lastDay = new Date(date.getFullYear(), date.getMonth() + 1, 0).getDate()
  date.setDate(Math.min(day, lastDay))
  const pad = (value) => String(value).padStart(2, '0')
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`
}
const addDaysToDate = (dateStr, days) => {
  if (!dateStr) return ''
  const date = new Date(`${dateStr}T00:00:00`)
  if (Number.isNaN(date.getTime())) return ''
  date.setDate(date.getDate() + Number(days || 0))
  const pad = (value) => String(value).padStart(2, '0')
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`
}

const openWarrantyAlert = async (alert) => {
  await openDetail({ _id: alert.customer_id })
  activeTab.value = 'device'
  await loadDevices()
  const device = devices.value.find(item => item._id === alert.device_id)
  if (!device) { ElMessage.warning('未找到该设备，可能已解绑'); return }
  openDevice(device)
}
const deviceWarrantyPreview = computed(() => {
  const startDate = deviceForm.invoice_received_date
    || (deviceForm.manufacture_date ? addDaysToDate(deviceForm.manufacture_date, 30) : '')
    || deviceForm.warranty_start_date
    || deviceForm.buy_date
  const expire = deviceForm.warranty_expire || addMonthsToDate(startDate, 12)
  if (!expire) {
    return { type: 'warning', label: '待补充', detail: '请填写发票签收日；无发票时填写SN出厂日，系统会顺延30天起算。' }
  }
  const active = Date.now() <= new Date(`${expire}T23:59:59`).getTime()
  return { type: active ? 'success' : 'danger', label: active ? '预计在保' : '预计过保', detail: `系统判定依据：质保截止 ${expire}` }
})
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
    warranty_start_date: row ? (row.warranty_start_date || '') : '',
    invoice_received_date: row ? (row.invoice_received_date || '') : '',
    manufacture_date: row ? (row.manufacture_date || '') : '',
    warranty_months: row && Number(row.warranty_months) > 0 ? Number(row.warranty_months) : null,
    warranty_expire: row ? (row.warranty_expire || '') : '',
    maintenance_cycle: row ? (row.maintenance_cycle || '') : ''
  })
  deviceVisible.value = true
}
const saveDevice = async () => {
  if (!deviceForm.product_name) { ElMessage.warning('请填写设备名称'); return }
  saving.value = true
  try {
    await saveCustomerDevice(detail._id, { ...deviceForm, warranty_months: 12 })
    ElMessage.success('已保存')
    deviceVisible.value = false
    loadDevices()
    loadWarrantyAlerts()
    loadOverview()
  } catch (e) { /* ignore */ } finally { saving.value = false }
}
const removeDevice = async (row) => {
  try { await deleteCustomerDevice(detail._id, row._id); ElMessage.success('已解绑'); loadDevices(); loadWarrantyAlerts(); loadOverview() } catch (e) { /* ignore */ }
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
    const PAGE_SIZE = 100
    const MAX_PAGES = 100
    const rows = []
    let pageNo = 1
    let totalCount = 0
    while (pageNo <= MAX_PAGES) {
      const data = await exportCustomers({
        keyword: filters.keyword,
        customer_type: resolveCustomerTypeValue(filters.customer_type),
        status: filters.status,
        tag: filters.tag,
        ...toApiDateRange(exportDateRange.value),
        page: pageNo,
        pageSize: PAGE_SIZE
      })
      const list = data.list || []
      totalCount = Number(data.total || 0)
      rows.push(...list)
      if (list.length < PAGE_SIZE || rows.length >= totalCount) break
      pageNo += 1
    }
    if (!rows.length) { ElMessage.warning('没有可导出的数据'); return }
    await exportCustomerWorkbook(rows)
    if (rows.length < totalCount) ElMessage.warning(`已导出 ${rows.length} 条，仍有 ${totalCount - rows.length} 条未导出，请缩小时间范围`)
    else ElMessage.success(`已导出 ${rows.length} 条`)
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
    load(); loadOverview()
  } catch (e) { /* ignore */ } finally { importing.value = false }
}

onMounted(() => {
  applyWarrantyRouteFilter()
  loadPermissionConfig(); load(); loadOverview(); loadDealers(); loadTags(); loadWarrantyAlerts()
})
watch(() => route.query.alert, () => {
  applyWarrantyRouteFilter()
  loadWarrantyAlerts()
})
</script>

<style scoped>
.customer-asset-center { min-height: 100%; color: #17233c; }
.customer-overview { margin-bottom: 16px; }
.overview-heading, .ledger-heading, .maintenance-head, .archive-section-heading { display: flex; align-items: center; justify-content: space-between; gap: 16px; }
.overview-heading { margin-bottom: 12px; }
.overview-heading h2, .ledger-heading h2, .archive-header h2 { margin: 0; color: #17233c; letter-spacing: 0; }
.overview-heading h2, .ledger-heading h2 { font-size: 18px; font-weight: 700; }
.overview-heading p, .ledger-heading p { margin: 4px 0 0; color: #7b879d; font-size: 13px; }
.overview-heading > span { color: #9aa5b8; font-size: 12px; white-space: nowrap; }
.customer-metric-grid { display: grid; grid-template-columns: repeat(5, minmax(150px, 1fr)); gap: 12px; }
.customer-metric { position: relative; min-height: 118px; padding: 18px; overflow: hidden; text-align: left; border: 1px solid #e6ebf2; border-radius: 8px; background: #fff; color: #17233c; cursor: pointer; transition: border-color .18s ease, box-shadow .18s ease, transform .18s ease; }
.customer-metric:hover { border-color: #b8cffd; box-shadow: 0 8px 22px rgba(23, 35, 60, .07); transform: translateY(-1px); }
.customer-metric:focus-visible, .asset-count:focus-visible { outline: 2px solid #246bfd; outline-offset: 2px; }
.customer-metric > span { display: block; color: #67748a; font-size: 13px; }
.customer-metric > strong { display: block; margin-top: 9px; font-size: 29px; line-height: 1; font-variant-numeric: tabular-nums; }
.customer-metric > small { display: block; margin-top: 10px; color: #8b96a9; font-size: 12px; }
.customer-metric > i { position: absolute; top: 21px; right: 18px; display: grid; width: 38px; height: 38px; place-items: center; border-radius: 50%; background: #edf3ff; color: #246bfd; font-size: 19px; font-style: normal; }
.customer-metric.is-green > i { background: #eaf8f0; color: #15803d; }
.customer-metric.is-violet > i { background: #f2efff; color: #7254d8; }
.customer-metric.is-orange > i { background: #fff3e8; color: #c56a16; }
.customer-metric.is-red > i { background: #fff0f0; color: #dc4c55; }
.customer-metric.is-orange.is-expanded { border-color: #e9a45e; background: #fffaf5; box-shadow: 0 7px 18px rgba(197, 106, 22, .11); }
.customer-metric.is-orange.is-expanded > i { background: #c56a16; color: #fff; }
.metric-toggle-cue { position: absolute; right: 17px; bottom: 12px; display: inline-flex; align-items: center; gap: 3px; color: #b45d12; font-size: 11px; font-style: normal; font-weight: 600; }
.metric-toggle-cue .el-icon { transition: transform .2s ease; }
.customer-metric.is-expanded .metric-toggle-cue .el-icon { transform: rotate(180deg); }
.customer-ledger { padding: 20px; border: 1px solid #e6ebf2; border-radius: 8px; background: #fff; }
.ledger-heading { margin-bottom: 18px; }
.title-actions { display: flex; align-items: center; justify-content: flex-end; gap: 8px; flex-wrap: wrap; }
.customer-filter-bar { display: grid; grid-template-columns: minmax(230px, 1.5fr) repeat(3, minmax(150px, .8fr)) auto auto; gap: 10px; align-items: center; padding: 14px; margin-bottom: 16px; border: 1px solid #e8edf4; border-radius: 8px; background: #f8fafc; }
.customer-search { min-width: 0; }
.maintenance-panel { margin-bottom: 16px; overflow: hidden; border: 1px solid #f2d8bd; border-radius: 8px; background: #fff; }
.maintenance-head { padding: 12px 14px; background: #fff8f1; }
.maintenance-head > div { display: flex; align-items: center; gap: 10px; flex-wrap: wrap; }
.maintenance-head strong { color: #8c4b10; font-size: 14px; }
.maintenance-head span { color: #9a6a40; font-size: 12px; }
.maintenance-reveal-enter-active, .maintenance-reveal-leave-active { overflow: hidden; transition: opacity .2s ease, transform .2s ease; }
.maintenance-reveal-enter-from, .maintenance-reveal-leave-to { opacity: 0; transform: translateY(-8px); }
.table-responsive { width: 100%; overflow-x: auto; }
.modern-table { min-width: 1030px; }
.modern-table :deep(.el-table__inner-wrapper::before) { display: none; }
.modern-table :deep(th.el-table__cell) { height: 44px; background-color: #f4f7fb !important; color: #5e6b80; font-weight: 600; border-bottom: 1px solid #e7ecf3; }
.modern-table :deep(td.el-table__cell) { border-bottom: 1px solid #edf0f5; padding: 13px 0; }
.modern-table :deep(.el-table__row:hover > td.el-table__cell) { background: #f8fbff; }
.customer-identity { display: flex; align-items: center; min-width: 0; gap: 11px; }
.customer-avatar { display: grid; width: 36px; height: 36px; flex: 0 0 36px; place-items: center; border-radius: 50%; background: #eaf1ff; color: #246bfd; font-size: 14px; font-weight: 700; }
.customer-avatar.is-large { width: 48px; height: 48px; flex-basis: 48px; font-size: 18px; }
.customer-identity > div { min-width: 0; }
.customer-identity strong { display: block; overflow: hidden; color: #17233c; font-size: 14px; text-overflow: ellipsis; white-space: nowrap; }
.customer-identity > div > span { display: flex; align-items: center; gap: 5px; min-height: 23px; margin-top: 4px; }
.customer-identity small { color: #8b96a9; }
.contact-cell { display: flex; flex-direction: column; gap: 4px; }
.contact-cell strong { color: #34415a; font-size: 13px; font-weight: 600; }
.contact-cell span { color: #7b879d; font-size: 12px; }
.asset-count { padding: 0; border: 0; background: transparent; color: #246bfd; cursor: pointer; }
.asset-count strong { margin-right: 4px; font-size: 17px; font-variant-numeric: tabular-nums; }
.asset-count span { font-size: 12px; }
.order-count { display: block; margin-top: 4px; color: #8b96a9; font-size: 12px; }
.last-service { color: #4d5a70; font-size: 13px; font-variant-numeric: tabular-nums; }
.customer-status { display: inline-flex; align-items: center; gap: 6px; color: #15803d; font-size: 12px; font-weight: 600; }
.customer-status::before { width: 7px; height: 7px; border-radius: 50%; background: currentColor; content: ''; }
.customer-status.disabled { color: #8b96a9; }
.table-empty-guide { display: flex; min-height: 170px; flex-direction: column; align-items: center; justify-content: center; gap: 7px; }
.table-empty-guide strong { color: #34415a; }
.table-empty-guide span { color: #8b96a9; font-size: 13px; }
.pager { display: flex; justify-content: flex-end; margin-top: 16px; }
.archive-header { display: flex; align-items: center; gap: 13px; min-width: 0; }
.archive-identity { min-width: 0; }
.archive-identity > div { display: flex; align-items: center; gap: 8px; flex-wrap: wrap; }
.archive-identity h2 { max-width: 620px; overflow: hidden; font-size: 20px; text-overflow: ellipsis; white-space: nowrap; }
.archive-identity p { margin: 5px 0; color: #667389; font-size: 13px; }
.archive-identity > div:last-child > span { color: #8b96a9; font-size: 12px; }
.archive-summary { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); margin-bottom: 16px; border: 1px solid #e5eaf2; border-radius: 8px; background: #f8fafc; }
.archive-summary > div { padding: 14px 16px; border-right: 1px solid #e5eaf2; }
.archive-summary > div:last-child { border-right: 0; }
.archive-summary span { display: block; margin-bottom: 6px; color: #7b879d; font-size: 12px; }
.archive-summary strong { color: #17233c; font-size: 22px; font-variant-numeric: tabular-nums; }
.archive-summary strong.is-date { font-size: 15px; }
.archive-summary small { margin-left: 3px; color: #7b879d; }
.archive-tabs :deep(.el-tabs__header) { margin-bottom: 18px; }
.archive-section-heading { margin-bottom: 12px; }
.archive-section-heading > div { display: flex; flex-direction: column; gap: 3px; }
.archive-section-heading strong { color: #25324a; font-size: 14px; }
.archive-section-heading span { color: #8b96a9; font-size: 12px; }
.archive-descriptions :deep(.el-descriptions__label) { width: 112px; color: #667389; }
.tab-toolbar { margin-bottom: 12px; }
.asset-summary { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 10px; margin-bottom: 12px; }
.asset-summary div { padding: 10px 12px; border: 1px solid #e5eaf2; border-radius: 8px; background: #f8fafc; }
.asset-summary span { display: block; margin-bottom: 4px; color: #7b879d; font-size: 12px; }
.asset-summary b { color: #17233c; font-size: 18px; }
.order-summary { margin-bottom: 12px; color: #4e5969; }
.order-summary b { color: #f56c6c; }
.text-danger { color: #f56c6c; font-weight: 600; }
.batch-bar { display: flex; align-items: center; gap: 10px; padding: 10px 14px; margin-bottom: 12px; border-radius: 8px; background: #edf4ff; color: #4e5969; }
.batch-bar b { color: #246bfd; }
.row-tag { margin-right: 4px; margin-bottom: 2px; }
.customer-type-cell-tag { max-width: 100%; }
.customer-type-cell-tag :deep(.el-tag__content) { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.muted { color: #909399; font-size: 13px; }
.tag-add-row { display: flex; gap: 8px; margin-bottom: 14px; flex-wrap: wrap; }
.import-tip { display: flex; align-items: center; gap: 8px; margin-bottom: 12px; }
.import-result { margin-top: 12px; }
.warranty-form-block { margin: 6px 0 18px; padding: 14px 14px 2px; border: 1px solid #e5eaf2; border-radius: 8px; background: #f8fafc; }
.warranty-form-head { display: flex; align-items: center; justify-content: space-between; gap: 12px; margin-bottom: 6px; color: #1d2129; font-size: 14px; }
.warranty-form-block > p { margin: 0 0 14px; color: #4e5969; font-size: 12px; line-height: 1.6; }
.warranty-preview { margin: -6px 0 12px 100px; color: #4e5969; font-size: 12px; line-height: 1.5; }

@media (max-width: 1280px) {
  .customer-metric-grid { grid-template-columns: repeat(3, minmax(160px, 1fr)); }
  .customer-filter-bar { grid-template-columns: repeat(3, minmax(150px, 1fr)); }
  .customer-search { grid-column: span 2; }
}
@media (max-width: 760px) {
  .overview-heading, .ledger-heading, .maintenance-head { align-items: flex-start; flex-direction: column; }
  .customer-metric-grid { grid-template-columns: repeat(2, minmax(0, 1fr)); }
  .customer-metric { min-height: 108px; padding: 14px; }
  .customer-metric:last-child { grid-column: span 2; }
  .customer-ledger { padding: 14px; }
  .title-actions { justify-content: flex-start; }
  .customer-filter-bar { grid-template-columns: 1fr 1fr; padding: 10px; }
  .customer-search { grid-column: span 2; }
  .archive-summary, .asset-summary { grid-template-columns: 1fr 1fr; }
  .archive-summary > div:nth-child(2) { border-right: 0; }
  .archive-summary > div:nth-child(-n + 2) { border-bottom: 1px solid #e5eaf2; }
  .archive-identity h2 { max-width: 64vw; }
}
@media (prefers-reduced-motion: reduce) {
  .customer-metric { transition: none; }
  .customer-metric:hover { transform: none; }
  .metric-toggle-cue .el-icon, .maintenance-reveal-enter-active, .maintenance-reveal-leave-active { transition: none; }
}
</style>
