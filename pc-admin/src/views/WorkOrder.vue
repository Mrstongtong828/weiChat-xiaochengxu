<template>
  <div class="glass-card">
    <div class="page-header">
      <div>
        <h2 class="page-title">报修工单管理</h2>
        <p class="page-subtitle">集中处理客户寄修、检测报价、付款核销、回寄发货和结案。</p>
      </div>
      <div class="header-stats">
        <div class="stat-item stat-pending">
          <span class="stat-label">待处理</span>
          <span class="stat-value">{{ orders.filter(o => pendingAdminStatuses.includes(o.status)).length }}</span>
          <small>待签收/初处理</small>
        </div>
        <div class="stat-item stat-processing">
          <span class="stat-label">处理中</span>
          <span class="stat-value">{{ orders.filter(o => o.status === '处理中').length }}</span>
          <small>检测或维修中</small>
        </div>
        <div class="stat-item stat-shipped">
          <span class="stat-label">已回寄</span>
          <span class="stat-value">{{ orders.filter(o => o.status === '已回寄').length }}</span>
          <small>待客户签收</small>
        </div>
        <div class="stat-item stat-completed">
          <span class="stat-label">已完成</span>
          <span class="stat-value">{{ orders.filter(o => o.status === '已完成').length }}</span>
          <small>已结案</small>
        </div>
      </div>
    </div>

    <div class="control-panel">
      <div class="panel-block">
        <div class="panel-head">
          <div>
            <span class="panel-title">查询筛选</span>
            <p>按客户、设备、状态快速定位工单。</p>
          </div>
          <el-tag v-if="activeTodoType" type="warning" closable @close="clearTodoFilter">
            {{ activeTodoLabel }}
          </el-tag>
        </div>
        <div class="filter-container">
          <el-input v-model="wo.search" placeholder="搜索姓名/手机号/设备号" clearable prefix-icon="Search"></el-input>
          <el-select v-model="wo.filter" placeholder="工单状态" clearable>
            <el-option v-for="status in adminStatusOptions" :key="status" :label="status" :value="status"></el-option>
          </el-select>
          <el-select v-model="wo.deviceFilter" placeholder="设备型号" clearable>
            <el-option v-for="device in deviceModels" :key="device" :label="device" :value="device"></el-option>
          </el-select>
          <el-select v-model="searchInvoiceStatus" placeholder="发票状态">
            <el-option label="全部" value=""></el-option>
            <el-option label="无需开票" value="无需开票"></el-option>
            <el-option label="未发票" value="未发票"></el-option>
            <el-option label="已发票" value="已发票"></el-option>
          </el-select>
          <el-select v-model="wo.warrantyFilter" placeholder="在保状态" clearable>
            <el-option label="全部" value=""></el-option>
            <el-option label="在保" value="in_warranty"></el-option>
            <el-option label="已过保" value="expired"></el-option>
          </el-select>
          <el-select v-model="slaFilter" placeholder="SLA 超时" clearable>
            <el-option label="全部" value=""></el-option>
            <el-option label="已超时" value="overdue"></el-option>
            <el-option label="严重超时" value="critical"></el-option>
            <el-option label="临近超时" value="warning"></el-option>
          </el-select>
        </div>
      </div>

      <div class="panel-block">
        <div class="panel-head">
          <div>
            <span class="panel-title">批量工具</span>
            <p>适合批量签收、回寄发货、打印和导出。</p>
          </div>
          <el-tag v-if="selectedOrders.length" type="primary" effect="plain">已选 {{ selectedOrders.length }} 单</el-tag>
        </div>
        <div class="toolbar-actions">
          <el-tooltip content="物流批量导入（签收单/回寄单）已统一到「物流管理」" placement="top">
            <el-button type="primary" plain class="top-btn-text" @click="$router.push('/logistics?tab=import')"><el-icon><Van /></el-icon> 物流批量导入</el-button>
          </el-tooltip>
          <el-tooltip content="打印已勾选工单的维修/回寄单据" placement="top">
            <el-button plain class="top-btn-text" :disabled="!selectedOrders.length" @click="handleConfiguredBatchPrint"><el-icon><Printer /></el-icon> 批量打印</el-button>
          </el-tooltip>
          <el-tooltip content="把已选且允许流转的工单标记为处理中" placement="top">
            <el-button
              type="warning"
              plain
              class="top-btn-text"
              :disabled="!getTransitionableOrders('处理中').length || batchCompleting"
              :loading="batchCompleting"
              @click="handleBatchProcessing"
            >
              <el-icon><CircleCheck /></el-icon> 标记处理中
            </el-button>
          </el-tooltip>
          <span class="risk-actions">
            <el-tooltip content="高风险操作：结单前会二次确认影响数量和跳过原因" placement="top">
              <el-button
                type="danger"
                plain
                class="top-btn-text"
                :disabled="!getTransitionableOrders('已完成').length || batchCompleting"
                :loading="batchCompleting"
                @click="handleBatchComplete"
              >
                <el-icon><CircleCheck /></el-icon> 批量结单
              </el-button>
            </el-tooltip>
          </span>
          <el-tooltip content="按当前筛选条件导出工单表格" placement="top">
            <el-button type="primary" class="top-btn-text" @click="openExportDialog"><el-icon><Download /></el-icon> 导出</el-button>
          </el-tooltip>
        </div>
      </div>
    </div>

    <div class="sla-board">
      <button
        v-for="item in slaCards"
        :key="item.key"
        type="button"
        class="sla-card"
        :class="[`sla-card--${item.tone}`, { active: slaFilter === item.filter }]"
        @click="applySlaFilter(item.filter)"
      >
        <span>{{ item.label }}</span>
        <strong>{{ item.count }}</strong>
        <small>{{ item.desc }}</small>
      </button>
    </div>

    <div class="info-banner">
      <div class="banner-icon">
        <el-icon :size="20"><InfoFilled /></el-icon>
      </div>
      <div class="banner-content">
        <div class="banner-title">批量导入物流状态 → 已移至「物流管理」</div>
        <div class="banner-desc">签收单（客户寄入→已签收）和回寄单（后台发货→已回寄）的批量导入，请到「物流管理 · 批量导入」操作。</div>
      </div>
      <div class="banner-badge"><el-tag type="info" effect="plain" round>按工单编号匹配</el-tag></div>
    </div>

    <div class="table-responsive">
      <el-table :data="pagedOrders" class="modern-table" style="width: 100%" @selection-change="handleSelectionChange">
        <template #empty>
          <div class="table-empty-guide">
            <strong>暂无匹配工单</strong>
            <span>可以调整筛选条件，或让客户从小程序提交报修；物流批量单据请到「物流管理 · 批量导入」更新。</span>
          </div>
        </template>
        <el-table-column type="selection" width="42"></el-table-column>
        <el-table-column prop="id" label="工单编号" width="150" show-overflow-tooltip></el-table-column>

        <el-table-column label="报修方信息" width="180">
          <template #default="{row}">
            <div class="clinic-name">{{ row.clinicName }}</div>
            <div class="customer-name">{{ row.customerName }}</div>
            <div class="phone-number">{{ row.phone }}</div>
          </template>
        </el-table-column>

        <el-table-column label="设备与故障" width="200">
          <template #default="{row}">
            <div class="product-model">{{ row.itemsSummary || row.productModel }}</div>
            <el-tag v-if="warrantyTagMeta(row.warrantyStatus)" :type="warrantyTagMeta(row.warrantyStatus).type" effect="light" round size="small" class="warranty-tag">
              {{ warrantyTagMeta(row.warrantyStatus).label }}
            </el-tag>
            <div class="fault-desc">{{ row.fault }}</div>
          </template>
        </el-table-column>

        <el-table-column label="物流信息" width="220">
          <template #default="{row}">
            <div class="logistics-info">
              <span class="logistics-label">寄出：</span>{{ row.senderAddress || '-' }}
            </div>
            <div class="logistics-info">
              <span class="logistics-label">回寄：</span>{{ row.returnNo ? `${row.returnCompany || '物流'} ${row.returnNo}` : row.returnAddress || '-' }}
            </div>
          </template>
        </el-table-column>

        <el-table-column width="126">
          <template #header>
            <el-tooltip content="按当前状态、报价、付款和物流自动判断后台下一步要做什么" placement="top">
              <span class="table-header-help">下一步动作</span>
            </el-tooltip>
          </template>
          <template #default="{row}">
            <div class="next-action-cell">
              <el-tag :type="getNextAction(row).type" effect="light" round size="small">
                {{ getNextAction(row).label }}
              </el-tag>
              <span>{{ getNextAction(row).desc }}</span>
            </div>
          </template>
        </el-table-column>

        <el-table-column width="130">
          <template #header>
            <el-tooltip content="可点击状态标签快速推进工单进度" placement="top">
              <span class="table-header-help">处理状态</span>
            </el-tooltip>
          </template>
          <template #default="{row}">
            <el-dropdown trigger="click" :disabled="!getAllowedStatusOptions(row).length" @command="status => handleQuickStatusChange(row, status)">
              <span class="status-dropdown-trigger">
                <el-tag
                  :class="'status-tag status-' + row.status"
                  :type="getStatusType(row.status)"
                  effect="light"
                  round
                  size="small">
                  {{ row.status }} <span v-if="getAllowedStatusOptions(row).length" class="status-dropdown-caret">▾</span>
                </el-tag>
              </span>
              <template #dropdown>
                <el-dropdown-menu>
                  <el-dropdown-item v-for="status in getAllowedStatusOptions(row)" :key="status" :command="status">{{ status }}</el-dropdown-item>
                </el-dropdown-menu>
              </template>
            </el-dropdown>
            <div class="update-time" :class="{ 'is-overdue': getStatusDwell(row).level === 'warning' }">
              {{ getStatusDwell(row).text }}
            </div>
          </template>
        </el-table-column>

        <el-table-column width="110">
          <template #header>
            <el-tooltip content="仅展示财务开票状态，开票登记在处理抽屉内完成" placement="top">
              <span class="table-header-help">发票状态</span>
            </el-tooltip>
          </template>
          <template #default="{row}">
            <el-tag
              :class="'invoice-tag invoice-' + normalizeInvoiceStatus(row)"
              :type="getInvoiceType(normalizeInvoiceStatus(row))"
              effect="light"
              round
              size="small">
              {{ normalizeInvoiceStatus(row) }}
            </el-tag>
          </template>
        </el-table-column>

        <el-table-column width="126">
          <template #header>
            <el-tooltip content="按当前状态停留时间和 SLA 阈值标记超时程度" placement="top">
              <span class="table-header-help">SLA</span>
            </el-tooltip>
          </template>
          <template #default="{row}">
            <div class="sla-cell" :class="'sla-cell--' + getSlaLevel(row)">
              <el-tag :type="getSlaTagType(row)" effect="light" round size="small">
                {{ getSlaLabel(row) }}
              </el-tag>
              <span>{{ getSlaText(row) }}</span>
            </div>
          </template>
        </el-table-column>

        <el-table-column label="操作" width="128" fixed="right" align="right">
          <template #default="{row}">
            <div class="operation-actions">
              <el-tooltip content="打开工单详情，处理报价、付款、物流、发票和结案" placement="top">
                <el-button type="primary" link @click="openDrawer(row)">处理</el-button>
              </el-tooltip>
              <el-tooltip v-if="canPerformOrderAction('update_remarks')" :content="getRemarkTooltip(row)" placement="top">
                <el-button
                  type="primary"
                  link
                  class="remark-button"
                  :class="{ 'has-remark': hasRemark(row) }"
                  @click="openRemarkDialog(row)"
                >
                  备注
                </el-button>
              </el-tooltip>
            </div>
          </template>
        </el-table-column>
      </el-table>
    </div>

    <div style="display:flex;justify-content:flex-end;margin-top:20px; overflow-x: auto;">
      <el-pagination
        v-model:current-page="wo.page"
        v-model:page-size="wo.pageSize"
        :page-sizes="[10, 20, 50, 100]"
        :total="totalOrders"
        layout="sizes, prev, pager, next, total"
        background>
      </el-pagination>
    </div>
  </div>

  <el-drawer v-model="drawerVisible" title="报修工单处理" direction="rtl" :size="isMobile ? '100%' : '560px'">
    <template v-if="currentOrder">
      <div class="drawer-body">
        <div class="drawer-order-head">
          <span style="font-size:16px; font-weight:600; color:#1d2129;">{{currentOrder.id}}</span>
          <el-tag :class="'status-tag status-' + currentOrder.status" :type="getStatusType(currentOrder.status)" effect="light">{{currentOrder.status}}</el-tag>
        </div>
        <el-tabs class="drawer-tabs">
          <el-tab-pane label="基础信息">
            <div class="drawer-section customer-section">
              <p class="drawer-section-title">客户信息</p>
              <div class="drawer-info-grid">
                <div class="drawer-info-item">
                  <span>客户姓名</span>
                  <strong>{{currentOrder.customerName || '-'}}</strong>
                </div>
                <div class="drawer-info-item">
                  <span>联系电话</span>
                  <strong class="mono-text">{{currentOrder.phone || '-'}}</strong>
                </div>
                <div class="drawer-info-item is-wide">
                  <span>单位/诊所</span>
                  <strong>{{currentOrder.clinicName || '-'}}</strong>
                </div>
                <div class="drawer-info-item is-wide">
                  <span>回寄地址</span>
                  <strong>{{currentOrder.address || '-'}}</strong>
                </div>
                <div class="drawer-info-item is-wide">
                  <span>关联用户ID</span>
                  <strong class="mono-text">{{currentOrder.userId || '-'}}</strong>
                </div>
              </div>
            </div>
            <div class="drawer-section">
              <p class="drawer-section-title">工单信息</p>
              <p>工单编号：{{currentOrder.id}}</p>
              <p>提交时间：{{currentOrder.submitTime || '-'}}</p>
              <p>更新时间：{{currentOrder.updateTime || '-'}}</p>
              <p>当前状态：<el-tag :class="'status-tag status-' + currentOrder.status" :type="getStatusType(currentOrder.status)" effect="light" size="small">{{currentOrder.status}}</el-tag> <span class="inline-muted">{{ getStatusDwell(currentOrder).text }}</span></p>
              <div class="assign-engineer-row">
                <span>负责工程师：</span>
                <template v-if="canPerformOrderAction('manage_staff')">
                  <el-select
                    v-model="assignEngineerId"
                    :placeholder="engineerOptions.length ? '选择工程师' : '暂无工程师账号'"
                    :disabled="!engineerOptions.length"
                    size="small"
                    style="width: 180px;"
                  >
                    <el-option v-for="item in engineerOptions" :key="item._id" :label="item.name || item.username" :value="item._id" />
                  </el-select>
                  <el-button
                    type="primary"
                    size="small"
                    :loading="assigningEngineer"
                    :disabled="!assignEngineerId || assignEngineerId === currentOrder.engineerId"
                    @click="submitAssignEngineer"
                  >指派</el-button>
                  <span v-if="!engineerOptions.length" class="inline-muted">请先在员工管理添加工程师角色账号</span>
                </template>
                <strong v-else>{{ engineerDisplayName(currentOrder.engineerId) }}</strong>
              </div>
            </div>
            <div class="drawer-section">
              <p class="drawer-section-title">寄入物流</p>
              <div class="drawer-info-grid">
                <div class="drawer-info-item">
                  <span>寄件人</span>
                  <strong>{{currentOrder.senderName || currentOrder.customerName || '-'}}</strong>
                </div>
                <div class="drawer-info-item">
                  <span>寄件电话</span>
                  <strong class="mono-text">{{currentOrder.senderPhone || currentOrder.phone || '-'}}</strong>
                </div>
                <div class="drawer-info-item">
                  <span>物流公司</span>
                  <strong>{{currentOrder.logisticsCompany || '-'}}</strong>
                </div>
                <div class="drawer-info-item">
                  <span>物流单号</span>
                  <strong class="mono-text">{{currentOrder.logisticsNo || '-'}}</strong>
                </div>
                <div class="drawer-info-item is-wide">
                  <span>寄出地址</span>
                  <strong>{{currentOrder.senderAddress || '-'}}</strong>
                </div>
              </div>
            </div>
          </el-tab-pane>
          <el-tab-pane label="检测/报价">
            <div class="drawer-section">
              <p class="drawer-section-title">检测产品与故障</p>
              <div v-if="currentOrder.itemsList && currentOrder.itemsList.length" class="product-detail-list">
                <div v-for="(item, itemIndex) in currentOrder.itemsList" :key="item._id || itemIndex" class="product-detail-card">
                  <div class="product-card-title">产品 {{ itemIndex + 1 }}：{{ item.product_name || '未命名产品' }}</div>
                  <div class="sn-edit-row">
                    <span class="sn-edit-label">SN：</span>
                    <el-input v-model="item.sn" placeholder="输入 SN 序列号" size="small" class="sn-edit-input" @blur="lookupOrderItemSn(itemIndex)" @keyup.enter="lookupOrderItemSn(itemIndex, true)" />
                    <el-button size="small" type="primary" :loading="snLookupLoading[itemIndex]" @click="lookupOrderItemSn(itemIndex, true)">查询</el-button>
                    <el-tag v-if="warrantyTagMeta(snItemWarranty(itemIndex))" :type="warrantyTagMeta(snItemWarranty(itemIndex)).type" size="small" effect="light" round>
                      {{ warrantyTagMeta(snItemWarranty(itemIndex)).label }}
                    </el-tag>
                  </div>
                  <div class="sn-fields-grid">
                    <el-input v-model="item.product_category" placeholder="设备分类" size="small" />
                    <el-input v-model="item.product_model" placeholder="设备型号" size="small" />
                    <el-date-picker v-model="item.buy_date" type="date" value-format="YYYY-MM-DD" placeholder="采购日期" size="small" style="width:100%;" />
                  </div>
                  <p v-if="snLookupResults[itemIndex] && snLookupResults[itemIndex].warrantyExpire" class="sn-warranty-expire">质保至：{{ snLookupResults[itemIndex].warrantyExpire }}</p>
                  <el-button v-if="snLookupResults[itemIndex] && snLookupResults[itemIndex].history && snLookupResults[itemIndex].history.length" type="primary" link size="small" @click="openSnHistory(itemIndex)">
                    查看该设备历史工单（{{ snLookupResults[itemIndex].history.length }}）›
                  </el-button>
                  <p>故障描述：{{item.fault_desc || '-'}}</p>
                  <template v-if="item.voucher_urls && item.voucher_urls.length">
                    <p class="attachment-title">购买凭证：</p>
                    <div class="attachment-list">
                      <el-image v-for="(img, index) in item.voucher_urls" :key="`voucher-${itemIndex}-${index}`" :src="img" :preview-src-list="item.voucher_urls" class="attachment-thumb" fit="cover"></el-image>
                    </div>
                  </template>
                  <template v-if="item.image_urls && item.image_urls.length">
                    <p class="attachment-title">故障图片：</p>
                    <div class="attachment-list">
                      <el-image v-for="(img, index) in item.image_urls" :key="`image-${itemIndex}-${index}`" :src="img" :preview-src-list="item.image_urls" class="attachment-thumb" fit="cover"></el-image>
                    </div>
                  </template>
                  <template v-if="item.video_urls && item.video_urls.length">
                    <p class="attachment-title">故障视频：</p>
                    <div class="attachment-list">
                      <a v-for="(video, index) in item.video_urls" :key="`video-${itemIndex}-${index}`" :href="video" target="_blank" rel="noreferrer" class="video-link">视频 {{ index + 1 }}</a>
                    </div>
                  </template>
                  <template v-if="item.media_urls && item.media_urls.length">
                    <p class="attachment-title">历史附件：</p>
                    <div class="attachment-list">
                      <a v-for="(url, index) in item.media_urls" :key="`media-${itemIndex}-${index}`" :href="url" target="_blank" rel="noreferrer" class="video-link">附件 {{ index + 1 }}</a>
                    </div>
                  </template>
                </div>
                <div class="product-detail-actions">
                  <el-button size="small" type="primary" :loading="savingOrderItems" @click="saveOrderItemsInfo">保存设备信息</el-button>
                  <span class="product-detail-tip">录入/扫码 SN 后点【查询】自动回填分类、型号、采购日期与在保状态，保存后写入工单。</span>
                </div>
              </div>
              <p v-else class="empty-text">暂无产品明细</p>
            </div>
            <div class="drawer-section quote-editor-section">
              <div class="drawer-section-head">
                <p class="drawer-section-title">维修报价</p>
                <el-tag :type="getQuoteStatusType(quoteForm.status)" size="small">{{ getQuoteStatusText(quoteForm.status) }}</el-tag>
              </div>
              <el-alert
                v-if="currentOrderWarrantyHint.show"
                :title="currentOrderWarrantyHint.text"
                :type="currentOrderWarrantyHint.type"
                :closable="false"
                show-icon
                class="quote-warranty-alert"
              ></el-alert>
              <div class="quote-summary-bar">
                <div><span>配件费</span><strong>{{ formatMoney(quotePartsFee) }}</strong></div>
                <div><span>服务费</span><strong>{{ formatMoney(quoteServicesFee) }}</strong></div>
                <div><span>其他费</span><strong>{{ formatMoney(quoteOthersFee) }}</strong></div>
                <div><span>自动合计</span><strong>{{ formatMoney(quoteAutoTotal) }}</strong></div>
                <div><span>最终报价</span><strong class="quote-total">{{ formatMoney(quoteTotal) }}</strong></div>
              </div>
              <el-alert
                v-if="quoteInventoryWarnings.length"
                class="quote-inventory-alert"
                type="warning"
                show-icon
                :closable="false"
                :title="quoteInventoryWarnings.join('；')"
              ></el-alert>
              <div class="quote-section">
                <div class="quote-section-head">
                  <span>配件费用</span>
                  <el-button v-if="canPerformOrderAction('issue_quote')" type="primary" link @click="openPartPicker">添加配件</el-button>
                </div>
                <div v-for="(item, index) in quoteForm.parts" :key="item.localId" class="quote-row-grid quote-row-grid--parts">
                  <el-input v-model="item.partCode" :disabled="!canPerformOrderAction('issue_quote')" placeholder="配件编号"></el-input>
                  <el-input v-model="item.name" :disabled="!canPerformOrderAction('issue_quote')" placeholder="配件名称"></el-input>
                  <el-input v-model="item.model" :disabled="!canPerformOrderAction('issue_quote')" placeholder="型号"></el-input>
                  <el-tag effect="plain" :type="getQuotePartStockType(item)">库存 {{ item.stock ?? '-' }}</el-tag>
                  <el-input-number v-model="item.unitPrice" :disabled="!canPerformOrderAction('issue_quote')" :min="0" :precision="2" :step="10" controls-position="right" placeholder="单价"></el-input-number>
                  <el-input-number v-model="item.quantity" :disabled="!canPerformOrderAction('issue_quote')" :min="0" :precision="0" :step="1" controls-position="right" placeholder="数量"></el-input-number>
                  <strong>{{ formatMoney(getQuoteRowAmount(item)) }}</strong>
                  <el-button type="danger" link :disabled="!canPerformOrderAction('issue_quote') || quoteForm.parts.length <= 1" @click="removeQuoteRow('parts', index)">删除</el-button>
                </div>
              </div>
              <div class="quote-section">
                <div class="quote-section-head">
                  <span>服务费用</span>
                  <el-button v-if="canPerformOrderAction('issue_quote')" type="primary" link @click="addQuoteRow('services')">添加服务</el-button>
                </div>
                <div v-for="(item, index) in quoteForm.services" :key="item.localId" class="quote-row-grid quote-row-grid--services">
                  <el-select
                    v-if="canPerformOrderAction('issue_quote') && feeTiers.length"
                    :model-value="''"
                    placeholder="预设服务项目"
                    @change="(v) => applyFeeTier(item, v)"
                  >
                    <el-option v-for="(t, i) in feeTiers" :key="i" :label="`${t.name}　¥${t.price}${t.unit ? '/' + t.unit : ''}`" :value="i" />
                  </el-select>
                  <el-input v-else v-model="item.name" :disabled="!canPerformOrderAction('issue_quote')" placeholder="服务项目"></el-input>
                  <el-input v-model="item.productCategory" :disabled="!canPerformOrderAction('issue_quote')" placeholder="产品分类"></el-input>
                  <el-input-number v-model="item.unitPrice" :disabled="!canPerformOrderAction('issue_quote')" :min="0" :precision="2" :step="10" controls-position="right" placeholder="单价"></el-input-number>
                  <el-input-number v-model="item.quantity" :disabled="!canPerformOrderAction('issue_quote')" :min="0" :precision="0" :step="1" controls-position="right" placeholder="数量"></el-input-number>
                  <strong>{{ formatMoney(getQuoteRowAmount(item)) }}</strong>
                  <el-button type="danger" link :disabled="!canPerformOrderAction('issue_quote') || quoteForm.services.length <= 1" @click="removeQuoteRow('services', index)">删除</el-button>
                </div>
              </div>
              <div class="quote-section">
                <div class="quote-section-head">
                  <span>其他费用</span>
                  <el-button v-if="canPerformOrderAction('issue_quote')" type="primary" link @click="addQuoteRow('others')">添加其他费用</el-button>
                </div>
                <div v-for="(item, index) in quoteForm.others" :key="item.localId" class="quote-row-grid quote-row-grid--others">
                  <el-input v-model="item.name" :disabled="!canPerformOrderAction('issue_quote')" placeholder="费用名称"></el-input>
                  <el-input-number v-model="item.unitPrice" :disabled="!canPerformOrderAction('issue_quote')" :min="0" :precision="2" :step="10" controls-position="right" placeholder="单价"></el-input-number>
                  <el-input-number v-model="item.quantity" :disabled="!canPerformOrderAction('issue_quote')" :min="0" :precision="0" :step="1" controls-position="right" placeholder="数量"></el-input-number>
                  <strong>{{ formatMoney(getQuoteRowAmount(item)) }}</strong>
                  <el-button type="danger" link :disabled="!canPerformOrderAction('issue_quote')" @click="removeQuoteRow('others', index)">删除</el-button>
                </div>
              </div>
              <div class="quote-final-row">
                <span>最终报价</span>
                <el-input-number v-model="quoteForm.finalPrice" :disabled="!canPerformOrderAction('issue_quote')" :min="0" :precision="2" :step="10" controls-position="right" placeholder="默认等于自动合计"></el-input-number>
              </div>
              <div class="quote-final-row">
                <span>维修质保(月)</span>
                <el-input-number v-model="quoteForm.warrantyMonths" :disabled="!canPerformOrderAction('issue_quote')" :min="0" :max="60" :step="1" controls-position="right" placeholder="0=沿用全局质保政策"></el-input-number>
              </div>
              <div class="quote-final-row">
                <span>付款期限(天)</span>
                <el-input-number v-model="quoteForm.paymentDeadlineDays" :disabled="!canPerformOrderAction('issue_quote')" :min="1" :max="60" :step="1" controls-position="right"></el-input-number>
                <span class="quote-deadline-hint">发布报价时起算，默认 7 天</span>
              </div>
              <div class="remark-field remark-field--customer">
                <div class="remark-field-head">
                  <strong>客户可见报价备注</strong>
                  <span>会展示在小程序报价详情中</span>
                </div>
                <el-input
                  v-model="quoteForm.remark"
                  :disabled="!canPerformOrderAction('issue_quote')"
                  type="textarea"
                  :rows="2"
                  maxlength="200"
                  show-word-limit
                  placeholder="报价备注（客户可见，可填写付款说明或费用说明）"
                ></el-input>
              </div>
              <div v-if="canPerformOrderAction('issue_quote')" class="quote-actions">
                <el-tooltip content="仅后台保存，客户小程序暂不可见" placement="top">
                  <el-button :loading="quoteSaving" @click="saveOrderQuote('draft')">保存草稿</el-button>
                </el-tooltip>
                <el-tooltip content="发布后客户可见报价，并进入确认/付款流程" placement="top">
                  <el-button type="primary" :loading="quoteSaving" @click="saveOrderQuote('issued')">发布报价</el-button>
                </el-tooltip>
              </div>
              <p class="quote-tip">发布后，客户小程序的“费用与发票”会展示该金额，并允许客户确认费用、上传付款凭证。</p>
            </div>
          </el-tab-pane>
          <el-tab-pane label="付款/发票">
            <div class="drawer-section payment-section">
              <div class="drawer-section-head">
                <p class="drawer-section-title">付款核销</p>
                <el-tag :type="getPaymentStatusType(currentOrder)" size="small">{{ getPaymentStatusText(currentOrder) }}</el-tag>
              </div>
              <div class="payment-status-grid">
                <div>
                  <span>客户确认</span>
                  <strong>{{ getAuthorizationStatusText(currentOrder.authorizationStatus) }}</strong>
                </div>
                <div>
                  <span>应收金额</span>
                  <strong>{{ formatMoney(currentOrder.totalPrice) }}</strong>
                </div>
                <div>
                  <span>付款状态</span>
                  <strong>{{ getPaymentStatusText(currentOrder) }}</strong>
                </div>
              </div>
              <div v-if="canPerformOrderAction('view_payment_proof') && currentOrder.paymentProofs && currentOrder.paymentProofs.length" class="payment-proof-list">
                <div v-for="(proof, index) in currentOrder.paymentProofs" :key="proof.id || proof.url || proof.fileID || index" class="payment-proof-card">
                  <el-image
                    v-if="isPreviewableProof(proof)"
                    :src="getProofUrl(proof)"
                    :preview-src-list="getPaymentPreviewList(currentOrder.paymentProofs)"
                    class="payment-proof-thumb"
                    fit="cover"
                  ></el-image>
                  <div v-else class="payment-proof-placeholder">凭证</div>
                  <div class="payment-proof-info">
                    <strong>付款凭证 {{ index + 1 }}</strong>
                    <span>{{ formatProofTime(proof.time || proof.create_time) || '客户已上传' }}</span>
                    <a v-if="getProofUrl(proof)" :href="getProofUrl(proof)" target="_blank" rel="noreferrer">查看原文件</a>
                    <span v-else class="empty-text">暂无可访问链接</span>
                  </div>
                </div>
              </div>
              <p v-else-if="canPerformOrderAction('view_payment_proof')" class="empty-text">客户还未上传付款凭证。</p>
              <p v-else class="empty-text">当前角色不可查看付款凭证。</p>
              <div class="payment-actions">
                <el-tooltip
                  v-if="resolvePaymentStatus(currentOrder) === 'uploaded' && canPerformOrderAction('confirm_payment')"
                  content="必须同步核对银行对公流水，不能只看客户截图。通过后付款状态变为已到账"
                  placement="top"
                >
                  <el-button
                    type="success"
                    size="small"
                    :loading="paymentSaving"
                    @click="markPaymentPaid"
                  >
                    审核通过
                  </el-button>
                </el-tooltip>
                <el-button
                  v-if="resolvePaymentStatus(currentOrder) === 'uploaded' && canPerformOrderAction('confirm_payment')"
                  type="danger"
                  size="small"
                  plain
                  :loading="paymentSaving"
                  @click="rejectCurrentPaymentProof"
                >
                  驳回凭证
                </el-button>
                <span v-if="resolvePaymentStatus(currentOrder) === 'rejected'" class="payment-rejected-tip">已驳回：{{ currentOrder.paymentRejectReason || '请客户重新上传凭证' }}</span>
                <span v-if="resolvePaymentStatus(currentOrder) === 'paid'" class="payment-paid-tip">财务已确认到账，可继续处理发票。</span>
                <el-tooltip
                  v-if="resolvePaymentStatus(currentOrder) === 'paid' && currentOrder.paymentMethod === 'wechat_pay' && currentOrder.refundStatus !== 'refunded' && canPerformOrderAction('confirm_payment')"
                  content="对微信支付订单发起退款（全额/部分），到账以微信结果为准"
                  placement="top"
                >
                  <el-button
                    type="danger"
                    size="small"
                    plain
                    :loading="refunding"
                    @click="handleRefund"
                  >
                    申请退款
                  </el-button>
                </el-tooltip>
                <span v-if="currentOrder.refundStatus === 'refunded'" class="payment-paid-tip">已退款 ¥{{ ((currentOrder.refundAmountFen || 0) / 100).toFixed(2) }}。</span>
                <span v-else-if="currentOrder.refundStatus === 'processing'" class="payment-paid-tip">退款处理中…</span>
              </div>
            </div>
            <div class="drawer-section">
              <p class="drawer-section-title">财务/发票信息</p>
              <p>是否需要开票：{{currentOrder.needInvoice ? '是' : '否'}}</p>
              <p>发票状态：<el-tag :type="getInvoiceType(normalizeInvoiceStatus(currentOrder))" size="small">{{ normalizeInvoiceStatus(currentOrder) }}</el-tag></p>
              <template v-if="currentOrder.needInvoice">
                <p>发票类型：{{currentOrder.invoiceType || '电子普通发票'}}</p>
                <p>发票抬头：{{currentOrder.invoiceTitle || '-'}}</p>
                <p>税号：{{currentOrder.taxId || '-'}}</p>
                <p v-if="currentOrder.invoiceType === '纸质专用发票'">收票信息：{{currentOrder.invoiceRecipientName || '-'}} / {{currentOrder.invoiceRecipientPhone || '-'}} / {{currentOrder.invoiceRecipientAddress || '-'}}</p>
              </template>
              <el-divider border-style="dashed"></el-divider>
              <p class="drawer-section-title">发票登记</p>
              <el-form label-width="86px" size="small">
                <el-form-item label="发票状态">
                  <el-select v-model="invoiceStatus" :disabled="!canPerformOrderAction('update_invoice')" style="width:100%;">
                    <el-option label="无需开票" value="无需开票"></el-option>
                    <el-option label="未发票" value="未发票"></el-option>
                    <el-option label="已发票" value="已发票"></el-option>
                    <el-option label="已寄出" value="已寄出"></el-option>
                    <el-option label="已签收" value="已签收"></el-option>
                  </el-select>
                </el-form-item>
                <el-form-item label="发票类型">
                  <el-select v-model="invoiceForm.invoiceType" :disabled="!canPerformOrderAction('update_invoice')" style="width:100%;">
                    <el-option label="电子普通发票" value="电子普通发票"></el-option>
                    <el-option label="纸质专用发票" value="纸质专用发票"></el-option>
                  </el-select>
                </el-form-item>
                <el-form-item label="发票抬头">
                  <el-input v-model="invoiceForm.title" :disabled="!canPerformOrderAction('update_invoice')" placeholder="请输入发票抬头"></el-input>
                </el-form-item>
                <el-form-item label="企业税号">
                  <el-input v-model="invoiceForm.taxNo" :disabled="!canPerformOrderAction('update_invoice')" placeholder="请输入企业税号"></el-input>
                </el-form-item>
                <el-form-item label="接收邮箱">
                  <el-input v-model="invoiceForm.email" :disabled="!canPerformOrderAction('update_invoice')" placeholder="电子发票接收邮箱"></el-input>
                </el-form-item>
                <template v-if="invoiceForm.invoiceType === '纸质专用发票'">
                  <el-form-item label="注册地址">
                    <el-input v-model="invoiceForm.registerAddress" :disabled="!canPerformOrderAction('update_invoice')" placeholder="营业执照注册地址"></el-input>
                  </el-form-item>
                  <el-form-item label="注册电话">
                    <el-input v-model="invoiceForm.registerPhone" :disabled="!canPerformOrderAction('update_invoice')" placeholder="税务登记电话"></el-input>
                  </el-form-item>
                  <el-form-item label="开户行">
                    <el-input v-model="invoiceForm.bankName" :disabled="!canPerformOrderAction('update_invoice')" placeholder="基本户开户行"></el-input>
                  </el-form-item>
                  <el-form-item label="银行账号">
                    <el-input v-model="invoiceForm.bankAccount" :disabled="!canPerformOrderAction('update_invoice')" placeholder="对公银行账号"></el-input>
                  </el-form-item>
                  <el-form-item label="收票人">
                    <el-input v-model="invoiceForm.recipientName" :disabled="!canPerformOrderAction('update_invoice')" placeholder="纸质发票收票人"></el-input>
                  </el-form-item>
                  <el-form-item label="收票电话">
                    <el-input v-model="invoiceForm.recipientPhone" :disabled="!canPerformOrderAction('update_invoice')" placeholder="收票人手机号"></el-input>
                  </el-form-item>
                  <el-form-item label="收票地址">
                    <el-input v-model="invoiceForm.recipientAddress" :disabled="!canPerformOrderAction('update_invoice')" placeholder="纸质发票邮寄地址"></el-input>
                  </el-form-item>
                </template>
                <el-form-item label="发票链接">
                  <el-input v-model="invoiceForm.fileUrl" :disabled="!canPerformOrderAction('update_invoice')" placeholder="电子发票下载/查看链接，客户可复制"></el-input>
                </el-form-item>
                <el-form-item label="PDF链接">
                  <el-input v-model="invoiceForm.pdfUrl" :disabled="!canPerformOrderAction('update_invoice')" placeholder="电子发票 PDF 链接，可与发票链接相同"></el-input>
                </el-form-item>
                <el-form-item label="发票号码">
                  <el-input v-model="invoiceForm.invoiceNo" :disabled="!canPerformOrderAction('update_invoice')" placeholder="开具后的电子发票号码"></el-input>
                </el-form-item>
                <el-form-item label="开票日期">
                  <el-input v-model="invoiceForm.invoiceDate" :disabled="!canPerformOrderAction('update_invoice')" placeholder="如 2026-06-28"></el-input>
                </el-form-item>
                <template v-if="invoiceForm.invoiceType === '纸质专用发票'">
                  <el-form-item label="快递公司">
                    <el-input v-model="invoiceForm.mailCompany" :disabled="!canPerformOrderAction('update_invoice')" placeholder="如 顺丰速运"></el-input>
                  </el-form-item>
                  <el-form-item label="快递单号">
                    <el-input v-model="invoiceForm.mailNo" :disabled="!canPerformOrderAction('update_invoice')" placeholder="纸质发票寄送单号"></el-input>
                  </el-form-item>
                  <el-form-item label="寄出时间">
                    <el-input v-model="invoiceForm.mailTime" :disabled="!canPerformOrderAction('update_invoice')" placeholder="如 2026-06-28 15:30"></el-input>
                  </el-form-item>
                </template>
                <el-form-item label="备注">
                  <el-input v-model="invoiceForm.remark" :disabled="!canPerformOrderAction('update_invoice')" placeholder="财务备注/特殊说明"></el-input>
                </el-form-item>
              </el-form>
              <el-tooltip v-if="canPerformOrderAction('update_invoice')" content="保存后会更新该工单的财务开票状态，列表发票状态同步变化" placement="top">
                <el-button type="primary" plain size="small" @click="saveInvoiceStatus">保存发票状态</el-button>
              </el-tooltip>
              <el-tooltip v-if="canPerformOrderAction('update_invoice') && autoInvoiceEnabled" content="需先确认到账。点此调用开票服务商自动开票并回填链接/号码/日期（未对接服务商前会提示未配置）" placement="top">
                <el-button type="success" plain size="small" :loading="invoiceIssuing" @click="onIssueInvoice">一键开票</el-button>
              </el-tooltip>
            </div>
          </el-tab-pane>
          <el-tab-pane label="维修/回寄">
            <div class="drawer-section">
              <div class="drawer-section-head">
                <p class="drawer-section-title">回寄物流</p>
                <el-tag :type="currentOrder.returnNo ? 'success' : 'info'" size="small">{{ currentOrder.returnNo ? '已录入' : '待回寄' }}</el-tag>
              </div>
              <div class="drawer-info-grid">
                <div class="drawer-info-item">
                  <span>回寄物流</span>
                  <strong>{{currentOrder.returnCompany || '暂无（待发货）'}}</strong>
                </div>
                <div class="drawer-info-item">
                  <span>回寄单号</span>
                  <strong class="mono-text">{{currentOrder.returnNo || '暂无（待发货）'}}</strong>
                </div>
                <div class="drawer-info-item is-wide">
                  <span>收件地址</span>
                  <strong>{{currentOrder.returnAddress || currentOrder.address || '-'}}</strong>
                </div>
              </div>
            </div>
            <div v-if="canPerformOrderAction('update_status')" class="drawer-section">
              <div class="drawer-section-head">
                <p class="drawer-section-title">更改工单进度</p>
                <el-tag type="info" size="small">{{ getNextAction(currentOrder).label }}</el-tag>
              </div>
              <p class="section-helper">保存后会将工单状态同步给客户小程序；选择“已回寄”时需要录入回寄物流。</p>
              <el-radio-group v-if="getAllowedStatusOptions(currentOrder).length" v-model="newStatus" class="status-radio-group">
                <el-radio v-for="status in getAllowedStatusOptions(currentOrder)" :key="status" :label="status">{{ status }}</el-radio>
              </el-radio-group>
              <span v-else class="empty-text">当前状态暂无可执行的下一步。</span>
            </div>
            <div class="drawer-section">
              <p class="drawer-section-title">备注与留言</p>
              <div class="remark-field remark-field--internal">
                <div class="remark-field-head">
                  <strong>内部备注</strong>
                  <span>仅后台可见，不会发给客户</span>
                </div>
                <el-input
                  v-model="currentOrder.adminRemark"
                  type="textarea"
                  :rows="3"
                  placeholder="内部跟进备注（仅后台可见）"
                ></el-input>
              </div>
              <div class="remark-field remark-field--customer">
                <div class="remark-field-head">
                  <strong>客户可见随件留言</strong>
                  <span>会打印在回寄单/维修单上</span>
                </div>
                <el-input
                  v-model="currentOrder.printRemark"
                  type="textarea"
                  :rows="3"
                  placeholder="随件留言（将打印在回寄单上）"
                ></el-input>
              </div>
              <el-tooltip content="保存后内部备注仅后台可见，随件留言会进入打印单据" placement="top">
                <el-button type="primary" plain size="small" :loading="remarkSaving" @click="saveRemarks">保存备注</el-button>
              </el-tooltip>
            </div>
          </el-tab-pane>
          <el-tab-pane label="流转记录">
            <div class="drawer-section">
              <p class="drawer-section-title">工单时间线</p>
              <div v-if="currentOrder.timeline && currentOrder.timeline.length" class="timeline-list">
                <div v-for="(item, index) in currentOrder.timeline" :key="index" class="timeline-item">
                  <div class="timeline-dot"></div>
                  <div class="timeline-content">
                    <strong>{{ item.title || item.statusText || '状态更新' }}</strong>
                    <span>{{ formatTimelineTime(item.time || item.createTime || item.updateTime) }}</span>
                    <p>{{ item.desc || item.description || item.content || '-' }}</p>
                  </div>
                </div>
              </div>
              <p v-else class="empty-text">暂无流转记录</p>
            </div>
            <div class="drawer-section">
              <p class="drawer-section-title">报价与结算摘要</p>
              <div class="drawer-info-grid">
                <div class="drawer-info-item">
                  <span>报价状态</span>
                  <strong>{{ getQuoteStatusText(currentOrder.quoteStatus) }}</strong>
                </div>
                <div class="drawer-info-item">
                  <span>付款状态</span>
                  <strong>{{ getPaymentStatusText(currentOrder) }}</strong>
                </div>
                <div class="drawer-info-item">
                  <span>配件小计</span>
                  <strong>{{ formatMoney(getQuoteSummary(currentOrder).partsTotal) }}</strong>
                </div>
                <div class="drawer-info-item">
                  <span>服务小计</span>
                  <strong>{{ formatMoney(getQuoteSummary(currentOrder).servicesTotal) }}</strong>
                </div>
                <div class="drawer-info-item">
                  <span>其他小计</span>
                  <strong>{{ formatMoney(getQuoteSummary(currentOrder).othersTotal) }}</strong>
                </div>
                <div class="drawer-info-item">
                  <span>最终报价</span>
                  <strong>{{ formatMoney(getQuoteSummary(currentOrder).finalPrice) }}</strong>
                </div>
                <div class="drawer-info-item is-wide">
                  <span>报价备注</span>
                  <strong>{{ getQuoteSummary(currentOrder).remark || '-' }}</strong>
                </div>
              </div>
            </div>
          </el-tab-pane>
        </el-tabs>
      </div>
    </template>
    <template #footer>
      <div class="drawer-footer">
        <div class="drawer-footer-actions">
          <el-dropdown trigger="click" @command="handlePrintCommand">
            <el-button plain><el-icon><Printer /></el-icon> 打印<el-icon class="el-icon--right"><ArrowDown /></el-icon></el-button>
            <template #dropdown>
              <el-dropdown-menu>
                <el-dropdown-item command="repair_order">报修 / 回寄单</el-dropdown-item>
                <el-dropdown-item command="quote" :disabled="!hasQuoteData">维修报价单</el-dropdown-item>
                <el-dropdown-item command="settlement" :disabled="!hasQuoteData">竣工结算单</el-dropdown-item>
                <el-dropdown-item command="parts_outbound" :disabled="!hasPartsData">配件出库单</el-dropdown-item>
              </el-dropdown-menu>
            </template>
          </el-dropdown>
          <el-button @click="drawerVisible=false">关闭</el-button>
          <el-tooltip v-if="canPerformOrderAction('update_status') && getAllowedStatusOptions(currentOrder).length" content="保存后会推进工单状态，并同步影响客户小程序可见进度" placement="top">
            <el-button type="primary" :loading="quickStatusLoading" @click="confirmStatus">保存进度</el-button>
          </el-tooltip>
        </div>
      </div>
    </template>
  </el-drawer>

  <el-dialog v-model="quickShipDialogVisible" title="快捷发货" width="400px" align-center @closed="resetQuickShipDialog">
    <el-form label-width="86px">
      <el-form-item label="物流公司" required>
        <el-input v-model="quickShipForm.returnCompany" placeholder="请输入物流公司"></el-input>
      </el-form-item>
      <el-form-item label="物流单号" required>
        <el-input v-model="quickShipForm.returnNo" placeholder="请输入物流单号"></el-input>
      </el-form-item>
    </el-form>
    <template #footer>
      <el-button @click="quickShipDialogVisible = false">取消</el-button>
      <el-button type="primary" :loading="quickStatusLoading" @click="confirmQuickShip">确定</el-button>
    </template>
  </el-dialog>

  <el-dialog v-model="remarkDialogVisible" title="快捷备注与留言" width="450px" @closed="resetRemarkForm">
    <el-form label-position="top" class="quick-remark-form">
      <div class="remark-field remark-field--internal">
        <div class="remark-field-head">
          <strong>内部备注</strong>
          <span>仅后台可见</span>
        </div>
        <el-form-item>
          <el-input
            v-model="quickRemarkForm.adminRemark"
            type="textarea"
            :rows="3"
            placeholder="内部跟进备注（仅后台可见）"
          ></el-input>
        </el-form-item>
      </div>
      <div class="remark-field remark-field--customer">
        <div class="remark-field-head">
          <strong>客户可见随件留言</strong>
          <span>会打印在回寄单上</span>
        </div>
        <el-form-item>
          <el-input
            v-model="quickRemarkForm.printRemark"
            type="textarea"
            :rows="3"
            placeholder="随件留言（将打印在回寄单上）"
          ></el-input>
        </el-form-item>
      </div>
    </el-form>
    <template #footer>
      <el-button @click="remarkDialogVisible = false">取消</el-button>
      <el-button type="primary" :loading="quickStatusLoading" @click="confirmSaveRemark">保存</el-button>
    </template>
  </el-dialog>

  <el-dialog v-model="partPickerVisible" title="选择库存配件" width="860px" align-center>
    <div class="part-picker-toolbar">
      <el-input v-model="partPickerKeyword" clearable placeholder="搜索配件编码 / 名称 / 型号" style="width: 280px;" @keyup.enter="loadPickerParts"></el-input>
      <el-button type="primary" plain :loading="partPickerLoading" @click="loadPickerParts">查询</el-button>
    </div>
    <el-table :data="pickerParts" v-loading="partPickerLoading" style="width:100%;" max-height="420">
      <el-table-column prop="part_code" label="配件编码" width="180" show-overflow-tooltip></el-table-column>
      <el-table-column prop="part_name" label="配件名称" min-width="150" show-overflow-tooltip></el-table-column>
      <el-table-column prop="model" label="型号" width="130" show-overflow-tooltip></el-table-column>
      <el-table-column label="库存" width="100">
        <template #default="{ row }">
          <el-tag :type="row.lowStock ? 'warning' : (Number(row.stock || 0) <= 0 ? 'danger' : 'success')" effect="plain">{{ row.stock || 0 }}</el-tag>
        </template>
      </el-table-column>
      <el-table-column label="销售单价" width="120">
        <template #default="{ row }">¥{{ Number(row.sale_price || row.salePrice || 0).toFixed(2) }}</template>
      </el-table-column>
      <el-table-column label="操作" width="100" align="right">
        <template #default="{ row }">
          <el-button type="primary" link :disabled="Number(row.stock || 0) <= 0" @click="selectQuotePart(row)">选择</el-button>
        </template>
      </el-table-column>
    </el-table>
  </el-dialog>

  <el-dialog v-model="importDialogVisible" :title="`批量导入${activeLogisticsImportLabel}`" width="480px" align-center>
    <div class="import-workbench">
      <el-alert
        :title="logisticsImportTip"
        type="warning"
        show-icon
        :closable="false"
      ></el-alert>
      <div class="import-workbench-actions">
        <el-button plain @click="downloadImportTemplate(activeLogisticsImportType)"><el-icon><Document /></el-icon> 下载规范模板</el-button>
        <el-upload
          action="#"
          :auto-upload="false"
          :show-file-list="false"
          accept=".xlsx,.xls"
          :on-change="handleImportFile"
        >
          <el-button type="primary" :loading="importing"><el-icon><Upload /></el-icon> 选择 Excel 文件</el-button>
        </el-upload>
      </div>
    </div>
  </el-dialog>

  <el-dialog v-model="importResultVisible" :title="`${importResult?.typeLabel || activeLogisticsImportLabel}结果`" width="720px" align-center>
    <el-alert
      v-if="importResult"
      :title="`本次导入类型：${importResult.typeLabel || activeLogisticsImportLabel}，目标状态：${importResult.targetStatus || '-'}`"
      type="info"
      show-icon
      :closable="false"
      class="import-result-tip"
    ></el-alert>
    <div v-if="importResult" class="import-summary">
      <div class="import-stat-card total">
        <span>总计</span>
        <strong>{{ importResult.total }}</strong>
      </div>
      <div class="import-stat-card success">
        <span>成功</span>
        <strong>{{ importResult.success }}</strong>
      </div>
      <div class="import-stat-card fail">
        <span>失败</span>
        <strong>{{ importResult.fail }}</strong>
      </div>
    </div>
    <el-table v-if="importResult && importResult.errors && importResult.errors.length" :data="importResult.errors" max-height="360" style="width: 100%;">
      <el-table-column prop="orderNo" label="失败工单号" min-width="180" show-overflow-tooltip></el-table-column>
      <el-table-column prop="reason" label="失败原因" min-width="240" show-overflow-tooltip></el-table-column>
    </el-table>
    <el-empty v-else-if="importResult" description="全部导入成功"></el-empty>
    <template #footer>
      <el-button @click="importResultVisible = false">关闭</el-button>
    </template>
  </el-dialog>

  <el-dialog v-model="exportDialogVisible" title="自定义导出字段" width="500px" align-center>
    <div class="export-field-panel">
      <el-checkbox
        v-model="checkAll"
        :indeterminate="isIndeterminate"
        @change="handleExportCheckAllChange"
      >
        全选
      </el-checkbox>
      <el-divider></el-divider>
      <el-checkbox-group v-model="selectedExportFields" @change="handleExportFieldChange">
        <div class="export-field-grid">
          <el-checkbox
            v-for="field in exportableFields"
            :key="field.key"
            :label="field.key"
          >
            {{ field.label }}
          </el-checkbox>
        </div>
      </el-checkbox-group>
    </div>
    <template #footer>
      <el-button @click="exportDialogVisible = false">取消</el-button>
      <el-button type="primary" @click="confirmExportExcel">确认导出</el-button>
    </template>
  </el-dialog>

  <div id="print-area" class="print-area" v-show="isPrinting">
    <div v-for="order in selectedOrders" :key="order._id || order.id" class="print-page">
      <h1 class="print-title">设备维修回寄单</h1>

      <div class="print-section-block">
        <h2>工单信息</h2>
        <div class="print-info-grid">
          <div>工单编号：{{ order.id || '-' }}</div>
          <div>当前状态：{{ order.status || '-' }}</div>
          <div>提交时间：{{ order.submitTime || '-' }}</div>
          <div>打印时间：{{ printTime || '-' }}</div>
        </div>
      </div>

      <div class="print-section-block">
        <h2>收件人信息</h2>
        <div class="print-info-grid">
          <div>收件人姓名：{{ order.customerName || '-' }}</div>
          <div>电话：{{ order.phone || '-' }}</div>
          <div>单位名称：{{ order.clinicName || '-' }}</div>
          <div>详细地址：{{ order.address || '-' }}</div>
        </div>
      </div>

      <div class="print-section-block">
        <h2>产品故障明细</h2>
        <table class="print-product-table">
          <thead>
            <tr>
              <th>产品名称</th>
              <th>型号</th>
              <th>SN码</th>
              <th>故障描述</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="(item, index) in order.itemsList || []" :key="item._id || index">
              <td>{{ item.product_name || '-' }}</td>
              <td>{{ item.product_model || '-' }}</td>
              <td>{{ item.sn || '-' }}</td>
              <td>{{ item.fault_desc || '-' }}</td>
            </tr>
          </tbody>
        </table>
      </div>

      <div v-if="order.printRemark" class="print-remark">
        维修寄语：{{ order.printRemark }}
      </div>
      <p class="print-footer-text">感谢您的信任！为了您的设备健康，建议定期维护保养。</p>
    </div>
  </div>
