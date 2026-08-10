<template>
  <div class="glass-card">
    <div class="page-header">
      <div>
        <h2 class="page-title">报修工单管理</h2>
        <p class="page-subtitle">从待签收、报价到回寄，集中处理客户维修工单。</p>
      </div>
      <div class="page-header-actions">
        <el-button v-if="canPerformOrderAction('create_order')" type="primary" @click="openCreateOrderDialog">
          <el-icon><Plus /></el-icon> 新建工单
        </el-button>
      </div>
    </div>

    <div class="workorder-toolbar">
      <div class="search-strip">
        <div class="search-strip-main">
          <el-input v-model="wo.search" placeholder="搜索工单号、快递单号、客户、手机号或设备 SN" clearable prefix-icon="Search"></el-input>
        </div>
        <el-select v-model="wo.filter" placeholder="工单状态" clearable>
          <el-option v-for="status in adminStatusOptions" :key="status" :label="status" :value="status"></el-option>
        </el-select>
        <el-select v-model="wo.deviceFilter" placeholder="设备型号" clearable>
          <el-option v-for="device in deviceModels" :key="device" :label="device" :value="device"></el-option>
        </el-select>
        <el-select v-model="searchInvoiceStatus" placeholder="发票状态">
          <el-option label="全部发票状态" value=""></el-option>
          <el-option label="无需开票" value="无需开票"></el-option>
          <el-option label="未发票" value="未发票"></el-option>
          <el-option label="已发票" value="已发票"></el-option>
        </el-select>
        <el-select v-model="wo.warrantyFilter" placeholder="质保状态" clearable>
          <el-option label="全部质保状态" value=""></el-option>
          <el-option label="在保" value="in_warranty"></el-option>
          <el-option label="已过保" value="expired"></el-option>
        </el-select>
        <el-select v-model="wo.customerTypeFilter" placeholder="用户类型" clearable filterable allow-create default-first-option>
          <el-option label="全部用户类型" value=""></el-option>
          <el-option v-for="option in customerTypeOptionsWithCurrent(wo.customerTypeFilter)" :key="option.value" :label="option.label" :value="option.value"></el-option>
        </el-select>
        <el-select v-model="slaFilter" placeholder="SLA 状态" clearable>
          <el-option label="全部 SLA 状态" value=""></el-option>
          <el-option label="已超时" value="overdue"></el-option>
          <el-option label="严重超时" value="critical"></el-option>
          <el-option label="临近超时" value="warning"></el-option>
        </el-select>
        <el-tag v-if="activeTodoType" type="warning" closable @close="clearTodoFilter">{{ activeTodoLabel }}</el-tag>
      </div>
      <div class="batch-strip">
        <span v-if="selectedOrders.length" class="selection-count">已选 {{ selectedOrders.length }} 单</span>
        <el-tooltip content="物流批量导入（签收单/回寄单）已统一到「物流管理」" placement="top">
          <el-button type="primary" plain class="top-btn-text" @click="$router.push('/logistics?tab=import')"><el-icon><Van /></el-icon> 物流导入</el-button>
        </el-tooltip>
        <el-dropdown :disabled="!selectedOrders.length || batchCompleting || batchDeleting" trigger="click" @command="handleBatchToolbarCommand">
          <el-button plain class="top-btn-text" :disabled="!selectedOrders.length || batchCompleting || batchDeleting" :loading="batchCompleting || batchDeleting">
            批量操作<el-icon class="el-icon--right"><ArrowDown /></el-icon>
          </el-button>
          <template #dropdown>
            <el-dropdown-menu>
              <el-dropdown-item command="print"><el-icon><Printer /></el-icon>打印所选工单</el-dropdown-item>
              <el-dropdown-item command="processing" :disabled="!getTransitionableOrders('处理中').length"><el-icon><CircleCheck /></el-icon>标记为处理中</el-dropdown-item>
              <el-dropdown-item command="complete" :disabled="!getTransitionableOrders('已完成').length" divided><el-icon><CircleCheck /></el-icon>批量结单</el-dropdown-item>
              <el-dropdown-item v-if="canPerformOrderAction('delete_order')" command="delete" divided><el-icon><Delete /></el-icon>删除所选工单</el-dropdown-item>
            </el-dropdown-menu>
          </template>
        </el-dropdown>
        <el-tooltip content="按当前筛选条件导出工单表格" placement="top">
          <el-button type="primary" class="top-btn-text" @click="openExportDialog"><el-icon><Download /></el-icon> 导出</el-button>
        </el-tooltip>
        <el-popover placement="bottom-end" trigger="click" width="360" :teleported="false">
          <template #reference>
            <el-button plain class="top-btn-text"><el-icon><Setting /></el-icon> 显示列</el-button>
          </template>
          <div class="column-config-panel">
            <div class="column-config-head">
              <strong>列表显示</strong>
              <el-button link type="primary" @click="resetTableColumns">恢复默认</el-button>
            </div>
            <el-checkbox-group v-model="visibleTableColumnKeys" class="column-config-grid">
              <el-checkbox v-for="column in tableColumnOptions" :key="column.key" :label="column.key">
                {{ column.label }}
              </el-checkbox>
            </el-checkbox-group>
          </div>
        </el-popover>
      </div>
    </div>

    <div class="attention-strip">
      <span class="attention-label">需要关注</span>
      <div class="sla-board">
      <el-button
        v-for="item in slaCards"
        :key="item.key"
        text
        class="sla-card"
        :class="[`sla-card--${item.tone}`, { active: slaFilter === item.filter }]"
        @click="applySlaFilter(item.filter)"
      >
        <span>{{ item.label }}</span>
        <strong>{{ item.count }}</strong>
        <small>{{ item.desc }}</small>
      </el-button>
      </div>
    </div>

    <div class="table-section-head">
      <div>
        <strong>工单列表</strong>
        <span>共 {{ totalOrders }} 单，点击“处理”进入当前工单工作台</span>
      </div>
      <span v-if="selectedOrders.length" class="table-selection-note">已选择 {{ selectedOrders.length }} 单</span>
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
        <el-table-column v-if="isTableColumnVisible('id')" prop="id" label="工单号" width="150" show-overflow-tooltip></el-table-column>

        <el-table-column v-if="isTableColumnVisible('reporter')" label="报修方信息" width="200">
          <template #default="{row}">
            <div class="clinic-name">{{ row.clinicName }}</div>
            <div class="customer-name">
              {{ row.customerName }}
              <el-tag
                v-if="customerTypeMeta(row.customerType)"
                size="small"
                effect="light"
                round
                :type="customerTypeMeta(row.customerType).type"
                class="customer-type-tag"
                :title="customerTypeMeta(row.customerType).label"
              >{{ customerTypeMeta(row.customerType).label }}</el-tag>
            </div>
            <div class="phone-number">{{ row.phone }}</div>
          </template>
        </el-table-column>

        <el-table-column v-if="isTableColumnVisible('receivedDate')" prop="receivedDate" label="收件日期" width="120" show-overflow-tooltip></el-table-column>
        <el-table-column v-if="isTableColumnVisible('bizUser')" prop="bizUser" label="对接业务员" width="120" show-overflow-tooltip></el-table-column>
        <el-table-column v-if="isTableColumnVisible('customerType')" label="客户类型" width="110" show-overflow-tooltip>
          <template #default="{row}">{{ customerTypeLabel(row.customerType) || '-' }}</template>
        </el-table-column>
        <el-table-column v-if="isTableColumnVisible('clinicName')" prop="clinicName" label="客户/单位名称" width="180" show-overflow-tooltip></el-table-column>
        <el-table-column v-if="isTableColumnVisible('contactName')" prop="contactName" label="联系人" width="110" show-overflow-tooltip></el-table-column>
        <el-table-column v-if="isTableColumnVisible('phone')" prop="phone" label="手机号" width="130" show-overflow-tooltip></el-table-column>
        <el-table-column v-if="isTableColumnVisible('customerAddress')" prop="customerAddress" label="客户地址" min-width="220" show-overflow-tooltip></el-table-column>
        <el-table-column v-if="isTableColumnVisible('logisticsCompany')" prop="logisticsCompany" label="寄入快递公司" width="130" show-overflow-tooltip></el-table-column>
        <el-table-column v-if="isTableColumnVisible('logisticsNo')" prop="logisticsNo" label="寄入快递单号" width="170" show-overflow-tooltip></el-table-column>

        <el-table-column v-if="isTableColumnVisible('productName')" label="产品名称" width="140" show-overflow-tooltip>
          <template #default="{row}">
            <div class="device-main-cell">{{ row.productName || '-' }}</div>
          </template>
        </el-table-column>

        <el-table-column v-if="isTableColumnVisible('productCategory')" prop="productCategory" label="设备分类" width="130" show-overflow-tooltip></el-table-column>

        <el-table-column v-if="isTableColumnVisible('productModel')" label="型号" width="140" show-overflow-tooltip>
          <template #default="{row}">
            <div class="device-main-cell device-main-cell--muted">{{ row.productModel || '-' }}</div>
          </template>
        </el-table-column>

        <el-table-column v-if="isTableColumnVisible('productCode')" label="编码/SN" width="160" show-overflow-tooltip>
          <template #default="{row}">
            <div class="device-code-cell">{{ getOrderProductCode(row) }}</div>
          </template>
        </el-table-column>

        <el-table-column v-if="isTableColumnVisible('buyDate')" prop="buyDate" label="购买日期" width="120" show-overflow-tooltip></el-table-column>
        <el-table-column v-if="isTableColumnVisible('warrantyMonths')" label="质保月数" width="110" show-overflow-tooltip>
          <template #default="{row}">{{ row.warrantyMonths ? `${row.warrantyMonths} 个月` : '-' }}</template>
        </el-table-column>
        <el-table-column v-if="isTableColumnVisible('warrantyExpire')" prop="warrantyExpire" label="质保到期日" width="130" show-overflow-tooltip></el-table-column>

        <el-table-column v-if="isTableColumnVisible('fault')" label="故障" min-width="200">
          <template #default="{row}">
            <el-tag v-if="warrantyTagMeta(row.warrantyStatus)" :type="warrantyTagMeta(row.warrantyStatus).type" effect="light" round size="small" class="warranty-tag">
              {{ warrantyTagMeta(row.warrantyStatus).label }}
            </el-tag>
            <div class="fault-desc">{{ row.fault || '-' }}</div>
          </template>
        </el-table-column>

        <el-table-column v-if="isTableColumnVisible('logistics')" label="物流信息" width="220">
          <template #default="{row}">
            <div class="logistics-info">
              <span class="logistics-label">寄出：</span>{{ row.senderAddress || '-' }}
            </div>
            <div class="logistics-info">
              <span class="logistics-label">回寄：</span>{{ row.returnNo ? `${row.returnCompany || '物流'} ${row.returnNo}` : row.returnAddress || '-' }}
            </div>
          </template>
        </el-table-column>

        <el-table-column v-if="isTableColumnVisible('adminRemark')" prop="adminRemark" label="内部备注" min-width="180" show-overflow-tooltip></el-table-column>
        <el-table-column v-if="isTableColumnVisible('printRemark')" prop="printRemark" label="随件留言" min-width="180" show-overflow-tooltip></el-table-column>

        <el-table-column v-if="isTableColumnVisible('nextAction')" width="126">
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

        <el-table-column v-if="isTableColumnVisible('status')" width="130">
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

        <el-table-column v-if="isTableColumnVisible('invoice')" width="110">
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

        <el-table-column v-if="isTableColumnVisible('sla')" width="126">
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
        layout="sizes, prev, pager, next"
        background>
      </el-pagination>
    </div>
  </div>

  <el-drawer
    v-model="drawerVisible"
    title="工单处理"
    direction="rtl"
    :size="isMobile ? '100%' : 'min(920px, 72vw)'"
    append-to-body
    destroy-on-close
    class="work-order-drawer"
  >
    <template v-if="currentOrder">
      <div class="drawer-body">
        <div class="drawer-sticky-head">
          <div class="drawer-order-head">
            <div class="drawer-order-identity">
              <span class="drawer-order-kicker">维修工单</span>
              <strong class="drawer-order-id">{{ currentOrder.id }}</strong>
              <span class="drawer-order-customer">{{ currentOrder.customerName || '未填写客户' }} · {{ currentOrder.clinicName || '未填写单位' }}</span>
            </div>
            <div class="drawer-order-status">
              <el-tag :class="'status-tag status-' + currentOrder.status" :type="getStatusType(currentOrder.status)" effect="light" size="small">{{currentOrder.status}}</el-tag>
              <span class="inline-muted">{{ getStatusDwell(currentOrder).text }}</span>
            </div>
          </div>
          <div class="drawer-next-step" :class="`is-${getNextAction(currentOrder).type || 'info'}`">
            <div class="drawer-next-step-copy">
              <span class="drawer-next-step-eyebrow">当前下一步</span>
              <strong>{{ getNextAction(currentOrder).label }}</strong>
              <span>{{ getNextAction(currentOrder).desc }}</span>
            </div>
            <el-button
              v-if="getRecommendedDrawerTab(currentOrder) !== 'base'"
              class="drawer-next-step-button"
              size="small"
              plain
              @click="focusNextDrawerStep"
            >{{ getNextStepButtonText(currentOrder) }}</el-button>
          </div>
          <div class="drawer-workflow" aria-label="工单处理阶段">
            <div
              v-for="(stage, index) in drawerWorkflowStages"
              :key="stage.key"
              class="drawer-workflow-stage"
              :class="{ 'is-done': index < getDrawerStageIndex(currentOrder), 'is-current': index === getDrawerStageIndex(currentOrder) }"
            >
              <span class="drawer-workflow-dot">{{ index + 1 }}</span>
              <span>{{ stage.label }}</span>
            </div>
          </div>
        </div>
        <el-tabs v-model="activeDrawerTab" class="drawer-tabs">
          <el-tab-pane label="概览" name="base">
            <div class="drawer-scroll-pane">
              <div class="drawer-section customer-section">
                <p class="drawer-section-title">客户信息</p>
                <div class="drawer-info-grid drawer-info-grid--dense">
                  <div class="drawer-info-item">
                    <span>客户姓名</span>
                    <strong>{{currentOrder.customerName || '-'}}</strong>
                  </div>
                  <div class="drawer-info-item">
                    <span>联系电话</span>
                    <strong class="mono-text">{{currentOrder.phone || '-'}}</strong>
                  </div>
                  <div class="drawer-info-item">
                    <span>用户类型</span>
                    <strong>
                      <el-tag
                        v-if="customerTypeMeta(currentOrder.customerType)"
                        size="small"
                        effect="light"
                        :type="customerTypeMeta(currentOrder.customerType).type"
                        :title="customerTypeMeta(currentOrder.customerType).label"
                      >{{ customerTypeMeta(currentOrder.customerType).label }}</el-tag>
                      <span v-else>-</span>
                    </strong>
                  </div>
                  <div class="drawer-info-item is-wide">
                    <span>单位/诊所</span>
                    <strong>{{currentOrder.clinicName || '-'}}</strong>
                  </div>
                  <div class="drawer-info-item is-wide">
                    <span>回寄地址</span>
                    <strong>{{currentOrder.address || '-'}}</strong>
                  </div>
                </div>
                <details class="drawer-meta-disclosure">
                  <summary>关联用户ID等次要信息</summary>
                  <div class="drawer-info-item is-plain">
                    <span>关联用户ID</span>
                    <strong class="mono-text">{{currentOrder.userId || '-'}}</strong>
                  </div>
                </details>
              </div>
              <div class="drawer-section">
                <p class="drawer-section-title">工单信息</p>
                <div class="drawer-info-grid drawer-info-grid--dense">
                  <div class="drawer-info-item">
                    <span>提交时间</span>
                    <strong>{{currentOrder.submitTime || '-'}}</strong>
                  </div>
                  <div class="drawer-info-item">
                    <span>更新时间</span>
                    <strong>{{currentOrder.updateTime || '-'}}</strong>
                  </div>
                  <div class="drawer-info-item">
                    <span>当前状态</span>
                    <strong class="drawer-status-inline">
                      <el-tag :class="'status-tag status-' + currentOrder.status" :type="getStatusType(currentOrder.status)" effect="light" size="small">{{currentOrder.status}}</el-tag>
                      <span class="inline-muted">{{ getStatusDwell(currentOrder).text }}</span>
                    </strong>
                  </div>
                  <div class="drawer-info-item is-wide">
                    <span>负责工程师</span>
                    <div class="assign-engineer-row">
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
                </div>
              </div>
              <div class="drawer-section">
                <p class="drawer-section-title">寄入物流</p>
                <div class="drawer-info-grid drawer-info-grid--dense">
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
              <div class="drawer-section product-overview-section">
                <div class="drawer-section-head">
                  <p class="drawer-section-title">设备与故障</p>
                  <el-button
                    v-if="currentOrder.itemsList && currentOrder.itemsList.length"
                    type="primary"
                    link
                    size="small"
                    @click="activeDrawerTab = 'quote'"
                  >去检测与报价 ›</el-button>
                </div>
                <div v-if="currentOrder.itemsList && currentOrder.itemsList.length" class="overview-product-list">
                  <div
                    v-for="(item, itemIndex) in currentOrder.itemsList"
                    :key="item._id || `overview-${itemIndex}`"
                    class="overview-product-card"
                  >
                    <div class="overview-product-head">
                      <strong>产品 {{ itemIndex + 1 }}：{{ item.product_name || '未命名产品' }}</strong>
                      <el-tag
                        v-if="warrantyTagMeta(snItemWarranty(itemIndex))"
                        :type="warrantyTagMeta(snItemWarranty(itemIndex)).type"
                        size="small"
                        effect="light"
                        round
                      >{{ warrantyTagMeta(snItemWarranty(itemIndex)).label }}</el-tag>
                    </div>
                    <div class="drawer-info-grid drawer-info-grid--dense">
                      <div class="drawer-info-item">
                        <span>产品名称</span>
                        <strong>{{ item.product_name || '-' }}</strong>
                      </div>
                      <div class="drawer-info-item">
                        <span>编码/SN</span>
                        <strong class="mono-text">{{ getItemProductCode(item) }}</strong>
                      </div>
                      <div class="drawer-info-item">
                        <span>分类</span>
                        <strong>{{ item.product_category || '-' }}</strong>
                      </div>
                      <div class="drawer-info-item">
                        <span>型号</span>
                        <strong>{{ item.product_model || '-' }}</strong>
                      </div>
                      <div class="drawer-info-item is-wide">
                        <span>故障描述</span>
                        <strong class="overview-fault-text">{{ item.fault_desc || currentOrder.fault || '-' }}</strong>
                      </div>
                    </div>
                    <div
                      v-if="(item.image_urls && item.image_urls.length) || (item.voucher_urls && item.voucher_urls.length) || (item.video_urls && item.video_urls.length) || (item.media_urls && item.media_urls.length)"
                      class="overview-attachment-block"
                    >
                      <template v-if="item.image_urls && item.image_urls.length">
                        <span class="attachment-title">故障图片</span>
                        <div class="attachment-list">
                          <el-image
                            v-for="(img, index) in item.image_urls"
                            :key="`overview-image-${itemIndex}-${index}`"
                            :src="img"
                            :preview-src-list="item.image_urls"
                            class="attachment-thumb"
                            fit="cover"
                          ></el-image>
                        </div>
                      </template>
                      <template v-if="item.voucher_urls && item.voucher_urls.length">
                        <span class="attachment-title">购买凭证</span>
                        <div class="attachment-list">
                          <el-image
                            v-for="(img, index) in item.voucher_urls"
                            :key="`overview-voucher-${itemIndex}-${index}`"
                            :src="img"
                            :preview-src-list="item.voucher_urls"
                            class="attachment-thumb"
                            fit="cover"
                          ></el-image>
                        </div>
                      </template>
                      <template v-if="item.video_urls && item.video_urls.length">
                        <span class="attachment-title">故障视频</span>
                        <div class="attachment-list">
                          <a
                            v-for="(video, index) in item.video_urls"
                            :key="`overview-video-${itemIndex}-${index}`"
                            :href="video"
                            target="_blank"
                            rel="noreferrer"
                            class="video-link"
                          >视频 {{ index + 1 }}</a>
                        </div>
                      </template>
                      <template v-if="item.media_urls && item.media_urls.length">
                        <span class="attachment-title">其他附件</span>
                        <div class="attachment-list">
                          <a
                            v-for="(url, index) in item.media_urls"
                            :key="`overview-media-${itemIndex}-${index}`"
                            :href="url"
                            target="_blank"
                            rel="noreferrer"
                            class="video-link"
                          >附件 {{ index + 1 }}</a>
                        </div>
                      </template>
                    </div>
                  </div>
                </div>
                <div v-else class="overview-fault-fallback">
                  <div class="drawer-info-item is-wide is-plain">
                    <span>故障描述</span>
                    <strong class="overview-fault-text">{{ currentOrder.fault || '暂无产品明细' }}</strong>
                  </div>
                </div>
              </div>
            </div>
          </el-tab-pane>
          <el-tab-pane label="检测与报价" name="quote">
            <div class="drawer-section">
              <p class="drawer-section-title">检测产品与故障</p>
              <div v-if="currentOrder.itemsList && currentOrder.itemsList.length" class="product-detail-list">
                <div v-for="(item, itemIndex) in currentOrder.itemsList" :key="item._id || itemIndex" class="product-detail-card">
                  <div class="product-card-title">产品 {{ itemIndex + 1 }}：{{ item.product_name || '未命名产品' }}</div>
                  <div class="sn-edit-row">
                    <span class="sn-edit-label">SN</span>
                    <el-input v-model="item.sn" placeholder="输入 SN 序列号" class="sn-edit-input" @blur="lookupOrderItemSn(itemIndex)" @keyup.enter="lookupOrderItemSn(itemIndex, true)" />
                    <el-button type="primary" :loading="snLookupLoading[itemIndex]" @click="lookupOrderItemSn(itemIndex, true)">查询</el-button>
                    <el-tag v-if="warrantyTagMeta(snItemWarranty(itemIndex))" :type="warrantyTagMeta(snItemWarranty(itemIndex)).type" effect="light" round>
                      {{ warrantyTagMeta(snItemWarranty(itemIndex)).label }}
                    </el-tag>
                  </div>
                  <div class="sn-fields-grid">
                    <el-input v-model="item.product_category" placeholder="设备分类" />
                    <el-input v-model="item.product_model" placeholder="设备型号" />
                    <el-date-picker v-model="item.buy_date" type="date" value-format="YYYY-MM-DD" placeholder="采购日期" style="width:100%;" />
                  </div>
                  <div class="warranty-entry-row">
                    <div>
                      <span>质保月数（可选）</span>
                      <el-input-number v-model="item.warranty_months" :min="1" :max="120" :precision="0" controls-position="right" placeholder="不确定可留空" />
                    </div>
                    <div>
                      <span>质保截止（可选）</span>
                      <el-date-picker v-model="item.warranty_expire" type="date" value-format="YYYY-MM-DD" placeholder="以此日期为准" clearable style="width:100%;" />
                    </div>
                    <p>{{ itemWarrantyPreview(item).detail }}</p>
                  </div>
                  <div class="coverage-review-row">
                    <div class="coverage-review-head">
                      <strong>本次质保结论</strong>
                      <span>设备是否在保与本次是否免费分开判断</span>
                    </div>
                    <div class="coverage-fields-grid">
                      <el-select v-model="item.coverage_result" :disabled="!canPerformOrderAction('issue_quote')" placeholder="选择本次结论" clearable>
                        <el-option v-for="option in coverageResultOptions" :key="option.value" :label="option.label" :value="option.value"></el-option>
                      </el-select>
                      <el-select v-model="item.coverage_reason" :disabled="!canPerformOrderAction('issue_quote')" placeholder="选择判断原因" clearable>
                        <el-option v-for="option in coverageReasonOptions" :key="option.value" :label="option.label" :value="option.value"></el-option>
                      </el-select>
                    </div>
                    <el-input
                      v-model="item.coverage_note"
                      :disabled="!canPerformOrderAction('issue_quote')"
                      placeholder="可补充核验依据，例如凭证、故障原因或不保原因"
                      maxlength="200"
                      show-word-limit
                    ></el-input>
                  </div>
                  <el-button v-if="snLookupResults[itemIndex] && snLookupResults[itemIndex].history && snLookupResults[itemIndex].history.length" type="primary" link @click="openSnHistory(itemIndex)">
                    查看该设备历史工单（{{ snLookupResults[itemIndex].history.length }}）›
                  </el-button>
                  <p class="product-fault-line"><span>故障描述</span>{{ item.fault_desc || '-' }}</p>
                  <template v-if="item.voucher_urls && item.voucher_urls.length">
                    <p class="attachment-title">购买凭证</p>
                    <div class="attachment-list">
                      <el-image v-for="(img, index) in item.voucher_urls" :key="`voucher-${itemIndex}-${index}`" :src="img" :preview-src-list="item.voucher_urls" class="attachment-thumb" fit="cover"></el-image>
                    </div>
                  </template>
                  <template v-if="item.image_urls && item.image_urls.length">
                    <p class="attachment-title">故障图片</p>
                    <div class="attachment-list">
                      <el-image v-for="(img, index) in item.image_urls" :key="`image-${itemIndex}-${index}`" :src="img" :preview-src-list="item.image_urls" class="attachment-thumb" fit="cover"></el-image>
                    </div>
                  </template>
                  <template v-if="item.video_urls && item.video_urls.length">
                    <p class="attachment-title">故障视频</p>
                    <div class="attachment-list">
                      <a v-for="(video, index) in item.video_urls" :key="`video-${itemIndex}-${index}`" :href="video" target="_blank" rel="noreferrer" class="video-link">视频 {{ index + 1 }}</a>
                    </div>
                  </template>
                  <template v-if="item.media_urls && item.media_urls.length">
                    <p class="attachment-title">历史附件</p>
                    <div class="attachment-list">
                      <a v-for="(url, index) in item.media_urls" :key="`media-${itemIndex}-${index}`" :href="url" target="_blank" rel="noreferrer" class="video-link">附件 {{ index + 1 }}</a>
                    </div>
                  </template>
                </div>
                <div class="product-detail-actions">
                  <el-button type="primary" :loading="savingOrderItems" @click="saveOrderItemsInfo">保存设备信息</el-button>
                  <span class="product-detail-tip">零元质保方案需要每台设备都明确选择“质保免费”；仅在保但未核验不会自动免收费。</span>
                </div>
              </div>
              <p v-else class="empty-text">暂无产品明细</p>
            </div>
            <div class="drawer-section quote-editor-section">
              <div class="drawer-section-head">
                <p class="drawer-section-title">维修报价</p>
                <el-tag :type="getQuoteStatusType(quoteForm.status)" size="small">{{ getQuoteStatusText(quoteForm.status) }}</el-tag>
              </div>
              <div class="quote-staircase">
                <section class="quote-stage quote-stage--warranty">
                  <div class="quote-stage-head">
                    <span class="quote-stage-index">1</span>
                    <div><strong>确认本次收费方式</strong><span>先完成设备级质保核验，再决定是否可免费维修。</span></div>
                  </div>
                  <el-alert
                    v-if="currentOrderWarrantyHint.show"
                    :title="currentOrderWarrantyHint.text"
                    :type="currentOrderWarrantyHint.type"
                    :closable="false"
                    show-icon
                    class="quote-warranty-alert"
                  ></el-alert>
                </section>
                <section class="quote-stage quote-stage--amount">
                  <div class="quote-stage-head">
                    <span class="quote-stage-index">2</span>
                    <div><strong>填写客户应付金额</strong><span>快速报价只需填最终金额；需要展示费用构成时再补充明细。</span></div>
                  </div>
                  <div class="quote-quick-panel">
                    <div>
                      <strong>最终报价</strong>
                      <span>客户小程序将以此金额发起确认或付款。</span>
                    </div>
                    <el-input-number v-model="quoteForm.finalPrice" :disabled="!canPerformOrderAction('issue_quote')" :min="0" :precision="2" :step="10" controls-position="right" placeholder="客户最终应付金额"></el-input-number>
                  </div>
                </section>
                <section class="quote-stage quote-stage--details">
                  <div class="quote-stage-head">
                    <span class="quote-stage-index">3</span>
                    <div><strong>补充费用构成</strong><span>配件、服务和其他费用均可选填，用于客户说明和打印清单。</span></div>
                  </div>
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
                  <details class="quote-detail-disclosure" :open="quoteAutoTotal > 0">
                    <summary>
                      <span>编辑费用明细</span>
                      <small>配件、服务或其他费用</small>
                    </summary>
                <div class="quote-section">
                  <div class="quote-section-head">
                    <span>配件费用 <em>选填</em></span>
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
                    <span>服务费用 <em>选填</em></span>
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
                    <span>其他费用 <em>选填</em></span>
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
                  </details>
                </section>
                <section class="quote-stage quote-stage--terms">
                  <div class="quote-stage-head">
                    <span class="quote-stage-index">4</span>
                    <div><strong>设置维修保障与说明</strong><span>明确维修后的质保时长、付款期限和客户可见说明。</span></div>
                  </div>
                  <div class="quote-terms-grid">
                    <div class="quote-final-row">
                      <span>维修质保(月)</span>
                      <el-input-number v-model="quoteForm.warrantyMonths" :disabled="!canPerformOrderAction('issue_quote')" :min="0" :max="60" :step="1" controls-position="right" placeholder="0=沿用全局质保政策"></el-input-number>
                    </div>
                    <div class="quote-final-row">
                      <span>付款期限(天)</span>
                      <el-input-number v-model="quoteForm.paymentDeadlineDays" :disabled="!canPerformOrderAction('issue_quote')" :min="1" :max="60" :step="1" controls-position="right"></el-input-number>
                      <span class="quote-deadline-hint">发布后起算，默认 7 天</span>
                    </div>
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
                      placeholder="例如：维修内容、费用说明或付款须知"
                    ></el-input>
                  </div>
                </section>
                <section class="quote-stage quote-stage--publish">
                  <div class="quote-stage-head">
                    <span class="quote-stage-index">5</span>
                    <div><strong>保存或发布报价</strong><span>草稿仅供后台查看；发布后客户可确认费用并上传付款凭证。</span></div>
                  </div>
                  <div v-if="canPerformOrderAction('issue_quote')" class="quote-actions">
                    <el-button :loading="quoteSaving" @click="saveOrderQuote('draft')">保存草稿</el-button>
                    <el-button type="primary" :loading="quoteSaving" @click="saveOrderQuote('issued')">发布报价</el-button>
                  </div>
                </section>
              </div>
            </div>
          </el-tab-pane>
          <el-tab-pane label="收款" name="payment">
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
              <div v-if="resolvePaymentStatus(currentOrder) === 'uploaded' && canPerformOrderAction('view_payment_proof') && currentOrder.paymentProofs && currentOrder.paymentProofs.length" class="payment-proof-list">
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
              <div v-else-if="!Number(currentOrder.totalPrice || 0)" class="payment-guide payment-guide--waiting">
                <strong>还不能收款</strong>
                <span>请先在“检测与报价”中填写并发布维修报价。</span>
              </div>
              <div v-else-if="resolvePaymentStatus(currentOrder) === 'not_required'" class="payment-guide payment-guide--success">
                <strong>质保免付款</strong>
                <span>本单由质保承担，无需客户付款或财务核销。</span>
              </div>
              <p v-else-if="canPerformOrderAction('view_payment_proof')" class="payment-guide payment-guide--waiting"><strong>等待客户付款</strong><span>客户确认报价后，可通过微信支付或上传对公付款凭证。</span></p>
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
                  v-if="resolvePaymentStatus(currentOrder) === 'paid' && currentOrder.paymentMethod === 'wechat_pay' && !['refunded', 'processing'].includes(currentOrder.refundStatus) && canPerformOrderAction('confirm_payment')"
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
                <el-button
                  v-if="currentOrder.refundStatus === 'processing' && canPerformOrderAction('confirm_payment')"
                  type="warning"
                  size="small"
                  plain
                  :loading="refundSyncing"
                  @click="syncCurrentRefundStatus"
                >
                  刷新退款状态
                </el-button>
                <span v-else-if="currentOrder.refundStatus === 'failed'" class="payment-rejected-tip">退款失败，请核对微信退款单后重试。</span>
                <span v-if="['outbound_processing', 'outbound_failed'].includes(currentOrder.inventoryStatus)" class="payment-rejected-tip">
                  配件出库：{{ currentOrder.inventoryStatus === 'outbound_processing' ? '处理中' : '失败' }}
                </span>
                <el-button
                  v-if="['outbound_processing', 'outbound_failed'].includes(currentOrder.inventoryStatus) && canPerformOrderAction('manage_inventory')"
                  type="warning"
                  size="small"
                  plain
                  :loading="inventoryRecovering"
                  @click="handleRecoverInventory"
                >
                  恢复库存出库
                </el-button>
              </div>
            </div>
          </el-tab-pane>
          <el-tab-pane label="发票" name="invoice">
            <div class="drawer-section invoice-section">
              <div class="drawer-section-head">
                <div>
                  <p class="drawer-section-title">发票处理</p>
                  <p class="section-helper">先确认到账，再登记或开具发票。</p>
                </div>
                <el-tag :type="getInvoiceType(normalizeInvoiceStatus(currentOrder))" size="small">{{ normalizeInvoiceStatus(currentOrder) }}</el-tag>
              </div>
              <div class="invoice-summary-grid">
                <div><span>客户申请</span><strong>{{ currentOrder.needInvoice ? '需要开票' : '无需开票' }}</strong></div>
                <div><span>发票类型</span><strong>{{ currentOrder.invoiceType || invoiceForm.invoiceType || '电子普通发票' }}</strong></div>
                <div><span>开票状态</span><strong>{{ normalizeInvoiceStatus(currentOrder) }}</strong></div>
              </div>
              <el-alert
                v-if="currentOrder.needInvoice && resolvePaymentStatus(currentOrder) !== 'paid'"
                title="客户已申请发票，但当前尚未确认到账"
                description="完成微信支付查单或对公付款核销后，才能开具发票。"
                type="warning"
                :closable="false"
                show-icon
                class="invoice-alert"
              ></el-alert>
              <div v-if="!currentOrder.needInvoice && !invoiceEditorExpanded" class="invoice-empty-state">
                <strong>本单暂不需要发票</strong>
                <span>如果客户补充开票需求，可在这里登记发票信息。</span>
                <el-button v-if="canPerformOrderAction('update_invoice')" size="small" plain @click="invoiceEditorExpanded = true">登记发票</el-button>
              </div>
              <template v-else>
                <div class="invoice-editor-heading">
                  <strong>发票信息</strong>
                  <span>带 * 的信息用于开票和客户接收</span>
                </div>
              <p>是否需要开票：{{currentOrder.needInvoice ? '是' : '否'}}</p>
              <template v-if="currentOrder.needInvoice">
                <p>发票类型：{{currentOrder.invoiceType || '电子普通发票'}}</p>
                <p>发票抬头：{{currentOrder.invoiceTitle || '-'}}</p>
                <p>税号：{{currentOrder.taxId || '-'}}</p>
                <p v-if="currentOrder.invoiceType === '纸质专用发票'">收票信息：{{currentOrder.invoiceRecipientName || '-'}} / {{currentOrder.invoiceRecipientPhone || '-'}} / {{currentOrder.invoiceRecipientAddress || '-'}}</p>
              </template>
              <el-divider border-style="dashed"></el-divider>
              <p class="drawer-section-title">发票登记</p>
              <el-form label-position="top" size="small" class="invoice-form">
                <div class="invoice-form-grid">
                <el-form-item label="发票状态 *">
                  <el-select v-model="invoiceStatus" :disabled="!canPerformOrderAction('update_invoice')" style="width:100%;">
                    <el-option label="无需开票" value="无需开票"></el-option>
                    <el-option label="未发票" value="未发票"></el-option>
                    <el-option label="已发票" value="已发票"></el-option>
                    <el-option label="已寄出" value="已寄出"></el-option>
                    <el-option label="已签收" value="已签收"></el-option>
                  </el-select>
                </el-form-item>
                <el-form-item label="发票类型 *">
                  <el-select v-model="invoiceForm.invoiceType" :disabled="!canPerformOrderAction('update_invoice')" style="width:100%;">
                    <el-option label="电子普通发票" value="电子普通发票"></el-option>
                    <el-option label="纸质专用发票" value="纸质专用发票"></el-option>
                  </el-select>
                </el-form-item>
                <el-form-item label="发票抬头 *">
                  <el-input v-model="invoiceForm.title" :disabled="!canPerformOrderAction('update_invoice')" placeholder="请输入发票抬头"></el-input>
                </el-form-item>
                <el-form-item label="企业税号 *">
                  <el-input v-model="invoiceForm.taxNo" :disabled="!canPerformOrderAction('update_invoice')" placeholder="请输入企业税号"></el-input>
                </el-form-item>
                <el-form-item label="接收邮箱 *">
                  <el-input v-model="invoiceForm.email" :disabled="!canPerformOrderAction('update_invoice')" placeholder="电子发票接收邮箱"></el-input>
                </el-form-item>
                </div>
                <details v-if="invoiceForm.invoiceType === '纸质专用发票'" class="invoice-detail-disclosure">
                  <summary><span>纸质专票与收票信息</span><small>注册地址、银行账户和邮寄地址</small></summary>
                  <div class="invoice-form-grid">
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
                  </div>
                </details>
                <details class="invoice-detail-disclosure" :open="['已发票', '已寄出', '已签收'].includes(invoiceStatus)">
                  <summary><span>开票结果与交付信息</span><small>开票后填写链接、号码和寄送信息</small></summary>
                  <div class="invoice-form-grid">
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
                  </div>
                </details>
              </el-form>
              <div class="invoice-actions">
              <el-tooltip v-if="canPerformOrderAction('update_invoice')" content="保存后会更新该工单的财务开票状态，列表发票状态同步变化" placement="top">
                <el-button type="primary" size="small" @click="saveInvoiceStatus">保存发票信息</el-button>
              </el-tooltip>
              <el-tooltip v-if="canPerformOrderAction('update_invoice') && autoInvoiceEnabled" content="需先确认到账。点此调用开票服务商自动开票并回填链接/号码/日期（未对接服务商前会提示未配置）" placement="top">
                <el-button type="success" plain size="small" :loading="invoiceIssuing" @click="onIssueInvoice">一键开票</el-button>
              </el-tooltip>
              </div>
              </template>
            </div>
          </el-tab-pane>
          <el-tab-pane label="维修/回寄" name="service">
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
          <el-tab-pane label="流转记录" name="timeline">
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
                <el-dropdown-item command="repair_order">维修单</el-dropdown-item>
                <el-dropdown-item command="quote" :disabled="!hasQuoteData">报价单</el-dropdown-item>
                <el-dropdown-item command="settlement" :disabled="!hasQuoteData">结算单</el-dropdown-item>
                <el-dropdown-item command="parts_outbound" :disabled="!hasPartsData">配件出库单</el-dropdown-item>
              </el-dropdown-menu>
            </template>
          </el-dropdown>
          <el-button @click="drawerVisible=false">关闭</el-button>
          <el-tooltip v-if="activeDrawerTab === 'service' && canPerformOrderAction('update_status') && getAllowedStatusOptions(currentOrder).length" content="确认后会推进工单状态，并同步客户小程序进度" placement="top">
            <el-button type="primary" :loading="quickStatusLoading" @click="confirmStatus">推进至{{ newStatus }}</el-button>
          </el-tooltip>
        </div>
      </div>
    </template>
  </el-drawer>

  <el-dialog v-model="quickShipDialogVisible" title="快捷发货" width="400px" align-center @closed="resetQuickShipDialog">
    <el-form label-width="86px">
      <el-form-item label="物流公司" required>
        <el-select
          v-model="quickShipForm.returnCompany"
          placeholder="请选择物流公司"
          filterable
          allow-create
          default-first-option
          clearable
          style="width: 100%;"
        >
          <el-option
            v-for="company in logisticsCompanyOptions"
            :key="company"
            :label="company"
            :value="company"
          ></el-option>
        </el-select>
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

  <el-dialog v-model="batchDeleteDialogVisible" title="批量删除工单" width="560px" align-center @closed="resetBatchDeleteForm">
    <div class="delete-confirm-panel">
      <el-alert
        title="删除后工单会从正常列表、小程序和统计中隐藏，但会保留审计记录。已付款、已开票、已扣库存或状态不允许的工单会自动跳过。"
        type="error"
        :closable="false"
        show-icon
      ></el-alert>
      <div class="delete-confirm-summary">
        <strong>本次选择 {{ selectedOrders.length }} 个工单</strong>
        <span>{{ formatOrderIdList(selectedOrders) }}</span>
      </div>
      <el-form label-position="top">
        <el-form-item label="删除原因" required>
          <el-input
            v-model="batchDeleteForm.reason"
            type="textarea"
            :rows="3"
            maxlength="500"
            show-word-limit
            placeholder="例如：后台误建测试工单、客户重复提交后保留另一张工单"
          ></el-input>
        </el-form-item>
        <el-form-item label="确认短语" required>
          <el-input v-model="batchDeleteForm.confirmText" :placeholder="expectedBatchDeleteConfirmText"></el-input>
          <p class="delete-confirm-tip">请输入：{{ expectedBatchDeleteConfirmText }}</p>
        </el-form-item>
      </el-form>
    </div>
    <template #footer>
      <el-button @click="batchDeleteDialogVisible = false">取消</el-button>
      <el-button type="danger" :loading="batchDeleting" @click="submitBatchDeleteOrders">
        <el-icon><Delete /></el-icon> 确认删除
      </el-button>
    </template>
  </el-dialog>

  <el-dialog
    v-model="createOrderDialogVisible"
    title="新建报修工单"
    width="920px"
    :fullscreen="isMobile"
    align-center
    destroy-on-close
    class="manual-order-dialog"
    @closed="resetCreateOrderForm"
  >
    <el-form ref="createOrderFormRef" :model="createOrderForm" label-position="top" class="manual-order-form">
      <section class="manual-order-section">
        <div class="manual-order-section-head">
          <span class="manual-order-step">1</span>
          <div><strong>受理与客户信息</strong><small>线下收件、客户联系人与 CRM 客户档案</small></div>
        </div>
        <div class="manual-order-grid manual-order-grid--intake">
          <el-form-item label="收件日期" required>
            <el-date-picker v-model="createOrderForm.received_date" type="date" value-format="YYYY-MM-DD" placeholder="选择收件日期"></el-date-picker>
          </el-form-item>
          <el-form-item label="对接业务员">
            <el-input v-model="createOrderForm.customer.biz_user" maxlength="40" placeholder="负责对接的业务员"></el-input>
          </el-form-item>
          <el-form-item label="快递公司">
            <el-input v-model="createOrderForm.ship_out_info.logistics_company" maxlength="40" placeholder="如：顺丰速运"></el-input>
          </el-form-item>
          <el-form-item label="快递单号">
            <el-input v-model="createOrderForm.ship_out_info.logistics_no" maxlength="40" placeholder="客户寄入运单号"></el-input>
          </el-form-item>
          <el-form-item label="客户类型" required>
            <el-select v-model="createOrderForm.customer.customer_type" filterable allow-create default-first-option placeholder="选择或输入客户类型">
              <el-option v-for="option in customerTypeOptionsWithCurrent(createOrderForm.customer.customer_type)" :key="option.value" :label="option.label" :value="option.value"></el-option>
            </el-select>
          </el-form-item>
          <el-form-item label="客户/单位名称" required>
            <el-input v-model="createOrderForm.customer.name" maxlength="80" placeholder="如：某某口腔门诊部"></el-input>
          </el-form-item>
          <el-form-item label="联系人" required>
            <el-input v-model="createOrderForm.customer.contact" maxlength="40" placeholder="客户联系人姓名"></el-input>
          </el-form-item>
          <el-form-item label="手机号" required>
            <el-input v-model="createOrderForm.customer.phone" maxlength="11" inputmode="numeric" placeholder="11 位手机号码"></el-input>
          </el-form-item>
          <el-form-item label="客户地址" required class="manual-order-span-2">
            <el-input v-model="createOrderForm.customer.address" maxlength="200" placeholder="省市区及详细地址"></el-input>
          </el-form-item>
          <el-form-item label="初始状态" required class="manual-order-span-2 manual-order-status">
            <el-radio-group v-model="createOrderForm.status">
              <el-radio-button value="pending">待客户寄入</el-radio-button>
              <el-radio-button value="sent">运输中</el-radio-button>
              <el-radio-button value="received">已到店/已签收</el-radio-button>
            </el-radio-group>
          </el-form-item>
        </div>
      </section>

      <section class="manual-order-section">
        <div class="manual-order-section-head">
          <span class="manual-order-step">2</span>
          <div><strong>设备与故障</strong><small>支持同一工单录入多台设备</small></div>
          <el-button type="primary" plain @click="addCreateOrderItem"><el-icon><Plus /></el-icon> 添加设备</el-button>
        </div>
        <div class="manual-order-item-list">
          <div v-for="(item, index) in createOrderForm.items" :key="item.key" class="manual-order-item">
            <div class="manual-order-item-head">
              <strong>设备 {{ index + 1 }}</strong>
              <el-tooltip v-if="createOrderForm.items.length > 1" content="移除此设备" placement="top">
                <el-button circle text type="danger" aria-label="移除此设备" @click="removeCreateOrderItem(index)">
                  <el-icon><Delete /></el-icon>
                </el-button>
              </el-tooltip>
            </div>
            <div class="manual-order-filter-row">
              <el-form-item label="产品名称" required>
                <el-select
                  v-model="item.product_name"
                  filterable
                  allow-create
                  default-first-option
                  clearable
                  placeholder="选择或输入其他产品"
                  @change="onCreateOrderProductNameChange(item)"
                >
                  <el-option v-for="product in REPAIR_PRODUCT_OPTIONS" :key="product.name" :label="product.name" :value="product.name"></el-option>
                </el-select>
              </el-form-item>
              <el-form-item label="产品型号" required>
                <el-select
                  v-model="item.product_model"
                  filterable
                  allow-create
                  default-first-option
                  clearable
                  :disabled="!item.product_name"
                  placeholder="选择或输入其他型号"
                >
                  <el-option v-for="model in getRepairProductModels(item.product_name)" :key="model" :label="model" :value="model"></el-option>
                </el-select>
              </el-form-item>
              <el-form-item label="设备分类">
                <el-input v-model="item.product_category" maxlength="80" placeholder="如：牙科手机"></el-input>
              </el-form-item>
              <el-form-item label="设备 SN" required>
                <el-input v-model="item.sn" maxlength="80" placeholder="机身序列号" @blur="lookupCreateOrderItemBySn(item)">
                  <template #append>
                    <el-button :loading="item.lookupLoading" aria-label="识别设备 SN" @click="lookupCreateOrderItemBySn(item)">
                      <el-icon><Search /></el-icon>
                    </el-button>
                  </template>
                </el-input>
              </el-form-item>
            </div>
            <div class="manual-order-grid manual-order-grid--device-detail">
              <el-form-item label="购买日期">
                <el-date-picker v-model="item.buy_date" type="date" value-format="YYYY-MM-DD" placeholder="选择日期"></el-date-picker>
              </el-form-item>
              <el-form-item label="质保月数">
                <el-input-number v-model="item.warranty_months" :min="0" :max="120" controls-position="right"></el-input-number>
              </el-form-item>
              <el-form-item label="质保到期日">
                <el-date-picker v-model="item.warranty_expire" type="date" value-format="YYYY-MM-DD" placeholder="选择日期"></el-date-picker>
              </el-form-item>
              <el-form-item label="故障描述" required class="manual-order-span-2">
                <el-input v-model="item.fault_desc" type="textarea" :rows="3" maxlength="2000" show-word-limit placeholder="客户反馈的故障现象、发生条件和已尝试操作"></el-input>
              </el-form-item>
            </div>
          </div>
        </div>
      </section>

      <section class="manual-order-section manual-order-section--last">
        <div class="manual-order-section-head">
          <span class="manual-order-step">3</span>
          <div><strong>内部备注</strong><small>仅后台工作人员可见</small></div>
        </div>
        <el-input v-model="createOrderForm.admin_remark" type="textarea" :rows="2" maxlength="1000" show-word-limit placeholder="如：客户通过电话报修、紧急程度、沟通约定等"></el-input>
      </section>
    </el-form>
    <template #footer>
      <el-button @click="createOrderDialogVisible = false">取消</el-button>
      <el-button type="primary" :loading="createOrderSubmitting" @click="submitCreateOrder">
        <el-icon><CirclePlus /></el-icon> 创建工单
      </el-button>
    </template>
  </el-dialog>

