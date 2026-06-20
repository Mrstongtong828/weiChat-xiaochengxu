<template>
	<view class="page-shell">
		<view v-if="activeModule" class="module-page" :class="{ 'module-page-dialog': activeModule === 'survey' }">
			<view v-if="activeModule !== 'survey'" class="module-head" :style="moduleHeadStyle">
				<view class="back-button tap" @click="closeModule"></view>
				<view class="module-title-wrap">
					<text class="module-title">{{ moduleInfo.title }}</text>
					<text class="module-subtitle">{{ moduleInfo.subtitle }}</text>
				</view>
			</view>

			<view v-if="activeModule === 'repair'" class="module-content repair-module">
				<view class="warm-card">
					<text class="warm-strong">温馨提示：</text>
					<text>为了给您提供更快更好的服务，请务必在快递里面留纸条写明：寄回原因或故障描述，联系方式和收件地址。</text>
				</view>
				<view class="module-section-head">
					<text>产品信息</text>
					<text>共 {{ repairProducts.length }} 件 · 可增加</text>
				</view>
				<view v-for="(product, index) in repairProducts" :key="product.id" class="repair-product">
						<view class="repair-product-strip">
							<view class="repair-product-name">
								<text>{{ index + 1 }}</text>
								<text>报修产品 #{{ index + 1 }}</text>
							</view>
							<view v-if="repairProducts.length > 1" class="remove-link tap" @click="removeRepairProduct(index)">移除</view>
						</view>
						<view class="repair-form-card">
							<view class="repair-field">
								<text>产品名称</text>
								<input v-model="product.name" placeholder="请输入" placeholder-class="input-placeholder" />
							</view>
							<view class="repair-field">
								<text><text class="required-star">*</text>产品序列号</text>
								<input v-model="product.serial" placeholder="输入或扫码 SN" placeholder-class="input-placeholder" @blur="recognizeSn(index)" />
								<view class="scan-icon tap" @click="scanSn(index)">
									<view class="scan-corner"></view>
									<view class="scan-corner"></view>
									<view class="scan-corner"></view>
								</view>
							</view>
							<!-- SN 识别结果 -->
							<view v-if="product.snLoading" class="sn-result loading"><text>正在识别设备…</text></view>
							<view v-else-if="product.snInfo && product.snInfo.found" class="sn-result">
								<view class="sn-result-row">
									<text class="sn-result-label">已识别</text>
									<text class="sn-tag" :class="'sn-tag-' + (product.snInfo.warrantyStatus || 'unknown')">{{ snWarrantyLabel(product.snInfo) }}</text>
								</view>
								<text v-if="product.snInfo.model" class="sn-result-line">型号：{{ product.snInfo.model }}</text>
								<text v-if="product.snInfo.warrantyExpire" class="sn-result-line">质保至：{{ product.snInfo.warrantyExpire }}</text>
								<text v-if="product.snInfo.history && product.snInfo.history.length" class="sn-result-line">历史维修：{{ product.snInfo.history.length }} 单</text>
							</view>
							<view v-else-if="product.snInfo && !product.snInfo.found && product.serial" class="sn-result muted"><text>未匹配到已登记设备，可手动填写型号</text></view>
							<view class="repair-field">
								<text>产品型号</text>
								<input v-model="product.model" placeholder="识别后自动带出，可修改" placeholder-class="input-placeholder" />
							</view>
							<view class="repair-field">
								<text>购买日期</text>
								<picker mode="date" :value="product.buyDate" @change="(e) => onDateChange(index, e)">
									<view class="field-action tap">
										<text class="field-action-value" :class="{ placeholder: !product.buyDate }">{{ product.buyDate || '设备信息待同步' }}</text>
										<view class="field-mini field-calendar"></view>
									</view>
								</picker>
							</view>
							<view class="repair-field voucher-field tap" @click="openVoucherPicker(index)">
								<view class="field-label-wrap">
									<text>购买凭证</text>
									<text class="field-optional">选填</text>
								</view>
								<view class="voucher-status">
									<text v-if="product.voucherList && product.voucherList.length" class="voucher-count">{{ product.voucherList.length }} 张已上传</text>
									<view v-else class="upload-box voucher-upload">
										<text>+</text>
										<text>上传凭证</text>
									</view>
								</view>
								<view class="field-mini field-clip"></view>
							</view>
							<view v-if="product.voucherList && product.voucherList.length" class="voucher-preview">
								<view v-for="(voucher, vIndex) in product.voucherList" :key="voucher.id" class="voucher-thumb tap" @click="previewVoucher(index, vIndex)">
									<image class="voucher-image" :src="getPreviewUrl(voucher)" mode="aspectFill"></image>
									<view class="voucher-remove" @click.stop="removeVoucher(index, vIndex)">×</view>
								</view>
							</view>
							<view class="repair-field column">
								<text><text class="required-star">*</text>故障描述</text>
								<textarea v-model="product.faultDesc" maxlength="2000" placeholder="最多2000字，描述故障现象、时间与诉求……" placeholder-class="input-placeholder"></textarea>
							</view>
							<view class="media-area">
								<view class="media-title">
									<text><text class="required-star">*</text>产品清单 / 故障图片或视频</text>
									<text>{{ product.media.length }}/3</text>
								</view>
								<view class="media-grid">
									<view v-for="media in product.media" :key="media.id" class="media-thumb">
										<image v-if="media.type === 'image'" class="media-image" :src="getPreviewUrl(media)" mode="aspectFill"></image>
										<view v-else class="media-video">
											<view class="glyph glyph-cam"><view class="glyph-extra"></view></view>
											<text>视频</text>
										</view>
										<view class="media-remove tap" @click.stop="removeRepairMedia(index, media.id)">×</view>
									</view>
									<view v-if="product.media.length < 3" class="media-add tap" @click="uploadRepairImage(index)">
										<text>+</text>
										<text>图片</text>
									</view>
									<view v-if="product.media.length < 3" class="media-add tap" @click="uploadRepairVideo(index)">
										<text>▶</text>
										<text>视频</text>
									</view>
								</view>
							</view>
						</view>
					</view>
					<view class="dash-add tap" @click="addRepairProduct">
						<text>+</text>
						<text>增加报修产品</text>
					</view>

				<view class="module-section-head single">
					<text>寄出信息</text>
				</view>
				<view class="blue-tip">请妥善包装好设备，顺丰取件请在快递员到达后提供运单号。</view>
				<view class="repair-form-card">
					<view class="repair-field select-row tap" @click="showLogisticsPicker = true">
						<text><text class="required-star">*</text>物流公司</text>
						<text class="select-value">{{ repairForm.logisticsCompany || '请选择物流公司' }}</text>
						<view class="field-arrow"></view>
					</view>
					<view class="repair-field">
						<text><text class="required-star">*</text>运单号</text>
						<input v-model="repairForm.trackingNo" placeholder="请输入运单号" placeholder-class="input-placeholder" />
						<view class="scan-icon tap" @click="scanTrackingNo">
							<view class="scan-corner"></view>
							<view class="scan-corner"></view>
							<view class="scan-corner"></view>
						</view>
					</view>
				</view>

				<view class="module-section-head single">
					<text>回寄信息</text>
				</view>
				<view class="repair-form-card">
					<view class="repair-field">
						<text><text class="required-star">*</text>收货人</text>
						<input v-model="repairForm.receiverName" placeholder="请输入用户姓名" placeholder-class="input-placeholder" />
					</view>
					<view class="repair-field">
						<text><text class="required-star">*</text>手机号码</text>
						<input v-model="repairForm.receiverPhone" placeholder="请输入用户手机" placeholder-class="input-placeholder" type="number" />
						<view class="field-arrow"></view>
					</view>
					<view class="repair-field">
						<text><text class="required-star">*</text>详细地址</text>
						<input v-model="repairForm.receiverAddress" placeholder="请输入用户地址" placeholder-class="input-placeholder" />
						<view class="field-mini field-pin"></view>
					</view>
					<view class="repair-field last">
						<text><text class="required-star">*</text>单位名称</text>
						<input v-model="repairForm.receiverUnit" placeholder="请输入单位名称" placeholder-class="input-placeholder" />
					</view>
				</view>

				<view class="module-section-head single">
					<text>联系我们</text>
				</view>
				<view class="contact-card-wrap">
					<view class="contact-card-item">
						<view class="contact-icon-wrap">
							<view class="glyph glyph-chat"><view class="glyph-extra"></view></view>
						</view>
						<view class="contact-content">
							<text class="contact-title">在线客服</text>
							<text class="contact-desc">（8:00至21:00 节假日除外）</text>
						</view>
					</view>
					<view class="contact-card-item contact-card-divider">
						<view class="contact-icon-wrap phone-icon">
							<view class="glyph glyph-phone"><view class="glyph-extra"></view></view>
						</view>
						<view class="contact-content">
							<text class="contact-title">服务热线（微信同号）</text>
							<text class="contact-desc">（8:00至21:00）</text>
							<view class="contact-phone-list">
								<view class="phone-item tap" @click="callPhone('13929945417')">
									<text class="phone-label">售后技术:</text>
									<text class="phone-number">13929945417</text>
									<text class="phone-region">（全国）</text>
								</view>
								<view class="phone-item tap" @click="callPhone('13929924257')">
									<text class="phone-label">售后客服1:</text>
									<text class="phone-number">13929924257</text>
									<text class="phone-region">（华东,湖北,湖南,海南）</text>
								</view>
								<view class="phone-item tap" @click="callPhone('13927263445')">
									<text class="phone-label">售后客服2:</text>
									<text class="phone-number">13927263445</text>
									<text class="phone-region">（东北,华北,西北,西南）</text>
								</view>
								<view class="phone-item tap" @click="callPhone('13927700164')">
									<text class="phone-label">售后客服3:</text>
									<text class="phone-number">13927700164</text>
									<text class="phone-region">（广东,河南）</text>
								</view>
								<view class="phone-item tap" @click="callPhone('+8613929924346')">
									<text class="phone-label">国际售后技术:</text>
									<text class="phone-number">+86 13929924346</text>
									<text class="phone-region">（International after-sales technology）</text>
								</view>
							</view>
						</view>
					</view>
				</view>
				<view class="repair-bottom-bar">
					<view class="bottom-more tap" @click="showRepairTools = true"><view></view><text>工具</text></view>
					<view class="bottom-submit tap" :class="{ disabled: repairSubmitting }" @click="submitRepair">{{ repairSubmitting ? '提交中...' : '立即提交报修' }}</view>
				</view>

				<view v-if="showLogisticsPicker" class="sheet-mask" @click="showLogisticsPicker = false"></view>
				<view v-if="showLogisticsPicker" class="choice-sheet">
					<view class="choice-head">
						<text class="tap" @click="showLogisticsPicker = false">取消</text>
						<text>选择物流公司</text>
						<text></text>
					</view>
					<scroll-view class="choice-scroll" scroll-y>
						<view v-for="item in logisticsList" :key="item.value" class="choice-row tap" @click="selectLogistics(item)">
							<text>{{ item.label }}</text>
							<view v-if="repairForm.logisticsCompany === item.value" class="mini-icon mini-check"></view>
						</view>
					</scroll-view>
				</view>
			</view>

			<view v-else-if="activeModule === 'repair-success'" class="module-content success-module">
				<view class="success-icon"><view class="mini-icon mini-check mini-check-white"></view></view>
				<text class="success-title">报修已提交</text>
				<text class="success-desc">工程师将于 30 分钟内联系您，请保持手机畅通</text>
				<view class="success-card">
					<view class="success-row"><text>工单号</text><text class="copy-link tap" @click="copyOne(submittedOrderId, '工单号')">复制</text></view>
					<text class="success-no">{{ submittedOrderId || '工单号待后台返回' }}</text>
					<view class="success-grid">
						<view><text>预计响应</text><text>30 分钟内</text></view>
						<view><text>物流方式</text><text>顺丰到付</text></view>
					</view>
				</view>
				<view class="dual-actions">
					<view class="ghost-button tap" @click="closeModule">返回首页</view>
					<view class="primary-button tap" @click="go('track')">查看进度</view>
				</view>
			</view>

			<view v-else-if="activeModule === 'track'" class="track-module">
				<view class="track-search-wrap">
					<view class="track-search">
						<view class="glyph glyph-search glyph-search-small"><view class="glyph-extra"></view></view>
						<input v-model.trim="trackSearchKeyword" placeholder="输入工单号 / 产品名称 / 序列号查询" placeholder-class="input-placeholder" confirm-type="search" />
					</view>
				</view>
				<scroll-view class="progress-tabs-line progress-tabs-compact" scroll-x show-scrollbar="false" enhanced>
					<view v-for="item in progressTabs" :key="item" class="progress-tab tap" :class="{ on: activeTrackTab === item }" @click="activeTrackTab = item">
						<text>{{ item }}</text>
					</view>
				</scroll-view>
				<view class="module-list track-list">
					<view v-for="order in filteredTrackOrders" :key="order.id" class="track-card track-card-classic tap" @click="openTrackDetail(order)">
						<view class="track-card-head">
							<view>
								<text class="muted-line">工单 {{ order.id }}</text>
								<text class="track-model">{{ order.model }}</text>
							</view>
							<text :class="['tag', 'tag-' + order.tone]">{{ order.status }}</text>
						</view>
						<view class="progress-steps">
							<view v-for="(step, index) in repairFlow" :key="step" class="progress-step" :class="{ reached: index <= order.reached }">
								<view></view>
								<text>{{ step }}</text>
							</view>
						</view>
						<view class="track-card-foot">
							<text>最后更新 · {{ order.time }}</text>
							<text>查看详情 →</text>
						</view>
					</view>
					<view v-if="!filteredTrackOrders.length" class="empty-hint compact track-empty">当前状态暂无工单记录。</view>
				</view>
			</view>

			<view v-else-if="activeModule === 'package-query'" class="module-content package-module">
				<view class="package-hero">
					<view class="package-hero-icon"><view class="glyph glyph-box"><view class="glyph-extra"></view></view></view>
					<view>
						<text>确认签收与入库进度</text>
						<text>输入快递单号，即可查看签收、入库和后续处理记录。</text>
					</view>
				</view>
				<view class="repair-form-card">
					<view class="repair-field">
						<text><text class="required-star">*</text>快递单号</text>
						<input v-model="packageQuery.trackingNo" placeholder="请输入快递单号" placeholder-class="input-placeholder" confirm-type="search" @confirm="queryPackage" />
						<view class="field-actions">
							<view class="field-action-icon package-action-icon package-scan-action tap" @click="scanPackageCode">
								<view class="glyph glyph-scan"><view class="glyph-extra"></view></view>
							</view>
							<view class="field-action-icon package-action-icon package-paste-action tap" @click="pastePackageCode">
								<view class="glyph glyph-paste"><view class="glyph-extra"></view></view>
							</view>
						</view>
					</view>
					<view class="repair-field last">
						<text>手机号后四位</text>
						<input v-model="packageQuery.phoneLast4" placeholder="查询完整轨迹时填写" placeholder-class="input-placeholder" type="number" maxlength="4" confirm-type="search" @confirm="queryPackage" />
					</view>
				</view>
				<view class="package-privacy-note">
					<text>隐私保护</text>
					<text>填写收件人手机后四位后，可查看更完整的物流轨迹。</text>
				</view>
				<view class="primary-button tap save-button" :class="{ disabled: packageQueryLoading }" @click="queryPackage">{{ packageQueryLoading ? '查询中...' : '立即查询' }}</view>
				<view v-if="packageQueryResult" class="package-result-card">
					<view class="package-result-head">
						<view>
							<text class="muted-line">快递单号</text>
							<text class="package-no">{{ packageQueryResult.trackingNo }}</text>
						</view>
						<text :class="['tag', 'tag-' + packageQueryResult.tone]">{{ packageQueryResult.status }}</text>
					</view>
					<view class="package-result-grid">
						<view><text>物流公司</text><text>{{ packageQueryResult.company || '待录入' }}</text></view>
						<view><text>关联工单</text><text>{{ packageQueryResult.orderId || '待关联' }}</text></view>
					</view>
					<view class="package-progress">
						<view v-for="(step, index) in packageFlow" :key="step" class="progress-step" :class="{ reached: index <= packageQueryResult.reached }">
							<view></view>
							<text>{{ step }}</text>
						</view>
					</view>
					<view class="module-section-head single package-timeline-title"><text>包裹记录</text></view>
					<view class="package-timeline">
						<view v-for="(item, index) in packageQueryResult.timeline" :key="item.title + index" class="detail-timeline-row">
							<view class="detail-timeline-pin" :class="{ pending: item.pending }">
								<view></view>
								<view v-if="index < packageQueryResult.timeline.length - 1"></view>
							</view>
							<view class="detail-timeline-copy">
								<view>
									<text :class="{ muted: item.pending }">{{ item.title }}</text>
									<text>{{ item.time }}</text>
								</view>
								<text>{{ item.desc }}</text>
							</view>
						</view>
					</view>
				</view>
				<view v-else-if="packageQuerySearched" class="empty-hint compact package-empty">暂未查到这票包裹。请确认快递单号是否正确，或等我们签收录入后再查询。</view>
			</view>

			<view v-else-if="activeModule === 'invoices'" class="module-content invoice-module">
				<view class="invoice-hero">
					<view class="invoice-hero-icon"><view class="glyph glyph-invoice"><view class="glyph-extra"></view></view></view>
					<view>
						<text>电子发票自助办理</text>
						<text>维修完成后可在线申请，支持查看申请、审核、开票状态与电子发票链接。</text>
					</view>
				</view>
				<view class="invoice-status-board">
					<view v-for="item in invoiceFlow" :key="item.title">
						<text>{{ item.title }}</text>
						<text>{{ item.desc }}</text>
					</view>
				</view>

				<view v-if="!activeInvoiceOrderId" class="progress-tabs-line invoice-tabs">
					<view v-for="item in invoiceTabs" :key="item" class="progress-tab tap" :class="{ on: item.startsWith(activeInvoiceTab) }" @click="activeInvoiceTab = item.split(' ')[0]">
						<text>{{ item }}</text>
					</view>
				</view>

				<view v-if="activeInvoiceOrderId" class="invoice-apply">
					<view class="invoice-form-head">
						<view>
							<text>申请开票</text>
							<text>工单 {{ activeInvoiceOrder.id }} · {{ activeInvoiceOrder.price }}</text>
						</view>
						<text class="tap" @click="cancelInvoiceApply">更换工单</text>
					</view>
					<view class="repair-form-card invoice-form-card">
						<view class="repair-field select-row">
							<text>发票类型</text>
							<text class="select-value">{{ invoiceForm.invoiceType }}</text>
						</view>
						<view class="invoice-type-row">
							<view v-for="item in invoiceTitleTypes" :key="item.value" class="tap" :class="{ on: invoiceForm.titleType === item.value }" @click="invoiceForm.titleType = item.value">
								<text>{{ item.label }}</text>
								<text>{{ item.desc }}</text>
							</view>
						</view>
						<view class="repair-field">
							<text><text class="required-star">*</text>发票抬头</text>
							<input v-model="invoiceForm.title" placeholder="请输入发票抬头" placeholder-class="input-placeholder" />
						</view>
						<view v-if="invoiceForm.titleType === 'company'" class="repair-field">
							<text><text class="required-star">*</text>税号</text>
							<input v-model="invoiceForm.taxNo" placeholder="请输入纳税人识别号" placeholder-class="input-placeholder" />
						</view>
						<view class="repair-field">
							<text><text class="required-star">*</text>接收邮箱</text>
							<input v-model="invoiceForm.email" placeholder="用于接收电子发票" placeholder-class="input-placeholder" />
						</view>
						<view class="repair-field last">
							<text>备注</text>
							<input v-model="invoiceForm.remark" placeholder="选填，如开票特殊说明" placeholder-class="input-placeholder" />
						</view>
					</view>
					<view class="invoice-tip">
						<text>当前版本支持电子普通发票。若需要专用发票或纸质票，请提交后联系客服协助处理。</text>
					</view>
					<view class="primary-button tap save-button" :class="{ disabled: invoiceSubmitting }" @click="submitInvoiceApply">{{ invoiceSubmitting ? '提交中...' : '确认提交' }}</view>
				</view>

				<view v-else-if="activeInvoiceTab === '待开票'" class="invoice-list">
					<view class="invoice-flow-card">
						<view v-for="(item, index) in invoiceFlow" :key="item.title" class="invoice-flow-step">
							<view>{{ index + 1 }}</view>
							<text>{{ item.title }}</text>
						</view>
					</view>
					<view v-for="order in invoiceTodoOrders" :key="order.id" class="invoice-order-card">
						<view class="invoice-order-head">
							<view>
								<text class="muted-line">工单 {{ order.id }}</text>
								<text>{{ order.model }}</text>
							</view>
							<text :class="['tag', 'tag-' + getInvoiceMeta(order).tone]">{{ getInvoiceMeta(order).label }}</text>
						</view>
					<view class="invoice-order-meta">
							<view><text>维修金额</text><text>{{ order.price }}</text></view>
							<view><text>报修日期</text><text>{{ order.date }}</text></view>
							<view><text>开票阶段</text><text>{{ getInvoiceMeta(order).stage }}</text></view>
							<view><text>电子链接</text><text>{{ order.invoiceUrl ? '已生成' : '待开具' }}</text></view>
						</view>
						<view class="invoice-order-actions">
							<view class="ghost-button tap" @click="openOrderDetail(order)">查看工单</view>
							<view class="primary-button tap" :class="{ disabled: getInvoiceStatusKey(order) !== 'available' }" @click="startInvoiceApply(order)">
								{{ getInvoiceStatusKey(order) === 'available' ? '申请开票' : getInvoiceMeta(order).label }}
							</view>
						</view>
					</view>
					<view v-if="!invoiceTodoOrders.length" class="empty-hint compact">暂无可申请开票的订单。</view>
				</view>

				<view v-else class="invoice-list">
					<view v-for="order in invoiceIssuedOrders" :key="order.id" class="invoice-issued-card">
						<view class="invoice-issued-ribbon">电子发票</view>
						<view class="invoice-issued-head">
							<view>
								<text>{{ order.invoiceTitle || '发票抬头待同步' }}</text>
								<text>工单 {{ order.id }}</text>
							</view>
							<text>{{ order.price }}</text>
						</view>
						<view class="invoice-issued-info">
							<view><text>发票号码</text><text>{{ order.invoiceNo || '待同步' }}</text></view>
							<view><text>开票日期</text><text>{{ order.invoiceDate || '待同步' }}</text></view>
							<view><text>开票状态</text><text>{{ getInvoiceMeta(order).stage }}</text></view>
							<view><text>电子链接</text><text>{{ order.invoiceUrl ? '已生成' : '待同步' }}</text></view>
						</view>
						<view class="invoice-order-actions">
							<view class="ghost-button tap" @click="openOrderDetail(order)">查看工单</view>
							<view class="primary-button tap" @click="copyInvoiceLink(order)">复制发票链接</view>
						</view>
					</view>
					<view v-if="!invoiceIssuedOrders.length" class="empty-hint compact">暂无已开具的电子发票。</view>
				</view>
			</view>

			<view v-else-if="activeModule === 'order-detail'" class="module-content">
				<view class="detail-hero">
					<view class="detail-hero-top">
						<text>工单号</text>
						<text :class="['tag', 'tag-muted-light']">{{ detailOrder.status }}</text>
					</view>
					<text class="detail-order-no">{{ detailOrder.id }}</text>
					<view class="detail-hero-grid">
						<view><text>产品</text><text>{{ detailOrder.model }}</text></view>
						<view><text>预计完成</text><text>{{ detailOrder.doneTime }}</text></view>
					</view>
				</view>
				<view class="module-section-head single"><text>进度时间线</text></view>
				<view class="progress-node-card">
					<view v-for="(node, index) in repairProgressNodes" :key="node.label" class="progress-node-row" :class="node.state">
						<view class="progress-node-pin">
							<view class="progress-node-dot"></view>
							<view v-if="index < repairProgressNodes.length - 1" class="progress-node-line"></view>
						</view>
						<view class="progress-node-copy">
							<text class="progress-node-label">{{ node.label }}</text>
							<text v-if="node.state === 'current'" class="progress-node-now">进行中</text>
						</view>
					</view>
				</view>
				<view v-if="detailOrder.timeline && detailOrder.timeline.length" class="module-section-head single"><text>处理记录</text></view>
				<view v-if="detailOrder.timeline && detailOrder.timeline.length" class="timeline-card">
					<view v-for="(item, index) in detailTimeline" :key="item.title + index" class="detail-timeline-row">
						<view class="detail-timeline-pin" :class="{ pending: item.pending }">
							<view></view>
							<view v-if="index < detailTimeline.length - 1"></view>
						</view>
						<view class="detail-timeline-copy">
							<view>
								<text :class="{ muted: item.pending }">{{ item.title }}</text>
								<text>{{ item.time }}</text>
							</view>
							<text>{{ item.desc }}</text>
						</view>
					</view>
				</view>
				<view class="module-section-head single"><text>维修报价</text></view>
				<view class="billing-card quote-sheet-card">
					<view class="billing-head">
						<view>
							<text>维修报价单</text>
							<text>{{ getBillingMeta(detailOrder).desc }}</text>
						</view>
						<text :class="['tag', 'tag-' + getBillingMeta(detailOrder).tone]">{{ getBillingMeta(detailOrder).label }}</text>
					</view>
					<view v-if="detailQuoteGroups.length" class="quote-line-list quote-group-list">
						<view v-for="group in detailQuoteGroups" :key="group.key" class="quote-group">
							<view class="quote-group-head">
								<text>{{ group.title }}</text>
								<text>{{ formatMoney(group.total) }}</text>
							</view>
							<view v-for="(item, index) in group.items" :key="group.key + item.name + index" class="quote-line-item">
								<view class="quote-line-copy">
									<text>{{ item.name || `费用项目 ${index + 1}` }}</text>
									<text v-if="item.desc">{{ item.desc }}</text>
									<view class="quote-line-fees">
										<text v-if="item.unitPrice">单价 {{ formatMoney(item.unitPrice) }}</text>
										<text v-if="item.quantity">数量 {{ item.quantity }}</text>
									</view>
								</view>
								<text class="quote-line-price">{{ formatMoney(getQuoteDetailRowTotal(item)) }}</text>
							</view>
						</view>
					</view>
					<view v-else-if="detailQuoteItems.length" class="quote-line-list">
						<view v-for="(item, index) in detailQuoteItems" :key="item.name + index" class="quote-line-item">
							<view class="quote-line-copy">
								<text>{{ item.name || `维修项目 ${index + 1}` }}</text>
								<text v-if="item.desc">{{ item.desc }}</text>
								<view class="quote-line-fees">
									<text v-if="item.partsFee">配件 {{ formatMoney(item.partsFee) }}</text>
									<text v-if="item.laborFee">工时 {{ formatMoney(item.laborFee) }}</text>
								</view>
							</view>
							<text class="quote-line-price">{{ formatMoney(getQuoteItemTotal(item)) }}</text>
						</view>
					</view>
					<view v-else-if="getQuoteTotal(detailOrder)" class="billing-empty">
						<text>维修费用已由后台确认，合计 {{ getBillingAmountText(detailOrder) }}。如需费用明细可联系售后客服。</text>
					</view>
					<view v-else class="billing-empty">
						<text>工程师检测完成后，这里会显示维修项目、费用明细和下一步操作。</text>
					</view>
					<view class="quote-total-box">
						<text>合计应付</text>
						<text>{{ getBillingAmountText(detailOrder) }}</text>
						<text>{{ getPaymentMeta(detailOrder).desc }}</text>
					</view>
					<view v-if="detailQuoteVisible" class="quote-bill-info">
						<view class="quote-bill-row">
							<view class="quote-bill-dot warranty"></view>
							<text>{{ detailWarrantyText }}</text>
						</view>
						<view v-if="detailPaymentDeadlineText" class="quote-bill-row">
							<view class="quote-bill-dot deadline"></view>
							<text>请在 {{ detailPaymentDeadlineText }} 前完成付款，逾期报价可能失效</text>
						</view>
						<view class="quote-bill-row">
							<view class="quote-bill-dot policy"></view>
							<text>如对报价有疑问，可先联系客服沟通；若最终拒绝维修，设备将按原寄回地址退回（可能产生回寄运费）。</text>
						</view>
					</view>
					<view v-if="detailPaymentProofs.length" class="payment-proof-grid billing-proof-grid">
						<view v-for="(proof, index) in detailPaymentProofs" :key="proof.id || proof.url || index" class="payment-proof-thumb tap" @click="previewPaymentProof(index)">
							<image class="payment-proof-image" :src="proof.url || proof.path" mode="aspectFill"></image>
							<text>{{ proof.time || '已上传' }}</text>
						</view>
					</view>
					<view class="quote-action-stack">
						<view v-if="getBillingAction(detailOrder).visible" class="primary-button tap detail-action-button" :class="{ disabled: getBillingAction(detailOrder).disabled }" @click="handleBillingAction(detailOrder)">
							{{ getBillingAction(detailOrder).text }}
						</view>
						<view v-if="getPaymentProofAction(detailOrder).visible" class="quote-secondary-action tap" :class="{ disabled: getPaymentProofAction(detailOrder).disabled }" @click="handlePaymentProofAction(detailOrder)">
							{{ getPaymentProofAction(detailOrder).text }}
						</view>
						<text v-else-if="getPaymentProofAction(detailOrder).hint" class="quote-secondary-hint">{{ getPaymentProofAction(detailOrder).hint }}</text>
						<view v-if="detailQuoteVisible && detailOrder.paymentStatus !== 'paid'" class="quote-contact-action tap" @click="contactSupportForQuote">
							<text>有疑问？联系客服</text>
						</view>
					</view>
				</view>

				<!-- 回寄物流 -->
				<view v-if="detailOrder.returnLogisticsNo" class="module-section-head single"><text>回寄物流</text></view>
				<view v-if="detailOrder.returnLogisticsNo" class="return-logistics-card">
					<view class="return-logistics-info">
						<view><text>物流公司</text><text>{{ detailOrder.returnLogisticsCompany || '待录入' }}</text></view>
						<view><text>回寄单号</text><text class="return-logistics-no">{{ detailOrder.returnLogisticsNo }}</text></view>
					</view>
					<view class="return-logistics-actions">
						<view class="return-logistics-btn tap" @click="copyOne(detailOrder.returnLogisticsNo, 'returnNo')">{{ copied === 'returnNo' ? '已复制' : '复制单号' }}</view>
						<view class="return-logistics-btn primary tap" @click="trackReturnLogistics(detailOrder)">查物流</view>
					</view>
				</view>

				<!-- 完成后引导：评价 / 保养 / 再次报修 -->
				<view v-if="detailIsCompleted" class="complete-guide-card">
					<view class="complete-guide-title">
						<text class="complete-guide-emoji">🎉</text>
						<text>维修已完成，感谢您的信任</text>
					</view>
					<text class="complete-guide-tip">建议定期保养设备以延长使用寿命；遇到新问题可随时再次报修。</text>
					<view class="complete-guide-actions">
						<view class="complete-guide-btn tap" @click="evaluateOrder(detailOrder)">
							<text class="complete-guide-ico">★</text>
							<text>去评价</text>
						</view>
						<view class="complete-guide-btn tap" @click="showMaintenanceTip">
							<text class="complete-guide-ico">🛠</text>
							<text>保养提醒</text>
						</view>
						<view class="complete-guide-btn tap" @click="reRepair(detailOrder)">
							<text class="complete-guide-ico">↻</text>
							<text>再次报修</text>
						</view>
					</view>
				</view>
			</view>

			<view v-else-if="activeModule === 'survey'" class="survey-module">
				<view class="survey-mask"></view>
				<view class="survey-modal-card survey-poster-card">
					<view class="survey-close tap" @click="closeModule">×</view>
					<view class="survey-ribbon"><view class="glyph glyph-gift"><view class="glyph-extra"></view></view><text>调研有礼</text></view>
					<view class="survey-poster-wrap tap" @click="previewSurveyPoster">
						<image
							class="survey-poster"
							:src="surveyPosterUrl"
							mode="widthFix"
							show-menu-by-longpress
						></image>
					</view>
					<text class="survey-poster-tip">点击图片放大查看，长按可保存或识别二维码</text>
					<view class="survey-actions">
						<view class="survey-secondary tap" @click="closeModule">退出</view>
					</view>
				</view>
			</view>

			<view v-else-if="activeModule === 'diag'" class="module-content diag-module">
				<view class="diag-hero-card">
					<view class="diag-icon"><view class="glyph glyph-diag"><view class="glyph-extra"></view></view></view>
					<view>
						<text>2 步快速定位故障</text>
						<text>选择产品类型与故障类型，即查看排查建议</text>
					</view>
				</view>
				<view class="module-section-head single"><text>请选择</text></view>
				<view class="select-card">
					<view class="select-row tap" @click="diagOpen = 'product'">
						<text><text class="required-star">*</text>产品类型</text>
						<text :class="{ placeholder: !diagProductLabel }">{{ diagProductLabel || '请选择产品类型' }}</text>
						<view class="field-arrow"></view>
					</view>
					<view class="select-row tap" :class="{ disabled: !diagProduct }" @click="openFaultSheet">
						<text><text class="required-star">*</text>故障类型</text>
						<text :class="{ placeholder: !diagFault }">{{ diagFault || diagFaultPlaceholder }}</text>
						<view class="field-arrow"></view>
					</view>
				</view>
				<view v-if="diagConfirmVisible" class="diag-result">
					<view class="module-section-head single"><text>排查确认信息</text></view>
					<view v-for="section in diagConfirmSections" :key="section.title" class="diag-check-card">
						<view class="diag-check-head"><view :style="{ backgroundColor: section.color }"></view><text>{{ section.title }}</text></view>
						<view v-for="(item, index) in section.items" :key="item" class="diag-check-row">
							<text>{{ section.numbered ? index + 1 : '·' }}</text>
							<text>{{ item }}</text>
						</view>
					</view>
					<view class="dual-actions">
						<view class="ghost-button tap" @click="resetDiag">重新选择</view>
						<view class="primary-button tap" @click="go('repair')">仍未解决 · 立即报修</view>
					</view>
				</view>
				<view v-else class="empty-hint">{{ diagEmptyText }}</view>
				<view v-if="diagOpen" class="sheet-mask" @click="diagOpen = ''"></view>
				<view v-if="diagOpen" class="choice-sheet">
					<view class="choice-head">
						<text class="tap" @click="diagOpen = ''">取消</text>
						<text>{{ diagOpen === 'product' ? '选择产品类型' : '选择故障类型' }}</text>
						<text></text>
					</view>
					<scroll-view class="choice-scroll" scroll-y>
						<view v-for="item in diagSheetOptions" :key="item.id" class="choice-row tap" @click="selectDiagOption(item)">
							<text>{{ item.title }}</text>
							<view v-if="item.active" class="mini-icon mini-check"></view>
						</view>
					</scroll-view>
				</view>
			</view>

			<view v-else-if="activeModule === 'warranty'" class="module-content warranty-module">
				<view class="warranty-hero">
					<view class="glyph glyph-shield"><view class="glyph-extra"></view></view>
					<text>{{ warrantyDoc.title || '三重保修承诺' }}</text>
					<text>{{ warrantyDoc.lead || '原厂配件 · 工艺质保 · 终身咨询' }}</text>
				</view>
				<view v-if="warrantyDoc.content" class="doc-paper">
					<rich-text :nodes="warrantyDoc.content"></rich-text>
				</view>
				<view class="module-section-head single"><text>保修期限</text></view>
				<view class="white-list-card">
					<view v-for="item in warrantyDurations" :key="item.name" class="list-row">
						<text>{{ item.name }}</text>
						<text>{{ item.duration }}</text>
					</view>
				</view>
				<template v-if="warrantyGroups.length">
						<view class="module-section-head single"><text>按机型保修</text></view>
						<view v-for="group in warrantyGroups" :key="group.category" class="warranty-group">
							<view class="warranty-group-title">{{ group.category }}</view>
							<view class="white-list-card">
								<view v-for="(rule, idx) in group.items" :key="idx" class="warranty-rule-row">
									<view class="warranty-rule-head">
										<text class="warranty-rule-model">{{ rule.model || group.category }}</text>
										<text class="warranty-rule-period">{{ rule.warrantyPeriod }}</text>
									</view>
									<text v-if="rule.terms" class="warranty-rule-terms">{{ rule.terms }}</text>
								</view>
							</view>
						</view>
					</template>
					<view class="module-section-head single"><text>保修范围</text></view>
				<view class="text-card">
					<view v-for="(item, index) in warrantyRanges" :key="item" class="number-line">
						<text>{{ index + 1 }}</text>
						<text>{{ item }}</text>
					</view>
				</view>
				<view class="module-section-head single"><text>增值服务</text></view>
				<view class="white-list-card">
					<view v-for="item in warrantyServices" :key="item.title" class="service-line">
						<view class="service-line-icon"><view :class="['glyph', 'glyph-' + item.icon]"><view class="glyph-extra"></view></view></view>
						<view><text>{{ item.title }}</text><text>{{ item.desc }}</text></view>
					</view>
				</view>
				<template v-if="extendedWarranty.desc || extendedWarranty.fee || extendedWarranty.rules">
						<view class="module-section-head single"><text>延保政策</text></view>
						<view class="text-card warranty-extended">
							<view v-if="extendedWarranty.desc" class="ext-block"><text class="ext-label">服务说明</text><text class="ext-text">{{ extendedWarranty.desc }}</text></view>
							<view v-if="extendedWarranty.fee" class="ext-block"><text class="ext-label">收费标准</text><text class="ext-text">{{ extendedWarranty.fee }}</text></view>
							<view v-if="extendedWarranty.rules" class="ext-block"><text class="ext-label">生效规则</text><text class="ext-text">{{ extendedWarranty.rules }}</text></view>
						</view>
					</template>
					<view v-if="!warrantyDoc.content" class="doc-paper warranty-paper">
					<text class="paper-title">保修政策</text>
					<view v-for="section in warrantyTerms" :key="section.title" class="paper-section">
						<text class="paper-section-title">{{ section.title }}</text>
						<view v-for="(line, index) in section.lines" :key="line" class="paper-line">
							<text>{{ index + 1 }})</text>
							<text>{{ line }}</text>
						</view>
					</view>
				</view>
			</view>

			<view v-else-if="isDocModule" class="module-content">
				<view v-if="activeModule === 'fees'" class="doc-hero fees-hero">
					<view class="glyph glyph-money"><view class="glyph-extra"></view></view>
					<text>收费公开透明</text>
					<text>免费检测 · 先报后修 · 无隐形消费</text>
				</view>
				<view v-else class="doc-hero">
					<view :class="['glyph', 'glyph-' + activeDoc.icon]"><view class="glyph-extra"></view></view>
					<view><text>{{ activeDoc.title }}</text><text>{{ activeDoc.lead }}</text></view>
				</view>
				<view v-if="activeModule === 'fees' && feeTiers.length" class="fee-tier-card">
						<view class="fee-tier-head"><text>收费项</text><text>标准价</text></view>
						<view v-for="(tier, idx) in feeTiers" :key="idx" class="fee-tier-row">
							<view class="fee-tier-name"><text>{{ tier.name }}</text><text v-if="tier.note" class="fee-tier-note">{{ tier.note }}</text></view>
							<text class="fee-tier-price">¥{{ tier.price }}<text v-if="tier.unit" class="fee-tier-unit">/{{ tier.unit }}</text></text>
						</view>
					</view>
					<view v-if="activeDoc.content" class="doc-paper">
					<rich-text :nodes="activeDoc.content"></rich-text>
				</view>
				<view v-else class="doc-paper">
					<text class="paper-title">{{ activeDoc.paperTitle }}</text>
					<view v-for="section in activeDoc.sections" :key="section.title" class="paper-section">
						<text class="paper-section-title">{{ section.title }}</text>
						<view v-for="(line, index) in section.lines" :key="line" class="paper-line">
							<text>{{ section.marker || index + 1 + ')' }}</text>
							<text>{{ line }}</text>
						</view>
					</view>
				</view>
				<view v-if="activeDoc.media && activeDoc.media.length" class="guide-media-list">
						<view v-for="(m, i) in activeDoc.media" :key="i" class="guide-media-item tap" @click="openGuideMedia(m)">
							<text class="guide-media-type">{{ m.type === 'video' ? '▶ 视频' : m.type === 'image' ? '图片' : '文档' }}</text>
							<text class="guide-media-name">{{ m.name }}</text>
							<text class="guide-media-open">打开</text>
						</view>
					</view>
					<view v-if="activeDoc.fileUrl" class="guide-file-card">
					<view>
						<text>后台上传文档</text>
						<text>{{ activeDoc.fileName || '操作教程文档' }}</text>
					</view>
					<view class="small-primary tap" @click="openGuideFile(activeDoc)">打开文档</view>
				</view>
				<view v-if="activeDoc.steps" class="step-card">
					<view v-for="(step, index) in activeDoc.steps" :key="step.title" class="guide-step-row">
						<text>{{ index + 1 }}</text>
						<view><text>{{ step.title }}</text><text>{{ step.desc }}</text></view>
					</view>
				</view>
				<view v-if="activeModule !== 'fees'" class="dual-actions doc-actions">
					<view class="ghost-button tap" @click="go('contact')">联系客服</view>
					<view class="primary-button tap" @click="go('repair')">立即报修</view>
				</view>
			</view>

			<view v-else-if="activeModule === 'contact'" class="module-content contact-module">
				<view class="online-card">
					<view class="online-icon"><view class="glyph glyph-chat"><view class="glyph-extra"></view></view></view>
					<view class="online-copy">
						<text>{{ customerService.title || '在线客服' }}</text>
						<text>{{ customerService.description || '7×24 小时 · 即时响应' }}</text>
					</view>
					<view class="soft-button">立即咨询</view>
				</view>
				<view class="module-section-head single"><text>服务热线</text></view>
				<view class="hotline-grid">
					<view v-for="item in contactHotlines" :key="item.title" class="hotline-card">
						<view><view class="glyph glyph-phone"><view class="glyph-extra"></view></view><text>{{ item.title }}</text></view>
						<text>{{ item.number }}</text>
						<text>{{ item.time }}</text>
						<view class="small-primary">一键拨号</view>
					</view>
				</view>
				<view class="module-section-head single"><text>收件地址</text></view>
				<view class="address-card">
					<view class="glyph glyph-pin"><view class="glyph-extra"></view></view>
					<view class="address-copy">
						<text>{{ contactInfo.companyName }}</text>
						<text v-for="item in receiver" :key="item.label">{{ item.label }} · {{ item.value }}</text>
					</view>
				</view>
				<view class="address-actions">
					<view class="ghost-button tap" @click="copyAll">复制地址</view>
					<view class="primary-button tap">查看地图</view>
				</view>
				<view class="module-section-head single"><text>工作时间</text></view>
				<view class="white-list-card">
					<view v-for="item in workTimes" :key="item.day" class="list-row">
						<text>{{ item.day }}</text>
						<text>{{ item.time }}</text>
					</view>
				</view>
			</view>

			<view v-else-if="activeModule === 'orders'" class="orders-module">
				<scroll-view class="progress-tabs-line orders-tabs orders-tabs-classic" scroll-x show-scrollbar="false" enhanced>
					<view v-for="item in orderTabs" :key="item.key" class="progress-tab orders-tab-item tap" :class="{ on: item.key === activeOrdersTab }" @click="activeOrdersTab = item.key">
						<text>{{ item.label }}</text>
						<text class="orders-tab-count">{{ item.count }}</text>
					</view>
				</scroll-view>
				<view class="module-content orders-content-classic">
					<view v-for="order in filteredOrderList" :key="order.id" class="order-card-mini order-card-classic tap" @click="openOrderDetail(order)">
						<view class="order-card-main">
							<text class="muted-line">工单 {{ order.id }}</text>
							<text class="order-card-title">{{ order.cardTitle }}</text>
							<text v-if="order.faultDesc" class="order-card-fault">{{ order.faultDesc }}</text>
							<view v-if="order.cardMeta && order.cardMeta.length" class="order-card-meta">
								<text v-for="meta in order.cardMeta" :key="meta">{{ meta }}</text>
							</view>
							<text class="order-card-date">报修日期 · {{ order.date }}</text>
						</view>
						<view class="order-card-side">
							<text :class="['tag', 'tag-' + getOrderStatusTone(order)]">{{ order.status }}</text>
							<text class="order-card-price">{{ formatOrderListPrice(order) }}</text>
						</view>
					</view>
					<view v-if="!filteredOrderList.length" class="empty-hint compact">当前筛选条件下没有订单。</view>
				</view>
			</view>

			<view v-else-if="activeModule === 'products'" class="module-content products-module">
				<view v-for="item in productList" :key="item.sn" class="product-card">
					<view class="product-icon"><view class="glyph glyph-tooth"><view class="glyph-extra"></view></view></view>
					<view class="product-copy">
						<text>{{ item.title }}</text>
						<text>SN · {{ item.sn }}</text>
						<text>{{ item.date }}</text>
						<text :class="['tag', item.expired ? 'tag-muted' : 'tag-ok']">{{ item.warranty }}</text>
					</view>
					<view class="ghost-mini tap" @click="go('repair')">报修</view>
				</view>
				<view v-if="!productList.length" class="empty-hint compact">暂无已登记设备。后端产品接口接入后会显示真实设备与保修状态。</view>
				<view class="dash-add tap"><text>+</text><text>添加我的产品</text></view>
			</view>

			<view v-else-if="activeModule === 'address'" class="module-content address-module">
				<view class="address-header">
					<view class="address-back tap" @click="closeModule">
						<view class="back-arrow"></view>
					</view>
					<view class="address-title">{{ addressForm.addressId ? '编辑收货地址' : '新增收货地址' }}</view>
					<view class="address-placeholder"></view>
				</view>

				<view class="address-form">
					<view class="address-field">
						<text class="field-label"><text class="required-star">*</text>收货人</text>
						<input v-model="addressForm.name" class="field-input" placeholder="请输入收货人姓名" placeholder-class="input-placeholder" />
					</view>

					<view class="address-field">
						<text class="field-label"><text class="required-star">*</text>手机号码</text>
						<input v-model="addressForm.phone" class="field-input" placeholder="请输入联系电话" placeholder-class="input-placeholder" type="number" />
					</view>

					<view class="address-field tap" @click="selectRegion">
						<text class="field-label"><text class="required-star">*</text>所在地区</text>
						<input v-model="addressForm.region" class="field-input" placeholder="请选择省 / 市 / 区" placeholder-class="input-placeholder" disabled />
						<view class="field-arrow"></view>
					</view>

					<view class="address-field">
						<text class="field-label"><text class="required-star">*</text>详细地址</text>
						<input v-model="addressForm.detail" class="field-input" placeholder="街道、楼牌号等" placeholder-class="input-placeholder" />
					</view>

					<view class="address-field">
						<text class="field-label">单位名称</text>
						<input v-model="addressForm.unit" class="field-input" placeholder="诊所 / 医院 名称（选填）" placeholder-class="input-placeholder" />
					</view>
				</view>

				<view class="address-switch">
					<view class="switch-left">
						<text class="switch-title">设为默认地址</text>
					</view>
					<view class="switch-btn tap" :class="{ on: addressForm.def }" @click="addressForm.def = !addressForm.def">
						<view></view>
					</view>
				</view>

				<view class="address-actions">
					<view v-if="addressForm.addressId" class="address-btn address-btn-secondary tap" @click="handleDeleteAddress">删除地址</view>
					<view class="address-btn address-btn-primary tap" @click="saveAddress">保存地址</view>
				</view>
			</view>

			<view v-else-if="activeModule === 'feedback'" class="module-content feedback-module">
				<view class="segment">
					<view v-for="item in feedbackTypes" :key="item" class="tap" :class="{ on: feedbackType === item }" @click="feedbackType = item">{{ item }}</view>
				</view>
				<text class="feedback-tip">{{ feedbackType === '投诉' ? '收到投诉后，主管会在 24 小时内主动联系您' : '欢迎提出您宝贵的建议，采纳后可获赠小礼品' }}</text>
				<view class="feedback-card">
					<view class="feedback-area">
						<text><text class="required-star">*</text>详细描述</text>
						<textarea v-model="feedbackText" maxlength="500" :placeholder="feedbackType === '投诉' ? '请描述问题发生的时间、经过以及您的诉求……' : '请描述您的建议与期望，我们会认真评估……'" placeholder-class="input-placeholder"></textarea>
						<view><text>可附 {{ feedbackImages.length }}/{{ maxFeedbackImages }} 张图片</text><text>{{ feedbackText.length }}/500</text></view>
					</view>
					<view class="feedback-images">
						<view class="media-grid feedback-media-grid">
							<view v-for="(image, index) in feedbackImages" :key="image.id" class="media-thumb tap" @click="previewFeedbackImage(index)">
								<image class="media-image" :src="getPreviewUrl(image)" mode="aspectFill"></image>
								<view class="media-remove tap" @click.stop="removeFeedbackImage(image.id)">×</view>
							</view>
							<view v-if="feedbackImages.length < maxFeedbackImages" class="media-add tap" :class="{ disabled: feedbackImageUploading || feedbackSubmitting }" @click="chooseFeedbackImages">
								<text>+</text>
								<text>{{ feedbackImageUploading ? '上传中' : '添加' }}</text>
							</view>
						</view>
					</view>
					<view class="feedback-contact">
						<text><text class="required-star">*</text>联系方式</text>
						<view class="contact-kind-row">
							<view v-for="item in feedbackContacts" :key="item.id" class="tap" :class="{ on: feedbackContactKind === item.id }" @click="feedbackContactKind = item.id">{{ item.title }}</view>
						</view>
						<view class="contact-input-row">
							<text>{{ feedbackContact.label }}</text>
							<input v-model="feedbackContactValue" :placeholder="feedbackContact.placeholder" placeholder-class="input-placeholder" />
						</view>
					</view>
				</view>
				<view class="simple-card">
					<text>关联工单</text>
					<text>选填 · 填写后便于我们快速定位问题</text>
					<input v-model="feedbackOrderId" placeholder="如 DR-20260508-1147" placeholder-class="input-placeholder" />
				</view>
				<view class="primary-button tap save-button" :class="{ disabled: feedbackSubmitting }" @click="submitFeedback">{{ feedbackSubmitting ? '提交中...' : '提交' + feedbackType }}</view>
				<text class="submit-note">提交后预计 1 至 3 个工作日内反馈结果</text>
				<view class="feedback-history">
					<view class="module-section-head single"><text>我的反馈单</text></view>
					<view v-if="feedbackRecords.length">
						<view v-for="record in feedbackRecords" :key="record.ticketNo" class="feedback-ticket-card">
							<view class="feedback-ticket-head">
								<view>
									<text>{{ record.ticketNo }}</text>
									<text>{{ record.type }} · {{ record.time }}</text>
								</view>
								<text :class="['tag', 'tag-' + getFeedbackMeta(record).tone]">{{ getFeedbackMeta(record).label }}</text>
							</view>
							<view class="feedback-ticket-meta">
								<view><text>关联工单</text><text>{{ record.orderId || '未关联' }}</text></view>
								<view><text>联系方式</text><text>{{ record.contact }}</text></view>
							</view>
							<text class="feedback-ticket-content">{{ record.content }}</text>
							<view v-if="record.images && record.images.length" class="feedback-ticket-images">
								<image v-for="(image, index) in record.images" :key="image.id || image.url || image || index" :src="image.url || image" mode="aspectFill" class="feedback-ticket-image tap" @click="previewFeedbackRecordImage(record, index)"></image>
							</view>
							<view class="feedback-reply">
								<text>客服回复</text>
								<text>{{ record.reply || '已收到反馈，客服处理后会在这里同步回复。' }}</text>
							</view>
						</view>
					</view>
					<view v-else class="empty-hint compact">提交后会自动生成反馈单号，并在这里展示处理状态与客服回复。</view>
				</view>
			</view>

			<view v-else-if="activeModule === 'login'" class="module-content login-module">
				<view class="login-logo"><view class="glyph glyph-tooth"><view class="glyph-extra"></view></view></view>
				<text class="login-title">欢迎使用</text>
				<text class="login-desc">专业牙科仪器 · 全程检修服务</text>
				<button class="wechat-login tap" open-type="getPhoneNumber" @getphonenumber="onGetPhoneNumberLogin">微信手机号授权登录</button>
				<view class="phone-login" @click="onDevLogin">开发测试登录</view>
				<text class="login-agree">授权登录即视为您同意《用户服务协议》及《隐私政策》</text>
			</view>
		</view>

		<view v-else-if="pageBootReady" class="page-scroll">
			<view v-if="activeTab === 'home'" class="home-body">
				<view class="brand-bar">
					<view class="brand-left">
						<text class="home-brand-subtitle">思科达服务</text>
					</view>
				</view>

				<view class="search-wrap">
					<view class="search-box">
						<view class="glyph glyph-search glyph-search-small">
							<view class="glyph-extra"></view>
						</view>
						<input
							v-model="searchKeyword"
							class="search-input"
							placeholder="请输入常见问题"
							placeholder-class="input-placeholder"
							confirm-type="search"
							@confirm="handleSearch"
						/>
						<text class="search-action tap" @click="handleSearch">搜索</text>
					</view>
				</view>

				<view class="new-brand-banner" style="margin: 12px; overflow: hidden; border-radius: 8px; position: relative; z-index: 10;"> 
					<image src="/static/logo-banner.jpg" mode="widthFix" style="width: 100%; display: block;"></image> 
				</view>

				<view class="section section-basic">
					<text class="section-title">基础服务</text>
					<view class="three-grid">
						<view
							v-for="item in basics"
							:key="item.id"
							class="service-card tap"
							@click="go(item.id)"
						>
							<view class="service-icon" :style="{ backgroundColor: item.bg, color: item.color }">
								<view :class="['glyph', 'glyph-' + item.icon]">
									<view class="glyph-extra"></view>
								</view>
							</view>
							<text class="service-title">{{ item.title }}</text>
						</view>
					</view>
				</view>

				<view class="section section-query">
					<text class="section-title">自助查询</text>
					<view class="query-grid">
						<view
							v-for="item in queries"
							:key="item.id"
							class="service-card tap"
							@click="go(item.id)"
						>
							<view class="service-icon" :style="{ backgroundColor: item.bg, color: item.color }">
								<view :class="['glyph', 'glyph-' + item.icon]">
									<view class="glyph-extra"></view>
								</view>
							</view>
							<text class="service-title">{{ item.title }}</text>
						</view>
					</view>
				</view>

				<view class="section section-guide">
					<view class="section-line">
						<text class="section-title">操作教程</text>
						<text class="section-meta">图文文档</text>
					</view>
					<view class="two-grid">
						<view
							v-for="item in guides"
							:key="item.id"
							class="guide-card tap"
							@click="go(item.id)"
						>
							<view class="guide-icon">
								<view :class="['glyph', 'glyph-' + item.icon, 'glyph-guide']">
									<view class="glyph-extra"></view>
								</view>
							</view>
							<text class="guide-title">{{ item.title }}</text>
							<view class="chevron"></view>
						</view>
					</view>
				</view>

				<view class="section section-contact">
					<text class="section-title">联系我们</text>
					<view class="two-grid">
						<button class="contact-card tap" open-type="contact" @click="openCustomerService">
							<view class="contact-icon">
								<view class="glyph glyph-chat">
									<view class="glyph-extra"></view>
								</view>
							</view>
							<view class="contact-copy">
								<text class="contact-title">在线客服</text>
								<text class="contact-desc">8:00至21:00</text>
							</view>
						</button>
						<view class="contact-card tap" @click="makePhoneCall">
							<view class="contact-icon">
								<view class="glyph glyph-phone">
									<view class="glyph-extra"></view>
								</view>
							</view>
							<view class="contact-copy">
								<text class="contact-title">服务热线</text>
								<text class="contact-desc">13929198537</text>
							</view>
						</view>
					</view>
				</view>

				<view class="receiver-wrap">
					<view class="receiver-card">
						<view class="receiver-head">
							<view class="glyph glyph-pin glyph-pin-title">
								<view class="glyph-extra"></view>
							</view>
							<text>收件信息</text>
						</view>
						<view
							v-for="(item, index) in receiver"
							:key="item.label"
							class="receiver-row"
							:class="{ 'receiver-row-last': index === receiverLastIndex }"
						>
							<view class="receiver-line">
								<view class="receiver-text">
									<text class="receiver-label">{{ item.label }}</text>
									<text class="receiver-value">{{ item.value }}</text>
								</view>
								<view class="copy-button tap" @click="copyOne(item.value, item.label)">
									<view v-if="copied === item.label" class="mini-icon mini-check"></view>
									<view v-else class="mini-icon mini-copy"></view>
								</view>
							</view>
						</view>
					</view>
				</view>

				<view class="copy-row">
					<view class="copy-all tap" @click="copyAll">
						<view class="mini-icon mini-check mini-check-white"></view>
						<text>{{ copied === 'all' ? '已复制' : '一键复制以上收件信息' }}</text>
					</view>
					<view class="chat-round tap" @click="go('contact')">
						<view class="glyph glyph-chat">
							<view class="glyph-extra"></view>
						</view>
					</view>
				</view>
			</view>

			<view v-else-if="activeTab === 'company'" class="company-body">
				<view class="company-brand">
					<view class="brand-left">
						<image class="brand-logo" :src="cicadaAssets.logoNew" mode="aspectFit"></image>
					</view>
				</view>

				<view class="company-hero">
					<image class="company-hero-image" :src="cicadaAssets.photoFactory" mode="aspectFill"></image>
					<view class="company-hero-mask"></view>
					<image class="company-hero-logo" :src="cicadaAssets.logoNew" mode="aspectFit"></image>
					<view class="company-hero-title-wrap">
						<text class="company-hero-kicker">CICADA Dental · 登煌医疗</text>
						<text class="company-hero-title">20年专注口腔设备研发制造</text>
						<text class="company-hero-subtitle">从光固化设备起步，持续拓展根管治疗、电动微马达、牙科手机与牙齿美白等专业产品。</text>
					</view>
				</view>

				<view class="company-stats-grid">
					<view v-for="item in companyStats" :key="item.label" class="company-stat-card">
						<text class="company-stat-value">{{ item.value }}</text>
						<text class="company-stat-label">{{ item.label }}</text>
						<text class="company-stat-desc">{{ item.desc }}</text>
					</view>
				</view>

				<view class="company-intro-card">
					<text class="company-intro-label">公司简介</text>
					<text v-for="item in companyIntro" :key="item" class="company-intro-text">{{ item }}</text>
				</view>

				<view class="company-section">
					<view class="rule-title">
						<view></view>
						<text>产品矩阵</text>
					</view>
					<view class="business-list">
						<view v-for="(item, index) in companyProductLines" :key="item.title" class="business-card">
							<view class="business-visual" :style="{ background: item.gradient }">
								<view :class="['device-shape', 'device-' + (index % 3)]"></view>
							</view>
							<view class="business-copy">
								<text class="business-title">{{ item.title }}</text>
								<text class="business-desc">{{ item.desc }}</text>
							</view>
						</view>
					</view>
				</view>

				<view class="company-section">
					<view class="rule-title">
						<view></view>
						<text>研发与质量</text>
					</view>
					<view class="auth-card">
						<view class="auth-head">
							<view class="cert-icon"></view>
							<text>医疗器械质量体系背书</text>
						</view>
						<text class="auth-desc">CICADA 产品已取得 ISO13485、CE、FDA 及国内产品注册等资质，覆盖口腔医疗设备研发、生产与合规交付关键环节。</text>
					</view>
					<view class="adv-grid">
						<view v-for="item in companyAdvantages" :key="item.title" class="adv-card">
							<view :class="['adv-icon', 'adv-' + item.icon]"></view>
							<text class="adv-title">{{ item.title }}</text>
							<text class="adv-desc">{{ item.desc }}</text>
						</view>
					</view>
				</view>

				<view class="company-section">
					<view class="rule-title">
						<view></view>
						<text>服务理念</text>
					</view>
					<view class="company-service-card">
						<text class="company-service-title">Serve Global Dental Specialist</text>
						<text class="company-service-desc">我们服务全球牙科专业人士，不只提供设备，也重视售后支持、客户体验与临床技术交流，帮助诊所提升诊疗效率与设备使用体验。</text>
						<view class="company-service-tags">
							<text v-for="item in companyServiceTags" :key="item">{{ item }}</text>
						</view>
					</view>
				</view>

				<view class="follow-card">
					<view class="qr-image-wrap company-qr">
						<image class="qr-image" :src="wechatInfo.qrcodeUrl" mode="aspectFill" show-menu-by-longpress></image>
					</view>
					<text class="follow-title">了解产品与售后支持</text>
					<text class="follow-desc">长按识别二维码关注官方服务号，获取产品资料、维修保养与售后服务支持。</text>
					<official-account class="official-account-btn"></official-account>
				</view>
			</view>

			<view v-else class="mine-body">
				<view class="mine-hero">
					<view class="profile-row">
						<view class="avatar" :class="{ 'avatar-logged': logged }">
							<text v-if="logged">{{ userAvatarText }}</text>
							<image v-else class="avatar-image" src="/static/default-user-avatar.png" mode="aspectFit"></image>
						</view>
						<view class="profile-copy">
							<text class="profile-name">{{ logged ? userDisplayName : '未登录' }}</text>
							<view v-if="logged" class="profile-meta">
								<text>{{ userDisplayUnit }}</text>
								<text class="member-tag">已登录</text>
								<text class="logout-btn tap" @click="logoutLocal">退出</text>
							</view>
							<view v-else class="profile-meta">
								<text>登录后查看您的维修订单</text>
								<text class="logout-btn tap" @click="go('login')">注册/登录</text>
							</view>
						</view>
					</view>
				</view>

				<view class="order-card">
					<view class="order-head tap" @click="go('orders')">
						<view class="rule-title order-rule">
							<view></view>
							<text>我的维修单</text>
						</view>
						<view class="order-more">
							<text>查看全部</text>
							<view class="chevron"></view>
						</view>
					</view>
					<view class="status-grid">
						<view v-for="item in statusItems" :key="item.id" class="status-item tap" @click="go('orders', item.type)">
							<view class="status-icon" :style="{ color: item.color, backgroundColor: item.bg }">
								<view :class="['glyph', 'glyph-' + item.icon]"><view class="glyph-extra"></view></view>
								<text v-if="item.count" class="badge">{{ item.count }}</text>
							</view>
							<text class="status-text">{{ item.title }}</text>
						</view>
					</view>
				</view>

				<view class="settings-section">
					<view class="rule-title">
						<view></view>
						<text>服务与设置</text>
					</view>
					<view class="settings-card">
						<view v-for="(item, index) in menus" :key="item.title" class="menu-row tap" :class="{ last: index === menus.length - 1 }" @click="go(item.go)">
							<view class="menu-icon">
								<view :class="['glyph', 'glyph-' + item.icon]"><view class="glyph-extra"></view></view>
							</view>
							<view class="menu-copy">
								<text class="menu-title">{{ item.title }}</text>
								<text class="menu-desc">{{ item.desc }}</text>
							</view>
							<view class="chevron"></view>
						</view>
					</view>
				</view>

				<view class="mine-footer">
					<image :src="cicadaAssets.logoNew" mode="aspectFit"></image>
					<text>佛山思科达 · 牙医仪器检修 v1.2.0</text>
				</view>
			</view>
		</view>

		<view v-else class="boot-screen">
			<view class="boot-card">
				<image class="boot-logo" :src="cicadaAssets.logoMark" mode="aspectFit"></image>
				<text class="boot-title">CICADA 维修服务</text>
				<text class="boot-desc">正在为您加载首页、报修与查询功能</text>
			</view>
		</view>

		<view v-if="!activeModule && activeTab === 'home'" class="side-tab tap vi-side-tab" @click="showOfficial = true">
			<view class="vi-side-wordmark">
				<text class="vi-en">CICADA</text><text class="vi-tm">®</text>
			</view>
			<text class="side-text">思科达服务号</text>
		</view>

		<BottomTabbar v-if="showBottomTabbar" :tabs="tabs" :active-id="activeTab" @select="go" />

		<view v-if="showOfficial" class="modal-mask">
			<view class="official-modal" @click.stop>
				<text class="modal-close tap" @click="showOfficial = false">×</text>
				<view class="qr-image-wrap company-qr">
					<image class="qr-image" :src="wechatInfo.qrcodeUrl" mode="aspectFill" show-menu-by-longpress="true"></image>
				</view>
				<text class="follow-title">了解产品与售后支持</text>
				<text class="follow-desc">长按识别二维码关注官方服务号，获取产品资料、维修保养与售后服务支持。</text>
				<official-account class="official-account-btn"></official-account>
			</view>
		</view>

		<view v-if="showQr" class="modal-mask" @click="showQr = false">
			<view class="qr-modal" @click.stop>
				<text class="modal-close tap" @click="showQr = false">×</text>
				<image class="qr-logo" :src="cicadaAssets.logoNew" mode="aspectFit"></image>
				<text class="qr-title">关注官方服务号</text>
				<text class="qr-subtitle">获取最新维修指南 / 售后政策</text>
				<view class="qr-image-wrap">
					<image
						class="qr-image"
						:src="wechatInfo.qrcodeUrl"
						mode="aspectFill"
						show-menu-by-longpress
					></image>
				</view>
				<view class="qr-hint">
					<text>长按图片即可识别二维码或保存图片</text>
				</view>
			</view>
		</view>

		<view v-if="showRepairTools" class="tool-sheet-mask" @click="showRepairTools = false"></view>
		<view v-if="showRepairTools" class="repair-tool-sheet">
			<view class="repair-tool-grabber"></view>
			<view class="repair-tool-head">
				<text>报修工具</text>
				<text>保存进度或重新填写当前报修单</text>
			</view>
			<view class="repair-tool-list">
				<view class="repair-tool-row tap" @click="saveRepairDraft">
					<view class="repair-tool-icon tool-save"><view class="mini-icon mini-check"></view></view>
					<view>
						<text>保存草稿</text>
						<text>把当前填写内容保存在本机，下次继续填写</text>
					</view>
				</view>
				<view class="repair-tool-row tap danger" @click="confirmClearRepair">
					<view class="repair-tool-icon tool-clear">×</view>
					<view>
						<text>清空重填</text>
						<text>清除产品和寄出信息，回寄信息恢复默认值</text>
					</view>
				</view>
			</view>
			<view class="repair-tool-cancel tap" @click="showRepairTools = false">取消</view>
		</view>
		<PrivacyConsent />
		<PolicyDialog v-model:visible="homeGuideVisible" title="操作指引" :content="homeGuideContent" />
	</view>
</template>

<script setup>
import { computed, onMounted, ref } from 'vue'
import { onLoad, onShow, onPullDownRefresh } from '@dcloudio/uni-app'
import BottomTabbar from '@/components/BottomTabbar.vue'
import PrivacyConsent from '@/components/PrivacyConsent.vue'
import PolicyDialog from '@/components/PolicyDialog.vue'
import { cicadaAssets } from '@/config/cicada-assets'
import {
	getContact,
	getCustomerService,
	getFaultTypes,
	getFeePolicy,
	getGuide,
	getSubscriptionConfig,
	getProductList,
	applyInvoice,
	getWechat,
	getWarrantyPolicy,
	getWarrantyExtra,
	getFeeTiers,
	getHomeGuidePopup,
	queryPackageStatus,
	searchFault,
	addAddress,
	updateAddress,
	deleteAddress,
	addComplaint,
	getComplaintList,
	devLogin,
	wechatLogin,
	uploadFeedbackImage,
	uploadImage,
	uploadVideo
} from '@/api/content'
import {
	createRepairWechatPay,
	getRepairDetail,
	getRepairList,
	syncRepairWechatPay,
	uploadRepairPaymentProof,
	submitRepair as submitRepairOrder,
	lookupDeviceBySn
} from '@/api/repair'
import { getInvoiceMeta, getInvoiceStatusKey, invoiceFlow } from './composables/invoiceFlow'
import { getCloudTempFileURL } from '@/utils/cloud.js'
import {
	basics,
	companyAdvantages,
	companyIntro,
	companyProductLines,
	companyServiceTags,
	companyStats,
	defaultReceiver,
	defaultStatusItems,
	guides,
	invoiceTitleTypes,
	logisticsList,
	menus,
	moduleMap,
	packageFlow,
	pendingRepairStatuses,
	progressTabs,
	queries,
	repairFlow,
	repairStatusFlow,
	tabs
} from './composables/moduleConfig'
import {
	feedbackTicketNo,
	formatDateTime,
	formatFileSize,
	formatMoney,
	formatOrderListPrice,
	isFileTooLarge,
	normalizeQuoteDetail,
	normalizeQuoteItems,
	sumQuoteFee,
	todayText,
	toTextLines
} from './composables/orderFormatters'
import { getFeedbackMeta, normalizeFeedbackRecord } from './composables/feedbackUtils'
import { createRepairProduct as defaultRepairProduct, defaultRepairForm } from './composables/repairForm'
import {
	createRepairStatusMeta,
	getOrderStatusTone,
	getRepairProgressNodes,
	invoiceTodoStatusKeys,
	normalizeRepairStatus,
	normalizeStatusTab,
	packageStatusMeta
} from './composables/statusMeta'
import {
	compressForUpload,
	getPreviewUrl,
	getUploadedUrl,
	hasLoginToken,
	isAuthError,
	isPickerCancel,
	normalizeUploadFileId,
	normalizeUploadUrl
} from './composables/uploadUtils'

const bootStart = Date.now()
const logBoot = (stage) => console.log('[index-boot]', stage, Date.now() - bootStart)

const copied = ref('')
const showQr = ref(false)
const showOfficial = ref(false)
const showRepairTools = ref(false)
const surveyPosterUrl = cicadaAssets.surveyPoster
const moduleHeadPaddingTop = ref(72)
const pageBootReady = ref(false)
const searchKeyword = ref('')
const activeTab = ref('home')
const activeModule = ref('')
const previousModule = ref('')
const logged = ref(Boolean(uni.getStorageSync('token')))
const currentUser = ref(uni.getStorageSync('userInfo') || {})
const diagProduct = ref('')
const diagFault = ref('')
const diagOpen = ref('')
const activeTrackTab = ref('全部')
const activeOrdersTab = ref('全部')
const trackSearchKeyword = ref('')
const activeInvoiceTab = ref('待开票')
const activeInvoiceOrderId = ref('')
const trackDetailOrder = ref('')
const orderDetailOrder = ref('')
const packageQueryLoading = ref(false)
const packageQuerySearched = ref(false)
const repairSubmitting = ref(false)
const repairStep = ref(1)
const invoiceSubmitting = ref(false)
const paymentSubmitting = ref(false)
const paymentProofUploading = ref(false)
const subscriptionTemplates = ref(null)
const feedbackSubmitting = ref(false)
const feedbackImageUploading = ref(false)
const feedbackType = ref('建议')
const feedbackContactKind = ref('phone')
const feedbackText = ref('')
const feedbackImages = ref([])

const subscriptionSceneMap = {
	repair_submit: ['repair_submitted', 'order_received', 'quote_issued'],
	track_view: ['quote_issued', 'payment_confirmed', 'order_shipped'],
	quote_confirm: ['payment_confirmed', 'order_shipped', 'order_completed']
}

const loadSubscriptionTemplates = async () => {
	if (Array.isArray(subscriptionTemplates.value)) return subscriptionTemplates.value
	try {
		const config = await getSubscriptionConfig()
		subscriptionTemplates.value = Array.isArray(config.templates) ? config.templates : []
	} catch (error) {
		console.warn('load subscription templates failed:', error)
		subscriptionTemplates.value = []
	}
	return subscriptionTemplates.value
}

const requestStatusSubscription = async (scene) => {
	if (!uni.requestSubscribeMessage) return null
	const sceneKeys = subscriptionSceneMap[scene] || []
	const templates = await loadSubscriptionTemplates()
	const tmplIds = templates
		.filter(item => sceneKeys.includes(item.scene) && item.templateId)
		.map(item => item.templateId)
		.slice(0, 3)
	if (!tmplIds.length) return null
	try {
		return await uni.requestSubscribeMessage({ tmplIds })
	} catch (error) {
		console.warn('request subscribe message failed:', error)
		return null
	}
}
const showLogisticsPicker = ref(false)
const feedbackContactValue = ref('')
const feedbackOrderId = ref('')
const feedbackRecords = ref([])
const packageQuery = ref({
	trackingNo: '',
	phoneLast4: ''
})
const packageQueryResult = ref(null)
const invoiceForm = ref({
	invoiceType: '电子普通发票',
	titleType: 'company',
	title: '',
	taxNo: '',
	email: '',
	remark: ''
})
const addressForm = ref({
	addressId: '',
	name: '',
	phone: '',
	region: '',
	detail: '',
	unit: '',
	def: false
})
const repairDraftKey = 'repairDraft'
const localOrderPatchKey = 'repairOrderLocalPatches'
const feedbackRecordKey = 'feedbackRecords'
const repairForm = ref(defaultRepairForm())
const submittedOrderId = ref('')
const repairProducts = ref([defaultRepairProduct()])
const orderLocalPatches = ref({})

let repairProductSeed = 1
let repairMediaSeed = 1
let feedbackImageSeed = 1

logBoot('base refs ready')

const receiver = ref(defaultReceiver.map((item) => ({ ...item })))

const tabRoutes = {
	home: true,
	company: true,
	mine: true
}

const moduleInfo = computed(() => moduleMap[activeModule.value] || {})
const moduleHeadStyle = computed(() => ({
	paddingTop: `${moduleHeadPaddingTop.value}rpx`
}))
const showBottomTabbar = computed(() => pageBootReady.value && !diagOpen.value && activeModule.value !== 'survey' && activeModule.value !== 'repair')

const trackOrders = ref([])

const orderList = ref([])

const productList = ref([])

const diagProducts = ref([])
const diagFaultMap = ref({})

const faultRecords = ref([])
const diagResult = ref(null)

const defaultDiagConfirmSections = [
	{
		title: '相关问题',
		color: '#1E6FE0',
		numbered: false,
		items: ['后台暂未配置相关问题']
	},
	{
		title: '确认方式',
		color: '#0EA5E9',
		numbered: true,
		items: ['后台暂未配置确认方式']
	},
	{
		title: '处理方式',
		color: '#10B981',
		numbered: true,
		items: ['后台暂未配置处理方式']
	}
]

const warrantyDurations = [
	{ name: '综合治疗椅', duration: '整机 1 年 · 主气路 3 年' },
	{ name: '高速/低速手机', duration: '机芯 6 个月 · 外壳 1 年' },
	{ name: '超声洁牙机', duration: '整机 1 年' },
	{ name: '根管马达', duration: '整机 2 年' },
	{ name: '光固化机', duration: '整机 1 年 · 灯头 6 个月' }
]

const warrantyRanges = [
	'在保修期内，因产品自身材料、工艺或装配缺陷导致的故障，免费维修。',
	'人为损坏（摔砸/进液/拆改）不在保修范围。',
	'已超出保修期的，按照配件成本与工时收费，价格表事先确认。',
	'所有维修配件均为原厂部件，确保品质一致。'
]

const warrantyServices = [
	{ icon: 'truck', title: '全国寄修', desc: '顺丰到付 · 全程可追踪' },
	{ icon: 'phone', title: '1 对 1 工程师', desc: '专属服务 · 售后无忧' },
	{ icon: 'invoice', title: '发票协助', desc: '增值税普通 / 专用发票' }
]

const warrantyTerms = [
	{
		title: '一、保修时间计算方式：',
		lines: [
			'客户提供购买凭证，以凭证上的购买时间计算，凭证无售出单位盖章或填写信息不完整的不予保修。',
			'客户在思科达售后小程序有产品注册，以注册填写的购买凭证时间来计算。',
			'客户在思科达售后小程序有产品注册，以注册填写的购买凭证时间来计算。',
			'如不能提供任何凭证，则以出厂时间加 1 个月来计算。',
			'保修期限以产品说明书中所述为准。'
		]
	},
	{
		title: '二、以下状况不属于保修范围：',
		lines: [
			'未按说明书进行安装、操作和维修。',
			'错误使用配件或使用非公司配件造成损坏。',
			'非正常的化学、电力、电解损坏及摔、碰伤。',
			'过度使用或用于牙科以外的其它科目。',
			'因使用、维护、保管不当造成损坏。',
			'不适当的操作或非制造商认可的人员对手机进行错误的维修。'
		]
	},
	{
		title: '三、不提供售后服务情形',
		lines: [
			'产品序列号被人为故意破坏、假标签、仿制等产品。',
			'在淘宝网、拼多多、微店等平台上购买的「思科达产品」且未授权的商家销售的产品。',
			'针对以上情形，本公司不提供任何技术支持及售后服务。'
		]
	},
	{ title: '四、维修续保', lines: ['所有维修品，同一故障问题，更换同样的零件，非人为因素，续保三个月。'] }
]

logBoot('static blocks ready')

// 按机型保修分组 / 延保政策 / 过保收费阶梯（来自后台配置）
const warrantyGroups = ref([])
const extendedWarranty = ref({ desc: '', fee: '', rules: '' })
const feeTiers = ref([])

// 首页教程弹窗
const homeGuideVisible = ref(false)
const homeGuideContent = ref('')
const HOME_GUIDE_SEEN_KEY = 'home_guide_popup_seen'
const maybeShowHomeGuidePopup = async () => {
	try {
		if (uni.getStorageSync(HOME_GUIDE_SEEN_KEY)) return
		// 隐私同意弹窗优先；未同意时本次不弹教程
		if (!uni.getStorageSync('privacy_consented')) return
		const data = await getHomeGuidePopup()
		if (data.enabled && data.content) {
			homeGuideContent.value = data.content
			homeGuideVisible.value = true
			uni.setStorageSync(HOME_GUIDE_SEEN_KEY, '1')
		}
	} catch (e) {
		// 忽略弹窗加载失败
	}
}

const docModuleIds = ['fees', 'guide-quick', 'guide-repair', 'guide-query', 'guide-invoice']

const docFallbacks = {
	fees: {
		title: '收费指南',
		icon: 'money',
		lead: '价格透明，先报价后维修，全程无隐形消费。',
		paperTitle: '思科达维修收费指南',
		sections: [
			{ title: '一、收费构成', lines: ['配件费：按照思科达原厂配件官方指导价收取。', '工时费：根据维修难度及工程师等级核算，公开透明。', '物流费：保修期内非人为故障往返运费由我司承担（顺丰到付）。'] },
			{ title: '二、核心原则', lines: ['免费检测：所有寄修设备均享免费检测，未维修不收取任何检测费用。', '先报后修：工程师检测后出具正式报价单，经客户在线确认后方动工维修。', '拒绝隐形消费：所有收费项目均在报价单中列明，无额外附加费。'] },
			{ title: '三、质保说明', lines: ['所有维修更换的配件（非人为因素）均享受 90 天的质保续期服务。'], marker: '' }
		]
	},
	'guide-quick': {
		title: '快速指南',
		icon: 'book',
		lead: '5 分钟了解小程序核心功能，让售后流程一目了然。',
		paperTitle: '思科达医疗小程序 — 快速指南',
		sections: [
			{ title: '一、故障自查', marker: 'a)', lines: ['点击首页「故障自查」或在导航栏选择「操作指南」。', '选择产品类型，按照指引进行故障排查，即可获得初步解决方案。'] },
			{ title: '二、如何报修', marker: 'b)', lines: ['点击首页「立即报修」进入报修表单。', '填写产品信息、故障描述、上传附件图片，点击提交完成报修。', '提交后可获得工单号，用于后续进度查询。'] },
			{ title: '三、维修进度查询', marker: 'c)', lines: ['在首页或「维修进度」页面输入工单号查询。', '维修状态会实时更新，包括：已提交、运输中、已签收、处理中、已回寄、已完成等状态。'] },
			{ title: '四、自助开票', marker: 'd)', lines: ['维修完成后，在「我的订单」中选择开票。', '选择发票类型，填写开票信息后提交。'] }
		]
	},
	'guide-repair': {
		title: '报修指南',
		icon: 'repair',
		lead: '专业的寄修服务流程，为您的医疗设备保驾护航。',
		paperTitle: '思科达故障报修指南',
		sections: [
			{ title: '一、报修前准备', lines: ['产品信息：准备好产品型号、序列号等基本信息。', '故障描述：详细描述故障现象、发生时间及使用环境。', '故障照片/视频：如有可能，拍摄故障发生时的照片或视频。', '购买凭证：准备好购买发票或订单信息（用于保修确认）。'] },
			{ title: '二、网上报修流程', lines: ['进入「立即报修」页面。', '填写产品信息。', '填写故障描述并上传图片。', '确认信息并提交。'] },
			{ title: '三、思科达 24h 客服指引', lines: ['在线客服：8:00 - 21:00。', '服务热线：400-888-9999。'] }
		],
		steps: [
			{ title: '进入立即报修', desc: '在小程序首页点击「立即报修」按钮，进入报修表单页面。' },
			{ title: '填写产品信息', desc: '选择产品类型，输入产品序列号，填写产品购买日期。' },
			{ title: '上传故障图片', desc: '详细描述故障现象，上传故障照片或视频。' },
			{ title: '确认并提交', desc: '核对报修信息无误后，点击提交完成申请。' }
		]
	},
	'guide-query': {
		title: '查询指南',
		icon: 'search',
		lead: '随时随地掌握维修进度，信息透明更安心。',
		paperTitle: '思科达维修查询指南',
		sections: [
			{ title: '一、工单号查询', lines: ['在小程序首页顶部的搜索框中，直接输入 DR 开头的完整工单号。', '点击搜索即可查看该工单的实时物流进度、检测报告及维修状态。'] },
			{ title: '二、序列号（SN）查询', lines: ['使用设备机身上刻印的 SN 序列号进行查询。', '该方式可追溯设备的所有历史维修记录及保修剩余时长。'] },
			{ title: '三、个人中心查询', lines: ['登录小程序后，点击右下角「我的」。', '进入「维修订单」页面，即可查看名下绑定的所有维修申请及进度。'] },
			{ title: '四、人工查询', lines: ['如无法通过以上方式查询，请联系 400 服务热线，提供报修时的手机号由客服协助查询。'], marker: '' }
		]
	},
	'guide-invoice': {
		title: '开票指南',
		icon: 'invoice',
		lead: '支持多种发票类型，在线申请，极速送达。',
		paperTitle: '思科达自助开票指南',
		sections: [
			{ title: '一、开票申请流程', lines: ['维修完成并支付后，在「维修订单」中选择对应订单。', '点击「申请开票」按钮，选择发票类型（电子普票/纸质专票）。', '录入单位抬头、税号及接收邮箱/地址，确认提交。'] },
			{ title: '二、发票类型说明', lines: ['增值税普通发票：默认开具电子发票，发送至您的预留邮箱。', '增值税专用发票：需上传开票资料，纸质发票将于 3 个工作日内寄出。'] },
			{ title: '三、开票时效', lines: ['电子发票申请后 24 小时内开具；纸质发票每周二、周五统一邮寄。'], marker: '' }
		]
	}
}

const docMap = ref({})

logBoot('doc fallbacks ready')

const contactInfo = ref({
	companyName: '佛山市思科达医疗器械有限公司',
	phone: '13929198537',
	email: '',
	address: '广东省佛山市南海区狮山镇罗村广东新光源核心基地B5座五楼',
	workTime: '周一至周五 08:00 - 21:00'
})

const customerService = ref({
	qrcodeUrl: cicadaAssets.qrWechat,
	title: '调研有礼',
	description: '扫码添加客服微信，参与调研即可获得精美礼品',
	wechat: 'CSD-Service-001'
})

const wechatInfo = ref({
	qrcodeUrl: cicadaAssets.qrWechat,
	name: '思科达售后',
	description: '获取最新维修指南 / 售后政策'
})

const contactHotlines = ref([
	{ title: '售后技术', number: '13929198537', time: '工作日 08:00-21:00' },
	{ title: '购买咨询', number: '13929198537', time: '工作日 08:00-21:00' }
])

const workTimes = ref([
	{ day: '周一至周五', time: '08:00 - 21:00' },
	{ day: '周末', time: '09:00 - 18:00' },
	{ day: '法定节假日', time: '09:00 - 17:00' }
])

const feedbackContacts = [
	{ id: 'phone', title: '手机', label: '手机号码', placeholder: '请输入 11 位手机号码' },
	{ id: 'qq', title: 'QQ', label: 'QQ 号码', placeholder: '请输入 QQ 号' },
	{ id: 'email', title: '邮箱', label: '邮箱地址', placeholder: '请输入常用邮箱' }
]

const feedbackTypes = ['建议', '投诉']
const maxRepairImageSize = 10 * 1024 * 1024
const maxFeedbackImages = 3
const maxRepairVideoSize = 50 * 1024 * 1024
const phoneRegex = /^1[3-9]\d{9}$/
const trackingNoRegex = /^[A-Za-z0-9-]{6,32}$/

const normalizePhone = (value = '') => String(value || '').replace(/\D/g, '')
const normalizeTrackingNo = (value = '') => String(value || '').replace(/\s/g, '').trim()
const isValidPhone = (value = '') => phoneRegex.test(normalizePhone(value))
const isValidTrackingNo = (value = '') => trackingNoRegex.test(normalizeTrackingNo(value))

const normalizeDoc = (doc, fallback = {}) => {
	if (!doc) return fallback
	const content = doc.content || doc.html || ''

	return {
		...fallback,
		title: doc.title || fallback.title,
		lead: doc.description || doc.summary || fallback.lead,
		paperTitle: doc.paperTitle || doc.title || fallback.paperTitle || fallback.title,
		content,
		updateTime: doc.updateTime || fallback.updateTime,
		sections: Array.isArray(doc.sections) && doc.sections.length ? doc.sections : fallback.sections || [],
		steps: Array.isArray(doc.steps) && doc.steps.length ? doc.steps : fallback.steps
	}
}

const normalizeContact = (data = {}) => ({
	companyName: data.companyName || contactInfo.value.companyName,
	phone: data.phone || contactInfo.value.phone,
	email: data.email || contactInfo.value.email,
	address: data.address || contactInfo.value.address,
	workTime: data.workTime || contactInfo.value.workTime
})

const splitWorkTimes = (workTime = '') => {
	if (!workTime) return workTimes.value
	const rows = String(workTime)
		.split(/\n|\uFF1B|;/)
		.map((item) => item.trim())
		.filter(Boolean)

	if (!rows.length) return workTimes.value

	return rows.map((item) => {
		const parts = item.split(/\s+/)
		return {
			day: parts[0] || '工作时间',
			time: parts.slice(1).join(' ') || item
		}
	})
}

const selectLogistics = (item) => {
	repairForm.value.logisticsCompany = item.value
	showLogisticsPicker.value = false
}

const scanTrackingNo = () => {
	uni.scanCode({
		onlyFromCamera: false,
		scanType: ['qrCode', 'barCode'],
		success: (res) => {
			if (res.result) {
				repairForm.value.trackingNo = res.result
			}
		},
		fail: (err) => {
			console.log('扫码失败:', err)
		}
	})
}

const normalizeQrUrl = (url) => url || cicadaAssets.qrWechat

const applyContact = (data = {}) => {
	const next = normalizeContact(data)
	contactInfo.value = next
	contactHotlines.value = [
		{ title: '售后技术', number: next.phone, time: next.workTime },
		...(next.email ? [{ title: '邮箱咨询', number: next.email, time: next.workTime }] : [])
	]
	workTimes.value = splitWorkTimes(next.workTime)
	receiver.value = [
		{ label: '收件公司', value: next.companyName },
		{ label: '收件电话', value: next.phone },
		{ label: '收件地址', value: next.address }
	]
}

const repairStatusMeta = createRepairStatusMeta(repairStatusFlow)

const normalizeOrder = (item = {}) => {
	const statusText = normalizeRepairStatus(item.statusText || item.statusName || item.status)
	const meta = repairStatusMeta[statusText] || {
		status: statusText,
		statusGroup: statusText,
		tone: 'muted',
		reached: Math.max(0, repairStatusFlow.indexOf(statusText))
	}
	const orderId = item.order_no || item.orderNo || item.orderId || item.id || item._id || ''
	const createTime = item.create_time || item.createTime || item.createdAt || item.date || ''
	const updateTime = item.updateTime || item.updatedAt || createTime
	const localPatch = orderLocalPatches.value[orderId] || {}
	const merged = { ...item, ...localPatch }
	const orderItems = Array.isArray(merged.items)
		? merged.items
		: (Array.isArray(merged.itemsList) ? merged.itemsList : [])
	const firstItem = orderItems[0] || {}
	const rawProductName = firstItem.product_name || firstItem.productName || merged.product_name || merged.productName || merged.deviceName || ''
	const genericProductNames = ['维修产品', '维修设备', '未命名设备']
	const productName = rawProductName && !genericProductNames.includes(rawProductName) ? rawProductName : ''
	const productModel = firstItem.product_model || firstItem.productModel || merged.product_model || merged.productModel || merged.model || ''
	const productSerial = firstItem.sn || firstItem.serial || firstItem.productSerial || merged.sn || merged.serial || merged.productSerial || ''
	const faultDesc = firstItem.fault_desc || firstItem.faultDesc || merged.fault_desc || merged.faultDesc || merged.fault || ''
	const shipOutInfo = merged.ship_out_info || merged.shipOutInfo || {}
	const shipBackInfo = merged.ship_back_info || merged.shipBackInfo || {}
	const logisticsCompany = shipOutInfo.logistics_company || shipOutInfo.logisticsCompany || merged.logisticsCompany || ''
	const trackingNo = shipOutInfo.logistics_no || shipOutInfo.logisticsNo || merged.trackingNo || merged.logisticsNo || merged.expressNo || ''
	const returnLogisticsCompany = shipBackInfo.logistics_company || shipBackInfo.logisticsCompany || ''
	const returnLogisticsNo = shipBackInfo.logistics_no || shipBackInfo.logisticsNo || shipBackInfo.return_no || shipBackInfo.returnNo || ''
	const cardTitle = productName || productModel || (productSerial ? `SN ${productSerial}` : '') || '设备信息待同步'
	const cardMeta = [
		productModel && productModel !== cardTitle ? `型号 ${productModel}` : '',
		productSerial && `SN ${productSerial}`,
		trackingNo && `寄出 ${logisticsCompany ? `${logisticsCompany} ` : ''}${trackingNo}`
	].filter(Boolean)
	const quoteItems = normalizeQuoteItems({ ...merged, status: statusText, statusGroup: meta.statusGroup })
	const quoteDetail = normalizeQuoteDetail(merged)
	const partsFee = Number(merged.partsFee ?? merged.parts_fee ?? merged.materialFee ?? merged.material_fee ?? merged.quote?.partsFee ?? merged.quote?.parts_fee ?? sumQuoteFee(quoteItems, 'partsFee')) || 0
	const laborFee = Number(merged.laborFee ?? merged.labor_fee ?? merged.workFee ?? merged.work_fee ?? merged.quote?.laborFee ?? merged.quote?.labor_fee ?? sumQuoteFee(quoteItems, 'laborFee')) || 0
	const totalFee = Number(merged.totalFee ?? merged.total_fee ?? merged.total_price ?? merged.amount ?? merged.price ?? merged.quote?.totalFee ?? merged.quote?.total_price ?? quoteDetail?.finalPrice ?? partsFee + laborFee) || 0
	const paymentProofs = Array.isArray(merged.paymentProofs)
		? merged.paymentProofs
		: (Array.isArray(merged.payment_proofs) ? merged.payment_proofs : [])
	const invoiceInfo = merged.invoice_info || merged.invoiceInfo || {}

	return {
		id: orderId,
		recordId: merged._id || merged.id || '',
		items: orderItems,
		productName,
		product_name: productName,
		productModel,
		product_model: productModel,
		productSerial,
		serial: productSerial,
		faultDesc,
		fault_desc: faultDesc,
		logisticsCompany,
		trackingNo,
		cardTitle,
		cardMeta,
		model: cardTitle,
		status: statusText,
		statusGroup: meta.statusGroup,
		tone: meta.tone,
		reached: meta.reached,
		time: formatDateTime(updateTime, 5, 16) || merged.time || '',
		price: merged.price || merged.amount || merged.totalFee || merged.total_fee || merged.total_price || (totalFee ? formatMoney(totalFee) : ''),
		date: formatDateTime(createTime, 0, 10),
		doneTime: merged.doneTime || merged.expectedDoneTime || '待后台同步',
		invoiceStatus: merged.invoiceStatus || merged.invoice_status || invoiceInfo.status,
		invoiced: merged.invoiced || invoiceInfo.status === '已开具',
		invoiceTitle: merged.invoiceTitle || merged.invoice_title || invoiceInfo.title,
		taxNo: merged.taxNo || merged.tax_no || invoiceInfo.tax_no,
		invoiceEmail: merged.invoiceEmail || merged.invoice_email || invoiceInfo.email,
		invoiceRemark: merged.invoiceRemark || merged.invoice_remark || invoiceInfo.remark,
		invoiceNo: merged.invoiceNo || merged.invoice_no || invoiceInfo.invoice_no,
		invoiceDate: merged.invoiceDate || merged.invoice_date || formatDateTime(invoiceInfo.update_time || invoiceInfo.apply_time, 0, 10),
		invoiceUrl: merged.invoiceUrl || merged.invoice_url || invoiceInfo.invoice_url,
		quoteStatus: merged.quoteStatus || merged.quote_status || merged.quote?.status || (quoteItems.length ? 'issued' : 'pending'),
		authorizationStatus: merged.authorizationStatus || merged.authorization_status || merged.authStatus || (localPatch.authorizationStatus || ''),
		authorizationTime: merged.authorizationTime || merged.authorization_time || localPatch.authorizationTime || '',
		paymentStatus: merged.paymentStatus || merged.payment_status || (paymentProofs.length ? 'uploaded' : 'pending'),
		quoteDetail,
		quoteItems,
		partsFee,
		laborFee,
		totalFee,
		paymentProofs,
		statusKey: item.status || merged.status || '',
		quoteWarrantyMonths: Number(merged.quoteWarrantyMonths ?? merged.quote_warranty_months ?? 0) || 0,
		paymentDeadline: Number(merged.paymentDeadline ?? merged.payment_deadline ?? 0) || 0,
		returnLogisticsCompany,
		returnLogisticsNo,
		timeline: Array.isArray(merged.timeline) ? merged.timeline : []
	}
}

const readStorage = (key, fallback) => {
	try {
		const value = uni.getStorageSync(key)
		return value || fallback
	} catch (error) {
		console.warn('read storage fallback:', key, error)
		return fallback
	}
}

const writeStorage = (key, value) => {
	try {
		uni.setStorageSync(key, value)
	} catch (error) {
		console.warn('write storage fallback:', key, error)
	}
}

const normalizeProduct = (item = {}) => ({
	title: item.title || item.name || item.productName || item.model || '已登记设备',
	sn: item.sn || item.serial || item.productSerial || item.id || '',
	date: item.buyDate || item.purchaseDate || item.date || '',
	warranty: item.warrantyText || item.warranty || item.warrantyStatus || '保修信息待同步',
	expired: Boolean(item.expired || item.isExpired)
})

const normalizePackageTimeline = (timeline = []) => {
	if (!Array.isArray(timeline) || !timeline.length) {
		return [{ title: '等待录入', desc: '后台录入快递单号后，这里会显示签收和处理记录。', time: '', pending: true }]
	}

	return timeline.map((item = {}) => ({
		title: item.title || item.statusText || item.status || '包裹状态更新',
		desc: item.desc || item.description || item.content || '包裹状态已更新。',
		time: item.time || item.createTime || item.updateTime || '',
		pending: Boolean(item.pending)
	}))
}

const normalizePackageResult = (data = {}) => {
	const rawStatus = data.status
	const meta = packageStatusMeta[rawStatus] || {
		status: data.statusText || data.statusName || rawStatus || '已录入',
		tone: data.tone || 'muted',
		reached: Number.isFinite(Number(data.reached)) ? Number(data.reached) : 1
	}

	const reachedValue = data.reached !== undefined && data.reached !== null ? data.reached : meta.reached

	return {
		trackingNo: data.trackingNo || data.expressNo || data.waybillNo || packageQuery.value.trackingNo,
		company: data.company || data.expressCompany || data.logisticsCompany || '',
		orderId: data.orderId || data.repairOrderId || '',
		status: data.statusText || data.statusName || meta.status,
		tone: data.tone || meta.tone,
		reached: Math.max(0, Math.min(packageFlow.length - 1, Number(reachedValue) || 0)),
		timeline: normalizePackageTimeline(data.timeline || data.logs || data.records)
	}
}

const queryPackage = async () => {
	if (packageQueryLoading.value) return

	const trackingNo = packageQuery.value.trackingNo.trim()
	if (!trackingNo) {
		uni.showToast({ title: '请输入快递单号', icon: 'none' })
		return
	}

	packageQueryLoading.value = true
	packageQuerySearched.value = false
	packageQueryResult.value = null

	try {
		const res = await queryPackageStatus({
			trackingNo,
			phoneLast4: packageQuery.value.phoneLast4.trim()
		})
		packageQueryResult.value = res ? normalizePackageResult(res) : null
		packageQuerySearched.value = true
	} catch (error) {
		console.warn('package query failed:', error)
		packageQuerySearched.value = true
		uni.showToast({ title: error.message || '暂未查到包裹记录', icon: 'none' })
	} finally {
		packageQueryLoading.value = false
	}
}

const scanPackageCode = () => {
	uni.scanCode({
		scanType: ['qrCode', 'barCode'],
		success: (res) => {
			if (res.result) {
				packageQuery.value.trackingNo = res.result.trim()
				uni.showToast({ title: '已识别单号', icon: 'success' })
			}
		},
		fail: (err) => {
			console.warn('scan failed:', err)
			uni.showToast({ title: '扫码失败', icon: 'none' })
		}
	})
}

const pastePackageCode = () => {
	uni.getClipboardData({
		success: (res) => {
			if (res.data && res.data.trim()) {
				packageQuery.value.trackingNo = res.data.trim()
				uni.showToast({ title: '已粘贴单号', icon: 'success' })
			} else {
				uni.showToast({ title: '剪贴板为空', icon: 'none' })
			}
		},
		fail: (err) => {
			console.warn('get clipboard failed:', err)
			uni.showToast({ title: '获取剪贴板失败', icon: 'none' })
		}
	})
}

const applyFaultTypes = (list = []) => {
	if (!Array.isArray(list) || !list.length) return
	const productMap = {}
	const faultMap = {}

	list.forEach((item) => {
		const productName = item.productType || item.productName || '通用设备'
		const productId = item.productTypeId || item.productType || productName
		const faultName = item.faultName || item.name || item.title

		if (!faultName) return
		productMap[productId] = { id: productId, title: productName }
		if (!faultMap[productId]) faultMap[productId] = []
		faultMap[productId].push(faultName)
	})

	if (Object.keys(productMap).length) {
		diagProducts.value = Object.values(productMap)
		diagFaultMap.value = faultMap
		faultRecords.value = list
	}
}

const updateDoc = (key, doc) => {
	docMap.value = {
		...docMap.value,
		[key]: normalizeDoc(doc, docFallbacks[key] || docMap.value[key] || {})
	}
}

const statusItems = computed(() => {
	const counts = orderList.value.reduce(
		(acc, item) => {
			acc.all += 1
			if (pendingRepairStatuses.includes(item.statusGroup)) acc.pending += 1
			if (item.statusGroup === '处理中') acc.fixing += 1
			if (item.statusGroup === '已回寄') acc.shipped += 1
			return acc
		},
		{ all: 0, pending: 0, fixing: 0, shipped: 0 }
	)

	return defaultStatusItems.map((item) => ({
		...item,
		count: counts[item.id] !== undefined && counts[item.id] !== null ? counts[item.id] : item.count
	}))
})

const countOrdersByStatus = (status) => orderList.value.filter((item) => item.statusGroup === status).length

const orderTabs = computed(() => [
	{ key: '全部', label: '全部', count: orderList.value.length },
	{ key: '待处理', label: '待处理', count: orderList.value.filter((item) => pendingRepairStatuses.includes(item.statusGroup)).length },
	{ key: '处理中', label: '处理中', count: countOrdersByStatus('处理中') },
	{ key: '已回寄', label: '已回寄', count: countOrdersByStatus('已回寄') },
	{ key: '未开票', label: '未开票', count: orderList.value.filter((item) => invoiceTodoStatusKeys.includes(getInvoiceStatusKey(item))).length },
	{ key: '已开票', label: '已开票', count: orderList.value.filter((item) => getInvoiceStatusKey(item) === 'issued').length }
])

const invoiceTodoOrders = computed(() => orderList.value.filter((item) => invoiceTodoStatusKeys.includes(getInvoiceStatusKey(item))))
const invoiceIssuedOrders = computed(() => orderList.value.filter((item) => getInvoiceStatusKey(item) === 'issued'))
const invoiceTabs = computed(() => [
	`待开票 ${invoiceTodoOrders.value.length}`,
	`已开票 ${invoiceIssuedOrders.value.length}`
])

const diagProductLabel = computed(() => {
	const product = diagProducts.value.find((item) => item.id === diagProduct.value)
	return product ? product.title : ''
})
const diagEmptyText = computed(() => (
	diagProducts.value.length
		? '选择产品类型与故障类型，系统将自动展示排查建议。'
		: '暂无故障自查数据，请联系管理员在后台配置。'
))
const diagFaultPlaceholder = computed(() => (diagProduct.value ? '请选择故障类型' : '请先选择产品类型'))
const diagFaultOptions = computed(() => {
	if (diagProduct.value) return diagFaultMap.value[diagProduct.value] || []
	return Array.from(new Set(Object.values(diagFaultMap.value).flat()))
})
const diagConfirmVisible = computed(() => Boolean(diagProduct.value && diagFault.value))
const diagConfirmSections = computed(() => {
	if (!diagResult.value) return defaultDiagConfirmSections

	const questionItems = toTextLines(diagResult.value.relatedQuestions || diagResult.value.confirmInfo)
	const checkItems = toTextLines(diagResult.value.checkSteps || diagResult.value.confirmSteps)
	const solutionItems = toTextLines(diagResult.value.solutions || diagResult.value.solution)

	return [
		{
			title: '相关问题',
			color: '#1E6FE0',
			numbered: false,
			items: questionItems.length ? questionItems : defaultDiagConfirmSections[0].items
		},
		{
			title: '确认方式',
			color: '#0EA5E9',
			numbered: true,
			items: checkItems.length ? checkItems : defaultDiagConfirmSections[1].items
		},
		{
			title: '处理方式',
			color: '#10B981',
			numbered: true,
			items: solutionItems.length ? solutionItems : defaultDiagConfirmSections[2].items
		}
	]
})
const diagSheetOptions = computed(() => {
	if (diagOpen.value === 'product') {
		return diagProducts.value.map((item) => ({ ...item, active: item.id === diagProduct.value }))
	}
	return diagFaultOptions.value.map((title) => ({ id: title, title, active: title === diagFault.value }))
})
const warrantyDoc = computed(() => docMap.value.warranty || {})
const activeDoc = computed(() => docMap.value[activeModule.value] || docFallbacks[activeModule.value] || docFallbacks['guide-quick'] || {})
const isDocModule = computed(() => docModuleIds.includes(activeModule.value))
const userDisplayName = computed(() => currentUser.value.nickname || currentUser.value.name || (currentUser.value.phone ? `用户${String(currentUser.value.phone).slice(-4)}` : '已登录用户'))
const userDisplayUnit = computed(() => currentUser.value.unit || currentUser.value.companyName || '已绑定手机号')
const userAvatarText = computed(() => String(userDisplayName.value || '用').slice(0, 1))
const feedbackContact = computed(() => feedbackContacts.find((item) => item.id === feedbackContactKind.value) || feedbackContacts[0])
const receiverLastIndex = computed(() => receiver.value.length - 1)
const filteredTrackOrders = computed(() => {
	const keyword = trackSearchKeyword.value.trim().toLowerCase()
	return trackOrders.value.filter((item) => {
		const statusMatched = activeTrackTab.value === '全部' || item.statusGroup === activeTrackTab.value
		if (!statusMatched) return false
		if (!keyword) return true
		const itemSearchable = Array.isArray(item.items)
			? item.items.flatMap((product = {}) => [
				product.product_name,
				product.productName,
				product.product_model,
				product.productModel,
				product.sn,
				product.serial,
				product.productSerial
			])
			: []
		const searchable = [item.id, item.model, item.productName, item.productModel, item.serial, item.productSerial, item.trackingNo, ...itemSearchable]
			.filter(Boolean)
			.join(' ')
			.toLowerCase()
		return searchable.includes(keyword)
	})
})
const filteredOrderList = computed(() => {
	if (activeOrdersTab.value === '待处理') return orderList.value.filter((item) => pendingRepairStatuses.includes(item.statusGroup))
	if (activeOrdersTab.value === '未开票') return orderList.value.filter((item) => invoiceTodoStatusKeys.includes(getInvoiceStatusKey(item)))
	if (activeOrdersTab.value === '已开票') return orderList.value.filter((item) => getInvoiceStatusKey(item) === 'issued')
	const matchedStatus = repairStatusFlow.find((status) => activeOrdersTab.value === status)
	if (matchedStatus) return orderList.value.filter((item) => item.statusGroup === matchedStatus)
	return orderList.value
})

const guideFileTypeByMime = {
	'application/pdf': 'pdf',
	'application/msword': 'doc',
	'application/vnd.openxmlformats-officedocument.wordprocessingml.document': 'docx',
	'application/vnd.ms-excel': 'xls',
	'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': 'xlsx',
	'application/vnd.ms-powerpoint': 'ppt',
	'application/vnd.openxmlformats-officedocument.presentationml.presentation': 'pptx'
}

const getGuideFileExt = (doc = {}) => {
	const mimeExt = guideFileTypeByMime[String(doc.fileType || '').split(';')[0].trim().toLowerCase()]
	if (mimeExt) return mimeExt
	const sources = [doc.fileName, doc.name, doc.fileUrl, doc.url]
	for (const source of sources) {
		const cleanSource = String(source || '').split('?')[0]
		const match = cleanSource.match(/\.([a-zA-Z0-9]+)$/)
		if (match) return match[1].toLowerCase()
	}
	return ''
}

const resolveGuideFileUrl = async (fileUrl = '') => {
	const url = String(fileUrl || '').trim()
	if (!url || /^https?:\/\//i.test(url) || url.startsWith('wxfile://')) return url
	const res = await getCloudTempFileURL([url])
	const item = res.fileList && res.fileList[0]
	return (item && (item.tempFileURL || item.url)) || url
}

const openGuideFile = async (doc = {}) => {
	if (!doc.fileUrl) {
		uni.showToast({ title: '该教程还未上传文档', icon: 'none' })
		return
	}

	try {
		uni.showLoading({ title: '打开中' })
		const ext = getGuideFileExt(doc)
		const url = await resolveGuideFileUrl(doc.fileUrl)
		const imageExts = ['jpg', 'jpeg', 'png', 'webp', 'gif']

		if (imageExts.includes(ext)) {
			uni.hideLoading()
			uni.previewImage({ urls: [url], current: url })
			return
		}

		const downloadRes = await uni.downloadFile({ url })
		const filePath = downloadRes.tempFilePath
		uni.hideLoading()
		await uni.openDocument({
			filePath,
			fileType: ext || undefined,
			showMenu: true
		})
	} catch (error) {
		console.warn('open guide file failed:', error)
		uni.hideLoading()
		uni.showToast({ title: '文档打开失败，请稍后重试', icon: 'none' })
	}
}

// 打开教程媒体：图片内联预览，视频用 previewMedia，文档走文件打开
const openGuideMedia = async (item = {}) => {
	if (!item || !item.url) return
	try {
		uni.showLoading({ title: '打开中' })
		const url = await resolveGuideFileUrl(item.url)
		uni.hideLoading()
		if (item.type === 'image') {
			uni.previewImage({ urls: [url], current: url })
			return
		}
		if (item.type === 'video') {
			if (uni.previewMedia) {
				uni.previewMedia({ sources: [{ url, type: 'video' }], current: 0 })
			} else {
				uni.navigateTo && uni.navigateTo({ url: `/pages/index/index?video=${encodeURIComponent(url)}`, fail: () => {} })
			}
			return
		}
		await openGuideFile({ fileUrl: item.url, fileName: item.name, fileType: item.fileType })
	} catch (error) {
		uni.hideLoading()
		uni.showToast({ title: '媒体打开失败，请稍后重试', icon: 'none' })
	}
}

const mergeOrderDetailItems = (orders = [], details = []) => {
	const detailMap = details.reduce((map, detail) => {
		if (!detail || !detail.id) return map
		map[detail.id] = detail
		return map
	}, {})
	return orders.map((order) => detailMap[order.id] ? { ...order, ...detailMap[order.id] } : order)
}

const hydrateOrderDetails = async (orders = []) => {
	const pendingOrders = orders.filter((order) => order && order.recordId && !order.productName && !order.productModel && !order.productSerial)
	if (!pendingOrders.length) return

	const detailResults = await Promise.allSettled(
		pendingOrders.slice(0, 8).map((order) => getRepairDetail(order.recordId))
	)
	const details = detailResults
		.filter((result) => result.status === 'fulfilled')
		.map((result) => normalizeOrder(result.value))
		.filter((order) => order.id)
	if (!details.length) return

	const applyDetails = (list) => mergeOrderDetailItems(list, details)
	orderList.value = applyDetails(orderList.value)
	trackOrders.value = applyDetails(trackOrders.value)
}

const detailOrder = computed(() => {
	const sourceId = trackDetailOrder.value || orderDetailOrder.value
	return (
		trackOrders.value.find((item) => item.id === sourceId) ||
		orderList.value.find((item) => item.id === sourceId) ||
		{}
	)
})
const detailTimeline = computed(() => {
	const timeline = detailOrder.value.timeline
	if (Array.isArray(timeline) && timeline.length) return normalizePackageTimeline(timeline)
	if (!detailOrder.value.id) return []
	return [
		{
			title: detailOrder.value.status || '已提交',
			desc: '工单进度已同步，更多节点会在后台更新后展示。',
			time: detailOrder.value.time || detailOrder.value.date || '',
			pending: false
		}
	]
})

// 标准化 9 节点维修进度（已提交→已完成），状态由工单状态+报价+付款推导
const repairProgressNodes = computed(() => getRepairProgressNodes(detailOrder.value))

const detailIsCompleted = computed(() => detailOrder.value.statusKey === 'completed' || detailOrder.value.status === '已完成')

const detailQuoteVisible = computed(() => ['issued', 'confirmed', 'rejected'].includes(detailOrder.value.quoteStatus))

const detailWarrantyText = computed(() => {
	const m = Number(detailOrder.value.quoteWarrantyMonths || 0)
	return m > 0 ? `本次维修质保 ${m} 个月` : '本次维修质保以全局质保政策为准'
})

const detailPaymentDeadlineText = computed(() => {
	const ts = Number(detailOrder.value.paymentDeadline || 0)
	if (!ts) return ''
	const d = new Date(ts)
	const pad = (n) => String(n).padStart(2, '0')
	return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`
})
const detailInvoiceOrder = computed(() => resolveOrderRecord(detailOrder.value))
const activeInvoiceOrder = computed(() => orderList.value.find((item) => item.id === activeInvoiceOrderId.value) || {})
const detailQuoteItems = computed(() => Array.isArray(detailOrder.value.quoteItems) ? detailOrder.value.quoteItems : [])
const detailQuoteGroups = computed(() => {
	const detail = detailOrder.value.quoteDetail
	if (!detail) return []
	return [
		{ key: 'parts', title: '配件费用', items: detail.parts || [], total: detail.partsTotal },
		{ key: 'services', title: '服务费用', items: detail.services || [], total: detail.servicesTotal },
		{ key: 'others', title: '其他费用', items: detail.others || [], total: detail.othersTotal }
	].filter((group) => Array.isArray(group.items) && group.items.length)
})
const detailPaymentProofs = computed(() => Array.isArray(detailOrder.value.paymentProofs) ? detailOrder.value.paymentProofs : [])

logBoot('computed state ready')

let copyTimer = null

const initModuleSafeArea = () => {
	try {
		const systemInfo = uni.getSystemInfoSync()
		const menuRect = uni.getMenuButtonBoundingClientRect ? uni.getMenuButtonBoundingClientRect() : null
		const pixelRatio = 750 / (systemInfo.windowWidth || 375)

		if (menuRect && menuRect.top) {
			const navBottom = menuRect.top + menuRect.height + Math.max(menuRect.top - (systemInfo.statusBarHeight || 0), 8)
			moduleHeadPaddingTop.value = Math.ceil(navBottom * pixelRatio) + 8
			return
		}

		moduleHeadPaddingTop.value = Math.ceil(((systemInfo.statusBarHeight || 24) + 24) * pixelRatio)
	} catch (error) {
		console.warn('safe area fallback:', error)
		moduleHeadPaddingTop.value = 88
	}
}

const markCopied = (label) => {
	copied.value = label
	if (copyTimer) clearTimeout(copyTimer)
	copyTimer = setTimeout(() => {
		copied.value = ''
	}, 1400)
}

const copyOne = (value, label) => {
	uni.setClipboardData({
		data: value,
		success: () => markCopied(label),
		fail: () => markCopied(label)
	})
}

const copyAll = () => {
	const text = receiver.value.map((item) => `${item.label}: ${item.value}`).join('\n')
	uni.setClipboardData({
		data: text,
		success: () => markCopied('all'),
		fail: () => markCopied('all')
	})
}

function resolveOrderRecord(order = {}) {
	return orderList.value.find((item) => item.id === order.id) || order || {}
}

const patchOrderRecord = (orderId, patch = {}) => {
	if (!orderId) return
	const nextPatch = {
		...(orderLocalPatches.value[orderId] || {}),
		...patch
	}
	orderLocalPatches.value = {
		...orderLocalPatches.value,
		[orderId]: nextPatch
	}
	writeStorage(localOrderPatchKey, orderLocalPatches.value)

	const applyPatch = (list) => list.map((item) => (item.id === orderId ? { ...item, ...nextPatch } : item))
	orderList.value = applyPatch(orderList.value)
	trackOrders.value = applyPatch(trackOrders.value)
}

const getQuoteTotal = (order = {}) => Number(order.totalFee || order.quoteDetail?.finalPrice || 0) || sumQuoteFee(order.quoteItems || [], 'partsFee') + sumQuoteFee(order.quoteItems || [], 'laborFee')

const getQuoteItemTotal = (item = {}) => (Number(item.partsFee) || 0) + (Number(item.laborFee) || 0)

const getQuoteDetailRowTotal = (item = {}) => Number(item.amount || 0) || (Number(item.unitPrice || 0) * Number(item.quantity || 0))

const getQuoteMeta = (order = {}) => {
	if (!order.id) return { label: '待同步', tone: 'muted', desc: '请选择一个工单查看报价。' }
	if ((!Array.isArray(order.quoteItems) || !order.quoteItems.length) && !order.quoteDetail) return { label: '待检测', tone: 'muted', desc: '工程师检测完成后会生成正式报价。' }
	if (order.quoteStatus === 'rejected') return { label: '已拒绝', tone: 'warn', desc: '客户暂未同意该维修报价。' }
	if (order.authorizationStatus === 'confirmed') return { label: '已确认', tone: 'ok', desc: '报价已确认，工程师可继续维修。' }
	return { label: '待确认', tone: 'warn', desc: '请确认维修项目、配件、工时和总价后再授权维修。' }
}

const getAuthorizationMeta = (order = {}) => {
	if (!getQuoteTotal(order)) return { label: '待报价', tone: 'muted', desc: '检测报价生成后才需要授权。' }
	if (order.authorizationStatus === 'confirmed') return { label: '已授权', tone: 'ok', desc: order.authorizationTime ? `客户已于 ${order.authorizationTime} 授权维修。` : '客户已授权维修。' }
	return { label: '待授权', tone: 'warn', desc: '客户确认报价后，后台再安排维修。' }
}

const getPaymentMeta = (order = {}) => {
	const proofs = Array.isArray(order.paymentProofs) ? order.paymentProofs : []
	if (!getQuoteTotal(order)) return { label: '待报价', tone: 'muted', desc: '报价金额确认后，可微信支付；企业客户也可上传对公转账凭证。' }
	if (order.paymentStatus === 'paid') return { label: '已支付', tone: 'ok', desc: '微信支付已完成，系统已自动确认到账。' }
	if (proofs.length || order.paymentStatus === 'uploaded') return { label: '待核销', tone: 'warn', desc: '凭证已留痕，等待财务核对到账。' }
	return { label: '待支付', tone: 'warn', desc: '可直接微信支付；企业客户可走对公转账并上传凭证。' }
}

const getBillingAmountText = (order = {}) => {
	const total = getQuoteTotal(order)
	return total ? formatMoney(total) : '待后台报价'
}

const getBillingMeta = (order = {}) => {
	const quoteTotal = getQuoteTotal(order)
	const invoiceMeta = getInvoiceMeta(resolveOrderRecord(order))
	if (!order.id) return { label: '待同步', tone: 'muted', desc: '请选择一个工单查看报价。' }
	if (!quoteTotal) return { label: '待报价', tone: 'muted', desc: '工程师检测后会在这里给出正式报价。' }
	if (order.paymentStatus === 'paid') return { label: '已支付', tone: 'ok', desc: invoiceMeta.desc || '微信支付已完成，订单已自动进入后续维修流程。' }
	if (Array.isArray(order.paymentProofs) && order.paymentProofs.length) return { label: '待核销', tone: 'warn', desc: '付款凭证已上传，等待财务核对到账。' }
	return { label: '待支付', tone: 'warn', desc: '请核对维修项目和金额，确认后可直接微信支付。' }
}

const getBillingAction = (order = {}) => {
	if (!order.id) return { visible: false, text: '', disabled: true }
	if (canPayRepair(order)) {
		return {
			visible: true,
			text: paymentSubmitting.value ? '支付中...' : '确认并支付',
			disabled: paymentSubmitting.value,
			type: 'wechat-pay'
		}
	}
	const invoiceStatus = getInvoiceStatusKey(resolveOrderRecord(order))
	if (invoiceStatus === 'available') return { visible: true, text: '申请开票', disabled: false, type: 'apply-invoice' }
	if (invoiceStatus === 'issued') return { visible: true, text: '查看发票', disabled: false, type: 'view-invoice' }
	return { visible: false, text: '', disabled: true }
}

const getPaymentProofAction = (order = {}) => {
	const proofs = Array.isArray(order.paymentProofs) ? order.paymentProofs : []
	if (!order.id || !getQuoteTotal(order)) return { visible: false, text: '', disabled: true, hint: '' }
	if (order.paymentStatus === 'paid') return { visible: false, text: '', disabled: true, hint: '微信支付已完成，无需上传截图。' }
	if (proofs.length || order.paymentStatus === 'uploaded') {
		return { visible: false, text: '', disabled: true, hint: '付款凭证已上传，等待后台核销。' }
	}
	return {
		visible: true,
		text: paymentProofUploading.value ? '上传中...' : '企业对公转账 / 上传凭证',
		disabled: paymentProofUploading.value,
		hint: ''
	}
}

const handleBillingAction = (order = {}) => {
	const action = getBillingAction(order)
	if (!action.visible || action.disabled) return
	if (action.type === 'wechat-pay') {
		payRepairQuote(order)
		return
	}
	handleInvoiceAction(order)
}

const handlePaymentProofAction = (order = {}) => {
	const action = getPaymentProofAction(order)
	if (!action.visible || action.disabled) return
	uploadPaymentProof(order)
}

const canPayRepair = (order = {}) => {
	const proofs = Array.isArray(order.paymentProofs) ? order.paymentProofs : []
	return Boolean(
		order.id &&
		getQuoteTotal(order) > 0 &&
		order.quoteStatus !== 'rejected' &&
		order.paymentStatus !== 'paid' &&
		order.paymentStatus !== 'uploaded' &&
		!proofs.length
	)
}

const canUploadPaymentProof = (order = {}) => Boolean(order.id && getQuoteTotal(order) > 0)

const payRepairQuote = (order = {}) => {
	if (!canPayRepair(order) || paymentSubmitting.value) return
	uni.showModal({
		title: '确认并支付',
		content: `确认维修报价 ${formatMoney(getQuoteTotal(order))}，并使用微信支付？`,
		confirmText: '去支付',
		cancelText: '再看看',
		success: async ({ confirm }) => {
			if (!confirm) return
			let loadingShown = false
			let paymentFinished = false
			try {
				await requestStatusSubscription('quote_confirm')
				paymentSubmitting.value = true
				uni.showLoading({ title: '创建支付' })
				loadingShown = true
				const paymentOrder = await createRepairWechatPay(order.recordId || order.id)
				const paymentParams = paymentOrder.payment || {}
				if (!paymentParams.timeStamp || !paymentParams.nonceStr || !paymentParams.package || !paymentParams.paySign) {
					throw new Error('微信支付参数不完整，请稍后重试')
				}

				uni.hideLoading()
				loadingShown = false
				await new Promise((resolve, reject) => {
					uni.requestPayment({
						...paymentParams,
						success: resolve,
						fail: reject
					})
				})
				paymentFinished = true

				uni.showLoading({ title: '确认到账' })
				loadingShown = true
				const result = await syncRepairWechatPay(order.recordId || order.id, paymentOrder.outTradeNo)
				const nextStatus = normalizeRepairStatus(result.status || result.statusGroup || 'fixing')
				patchOrderRecord(order.id, {
					authorizationStatus: result.authorizationStatus || result.authorization_status || 'confirmed',
					quoteStatus: result.quoteStatus || result.quote_status || 'confirmed',
					authorizationTime: result.authorizationTime || result.authorization_time || todayText(),
					paymentStatus: result.paymentStatus || result.payment_status || 'paid',
					status: nextStatus,
					statusGroup: nextStatus,
					tone: getOrderStatusTone({ statusGroup: nextStatus }),
					reached: Math.max(0, repairStatusFlow.indexOf(nextStatus))
				})
				uni.hideLoading()
				loadingShown = false
				uni.showToast({ title: '支付成功', icon: 'success' })
				setTimeout(() => {
					uni.showModal({
						title: '支付成功',
						content: '下一步预计：工程师将在 1 个工作日内开始维修，进度会在“维修进度”中实时更新。',
						showCancel: false,
						confirmText: '知道了'
					})
				}, 600)
			} catch (error) {
				console.warn('wechat pay failed:', error)
				const message = error && (error.message || error.errMsg)
					? (error.message || error.errMsg)
					: '支付失败'
				if (paymentFinished) {
					uni.showToast({ title: '已支付，到账确认中', icon: 'none' })
				} else {
					uni.showToast({ title: message.includes('cancel') ? '已取消支付' : message, icon: 'none' })
				}
			} finally {
				paymentSubmitting.value = false
				if (loadingShown) uni.hideLoading()
			}
		}
	})
}

// 报价有疑问联系客服（避免客户直接拒绝报价）
const contactSupportForQuote = () => {
	uni.showActionSheet({
		itemList: ['拨打售后客服', '拨打售后技术'],
		success: ({ tapIndex }) => {
			const phone = tapIndex === 1 ? '13929945417' : '13929924257'
			callPhone(phone)
		},
		fail: () => {}
	})
}

// 回寄物流：跳转包裹查询并自动带入回寄单号
const trackReturnLogistics = (order = {}) => {
	if (!order.returnLogisticsNo) return
	packageQuery.value.trackingNo = order.returnLogisticsNo
	openModule('package-query')
	queryPackage()
}

// 完成后：去评价（复用投诉建议，预填关联工单）
const evaluateOrder = (order = {}) => {
	feedbackType.value = '建议'
	feedbackOrderId.value = order.id || order.recordId || ''
	openModule('feedback')
}

// 完成后：保养提醒
const showMaintenanceTip = () => {
	uni.showModal({
		title: '保养提醒',
		content: '建议每 6 个月对设备做一次保养维护：清洁、润滑并检查易损件，可有效延长设备寿命、降低故障率。如需上门或寄修保养，可直接发起报修。',
		showCancel: false,
		confirmText: '知道了'
	})
}

// 完成后：再次报修（预填本次设备信息）
const reRepair = (order = {}) => {
	repairForm.value = defaultRepairForm()
	const product = defaultRepairProduct()
	product.name = order.productName || ''
	product.model = order.productModel || ''
	product.serial = order.productSerial || order.serial || ''
	repairProducts.value = [product]
	repairProductSeed = 1
	repairMediaSeed = 1
	repairStep.value = 1
	openModule('repair')
	if (product.serial) recognizeSn(0)
}

const uploadPaymentProof = async (order = {}) => {
	if (!canUploadPaymentProof(order) || paymentProofUploading.value) return
	let loadingShown = false
	try {
		await requestStatusSubscription('quote_confirm')
		const chooseRes = await uni.chooseImage({
			count: 1,
			sizeType: ['compressed'],
			sourceType: ['album', 'camera']
		})
		const path = chooseRes.tempFilePaths && chooseRes.tempFilePaths[0]
		if (!path) return
		const oversized = (chooseRes.tempFiles || []).find((file) => isFileTooLarge(file, maxRepairImageSize))
		if (oversized) {
			uni.showToast({ title: `图片不能超过${formatFileSize(maxRepairImageSize)}`, icon: 'none' })
			return
		}

		paymentProofUploading.value = true
		uni.showLoading({ title: '上传中' })
		loadingShown = true
		let proofUrl = path
		let proofFileID = ''
		try {
			const uploadRes = await uploadImage(path)
			proofUrl = normalizeUploadUrl(uploadRes, path)
			proofFileID = normalizeUploadFileId(uploadRes)
		} catch (error) {
			console.warn('payment proof upload fallback:', error)
		}
		const nextProof = { id: `pay-${Date.now()}`, path, fileID: proofFileID, url: proofUrl, time: todayText() }
		const nextProofs = [
			...(Array.isArray(order.paymentProofs) ? order.paymentProofs : []),
			nextProof
		]
		const result = await uploadRepairPaymentProof(order.recordId || order.id, nextProof)
		patchOrderRecord(order.id, {
			paymentStatus: result.paymentStatus || result.payment_status || 'uploaded',
			paymentProofs: Array.isArray(result.paymentProofs) ? result.paymentProofs : (Array.isArray(result.payment_proofs) ? result.payment_proofs : nextProofs)
		})
		uni.hideLoading()
		loadingShown = false
		uni.showToast({ title: '凭证已留痕', icon: 'success' })
	} catch (error) {
		console.warn('choose payment proof failed:', error)
		uni.showToast({ title: '上传凭证失败', icon: 'none' })
	} finally {
		paymentProofUploading.value = false
		if (loadingShown) uni.hideLoading()
	}
}

const previewPaymentProof = (index = 0) => {
	const urls = detailPaymentProofs.value.map(getPreviewUrl).filter(Boolean)
	if (!urls.length) return
	uni.previewImage({
		current: urls[index] || urls[0],
		urls
	})
}

const resetInvoiceForm = (order = {}) => {
	invoiceForm.value = {
		invoiceType: '电子普通发票',
		titleType: 'company',
		title: order.invoiceTitle || addressForm.value.unit || '',
		taxNo: order.taxNo || '',
		email: order.invoiceEmail || '',
		remark: ''
	}
}

const startInvoiceApply = (order = {}) => {
	const sourceOrder = resolveOrderRecord(order)
	const status = getInvoiceStatusKey(sourceOrder)

	if (status === 'processing') {
		uni.showToast({ title: '发票正在开具中', icon: 'none' })
		return
	}

	if (status !== 'available') {
		uni.showToast({ title: getInvoiceMeta(sourceOrder).desc, icon: 'none' })
		return
	}

	resetInvoiceForm(sourceOrder)
	activeInvoiceOrderId.value = sourceOrder.id
}

const cancelInvoiceApply = () => {
	activeInvoiceOrderId.value = ''
}

const submitInvoiceApply = async () => {
	if (invoiceSubmitting.value) return
	const order = activeInvoiceOrder.value

	if (!order.id) {
		uni.showToast({ title: '请选择开票工单', icon: 'none' })
		return
	}

	if (!invoiceForm.value.title.trim()) {
		uni.showToast({ title: '请填写发票抬头', icon: 'none' })
		return
	}

	if (invoiceForm.value.titleType === 'company' && !invoiceForm.value.taxNo.trim()) {
		uni.showToast({ title: '请填写税号', icon: 'none' })
		return
	}

	if (!invoiceForm.value.email.trim()) {
		uni.showToast({ title: '请填写接收邮箱', icon: 'none' })
		return
	}

	invoiceSubmitting.value = true
	try {
		const invoiceResult = await applyInvoice({
			orderId: order.recordId || order.id,
			invoiceType: invoiceForm.value.invoiceType,
			titleType: invoiceForm.value.titleType,
			title: invoiceForm.value.title.trim(),
			taxNo: invoiceForm.value.titleType === 'company' ? invoiceForm.value.taxNo.trim() : '',
			email: invoiceForm.value.email.trim(),
			remark: invoiceForm.value.remark.trim()
		})

		patchOrderRecord(order.id, {
			invoiceStatus: invoiceResult.status || '待开票',
			invoiceType: invoiceResult.invoice_type || invoiceResult.invoiceType || invoiceForm.value.invoiceType,
			invoiceTitle: invoiceResult.title || invoiceForm.value.title.trim(),
			taxNo: invoiceResult.tax_no || invoiceResult.taxNo || (invoiceForm.value.titleType === 'company' ? invoiceForm.value.taxNo.trim() : ''),
			invoiceEmail: invoiceResult.email || invoiceForm.value.email.trim()
		})
		activeInvoiceOrderId.value = ''
		activeInvoiceTab.value = '待开票'
		uni.showModal({
			title: '提交成功',
			content: '开票申请已提交，后续会在发票与开票中同步审核、开票和电子发票链接。',
			showCancel: false,
			confirmText: '知道了'
		})
	} catch (error) {
		console.warn('submit invoice failed:', error)
		uni.showToast({ title: error.message || '开票申请提交失败', icon: 'none' })
	} finally {
		invoiceSubmitting.value = false
	}
}

const copyInvoiceLink = (order = {}) => {
	const sourceOrder = resolveOrderRecord(order)
	const invoiceLink = sourceOrder.invoiceUrl
	if (!invoiceLink) {
		uni.showToast({ title: '暂无电子发票链接', icon: 'none' })
		return
	}
	uni.setClipboardData({
		data: invoiceLink,
		success: () => uni.showToast({ title: '发票链接已复制', icon: 'success' }),
		fail: () => uni.showToast({ title: '复制失败', icon: 'none' })
	})
}

const handleInvoiceAction = (order = {}) => {
	const sourceOrder = resolveOrderRecord(order)
	const status = getInvoiceStatusKey(sourceOrder)

	if (status === 'issued') {
		copyInvoiceLink(sourceOrder)
		return
	}

	activeModule.value = 'invoices'
	activeInvoiceTab.value = '待开票'
	if (status === 'available') startInvoiceApply(sourceOrder)
}

const restoreLocalBusinessState = () => {
	orderLocalPatches.value = readStorage(localOrderPatchKey, {})
	const records = readStorage(feedbackRecordKey, [])
	feedbackRecords.value = Array.isArray(records) ? records : []
}

const saveFeedbackRecords = () => {
	writeStorage(feedbackRecordKey, feedbackRecords.value)
}

// 拉取服务端反馈单，覆盖本地缓存，使后台处理状态与官方回复实时同步
const syncFeedbackRecords = async () => {
	try {
		const res = await getComplaintList({ page: 1, pageSize: 10 })
		const list = (res && res.list) || []
		if (!Array.isArray(list)) return
		feedbackRecords.value = list.map(normalizeFeedbackRecord)
		saveFeedbackRecords()
	} catch (error) {
		// 网络/登录异常时保留本地缓存，不打断页面
		console.warn('sync feedback records fallback:', error)
	}
}

const getFeedbackRecordImages = () => feedbackImages.value
	.map((item) => ({
		id: item.id,
		url: getPreviewUrl(item),
		fileID: item.fileID || item.fileId || ''
	}))
	.filter((item) => item.url)

const resetFeedbackForm = () => {
	feedbackText.value = ''
	feedbackContactValue.value = ''
	feedbackOrderId.value = ''
	feedbackImages.value = []
}

const addLocalFeedbackRecord = (status = 'submitted', result = {}) => {
	const ticketNo = result.ticketNo || result.ticket_no || result.id || feedbackTicketNo()
	const record = {
		ticketNo,
		type: feedbackType.value,
		content: feedbackText.value.trim(),
		contactType: feedbackContactKind.value,
		contact: feedbackContactValue.value.trim(),
		orderId: feedbackOrderId.value.trim(),
		images: getFeedbackRecordImages(),
		status,
		reply: '',
		time: todayText()
	}
	feedbackRecords.value = [record, ...feedbackRecords.value].slice(0, 10)
	saveFeedbackRecords()
	return record
}

const previewFeedbackRecordImage = (record = {}, index = 0) => {
	const urls = (record.images || []).map((item) => (typeof item === 'string' ? item : item.url)).filter(Boolean)
	if (!urls.length) return
	uni.previewImage({
		current: urls[index] || urls[0],
		urls
	})
}

const previewSurveyPoster = () => {
	uni.previewImage({
		current: surveyPosterUrl,
		urls: [surveyPosterUrl]
	})
}

const openModule = (id, type) => {
	if (id === 'address') {
		openAddressPage()
		return
	}

	previousModule.value = activeModule.value
	activeModule.value = id
	showOfficial.value = false
	showQr.value = false

	if (id === 'invoices') {
		activeInvoiceOrderId.value = ''
		activeInvoiceTab.value = '待开票'
	}

	if (id === 'feedback') {
		syncFeedbackRecords()
	}

	if (id === 'repair') {
		repairStep.value = 1
	}

	if (id === 'orders' && type !== undefined) {
		const typeMap = ['全部', '待处理', '处理中', '已回寄', '未开票', '已开票']
		if (typeof type === 'string') {
			activeOrdersTab.value = normalizeStatusTab(type)
		} else if (typeMap[type]) {
			activeOrdersTab.value = typeMap[type]
		}
	}

}

const closeModule = () => {
	if (activeModule.value === 'order-detail' && (previousModule.value === 'track' || previousModule.value === 'orders' || previousModule.value === 'invoices')) {
		activeModule.value = previousModule.value
		previousModule.value = ''
		return
	}
	activeModule.value = ''
	previousModule.value = ''
}

const openTrackDetail = (order) => {
	requestStatusSubscription('track_view')
	trackDetailOrder.value = order.id
	openModule('order-detail')
}

const openOrderDetail = (order) => {
	orderDetailOrder.value = order.id
	openModule('order-detail')
}

const addRepairProduct = () => {
	repairProductSeed += 1
	repairProducts.value.push(defaultRepairProduct(repairProductSeed))
}

const syncRepairSeeds = () => {
	repairProductSeed = Math.max(1, ...repairProducts.value.map((item) => Number(item.id) || 1))
}

const normalizeRepairProducts = (products = []) => {
	if (!Array.isArray(products) || !products.length) return [defaultRepairProduct()]

	return products.map((item, index) => ({
		id: Number(item.id) || index + 1,
		name: item.name || '',
		model: item.model || '',
		serial: item.serial || '',
		buyDate: item.buyDate || '',
		voucher: item.voucher || '',
		voucherList: Array.isArray(item.voucherList) ? item.voucherList : [],
		faultDesc: item.faultDesc || '',
		media: Array.isArray(item.media) ? item.media : []
	}))
}

const restoreRepairDraft = () => {
	try {
		const draft = uni.getStorageSync(repairDraftKey)
		if (!draft || (!draft.repairForm && !draft.repairProducts)) return

		repairForm.value = {
			...defaultRepairForm(),
			...(draft.repairForm || {})
		}
		repairProducts.value = normalizeRepairProducts(draft.repairProducts)
		syncRepairSeeds()
	} catch (error) {
		console.warn('restore repair draft fallback:', error)
	}
}

const saveRepairDraft = () => {
	try {
		uni.setStorageSync(repairDraftKey, {
			repairForm: repairForm.value,
			repairProducts: repairProducts.value,
			updateTime: Date.now()
		})
		showRepairTools.value = false
		uni.showToast({ title: '草稿已保存', icon: 'success' })
	} catch (error) {
		console.warn('save repair draft fallback:', error)
		uni.showToast({ title: '保存失败，请稍后重试', icon: 'none' })
	}
}

const clearRepairForm = () => {
	repairForm.value = defaultRepairForm()
	repairProducts.value = [defaultRepairProduct()]
	repairProductSeed = 1
	repairMediaSeed = 1
	uni.removeStorageSync(repairDraftKey)
	showRepairTools.value = false
	uni.showToast({ title: '已清空，可重新填写', icon: 'none' })
}

const confirmClearRepair = () => {
	uni.showModal({
		title: '清空当前报修单？',
		content: '清空后，已填写的产品、运单号和附件会被删除，回寄信息会恢复默认值，建议先保存草稿。',
		confirmText: '清空',
		confirmColor: '#E5484D',
		cancelText: '取消',
		success: ({ confirm }) => {
			if (confirm) clearRepairForm()
		}
	})
}

const removeRepairProduct = (index) => {
	if (repairProducts.value.length <= 1) return
	repairProducts.value.splice(index, 1)
}

const chooseFeedbackImages = async () => {
	if (feedbackSubmitting.value) return
	if (feedbackImageUploading.value) return

	const remaining = maxFeedbackImages - feedbackImages.value.length
	if (remaining <= 0) {
		uni.showToast({ title: `最多上传${maxFeedbackImages}张图片`, icon: 'none' })
		return
	}

	let loadingShown = false
	feedbackImageUploading.value = true
	try {
		const chooseRes = await uni.chooseImage({
			count: remaining,
			sizeType: ['compressed'],
			sourceType: ['album', 'camera']
		})
		const paths = chooseRes.tempFilePaths || []
		if (!paths.length) return
		const oversized = (chooseRes.tempFiles || []).find((file) => isFileTooLarge(file, maxRepairImageSize))
		if (oversized) {
			uni.showToast({ title: `图片不能超过${formatFileSize(maxRepairImageSize)}`, icon: 'none' })
			return
		}

		uni.showLoading({ title: '上传中' })
		loadingShown = true

		// 压缩 + 并发上传（原先串行逐张上传，多图时明显更慢）
		const targets = paths.slice(0, remaining)
		const results = await Promise.all(targets.map(async (path) => {
			try {
				const compressed = await compressForUpload(path)
				const uploadRes = await uploadFeedbackImage(compressed)
				return {
					path,
					fileID: normalizeUploadFileId(uploadRes),
					url: normalizeUploadUrl(uploadRes, path)
				}
			} catch (error) {
				console.warn('upload feedback image failed:', error)
				return null
			}
		}))

		const uploadedImages = []
		let failedCount = 0
		for (const item of results) {
			if (feedbackImages.value.length + uploadedImages.length >= maxFeedbackImages) break
			if (item) {
				feedbackImageSeed += 1
				uploadedImages.push({ id: `feedback-img-${feedbackImageSeed}`, ...item })
			} else {
				failedCount += 1
			}
		}

		if (uploadedImages.length) {
			feedbackImages.value = [...feedbackImages.value, ...uploadedImages].slice(0, maxFeedbackImages)
		}

		uni.hideLoading()
		loadingShown = false
		if (failedCount && uploadedImages.length) {
			uni.showToast({ title: '部分图片上传失败', icon: 'none' })
		} else if (failedCount) {
			uni.showToast({ title: '图片上传失败', icon: 'none' })
		} else {
			uni.showToast({ title: '上传成功', icon: 'success' })
		}
	} catch (error) {
		if (!isPickerCancel(error)) {
			console.warn('choose feedback image failed:', error)
			uni.showToast({ title: '图片选择失败', icon: 'none' })
		}
	} finally {
		feedbackImageUploading.value = false
		if (loadingShown) uni.hideLoading()
	}
}

const previewFeedbackImage = (index = 0) => {
	const urls = feedbackImages.value.map(getPreviewUrl).filter(Boolean)
	if (!urls.length) return
	uni.previewImage({
		current: urls[index] || urls[0],
		urls
	})
}

const removeFeedbackImage = (imageId) => {
	if (feedbackSubmitting.value || feedbackImageUploading.value) return
	feedbackImages.value = feedbackImages.value.filter((item) => item.id !== imageId)
}

const uploadRepairImage = async (index) => {
	const product = repairProducts.value[index]
	if (!product || product.media.length >= 3) return

	let loadingShown = false
	try {
		const chooseRes = await uni.chooseImage({
			count: 3 - product.media.length,
			sizeType: ['compressed'],
			sourceType: ['album', 'camera']
		})
		const paths = chooseRes.tempFilePaths || []
		if (!paths.length) return
		const oversized = (chooseRes.tempFiles || []).find((file) => isFileTooLarge(file, maxRepairImageSize))
		if (oversized) {
			uni.showToast({ title: `图片不能超过${formatFileSize(maxRepairImageSize)}`, icon: 'none' })
			return
		}

		uni.showLoading({ title: '上传中' })
		loadingShown = true

		// 压缩 + 并发上传
		const slots = Math.max(0, 3 - product.media.length)
		const targets = paths.slice(0, slots)
		const results = await Promise.all(targets.map(async (path) => {
			try {
				const compressed = await compressForUpload(path)
				const uploadRes = await uploadImage(compressed)
				return {
					path,
					fileID: normalizeUploadFileId(uploadRes),
					url: normalizeUploadUrl(uploadRes, path)
				}
			} catch (error) {
				console.warn('upload repair image failed:', error)
				return null
			}
		}))

		let failedCount = 0
		for (const item of results) {
			if (product.media.length >= 3) break
			if (item) {
				repairMediaSeed += 1
				product.media.push({ id: `img-${repairMediaSeed}`, type: 'image', ...item })
			} else {
				failedCount += 1
			}
		}

		uni.hideLoading()
		loadingShown = false
		if (failedCount && failedCount === targets.length) {
			uni.showToast({ title: '图片上传失败', icon: 'none' })
		} else if (failedCount) {
			uni.showToast({ title: '部分图片上传失败', icon: 'none' })
		} else {
			uni.showToast({ title: '上传成功', icon: 'success' })
		}
	} catch (error) {
		if (isPickerCancel(error)) return
		console.warn('upload image fallback:', error)
		const msg = String(error && (error.errMsg || error.message) || '')
		uni.showToast({ title: msg.includes('privacy') ? '请先同意隐私授权后再上传' : '图片选择失败', icon: 'none' })
	} finally {
		if (loadingShown) uni.hideLoading()
	}
}

const uploadRepairVideo = async (index) => {
	const product = repairProducts.value[index]
	if (!product || product.media.length >= 3) return

	let loadingShown = false
	try {
		const chooseRes = await uni.chooseVideo({
			sourceType: ['album', 'camera'],
			compressed: true,
			maxDuration: 60
		})
		if (!chooseRes.tempFilePath) return
		if (isFileTooLarge(chooseRes, maxRepairVideoSize)) {
			uni.showToast({ title: `视频不能超过${formatFileSize(maxRepairVideoSize)}`, icon: 'none' })
			return
		}

		uni.showLoading({ title: '上传中' })
		loadingShown = true
		const uploadRes = await uploadVideo(chooseRes.tempFilePath)
		repairMediaSeed += 1
		product.media.push({
			id: `vid-${repairMediaSeed}`,
			type: 'video',
			path: chooseRes.tempFilePath,
			fileID: normalizeUploadFileId(uploadRes),
			url: normalizeUploadUrl(uploadRes, chooseRes.tempFilePath),
			duration: chooseRes.duration,
			size: chooseRes.size
		})
		uni.hideLoading()
		loadingShown = false
		uni.showToast({ title: '上传成功', icon: 'success' })
	} catch (error) {
		if (isPickerCancel(error)) return
		console.warn('upload video fallback:', error)
		const msg = String(error && (error.errMsg || error.message) || '')
		uni.showToast({ title: msg.includes('privacy') ? '请先同意隐私授权后再上传' : '视频上传失败', icon: 'none' })
	} finally {
		if (loadingShown) uni.hideLoading()
	}
}

const addRepairMedia = (index) => {
	const product = repairProducts.value[index]
	if (!product || product.media.length >= 3) return

	uni.showActionSheet({
		itemList: ['上传图片', '上传视频'],
		success: ({ tapIndex }) => {
			if (tapIndex === 0) uploadRepairImage(index)
			if (tapIndex === 1) uploadRepairVideo(index)
		}
	})
}

const removeRepairMedia = (productIndex, mediaId) => {
	const product = repairProducts.value[productIndex]
	if (!product) return
	product.media = product.media.filter((item) => item.id !== mediaId)
}

const splitRepairMedia = (media = []) => ({
	images: media.filter((item) => item.type === 'image').map(getUploadedUrl).filter(Boolean),
	videos: media.filter((item) => item.type === 'video').map(getUploadedUrl).filter(Boolean)
})

const buildRepairPayload = () => {
	const product = repairProducts.value[0] || {}
	const firstMedia = splitRepairMedia(product.media)
	const trackingNo = normalizeTrackingNo(repairForm.value.trackingNo)
	const receiverPhone = normalizePhone(repairForm.value.receiverPhone)
	return {
		status: 'submitted',
		statusText: '已提交',
		productName: (product.name || product.model || '维修产品').trim(),
		productModel: String(product.model || '').trim(),
		productSerial: String(product.serial || '').trim(),
		faultType: product.faultType || product.faultDesc || '待检测',
		faultDesc: String(product.faultDesc || '').trim(),
		images: firstMedia.images,
		videos: firstMedia.videos,
		logisticsCompany: repairForm.value.logisticsCompany,
		trackingNo,
		sendMethod: repairForm.value.sendMethod,
		senderName: String(repairForm.value.receiverName || '').trim(),
		senderPhone: receiverPhone,
		senderAddress: String(repairForm.value.receiverAddress || '').trim(),
		receiverName: String(repairForm.value.receiverName || '').trim(),
		receiverPhone,
		receiverAddress: String(repairForm.value.receiverAddress || '').trim(),
		receiverUnit: String(repairForm.value.receiverUnit || '').trim(),
		products: repairProducts.value.map((item) => {
			const media = splitRepairMedia(item.media)
			const voucherUrls = (item.voucherList || []).map(getUploadedUrl).filter(Boolean)
			return {
				productName: (item.name || item.model || '维修产品').trim(),
				productModel: String(item.model || '').trim(),
				productSerial: String(item.serial || '').trim(),
				buyDate: item.buyDate,
				voucher: item.voucher,
				voucherImages: voucherUrls,
				faultDesc: String(item.faultDesc || '').trim(),
				images: media.images,
				videos: media.videos
			}
		})
	}
}

const repairStepLabels = ['设备信息', '故障描述', '图片/视频', '寄修信息']

const validateRepairStep = (step) => {
	const products = repairProducts.value
	if (step === 1) {
		for (let i = 0; i < products.length; i += 1) {
			if (!String(products[i].serial || '').trim()) {
				uni.showToast({ title: `第 ${i + 1} 个产品请填写序列号`, icon: 'none' })
				return false
			}
		}
		return true
	}
	if (step === 2) {
		for (let i = 0; i < products.length; i += 1) {
			if (!String(products[i].faultDesc || '').trim()) {
				uni.showToast({ title: `第 ${i + 1} 个产品请填写故障描述`, icon: 'none' })
				return false
			}
		}
		return true
	}
	if (step === 3) {
		for (let i = 0; i < products.length; i += 1) {
			if (!Array.isArray(products[i].media) || !products[i].media.length) {
				uni.showToast({ title: `第 ${i + 1} 个产品请上传故障附件`, icon: 'none' })
				return false
			}
		}
		return true
	}
	return true
}

const nextRepairStep = () => {
	if (!validateRepairStep(repairStep.value)) return
	if (repairStep.value < 4) repairStep.value += 1
}

const prevRepairStep = () => {
	if (repairStep.value > 1) repairStep.value -= 1
}

const goRepairStep = (step) => {
	if (step === repairStep.value) return
	if (step < repairStep.value) { repairStep.value = step; return }
	for (let s = repairStep.value; s < step; s += 1) {
		if (!validateRepairStep(s)) return
	}
	repairStep.value = step
}

const snWarrantyLabel = (info = {}) => {
	const map = { in_warranty: '保修期内', extended: '延保中', expired: '已过保', unknown: '保修未知' }
	return map[info.warrantyStatus] || '保修未知'
}

const recognizeSn = async (index) => {
	const product = repairProducts.value[index]
	if (!product) return
	const sn = String(product.serial || '').trim()
	if (!sn) { product.snInfo = null; return }
	if (!hasLoginToken()) return
	if (product.snLoading) return
	if (product.snInfo && product.snInfo.sn === sn) return
	product.snLoading = true
	try {
		const info = await lookupDeviceBySn(sn)
		product.snInfo = info || { found: false, sn }
		if (info && info.found) {
			if (info.model && !String(product.model || '').trim()) product.model = info.model
			if (info.productName && !String(product.name || '').trim()) product.name = info.productName
			if (info.buyDate && !product.buyDate) product.buyDate = info.buyDate
		}
	} catch (error) {
		console.warn('lookup sn failed:', error)
		product.snInfo = null
	} finally {
		product.snLoading = false
	}
}

const scanSn = (index) => {
	uni.scanCode({
		success: (res) => {
			const code = String(res.result || '').trim()
			if (!code) return
			const product = repairProducts.value[index]
			if (!product) return
			product.serial = code
			recognizeSn(index)
		},
		fail: () => {}
	})
}

const validateRepairForm = () => {
	for (let index = 0; index < repairProducts.value.length; index += 1) {
		const product = repairProducts.value[index] || {}
		const label = `第 ${index + 1} 个产品`
		if (!String(product.serial || '').trim()) {
			uni.showToast({ title: `${label}请填写序列号`, icon: 'none' })
			return false
		}
		if (!String(product.faultDesc || '').trim()) {
			uni.showToast({ title: `${label}请填写故障描述`, icon: 'none' })
			return false
		}
		if (!Array.isArray(product.media) || !product.media.length) {
			uni.showToast({ title: `${label}请上传故障附件`, icon: 'none' })
			return false
		}
	}

	if (!repairForm.value.logisticsCompany) {
		uni.showToast({ title: '请选择物流公司', icon: 'none' })
		return false
	}

	if (!isValidTrackingNo(repairForm.value.trackingNo)) {
		uni.showToast({ title: '请输入正确运单号', icon: 'none' })
		return false
	}

	if (!String(repairForm.value.receiverName || '').trim()) {
		uni.showToast({ title: '请填写收货人', icon: 'none' })
		return false
	}

	if (!isValidPhone(repairForm.value.receiverPhone)) {
		uni.showToast({ title: '请输入正确手机号', icon: 'none' })
		return false
	}

	if (!String(repairForm.value.receiverAddress || '').trim()) {
		uni.showToast({ title: '请填写详细地址', icon: 'none' })
		return false
	}

	if (!String(repairForm.value.receiverUnit || '').trim()) {
		uni.showToast({ title: '请填写单位名称', icon: 'none' })
		return false
	}

	repairForm.value.trackingNo = normalizeTrackingNo(repairForm.value.trackingNo)
	repairForm.value.receiverPhone = normalizePhone(repairForm.value.receiverPhone)
	return true
}

const submitRepair = async () => {
	if (repairSubmitting.value) return
	if (!hasLoginToken()) {
		openModule('login')
		uni.showToast({ title: '请先登录后再提交报修', icon: 'none' })
		return
	}
	if (!validateRepairForm()) return

	await requestStatusSubscription('repair_submit')
	repairSubmitting.value = true
	try {
		const res = await submitRepairOrder(buildRepairPayload())
		const resData = (res && res.data) ? res.data : (res || {})
		submittedOrderId.value = resData.order_no || resData.orderNo || resData.orderId || resData.id || ''
		uni.removeStorageSync(repairDraftKey)
		openModule('repair-success')
		loadRemoteContent()
	} catch (error) {
		if (isAuthError(error)) {
			logoutLocal()
			openModule('login')
			uni.showToast({ title: '登录已失效，请重新登录', icon: 'none' })
			return
		}
		console.warn('submit repair failed:', error)
		uni.showToast({ title: error.message || '提交失败，已保留草稿', icon: 'none' })
	} finally {
		repairSubmitting.value = false
	}
}

const openFaultSheet = () => {
	if (!diagProduct.value) {
		uni.showToast({ title: '请先选择产品类型', icon: 'none' })
		return
	}

	if (!diagFaultOptions.value.length) {
		uni.showToast({ title: '当前产品暂无故障类型，请联系管理员配置', icon: 'none' })
		return
	}

	diagOpen.value = 'fault'
}

const loadFaultResult = async () => {
	if (!diagProduct.value || !diagFault.value) return

	const localRecord = faultRecords.value.find(
		(item) => (item.productTypeId || item.productType || item.productName) === diagProduct.value && item.faultName === diagFault.value
	)
	diagResult.value = localRecord || null

	try {
		const result = await searchFault({
			productType: diagProduct.value,
			faultTypeId: localRecord ? (localRecord.faultTypeId || localRecord.id || '') : ''
		})
		diagResult.value = result || localRecord || null
	} catch (error) {
		console.warn('fault search fallback:', error)
	}
}

const selectDiagOption = (item) => {
	if (diagOpen.value === 'product') {
		diagProduct.value = item.id
		if (diagFault.value && !(diagFaultMap.value[item.id] || []).includes(diagFault.value)) {
			diagFault.value = ''
			diagResult.value = null
		}
	} else {
		diagFault.value = item.title
		loadFaultResult()
	}
	diagOpen.value = ''
}

const resetDiag = () => {
	diagProduct.value = ''
	diagFault.value = ''
	diagOpen.value = ''
	diagResult.value = null
}

const removeVoucher = (productIndex, voucherIndex) => {
	const product = repairProducts.value[productIndex]
	if (!product || !product.voucherList) return
	
	product.voucherList.splice(voucherIndex, 1)
	product.voucher = product.voucherList.map(v => v.path).join(',')
}

const onDateChange = (productIndex, e) => {
	const product = repairProducts.value[productIndex]
	if (!product) return
	product.buyDate = e.detail.value
}

const previewVoucher = (productIndex, voucherIndex) => {
	const product = repairProducts.value[productIndex]
	const voucher = product && product.voucherList ? product.voucherList[voucherIndex] : null
	if (!voucher) return

	const urls = (product.voucherList || []).map(getPreviewUrl).filter(Boolean)
	if (!urls.length) return

	uni.previewImage({
		current: getPreviewUrl(voucher),
		urls
	})
}

const openVoucherPicker = (productIndex) => {
	const product = repairProducts.value[productIndex]
	if (!product) return
	
	if (!product.voucherList) {
		product.voucherList = []
	}
	
	if (product.voucherList.length >= 3) {
		uni.showToast({ title: '最多上传3张凭证', icon: 'none' })
		return
	}
	
	uni.chooseImage({
		count: 3 - product.voucherList.length,
		sourceType: ['album', 'camera'],
		sizeType: ['compressed'],
		success: (chooseRes) => {
			const tempFilePaths = chooseRes.tempFilePaths || []
			const oversized = (chooseRes.tempFiles || []).find((file) => isFileTooLarge(file, maxRepairImageSize))
			if (oversized) {
				uni.showToast({ title: `凭证图片不能超过${formatFileSize(maxRepairImageSize)}`, icon: 'none' })
				return
			}
			tempFilePaths.forEach((path) => {
				product.voucherList.push({
					id: `voucher-${Date.now()}-${Math.random()}`,
					path,
					url: path
				})
			})
			product.voucher = product.voucherList.map(v => v.path).join(',')
			uni.showToast({ title: '上传成功', icon: 'success' })
		},
		fail: (error) => {
			console.warn('choose image cancelled:', error)
		}
	})
}

const parseRegion = (region = '') => {
	const parts = String(region).split('/').map((item) => item.trim())
	return {
		province: parts[0] || '',
		city: parts[1] || '',
		district: parts[2] || ''
	}
}

const saveAddress = async () => {
	if (!addressForm.value.name || !addressForm.value.phone || !addressForm.value.detail) {
		uni.showToast({ title: '请完善地址信息', icon: 'none' })
		return
	}

	const phoneRegex = /^1[3-9]\d{9}$/
	if (!phoneRegex.test(addressForm.value.phone.replace(/\s/g, ''))) {
		uni.showToast({ title: '请输入正确的手机号', icon: 'none' })
		return
	}

	const region = parseRegion(addressForm.value.region)
	const payload = {
		addressId: addressForm.value.addressId,
		name: addressForm.value.name,
		phone: addressForm.value.phone.replace(/\s/g, ''),
		province: region.province,
		city: region.city,
		district: region.district,
		detail: addressForm.value.detail,
		unit: addressForm.value.unit,
		isDefault: addressForm.value.def ? 1 : 0
	}

	try {
		if (payload.addressId) {
			await updateAddress(payload)
		} else {
			const res = await addAddress(payload)
			if (res && res.addressId) {
				addressForm.value.addressId = res.addressId
			}
		}
		uni.showToast({ title: '地址已保存', icon: 'success' })

		setTimeout(() => {
			closeModule()
		}, 1500)
	} catch (error) {
		console.warn('save address fallback:', error)
		uni.showToast({
			title: error.message || '保存地址失败，请重试',
			icon: 'none'
		})
	}
}

const selectRegion = () => {
	uni.showToast({
		title: '地区选择功能开发中',
		icon: 'none'
	})
}

const resetAddressForm = () => {
	addressForm.value = {
		addressId: '',
		name: '',
		phone: '',
		region: '',
		detail: '',
		unit: '',
		def: false
	}
}

const handleDeleteAddress = async () => {
	uni.showModal({
		title: '确认删除',
		content: '删除后将无法恢复，确定要删除这个地址吗？',
		confirmText: '删除',
		confirmColor: '#EF4444',
		success: async (res) => {
			if (res.confirm) {
				try {
					await deleteAddress(addressForm.value.addressId)
					resetAddressForm()
					uni.showToast({ title: '删除成功', icon: 'success' })
					setTimeout(() => {
						closeModule()
					}, 1500)
				} catch (error) {
					console.warn('delete address fallback:', error)
					uni.showToast({ title: '地址接口未开放', icon: 'none' })
				}
			}
		}
	})
}

const submitFeedback = async () => {
	if (feedbackSubmitting.value) return
	if (!feedbackText.value.trim() || !feedbackContactValue.value.trim()) {
		uni.showToast({ title: '请填写反馈内容和联系方式', icon: 'none' })
		return
	}
	if (feedbackImageUploading.value) {
		uni.showToast({ title: '图片上传中，请稍后提交', icon: 'none' })
		return
	}

	feedbackSubmitting.value = true
	try {
		const result = await addComplaint({
			type: feedbackType.value === '投诉' ? 0 : 1,
			content: feedbackText.value.trim(),
			images: feedbackImages.value.map(getUploadedUrl).filter(Boolean).slice(0, maxFeedbackImages),
			contactType: feedbackContactKind.value,
			contact: feedbackContactValue.value.trim(),
			orderId: feedbackOrderId.value.trim()
		})
		const record = addLocalFeedbackRecord('submitted', result || {})
		uni.showModal({
			title: '提交成功',
			content: `反馈单号：${record.ticketNo}。客服回复和处理状态会在“我的反馈单”中展示。`,
			showCancel: false,
			confirmText: '知道了'
		})
		resetFeedbackForm()
		syncFeedbackRecords()
	} catch (error) {
		console.warn('submit feedback fallback:', error)
		const record = addLocalFeedbackRecord('submitted')
		uni.showModal({
			title: '已生成反馈单',
			content: `反馈单号：${record.ticketNo}。网络或登录状态异常，已先在本机保留记录；恢复后可再次提交或由后台同步处理。`,
			showCancel: false,
			confirmText: '知道了'
		})
		resetFeedbackForm()
	} finally {
		feedbackSubmitting.value = false
	}
}

const onGetPhoneNumberLogin = async (event = {}) => {
	const detail = event.detail || {}

	if (detail.errMsg !== 'getPhoneNumber:ok') {
		if (detail.errMsg && detail.errMsg.includes('cancel')) return
		uni.showToast({ title: '授权失败，请重试', icon: 'none' })
		return
	}

	if (!detail.code) {
		uni.showToast({ title: '获取手机号授权失败', icon: 'none' })
		return
	}

	try {
		const loginRes = await uni.login({ provider: 'weixin' })
		if (!loginRes.code) {
			throw new Error('获取微信登录凭证失败')
		}
		const res = await wechatLogin({ code: loginRes.code, phoneCode: detail.code })
		if (applyLoginSession(res)) {
			uni.showToast({ title: '登录成功', icon: 'success' })
		}
	} catch (error) {
		console.warn('wechat phone login failed:', error)
		uni.showToast({ title: error.message || '登录接口暂未开放', icon: 'none' })
	}
}

const applyLoginSession = (res = {}) => {
	if (!res || !res.token) {
		uni.showToast({ title: '登录响应缺少 token', icon: 'none' })
		return false
	}

	uni.setStorageSync('token', res.token)
	uni.setStorageSync('userInfo', res.userInfo || {})
	uni.setStorageSync('isLoggedIn', true)
	currentUser.value = res.userInfo || {}
	logged.value = true
	activeModule.value = ''
	activeTab.value = 'mine'
	return true
}

const onDevLogin = async () => {
	try {
		const res = await devLogin()
		if (applyLoginSession(res)) {
			uni.showToast({ title: '测试登录成功', icon: 'success' })
		}
	} catch (error) {
		console.warn('dev login failed:', error)
		uni.showToast({ title: error.message || '开发登录失败', icon: 'none' })
	}
}

const logoutLocal = () => {
	uni.removeStorageSync('token')
	uni.removeStorageSync('userInfo')
	uni.removeStorageSync('isLoggedIn')
	currentUser.value = {}
	logged.value = false
}

const go = (id, type) => {
	if (tabRoutes[id]) {
		activeTab.value = id
		activeModule.value = ''
		previousModule.value = ''
		return
	}

	if (id === 'address') {
		openAddressPage()
		return
	}

	if (moduleMap[id]) {
		if (id === 'track') requestStatusSubscription('track_view')
		openModule(id, type)
		return
	}

	uni.showToast({ title: '功能已接入当前页面', icon: 'none' })
}

const openAddressPage = () => {
	uni.navigateTo({
		url: '/pages/address/index',
		fail: () => uni.showToast({ title: '收货地址页面暂不可用', icon: 'none' })
	})
}

const openCustomerService = () => {
	uni.showToast({ title: '正在连接客服...', icon: 'none' })
}

const makePhoneCall = () => {
	uni.makePhoneCall({
		phoneNumber: '13929198537',
		success: () => {},
		fail: (error) => {
			console.warn('make phone call failed:', error)
			uni.showToast({ title: '拨打电话失败', icon: 'none' })
		}
	})
}

const callPhone = (phoneNumber) => {
	uni.makePhoneCall({
		phoneNumber: phoneNumber.replace(/\s/g, ''),
		success: () => {},
		fail: (error) => {
			console.warn('make phone call failed:', error)
			uni.showToast({ title: '拨打电话失败', icon: 'none' })
		}
	})
}

const handleSearch = () => {
	// 待后端接口建立后恢复
	// go('guide-query')
	
	// 临时拦截：搜索功能正在优化中
	uni.showModal({
		title: '提示',
		content: '搜索功能正在优化中，敬请期待！',
		showCancel: false,
		confirmText: '知道了'
	})
}

onLoad((options = {}) => {
	const type = Number(options.type)
	const routeType = Number.isInteger(type) ? type : undefined

	if (options.module && moduleMap[options.module]) {
		openModule(options.module, routeType)
		return
	}

	if (routeType !== undefined) {
		openModule('orders', routeType)
	}
})

onShow(() => {
	logBoot('onShow triggered')
	// 每次切回页面都自动重新拉取一次最新的后端数据
	if (pageBootReady.value) {
		loadRemoteContent()
	}
})

onPullDownRefresh(async () => {
	logBoot('onPullDownRefresh triggered')
	try {
		await loadRemoteContent()
	} finally {
		uni.stopPullDownRefresh()
	}
})

const loadRemoteContent = async () => {
	const tasks = [
		getWarrantyPolicy()
			.then((doc) => updateDoc('warranty', doc))
			.catch((error) => console.warn('warranty fallback:', error)),
		getFeePolicy()
			.then((doc) => updateDoc('fees', doc))
			.catch((error) => console.warn('fee fallback:', error)),
		getWarrantyExtra()
			.then((data = {}) => {
				warrantyGroups.value = Array.isArray(data.groups) ? data.groups : []
				extendedWarranty.value = data.extended || { desc: '', fee: '', rules: '' }
			})
			.catch((error) => console.warn('warranty extra fallback:', error)),
		getFeeTiers()
			.then((list) => { feeTiers.value = Array.isArray(list) ? list : [] })
			.catch((error) => console.warn('fee tiers fallback:', error)),
		getGuide('quick')
			.then((doc) => updateDoc('guide-quick', doc))
			.catch((error) => console.warn('quick guide fallback:', error)),
		getGuide('repair')
			.then((doc) => updateDoc('guide-repair', doc))
			.catch((error) => console.warn('repair guide fallback:', error)),
		getGuide('query')
			.then((doc) => updateDoc('guide-query', doc))
			.catch((error) => console.warn('query guide fallback:', error)),
		getGuide('invoice')
			.then((doc) => updateDoc('guide-invoice', doc))
			.catch((error) => console.warn('invoice guide fallback:', error)),
		getContact()
			.then((data) => applyContact(data))
			.catch((error) => console.warn('contact fallback:', error)),
		getCustomerService()
			.then((data = {}) => {
				customerService.value = {
					...customerService.value,
					...data,
					qrcodeUrl: normalizeQrUrl(data.qrcodeUrl),
					wechat: data.wechat || data.wechatId || customerService.value.wechat
				}
			})
			.catch((error) => console.warn('customer service fallback:', error)),
		getWechat()
			.then((data = {}) => {
				wechatInfo.value = {
					...wechatInfo.value,
					...data,
					qrcodeUrl: normalizeQrUrl(data.qrcodeUrl)
				}
			})
			.catch((error) => console.warn('wechat fallback:', error)),
		getFaultTypes()
			.then((list) => applyFaultTypes(list))
			.catch((error) => console.warn('fault types fallback:', error)),
		getProductList({ page: 1, size: 50 })
			.then((data = {}) => {
				const list = Array.isArray(data) ? data : data.list
				productList.value = Array.isArray(list) ? list.map(normalizeProduct).filter((item) => item.sn || item.title) : []
			})
			.catch((error) => console.warn('product list failed:', error)),
		getRepairList({ page: 1, size: 30 })
			.then((data = {}) => {
				const list = Array.isArray(data) ? data : (data.list || data.data || [])
				if (!Array.isArray(list)) return
				orderLocalPatches.value = readStorage(localOrderPatchKey, orderLocalPatches.value || {})
				const normalized = list.map(normalizeOrder).filter((item) => item.id)
				orderList.value = normalized
				trackOrders.value = normalized
				hydrateOrderDetails(normalized).catch((error) => console.warn('repair detail hydrate failed:', error))
			})
			.catch((error) => console.warn('repair list failed:', error))
	]

	await Promise.allSettled(tasks)
	maybeShowHomeGuidePopup()
}

onMounted(() => {
	logBoot('onMounted start')
	initModuleSafeArea()
	setTimeout(() => {
		pageBootReady.value = true
		logBoot('full page enabled')
	}, 80)
	setTimeout(() => {
		logBoot('deferred boot start')
		restoreLocalBusinessState()
		restoreRepairDraft()
		loadRemoteContent()
	}, 220)
})
</script>

<style scoped>
.page-shell {
	position: relative;
	width: 100%;
	min-height: 100vh;
	color: #0F1F3A;
	background: #E8EEFA;
	font-family: "PingFang SC", "Microsoft YaHei", sans-serif;
}

.page-scroll {
	width: 100%;
	min-height: 100vh;
	padding-bottom: 180rpx;
	background: #E8EEFA;
	box-sizing: border-box;
}

.boot-screen {
	min-height: 100vh;
	padding: 48rpx;
	display: flex;
	align-items: center;
	justify-content: center;
	background:
		radial-gradient(circle at top, rgba(30, 111, 224, 0.14), transparent 42%),
		linear-gradient(180deg, #EEF4FF 0%, #E8EEFA 100%);
	box-sizing: border-box;
}

.boot-card {
	width: 100%;
	max-width: 560rpx;
	padding: 56rpx 40rpx;
	border-radius: 36rpx;
	display: flex;
	flex-direction: column;
	align-items: center;
	background: rgba(255, 255, 255, 0.92);
	box-shadow: 0 20rpx 56rpx rgba(15, 31, 58, 0.08);
	box-sizing: border-box;
}

.boot-logo {
	width: 148rpx;
	height: 148rpx;
}

.boot-title {
	margin-top: 24rpx;
	font-size: 36rpx;
	font-weight: 700;
	line-height: 1.35;
	color: #0F1F3A;
}

.boot-desc {
	margin-top: 14rpx;
	font-size: 26rpx;
	line-height: 1.7;
	text-align: center;
	color: #5A6C8D;
}

.home-body {
	min-height: 100vh;
	padding-bottom: 220rpx;
	background: #E8EEFA;
}

.tap {
	transition-property: opacity, transform;
	transition-duration: 120ms;
}

.tap:active {
	opacity: 0.82;
	transform: scale(0.98);
}

.module-page {
	min-height: 100vh;
	padding-bottom: 188rpx;
	background: #E8EEFA;
	box-sizing: border-box;
}

.module-head {
	position: sticky;
	top: 0;
	z-index: 20;
	min-height: 176rpx;
	padding: 72rpx 28rpx 24rpx;
	display: flex;
	align-items: center;
	gap: 20rpx;
	background: rgba(232, 238, 250, 0.96);
	box-shadow: 0 8rpx 24rpx rgba(15, 31, 58, 0.05);
	box-sizing: border-box;
}

.back-button {
	position: relative;
	width: 64rpx;
	height: 64rpx;
	flex-shrink: 0;
	border-radius: 999rpx;
	background: #FFFFFF;
	box-shadow: 0 4rpx 16rpx rgba(30, 111, 224, 0.08);
}

.back-button::before {
	content: "";
	position: absolute;
	left: 25rpx;
	top: 20rpx;
	width: 18rpx;
	height: 18rpx;
	border-left: 4rpx solid #1E6FE0;
	border-bottom: 4rpx solid #1E6FE0;
	transform: rotate(45deg);
}

.module-title-wrap {
	min-width: 0;
	flex: 1;
	display: flex;
	flex-direction: column;
}

.module-title {
	font-size: 36rpx;
	font-weight: 700;
	line-height: 1.25;
	color: #0F1F3A;
}

.module-subtitle {
	margin-top: 6rpx;
	font-size: 23rpx;
	line-height: 1.4;
	color: #6B7C97;
}

.module-content {
	padding: 28rpx;
	box-sizing: border-box;
}

.notice-card,
.form-card,
.order-list-card,
.survey-card,
.check-card,
.policy-card,
.doc-card,
.contact-page-card {
	margin-bottom: 24rpx;
	padding: 32rpx;
	border-radius: 28rpx;
	background: #FFFFFF;
	box-shadow: 0 2rpx 4rpx rgba(15, 31, 58, 0.04), 0 8rpx 28rpx rgba(30, 111, 224, 0.05);
	box-sizing: border-box;
}

.notice-card {
	background: linear-gradient(135deg, #F3F8FF 0%, #FFFFFF 100%);
	border: 2rpx solid #D7E3FA;
}

.notice-title,
.form-title,
.survey-title,
.check-title,
.policy-title,
.doc-title,
.contact-page-title {
	display: block;
	font-size: 30rpx;
	font-weight: 700;
	line-height: 1.3;
	color: #0F1F3A;
}

.notice-desc,
.auth-desc,
.survey-desc,
.check-desc,
.policy-desc,
.contact-page-desc {
	display: block;
	margin-top: 12rpx;
	font-size: 25rpx;
	line-height: 1.7;
	color: #324563;
}

.form-title-line {
	display: flex;
	align-items: center;
	justify-content: space-between;
	margin-bottom: 8rpx;
}

.add-product {
	font-size: 24rpx;
	font-weight: 600;
	color: #1E6FE0;
}

.field-row {
	min-height: 92rpx;
	display: flex;
	align-items: center;
	justify-content: space-between;
	gap: 24rpx;
	border-bottom: 2rpx solid #F1F5FB;
	font-size: 26rpx;
	color: #324563;
}

.field-row input {
	min-width: 0;
	flex: 1;
	text-align: right;
	font-size: 26rpx;
	color: #0F1F3A;
}

.field-value {
	flex: 1;
	text-align: right;
	color: #94A3B8;
	line-height: 1.5;
}

.textarea-box {
	margin-top: 24rpx;
	min-height: 144rpx;
	padding: 24rpx;
	border-radius: 20rpx;
	background: #F3F8FF;
	font-size: 25rpx;
	line-height: 1.6;
	color: #94A3B8;
	box-sizing: border-box;
}

.upload-grid {
	margin-top: 24rpx;
	display: flex;
	gap: 20rpx;
}

.upload-box {
	width: 180rpx;
	height: 150rpx;
	display: flex;
	flex-direction: column;
	align-items: center;
	justify-content: center;
	gap: 10rpx;
	border: 2rpx dashed #BFD6F7;
	border-radius: 22rpx;
	background: #F8FBFF;
	color: #1E6FE0;
	font-size: 24rpx;
	box-sizing: border-box;
}

.upload-box text:first-child {
	font-size: 44rpx;
	font-weight: 300;
	line-height: 1;
}

.helper-text {
	display: block;
	margin-top: 16rpx;
	font-size: 22rpx;
	line-height: 1.5;
	color: #94A3B8;
}

.module-receiver {
	margin: 0 0 24rpx;
	background: #E2EAF8;
}

.primary-button {
	height: 96rpx;
	display: flex;
	align-items: center;
	justify-content: center;
	border-radius: 999rpx;
	background: linear-gradient(180deg, #2A6CD3 0%, #0A4FB8 100%);
	box-shadow: 0 20rpx 48rpx -20rpx rgba(10, 79, 184, 0.55);
	color: #FFFFFF;
	font-size: 30rpx;
	font-weight: 700;
}

.primary-button.disabled {
	opacity: 0.68;
	pointer-events: none;
}

.status-tabs {
	margin-bottom: 24rpx;
	padding: 8rpx;
	display: flex;
	border-radius: 999rpx;
	background: #D7E3FA;
}

.status-tab {
	flex: 1;
	height: 64rpx;
	display: flex;
	align-items: center;
	justify-content: center;
	border-radius: 999rpx;
	font-size: 24rpx;
	font-weight: 600;
	color: #6B7C97;
}

.status-tab.on {
	background: #FFFFFF;
	color: #1E6FE0;
	box-shadow: 0 4rpx 14rpx rgba(30, 111, 224, 0.12);
}

.order-list-head {
	display: flex;
	align-items: center;
	justify-content: space-between;
	font-size: 25rpx;
	font-weight: 600;
	color: #6B7C97;
}

.order-state {
	padding: 6rpx 16rpx;
	border-radius: 999rpx;
	font-size: 22rpx;
	font-weight: 700;
}

.state-fixing {
	background: #E0F2FE;
	color: #0369A1;
}

.state-shipped {
	background: #DCFCE7;
	color: #047857;
}

.order-device {
	display: block;
	margin-top: 18rpx;
	font-size: 30rpx;
	font-weight: 700;
	line-height: 1.3;
	color: #0F1F3A;
}

.timeline {
	margin-top: 24rpx;
}

.timeline-row {
	position: relative;
	padding: 0 0 28rpx 40rpx;
}

.timeline-row::before {
	content: "";
	position: absolute;
	left: 11rpx;
	top: 22rpx;
	bottom: -2rpx;
	width: 2rpx;
	background: #D7E3FA;
}

.timeline-row:last-child::before {
	display: none;
}

.timeline-dot {
	position: absolute;
	left: 0;
	top: 4rpx;
	width: 24rpx;
	height: 24rpx;
	border: 4rpx solid #C4D1E4;
	border-radius: 999rpx;
	background: #FFFFFF;
	box-sizing: border-box;
}

.timeline-row.done .timeline-dot {
	border-color: #1E6FE0;
	background: #1E6FE0;
}

.timeline-copy {
	display: flex;
	flex-direction: column;
	gap: 4rpx;
}

.timeline-copy text:first-child {
	font-size: 26rpx;
	font-weight: 600;
	color: #0F1F3A;
}

.timeline-copy text:last-child {
	font-size: 22rpx;
	color: #94A3B8;
}

.survey-card {
	display: flex;
	flex-direction: column;
	align-items: center;
	text-align: center;
	background: linear-gradient(180deg, #FFFFFF 0%, #F3F8FF 100%);
}

.tag-row {
	margin-top: 28rpx;
	display: flex;
	flex-wrap: wrap;
	justify-content: center;
	gap: 16rpx;
}

.tag-row text {
	padding: 8rpx 18rpx;
	border-radius: 999rpx;
	background: #E8F1FE;
	color: #0A4FB8;
	font-size: 23rpx;
	font-weight: 600;
}

.check-card {
	border-left: 6rpx solid #1E6FE0;
}

.policy-card {
	background: #FFFFFF;
}

.policy-card::before {
	content: "";
	display: block;
	width: 52rpx;
	height: 8rpx;
	margin-bottom: 22rpx;
	border-radius: 999rpx;
	background: #1E6FE0;
}

.doc-card {
	padding: 36rpx 32rpx;
}

.doc-step {
	margin-top: 28rpx;
	display: flex;
	align-items: flex-start;
	gap: 18rpx;
	font-size: 27rpx;
	line-height: 1.7;
	color: #324563;
}

.doc-index {
	width: 44rpx;
	height: 44rpx;
	display: flex;
	align-items: center;
	justify-content: center;
	flex-shrink: 0;
	border-radius: 999rpx;
	background: #1E6FE0;
	color: #FFFFFF;
	font-size: 24rpx;
	font-weight: 700;
	line-height: 1;
}

.contact-page-card {
	text-align: center;
	background: linear-gradient(135deg, #2A6CD3 0%, #0A4FB8 100%);
	color: #FFFFFF;
}

.contact-page-title,
.contact-page-desc {
	color: #FFFFFF;
}

.contact-page-phone {
	display: block;
	margin-top: 16rpx;
	font-size: 44rpx;
	font-weight: 800;
	letter-spacing: 1rpx;
	color: #FFFFFF;
}

.brand-bar {
	padding: 60rpx 188rpx 22rpx 34rpx;
	display: flex;
	align-items: flex-start;
	justify-content: space-between;
	gap: 18rpx;
	background: #E8EEFA;
	box-sizing: border-box;
}

.vi-header {
	padding: 50rpx 34rpx 30rpx !important;
	background: #E8EEFA;
}

.vi-header-content {
	display: flex;
	flex-direction: column;
	align-items: flex-start;
}

.vi-brand-group {
	display: flex;
	align-items: baseline;
	position: relative;
}

.vi-brand-group.large {
	margin-bottom: 10rpx;
}

.vi-en {
	font-family: "Times New Roman", Times, Georgia, serif !important;
	color: #00AEEF;
	font-weight: bold;
	letter-spacing: 0.5px;
	font-size: 42rpx;
	margin-right: 12rpx;
}

.vi-cn {
	font-family: "Microsoft YaHei", sans-serif;
	color: #1A1A1A;
	font-weight: 900;
	font-size: 38rpx;
}

.large .vi-en {
	font-size: 64rpx;
	margin-right: 20rpx;
}

.large .vi-cn {
	font-size: 58rpx;
}

.vi-tm {
	font-family: "Times New Roman", Times, Georgia, serif !important;
	font-size: 18rpx;
	color: #1A1A1A;
	font-weight: normal;
	position: relative;
	top: -0.8em;
	margin-left: 2rpx;
}

.vi-header-slogan {
	margin-top: 4rpx;
	font-size: 18rpx;
	color: #1A1A1A;
	letter-spacing: 6rpx;
	opacity: 0.9;
}

.vi-banner-card {
	background: #FFFFFF !important;
	display: flex;
	align-items: center;
	justify-content: center;
	border: 1rpx solid rgba(16, 38, 74, 0.08);
	box-shadow: 0 10rpx 30rpx rgba(16, 38, 74, 0.05) !important;
}

.vi-banner-content {
	display: flex;
	flex-direction: column;
	align-items: center;
	text-align: center;
}

.vi-banner-slogan {
	margin-top: 16rpx;
	font-size: 22rpx;
	color: #1A1A1A;
	letter-spacing: 10rpx;
	font-weight: 500;
}

.vi-side-tab {
	padding: 24rpx 20rpx 24rpx 32rpx !important;
}

.vi-side-wordmark {
	display: flex;
	align-items: baseline;
	margin-bottom: 4rpx;
}

.vi-side-wordmark .vi-en {
	color: #FFFFFF;
	font-size: 26rpx;
	margin-right: 4rpx;
}

.vi-side-wordmark .vi-tm {
	color: #FFFFFF;
	font-size: 12rpx;
	top: -0.5em;
}

.brand-left {
	min-width: 0;
	flex: 1;
	display: flex;
	flex-direction: column;
	align-items: flex-start;
	gap: 5rpx;
}

.brand-logo {
	width: 280rpx;
	height: 88rpx;
	flex-shrink: 0;
}

.home-brand-logo {
	width: 168rpx;
	height: 38rpx;
}

.home-brand-subtitle {
	padding-left: 4rpx;
	font-family: "Microsoft YaHei", "PingFang SC", sans-serif;
	font-size: 25rpx;
	font-weight: 800;
	letter-spacing: 0.6rpx;
	line-height: 1.18;
	color: #10264A;
}

.search-wrap {
	padding: 0 28rpx;
}

.search-box {
	height: 76rpx;
	padding: 0 28rpx;
	display: flex;
	align-items: center;
	gap: 16rpx;
	border-radius: 24rpx;
	background: #FFFFFF;
	box-shadow: 0 2rpx 4rpx rgba(15, 31, 58, 0.03), 0 8rpx 24rpx rgba(30, 111, 224, 0.04);
	box-sizing: border-box;
}

.search-input {
	min-width: 0;
	flex: 1;
	height: 76rpx;
	font-size: 27rpx;
	color: #0F1F3A;
}

.input-placeholder {
	color: #94A3B8;
}

.search-action {
	font-size: 26rpx;
	font-weight: 600;
	color: #1E6FE0;
}

.official-follow-bar {
	margin: 18rpx 28rpx 0;
	min-height: 70rpx;
	padding: 0 20rpx 0 18rpx;
	display: flex;
	align-items: center;
	gap: 14rpx;
	border: 1rpx solid rgba(30, 111, 224, 0.12);
	border-radius: 22rpx;
	background: linear-gradient(135deg, rgba(255, 255, 255, 0.86) 0%, rgba(239, 246, 255, 0.92) 100%);
	box-shadow: 0 8rpx 24rpx rgba(30, 111, 224, 0.06);
	box-sizing: border-box;
}

.official-follow-avatar {
	width: 44rpx;
	height: 44rpx;
	flex-shrink: 0;
	border-radius: 12rpx;
	border: 3rpx solid rgba(255, 255, 255, 0.9);
	box-shadow: 0 6rpx 14rpx rgba(37, 153, 199, 0.16);
	box-sizing: border-box;
}

.official-follow-text {
	min-width: 0;
	flex: 1;
	font-size: 24rpx;
	font-weight: 600;
	line-height: 1.35;
	color: #385273;
	white-space: nowrap;
	overflow: hidden;
	text-overflow: ellipsis;
}

.official-follow-arrow {
	width: 14rpx;
	height: 14rpx;
	flex-shrink: 0;
	border-right: 3rpx solid #7EA4D4;
	border-bottom: 3rpx solid #7EA4D4;
	transform: rotate(-45deg);
}

.hero-wrap {
	padding: 22rpx 28rpx 0;
}

.hero-card {
	position: relative;
	height: 280rpx;
	overflow: hidden;
	border-radius: 28rpx;
	background: linear-gradient(120deg, #2C5985 0%, #4A8AB8 50%, #6BB0CC 100%);
	box-shadow: 0 10rpx 30rpx rgba(44, 89, 133, 0.14);
}

.hero-media {
	position: absolute;
	top: 0;
	right: 0;
	bottom: 0;
	width: 55%;
}

.hero-image {
	width: 100%;
	height: 100%;
}

.hero-media-mask {
	position: absolute;
	inset: 0;
	background: linear-gradient(90deg, rgba(44, 89, 133, 0.85) 0%, rgba(44, 89, 133, 0.15) 50%, rgba(0, 0, 0, 0.18) 100%);
}

.hero-copy {
	position: relative;
	z-index: 1;
	height: 100%;
	padding: 48rpx 36rpx;
	display: flex;
	flex-direction: column;
	justify-content: center;
	color: #FFFFFF;
	box-sizing: border-box;
}

.hero-title {
	font-size: 36rpx;
	font-weight: 700;
	line-height: 1.25;
	letter-spacing: 1rpx;
}

.hero-subtitle {
	margin-top: 16rpx;
	font-size: 24rpx;
	line-height: 1.3;
	color: rgba(255, 255, 255, 0.9);
	letter-spacing: 1rpx;
}

.section {
	padding-left: 28rpx;
	padding-right: 28rpx;
	box-sizing: border-box;
}

.section-basic {
	padding-top: 48rpx;
}

.section-query,
.section-guide,
.section-contact {
	padding-top: 44rpx;
}

.section-title {
	display: block;
	padding: 0 4rpx 24rpx;
	font-size: 32rpx;
	font-weight: 700;
	line-height: 1.25;
	color: #0F1F3A;
}

.section-line {
	display: flex;
	align-items: center;
	justify-content: space-between;
	padding: 0 4rpx 24rpx;
}

.section-line .section-title {
	padding: 0;
}

.section-meta {
	font-size: 23rpx;
	line-height: 1.2;
	color: #94A3B8;
}

.three-grid {
	display: flex;
	align-items: stretch;
	justify-content: space-between;
}

.query-grid {
	display: flex;
	align-items: stretch;
	justify-content: space-between;
	flex-wrap: wrap;
	gap: 20rpx 0;
}

.query-grid .service-card {
	width: 337rpx;
	min-height: 172rpx;
	padding: 30rpx 16rpx;
}

.service-card {
	width: 218rpx;
	padding: 36rpx 16rpx;
	display: flex;
	flex-direction: column;
	align-items: center;
	gap: 20rpx;
	border-radius: 28rpx;
	background: #FFFFFF;
	box-shadow: 0 2rpx 4rpx rgba(15, 31, 58, 0.04), 0 8rpx 28rpx rgba(30, 111, 224, 0.05);
	box-sizing: border-box;
}

.service-icon {
	width: 96rpx;
	height: 96rpx;
	display: flex;
	align-items: center;
	justify-content: center;
	border-radius: 999rpx;
}

.service-title {
	font-size: 26rpx;
	font-weight: 500;
	line-height: 1.2;
	color: #0F1F3A;
}

.two-grid {
	display: flex;
	align-items: stretch;
	justify-content: space-between;
	flex-wrap: wrap;
	gap: 20rpx 0;
}

.guide-card {
	width: 337rpx;
	min-height: 96rpx;
	padding: 28rpx;
	display: flex;
	align-items: center;
	gap: 20rpx;
	border-radius: 24rpx;
	background: #FFFFFF;
	box-shadow: 0 2rpx 4rpx rgba(15, 31, 58, 0.04), 0 8rpx 24rpx rgba(30, 111, 224, 0.05);
	box-sizing: border-box;
}

.guide-icon {
	width: 68rpx;
	height: 68rpx;
	display: flex;
	align-items: center;
	justify-content: center;
	flex-shrink: 0;
	border-radius: 18rpx;
	background: #E8F1FE;
	color: #1E6FE0;
}

.guide-title {
	min-width: 0;
	flex: 1;
	font-size: 27rpx;
	font-weight: 500;
	line-height: 1.25;
	color: #0F1F3A;
}

.chevron {
	position: relative;
	width: 16rpx;
	height: 24rpx;
	flex-shrink: 0;
}

.chevron::before {
	content: "";
	position: absolute;
	top: 4rpx;
	left: 0;
	width: 14rpx;
	height: 14rpx;
	border-top: 3rpx solid #C4D1E4;
	border-right: 3rpx solid #C4D1E4;
	transform: rotate(45deg);
	box-sizing: border-box;
}

.contact-card {
	width: 337rpx;
	min-height: 104rpx;
	padding: 28rpx;
	display: flex;
	align-items: center;
	gap: 20rpx;
	border-radius: 24rpx;
	background: #D7E3FA;
	box-shadow: 0 4rpx 16rpx rgba(30, 111, 224, 0.08);
	box-sizing: border-box;
}

.contact-icon {
	width: 76rpx;
	height: 76rpx;
	display: flex;
	align-items: center;
	justify-content: center;
	flex-shrink: 0;
	border-radius: 999rpx;
	background: rgba(255, 255, 255, 0.6);
	color: #1E6FE0;
}

.contact-copy {
	min-width: 0;
	display: flex;
	flex-direction: column;
}

.contact-title {
	font-size: 27rpx;
	font-weight: 700;
	line-height: 1.2;
	color: #0F1F3A;
}

.contact-desc {
	margin-top: 6rpx;
	font-size: 22rpx;
	line-height: 1.2;
	color: #1E6FE0;
}

.receiver-wrap {
	padding: 36rpx 28rpx 0;
}

.receiver-card {
	padding: 32rpx 32rpx 12rpx;
	border-radius: 28rpx;
	background: #E2EAF8;
	box-shadow: 0 4rpx 18rpx rgba(30, 111, 224, 0.08);
	box-sizing: border-box;
}

.receiver-head {
	padding-bottom: 24rpx;
	display: flex;
	align-items: center;
	gap: 16rpx;
	border-bottom: 2rpx solid rgba(30, 111, 224, 0.18);
	font-size: 30rpx;
	font-weight: 700;
	line-height: 1.2;
	color: #0F1F3A;
}

.receiver-row {
	padding: 24rpx 0 20rpx;
	border-bottom: 2rpx dashed rgba(30, 111, 224, 0.12);
}

.receiver-row-last {
	border-bottom: none;
}

.receiver-line {
	display: flex;
	align-items: flex-start;
	justify-content: space-between;
	gap: 16rpx;
}

.receiver-text {
	min-width: 0;
	flex: 1;
	display: flex;
	flex-direction: column;
}

.receiver-label {
	font-size: 23rpx;
	line-height: 1.2;
	color: #6B7C97;
}

.receiver-value {
	margin-top: 6rpx;
	font-size: 27rpx;
	font-weight: 600;
	line-height: 1.5;
	color: #0F1F3A;
}

.copy-button {
	width: 52rpx;
	height: 52rpx;
	margin-top: 4rpx;
	display: flex;
	align-items: center;
	justify-content: center;
	flex-shrink: 0;
}

.copy-row {
	padding: 28rpx 28rpx 0;
	display: flex;
	align-items: center;
	gap: 24rpx;
}

.copy-all {
	height: 100rpx;
	min-width: 0;
	flex: 1;
	display: flex;
	align-items: center;
	justify-content: center;
	gap: 16rpx;
	border-radius: 999rpx;
	background: linear-gradient(180deg, #2A6CD3 0%, #0A4FB8 100%);
	box-shadow: 0 20rpx 48rpx -20rpx rgba(10, 79, 184, 0.55);
	color: #FFFFFF;
	font-size: 29rpx;
	font-weight: 600;
	box-sizing: border-box;
}

.chat-round {
	width: 100rpx;
	height: 100rpx;
	display: flex;
	align-items: center;
	justify-content: center;
	flex-shrink: 0;
	border-radius: 999rpx;
	background: #FFFFFF;
	color: #1E6FE0;
	box-shadow: 0 12rpx 28rpx -8rpx rgba(15, 31, 58, 0.18);
}

.company-body {
	min-height: 100vh;
	padding: 56rpx 28rpx 220rpx;
	background: #E8EEFA;
	box-sizing: border-box;
}

.company-brand {
	margin-bottom: 28rpx;
	display: flex;
	align-items: center;
	justify-content: flex-start;
}

.company-hero {
	position: relative;
	height: 480rpx;
	overflow: hidden;
	border-radius: 28rpx;
	background: linear-gradient(135deg, #1A3C5C 0%, #2C5985 50%, #4A7BA6 100%);
	box-shadow: 0 10rpx 28rpx rgba(44, 89, 133, 0.16);
}

.company-hero-image {
	position: absolute;
	inset: 0;
	width: 100%;
	height: 100%;
}

.company-hero-mask {
	position: absolute;
	inset: 0;
	background: linear-gradient(180deg, rgba(15, 46, 102, 0.35) 0%, rgba(15, 31, 58, 0.65) 100%);
}

.company-hero-logo {
	position: absolute;
	top: 28rpx;
	right: 28rpx;
	width: 320rpx;
	height: 96rpx;
}

.company-hero-title-wrap {
	position: absolute;
	left: 0;
	right: 0;
	bottom: 0;
	padding: 72rpx 36rpx 36rpx;
	display: flex;
	flex-direction: column;
	gap: 14rpx;
	background: linear-gradient(180deg, transparent 0%, rgba(15, 31, 58, 0.55) 100%);
}

.company-hero-kicker {
	align-self: flex-start;
	padding: 8rpx 16rpx;
	border: 1rpx solid rgba(255, 255, 255, 0.42);
	border-radius: 999rpx;
	background: rgba(255, 255, 255, 0.14);
	font-size: 22rpx;
	line-height: 1.2;
	color: #FFFFFF;
}

.company-hero-title {
	font-size: 36rpx;
	font-weight: 700;
	line-height: 1.3;
	color: #FFFFFF;
	letter-spacing: 1.2rpx;
}

.company-hero-subtitle {
	width: 92%;
	font-size: 24rpx;
	line-height: 1.58;
	color: rgba(255, 255, 255, 0.86);
}

.company-stats-grid {
	margin-top: 24rpx;
	display: flex;
	flex-wrap: wrap;
	gap: 18rpx;
}

.company-stat-card {
	width: calc((100% - 18rpx) / 2);
	padding: 26rpx 24rpx;
	border-radius: 24rpx;
	background: #FFFFFF;
	box-shadow: 0 2rpx 4rpx rgba(15, 31, 58, 0.04), 0 8rpx 28rpx rgba(30, 111, 224, 0.05);
	box-sizing: border-box;
}

.company-stat-value {
	display: block;
	font-size: 42rpx;
	font-weight: 800;
	line-height: 1.05;
	color: #1E6FE0;
}

.company-stat-label {
	display: block;
	margin-top: 10rpx;
	font-size: 25rpx;
	font-weight: 700;
	line-height: 1.2;
	color: #0F1F3A;
}

.company-stat-desc {
	display: block;
	margin-top: 8rpx;
	font-size: 21rpx;
	line-height: 1.3;
	color: #6B7C97;
}

.company-intro-card {
	margin-top: 24rpx;
	padding: 34rpx 32rpx;
	border-radius: 28rpx;
	background: linear-gradient(180deg, #FFFFFF 0%, #F7FAFF 100%);
	box-shadow: 0 2rpx 4rpx rgba(15, 31, 58, 0.04), 0 8rpx 28rpx rgba(30, 111, 224, 0.05);
	box-sizing: border-box;
}

.company-intro-label {
	display: block;
	margin-bottom: 18rpx;
	font-size: 30rpx;
	font-weight: 800;
	line-height: 1.2;
	color: #0F1F3A;
}

.company-intro-text {
	display: block;
	margin-top: 14rpx;
	font-size: 27rpx;
	line-height: 1.7;
	color: #324563;
	letter-spacing: 0.4rpx;
}

.company-section {
	padding-top: 44rpx;
}

.rule-title {
	padding: 0 4rpx 24rpx;
	display: flex;
	align-items: center;
	gap: 12rpx;
	font-size: 30rpx;
	font-weight: 700;
	line-height: 1.2;
	color: #0F1F3A;
	letter-spacing: 0.6rpx;
}

.rule-title > view {
	width: 6rpx;
	height: 28rpx;
	border-radius: 4rpx;
	background: #1E6FE0;
}

.auth-card {
	margin-bottom: 20rpx;
	padding: 32rpx;
	border-left: 6rpx solid #1E6FE0;
	border-radius: 24rpx;
	background: #FFFFFF;
	box-shadow: 0 2rpx 4rpx rgba(15, 31, 58, 0.04), 0 8rpx 28rpx rgba(30, 111, 224, 0.05);
	box-sizing: border-box;
}

.auth-head {
	margin-bottom: 16rpx;
	display: flex;
	align-items: center;
	gap: 16rpx;
	font-size: 30rpx;
	font-weight: 700;
	color: #0F1F3A;
}

.cert-icon {
	position: relative;
	width: 44rpx;
	height: 44rpx;
	border: 4rpx solid #1E6FE0;
	border-radius: 999rpx;
	box-sizing: border-box;
}

.cert-icon::before {
	content: "";
	position: absolute;
	left: 10rpx;
	top: 14rpx;
	width: 18rpx;
	height: 10rpx;
	border-left: 4rpx solid #1E6FE0;
	border-bottom: 4rpx solid #1E6FE0;
	transform: rotate(-45deg);
}

.auth-desc {
	font-size: 26rpx;
	line-height: 1.7;
	color: #324563;
}

.adv-grid {
	display: flex;
	align-items: stretch;
	justify-content: space-between;
}

.adv-card {
	width: 337rpx;
	padding: 32rpx 28rpx;
	border-radius: 24rpx;
	background: #FFFFFF;
	box-shadow: 0 2rpx 4rpx rgba(15, 31, 58, 0.04), 0 8rpx 28rpx rgba(30, 111, 224, 0.05);
	box-sizing: border-box;
}

.adv-icon {
	position: relative;
	width: 64rpx;
	height: 64rpx;
	margin-bottom: 20rpx;
	border-radius: 16rpx;
	background: #1E6FE0;
}

.adv-lightning::before {
	content: "";
	position: absolute;
	left: 24rpx;
	top: 10rpx;
	width: 0;
	height: 0;
	border-left: 12rpx solid transparent;
	border-right: 6rpx solid transparent;
	border-bottom: 24rpx solid #FFFFFF;
	transform: skew(-18deg);
}

.adv-lightning::after {
	content: "";
	position: absolute;
	left: 18rpx;
	top: 30rpx;
	width: 0;
	height: 0;
	border-left: 6rpx solid transparent;
	border-right: 12rpx solid transparent;
	border-top: 24rpx solid #FFFFFF;
	transform: skew(-18deg);
}

.adv-microscope::before {
	content: "";
	position: absolute;
	left: 20rpx;
	top: 12rpx;
	width: 20rpx;
	height: 30rpx;
	border-radius: 4rpx;
	background: #FFFFFF;
	transform: rotate(-18deg);
}

.adv-microscope::after {
	content: "";
	position: absolute;
	left: 14rpx;
	bottom: 12rpx;
	width: 36rpx;
	height: 7rpx;
	border-radius: 8rpx;
	background: #FFFFFF;
}

.adv-title {
	display: inline-block;
	padding-bottom: 16rpx;
	border-bottom: 4rpx solid #1E6FE0;
	font-size: 28rpx;
	font-weight: 700;
	line-height: 1.2;
	color: #0F1F3A;
}

.adv-desc {
	display: block;
	margin-top: 20rpx;
	font-size: 23rpx;
	line-height: 1.7;
	color: #6B7C97;
}

.business-list {
	display: flex;
	flex-direction: column;
	gap: 20rpx;
}

.business-card {
	padding: 28rpx;
	display: flex;
	align-items: center;
	gap: 28rpx;
	border-radius: 24rpx;
	background: #FFFFFF;
	box-shadow: 0 2rpx 4rpx rgba(15, 31, 58, 0.04), 0 8rpx 28rpx rgba(30, 111, 224, 0.05);
	box-sizing: border-box;
}

.business-visual {
	position: relative;
	width: 128rpx;
	height: 120rpx;
	display: flex;
	align-items: center;
	justify-content: center;
	flex-shrink: 0;
	overflow: hidden;
	border-radius: 16rpx;
}

.device-shape {
	position: relative;
	width: 96rpx;
	height: 96rpx;
}

.device-shape::before,
.device-shape::after {
	content: "";
	position: absolute;
	box-sizing: border-box;
}

.device-0::before {
	left: 8rpx;
	top: 42rpx;
	width: 72rpx;
	height: 12rpx;
	border-radius: 5rpx;
	background: #4A8AB8;
}

.device-0::after {
	left: 66rpx;
	top: 46rpx;
	width: 28rpx;
	height: 4rpx;
	background: #1E6FE0;
	box-shadow: -56rpx 4rpx 0 #0F1F3A, -12rpx 20rpx 0 rgba(107, 176, 204, 0.75);
}

.device-1::before {
	left: 10rpx;
	top: 48rpx;
	width: 76rpx;
	height: 38rpx;
	border-top: 6rpx solid #4A8AB8;
	border-radius: 999rpx 999rpx 0 0;
}

.device-1::after {
	left: 58rpx;
	top: 28rpx;
	width: 16rpx;
	height: 16rpx;
	border-radius: 999rpx;
	background: #1E6FE0;
	box-shadow: -46rpx 48rpx 0 0 #6BB0CC;
}

.device-2::before {
	left: 12rpx;
	top: 16rpx;
	width: 72rpx;
	height: 56rpx;
	border: 4rpx solid #4A8AB8;
	border-radius: 8rpx;
	background: rgba(30, 79, 168, 0.15);
}

.device-2::after {
	left: 36rpx;
	top: 36rpx;
	width: 22rpx;
	height: 22rpx;
	border: 4rpx solid #1E6FE0;
	border-radius: 999rpx;
}

.business-copy {
	min-width: 0;
	flex: 1;
	display: flex;
	flex-direction: column;
}

.business-title {
	font-size: 29rpx;
	font-weight: 700;
	line-height: 1.25;
	color: #0F1F3A;
}

.business-desc {
	margin-top: 8rpx;
	font-size: 24rpx;
	line-height: 1.6;
	color: #6B7C97;
}

.company-service-card {
	padding: 36rpx 32rpx;
	border-radius: 28rpx;
	background: linear-gradient(135deg, #123B6D 0%, #1E6FE0 58%, #64B5D4 100%);
	box-shadow: 0 18rpx 42rpx rgba(30, 111, 224, 0.22);
	box-sizing: border-box;
}

.company-service-title {
	display: block;
	font-size: 30rpx;
	font-weight: 800;
	line-height: 1.3;
	color: #FFFFFF;
}

.company-service-desc {
	display: block;
	margin-top: 16rpx;
	font-size: 25rpx;
	line-height: 1.7;
	color: rgba(255, 255, 255, 0.86);
}

.company-service-tags {
	margin-top: 26rpx;
	display: flex;
	flex-wrap: wrap;
	gap: 14rpx;
}

.company-service-tags text {
	padding: 10rpx 18rpx;
	border: 1rpx solid rgba(255, 255, 255, 0.34);
	border-radius: 999rpx;
	background: rgba(255, 255, 255, 0.13);
	font-size: 22rpx;
	color: #FFFFFF;
}

.follow-card {
	margin-top: 44rpx;
	padding: 44rpx 36rpx;
	display: flex;
	flex-direction: column;
	align-items: center;
	border-radius: 28rpx;
	background: #D7E3FA;
	text-align: center;
	box-shadow: 0 8rpx 26rpx rgba(30, 111, 224, 0.12);
	box-sizing: border-box;
}

.company-qr {
	width: 208rpx;
	height: 208rpx;
	margin: 0;
	padding: 12rpx;
	background: #FFFFFF;
	box-shadow: 0 8rpx 28rpx rgba(30, 111, 224, 0.18);
}

.company-qr .qr-image {
	width: 100%;
	height: 100%;
}

.follow-title {
	margin-top: 28rpx;
	font-size: 28rpx;
	font-weight: 600;
	line-height: 1.2;
	color: #1E6FE0;
}

.follow-desc {
	margin-top: 16rpx;
	padding: 0 24rpx;
	font-size: 24rpx;
	line-height: 1.7;
	color: #324563;
}

.follow-button {
	width: 100%;
	height: 92rpx;
	margin-top: 32rpx;
	display: flex;
	align-items: center;
	justify-content: center;
	gap: 16rpx;
	border-radius: 999rpx;
	background: linear-gradient(180deg, #2A6CD3 0%, #0A4FB8 100%);
	box-shadow: 0 20rpx 48rpx -20rpx rgba(10, 79, 184, 0.55);
	color: #FFFFFF;
	font-size: 29rpx;
	font-weight: 600;
}

.plus-icon {
	position: relative;
	width: 36rpx;
	height: 36rpx;
	border: 4rpx solid #FFFFFF;
	border-radius: 999rpx;
	box-sizing: border-box;
}

.plus-icon::before,
.plus-icon::after {
	content: "";
	position: absolute;
	left: 8rpx;
	top: 14rpx;
	width: 12rpx;
	height: 4rpx;
	border-radius: 4rpx;
	background: #FFFFFF;
}

.plus-icon::after {
	transform: rotate(90deg);
}

.mine-body {
	min-height: 100vh;
	padding-bottom: 220rpx;
	background: #E8EEFA;
	box-sizing: border-box;
}

.mine-hero {
	padding: 96rpx 36rpx 156rpx;
	background: linear-gradient(180deg, #1E6FE0 0%, #3A86FF 100%);
	color: #FFFFFF;
	box-sizing: border-box;
}

.profile-row {
	position: relative;
	display: flex;
	align-items: center;
	gap: 28rpx;
	padding-right: 184rpx;
}

.avatar {
	width: 120rpx;
	height: 120rpx;
	display: flex;
	align-items: center;
	justify-content: center;
	flex-shrink: 0;
	overflow: hidden;
	border-radius: 999rpx;
	background: transparent;
	box-shadow: none;
	color: #FFFFFF;
	font-size: 48rpx;
	font-weight: 700;
}

.avatar-logged {
	background: #FFFFFF;
	box-shadow: 0 8rpx 32rpx rgba(0, 0, 0, 0.15);
	color: #1E6FE0;
}

.avatar-image {
	width: 120rpx;
	height: 120rpx;
	display: block;
}

.profile-copy {
	min-width: 0;
	flex: 1;
	display: flex;
	flex-direction: column;
}

.profile-name {
	font-size: 34rpx;
	font-weight: 700;
	line-height: 1.25;
	color: #FFFFFF;
}

.profile-meta {
	margin-top: 6rpx;
	display: flex;
	align-items: center;
	flex-wrap: wrap;
	gap: 12rpx;
	font-size: 23rpx;
	line-height: 1.4;
	color: rgba(255, 255, 255, 0.85);
}

.profile-meta-text {
	margin-top: 6rpx;
	font-size: 23rpx;
	line-height: 1.4;
	color: rgba(255, 255, 255, 0.85);
}

.member-tag {
	padding: 2rpx 14rpx;
	border-radius: 999rpx;
	background: rgba(255, 255, 255, 0.18);
	font-size: 20rpx;
	font-weight: 600;
	letter-spacing: 0.4rpx;
}

.logout-btn {
	display: inline-flex;
	padding: 3rpx 14rpx;
	border: 2rpx solid rgba(255, 255, 255, 0.3);
	border-radius: 999rpx;
	background: rgba(255, 255, 255, 0.18);
	color: #FFFFFF;
	font-size: 20rpx;
	font-weight: 500;
	box-sizing: border-box;
}

.order-card {
	position: relative;
	z-index: 2;
	margin: -116rpx 28rpx 0;
	overflow: hidden;
	border-radius: 28rpx;
	background: #FFFFFF;
	box-shadow: 0 2rpx 4rpx rgba(15, 31, 58, 0.04), 0 8rpx 28rpx rgba(30, 111, 224, 0.05);
}

.order-head {
	padding: 28rpx 32rpx;
	display: flex;
	align-items: center;
	justify-content: space-between;
	border-bottom: 2rpx solid #F1F5FB;
	box-sizing: border-box;
}

.order-rule {
	padding: 0;
}

.order-more {
	display: flex;
	align-items: center;
	gap: 8rpx;
	font-size: 24rpx;
	color: #6B7C97;
}

.status-grid {
	padding: 36rpx 20rpx 32rpx;
	display: flex;
	align-items: flex-start;
	justify-content: space-between;
}

.status-item {
	position: relative;
	width: 25%;
	display: flex;
	flex-direction: column;
	align-items: center;
	gap: 12rpx;
}

.status-icon {
	position: relative;
	width: 88rpx;
	height: 88rpx;
	display: flex;
	align-items: center;
	justify-content: center;
	border-radius: 26rpx;
}

.badge {
	position: absolute;
	top: -8rpx;
	right: -8rpx;
	min-width: 32rpx;
	height: 32rpx;
	padding: 0 10rpx;
	display: flex;
	align-items: center;
	justify-content: center;
	border: 4rpx solid #FFFFFF;
	border-radius: 999rpx;
	background: #E5484D;
	color: #FFFFFF;
	font-size: 20rpx;
	font-weight: 700;
	box-sizing: border-box;
}

.status-text {
	font-size: 24rpx;
	font-weight: 500;
	line-height: 1.2;
	color: #324563;
}

.settings-section {
	padding: 28rpx 28rpx 0;
}

.settings-section .rule-title {
	padding: 0 8rpx 20rpx;
}

.settings-card {
	overflow: hidden;
	border-radius: 28rpx;
	background: #FFFFFF;
	box-shadow: 0 2rpx 4rpx rgba(15, 31, 58, 0.04), 0 8rpx 28rpx rgba(30, 111, 224, 0.05);
}

.menu-row {
	padding: 28rpx;
	display: flex;
	align-items: center;
	gap: 24rpx;
	border-bottom: 2rpx solid #F1F5FB;
	box-sizing: border-box;
}

.menu-row.last {
	border-bottom: none;
}

.menu-icon {
	width: 64rpx;
	height: 64rpx;
	display: flex;
	align-items: center;
	justify-content: center;
	flex-shrink: 0;
	border-radius: 20rpx;
	background: #F3F8FF;
	color: #1E6FE0;
}

.menu-icon .glyph {
	width: 40rpx;
	height: 40rpx;
}

.menu-copy {
	min-width: 0;
	flex: 1;
	display: flex;
	flex-direction: column;
}

.menu-title {
	font-size: 28rpx;
	font-weight: 500;
	line-height: 1.25;
	color: #0F1F3A;
}

.menu-desc {
	margin-top: 4rpx;
	font-size: 22rpx;
	line-height: 1.3;
	color: #94A3B8;
}

.mine-footer {
	padding: 48rpx 28rpx 0;
	display: flex;
	flex-direction: column;
	align-items: center;
	color: #94A3B8;
	font-size: 22rpx;
	line-height: 1.3;
}

.mine-footer image {
	width: 360rpx;
	height: 108rpx;
	margin-bottom: 12rpx;
	opacity: 0.55;
}

.glyph-truck::before {
	left: 4rpx;
	top: 14rpx;
	width: 24rpx;
	height: 18rpx;
	border: 4rpx solid currentColor;
}

.glyph-truck::after {
	left: 28rpx;
	top: 19rpx;
	width: 14rpx;
	height: 13rpx;
	border: 4rpx solid currentColor;
	border-left: none;
}

.glyph-truck .glyph-extra {
	left: 9rpx;
	bottom: 5rpx;
	width: 8rpx;
	height: 8rpx;
	border: 3rpx solid currentColor;
	border-radius: 999rpx;
	box-shadow: 21rpx 0 0 -1rpx #FFFFFF, 21rpx 0 0 2rpx currentColor;
}

.glyph-edit::before {
	left: 6rpx;
	top: 20rpx;
	width: 34rpx;
	height: 7rpx;
	border-radius: 8rpx;
	background: currentColor;
	transform: rotate(-45deg);
}

.glyph-edit::after {
	left: 24rpx;
	top: 5rpx;
	width: 14rpx;
	height: 14rpx;
	border: 4rpx solid currentColor;
	border-radius: 5rpx;
	transform: rotate(45deg);
}

.glyph-box::before {
	left: 6rpx;
	top: 12rpx;
	width: 36rpx;
	height: 26rpx;
	border: 4rpx solid currentColor;
	border-radius: 5rpx;
}

.glyph-box::after {
	left: 8rpx;
	top: 20rpx;
	width: 32rpx;
	height: 4rpx;
	background: currentColor;
	transform: rotate(20deg);
}

.side-tab {
	position: fixed;
	right: 0;
	top: 42%;
	z-index: 25;
	padding: 20rpx 16rpx 20rpx 28rpx;
	display: flex;
	flex-direction: column;
	align-items: center;
	gap: 2rpx;
	border: 2rpx solid rgba(255, 255, 255, 0.25);
	border-right: none;
	border-radius: 28rpx 0 0 28rpx;
	background: linear-gradient(135deg, #3A86FF 0%, #0A4FB8 100%);
	box-shadow: -8rpx 12rpx 32rpx -8rpx rgba(10, 79, 184, 0.4);
	color: #FFFFFF;
	line-height: 1.1;
	letter-spacing: 1.2rpx;
	transform: translateY(-50%);
	box-sizing: border-box;
}

.side-wordmark {
	font-family: Georgia, "Times New Roman", serif;
	font-size: 21rpx;
	font-weight: 800;
	line-height: 1.1;
	letter-spacing: 2.4rpx;
}

.side-text {
	font-size: 19rpx;
	font-weight: 600;
	line-height: 1.1;
	color: rgba(255, 255, 255, 0.95);
}

.modal-mask {
	position: fixed;
	inset: 0;
	z-index: 75;
	padding: 48rpx;
	display: flex;
	align-items: center;
	justify-content: center;
	background: rgba(15, 31, 58, 0.55);
	box-sizing: border-box;
}

.official-modal,
.qr-modal {
	position: relative;
	width: 600rpx;
	border-radius: 36rpx;
	background: #FFFFFF;
	box-sizing: border-box;
}

.official-modal {
	padding: 48rpx 36rpx;
	display: flex;
	flex-direction: column;
	align-items: center;
	text-align: center;
}

.follow-title {
	margin-top: 32rpx;
	font-size: 30rpx;
	font-weight: 800;
	color: #0F1F3A;
}

.follow-desc {
	margin-top: 16rpx;
	padding: 0 20rpx;
	font-size: 24rpx;
	line-height: 1.6;
	color: #6B7C97;
}

.official-account-btn {
	width: 100%;
	margin-top: 32rpx;
}

.qr-modal {
	padding: 48rpx;
	display: flex;
	flex-direction: column;
	align-items: center;
	text-align: center;
}

.modal-close {
	position: absolute;
	top: 20rpx;
	right: 28rpx;
	z-index: 2;
	font-size: 44rpx;
	font-weight: 300;
	line-height: 1;
	color: #94A3B8;
}

.modal-btn {
	height: 84rpx;
	display: flex;
	align-items: center;
	justify-content: center;
	border-radius: 999rpx;
	font-size: 26rpx;
	font-weight: 600;
	box-sizing: border-box;
}

.modal-btn-ghost {
	flex: 1;
	border: 2rpx solid #BFD6F7;
	background: #FFFFFF;
	color: #324563;
}

.modal-btn-primary {
	flex: 1.5;
	gap: 10rpx;
	background: linear-gradient(180deg, #3A86FF 0%, #1E6FE0 100%);
	color: #FFFFFF;
	font-weight: 700;
}

.qr-logo {
	width: 380rpx;
	height: 114rpx;
	margin-bottom: 28rpx;
}

.qr-title {
	font-size: 28rpx;
	font-weight: 700;
	line-height: 1.25;
	color: #0F1F3A;
}

.qr-subtitle {
	margin-top: 8rpx;
	font-size: 23rpx;
	line-height: 1.3;
	color: #94A3B8;
}

.qr-image-wrap {
	margin: 32rpx auto;
	padding: 20rpx;
	display: inline-flex;
	border-radius: 24rpx;
	background: #F3F8FF;
	box-sizing: border-box;
}

.qr-image {
	width: 360rpx;
	height: 360rpx;
	border-radius: 12rpx;
}

.qr-hint {
	margin-top: 20rpx;
	padding: 20rpx 32rpx;
	background: #F3F8FF;
	border-radius: 16rpx;
}

.qr-hint text {
	font-size: 24rpx;
	color: #6B7280;
}

.qr-action {
	width: 100%;
	height: 84rpx;
	display: flex;
	align-items: center;
	justify-content: center;
	border-radius: 999rpx;
	background: linear-gradient(180deg, #3A86FF 0%, #1E6FE0 100%);
	color: #FFFFFF;
	font-size: 28rpx;
	font-weight: 600;
	box-sizing: border-box;
}

.glyph,
.mini-icon {
	position: relative;
	flex-shrink: 0;
	box-sizing: border-box;
}

.glyph {
	width: 48rpx;
	height: 48rpx;
	color: inherit;
}

.glyph-small {
	width: 26rpx;
	height: 26rpx;
}

.glyph-search-small {
	width: 32rpx;
	height: 32rpx;
	color: #94A3B8;
}

.glyph-guide {
	width: 40rpx;
	height: 40rpx;
}

.glyph-pin-title {
	width: 36rpx;
	height: 36rpx;
	color: #1E6FE0;
}

.glyph::before,
.glyph::after,
.glyph-extra,
.mini-icon::before,
.mini-icon::after {
	content: "";
	position: absolute;
	box-sizing: border-box;
}

.glyph-repair::before {
	left: 7rpx;
	top: 22rpx;
	width: 36rpx;
	height: 8rpx;
	border-radius: 8rpx;
	background: currentColor;
	transform: rotate(-45deg);
}

.glyph-repair::after {
	left: 25rpx;
	top: 5rpx;
	width: 16rpx;
	height: 16rpx;
	border: 4rpx solid currentColor;
	border-radius: 5rpx;
	transform: rotate(45deg);
}

.glyph-repair .glyph-extra {
	left: 7rpx;
	bottom: 5rpx;
	width: 16rpx;
	height: 16rpx;
	border: 4rpx solid currentColor;
	border-radius: 5rpx;
	transform: rotate(45deg);
}

.glyph-track::before {
	left: 6rpx;
	top: 6rpx;
	width: 36rpx;
	height: 36rpx;
	border: 4rpx solid currentColor;
	border-radius: 999rpx;
}

.glyph-track::after {
	left: 22rpx;
	top: 12rpx;
	width: 4rpx;
	height: 16rpx;
	border-radius: 4rpx;
	background: currentColor;
}

.glyph-track .glyph-extra {
	left: 23rpx;
	top: 25rpx;
	width: 14rpx;
	height: 4rpx;
	border-radius: 4rpx;
	background: currentColor;
	transform: rotate(26deg);
	transform-origin: left center;
}

.glyph-gift::before {
	left: 5rpx;
	top: 18rpx;
	width: 38rpx;
	height: 26rpx;
	border: 4rpx solid currentColor;
	border-radius: 5rpx;
}

.glyph-gift::after {
	left: 22rpx;
	top: 18rpx;
	width: 4rpx;
	height: 26rpx;
	background: currentColor;
}

.glyph-gift .glyph-extra {
	left: 5rpx;
	top: 26rpx;
	width: 38rpx;
	height: 4rpx;
	background: currentColor;
}

.glyph-diag::before,
.glyph-invoice::before,
.glyph-book::before {
	left: 10rpx;
	top: 6rpx;
	width: 28rpx;
	height: 36rpx;
	border: 4rpx solid currentColor;
	border-radius: 5rpx;
}

.glyph-diag::after,
.glyph-invoice::after,
.glyph-book::after {
	left: 16rpx;
	top: 20rpx;
	width: 16rpx;
	height: 4rpx;
	border-radius: 4rpx;
	background: currentColor;
	box-shadow: 0 10rpx 0 currentColor;
}

.glyph-diag .glyph-extra,
.glyph-invoice .glyph-extra,
.glyph-book .glyph-extra {
	left: 30rpx;
	top: 7rpx;
	width: 8rpx;
	height: 8rpx;
	border-left: 4rpx solid currentColor;
	border-bottom: 4rpx solid currentColor;
}

.glyph-check::before {
	left: 8rpx;
	top: 16rpx;
	width: 24rpx;
	height: 12rpx;
	border-left: 4rpx solid currentColor;
	border-bottom: 4rpx solid currentColor;
	transform: rotate(-45deg);
}

.glyph-shield::before {
	left: 8rpx;
	top: 4rpx;
	width: 32rpx;
	height: 40rpx;
	border: 4rpx solid currentColor;
	border-radius: 18rpx 18rpx 12rpx 12rpx;
	transform: perspective(80rpx) rotateX(-8deg);
}

.glyph-shield::after {
	left: 15rpx;
	top: 21rpx;
	width: 18rpx;
	height: 10rpx;
	border-left: 4rpx solid currentColor;
	border-bottom: 4rpx solid currentColor;
	transform: rotate(-45deg);
}

.glyph-money::before {
	left: 6rpx;
	top: 6rpx;
	width: 36rpx;
	height: 36rpx;
	border: 4rpx solid currentColor;
	border-radius: 999rpx;
}

.glyph-money::after {
	content: "¥";
	left: 0;
	top: 7rpx;
	width: 48rpx;
	height: 34rpx;
	font-size: 28rpx;
	font-weight: 700;
	line-height: 34rpx;
	text-align: center;
	color: currentColor;
}

.glyph-search::before {
	left: 5rpx;
	top: 5rpx;
	width: 27rpx;
	height: 27rpx;
	border: 4rpx solid currentColor;
	border-radius: 999rpx;
}

.glyph-search::after {
	left: 29rpx;
	top: 31rpx;
	width: 17rpx;
	height: 4rpx;
	border-radius: 4rpx;
	background: currentColor;
	transform: rotate(45deg);
}

.glyph-phone::before {
	left: 9rpx;
	top: 9rpx;
	width: 30rpx;
	height: 30rpx;
	border-right: 7rpx solid currentColor;
	border-bottom: 7rpx solid currentColor;
	border-radius: 0 0 15rpx 0;
	transform: rotate(45deg);
}

.glyph-phone::after {
	left: 8rpx;
	top: 8rpx;
	width: 13rpx;
	height: 20rpx;
	border-radius: 8rpx;
	background: currentColor;
	transform: rotate(-26deg);
}

.glyph-chat::before {
	left: 5rpx;
	top: 8rpx;
	width: 38rpx;
	height: 28rpx;
	border: 4rpx solid currentColor;
	border-radius: 10rpx;
}

.glyph-chat::after {
	left: 14rpx;
	top: 32rpx;
	width: 12rpx;
	height: 12rpx;
	border-left: 4rpx solid currentColor;
	border-bottom: 4rpx solid currentColor;
	transform: rotate(-45deg);
}

.glyph-chat .glyph-extra {
	left: 15rpx;
	top: 21rpx;
	width: 5rpx;
	height: 5rpx;
	border-radius: 999rpx;
	background: currentColor;
	box-shadow: 9rpx 0 0 currentColor, 18rpx 0 0 currentColor;
}

.glyph-pin::before {
	left: 12rpx;
	top: 5rpx;
	width: 24rpx;
	height: 24rpx;
	border: 4rpx solid currentColor;
	border-radius: 999rpx;
}

.glyph-pin::after {
	left: 16rpx;
	top: 24rpx;
	width: 16rpx;
	height: 16rpx;
	border-right: 4rpx solid currentColor;
	border-bottom: 4rpx solid currentColor;
	transform: rotate(45deg);
}

.glyph-pin .glyph-extra {
	left: 22rpx;
	top: 15rpx;
	width: 5rpx;
	height: 5rpx;
	border-radius: 999rpx;
	background: currentColor;
}

.mini-icon {
	width: 36rpx;
	height: 36rpx;
}

.mini-check::before {
	left: 7rpx;
	top: 8rpx;
	width: 22rpx;
	height: 13rpx;
	border-left: 5rpx solid #10B981;
	border-bottom: 5rpx solid #10B981;
	transform: rotate(-45deg);
}

.mini-check-white::before {
	border-color: #FFFFFF;
}

.mini-copy::before {
	left: 12rpx;
	top: 10rpx;
	width: 20rpx;
	height: 22rpx;
	border: 3rpx solid #6B7C97;
	border-radius: 5rpx;
}

.mini-copy::after {
	left: 5rpx;
	top: 4rpx;
	width: 20rpx;
	height: 22rpx;
	border: 3rpx solid #6B7C97;
	border-radius: 5rpx;
	background: transparent;
}

.mini-external::before {
	left: 8rpx;
	top: 8rpx;
	width: 20rpx;
	height: 4rpx;
	border-radius: 4rpx;
	background: #FFFFFF;
	transform: rotate(-45deg);
}

.mini-external::after {
	right: 6rpx;
	top: 6rpx;
	width: 14rpx;
	height: 14rpx;
	border-top: 4rpx solid #FFFFFF;
	border-right: 4rpx solid #FFFFFF;
}

.module-page-dialog {
	position: relative;
	overflow: hidden;
	padding-bottom: 0;
}

.module-section-head {
	padding: 36rpx 4rpx 20rpx;
	display: flex;
	align-items: center;
	justify-content: space-between;
	box-sizing: border-box;
}

.module-section-head.single {
	justify-content: flex-start;
}

.module-section-head text:first-child {
	font-size: 30rpx;
	font-weight: 700;
	line-height: 1.25;
	color: #1E6FE0;
}

.module-section-head text:last-child {
	font-size: 23rpx;
	line-height: 1.2;
	color: #94A3B8;
}

.warm-card {
	padding: 24rpx 28rpx;
	border-radius: 16rpx;
	background: #FDE9D9;
	color: #6B4226;
	font-size: 25rpx;
	line-height: 1.7;
	box-sizing: border-box;
}

.warm-strong {
	font-weight: 700;
	color: #E5484D;
}

.repair-module {
	padding-bottom: 168rpx;
}

.repair-product {
	margin-bottom: 20rpx;
}

.repair-product-strip {
	padding: 16rpx 28rpx;
	display: flex;
	align-items: center;
	justify-content: space-between;
	border-radius: 20rpx 20rpx 0 0;
	background: #D7E3FA;
	box-sizing: border-box;
}

.repair-product-name {
	display: flex;
	align-items: center;
	gap: 12rpx;
}

.repair-product-name text:first-child {
	width: 40rpx;
	height: 40rpx;
	display: flex;
	align-items: center;
	justify-content: center;
	border-radius: 999rpx;
	background: #1E6FE0;
	color: #FFFFFF;
	font-size: 23rpx;
	font-weight: 700;
	line-height: 1;
}

.repair-product-name text:last-child {
	font-size: 26rpx;
	font-weight: 700;
	color: #0A4FB8;
}

.remove-link {
	font-size: 24rpx;
	font-weight: 600;
	color: #E5484D;
}

.repair-form-card,
.select-card,
.timeline-card,
.white-list-card,
.text-card,
.doc-paper,
.step-card,
.feedback-card,
.simple-card,
.success-card,
.product-card,
.order-card-mini,
.switch-card,
.info-line-card {
	border-radius: 24rpx;
	background: #FFFFFF;
	box-shadow: 0 2rpx 4rpx rgba(15, 31, 58, 0.04), 0 8rpx 28rpx rgba(30, 111, 224, 0.05);
	box-sizing: border-box;
}

.repair-product .repair-form-card {
	border-radius: 0 0 24rpx 24rpx;
}

.repair-field,
.select-row {
	min-height: 96rpx;
	padding: 0 28rpx;
	display: flex;
	align-items: center;
	gap: 20rpx;
	border-bottom: 2rpx solid #F1F5FB;
	box-sizing: border-box;
}

.repair-field.last,
.select-row:last-child {
	border-bottom: none;
}

.field-label-wrap {
	display: flex;
	align-items: center;
	gap: 8rpx;
	width: 172rpx;
	flex-shrink: 0;
}

.field-optional {
	font-size: 22rpx;
	color: #9CA3AF;
}

.repair-field > text,
.select-row > text:first-child {
	width: 172rpx;
	flex-shrink: 0;
	font-size: 27rpx;
	line-height: 1.3;
	color: #324563;
}

.repair-field input {
	min-width: 0;
	flex: 1;
	height: 72rpx;
	font-size: 27rpx;
	text-align: left;
	color: #0F1F3A;
}

.field-actions {
	display: flex;
	align-items: center;
	gap: 20rpx;
	flex-shrink: 0;
}

.field-action-icon {
	width: 64rpx;
	height: 64rpx;
	display: flex;
	align-items: center;
	justify-content: center;
	border-radius: 12rpx;
	background: #F5F7FA;
}

.field-action-icon .glyph {
	width: 36rpx;
	height: 36rpx;
}

.field-action {
	min-width: 0;
	flex: 1;
	display: flex;
	align-items: center;
	justify-content: flex-end;
	gap: 12rpx;
}

.field-action-value {
	font-size: 27rpx;
	color: #0F1F3A;
}

.voucher-preview {
	padding: 20rpx 28rpx 28rpx;
	display: flex;
	gap: 16rpx;
	flex-wrap: wrap;
}

.voucher-thumb {
	position: relative;
	width: 120rpx;
	height: 120rpx;
	border-radius: 12rpx;
	overflow: hidden;
	background: #F3F8FF;
}

.voucher-image {
	width: 100%;
	height: 100%;
}

.voucher-remove {
	position: absolute;
	top: 0;
	right: 0;
	width: 40rpx;
	height: 40rpx;
	display: flex;
	align-items: center;
	justify-content: center;
	background: rgba(0, 0, 0, 0.5);
	color: #FFFFFF;
	font-size: 32rpx;
	font-weight: 700;
	line-height: 1;
}

.date-value {
	min-width: 0;
	flex: 1;
	height: 72rpx;
	font-size: 27rpx;
	text-align: right;
	color: #0F1F3A;
	line-height: 72rpx;
}

.voucher-status {
	min-width: 0;
	flex: 1;
	display: flex;
	justify-content: flex-end;
	align-items: center;
}

.voucher-count {
	font-size: 27rpx;
	color: #1E6FE0;
	font-weight: 600;
}

.voucher-status .placeholder {
	font-size: 27rpx;
	color: #94A3B8;
}

.voucher-upload {
	width: 186rpx;
	height: 120rpx;
	margin-left: auto;
}

.voucher-upload text:first-child {
	font-size: 44rpx;
	line-height: 1;
}

.voucher-upload text:last-child {
	font-size: 22rpx;
	font-weight: 500;
}

.repair-field .placeholder {
	color: #94A3B8;
}

.required-star {
	color: #E5484D;
}

.field-mini,
.field-arrow,
.scan-icon {
	position: relative;
	flex-shrink: 0;
	box-sizing: border-box;
}

.field-arrow {
	width: 16rpx;
	height: 16rpx;
	border-right: 3rpx solid #C4D1E4;
	border-bottom: 3rpx solid #C4D1E4;
	transform: rotate(-45deg);
}

.field-mini {
	width: 36rpx;
	height: 36rpx;
	color: #94A3B8;
}

.field-calendar::before {
	content: "";
	position: absolute;
	left: 3rpx;
	top: 6rpx;
	width: 30rpx;
	height: 26rpx;
	border: 3rpx solid currentColor;
	border-radius: 5rpx;
	box-sizing: border-box;
}

.field-calendar::after {
	content: "";
	position: absolute;
	left: 8rpx;
	top: 14rpx;
	width: 20rpx;
	height: 3rpx;
	background: currentColor;
}

.field-clip::before {
	content: "";
	position: absolute;
	left: 9rpx;
	top: 4rpx;
	width: 18rpx;
	height: 28rpx;
	border: 3rpx solid currentColor;
	border-left-color: transparent;
	border-radius: 12rpx;
	transform: rotate(38deg);
	box-sizing: border-box;
}

.field-pin::before {
	content: "";
	position: absolute;
	left: 8rpx;
	top: 3rpx;
	width: 20rpx;
	height: 20rpx;
	border: 3rpx solid #1E6FE0;
	border-radius: 999rpx;
	box-sizing: border-box;
}

.field-pin::after {
	content: "";
	position: absolute;
	left: 12rpx;
	top: 21rpx;
	width: 12rpx;
	height: 12rpx;
	border-right: 3rpx solid #1E6FE0;
	border-bottom: 3rpx solid #1E6FE0;
	transform: rotate(45deg);
	box-sizing: border-box;
}

.scan-icon {
	width: 40rpx;
	height: 40rpx;
	position: relative;
}

.scan-icon::before {
	content: "";
	position: absolute;
	top: 4rpx;
	left: 4rpx;
	right: 4rpx;
	bottom: 4rpx;
	border: 2rpx solid #9CA3AF;
	border-radius: 4rpx;
}

.scan-icon::after {
	content: "";
	position: absolute;
	top: 0;
	left: 0;
	width: 10rpx;
	height: 10rpx;
	border-top: 3rpx solid #9CA3AF;
	border-left: 3rpx solid #9CA3AF;
}

.scan-icon .scan-corner {
	position: absolute;
	width: 10rpx;
	height: 10rpx;
	border-color: #9CA3AF;
}

.scan-icon .scan-corner:nth-child(1) {
	top: 0;
	right: 0;
	border-top: 3rpx solid;
	border-right: 3rpx solid;
}

.scan-icon .scan-corner:nth-child(2) {
	bottom: 0;
	left: 0;
	border-bottom: 3rpx solid;
	border-left: 3rpx solid;
}

.scan-icon .scan-corner:nth-child(3) {
	bottom: 0;
	right: 0;
	border-bottom: 3rpx solid;
	border-right: 3rpx solid;
}

.media-area {
	padding: 28rpx;
	box-sizing: border-box;
}

.media-title {
	margin-bottom: 20rpx;
	display: flex;
	align-items: center;
	justify-content: space-between;
	font-size: 26rpx;
	font-weight: 600;
	color: #324563;
}

.media-title text:last-child {
	font-size: 23rpx;
	font-weight: 400;
	color: #94A3B8;
}

.media-grid {
	display: flex;
	flex-wrap: wrap;
	gap: 20rpx;
}

.media-thumb,
.media-add {
	position: relative;
	width: 148rpx;
	height: 148rpx;
	display: flex;
	align-items: center;
	justify-content: center;
	border-radius: 16rpx;
	overflow: hidden;
	box-sizing: border-box;
}

.media-thumb {
	background: #F3F8FF;
	color: #FFFFFF;
}

.media-image {
	width: 100%;
	height: 100%;
	object-fit: cover;
}

.media-video {
	display: flex;
	flex-direction: column;
	align-items: center;
	justify-content: center;
	gap: 8rpx;
	color: #1E6FE0;
}

.media-remove {
	position: absolute;
	top: 0;
	right: 0;
	width: 40rpx;
	height: 40rpx;
	display: flex;
	align-items: center;
	justify-content: center;
	background: rgba(0, 0, 0, 0.5);
	color: #FFFFFF;
	font-size: 32rpx;
	font-weight: 700;
	line-height: 1;
	z-index: 2;
}

.media-add {
	flex-direction: column;
	gap: 8rpx;
	border: 3rpx dashed #BFD6F7;
	background: #F3F8FF;
	color: #94A3B8;
	font-size: 20rpx;
}

.media-add.disabled {
	opacity: 0.58;
	pointer-events: none;
}

.media-add text:first-child {
	font-size: 44rpx;
	line-height: 1;
}

.dash-add {
	height: 92rpx;
	display: flex;
	align-items: center;
	justify-content: center;
	gap: 12rpx;
	border: 3rpx dashed #BFD6F7;
	border-radius: 24rpx;
	background: #F3F8FF;
	color: #1E6FE0;
	font-size: 28rpx;
	font-weight: 700;
	box-sizing: border-box;
}

.dash-add text:first-child {
	font-size: 34rpx;
	line-height: 1;
}

.blue-tip {
	margin-bottom: 20rpx;
	padding: 24rpx 28rpx;
	border-radius: 16rpx;
	background: #D7E3FA;
	color: #0A4FB8;
	font-size: 25rpx;
	line-height: 1.7;
	box-sizing: border-box;
}

.radio-row {
	flex: 1;
	display: flex;
	align-items: center;
	gap: 36rpx;
}

.radio-item {
	display: flex;
	align-items: center;
	gap: 12rpx;
	font-size: 26rpx;
	color: #0F1F3A;
}

.radio-item > view {
	width: 28rpx;
	height: 28rpx;
	border: 3rpx solid #C4D1E4;
	border-radius: 999rpx;
	background: #FFFFFF;
	box-sizing: border-box;
}

.radio-item.on > view {
	border: 8rpx solid #1E6FE0;
}

.contact-card-wrap {
	display: flex;
	flex-direction: column;
	gap: 16rpx;
}

.contact-card-item {
	padding: 24rpx;
	display: flex;
	align-items: flex-start;
	gap: 20rpx;
	border: 2rpx solid #1E6FE0;
	border-radius: 16rpx;
	box-sizing: border-box;
}

.contact-card-divider {
	border-top-left-radius: 16rpx;
	border-top-right-radius: 16rpx;
	border-bottom-left-radius: 0;
	border-bottom-right-radius: 0;
}

.contact-icon-wrap {
	width: 48rpx;
	height: 48rpx;
	display: flex;
	align-items: center;
	justify-content: center;
	background: #E8F1FD;
	border-radius: 8rpx;
	flex-shrink: 0;
}

.contact-icon-wrap.phone-icon {
	background: #FFF0E8;
}

.contact-icon-wrap .glyph-chat::before,
.contact-icon-wrap .glyph-chat::after {
	background: #1E6FE0;
}

.contact-icon-wrap.phone-icon .glyph-phone::before,
.contact-icon-wrap.phone-icon .glyph-phone::after {
	border-color: #F59E0B;
}

.contact-content {
	flex: 1;
	display: flex;
	flex-direction: column;
	gap: 8rpx;
}

.contact-title {
	font-size: 28rpx;
	font-weight: 600;
	color: #1E6FE0;
}

.contact-desc {
	font-size: 24rpx;
	color: #6B7280;
}

.contact-phone-list {
	display: flex;
	flex-direction: column;
	gap: 12rpx;
	margin-top: 8rpx;
	padding-top: 16rpx;
	border-top: 1rpx solid #E5E7EB;
}

.phone-item {
	display: flex;
	flex-wrap: wrap;
	align-items: center;
	gap: 8rpx;
}

.phone-label {
	font-size: 24rpx;
	color: #6B7280;
}

.phone-number {
	font-size: 26rpx;
	font-weight: 600;
	color: #1E6FE0;
}

.phone-region {
	font-size: 22rpx;
	color: #9CA3AF;
}

.contact-mini-list {
	display: flex;
	flex-direction: column;
	gap: 20rpx;
}

.contact-mini-card {
	padding: 28rpx;
	display: flex;
	align-items: center;
	gap: 24rpx;
	border-radius: 24rpx;
	background: #FFFFFF;
	box-shadow: 0 2rpx 4rpx rgba(15, 31, 58, 0.04), 0 8rpx 28rpx rgba(30, 111, 224, 0.05);
	box-sizing: border-box;
}

.contact-mini-icon {
	width: 76rpx;
	height: 76rpx;
	display: flex;
	align-items: center;
	justify-content: center;
	flex-shrink: 0;
	border-radius: 20rpx;
	background: #D7E3FA;
	color: #1E6FE0;
}

.contact-mini-icon .glyph {
	width: 40rpx;
	height: 40rpx;
}

.contact-mini-copy {
	min-width: 0;
	flex: 1;
	display: flex;
	flex-direction: column;
}

.contact-mini-copy text:first-child {
	font-size: 28rpx;
	font-weight: 700;
	color: #0F1F3A;
}

.contact-mini-copy text:last-child {
	margin-top: 6rpx;
	font-size: 23rpx;
	color: #6B7C97;
}

.contact-mini-copy .brand-text {
	color: #1E6FE0;
	font-size: 25rpx;
	font-weight: 700;
}

.repair-receiver {
	margin-top: 20rpx;
	background: #FFFFFF;
}

.repair-copy {
	height: 84rpx;
	margin-top: 20rpx;
}

.repair-fab {
	position: fixed;
	right: 36rpx;
	z-index: 18;
	width: 92rpx;
	height: 92rpx;
	display: flex;
	align-items: center;
	justify-content: center;
	border: 4rpx solid #FFFFFF;
	border-radius: 999rpx;
	box-shadow: 0 16rpx 40rpx -12rpx rgba(30, 111, 224, 0.5);
	color: #FFFFFF;
}

.repair-fab-chat {
	bottom: 280rpx;
	background: linear-gradient(180deg, #3A86FF 0%, #1E6FE0 100%);
}

.repair-fab-phone {
	bottom: 168rpx;
	background: #FFFFFF;
	color: #1E6FE0;
	box-shadow: 0 12rpx 28rpx -8rpx rgba(15, 31, 58, 0.2);
}

.repair-bottom-bar {
	position: fixed;
	left: 0;
	right: 0;
	bottom: 0;
	z-index: 30;
	height: 132rpx;
	padding: 16rpx 28rpx 28rpx;
	display: flex;
	align-items: center;
	gap: 20rpx;
	border-top: 2rpx solid #E4ECF7;
	background: #FFFFFF;
	box-sizing: border-box;
}

.bottom-more {
	width: 116rpx;
	height: 96rpx;
	display: flex;
	flex-direction: column;
	align-items: center;
	justify-content: center;
	gap: 6rpx;
	border-radius: 16rpx;
	color: #324563;
	font-size: 21rpx;
}

.bottom-more > view {
	width: 36rpx;
	height: 8rpx;
	border-radius: 999rpx;
	background: #324563;
	box-shadow: 0 -12rpx 0 #324563, 0 12rpx 0 #324563;
}

.bottom-submit {
	flex: 1;
	height: 96rpx;
	display: flex;
	align-items: center;
	justify-content: center;
	border-radius: 16rpx;
	background: linear-gradient(180deg, #2A6CD3 0%, #0A4FB8 100%);
	box-shadow: 0 20rpx 48rpx -20rpx rgba(10, 79, 184, 0.55);
	color: #FFFFFF;
	font-size: 30rpx;
	font-weight: 700;
}

.bottom-submit.disabled {
	opacity: 0.68;
	pointer-events: none;
}

.bottom-prev {
	width: 180rpx;
	height: 96rpx;
	display: flex;
	align-items: center;
	justify-content: center;
	border-radius: 16rpx;
	background: #EEF3FB;
	color: #0A4FB8;
	font-size: 28rpx;
	font-weight: 600;
}

/* 报修分步进度 */
.repair-steps {
	display: flex;
	align-items: center;
	justify-content: space-between;
	padding: 24rpx 12rpx 8rpx;
	margin-bottom: 8rpx;
}

.repair-step-item {
	flex: 1;
	display: flex;
	flex-direction: column;
	align-items: center;
	gap: 8rpx;
	position: relative;
}

.repair-step-item::after {
	content: '';
	position: absolute;
	top: 24rpx;
	left: 60%;
	width: 80%;
	height: 4rpx;
	background: #E0E7F2;
}

.repair-step-item:last-child::after { display: none; }

.repair-step-num {
	width: 48rpx;
	height: 48rpx;
	border-radius: 50%;
	display: flex;
	align-items: center;
	justify-content: center;
	background: #E0E7F2;
	color: #8597B2;
	font-size: 24rpx;
	font-weight: 700;
	position: relative;
	z-index: 1;
}

.repair-step-text {
	font-size: 22rpx;
	color: #8597B2;
}

.repair-step-item.on .repair-step-num { background: linear-gradient(180deg, #2A6CD3 0%, #0A4FB8 100%); color: #FFFFFF; }
.repair-step-item.on .repair-step-text { color: #0A4FB8; font-weight: 600; }
.repair-step-item.done .repair-step-num { background: #10B981; color: #FFFFFF; }
.repair-step-item.done .repair-step-text { color: #10B981; }
.repair-step-item.done::after { background: #10B981; }

/* SN 识别结果 */
.sn-result {
	margin: -4rpx 0 12rpx;
	padding: 16rpx 20rpx;
	border-radius: 14rpx;
	background: #F1F6FF;
	border: 2rpx solid #DCE8FB;
	display: flex;
	flex-direction: column;
	gap: 6rpx;
}

.sn-result.muted { background: #F7F8FA; border-color: #ECEEF2; }
.sn-result.loading { background: #F7F8FA; border-color: #ECEEF2; color: #8597B2; }
.sn-result-row { display: flex; align-items: center; justify-content: space-between; }
.sn-result-label { font-size: 24rpx; color: #0A4FB8; font-weight: 600; }
.sn-result-line { font-size: 24rpx; color: #324563; }

.sn-tag { font-size: 22rpx; padding: 4rpx 14rpx; border-radius: 999rpx; }
.sn-tag-in_warranty { background: #E3F8EE; color: #0F9D58; }
.sn-tag-extended { background: #E8F0FE; color: #1E6FE0; }
.sn-tag-expired { background: #FDECEC; color: #E0524D; }
.sn-tag-unknown { background: #EEF1F5; color: #8597B2; }

.repair-field.column { flex-direction: column; align-items: stretch; gap: 12rpx; }
.repair-field.column textarea {
	width: 100%;
	min-height: 160rpx;
	box-sizing: border-box;
	font-size: 28rpx;
	color: #1d2129;
	line-height: 1.6;
}

.tool-sheet-mask {
	position: fixed;
	inset: 0;
	z-index: 70;
	background: rgba(15, 31, 58, 0.45);
}

.repair-tool-sheet {
	position: fixed;
	left: 0;
	right: 0;
	bottom: 0;
	z-index: 80;
	padding: 18rpx 28rpx 42rpx;
	border-radius: 36rpx 36rpx 0 0;
	background: #F7FAFF;
	box-shadow: 0 -16rpx 44rpx rgba(15, 31, 58, 0.16);
	box-sizing: border-box;
}

.repair-tool-grabber {
	width: 72rpx;
	height: 8rpx;
	margin: 0 auto 24rpx;
	border-radius: 999rpx;
	background: #C4D1E4;
}

.repair-tool-head {
	margin-bottom: 20rpx;
	display: flex;
	flex-direction: column;
	gap: 8rpx;
}

.repair-tool-head text:first-child {
	font-size: 32rpx;
	font-weight: 800;
	color: #0F1F3A;
}

.repair-tool-head text:last-child {
	font-size: 24rpx;
	color: #6B7C97;
}

.repair-tool-list {
	overflow: hidden;
	border-radius: 24rpx;
	background: #FFFFFF;
	box-shadow: 0 2rpx 4rpx rgba(15, 31, 58, 0.04), 0 8rpx 28rpx rgba(30, 111, 224, 0.05);
}

.repair-tool-row {
	min-height: 116rpx;
	padding: 24rpx;
	display: flex;
	align-items: center;
	gap: 22rpx;
	border-bottom: 2rpx solid #F1F5FB;
	box-sizing: border-box;
}

.repair-tool-row:last-child {
	border-bottom: none;
}

.repair-tool-icon {
	width: 64rpx;
	height: 64rpx;
	display: flex;
	align-items: center;
	justify-content: center;
	flex-shrink: 0;
	border-radius: 20rpx;
	font-size: 34rpx;
	font-weight: 800;
	box-sizing: border-box;
}

.tool-save {
	background: #E8F1FE;
	color: #1E6FE0;
}

.tool-clear {
	background: #FEE2E2;
	color: #E5484D;
}

.repair-tool-row > view:last-child {
	min-width: 0;
	display: flex;
	flex-direction: column;
	gap: 8rpx;
}

.repair-tool-row > view:last-child text:first-child {
	font-size: 28rpx;
	font-weight: 800;
	color: #0F1F3A;
}

.repair-tool-row > view:last-child text:last-child {
	font-size: 23rpx;
	line-height: 1.5;
	color: #6B7C97;
}

.repair-tool-row.danger > view:last-child text:first-child {
	color: #E5484D;
}

.repair-tool-cancel {
	height: 88rpx;
	margin-top: 20rpx;
	display: flex;
	align-items: center;
	justify-content: center;
	border-radius: 22rpx;
	background: #FFFFFF;
	color: #324563;
	font-size: 28rpx;
	font-weight: 700;
	box-shadow: 0 2rpx 4rpx rgba(15, 31, 58, 0.04);
}

.success-module {
	padding-top: 60rpx;
	display: flex;
	flex-direction: column;
	align-items: center;
	text-align: center;
}

.success-icon {
	width: 160rpx;
	height: 160rpx;
	display: flex;
	align-items: center;
	justify-content: center;
	border-radius: 999rpx;
	background: linear-gradient(135deg, #3A86FF 0%, #1E6FE0 100%);
	box-shadow: 0 24rpx 56rpx -16rpx rgba(30, 111, 224, 0.5);
}

.success-icon .mini-icon {
	transform: scale(1.8);
}

.success-title {
	margin-top: 36rpx;
	font-size: 40rpx;
	font-weight: 700;
	color: #0F1F3A;
}

.success-desc {
	margin-top: 16rpx;
	font-size: 26rpx;
	line-height: 1.7;
	color: #6B7C97;
}

.success-card {
	width: 100%;
	margin-top: 48rpx;
	padding: 32rpx;
	text-align: left;
}

.success-row {
	display: flex;
	align-items: center;
	justify-content: space-between;
	font-size: 22rpx;
	color: #94A3B8;
}

.copy-link {
	color: #1E6FE0;
}

.success-no {
	display: block;
	margin-top: 8rpx;
	font-size: 32rpx;
	font-weight: 700;
	color: #0F1F3A;
	letter-spacing: 1rpx;
}

.success-grid {
	margin-top: 28rpx;
	padding-top: 28rpx;
	display: flex;
	gap: 24rpx;
	border-top: 2rpx solid #F1F5FB;
}

.success-grid view {
	flex: 1;
	display: flex;
	flex-direction: column;
	gap: 6rpx;
}

.success-grid text:first-child {
	font-size: 22rpx;
	color: #94A3B8;
}

.success-grid text:last-child {
	font-size: 26rpx;
	font-weight: 700;
	color: #0F1F3A;
}

.dual-actions {
	width: 100%;
	margin-top: 40rpx;
	display: flex;
	align-items: center;
	gap: 20rpx;
}

.dual-actions .primary-button,
.dual-actions .ghost-button {
	flex: 1;
}

.ghost-button {
	height: 88rpx;
	display: flex;
	align-items: center;
	justify-content: center;
	border: 2rpx solid #BFD6F7;
	border-radius: 999rpx;
	background: #FFFFFF;
	color: #1E6FE0;
	font-size: 28rpx;
	font-weight: 700;
	box-sizing: border-box;
}

.ghost-button.disabled {
	opacity: 0.62;
	pointer-events: none;
}

.track-module {
	padding-bottom: 48rpx;
}

.track-search-wrap {
	padding: 22rpx 28rpx 16rpx;
	background: transparent;
	box-sizing: border-box;
}

.track-search {
	height: 76rpx;
	padding: 0 28rpx;
	display: flex;
	align-items: center;
	gap: 16rpx;
	border-radius: 999rpx;
	background: rgba(255, 255, 255, 0.92);
	box-shadow: 0 8rpx 24rpx rgba(30, 111, 224, 0.05);
	box-sizing: border-box;
}

.track-search input {
	min-width: 0;
	flex: 1;
	height: 76rpx;
	font-size: 26rpx;
	color: #0F1F3A;
}

.progress-tabs-line {
	padding: 16rpx 28rpx 0;
	display: flex;
	gap: 36rpx;
	border-bottom: 2rpx solid #F1F5FB;
	background: #FFFFFF;
	box-sizing: border-box;
}

.progress-tabs-compact,
.orders-tabs-classic {
	white-space: nowrap;
}

.progress-tabs-compact {
	padding: 0 28rpx;
	gap: 0;
	border-bottom: none;
	background: transparent;
}

.progress-tab {
	position: relative;
	padding: 16rpx 0 20rpx;
	font-size: 26rpx;
	color: #6B7C97;
}

.progress-tabs-compact .progress-tab,
.orders-tabs-classic .progress-tab {
	display: inline-flex;
	align-items: center;
	flex-shrink: 0;
}

.progress-tabs-compact .progress-tab {
	margin-right: 32rpx;
	padding: 18rpx 0 16rpx;
	font-size: 24rpx;
}

.progress-tab.on {
	font-weight: 700;
	color: #1E6FE0;
}

.progress-tab.on::after {
	content: "";
	position: absolute;
	left: 50%;
	bottom: 0;
	width: 36rpx;
	height: 4rpx;
	border-radius: 999rpx;
	background: #1E6FE0;
	transform: translateX(-50%);
}

.module-list {
	padding: 28rpx;
}

.track-list {
	padding-top: 18rpx;
}

.track-card {
	margin-bottom: 20rpx;
	overflow: hidden;
	border-radius: 28rpx;
	background: #FFFFFF;
	box-shadow: 0 2rpx 4rpx rgba(15, 31, 58, 0.04), 0 8rpx 28rpx rgba(30, 111, 224, 0.05);
}

.track-card-head {
	padding: 28rpx 28rpx 0;
	display: flex;
	align-items: flex-start;
	justify-content: space-between;
	gap: 20rpx;
}

.muted-line {
	display: block;
	font-size: 22rpx;
	line-height: 1.3;
	color: #94A3B8;
}

.track-model {
	display: block;
	margin-top: 8rpx;
	font-size: 28rpx;
	font-weight: 700;
	line-height: 1.35;
	color: #0F1F3A;
}

.tag {
	display: inline-flex;
	align-items: center;
	justify-content: center;
	padding: 6rpx 16rpx;
	border-radius: 999rpx;
	font-size: 22rpx;
	font-weight: 700;
	line-height: 1.2;
	white-space: nowrap;
}

.tag-warn {
	background: #FEF3C7;
	color: #92400E;
}

.tag-ok {
	background: #DCFCE7;
	color: #047857;
}

.tag-info {
	background: #DBEAFE;
	color: #1D4ED8;
}

.tag-muted {
	background: #EEF2F8;
	color: #6B7C97;
}

.tag-muted-light {
	background: rgba(255, 255, 255, 0.22);
	color: #FFFFFF;
}

.progress-steps {
	padding: 28rpx;
	display: flex;
	align-items: flex-start;
}

.progress-step {
	position: relative;
	flex: 1;
	display: flex;
	flex-direction: column;
	align-items: center;
	gap: 8rpx;
}

.progress-step::after {
	content: "";
	position: absolute;
	left: 50%;
	right: -50%;
	top: 13rpx;
	height: 3rpx;
	background: #E4ECF7;
	z-index: 0;
}

.progress-step:last-child::after {
	display: none;
}

.progress-step > view {
	position: relative;
	z-index: 1;
	width: 28rpx;
	height: 28rpx;
	border-radius: 999rpx;
	background: #E4ECF7;
	box-sizing: border-box;
}

.progress-step.reached::after,
.progress-step.reached > view {
	background: #1E6FE0;
}

.progress-step.reached > view {
	box-shadow: 0 0 0 8rpx rgba(30, 111, 224, 0.12);
}

.progress-step text {
	font-size: 20rpx;
	color: #94A3B8;
}

.progress-step.reached text {
	color: #1E6FE0;
}

.track-card-foot {
	padding: 20rpx 28rpx;
	display: flex;
	align-items: center;
	justify-content: space-between;
	border-top: 2rpx solid #F1F5FB;
	font-size: 23rpx;
	color: #6B7C97;
}

.track-card-foot text:last-child {
	font-weight: 700;
	color: #1E6FE0;
}

.track-empty {
	margin-top: 12rpx;
	padding: 72rpx 32rpx;
	border-radius: 28rpx;
	background: rgba(255, 255, 255, 0.74);
	border: 2rpx solid rgba(214, 225, 243, 0.92);
	color: #8A99B2;
}

.package-module {
	padding-bottom: 80rpx;
}

.package-hero {
	padding: 30rpx;
	display: flex;
	align-items: center;
	gap: 24rpx;
	border-radius: 28rpx;
	background: linear-gradient(135deg, #E6FAF4 0%, #F5FBF9 100%);
	box-shadow: inset 0 0 0 1rpx rgba(16, 185, 129, 0.12);
	color: #0F766E;
	box-sizing: border-box;
}

.package-hero-icon {
	width: 88rpx;
	height: 88rpx;
	display: flex;
	align-items: center;
	justify-content: center;
	flex-shrink: 0;
	border-radius: 26rpx;
	background: rgba(15, 118, 110, 0.15);
}

.package-hero > view:last-child {
	min-width: 0;
	display: flex;
	flex-direction: column;
	gap: 8rpx;
}

.package-hero > view:last-child text:first-child {
	font-size: 34rpx;
	font-weight: 800;
	line-height: 1.25;
}

.package-hero > view:last-child text:last-child {
	font-size: 24rpx;
	line-height: 1.55;
	color: rgba(15, 118, 110, 0.75);
}

.package-tip {
	margin-top: 24rpx;
	background: #E7F8F4;
	color: #0F766E;
}

.package-module .repair-form-card {
	margin-top: 24rpx;
	overflow: hidden;
	border: 2rpx solid rgba(215, 227, 250, 0.52);
}

.package-module .repair-field {
	min-height: 104rpx;
}

.package-module .repair-field > text {
	color: #253B5B;
}

.package-module .field-actions {
	gap: 14rpx;
}

.package-action-icon {
	width: 62rpx;
	height: 62rpx;
	border-radius: 18rpx;
	border: 2rpx solid rgba(15, 118, 110, 0.12);
	background: #F1FAF7;
	color: #0F766E;
	box-shadow: 0 8rpx 18rpx rgba(15, 118, 110, 0.07);
}

.package-paste-action {
	border-color: rgba(30, 111, 224, 0.12);
	background: #F4F7FE;
	color: #1E6FE0;
	box-shadow: 0 8rpx 18rpx rgba(30, 111, 224, 0.07);
}

.package-action-icon .glyph {
	width: 34rpx;
	height: 34rpx;
}

.glyph-scan::before {
	left: 4rpx;
	top: 4rpx;
	width: 26rpx;
	height: 26rpx;
	border: 3rpx solid currentColor;
	border-radius: 6rpx;
	opacity: 0.92;
}

.glyph-scan::after {
	left: 9rpx;
	top: 16rpx;
	width: 16rpx;
	height: 3rpx;
	border-radius: 999rpx;
	background: currentColor;
}

.glyph-scan .glyph-extra {
	left: 14rpx;
	top: 9rpx;
	width: 6rpx;
	height: 6rpx;
	border-radius: 2rpx;
	background: currentColor;
	box-shadow: 0 11rpx 0 -1rpx currentColor;
}

.glyph-paste::before {
	left: 7rpx;
	top: 8rpx;
	width: 22rpx;
	height: 24rpx;
	border: 3rpx solid currentColor;
	border-radius: 5rpx;
	opacity: 0.92;
}

.glyph-paste::after {
	left: 13rpx;
	top: 4rpx;
	width: 10rpx;
	height: 8rpx;
	border: 3rpx solid currentColor;
	border-bottom: none;
	border-radius: 6rpx 6rpx 0 0;
}

.glyph-paste .glyph-extra {
	left: 13rpx;
	top: 18rpx;
	width: 10rpx;
	height: 3rpx;
	border-radius: 999rpx;
	background: currentColor;
	box-shadow: 0 7rpx 0 currentColor;
	opacity: 0.72;
}

.package-privacy-note {
	margin-top: 18rpx;
	padding: 18rpx 22rpx;
	display: flex;
	align-items: center;
	gap: 16rpx;
	border-radius: 18rpx;
	background: rgba(231, 248, 244, 0.62);
	color: #0F766E;
	box-sizing: border-box;
}

.package-privacy-note text:first-child {
	flex-shrink: 0;
	padding: 5rpx 14rpx;
	border-radius: 999rpx;
	background: rgba(15, 118, 110, 0.1);
	font-size: 21rpx;
	font-weight: 700;
	line-height: 1.3;
}

.package-privacy-note text:last-child {
	min-width: 0;
	flex: 1;
	font-size: 23rpx;
	line-height: 1.55;
	color: rgba(15, 118, 110, 0.74);
}

.package-result-card {
	margin-top: 28rpx;
	padding: 30rpx;
	border-radius: 28rpx;
	background: #FFFFFF;
	box-shadow: 0 2rpx 4rpx rgba(15, 31, 58, 0.04), 0 8rpx 28rpx rgba(30, 111, 224, 0.05);
	box-sizing: border-box;
}

.package-result-head {
	display: flex;
	align-items: flex-start;
	justify-content: space-between;
	gap: 20rpx;
}

.package-no {
	display: block;
	margin-top: 8rpx;
	font-size: 32rpx;
	font-weight: 800;
	line-height: 1.3;
	color: #0F1F3A;
}

.package-result-grid {
	margin-top: 28rpx;
	padding: 24rpx;
	display: grid;
	grid-template-columns: repeat(2, minmax(0, 1fr));
	gap: 24rpx;
	border-radius: 22rpx;
	background: #F3F8FF;
	box-sizing: border-box;
}

.package-result-grid view {
	min-width: 0;
	display: flex;
	flex-direction: column;
	gap: 8rpx;
}

.package-result-grid text:first-child {
	font-size: 22rpx;
	color: #94A3B8;
}

.package-result-grid text:last-child {
	font-size: 25rpx;
	font-weight: 700;
	color: #0F1F3A;
	overflow: hidden;
	text-overflow: ellipsis;
	white-space: nowrap;
}

.package-progress {
	padding: 30rpx 0 20rpx;
	display: flex;
	align-items: flex-start;
}

.package-timeline-title {
	margin-top: 8rpx;
}

.package-timeline {
	padding-top: 4rpx;
}

.package-empty {
	margin-top: 28rpx;
	border-radius: 24rpx;
	background: #FFFFFF;
}

.invoice-module {
	padding-bottom: 80rpx;
}

.invoice-hero {
	padding: 32rpx;
	display: flex;
	align-items: center;
	gap: 24rpx;
	border-radius: 30rpx;
	background:
		linear-gradient(135deg, rgba(30, 111, 224, 0.1) 0%, rgba(14, 165, 233, 0.08) 100%),
		#FFFFFF;
	box-shadow: 0 2rpx 4rpx rgba(15, 31, 58, 0.04), 0 8rpx 28rpx rgba(30, 111, 224, 0.05);
	box-sizing: border-box;
}

.invoice-hero-icon {
	width: 88rpx;
	height: 88rpx;
	display: flex;
	align-items: center;
	justify-content: center;
	flex-shrink: 0;
	border-radius: 26rpx;
	background: #FFFFFF;
	color: #1E6FE0;
	box-shadow: 0 12rpx 28rpx rgba(30, 111, 224, 0.12);
}

.invoice-hero > view:last-child {
	min-width: 0;
	display: flex;
	flex-direction: column;
	gap: 8rpx;
}

.invoice-hero > view:last-child text:first-child {
	font-size: 32rpx;
	font-weight: 800;
	line-height: 1.3;
	color: #0F1F3A;
}

.invoice-hero > view:last-child text:last-child {
	font-size: 24rpx;
	line-height: 1.6;
	color: #5A6C8D;
}

.invoice-tabs {
	margin: 28rpx -28rpx 0;
}

.invoice-list {
	padding-top: 28rpx;
}

.invoice-status-board {
	margin-top: 24rpx;
	padding: 22rpx;
	display: grid;
	grid-template-columns: repeat(2, minmax(0, 1fr));
	gap: 16rpx;
	border-radius: 26rpx;
	background: #FFFFFF;
	box-shadow: 0 2rpx 4rpx rgba(15, 31, 58, 0.04), 0 8rpx 28rpx rgba(30, 111, 224, 0.05);
	box-sizing: border-box;
}

.invoice-status-board > view {
	padding: 20rpx;
	display: flex;
	flex-direction: column;
	gap: 6rpx;
	border-radius: 20rpx;
	background: #F7FAFF;
}

.invoice-status-board text:first-child {
	font-size: 25rpx;
	font-weight: 800;
	color: #0F1F3A;
}

.invoice-status-board text:last-child {
	font-size: 21rpx;
	line-height: 1.4;
	color: #6B7C97;
}

.invoice-flow-card {
	margin-bottom: 24rpx;
	padding: 24rpx 18rpx;
	display: grid;
	grid-template-columns: repeat(4, minmax(0, 1fr));
	gap: 10rpx;
	border-radius: 26rpx;
	background: #FFFFFF;
	box-shadow: 0 2rpx 4rpx rgba(15, 31, 58, 0.04), 0 8rpx 28rpx rgba(30, 111, 224, 0.05);
	box-sizing: border-box;
}

.invoice-flow-step {
	position: relative;
	display: flex;
	flex-direction: column;
	align-items: center;
	gap: 10rpx;
}

.invoice-flow-step:not(:last-child)::after {
	content: "";
	position: absolute;
	top: 18rpx;
	right: -20rpx;
	width: 38rpx;
	height: 2rpx;
	background: #D7E3FA;
}

.invoice-flow-step view {
	width: 38rpx;
	height: 38rpx;
	display: flex;
	align-items: center;
	justify-content: center;
	border-radius: 999rpx;
	background: #E8F1FE;
	color: #1E6FE0;
	font-size: 22rpx;
	font-weight: 800;
}

.invoice-flow-step text {
	font-size: 22rpx;
	line-height: 1.2;
	color: #6B7C97;
}

.invoice-order-card,
.invoice-issued-card {
	margin-bottom: 22rpx;
	padding: 28rpx;
	border-radius: 28rpx;
	background: #FFFFFF;
	box-shadow: 0 2rpx 4rpx rgba(15, 31, 58, 0.04), 0 8rpx 28rpx rgba(30, 111, 224, 0.05);
	box-sizing: border-box;
}

.invoice-order-head,
.invoice-issued-head {
	display: flex;
	align-items: flex-start;
	justify-content: space-between;
	gap: 20rpx;
}

.invoice-order-head > view,
.invoice-issued-head > view {
	min-width: 0;
	display: flex;
	flex-direction: column;
	gap: 8rpx;
}

.invoice-order-head > view text:last-child,
.invoice-issued-head > view text:first-child {
	font-size: 29rpx;
	font-weight: 800;
	line-height: 1.35;
	color: #0F1F3A;
}

.invoice-order-meta,
.invoice-issued-info {
	margin-top: 24rpx;
	padding: 22rpx;
	display: grid;
	grid-template-columns: repeat(2, minmax(0, 1fr));
	gap: 18rpx;
	border-radius: 22rpx;
	background: #F7FAFF;
}

.invoice-order-meta view,
.invoice-issued-info view {
	display: flex;
	flex-direction: column;
	gap: 6rpx;
}

.invoice-order-meta text:first-child,
.invoice-issued-info text:first-child {
	font-size: 22rpx;
	color: #94A3B8;
}

.invoice-order-meta text:last-child,
.invoice-issued-info text:last-child {
	font-size: 25rpx;
	font-weight: 700;
	color: #0F1F3A;
}

.invoice-order-actions {
	margin-top: 24rpx;
	display: flex;
	align-items: center;
	gap: 18rpx;
}

.invoice-order-actions .ghost-button,
.invoice-order-actions .primary-button {
	flex: 1;
	height: 76rpx;
	font-size: 25rpx;
}

.invoice-apply {
	padding-top: 28rpx;
}

.invoice-form-head {
	margin-bottom: 22rpx;
	padding: 28rpx;
	display: flex;
	align-items: center;
	justify-content: space-between;
	gap: 24rpx;
	border-radius: 28rpx;
	background: #FFFFFF;
	box-shadow: 0 2rpx 4rpx rgba(15, 31, 58, 0.04), 0 8rpx 28rpx rgba(30, 111, 224, 0.05);
	box-sizing: border-box;
}

.invoice-form-head > view {
	min-width: 0;
	display: flex;
	flex-direction: column;
	gap: 8rpx;
}

.invoice-form-head > view text:first-child {
	font-size: 32rpx;
	font-weight: 800;
	color: #0F1F3A;
}

.invoice-form-head > view text:last-child {
	font-size: 24rpx;
	color: #6B7C97;
}

.invoice-form-head > text {
	flex-shrink: 0;
	font-size: 24rpx;
	font-weight: 700;
	color: #1E6FE0;
}

.invoice-form-card {
	box-shadow: 0 2rpx 4rpx rgba(15, 31, 58, 0.04), 0 8rpx 28rpx rgba(30, 111, 224, 0.05);
}

.invoice-type-row {
	padding: 24rpx 28rpx;
	display: grid;
	grid-template-columns: repeat(2, minmax(0, 1fr));
	gap: 18rpx;
	border-bottom: 2rpx solid #F1F5FB;
	box-sizing: border-box;
}

.invoice-type-row > view {
	padding: 20rpx;
	display: flex;
	flex-direction: column;
	gap: 6rpx;
	border: 2rpx solid #E4ECF7;
	border-radius: 22rpx;
	background: #F8FBFF;
	box-sizing: border-box;
}

.invoice-type-row > view.on {
	border-color: #1E6FE0;
	background: #EEF6FF;
}

.invoice-type-row text:first-child {
	font-size: 26rpx;
	font-weight: 800;
	color: #0F1F3A;
}

.invoice-type-row text:last-child {
	font-size: 21rpx;
	color: #94A3B8;
}

.invoice-tip {
	margin-top: 22rpx;
	padding: 22rpx 26rpx;
	border-radius: 22rpx;
	background: #F3F8FF;
	font-size: 23rpx;
	line-height: 1.6;
	color: #5A6C8D;
}

.invoice-issued-card {
	position: relative;
	overflow: hidden;
}

.invoice-issued-ribbon {
	position: absolute;
	top: 0;
	right: 0;
	padding: 10rpx 24rpx;
	border-bottom-left-radius: 22rpx;
	background: #E8F8F2;
	color: #10B981;
	font-size: 22rpx;
	font-weight: 800;
}

.invoice-issued-head {
	padding-right: 120rpx;
}

.invoice-issued-head > text {
	flex-shrink: 0;
	font-size: 34rpx;
	font-weight: 900;
	color: #1E6FE0;
}

.invoice-issued-head > view text:last-child {
	font-size: 23rpx;
	color: #94A3B8;
}

.detail-hero {
	padding: 36rpx;
	border-radius: 28rpx;
	background: linear-gradient(135deg, #1E6FE0 0%, #3A86FF 100%);
	color: #FFFFFF;
	box-shadow: 0 20rpx 48rpx -18rpx rgba(30, 111, 224, 0.55);
	box-sizing: border-box;
}

.detail-hero-top,
.detail-hero-grid {
	display: flex;
	align-items: center;
	justify-content: space-between;
}

.detail-hero-top {
	font-size: 22rpx;
	color: rgba(255, 255, 255, 0.85);
}

.detail-order-no {
	display: block;
	margin-top: 8rpx;
	font-size: 32rpx;
	font-weight: 800;
	letter-spacing: 1rpx;
}

.detail-hero-grid {
	margin-top: 28rpx;
	padding-top: 28rpx;
	gap: 28rpx;
	border-top: 2rpx solid rgba(255, 255, 255, 0.2);
}

.detail-hero-grid view {
	flex: 1;
	display: flex;
	flex-direction: column;
	gap: 6rpx;
}

.detail-hero-grid text:first-child {
	font-size: 22rpx;
	color: rgba(255, 255, 255, 0.75);
}

.detail-hero-grid text:last-child {
	font-size: 26rpx;
	font-weight: 700;
}

.timeline-card {
	padding: 32rpx;
}

.detail-timeline-row {
	display: flex;
	gap: 24rpx;
}

.detail-timeline-pin {
	display: flex;
	flex-direction: column;
	align-items: center;
}

.detail-timeline-pin view:first-child {
	width: 20rpx;
	height: 20rpx;
	margin-top: 12rpx;
	border-radius: 999rpx;
	background: #1E6FE0;
	box-shadow: 0 0 0 8rpx #E8F1FE;
	box-sizing: border-box;
}

.detail-timeline-pin.pending view:first-child {
	border: 4rpx solid #1E6FE0;
	background: #FFFFFF;
	box-shadow: none;
}

.detail-timeline-pin view:last-child {
	flex: 1;
	width: 3rpx;
	margin-top: 8rpx;
	background: #E4ECF7;
}

.detail-timeline-copy {
	flex: 1;
	padding-bottom: 32rpx;
}

.detail-timeline-copy > view {
	display: flex;
	align-items: center;
	justify-content: space-between;
	gap: 16rpx;
}

.detail-timeline-copy > view text:first-child {
	font-size: 28rpx;
	font-weight: 700;
	color: #0F1F3A;
}

.detail-timeline-copy > view text:first-child.muted {
	color: #94A3B8;
}

.detail-timeline-copy > view text:last-child,
.detail-timeline-copy > text {
	font-size: 22rpx;
	color: #94A3B8;
}

.detail-timeline-copy > text {
	display: block;
	margin-top: 8rpx;
	line-height: 1.6;
	color: #6B7C97;
}

.billing-card {
	padding: 28rpx;
	border-radius: 28rpx;
	background: #FFFFFF;
	box-shadow: 0 2rpx 4rpx rgba(15, 31, 58, 0.04), 0 8rpx 28rpx rgba(30, 111, 224, 0.05);
	box-sizing: border-box;
}

.quote-sheet-card {
	border: 2rpx solid #EAF1FB;
}

.billing-head {
	display: flex;
	align-items: flex-start;
	justify-content: space-between;
	gap: 20rpx;
}

.billing-head > view {
	min-width: 0;
	display: flex;
	flex-direction: column;
	gap: 8rpx;
}

.billing-head > view text:first-child {
	font-size: 30rpx;
	font-weight: 800;
	color: #0F1F3A;
}

.billing-head > view text:last-child {
	font-size: 23rpx;
	line-height: 1.5;
	color: #6B7C97;
}

.quote-line-list {
	margin-top: 24rpx;
	display: flex;
	flex-direction: column;
	gap: 16rpx;
}

.quote-group-list {
	gap: 22rpx;
}

.quote-group {
	padding: 18rpx 20rpx;
	border-radius: 20rpx;
	background: #F8FBFF;
	border: 2rpx solid #EAF1FB;
	box-sizing: border-box;
}

.quote-group-head {
	display: flex;
	align-items: center;
	justify-content: space-between;
	gap: 16rpx;
	padding-bottom: 8rpx;
}

.quote-group-head text:first-child {
	font-size: 25rpx;
	font-weight: 800;
	color: #0F1F3A;
}

.quote-group-head text:last-child {
	font-size: 25rpx;
	font-weight: 900;
	color: #2B5EA8;
}

.quote-line-item {
	padding: 22rpx 0;
	display: flex;
	align-items: flex-start;
	justify-content: space-between;
	gap: 20rpx;
	border-bottom: 2rpx solid #F1F5FB;
}

.quote-line-item:last-child {
	border-bottom: none;
}

.quote-line-copy {
	min-width: 0;
	display: flex;
	flex-direction: column;
	gap: 8rpx;
}

.quote-line-copy > text:first-child {
	font-size: 27rpx;
	font-weight: 800;
	color: #0F1F3A;
}

.quote-line-copy > text:nth-child(2) {
	font-size: 23rpx;
	line-height: 1.5;
	color: #6B7C97;
}

.quote-line-fees {
	display: flex;
	flex-wrap: wrap;
	gap: 10rpx;
}

.quote-line-fees text {
	padding: 5rpx 12rpx;
	border-radius: 999rpx;
	background: #F2F7FF;
	font-size: 21rpx;
	color: #2B5EA8;
}

.quote-line-price {
	flex-shrink: 0;
	font-size: 28rpx;
	font-weight: 900;
	color: #0F1F3A;
}

.quote-total-box {
	margin-top: 24rpx;
	padding: 24rpx;
	display: flex;
	flex-direction: column;
	gap: 8rpx;
	border-radius: 22rpx;
	background: linear-gradient(135deg, #FFF7E6 0%, #FFFDF5 100%);
	border: 2rpx solid #FFE4B5;
	box-sizing: border-box;
}

.quote-total-box text:first-child {
	font-size: 22rpx;
	color: #A16207;
}

.quote-total-box text:nth-child(2) {
	font-size: 42rpx;
	font-weight: 900;
	color: #D97706;
}

.quote-total-box text:last-child {
	font-size: 23rpx;
	line-height: 1.5;
	color: #7C5A16;
}

.billing-empty {
	margin-top: 24rpx;
	padding: 24rpx;
	border-radius: 22rpx;
	background: #F7FAFF;
	font-size: 24rpx;
	line-height: 1.6;
	color: #6B7C97;
	box-sizing: border-box;
}

.billing-proof-grid {
	margin-top: 24rpx;
}

.detail-action-button {
	margin-top: 24rpx;
	height: 82rpx;
	font-size: 26rpx;
}

.quote-action-stack {
	margin-top: 24rpx;
	display: flex;
	flex-direction: column;
	gap: 18rpx;
}

.quote-action-stack .detail-action-button {
	margin-top: 0;
}

.quote-secondary-action,
.quote-secondary-hint {
	min-height: 64rpx;
	display: flex;
	align-items: center;
	justify-content: center;
	border-radius: 999rpx;
	font-size: 24rpx;
	line-height: 1.5;
	box-sizing: border-box;
}

.quote-secondary-action {
	border: 2rpx solid #D6E4F5;
	background: #F8FBFF;
	color: #1E6FE0;
	font-weight: 800;
}

.quote-secondary-action.disabled {
	opacity: 0.6;
}

.quote-secondary-hint {
	padding: 0 20rpx;
	background: #F7FAFF;
	color: #6B7C97;
	text-align: center;
}

.quote-contact-action {
	min-height: 64rpx;
	display: flex;
	align-items: center;
	justify-content: center;
	border-radius: 999rpx;
	font-size: 24rpx;
	font-weight: 700;
	color: #C97A1B;
	background: #FFF7E8;
	border: 2rpx solid #F6E0B5;
}

/* 报价账单说明 */
.quote-bill-info {
	margin-top: 20rpx;
	padding: 18rpx 20rpx;
	border-radius: 14rpx;
	background: #F7FAFF;
	display: flex;
	flex-direction: column;
	gap: 12rpx;
}

.quote-bill-row {
	display: flex;
	align-items: flex-start;
	gap: 12rpx;
	font-size: 24rpx;
	color: #4A5A73;
	line-height: 1.6;
}

.quote-bill-dot {
	width: 12rpx;
	height: 12rpx;
	border-radius: 50%;
	margin-top: 10rpx;
	flex-shrink: 0;
}

.quote-bill-dot.warranty { background: #10B981; }
.quote-bill-dot.deadline { background: #E6A23C; }
.quote-bill-dot.policy { background: #1E6FE0; }

/* 9 节点进度时间线 */
.progress-node-card {
	background: #FFFFFF;
	border-radius: 20rpx;
	padding: 28rpx 28rpx 8rpx;
	box-shadow: 0 8rpx 28rpx -22rpx rgba(10, 79, 184, 0.5);
}

.progress-node-row {
	display: flex;
	gap: 18rpx;
	min-height: 72rpx;
}

.progress-node-pin {
	display: flex;
	flex-direction: column;
	align-items: center;
}

.progress-node-dot {
	width: 22rpx;
	height: 22rpx;
	border-radius: 50%;
	background: #D5DCE8;
	margin-top: 4rpx;
	flex-shrink: 0;
}

.progress-node-line {
	flex: 1;
	width: 4rpx;
	background: #E3E8F1;
	margin: 4rpx 0;
}

.progress-node-copy {
	display: flex;
	align-items: center;
	gap: 14rpx;
	padding-bottom: 20rpx;
}

.progress-node-label {
	font-size: 26rpx;
	color: #9AA6B8;
}

.progress-node-now {
	font-size: 20rpx;
	color: #1E6FE0;
	background: #E8F1FE;
	padding: 2rpx 14rpx;
	border-radius: 999rpx;
}

.progress-node-row.done .progress-node-dot { background: #10B981; }
.progress-node-row.done .progress-node-line { background: #10B981; }
.progress-node-row.done .progress-node-label { color: #324563; }
.progress-node-row.current .progress-node-dot { background: #1E6FE0; box-shadow: 0 0 0 6rpx rgba(30, 111, 224, 0.16); }
.progress-node-row.current .progress-node-label { color: #0A4FB8; font-weight: 700; }

/* 回寄物流 */
.return-logistics-card {
	background: #FFFFFF;
	border-radius: 20rpx;
	padding: 24rpx;
	box-shadow: 0 8rpx 28rpx -22rpx rgba(10, 79, 184, 0.5);
}

.return-logistics-info > view {
	display: flex;
	justify-content: space-between;
	font-size: 26rpx;
	padding: 8rpx 0;
}

.return-logistics-info > view > text:first-child { color: #8597B2; }
.return-logistics-info > view > text:last-child { color: #1d2129; }
.return-logistics-no { font-weight: 700; }

.return-logistics-actions {
	display: flex;
	gap: 16rpx;
	margin-top: 16rpx;
}

.return-logistics-btn {
	flex: 1;
	height: 76rpx;
	display: flex;
	align-items: center;
	justify-content: center;
	border-radius: 14rpx;
	font-size: 26rpx;
	font-weight: 600;
	color: #1E6FE0;
	background: #F1F6FF;
	border: 2rpx solid #DCE8FB;
}

.return-logistics-btn.primary {
	color: #FFFFFF;
	background: linear-gradient(180deg, #2A6CD3 0%, #0A4FB8 100%);
	border: none;
}

/* 完成引导 */
.complete-guide-card {
	margin-top: 24rpx;
	background: linear-gradient(180deg, #F0F7FF 0%, #FFFFFF 100%);
	border-radius: 20rpx;
	padding: 28rpx 24rpx;
	border: 2rpx solid #E2EDFB;
}

.complete-guide-title {
	display: flex;
	align-items: center;
	gap: 10rpx;
	font-size: 30rpx;
	font-weight: 700;
	color: #1d2129;
}

.complete-guide-emoji { font-size: 34rpx; }

.complete-guide-tip {
	display: block;
	margin: 12rpx 0 20rpx;
	font-size: 24rpx;
	color: #6B7C97;
	line-height: 1.6;
}

.complete-guide-actions {
	display: flex;
	gap: 16rpx;
}

.complete-guide-btn {
	flex: 1;
	display: flex;
	flex-direction: column;
	align-items: center;
	gap: 8rpx;
	padding: 20rpx 0;
	border-radius: 16rpx;
	background: #FFFFFF;
	border: 2rpx solid #E2EDFB;
	font-size: 24rpx;
	color: #324563;
}

.complete-guide-ico { font-size: 34rpx; color: #1E6FE0; }

.payment-proof-grid {
	margin-top: 24rpx;
	display: grid;
	grid-template-columns: repeat(3, minmax(0, 1fr));
	gap: 16rpx;
}

.payment-proof-thumb {
	padding: 10rpx;
	display: flex;
	flex-direction: column;
	gap: 8rpx;
	border-radius: 18rpx;
	background: #F7FAFF;
	box-sizing: border-box;
}

.payment-proof-image {
	width: 100%;
	height: 136rpx;
	border-radius: 14rpx;
	background: #E4ECF7;
}

.payment-proof-thumb text {
	font-size: 20rpx;
	text-align: center;
	color: #6B7C97;
}

.info-line-card,
.invoice-detail-card {
	padding: 28rpx;
	display: flex;
	align-items: center;
	gap: 24rpx;
}

.invoice-detail-card {
	align-items: flex-start;
}

.invoice-detail-actions {
	display: flex;
	flex-direction: column;
	align-items: flex-end;
	gap: 14rpx;
	flex-shrink: 0;
}

.invoice-mini-button {
	min-width: 128rpx;
	height: 52rpx;
	padding: 0 20rpx;
	display: flex;
	align-items: center;
	justify-content: center;
	border-radius: 999rpx;
	background: #E8F1FE;
	color: #1E6FE0;
	font-size: 22rpx;
	font-weight: 800;
	box-sizing: border-box;
}

.info-line-icon {
	display: flex;
	align-items: center;
	justify-content: center;
	flex-shrink: 0;
}

.info-line-icon {
	width: 84rpx;
	height: 84rpx;
	border-radius: 24rpx;
	color: #D97706;
}

.invoice-bg {
	background: #FFF7E6;
}

.info-line-copy {
	min-width: 0;
	flex: 1;
	display: flex;
	flex-direction: column;
	gap: 6rpx;
}

.info-line-copy text:first-child {
	font-size: 28rpx;
	font-weight: 700;
	color: #0F1F3A;
}

.info-line-copy text:last-child {
	font-size: 23rpx;
	line-height: 1.4;
	color: #6B7C97;
}

.survey-module {
	position: relative;
	min-height: 100vh;
	display: flex;
	align-items: center;
	justify-content: center;
	padding: 40rpx 32rpx;
	background: rgba(232, 238, 250, 0.65);
	box-sizing: border-box;
}

.survey-mask {
	position: absolute;
	inset: 0;
	background: rgba(15, 31, 58, 0.45);
}

.survey-modal-card {
	position: relative;
	z-index: 2;
	width: 100%;
	padding: 44rpx 44rpx 36rpx;
	border-radius: 36rpx;
	background: #FFFFFF;
	box-shadow: 0 48rpx 120rpx -24rpx rgba(15, 31, 58, 0.4);
	text-align: center;
	box-sizing: border-box;
}

.survey-poster-card {
	max-height: calc(100vh - 80rpx);
	padding: 36rpx 28rpx 32rpx;
	overflow-y: auto;
}

.survey-close {
	position: absolute;
	top: 18rpx;
	right: 22rpx;
	color: #94A3B8;
	font-size: 36rpx;
	line-height: 1;
}

.survey-ribbon {
	margin: 0 auto;
	padding: 8rpx 24rpx;
	display: inline-flex;
	align-items: center;
	gap: 10rpx;
	border-radius: 999rpx;
	background: #FFF7E6;
	color: #A16207;
	font-size: 22rpx;
	font-weight: 700;
}

.survey-ribbon .glyph {
	width: 28rpx;
	height: 28rpx;
}

.survey-poster-wrap {
	width: 100%;
	margin-top: 24rpx;
	overflow: hidden;
	border: 2rpx solid #E4ECF7;
	border-radius: 24rpx;
	background: #FFFFFF;
	box-shadow: 0 16rpx 44rpx -24rpx rgba(15, 31, 58, 0.22);
}

.survey-poster {
	width: 100%;
	display: block;
}

.survey-poster-tip {
	display: block;
	margin-top: 18rpx;
	font-size: 22rpx;
	line-height: 1.5;
	color: #94A3B8;
}

.survey-title {
	display: block;
	margin-top: 24rpx;
	font-size: 36rpx;
	font-weight: 800;
	color: #0F1F3A;
}

.survey-desc {
	display: block;
	margin-top: 12rpx;
	font-size: 25rpx;
	line-height: 1.7;
	color: #6B7C97;
}

.survey-qr-wrap {
	width: 320rpx;
	height: 320rpx;
	margin: 36rpx auto 12rpx;
	padding: 20rpx;
	border: 2rpx solid #E4ECF7;
	border-radius: 28rpx;
	background: #FFFFFF;
	box-shadow: 0 16rpx 44rpx -20rpx rgba(15, 31, 58, 0.18);
	box-sizing: border-box;
}

.survey-qr {
	width: 100%;
	height: 100%;
	border-radius: 12rpx;
}

.survey-wx {
	display: block;
	font-size: 23rpx;
	color: #94A3B8;
}

.survey-actions {
	margin-top: 36rpx;
	display: flex;
	justify-content: center;
}

.survey-secondary {
	min-width: 240rpx;
	height: 80rpx;
	display: flex;
	align-items: center;
	justify-content: center;
	border-radius: 999rpx;
	font-size: 28rpx;
	font-weight: 600;
	background: #F3F8FF;
	border: 2rpx solid #D7E3FA;
	color: #1E6FE0;
	padding: 0 40rpx;
}

.diag-hero-card {
	padding: 28rpx;
	display: flex;
	align-items: center;
	gap: 24rpx;
	border: 2rpx solid #BFD6F7;
	border-radius: 28rpx;
	background: linear-gradient(135deg, #F3F8FF 0%, #E8F1FE 100%);
	box-sizing: border-box;
}

.diag-icon {
	width: 84rpx;
	height: 84rpx;
	display: flex;
	align-items: center;
	justify-content: center;
	flex-shrink: 0;
	border-radius: 24rpx;
	background: #FFFFFF;
	color: #1E6FE0;
}

.diag-hero-card > view:last-child {
	display: flex;
	flex-direction: column;
	gap: 6rpx;
}

.diag-hero-card > view:last-child text:first-child {
	font-size: 28rpx;
	font-weight: 700;
	color: #0F1F3A;
}

.diag-hero-card > view:last-child text:last-child {
	font-size: 23rpx;
	line-height: 1.6;
	color: #6B7C97;
}

.select-row > text:nth-child(2) {
	min-width: 0;
	flex: 1;
	text-align: right;
	font-size: 27rpx;
	color: #0F1F3A;
}

.select-row > text.placeholder,
.select-row.disabled > text:nth-child(2) {
	color: #94A3B8;
}

.select-row.disabled {
	opacity: 0.55;
}

.diag-check-card {
	margin-bottom: 20rpx;
	padding: 28rpx 32rpx;
	border-radius: 24rpx;
	background: #FFFFFF;
	box-shadow: 0 2rpx 4rpx rgba(15, 31, 58, 0.04), 0 8rpx 28rpx rgba(30, 111, 224, 0.05);
	box-sizing: border-box;
}

.diag-check-head {
	padding-bottom: 20rpx;
	display: flex;
	align-items: center;
	gap: 16rpx;
	border-bottom: 2rpx solid #F1F5FB;
}

.diag-check-head view {
	width: 12rpx;
	height: 12rpx;
	border-radius: 999rpx;
}

.diag-check-head text {
	font-size: 27rpx;
	font-weight: 700;
	color: #0F1F3A;
}

.diag-check-row {
	padding-top: 20rpx;
	display: flex;
	align-items: flex-start;
	gap: 18rpx;
	font-size: 26rpx;
	line-height: 1.6;
	color: #324563;
}

.diag-check-row text:first-child {
	width: 36rpx;
	height: 36rpx;
	display: flex;
	align-items: center;
	justify-content: center;
	flex-shrink: 0;
	border-radius: 999rpx;
	background: #E8F1FE;
	color: #1E6FE0;
	font-size: 22rpx;
	font-weight: 700;
}

.empty-hint {
	padding: 80rpx 60rpx;
	text-align: center;
	font-size: 26rpx;
	line-height: 1.7;
	color: #94A3B8;
}

.sheet-mask {
	position: fixed;
	inset: 0;
	z-index: 90;
	background: rgba(15, 31, 58, 0.45);
}

.choice-sheet {
	position: fixed;
	left: 0;
	right: 0;
	bottom: 0;
	z-index: 100;
	max-height: 70vh;
	display: flex;
	flex-direction: column;
	overflow: hidden;
	border-radius: 32rpx 32rpx 0 0;
	background: #FFFFFF;
	box-sizing: border-box;
}

.choice-head {
	padding: 28rpx 32rpx;
	display: flex;
	align-items: center;
	justify-content: space-between;
	border-bottom: 2rpx solid #F1F5FB;
}

.choice-head text:first-child,
.choice-head text:last-child {
	width: 72rpx;
	font-size: 26rpx;
	color: #94A3B8;
}

.choice-head text:nth-child(2) {
	font-size: 30rpx;
	font-weight: 700;
	color: #0F1F3A;
}

.choice-scroll {
	max-height: calc(70vh - 92rpx);
}

.choice-row {
	min-height: 96rpx;
	padding: 0 32rpx;
	display: flex;
	align-items: center;
	justify-content: space-between;
	border-bottom: 2rpx solid #F1F5FB;
	font-size: 28rpx;
	color: #0F1F3A;
	box-sizing: border-box;
}

.warranty-hero,
.doc-hero {
	padding: 36rpx;
	border-radius: 28rpx;
	background: linear-gradient(180deg, #1E6FE0 0%, #3A86FF 100%);
	color: #FFFFFF;
	box-shadow: 0 20rpx 48rpx -18rpx rgba(30, 111, 224, 0.55);
	box-sizing: border-box;
}

.warranty-hero {
	display: flex;
	flex-direction: column;
	align-items: flex-start;
}

.warranty-hero .glyph,
.doc-hero .glyph {
	width: 72rpx;
	height: 72rpx;
	color: #FFFFFF;
}

.warranty-hero text:nth-child(2),
.doc-hero > text:first-child,
.doc-hero > text:nth-child(2),
.doc-hero > view text:first-child {
	margin-top: 12rpx;
	font-size: 40rpx;
	font-weight: 800;
	color: #FFFFFF;
}

.warranty-hero text:last-child,
.doc-hero > text:last-child,
.doc-hero > view text:last-child {
	margin-top: 12rpx;
	font-size: 24rpx;
	line-height: 1.6;
	color: rgba(255, 255, 255, 0.88);
}

.doc-hero {
	display: flex;
	align-items: center;
	gap: 24rpx;
	margin-bottom: 24rpx;
}

.doc-hero > view {
	min-width: 0;
	display: flex;
	flex-direction: column;
}

.fees-hero {
	margin-bottom: 24rpx;
	display: flex;
	flex-direction: column;
	align-items: flex-start;
}

.white-list-card,
.text-card,
.doc-paper,
.step-card {
	overflow: hidden;
}

.list-row {
	min-height: 92rpx;
	padding: 0 28rpx;
	display: flex;
	align-items: center;
	justify-content: space-between;
	gap: 20rpx;
	border-bottom: 2rpx solid #F1F5FB;
	box-sizing: border-box;
}

.list-row:last-child {
	border-bottom: none;
}

.list-row text:first-child {
	font-size: 28rpx;
	font-weight: 600;
	color: #0F1F3A;
}

.list-row text:last-child {
	font-size: 24rpx;
	font-weight: 600;
	color: #0A4FB8;
	text-align: right;
}

.text-card {
	padding: 24rpx 28rpx;
}

.number-line {
	padding: 12rpx 0;
	display: flex;
	align-items: flex-start;
	gap: 20rpx;
	font-size: 26rpx;
	line-height: 1.7;
	color: #324563;
}

.number-line text:first-child {
	width: 36rpx;
	height: 36rpx;
	display: flex;
	align-items: center;
	justify-content: center;
	flex-shrink: 0;
	border-radius: 999rpx;
	background: #E8F1FE;
	color: #1E6FE0;
	font-size: 22rpx;
	font-weight: 700;
}

.service-line {
	padding: 28rpx;
	display: flex;
	align-items: center;
	gap: 24rpx;
	border-bottom: 2rpx solid #F1F5FB;
}

.service-line:last-child {
	border-bottom: none;
}

.service-line-icon {
	width: 72rpx;
	height: 72rpx;
	display: flex;
	align-items: center;
	justify-content: center;
	flex-shrink: 0;
	border-radius: 20rpx;
	background: #E8F1FE;
	color: #1E6FE0;
}

.service-line > view:last-child {
	display: flex;
	flex-direction: column;
	gap: 4rpx;
}

.service-line > view:last-child text:first-child {
	font-size: 27rpx;
	font-weight: 700;
	color: #0F1F3A;
}

.service-line > view:last-child text:last-child {
	font-size: 23rpx;
	color: #6B7C97;
}

.doc-paper {
	padding: 32rpx;
}

.warranty-paper {
	margin-top: 32rpx;
}

.paper-title {
	display: block;
	padding: 24rpx 0 32rpx;
	border-bottom: 4rpx solid #1E6FE0;
	text-align: center;
	font-size: 34rpx;
	font-weight: 800;
	color: #0F1F3A;
}

.paper-section {
	padding: 28rpx 0;
	border-bottom: 2rpx solid #F1F5FB;
}

.paper-section:last-child {
	border-bottom: none;
	padding-bottom: 0;
}

.paper-section-title {
	display: block;
	margin-bottom: 20rpx;
	font-size: 29rpx;
	font-weight: 700;
	color: #0F1F3A;
}

.paper-line {
	padding: 8rpx 0 8rpx 20rpx;
	display: flex;
	align-items: flex-start;
	gap: 14rpx;
	font-size: 26rpx;
	line-height: 1.8;
	color: #324563;
}

.paper-line text:first-child {
	flex-shrink: 0;
	font-weight: 700;
	color: #1E6FE0;
}

.guide-file-card {
	margin-top: 24rpx;
	padding: 28rpx;
	display: flex;
	align-items: center;
	justify-content: space-between;
	gap: 20rpx;
	border-radius: 28rpx;
	background: #F5F8FF;
	border: 2rpx solid #DCE6FA;
}

.guide-file-card > view:first-child {
	min-width: 0;
	display: flex;
	flex-direction: column;
	gap: 8rpx;
}

.guide-file-card > view:first-child text:first-child {
	font-size: 24rpx;
	color: #6B7C97;
}

.guide-file-card > view:first-child text:last-child {
	font-size: 28rpx;
	font-weight: 700;
	color: #0F1F3A;
	word-break: break-all;
}

.step-card {
	margin-top: 24rpx;
}

.guide-step-row {
	padding: 32rpx;
	display: flex;
	align-items: flex-start;
	gap: 28rpx;
	border-bottom: 2rpx solid #F1F5FB;
}

.guide-step-row:last-child {
	border-bottom: none;
}

.guide-step-row > text {
	width: 56rpx;
	height: 56rpx;
	display: flex;
	align-items: center;
	justify-content: center;
	flex-shrink: 0;
	border-radius: 18rpx;
	background: linear-gradient(135deg, #3A86FF 0%, #1E6FE0 100%);
	box-shadow: 0 8rpx 20rpx -4rpx rgba(30, 111, 224, 0.35);
	color: #FFFFFF;
	font-size: 26rpx;
	font-weight: 800;
}

.guide-step-row > view {
	display: flex;
	flex-direction: column;
	gap: 10rpx;
}

.guide-step-row > view text:first-child {
	font-size: 29rpx;
	font-weight: 700;
	color: #0F1F3A;
}

.guide-step-row > view text:last-child {
	font-size: 25rpx;
	line-height: 1.6;
	color: #6B7C97;
}

.doc-actions {
	margin-bottom: 72rpx;
}

.online-card {
	padding: 36rpx;
	display: flex;
	align-items: center;
	gap: 24rpx;
	border-radius: 28rpx;
	background: linear-gradient(135deg, #1E6FE0 0%, #3A86FF 100%);
	color: #FFFFFF;
	box-shadow: 0 20rpx 48rpx -18rpx rgba(30, 111, 224, 0.55);
	box-sizing: border-box;
}

.online-icon {
	width: 88rpx;
	height: 88rpx;
	display: flex;
	align-items: center;
	justify-content: center;
	flex-shrink: 0;
	border-radius: 24rpx;
	background: rgba(255, 255, 255, 0.18);
}

.online-copy {
	min-width: 0;
	flex: 1;
	display: flex;
	flex-direction: column;
	gap: 6rpx;
}

.online-copy text:first-child {
	font-size: 30rpx;
	font-weight: 800;
}

.online-copy text:last-child {
	font-size: 23rpx;
	color: rgba(255, 255, 255, 0.85);
}

.soft-button {
	height: 64rpx;
	padding: 0 24rpx;
	display: flex;
	align-items: center;
	justify-content: center;
	border-radius: 999rpx;
	background: #FFFFFF;
	color: #0A4FB8;
	font-size: 24rpx;
	font-weight: 700;
}

.hotline-grid {
	display: flex;
	gap: 20rpx;
}

.hotline-card {
	min-width: 0;
	flex: 1;
	padding: 28rpx;
	border-radius: 24rpx;
	background: #FFFFFF;
	box-shadow: 0 2rpx 4rpx rgba(15, 31, 58, 0.04), 0 8rpx 28rpx rgba(30, 111, 224, 0.05);
	box-sizing: border-box;
}

.hotline-card > view:first-child {
	display: flex;
	align-items: center;
	gap: 12rpx;
	color: #1E6FE0;
}

.hotline-card > view:first-child .glyph {
	width: 36rpx;
	height: 36rpx;
}

.hotline-card > view:first-child text {
	font-size: 25rpx;
	font-weight: 700;
	color: #0F1F3A;
}

.hotline-card > text:nth-child(2) {
	display: block;
	margin-top: 16rpx;
	font-size: 30rpx;
	font-weight: 800;
	color: #1E6FE0;
}

.hotline-card > text:nth-child(3) {
	display: block;
	margin-top: 6rpx;
	font-size: 21rpx;
	color: #94A3B8;
}

.small-primary {
	height: 64rpx;
	margin-top: 20rpx;
	display: flex;
	align-items: center;
	justify-content: center;
	border-radius: 999rpx;
	background: linear-gradient(180deg, #3A86FF 0%, #1E6FE0 100%);
	color: #FFFFFF;
	font-size: 25rpx;
	font-weight: 700;
}

.address-card {
	padding: 32rpx;
	display: flex;
	align-items: flex-start;
	gap: 20rpx;
	border-radius: 24rpx;
	background: #FFFFFF;
	box-shadow: 0 2rpx 4rpx rgba(15, 31, 58, 0.04), 0 8rpx 28rpx rgba(30, 111, 224, 0.05);
	box-sizing: border-box;
}

.address-card > .glyph {
	width: 44rpx;
	height: 44rpx;
	color: #DC2626;
}

.address-copy {
	min-width: 0;
	flex: 1;
	display: flex;
	flex-direction: column;
	gap: 10rpx;
}

.address-copy text:first-child {
	font-size: 27rpx;
	font-weight: 700;
	color: #0F1F3A;
}

.address-header {
	padding: 28rpx 32rpx;
	background: #FFFFFF;
	display: flex;
	align-items: center;
	justify-content: space-between;
	border-bottom: 1rpx solid #F1F5F9;
}

.address-back {
	width: 48rpx;
	height: 48rpx;
	display: flex;
	align-items: center;
	justify-content: center;
}

.back-arrow {
	width: 16rpx;
	height: 16rpx;
	border-left: 3rpx solid #0F1F3A;
	border-top: 3rpx solid #0F1F3A;
	transform: rotate(-45deg);
}

.address-title {
	font-size: 32rpx;
	font-weight: 600;
	color: #0F1F3A;
	text-align: center;
}

.address-placeholder {
	width: 48rpx;
}

.address-form {
	margin: 24rpx;
	background: #FFFFFF;
	border-radius: 16rpx;
	padding: 0 28rpx;
	box-shadow: 0 2rpx 8rpx rgba(0, 0, 0, 0.04);
}

.address-field {
	display: flex;
	align-items: center;
	padding: 28rpx 0;
	border-bottom: 1rpx solid #F5F7FA;
	position: relative;
}

.address-field:last-child {
	border-bottom: none;
}

.field-label {
	width: 160rpx;
	flex-shrink: 0;
	font-size: 28rpx;
	color: #324563;
	font-weight: 500;
}

.required-star {
	color: #E5484D;
	margin-right: 4rpx;
}

.field-input {
	flex: 1;
	font-size: 28rpx;
	color: #0F1F3A;
	text-align: left;
}

.field-arrow {
	width: 14rpx;
	height: 14rpx;
	border-right: 2rpx solid #94A3B8;
	border-bottom: 2rpx solid #94A3B8;
	transform: rotate(-45deg);
	margin-left: 16rpx;
	flex-shrink: 0;
}

.address-switch {
	margin: 0 24rpx 24rpx;
	background: #FFFFFF;
	border-radius: 16rpx;
	padding: 28rpx;
	display: flex;
	justify-content: space-between;
	align-items: center;
	box-shadow: 0 2rpx 8rpx rgba(0, 0, 0, 0.04);
}

.switch-left {
	display: flex;
	flex-direction: column;
	gap: 8rpx;
}

.switch-title {
	font-size: 28rpx;
	font-weight: 500;
	color: #324563;
}

.address-actions {
	padding: 24rpx;
	display: flex;
	gap: 20rpx;
}

.address-btn {
	flex: 1;
	height: 88rpx;
	display: flex;
	align-items: center;
	justify-content: center;
	border-radius: 44rpx;
	font-size: 30rpx;
	font-weight: 600;
}

.address-btn-primary {
	background: linear-gradient(180deg, #2A6CD3 0%, #0A4FB8 100%);
	color: #FFFFFF;
	box-shadow: 0 12rpx 32rpx -12rpx rgba(10, 79, 184, 0.45);
}

.address-btn-secondary {
	background: #FFFFFF;
	color: #E5484D;
	border: 2rpx solid #FEE2E2;
}

.address-copy text:not(:first-child) {
	font-size: 24rpx;
	line-height: 1.5;
	color: #6B7C97;
}

.orders-tabs {
	padding-top: 0;
	gap: 30rpx;
}

.orders-tabs-classic {
	padding: 0 28rpx;
	gap: 0;
	background: transparent;
	border-bottom: none;
}

.orders-tab-item {
	margin-right: 32rpx;
	padding: 18rpx 0 18rpx;
	gap: 6rpx;
	font-size: 24rpx;
}

.orders-tab-count {
	font-size: 24rpx;
	font-weight: 600;
	color: inherit;
}

.orders-content-classic {
	padding-top: 18rpx;
}

.order-card-mini {
	margin-bottom: 20rpx;
	padding: 28rpx;
	display: flex;
	align-items: flex-start;
	justify-content: space-between;
	gap: 20rpx;
}

.order-card-mini > view:first-child {
	min-width: 0;
	flex: 1;
	display: flex;
	flex-direction: column;
	gap: 8rpx;
}

.order-card-mini > view:first-child text:nth-child(2) {
	font-size: 28rpx;
	font-weight: 700;
	line-height: 1.35;
	color: #0F1F3A;
}

.order-card-mini > view:first-child text:last-child {
	font-size: 23rpx;
	color: #6B7C97;
}

.order-card-mini > view:last-child {
	display: flex;
	flex-direction: column;
	align-items: flex-end;
	gap: 12rpx;
}

.order-card-mini > view:last-child text:last-child {
	font-size: 30rpx;
	font-weight: 800;
	color: #0F1F3A;
}

.order-card-classic {
	padding: 32rpx 30rpx;
	border-radius: 30rpx;
	background: rgba(255, 255, 255, 0.96);
	box-shadow: 0 10rpx 28rpx rgba(79, 112, 168, 0.08);
}

.order-card-main {
	min-width: 0;
	flex: 1;
	display: flex;
	flex-direction: column;
	gap: 10rpx;
}

.order-card-title {
	display: block;
	max-width: 100%;
	font-size: 28rpx;
	font-weight: 700;
	line-height: 1.35;
	color: #0F1F3A;
	white-space: nowrap;
	overflow: hidden;
	text-overflow: ellipsis;
}

.order-card-fault {
	display: block;
	max-width: 100%;
	font-size: 23rpx;
	line-height: 1.35;
	color: #6B7C97;
	white-space: nowrap;
	overflow: hidden;
	text-overflow: ellipsis;
}

.order-card-meta {
	max-width: 100%;
	display: flex;
	align-items: center;
	gap: 12rpx;
	overflow: hidden;
}

.order-card-meta text {
	min-width: 0;
	max-width: 100%;
	padding: 4rpx 10rpx;
	border-radius: 999rpx;
	background: #F3F8FF;
	color: #5A6C8D;
	font-size: 21rpx;
	line-height: 1.25;
	white-space: nowrap;
	overflow: hidden;
	text-overflow: ellipsis;
}

.order-card-date {
	font-size: 23rpx;
	line-height: 1.3;
	color: #6B7C97;
}

.order-card-side {
	display: flex;
	flex-direction: column;
	align-items: flex-end;
	gap: 18rpx;
}

.order-card-price {
	font-size: 30rpx;
	font-weight: 800;
	line-height: 1.2;
	color: #0F1F3A;
}

.product-card {
	margin-bottom: 20rpx;
	padding: 28rpx;
	display: flex;
	align-items: center;
	gap: 24rpx;
}

.product-icon {
	width: 108rpx;
	height: 108rpx;
	display: flex;
	align-items: center;
	justify-content: center;
	flex-shrink: 0;
	border-radius: 24rpx;
	background: #E8F1FE;
	color: #1E6FE0;
}

.product-copy {
	min-width: 0;
	flex: 1;
	display: flex;
	flex-direction: column;
	align-items: flex-start;
	gap: 6rpx;
}

.product-copy > text:first-child {
	font-size: 28rpx;
	font-weight: 700;
	color: #0F1F3A;
}

.product-copy > text:nth-child(2),
.product-copy > text:nth-child(3) {
	font-size: 22rpx;
	color: #94A3B8;
}

.ghost-mini {
	height: 64rpx;
	padding: 0 22rpx;
	display: flex;
	align-items: center;
	justify-content: center;
	flex-shrink: 0;
	border: 2rpx solid #BFD6F7;
	border-radius: 999rpx;
	background: #FFFFFF;
	color: #1E6FE0;
	font-size: 24rpx;
	font-weight: 700;
}

.switch-card {
	margin-top: 20rpx;
	padding: 28rpx;
	display: flex;
	align-items: center;
	justify-content: space-between;
}

.switch-card > view:first-child {
	display: flex;
	flex-direction: column;
	gap: 6rpx;
}

.switch-card > view:first-child text:first-child {
	font-size: 28rpx;
	font-weight: 700;
	color: #0F1F3A;
}

.switch-card > view:first-child text:last-child {
	font-size: 23rpx;
	color: #94A3B8;
}

.switch-btn {
	position: relative;
	width: 88rpx;
	height: 48rpx;
	border-radius: 999rpx;
	background: #D7E1EE;
	transition: background 120ms;
}

.switch-btn view {
	position: absolute;
	left: 4rpx;
	top: 4rpx;
	width: 40rpx;
	height: 40rpx;
	border-radius: 999rpx;
	background: #FFFFFF;
	box-shadow: 0 4rpx 8rpx rgba(0, 0, 0, 0.15);
	transition: left 120ms;
}

.switch-btn.on {
	background: #1E6FE0;
}

.switch-btn.on view {
	left: 44rpx;
}

.save-button {
	margin-top: 40rpx;
}

.delete-button {
	height: 80rpx;
	margin-top: 10rpx;
	display: flex;
	align-items: center;
	justify-content: center;
	color: #94A3B8;
	font-size: 26rpx;
}

.segment {
	padding: 8rpx;
	display: flex;
	gap: 8rpx;
	border-radius: 999rpx;
	background: #EAF0FA;
}

.segment view {
	flex: 1;
	height: 76rpx;
	display: flex;
	align-items: center;
	justify-content: center;
	border-radius: 999rpx;
	color: #6B7C97;
	font-size: 28rpx;
	font-weight: 600;
}

.segment view.on {
	background: #FFFFFF;
	box-shadow: 0 8rpx 24rpx -8rpx rgba(30, 111, 224, 0.25);
	color: #0A4FB8;
	font-weight: 800;
}

.feedback-tip {
	display: block;
	margin-top: 16rpx;
	padding: 0 8rpx;
	font-size: 23rpx;
	color: #94A3B8;
}

.feedback-card {
	margin-top: 24rpx;
	overflow: hidden;
}

.feedback-area {
	padding: 28rpx 28rpx 12rpx;
	border-bottom: 2rpx solid #F1F5FB;
}

.feedback-area > text,
.feedback-contact > text {
	display: block;
	margin-bottom: 16rpx;
	font-size: 26rpx;
	font-weight: 700;
	color: #324563;
}

.feedback-area textarea {
	width: 100%;
	height: 220rpx;
	font-size: 28rpx;
	line-height: 1.6;
	color: #0F1F3A;
}

.feedback-area > view {
	display: flex;
	align-items: center;
	justify-content: space-between;
	padding-bottom: 16rpx;
	font-size: 22rpx;
	color: #94A3B8;
}

.feedback-images {
	padding: 8rpx 28rpx 28rpx;
	border-bottom: 2rpx solid #F1F5FB;
}

.feedback-media-grid {
	gap: 16rpx;
}

.feedback-contact {
	padding: 28rpx;
}

.contact-kind-row {
	display: flex;
	gap: 16rpx;
	margin-bottom: 20rpx;
}

.contact-kind-row view {
	flex: 1;
	height: 72rpx;
	display: flex;
	align-items: center;
	justify-content: center;
	border: 3rpx solid #E4ECF7;
	border-radius: 20rpx;
	color: #324563;
	font-size: 26rpx;
	font-weight: 600;
	box-sizing: border-box;
}

.contact-kind-row view.on {
	border-color: #1E6FE0;
	background: #E8F1FE;
	color: #0A4FB8;
	font-weight: 800;
}

.contact-input-row {
	height: 84rpx;
	padding: 0 28rpx;
	display: flex;
	align-items: center;
	gap: 20rpx;
	border-radius: 20rpx;
	background: #F5F9FF;
	box-sizing: border-box;
}

.contact-input-row text {
	flex-shrink: 0;
	font-size: 25rpx;
	color: #6B7C97;
}

.contact-input-row input {
	min-width: 0;
	flex: 1;
	height: 72rpx;
	text-align: right;
	font-size: 27rpx;
	color: #0F1F3A;
}

.simple-card {
	margin-top: 20rpx;
	padding: 28rpx;
	display: flex;
	flex-direction: column;
	gap: 10rpx;
}

.simple-card text:first-child {
	font-size: 27rpx;
	font-weight: 700;
	color: #0F1F3A;
}

.simple-card text:nth-child(2) {
	font-size: 23rpx;
	color: #94A3B8;
}

.simple-card input {
	height: 72rpx;
	font-size: 27rpx;
	color: #0F1F3A;
}

.submit-note {
	display: block;
	margin-top: 16rpx;
	text-align: center;
	font-size: 22rpx;
	color: #94A3B8;
}

.feedback-history {
	margin-top: 34rpx;
}

.feedback-ticket-card {
	margin-bottom: 20rpx;
	padding: 28rpx;
	border-radius: 28rpx;
	background: #FFFFFF;
	box-shadow: 0 2rpx 4rpx rgba(15, 31, 58, 0.04), 0 8rpx 28rpx rgba(30, 111, 224, 0.05);
	box-sizing: border-box;
}

.feedback-ticket-head {
	display: flex;
	align-items: flex-start;
	justify-content: space-between;
	gap: 20rpx;
}

.feedback-ticket-head > view {
	min-width: 0;
	display: flex;
	flex-direction: column;
	gap: 8rpx;
}

.feedback-ticket-head > view text:first-child {
	font-size: 29rpx;
	font-weight: 800;
	color: #0F1F3A;
}

.feedback-ticket-head > view text:last-child {
	font-size: 22rpx;
	color: #94A3B8;
}

.feedback-ticket-meta {
	margin-top: 20rpx;
	padding: 20rpx;
	display: grid;
	grid-template-columns: repeat(2, minmax(0, 1fr));
	gap: 16rpx;
	border-radius: 20rpx;
	background: #F7FAFF;
}

.feedback-ticket-meta view {
	display: flex;
	flex-direction: column;
	gap: 6rpx;
}

.feedback-ticket-meta text:first-child {
	font-size: 21rpx;
	color: #94A3B8;
}

.feedback-ticket-meta text:last-child {
	font-size: 24rpx;
	font-weight: 700;
	color: #0F1F3A;
}

.feedback-ticket-content {
	display: block;
	margin-top: 20rpx;
	font-size: 25rpx;
	line-height: 1.6;
	color: #324563;
}

.feedback-ticket-images {
	margin-top: 18rpx;
	display: flex;
	flex-wrap: wrap;
	gap: 14rpx;
}

.feedback-ticket-image {
	width: 112rpx;
	height: 112rpx;
	border-radius: 14rpx;
	background: #F3F8FF;
}

.feedback-reply {
	margin-top: 20rpx;
	padding: 22rpx;
	display: flex;
	flex-direction: column;
	gap: 8rpx;
	border-radius: 20rpx;
	background: #F3F8FF;
}

.feedback-reply text:first-child {
	font-size: 23rpx;
	font-weight: 800;
	color: #1E6FE0;
}

.feedback-reply text:last-child {
	font-size: 23rpx;
	line-height: 1.5;
	color: #5A6C8D;
}

.login-module {
	padding-top: 80rpx;
	display: flex;
	flex-direction: column;
	align-items: center;
	text-align: center;
}

.login-logo {
	width: 152rpx;
	height: 152rpx;
	display: flex;
	align-items: center;
	justify-content: center;
	border-radius: 44rpx;
	background: linear-gradient(135deg, #3A86FF 0%, #1E6FE0 100%);
	box-shadow: 0 24rpx 56rpx -16rpx rgba(30, 111, 224, 0.45);
	color: #FFFFFF;
}

.login-logo .glyph {
	width: 84rpx;
	height: 84rpx;
}

.login-title {
	margin-top: 36rpx;
	font-size: 44rpx;
	font-weight: 800;
	color: #0F1F3A;
}

.login-desc {
	margin-top: 12rpx;
	font-size: 26rpx;
	color: #6B7C97;
}

.wechat-login,
.phone-login {
	width: 100%;
	height: 100rpx;
	margin-top: 72rpx;
	display: flex;
	align-items: center;
	justify-content: center;
	border-radius: 999rpx;
	font-size: 30rpx;
	font-weight: 700;
	box-sizing: border-box;
}

.wechat-login {
	background: #07C160;
	box-shadow: 0 16rpx 36rpx -12rpx rgba(7, 193, 96, 0.45);
	color: #FFFFFF;
	border: none;
	line-height: 100rpx;
	padding: 0;
}

.wechat-login::after {
	border: none;
}

.phone-login {
	margin-top: 20rpx;
	border: 2rpx solid #E4ECF7;
	background: #FFFFFF;
	color: #0F1F3A;
}

.login-agree {
	margin-top: 48rpx;
	padding: 0 40rpx;
	font-size: 23rpx;
	line-height: 1.7;
	color: #94A3B8;
}

.glyph-cam::before {
	left: 5rpx;
	top: 14rpx;
	width: 38rpx;
	height: 28rpx;
	border: 4rpx solid currentColor;
	border-radius: 6rpx;
}

.glyph-cam::after {
	left: 17rpx;
	top: 21rpx;
	width: 14rpx;
	height: 14rpx;
	border: 4rpx solid currentColor;
	border-radius: 999rpx;
}

.glyph-cam .glyph-extra {
	left: 14rpx;
	top: 7rpx;
	width: 20rpx;
	height: 10rpx;
	border-radius: 8rpx 8rpx 0 0;
	background: currentColor;
}

.glyph-tooth::before {
	left: 8rpx;
	top: 4rpx;
	width: 32rpx;
	height: 40rpx;
	border: 4rpx solid currentColor;
	border-radius: 18rpx 18rpx 22rpx 22rpx;
}

.glyph-tooth::after {
	left: 16rpx;
	top: 8rpx;
	width: 8rpx;
	height: 8rpx;
	border-radius: 999rpx;
	background: currentColor;
	box-shadow: 8rpx 0 0 currentColor;
}

/* 按机型保修 / 延保 / 收费阶梯 */
.warranty-group { margin-bottom: 16rpx; }
.warranty-group-title { font-size: 27rpx; font-weight: 600; color: #1E6FE0; margin: 12rpx 0 8rpx; }
.warranty-rule-row { padding: 16rpx 0; border-bottom: 1px solid #f0f2f5; }
.warranty-rule-row:last-child { border-bottom: none; }
.warranty-rule-head { display: flex; justify-content: space-between; align-items: center; }
.warranty-rule-model { font-size: 27rpx; color: #1d2129; font-weight: 500; }
.warranty-rule-period { font-size: 25rpx; color: #C97A6B; font-weight: 600; }
.warranty-rule-terms { display: block; margin-top: 6rpx; font-size: 24rpx; line-height: 1.6; color: #86909c; }
.warranty-extended .ext-block { margin-bottom: 14rpx; }
.warranty-extended .ext-block:last-child { margin-bottom: 0; }
.ext-label { display: block; font-size: 25rpx; font-weight: 600; color: #1d2129; margin-bottom: 4rpx; }
.ext-text { font-size: 25rpx; line-height: 1.7; color: #4e5969; white-space: pre-wrap; }
.fee-tier-card { background: #fff; border-radius: 16rpx; padding: 8rpx 24rpx; margin-bottom: 20rpx; }
.fee-tier-head { display: flex; justify-content: space-between; padding: 16rpx 0; font-size: 24rpx; color: #86909c; border-bottom: 1px solid #f0f2f5; }
.fee-tier-row { display: flex; justify-content: space-between; align-items: center; padding: 18rpx 0; border-bottom: 1px solid #f7f8fa; }
.fee-tier-row:last-child { border-bottom: none; }
.fee-tier-name { display: flex; flex-direction: column; }
.fee-tier-name > text:first-child { font-size: 27rpx; color: #1d2129; }
.fee-tier-note { font-size: 22rpx; color: #86909c; margin-top: 4rpx; }
.fee-tier-price { font-size: 29rpx; font-weight: 700; color: #D97706; }
.fee-tier-unit { font-size: 22rpx; font-weight: 400; color: #86909c; }
/* 教程媒体列表 */
.guide-media-list { background: #fff; border-radius: 16rpx; padding: 8rpx 24rpx; margin-bottom: 20rpx; }
.guide-media-item { display: flex; align-items: center; gap: 16rpx; padding: 20rpx 0; border-bottom: 1px solid #f7f8fa; }
.guide-media-item:last-child { border-bottom: none; }
.guide-media-type { font-size: 24rpx; color: #1E6FE0; flex-shrink: 0; }
.guide-media-name { flex: 1; font-size: 26rpx; color: #1d2129; overflow: hidden; white-space: nowrap; text-overflow: ellipsis; }
.guide-media-open { font-size: 24rpx; color: #86909c; flex-shrink: 0; }
</style>