</template>

<script setup>
import { ref, reactive, computed, nextTick, onMounted, watch } from 'vue'
import { useRoute } from 'vue-router'
import { ElMessage, ElMessageBox } from 'element-plus'
import { assignEngineer, batchImportLogistics, batchUpdateShipping, getOrderList, getWorkflowConfig, issueInvoice, refundOrderPayment, rejectPaymentProof, saveOrderItems, updateInvoiceStatus, updateOrderQuote, updateOrderStatus, updatePaymentStatus, updateRemarks } from '../api/order.js'
import { getPartList } from '../api/inventory.js'
import { lookupDeviceBySn as lookupDeviceBySnApi, logSnAction } from '../api/customer.js'
import { getSettings, getStaffList, getTempFileURL } from '../api/admin.js'
import { exportOrdersToWorkbook, formatOrderAttachments, formatOrderItems } from '../utils/orderExport.js'
import { transformOrders } from '../utils/orderTransform.js'
import { toEnglishStatus } from '../utils/orderStatus.js'
import { openPrintWindow, parsePrintConfig, pickPrintTemplate } from '../utils/orderPrint.js'
import { downloadShippingTemplate, getLogisticsImportTypeLabel, parseShippingExcelFile } from '../utils/shippingImport.js'

const route = useRoute()
const isMobile = ref(window.innerWidth <= 768)
const pendingAdminStatuses = ['已提交', '运输中', '已签收']
const adminStatusOptions = ['已提交', '运输中', '已签收', '处理中', '已回寄', '已完成', '已取消']
const adminActionStatusOptions = ['已签收', '处理中', '已回寄', '已完成', '已取消']