</template>

<script setup>
import { ref, reactive, computed, onBeforeUnmount, onMounted, watch } from 'vue'
import { useRoute } from 'vue-router'
import { ElMessage, ElMessageBox } from 'element-plus'
import { assignEngineer, batchDeleteOrders, batchImportLogistics, batchUpdateShipping, createAdminOrder, getOrderList, getWorkflowConfig, issueInvoice, refundOrderPayment, rejectPaymentProof, saveOrderItems, syncRefundStatus, updateInvoiceStatus, updateOrderQuote, updateOrderStatus, updatePaymentStatus, updateRemarks } from '../api/order.js'
import { getPartList, recoverOrderInventory } from '../api/inventory.js'
import { lookupDeviceBySn as lookupDeviceBySnApi, logSnAction } from '../api/customer.js'
import { getSettings, getStaffList, getTempFileURL } from '../api/admin.js'
import { customerTypeLabel, customerTypeMeta, customerTypeOptionsWithCurrent, resolveCustomerTypeValue } from '../config/customerTypes.js'
import { getRepairProductModels, REPAIR_PRODUCT_OPTIONS } from '../config/repairProducts.js'
import { exportOrdersToWorkbook, formatOrderAttachments, formatOrderItems } from '../utils/orderExport.js'
import { transformOrders } from '../utils/orderTransform.js'
import { toEnglishStatus } from '../utils/orderStatus.js'
import { openPrintWindow, parsePrintTemplates, pickPrintTemplate } from '../utils/orderPrint.js'
import { downloadShippingTemplate, getLogisticsImportTypeLabel, parseShippingExcelFile } from '../utils/shippingImport.js'

