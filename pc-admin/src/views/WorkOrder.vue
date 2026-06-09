<template>
  <div class="glass-card">
    <div class="page-header">
      <h2 class="page-title">报修工单管理</h2>
      <div class="header-stats">
        <div class="stat-item stat-pending">
          <span class="stat-label">待处理</span>
          <span class="stat-value">{{ orders.filter(o => pendingAdminStatuses.includes(o.status)).length }}</span>
        </div>
        <div class="stat-item stat-processing">
          <span class="stat-label">处理中</span>
          <span class="stat-value">{{ orders.filter(o => o.status === '处理中').length }}</span>
        </div>
        <div class="stat-item stat-shipped">
          <span class="stat-label">已回寄</span>
          <span class="stat-value">{{ orders.filter(o => o.status === '已回寄').length }}</span>
        </div>
        <div class="stat-item stat-completed">
          <span class="stat-label">已完成</span>
          <span class="stat-value">{{ orders.filter(o => o.status === '已完成').length }}</span>
        </div>
      </div>
    </div>

    <div class="workorder-header">
      <div class="filter-container">
        <el-input v-model="wo.search" placeholder="搜索姓名/手机号/设备号" style="width: 240px;" clearable prefix-icon="Search"></el-input>
        <el-select v-model="wo.filter" placeholder="工单状态" clearable style="width: 130px;">
          <el-option v-for="status in adminStatusOptions" :key="status" :label="status" :value="status"></el-option>
        </el-select>
        <el-select v-model="wo.deviceFilter" placeholder="设备型号" clearable style="width: 180px;">
          <el-option v-for="device in deviceModels" :key="device" :label="device" :value="device"></el-option>
        </el-select>
        <el-select v-model="searchInvoiceStatus" placeholder="发票状态" style="width: 130px;">
          <el-option label="全部" value=""></el-option>
          <el-option label="无需开票" value="无需开票"></el-option>
          <el-option label="未发票" value="未发票"></el-option>
          <el-option label="已发票" value="已发票"></el-option>
        </el-select>
        <el-tag v-if="activeTodoType" type="warning" closable @close="clearTodoFilter">
          {{ activeTodoLabel }}
        </el-tag>
      </div>
      <div class="toolbar-actions">
        <el-date-picker
          v-model="shipDate"
          type="date"
          value-format="YYYY-MM-DD"
          placeholder="发货日期"
          style="width: 140px;"
        ></el-date-picker>
        <el-button plain class="top-btn-text" @click="downloadImportTemplate('inbound')"><el-icon><Document /></el-icon> 签收模板</el-button>
        <el-button plain class="top-btn-text" @click="downloadImportTemplate('return')"><el-icon><Document /></el-icon> 回寄模板</el-button>
        <el-button type="success" plain class="top-btn-text" :loading="importing" @click="openImportDialog('inbound')">
          <el-icon><Upload /></el-icon> 导入签收单
        </el-button>
        <el-button type="primary" plain class="top-btn-text" :loading="importing" @click="openImportDialog('return')">
          <el-icon><Upload /></el-icon> 导入回寄单
        </el-button>
        <el-button plain class="top-btn-text" :disabled="!selectedOrders.length" @click="handleConfiguredBatchPrint"><el-icon><Printer /></el-icon> 批量打印</el-button>
        <el-dropdown trigger="click" :disabled="!selectedOrders.length || batchCompleting" @command="handleBatchStatusCommand">
          <el-button type="warning" plain class="top-btn-text" :disabled="!selectedOrders.length" :loading="batchCompleting">
            <el-icon><CircleCheck /></el-icon> 批量状态 <el-icon class="el-icon--right"><ArrowDown /></el-icon>
          </el-button>
          <template #dropdown>
            <el-dropdown-menu>
              <el-dropdown-item command="processing">标记处理中</el-dropdown-item>
              <el-dropdown-item command="completed" divided>批量结单</el-dropdown-item>
            </el-dropdown-menu>
          </template>
        </el-dropdown>
        <el-button type="primary" class="top-btn-text" @click="openExportDialog"><el-icon><Download /></el-icon> 导出</el-button>
      </div>
    </div>

    <div class="info-banner">
      <div class="banner-icon">
        <el-icon :size="20"><InfoFilled /></el-icon>
      </div>
      <div class="banner-content">
        <div class="banner-title">批量导入物流状态</div>
        <div class="banner-desc">签收单用于客户寄入，导入后更新为已签收；回寄单用于后台发货，导入后更新为已回寄。</div>
      </div>
      <div class="banner-badge">
        <el-tag v-if="selectedOrders.length" type="primary" effect="dark" round>已选择 {{ selectedOrders.length }} 单</el-tag>
        <el-tag v-else type="info" effect="plain" round>按工单编号匹配</el-tag>
      </div>
    </div>

    <div class="table-responsive">
      <el-table :data="pagedOrders" class="modern-table" style="width: 100%" @selection-change="handleSelectionChange">
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

        <el-table-column label="处理状态" width="130">
          <template #default="{row}">
            <el-dropdown trigger="click" @command="status => handleQuickStatusChange(row, status)">
              <span class="status-dropdown-trigger">
                <el-tag
                  :class="'status-tag status-' + row.status"
                  :type="getStatusType(row.status)"
                  effect="light"
                  round
                  size="small">
                  {{ row.status }} <span class="status-dropdown-caret">▾</span>
                </el-tag>
              </span>
              <template #dropdown>
                <el-dropdown-menu>
                  <el-dropdown-item v-for="status in adminActionStatusOptions" :key="status" :command="status">{{ status }}</el-dropdown-item>
                </el-dropdown-menu>
              </template>
            </el-dropdown>
            <div class="update-time">{{ row.updateTime || '暂无更新时间' }}</div>
          </template>
        </el-table-column>

        <el-table-column label="发票状态" width="110">
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

        <el-table-column label="操作" width="128" fixed="right" align="right">
          <template #default="{row}">
            <div class="operation-actions">
              <el-button type="primary" link @click="openDrawer(row)">处理</el-button>
              <el-tooltip :content="getRemarkTooltip(row)" placement="top">
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
          <el-tab-pane label="基础与物流">
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
              <p class="drawer-section-title">寄出物流</p>
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
            <div class="drawer-section">
              <p class="drawer-section-title">回寄物流</p>
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
            <div class="drawer-section">
              <p class="drawer-section-title">工单信息</p>
              <p>工单编号：{{currentOrder.id}}</p>
              <p>提交时间：{{currentOrder.submitTime || '-'}}</p>
              <p>更新时间：{{currentOrder.updateTime || '-'}}</p>
              <p>当前状态：<el-tag :class="'status-tag status-' + currentOrder.status" :type="getStatusType(currentOrder.status)" effect="light" size="small">{{currentOrder.status}}</el-tag></p>
            </div>
            <div class="drawer-section">
              <p class="drawer-section-title">备注与留言</p>
              <el-input
                v-model="currentOrder.adminRemark"
                type="textarea"
                :rows="3"
                placeholder="内部跟进备注（仅后台可见）"
              ></el-input>
              <el-input
                v-model="currentOrder.printRemark"
                type="textarea"
                :rows="3"
                placeholder="随件留言（将打印在回寄单上）"
              ></el-input>
              <el-button type="primary" plain size="small" :loading="remarkSaving" @click="saveRemarks">保存备注</el-button>
            </div>
          </el-tab-pane>
          <el-tab-pane label="产品明细">
            <div class="drawer-section">
              <div v-if="currentOrder.itemsList && currentOrder.itemsList.length" class="product-detail-list">
                <div v-for="(item, itemIndex) in currentOrder.itemsList" :key="item._id || itemIndex" class="product-detail-card">
                  <div class="product-card-title">产品 {{ itemIndex + 1 }}：{{ item.product_name || '未命名产品' }}</div>
                  <p>产品型号：{{item.product_model || '-'}}</p>
                  <p>SN码：{{item.sn || '-'}}</p>
                  <p>购买日期：{{item.buy_date || '-'}}</p>
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
              </div>
              <p v-else class="empty-text">暂无产品明细</p>
            </div>
          </el-tab-pane>
          <el-tab-pane label="财务与发票">
            <div class="drawer-section quote-editor-section">
              <div class="drawer-section-head">
                <p class="drawer-section-title">维修报价</p>
                <el-tag :type="getQuoteStatusType(quoteForm.status)" size="small">{{ getQuoteStatusText(quoteForm.status) }}</el-tag>
              </div>
              <div class="quote-summary-bar">
                <div><span>配件费</span><strong>{{ formatMoney(quotePartsFee) }}</strong></div>
                <div><span>工时费</span><strong>{{ formatMoney(quoteLaborFee) }}</strong></div>
                <div><span>合计</span><strong class="quote-total">{{ formatMoney(quoteTotal) }}</strong></div>
              </div>
              <div class="quote-item-list">
                <div v-for="(item, index) in quoteForm.items" :key="item.localId" class="quote-item-editor">
                  <el-input v-model="item.name" placeholder="维修项目，如更换轴承/检测清洁"></el-input>
                  <el-input v-model="item.desc" placeholder="项目说明，可选"></el-input>
                  <div class="quote-fee-row">
                    <el-input-number v-model="item.partsFee" :min="0" :precision="2" :step="10" controls-position="right" placeholder="配件费"></el-input-number>
                    <el-input-number v-model="item.laborFee" :min="0" :precision="2" :step="10" controls-position="right" placeholder="工时费"></el-input-number>
                    <el-button type="danger" link :disabled="quoteForm.items.length <= 1" @click="removeQuoteItem(index)">删除</el-button>
                  </div>
                </div>
              </div>
              <el-button type="primary" plain size="small" @click="addQuoteItem">添加费用项</el-button>
              <el-input
                v-model="quoteForm.remark"
                type="textarea"
                :rows="2"
                placeholder="报价备注（客户可见，可填写付款说明或费用说明）"
              ></el-input>
              <div class="quote-actions">
                <el-button :loading="quoteSaving" @click="saveOrderQuote('draft')">保存草稿</el-button>
                <el-button type="primary" :loading="quoteSaving" @click="saveOrderQuote('issued')">发布报价</el-button>
              </div>
              <p class="quote-tip">发布后，客户小程序的“费用与发票”会展示该金额，并允许客户确认费用、上传付款凭证。</p>
            </div>
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
              <div v-if="currentOrder.paymentProofs && currentOrder.paymentProofs.length" class="payment-proof-list">
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
              <p v-else class="empty-text">客户还未上传付款凭证。</p>
              <div class="payment-actions">
                <el-button
                  v-if="resolvePaymentStatus(currentOrder) === 'uploaded'"
                  type="success"
                  size="small"
                  :loading="paymentSaving"
                  @click="markPaymentPaid"
                >
                  标记已到账
                </el-button>
                <span v-if="resolvePaymentStatus(currentOrder) === 'paid'" class="payment-paid-tip">财务已确认到账，可继续处理发票。</span>
              </div>
            </div>
            <div class="drawer-section">
              <p class="drawer-section-title">财务/发票信息</p>
              <p>是否需要开票：{{currentOrder.needInvoice ? '是' : '否'}}</p>
              <p>发票状态：<el-tag :type="getInvoiceType(normalizeInvoiceStatus(currentOrder))" size="small">{{ normalizeInvoiceStatus(currentOrder) }}</el-tag></p>
              <template v-if="currentOrder.needInvoice">
                <p>发票抬头：{{currentOrder.invoiceTitle || '-'}}</p>
                <p>税号：{{currentOrder.taxId || '-'}}</p>
              </template>
              <el-divider border-style="dashed"></el-divider>
              <p class="drawer-section-title">发票登记</p>
              <el-form label-width="86px" size="small">
                <el-form-item label="发票状态">
                  <el-select v-model="invoiceStatus" style="width:100%;">
                    <el-option label="无需开票" value="无需开票"></el-option>
                    <el-option label="未发票" value="未发票"></el-option>
                    <el-option label="已发票" value="已发票"></el-option>
                  </el-select>
                </el-form-item>
                <el-form-item label="发票抬头">
                  <el-input v-model="invoiceForm.title" placeholder="请输入发票抬头"></el-input>
                </el-form-item>
                <el-form-item label="企业税号">
                  <el-input v-model="invoiceForm.taxNo" placeholder="请输入企业税号"></el-input>
                </el-form-item>
                <el-form-item label="备注">
                  <el-input v-model="invoiceForm.remark" placeholder="电子票号/财务备注"></el-input>
                </el-form-item>
              </el-form>
              <el-button type="primary" plain size="small" @click="saveInvoiceStatus">保存发票状态</el-button>
            </div>
          </el-tab-pane>
        </el-tabs>
      </div>
    </template>
    <template #footer>
      <div class="drawer-footer">
        <div class="drawer-status-box">
          <span class="drawer-status-title">更改工单进度</span>
          <el-radio-group v-model="newStatus">
            <el-radio v-for="status in adminActionStatusOptions" :key="status" :label="status">{{ status }}</el-radio>
          </el-radio-group>
        </div>
        <div class="drawer-footer-actions">
          <el-button @click="printConfiguredOrder" plain><el-icon><Printer /></el-icon> 打印</el-button>
          <el-button @click="drawerVisible=false">关闭</el-button>
          <el-button type="primary" :loading="quickStatusLoading" @click="confirmStatus">保存</el-button>
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
      <el-form-item label="内部备注">
        <el-input
          v-model="quickRemarkForm.adminRemark"
          type="textarea"
          :rows="3"
          placeholder="内部跟进备注（仅后台可见）"
        ></el-input>
      </el-form-item>
      <el-form-item label="随件留言">
        <el-input
          v-model="quickRemarkForm.printRemark"
          type="textarea"
          :rows="3"
          placeholder="随件留言（将打印在回寄单上）"
        ></el-input>
      </el-form-item>
    </el-form>
    <template #footer>
      <el-button @click="remarkDialogVisible = false">取消</el-button>
      <el-button type="primary" :loading="quickStatusLoading" @click="confirmSaveRemark">保存</el-button>
    </template>
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
import { batchImportLogistics, batchUpdateShipping, getOrderList, updateInvoiceStatus, updateOrderQuote, updateOrderStatus, updatePaymentStatus, updateRemarks } from '../api/order.js'
import { getSettings } from '../api/admin.js'
import { exportOrdersToWorkbook, formatOrderAttachments, formatOrderItems } from '../utils/orderExport.js'
import { transformOrders } from '../utils/orderTransform.js'
import { toEnglishStatus } from '../utils/orderStatus.js'
import { openPrintWindow, parsePrintConfig } from '../utils/orderPrint.js'
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
    '已发票': 'success'
  }
  return invoiceMap[status] || 'info'
}