const getStatusType = (status) => {
  const statusMap = {
    '已提交': 'info',
    '运输中': 'warning',
    '已签收': 'warning',
    '处理中': 'primary',
    '已回寄': 'success',
    '已完成': 'success',
    '已取消': 'danger'
  }
  return statusMap[status] || 'info'
}

const getInvoiceType = (status) => {
  const invoiceMap = {
    '无需开票': 'info',
    '未发票': 'warning',
    '已发票': 'success',
    '已寄出': 'primary',
    '已签收': 'success'
  }
  return invoiceMap[status] || 'info'
}

const normalizeInvoiceStatus = (order = {}) => {
  if (order.invoiceStatus === '待开票' || order.invoiceStatus === '开具中') return '未发票'
  if (order.invoiceStatus === '已寄出') return '已寄出'
  if (order.invoiceStatus === '已签收') return '已签收'
  if (order.invoiceStatus === '已开具') return '已发票'
  if (order.invoiceStatus === '已发票') return '已发票'
  if (order.invoiceStatus === '未发票') return '未发票'
  return '无需开票'
}

const formatMoney = (value = 0) => {
  const amount = Number(value) || 0
  return `¥${amount.toFixed(2)}`
}

function getQuoteRowExportAmount(item = {}) {
  return Number(item.amount || 0) || (Number(item.unit_price ?? item.unitPrice ?? 0) * Number(item.quantity || 0))
}