const route = useRoute()
const isMobile = ref(window.innerWidth <= 768)
const updateIsMobile = () => {
  isMobile.value = window.innerWidth <= 768
}
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
  const status = resolvePaymentStatus(order)
  const statusMap = {
    pending: '待付款',
    uploaded: '待财务审核',
    rejected: '凭证已驳回',
    paid: '已到账',
    not_required: '质保免付款'
  }
  if (status === 'not_required') return statusMap.not_required
  if (!Number(order.totalPrice || 0)) return '待报价'
  return statusMap[status] || '待付款'
}

const getPaymentStatusType = (order = {}) => {
  const status = resolvePaymentStatus(order)
  if (status === 'not_required') return 'success'
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
  if (order.status === '已回寄' || order.returnNo) return { label: '待结案', desc: '确认完成归档', type: 'success' }
  if (['已提交', '运输中'].includes(order.status)) return { label: '待签收', desc: '确认寄入设备', type: 'warning' }
  const quoteStatus = order.quoteStatus || order.quote_status || ''
  const paymentStatus = resolvePaymentStatus(order)
  if (quoteStatus === 'rejected') {
    return { label: '拒修待回寄', desc: '无需付款，可直接安排设备回寄', type: 'warning' }
  }
  if (order.status === '已签收' && ['pending', 'draft', ''].includes(quoteStatus)) {
    return { label: '待报价', desc: '检测并发布报价', type: 'primary' }
  }
  if (['pending', 'draft'].includes(quoteStatus)) {
    return { label: '待报价', desc: '补齐维修报价', type: 'primary' }
  }
  if (order.chargeType === 'free' && ['issued', 'confirmed'].includes(quoteStatus)) {
    return order.authorizationStatus === 'confirmed'
      ? { label: '质保维修', desc: '客户已确认，无需付款', type: 'success' }
      : { label: '待确认', desc: '等待客户确认质保维修', type: 'success' }
  }
  if (!order.returnNo && ['issued', 'confirmed'].includes(quoteStatus)) {
    if (paymentStatus === 'paid') return { label: '待回寄', desc: '继续维修并录入回寄物流', type: 'warning' }
    if (paymentStatus === 'uploaded') return { label: '维修待处理', desc: '可先维修，付款凭证待审核', type: 'primary' }
    return { label: '维修待处理', desc: '可先维修或回寄，付款继续跟进', type: 'primary' }
  }
  if (paymentStatus === 'uploaded') return { label: '待审核', desc: '核对对公流水', type: 'warning' }
  if (paymentStatus === 'rejected') return { label: '已驳回', desc: '等待客户重传凭证', type: 'danger' }
  if (paymentStatus !== 'paid') return { label: '待付款', desc: '等待客户付款', type: 'info' }
  if (!order.returnNo) return { label: '待回寄', desc: '录入回寄物流', type: 'warning' }
  if (order.status === '已回寄') return { label: '待结案', desc: '确认完成归档', type: 'success' }
  return { label: '维修中', desc: '维修/质检处理', type: 'primary' }
}