const normalizeInvoiceStatus = (order = {}) => {
  if (order.invoiceStatus === '待开票' || order.invoiceStatus === '开具中') return '未发票'
  if (order.invoiceStatus === '已开具') return '已发票'
  if (order.invoiceStatus === '已发票') return '已发票'
  if (order.invoiceStatus === '未发票') return '未发票'
  return '无需开票'
}

const formatMoney = (value = 0) => {
  const amount = Number(value) || 0
  return `¥${amount.toFixed(2)}`
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
    uploaded: '待核销',
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
  return 'info'
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
  payment: '待核销',
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
  { label: '付款状态', key: 'paymentStatus', getter: order => getPaymentStatusText(order) },
  { label: '总金额', key: 'totalPrice', getter: order => order.totalPrice }
]

const orders = ref([])
const totalOrders = ref(0)
const deviceModelOptions = ref([])
const selectedOrders = ref([])
const isPrinting = ref(false)
const printTime = ref('')
const printConfig = ref(parsePrintConfig())
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
const activeTodoType = ref('')
const activeTodoLabel = computed(() => todoTypeMap[activeTodoType.value] || '待办筛选')
const activeLogisticsImportLabel = computed(() => getLogisticsImportTypeLabel(activeLogisticsImportType.value))
const logisticsImportTip = computed(() => {
  return activeLogisticsImportType.value === 'inbound'
    ? '签收单用于客户寄入设备：请填写工单编号、物流公司、物流单号、签收时间，导入后状态更新为已签收。'
    : '回寄单用于后台发货：请填写工单编号、物流公司、物流单号、发货时间，导入后状态更新为已回寄。'
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
      todoType: activeTodoType.value,
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
      todoType: activeTodoType.value,
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

const wo = reactive({ search: '', filter: '', deviceFilter: '', page: 1, pageSize: 10 })

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
}

const clearTodoFilter = () => {
  activeTodoType.value = ''
}

onMounted(() => {
  applyRouteFilters()
  loadPrintConfig()
  loadOrders()
})

watch(
  () => [wo.search, wo.filter, wo.deviceFilter, searchInvoiceStatus.value, activeTodoType.value],
  () => {
    if (wo.page === 1) {
      loadOrders()
    } else {
      wo.page = 1
    }
  }
)

watch(
  () => [route.query.filter, route.query.todo],
  () => {
    applyRouteFilters()
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
const currentQuickOrder = ref(null)
const currentRemarkOrder = ref(null)
const quickShipDialogVisible = ref(false)
const remarkDialogVisible = ref(false)
const newStatus = ref('')
const invoiceStatus = ref('无需开票')
const invoiceForm = reactive({ title: '', taxNo: '', remark: '' })
const remarkSaving = ref(false)
const quoteSaving = ref(false)
const paymentSaving = ref(false)
const quickShipForm = reactive({ returnCompany: '顺丰速运', returnNo: '' })
const quickRemarkForm = reactive({ adminRemark: '', printRemark: '' })

const createQuoteItem = (item = {}) => ({
  localId: item.localId || `quote-${Date.now()}-${Math.random().toString(16).slice(2)}`,
  name: item.name || item.title || item.projectName || '',
  desc: item.desc || item.description || item.remark || '',
  partsFee: Number(item.partsFee ?? item.parts_fee ?? item.partFee ?? item.part_fee ?? item.materialFee ?? item.material_fee ?? 0) || 0,
  laborFee: Number(item.laborFee ?? item.labor_fee ?? item.workFee ?? item.work_fee ?? item.serviceFee ?? item.service_fee ?? 0) || 0
})

const quoteForm = reactive({
  status: 'pending',
  remark: '',
  items: [createQuoteItem()]
})

const quotePartsFee = computed(() => quoteForm.items.reduce((total, item) => total + (Number(item.partsFee) || 0), 0))
const quoteLaborFee = computed(() => quoteForm.items.reduce((total, item) => total + (Number(item.laborFee) || 0), 0))
const quoteTotal = computed(() => quotePartsFee.value + quoteLaborFee.value)

const normalizeQuoteItems = (items = []) => {
  return (Array.isArray(items) ? items : []).map(createQuoteItem)
}

const resetQuoteForm = (order = {}) => {
  const rawItems = Array.isArray(order.quoteItems) && order.quoteItems.length
    ? order.quoteItems
    : (Array.isArray(order.quote_items) ? order.quote_items : [])
  const totalPrice = Number(order.totalPrice ?? order.total_price ?? 0) || 0
  const partsFee = Number(order.partsFee ?? order.parts_fee ?? 0) || 0
  const laborFee = Number(order.laborFee ?? order.labor_fee ?? 0) || 0
  const fallbackItems = totalPrice > 0
    ? [createQuoteItem({
        name: '维修费用',
        desc: order.quoteRemark || order.quote_remark || '',
        partsFee,
        laborFee: laborFee || Math.max(totalPrice - partsFee, 0)
      })]
    : [createQuoteItem()]

  quoteForm.status = order.quoteStatus || order.quote_status || (totalPrice > 0 ? 'issued' : 'pending')
  quoteForm.remark = order.quoteRemark || order.quote_remark || ''
  quoteForm.items = rawItems.length ? normalizeQuoteItems(rawItems) : fallbackItems
}

const buildQuotePayload = (status) => {
  const items = quoteForm.items
    .map(item => {
      const name = (item.name || '').trim()
      const desc = (item.desc || '').trim()
      const partsFee = Number(item.partsFee) || 0
      const laborFee = Number(item.laborFee) || 0
      return {
        name: name || '维修费用',
        desc,
        partsFee,
        laborFee,
        hasContent: Boolean(name || desc || partsFee > 0 || laborFee > 0)
      }
    })
    .filter(item => item.hasContent)
    .map(({ hasContent, ...item }) => item)

  return {
    status,
    remark: (quoteForm.remark || '').trim(),
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
  newStatus.value = row.status
  invoiceStatus.value = normalizeInvoiceStatus(row)
  invoiceForm.title = row.invoiceTitle || ''
  invoiceForm.taxNo = row.taxId || ''
  invoiceForm.remark = row.invoiceRemark || ''
  resetQuoteForm(row)
  drawerVisible.value = true
}

const addQuoteItem = () => {
  quoteForm.items.push(createQuoteItem())
}

const removeQuoteItem = (index) => {
  if (quoteForm.items.length <= 1) return
  quoteForm.items.splice(index, 1)
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
    resetQuoteForm(fresh)
  }
}

const isUserCancel = (error) => error === 'cancel' || error === 'close'

const formatOrderIdList = (list = []) => {
  const ids = list.map(item => item.id || item._id).filter(Boolean)
  const visible = ids.slice(0, 6).join('、')
  return ids.length > 6 ? `${visible} 等 ${ids.length} 单` : visible
}

const handleQuickStatusChange = async (row, status) => {
  if (!row || !status || row.status === status) {
    ElMessage.info('当前工单已是该状态')
    return false
  }

  if (status === '已回寄') {
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

  const invalidOrders = selectedOrders.value.filter(order => ['已回寄', '已完成'].includes(order.status))
  if (invalidOrders.length) {
    await ElMessageBox.alert(
      `以下工单已进入回寄或完成阶段，不能批量回退为处理中：${formatOrderIdList(invalidOrders)}`,
      '批量标记处理中失败',
      {
        confirmButtonText: '知道了',
        type: 'warning'
      }
    ).catch(() => {})
    return
  }

  const targetOrders = selectedOrders.value.filter(order => order.status !== '处理中')
  if (!targetOrders.length) {
    ElMessage.info('选中的工单已全部是处理中')
    return
  }

  try {
    await ElMessageBox.confirm(
      `确定将选中的 ${targetOrders.length} 个工单批量标记为【处理中】吗？涉及工单：${formatOrderIdList(targetOrders)}`,
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

  const invalidShippingOrders = selectedOrders.value.filter(order => order.status !== '已回寄' || !order.returnNo)
  if (invalidShippingOrders.length) {
    await ElMessageBox.alert(
      `以下工单尚未完成回寄发货，不能批量结单：${formatOrderIdList(invalidShippingOrders)}`,
      '批量结单校验失败',
      {
        confirmButtonText: '知道了',
        type: 'warning'
      }
    ).catch(() => {})
    return
  }

  const pendingInvoiceOrders = selectedOrders.value.filter(order => order.needInvoice === true && normalizeInvoiceStatus(order) !== '已发票')
  const orderListText = formatOrderIdList(selectedOrders.value)
  const confirmMessage = pendingInvoiceOrders.length
    ? `本次将批量标记 ${selectedOrders.value.length} 个工单为【已完成】。涉及工单：${orderListText}。其中 ${pendingInvoiceOrders.length} 个工单需要发票但尚未标记为已发票，确定强制结单吗？`
    : `确定将选中的 ${selectedOrders.value.length} 个工单批量标记为【已完成】吗？涉及工单：${orderListText}`

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
      selectedOrders.value.map(order => updateOrderStatus(token, order._id, statusEn))
    )
    const failed = results.filter(item => item.status === 'rejected')
    if (failed.length) {
      ElMessage.error(`批量结单完成，失败 ${failed.length} 单`)
    } else {
      ElMessage.success(`已批量结单 ${selectedOrders.value.length} 单`)
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
  const changed = await handleQuickStatusChange(currentOrder.value, newStatus.value)
  if (changed) {
    drawerVisible.value = false
  }
}

const saveInvoiceStatus = async () => {
  if (!currentOrder.value) return
  loading.value = true
  try {
    const token = localStorage.getItem('adminToken')
    await updateInvoiceStatus(token, currentOrder.value._id, invoiceStatus.value, {
      title: invoiceForm.title,
      taxNo: invoiceForm.taxNo,
      remark: invoiceForm.remark
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
  const payload = buildQuotePayload(status)
  const total = payload.items.reduce((sum, item) => sum + (Number(item.partsFee) || 0) + (Number(item.laborFee) || 0), 0)

  if (!payload.items.length || total <= 0) {
    ElMessage.warning('请至少填写一个有效报价项目和金额')
    return
  }

  if (status === 'issued') {
    try {
      await ElMessageBox.confirm(
        `确定发布报价 ${formatMoney(total)} 给客户确认吗？`,
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
  if (resolvePaymentStatus(currentOrder.value) !== 'uploaded') {
    ElMessage.info('当前没有待核销的付款凭证')
    return
  }

  try {
    await ElMessageBox.confirm(
      '确认客户付款已经到账，并将付款状态标记为“已到账”？',
      '付款核销确认',
      {
        confirmButtonText: '确认到账',
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

const saveRemarks = async () => {
  if (!currentOrder.value) return
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

const loadPrintConfig = async () => {
  try {
    const token = localStorage.getItem('adminToken')
    const data = await getSettings(token)
    printConfig.value = parsePrintConfig(data && data.print_config)
  } catch (error) {
    printConfig.value = parsePrintConfig()
  }
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

const openImportDialog = (type = 'return') => {
  activeLogisticsImportType.value = type
  importResult.value = null
  importDialogVisible.value = true
}

const downloadImportTemplate = (type = 'return') => {
  downloadShippingTemplate(type)
}

const handleImportFile = async (uploadFile) => {
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

.page-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 24px; padding-bottom: 20px; border-bottom: 2px solid #f0f2f5; }
.page-title { font-size: 24px; font-weight: 700; color: #1d2129; margin: 0; letter-spacing: -0.5px; }
.header-stats { display: flex; gap: 16px; }
.stat-item { display: flex; flex-direction: column; align-items: center; padding: 12px 20px; border-radius: 8px; min-width: 80px; transition: all 0.3s; }
.stat-item:hover { transform: translateY(-2px); box-shadow: 0 4px 12px rgba(0,0,0,0.08); }
.stat-label { font-size: 12px; color: #86909c; margin-bottom: 4px; font-weight: 500; }
.stat-value { font-size: 24px; font-weight: 700; }
.stat-pending { background: #fff7e6; }
.stat-pending .stat-value { color: #ff9800; }
.stat-processing { background: #e6f4ff; }
.stat-processing .stat-value { color: #1890ff; }
.stat-shipped { background: #e6f7f0; }
.stat-shipped .stat-value { color: #52c41a; }
.stat-completed { background: #f0f2f5; }
.stat-completed .stat-value { color: #86909c; }

.info-banner { display: flex; align-items: center; gap: 16px; padding: 16px 20px; background: linear-gradient(135deg, #e6f4ff 0%, #f0f5ff 100%); border-radius: 10px; margin-bottom: 20px; border-left: 4px solid #1890ff; }
.banner-icon { color: #1890ff; display: flex; align-items: center; }
.banner-content { flex: 1; }
.banner-title { font-size: 15px; font-weight: 600; color: #1d2129; margin-bottom: 4px; }
.banner-desc { font-size: 13px; color: #4e5969; line-height: 1.6; }
.banner-badge { flex-shrink: 0; }

.workorder-header { display: flex; justify-content: space-between; align-items: center; gap: 24px; margin-bottom: 20px; flex-wrap: wrap; }
.filter-container { display: flex; align-items: center; gap: 16px; }
.toolbar-actions { display: flex; align-items: center; gap: 12px; flex-wrap: wrap; }
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
.table-responsive { width: 100%; overflow-x: auto; }
.modern-table { min-width: 900px; }
.modern-table :deep(.el-table__inner-wrapper::before) { display: none; }
.modern-table :deep(th.el-table__cell) { background-color: #f7f8fa !important; color: #4e5969; font-weight: 600; border-bottom: none; font-size: 13px; }
.modern-table :deep(td.el-table__cell) { border-bottom: 1px solid #f0f2f5; padding: 12px 0; }
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
.drawer-section-head .drawer-section-title { margin-bottom: 0 !important; }
.customer-section { background: #eef6ff; }
.drawer-info-grid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 10px 14px; }
.drawer-info-item { min-width: 0; padding: 10px 12px; border-radius: 8px; background: rgba(255, 255, 255, 0.72); }
.drawer-info-item.is-wide { grid-column: 1 / -1; }
.drawer-info-item span { display: block; margin-bottom: 4px; color: #86909c; font-size: 12px; line-height: 1.3; }
.drawer-info-item strong { display: block; color: #1d2129; font-size: 14px; font-weight: 600; line-height: 1.5; word-break: break-all; }
.mono-text { font-family: 'Consolas', 'Menlo', monospace; }
.quote-editor-section, .payment-section { background: #fff; border: 1px solid #e5eefb; box-shadow: 0 8px 24px rgba(24, 144, 255, 0.06); }
.quote-summary-bar { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 10px; margin-bottom: 12px; }
.quote-summary-bar div, .payment-status-grid div { padding: 10px 12px; border-radius: 8px; background: #f7fbff; border: 1px solid #e6f4ff; }
.quote-summary-bar span, .payment-status-grid span { display: block; color: #86909c; font-size: 12px; line-height: 1.3; margin-bottom: 4px; }
.quote-summary-bar strong, .payment-status-grid strong { display: block; color: #1d2129; font-size: 15px; line-height: 1.4; }
.quote-summary-bar .quote-total { color: #1890ff; font-size: 18px; }
.quote-item-list { display: flex; flex-direction: column; gap: 10px; margin-bottom: 10px; }
.quote-item-editor { display: flex; flex-direction: column; gap: 8px; padding: 12px; border-radius: 10px; background: #f7f8fa; border: 1px solid #eef0f3; }
.quote-fee-row { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)) auto; align-items: center; gap: 8px; }
.quote-fee-row :deep(.el-input-number) { width: 100%; }
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
.payment-actions { display: flex; align-items: center; gap: 10px; margin-top: 12px; }
.payment-paid-tip { color: #52c41a; font-size: 13px; }
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
.attachment-title { margin: 8px 0 6px; color: #86909c; }
.attachment-list { display: flex; gap: 8px; flex-wrap: wrap; }
.attachment-thumb { width: 72px; height: 72px; border-radius: 8px; }
.video-link { display: inline-flex; align-items: center; min-height: 28px; padding: 0 10px; border-radius: 6px; background: #e6f4ff; color: #1890ff; font-size: 12px; text-decoration: none; }

.logistics-info { font-size: 12px; color: #4e5969; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; margin-bottom: 2px; }
.logistics-label { color: #86909c; font-weight: 500; }

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

.invoice-tag { font-weight: 600; font-size: 12px; }
.invoice-无需开票 { background: #f0f2f5 !important; color: #86909c !important; border-color: #d9d9d9 !important; }
.invoice-未发票 { background: #fff7e6 !important; color: #ff9800 !important; border-color: #ffd666 !important; }
.invoice-已发票 { background: #e6f7f0 !important; color: #52c41a !important; border-color: #95de64 !important; }

@media screen and (max-width: 768px) {
  .page-header { flex-direction: column; align-items: flex-start; gap: 16px; }
  .header-stats { width: 100%; overflow-x: auto; }
  .filter-container { flex-direction: column; align-items: stretch !important; gap: 12px; }
  .filter-container .el-input, .filter-container .el-select { width: 100% !important; }
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