function sumQuoteExportRows(rows = []) {
  return (Array.isArray(rows) ? rows : []).reduce((sum, item) => sum + getQuoteRowExportAmount(item), 0)
}

function getQuoteSummary(order = {}) {
  const detail = order.quoteDetail || order.quote_detail || {}
  const parts = Array.isArray(detail.parts) ? detail.parts : []
  const services = Array.isArray(detail.services) ? detail.services : []
  const others = Array.isArray(detail.others) ? detail.others : []
  const legacyPartsTotal = Number(order.partsFee ?? order.parts_fee ?? 0) || 0
  const legacyLaborTotal = Number(order.laborFee ?? order.labor_fee ?? 0) || 0
  const partsTotal = Number(detail.parts_total ?? detail.partsTotal ?? 0) || sumQuoteExportRows(parts) || legacyPartsTotal
  const servicesTotal = Number(detail.services_total ?? detail.servicesTotal ?? 0) || sumQuoteExportRows(services) || legacyLaborTotal
  const othersTotal = Number(detail.others_total ?? detail.othersTotal ?? 0) || sumQuoteExportRows(others)
  const autoTotal = Number(detail.auto_total ?? detail.autoTotal ?? 0) || partsTotal + servicesTotal + othersTotal
  const finalPrice = Number(detail.final_price ?? detail.finalPrice ?? order.totalPrice ?? order.total_price ?? 0) || autoTotal
  return {
    parts,
    services,
    others,
    partsTotal,
    servicesTotal,
    othersTotal,
    autoTotal,
    finalPrice,
    remark: detail.remark || order.quoteRemark || order.quote_remark || ''
  }
}

function formatQuoteRows(rows = [], typeLabel = '费用') {
  return (Array.isArray(rows) ? rows : [])
    .map((item, index) => {
      const name = item.name || item.part_name || item.partName || item.projectName || `${typeLabel}${index + 1}`
      const code = item.part_code || item.partCode || ''
      const model = item.model || item.product_category || item.productCategory || ''
      const quantity = Number(item.quantity || 0) || 0
      const unitPrice = Number(item.unit_price ?? item.unitPrice ?? 0) || 0
      return `${name}${code ? `(${code})` : ''}${model ? ` / ${model}` : ''} x${quantity} @ ${unitPrice.toFixed(2)} = ${getQuoteRowExportAmount(item).toFixed(2)}`
    })
    .join('\n')
}

function formatQuoteDetail(order = {}) {
  const summary = getQuoteSummary(order)
  const sections = [
    summary.parts.length ? `配件费用:\n${formatQuoteRows(summary.parts, '配件')}` : '',
    summary.services.length ? `服务费用:\n${formatQuoteRows(summary.services, '服务')}` : '',
    summary.others.length ? `其他费用:\n${formatQuoteRows(summary.others, '其他')}` : ''
  ].filter(Boolean)
  if (sections.length) return sections.join('\n')
  return (order.quoteItems || []).map(item => `${item.name || '维修费用'}: 配件 ${Number(item.partsFee || 0).toFixed(2)} / 工时 ${Number(item.laborFee || 0).toFixed(2)}`).join('\n')
}

const formatTimelineTime = (value = '') => {
  if (!value) return '-'
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? String(value) : date.toLocaleString('zh-CN', { hour12: false })
}

const getQuoteStatusText = (status = 'pending') => {
  const statusMap = {
    pending: '待报价',
    draft: '草稿',
    issued: '已发布',
    confirmed: '客户已确认',
    rejected: '已拒绝'
  }
  return statusMap[status] || '待报价'
}

const getQuoteStatusType = (status = 'pending') => {
  const statusMap = {
    pending: 'info',
    draft: 'info',
    issued: 'warning',
    confirmed: 'success',
    rejected: 'danger'
  }
  return statusMap[status] || 'info'
}

const resolvePaymentStatus = (order = {}) => {
  if (order.paymentStatus) return order.paymentStatus
  return Array.isArray(order.paymentProofs) && order.paymentProofs.length ? 'uploaded' : 'pending'
}

const getPaymentStatusText = (order = {}) => {
  const statusMap = {
    pending: '待付款',
    uploaded: '待财务审核',
    rejected: '凭证已驳回',
    paid: '已到账'
  }
  if (!Number(order.totalPrice || 0)) return '待报价'
  return statusMap[resolvePaymentStatus(order)] || '待付款'
}

const getPaymentStatusType = (order = {}) => {
  const status = resolvePaymentStatus(order)
  if (!Number(order.totalPrice || 0)) return 'info'
  if (status === 'paid') return 'success'
  if (status === 'uploaded') return 'warning'
  if (status === 'rejected') return 'danger'
  return 'info'
}

const parseOrderDate = (value = '') => {
  if (!value) return null
  if (typeof value === 'number') {
    const date = new Date(value)
    return Number.isNaN(date.getTime()) ? null : date
  }
  const normalized = String(value).replace(/-/g, '/')
  const date = new Date(normalized)
  return Number.isNaN(date.getTime()) ? null : date
}

const getStatusDwell = (order = {}) => {
  if (order.slaInfo && order.slaInfo.tracked) {
    const hours = Number(order.slaInfo.dwell_hours || 0)
    const days = Math.floor(hours / 24)
    const text = days >= 1 ? `停留 ${days}天` : `停留 ${Math.max(hours, 1)}小时`
    return { text, level: order.slaInfo.overdue ? 'warning' : 'normal' }
  }
  if (['已完成', '已取消'].includes(order.status)) {
    return { text: '已结束', level: 'normal' }
  }
  const date = parseOrderDate(order.updateTime || order.submitTime || order.createTime || order.create_time)
  if (!date) return { text: '停留时间未知', level: 'normal' }
  const hours = Math.max(0, Math.floor((Date.now() - date.getTime()) / 36e5))
  const days = Math.floor(hours / 24)
  const text = days >= 1 ? `停留 ${days}天` : `停留 ${Math.max(hours, 1)}小时`
  return { text, level: days >= 2 ? 'warning' : 'normal' }
}

const getSlaLevel = (order = {}) => (order.slaInfo && order.slaInfo.level) || 'normal'
const getSlaTagType = (order = {}) => {
  const level = getSlaLevel(order)
  if (level === 'critical') return 'danger'
  if (level === 'warning') return 'warning'
  return 'success'
}
const getSlaLabel = (order = {}) => {
  const level = getSlaLevel(order)
  if (level === 'critical') return '严重超时'
  if (level === 'warning') return '临近超时'
  return order.slaInfo && order.slaInfo.tracked ? '正常' : '不跟踪'
}
const getSlaText = (order = {}) => {
  const info = order.slaInfo || {}
  if (!info.tracked) return '无需 SLA'
  const threshold = Number(info.threshold_hours || 0)
  const dwell = Number(info.dwell_hours || 0)
  const action = info.action || '继续处理'
  return `${dwell}h / ${threshold}h · ${action}`
}

const getNextAction = (order = {}) => {
  if (order.status === '已取消') return { label: '已作废', desc: '无需处理', type: 'info' }
  if (order.status === '已完成') return { label: '已结案', desc: '流程完成', type: 'success' }
  if (['已提交', '运输中'].includes(order.status)) return { label: '待签收', desc: '确认寄入设备', type: 'warning' }
  if (order.status === '已签收') return { label: '待报价', desc: '检测并发布报价', type: 'primary' }
  const quoteStatus = order.quoteStatus || order.quote_status || ''
  const paymentStatus = resolvePaymentStatus(order)
  if (!Number(order.totalPrice || 0) || ['pending', 'draft', 'rejected'].includes(quoteStatus)) {
    return { label: '待报价', desc: '补齐维修报价', type: 'primary' }
  }
  if (paymentStatus === 'uploaded') return { label: '待审核', desc: '核对对公流水', type: 'warning' }
  if (paymentStatus === 'rejected') return { label: '已驳回', desc: '等待客户重传凭证', type: 'danger' }
  if (paymentStatus !== 'paid') return { label: '待付款', desc: '等待客户付款', type: 'info' }
  if (!order.returnNo) return { label: '待回寄', desc: '录入回寄物流', type: 'warning' }
  if (order.status === '已回寄') return { label: '待结案', desc: '确认完成归档', type: 'success' }
  return { label: '维修中', desc: '维修/质检处理', type: 'primary' }
}

const getAuthorizationStatusText = (status = '') => {
  if (status === 'confirmed') return '已确认'
  if (status === 'rejected') return '已拒绝'
  return '待确认'
}

const formatProofTime = (value = '') => {
  if (!value) return ''
  if (typeof value === 'number') {
    const date = new Date(value)
    if (Number.isNaN(date.getTime())) return ''
    return date.toLocaleString('zh-CN', { hour12: false })
  }
  return String(value)
}

const getProofUrl = (proof = {}) => proof.previewUrl || proof.url || proof.fileUrl || proof.fileID || proof.fileId || proof.path || ''

const isPreviewableUrl = (url = '') => {
  const normalized = String(url || '').split('?')[0].toLowerCase()
  return /^(https?:|data:image|blob:)/.test(normalized) && /\.(png|jpe?g|gif|webp|bmp|svg)$/.test(normalized)
}

const isPreviewableProof = (proof = {}) => isPreviewableUrl(getProofUrl(proof))

const getPaymentPreviewList = (proofs = []) => {
  return (Array.isArray(proofs) ? proofs : [])
    .map(getProofUrl)
    .filter(isPreviewableUrl)
}

const loading = ref(false)
const importing = ref(false)
const quickStatusLoading = ref(false)
const batchCompleting = ref(false)
const todoTypeMap = {
  inbound: '待签收',
  quote: '待报价',
  payment: '待审核转账凭证',
  invoice: '待开票',
  return: '待回寄',
  exception: '异常工单'
}

const exportableFields = [
  { label: '工单编号', key: 'id', getter: order => order.id },
  { label: '单位名称', key: 'clinicName', getter: order => order.clinicName },
  { label: '客户姓名', key: 'customerName', getter: order => order.customerName },
  { label: '手机号码', key: 'phone', getter: order => order.phone },
  { label: '关联用户ID', key: 'userId', getter: order => order.userId || '-' },
  { label: '提交时间', key: 'submitTime', getter: order => order.submitTime },
  { label: '更新时间', key: 'updateTime', getter: order => order.updateTime },
  { label: '当前状态', key: 'status', getter: order => order.status },
  { label: 'SLA状态', key: 'slaStatus', getter: order => getSlaLabel(order) },
  { label: 'SLA停留', key: 'slaDwell', getter: order => getSlaText(order) },
  { label: '寄出物流', key: 'logisticsCompany', getter: order => order.logisticsCompany },
  { label: '寄出单号', key: 'logisticsNo', getter: order => order.logisticsNo },
  { label: '回寄地址', key: 'address', getter: order => order.address },
  { label: '产品明细', key: 'itemsSummary', getter: order => formatOrderItems(order.itemsList) },
  { label: '故障描述', key: 'fault', getter: order => order.fault },
  { label: '凭证与附件', key: 'attachments', getter: order => formatOrderAttachments(order.itemsList) || '无附件' },
  { label: '内部备注', key: 'adminRemark', getter: order => order.adminRemark },
  { label: '随件留言', key: 'printRemark', getter: order => order.printRemark },
  { label: '回寄物流', key: 'returnCompany', getter: order => order.returnCompany || '暂无' },
  { label: '回寄单号', key: 'returnNo', getter: order => order.returnNo || '暂无' },
  { label: '是否开票', key: 'needInvoice', getter: order => order.needInvoice ? '是' : '否' },
  { label: '发票抬头', key: 'invoiceTitle', getter: order => order.invoiceTitle || '-' },
  { label: '企业税号', key: 'taxId', getter: order => order.taxId || '-' },
  { label: '发票状态', key: 'invoiceStatus', getter: order => normalizeInvoiceStatus(order) },
  { label: '发票备注', key: 'invoiceRemark', getter: order => order.invoiceRemark },
  { label: '报价状态', key: 'quoteStatus', getter: order => getQuoteStatusText(order.quoteStatus) },
  { label: '配件小计', key: 'quotePartsTotal', getter: order => formatMoney(getQuoteSummary(order).partsTotal) },
  { label: '服务小计', key: 'quoteServicesTotal', getter: order => formatMoney(getQuoteSummary(order).servicesTotal) },
  { label: '其他小计', key: 'quoteOthersTotal', getter: order => formatMoney(getQuoteSummary(order).othersTotal) },
  { label: '最终报价', key: 'quoteFinalPrice', getter: order => formatMoney(getQuoteSummary(order).finalPrice) },
  { label: '报价备注', key: 'quoteRemark', getter: order => getQuoteSummary(order).remark || '-' },
  { label: '报价明细', key: 'quoteDetail', getter: order => formatQuoteDetail(order) || '-' },
  { label: '付款状态', key: 'paymentStatus', getter: order => getPaymentStatusText(order) },
  { label: '付款驳回原因', key: 'paymentRejectReason', getter: order => order.paymentRejectReason || '-' },
  { label: '库存出库', key: 'inventoryStatus', getter: order => order.inventoryDeducted || order.inventory_deducted ? '已出库' : '未出库' },
  { label: '总金额', key: 'totalPrice', getter: order => formatMoney(order.totalPrice) }
]

const orders = ref([])
const totalOrders = ref(0)
const deviceModelOptions = ref([])
const selectedOrders = ref([])
const workflowConfig = ref(null)
const isPrinting = ref(false)
const printTime = ref('')
const printConfig = ref(parsePrintConfig())
const printSettingsRaw = ref({})
const exportDialogVisible = ref(false)
const selectedExportFields = ref(exportableFields.map(field => field.key))
const checkAll = ref(true)
const isIndeterminate = ref(false)
const importDialogVisible = ref(false)
const importResultVisible = ref(false)
const importResult = ref(null)
const activeLogisticsImportType = ref('return')
const shipDate = ref(new Date().toISOString().slice(0, 10))
const searchInvoiceStatus = ref('')
const slaFilter = ref('')
const activeTodoType = ref('')
const activeTodoLabel = computed(() => todoTypeMap[activeTodoType.value] || '待办筛选')
const activeLogisticsImportLabel = computed(() => getLogisticsImportTypeLabel(activeLogisticsImportType.value))
const logisticsImportTip = computed(() => {
  return activeLogisticsImportType.value === 'inbound'
    ? '签收单用于客户寄入设备：请填写工单编号、物流公司、物流单号、签收时间，导入后状态更新为已签收。'
    : '回寄单用于后台发货：请填写工单编号、物流公司、物流单号、发货时间，导入后状态更新为已回寄。'
})

const loadWorkflowConfig = async () => {
  const token = localStorage.getItem('adminToken')
  workflowConfig.value = await getWorkflowConfig(token)
}

const slaCards = computed(() => {
  const overdue = orders.value.filter(order => order.slaInfo && order.slaInfo.overdue)
  const critical = orders.value.filter(order => getSlaLevel(order) === 'critical')
  const warning = orders.value.filter(order => getSlaLevel(order) === 'warning')
  return [
    { key: 'overdue', label: '超时工单', count: overdue.length, desc: '当前页需优先处理', filter: 'overdue', tone: 'danger' },
    { key: 'critical', label: '严重超时', count: critical.length, desc: '超过阈值 2 倍', filter: 'critical', tone: 'critical' },
    { key: 'warning', label: '临近超时', count: warning.length, desc: '超过 SLA 阈值', filter: 'warning', tone: 'warning' },
    { key: 'today', label: '今日待处理', count: orders.value.filter(order => ['已提交', '运输中', '已签收', '处理中'].includes(order.status)).length, desc: '未完成有效工单', filter: '', tone: 'info' }
  ]
})

const applySlaFilter = (filter) => {
  slaFilter.value = slaFilter.value === filter ? '' : filter
}

const canPerformOrderAction = (action) => {
  return Boolean(workflowConfig.value && workflowConfig.value.permissions && workflowConfig.value.permissions[action])
}

// ============== 指派工程师（仅 manage_staff 权限，与后端 assignEngineer 同键） ==============
const engineerOptions = ref([])
const assignEngineerId = ref('')
const assigningEngineer = ref(false)

const loadEngineerOptions = async () => {
  try {
    const token = localStorage.getItem('adminToken')
    const data = await getStaffList(token)
    const list = Array.isArray(data) ? data : (data.list || [])
    engineerOptions.value = list.filter(u => u.role === 'engineer' && !u.disabled)
  } catch (error) {
    engineerOptions.value = []
  }
}

const engineerDisplayName = (engineerId) => {
  if (!engineerId) return '未指派'
  const found = engineerOptions.value.find(u => u._id === engineerId)
  return found ? (found.name || found.username) : `工程师(${String(engineerId).slice(-4)})`
}

const submitAssignEngineer = async () => {
  if (!assignEngineerId.value || assigningEngineer.value) return
  assigningEngineer.value = true
  try {
    const token = localStorage.getItem('adminToken')
    await assignEngineer(token, currentOrder.value._id || currentOrder.value.id, assignEngineerId.value)
    currentOrder.value.engineerId = assignEngineerId.value
    ElMessage.success(`已指派给 ${engineerDisplayName(assignEngineerId.value)}`)
    loadOrders()
  } catch (error) {
    ElMessage.error(error.message || '指派失败')
  } finally {
    assigningEngineer.value = false
  }
}

const getOrderStatusValue = (order = {}) => {
  return order.statusEn || toEnglishStatus(order.status || '')
}

const getAllowedStatusOptions = (order = {}) => {
  if (!order || !canPerformOrderAction('update_status')) return []
  const currentStatus = getOrderStatusValue(order)
  const transitions = (workflowConfig.value && workflowConfig.value.transitions && workflowConfig.value.transitions[currentStatus]) || []
  return adminActionStatusOptions.filter(status => {
    const targetStatus = toEnglishStatus(status)
    return targetStatus !== currentStatus && transitions.includes(targetStatus)
  })
}