const drawerWorkflowStages = [
  { key: 'intake', label: '受理' },
  { key: 'diagnosis', label: '检测' },
  { key: 'quote', label: '报价' },
  { key: 'repair', label: '维修' },
  { key: 'return', label: '回寄' }
]

const getDrawerStageIndex = (order = {}) => {
  if (order.status === '已完成' || order.returnNo || order.status === '已回寄') return 4
  if (['处理中', '维修中'].includes(order.status)) return 3
  const quoteStatus = order.quoteStatus || order.quote_status || ''
  if (['issued', 'confirmed', 'rejected'].includes(quoteStatus) || Number(order.totalPrice || 0) > 0) return 2
  if (['已签收', '处理中', '维修中'].includes(order.status)) return 1
  return 0
}

const getRecommendedDrawerTab = (order = {}) => {
  const quoteStatus = order.quoteStatus || order.quote_status || ''
  const paymentStatus = resolvePaymentStatus(order)
  const invoiceState = normalizeInvoiceStatus(order)
  if (['pending', 'draft', ''].includes(quoteStatus) && !['已提交', '运输中'].includes(order.status)) return 'quote'
  if (order.status === '已回寄' || order.returnNo) return 'service'
  if (['issued', 'confirmed', 'rejected'].includes(quoteStatus) && ['已签收', '处理中', '维修中'].includes(order.status)) return 'service'
  if (order.needInvoice && paymentStatus === 'paid' && !['已发票', '已寄出', '已签收'].includes(invoiceState)) return 'invoice'
  if (paymentStatus === 'paid' || paymentStatus === 'not_required') return 'service'
  return 'base'
}

const getNextStepButtonText = (order = {}) => {
  const labels = {
    quote: '去报价',
    payment: resolvePaymentStatus(order) === 'uploaded' ? '审核付款' : '查看收款',
    invoice: '去开票',
    service: order.returnNo ? '查看回寄' : ((order.quoteStatus || order.quote_status) === 'rejected' ? '安排回寄' : '继续维修')
  }
  return labels[getRecommendedDrawerTab(order)] || '查看详情'
}