const canMoveOrderToStatus = (order, status) => getAllowedStatusOptions(order).includes(status)

const getTransitionableOrders = (status, source = selectedOrders.value) => {
  return source.filter(order => order.status !== status && canMoveOrderToStatus(order, status))
}

const hasBatchStatusOptions = computed(() => {
  return canPerformOrderAction('update_status') &&
    selectedOrders.value.some(order => canMoveOrderToStatus(order, '处理中') || canMoveOrderToStatus(order, '已完成'))
})

const loadOrders = async () => {
  loading.value = true
  try {
    const token = localStorage.getItem('adminToken')
    const statusFilter = wo.filter ? toEnglishStatus(wo.filter) : undefined
    const data = await getOrderList(token, statusFilter, wo.page, wo.pageSize, {
      keyword: wo.search.trim(),
      deviceModel: wo.deviceFilter,
      invoiceStatus: searchInvoiceStatus.value,
      warrantyStatus: wo.warrantyFilter,
      todoType: activeTodoType.value,
      slaLevel: slaFilter.value,
      responseMode: 'page'
    })
    const list = Array.isArray(data) ? data : (data.list || [])
    orders.value = transformOrders(list)
    totalOrders.value = Array.isArray(data) ? orders.value.length : Number(data.total || 0)
    deviceModelOptions.value = Array.isArray(data.deviceModels) ? data.deviceModels : deviceModelOptions.value
    selectedOrders.value = []
  } catch (error) {
    orders.value = []
    totalOrders.value = 0
    ElMessage.error(error.message || '工单列表加载失败')
  } finally {
    loading.value = false
  }
}

const fetchAllFilteredOrders = async () => {
  const token = localStorage.getItem('adminToken')
  const statusFilter = wo.filter ? toEnglishStatus(wo.filter) : undefined
  const pageSize = 100
  let page = 1
  let total = 0
  const allOrders = []

  while (true) {
    const data = await getOrderList(token, statusFilter, page, pageSize, {
      keyword: wo.search.trim(),
      deviceModel: wo.deviceFilter,
      invoiceStatus: searchInvoiceStatus.value,
      warrantyStatus: wo.warrantyFilter,
      todoType: activeTodoType.value,
      slaLevel: slaFilter.value,
      responseMode: 'page'
    })
    const list = Array.isArray(data) ? data : (data.list || [])
    total = Number((Array.isArray(data) ? list.length : data.total) || 0)
    allOrders.push(...transformOrders(list))
    if (allOrders.length >= total || list.length < pageSize) break
    page += 1
  }

  return allOrders
}

const wo = reactive({ search: '', filter: '', deviceFilter: '', warrantyFilter: '', page: 1, pageSize: 10 })

const deviceModels = computed(() => {
  const models = [...new Set([
    ...deviceModelOptions.value,
    ...orders.value.flatMap(o => (o.itemsList || []).map(item => item.product_model)).filter(Boolean)
  ])]
  return models.sort()
})

const filteredOrders = computed(() => orders.value)

const pagedOrders = computed(() => orders.value)

const applyRouteFilters = () => {
  const routeTodo = String(route.query.todo || '')
  activeTodoType.value = todoTypeMap[routeTodo] ? routeTodo : ''
  wo.filter = String(route.query.filter || '')
  wo.search = String(route.query.keyword || route.query.search || wo.search || '')
}

const clearTodoFilter = () => {
  activeTodoType.value = ''
}

onMounted(async () => {
  applyRouteFilters()
  loadPrintConfig()
  try {
    await loadWorkflowConfig()
  } catch (error) {
    ElMessage.error(error.message || '工单权限配置加载失败')
  }
  // 工程师列表仅指派入口需要（manage_staff = admin），无权限不请求
  if (canPerformOrderAction('manage_staff')) loadEngineerOptions()
  loadOrders()
})

watch(
  () => [wo.search, wo.filter, wo.deviceFilter, wo.warrantyFilter, searchInvoiceStatus.value, activeTodoType.value, slaFilter.value],
  () => {
    if (wo.page === 1) {
      loadOrders()
    } else {
      wo.page = 1
    }
  }
)

watch(
  () => [route.query.filter, route.query.todo, route.query.keyword, route.query.search],
  () => {
    applyRouteFilters()
    if (wo.page === 1) loadOrders()
    else wo.page = 1
  }
)

watch(
  () => [wo.page, wo.pageSize],
  () => {
    loadOrders()
  }
)

const drawerVisible = ref(false)
const currentOrder = ref(null)
// SN 回填：每个工单项的查询结果与 loading 状态（按下标）
const snLookupResults = reactive({})
const snLookupLoading = reactive({})
const savingOrderItems = ref(false)
const currentQuickOrder = ref(null)
const currentRemarkOrder = ref(null)
const quickShipDialogVisible = ref(false)
const remarkDialogVisible = ref(false)
const newStatus = ref('')
const invoiceStatus = ref('无需开票')
const invoiceForm = reactive({
  invoiceType: '电子普通发票',
  title: '',
  taxNo: '',
  email: '',
  registerAddress: '',
  registerPhone: '',
  bankName: '',
  bankAccount: '',
  recipientName: '',
  recipientPhone: '',
  recipientAddress: '',
  remark: '',
  fileUrl: '',
  pdfUrl: '',
  invoiceNo: '',
  invoiceDate: '',
  mailCompany: '',
  mailNo: '',
  mailTime: ''
})
const invoiceIssuing = ref(false)
// 一键开票（自动开票）开关：默认隐藏；对接好开票服务商后，在 pc-admin/.env.local 设
// VITE_ENABLE_AUTO_INVOICE=1 并重新构建即可显示「一键开票」按钮。人工阶段保持隐藏。
const autoInvoiceEnabled = import.meta.env.VITE_ENABLE_AUTO_INVOICE === '1'
const remarkSaving = ref(false)
const quoteSaving = ref(false)
const paymentSaving = ref(false)
const refunding = ref(false)
const partPickerVisible = ref(false)
const partPickerLoading = ref(false)
const partPickerKeyword = ref('')
const pickerParts = ref([])
const quickShipForm = reactive({ returnCompany: '顺丰速运', returnNo: '' })
const quickRemarkForm = reactive({ adminRemark: '', printRemark: '' })

const createQuoteRow = (item = {}, type = 'services') => ({
  localId: item.localId || `quote-${type}-${Date.now()}-${Math.random().toString(16).slice(2)}`,
  partId: item.partId || item.part_id || item._id || '',
  partCode: item.partCode || item.part_code || item.code || '',
  name: item.name || item.title || item.projectName || item.project_name || item.part_name || '',
  model: item.model || item.partModel || item.part_model || '',
  stock: item.stock ?? item.current_stock ?? item.currentStock ?? '',
  productCategory: item.productCategory || item.product_category || item.category || '',
  unitPrice: Number(item.unitPrice ?? item.unit_price ?? item.price ?? item.sale_price ?? item.projectPrice ?? item.project_price ?? item.amount ?? 0) || 0,
  quantity: Number(item.quantity ?? item.qty ?? item.count ?? 1) || 1,
  amount: Number(item.amount ?? item.total ?? 0) || 0,
  remark: item.remark || item.desc || item.description || ''
})

const createPartRow = (item = {}) => createQuoteRow(item, 'parts')
const createServiceRow = (item = {}) => createQuoteRow(item, 'services')
const createOtherRow = (item = {}) => createQuoteRow(item, 'others')

const quoteForm = reactive({
  status: 'pending',
  remark: '',
  finalPrice: 0,
  warrantyMonths: 0,
  paymentDeadlineDays: 7,
  parts: [createPartRow()],
  services: [createServiceRow()],
  others: []
})

const getQuoteRowAmount = (item = {}) => {
  const unitPrice = Number(item.unitPrice) || 0
  const quantity = Number(item.quantity) || 0
  const calculated = unitPrice * quantity
  return calculated || Number(item.amount) || 0
}

const hasQuoteRowContent = (item = {}) => {
  return Boolean(
    (item.name || '').trim() ||
    (item.partCode || '').trim() ||
    (item.model || '').trim() ||
    (item.productCategory || '').trim() ||
    (item.remark || '').trim() ||
    getQuoteRowAmount(item) > 0
  )
}

const quotePartsFee = computed(() => quoteForm.parts.reduce((total, item) => total + getQuoteRowAmount(item), 0))
const quoteServicesFee = computed(() => quoteForm.services.reduce((total, item) => total + getQuoteRowAmount(item), 0))
const quoteOthersFee = computed(() => quoteForm.others.reduce((total, item) => total + getQuoteRowAmount(item), 0))
const quoteLaborFee = computed(() => quoteServicesFee.value + quoteOthersFee.value)
const quoteAutoTotal = computed(() => quotePartsFee.value + quoteServicesFee.value + quoteOthersFee.value)
const quoteTotal = computed(() => Number(quoteForm.finalPrice) || quoteAutoTotal.value)
const currentOrderProductKeywords = computed(() => {
  const order = currentOrder.value || {}
  const items = Array.isArray(order.itemsList) ? order.itemsList : []
  return [
    order.productModel,
    order.itemsSummary,
    ...items.flatMap(item => [
      item.product_name,
      item.product_model,
      item.product_category,
      item.category
    ])
  ]
    .map(item => String(item || '').trim().toLowerCase())
    .filter(Boolean)
})

// 报价备注模板库 / 过保收费阶梯模板（来自系统设置）
const feeTiers = ref([])
const parseSettingsArray = (value) => {
  try {
    const parsed = value ? JSON.parse(value) : []
    return Array.isArray(parsed) ? parsed : []
  } catch (error) {
    return []
  }
}
const applyFeeTier = (item, index) => {
  const tier = feeTiers.value[index]
  if (!tier) return
  item.name = tier.name || item.name
  item.unitPrice = Number(tier.price) || 0
  item.quantity = item.quantity || 1
}
const getQuotePartStockType = (item = {}) => {
  const stock = Number(item.stock)
  const quantity = Number(item.quantity || 0)
  if (!Number.isFinite(stock) || item.stock === '') return 'info'
  if (stock <= 0 || quantity > stock) return 'danger'
  if (stock <= 3) return 'warning'
  return 'success'
}

const quoteInventoryWarnings = computed(() => {
  return quoteForm.parts
    .filter(hasQuoteRowContent)
    .map(item => {
      if (item.stock === '' || item.stock === null || item.stock === undefined) return ''
      const stock = Number(item.stock)
      const quantity = Number(item.quantity || 0)
      if (!Number.isFinite(stock)) return ''
      const name = item.name || item.partCode || '未命名配件'
      if (stock <= 0) return `${name} 库存不足，需采购`
      if (quantity > stock) return `${name} 需 ${quantity} 件，当前库存 ${stock} 件，需采购`
      return ''
    })
    .filter(Boolean)
})

const resetQuoteForm = (order = {}) => {
  const detail = order.quoteDetail || order.quote_detail || {}
  const rawItems = Array.isArray(order.quoteItems) && order.quoteItems.length
    ? order.quoteItems
    : (Array.isArray(order.quote_items) ? order.quote_items : [])
  const totalPrice = Number(order.totalPrice ?? order.total_price ?? 0) || 0
  const partsFee = Number(order.partsFee ?? order.parts_fee ?? 0) || 0
  const laborFee = Number(order.laborFee ?? order.labor_fee ?? 0) || 0
  const remark = detail.remark || order.quoteRemark || order.quote_remark || ''
  quoteForm.status = order.quoteStatus || order.quote_status || (totalPrice > 0 ? 'issued' : 'pending')
  quoteForm.remark = remark
  quoteForm.finalPrice = Number(detail.finalPrice ?? detail.final_price ?? totalPrice ?? 0) || 0
  quoteForm.warrantyMonths = Number(order.quoteWarrantyMonths ?? order.quote_warranty_months ?? 0) || 0
  quoteForm.paymentDeadlineDays = quoteForm.paymentDeadlineDays || 7

  if (Array.isArray(detail.parts) || Array.isArray(detail.services) || Array.isArray(detail.others)) {
    quoteForm.parts = (Array.isArray(detail.parts) ? detail.parts : []).map(createPartRow)
    quoteForm.services = (Array.isArray(detail.services) ? detail.services : []).map(createServiceRow)
    quoteForm.others = (Array.isArray(detail.others) ? detail.others : []).map(createOtherRow)
    if (!quoteForm.parts.length) quoteForm.parts = [createPartRow()]
    if (!quoteForm.services.length) quoteForm.services = [createServiceRow()]
    return
  }

  const legacyParts = []
  const legacyServices = []
  rawItems.forEach((item = {}) => {
    const itemPartsFee = Number(item.partsFee ?? item.parts_fee ?? item.partFee ?? item.part_fee ?? item.materialFee ?? item.material_fee ?? 0) || 0
    const itemLaborFee = Number(item.laborFee ?? item.labor_fee ?? item.workFee ?? item.work_fee ?? item.serviceFee ?? item.service_fee ?? 0) || 0
    const name = item.name || item.title || item.projectName || '维修费用'
    const itemRemark = item.desc || item.description || item.remark || ''
    if (itemPartsFee > 0) {
      legacyParts.push(createPartRow({ name, unitPrice: itemPartsFee, quantity: 1, amount: itemPartsFee, remark: itemRemark }))
    }
    if (itemLaborFee > 0) {
      legacyServices.push(createServiceRow({ name, unitPrice: itemLaborFee, quantity: 1, amount: itemLaborFee, remark: itemRemark }))
    }
  })

  if (!legacyParts.length && partsFee > 0) {
    legacyParts.push(createPartRow({ name: '配件费用', unitPrice: partsFee, quantity: 1, amount: partsFee, remark }))
  }
  if (!legacyServices.length && (laborFee > 0 || totalPrice > partsFee)) {
    const fee = laborFee || Math.max(totalPrice - partsFee, 0)
    legacyServices.push(createServiceRow({ name: '维修服务费', unitPrice: fee, quantity: 1, amount: fee, remark }))
  }

  quoteForm.parts = legacyParts.length ? legacyParts : [createPartRow()]
  quoteForm.services = legacyServices.length ? legacyServices : [createServiceRow()]
  quoteForm.others = []
}

const buildQuotePayload = (status) => {
  const normalizeRows = (rows = [], type = 'services') => rows
    .filter(hasQuoteRowContent)
    .map(item => {
      const amount = getQuoteRowAmount(item)
      const base = {
        name: (item.name || '').trim() || (type === 'parts' ? '配件费用' : type === 'others' ? '其他费用' : '服务费用'),
        unit_price: Number(item.unitPrice) || 0,
        quantity: Number(item.quantity) || 0,
        amount,
        remark: (item.remark || '').trim()
      }
      if (type === 'parts') {
        return {
          ...base,
          part_id: item.partId || '',
          part_code: (item.partCode || '').trim(),
          model: (item.model || '').trim(),
          stock: Number(item.stock || 0) || 0
        }
      }
      if (type === 'services') {
        return {
          ...base,
          service_id: item.serviceId || '',
          product_category: (item.productCategory || '').trim()
        }
      }
      return base
    })

  const parts = normalizeRows(quoteForm.parts, 'parts')
  const services = normalizeRows(quoteForm.services, 'services')
  const others = normalizeRows(quoteForm.others, 'others')
  const autoTotal = [...parts, ...services, ...others].reduce((sum, item) => sum + (Number(item.amount) || 0), 0)
  const finalPrice = Number(quoteForm.finalPrice) || autoTotal
  const remark = (quoteForm.remark || '').trim()
  const items = [
    ...parts.map(item => ({
      name: item.name,
      desc: item.remark || [item.part_code, item.model].filter(Boolean).join(' / '),
      partsFee: item.amount,
      laborFee: 0
    })),
    ...services.map(item => ({
      name: item.name,
      desc: item.remark || item.product_category || '',
      partsFee: 0,
      laborFee: item.amount
    })),
    ...others.map(item => ({
      name: item.name,
      desc: item.remark || '',
      partsFee: 0,
      laborFee: item.amount
    }))
  ]

  return {
    status,
    remark,
    finalPrice,
    final_price: finalPrice,
    quote_warranty_months: Math.max(0, Number(quoteForm.warrantyMonths) || 0),
    payment_deadline_days: Math.max(1, Number(quoteForm.paymentDeadlineDays) || 7),
    quote_detail: {
      parts,
      services,
      others,
      final_price: finalPrice,
      remark
    },
    parts,
    services,
    others,
    items
  }
}

const handleSelectionChange = (selection) => {
  selectedOrders.value = selection
}

const syncExportCheckState = () => {
  const checkedCount = selectedExportFields.value.length
  checkAll.value = checkedCount === exportableFields.length
  isIndeterminate.value = checkedCount > 0 && checkedCount < exportableFields.length
}

const handleExportCheckAllChange = (checked) => {
  selectedExportFields.value = checked ? exportableFields.map(field => field.key) : []
  isIndeterminate.value = false
}

const handleExportFieldChange = () => {
  syncExportCheckState()
}

const openExportDialog = () => {
  syncExportCheckState()
  exportDialogVisible.value = true
}

const openDrawer = (row) => {
  currentOrder.value = row
  assignEngineerId.value = row.engineerId || ''
  // 重置 SN 回填态
  Object.keys(snLookupResults).forEach((k) => delete snLookupResults[k])
  Object.keys(snLookupLoading).forEach((k) => delete snLookupLoading[k])
  Object.keys(snLookupTimers).forEach((k) => { clearTimeout(snLookupTimers[k]); delete snLookupTimers[k] })
  newStatus.value = getAllowedStatusOptions(row)[0] || row.status
  invoiceStatus.value = normalizeInvoiceStatus(row)
  invoiceForm.invoiceType = row.invoiceType || '电子普通发票'
  invoiceForm.title = row.invoiceTitle || ''
  invoiceForm.taxNo = row.taxId || ''
  invoiceForm.email = row.invoiceEmail || ''
  invoiceForm.registerAddress = row.invoiceRegisterAddress || ''
  invoiceForm.registerPhone = row.invoiceRegisterPhone || ''
  invoiceForm.bankName = row.invoiceBankName || ''
  invoiceForm.bankAccount = row.invoiceBankAccount || ''
  invoiceForm.recipientName = row.invoiceRecipientName || ''
  invoiceForm.recipientPhone = row.invoiceRecipientPhone || ''
  invoiceForm.recipientAddress = row.invoiceRecipientAddress || ''
  invoiceForm.remark = row.invoiceRemark || ''
  invoiceForm.fileUrl = row.invoiceUrl || ''
  invoiceForm.pdfUrl = row.invoicePdfUrl || ''
  invoiceForm.invoiceNo = row.invoiceNo || ''
  invoiceForm.invoiceDate = row.invoiceDate || ''
  invoiceForm.mailCompany = row.invoiceMailCompany || ''
  invoiceForm.mailNo = row.invoiceMailNo || ''
  invoiceForm.mailTime = row.invoiceMailTime || ''
  resetQuoteForm(row)
  drawerVisible.value = true
}

const addQuoteRow = (type) => {
  if (type === 'parts') quoteForm.parts.push(createPartRow())
  if (type === 'services') quoteForm.services.push(createServiceRow())
  if (type === 'others') quoteForm.others.push(createOtherRow())
}

// ============== SN 识别回填（后台工单录入） ==============
// 在保状态 → 标签元数据；仅对在保/已过保展示彩色标签
const warrantyTagMeta = (status) => {
  if (status === 'in_warranty') return { type: 'success', label: '在保' }
  if (status === 'extended') return { type: 'success', label: '延保中' }
  if (status === 'expired') return { type: 'danger', label: '已过保' }
  return null
}

// 取某工单项当前在保状态：优先 SN 查询结果，回退工单级快照
const snItemWarranty = (itemIndex) => {
  const r = snLookupResults[itemIndex]
  if (r && r.warrantyStatus) return r.warrantyStatus
  return (currentOrder.value && currentOrder.value.warrantyStatus) || ''
}

// SN 清洗：去空格/换行（后端再规范化匹配）
const cleanSn = (raw) => String(raw == null ? '' : raw).replace(/\s+/g, '').trim()

// 按 SN 查询设备档案并回填（force=true 立即查询，否则失焦防抖；同一 SN 不重复请求）
// 防抖定时器按产品下标隔离，避免编辑下一项时取消上一项尚未触发的查询
const snLookupTimers = {}
const lookupOrderItemSn = (itemIndex, force = false) => {
  const item = currentOrder.value && currentOrder.value.itemsList && currentOrder.value.itemsList[itemIndex]
  if (!item) return
  const sn = cleanSn(item.sn)
  if (sn !== item.sn) item.sn = sn
  if (snLookupTimers[itemIndex]) { clearTimeout(snLookupTimers[itemIndex]); snLookupTimers[itemIndex] = null }
  if (!sn) { delete snLookupResults[itemIndex]; return }
  const existing = snLookupResults[itemIndex]
  if (existing && existing.sn === sn && !force) return // 节流：同 SN 不重复
  const run = () => doLookupOrderItemSn(itemIndex, sn)
  if (force) run()
  else snLookupTimers[itemIndex] = setTimeout(run, 400)
}

const doLookupOrderItemSn = async (itemIndex, sn) => {
  const item = currentOrder.value && currentOrder.value.itemsList && currentOrder.value.itemsList[itemIndex]
  if (!item) return
  if (snLookupLoading[itemIndex]) return
  snLookupLoading[itemIndex] = true
  let info = null
  try {
    info = await lookupDeviceBySnApi(sn)
    info = info && (info.data !== undefined ? info.data : info)
    if (info && info.found) {
      if (info.productCategory && !String(item.product_category || '').trim()) item.product_category = info.productCategory
      if (info.model && !String(item.product_model || '').trim()) item.product_model = info.model
      if (info.buyDate && !String(item.buy_date || '').trim()) item.buy_date = info.buyDate
      snLookupResults[itemIndex] = { ...info, sn }
    } else {
      snLookupResults[itemIndex] = { found: false, sn, history: (info && info.history) || [] }
      ElMessage.warning('未查询到该设备档案，请核对SN编号，或联系管理员录入设备台账')
    }
  } catch (error) {
    // 失败不阻断录入
    ElMessage.error(error.message || 'SN 查询失败')
  } finally {
    snLookupLoading[itemIndex] = false
  }
  // 埋点：后台手动查询
  logSnAction('sn_query', sn, {
    matched: Boolean(info && info.found),
    warranty_status: (info && info.warrantyStatus) || '',
    device_id: (info && info.deviceId) || ''
  })
}

// 历史工单：按 SN 过滤工单列表（关闭抽屉并以 SN 作为搜索关键词）
const openSnHistory = (itemIndex) => {
  const item = currentOrder.value && currentOrder.value.itemsList && currentOrder.value.itemsList[itemIndex]
  if (!item || !item.sn) return
  drawerVisible.value = false
  wo.search = item.sn
}

// 保存工单产品/设备信息并重算在保快照
const saveOrderItemsInfo = async () => {
  const order = currentOrder.value
  if (!order || !Array.isArray(order.itemsList) || !order.itemsList.length) return
  const items = order.itemsList
    .filter((it) => it && it._id)
    .map((it) => ({
      _id: it._id,
      product_category: it.product_category || '',
      product_model: it.product_model || '',
      sn: cleanSn(it.sn),
      buy_date: it.buy_date || ''
    }))
  if (!items.length) { ElMessage.warning('无可保存的产品明细'); return }
  savingOrderItems.value = true
  try {
    const token = localStorage.getItem('adminToken')
    const res = await saveOrderItems(token, order._id, items)
    const data = res && (res.data !== undefined ? res.data : res)
    if (data && data.warranty_status) {
      order.warrantyStatus = data.warranty_status
      order.inWarranty = Boolean(data.in_warranty)
      order.chargeType = data.charge_type || order.chargeType
    }
    ElMessage.success('设备信息已保存')
    loadOrders()
  } catch (error) {
    ElMessage.error(error.message || '保存失败')
  } finally {
    savingOrderItems.value = false
  }
}

// 报价区在保提示栏
const currentOrderWarrantyHint = computed(() => {
  const order = currentOrder.value || {}
  const status = order.warrantyStatus || ''
  if (order.inWarranty || status === 'in_warranty' || status === 'extended') {
    return { show: true, type: 'success', text: '该设备处于原厂质保期，可享受质保减免政策' }
  }
  if (status === 'expired') {
    return { show: true, type: 'error', text: '该设备已超出质保期，维修收取全额工时、上门及配件费用' }
  }
  return { show: false, type: 'info', text: '' }
})

const loadPickerParts = async () => {
  partPickerLoading.value = true
  try {
    const token = localStorage.getItem('adminToken')
    const data = await getPartList(token, {
      keyword: partPickerKeyword.value,
      enabled: true,
      page: 1,
      pageSize: 50
    })
    pickerParts.value = data.list || []
  } catch (error) {
    ElMessage.error(error.message || '配件列表加载失败')
  } finally {
    partPickerLoading.value = false
  }
}

const openPartPicker = async () => {
  partPickerVisible.value = true
  await loadPickerParts()
}

const selectQuotePart = (part) => {
  quoteForm.parts.push(createPartRow({
    partId: part._id,
    partCode: part.part_code || part.partCode,
    name: part.part_name || part.partName,
    model: part.model,
    stock: Number(part.stock || 0),
    unitPrice: Number(part.sale_price || part.salePrice || 0),
    quantity: 1,
    amount: Number(part.sale_price || part.salePrice || 0)
  }))
  partPickerVisible.value = false
}

const removeQuoteRow = (type, index) => {
  const rows = quoteForm[type]
  if (!Array.isArray(rows)) return
  if ((type === 'parts' || type === 'services') && rows.length <= 1) return
  rows.splice(index, 1)
}

const resetQuickShipDialog = () => {
  currentQuickOrder.value = null
  quickShipForm.returnCompany = '顺丰速运'
  quickShipForm.returnNo = ''
}

const hasRemark = (row) => {
  return Boolean((row.adminRemark || '').trim() || (row.printRemark || '').trim())
}

const getRemarkTooltip = (row) => {
  const adminRemark = (row.adminRemark || '').trim()
  const printRemark = (row.printRemark || '').trim()
  if (!adminRemark && !printRemark) return '添加备注'
  return [
    adminRemark ? `[内部]: ${adminRemark}` : '',
    printRemark ? `[打印]: ${printRemark}` : ''
  ].filter(Boolean).join(' / ')
}

const openRemarkDialog = (row) => {
  if (!canPerformOrderAction('update_remarks')) {
    ElMessage.error('当前角色无权编辑备注')
    return
  }
  currentRemarkOrder.value = row
  quickRemarkForm.adminRemark = row.adminRemark || ''
  quickRemarkForm.printRemark = row.printRemark || ''
  remarkDialogVisible.value = true
}

const resetRemarkForm = () => {
  currentRemarkOrder.value = null
  quickRemarkForm.adminRemark = ''
  quickRemarkForm.printRemark = ''
}

const syncCurrentOrderFromList = (row) => {
  if (!row || !currentOrder.value || currentOrder.value._id !== row._id) return
  const fresh = orders.value.find(item => item._id === row._id)
  if (fresh) {
    currentOrder.value = fresh
    newStatus.value = fresh.status
    invoiceStatus.value = normalizeInvoiceStatus(fresh)
    invoiceForm.title = fresh.invoiceTitle || ''
    invoiceForm.taxNo = fresh.taxId || ''
    invoiceForm.remark = fresh.invoiceRemark || ''
    invoiceForm.fileUrl = fresh.invoiceUrl || ''
    invoiceForm.invoiceNo = fresh.invoiceNo || ''
    invoiceForm.invoiceDate = fresh.invoiceDate || ''
    resetQuoteForm(fresh)
  }
}

const isUserCancel = (error) => error === 'cancel' || error === 'close'

const formatOrderIdList = (list = []) => {
  const ids = list.map(item => item.id || item._id).filter(Boolean)
  const visible = ids.slice(0, 6).join('、')
  return ids.length > 6 ? `${visible} 等 ${ids.length} 单` : visible
}

const getBatchSkipReason = (order = {}, targetStatus = '') => {
  if (!targetStatus) return '当前状态不支持该批量操作'
  if (!canMoveOrderToStatus(order, targetStatus)) return `当前状态“${order.status || '-'}”不能流转到“${targetStatus}”`
  if (targetStatus === '已完成' && order.status !== '已回寄') return '未回寄，不能结单'
  if (targetStatus === '已完成' && !order.returnNo) return '缺少回寄单号，不能结单'
  return '不满足批量操作条件'
}

const formatSkippedReasons = (skippedOrders = [], targetStatus = '') => {
  if (!skippedOrders.length) return ''
  const grouped = skippedOrders.reduce((acc, order) => {
    const reason = getBatchSkipReason(order, targetStatus)
    acc[reason] = acc[reason] || []
    acc[reason].push(order)
    return acc
  }, {})
  return Object.entries(grouped)
    .map(([reason, list]) => `${reason}：${formatOrderIdList(list)}`)
    .join('；')
}

const buildBatchConfirmMessage = (actionText, targetOrders = [], skippedOrders = [], extraText = '') => {
  const targetStatus = actionText.includes('已完成') ? '已完成' : (actionText.includes('处理中') ? '处理中' : '')
  const parts = [
    `已选择 ${selectedOrders.value.length} 单`,
    `本次将${actionText} ${targetOrders.length} 单`,
    `跳过 ${skippedOrders.length} 单`
  ]
  if (targetOrders.length) parts.push(`执行工单：${formatOrderIdList(targetOrders)}`)
  if (skippedOrders.length) {
    parts.push(`跳过工单：${formatOrderIdList(skippedOrders)}`)
    parts.push(`跳过原因：${formatSkippedReasons(skippedOrders, targetStatus)}`)
  }
  if (extraText) parts.push(extraText)
  return parts.join('。')
}

const handleQuickStatusChange = async (row, status) => {
  if (!row || !status || row.status === status) {
    ElMessage.info('当前工单已是该状态')
    return false
  }
  if (!canMoveOrderToStatus(row, status)) {
    ElMessage.error('当前角色或工单状态不允许执行该操作')
    return false
  }

  if (status === '已回寄') {
    if (!canPerformOrderAction('import_logistics')) {
      ElMessage.error('当前角色无权导入回寄物流')
      return false
    }
    currentQuickOrder.value = row
    quickShipForm.returnCompany = row.returnCompany || '顺丰速运'
    quickShipForm.returnNo = row.returnNo || ''
    quickShipDialogVisible.value = true
    return false
  }

  try {
    if (status === '已完成') {
      if (row.status !== '已回寄' || !row.returnNo) {
        ElMessage.error('禁止越级结单！该工单尚未录入回寄物流信息。')
        return false
      }

      if (row.needInvoice === true && normalizeInvoiceStatus(row) !== '已发票') {
        await ElMessageBox.confirm(
          '该工单客户需要发票，但当前财务状态为未发票！确定要强制结单吗？',
          '强制结单确认',
          {
            confirmButtonText: '强制结单',
            cancelButtonText: '取消',
            type: 'error'
          }
        )
      } else {
        await ElMessageBox.confirm(
          '确定将该工单标记为【已完成】吗？',
          '结单确认',
          {
            confirmButtonText: '确定',
            cancelButtonText: '取消',
            type: 'success'
          }
        )
      }
    } else {
      await ElMessageBox.confirm(
        `确定将工单变更为【${status}】吗？此操作将同步通知报修客户。`,
        '状态变更确认',
        {
          confirmButtonText: '确定',
          cancelButtonText: '取消',
          type: 'warning'
        }
      )
    }
    quickStatusLoading.value = true
    const token = localStorage.getItem('adminToken')
    await updateOrderStatus(token, row._id, toEnglishStatus(status))
    ElMessage.success('工单状态更新成功')
    await loadOrders()
    syncCurrentOrderFromList(row)
    return true
  } catch (error) {
    if (!isUserCancel(error)) {
      ElMessage.error(error.message || '状态更新失败')
    }
    return false
  } finally {
    quickStatusLoading.value = false
  }
}

const handleBatchStatusCommand = (command) => {
  if (command === 'processing') {
    handleBatchProcessing()
    return
  }
  if (command === 'completed') {
    handleBatchComplete()
  }
}

const handleBatchProcessing = async () => {
  if (!selectedOrders.value.length) {
    ElMessage.warning('请先勾选要处理的工单')
    return
  }
  if (!canPerformOrderAction('update_status')) {
    ElMessage.error('当前角色无权批量修改工单状态')
    return
  }

  const targetOrders = getTransitionableOrders('处理中')
  const skippedOrders = selectedOrders.value.filter(order => !targetOrders.some(item => item._id === order._id))

  if (!targetOrders.length) {
    ElMessage.info('选中的工单没有可标记为处理中的项目')
    return
  }

  try {
    await ElMessageBox.confirm(
      buildBatchConfirmMessage('标记为【处理中】', targetOrders, skippedOrders),
      '批量状态变更确认',
      {
        confirmButtonText: '确定',
        cancelButtonText: '取消',
        type: 'warning'
      }
    )

    batchCompleting.value = true
    const token = localStorage.getItem('adminToken')
    const statusEn = toEnglishStatus('处理中')
    const results = await Promise.allSettled(
      targetOrders.map(order => updateOrderStatus(token, order._id, statusEn))
    )
    const failed = results.filter(item => item.status === 'rejected')
    if (failed.length) {
      ElMessage.error(`批量标记处理中完成，失败 ${failed.length} 单`)
    } else {
      ElMessage.success(`已批量标记处理中 ${targetOrders.length} 单`)
    }
    selectedOrders.value = []
    await loadOrders()
  } catch (error) {
    if (!isUserCancel(error)) {
      ElMessage.error(error.message || '批量标记处理中失败')
    }
  } finally {
    batchCompleting.value = false
  }
}

const handleBatchComplete = async () => {
  if (!selectedOrders.value.length) {
    ElMessage.warning('请先勾选要结单的工单')
    return
  }
  if (!canPerformOrderAction('update_status')) {
    ElMessage.error('当前角色无权批量修改工单状态')
    return
  }

  const transitionableOrders = getTransitionableOrders('已完成')
  const targetOrders = transitionableOrders.filter(order => order.status === '已回寄' && order.returnNo)
  const skippedOrders = selectedOrders.value.filter(order => !targetOrders.some(item => item._id === order._id))
  if (!targetOrders.length) {
    ElMessage.info('选中的工单没有可结单的项目')
    return
  }

  const pendingInvoiceOrders = targetOrders.filter(order => order.needInvoice === true && normalizeInvoiceStatus(order) !== '已发票')
  const invoiceText = pendingInvoiceOrders.length ? `其中 ${pendingInvoiceOrders.length} 单需要发票但尚未标记为已发票，确认后会强制结单` : ''
  const confirmMessage = pendingInvoiceOrders.length
    ? buildBatchConfirmMessage('标记为【已完成】', targetOrders, skippedOrders, invoiceText)
    : buildBatchConfirmMessage('标记为【已完成】', targetOrders, skippedOrders)

  try {
    await ElMessageBox.confirm(
      confirmMessage,
      pendingInvoiceOrders.length ? '批量强制结单确认' : '批量结单确认',
      {
        confirmButtonText: pendingInvoiceOrders.length ? '强制结单' : '确定结单',
        cancelButtonText: '取消',
        type: pendingInvoiceOrders.length ? 'error' : 'success'
      }
    )

    batchCompleting.value = true
    const token = localStorage.getItem('adminToken')
    const statusEn = toEnglishStatus('已完成')
    const results = await Promise.allSettled(
      targetOrders.map(order => updateOrderStatus(token, order._id, statusEn))
    )
    const failed = results.filter(item => item.status === 'rejected')
    if (failed.length) {
      ElMessage.error(`批量结单完成，失败 ${failed.length} 单`)
    } else {
      ElMessage.success(`已批量结单 ${targetOrders.length} 单`)
    }
    selectedOrders.value = []
    await loadOrders()
  } catch (error) {
    if (!isUserCancel(error)) {
      ElMessage.error(error.message || '批量结单失败')
    }
  } finally {
    batchCompleting.value = false
  }
}

const confirmQuickShip = async () => {
  if (!currentQuickOrder.value) return
  if (!canPerformOrderAction('import_logistics') || !canMoveOrderToStatus(currentQuickOrder.value, '已回寄')) {
    ElMessage.error('当前角色或工单状态不允许回寄发货')
    return
  }
  const returnCompany = quickShipForm.returnCompany.trim()
  const returnNo = quickShipForm.returnNo.trim()
  if (!returnCompany) {
    ElMessage.warning('请填写物流公司')
    return
  }
  if (!returnNo) {
    ElMessage.warning('请填写物流单号')
    return
  }

  quickStatusLoading.value = true
  try {
    const token = localStorage.getItem('adminToken')
    const result = await batchUpdateShipping(token, [{
      orderNo: currentQuickOrder.value.id,
      returnCompany,
      returnNo
    }])
    if (!result || result.success < 1) {
      const reason = result && result.errors && result.errors[0] ? result.errors[0].reason : '快捷发货失败'
      throw new Error(reason)
    }
    ElMessage.success('快捷发货更新成功')
    quickShipDialogVisible.value = false
    await loadOrders()
    syncCurrentOrderFromList(currentQuickOrder.value)
  } catch (error) {
    ElMessage.error(error.message || '快捷发货失败')
  } finally {
    quickStatusLoading.value = false
  }
}