const focusNextDrawerStep = () => {
  activeDrawerTab.value = getRecommendedDrawerTab(currentOrder.value || {})
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
const batchDeleting = ref(false)
const todoTypeMap = {
  inbound: '待签收',
  quote: '待报价',
  payment: '待审核转账凭证',
  invoice: '待开票',
  return: '待回寄',
  exception: '异常工单'
}

const createManualOrderItem = () => ({
  key: `${Date.now()}-${Math.random().toString(16).slice(2)}`,
  product_name: '',
  product_category: '',
  product_model: '',
  sn: '',
  buy_date: '',
  warranty_months: 0,
  warranty_expire: '',
  fault_desc: '',
  lookupLoading: false
})

const todayDateString = () => new Date().toISOString().slice(0, 10)

const createOrderDialogVisible = ref(false)
const createOrderSubmitting = ref(false)
const createOrderFormRef = ref(null)
const createOrderForm = reactive({
  received_date: todayDateString(),
  customer: {
    customer_id: '',
    customer_type: 'clinic',
    name: '',
    contact: '',
    phone: '',
    address: '',
    biz_user: ''
  },
  status: 'received',
  ship_out_info: {
    name: '',
    phone: '',
    unit: '',
    detail: '',
    logistics_company: '',
    logistics_no: '',
    received_at: ''
  },
  ship_back_info: {
    name: '',
    phone: '',
    unit: '',
    detail: ''
  },
  items: [createManualOrderItem()],
  admin_remark: ''
})

const resetCreateOrderForm = () => {
  createOrderForm.received_date = todayDateString()
  Object.assign(createOrderForm.customer, {
    customer_id: '',
    customer_type: 'clinic',
    name: '',
    contact: '',
    phone: '',
    address: '',
    biz_user: ''
  })
  createOrderForm.status = 'received'
  Object.assign(createOrderForm.ship_out_info, {
    name: '',
    phone: '',
    unit: '',
    detail: '',
    logistics_company: '',
    logistics_no: '',
    received_at: ''
  })
  Object.assign(createOrderForm.ship_back_info, {
    name: '',
    phone: '',
    unit: '',
    detail: ''
  })
  createOrderForm.items = [createManualOrderItem()]
  createOrderForm.admin_remark = ''
  createOrderFormRef.value?.clearValidate()
}

const openCreateOrderDialog = () => {
  resetCreateOrderForm()
  createOrderDialogVisible.value = true
}

const addCreateOrderItem = () => {
  createOrderForm.items.push(createManualOrderItem())
}

const onCreateOrderProductNameChange = (item) => {
  const models = getRepairProductModels(item && item.product_name)
  item.product_model = models.length === 1 ? models[0] : ''
}

const removeCreateOrderItem = (index) => {
  if (createOrderForm.items.length <= 1) return
  createOrderForm.items.splice(index, 1)
}

const fillCreateOrderShipping = () => {
  const { name, contact, phone, address } = createOrderForm.customer
  Object.assign(createOrderForm.ship_out_info, {
    name: contact || createOrderForm.ship_out_info.name,
    phone: phone || createOrderForm.ship_out_info.phone,
    unit: name || createOrderForm.ship_out_info.unit,
    detail: address || createOrderForm.ship_out_info.detail
  })
  Object.assign(createOrderForm.ship_back_info, {
    name: contact || createOrderForm.ship_back_info.name,
    phone: phone || createOrderForm.ship_back_info.phone,
    unit: name || createOrderForm.ship_back_info.unit,
    detail: address || createOrderForm.ship_back_info.detail
  })
}

const syncCreateOrderShipping = () => {
  const { name, contact, phone, address } = createOrderForm.customer
  Object.assign(createOrderForm.ship_out_info, {
    name: contact,
    phone,
    unit: name,
    detail: address,
    received_at: createOrderForm.received_date
  })
  Object.assign(createOrderForm.ship_back_info, {
    name: contact,
    phone,
    unit: name,
    detail: address
  })
}

const lookupCreateOrderItemBySn = async (item) => {
  const sn = String(item && item.sn || '').trim()
  if (!sn || item.lookupLoading) return
  item.lookupLoading = true
  try {
    const result = await lookupDeviceBySnApi(sn)
    await logSnAction('sn_query', sn, {
      matched: Boolean(result && result.found),
      device_id: result && result.deviceId,
      warranty_status: result && result.warrantyStatus
    })
    if (!result || !result.found) return
    item.product_name = result.productName || item.product_name
    item.product_category = result.productCategory || item.product_category
    item.product_model = result.model || item.product_model
    item.buy_date = result.buyDate || item.buy_date
    item.warranty_months = Number(result.warrantyMonths || item.warranty_months || 0) || 0
    item.warranty_expire = result.warrantyExpire || item.warranty_expire
    if (result.customerId && !createOrderForm.customer.customer_id) {
      createOrderForm.customer.customer_id = result.customerId
      createOrderForm.customer.name = result.customerName || createOrderForm.customer.name
      createOrderForm.customer.customer_type = result.customerType || createOrderForm.customer.customer_type
    }
    ElMessage.success('已从设备档案回填 SN 信息')
  } catch (error) {
    if (!error.__displayed) ElMessage.warning(error.message || 'SN 识别失败')
  } finally {
    item.lookupLoading = false
  }
}

const validateCreateOrderForm = () => {
  syncCreateOrderShipping()
  const customer = createOrderForm.customer
  const customerType = resolveCustomerTypeValue(customer.customer_type)
  if (!customerType) return '请选择或输入客户类型'
  if (customerType.length > 40) return '客户类型不能超过 40 个字符'
  customer.customer_type = customerType
  if (!customer.name.trim()) return '请填写客户/单位名称'
  if (!customer.contact.trim()) return '请填写联系人'
  if (!/^1\d{10}$/.test(customer.phone.trim())) return '请填写正确的 11 位手机号'
  if (!customer.address.trim()) return '请填写客户地址'
  if (!createOrderForm.received_date) return '请选择收件日期'
  if (!createOrderForm.items.length) return '请至少添加一台维修设备'
  for (let index = 0; index < createOrderForm.items.length; index += 1) {
    const item = createOrderForm.items[index]
    const prefix = `设备 ${index + 1}`
    if (!item.product_name.trim()) return `${prefix}：请填写产品名称`
    if (item.product_name.trim().length > 80) return `${prefix}：产品名称不能超过 80 个字符`
    if (!item.product_model.trim()) return `${prefix}：请填写产品型号`
    if (item.product_model.trim().length > 80) return `${prefix}：产品型号不能超过 80 个字符`
    if (!item.sn.trim()) return `${prefix}：请填写设备 SN`
    if (!item.fault_desc.trim()) return `${prefix}：请填写故障描述`
  }
  const out = createOrderForm.ship_out_info
  const back = createOrderForm.ship_back_info
  if (!out.name.trim() || !/^1\d{10}$/.test(out.phone.trim()) || !out.detail.trim()) return '请完善客户名称、联系方式和客户地址'
  if (!back.name.trim() || !/^1\d{10}$/.test(back.phone.trim()) || !back.detail.trim()) return '请完善客户名称、联系方式和客户地址'
  if (createOrderForm.status === 'sent' && !out.logistics_no.trim()) return '运输中工单必须填写寄入物流单号'
  return ''
}

const submitCreateOrder = async () => {
  const validationError = validateCreateOrderForm()
  if (validationError) {
    ElMessage.warning(validationError)
    return
  }

  createOrderSubmitting.value = true
  try {
    const token = localStorage.getItem('adminToken')
    const payload = {
      customer: { ...createOrderForm.customer },
      status: createOrderForm.status,
      ship_out_info: { ...createOrderForm.ship_out_info },
      ship_back_info: { ...createOrderForm.ship_back_info },
      items: createOrderForm.items.map(({ key, lookupLoading, ...item }) => ({ ...item })),
      admin_remark: createOrderForm.admin_remark
    }
    const result = await createAdminOrder(token, payload)
    createOrderDialogVisible.value = false
    wo.page = 1
    await loadOrders()
    ElMessage.success(`工单 ${result.order_no || ''} 创建成功`)
  } catch (error) {
    if (!error.__displayed) ElMessage.error(error.message || '新建工单失败')
  } finally {
    createOrderSubmitting.value = false
  }
}

const exportableFields = [
  { label: '工单编号', key: 'id', getter: order => order.id },
  { label: '单位名称', key: 'clinicName', getter: order => order.clinicName },
  { label: '用户类型', key: 'customerType', getter: order => customerTypeLabel(order.customerType) },
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

const tableColumnStorageKey = 'pc-admin:work-order-visible-columns'
const tableColumnStorageVersionKey = 'pc-admin:work-order-visible-columns-version'
const tableColumnStorageVersion = '2'
const tableColumnOptions = [
  { key: 'id', label: '工单号' },
  { key: 'reporter', label: '报修方信息' },
  { key: 'receivedDate', label: '收件日期' },
  { key: 'bizUser', label: '对接业务员' },
  { key: 'customerType', label: '客户类型' },
  { key: 'clinicName', label: '客户/单位名称' },
  { key: 'contactName', label: '联系人' },
  { key: 'phone', label: '手机号' },
  { key: 'customerAddress', label: '客户地址' },
  { key: 'logisticsCompany', label: '寄入快递公司' },
  { key: 'logisticsNo', label: '寄入快递单号' },
  { key: 'productName', label: '产品名称' },
  { key: 'productCategory', label: '设备分类' },
  { key: 'productModel', label: '型号' },
  { key: 'productCode', label: '编码/SN' },
  { key: 'buyDate', label: '购买日期' },
  { key: 'warrantyMonths', label: '质保月数' },
  { key: 'warrantyExpire', label: '质保到期日' },
  { key: 'fault', label: '故障' },
  { key: 'logistics', label: '物流信息' },
  { key: 'adminRemark', label: '内部备注' },
  { key: 'printRemark', label: '随件留言' },
  { key: 'nextAction', label: '下一步动作' },
  { key: 'status', label: '处理状态' },
  { key: 'invoice', label: '发票状态' },
  { key: 'sla', label: 'SLA' }
]
const defaultTableColumnKeys = ['id', 'reporter', 'productName', 'productModel', 'productCode', 'fault', 'logistics', 'nextAction', 'status', 'invoice', 'sla']
const availableTableColumnKeys = new Set(tableColumnOptions.map(column => column.key))

const readTableColumnKeys = () => {
  try {
    const raw = localStorage.getItem(tableColumnStorageKey)
    if (!raw) {
      localStorage.setItem(tableColumnStorageVersionKey, tableColumnStorageVersion)
      return [...defaultTableColumnKeys]
    }
    const parsed = JSON.parse(raw)
    if (!Array.isArray(parsed)) return [...defaultTableColumnKeys]
    const visibleKeys = parsed.filter(key => availableTableColumnKeys.has(key))
    if (localStorage.getItem(tableColumnStorageVersionKey) !== tableColumnStorageVersion) {
      if (!visibleKeys.includes('id')) visibleKeys.unshift('id')
      localStorage.setItem(tableColumnStorageVersionKey, tableColumnStorageVersion)
    }
    return visibleKeys
  } catch (error) {
    return [...defaultTableColumnKeys]
  }
}

const orders = ref([])
const totalOrders = ref(0)
const deviceModelOptions = ref([])
const selectedOrders = ref([])
const batchDeleteDialogVisible = ref(false)
const batchDeleteForm = reactive({
  reason: '',
  confirmText: ''
})
const workflowConfig = ref(null)
const printConfig = ref(parsePrintTemplates().repair_order)
const printSettingsRaw = ref({})
const exportDialogVisible = ref(false)
const selectedExportFields = ref(exportableFields.map(field => field.key))
const checkAll = ref(true)
const isIndeterminate = ref(false)
const visibleTableColumnKeys = ref(readTableColumnKeys())
const importDialogVisible = ref(false)
const importResultVisible = ref(false)
const importResult = ref(null)
const activeLogisticsImportType = ref('return')
const shipDate = ref(new Date().toISOString().slice(0, 10))
const searchInvoiceStatus = ref('')
const slaFilter = ref('')
const activeTodoType = ref('')
const activeTodoLabel = computed(() => todoTypeMap[activeTodoType.value] || '待办筛选')
const expectedBatchDeleteConfirmText = computed(() => `确认删除${selectedOrders.value.length}个工单`)
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
    if (currentStatus === 'received' && targetStatus === 'shipped') {
      const isRejectReturn = order.quoteStatus === 'rejected'
        || order.needsReturn === true
        || order.archiveStatus === 'pending_return'
      if (!isRejectReturn) return false
    }
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
      customerType: resolveCustomerTypeValue(wo.customerTypeFilter),
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
      customerType: resolveCustomerTypeValue(wo.customerTypeFilter),
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

const wo = reactive({ search: '', filter: '', deviceFilter: '', warrantyFilter: '', customerTypeFilter: '', page: 1, pageSize: 10 })

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
  const routeSla = String(route.query.sla || '')
  slaFilter.value = ['overdue', 'critical', 'warning'].includes(routeSla) ? routeSla : ''
  wo.filter = String(route.query.filter || '')
  wo.search = String(route.query.keyword || route.query.search || wo.search || '')
}

const clearTodoFilter = () => {
  activeTodoType.value = ''
}

onMounted(async () => {
  updateIsMobile()
  window.addEventListener('resize', updateIsMobile)
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

onBeforeUnmount(() => {
  window.removeEventListener('resize', updateIsMobile)
})

const reloadFromFilter = () => {
  if (wo.page === 1) {
    loadOrders()
  } else {
    wo.page = 1
  }
}

// 下拉筛选变化立即生效
watch(
  () => [wo.filter, wo.deviceFilter, wo.warrantyFilter, wo.customerTypeFilter, searchInvoiceStatus.value, activeTodoType.value, slaFilter.value],
  reloadFromFilter
)

// 关键词是逐字输入的自由文本，加防抖，避免每敲一个字就打一次接口
let searchDebounceTimer = null
watch(
  () => wo.search,
  () => {
    if (searchDebounceTimer) clearTimeout(searchDebounceTimer)
    searchDebounceTimer = setTimeout(reloadFromFilter, 350)
  }
)

watch(
  () => [route.query.filter, route.query.todo, route.query.sla, route.query.keyword, route.query.search],
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

watch(
  visibleTableColumnKeys,
  (keys) => {
    localStorage.setItem(tableColumnStorageKey, JSON.stringify(keys))
  },
  { deep: true }
)

const drawerVisible = ref(false)
const currentOrder = ref(null)
const activeDrawerTab = ref('base')
const invoiceEditorExpanded = ref(false)
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
const refundSyncing = ref(false)
const inventoryRecovering = ref(false)
const partPickerVisible = ref(false)
const partPickerLoading = ref(false)
const partPickerKeyword = ref('')
const pickerParts = ref([])
const logisticsCompanyOptions = [
  '顺丰速运',
  '京东物流',
  '中国邮政EMS',
  '德邦快递',
  '中通快递',
  '圆通速递',
  '申通快递',
  '韵达快递',
  '极兔速递',
  '百世快递',
  '跨越速运',
  '安能物流'
]
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

const coverageResultOptions = [
  { value: 'pending', label: '待人工核验' },
  { value: 'free', label: '质保免费' },
  { value: 'paid', label: '收费维修' },
  { value: 'partial', label: '部分收费' },
  { value: 'not_covered', label: '在保但不保' }
]

const coverageReasonOptions = [
  { value: 'quality_issue', label: '非人为质量问题' },
  { value: 'expired', label: '已过质保期' },
  { value: 'human_damage', label: '人为损坏' },
  { value: 'consumable', label: '耗材/易损件' },
  { value: 'water_damage', label: '进水/污染' },
  { value: 'drop_damage', label: '摔落/撞击' },
  { value: 'missing_proof', label: '凭证不足' },
  { value: 'other', label: '其他原因' }
]

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
const isCurrentOrderWarrantyFree = computed(() => {
  const order = currentOrder.value || {}
  return order.chargeType === 'free'
    && Boolean(order.inWarranty)
    && ['in_warranty', 'extended'].includes(order.warrantyStatus)
})
const currentOrderProductKeywords = computed(() => {
  const order = currentOrder.value || {}
  const items = Array.isArray(order.itemsList) ? order.itemsList : []
  return [
    order.productModel,
    order.productCode,
    order.itemsSummary,
    ...items.flatMap(item => [
      item.product_name,
      item.product_model,
      item.product_code,
      item.productCode,
      item.code,
      item.sn,
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
  const simpleServices = (!parts.length && !services.length && !others.length && finalPrice > 0)
    ? [{
      name: '维修费用',
      unit_price: finalPrice,
      quantity: 1,
      amount: finalPrice,
      remark: remark || '简易报价',
      service_id: '',
      product_category: ''
    }]
    : services
  const items = [
    ...parts.map(item => ({
      name: item.name,
      desc: item.remark || [item.part_code, item.model].filter(Boolean).join(' / '),
      partsFee: item.amount,
      laborFee: 0
    })),
    ...simpleServices.map(item => ({
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
      services: simpleServices,
      others,
      parts_total: parts.reduce((sum, item) => sum + (Number(item.amount) || 0), 0),
      services_total: simpleServices.reduce((sum, item) => sum + (Number(item.amount) || 0), 0),
      others_total: others.reduce((sum, item) => sum + (Number(item.amount) || 0), 0),
      auto_total: autoTotal || finalPrice,
      final_price: finalPrice,
      remark
    },
    parts,
    services: simpleServices,
    others,
    items
  }
}

const handleSelectionChange = (selection) => {
  selectedOrders.value = selection
}

const isTableColumnVisible = (key) => visibleTableColumnKeys.value.includes(key)

const resetTableColumns = () => {
  visibleTableColumnKeys.value = [...defaultTableColumnKeys]
}

const getItemProductCode = (item = {}) => {
  const code = item.product_code || item.productCode || item.code || ''
  const sn = item.sn || ''
  if (code && sn && code !== sn) return `${code} / ${sn}`
  return code || sn || '-'
}

const getOrderProductCode = (order = {}) => {
  const firstItem = Array.isArray(order.itemsList) ? order.itemsList[0] : null
  return order.productCode || getItemProductCode(firstItem || {})
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
  activeDrawerTab.value = getRecommendedDrawerTab(row)
  invoiceEditorExpanded.value = Boolean(row.needInvoice || normalizeInvoiceStatus(row) !== '无需开票')
  assignEngineerId.value = row.engineerId || ''
  // 重置 SN 回填态
  Object.keys(snLookupResults).forEach((k) => delete snLookupResults[k])
  Object.keys(snLookupLoading).forEach((k) => delete snLookupLoading[k])
  Object.keys(snLookupTimers).forEach((k) => { clearTimeout(snLookupTimers[k]); delete snLookupTimers[k] })
  const allowedStatuses = getAllowedStatusOptions(row)
  newStatus.value = (row.quoteStatus === 'rejected' && allowedStatuses.includes('已回寄'))
    ? '已回寄'
    : (allowedStatuses[0] || row.status)
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
// 在保状态 → 标签元数据；未知状态必须显式提示，避免被误认为收费或免费。
const warrantyTagMeta = (status) => {
  if (status === 'in_warranty') return { type: 'success', label: '在保' }
  if (status === 'extended') return { type: 'success', label: '延保中' }
  if (status === 'expired') return { type: 'danger', label: '已过保' }
  return { type: 'warning', label: '质保待补充' }
}

const addWarrantyMonths = (dateStr, months) => {
  const amount = Number(months)
  if (!dateStr || !Number.isFinite(amount) || amount <= 0) return ''
  const date = new Date(`${dateStr}T00:00:00`)
  if (Number.isNaN(date.getTime())) return ''
  date.setMonth(date.getMonth() + amount)
  const pad = (value) => String(value).padStart(2, '0')
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`
}

const itemWarrantyPreview = (item = {}) => {
  const expire = item.warranty_expire || addWarrantyMonths(item.buy_date, item.warranty_months)
  if (!expire) {
    const missingDate = Number(item.warranty_months) > 0 && !item.buy_date
    return { status: 'unknown', detail: missingDate ? '请补采购日期，或直接填写质保截止日期。' : '质保信息待补充，本单暂不自动判定收费。' }
  }
  const active = Date.now() <= new Date(`${expire}T23:59:59`).getTime()
  return { status: active ? 'in_warranty' : 'expired', detail: `判定依据：质保截止 ${expire}` }
}

// 取某工单项当前在保状态：优先 SN 查询结果，回退工单级快照
const snItemWarranty = (itemIndex) => {
  const item = currentOrder.value && currentOrder.value.itemsList && currentOrder.value.itemsList[itemIndex]
  const local = itemWarrantyPreview(item || {})
  if (local.status !== 'unknown') return local.status
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
      if (Number(info.warrantyMonths) > 0 && !Number(item.warranty_months)) item.warranty_months = Number(info.warrantyMonths)
      if (info.warrantyExpire && !String(item.warranty_expire || '').trim()) item.warranty_expire = info.warrantyExpire
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
      buy_date: it.buy_date || '',
      warranty_months: Number(it.warranty_months) > 0 ? Number(it.warranty_months) : 0,
      warranty_expire: it.warranty_expire || '',
      coverage_result: it.coverage_result || '',
      coverage_reason: it.coverage_reason || '',
      coverage_note: it.coverage_note || ''
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
  if (order.chargeType === 'free' && (order.inWarranty || status === 'in_warranty' || status === 'extended')) {
    return { show: true, type: 'success', text: '所有设备已核验为质保免费，可发布零元质保方案' }
  }
  if (order.inWarranty || status === 'in_warranty' || status === 'extended') {
    return { show: true, type: 'warning', text: '设备仍在质保期内，但需逐台选择本次质保结论后才能决定是否免费' }
  }
  if (status === 'expired') {
    return { show: true, type: 'error', text: '该设备已超出质保期，维修收取全额工时、上门及配件费用' }
  }
  return { show: true, type: 'warning', text: '质保信息待补充：请填写质保月数或截止日期后再确认收费方式' }
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

const resetBatchDeleteForm = () => {
  batchDeleteForm.reason = ''
  batchDeleteForm.confirmText = ''
}

const openBatchDeleteDialog = () => {
  if (!selectedOrders.value.length) {
    ElMessage.warning('请先勾选要删除的工单')
    return
  }
  if (!canPerformOrderAction('delete_order')) {
    ElMessage.error('当前角色无权删除工单')
    return
  }
  resetBatchDeleteForm()
  batchDeleteDialogVisible.value = true
}

const buildBatchDeleteRows = (ordersForDelete = []) => ordersForDelete.map(order => ({
  order_id: order._id,
  order_no: order.id || order.order_no
}))

const formatBatchDeleteFailures = (failures = []) => failures
  .slice(0, 8)
  .map(item => `${item.order_no || item.order_id || '-'}：${item.reason || '未删除'}`)
  .join('\n')

const submitBatchDeleteOrders = async () => {
  const ordersForDelete = [...selectedOrders.value]
  if (!ordersForDelete.length) {
    ElMessage.warning('请先勾选要删除的工单')
    return
  }
  if (!canPerformOrderAction('delete_order')) {
    ElMessage.error('当前角色无权删除工单')
    return
  }
  const reason = batchDeleteForm.reason.trim()
  const expected = `确认删除${ordersForDelete.length}个工单`
  if (reason.length < 2) {
    ElMessage.warning('删除原因至少填写2个字')
    return
  }
  if (batchDeleteForm.confirmText.trim() !== expected) {
    ElMessage.warning(`请输入“${expected}”确认批量删除`)
    return
  }

  batchDeleting.value = true
  try {
    const token = localStorage.getItem('adminToken')
    const result = await batchDeleteOrders(token, buildBatchDeleteRows(ordersForDelete), reason, expected)
    const deletedCount = Number(result.deleted_count || result.deletedCount || 0)
    const failedCount = Number(result.failed_count || result.failedCount || 0)
    const failures = Array.isArray(result.failures) ? result.failures : []
    const deleted = Array.isArray(result.deleted) ? result.deleted : []

    if (deletedCount) {
      ElMessage.success(`已删除 ${deletedCount} 个工单${failedCount ? `，${failedCount} 个未删除` : ''}`)
    } else {
      ElMessage.warning('没有工单被删除')
    }
    if (failures.length) {
      const extra = failures.length > 8 ? `\n其余 ${failures.length - 8} 个失败原因请刷新后逐单查看。` : ''
      await ElMessageBox.alert(formatBatchDeleteFailures(failures) + extra, '未删除工单', {
        confirmButtonText: '知道了',
        type: deletedCount ? 'warning' : 'error'
      })
    }

    if (deleted.some(item => currentOrder.value && item.order_id === currentOrder.value._id)) {
      drawerVisible.value = false
      currentOrder.value = null
    }
    selectedOrders.value = []
    batchDeleteDialogVisible.value = false
    await loadOrders()
  } catch (error) {
    if (!isUserCancel(error)) {
      ElMessage.error(error.message || '批量删除失败')
    }
  } finally {
    batchDeleting.value = false
  }
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

  if (total <= 0 && !isCurrentOrderWarrantyFree.value) {
    ElMessage.warning('发布零元质保方案前，请先在设备明细中将每台设备标记为“质保免费”并保存')
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
        isCurrentOrderWarrantyFree.value
          ? `确定发布零元质保方案给客户确认吗？${inventoryText}`
          : `确定发布报价 ${formatMoney(total)} 给客户确认吗？${inventoryText}`,
        isCurrentOrderWarrantyFree.value ? '发布质保方案确认' : '发布报价确认',
        {
          confirmButtonText: isCurrentOrderWarrantyFree.value ? '发布质保方案' : '发布报价',
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

const syncCurrentRefundStatus = async () => {
  if (!currentOrder.value || currentOrder.value.refundStatus !== 'processing') return
  refundSyncing.value = true
  try {
    const token = localStorage.getItem('adminToken')
    const orderId = currentOrder.value._id
    const result = await syncRefundStatus(token, orderId)
    ElMessage.success((result && result.msg) || '退款状态已刷新')
    await loadOrders()
    const fresh = orders.value.find(item => item._id === orderId)
    if (fresh) currentOrder.value = fresh
  } catch (error) {
    ElMessage.error(error.message || '刷新退款状态失败')
  } finally {
    refundSyncing.value = false
  }
}

const handleRecoverInventory = async () => {
  if (!currentOrder.value || !canPerformOrderAction('manage_inventory')) return
  inventoryRecovering.value = true
  const orderId = currentOrder.value._id
  try {
    const token = localStorage.getItem('adminToken')
    const action = currentOrder.value.inventoryStatus === 'outbound_failed' ? 'retry' : 'inspect'
    const result = await recoverOrderInventory(token, orderId, action)
    ElMessage.success((result && result.message) || '库存出库状态已恢复')
  } catch (error) {
    if (currentOrder.value.inventoryStatus === 'outbound_processing' && /未发现出库流水/.test(error.message || '')) {
      try {
        await ElMessageBox.confirm(
          '未发现该工单的出库流水。请先确认库存没有实际扣减，再重置并重试。',
          '确认库存未扣减',
          { confirmButtonText: '确认重置并重试', cancelButtonText: '取消', type: 'warning' }
        )
        const token = localStorage.getItem('adminToken')
        await recoverOrderInventory(token, orderId, 'reset', true)
        await recoverOrderInventory(token, orderId, 'retry')
        ElMessage.success('库存出库已重试')
      } catch (resetError) {
        if (!isUserCancel(resetError)) ElMessage.error(resetError.message || '库存恢复失败')
      }
    } else {
      ElMessage.error(error.message || '库存恢复失败')
    }
  } finally {
    await loadOrders()
    const fresh = orders.value.find(item => item._id === orderId)
    if (fresh) currentOrder.value = fresh
    inventoryRecovering.value = false
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
    const templates = parsePrintTemplates(data && data.print_templates, data && data.print_config)
    await Promise.all(Object.values(templates).map(template => resolvePrintLogo(template)))
    printSettingsRaw.value = { ...(data || {}), print_templates: templates }
    printConfig.value = templates.repair_order
    feeTiers.value = parseSettingsArray(data && data.fee_tier_templates)
  } catch (error) {
    const templates = parsePrintTemplates()
    printSettingsRaw.value = { print_templates: templates }
    printConfig.value = templates.repair_order
  }
}

// 按单据类型打印当前工单（维修报价单 / 竣工结算单 / 配件出库单）
const hasQuoteData = computed(() => {
  const o = currentOrder.value
  if (!o) return false
  const d = o.quoteDetail || {}
  return ['issued', 'confirmed', 'rejected'].includes(o.quoteStatus)
    || Number(o.totalPrice || 0) > 0
    || (d.parts || []).length > 0
    || (d.services || []).length > 0
    || (d.others || []).length > 0
})
const hasPartsData = computed(() => {
  const o = currentOrder.value
  return !!(o && o.quoteDetail && (o.quoteDetail.parts || []).length > 0)
})
const printDoc = (docType) => {
  if (!currentOrder.value) return
  const raw = printSettingsRaw.value || {}
  const template = pickPrintTemplate(raw.print_templates, raw.print_config, docType)
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
  if (!openPrintWindow([currentOrder.value], printConfig.value)) {
    ElMessage.error('浏览器拦截了打印窗口，请允许弹窗后重试')
  }
}

const handleConfiguredBatchPrint = () => {
  if (!selectedOrders.value.length) {
    ElMessage.warning('请先勾选要打印的工单')
    return
  }
  if (!openPrintWindow(selectedOrders.value, printConfig.value)) {
    ElMessage.error('浏览器拦截了打印窗口，请允许弹窗后重试')
  }
}

const handleBatchToolbarCommand = (command) => {
  if (command === 'print') return handleConfiguredBatchPrint()
  if (command === 'processing') return handleBatchProcessing()
  if (command === 'complete') return handleBatchComplete()
  if (command === 'delete') return openBatchDeleteDialog()
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

.page-header { display: flex; justify-content: space-between; align-items: flex-start; gap: 32px; margin-bottom: 20px; padding-bottom: 18px; border-bottom: 1px solid #edf1f7; }
.page-title { font-size: 24px; font-weight: 700; color: #1d2129; margin: 0; letter-spacing: 0; }
.page-subtitle { margin: 7px 0 0; color: #667085; font-size: 13px; line-height: 1.6; }

.workorder-toolbar { display: flex; flex-direction: column; gap: 12px; margin-bottom: 16px; padding: 14px; border: 1px solid #e5eefb; border-radius: 8px; background: #fbfdff; }
.search-strip { display: grid; grid-template-columns: minmax(240px, 1.7fr) repeat(5, minmax(130px, 1fr)) auto; align-items: center; gap: 10px; }
.search-strip-main, .search-strip :deep(.el-select) { min-width: 0; width: 100%; }
.search-strip-main :deep(.el-input__wrapper), .search-strip :deep(.el-select__wrapper) { min-height: 40px; }
.batch-strip { display: flex; align-items: center; justify-content: flex-end; gap: 8px; padding-top: 12px; border-top: 1px solid #edf1f7; }
.selection-count { margin-right: auto; color: #1769aa; font-size: 12px; font-weight: 600; }
.top-btn-text { font-weight: 600; }

.attention-strip { display: flex; align-items: center; gap: 14px; min-height: 48px; margin-bottom: 16px; padding: 7px 10px; border: 1px solid #edf1f7; border-radius: 8px; background: #fff; }
.attention-label { flex: none; color: #667085; font-size: 12px; font-weight: 700; }
.sla-board { display: grid; grid-template-columns: repeat(4, minmax(120px, 1fr)); flex: 1; gap: 8px; }
.sla-card { appearance: none; display: grid; grid-template-columns: minmax(0, 1fr) auto; grid-template-rows: auto auto; align-items: center; gap: 0 8px; height: auto; margin: 0; border: 1px solid #e5e6eb; border-radius: 6px; background: #fff; padding: 7px 10px; text-align: left; cursor: pointer; transition: border-color 0.2s, background 0.2s; }
.sla-card:hover, .sla-card.active { border-color: #8bbcf2; background: #f7fbff; }
.sla-card span { grid-row: 1 / span 2; color: #4e5969; font-size: 12px; }
.sla-card strong { color: #1d2129; font-size: 16px; line-height: 1; text-align: right; }
.sla-card small { color: #98a2b3; font-size: 10px; line-height: 1.2; text-align: right; white-space: nowrap; }
.sla-card--danger, .sla-card--critical { border-color: #ffd0cc; background: #fff7f6; }
.sla-card--danger strong, .sla-card--critical strong { color: #f56c6c; }
.sla-card--warning { border-color: #ffe0a3; background: #fffaf0; }
.sla-card--warning strong { color: #ff9800; }
.sla-card--info { border-color: #d9ecff; background: #f7fbff; }
.sla-card--info strong { color: #1890ff; }

.table-section-head { display: flex; align-items: center; justify-content: space-between; gap: 12px; margin: 0 0 10px; }
.table-section-head > div { display: flex; align-items: baseline; gap: 10px; min-width: 0; }
.table-section-head strong { color: #1d2129; font-size: 15px; }
.table-section-head span { color: #98a2b3; font-size: 12px; }
.table-selection-note { color: #1769aa !important; font-weight: 600; }
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
.delete-confirm-panel { display: flex; flex-direction: column; gap: 16px; }
.delete-confirm-summary { padding: 12px 14px; border-radius: 8px; background: #fff7f7; border: 1px solid #ffd6d6; }
.delete-confirm-summary strong { display: block; margin-bottom: 6px; color: #c45656; font-size: 14px; line-height: 1.4; }
.delete-confirm-summary span { display: block; color: #5f6b7a; font-size: 13px; line-height: 1.5; word-break: break-all; }
.delete-confirm-tip { margin: 6px 0 0; color: #8a97aa; font-size: 12px; line-height: 1.4; }
.manual-order-form { max-height: 68vh; overflow-y: auto; padding: 0 6px 4px 0; }
.manual-order-section { padding: 0 0 20px; margin: 0 0 20px; border-bottom: 1px solid #e8edf4; }
.manual-order-section--last { margin-bottom: 0; border-bottom: 0; }
.manual-order-section-head { display: flex; align-items: center; gap: 10px; min-height: 36px; margin-bottom: 14px; }
.manual-order-section-head > div { display: flex; flex-direction: column; min-width: 0; }
.manual-order-section-head > div strong { color: #17212f; font-size: 15px; line-height: 1.35; }
.manual-order-section-head > div small { color: #8a97aa; font-size: 12px; line-height: 1.4; }
.manual-order-section-head > .el-button { margin-left: auto; }
.manual-order-step { display: inline-flex; align-items: center; justify-content: center; width: 26px; height: 26px; flex: 0 0 26px; border-radius: 50%; background: #1769aa; color: #fff; font-size: 12px; font-weight: 700; }
.manual-order-grid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 0 14px; }
.manual-order-grid--customer { grid-template-columns: repeat(2, minmax(0, 1fr)); }
.manual-order-grid--intake { grid-template-columns: repeat(4, minmax(0, 1fr)); }
.manual-order-grid--device-detail { grid-template-columns: repeat(3, minmax(0, 1fr)); }
.manual-order-filter-row { display: grid; grid-template-columns: minmax(160px, 1.25fr) minmax(140px, 1fr) minmax(130px, .9fr) minmax(170px, 1.1fr); gap: 0 10px; padding: 10px 10px 0; margin-bottom: 10px; border: 1px solid #e5eefb; border-radius: 8px; background: #fff; }
.manual-order-grid :deep(.el-form-item) { min-width: 0; margin-bottom: 14px; }
.manual-order-filter-row :deep(.el-form-item) { min-width: 0; margin-bottom: 10px; }
.manual-order-grid :deep(.el-select),
.manual-order-grid :deep(.el-date-editor),
.manual-order-grid :deep(.el-input-number),
.manual-order-filter-row :deep(.el-select),
.manual-order-filter-row :deep(.el-date-editor),
.manual-order-filter-row :deep(.el-input-number) { width: 100%; }
.manual-order-span-2 { grid-column: 1 / -1; }
.manual-order-item-list { display: flex; flex-direction: column; gap: 12px; }
.manual-order-item { padding: 14px 14px 0; border: 1px solid #e5eaf1; border-radius: 8px; background: #fbfcfe; }
.manual-order-item-head { display: flex; align-items: center; justify-content: space-between; min-height: 30px; margin-bottom: 8px; }
.manual-order-item-head strong { color: #344054; font-size: 13px; }
.manual-order-status { margin-bottom: 16px; }
.manual-order-logistics-columns { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 14px; }
.manual-order-logistics-column { min-width: 0; padding: 14px 14px 0; border: 1px solid #e5eaf1; border-radius: 8px; }
.manual-order-logistics-column > strong { display: block; margin-bottom: 12px; color: #344054; font-size: 13px; }
.column-config-panel { padding: 4px 2px; }
.column-config-head { display: flex; align-items: center; justify-content: space-between; gap: 12px; margin-bottom: 10px; }
.column-config-head strong { color: #1d2129; font-size: 14px; }
.column-config-grid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 8px 14px; max-height: min(58vh, 520px); overflow-y: auto; padding-right: 4px; }
.table-responsive { width: 100%; overflow-x: auto; margin-top: 4px; }
.modern-table { min-width: 1280px; }
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
.customer-name { display: flex; align-items: center; gap: 6px; flex-wrap: wrap; }
.customer-type-tag { margin-left: 0; max-width: 180px; }
.customer-type-tag :deep(.el-tag__content) { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.customer-name { color: #4e5969; font-size: 13px; margin-bottom: 2px; }
.phone-number { color: #86909c; font-size: 12px; font-family: 'Consolas', monospace; }

.product-model { font-weight: 600; color: #1890ff; font-size: 13px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; margin-bottom: 4px; }
.device-main-cell { font-weight: 600; color: #1d2129; font-size: 13px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.device-main-cell--muted { color: #4e5969; font-weight: 500; }
.device-code-cell { font-family: 'Consolas', monospace; font-size: 12px; color: #1769aa; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.fault-desc { font-size: 12px; color: #86909c; overflow: hidden; text-overflow: ellipsis; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; line-height: 1.4; }
/* 抽屉壳层样式见下方 unscoped 块（append-to-body 后 scoped 选不中） */
.drawer-body {
  flex: 1 1 auto;
  height: 100%;
  min-height: 0;
  display: flex;
  flex-direction: column;
  gap: 8px;
  padding: 0;
  color: #4e5969;
  font-size: 14px;
  line-height: 1.45;
  overflow: hidden;
}
.drawer-sticky-head { flex: none; display: flex; flex-direction: column; gap: 6px; }
.drawer-order-head { display: flex; justify-content: space-between; align-items: flex-start; gap: 12px; margin-bottom: 0; }
.drawer-order-identity { min-width: 0; display: grid; grid-template-columns: auto minmax(0, 1fr); align-items: center; gap: 1px 8px; }
.drawer-order-kicker { grid-row: 1 / span 2; align-self: stretch; display: inline-flex; align-items: center; padding: 0 8px; border-radius: 6px; background: #102a43; color: #fff; font-size: 12px; font-weight: 600; }
.drawer-order-id { min-width: 0; color: #17212f; font-family: 'Consolas', 'Menlo', monospace; font-size: 16px; line-height: 1.3; overflow-wrap: anywhere; }
.drawer-order-customer { color: #52637a; font-size: 13px; line-height: 1.35; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.drawer-order-status { flex: none; display: flex; align-items: center; gap: 6px; }
.drawer-next-step { min-height: 0; display: flex; align-items: center; justify-content: space-between; gap: 10px; margin-bottom: 0; padding: 8px 10px; border: 1px solid #b9d8fa; border-radius: 8px; background: #eef6ff; }
.drawer-next-step.is-warning { border-color: #f5d7a5; background: #fffaf0; }
.drawer-next-step.is-success { border-color: #b7dfc9; background: #f2fbf6; }
.drawer-next-step.is-danger { border-color: #f1c0c0; background: #fff6f6; }
.drawer-next-step.is-info { border-color: #dfe3e8; background: #f7f8fa; }
.drawer-next-step-copy { min-width: 0; display: grid; grid-template-columns: auto minmax(0, 1fr); align-items: baseline; gap: 1px 8px; line-height: 1.35; }
.drawer-next-step-eyebrow { grid-row: 1 / span 2; align-self: center; color: #52637a; font-size: 13px; font-weight: 600; }
.drawer-next-step-copy strong { color: #17212f; font-size: 16px; }
.drawer-next-step-copy > span:last-child { color: #52637a; font-size: 13px; }
.drawer-next-step-button { flex: none; }
.drawer-workflow { display: grid; grid-template-columns: repeat(5, minmax(0, 1fr)); margin: 0 2px; }
.drawer-workflow-stage { position: relative; display: flex; flex-direction: column; align-items: center; gap: 3px; color: #98a2b3; font-size: 12px; line-height: 1.2; }
.drawer-workflow-stage::before { content: ''; position: absolute; top: 9px; left: -50%; width: 100%; height: 2px; background: #e5e9ef; }
.drawer-workflow-stage:first-child::before { display: none; }
.drawer-workflow-dot { position: relative; z-index: 1; width: 20px; height: 20px; display: inline-flex; align-items: center; justify-content: center; border: 2px solid #d8dee7; border-radius: 50%; background: #fff; color: #98a2b3; font-family: 'Consolas', 'Menlo', monospace; font-size: 10px; font-weight: 700; }
.drawer-workflow-stage.is-done::before, .drawer-workflow-stage.is-current::before { background: #75b798; }
.drawer-workflow-stage.is-done { color: #14804a; }
.drawer-workflow-stage.is-done .drawer-workflow-dot { border-color: #14804a; background: #14804a; color: #fff; }
.drawer-workflow-stage.is-current { color: #17212f; font-weight: 600; }
.drawer-workflow-stage.is-current .drawer-workflow-dot { border-color: #1890ff; color: #0b6fc2; box-shadow: 0 0 0 3px #e8f3ff; }
.drawer-tabs {
  flex: 1 1 auto;
  min-height: 0;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}
.drawer-tabs :deep(.el-tabs__header) { flex: none; margin: 0 0 6px; }
.drawer-tabs :deep(.el-tabs__nav-wrap::after) { height: 1px; }
.drawer-tabs :deep(.el-tabs__item) { height: 36px; padding: 0 12px; color: #52637a; font-size: 14px; }
.drawer-tabs :deep(.el-tabs__item.is-active) { color: #17212f; font-weight: 700; }
.drawer-tabs :deep(.el-tabs__active-bar) { height: 2px; border-radius: 2px; }
.drawer-tabs :deep(.el-tabs__content) {
  flex: 1 1 auto;
  min-height: 0;
  overflow-y: auto;
  overflow-x: hidden;
  overscroll-behavior: contain;
  -webkit-overflow-scrolling: touch;
}
.drawer-tabs :deep(.el-tab-pane) { padding-right: 2px; }
.drawer-scroll-pane { display: flex; flex-direction: column; gap: 8px; padding-bottom: 4px; }
.drawer-section { background: #f7f8fa; padding: 10px 12px; border-radius: 8px; margin-bottom: 8px; }
.drawer-scroll-pane > .drawer-section { margin-bottom: 0; }
.drawer-tabs :deep(.el-tab-pane > .drawer-section:last-child) { margin-bottom: 0; }
.drawer-section p { margin: 0; }
.drawer-section-title { font-weight: 700; color: #1d2129; font-size: 15px; margin: 0 0 6px !important; }
.drawer-section-head { display: flex; justify-content: space-between; align-items: center; gap: 12px; margin-bottom: 6px; }
.assign-engineer-row { display: flex; align-items: center; gap: 8px; margin-top: 0; flex-wrap: wrap; }
.drawer-section-head .drawer-section-title { margin-bottom: 0 !important; }
.customer-section { background: #eef6ff; }
.product-overview-section { background: #fff8f0; }
.drawer-info-grid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 6px 8px; }
.drawer-info-grid--dense { grid-template-columns: repeat(3, minmax(0, 1fr)); }
.drawer-info-item { min-width: 0; padding: 6px 8px; border-radius: 6px; background: rgba(255, 255, 255, 0.86); }
.drawer-info-item.is-wide { grid-column: 1 / -1; }
.drawer-info-item.is-plain { padding: 4px 0 0; background: transparent; }
.drawer-info-item span { display: block; margin-bottom: 2px; color: #697a91; font-size: 12px; line-height: 1.25; }
.drawer-info-item strong { display: block; color: #1d2129; font-size: 14px; font-weight: 600; line-height: 1.4; word-break: break-all; }
.drawer-status-inline { display: flex !important; align-items: center; flex-wrap: wrap; gap: 4px; }
.drawer-meta-disclosure { margin-top: 4px; color: #697a91; font-size: 13px; }
.overview-product-list { display: flex; flex-direction: column; gap: 8px; }
.overview-product-card { padding: 8px 10px; border: 1px solid #f0e2d0; border-radius: 8px; background: #fff; }
.overview-product-head { display: flex; align-items: center; justify-content: space-between; gap: 8px; margin-bottom: 6px; }
.overview-product-head strong { min-width: 0; color: #17212f; font-size: 15px; line-height: 1.35; }
.overview-fault-text { white-space: pre-wrap; word-break: break-word; font-size: 14px !important; line-height: 1.55 !important; }
.overview-attachment-block { display: flex; flex-direction: column; gap: 4px; margin-top: 6px; }
.overview-fault-fallback { padding-top: 2px; }
.drawer-meta-disclosure > summary { cursor: pointer; user-select: none; list-style: none; color: #52637a; font-weight: 600; }
.drawer-meta-disclosure > summary::-webkit-details-marker { display: none; }
.drawer-meta-disclosure > summary::before { content: ''; display: inline-block; width: 6px; height: 6px; margin-right: 6px; border-right: 1.5px solid currentColor; border-bottom: 1.5px solid currentColor; transform: rotate(-45deg); vertical-align: 1px; transition: transform 140ms ease; }
.drawer-meta-disclosure[open] > summary::before { transform: rotate(45deg); }
.mono-text { font-family: 'Consolas', 'Menlo', monospace; }
.quote-editor-section, .payment-section, .invoice-section { background: #fff; border: 1px solid #e2e8f0; box-shadow: 0 8px 24px rgba(28, 45, 68, 0.05); }
.quote-staircase { display: flex; flex-direction: column; gap: 0; }
.quote-stage { position: relative; padding: 0 0 14px 44px; }
.quote-stage:not(:last-child)::before { content: ''; position: absolute; top: 30px; bottom: 0; left: 15px; width: 2px; background: #dbe7f4; }
.quote-stage-head { display: flex; align-items: flex-start; gap: 10px; min-height: 36px; margin-left: -44px; margin-bottom: 8px; }
.quote-stage-index { position: relative; z-index: 1; width: 32px; height: 32px; flex: none; display: inline-flex; align-items: center; justify-content: center; border-radius: 50%; background: #eaf3ff; color: #1769aa; font-size: 14px; font-weight: 700; }
.quote-stage-head > div { display: grid; gap: 1px; min-width: 0; }
.quote-stage-head strong { color: #17212f; font-size: 15px; line-height: 1.35; }
.quote-stage-head span { color: #64748b; font-size: 13px; line-height: 1.4; }
.quote-stage--publish { padding-bottom: 0; }
.quote-stage--publish .quote-stage-index { background: #1769aa; color: #fff; }
.quote-quick-panel { display: grid; grid-template-columns: minmax(0, 1fr) minmax(160px, 220px); align-items: center; gap: 12px; padding: 12px 14px; margin-bottom: 4px; border-radius: 8px; background: #f4f8ff; border: 1px solid #d1e5ff; }
.quote-quick-panel strong { display: block; margin-bottom: 4px; color: #10264a; font-size: 15px; line-height: 1.4; }
.quote-quick-panel span { display: block; color: #52637a; font-size: 13px; line-height: 1.45; }
.quote-quick-panel :deep(.el-input-number) { width: 100%; }
.quote-summary-bar { display: grid; grid-template-columns: repeat(5, minmax(0, 1fr)); gap: 8px; margin-bottom: 12px; }
.quote-summary-bar div, .payment-status-grid div { padding: 10px 12px; border-radius: 8px; background: #f7fbff; border: 1px solid #e6f4ff; }
.quote-summary-bar span, .payment-status-grid span { display: block; color: #697a91; font-size: 12px; line-height: 1.3; margin-bottom: 4px; }
.quote-summary-bar strong, .payment-status-grid strong { display: block; color: #1d2129; font-size: 14px; line-height: 1.35; }
.quote-summary-bar .quote-total { color: #1677ff; font-size: 18px; }
.quote-detail-disclosure { margin-bottom: 12px; border-radius: 8px; border: 1px solid #eef0f3; background: #fbfcfe; }
.quote-detail-disclosure > summary { min-height: 48px; padding: 0 16px; display: flex; align-items: center; gap: 10px; cursor: pointer; color: #1d2129; font-size: 15px; font-weight: 700; list-style: none; }
.quote-detail-disclosure > summary::-webkit-details-marker { display: none; }
.quote-detail-disclosure > summary::before { content: ''; width: 8px; height: 8px; border-right: 2px solid #8a97aa; border-bottom: 2px solid #8a97aa; transform: rotate(-45deg); transition: transform 160ms ease; }
.quote-detail-disclosure[open] > summary::before { transform: rotate(45deg); }
.quote-detail-disclosure > summary small { color: #64748b; font-size: 13px; font-weight: 400; }
.quote-detail-disclosure[open] { padding-bottom: 10px; }
.quote-template-row { display: grid; grid-template-columns: minmax(180px, 280px) 1fr; gap: 10px; align-items: center; margin-bottom: 12px; color: #86909c; font-size: 12px; }
.quote-item-list { display: flex; flex-direction: column; gap: 10px; margin-bottom: 10px; }
.quote-item-editor { display: flex; flex-direction: column; gap: 8px; padding: 12px; border-radius: 10px; background: #f7f8fa; border: 1px solid #eef0f3; }
.quote-fee-row { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)) auto; align-items: center; gap: 8px; }
.quote-fee-row :deep(.el-input-number) { width: 100%; }
.quote-section { display: flex; flex-direction: column; gap: 8px; margin-bottom: 12px; padding: 12px; border-radius: 8px; background: #f7f8fa; border: 1px solid #eef0f3; }
.quote-section-head { display: flex; align-items: center; justify-content: space-between; gap: 8px; color: #1d2129; font-size: 14px; font-weight: 600; }
.quote-section-head em { margin-left: 4px; color: #8a97aa; font-size: 12px; font-style: normal; font-weight: 400; }
.quote-row-grid { display: grid; align-items: center; gap: 8px; }
.quote-row-grid--parts { grid-template-columns: 100px minmax(100px, 1fr) 96px 110px 96px 88px auto; }
.quote-row-grid--services { grid-template-columns: minmax(120px, 1.2fr) 96px 110px 96px 88px auto; }
.quote-row-grid--others { grid-template-columns: minmax(140px, 1fr) 110px 96px 88px auto; }
.quote-item-list, .quote-section { overflow-x: auto; }
.quote-row-grid :deep(.el-input-number) { width: 100%; }
.quote-row-grid strong { color: #1d2129; font-size: 13px; white-space: nowrap; }
.quote-terms-grid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 14px; margin-bottom: 14px; }
.quote-final-row { display: grid; grid-template-columns: 112px minmax(160px, 1fr); align-items: center; gap: 10px; margin: 0; color: #1d2129; font-size: 15px; font-weight: 600; }
.quote-final-row :deep(.el-input-number) { width: 100%; }
.quote-actions { display: flex; justify-content: flex-end; gap: 10px; margin-top: 4px; }
.quote-actions :deep(.el-button) { min-width: 112px; min-height: 40px; font-size: 15px; font-weight: 600; }
.payment-status-grid { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 8px; margin-bottom: 12px; }
.payment-guide { min-height: 78px; display: flex; flex-direction: column; justify-content: center; gap: 4px; margin-top: 12px; padding: 14px 16px; border-radius: 8px; border: 1px dashed #cfd7e3; background: #fafbfc; }
.payment-guide strong { color: #17212f; font-size: 14px; }
.payment-guide span { color: #6b778c; font-size: 12px; line-height: 1.55; }
.payment-guide--success { border-color: #a9d8bd; background: #f2fbf6; }
.payment-guide--success strong { color: #14804a; }
.payment-proof-list { display: flex; flex-direction: column; gap: 10px; margin-top: 10px; }
.payment-proof-card { display: flex; gap: 12px; align-items: center; padding: 10px; border-radius: 10px; background: #f7f8fa; border: 1px solid #eef0f3; }
.payment-proof-thumb, .payment-proof-placeholder { width: 64px; height: 64px; flex-shrink: 0; border-radius: 8px; }
.payment-proof-placeholder { display: inline-flex; align-items: center; justify-content: center; background: #e6f4ff; color: #1890ff; font-size: 13px; font-weight: 600; }
.payment-proof-info { min-width: 0; display: flex; flex-direction: column; gap: 3px; line-height: 1.4; }
.payment-proof-info strong { color: #1d2129; font-size: 14px; }
.payment-proof-info span { color: #86909c; font-size: 12px; }
.payment-proof-info a { color: #1890ff; font-size: 12px; text-decoration: none; }
.part-picker-toolbar { display: flex; align-items: center; gap: 10px; margin-bottom: 12px; }
.payment-actions { display: flex; align-items: center; flex-wrap: wrap; gap: 10px; margin-top: 12px; }
.payment-paid-tip { color: #52c41a; font-size: 13px; }
.payment-rejected-tip { color: #f56c6c; font-size: 13px; }
.invoice-summary-grid { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 8px; margin-bottom: 12px; }
.invoice-summary-grid > div { padding: 11px 12px; border-radius: 8px; border: 1px solid #e8ebef; background: #fafbfc; }
.invoice-summary-grid span { display: block; margin-bottom: 4px; color: #7a8699; font-size: 12px; line-height: 1.3; }
.invoice-summary-grid strong { display: block; color: #17212f; font-size: 14px; line-height: 1.4; }
.invoice-alert { margin-bottom: 14px; }
.invoice-empty-state { min-height: 180px; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 8px; padding: 24px; border: 1px dashed #cfd7e3; border-radius: 8px; background: #fafbfc; text-align: center; }
.invoice-empty-state strong { color: #17212f; font-size: 15px; }
.invoice-empty-state span { color: #7a8699; font-size: 12px; }
.invoice-editor-heading { display: flex; justify-content: space-between; align-items: center; gap: 12px; margin: 16px 0 8px; }
.invoice-editor-heading strong { color: #17212f; font-size: 15px; }
.invoice-editor-heading span { color: #7a8699; font-size: 12px; }
.invoice-form-grid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 0 14px; }
.invoice-form-grid :deep(.el-form-item) { margin-bottom: 14px; }
.invoice-form-grid :deep(.el-form-item__label) { padding-bottom: 5px; color: #4e5969; font-size: 12px; line-height: 1.35; }
.invoice-detail-disclosure { margin: 4px 0 14px; border: 1px solid #e5e9ef; border-radius: 8px; background: #fafbfc; }
.invoice-detail-disclosure > summary { position: relative; min-height: 46px; display: flex; align-items: center; gap: 10px; padding: 0 14px; color: #17212f; cursor: pointer; list-style: none; font-size: 13px; font-weight: 600; }
.invoice-detail-disclosure > summary::-webkit-details-marker { display: none; }
.invoice-detail-disclosure > summary::before { content: ''; width: 7px; height: 7px; border-right: 2px solid #7a8699; border-bottom: 2px solid #7a8699; transform: rotate(-45deg); transition: transform 160ms ease; }
.invoice-detail-disclosure[open] > summary::before { transform: rotate(45deg); }
.invoice-detail-disclosure > summary small { color: #8b95a5; font-size: 11px; font-weight: 400; }
.invoice-detail-disclosure > .invoice-form-grid { padding: 2px 14px 4px; }
.invoice-actions { display: flex; justify-content: flex-end; flex-wrap: wrap; gap: 8px; margin-top: 10px; }
.drawer-section .el-textarea { margin-bottom: 10px; }
.drawer-section .el-button { margin-top: 2px; }
.drawer-footer { width: 100%; display: flex; flex-direction: column; gap: 14px; padding-top: 4px; }
.drawer-status-box { background: #f7f8fa; border-radius: 10px; padding: 12px 14px; }
.drawer-status-title { display: block; font-weight: 600; color: #1d2129; margin-bottom: 8px; }
.drawer-footer-actions { display: flex; justify-content: flex-end; gap: 10px; }
.empty-text { margin: 0; color: #86909c; }
.product-detail-list { display: flex; flex-direction: column; gap: 8px; }
.product-detail-card { background: #fff; border: 1px solid #e5e6eb; border-radius: 8px; padding: 10px 12px; display: flex; flex-direction: column; gap: 6px; }
.product-detail-card p { margin: 0; }
.product-card-title { font-weight: 700; color: #1d2129; font-size: 16px; line-height: 1.35; margin-bottom: 0; }
.sn-edit-row { display: flex; align-items: center; gap: 8px; margin-bottom: 0; }
.sn-edit-label { font-size: 14px; font-weight: 600; color: #4e5969; flex: none; }
.sn-edit-input { flex: 1 1 auto; min-width: 0; width: auto; }
.sn-fields-grid { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 6px; margin-bottom: 0; }
.sn-warranty-expire { font-size: 13px; color: #86909c; margin: 2px 0 4px; }
.warranty-entry-row { display: grid; grid-template-columns: minmax(120px, 1fr) minmax(140px, 1fr) minmax(160px, 1.4fr); align-items: end; gap: 8px; margin: 0; padding: 8px 10px; border: 1px solid #ffe0a3; border-radius: 8px; background: #fffaf0; }
.warranty-entry-row > div > span { display: block; margin-bottom: 4px; color: #4e5969; font-size: 13px; font-weight: 600; }
.warranty-entry-row :deep(.el-input-number) { width: 100%; }
.warranty-entry-row > p { margin: 0; color: #7a5200; font-size: 13px; line-height: 1.45; align-self: center; }
.coverage-review-row { display: flex; flex-direction: column; gap: 6px; margin: 0; padding: 8px 10px; border: 1px solid #d8e7f7; border-radius: 8px; background: #f7fbff; }
.coverage-review-head { display: flex; align-items: baseline; justify-content: space-between; gap: 10px; }
.coverage-review-head strong { color: #17212f; font-size: 15px; }
.coverage-review-head span { color: #7a8699; font-size: 13px; text-align: right; }
.coverage-fields-grid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 6px; }
.product-fault-line { display: flex; gap: 8px; align-items: flex-start; color: #1d2129; font-size: 14px; line-height: 1.5; }
.product-fault-line span { flex: none; color: #697a91; font-weight: 600; }
.product-detail-actions { display: flex; align-items: center; gap: 10px; margin-top: 8px; }
.product-detail-tip { font-size: 13px; color: #86909c; line-height: 1.4; }
.warranty-tag { margin: 2px 0; }
.quote-warranty-alert { margin-bottom: 8px; }
.attachment-title { margin: 2px 0 0; color: #697a91; font-size: 13px; font-weight: 600; }
.attachment-list { display: flex; gap: 6px; flex-wrap: wrap; }
.attachment-thumb { width: 72px; height: 72px; border-radius: 6px; }
.video-link { display: inline-flex; align-items: center; min-height: 30px; padding: 0 10px; border-radius: 6px; background: #e6f4ff; color: #1890ff; font-size: 13px; text-decoration: none; }
/* 检测与报价：默认中号控件，字更大、框更高 */
.product-detail-card :deep(.el-input__wrapper),
.product-detail-card :deep(.el-select__wrapper),
.product-detail-card :deep(.el-input-number),
.product-detail-card :deep(.el-date-editor.el-input__wrapper) {
  min-height: 36px;
  font-size: 14px;
}
.product-detail-card :deep(.el-input__inner),
.product-detail-card :deep(.el-select__selected-item),
.product-detail-card :deep(.el-select__placeholder),
.product-detail-card :deep(.el-input-number .el-input__inner) {
  font-size: 14px;
}
.product-detail-card :deep(.el-button) {
  min-height: 36px;
  padding: 8px 14px;
  font-size: 14px;
}
.product-detail-card :deep(.el-button.is-link) {
  min-height: auto;
  padding: 0;
  font-size: 14px;
}
.product-detail-actions :deep(.el-button) {
  min-height: 36px;
  padding: 8px 16px;
  font-size: 14px;
}

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
  .page-header-actions { width: 100%; }
  .page-header-actions :deep(.el-button) { width: 100%; }
  .workorder-toolbar { padding: 10px; }
  .search-strip { grid-template-columns: 1fr; }
  .batch-strip { justify-content: flex-start; overflow-x: auto; padding-bottom: 2px; }
  .selection-count { margin-right: 4px; white-space: nowrap; }
  .attention-strip { align-items: flex-start; flex-direction: column; gap: 8px; }
  .sla-board { width: 100%; grid-template-columns: repeat(2, minmax(0, 1fr)); }
  .table-section-head { align-items: flex-start; flex-direction: column; gap: 4px; }
  .table-section-head > div { align-items: flex-start; flex-direction: column; gap: 2px; }
  .drawer-body { gap: 8px; }
  .drawer-order-head { align-items: flex-start; gap: 10px; }
  .drawer-order-identity { grid-template-columns: minmax(0, 1fr); }
  .drawer-order-kicker { display: none; }
  .drawer-order-customer { white-space: normal; }
  .drawer-order-status { flex-direction: column; align-items: flex-end; }
  .drawer-next-step { align-items: flex-start; }
  .drawer-next-step-copy { grid-template-columns: 1fr; }
  .drawer-next-step-eyebrow { grid-row: auto; }
  .drawer-workflow { margin-inline: 0; grid-template-columns: repeat(5, minmax(52px, 1fr)); padding: 2px 0 4px; overflow-x: auto; }
  .drawer-tabs :deep(.el-tabs__item) { padding: 0 10px; }
  .drawer-info-grid--dense { grid-template-columns: repeat(2, minmax(0, 1fr)); }
  .drawer-info-grid { grid-template-columns: 1fr; }
  .quote-stage { padding-left: 0; }
  .quote-stage:not(:last-child)::before { display: none; }
  .quote-stage-head { margin-left: 0; }
  .quote-summary-bar { grid-template-columns: repeat(2, minmax(0, 1fr)); }
  .quote-quick-panel, .quote-terms-grid { grid-template-columns: 1fr; }
  .quote-final-row { grid-template-columns: 1fr; align-items: stretch; }
  .quote-actions { justify-content: stretch; }
  .quote-actions :deep(.el-button) { flex: 1; min-width: 0; }
  .payment-status-grid, .invoice-summary-grid, .invoice-form-grid { grid-template-columns: 1fr; }
  .coverage-review-head { align-items: flex-start; flex-direction: column; gap: 2px; }
  .coverage-fields-grid { grid-template-columns: 1fr; }
  .invoice-editor-heading { align-items: flex-start; flex-direction: column; gap: 2px; }
  .invoice-detail-disclosure > summary { align-items: flex-start; flex-direction: column; gap: 2px; padding-block: 10px; }
  .invoice-detail-disclosure > summary::before { position: absolute; right: 16px; margin-top: 5px; }
  .drawer-footer-actions { flex-wrap: wrap; }
  .warranty-entry-row { grid-template-columns: 1fr; align-items: stretch; }
  .manual-order-form { max-height: none; padding-right: 0; }
  .manual-order-grid,
  .manual-order-grid--customer,
  .manual-order-grid--intake,
  .manual-order-grid--device-detail,
  .manual-order-filter-row,
  .manual-order-logistics-columns { grid-template-columns: 1fr; }
  .manual-order-section-head { align-items: flex-start; flex-wrap: wrap; }
  .manual-order-section-head > .el-button { margin-left: 36px; }
  .manual-order-status :deep(.el-radio-group) { display: grid; grid-template-columns: 1fr; width: 100%; }
  .manual-order-status :deep(.el-radio-button__inner) { width: 100%; }
}

</style>

<!-- append-to-body 的抽屉挂在 body 下，需要非 scoped 才能命中壳层 -->
<style>
.work-order-drawer.el-drawer {
  display: flex;
  flex-direction: column;
  height: 100%;
  box-shadow: -12px 0 36px rgba(23, 33, 47, 0.12);
}
.work-order-drawer .el-drawer__header {
  margin-bottom: 0;
  flex: none;
  padding: 12px 18px 10px;
  border-bottom: 1px solid #e7edf5;
}
.work-order-drawer .el-drawer__title {
  color: #17212f;
  font-size: 18px;
  font-weight: 700;
  line-height: 1.3;
}
.work-order-drawer .el-drawer__body {
  flex: 1 1 auto;
  display: flex;
  flex-direction: column;
  min-height: 0;
  height: auto;
  padding: 10px 18px 6px;
  overflow: hidden;
}
.work-order-drawer .el-drawer__footer {
  flex: none;
  padding: 8px 18px 12px;
  border-top: 1px solid #e7edf5;
}
.work-order-drawer .drawer-body {
  flex: 1 1 auto;
  min-height: 0;
  height: 100%;
}
@media screen and (max-width: 768px) {
  .work-order-drawer .el-drawer__header { padding: 12px 14px 10px; }
  .work-order-drawer .el-drawer__title { font-size: 16px; }
  .work-order-drawer .el-drawer__body { padding: 10px 14px 8px; }
  .work-order-drawer .el-drawer__footer { padding: 8px 14px 12px; }
}
</style>