const confirmStatus = async () => {
  if (!currentOrder.value) return
  if (!canMoveOrderToStatus(currentOrder.value, newStatus.value)) {
    ElMessage.error('当前状态不允许执行该操作')
    return
  }
  const changed = await handleQuickStatusChange(currentOrder.value, newStatus.value)
  if (changed) {
    drawerVisible.value = false
  }
}

// 一键开票：财务确认到账后，调用开票服务商自动开票并回填
const onIssueInvoice = async () => {
  if (!currentOrder.value) return
  if (!canPerformOrderAction('update_invoice')) {
    ElMessage.error('当前角色无权开票')
    return
  }
  try {
    await ElMessageBox.confirm('确认该工单已收款到账，并自动开具电子发票？', '一键开票', { type: 'warning' })
  } catch (e) { return }
  invoiceIssuing.value = true
  try {
    const token = localStorage.getItem('adminToken')
    await issueInvoice(token, currentOrder.value._id)
    ElMessage.success('开票成功，已回填发票信息')
    await loadOrders()
    const fresh = orders.value.find(item => item._id === currentOrder.value._id)
    if (fresh) currentOrder.value = fresh
  } catch (error) {
    if (!error?.__displayed) ElMessage.error(error?.message || '开票失败')
  } finally {
    invoiceIssuing.value = false
  }
}

const saveInvoiceStatus = async () => {
  if (!currentOrder.value) return
  if (!canPerformOrderAction('update_invoice')) {
    ElMessage.error('当前角色无权更新发票状态')
    return
  }
  loading.value = true
  try {
    const token = localStorage.getItem('adminToken')
    await updateInvoiceStatus(token, currentOrder.value._id, invoiceStatus.value, {
      invoice_type: invoiceForm.invoiceType,
      title: invoiceForm.title,
      taxNo: invoiceForm.taxNo,
      email: invoiceForm.email,
      register_address: invoiceForm.registerAddress,
      register_phone: invoiceForm.registerPhone,
      bank_name: invoiceForm.bankName,
      bank_account: invoiceForm.bankAccount,
      recipient_name: invoiceForm.recipientName,
      recipient_phone: invoiceForm.recipientPhone,
      recipient_address: invoiceForm.recipientAddress,
      remark: invoiceForm.remark,
      invoice_url: invoiceForm.fileUrl,
      pdf_url: invoiceForm.pdfUrl,
      invoice_no: invoiceForm.invoiceNo,
      invoice_date: invoiceForm.invoiceDate,
      mail_company: invoiceForm.mailCompany,
      mail_no: invoiceForm.mailNo,
      mail_time: invoiceForm.mailTime
    })
    ElMessage.success('发票状态已登记')
    await loadOrders()
    if (currentOrder.value) {
      const fresh = orders.value.find(item => item._id === currentOrder.value._id)
      if (fresh) currentOrder.value = fresh
    }
  } catch (error) {
    ElMessage.error(error.message || '发票状态保存失败')
  } finally {
    loading.value = false
  }
}

const saveOrderQuote = async (status = 'draft') => {
  if (!currentOrder.value) return
  if (!canPerformOrderAction('issue_quote')) {
    ElMessage.error('当前角色无权编辑维修报价')
    return
  }
  const payload = buildQuotePayload(status)
  const total = Number(payload.finalPrice) || quoteAutoTotal.value

  if (!payload.items.length || total <= 0) {
    ElMessage.warning('请至少填写一个有效报价项目和金额')
    return
  }

  if ((payload.remark || '').length > 200) {
    ElMessage.warning('报价备注不能超过200字')
    return
  }

  if (status === 'issued') {
    try {
      const inventoryText = quoteInventoryWarnings.value.length
        ? `\n\n库存提醒：${quoteInventoryWarnings.value.join('；')}`
        : ''
      await ElMessageBox.confirm(
        `确定发布报价 ${formatMoney(total)} 给客户确认吗？${inventoryText}`,
        '发布报价确认',
        {
          confirmButtonText: '发布报价',
          cancelButtonText: '取消',
          type: 'warning'
        }
      )
    } catch (error) {
      if (!isUserCancel(error)) {
        ElMessage.error(error.message || '发布报价取消')
      }
      return
    }
  }

  quoteSaving.value = true
  try {
    const token = localStorage.getItem('adminToken')
    const result = await updateOrderQuote(token, currentOrder.value._id, payload)
    ElMessage.success(status === 'issued' ? '报价已发布' : '报价草稿已保存')
    await loadOrders()
    const fresh = orders.value.find(item => item._id === currentOrder.value._id)
    if (fresh) {
      currentOrder.value = fresh
      resetQuoteForm(fresh)
    } else if (result) {
      resetQuoteForm({ ...currentOrder.value, ...result })
    }
  } catch (error) {
    ElMessage.error(error.message || '报价保存失败')
  } finally {
    quoteSaving.value = false
  }
}

const markPaymentPaid = async () => {
  if (!currentOrder.value) return
  if (!canPerformOrderAction('confirm_payment')) {
    ElMessage.error('当前角色无权核销付款')
    return
  }
  if (resolvePaymentStatus(currentOrder.value) !== 'uploaded') {
    ElMessage.info('当前没有待核销的付款凭证')
    return
  }

  try {
    await ElMessageBox.confirm(
      '请确认已同步核对银行对公流水，且金额、工单备注均匹配。通过后付款状态将标记为“已到账”。',
      '转账凭证审核通过',
      {
        confirmButtonText: '确认已到账',
        cancelButtonText: '取消',
        type: 'warning'
      }
    )
  } catch (error) {
    if (!isUserCancel(error)) {
      ElMessage.error(error.message || '付款核销取消')
    }
    return
  }

  paymentSaving.value = true
  try {
    const token = localStorage.getItem('adminToken')
    const orderId = currentOrder.value._id
    const result = await updatePaymentStatus(token, orderId, 'paid')
    ElMessage.success('付款已标记为到账')
    await loadOrders()
    const fresh = orders.value.find(item => item._id === orderId)
    if (fresh) {
      currentOrder.value = fresh
    } else if (result) {
      currentOrder.value = {
        ...currentOrder.value,
        paymentStatus: result.paymentStatus || result.payment_status || 'paid'
      }
    }
  } catch (error) {
    ElMessage.error(error.message || '付款核销失败')
  } finally {
    paymentSaving.value = false
  }
}

const rejectCurrentPaymentProof = async () => {
  if (!currentOrder.value) return
  if (!canPerformOrderAction('confirm_payment')) {
    ElMessage.error('当前角色无权审核付款凭证')
    return
  }
  if (resolvePaymentStatus(currentOrder.value) !== 'uploaded') {
    ElMessage.info('当前没有待审核的转账凭证')
    return
  }

  let reason = ''
  try {
    const res = await ElMessageBox.prompt(
      '请填写驳回原因，原因会展示给客户并用于重新上传凭证。',
      '驳回转账凭证',
      {
        confirmButtonText: '确认驳回',
        cancelButtonText: '取消',
        inputPlaceholder: '如：银行流水未匹配到该工单编号 / 金额不一致 / 回单不清晰',
        inputValidator: (v) => (v && v.trim() ? true : '请填写驳回原因'),
        type: 'warning'
      }
    )
    reason = (res && res.value || '').trim()
  } catch (error) {
    if (!isUserCancel(error)) ElMessage.error(error.message || '已取消驳回')
    return
  }

  paymentSaving.value = true
  try {
    const token = localStorage.getItem('adminToken')
    const orderId = currentOrder.value._id
    const result = await rejectPaymentProof(token, orderId, reason)
    ElMessage.success('已驳回转账凭证')
    await loadOrders()
    const fresh = orders.value.find(item => item._id === orderId)
    if (fresh) {
      currentOrder.value = fresh
    } else if (result) {
      currentOrder.value = {
        ...currentOrder.value,
        paymentStatus: result.paymentStatus || result.payment_status || 'rejected',
        paymentRejectReason: reason
      }
    }
  } catch (error) {
    ElMessage.error(error.message || '驳回失败')
  } finally {
    paymentSaving.value = false
  }
}

const handleRefund = async () => {
  if (!currentOrder.value) return
  if (!canPerformOrderAction('confirm_payment')) {
    ElMessage.error('当前角色无权发起退款')
    return
  }
  let reason = ''
  try {
    const res = await ElMessageBox.prompt(
      '将对该微信支付订单发起全额退款，原路退回客户支付账户。请填写退款原因：',
      '退款确认',
      {
        confirmButtonText: '确认退款',
        cancelButtonText: '取消',
        inputPlaceholder: '如：客户拒修 / 重复支付 / 协商退款',
        inputValidator: (v) => (v && v.trim() ? true : '请填写退款原因'),
        type: 'warning'
      }
    )
    reason = (res && res.value || '').trim()
  } catch (error) {
    if (!isUserCancel(error)) ElMessage.error(error.message || '退款已取消')
    return
  }

  refunding.value = true
  try {
    const token = localStorage.getItem('adminToken')
    const orderId = currentOrder.value._id
    const result = await refundOrderPayment(token, orderId, reason)
    ElMessage.success((result && result.msg) || '退款已提交')
    await loadOrders()
    const fresh = orders.value.find(item => item._id === orderId)
    if (fresh) currentOrder.value = fresh
  } catch (error) {
    ElMessage.error(error.message || '退款失败')
  } finally {
    refunding.value = false
  }
}

const saveRemarks = async () => {
  if (!currentOrder.value) return
  if (!canPerformOrderAction('update_remarks')) {
    ElMessage.error('当前角色无权编辑备注')
    return
  }
  remarkSaving.value = true
  try {
    const token = localStorage.getItem('adminToken')
    const adminRemark = currentOrder.value.adminRemark || ''
    const printRemark = currentOrder.value.printRemark || ''
    await updateRemarks(token, currentOrder.value._id, adminRemark, printRemark)
    ElMessage.success('备注已保存')
    await loadOrders()
    const fresh = orders.value.find(item => item._id === currentOrder.value._id)
    if (fresh) {
      currentOrder.value = {
        ...fresh,
        adminRemark,
        printRemark
      }
    }
  } catch (error) {
    ElMessage.error(error.message || '备注保存失败')
  } finally {
    remarkSaving.value = false
  }
}

const confirmSaveRemark = async () => {
  if (!currentRemarkOrder.value) return
  if (!canPerformOrderAction('update_remarks')) {
    ElMessage.error('当前角色无权编辑备注')
    return
  }
  quickStatusLoading.value = true
  try {
    const token = localStorage.getItem('adminToken')
    const adminRemark = quickRemarkForm.adminRemark || ''
    const printRemark = quickRemarkForm.printRemark || ''
    await updateRemarks(token, currentRemarkOrder.value._id, adminRemark, printRemark)
    ElMessage.success('备注已保存')
    remarkDialogVisible.value = false
    await loadOrders()
  } catch (error) {
    ElMessage.error(error.message || '备注保存失败')
  } finally {
    quickStatusLoading.value = false
  }
}

const printOrder = () => {
  if (!currentOrder.value) return
  if (!openPrintWindow([currentOrder.value])) {
    ElMessage.error('浏览器拦截了打印窗口，请允许弹窗后重试')
  }
}

const printSelectedOrders = () => {
  if (!selectedOrders.value.length) {
    ElMessage.warning('请先勾选要打印的工单')
    return
  }
  if (!openPrintWindow(selectedOrders.value)) {
    ElMessage.error('浏览器拦截了打印窗口，请允许弹窗后重试')
  }
}

const handleBatchPrint = async () => {
  if (!selectedOrders.value.length) {
    ElMessage.warning('请先勾选要打印的工单')
    return
  }

  printTime.value = new Date().toLocaleString('zh-CN', { hour12: false })
  isPrinting.value = true
  await nextTick()

  const resetPrinting = () => {
    isPrinting.value = false
    window.removeEventListener('afterprint', resetPrinting)
  }
  window.addEventListener('afterprint', resetPrinting, { once: true })
  window.print()
  setTimeout(resetPrinting, 1000)
}

// logo 存的是云存储 fileID，打印窗口无法直接加载，需解析成临时 http 地址（按 fileID 缓存）
const printLogoCache = reactive({})
const resolvePrintLogo = async (template) => {
  if (!template.logoUrl || !/^cloud:\/\//i.test(template.logoUrl)) return template
  const fileId = template.logoUrl
  if (printLogoCache[fileId] !== undefined) {
    template.logoUrl = printLogoCache[fileId]
    return template
  }
  try {
    const token = localStorage.getItem('adminToken')
    const map = await getTempFileURL(token, [fileId])
    const url = (map && map[fileId]) || ''
    printLogoCache[fileId] = url
    template.logoUrl = url
  } catch (e) {
    printLogoCache[fileId] = ''
    template.logoUrl = ''
  }
  return template
}

const loadPrintConfig = async () => {
  try {
    const token = localStorage.getItem('adminToken')
    const data = await getSettings(token)
    printSettingsRaw.value = data || {}
    const template = pickPrintTemplate(data && data.print_templates, data && data.print_config, 'repair_order')
    await resolvePrintLogo(template)
    printConfig.value = template
    feeTiers.value = parseSettingsArray(data && data.fee_tier_templates)
  } catch (error) {
    printConfig.value = parsePrintConfig()
  }
}

// 按单据类型打印当前工单（维修报价单 / 竣工结算单 / 配件出库单）
const hasQuoteData = computed(() => {
  const o = currentOrder.value
  if (!o) return false
  const d = o.quoteDetail || {}
  return Number(o.totalPrice || 0) > 0 || (d.parts || []).length > 0 || (d.services || []).length > 0 || (d.others || []).length > 0
})
const hasPartsData = computed(() => {
  const o = currentOrder.value
  return !!(o && o.quoteDetail && (o.quoteDetail.parts || []).length > 0)
})
const printDoc = async (docType) => {
  if (!currentOrder.value) return
  const raw = printSettingsRaw.value || {}
  const template = pickPrintTemplate(raw.print_templates, raw.print_config, docType)
  await resolvePrintLogo(template)
  if (!openPrintWindow([currentOrder.value], template, docType)) {
    ElMessage.error('浏览器拦截了打印窗口，请允许弹窗后重试')
  }
}
const handlePrintCommand = (command) => {
  if (command === 'repair_order') return printConfiguredOrder()
  return printDoc(command)
}

const printConfiguredOrder = () => {
  if (!currentOrder.value) return
  const config = { ...printConfig.value, fields: { ...(printConfig.value.fields || {}), showCost: true } }
  if (!openPrintWindow([currentOrder.value], config)) {
    ElMessage.error('浏览器拦截了打印窗口，请允许弹窗后重试')
  }
}

const handleConfiguredBatchPrint = () => {
  if (!selectedOrders.value.length) {
    ElMessage.warning('请先勾选要打印的工单')
    return
  }
  const config = { ...printConfig.value, fields: { ...(printConfig.value.fields || {}), showCost: true } }
  if (!openPrintWindow(selectedOrders.value, config)) {
    ElMessage.error('浏览器拦截了打印窗口，请允许弹窗后重试')
  }
}

const openImportDialog = (type = 'return') => {
  if (!canPerformOrderAction('import_logistics')) {
    ElMessage.error('当前角色无权导入物流')
    return
  }
  activeLogisticsImportType.value = type
  importResult.value = null
  importDialogVisible.value = true
}

const downloadImportTemplate = (type = 'return') => {
  downloadShippingTemplate(type)
}

const handleImportFile = async (uploadFile) => {
  if (!canPerformOrderAction('import_logistics')) {
    ElMessage.error('当前角色无权导入物流')
    return
  }
  const file = uploadFile.raw
  if (!file) return

  importing.value = true
  try {
    const importType = activeLogisticsImportType.value
    const rows = await parseShippingExcelFile(file, importType)
    if (!rows.length) {
      ElMessage.warning('Excel 中没有可导入的数据')
      return
    }

    const token = localStorage.getItem('adminToken')
    const result = await batchImportLogistics(token, importType, rows, shipDate.value)
    importResult.value = result
    importDialogVisible.value = false
    importResultVisible.value = true
    ElMessage.success(`导入完成：成功 ${result.success} 条，失败 ${result.fail} 条`)
    await loadOrders()
  } catch (error) {
    ElMessage.error(error.message || '导入失败')
  } finally {
    importing.value = false
  }
}

const confirmExportExcel = async () => {
  if (!selectedExportFields.value.length) {
    ElMessage.warning('请至少选择一个导出字段')
    return
  }

  const selectedFieldConfigs = exportableFields.filter(field => selectedExportFields.value.includes(field.key))
  const usingSelectedOrders = selectedOrders.value.length > 0
  const sourceOrders = usingSelectedOrders ? selectedOrders.value : await fetchAllFilteredOrders()
  await exportOrdersToWorkbook(sourceOrders, selectedFieldConfigs)
  exportDialogVisible.value = false
  ElMessage.success(`已导出${usingSelectedOrders ? '选中' : '当前筛选'}工单 ${sourceOrders.length} 条`)
}
</script>

<style scoped>
.glass-card { background: #fff; border-radius: 12px; padding: 24px; box-shadow: 0 2px 12px rgba(0,0,0,0.03); margin-bottom: 20px; }

.page-header { display: flex; justify-content: space-between; align-items: flex-start; gap: 32px; margin-bottom: 26px; padding-bottom: 24px; border-bottom: 1px solid #edf1f7; }
.page-title { font-size: 24px; font-weight: 700; color: #1d2129; margin: 0; letter-spacing: -0.5px; }
.page-subtitle { margin: 8px 0 0; color: #667085; font-size: 13px; line-height: 1.6; }
.header-stats { display: grid; grid-template-columns: repeat(4, minmax(96px, 1fr)); gap: 14px; min-width: 460px; }
.stat-item { display: flex; flex-direction: column; align-items: center; padding: 14px 16px; border-radius: 8px; min-width: 92px; transition: all 0.3s; }
.stat-item:hover { transform: translateY(-2px); box-shadow: 0 4px 12px rgba(0,0,0,0.08); }
.stat-label { font-size: 12px; color: #86909c; margin-bottom: 4px; font-weight: 500; }
.stat-value { font-size: 24px; font-weight: 700; }
.stat-item small { margin-top: 4px; color: #98a2b3; font-size: 11px; white-space: nowrap; }
.stat-pending { background: #fff7e6; }
.stat-pending .stat-value { color: #ff9800; }
.stat-processing { background: #e6f4ff; }
.stat-processing .stat-value { color: #1890ff; }
.stat-shipped { background: #e6f7f0; }
.stat-shipped .stat-value { color: #52c41a; }
.stat-completed { background: #f0f2f5; }
.stat-completed .stat-value { color: #86909c; }

.info-banner { display: flex; align-items: center; gap: 16px; padding: 18px 20px; background: linear-gradient(135deg, #eef6ff 0%, #f7fbff 100%); border-radius: 10px; margin: 22px 0 24px; border-left: 4px solid #1890ff; }
.banner-icon { color: #1890ff; display: flex; align-items: center; }
.banner-content { flex: 1; }
.banner-title { font-size: 15px; font-weight: 700; color: #1d2129; margin-bottom: 4px; }
.banner-desc { font-size: 13px; color: #4e5969; line-height: 1.6; }
.banner-badge { flex-shrink: 0; }

.sla-board { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 12px; margin: 18px 0 8px; }
.sla-card { appearance: none; border: 1px solid #e5e6eb; border-radius: 8px; background: #fff; padding: 12px 14px; text-align: left; cursor: pointer; transition: border-color 0.2s, box-shadow 0.2s, transform 0.2s; }
.sla-card:hover, .sla-card.active { transform: translateY(-1px); box-shadow: 0 8px 20px rgba(29, 33, 41, 0.06); }
.sla-card span { display: block; color: #4e5969; font-size: 12px; margin-bottom: 4px; }
.sla-card strong { display: block; color: #1d2129; font-size: 24px; line-height: 1.1; margin-bottom: 4px; }
.sla-card small { color: #86909c; font-size: 11px; }
.sla-card--danger, .sla-card--critical { border-color: #ffd0cc; background: #fff7f6; }
.sla-card--danger strong, .sla-card--critical strong { color: #f56c6c; }
.sla-card--warning { border-color: #ffe0a3; background: #fffaf0; }
.sla-card--warning strong { color: #ff9800; }
.sla-card--info { border-color: #d9ecff; background: #f7fbff; }
.sla-card--info strong { color: #1890ff; }

.control-panel { display: grid; grid-template-columns: minmax(420px, 0.85fr) minmax(560px, 1.15fr); gap: 20px; margin-bottom: 18px; }
.panel-block { min-width: 0; padding: 18px 20px; border: 1px solid #e5eefb; border-radius: 10px; background: #fbfdff; }
.panel-head { display: flex; justify-content: space-between; align-items: flex-start; gap: 16px; margin-bottom: 16px; }
.panel-title { display: block; color: #1d2129; font-size: 15px; font-weight: 700; }
.panel-head p { margin: 4px 0 0; color: #86909c; font-size: 12px; line-height: 1.5; }
.filter-container { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 12px 14px; align-items: center; }
.filter-container :deep(.el-input), .filter-container :deep(.el-select) { width: 100%; min-width: 0; }
.toolbar-actions { display: flex; align-items: center; gap: 14px; row-gap: 12px; flex-wrap: wrap; }
.toolbar-actions :deep(.el-date-editor.el-input) { width: 140px; }
.top-btn-text { font-weight: 600; }
.table-header-help { cursor: help; border-bottom: 1px dotted #98a2b3; }
.import-workbench { display: flex; flex-direction: column; gap: 22px; }
.import-workbench-actions { display: flex; justify-content: center; align-items: center; gap: 14px; }
.import-summary { display: grid; grid-template-columns: repeat(3, 1fr); gap: 12px; margin-bottom: 16px; }
.import-result-tip { margin-bottom: 14px; }
.import-stat-card { border-radius: 12px; padding: 16px; background: #f7f8fa; text-align: center; }
.import-stat-card span { display: block; color: #86909c; font-size: 13px; margin-bottom: 6px; }
.import-stat-card strong { display: block; font-size: 30px; line-height: 1; color: #1d2129; }
.import-stat-card.success { background: #e6f7f0; }
.import-stat-card.success strong { color: #52c41a; }
.import-stat-card.fail { background: #fff1f0; }
.import-stat-card.fail strong { color: #f56c6c; }
.export-field-panel { padding: 4px 2px; }
.export-field-grid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 10px 18px; }
.print-area { display: none; }
.print-page { background: #fff; color: #1d2129; font-family: "Microsoft YaHei", Arial, sans-serif; }
.print-title { text-align: center; font-size: 24px; font-weight: 700; margin: 0 0 24px; }
.print-meta { display: flex; justify-content: space-between; margin-bottom: 18px; font-size: 14px; }
.print-section-block { margin-bottom: 22px; }
.print-section-block h2 { font-size: 16px; margin: 0 0 10px; border-left: 4px solid #1890ff; padding-left: 8px; }
.print-info-grid { display: grid; grid-template-columns: repeat(2, 1fr); gap: 8px 24px; font-size: 14px; }
.print-product-table { width: 100%; border-collapse: collapse; font-size: 13px; }
.print-product-table th, .print-product-table td { border: 1px solid #dcdfe6; padding: 8px 10px; text-align: left; vertical-align: top; }
.print-product-table th { background: #f5f7fa; font-weight: 700; }
.print-remark { margin-top: 18px; padding: 12px 14px; border: 1px dashed #1890ff; border-radius: 8px; background: #f0f8ff; color: #1d2129; font-size: 14px; }
.print-footer-text { margin-top: 28px; text-align: center; color: #606266; font-size: 14px; }
.table-responsive { width: 100%; overflow-x: auto; margin-top: 4px; }
.modern-table { min-width: 900px; }
.modern-table :deep(.el-table__inner-wrapper::before) { display: none; }
.modern-table :deep(th.el-table__cell) { background-color: #f7f8fa !important; color: #4e5969; font-weight: 600; border-bottom: none; font-size: 13px; }
.modern-table :deep(td.el-table__cell) { border-bottom: 1px solid #f0f2f5; padding: 16px 0; }
.operation-actions { display: inline-flex; align-items: center; justify-content: flex-end; gap: 8px; white-space: nowrap; }
.operation-actions :deep(.el-button + .el-button) { margin-left: 0; }
.remark-button { position: relative; }
.remark-button.has-remark { color: #f56c6c; font-weight: 600; }
.remark-button.has-remark::after { content: ""; position: absolute; top: 1px; right: -5px; width: 6px; height: 6px; border-radius: 50%; background: #f56c6c; }
.quick-remark-form :deep(.el-form-item:last-child) { margin-bottom: 0; }

.clinic-name { font-weight: 600; color: #1d2129; font-size: 14px; margin-bottom: 4px; }
.customer-name { color: #4e5969; font-size: 13px; margin-bottom: 2px; }
.phone-number { color: #86909c; font-size: 12px; font-family: 'Consolas', monospace; }

.product-model { font-weight: 600; color: #1890ff; font-size: 13px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; margin-bottom: 4px; }
.fault-desc { font-size: 12px; color: #86909c; overflow: hidden; text-overflow: ellipsis; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; line-height: 1.4; }
.drawer-body { padding: 4px 18px 16px; color: #4e5969; font-size: 14px; line-height: 1.9; }
.drawer-order-head { display: flex; justify-content: space-between; align-items: center; margin-bottom: 14px; }
.drawer-tabs :deep(.el-tabs__header) { margin-bottom: 14px; }
.drawer-section { background: #f7f8fa; padding: 16px; border-radius: 10px; margin-bottom: 16px; }
.drawer-section p { margin: 0; }
.drawer-section-title { font-weight: 600; color: #1d2129; margin: 0 0 8px !important; }
.drawer-section-head { display: flex; justify-content: space-between; align-items: center; gap: 12px; margin-bottom: 12px; }
.assign-engineer-row { display: flex; align-items: center; gap: 8px; margin-top: 8px; flex-wrap: wrap; }
.drawer-section-head .drawer-section-title { margin-bottom: 0 !important; }
.customer-section { background: #eef6ff; }
.drawer-info-grid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 10px 14px; }
.drawer-info-item { min-width: 0; padding: 10px 12px; border-radius: 8px; background: rgba(255, 255, 255, 0.72); }
.drawer-info-item.is-wide { grid-column: 1 / -1; }
.drawer-info-item span { display: block; margin-bottom: 4px; color: #86909c; font-size: 12px; line-height: 1.3; }
.drawer-info-item strong { display: block; color: #1d2129; font-size: 14px; font-weight: 600; line-height: 1.5; word-break: break-all; }
.mono-text { font-family: 'Consolas', 'Menlo', monospace; }
.quote-editor-section, .payment-section { background: #fff; border: 1px solid #e5eefb; box-shadow: 0 8px 24px rgba(24, 144, 255, 0.06); }
.quote-summary-bar { display: grid; grid-template-columns: repeat(5, minmax(0, 1fr)); gap: 10px; margin-bottom: 12px; }
.quote-summary-bar div, .payment-status-grid div { padding: 10px 12px; border-radius: 8px; background: #f7fbff; border: 1px solid #e6f4ff; }
.quote-summary-bar span, .payment-status-grid span { display: block; color: #86909c; font-size: 12px; line-height: 1.3; margin-bottom: 4px; }
.quote-summary-bar strong, .payment-status-grid strong { display: block; color: #1d2129; font-size: 15px; line-height: 1.4; }
.quote-summary-bar .quote-total { color: #1890ff; font-size: 18px; }
.quote-template-row { display: grid; grid-template-columns: minmax(180px, 280px) 1fr; gap: 10px; align-items: center; margin-bottom: 12px; color: #86909c; font-size: 12px; }
.quote-item-list { display: flex; flex-direction: column; gap: 10px; margin-bottom: 10px; }
.quote-item-editor { display: flex; flex-direction: column; gap: 8px; padding: 12px; border-radius: 10px; background: #f7f8fa; border: 1px solid #eef0f3; }
.quote-fee-row { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)) auto; align-items: center; gap: 8px; }
.quote-fee-row :deep(.el-input-number) { width: 100%; }
.quote-section { display: flex; flex-direction: column; gap: 8px; margin-bottom: 12px; padding: 12px; border-radius: 8px; background: #f7f8fa; border: 1px solid #eef0f3; }
.quote-section-head { display: flex; align-items: center; justify-content: space-between; gap: 8px; color: #1d2129; font-size: 14px; font-weight: 600; }
.quote-row-grid { display: grid; align-items: center; gap: 8px; }
.quote-row-grid--parts { grid-template-columns: 120px minmax(120px, 1fr) 120px 130px 110px 96px auto; }
.quote-row-grid--services { grid-template-columns: minmax(140px, 1.2fr) 120px 130px 110px 96px auto; }
.quote-row-grid--others { grid-template-columns: minmax(160px, 1fr) 130px 110px 96px auto; }
.quote-row-grid :deep(.el-input-number) { width: 100%; }
.quote-row-grid strong { color: #1d2129; font-size: 13px; white-space: nowrap; }
.quote-final-row { display: grid; grid-template-columns: 96px minmax(180px, 260px); align-items: center; gap: 10px; margin: 10px 0; color: #1d2129; font-weight: 600; }
.quote-final-row :deep(.el-input-number) { width: 100%; }
.quote-actions { display: flex; justify-content: flex-end; gap: 8px; margin-top: 10px; }
.quote-tip { color: #86909c; font-size: 12px; line-height: 1.6; margin-top: 8px !important; }
.payment-status-grid { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 10px; margin-bottom: 12px; }
.payment-proof-list { display: flex; flex-direction: column; gap: 10px; margin-top: 10px; }
.payment-proof-card { display: flex; gap: 12px; align-items: center; padding: 10px; border-radius: 10px; background: #f7f8fa; border: 1px solid #eef0f3; }
.payment-proof-thumb, .payment-proof-placeholder { width: 64px; height: 64px; flex-shrink: 0; border-radius: 8px; }
.payment-proof-placeholder { display: inline-flex; align-items: center; justify-content: center; background: #e6f4ff; color: #1890ff; font-size: 13px; font-weight: 600; }
.payment-proof-info { min-width: 0; display: flex; flex-direction: column; gap: 3px; line-height: 1.4; }
.payment-proof-info strong { color: #1d2129; font-size: 14px; }
.payment-proof-info span { color: #86909c; font-size: 12px; }
.payment-proof-info a { color: #1890ff; font-size: 12px; text-decoration: none; }
.part-picker-toolbar { display: flex; align-items: center; gap: 10px; margin-bottom: 12px; }
.payment-actions { display: flex; align-items: center; gap: 10px; margin-top: 12px; }
.payment-paid-tip { color: #52c41a; font-size: 13px; }
.payment-rejected-tip { color: #f56c6c; font-size: 13px; }
.drawer-section .el-textarea { margin-bottom: 10px; }
.drawer-section .el-button { margin-top: 2px; }
.drawer-footer { width: 100%; display: flex; flex-direction: column; gap: 14px; padding-top: 4px; }
.drawer-status-box { background: #f7f8fa; border-radius: 10px; padding: 12px 14px; }
.drawer-status-title { display: block; font-weight: 600; color: #1d2129; margin-bottom: 8px; }
.drawer-footer-actions { display: flex; justify-content: flex-end; gap: 10px; }
.empty-text { margin: 0; color: #86909c; }
.product-detail-list { display: flex; flex-direction: column; gap: 12px; }
.product-detail-card { background: #fff; border: 1px solid #e5e6eb; border-radius: 8px; padding: 12px; }
.product-detail-card p { margin: 0; }
.product-card-title { font-weight: 600; color: #1d2129; margin-bottom: 6px; }
.sn-edit-row { display: flex; align-items: center; gap: 8px; margin-bottom: 8px; }
.sn-edit-label { font-size: 13px; color: #4e5969; flex: none; }
.sn-edit-input { width: 200px; }
.sn-fields-grid { display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 8px; margin-bottom: 8px; }
.sn-warranty-expire { font-size: 12px; color: #86909c; margin: 2px 0 4px; }
.product-detail-actions { display: flex; align-items: center; gap: 12px; margin-top: 12px; }
.product-detail-tip { font-size: 12px; color: #86909c; }
.warranty-tag { margin: 2px 0; }
.quote-warranty-alert { margin-bottom: 12px; }
.attachment-title { margin: 8px 0 6px; color: #86909c; }
.attachment-list { display: flex; gap: 8px; flex-wrap: wrap; }
.attachment-thumb { width: 72px; height: 72px; border-radius: 8px; }
.video-link { display: inline-flex; align-items: center; min-height: 28px; padding: 0 10px; border-radius: 6px; background: #e6f4ff; color: #1890ff; font-size: 12px; text-decoration: none; }

.logistics-info { font-size: 12px; color: #4e5969; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; margin-bottom: 2px; }
.logistics-label { color: #86909c; font-weight: 500; }
.next-action-cell { display: flex; flex-direction: column; align-items: flex-start; gap: 4px; min-width: 0; }
.next-action-cell span:last-child { color: #86909c; font-size: 11px; line-height: 1.35; }
.sla-cell { display: flex; flex-direction: column; align-items: flex-start; gap: 4px; min-width: 0; }
.sla-cell span:last-child { color: #86909c; font-size: 11px; line-height: 1.35; }
.sla-cell--warning span:last-child { color: #ff9800; font-weight: 600; }
.sla-cell--critical span:last-child { color: #f56c6c; font-weight: 600; }

.status-tag { font-weight: 600; font-size: 12px; }
.status-dropdown-trigger { display: inline-flex; cursor: pointer; outline: none; }
.status-dropdown-caret { margin-left: 4px; font-size: 10px; }
.status-已提交, .status-待处理 { background: #e6f4ff !important; color: #1890ff !important; border-color: #91d5ff !important; }
.status-运输中, .status-已签收 { background: #fff7e6 !important; color: #ff9800 !important; border-color: #ffd666 !important; }
.status-处理中, .status-维修中 { background: #e6f4ff !important; color: #1890ff !important; border-color: #91d5ff !important; }
.status-已回寄, .status-已发货, .status-已完成 { background: #e6f7f0 !important; color: #52c41a !important; border-color: #95de64 !important; }
.status-已取消 { background: #fff1f0 !important; color: #f56c6c !important; border-color: #ffccc7 !important; }
.status-已处理 { background: #f0f2f5 !important; color: #86909c !important; border-color: #d9d9d9 !important; }
.update-time { font-size: 11px; color: #86909c; margin-top: 4px; }
.update-time.is-overdue { color: #f56c6c; font-weight: 600; }
.inline-muted { color: #86909c; font-size: 12px; margin-left: 6px; }
.section-helper { color: #86909c; font-size: 12px; line-height: 1.6; margin: 0 0 10px !important; }
.status-radio-group { display: flex; flex-wrap: wrap; gap: 4px 10px; }
.quote-recommend-row { display: flex; align-items: center; flex-wrap: wrap; gap: 8px; margin-bottom: 12px; color: #4e5969; font-size: 12px; }
.quote-recommend-row > span { color: #86909c; }
.quote-inventory-alert { margin-bottom: 12px; }
.remark-field { border-radius: 10px; padding: 12px; margin-bottom: 10px; border: 1px solid transparent; }
.remark-field--internal { background: #f5f7fa; border-color: #e5e6eb; }
.remark-field--customer { background: #fff7e6; border-color: #ffd591; }
.remark-field-head { display: flex; justify-content: space-between; align-items: center; gap: 10px; margin-bottom: 8px; }
.remark-field-head strong { color: #1d2129; font-size: 13px; }
.remark-field-head span { color: #86909c; font-size: 12px; text-align: right; }
.quick-remark-form .remark-field :deep(.el-form-item) { margin-bottom: 0; }

.invoice-tag { font-weight: 600; font-size: 12px; }
.invoice-无需开票 { background: #f0f2f5 !important; color: #86909c !important; border-color: #d9d9d9 !important; }
.invoice-未发票 { background: #fff7e6 !important; color: #ff9800 !important; border-color: #ffd666 !important; }
.invoice-已发票 { background: #e6f7f0 !important; color: #52c41a !important; border-color: #95de64 !important; }

@media screen and (max-width: 768px) {
  .page-header { flex-direction: column; align-items: flex-start; gap: 16px; }
  .header-stats { width: 100%; min-width: 0; overflow-x: auto; }
  .control-panel { grid-template-columns: 1fr; }
  .filter-container { grid-template-columns: 1fr; align-items: stretch !important; gap: 12px; }
  .filter-container .el-input, .filter-container .el-select { width: 100% !important; }
  .toolbar-actions { width: 100%; }
  .toolbar-actions :deep(.el-date-editor.el-input) { width: 100%; }
  .sla-board { grid-template-columns: repeat(2, minmax(0, 1fr)); }
  .info-banner { align-items: flex-start; }
  .banner-badge { display: none; }
  .drawer-info-grid { grid-template-columns: 1fr; }
}

@media print {
  :global(body *) { visibility: hidden; }
  #print-area, #print-area * { visibility: visible; }
  #print-area { display: block !important; position: absolute; left: 0; top: 0; width: 100%; }
  .print-page { page-break-after: always; padding: 20px; min-height: 100vh; box-sizing: border-box; }
  .print-page:last-child { page-break-after: auto; }
}
</style>
