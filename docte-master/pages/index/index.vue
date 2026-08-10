<template>
	<view class="page-shell">
		<view v-if="activeModule" class="module-page">
			<view v-if="activeModule !== 'login'" class="module-head" :style="moduleHeadStyle">
				<view class="back-button tap" @click="returnFromModule"></view>
				<view class="module-title-wrap">
					<text class="module-title">{{ moduleInfo.title }}</text>
					<text class="module-subtitle">{{ moduleInfo.subtitle }}</text>
				</view>
				<image
					v-if="activeModule !== 'repair'"
					class="module-brand-watermark"
					:src="cicadaAssets.logoHeader"
					mode="aspectFit"
				></image>
			</view>

			<view v-if="activeModule === 'repair'" class="module-content repair-module">
				<view class="warm-card">
					<text class="warm-strong">温馨提示：</text>
					<text>为了给您提供更快更好的服务，请务必在快递里面留纸条写明：寄回原因或故障描述，联系方式和收件地址。</text>
				</view>
				<view class="module-section-head repair-section-head tap" @click="toggleRepairSection('user')">
					<text>用户信息</text>
					<view class="repair-section-toggle"><text>{{ repairSectionOpen.user ? '收起' : (customerTypeLabel(repairForm.customerType) || '展开') }}</text><view class="section-chevron" :class="{ open: repairSectionOpen.user }"></view></view>
				</view>
				<view v-show="repairSectionOpen.user" class="repair-form-card">
					<view class="repair-field select-row tap" @click="openCustomerTypePicker">
						<text><text class="required-star">*</text>用户类型</text>
						<text class="select-value">{{ customerTypeLabel(repairForm.customerType) || '请选择用户类型' }}</text>
						<view class="field-arrow"></view>
					</view>
				</view>
				<view class="module-section-head repair-section-head tap" @click="toggleRepairSection('products')">
					<text>产品信息</text>
					<view class="repair-section-toggle"><text>{{ repairSectionOpen.products ? `共 ${repairProducts.length} 件 · 收起` : `共 ${repairProducts.length} 件 · 展开` }}</text><view class="section-chevron" :class="{ open: repairSectionOpen.products }"></view></view>
				</view>
				<view v-show="repairSectionOpen.products" class="repair-section-body">
				<view v-for="(product, index) in repairProducts" :key="product.id" class="repair-product">
						<view class="repair-product-strip">
							<view class="repair-product-name">
								<text>{{ index + 1 }}</text>
								<text>报修产品 #{{ index + 1 }}</text>
							</view>
							<view v-if="repairProducts.length > 1" class="remove-link tap" @click="removeRepairProduct(index)">移除</view>
						</view>
						<view class="repair-form-card">
							<view class="repair-field select-row tap" @click="openProductPicker(index)">
								<text><text class="required-star">*</text>产品名称</text>
								<text class="select-value" :class="{ placeholder: !product.name }">{{ repairProductNameText(product) }}</text>
								<view class="field-arrow"></view>
							</view>
							<view v-if="isOtherRepairProduct(product)" class="repair-field">
								<text><text class="required-star">*</text>其他名称</text>
								<input v-model.trim="product.name" maxlength="80" placeholder="请输入产品名称" placeholder-class="input-placeholder" />
							</view>
							<view class="repair-field">
								<text><text class="required-star">*</text>产品序列号</text>
								<input v-model="product.serial" placeholder="输入" placeholder-class="input-placeholder" @blur="recognizeSn(index)" />
							</view>
							<!-- SN 识别结果 -->
							<view v-if="product.snLoading" class="sn-result loading"><text>正在识别设备…</text></view>
							<view v-else-if="getSnValidationMessage(product)" class="sn-result error"><text>{{ getSnValidationMessage(product) }}</text></view>
							<view v-else-if="product.snInfo && product.snInfo.found" class="sn-result">
								<view class="sn-result-row">
									<text class="sn-result-label">已识别</text>
									<text class="sn-tag" :class="'sn-tag-' + (product.snInfo.warrantyStatus || 'unknown')">{{ snWarrantyLabel(product.snInfo) }}</text>
								</view>
								<text v-if="product.snInfo.productCategory" class="sn-result-line">分类：{{ product.snInfo.productCategory }}</text>
								<text v-if="product.snInfo.model" class="sn-result-line">型号：{{ product.snInfo.model }}</text>
								<text v-if="product.snInfo.warrantyExpire" class="sn-result-line">质保至：{{ product.snInfo.warrantyExpire }}</text>
								<view v-if="product.snInfo.history && product.snInfo.history.length" class="sn-result-history tap" @click="openSnHistory(index)">
									<text class="sn-result-line link">历史维修：{{ product.snInfo.history.length }} 单 ›</text>
								</view>
							</view>
							<view v-else-if="product.snInfo && !product.snInfo.found && product.serial" class="sn-result muted"><text>首次报修可手动填写，提交后会自动登记</text></view>
							<view v-if="!product.name" class="repair-field select-row tap" @click="openProductPicker(index)">
								<text><text class="required-star">*</text>产品型号</text>
								<text class="select-value placeholder">请先选择产品名称</text>
								<view class="field-arrow"></view>
							</view>
							<view v-else-if="isOtherRepairProduct(product)" class="repair-field">
								<text><text class="required-star">*</text>产品型号</text>
								<input v-model.trim="product.model" maxlength="80" placeholder="请输入产品型号" placeholder-class="input-placeholder" />
							</view>
							<template v-else>
								<view class="repair-field select-row tap" @click="openRepairModelPicker(index)">
									<text><text class="required-star">*</text>产品型号</text>
									<text class="select-value" :class="{ placeholder: !product.model }">{{ repairProductModelText(product) }}</text>
									<view class="field-arrow"></view>
								</view>
								<view v-if="isOtherRepairModel(product)" class="repair-field repair-custom-model-field">
									<text><text class="required-star">*</text>其他型号</text>
									<input
										v-model="product.customModel"
										maxlength="80"
										placeholder="请输入自定义产品型号"
										placeholder-class="input-placeholder"
										@input="syncCustomRepairModel(index, $event.detail.value)"
										@blur="syncCustomRepairModel(index, $event.detail.value, true)"
									/>
								</view>
							</template>
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
									<text>产品清单 / 故障图片或视频 <text class="field-optional">选填</text></text>
									<text>{{ product.media.length }}/3</text>
								</view>
								<view class="media-grid">
									<view v-for="media in product.media" :key="media.id" class="media-thumb">
										<image v-if="media.type === 'image'" class="media-image" :src="getPreviewUrl(media)" mode="aspectFill"></image>
										<view v-else class="media-video">
											<image v-if="media.coverPath" class="media-image" :src="media.coverPath" mode="aspectFill"></image>
											<view class="media-video-overlay">
												<view class="glyph glyph-cam"><view class="glyph-extra"></view></view>
												<text>视频</text>
											</view>
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
				</view>

				<view class="module-section-head repair-section-head tap" @click="toggleRepairSection('sender')">
					<text>寄出信息</text>
					<view class="repair-section-actions"><text class="tap" @click.stop="chooseWechatAddress('sender')">微信地址</text><text class="tap" @click.stop="openSavedAddressPicker('sender')">常用地址</text><view class="repair-section-toggle"><text>{{ repairSectionOpen.sender ? '收起' : '展开' }}</text><view class="section-chevron" :class="{ open: repairSectionOpen.sender }"></view></view></view>
				</view>
				<view v-show="repairSectionOpen.sender" class="repair-section-body">
				<view class="blue-tip">请妥善包装好设备，顺丰取件请在快递员到达后提供运单号。</view>
				<view class="repair-form-card">
					<view class="repair-field">
						<text><text class="required-star">*</text>寄件人</text>
						<input v-model="repairForm.senderName" placeholder="请输入寄件人姓名" placeholder-class="input-placeholder" />
					</view>
					<view class="repair-field">
						<text><text class="required-star">*</text>联系电话</text>
						<input v-model="repairForm.senderPhone" placeholder="请输入寄件人手机" placeholder-class="input-placeholder" type="number" />
					</view>
					<view class="repair-field last">
						<text><text class="required-star">*</text>寄出地址</text>
						<input v-model="repairForm.senderAddress" placeholder="请输入寄出详细地址" placeholder-class="input-placeholder" />
					</view>
				</view>
				<view class="invoice-type-row send-mode-row">
					<view class="tap" :class="{ on: !trackingLater }" @click="trackingLater = false">
						<text>已有运单号</text>
						<text>现在填写快递单号</text>
					</view>
					<view class="tap" :class="{ on: trackingLater }" @click="trackingLater = true">
						<text>稍后补单号</text>
						<text>取件后在工单补填</text>
					</view>
				</view>
				<view class="repair-form-card">
					<view class="repair-field select-row tap" @click="openRepairLogisticsPicker">
						<text><text class="required-star">*</text>物流公司</text>
						<text class="select-value">{{ repairForm.logisticsCompany || '请选择物流公司' }}</text>
						<view class="field-arrow"></view>
					</view>
					<view class="repair-field">
						<text><text v-if="!trackingLater" class="required-star">*</text>运单号</text>
						<input v-model="repairForm.trackingNo" :placeholder="trackingLater ? '可稍后在工单详情补填' : '请输入运单号'" placeholder-class="input-placeholder" />
						<view class="scan-icon tap" @click="scanTrackingNo">
							<view class="scan-corner"></view>
							<view class="scan-corner"></view>
							<view class="scan-corner"></view>
						</view>
					</view>
				</view>
				</view>

				<view class="module-section-head repair-section-head tap" @click="toggleRepairSection('receiver')">
					<text>回寄信息</text>
					<view class="repair-section-actions"><text class="tap" @click.stop="chooseWechatAddress('receiver')">微信地址</text><text class="tap" @click.stop="openSavedAddressPicker('receiver')">常用地址</text><view class="repair-section-toggle"><text>{{ repairSectionOpen.receiver ? '收起' : '展开' }}</text><view class="section-chevron" :class="{ open: repairSectionOpen.receiver }"></view></view></view>
				</view>
				<view v-show="repairSectionOpen.receiver" class="repair-form-card">
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
					</view>
					<view class="repair-field last">
						<text><text class="required-star">*</text>单位名称</text>
						<input v-model="repairForm.receiverUnit" placeholder="请输入单位名称" placeholder-class="input-placeholder" />
					</view>
				</view>

				<view class="repair-brand-watermark">
					<image :src="cicadaAssets.logoCompact" mode="aspectFit"></image>
					<text>思科达售后服务中心</text>
				</view>

				<view v-if="!uploadPrivacyVisible" class="repair-bottom-bar">
					<view class="bottom-more tap" @click="showRepairTools = true">
						<view class="bottom-more-icon"><view></view><view></view><view></view></view>
						<text>工具</text>
					</view>
					<view class="bottom-submit tap" :class="{ disabled: repairSubmitting }" @click="submitRepair">{{ repairSubmitting ? '提交中...' : '立即提交报修' }}</view>
				</view>

				<view v-if="showSavedAddressPicker" class="sheet-mask" @click="showSavedAddressPicker = false" @touchmove.stop></view>
				<view v-if="showSavedAddressPicker" class="choice-sheet" @touchmove.stop>
					<view class="choice-head">
						<text class="tap" @click="showSavedAddressPicker = false">取消</text>
						<text>选择常用地址</text>
						<text class="tap" @click="addSavedAddress">新增</text>
					</view>
					<scroll-view class="choice-scroll" scroll-y enhanced :show-scrollbar="false" :bounces="true">
						<view v-for="item in savedAddressOptions" :key="item.id || item._id" class="choice-row address-choice-row tap" @click="selectSavedAddress(item)">
							<view>
								<text>{{ item.receiver || item.name }}　{{ item.phone }}</text>
								<text class="address-choice-detail">{{ savedAddressText(item) }}</text>
							</view>
							<text v-if="item.isDefault" class="address-choice-default">默认</text>
						</view>
					</scroll-view>
				</view>

				<view v-if="showCustomerTypePicker" class="sheet-mask" @click="showCustomerTypePicker = false" @touchmove.stop></view>
				<view v-if="showCustomerTypePicker" class="choice-sheet" @touchmove.stop>
					<view class="choice-head">
						<text class="tap" @click="showCustomerTypePicker = false">取消</text>
						<text>选择用户类型</text>
						<text></text>
					</view>
					<scroll-view class="choice-scroll" scroll-y enhanced :show-scrollbar="false" :bounces="true">
						<view v-for="item in customerTypeOptions" :key="item.value" class="choice-row tap" @click="selectCustomerType(item)">
							<text>{{ item.label }}</text>
							<view v-if="repairForm.customerType === item.value" class="mini-icon mini-check"></view>
						</view>
					</scroll-view>
				</view>

				<view v-if="showProductPicker" class="sheet-mask" @click="closeProductPicker" @touchmove.stop></view>
				<view v-if="showProductPicker" class="choice-sheet" @touchmove.stop>
					<view class="choice-head">
						<text class="tap" @click="closeProductPicker">取消</text>
						<text>选择产品名称</text>
						<text></text>
					</view>
					<view class="product-choice-search">
						<view class="glyph glyph-search glyph-search-small"></view>
						<input v-model.trim="repairProductKeyword" maxlength="60" confirm-type="search" placeholder="产品名称、型号或拼音首字母" placeholder-class="input-placeholder" />
					</view>
					<scroll-view class="choice-scroll product-choice-scroll" scroll-y enhanced :show-scrollbar="false" :bounces="true">
						<view v-if="repairProductLoading && !repairProductOptions.length" class="choice-empty">产品名称加载中...</view>
						<view v-else-if="filteredRepairProductOptions.length">
							<view v-for="item in filteredRepairProductOptions" :key="item.value" class="choice-row choice-row-product tap" @click="selectRepairProduct(item)">
								<view>
									<text>{{ item.label }}</text>
								</view>
								<view v-if="isActiveRepairProduct(item)" class="mini-icon mini-check"></view>
							</view>
						</view>
						<view v-else class="choice-empty">没有匹配的产品</view>
						<view v-if="!repairProductLoading" class="choice-row choice-row-product choice-row-other tap" @click="selectRepairProduct(repairProductOtherOption)">
							<view>
								<text>{{ repairProductOtherOption.label }}</text>
								<text>自行填写产品名称</text>
							</view>
							<view v-if="isOtherRepairProduct(activeRepairProduct)" class="mini-icon mini-check"></view>
						</view>
					</scroll-view>
				</view>

				<view v-if="showRepairModelPicker" class="sheet-mask" @click="closeRepairModelPicker" @touchmove.stop></view>
				<view v-if="showRepairModelPicker" class="choice-sheet" @touchmove.stop>
					<view class="choice-head">
						<text class="tap" @click="closeRepairModelPicker">取消</text>
						<text>选择产品型号</text>
						<text></text>
					</view>
					<scroll-view class="choice-scroll" scroll-y enhanced :show-scrollbar="false" :bounces="true">
						<view v-for="item in activeRepairModelOptions" :key="item.value" class="choice-row tap" @click="selectRepairProductModel(item)">
							<text>{{ item.label }}</text>
							<view v-if="isActiveRepairModelOption(item)" class="mini-icon mini-check"></view>
						</view>
					</scroll-view>
				</view>

				<view v-if="showRepairLogisticsPicker" class="sheet-mask" @click="closeRepairLogisticsPicker" @touchmove.stop></view>
				<view v-if="showRepairLogisticsPicker" class="choice-sheet" @touchmove.stop>
					<view class="choice-head">
						<text class="tap" @click="closeRepairLogisticsPicker">取消</text>
						<text>选择物流公司</text>
						<text></text>
					</view>
					<scroll-view class="choice-scroll" scroll-y enhanced :show-scrollbar="false" :bounces="true">
						<view v-for="item in logisticsList" :key="item.value" class="choice-row tap" @click="selectRepairLogistics(item)">
							<text>{{ item.label }}</text>
							<view v-if="repairForm.logisticsCompany === item.value" class="mini-icon mini-check"></view>
						</view>
					</scroll-view>
				</view>
			</view>

			<view v-else-if="activeModule === 'repair-success'" class="module-content success-module">
				<view class="success-icon"><view class="mini-icon mini-check mini-check-white"></view></view>
				<text class="success-title">报修已提交</text>
				<text class="success-desc">工作人员将尽快联系您</text>
				<view class="success-card">
					<view class="success-row"><text>工单号</text><text class="copy-link tap" @click="copyOne(submittedOrderId, '工单号')">复制</text></view>
					<text class="success-no">{{ submittedOrderId || '工单号生成中' }}</text>
					<view class="success-grid">
						<view><text>响应状态</text><text>等待客服受理</text></view>
						<view><text>寄出物流</text><text>{{ submittedLogisticsText }}</text></view>
					</view>
					<text class="success-archive-tip">本次报修的设备已记入「我的设备」档案，维修完成后保修状态与历史工单会自动更新。</text>
				</view>
				<view class="dual-actions">
					<view class="ghost-button tap" @click="closeModule">返回首页</view>
					<view class="primary-button tap" @click="go('track')">查看进度</view>
				</view>
				<view class="continue-repair-button tap" @click="startNewRepair">继续新建报修单</view>
			</view>

			<view v-else-if="activeModule === 'track'" class="track-module">
				<view class="track-search-wrap">
					<view class="track-search">
						<view class="glyph glyph-search glyph-search-small"><view class="glyph-extra"></view></view>
						<input v-model.trim="trackSearchKeyword" placeholder="输入工单号 / 产品名称 / 序列号查询" placeholder-class="input-placeholder" confirm-type="search" />
					</view>
				</view>
				<scroll-view class="progress-tabs-line progress-tabs-compact" scroll-x show-scrollbar="false" enhanced>
					<view v-for="item in trackTabs" :key="item" class="progress-tab tap" :class="{ on: activeTrackTab === item }" @click="activeTrackTab = item">
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
					<view class="package-tabs">
						<view v-for="tb in packageTabs" :key="tb.key" class="package-tab tap" :class="{ on: activePackageTab === tb.key }" @click="activePackageTab = tb.key">{{ tb.label }}</view>
					</view>
					<block v-if="currentPackage && currentPackage.available">
						<view class="package-result-head">
							<view>
								<text class="muted-line">快递单号</text>
								<text class="package-no">{{ currentPackage.trackingNo || '待录入' }}</text>
							</view>
							<text :class="['tag', 'tag-' + currentPackage.tone]">{{ currentPackage.status }}</text>
						</view>
						<view v-if="currentPackage.trackingNo" class="package-copy-row">
							<text class="copy-link tap" @click="copyOne(currentPackage.trackingNo, 'pkgNo')">{{ copied === 'pkgNo' ? '已复制单号' : '复制单号' }}</text>
						</view>
						<view v-if="currentPackage.stagnant" class="package-stagnant-notice">
							<text>⚠ 包裹超 72 小时无状态更新，可能存在停滞。如有疑问可联系客服核实。</text>
							<text class="copy-link tap" @click="openCustomerService">联系客服</text>
						</view>
						<view class="package-result-grid">
							<view><text>物流公司</text><text>{{ currentPackage.company || '待录入' }}</text></view>
							<view class="package-linked-order tap" @click="openLinkedOrder(packageQueryResult.orderId)">
								<text>关联工单</text>
								<text :class="{ 'package-order-link': packageQueryResult.orderId }">{{ packageQueryResult.orderId || '待关联' }}{{ packageQueryResult.orderId ? ' ›' : '' }}</text>
							</view>
						</view>
						<view class="package-progress">
							<view v-for="(step, index) in packageTabFlow[activePackageTab]" :key="step" class="progress-step" :class="{ reached: index <= currentPackage.reached }">
								<view></view>
								<text>{{ step }}</text>
							</view>
						</view>
						<view class="module-section-head single package-timeline-title"><text>包裹记录</text></view>
						<view class="package-timeline">
							<view v-for="(item, index) in currentPackage.timeline" :key="item.title + index" class="detail-timeline-row">
								<view class="detail-timeline-pin" :class="{ pending: item.pending }">
									<view></view>
									<view v-if="index < currentPackage.timeline.length - 1"></view>
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
						<view v-if="currentPackage.realtime === false" class="package-privacy-note package-estimate-note">
							<text>说明</text>
							<text>当前节点为工单状态估算，具体物流轨迹请以快递公司官方查询为准。</text>
						</view>
					</block>
					<view v-else class="empty-hint compact package-empty">{{ activePackageTab === 'back' ? '设备尚未回寄，修好寄回后可在此查看回寄物流。' : '暂无寄出物流记录。' }}</view>
				</view>
				<view v-else-if="packageQuerySearched" class="package-result-card package-notfound-card">
					<view class="empty-hint compact package-empty">暂未查到这票包裹。请确认快递单号是否正确，或等我们签收录入后再查询。</view>
					<view class="package-notfound-actions">
						<view class="return-logistics-btn tap" @click="copyOne(packageQuery.trackingNo, 'failedPkgNo')">{{ copied === 'failedPkgNo' ? '已复制' : '复制输入的单号' }}</view>
						<view class="return-logistics-btn primary tap" @click="openCustomerService">联系客服</view>
					</view>
				</view>
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
						<view class="invoice-type-row">
							<view v-for="item in invoiceKindOptions" :key="item.value" class="tap" :class="{ on: invoiceForm.invoiceType === item.value }" @click="selectInvoiceKind(item.value)">
								<text>{{ item.label }}</text>
								<text>{{ item.desc }}</text>
							</view>
						</view>
						<view class="invoice-type-row">
							<view v-for="item in invoiceTitleTypes" :key="item.value" class="tap" :class="{ on: invoiceForm.titleType === item.value, disabled: isPaperInvoice && item.value !== 'company' }" @click="selectInvoiceTitleType(item.value)">
								<text>{{ item.label }}</text>
								<text>{{ item.desc }}</text>
							</view>
						</view>
						<view class="repair-field">
							<text><text class="required-star">*</text>发票抬头</text>
							<input v-model="invoiceForm.title" placeholder="请输入发票抬头" placeholder-class="input-placeholder" />
							<view v-if="canChooseInvoiceTitle" class="native-field-action tap" @click="chooseWechatInvoiceTitle">微信抬头</view>
						</view>
						<view v-if="invoiceForm.titleType === 'company'" class="repair-field">
							<text><text class="required-star">*</text>税号</text>
							<input v-model="invoiceForm.taxNo" placeholder="请输入纳税人识别号" placeholder-class="input-placeholder" />
						</view>
						<view class="repair-field">
							<text><text class="required-star">*</text>接收邮箱</text>
							<input v-model="invoiceForm.email" :placeholder="isPaperInvoice ? '用于接收开票进度通知' : '用于接收电子发票'" placeholder-class="input-placeholder" />
						</view>
						<template v-if="isPaperInvoice">
							<view class="repair-field">
								<text><text class="required-star">*</text>注册地址</text>
								<input v-model="invoiceForm.registerAddress" placeholder="营业执照上的注册地址" placeholder-class="input-placeholder" />
							</view>
							<view class="repair-field">
								<text><text class="required-star">*</text>注册电话</text>
								<input v-model="invoiceForm.registerPhone" placeholder="注册登记的联系电话" placeholder-class="input-placeholder" />
							</view>
							<view class="repair-field">
								<text><text class="required-star">*</text>开户银行</text>
								<input v-model="invoiceForm.bankName" placeholder="基本户开户银行全称" placeholder-class="input-placeholder" />
							</view>
							<view class="repair-field">
								<text><text class="required-star">*</text>银行账号</text>
								<input v-model="invoiceForm.bankAccount" placeholder="对公银行账号" placeholder-class="input-placeholder" />
							</view>
							<view class="repair-field">
								<text><text class="required-star">*</text>收票人</text>
								<input v-model="invoiceForm.recipientName" placeholder="纸质发票收件人姓名" placeholder-class="input-placeholder" />
							</view>
							<view class="repair-field">
								<text><text class="required-star">*</text>收票手机号</text>
								<input v-model="invoiceForm.recipientPhone" placeholder="收件人手机号" placeholder-class="input-placeholder" type="number" maxlength="11" />
							</view>
							<view class="repair-field">
								<text><text class="required-star">*</text>收票地址</text>
								<input v-model="invoiceForm.recipientAddress" placeholder="纸质发票邮寄地址" placeholder-class="input-placeholder" />
							</view>
						</template>
						<view class="repair-field last">
							<text>备注</text>
							<input v-model="invoiceForm.remark" placeholder="选填，如开票特殊说明" placeholder-class="input-placeholder" />
						</view>
					</view>
					<view class="invoice-tip">
						<text v-if="isPaperInvoice">纸质专用发票仅支持企业抬头，财务审核开具后邮寄到收票地址，请确保收票信息准确无误。</text>
						<text v-else>电子普通发票开具后可复制链接查看，同时会发送到接收邮箱。若需纸质专用发票，请切换上方发票类型。</text>
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
						<view class="invoice-issued-ribbon">{{ order.invoiceType === '纸质专用发票' ? '纸质专票' : '电子发票' }}</view>
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
							<view><text>开票状态</text><text>{{ order.invoiceType === '纸质专用发票' ? (order.invoiceStatus || getInvoiceMeta(order).stage) : getInvoiceMeta(order).stage }}</text></view>
							<view v-if="order.invoiceType === '纸质专用发票'"><text>邮寄快递</text><text>{{ order.invoiceMailCompany || '待寄出' }}</text></view>
							<view v-else><text>电子链接</text><text>{{ order.invoiceUrl ? '已生成' : '待同步' }}</text></view>
							<view v-if="order.invoiceType === '纸质专用发票' && order.invoiceMailNo"><text>邮寄单号</text><text>{{ order.invoiceMailNo }}</text></view>
						</view>
						<view class="invoice-order-actions">
							<view class="ghost-button tap" @click="openOrderDetail(order)">查看工单</view>
							<view v-if="order.invoiceType === '纸质专用发票'" class="primary-button tap" :class="{ disabled: !order.invoiceMailNo }" @click="copyInvoiceMailNo(order)">
								{{ order.invoiceMailNo ? (copied === 'invMail-' + order.id ? '已复制邮寄单号' : '复制邮寄单号') : '待财务寄出' }}
							</view>
							<view v-else class="primary-button tap" @click="copyInvoiceLink(order)">复制发票链接</view>
						</view>
					</view>
					<view v-if="!invoiceIssuedOrders.length" class="empty-hint compact">暂无已开具的发票。</view>
				</view>
			</view>

			<view v-else-if="activeModule === 'order-detail'" class="module-content">
				<view class="detail-hero">
					<view class="detail-hero-top">
						<text>工单号</text>
						<text :class="['tag', 'tag-muted-light']">{{ detailOrder.status }}</text>
					</view>
					<view class="detail-order-no-row">
						<text class="detail-order-no" user-select>{{ detailOrder.id }}</text>
						<view class="detail-order-copy tap" @click="copyOne(detailOrder.id, 'detailOrderNo')">
							<view v-if="copied === 'detailOrderNo'" class="mini-icon mini-check mini-check-white"></view>
							<view v-else class="mini-icon mini-copy mini-copy-white"></view>
							<text>{{ copied === 'detailOrderNo' ? '已复制' : '复制' }}</text>
						</view>
					</view>
					<view class="detail-hero-grid">
						<view><text>产品</text><text>{{ detailOrder.model }}</text></view>
						<view><text>预计完成</text><text>{{ detailOrder.doneTime }}</text></view>
					</view>
				</view>
				<view class="module-section-head single"><text>报修信息</text></view>
				<view v-if="detailView.items.length" class="detail-repair-list">
					<view v-for="(item, itemIndex) in detailView.items" :key="item.id" class="detail-repair-card">
						<view class="detail-repair-head">
							<text>报修产品 {{ itemIndex + 1 }}</text>
							<text>{{ item.name }}</text>
						</view>
						<view class="detail-field-grid">
							<view><text>产品分类</text><text>{{ item.category }}</text></view>
							<view><text>产品型号</text><text>{{ item.model }}</text></view>
							<view><text>产品序列号</text><text user-select>{{ item.sn }}</text></view>
							<view><text>购买日期</text><text>{{ item.buyDate }}</text></view>
						</view>
						<view class="detail-fault-block">
							<text>故障描述</text>
							<text user-select>{{ item.faultDesc }}</text>
						</view>
						<view v-if="item.vouchers.length || item.images.length || item.videos.length" class="detail-attachment-block">
							<text>凭证与附件</text>
							<view class="detail-attachment-grid">
								<view v-for="(attachment, index) in item.vouchers" :key="attachment.id" class="detail-attachment tap" @click="previewDetailImages(item.vouchers, index)">
									<image v-if="getDetailAttachmentUrl(attachment)" :src="getDetailAttachmentUrl(attachment)" mode="aspectFill"></image>
									<view v-else class="detail-attachment-placeholder">凭证</view>
									<text>购买凭证</text>
								</view>
								<view v-for="(attachment, index) in item.images" :key="attachment.id" class="detail-attachment tap" @click="previewDetailImages(item.images, index)">
									<image v-if="getDetailAttachmentUrl(attachment)" :src="getDetailAttachmentUrl(attachment)" mode="aspectFill"></image>
									<view v-else class="detail-attachment-placeholder">图片</view>
									<text>故障图片</text>
								</view>
								<view v-for="attachment in item.videos" :key="attachment.id" class="detail-attachment tap" @click="previewDetailVideo(attachment)">
									<view class="detail-video-placeholder">
										<image v-if="getDetailAttachmentCoverUrl(attachment)" :src="getDetailAttachmentCoverUrl(attachment)" mode="aspectFill"></image>
										<view class="detail-video-play"><text>▶</text></view>
									</view>
									<text>故障视频</text>
								</view>
							</view>
						</view>
					</view>
				</view>
				<view v-else class="empty-hint compact">设备信息待同步，请稍后刷新或联系客服。</view>
				<view class="detail-shipping-card">
					<view class="detail-shipping-group">
						<text>寄出信息</text>
						<view><text>寄件人</text><text>{{ detailView.shipOut.name }}</text></view>
						<view><text>联系电话</text><text user-select>{{ detailView.shipOut.phone }}</text></view>
						<view><text>寄出地址</text><text user-select>{{ detailView.shipOut.address }}</text></view>
						<view><text>物流公司</text><text>{{ detailView.shipOut.logisticsCompany }}</text></view>
						<view><text>寄出单号</text><text user-select>{{ detailView.shipOut.logisticsNo }}</text></view>
					</view>
					<view class="detail-shipping-group">
						<text>回寄信息</text>
						<view><text>收件单位</text><text>{{ detailView.shipBack.unit }}</text></view>
						<view><text>收货人</text><text>{{ detailView.shipBack.name }}</text></view>
						<view><text>手机号码</text><text user-select>{{ detailView.shipBack.phone }}</text></view>
						<view><text>回寄地址</text><text user-select>{{ detailView.shipBack.address }}</text></view>
						<view><text>回寄物流</text><text>{{ detailView.shipBack.logisticsCompany }}</text></view>
						<view><text>回寄单号</text><text user-select>{{ detailView.shipBack.logisticsNo }}</text></view>
					</view>
				</view>
				<view class="module-section-head single"><text>维修进度</text></view>
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
				<view class="detail-timeline-card">
					<view class="detail-timeline-heading"><text>处理记录</text><text>共 {{ detailView.timeline.length }} 条</text></view>
					<view v-if="detailView.timeline.length">
						<view v-for="(item, index) in detailView.timeline" :key="item.id" class="detail-timeline-row">
							<view class="detail-timeline-pin" :class="{ pending: item.pending }">
								<view></view>
								<view v-if="index < detailView.timeline.length - 1"></view>
							</view>
							<view class="detail-timeline-copy">
								<view><text>{{ item.title }}</text><text>{{ item.time }}</text></view>
								<text>{{ item.desc }}</text>
							</view>
						</view>
					</view>
					<view v-else class="empty-hint compact">暂无处理记录。</view>
				</view>
				<view class="module-section-head single"><text>维修报价</text></view>
				<view class="billing-card quote-sheet-card quote-payment-panel">
					<view class="billing-head">
						<view>
							<text>维修报价单</text>
							<text>{{ getBillingMeta(detailOrder).desc }}</text>
						</view>
						<text :class="['tag', 'tag-' + getBillingMeta(detailOrder).tone]">{{ getBillingMeta(detailOrder).label }}</text>
					</view>
					<view v-if="detailWarrantyHint.show" class="quote-status-note" :class="'quote-status-note-' + detailWarrantyHint.tone">
						<text>{{ detailWarrantyHint.text }}</text>
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
						<text>维修费用已由售后确认，合计 {{ getBillingAmountText(detailOrder) }}。如需费用明细可联系售后客服。</text>
					</view>
					<view v-else class="billing-empty">
						<text>工程师检测完成后，这里会显示维修项目、费用明细和下一步操作。</text>
					</view>
					<view class="quote-total-box">
						<view class="quote-total-main">
							<text>应付金额</text>
							<text>{{ getBillingAmountText(detailOrder) }}</text>
						</view>
						<text>{{ getPaymentMeta(detailOrder).desc }}</text>
					</view>
					<text v-if="detailPaymentDeadlineText" class="quote-payment-note">请在 {{ detailPaymentDeadlineText }} 前完成付款</text>
					<view v-if="detailOrder.paymentStatus === 'rejected'" class="payment-reject-notice">
						<text class="payment-reject-title">转账凭证被驳回</text>
						<text class="payment-reject-reason">{{ detailOrder.paymentRejectReason || '请核对付款信息后重新上传凭证。' }}</text>
					</view>
					<PaymentMethodSelector v-if="showPaymentMethodSelector(detailOrder)" v-model="selectedPaymentMethod" />
					<view v-if="showTransferPaymentPanel(detailOrder)" class="transfer-account-card">
						<text class="transfer-account-title">企业对公转账</text>
						<view class="transfer-account-row">
							<text class="transfer-account-label">收款单位</text>
							<text class="transfer-account-value">{{ contactInfo.bankCompanyName || contactInfo.companyName }}</text>
						</view>
						<view v-if="contactInfo.bankTaxNo" class="transfer-account-row">
							<text class="transfer-account-label">税号</text>
							<text class="transfer-account-value">{{ contactInfo.bankTaxNo }}</text>
						</view>
						<view v-if="contactInfo.bankAddressPhone" class="transfer-account-row">
							<text class="transfer-account-label">地址电话</text>
							<text class="transfer-account-value">{{ contactInfo.bankAddressPhone }}</text>
						</view>
						<view v-if="contactInfo.bankName" class="transfer-account-row">
							<text class="transfer-account-label">开户行</text>
							<text class="transfer-account-value">{{ contactInfo.bankName }}</text>
						</view>
						<view class="transfer-account-row">
							<text class="transfer-account-label">账号</text>
							<text v-if="contactInfo.bankAccount" class="transfer-account-value transfer-account-no">{{ contactInfo.bankAccount }}</text>
							<text v-else class="transfer-account-value transfer-account-muted">请联系客服获取对公账户</text>
							<text v-if="contactInfo.bankAccount" class="transfer-copy tap" @click="copyOne(contactInfo.bankAccount, 'bankAcct')">{{ copied === 'bankAcct' ? '已复制' : '复制' }}</text>
						</view>
						<view v-if="contactInfo.bankLineNo" class="transfer-account-row">
							<text class="transfer-account-label">行号</text>
							<text class="transfer-account-value transfer-account-no">{{ contactInfo.bankLineNo }}</text>
							<text class="transfer-copy tap" @click="copyOne(contactInfo.bankLineNo, 'bankLineNo')">{{ copied === 'bankLineNo' ? '已复制' : '复制' }}</text>
						</view>
						<view class="transfer-account-remark">
							<text class="transfer-remark-tip">⚠ 转账备注请填写工单号，方便财务核对到账</text>
							<view class="transfer-remark-row">
								<text class="transfer-remark-no">{{ detailOrder.id }}</text>
								<text class="transfer-copy tap" @click="copyOne(detailOrder.id, 'orderNoRemark')">{{ copied === 'orderNoRemark' ? '已复制' : '复制工单号' }}</text>
							</view>
						</view>
					</view>
					<view v-if="detailPaymentProofs.length" class="payment-proof-grid billing-proof-grid">
						<view v-for="(proof, index) in detailPaymentProofs" :key="proof.id || proof.url || index" class="payment-proof-thumb tap" @click="previewPaymentProof(index)">
							<image class="payment-proof-image" :src="getPaymentProofPreviewUrl(proof)" mode="aspectFill"></image>
							<text>{{ proof.time || '已上传' }}</text>
						</view>
					</view>
					<view class="quote-action-stack">
						<view v-if="showWechatPayAction(detailOrder)" class="primary-button tap detail-action-button" :class="{ disabled: getBillingAction(detailOrder).disabled }" @click="handleBillingAction(detailOrder)">
							{{ getBillingAction(detailOrder).text }}
						</view>
						<view v-else-if="showNonPaymentBillingAction(detailOrder)" class="primary-button tap detail-action-button" :class="{ disabled: getBillingAction(detailOrder).disabled }" @click="handleBillingAction(detailOrder)">
							{{ getBillingAction(detailOrder).text }}
						</view>
						<view v-if="showTransferProofAction(detailOrder)" class="primary-button tap detail-action-button transfer-proof-button" :class="{ disabled: getPaymentProofAction(detailOrder).disabled }" @click="handlePaymentProofAction(detailOrder)">
							{{ getPaymentProofAction(detailOrder).text }}
						</view>
						<text v-else-if="getPaymentProofAction(detailOrder).hint" class="quote-secondary-hint">{{ getPaymentProofAction(detailOrder).hint }}</text>
						<button v-if="detailQuoteVisible && detailOrder.paymentStatus !== 'paid'" class="quote-contact-action tap" open-type="contact">
							<text>有疑问？联系客服</text>
						</button>
						<view v-if="canRejectQuote(detailOrder)" class="quote-reject-action tap" @click="rejectRepairQuoteAction(detailOrder)">
							<text>拒绝维修</text>
						</view>
					</view>
				</view>

				<!-- 物流信息：客户寄出 + 厂家寄回，统一挂在工单下 -->
				<view v-if="detailOrder.trackingNo || detailOrder.returnLogisticsNo || canConfirmReceipt(detailOrder) || canFillOutboundTracking(detailOrder)" class="module-section-head single"><text>物流信息</text></view>
				<!-- 稍后补单号：pending 且未填寄出单号时，提供补填入口 -->
				<view v-if="canFillOutboundTracking(detailOrder)" class="repair-form-card outbound-fill-card">
					<view class="blue-tip">快递员已取件？补填运单号后即可追踪包裹，工厂签收更快。</view>
					<view class="repair-field select-row tap" @click="showOutboundSheet = true">
						<text><text class="required-star">*</text>物流公司</text>
						<text class="select-value">{{ outboundForm.company || '请选择物流公司' }}</text>
						<view class="field-arrow"></view>
					</view>
					<view class="repair-field last">
						<text><text class="required-star">*</text>运单号</text>
						<input v-model="outboundForm.trackingNo" placeholder="请输入快递运单号" placeholder-class="input-placeholder" />
					</view>
					<view class="primary-button tap detail-action-button" :class="{ disabled: outboundSubmitting }" @click="submitOutboundTracking(detailOrder)">
						{{ outboundSubmitting ? '提交中...' : '提交运单号' }}
					</view>
				</view>
				<view v-if="detailOrder.trackingNo" class="return-logistics-card">
					<view class="return-logistics-info">
						<view><text>客户寄出</text><text>{{ detailOrder.logisticsCompany || '待录入' }}</text></view>
						<view><text>寄出单号</text><text class="return-logistics-no">{{ detailOrder.trackingNo }}</text></view>
					</view>
					<view class="return-logistics-actions">
						<view class="return-logistics-btn tap" @click="copyOne(detailOrder.trackingNo, 'sendNo')">{{ copied === 'sendNo' ? '已复制' : '复制单号' }}</view>
						<view class="return-logistics-btn primary tap" @click="trackSendLogistics(detailOrder)">查物流</view>
					</view>
				</view>
				<view v-if="detailOrder.returnLogisticsNo" class="return-logistics-card">
					<view class="return-logistics-info">
						<view><text>厂家寄回</text><text>{{ detailOrder.returnLogisticsCompany || '待录入' }}</text></view>
						<view><text>回寄单号</text><text class="return-logistics-no">{{ detailOrder.returnLogisticsNo }}</text></view>
					</view>
					<view class="return-logistics-actions">
						<view class="return-logistics-btn tap" @click="copyOne(detailOrder.returnLogisticsNo, 'returnNo')">{{ copied === 'returnNo' ? '已复制' : '复制单号' }}</view>
						<view class="return-logistics-btn primary tap" @click="trackReturnLogistics(detailOrder)">查物流</view>
					</view>
				</view>
				<view v-if="canConfirmReceipt(detailOrder)" class="primary-button tap detail-action-button receipt-confirm-button" @click="confirmRepairReceiptAction(detailOrder)">
					确认收货
				</view>

				<!-- 投诉与反馈：挂在本工单下 -->
				<view class="module-section-head single"><text>投诉与反馈</text></view>
				<view class="order-complaint-card">
					<view v-if="detailOrderComplaints.length" class="order-complaint-list">
						<view v-for="record in detailOrderComplaints" :key="record.ticketNo" class="order-complaint-item">
							<view class="order-complaint-top">
								<text class="order-complaint-type">{{ record.type || '反馈' }}</text>
								<text :class="['tag', 'tag-' + getFeedbackMeta(record).tone]">{{ record.statusLabel || getFeedbackMeta(record).label }}</text>
							</view>
							<text v-if="record.content" class="order-complaint-content">{{ record.content }}</text>
							<view v-if="record.reply" class="order-complaint-reply">
								<text class="order-complaint-reply-label">客服回复</text>
								<text>{{ record.reply }}</text>
							</view>
						</view>
					</view>
					<text v-else class="order-complaint-empty">本工单暂无投诉/反馈记录。遇到问题可直接发起投诉，我们会在工单内跟进处理与回复。</text>
					<view class="order-complaint-action tap" @click="complainAboutOrder(detailOrder)">
						<text>我要投诉</text>
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
						<view class="complete-guide-btn tap" @click="reviewOrder(detailOrder)">
							<text class="complete-guide-ico">★</text>
							<text>{{ detailOrder.review ? '已评价' : '去评价' }}</text>
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

				<view v-if="showOutboundSheet" class="sheet-mask" @click="showOutboundSheet = false" @touchmove.stop></view>
				<view v-if="showOutboundSheet" class="choice-sheet" @touchmove.stop>
					<view class="choice-head">
						<text class="tap" @click="showOutboundSheet = false">取消</text>
						<text>选择物流公司</text>
						<text></text>
					</view>
					<scroll-view class="choice-scroll" scroll-y enhanced :show-scrollbar="false" :bounces="true">
						<view v-for="item in logisticsList" :key="item.value" class="choice-row tap" @click="selectOutboundLogistics(item)">
							<text>{{ item.label }}</text>
							<view v-if="outboundForm.company === item.value" class="mini-icon mini-check"></view>
						</view>
					</scroll-view>
				</view>
			</view>

			<view v-else-if="activeModule === 'survey'" class="module-content survey-module">
				<view class="survey-hero-card">
					<view class="survey-hero-icon"><view class="glyph glyph-gift"><view class="glyph-extra"></view></view></view>
					<view>
						<text>{{ surveyConfig.title }}</text>
						<text>{{ surveyConfig.subtitle }}</text>
					</view>
				</view>
				<view class="survey-benefits">
					<view class="survey-benefit"><text>1</text><text>填写售后体验</text></view>
					<view class="survey-benefit"><text>2</text><text>留下联系方式</text></view>
					<view class="survey-benefit"><text>3</text><text>领取专属福利</text></view>
				</view>

				<view class="module-section-head single"><text>请填写</text></view>
				<view class="survey-form-card">
					<view class="survey-field">
						<text class="survey-field-label">工单号 / 设备 SN</text>
						<input v-model="surveyForm.orderNo" placeholder="选填，便于客服核对服务记录" placeholder-class="input-placeholder" />
					</view>

					<view class="survey-field">
						<text class="survey-field-label"><text class="required-star">*</text>整体满意度</text>
						<view class="survey-chip-row">
							<view
								v-for="option in surveySatisfactionOptions"
								:key="option.value"
								class="survey-chip tap"
								:class="{ on: surveyForm.satisfaction === option.value }"
								@click="surveyForm.satisfaction = option.value"
							>{{ option.label }}</view>
						</view>
					</view>

					<view class="survey-field">
						<text class="survey-field-label"><text class="required-star">*</text>服务评分</text>
						<view class="survey-score-row">
							<view
								v-for="score in surveyRatingOptions"
								:key="score"
								class="survey-score tap"
								:class="{ on: surveyForm.rating >= score }"
								@click="surveyForm.rating = score"
							>{{ score }}</view>
						</view>
						<text class="survey-score-tip">{{ surveyForm.rating ? surveyForm.rating + ' 分 / ' + surveyConfig.ratingMax + ' 分' : '未评分' }}</text>
					</view>

					<view class="survey-field">
						<text class="survey-field-label"><text class="required-star">*</text>问题是否解决</text>
						<view class="survey-chip-row">
							<view
								v-for="option in surveyResolveOptions"
								:key="option.value"
								class="survey-chip tap"
								:class="{ on: surveyForm.resolved === option.value }"
								@click="surveyForm.resolved = option.value"
							>{{ option.label }}</view>
						</view>
					</view>

					<view class="survey-field">
						<text class="survey-field-label"><text class="required-star">*</text>您最想反馈什么</text>
						<textarea v-model="surveyForm.comment" maxlength="500" placeholder="例如：响应速度、报价说明、维修质量、物流体验、客服沟通等" placeholder-class="input-placeholder"></textarea>
					</view>

					<view class="survey-field">
						<text class="survey-field-label"><text class="required-star">*</text>联系方式</text>
						<input v-model="surveyForm.contact" placeholder="手机号 / 微信号，便于发放福利" placeholder-class="input-placeholder" />
					</view>
				</view>

				<view class="survey-actions">
					<view class="survey-secondary tap" @click="resetSurveyForm()">重填</view>
					<view class="survey-primary tap" :class="{ disabled: surveySubmitting }" @click="submitSurveyForm">{{ surveySubmitting ? '提交中' : '提交调研' }}</view>
				</view>
				<text class="survey-poster-tip tap" @click="previewSurveyPoster">{{ surveyConfig.giftText }}</text>
			</view>

			<view v-else-if="activeModule === 'diag'" class="module-content diag-module">
				<view class="diag-hero-card">
					<view class="diag-icon"><view class="glyph glyph-diag"><view class="glyph-extra"></view></view></view>
					<view>
						<text>2 步快速定位故障</text>
						<text>选择产品类型与故障现象，即查看排查方法和处理建议</text>
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
						<text><text class="required-star">*</text>故障现象</text>
						<text :class="{ placeholder: !diagFault }">{{ diagFault || diagFaultPlaceholder }}</text>
						<view class="field-arrow"></view>
					</view>
				</view>
				<view v-if="diagConfirmVisible" class="diag-result">
					<view class="module-section-head single"><text>自查结果</text></view>
					<view v-if="diagLoading" class="diag-sync-tip">正在同步后台最新故障知识库...</view>
					<view v-if="diagErrorText" class="diag-sync-tip warning">{{ diagErrorText }}</view>
					<view v-if="diagResult" class="diag-advice-card" :class="{ recommend: diagRecommendRepair }">
						<text>{{ diagRecommendRepair ? '建议报修' : '可先自查' }}</text>
						<text>{{ diagRecommendRepair ? '后台知识库建议提交报修，由工程师进一步确认。' : '可先按排查步骤处理，未恢复时再提交报修。' }}</text>
					</view>
					<view v-for="section in diagConfirmSections" :key="section.title" class="diag-check-card">
						<view class="diag-check-head"><view :style="{ backgroundColor: section.color }"></view><text>{{ section.title }}</text></view>
						<view v-for="(item, index) in section.items" :key="section.title + index" class="diag-check-row">
							<text>{{ section.numbered ? index + 1 : '·' }}</text>
							<text>{{ item }}</text>
						</view>
					</view>
					<view class="dual-actions">
						<view class="ghost-button tap" @click="resetDiag">重新选择</view>
						<view class="primary-button tap" @click="startRepairFromDiag">{{ diagRepairActionText }}</view>
					</view>
				</view>
				<view v-else class="empty-hint">{{ diagEmptyText }}</view>
				<view v-if="diagOpen" class="sheet-mask" @click="diagOpen = ''" @touchmove.stop></view>
				<view v-if="diagOpen" class="choice-sheet" @touchmove.stop>
					<view class="choice-head">
						<text class="tap" @click="diagOpen = ''">取消</text>
						<text>{{ diagOpen === 'product' ? '选择产品类型' : '选择故障现象' }}</text>
						<text></text>
					</view>
					<scroll-view class="choice-scroll" scroll-y enhanced :show-scrollbar="false" :bounces="true">
						<view v-for="item in diagSheetOptions" :key="item.id" class="choice-row tap" @click="selectDiagOption(item)">
							<text>{{ item.title }}</text>
							<view v-if="item.active" class="mini-icon mini-check"></view>
						</view>
					</scroll-view>
				</view>
			</view>

			<view v-else-if="activeModule === 'warranty'" class="module-content warranty-module">
				<PolicyDocumentViewer
					v-if="warrantyHasPolicyDocument"
					:policy-document="warrantyDoc.policyDocument"
				/>
				<view v-else-if="warrantyDoc.content" class="doc-paper">
					<rich-text :nodes="warrantyDoc.content"></rich-text>
				</view>
				<view v-if="!warrantyHasPolicyDocument && !warrantyDoc.content" class="doc-paper warranty-paper">
					<text class="paper-title">保修政策</text>
					<view v-for="section in warrantyTerms" :key="section.title" class="paper-section">
						<text class="paper-section-title">{{ section.title }}</text>
						<view v-for="(line, index) in section.lines" :key="line" class="paper-line">
							<text>{{ index + 1 }})</text>
							<text>{{ line }}</text>
						</view>
					</view>
				</view>
				<view class="dual-actions">
					<view class="primary-button tap" @click="go('repair')">立即报修</view>
				</view>
			</view>

			<view v-else-if="isDocModule" class="module-content">
				<view v-if="activeModule !== 'fees'" class="doc-hero">
					<view :class="['glyph', 'glyph-' + activeDoc.icon]"><view class="glyph-extra"></view></view>
					<view><text>{{ activeDoc.title }}</text><text>{{ activeDoc.lead }}</text></view>
				</view>
				<PolicyDocumentViewer
					v-if="activeModule === 'fees' && activeDocHasPolicyDocument"
					:policy-document="activeDoc.policyDocument"
				/>
				<view v-else-if="activeDoc.content" class="doc-paper">
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
						<text>服务文档</text>
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
						<view class="order-card-head">
							<text class="order-card-no">工单 {{ order.id }}</text>
							<text :class="['tag', 'tag-' + getOrderStatusTone(order)]">{{ order.status }}</text>
						</view>
						<text class="order-card-title">{{ order.cardTitle }}</text>
						<text v-if="order.faultDesc" class="order-card-fault">{{ order.faultDesc }}</text>
						<view v-if="order.cardMeta && order.cardMeta.length" class="order-card-meta">
							<text v-for="meta in order.cardMeta" :key="meta">{{ meta }}</text>
						</view>
						<view class="order-card-footer">
							<text class="order-card-date">报修日期 · {{ order.date }}</text>
							<view class="order-card-action">
								<text v-if="formatOrderListPrice(order, '')" class="order-card-price">{{ formatOrderListPrice(order, '') }}</text>
								<text>查看详情</text>
								<view class="order-card-chevron"></view>
							</view>
						</view>
					</view>
					<view v-if="!filteredOrderList.length" class="empty-hint compact">当前筛选条件下没有订单。</view>
				</view>
			</view>

			<view v-else-if="activeModule === 'products'" class="module-content products-module">
				<view v-for="item in productList" :key="item.sn || item.title" class="product-card">
					<view class="product-icon"><view class="glyph glyph-tooth"><view class="glyph-extra"></view></view></view>
					<view class="product-copy">
						<text class="product-title">{{ item.title }}</text>
						<text class="product-meta">SN · {{ item.sn || '未登记' }}</text>
						<text v-if="item.model" class="product-meta">型号 · {{ item.model }}</text>
						<text v-if="item.lastOrderText" class="product-order">{{ item.lastOrderText }}</text>
						<text v-else-if="item.date" class="product-meta">购买日期 · {{ item.date }}</text>
						<text :class="['tag', item.expired ? 'tag-muted' : 'tag-ok']">{{ item.warranty }}</text>
					</view>
					<view class="ghost-mini tap" @click="go('repair')">报修</view>
				</view>
				<view v-if="!productList.length" class="empty-hint compact">暂无已登记设备。报修提交或维修完成后，会在这里沉淀设备档案与保修状态。</view>
				<view class="dash-add tap" @click="go('repair')"><text>+</text><text>添加我的产品</text></view>
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

					<picker mode="region" :value="regionPickerValue" @change="onRegionChange">
						<view class="address-field tap">
							<text class="field-label"><text class="required-star">*</text>所在地区</text>
							<input v-model="addressForm.region" class="field-input" placeholder="请选择省 / 市 / 区" placeholder-class="input-placeholder" disabled />
							<view class="field-arrow"></view>
						</view>
					</picker>

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
					<switch :checked="addressForm.def" color="#1E6FE0" @change="addressForm.def = $event.detail.value" />
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
								<image v-for="(image, index) in record.images" :key="image.id || image.url || image || index" :src="getFeedbackRecordImageUrl(image)" mode="aspectFill" class="feedback-ticket-image tap" @click="previewFeedbackRecordImage(record, index)"></image>
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
				<WechatLoginPanel
					:loading="loginSubmitting"
					:retrying="loginRetrying"
					:agreed="loginAgreementChecked"
					:locked="loginClickLocked"
					:cooldown-seconds="loginCooldownSeconds"
					@back="returnFromModule"
					@login="onLoginButtonTap"
					@toggle-agreement="toggleLoginAgreement"
					@open-policy="openLoginPolicy"
				/>
			</view>
		</view>

		<view v-else-if="pageBootReady" class="page-scroll">
			<view v-if="activeTab === 'home'" class="home-body">
				<view class="brand-bar">
					<view class="brand-left">
						<text class="home-brand-subtitle">服务中心</text>
					</view>
				</view>

				<view class="new-brand-banner" style="margin: 12px; overflow: hidden; border-radius: 8px; position: relative; z-index: 10;">
					<image :src="homeTopBackground" mode="widthFix" style="width: 100%; display: block;"></image>
				</view>

				<view class="section section-basic">
					<view class="home-section-heading">
						<view class="home-section-marker"></view>
						<text class="section-title">基础服务</text>
					</view>
					<view class="three-grid">
						<view
							v-for="item in basics"
							:key="item.id"
							class="service-card basic-service-card tap"
							@click="go(item.id)"
						>
							<view class="service-icon-halo basic-icon-halo" :style="{ backgroundColor: item.bg }">
								<view class="service-icon" :style="{ backgroundColor: item.color, color: '#FFFFFF' }">
									<view :class="['glyph', 'glyph-' + item.icon]">
										<view class="glyph-extra"></view>
									</view>
								</view>
							</view>
							<text class="service-title">{{ item.title }}</text>
							<text class="service-desc">{{ item.desc }}</text>
							<view class="service-accent" :style="{ backgroundColor: item.color }"></view>
						</view>
					</view>
				</view>

				<view class="section section-query">
					<view class="home-section-heading">
						<view class="home-section-marker"></view>
						<text class="section-title">自助查询</text>
					</view>
					<view class="query-grid">
						<view
							v-for="item in queries"
							:key="item.id"
							class="query-service-card tap"
							@click="go(item.id)"
						>
							<view class="service-icon-halo query-icon-halo" :style="{ backgroundColor: item.bg }">
								<view class="service-icon query-service-icon" :style="{ backgroundColor: item.color, color: '#FFFFFF' }">
									<view :class="['glyph', 'glyph-' + item.icon]">
										<view class="glyph-extra"></view>
									</view>
								</view>
							</view>
							<view class="query-service-copy">
								<text class="service-title">{{ item.title }}</text>
								<text class="service-desc">{{ item.desc }}</text>
							</view>
							<view class="query-chevron" :style="{ borderColor: item.color }"></view>
						</view>
					</view>
				</view>

				<view class="section section-guide">
					<view class="home-section-heading tutorial-section-line">
						<view class="home-section-marker"></view>
						<text class="section-title">操作教程</text>
					</view>
					<view class="tutorial-guide-grid">
						<view
							v-for="item in guides"
							:key="item.id"
							class="guide-card tap"
							@click="openGuideFromHome(item.id)"
						>
							<view class="guide-icon">
								<view :class="['glyph', 'glyph-' + item.icon, 'glyph-guide']">
									<view class="glyph-extra"></view>
								</view>
							</view>
							<view class="guide-copy">
								<text class="guide-title">{{ item.title }}</text>
								<text class="guide-desc">{{ item.desc }}</text>
							</view>
							<view class="chevron"></view>
						</view>
					</view>
					<view class="product-video-entry tap" @click="openProductVideoLink">
						<view class="product-video-icon">
							<view class="product-video-play"></view>
						</view>
						<view class="product-video-copy">
							<view class="product-video-title-row">
								<text class="product-video-title">产品视频</text>
								<text class="product-video-new">NEW</text>
							</view>
							<text class="product-video-desc">观看产品使用视频</text>
						</view>
						<view class="product-video-chevron"></view>
					</view>
				</view>

				<view v-if="homeIntroVideo" class="section maintenance-video-wrap">
					<view class="maintenance-video-list">
						<view class="maintenance-video-card tap" @click="openMaintenanceVideo(homeIntroVideo)">
							<text class="maintenance-video-title">{{ homeIntroVideo.title || '产品安装及维护保养视频' }}</text>
							<view class="maintenance-video-cover">
								<image v-if="homeIntroVideo.coverUrl" class="maintenance-video-image" :src="homeIntroVideo.coverUrl" mode="aspectFill"></image>
								<view v-else class="maintenance-video-placeholder">
									<text class="maintenance-video-brand">CICADA Dental</text>
									<text class="maintenance-video-placeholder-title">{{ homeIntroVideo.title || '产品安装及维护保养视频' }}</text>
								</view>
								<view class="maintenance-video-shade"></view>
								<view class="maintenance-play-badge"><text>▶</text></view>
							</view>
						</view>
					</view>
				</view>

				<view class="section section-contact">
					<view class="home-section-heading">
						<view class="home-section-marker"></view>
						<text class="section-title">联系我们</text>
					</view>
					<view class="contact-grid">
						<button class="contact-card tap" open-type="contact">
							<view class="contact-icon">
								<view class="glyph glyph-chat">
									<view class="glyph-extra"></view>
								</view>
							</view>
							<view class="contact-copy">
								<text class="contact-title">在线客服</text>
								<text class="contact-desc">8:00-17:30</text>
							</view>
							<text class="contact-action">咨询</text>
						</button>
						<view class="contact-card tap" @click="makePhoneCall">
							<view class="contact-icon">
								<view class="glyph glyph-phone">
									<view class="glyph-extra"></view>
								</view>
							</view>
							<view class="contact-copy">
								<text class="contact-title">服务热线</text>
								<text class="contact-desc">{{ contactInfo.phone }}</text>
							</view>
							<text class="contact-action">拨打</text>
						</view>
					</view>
					<view class="home-receiver-detail">
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
										<text class="receiver-value" user-select>{{ item.value }}</text>
									</view>
									<view class="copy-button tap" @click="copyOne(item.value, item.label)">
										<view v-if="copied === item.label" class="mini-icon mini-check"></view>
										<view v-else class="mini-icon mini-copy"></view>
									</view>
								</view>
							</view>
						</view>
						<view class="copy-row">
							<view class="copy-all tap" @click="copyAll">
								<view class="mini-icon mini-check mini-check-white"></view>
								<text>{{ copied === 'all' ? '已复制' : '一键复制以上收件信息' }}</text>
							</view>
						</view>
					</view>
				</view>

			</view>

			<view v-else-if="activeTab === 'company'" class="company-body">
				<view class="company-brand">
					<view class="brand-left">
						<image class="brand-logo" :src="cicadaAssets.logoCompact" mode="aspectFit"></image>
					</view>
				</view>

				<view class="company-hero">
					<image class="company-hero-image" src="/static/company-intro-header-v2.jpg" mode="aspectFill"></image>
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
					<text
						v-for="(item, index) in companyIntro"
						:key="item"
						:class="['company-intro-text', { 'company-intro-text-title': index === 0 }]"
					>{{ item }}</text>
				</view>

				<view class="company-section">
					<view class="rule-title">
						<view></view>
						<text>产品矩阵</text>
					</view>
					<view class="business-list">
						<view v-for="(item, index) in companyProductLines" :key="item.title" class="business-card">
							<view class="business-visual" :style="{ background: item.image ? '#FFFFFF' : item.gradient }">
								<image
									v-if="item.image"
									class="business-image tap"
									:src="item.image"
									mode="aspectFill"
									show-menu-by-longpress
									@click.stop="previewCompanyProductImage(item)"
								></image>
								<view v-else :class="['device-shape', 'device-' + (index % 3)]"></view>
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
							<text>医疗器械质量体系保障</text>
						</view>
						<text class="auth-desc">CICADA 产品拥有 ISO13485、CE、FDA 及国内医疗器械注册资质，覆盖口腔设备研发、生产、合规交付全流程。</text>
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
						<text class="company-service-title">追求极致稳定性</text>
						<text class="company-service-slogan">Make it Worth it</text>
						<text class="company-service-desc">立足极致可靠的产品，面向全球牙科医师与合作伙伴。</text>
						<text class="company-service-desc">CICADA 思科达不止提供稳定优质的口腔设备，依托快速售后响应、临床技术支持与全球服务布局，持续为客户创造长期价值，让每一份选择皆有所值。</text>
						<view class="company-service-tags">
							<text v-for="item in companyServiceTags" :key="item">{{ item }}</text>
						</view>
					</view>
				</view>

				<view class="follow-card tap" @click="openOfficialAccountProfile">
					<view class="qr-image-wrap company-qr">
						<image
							class="qr-image"
							:src="wechatInfo.qrcodeUrl || cicadaAssets.qrWechat"
							mode="aspectFill"
							show-menu-by-longpress
						></image>
					</view>
					<text class="follow-title">了解产品与售后支持</text>
					<text class="follow-desc">点击打开官方公众号，获取产品资料、维修保养与售后服务支持。</text>
					<official-account class="official-account-btn"></official-account>
				</view>
			</view>

			<view v-else class="mine-body">
				<view class="mine-hero">
					<view class="profile-row">
						<view class="avatar" :class="{ 'avatar-logged': logged }" @click="logged && openEditProfile()">
							<image v-if="logged && avatarDisplayUrl" class="avatar-image" :src="avatarDisplayUrl" mode="aspectFill"></image>
							<text v-else-if="logged">{{ userAvatarText }}</text>
							<image v-else class="avatar-image" src="/static/default-user-avatar.png" mode="aspectFit"></image>
						</view>
						<view class="profile-copy" @click="logged && openEditProfile()">
							<view class="profile-name-row">
								<text class="profile-name">{{ logged ? userDisplayName : '未登录' }}</text>
								<text v-if="logged" class="profile-edit-tag">编辑</text>
							</view>
							<view v-if="logged" class="profile-meta">
								<text>{{ userDisplayUnit }}</text>
								<text class="member-tag">已登录</text>
								<text class="logout-btn tap" @click.stop="logoutLocal">退出</text>
							</view>
							<view v-else class="profile-meta">
								<text>登录后查看您的维修订单</text>
								<text class="logout-btn tap" @click.stop="go('login')">注册/登录</text>
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

				<view v-if="logged" class="account-cancel-row">
					<text class="account-cancel-link tap" @click="onCancelAccount">注销账号</text>
				</view>

				<view class="mine-footer">
					<image :src="cicadaAssets.logoCompact" mode="aspectFit"></image>
					<text>佛山思科达 · 牙医仪器检修 v1.2.0</text>
				</view>
			</view>
		</view>

		<view v-else class="boot-screen">
			<view class="boot-content">
				<image class="boot-logo" :src="cicadaAssets.bootLogo" mode="aspectFit"></image>
				<text class="boot-title">思科达售后服务中心</text>
				<view class="boot-dots">
					<view class="boot-dot"></view>
					<view class="boot-dot"></view>
					<view class="boot-dot"></view>
				</view>
			</view>
		</view>

		<view v-if="pageBootReady && !activeModule && activeTab === 'home'" class="side-tab tap vi-side-tab" @click="openCicadaServiceAccountProfile">
			<view class="vi-side-wordmark">
				<image class="vi-side-logo-img" :src="cicadaAssets.wordmarkRegisteredWhite" mode="aspectFit"></image>
			</view>
			<text class="side-text">公众号</text>
		</view>

		<BottomTabbar v-if="showBottomTabbar" :tabs="tabs" :active-id="activeTab" @select="go" />

		<!-- 编辑资料弹层：微信已禁止自动获取昵称头像，须用户主动选择/填写 -->
		<view v-if="editProfileVisible" class="edit-mask" @click="closeEditProfile">
			<view class="edit-sheet" @click.stop>
				<view class="edit-title">编辑资料</view>
				<view class="edit-avatar-row">
					<button class="edit-avatar-btn" open-type="chooseAvatar" @chooseavatar="onChooseAvatar">
						<image v-if="editAvatarUrl" class="edit-avatar-img" :src="editAvatarUrl" mode="aspectFill"></image>
						<view v-else class="edit-avatar-ph">选择头像</view>
					</button>
					<text class="edit-avatar-hint">点击选择微信头像</text>
				</view>
				<view class="edit-field">
					<text class="edit-label">昵称</text>
					<input
						class="edit-input"
						type="nickname"
						:value="editNickname"
						placeholder="点击输入，可使用微信昵称"
						placeholder-class="edit-input-ph"
						maxlength="30"
						@input="onNicknameInput"
						@blur="onNicknameInput"
					/>
				</view>
				<view class="edit-actions">
					<view class="edit-btn cancel tap" @click="closeEditProfile">取消</view>
					<view class="edit-btn save tap" :class="{ disabled: profileSaving }" @click="saveProfile">{{ profileSaving ? '保存中…' : '保存' }}</view>
				</view>
			</view>
		</view>

		<view v-if="showQr" class="modal-mask" @click="showQr = false">
			<view class="qr-modal" @click.stop>
				<text class="modal-close tap" @click="showQr = false">×</text>
				<image class="qr-logo" :src="cicadaAssets.logoNew" mode="aspectFit"></image>
				<text class="qr-title">CICADA 服务号</text>
				<text class="qr-subtitle">微信扫码关注，获取维修指南与售后支持</text>
				<view class="qr-image-wrap">
					<image
						class="qr-image"
						:src="cicadaAssets.qrWechat"
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
				<text>保存进度、复制寄修纸条或重新填写</text>
			</view>
			<view class="repair-tool-list">
				<view class="repair-tool-row tap" @click="saveRepairDraft">
					<view class="repair-tool-icon tool-save"><view class="mini-icon mini-check"></view></view>
					<view>
						<text>保存草稿</text>
						<text>把当前填写内容保存在本机，下次继续填写</text>
					</view>
				</view>
				<view class="repair-tool-row tap" @click="copyRepairNoteTemplate">
					<view class="repair-tool-icon tool-note"><view><view></view><view></view><view></view></view></view>
					<view>
						<text>复制寄修纸条模板</text>
						<text>自动整理故障、联系方式和回寄地址</text>
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
		<view v-if="uploadPrivacyVisible" class="upload-privacy-mask">
			<view class="upload-privacy-card">
				<view class="upload-privacy-close tap" @click="rejectUploadPrivacy">×</view>
				<text class="upload-privacy-title">隐私政策与信息授权</text>
				<scroll-view scroll-y class="upload-privacy-body">
					<rich-text v-if="uploadPrivacyHtml" :nodes="uploadPrivacyHtml"></rich-text>
					<view v-else class="upload-privacy-text">使用图片、视频、微信地址或扫码功能前，需要您同意隐私授权。相关信息仅用于售后报修、维修沟通和服务记录。</view>
				</scroll-view>
				<view class="upload-privacy-actions">
					<view class="upload-privacy-btn ghost tap" @click="rejectUploadPrivacy">不同意</view>
					<!-- #ifdef MP-WEIXIN -->
					<button class="upload-privacy-btn primary tap" open-type="agreePrivacyAuthorization" @agreeprivacyauthorization="confirmUploadPrivacy">同意并继续</button>
					<!-- #endif -->
					<!-- #ifndef MP-WEIXIN -->
					<view class="upload-privacy-btn primary tap" @click="confirmUploadPrivacy">同意并继续</view>
					<!-- #endif -->
				</view>
			</view>
		</view>
		<PrivacyConsent :disabled="activeModule === 'repair'" />
		<PolicyDialog v-model:visible="homeGuideVisible" title="操作指引" :content="homeGuideContent" />
	</view>
</template>

<script setup>
import { computed, onMounted, onUnmounted, ref, watch } from 'vue'
import { onLoad, onShow, onPullDownRefresh, onBackPress } from '@dcloudio/uni-app'
import BottomTabbar from '@/components/BottomTabbar.vue'
import PaymentMethodSelector from '@/components/PaymentMethodSelector.vue'
import PrivacyConsent from '@/components/PrivacyConsent.vue'
import WechatLoginPanel from '@/components/WechatLoginPanel.vue'
import PolicyDialog from '@/components/PolicyDialog.vue'
import PolicyDocumentViewer from '@/components/PolicyDocumentViewer.vue'
import { cicadaAssets } from '@/config/cicada-assets'
import homeTopBackground from '@/static/home-top-background.jpg'
import maintenanceW201lCover from '@/static/maintenance-w201l-cover.jpg'
import { getLoginErrorMessage, isLoginCancelledError, loginWithWechatOpenid } from '@/utils/wechat-phone-login.js'
import { getWechatPrivacyReady, markWechatPrivacyReady, requestWechatPrivacyAuthorization, resetWechatPrivacyReady } from '@/utils/wechat-privacy.js'
import { createPcLoginGuard } from '@/utils/pc-login-guard.js'
import { isPcWebViewEnvironment } from '@/utils/runtime-environment.js'
import {
	getContact,
	getCustomerService,
	getFaultTypes,
	getFeePolicy,
	getGuide,
	getGuides,
	getSurveyConfig,
	getSubscriptionConfig,
	applyInvoice,
	getWechat,
	getWarrantyPolicy,
	getHomeGuidePopup,
	getCompliance,
	queryPackageStatus,
	searchFault,
	getAddressList,
	addAddress,
	updateAddress,
	deleteAddress,
	addComplaint,
	getComplaintList,
	wechatLogin,
	cancelAccount,
	uploadFeedbackImage,
	uploadImage,
	uploadVideo,
	submitAfterSalesSurvey
} from '@/api/content'
import {
	createRepairWechatPay,
	getRepairDetail,
	getRepairList,
	syncRepairWechatPay,
	uploadRepairPaymentProof,
	submitRepair as submitRepairOrder,
	lookupDeviceBySn,
	logSnAction,
	rejectRepairQuote,
	confirmRepairQuote,
	confirmRepairReceipt,
	submitRepairReview,
	getMyDevices,
	updateRepairOutboundLogistics
} from '@/api/repair'
import { getInvoiceMeta, getInvoiceStatusKey, invoiceFlow } from './composables/invoiceFlow'
import { downloadCloudFile, getCloudTempFileURL } from '@/utils/cloud.js'
import { updateProfile, logout as logoutRemote } from '@/api/auth'
import { normalizePolicyHtml } from '@/utils/policyHtml.js'
import { createPolicyDocumentRefresher } from '@/utils/policyRefresh.js'
import {
	basics,
	companyAdvantages,
	companyIntro,
	companyProductLines,
	companyServiceTags,
	companyStats,
	customerTypeOptions,
	defaultReceiver,
	defaultStatusItems,
	guides,
	invoiceTitleTypes,
	logisticsList,
	menus,
	moduleMap,
	packageFlow,
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
import { createOrderDetailView } from './composables/orderDetail'
import { createRepairProduct as defaultRepairProduct, defaultRepairForm, getRepairProductModelValue } from './composables/repairForm'
import { toCustomerErrorMessage } from '@/utils/customer-error.js'
import {
	createRepairStatusMeta,
	deriveDisplayStatus,
	getOrderStatusTone,
	getRepairProgressNodes,
	invoiceTodoStatusKeys,
	normalizeRepairStatus,
	normalizeStatusTab,
	packageStatusMeta,
	resolveStatusKey
} from './composables/statusMeta'
import {
	canUploadPaymentProofForOrder,
	compressForUpload,
	getCloudFileId,
	getPreviewUrl,
	getUploadedUrl,
	hasLoginToken,
	isAuthError,
	isCloudFileId,
	isPickerCancel,
	normalizeUploadFileId,
	normalizeUploadUrl
} from './composables/uploadUtils'
import { getRepairProductOptions } from '@/api/product'
import {
	createRepairProductModelOptions,
	REPAIR_PRODUCT_MODEL_OTHER_LABEL,
	REPAIR_PRODUCT_OTHER_VALUE,
	repairProductOptions as defaultRepairProductOptions,
	repairProductOtherOption,
	splitRepairProductModels
} from '@/config/repair-products.js'
import { defaultFaultTypes } from '@/config/fault-diagnostics.js'

const bootStart = Date.now()
const logBoot = (stage) => console.log('[index-boot]', stage, Date.now() - bootStart)

const copied = ref('')
const showQr = ref(false)
const showRepairTools = ref(false)
const uploadPrivacyVisible = ref(false)
const uploadPrivacyHtml = ref('')
const surveyPosterUrl = cicadaAssets.surveyPoster
const maintenanceVideoFallback = Object.freeze({
	id: 'w201l-maintenance-fallback',
	title: '牙科种植手机W201L保养维护',
	desc: '牙科种植手机W201L保养维护',
	videoUrl: 'https://cicada-video-prod.oss-cn-beijing.aliyuncs.com/home-intro-video/1783392116334_a6e54770be052_0.mp4',
	videoName: '0.mp4',
	coverUrl: maintenanceW201lCover
})
const maintenanceVideos = ref([{ ...maintenanceVideoFallback }])
const homeIntroVideo = computed(() => maintenanceVideos.value[0] || null)
const moduleHeadPaddingTop = ref(72)
const pageBootReady = ref(false)
const BOOT_WAIT_MS = 1450
const activeTab = ref('home')
const activeModule = ref('')
const previousModule = ref('')
const logged = ref(Boolean(uni.getStorageSync('token')))
const currentUser = ref(uni.getStorageSync('userInfo') || {})
const repairLoginPending = ref(false)
const diagProduct = ref('')
const diagFault = ref('')
const diagOpen = ref('')
const activeTrackTab = ref('全部')
// 维修进度 tab：进度合并 + 发票维度（待处理/维修中/已发货 按进度；未开票/已开票 按发票状态）
const trackTabs = ['全部', '待处理', '维修中', '已发货', '未开票', '已开票']
const orderMatchesTrackTab = (item = {}, tab = '全部') => {
	if (tab === '全部') return true
	if (tab === '待处理') return getMiniStatusBucket(item) === 'pending'
	if (tab === '维修中') return getMiniStatusBucket(item) === 'fixing'
	if (tab === '已发货') return getMiniStatusBucket(item) === 'shipped'
	const inv = String(item.invoiceStatus || '')
	const issued = Boolean(item.invoiced) || ['已开具', '已开票', '已发票'].includes(inv)
	if (tab === '已开票') return issued
	if (tab === '未开票') return !issued && ['待开票', '开具中', '未发票'].includes(inv)
	return false
}
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
const actionSubmitting = ref(false)
const paymentProofUploading = ref(false)
const paymentProofTempUrls = ref({})
const detailAttachmentTempUrls = ref({})
const selectedPaymentMethod = ref('wechat')
const subscriptionTemplates = ref(null)
const feedbackSubmitting = ref(false)
const feedbackImageUploading = ref(false)
const feedbackType = ref('建议')
const feedbackContactKind = ref('phone')
const feedbackText = ref('')
const feedbackImages = ref([])
const surveySubmitting = ref(false)
const loginSubmitting = ref(false)
const loginRetrying = ref(false)
const loginClickLocked = ref(false)
const loginCooldownSeconds = ref(0)
const loginPrivacyReady = ref(false)
const loginAgreementChecked = ref(false)
const isPcWebView = isPcWebViewEnvironment()
const pcLoginGuard = createPcLoginGuard({
	enabled: isPcWebView,
	onLockChange: (locked) => {
		loginClickLocked.value = locked
	},
	onCountdown: (seconds) => {
		loginCooldownSeconds.value = seconds
	}
})
const surveyConfig = ref({
	enabled: true,
	title: '售后服务调研表',
	subtitle: '提交一次真实售后体验反馈，工作人员核对后为您登记调研福利。',
	giftText: '查看原调研有礼海报',
	ratingMax: 5,
	satisfactionOptions: ['满意', '一般', '不满意'],
	resolvedOptions: ['已解决', '处理中', '未解决'],
	successTitle: '提交成功',
	successMessage: '感谢参与售后调研，工作人员会根据联系方式核对并登记福利。'
})
const surveyRatingOptions = computed(() => Array.from({ length: Math.max(1, Number(surveyConfig.value.ratingMax) || 5) }, (_, i) => i + 1))
const surveySatisfactionOptions = computed(() => (Array.isArray(surveyConfig.value.satisfactionOptions) && surveyConfig.value.satisfactionOptions.length ? surveyConfig.value.satisfactionOptions : ['满意', '一般', '不满意']).map(label => ({ label, value: label })))
const surveyResolveOptions = computed(() => (Array.isArray(surveyConfig.value.resolvedOptions) && surveyConfig.value.resolvedOptions.length ? surveyConfig.value.resolvedOptions : ['已解决', '处理中', '未解决']).map(label => ({ label, value: label })))
const surveyForm = ref({
	orderNo: '',
	satisfaction: '',
	rating: 0,
	resolved: '',
	comment: '',
	contact: ''
})
const surveyRecords = ref([])

const SUBSCRIPTION_PROMPTED_KEY = 'cicada_subscription_prompted_v1'
let subscriptionRequested = false
let subscriptionRequestPromise = null

const hasRequestedSubscription = () => {
	try {
		return Boolean(uni.getStorageSync(SUBSCRIPTION_PROMPTED_KEY))
	} catch (error) {
		return false
	}
}

const markSubscriptionRequested = () => {
	try {
		uni.setStorageSync(SUBSCRIPTION_PROMPTED_KEY, '1')
	} catch (error) {
		// 内存标记仍可保证本次运行不重复弹窗。
	}
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

const requestStatusSubscription = (_scene) => {
	if (!uni.requestSubscribeMessage) return null
	if (subscriptionRequested || hasRequestedSubscription()) return null
	if (subscriptionRequestPromise) return subscriptionRequestPromise
	subscriptionRequestPromise = (async () => {
		const templates = await loadSubscriptionTemplates()
		const tmplIds = [...new Set(templates
			.filter(item => item.templateId)
			.map(item => item.templateId))].slice(0, 3)
		if (!tmplIds.length) return null

		// 无论同意、拒绝还是关闭，后续都不再请求，避免打断业务操作。
		subscriptionRequested = true
		markSubscriptionRequested()
		try {
			return await uni.requestSubscribeMessage({ tmplIds })
		} catch (error) {
			console.warn('request subscribe message failed:', error)
			return null
		}
	})()
	return subscriptionRequestPromise
}
const customerTypeLabel = (value) => {
	const option = customerTypeOptions.find((item) => item.value === value)
	return option ? option.label : ''
}
const showSavedAddressPicker = ref(false)
const savedAddressOptions = ref([])
const savedAddressTarget = ref('sender')
// 稍后补单号：详情页补填寄出运单号（独立状态，勿与报修表单的物流选择器混用）
const showOutboundSheet = ref(false)
const outboundSubmitting = ref(false)
const outboundForm = ref({ company: '', trackingNo: '' })
// 报修表单：产品名称下拉选择（后端驱动）
const showCustomerTypePicker = ref(false)
const showProductPicker = ref(false)
const activeProductPickerIndex = ref(-1)
const showRepairModelPicker = ref(false)
const activeRepairModelPickerIndex = ref(-1)
const showRepairLogisticsPicker = ref(false)
const repairProductLoading = ref(false)
const repairProductOptions = ref(defaultRepairProductOptions.map((item) => ({ ...item })))
const repairProductKeyword = ref('')
let repairProductOptionsLoaded = false
const feedbackContactValue = ref('')
const feedbackOrderId = ref('')
const feedbackRecords = ref([])
const feedbackImageTempUrls = ref({})
const packageQuery = ref({
	trackingNo: '',
	phoneLast4: ''
})
const packageQueryResult = ref(null)
const activePackageTab = ref('out')
const packageTabs = [
	{ key: 'out', label: '我寄出的设备' },
	{ key: 'back', label: '厂家寄回设备' }
]
const packageTabFlow = {
	out: ['已寄出', '运输中', '厂家签收'],
	back: ['厂家发货', '运输中', '客户签收']
}
const currentPackage = computed(() => {
	const r = packageQueryResult.value
	if (!r) return null
	return r[activePackageTab.value] || r.out
})
const invoiceForm = ref({
	invoiceType: '电子普通发票',
	titleType: 'company',
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
const repairLoginReturnKey = 'repairLoginReturn'
const feedbackRecordKey = 'feedbackRecords'
const surveyRecordKey = 'afterSalesSurveyRecords'
const repairForm = ref(defaultRepairForm())
const trackingLater = ref(false)
const submittedOrderId = ref('')
const submittedRepairSummary = ref({ logisticsCompany: '', trackingNo: '', trackingPending: false })
const repairProducts = ref([defaultRepairProduct()])
const repairSectionOpen = ref({ user: true, products: true, sender: true, receiver: true })

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
// Keep the persistent navigation tied to the three root views only. Detail modules
// manage their own back navigation and must not affect the root bar's lifecycle.
const showBottomTabbar = computed(() => pageBootReady.value && !activeModule.value)

const trackOrders = ref([])

const orderList = ref([])

const productList = ref([])

const diagProducts = ref([])
const diagFaultMap = ref({})

const faultRecords = ref([])
const diagResult = ref(null)
const diagLoading = ref(false)
const diagErrorText = ref('')

const defaultDiagConfirmSections = [
	{
		title: '处理方式',
		color: '#10B981',
		numbered: true,
		items: ['暂未提供对应处理建议']
	}
]

logBoot('static blocks ready')

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

const docModuleIds = ['fees', 'guide-repair', 'guide-invoice']

const docFallbacks = {
	warranty: {
		title: '三重保修承诺',
		lead: '原厂配件 · 工艺质保 · 终身咨询',
		content: '',
		sections: []
	},
	fees: {
		title: '收费指南',
		icon: 'money',
		lead: '价格透明，先报价后维修，全程无隐形消费。',
		paperTitle: '思科达维修收费指南',
		content: '',
		sections: [
			{ title: '一、收费构成', lines: ['配件费：按照思科达原厂配件官方指导价收取。', '工时费：根据维修难度及工程师等级核算，公开透明。', '物流费：保修期内非人为故障往返运费由我司承担（顺丰到付）。'] },
			{ title: '二、核心原则', lines: ['免费检测：所有寄修设备均享免费检测，未维修不收取任何检测费用。', '先报后修：工程师检测后出具正式报价单，经客户在线确认后方动工维修。', '拒绝隐形消费：所有收费项目均在报价单中列明，无额外附加费。'] },
			{ title: '三、质保说明', lines: ['所有维修更换的配件（非人为因素）均享受 90 天的质保续期服务。'], marker: '' }
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
			{ title: '三、思科达客服指引', lines: ['在线客服：8:00 - 21:00。', '服务热线：0757-85775667。'] }
		],
		steps: [
			{ title: '进入立即报修', desc: '在小程序首页点击「立即报修」按钮，进入报修表单页面。' },
			{ title: '填写产品信息', desc: '选择产品类型，输入产品序列号，填写产品购买日期。' },
			{ title: '上传故障图片', desc: '详细描述故障现象，上传故障照片或视频。' },
			{ title: '确认并提交', desc: '核对报修信息无误后，点击提交完成申请。' }
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

;['guide-repair', 'guide-invoice'].forEach((key) => {
	if (docFallbacks[key]) {
		docFallbacks[key].content = ''
		docFallbacks[key].fileName = ''
		docFallbacks[key].fileUrl = ''
		docFallbacks[key].fileType = ''
		docFallbacks[key].media = []
	}
})

const docMap = ref({})

logBoot('doc fallbacks ready')

const contactInfo = ref({
	companyName: '佛山市思科达医疗器械有限公司',
	phone: '0757-85775667',
	email: '',
	address: '广东省佛山市南海区狮山镇罗村广东新光源核心基地B5座五楼',
	workTime: '周一至周五 08:00 - 21:00',
	bankCompanyName: '佛山市登煌医疗器械有限公司',
	bankTaxNo: '91440605688623440U',
	bankAddressPhone: '佛山市南海区狮山镇罗村广东新光源产业基地核心区内B区5座二层  0757-85775667',
	bankName: '中国农业银行佛山惠景支行',
	bankAccount: '4442 3201 0400 04288',
	bankLineNo: '103588042208'
})

const customerService = ref({
	qrcodeUrl: cicadaAssets.qrWechat,
	title: '调研有礼',
	description: '扫码添加客服微信，参与调研即可获得精美礼品',
	wechat: 'CSD-Service-001'
})

const OFFICIAL_ACCOUNT_USERNAME = 'gh_efdbbf08eaa1'
const CICADA_SERVICE_ACCOUNT_USERNAME = 'gh_722a53ce06b5'
const PRODUCT_VIDEO_LINK = 'https://mp.weixin.qq.com/mp/homepage?__biz=MzIwNzYyNTI2Nw==&hid=40&sn=d1cbc102c21504684064130ba9fb7bd6&scene=18'

const wechatInfo = ref({
	qrcodeUrl: cicadaAssets.qrWechat,
	name: '思科达售后',
	description: '获取最新服务指南 / 售后政策',
	username: OFFICIAL_ACCOUNT_USERNAME
})

const contactHotlines = ref([
	{ title: '售后技术', number: '0757-85775667', time: '工作日 08:00-21:00' },
	{ title: '购买咨询', number: '0757-85775667', time: '工作日 08:00-21:00' }
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
const policyDocKeys = new Set(['warranty', 'fees'])

const normalizePhone = (value = '') => String(value || '').replace(/\D/g, '')
const normalizeTrackingNo = (value = '') => String(value || '').replace(/\s/g, '').trim()
const isValidPhone = (value = '') => phoneRegex.test(normalizePhone(value))
const isValidTrackingNo = (value = '') => trackingNoRegex.test(normalizeTrackingNo(value))

const hasRenderablePolicyDocument = (document) => Boolean(
	String(document?.mobileHtml || '').trim()
	|| (Array.isArray(document?.original?.pagePreviewUrls) && document.original.pagePreviewUrls.some(Boolean))
	|| String(document?.original?.pdfPreviewUrl || '').trim()
	|| String(document?.source?.previewUrl || '').trim()
)

const normalizeDoc = (doc, fallback = {}) => {
	if (!doc) return fallback
	const remoteContent = doc.content || doc.html || ''
	const policyDocument = hasRenderablePolicyDocument(doc.policyDocument)
		? doc.policyDocument
		: (hasRenderablePolicyDocument(fallback.policyDocument) ? fallback.policyDocument : null)
	const hasRemotePayload = Boolean(
		String(remoteContent || '').trim()
		|| policyDocument
		|| (Array.isArray(doc.sections) && doc.sections.length)
		|| (Array.isArray(doc.steps) && doc.steps.length)
		|| (Array.isArray(doc.media) && doc.media.length)
		|| doc.fileUrl
		|| doc.file_url
	)

	return {
		...fallback,
		title: hasRemotePayload ? (doc.title || fallback.title) : (fallback.title || doc.title),
		lead: hasRemotePayload ? (doc.description || doc.summary || fallback.lead) : fallback.lead,
		paperTitle: doc.paperTitle || (hasRemotePayload ? doc.title : '') || fallback.paperTitle || fallback.title,
		content: String(remoteContent || '').trim() ? remoteContent : (fallback.content || ''),
		updateTime: doc.updateTime || fallback.updateTime,
		fileName: doc.fileName || doc.file_name || fallback.fileName || '',
		fileUrl: doc.fileUrl || doc.file_url || fallback.fileUrl || '',
		fileType: doc.fileType || doc.file_type || fallback.fileType || '',
		policyDocument,
		media: Array.isArray(doc.media) && doc.media.length ? doc.media : fallback.media || [],
		sections: Array.isArray(doc.sections) && doc.sections.length ? doc.sections : fallback.sections || [],
		steps: Array.isArray(doc.steps) && doc.steps.length ? doc.steps : fallback.steps || []
	}
}

const normalizeContact = (data = {}) => ({
	companyName: data.companyName || contactInfo.value.companyName,
	phone: data.phone || contactInfo.value.phone,
	email: data.email || contactInfo.value.email,
	address: data.address || contactInfo.value.address,
	workTime: data.workTime || contactInfo.value.workTime,
	bankCompanyName: data.bankCompanyName || data.bank_company_name || data.bankTransferCompanyName || contactInfo.value.bankCompanyName || data.companyName || contactInfo.value.companyName,
	bankTaxNo: data.bankTaxNo || data.bank_tax_no || data.bankTransferTaxNo || contactInfo.value.bankTaxNo,
	bankAddressPhone: data.bankAddressPhone || data.bank_address_phone || data.bankTransferAddressPhone || contactInfo.value.bankAddressPhone,
	bankName: data.bankName || data.bank_name || data.bankTransferBankName || contactInfo.value.bankName,
	bankAccount: data.bankAccount || data.bank_account || data.bankTransferAccountNo || contactInfo.value.bankAccount,
	bankLineNo: data.bankLineNo || data.bank_line_no || data.bankTransferLineNo || contactInfo.value.bankLineNo
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

const toggleRepairSection = (section) => {
	if (!Object.prototype.hasOwnProperty.call(repairSectionOpen.value, section)) return
	repairSectionOpen.value[section] = !repairSectionOpen.value[section]
}

const openRepairSection = (section) => {
	if (Object.prototype.hasOwnProperty.call(repairSectionOpen.value, section)) {
		repairSectionOpen.value[section] = true
	}
}

const chooseWechatAddress = async (target) => {
	if (typeof uni.chooseAddress !== 'function') {
		uni.showToast({ title: '当前微信版本不支持地址导入', icon: 'none' })
		return
	}
	if (!(await ensureWechatPrivacyForAction())) return
	uni.chooseAddress({
		success: (result = {}) => {
			const address = Array.from(new Set([
				result.provinceName,
				result.cityName,
				result.countyName,
				result.detailInfo
			].filter(Boolean))).join(' ')
			const name = String(result.userName || '').trim()
			const phone = String(result.telNumber || '').replace(/\D/g, '')
			if (target === 'receiver') {
				repairForm.value.receiverName = name
				repairForm.value.receiverPhone = phone
				repairForm.value.receiverAddress = address
			} else {
				repairForm.value.senderName = name
				repairForm.value.senderPhone = phone
				repairForm.value.senderAddress = address
			}
		},
		fail: (error) => {
			if (!String(error && error.errMsg || '').includes('cancel')) {
				uni.showToast({ title: '微信地址导入失败', icon: 'none' })
			}
		}
	})
}

const openCustomerTypePicker = () => {
	if (!Array.isArray(customerTypeOptions) || !customerTypeOptions.length) {
		uni.showToast({ title: '用户类型暂不可选，请稍后重试', icon: 'none' })
		return
	}
	showCustomerTypePicker.value = true
}

const selectCustomerType = (item = {}) => {
	const value = String(item.value || '').trim()
	if (!value || !customerTypeOptions.some((option) => option.value === value)) {
		uni.showToast({ title: '用户类型选项无效，请重新选择', icon: 'none' })
		return
	}
	repairForm.value.customerType = value
	showCustomerTypePicker.value = false
}

const openRepairLogisticsPicker = () => {
	if (!Array.isArray(logisticsList) || !logisticsList.length) {
		uni.showToast({ title: '物流公司暂不可选，请稍后重试', icon: 'none' })
		return
	}
	showRepairLogisticsPicker.value = true
}

const closeRepairLogisticsPicker = () => {
	showRepairLogisticsPicker.value = false
}

const selectRepairLogistics = (item = {}) => {
	const value = String(item.value || item.label || '').trim()
	const selected = logisticsList.find((option) => option.value === value || option.label === value)
	if (!selected) {
		uni.showToast({ title: '物流公司选项无效，请重新选择', icon: 'none' })
		return
	}
	repairForm.value.logisticsCompany = selected.value || selected.label
	closeRepairLogisticsPicker()
}

const activeRepairProduct = computed(() => {
	const index = activeProductPickerIndex.value >= 0
		? activeProductPickerIndex.value
		: activeRepairModelPickerIndex.value
	return repairProducts.value[index] || null
})
const normalizedRepairProductKeyword = computed(() => String(repairProductKeyword.value || '').trim().toLowerCase())
const filteredRepairProductOptions = computed(() => {
	const keyword = normalizedRepairProductKeyword.value
	if (!keyword) return repairProductOptions.value
	return repairProductOptions.value.filter((item = {}) => {
		const searchable = item.searchKeywords
			|| [item.label, item.name, item.model, item.initials].filter(Boolean).join(' ').toLowerCase()
		return searchable.includes(keyword)
	})
})

const loadRepairProductOptions = async () => {
	if (repairProductLoading.value || repairProductOptionsLoaded) return
	repairProductLoading.value = true
	try {
		const options = await getRepairProductOptions({ scene: 'repair' })
		if (options.length) repairProductOptions.value = options
	} catch (error) {
		console.warn('repair product options failed:', error)
	} finally {
		repairProductLoading.value = false
		repairProductOptionsLoaded = true
	}
}

const openProductPicker = (index) => {
	if (!repairProducts.value[index]) {
		uni.showToast({ title: '产品信息无效，请重试', icon: 'none' })
		return
	}
	activeProductPickerIndex.value = index
	repairProductKeyword.value = ''
	showProductPicker.value = true
	loadRepairProductOptions()
}

const closeProductPicker = () => {
	showProductPicker.value = false
	repairProductKeyword.value = ''
	activeProductPickerIndex.value = -1
}

const isOtherRepairProduct = (product = {}) => Boolean(product && product.isCustomName)
const isOtherRepairModel = (product = {}) => Boolean(product && product.isCustomModel)
const repairProductNameText = (product = {}) => {
	if (product.name) return product.name
	return isOtherRepairProduct(product) ? repairProductOtherOption.label : '请选择产品名称'
}

const findRepairProductOption = (product = {}) => repairProductOptions.value.find((item = {}) => (
	Boolean(product.productId && product.productId === item.value)
	|| Boolean(product.name && product.name === (item.label || item.name))
))

const repairProductModelOptions = (product = {}) => {
	const option = findRepairProductOption(product)
	return createRepairProductModelOptions(option && option.model)
}

const repairProductModelPickerOptions = (product = {}) => (
	repairProductModelOptions(product).map((option) => option.label)
)

const syncRepairProductModelPickerOptions = (product = {}, sourceOption) => {
	const option = sourceOption || findRepairProductOption(product)
	product.modelPickerOptions = createRepairProductModelOptions(option && option.model)
		.map((item) => item.label)
}

const isConfiguredRepairProductModel = (product = {}, model = '') => {
	const option = findRepairProductOption(product)
	return splitRepairProductModels(option && option.model).includes(String(model || '').trim())
}

const repairProductModelText = (product = {}) => {
	const model = getRepairProductModelValue(product)
	if (model) return model
	return isOtherRepairModel(product) ? REPAIR_PRODUCT_MODEL_OTHER_LABEL : '请选择产品型号'
}

const syncCustomRepairModel = (index, value = '', shouldTrim = false) => {
	const product = repairProducts.value[index]
	if (!product || !product.isCustomModel) return
	const nextValue = shouldTrim ? String(value || '').trim() : String(value || '')
	product.customModel = nextValue
	product.model = nextValue
}

const activeRepairModelOptions = computed(() => {
	const product = activeRepairProduct.value
	const options = product && Array.isArray(product.modelPickerOptions) ? product.modelPickerOptions : []
	return options
		.map((label) => String(label || '').trim())
		.filter(Boolean)
		.map((label) => ({ label, value: label }))
})

const isActiveRepairModelOption = (item = {}) => {
	const product = activeRepairProduct.value
	if (!product) return false
	return product.model === item.value
		|| (item.value === REPAIR_PRODUCT_MODEL_OTHER_LABEL && product.isCustomModel)
}

const openRepairModelPicker = (index) => {
	const product = repairProducts.value[index]
	if (!product) {
		uni.showToast({ title: '产品信息无效，请重试', icon: 'none' })
		return
	}
	if (!Array.isArray(product.modelPickerOptions) || !product.modelPickerOptions.some((item) => String(item || '').trim())) {
		uni.showToast({ title: '产品型号暂不可选，请先选择产品名称', icon: 'none' })
		return
	}
	activeProductPickerIndex.value = -1
	activeRepairModelPickerIndex.value = index
	showRepairModelPicker.value = true
}

const closeRepairModelPicker = () => {
	showRepairModelPicker.value = false
	activeRepairModelPickerIndex.value = -1
}

const selectRepairProductModel = (item = {}) => {
	const product = activeRepairProduct.value
	const selected = String(item.value || item.label || '').trim()
	if (!product || !selected || !activeRepairModelOptions.value.some((option) => option.value === selected)) {
		uni.showToast({ title: '产品型号选项无效，请重新选择', icon: 'none' })
		return
	}
	if (selected === REPAIR_PRODUCT_MODEL_OTHER_LABEL) {
		const customModel = String(product.customModel || (product.isCustomModel ? product.model : '') || '').trim()
		product.isCustomModel = true
		product.customModel = customModel
		product.model = customModel
	} else {
		product.isCustomModel = false
		product.model = selected
	}
	closeRepairModelPicker()
}

const isActiveRepairProduct = (item = {}) => {
	const product = activeRepairProduct.value || {}
	return Boolean(product.productId && product.productId === item.value) || Boolean(product.name && product.name === item.label)
}

const selectRepairProduct = (item = {}) => {
	const product = activeRepairProduct.value
	const value = String(item.value || '').trim()
	const label = String(item.label || item.name || '').trim()
	const isOther = value === REPAIR_PRODUCT_OTHER_VALUE
	const optionExists = repairProductOptions.value.some((option) => String(option.value || '').trim() === value)
	if (!product || !value || (!isOther && (!label || !optionExists))) {
		uni.showToast({ title: '产品名称选项无效，请重新选择', icon: 'none' })
		return
	}
	if (isOther) {
		if (product.isCustomName) {
			closeProductPicker()
			return
		}
		product.productId = ''
		product.name = ''
		product.model = ''
		product.isCustomName = true
		product.isCustomModel = true
		product.customModel = ''
		product.modelPickerOptions = [REPAIR_PRODUCT_MODEL_OTHER_LABEL]
		closeProductPicker()
		return
	}
	const productChanged = product.productId !== value || product.name !== label
	product.productId = value
	product.name = label
	product.isCustomName = false
	syncRepairProductModelPickerOptions(product, item)
	if (productChanged) {
		const models = splitRepairProductModels(item.model)
		product.model = models.length === 1 ? models[0] : ''
		product.isCustomModel = false
		product.customModel = ''
	}
	closeProductPicker()
}

const scanTrackingNo = async () => {
	if (!(await ensureWechatPrivacyForAction())) return
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
		{ label: '收件人', value: '姚兵' },
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
	// 后端为唯一状态来源：不再合并本地 patch，避免旧缓存掩盖真实状态
	const merged = { ...item }
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
	// 状态唯一真相：英文主状态键 + 报价/付款子状态 → 细分显示标签（与“我的”页同源）
	const statusKey = resolveStatusKey(merged)
	const miniStatusBucket = merged.mini_status_bucket || (
		['pending', 'sent', 'received', 'inspecting'].includes(statusKey)
			? 'pending'
			: (statusKey === 'fixing' ? 'fixing' : (statusKey === 'shipped' ? 'shipped' : ''))
	)
	const quoteStatus = merged.quoteStatus || merged.quote_status || merged.quote?.status || (quoteItems.length ? 'issued' : 'pending')
	const paymentStatus = merged.paymentStatus || merged.payment_status || (paymentProofs.length ? 'uploaded' : 'pending')
	const arrivalConfirmStatus = merged.arrivalConfirmStatus || merged.arrival_confirm_status || ''
	const displayStatus = deriveDisplayStatus({ statusKey, quoteStatus, paymentStatus, review: merged.review, arrivalConfirmStatus })
	const displayTone = arrivalConfirmStatus === 'pending' ? 'warn' : meta.tone
	const displayReached = arrivalConfirmStatus === 'pending' ? Math.max(1, meta.reached) : meta.reached

	return {
		id: orderId,
		recordId: merged._id || merged.id || '',
		items: orderItems,
		shipOutInfo,
		shipBackInfo,
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
		status: displayStatus,
		statusGroup: meta.statusGroup,
		tone: displayTone,
		reached: displayReached,
		time: formatDateTime(updateTime, 5, 16) || merged.time || '',
		price: merged.price || merged.amount || merged.totalFee || merged.total_fee || merged.total_price || (totalFee ? formatMoney(totalFee) : ''),
		date: formatDateTime(createTime, 0, 10),
		doneTime: merged.doneTime || merged.expectedDoneTime || '待工作人员同步',
		invoiceStatus: merged.invoiceStatus || merged.invoice_status || invoiceInfo.status,
		invoiced: merged.invoiced || invoiceInfo.status === '已开具',
		invoiceType: merged.invoiceType || merged.invoice_type || invoiceInfo.invoice_type || '',
		invoiceMailCompany: invoiceInfo.mail_company || invoiceInfo.mailCompany || '',
		invoiceMailNo: invoiceInfo.mail_no || invoiceInfo.mailNo || '',
		invoiceTitle: merged.invoiceTitle || merged.invoice_title || invoiceInfo.title,
		taxNo: merged.taxNo || merged.tax_no || invoiceInfo.tax_no,
		invoiceEmail: merged.invoiceEmail || merged.invoice_email || invoiceInfo.email,
		invoiceRemark: merged.invoiceRemark || merged.invoice_remark || invoiceInfo.remark,
		invoiceNo: merged.invoiceNo || merged.invoice_no || invoiceInfo.invoice_no,
		invoiceDate: merged.invoiceDate || merged.invoice_date || invoiceInfo.invoice_date || formatDateTime(invoiceInfo.issued_time || invoiceInfo.update_time || invoiceInfo.apply_time, 0, 10),
		invoiceUrl: merged.invoiceUrl || merged.invoice_url || invoiceInfo.invoice_url,
		quoteStatus,
		authorizationStatus: merged.authorizationStatus || merged.authorization_status || merged.authStatus || '',
		authorizationTime: merged.authorizationTime || merged.authorization_time || '',
		paymentStatus,
		paymentRejectReason: merged.paymentRejectReason || merged.payment_reject_reason || '',
		quoteDetail,
		quoteItems,
		partsFee,
		laborFee,
		totalFee,
		paymentProofs,
		statusKey,
		miniStatusBucket,
		arrivalConfirmStatus,
		quoteWarrantyMonths: Number(merged.quoteWarrantyMonths ?? merged.quote_warranty_months ?? 0) || 0,
		warrantyStatus: merged.warrantyStatus || merged.warranty_status || '',
		inWarranty: Boolean(merged.inWarranty ?? merged.in_warranty),
		chargeType: merged.chargeType || merged.charge_type || '',
		paymentDeadline: Number(merged.paymentDeadline ?? merged.payment_deadline ?? 0) || 0,
		returnLogisticsCompany,
		returnLogisticsNo,
		timeline: Array.isArray(merged.timeline) ? merged.timeline : [],
		review: merged.review || null
	}
}

const getPaymentProofPreviewUrl = (proof = {}) => {
	const fileID = getCloudFileId(proof)
	return (fileID && paymentProofTempUrls.value[fileID]) || getPreviewUrl(proof)
}

const resolvePaymentProofUrls = async (orders = []) => {
	const fileIDs = [...new Set((Array.isArray(orders) ? orders : [])
		.flatMap((order = {}) => Array.isArray(order.paymentProofs) ? order.paymentProofs : [])
		.map(getCloudFileId)
		.filter(Boolean))]
	const unresolved = fileIDs.filter((fileID) => !paymentProofTempUrls.value[fileID])
	if (!unresolved.length) return

	try {
		const result = await getCloudTempFileURL(unresolved)
		const nextUrls = { ...paymentProofTempUrls.value }
		const fileList = result && Array.isArray(result.fileList) ? result.fileList : []
		for (const item of fileList) {
			const fileID = item.fileID || item.fileId || ''
			const tempFileURL = item.tempFileURL || item.url || ''
			if (fileID && tempFileURL && !isCloudFileId(tempFileURL)) nextUrls[fileID] = tempFileURL
		}
		paymentProofTempUrls.value = nextUrls
	} catch (error) {
		console.warn('resolve payment proof urls failed:', error)
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

const warrantyStatusLabels = { in_warranty: '保修中', extended: '延保中', expired: '已过保', unknown: '保修信息待同步' }
const normalizeProduct = (item = {}) => {
	const warrantyStatus = item.warrantyStatus || item.warranty_status || ''
	const warranty = item.warrantyText || item.warranty
		|| (warrantyStatus ? warrantyStatusLabels[warrantyStatus] : '')
		|| (item.warrantyExpire ? `保修至 ${item.warrantyExpire}` : '保修信息待同步')
	const lastOrderNo = item.lastOrderNo || item.last_order_no || ''
	const repairCount = Number(item.repairCount || item.repair_count || 0) || 0
	const lastOrderText = lastOrderNo
		? `最近工单 · ${lastOrderNo}${repairCount ? `（累计报修 ${repairCount} 次）` : ''}`
		: ''
	return {
		title: item.title || item.name || item.productName || item.model || '已登记设备',
		sn: item.sn || item.serial || item.productSerial || item.id || '',
		model: item.model || '',
		date: item.buyDate || item.purchaseDate || item.date || '',
		warranty,
		expired: warrantyStatus === 'expired' || Boolean(item.expired || item.isExpired),
		lastOrderNo,
		repairCount,
		lastOrderText
	}
}

const normalizePackageTimeline = (timeline = []) => {
	if (!Array.isArray(timeline) || !timeline.length) {
		return [{ title: '等待录入', desc: '工作人员更新快递单号后，这里会显示签收和处理记录。', time: '', pending: true }]
	}

	return timeline.map((item = {}) => ({
		title: item.title || item.statusText || item.status || '包裹状态更新',
		desc: item.desc || item.description || item.content || '包裹状态已更新。',
		time: item.time || item.createTime || item.updateTime || '',
		pending: Boolean(item.pending)
	}))
}

const normalizeSegment = (seg = {}) => ({
	company: seg.company || seg.expressCompany || seg.logisticsCompany || '',
	trackingNo: seg.trackingNo || seg.expressNo || seg.waybillNo || '',
	status: seg.status || seg.statusText || (seg.available ? '已录入' : '暂无记录'),
	tone: seg.tone || 'muted',
	reached: Math.max(0, Math.min(2, Number(seg.reached) || 0)),
	available: Boolean(seg.available),
	stagnant: Boolean(seg.stagnant),
	realtime: seg.realtime !== undefined ? Boolean(seg.realtime) : undefined,
	timeline: normalizePackageTimeline(seg.timeline || seg.logs || seg.records)
})

const normalizePackageResult = (data = {}) => {
	// 新格式：含 out/back 两段
	if (data.out || data.back) {
		return {
			trackingNo: data.trackingNo || packageQuery.value.trackingNo,
			orderId: data.orderId || '',
			matchedType: data.matchedType === 'back' ? 'back' : 'out',
			out: normalizeSegment(data.out || {}),
			back: normalizeSegment(data.back || {})
		}
	}
	// 旧格式兜底：单段 → 放进匹配的 tab
	const mt = data.matchedType === 'back' ? 'back' : 'out'
	const single = normalizeSegment({ ...data, available: true })
	return {
		trackingNo: data.trackingNo || packageQuery.value.trackingNo,
		orderId: data.orderId || data.repairOrderId || '',
		matchedType: mt,
		out: mt === 'out' ? single : normalizeSegment({}),
		back: mt === 'back' ? single : normalizeSegment({})
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
		if (packageQueryResult.value) activePackageTab.value = packageQueryResult.value.matchedType
		packageQuerySearched.value = true
	} catch (error) {
		console.warn('package query failed:', error)
		packageQuerySearched.value = true
		uni.showToast({ title: toCustomerErrorMessage(error, '暂未查到包裹记录'), icon: 'none' })
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
	if (!Array.isArray(list)) return
	const productMap = {}
	const faultMap = {}

	list.forEach((item) => {
		const productName = item.productType || item.productName || '通用设备'
		const productId = item.productTypeId || item.productType || productName
		const faultName = item.faultName || item.name || item.title

		if (!faultName) return
		productMap[productId] = { id: productId, title: productName }
		if (!faultMap[productId]) faultMap[productId] = new Set()
		faultMap[productId].add(faultName)
	})

	diagProducts.value = Object.values(productMap)
	diagFaultMap.value = Object.entries(faultMap).reduce((map, [productId, names]) => {
		map[productId] = Array.from(names)
		return map
	}, {})
	faultRecords.value = list

	if (diagProduct.value && !productMap[diagProduct.value]) {
		diagProduct.value = ''
		diagFault.value = ''
		diagResult.value = null
		return
	}

	if (diagProduct.value && diagFault.value) {
		const currentFaults = diagFaultMap.value[diagProduct.value] || []
		if (!currentFaults.includes(diagFault.value)) {
			diagFault.value = ''
			diagResult.value = null
			return
		}
		diagResult.value = list.find(
			(item) => (item.productTypeId || item.productType || item.productName) === diagProduct.value
				&& item.faultName === diagFault.value
		) || null
	}
}

const refreshFaultTypes = async ({ forceRefresh = false, silent = false } = {}) => {
	if (diagLoading.value) return faultRecords.value
	if (!silent) diagLoading.value = true
	diagErrorText.value = ''

	try {
		const list = await getFaultTypes({ forceRefresh })
		if (!Array.isArray(list) || !list.length) throw new Error('故障知识库暂无可用数据')
		applyFaultTypes(list)
		return list
	} catch (error) {
		console.warn('fault types fallback:', error)
		applyFaultTypes(defaultFaultTypes)
		diagErrorText.value = '故障知识库加载失败，当前显示内置数据。'
		if (!silent) uni.showToast({ title: '加载失败，已显示本地故障选项', icon: 'none' })
		return defaultFaultTypes
	} finally {
		if (!silent) diagLoading.value = false
	}
}

const updateDoc = (key, doc) => {
	const normalized = normalizeDoc(doc, docFallbacks[key] || docMap.value[key] || {})
	if (policyDocKeys.has(key)) {
		normalized.content = normalizePolicyHtml(normalized.content)
	}
	docMap.value = {
		...docMap.value,
		[key]: normalized
	}
}

const refreshPolicyDocument = createPolicyDocumentRefresher({
	getWarrantyPolicy,
	getFeePolicy,
	updateDoc
})

const statusItems = computed(() => {
	const counts = orderList.value.reduce(
		(acc, item) => {
			acc.all += 1
			const bucket = getMiniStatusBucket(item)
			if (bucket) acc[bucket] += 1
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

const getMiniStatusBucket = (order = {}) => order.miniStatusBucket || order.mini_status_bucket || ''

// 待付款口径与后端 getOrderStats.todo.payment 对齐：有应付金额、付款未确认、未退款未取消
const paymentConfirmedValues = ['paid', '已付款', '已支付', '已核款', '核款通过', '付款已确认']
const isOrderAwaitingPayment = (item = {}) => {
	if (!Number(item.totalFee || 0)) return false
	if (item.statusKey === 'cancelled') return false
	const payment = String(item.paymentStatus || '').trim()
	return !paymentConfirmedValues.includes(payment) && !['refunded', 'cancelled'].includes(payment)
}

const orderTabs = computed(() => [
	{ key: '全部', label: '全部', count: orderList.value.length },
	{ key: '待处理', label: '待处理', count: orderList.value.filter((item) => getMiniStatusBucket(item) === 'pending').length },
	{ key: '处理中', label: '处理中', count: orderList.value.filter((item) => getMiniStatusBucket(item) === 'fixing').length },
	{ key: '已回寄', label: '已回寄', count: orderList.value.filter((item) => getMiniStatusBucket(item) === 'shipped').length },
	{ key: '未开票', label: '未开票', count: orderList.value.filter((item) => invoiceTodoStatusKeys.includes(getInvoiceStatusKey(item))).length },
	{ key: '已开票', label: '已开票', count: orderList.value.filter((item) => getInvoiceStatusKey(item) === 'issued').length },
	{ key: '待付款', label: '待付款', count: orderList.value.filter(isOrderAwaitingPayment).length }
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
		? '选择产品类型与故障现象，系统将自动展示自查建议。'
		: '暂未提供故障自查方案，可联系售后协助判断。'
))
const diagFaultPlaceholder = computed(() => (diagProduct.value ? '请选择故障现象' : '请先选择产品类型'))
const diagFaultOptions = computed(() => {
	if (diagProduct.value) return diagFaultMap.value[diagProduct.value] || []
	return Array.from(new Set(Object.values(diagFaultMap.value).flat()))
})
const diagConfirmVisible = computed(() => Boolean(diagProduct.value && diagFault.value))
const diagRecommendRepair = computed(() => {
	const value = diagResult.value?.isRecommendRepair ?? diagResult.value?.is_recommend_repair
	return value === true || value === 1 || ['1', 'true', 'yes', '建议', '建议报修'].includes(String(value || '').trim().toLowerCase())
})
const diagRepairActionText = computed(() => (diagRecommendRepair.value ? '建议报修 · 填写报修单' : '仍未解决 · 立即报修'))
const diagConfirmSections = computed(() => {
	if (!diagResult.value) return defaultDiagConfirmSections

	const relatedItems = toTextLines(diagResult.value.relatedQuestions || diagResult.value.related_questions)
	const checkItems = toTextLines(diagResult.value.checkSteps || diagResult.value.check_steps)
	const solutionItems = toTextLines(
		diagResult.value.fixSolutions ||
		diagResult.value.fix_solutions ||
		diagResult.value.solutions ||
		diagResult.value.solution
	)

	const sections = [
		{
			title: '相关问题',
			color: '#1E6FE0',
			numbered: false,
			items: relatedItems
		},
		{
			title: '排查确认',
			color: '#F59E0B',
			numbered: true,
			items: checkItems
		},
		{
			title: '处理方式',
			color: '#10B981',
			numbered: true,
			items: solutionItems.length ? solutionItems : defaultDiagConfirmSections[0].items
		}
	].filter((section) => section.items.length)

	return sections.length ? sections : defaultDiagConfirmSections
})
const diagSheetOptions = computed(() => {
	if (diagOpen.value === 'product') {
		return diagProducts.value.map((item) => ({ ...item, active: item.id === diagProduct.value }))
	}
	return diagFaultOptions.value.map((title) => ({ id: title, title, active: title === diagFault.value }))
})
const warrantyDoc = computed(() => docMap.value.warranty || docFallbacks.warranty)
const warrantyHasPolicyDocument = computed(() => hasRenderablePolicyDocument(warrantyDoc.value.policyDocument))
const activeDoc = computed(() => docMap.value[activeModule.value] || docFallbacks[activeModule.value] || docFallbacks['guide-repair'] || {})
const activeDocHasPolicyDocument = computed(() => hasRenderablePolicyDocument(activeDoc.value.policyDocument))
const isDocModule = computed(() => docModuleIds.includes(activeModule.value))
const userDisplayName = computed(() => currentUser.value.nickname || currentUser.value.name || (currentUser.value.phone ? `用户${String(currentUser.value.phone).slice(-4)}` : '已登录用户'))
const userDisplayUnit = computed(() => currentUser.value.unit || currentUser.value.companyName || '已绑定手机号')
const userAvatarText = computed(() => String(userDisplayName.value || '用').slice(0, 1))

// ============== 编辑资料（昵称/头像） ==============
// 库里头像存 cloud:// fileID，展示需转临时链接
const avatarDisplayUrl = ref('')
const editProfileVisible = ref(false)
const editNickname = ref('')
const editAvatarUrl = ref('')       // 弹层内预览用可显示 URL
const editAvatarLocalPath = ref('') // chooseAvatar 返回的本地临时路径（保存时才上传）
const profileSaving = ref(false)

const resolveAvatarDisplay = async (raw) => {
	const value = String(raw || '')
	if (!value) { avatarDisplayUrl.value = ''; return }
	if (value.indexOf('cloud://') !== 0) { avatarDisplayUrl.value = value; return }
	try {
		const res = await getCloudTempFileURL([value])
		const item = res && res.fileList && res.fileList[0]
		avatarDisplayUrl.value = (item && item.tempFileURL) || ''
	} catch (e) {
		avatarDisplayUrl.value = ''
	}
}

const openEditProfile = () => {
	editNickname.value = currentUser.value.nickname || ''
	editAvatarUrl.value = avatarDisplayUrl.value || ''
	editAvatarLocalPath.value = ''
	editProfileVisible.value = true
}

const closeEditProfile = () => {
	if (profileSaving.value) return
	editProfileVisible.value = false
}

const onNicknameInput = (e) => {
	editNickname.value = (e && e.detail && e.detail.value) || ''
}

const onChooseAvatar = (e) => {
	const path = e && e.detail && e.detail.avatarUrl
	if (!path) return
	editAvatarUrl.value = path
	editAvatarLocalPath.value = path
}

const saveProfile = async () => {
	if (profileSaving.value) return
	const nickname = String(editNickname.value || '').trim()
	if (!nickname && !editAvatarLocalPath.value) {
		uni.showToast({ title: '请填写昵称或选择头像', icon: 'none' })
		return
	}
	profileSaving.value = true
	uni.showLoading({ title: '保存中…', mask: true })
	try {
		const payload = {}
		if (nickname !== (currentUser.value.nickname || '')) payload.nickname = nickname
		if (editAvatarLocalPath.value) {
			// 与报修图片上传同一套流程：先压缩再上传，取规范化后的 fileID
			const compressed = await compressForUpload(editAvatarLocalPath.value)
			const up = await uploadImage(compressed)
			const avatarFileId = normalizeUploadFileId(up) || (up && up.fileID) || (up && up.url) || ''
			if (!avatarFileId) throw new Error('头像上传失败，请重试')
			payload.avatar = avatarFileId
		}
		if (!Object.keys(payload).length) {
			uni.hideLoading()
			profileSaving.value = false
			editProfileVisible.value = false
			return
		}
		const info = await updateProfile(payload)
		currentUser.value = info || currentUser.value
		await resolveAvatarDisplay(currentUser.value.avatar)
		uni.hideLoading()
		uni.showToast({ title: '已保存', icon: 'success' })
		editProfileVisible.value = false
	} catch (error) {
		uni.hideLoading()
		uni.showToast({ title: toCustomerErrorMessage(error, '保存失败'), icon: 'none' })
	} finally {
		profileSaving.value = false
	}
}
const feedbackContact = computed(() => feedbackContacts.find((item) => item.id === feedbackContactKind.value) || feedbackContacts[0])
const receiverLastIndex = computed(() => receiver.value.length - 1)
const filteredTrackOrders = computed(() => {
	const keyword = trackSearchKeyword.value.trim().toLowerCase()
	return trackOrders.value.filter((item) => {
		const statusMatched = orderMatchesTrackTab(item, activeTrackTab.value)
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
	if (activeOrdersTab.value === '待处理') return orderList.value.filter((item) => getMiniStatusBucket(item) === 'pending')
	if (activeOrdersTab.value === '处理中') return orderList.value.filter((item) => getMiniStatusBucket(item) === 'fixing')
	if (activeOrdersTab.value === '已回寄') return orderList.value.filter((item) => getMiniStatusBucket(item) === 'shipped')
	if (activeOrdersTab.value === '未开票') return orderList.value.filter((item) => invoiceTodoStatusKeys.includes(getInvoiceStatusKey(item)))
	if (activeOrdersTab.value === '已开票') return orderList.value.filter((item) => getInvoiceStatusKey(item) === 'issued')
	if (activeOrdersTab.value === '待付款') return orderList.value.filter(isOrderAwaitingPayment)
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
		const imageExts = ['jpg', 'jpeg', 'png', 'webp', 'gif']
		const isWebFile = /^https?:\/\//i.test(String(doc.fileUrl || '').trim())
		const url = imageExts.includes(ext) || isWebFile
			? await resolveGuideFileUrl(doc.fileUrl)
			: ''

		if (imageExts.includes(ext)) {
			uni.hideLoading()
			uni.previewImage({ urls: [url], current: url })
			return
		}

		const downloadRes = isWebFile
			? await uni.downloadFile({ url })
			: await downloadCloudFile(doc.fileUrl)
		if (isWebFile && Number(downloadRes.statusCode) !== 200) {
			throw new Error(`文档下载失败（HTTP ${downloadRes.statusCode || '未知'}）`)
		}
		const filePath = downloadRes.tempFilePath
		if (!filePath) throw new Error('文档下载后未生成临时文件')
		uni.hideLoading()
		await uni.openDocument({
			filePath,
			fileType: ext || undefined,
			showMenu: true
		})
	} catch (error) {
		console.warn('open guide file failed:', error)
		uni.hideLoading()
		uni.showToast({ title: '文档打开失败', icon: 'none' })
	}
}

const guideModuleTypeMap = {
	'guide-repair': 'repair',
	'guide-invoice': 'invoice'
}

const openGuideFromHome = async (id) => {
	const type = guideModuleTypeMap[id]
	if (!type) {
		go(id)
		return
	}

	const fallbackDoc = docFallbacks[id]
	let doc = docMap.value[id] || fallbackDoc
	// 总是尝试拉取后台最新指南（可能含上传的文档文件）；本地兜底自带文本，不能因此跳过远程拉取，
	// 否则后台上传的文档会被本地兜底文本遮蔽。仅当已缓存到带 fileUrl 的远程文档时才免拉。
	if (type && !(docMap.value[id] && docMap.value[id].fileUrl)) {
		try {
			const remoteDoc = await getGuide(type)
			if (remoteDoc) {
				updateDoc(id, remoteDoc)
				doc = docMap.value[id] || normalizeDoc(remoteDoc, docFallbacks[id] || {})
			}
		} catch (error) {
			console.warn('load guide before open failed:', error)
		}
	}

	if (doc && doc.fileUrl) {
		await openGuideFile(doc)
		return
	}

	if (doc && ((Array.isArray(doc.sections) && doc.sections.length) || (Array.isArray(doc.steps) && doc.steps.length) || doc.content)) {
		go(id)
		return
	}

	if (fallbackDoc && ((Array.isArray(fallbackDoc.sections) && fallbackDoc.sections.length) || (Array.isArray(fallbackDoc.steps) && fallbackDoc.steps.length) || fallbackDoc.content)) {
		go(id)
		return
	}

	uni.showToast({ title: '该教程还未上传文档', icon: 'none' })
}

const maintenanceVideoCategories = ['首页介绍视频', '小程序介绍视频', '售后介绍视频', '维修保养视频', '维护保养视频', '维修保养', '维护保养']
const clientGuideAudiences = new Set(['', 'client', 'public', 'all'])
const isRenderableGuideUrl = (value = '') => /^(https?:\/\/|wxfile:\/\/|\/static\/)/i.test(String(value || '').trim())

const normalizeMaintenanceVideos = async (list = []) => {
	const picked = (Array.isArray(list) ? list : []).filter((item = {}) => {
		const category = String(item.category || item.title || '')
		const audience = String(item.audience || '').trim().toLowerCase()
		return maintenanceVideoCategories.some((name) => category.includes(name)) && clientGuideAudiences.has(audience)
	}).sort((a = {}, b = {}) => {
		const aCategory = String(a.category || a.title || '')
		const bCategory = String(b.category || b.title || '')
		const aIntro = aCategory.includes('首页介绍') || aCategory.includes('小程序介绍') || aCategory.includes('售后介绍') ? 0 : 1
		const bIntro = bCategory.includes('首页介绍') || bCategory.includes('小程序介绍') || bCategory.includes('售后介绍') ? 0 : 1
		return aIntro - bIntro || (Number(a.sort) || 99) - (Number(b.sort) || 99)
	})

	const result = []
	for (const guide of picked) {
		const media = Array.isArray(guide.media) ? guide.media : []
		let video = media.find((item) => item && item.type === 'video' && item.url)
		const legacyFileUrl = guide.videoUrl || guide.video_url || guide.fileUrl || guide.file_url || ''
		if (!video && legacyFileUrl) {
			video = { url: legacyFileUrl, name: guide.videoName || guide.video_name || guide.fileName || guide.file_name || '' }
		}
		if (!video) continue
		const cover = media.find((item) => item && item.type === 'image' && item.url)
		let coverUrl = maintenanceVideoFallback.coverUrl
		if (cover && cover.url) {
			try {
				const resolvedCoverUrl = await resolveGuideFileUrl(cover.url)
				if (isRenderableGuideUrl(resolvedCoverUrl)) coverUrl = resolvedCoverUrl
			} catch (error) {
				console.warn('maintenance cover fallback:', error)
			}
		}
		result.push({
			id: guide.id || guide._id || `${video.url}-${result.length}`,
			title: guide.title || guide.description || guide.summary || guide.desc || video.name || '首页介绍视频',
			desc: guide.content || '',
			videoUrl: video.url,
			videoName: video.name || '',
			coverUrl
		})
	}
	return result.slice(0, 1)
}

const loadMaintenanceVideos = async () => {
	try {
		const list = await getGuides({ forceRefresh: true })
		const normalized = await normalizeMaintenanceVideos(list)
		maintenanceVideos.value = normalized.length ? normalized : [{ ...maintenanceVideoFallback }]
	} catch (error) {
		console.warn('maintenance videos fallback:', error)
		maintenanceVideos.value = [{ ...maintenanceVideoFallback }]
	}
}

const openMaintenanceVideo = async (item = {}) => {
	if (!item.videoUrl) {
		uni.showToast({ title: '暂无视频', icon: 'none' })
		return
	}
	try {
		uni.showLoading({ title: '打开中' })
		const url = await resolveGuideFileUrl(item.videoUrl)
		if (!isRenderableGuideUrl(url)) throw new Error('视频地址不可用')
		uni.hideLoading()
		if (uni.previewMedia) {
			uni.previewMedia({
				sources: [{ url, type: 'video' }],
				current: 0,
				fail: (error) => {
					console.warn('preview maintenance video failed:', error)
					uni.showToast({ title: '视频播放失败，请稍后重试', icon: 'none' })
				}
			})
			return
		}
		uni.showToast({ title: '当前微信版本不支持视频预览', icon: 'none' })
	} catch (error) {
		console.warn('open maintenance video failed:', error)
		uni.hideLoading()
		uni.showToast({ title: '视频打开失败', icon: 'none' })
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
		uni.showToast({ title: '媒体打开失败', icon: 'none' })
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
	await resolvePaymentProofUrls(details)

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
const detailView = computed(() => createOrderDetailView(detailOrder.value))
const submittedLogisticsText = computed(() => {
	const summary = submittedRepairSummary.value
	const company = summary.logisticsCompany || '物流公司待同步'
	if (summary.trackingPending || !summary.trackingNo) return `${company} · 单号待补`
	return `${company} · ${summary.trackingNo}`
})

const getDetailAttachmentUrl = (attachment = {}) => {
	const fileID = getCloudFileId(attachment)
	if (fileID && detailAttachmentTempUrls.value[fileID]) return detailAttachmentTempUrls.value[fileID]
	return getPreviewUrl(attachment)
}

const openProductVideoLink = () => {
	uni.navigateTo({
		url: `/pages-sub/webview/index?title=${encodeURIComponent('产品视频')}&url=${encodeURIComponent(PRODUCT_VIDEO_LINK)}`,
		fail: (error) => {
			console.warn('open product video page failed:', error)
			uni.showToast({ title: '产品视频暂时无法打开', icon: 'none' })
		}
	})
}

const getDetailAttachmentCoverUrl = (attachment = {}) => (
	attachment.coverUrl || attachment.cover_url || attachment.coverPath || attachment.thumbTempFilePath || ''
)

const resolveDetailAttachmentUrls = async (attachments = []) => {
	const fileIDs = [...new Set((Array.isArray(attachments) ? attachments : [])
		.map(getCloudFileId)
		.filter((fileID) => fileID && isCloudFileId(fileID) && !detailAttachmentTempUrls.value[fileID]))]
	if (!fileIDs.length) return
	try {
		const result = await getCloudTempFileURL(fileIDs)
		const nextUrls = { ...detailAttachmentTempUrls.value }
		const fileList = result && Array.isArray(result.fileList) ? result.fileList : []
		for (const item of fileList) {
			const fileID = item.fileID || item.fileId || ''
			const tempFileURL = item.tempFileURL || item.url || ''
			if (fileID && tempFileURL && !isCloudFileId(tempFileURL)) nextUrls[fileID] = tempFileURL
		}
		detailAttachmentTempUrls.value = nextUrls
	} catch (error) {
		console.warn('resolve detail attachment urls failed:', error)
	}
}

const previewDetailImages = async (attachments = [], index = 0) => {
	await resolveDetailAttachmentUrls(attachments)
	const urls = attachments.map(getDetailAttachmentUrl).filter(Boolean)
	if (!urls.length) {
		uni.showToast({ title: '附件暂不可预览', icon: 'none' })
		return
	}
	uni.previewImage({ urls, current: urls[Math.min(Math.max(Number(index) || 0, 0), urls.length - 1)] })
}

const previewDetailVideo = async (attachment = {}) => {
	await resolveDetailAttachmentUrls([attachment])
	const url = getDetailAttachmentUrl(attachment)
	if (!url) {
		uni.showToast({ title: '视频暂不可预览', icon: 'none' })
		return
	}
	if (uni.previewMedia) {
		uni.previewMedia({ sources: [{ url, type: 'video' }], current: 0 })
		return
	}
	uni.showToast({ title: '当前微信版本暂不支持视频预览', icon: 'none' })
}
// 面向用户只保留四个关键维修阶段，报价和付款状态分别在对应卡片展示。
const repairProgressNodes = computed(() => getRepairProgressNodes(detailOrder.value))

const detailIsCompleted = computed(() => detailOrder.value.statusKey === 'completed' || detailOrder.value.status === '已完成')

// 投诉/反馈挂到本工单：按 rel_order_no 过滤已加载的反馈单
const detailOrderComplaints = computed(() => {
	const id = detailOrder.value.id
	if (!id) return []
	return feedbackRecords.value.filter((record) => record && record.orderId === id)
})

const detailQuoteVisible = computed(() => ['issued', 'confirmed', 'rejected'].includes(detailOrder.value.quoteStatus))

const isWarrantyFreeOrder = (order = {}) => Boolean(
	order.chargeType === 'free'
	&& order.inWarranty
	&& ['in_warranty', 'extended'].includes(order.warrantyStatus)
	&& ['issued', 'confirmed'].includes(order.quoteStatus)
)

const detailWarrantyText = computed(() => {
	const m = Number(detailOrder.value.quoteWarrantyMonths || 0)
	return m > 0 ? `本次维修质保 ${m} 个月` : '本次维修质保以全局质保政策为准'
})

// 报价弹窗顶部在保/过保提示栏：读取工单下单时的在保快照
const detailWarrantyHint = computed(() => {
	const status = detailOrder.value.warrantyStatus || ''
	if (detailOrder.value.inWarranty || status === 'in_warranty' || status === 'extended') {
		return { show: true, tone: 'in', text: '该设备处于原厂质保期，可享受质保减免政策' }
	}
	if (status === 'expired') {
		return { show: true, tone: 'out', text: '该设备已超出质保期，维修收取全额工时、上门及配件费用' }
	}
	return { show: true, tone: 'unknown', text: '质保信息待补充，工作人员核实期限后再确认本次收费方式' }
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
		const systemInfo = typeof uni.getWindowInfo === 'function'
			? uni.getWindowInfo()
			: { windowWidth: 375, statusBarHeight: 24 }
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

const writeClipboard = (value, label) => {
	const text = String(value ?? '').trim()
	if (!text) {
		uni.showToast({ title: '暂无可复制内容', icon: 'none' })
		return
	}

	uni.setClipboardData({
		data: text,
		success: () => {
			markCopied(label)
			uni.showToast({ title: '复制成功', icon: 'success' })
		},
		fail: (error) => {
			console.warn('set clipboard failed:', error)
			uni.showToast({ title: '复制失败，请长按信息复制', icon: 'none' })
		}
	})
}

const copyOne = (value, label) => {
	writeClipboard(value, label)
}

const copyAll = () => {
	const text = receiver.value.map((item) => `${item.label}: ${item.value}`).join('\n')
	writeClipboard(text, 'all')
}

function resolveOrderRecord(order = {}) {
	return orderList.value.find((item) => item.id === order.id) || order || {}
}

// 后端为唯一状态来源：支付/确认/收货等改动后回拉工单详情并覆盖本地数据。
const refreshOrderFromServer = async (order = {}) => {
	const recordId = order.recordId || order.id
	if (!recordId) return null
	try {
		const detail = await getRepairDetail(recordId)
		const normalized = normalizeOrder(detail)
		if (!normalized.id) return null
		await resolvePaymentProofUrls([normalized])
		const mergeInto = (list) => list.map((item) => (item.id === normalized.id ? { ...item, ...normalized } : item))
		orderList.value = mergeInto(orderList.value)
		trackOrders.value = mergeInto(trackOrders.value)
		return normalized
	} catch (error) {
		console.warn('refresh order failed:', error)
		return null
	}
}

const getQuoteTotal = (order = {}) => Number(order.totalFee || order.quoteDetail?.finalPrice || 0) || sumQuoteFee(order.quoteItems || [], 'partsFee') + sumQuoteFee(order.quoteItems || [], 'laborFee')

const getQuoteItemTotal = (item = {}) => (Number(item.partsFee) || 0) + (Number(item.laborFee) || 0)

const getQuoteDetailRowTotal = (item = {}) => Number(item.amount || 0) || (Number(item.unitPrice || 0) * Number(item.quantity || 0))
const isPayableQuoteOrder = (order = {}) => Boolean(
	order.id &&
	getQuoteTotal(order) > 0 &&
	!['cancelled', 'completed'].includes(order.statusKey) &&
	['issued', 'confirmed'].includes(order.quoteStatus) &&
	order.paymentStatus !== 'paid'
)

const showPaymentMethodSelector = (order = {}) => {
	const proofs = Array.isArray(order.paymentProofs) ? order.paymentProofs : []
	return isPayableQuoteOrder(order) && order.paymentStatus !== 'uploaded' && !proofs.length
}

const showTransferPaymentPanel = (order = {}) => {
	const proofs = Array.isArray(order.paymentProofs) ? order.paymentProofs : []
	return isPayableQuoteOrder(order) && (
		selectedPaymentMethod.value === 'transfer' ||
		order.paymentStatus === 'uploaded' ||
		order.paymentStatus === 'rejected' ||
		proofs.length > 0
	)
}

const showWechatPayAction = (order = {}) => {
	const action = getBillingAction(order)
	return selectedPaymentMethod.value === 'wechat' && showPaymentMethodSelector(order) && action.visible && action.type === 'wechat-pay'
}

const showNonPaymentBillingAction = (order = {}) => {
	const action = getBillingAction(order)
	return action.visible && action.type !== 'wechat-pay'
}

const showTransferProofAction = (order = {}) => showTransferPaymentPanel(order) && getPaymentProofAction(order).visible

watch(
	() => [detailOrder.value.id, detailOrder.value.paymentStatus, detailPaymentProofs.value.length],
	([id, paymentStatus, proofCount]) => {
		if (!id) return
		if (paymentStatus === 'uploaded' || paymentStatus === 'rejected' || proofCount > 0) {
			selectedPaymentMethod.value = 'transfer'
			return
		}
		selectedPaymentMethod.value = 'wechat'
	},
	{ immediate: true }
)

watch(
	() => detailView.value.items.flatMap((item) => [...item.vouchers, ...item.images, ...item.videos]).map((item) => item.url).join('|'),
	() => {
		const attachments = detailView.value.items.flatMap((item) => [...item.vouchers, ...item.images, ...item.videos])
		resolveDetailAttachmentUrls(attachments)
	},
	{ immediate: true }
)

const getQuoteMeta = (order = {}) => {
	if (!order.id) return { label: '待同步', tone: 'muted', desc: '请选择一个工单查看报价。' }
	if ((!Array.isArray(order.quoteItems) || !order.quoteItems.length) && !order.quoteDetail) return { label: '待检测', tone: 'muted', desc: '工程师检测完成后会生成正式报价。' }
	if (order.quoteStatus === 'rejected') return { label: '已拒绝', tone: 'warn', desc: '客户暂未同意该维修报价。' }
	if (order.authorizationStatus === 'confirmed') return { label: '已确认', tone: 'ok', desc: '报价已确认，工程师可继续维修。' }
	return { label: '待确认', tone: 'warn', desc: '请确认维修项目、配件、工时和总价后再授权维修。' }
}

const getAuthorizationMeta = (order = {}) => {
	if (isWarrantyFreeOrder(order)) {
		return order.authorizationStatus === 'confirmed'
			? { label: '已授权', tone: 'ok', desc: order.authorizationTime ? `客户已于 ${order.authorizationTime} 确认质保维修。` : '客户已确认质保维修。' }
			: { label: '待授权', tone: 'warn', desc: '请确认本次零元质保方案后授权维修。' }
	}
	if (!getQuoteTotal(order)) return { label: '待报价', tone: 'muted', desc: '检测报价生成后才需要授权。' }
	if (order.authorizationStatus === 'confirmed') return { label: '已授权', tone: 'ok', desc: order.authorizationTime ? `客户已于 ${order.authorizationTime} 授权维修。` : '客户已授权维修。' }
	return { label: '待授权', tone: 'warn', desc: '客户确认报价后，售后再安排维修。' }
}

const getPaymentMeta = (order = {}) => {
	const proofs = Array.isArray(order.paymentProofs) ? order.paymentProofs : []
	if (isWarrantyFreeOrder(order)) return { label: '质保免收费', tone: 'ok', desc: '本次维修费用由质保承担，无需微信支付或上传付款凭证。' }
	if (!getQuoteTotal(order)) return { label: '待报价', tone: 'muted', desc: '报价金额确认后，可微信支付；企业客户也可上传对公转账凭证。' }
	if (order.paymentStatus === 'paid') return { label: '已支付', tone: 'ok', desc: '微信支付已完成，系统已自动确认到账。' }
	if (order.paymentStatus === 'rejected') return { label: '已驳回', tone: 'warn', desc: order.paymentRejectReason ? `转账凭证被驳回：${order.paymentRejectReason}` : '转账凭证被驳回，请核对后重新上传。' }
	if (proofs.length || order.paymentStatus === 'uploaded') return { label: '待核销', tone: 'warn', desc: '凭证已留痕，等待财务核对到账。' }
	return { label: '待支付', tone: 'warn', desc: '可直接微信支付；企业客户可走对公转账并上传凭证。' }
}

const getBillingAmountText = (order = {}) => {
	const total = getQuoteTotal(order)
	if (isWarrantyFreeOrder(order)) return '¥0.00（质保免收费）'
	return total ? formatMoney(total) : '待售后报价'
}

const getBillingMeta = (order = {}) => {
	const quoteTotal = getQuoteTotal(order)
	const invoiceMeta = getInvoiceMeta(resolveOrderRecord(order))
	if (!order.id) return { label: '待同步', tone: 'muted', desc: '请选择一个工单查看报价。' }
	if (isWarrantyFreeOrder(order)) {
		return order.authorizationStatus === 'confirmed'
			? { label: '质保已确认', tone: 'ok', desc: '本次维修免收费，已进入后续维修流程。' }
			: { label: '质保免收费', tone: 'ok', desc: '本次方案应付 0 元，确认后无需进入付款流程。' }
	}
	if (!quoteTotal) return { label: '待报价', tone: 'muted', desc: '工程师检测后会在这里给出正式报价。' }
	if (order.paymentStatus === 'paid') return { label: '已支付', tone: 'ok', desc: invoiceMeta.desc || '微信支付已完成，订单已自动进入后续维修流程。' }
	if (order.paymentStatus === 'rejected') return { label: '已驳回', tone: 'warn', desc: order.paymentRejectReason ? `转账凭证被驳回：${order.paymentRejectReason}` : '转账凭证被驳回，请核对后重新上传。' }
	if (Array.isArray(order.paymentProofs) && order.paymentProofs.length) return { label: '待核销', tone: 'warn', desc: '付款凭证已上传，等待财务核对到账。' }
	return { label: '待支付', tone: 'warn', desc: '请核对维修项目和金额，确认后可直接微信支付。' }
}

const getBillingAction = (order = {}) => {
	if (!order.id) return { visible: false, text: '', disabled: true }
	if (isWarrantyFreeOrder(order) && order.authorizationStatus !== 'confirmed') {
		return {
			visible: true,
			text: paymentSubmitting.value ? '确认中...' : '确认质保维修',
			disabled: paymentSubmitting.value,
			type: 'confirm-warranty'
		}
	}
	if (isWarrantyFreeOrder(order)) return { visible: false, text: '', disabled: true }
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
	if (order.paymentStatus === 'uploaded') return { visible: false, text: '', disabled: true, hint: '付款凭证已上传，等待工作人员确认。' }
	if (!canUploadPaymentProof(order)) return { visible: false, text: '', disabled: true, hint: '' }
	if (order.paymentStatus === 'rejected') {
		return {
			visible: true,
			text: paymentProofUploading.value ? '上传中...' : '凭证被驳回，重新上传',
			disabled: paymentProofUploading.value,
			hint: ''
		}
	}
	if (proofs.length) {
		return { visible: false, text: '', disabled: true, hint: '付款凭证已上传，等待工作人员确认。' }
	}
	return {
		visible: true,
		text: paymentProofUploading.value ? '上传中...' : '我已转账，上传付款凭证',
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
	if (action.type === 'confirm-warranty') {
		confirmWarrantyRepair(order)
		return
	}
	handleInvoiceAction(order)
}

const confirmWarrantyRepair = (order = {}) => {
	if (!isWarrantyFreeOrder(order) || order.authorizationStatus === 'confirmed' || paymentSubmitting.value) return
	uni.showModal({
		title: '确认质保维修',
		content: '本次维修处于质保范围，应付金额为 0 元。确认后将授权工程师开始维修，无需付款。',
		confirmText: '确认维修',
		cancelText: '再看看',
		success: async ({ confirm }) => {
			if (!confirm) return
			try {
				paymentSubmitting.value = true
				uni.showLoading({ title: '确认中' })
				await confirmRepairQuote(order.recordId || order.id)
				await refreshOrderFromServer(order)
				uni.hideLoading()
				uni.showToast({ title: '已确认质保维修', icon: 'success' })
			} catch (error) {
				uni.hideLoading()
				uni.showToast({ title: toCustomerErrorMessage(error, '确认失败'), icon: 'none' })
			} finally {
				paymentSubmitting.value = false
			}
		}
	})
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

const canUploadPaymentProof = (order = {}) => canUploadPaymentProofForOrder(order, getQuoteTotal(order))

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
				await requestStatusSubscription('wechat_pay')
				paymentSubmitting.value = true
				uni.showLoading({ title: '创建支付' })
				loadingShown = true
				const paymentOrder = await createRepairWechatPay(order.recordId || order.id)
				const paymentParams = paymentOrder.payment || {}
				if (!paymentParams.timeStamp || !paymentParams.nonceStr || !paymentParams.package || !paymentParams.paySign) {
					throw new Error('暂时无法支付，请稍后重试')
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
				await syncRepairWechatPay(order.recordId || order.id, paymentOrder.outTradeNo)
				// 后端为唯一状态来源：支付完成后回拉工单
				await refreshOrderFromServer(order)
				uni.hideLoading()
				loadingShown = false
				uni.showToast({ title: '支付成功', icon: 'success' })
			} catch (error) {
				console.warn('wechat pay failed:', error)
				const message = toCustomerErrorMessage(error, '支付失败')
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

// 回寄物流：跳转包裹查询并自动带入回寄单号
const trackReturnLogistics = (order = {}) => {
	if (!order.returnLogisticsNo) return
	packageQuery.value.trackingNo = order.returnLogisticsNo
	openModule('package-query')
	queryPackage()
}

// 寄出物流：跳转包裹查询并自动带入寄出单号
const trackSendLogistics = (order = {}) => {
	if (!order.trackingNo) return
	packageQuery.value.trackingNo = order.trackingNo
	openModule('package-query')
	queryPackage()
}

// 包裹查询：点击关联工单跳转工单详情
const openLinkedOrder = (orderId = '') => {
	if (!orderId) return
	const matched = orderList.value.find((item) => item.id === orderId) || trackOrders.value.find((item) => item.id === orderId)
	if (matched) {
		openOrderDetail(matched)
		return
	}
	uni.showToast({ title: '请登录后在“我的维修单”查看该工单', icon: 'none' })
}

// 拒绝维修报价（仅报价已发布、未支付时可用）
const canRejectQuote = (order = {}) => Boolean(order.id && order.quoteStatus === 'issued' && order.paymentStatus !== 'paid')

const rejectRepairQuoteAction = (order = {}) => {
	if (!canRejectQuote(order) || actionSubmitting.value) return
	uni.showModal({
		title: '拒绝维修报价',
		editable: true,
		placeholderText: '可填写拒绝原因（选填）',
		confirmText: '确认拒绝',
		cancelText: '再想想',
		success: async ({ confirm, content }) => {
			if (!confirm || actionSubmitting.value) return
			actionSubmitting.value = true
			try {
				uni.showLoading({ title: '提交中' })
				await rejectRepairQuote(order.recordId || order.id, content || '')
				await refreshOrderFromServer(order)
				uni.hideLoading()
				uni.showToast({ title: '已拒绝报价', icon: 'success' })
			} catch (error) {
				uni.hideLoading()
				uni.showToast({ title: toCustomerErrorMessage(error, '操作失败'), icon: 'none' })
			} finally {
				actionSubmitting.value = false
			}
		}
	})
}

// 确认收货：已回寄 → 已完成
const canConfirmReceipt = (order = {}) => Boolean(order.id && (order.statusKey === 'shipped' || order.status === '已回寄'))

// 稍后补单号：pending（已提交待寄出）且尚未填寄出单号时可补填
const canFillOutboundTracking = (order = {}) => Boolean(order.id && order.statusKey === 'pending' && !order.trackingNo)

const selectOutboundLogistics = (item = {}) => {
	const value = String(item.value || item.label || '').trim()
	const selected = logisticsList.find((option) => option.value === value || option.label === value)
	if (!selected) {
		uni.showToast({ title: '物流公司选项无效，请重新选择', icon: 'none' })
		return
	}
	outboundForm.value.company = selected.value || selected.label
	showOutboundSheet.value = false
}

const submitOutboundTracking = async (order = {}) => {
	if (outboundSubmitting.value || !canFillOutboundTracking(order)) return
	const company = (outboundForm.value.company || '').trim()
	const trackingNo = (outboundForm.value.trackingNo || '').trim()
	if (!company) {
		uni.showToast({ title: '请选择物流公司', icon: 'none' })
		return
	}
	if (!/^[A-Za-z0-9-]{6,32}$/.test(trackingNo)) {
		uni.showToast({ title: '运单号格式不正确（6-32位字母数字）', icon: 'none' })
		return
	}
	outboundSubmitting.value = true
	try {
		// 补单号后进入运输链路，顺带申请物流节点订阅
		await requestStatusSubscription('track_view')
		uni.showLoading({ title: '提交中' })
		await updateRepairOutboundLogistics(order.recordId || order.id, company, trackingNo)
		await refreshOrderFromServer(order)
		uni.hideLoading()
		outboundForm.value = { company: '', trackingNo: '' }
		uni.showToast({ title: '运单号已提交', icon: 'success' })
	} catch (error) {
		uni.hideLoading()
		uni.showToast({ title: toCustomerErrorMessage(error, '提交失败'), icon: 'none' })
	} finally {
		outboundSubmitting.value = false
	}
}

const confirmRepairReceiptAction = (order = {}) => {
	if (!canConfirmReceipt(order) || actionSubmitting.value) return
	uni.showModal({
		title: '确认收货',
		content: '确认已收到回寄的设备？确认后工单将标记为已完成。',
		confirmText: '确认收货',
		cancelText: '再看看',
		success: async ({ confirm }) => {
			if (!confirm || actionSubmitting.value) return
			actionSubmitting.value = true
			try {
				uni.showLoading({ title: '提交中' })
				await confirmRepairReceipt(order.recordId || order.id)
				await refreshOrderFromServer(order)
				uni.hideLoading()
				uni.showToast({ title: '已确认收货', icon: 'success' })
			} catch (error) {
				uni.hideLoading()
				uni.showToast({ title: toCustomerErrorMessage(error, '操作失败'), icon: 'none' })
			} finally {
				actionSubmitting.value = false
			}
		}
	})
}

// 完成后：回访评价，绑定到已完成工单；不满意自动转投诉
const reviewOrder = (order = {}) => {
	if (!order.id) return
	if (order.review) {
		uni.showToast({ title: '已评价', icon: 'none' })
		return
	}
	const options = [
		{ label: '非常满意（5星）', rating: 5 },
		{ label: '满意（4星）', rating: 4 },
		{ label: '一般（3星）', rating: 3 },
		{ label: '不满意（转人工投诉）', rating: 2, toComplaint: true }
	]
	uni.showActionSheet({
		itemList: options.map((item) => item.label),
		success: async ({ tapIndex }) => {
			const choice = options[tapIndex]
			if (!choice) return
			try {
				uni.showLoading({ title: '提交中' })
				await submitRepairReview(order.recordId || order.id, {
					rating: choice.rating,
					to_complaint: Boolean(choice.toComplaint)
				})
				await refreshOrderFromServer(order)
				uni.hideLoading()
				if (choice.toComplaint) {
					feedbackType.value = '投诉'
					feedbackOrderId.value = order.id || order.recordId || ''
					uni.showModal({
						title: '已转投诉',
						content: '请补充问题详情。',
						showCancel: false,
						confirmText: '去填写',
						success: () => openModule('feedback')
					})
				} else {
					uni.showToast({ title: '感谢您的评价', icon: 'success' })
				}
			} catch (error) {
				uni.hideLoading()
				uni.showToast({ title: toCustomerErrorMessage(error, '评价失败'), icon: 'none' })
			}
		},
		fail: () => {}
	})
}

// 完成后：详细反馈（复用投诉建议，预填关联工单）
const evaluateOrder = (order = {}) => {
	feedbackType.value = '建议'
	feedbackOrderId.value = order.id || order.recordId || ''
	openModule('feedback')
}

// 工单详情：发起投诉，预填关联工单
const complainAboutOrder = (order = {}) => {
	feedbackType.value = '投诉'
	feedbackOrderId.value = order.id || order.recordId || ''
	openModule('feedback')
}

// 完成后：保养提醒
const showMaintenanceTip = () => {
	uni.showModal({
		title: '保养提醒',
		content: '建议每 6 个月清洁、润滑并检查一次易损件。',
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
	product.isCustomModel = Boolean(product.model && !isConfiguredRepairProductModel(product, product.model))
	product.customModel = product.isCustomModel ? product.model : ''
	syncRepairProductModelPickerOptions(product)
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
		await requestStatusSubscription('payment_proof')
		const chooseRes = await chooseImageWithPrivacy({
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
		const uploadRes = await uploadImage(path)
		const proofFileID = normalizeUploadFileId(uploadRes)
		if (!isCloudFileId(proofFileID)) throw new Error('付款凭证上传未返回有效云文件')
		const nextProof = { id: `pay-${Date.now()}`, fileID: proofFileID, url: proofFileID, time: todayText() }
		await uploadRepairPaymentProof(order.recordId || order.id, nextProof)
		// 后端为唯一状态来源：上传凭证后回拉工单
		await refreshOrderFromServer(order)
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
	const urls = detailPaymentProofs.value.map(getPaymentProofPreviewUrl).filter(Boolean)
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
		registerAddress: '',
		registerPhone: '',
		bankName: '',
		bankAccount: '',
		// 收票人默认取回寄地址联系人，减少重复填写
		recipientName: addressForm.value.name || '',
		recipientPhone: addressForm.value.phone || '',
		recipientAddress: [addressForm.value.region, addressForm.value.detail].filter(Boolean).join(' '),
		remark: ''
	}
}

// 发票种类双选：电子普票 / 纸质专票（专票强制企业抬头，后端同规则）
const invoiceKindOptions = [
	{ value: '电子普通发票', label: '电子普通发票', desc: '开具快，链接+邮箱接收' },
	{ value: '纸质专用发票', label: '纸质专用发票', desc: '可抵扣，财务审核后邮寄' }
]

const isPaperInvoice = computed(() => invoiceForm.value.invoiceType === '纸质专用发票')
const canChooseInvoiceTitle = typeof uni.chooseInvoiceTitle === 'function'

const chooseWechatInvoiceTitle = () => {
	if (!canChooseInvoiceTitle) return
	uni.chooseInvoiceTitle({
		success: (result = {}) => {
			const isCompany = Number(result.type) === 0
			if (isPaperInvoice.value && !isCompany) {
				uni.showToast({ title: '纸质专票请选择企业抬头', icon: 'none' })
				return
			}
			invoiceForm.value.titleType = isCompany ? 'company' : 'personal'
			invoiceForm.value.title = String(result.title || '').trim()
			invoiceForm.value.taxNo = isCompany ? String(result.taxNumber || '').trim() : ''
			if (result.companyAddress) invoiceForm.value.registerAddress = result.companyAddress
			if (result.telephone) invoiceForm.value.registerPhone = result.telephone
			if (result.bankName) invoiceForm.value.bankName = result.bankName
			if (result.bankAccount) invoiceForm.value.bankAccount = result.bankAccount
		},
		fail: (error) => {
			if (!String(error && error.errMsg || '').includes('cancel')) {
				uni.showToast({ title: '微信抬头导入失败', icon: 'none' })
			}
		}
	})
}

const selectInvoiceKind = (value) => {
	invoiceForm.value.invoiceType = value
	if (value === '纸质专用发票') invoiceForm.value.titleType = 'company'
}

const selectInvoiceTitleType = (value) => {
	if (isPaperInvoice.value && value !== 'company') {
		uni.showToast({ title: '纸质专票仅支持企业抬头', icon: 'none' })
		return
	}
	invoiceForm.value.titleType = value
}

const copyInvoiceMailNo = (order = {}) => {
	if (!order.invoiceMailNo) return
	copyOne(order.invoiceMailNo, 'invMail-' + order.id)
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

	// 纸质专票：7 个收票/注册字段前端预校验（口径与后端 applyInvoice 一致）
	if (invoiceForm.value.invoiceType === '纸质专用发票') {
		const paperRequired = [
			['registerAddress', '请填写注册地址'],
			['registerPhone', '请填写注册电话'],
			['bankName', '请填写开户银行'],
			['bankAccount', '请填写银行账号'],
			['recipientName', '请填写收票人'],
			['recipientAddress', '请填写收票地址']
		]
		for (const [field, msg] of paperRequired) {
			if (!String(invoiceForm.value[field] || '').trim()) {
				uni.showToast({ title: msg, icon: 'none' })
				return
			}
		}
		const recipientPhone = String(invoiceForm.value.recipientPhone || '').replace(/\D/g, '')
		if (!/^1[3-9]\d{9}$/.test(recipientPhone)) {
			uni.showToast({ title: '收票手机号格式不正确', icon: 'none' })
			return
		}
	}

	invoiceSubmitting.value = true
	try {
		await requestStatusSubscription('invoice_apply')
		await applyInvoice({
			orderId: order.recordId || order.id,
			invoiceType: invoiceForm.value.invoiceType,
			titleType: invoiceForm.value.titleType,
			title: invoiceForm.value.title.trim(),
			taxNo: invoiceForm.value.titleType === 'company' ? invoiceForm.value.taxNo.trim() : '',
			email: invoiceForm.value.email.trim(),
			registerAddress: String(invoiceForm.value.registerAddress || '').trim(),
			registerPhone: String(invoiceForm.value.registerPhone || '').trim(),
			bankName: String(invoiceForm.value.bankName || '').trim(),
			bankAccount: String(invoiceForm.value.bankAccount || '').trim(),
			recipientName: String(invoiceForm.value.recipientName || '').trim(),
			recipientPhone: String(invoiceForm.value.recipientPhone || '').trim(),
			recipientAddress: String(invoiceForm.value.recipientAddress || '').trim(),
			remark: invoiceForm.value.remark.trim()
		})

		// 后端为唯一状态来源：开票申请后回拉工单
		await refreshOrderFromServer(order)
		activeInvoiceOrderId.value = ''
		activeInvoiceTab.value = '待开票'
		uni.showToast({ title: '开票申请已提交', icon: 'success' })
	} catch (error) {
		console.warn('submit invoice failed:', error)
		uni.showToast({ title: toCustomerErrorMessage(error, '开票申请提交失败'), icon: 'none' })
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
	const records = readStorage(feedbackRecordKey, [])
	feedbackRecords.value = Array.isArray(records) ? records : []
	const surveys = readStorage(surveyRecordKey, [])
	surveyRecords.value = Array.isArray(surveys) ? surveys : []
}

const saveFeedbackRecords = () => {
	writeStorage(feedbackRecordKey, feedbackRecords.value)
}

const saveSurveyRecords = () => {
	writeStorage(surveyRecordKey, surveyRecords.value)
}

// 拉取服务端反馈单，覆盖本地缓存，使后台处理状态与官方回复实时同步
const syncFeedbackRecords = async () => {
	try {
		const res = await getComplaintList({ page: 1, pageSize: 10 })
		const list = (res && res.list) || []
		if (!Array.isArray(list)) return
		feedbackRecords.value = list.map(normalizeFeedbackRecord)
		saveFeedbackRecords()
		await resolveFeedbackRecordImageUrls(feedbackRecords.value)
	} catch (error) {
		// 网络/登录异常时保留本地缓存，不打断页面
		console.warn('sync feedback records fallback:', error)
	}
}

const getFeedbackRecordImageUrl = (image = {}) => {
	const item = typeof image === 'string' ? { url: image } : image
	const fileID = getCloudFileId(item)
	return (fileID && feedbackImageTempUrls.value[fileID]) || getPreviewUrl(item)
}

const resolveFeedbackRecordImageUrls = async (records = []) => {
	const fileIDs = [...new Set((Array.isArray(records) ? records : [])
		.flatMap((record = {}) => Array.isArray(record.images) ? record.images : [])
		.map((image) => getCloudFileId(typeof image === 'string' ? { url: image } : image))
		.filter(Boolean))]
	const unresolved = fileIDs.filter((fileID) => !feedbackImageTempUrls.value[fileID])
	if (!unresolved.length) return

	try {
		const result = await getCloudTempFileURL(unresolved)
		const nextUrls = { ...feedbackImageTempUrls.value }
		const fileList = result && Array.isArray(result.fileList) ? result.fileList : []
		for (const item of fileList) {
			const fileID = item.fileID || item.fileId || ''
			const tempFileURL = item.tempFileURL || item.url || ''
			if (fileID && tempFileURL && !isCloudFileId(tempFileURL)) nextUrls[fileID] = tempFileURL
		}
		feedbackImageTempUrls.value = nextUrls
	} catch (error) {
		console.warn('resolve feedback image urls failed:', error)
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
	const urls = (record.images || []).map(getFeedbackRecordImageUrl).filter(Boolean)
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

const loadSurveyConfig = async () => {
	try {
		const config = await getSurveyConfig()
		if (config && typeof config === 'object') {
			surveyConfig.value = {
				...surveyConfig.value,
				...config,
				ratingMax: Math.max(1, Number(config.ratingMax) || surveyConfig.value.ratingMax)
			}
			if (!surveyConfig.value.satisfactionOptions.includes(surveyForm.value.satisfaction)) surveyForm.value.satisfaction = ''
			if (!surveyConfig.value.resolvedOptions.includes(surveyForm.value.resolved)) surveyForm.value.resolved = ''
			if (surveyForm.value.rating > surveyConfig.value.ratingMax) surveyForm.value.rating = 0
		}
	} catch (error) {
		console.warn('load survey config failed:', error)
	}
}

const prefillSurveyContact = () => {
	if (surveyForm.value.contact) return
	const user = currentUser.value || {}
	surveyForm.value.contact = user.phone || user.mobile || user.wechat || ''
}

const resetSurveyForm = (silent = false) => {
	surveyForm.value = {
		orderNo: '',
		satisfaction: '',
		rating: 0,
		resolved: '',
		comment: '',
		contact: ''
	}
	if (!silent) uni.showToast({ title: '已重置调研表', icon: 'none' })
}

const saveLocalSurveyRecord = (record) => {
	surveyRecords.value = [record, ...surveyRecords.value].slice(0, 20)
	saveSurveyRecords()
}

const submitSurveyForm = async () => {
	if (surveySubmitting.value) return
	const form = surveyForm.value
	if (surveyConfig.value.enabled === false) {
		uni.showToast({ title: '调研表暂未启用', icon: 'none' })
		return
	}
	if (!form.satisfaction || !form.resolved || !form.rating) {
		uni.showToast({ title: '请完成必填选项', icon: 'none' })
		return
	}
	if (!form.comment.trim()) {
		uni.showToast({ title: '请填写调研反馈', icon: 'none' })
		return
	}
	if (!form.contact.trim()) {
		uni.showToast({ title: '请填写联系方式', icon: 'none' })
		return
	}

	surveySubmitting.value = true
	const record = {
		id: `SUR-${Date.now()}`,
		orderNo: form.orderNo.trim(),
		satisfaction: form.satisfaction,
		rating: form.rating,
		resolved: form.resolved,
		comment: form.comment.trim(),
		contact: form.contact.trim(),
		time: todayText()
	}
	try {
		const res = await submitAfterSalesSurvey(record)
		saveLocalSurveyRecord({ ...record, cloudId: res && res.id, status: 'submitted' })
		uni.showToast({ title: '调研已提交', icon: 'success' })
		resetSurveyForm(true)
	} catch (error) {
		saveLocalSurveyRecord({ ...record, status: 'local_fallback' })
		uni.showToast({ title: '提交失败，请稍后重试', icon: 'none' })
	} finally {
		surveySubmitting.value = false
	}
}

const openModule = (id, type) => {
	if (id === 'address') {
		openAddressPage()
		return
	}
	if (id === 'repair' && !hasLoginToken()) {
		previousModule.value = activeModule.value
		activeModule.value = id
		showQr.value = false
		repairStep.value = 1
		prefillRepairAddress()
		loadRepairProductOptions()
		beginRepairLogin()
		return
	}

	previousModule.value = activeModule.value
	activeModule.value = id
	showQr.value = false

	if (policyDocKeys.has(id)) {
		refreshPolicyDocument(id).catch((error) => console.warn(`${id} policy refresh failed:`, error))
	}

	if (id === 'invoices') {
		activeInvoiceOrderId.value = ''
		activeInvoiceTab.value = '待开票'
	}

	if (id === 'feedback') {
		syncFeedbackRecords()
	}

	if (id === 'survey') {
		restoreLocalBusinessState()
		loadSurveyConfig()
		prefillSurveyContact()
	}

	if (id === 'diag') {
		refreshFaultTypes({ forceRefresh: true })
	}

	if (id === 'repair') {
		repairStep.value = 1
		prefillRepairAddress()
		loadRepairProductOptions()
	}

	if (id === 'orders' && type !== undefined) {
		// 数字索引协议（pages-sub/mine 跳转用），只能尾部追加不能插入
		const typeMap = ['全部', '待处理', '处理中', '已回寄', '未开票', '已开票', '待付款']
		if (typeof type === 'string') {
			activeOrdersTab.value = normalizeStatusTab(type)
		} else if (typeMap[type]) {
			activeOrdersTab.value = typeMap[type]
		}
	}

}

const closeModule = () => {
	if (activeModule.value === 'login' && previousModule.value === 'repair' && repairLoginPending.value) {
		activeModule.value = 'repair'
		previousModule.value = ''
		repairLoginPending.value = false
		clearRepairLoginReturn()
		restoreRepairDraft()
		return
	}
	if (activeModule.value === 'order-detail' && (previousModule.value === 'track' || previousModule.value === 'orders' || previousModule.value === 'invoices')) {
		activeModule.value = previousModule.value
		previousModule.value = ''
		return
	}
	activeModule.value = ''
	previousModule.value = ''
}

const returnFromModule = () => {
	if (diagOpen.value) {
		diagOpen.value = ''
		return true
	}
	closeModule()
	return true
}

const openTrackDetail = (order) => {
	orderDetailOrder.value = ''
	trackDetailOrder.value = order.id
	openModule('order-detail')
}

const openOrderDetail = (order) => {
	trackDetailOrder.value = ''
	orderDetailOrder.value = order.id
	openModule('order-detail')
	if (hasLoginToken()) refreshOrderFromServer(order).catch((error) => console.warn('refresh detail on open failed:', error))
	// 打开详情时刷新该工单的投诉/反馈状态与客服回复
	if (hasLoginToken()) syncFeedbackRecords().catch((error) => console.warn('sync feedback on detail failed:', error))
}

// 报修表单：自动带入默认寄出和回寄地址（仅填空字段，不覆盖用户已填）
const cachedDefaultAddress = ref(null)
const prefillRepairAddress = async () => {
	if (!hasLoginToken()) return
	const form = repairForm.value
	if ((form.senderName || form.senderPhone || form.senderAddress) && (form.receiverName || form.receiverPhone || form.receiverAddress)) return
	try {
		if (!cachedDefaultAddress.value) {
			const list = await getAddressList()
			if (Array.isArray(list) && list.length) {
				cachedDefaultAddress.value = list.find((item) => item.isDefault) || list[0]
			}
		}
		const target = cachedDefaultAddress.value
		if (!target) return
		// 二次确认表单仍为空再写入（避免异步期间用户已开始填写）
		const current = repairForm.value
		const region = Array.isArray(target.region) ? target.region.join(' ') : (target.region || '')
		const fullAddress = [region, target.detail || ''].filter(Boolean).join(' ').trim()
		repairForm.value = {
			...current,
			senderName: current.senderName || target.receiver || target.name || '',
			senderPhone: current.senderPhone || target.phone || '',
			senderAddress: current.senderAddress || fullAddress,
			receiverName: current.receiverName || target.receiver || target.name || '',
			receiverPhone: current.receiverPhone || target.phone || '',
			receiverAddress: current.receiverAddress || fullAddress,
			receiverUnit: current.receiverUnit || target.unit || ''
		}
	} catch (error) {
		console.warn('prefill repair address failed:', error)
	}
}

const savedAddressText = (item = {}) => {
	const region = Array.isArray(item.region) ? item.region.join(' ') : (item.region || '')
	return [region, item.detail || ''].filter(Boolean).join(' ').trim()
}

const openSavedAddressPicker = async (target) => {
	if (!hasLoginToken()) {
		beginRepairLogin({ prompt: false })
		uni.showToast({ title: '请先登录后选择常用地址', icon: 'none' })
		return
	}
	savedAddressTarget.value = target
	try {
		const list = await getAddressList()
		savedAddressOptions.value = Array.isArray(list) ? list : []
		if (!savedAddressOptions.value.length) {
			uni.showToast({ title: '暂无常用地址，请先新增', icon: 'none' })
			openAddressPage()
			return
		}
		showSavedAddressPicker.value = true
	} catch (error) {
		uni.showToast({ title: toCustomerErrorMessage(error, '地址加载失败'), icon: 'none' })
	}
}

const selectSavedAddress = (item = {}) => {
	const name = item.receiver || item.name || ''
	const phone = item.phone || ''
	const address = savedAddressText(item)
	if (savedAddressTarget.value === 'receiver') {
		repairForm.value.receiverName = name
		repairForm.value.receiverPhone = phone
		repairForm.value.receiverAddress = address
		repairForm.value.receiverUnit = item.unit || repairForm.value.receiverUnit
	} else {
		repairForm.value.senderName = name
		repairForm.value.senderPhone = phone
		repairForm.value.senderAddress = address
	}
	showSavedAddressPicker.value = false
}

const addSavedAddress = () => {
	showSavedAddressPicker.value = false
	openAddressPage()
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

	return products.map((item, index) => {
		const isCustomName = item.isCustomName === undefined
			? Boolean(item.name && !findRepairProductOption(item))
			: Boolean(item.isCustomName)
		const isCustomModel = item.isCustomModel === undefined
			? Boolean(item.model && !isConfiguredRepairProductModel(item, item.model))
			: Boolean(item.isCustomModel)
		const customModel = String(item.customModel || (isCustomModel ? item.model : '') || '')
		return {
			id: Number(item.id) || index + 1,
			productId: item.productId || item.product_id || '',
			isCustomName,
			isCustomModel,
			customModel,
			modelPickerOptions: repairProductModelPickerOptions(item),
			name: item.name || '',
			category: item.category || '',
			model: isCustomModel ? customModel : (item.model || ''),
			serial: item.serial || '',
			buyDate: item.buyDate || '',
			voucher: item.voucher || '',
			voucherList: Array.isArray(item.voucherList) ? item.voucherList : [],
			faultDesc: item.faultDesc || '',
			media: Array.isArray(item.media) ? item.media : []
		}
	})
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
		trackingLater.value = Boolean(draft.trackingLater)
		syncRepairSeeds()
	} catch (error) {
		console.warn('restore repair draft fallback:', error)
	}
}

const persistRepairDraft = () => {
	try {
		uni.setStorageSync(repairDraftKey, {
			repairForm: repairForm.value,
			repairProducts: repairProducts.value,
			trackingLater: trackingLater.value,
			updateTime: Date.now()
		})
		return true
	} catch (error) {
		console.warn('persist repair draft fallback:', error)
		return false
	}
}

const readRepairLoginReturn = () => {
	try {
		const value = uni.getStorageSync(repairLoginReturnKey)
		const timestamp = Number(value && value.time)
		if (!timestamp) {
			if (value) uni.removeStorageSync(repairLoginReturnKey)
			return false
		}
		if (timestamp && Date.now() - timestamp > 30 * 60 * 1000) {
			uni.removeStorageSync(repairLoginReturnKey)
			return false
		}
		return Boolean(value)
	} catch (error) {
		console.warn('read repair login return fallback:', error)
		return false
	}
}

const markRepairLoginReturn = () => {
	try {
		uni.setStorageSync(repairLoginReturnKey, { time: Date.now() })
	} catch (error) {
		console.warn('persist repair login return fallback:', error)
	}
}

const clearRepairLoginReturn = () => {
	try {
		uni.removeStorageSync(repairLoginReturnKey)
	} catch (error) {
		console.warn('clear repair login return fallback:', error)
	}
}

const beginRepairLogin = ({ prompt = true } = {}) => {
	if (repairLoginPending.value) return
	repairLoginPending.value = true
	persistRepairDraft()
	markRepairLoginReturn()
	if (!prompt) {
		openModule('login')
		return
	}
	try {
		uni.showModal({
			title: '请先登录',
			content: '进入立即报修前，请先完成微信登录。',
			confirmText: '去登录',
			cancelText: '取消',
			success: ({ confirm }) => {
				if (confirm) {
					openModule('login')
					return
				}
				repairLoginPending.value = false
				clearRepairLoginReturn()
			},
			fail: (error) => {
				console.warn('show repair login prompt failed:', error)
				openModule('login')
			}
		})
	} catch (error) {
		console.warn('show repair login prompt failed:', error)
		openModule('login')
	}
}

const saveRepairDraft = () => {
	if (persistRepairDraft()) {
		showRepairTools.value = false
		uni.showToast({ title: '草稿已保存', icon: 'success' })
	} else {
		uni.showToast({ title: '保存失败', icon: 'none' })
	}
}

const repairNoteValue = (value) => String(value || '').trim() || '未填写'

const buildRepairNoteTemplate = () => {
	const form = repairForm.value || {}
	const contactName = form.senderName || form.receiverName
	const contactPhone = form.senderPhone || form.receiverPhone
	const products = (repairProducts.value || []).map((product, index) => {
		const name = repairNoteValue(product.name || product.category)
		const model = repairNoteValue(getRepairProductModelValue(product))
		const serial = repairNoteValue(product.serial)
		const fault = repairNoteValue(product.faultDesc)
		return [
			`${index + 1}. 产品：${name}`,
			`   型号：${model}`,
			`   SN：${serial}`,
			`   故障：${fault}`
		].join('\n')
	})

	return [
		'思科达售后寄修纸条',
		`用户类型：${customerTypeLabel(form.customerType) || '未填写'}`,
		`联系人：${repairNoteValue(contactName)}`,
		`联系电话：${repairNoteValue(contactPhone)}`,
		`回寄地址：${repairNoteValue(form.receiverAddress)}`,
		`单位名称：${repairNoteValue(form.receiverUnit)}`,
		`寄出物流：${repairNoteValue(form.logisticsCompany)}`,
		`运单号：${trackingLater.value ? '稍后补填' : repairNoteValue(form.trackingNo)}`,
		'',
		'设备与故障：',
		products.length ? products.join('\n\n') : '未填写',
		'',
		'请维修前先联系确认检测结果和报价。'
	].join('\n')
}

const copyRepairNoteTemplate = () => {
	showRepairTools.value = false
	writeClipboard(buildRepairNoteTemplate(), 'repairNote')
}

const clearRepairForm = (notify = true) => {
	repairForm.value = defaultRepairForm()
	trackingLater.value = false
	repairProducts.value = [defaultRepairProduct()]
	repairSectionOpen.value = { user: true, products: true, sender: true, receiver: true }
	repairProductSeed = 1
	repairMediaSeed = 1
	uni.removeStorageSync(repairDraftKey)
	showRepairTools.value = false
	if (notify) uni.showToast({ title: '已清空', icon: 'none' })
}

const startNewRepair = () => {
	clearRepairForm(false)
	submittedOrderId.value = ''
	submittedRepairSummary.value = { logisticsCompany: '', trackingNo: '', trackingPending: false }
	openModule('repair')
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
		const chooseRes = await chooseImageWithPrivacy({
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
		}
	} catch (error) {
		if (!isPickerCancel(error)) {
			console.warn('choose feedback image failed:', error)
			uni.showToast({ title: isWechatPrivacyError(error) ? getWechatPrivacyPickerMessage(error) : '图片选择失败', icon: 'none' })
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
		const chooseRes = await chooseImageWithPrivacy({
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
		}
	} catch (error) {
		if (isPickerCancel(error)) return
		console.warn('upload image fallback:', error)
		uni.showToast({ title: isWechatPrivacyError(error) ? getWechatPrivacyPickerMessage(error) : '图片选择失败', icon: 'none' })
	} finally {
		if (loadingShown) uni.hideLoading()
	}
}

const getVideoCoverPath = (path = '') => new Promise((resolve) => {
	if (!path || typeof uni.getVideoInfo !== 'function') {
		resolve('')
		return
	}
	try {
		uni.getVideoInfo({
			src: path,
			success: (result = {}) => resolve(result.thumbTempFilePath || result.thumbPath || ''),
			fail: () => resolve('')
		})
	} catch (error) {
		resolve('')
	}
})

const uploadRepairVideo = async (index) => {
	const product = repairProducts.value[index]
	if (!product || product.media.length >= 3) return

	let loadingShown = false
	try {
		const chooseRes = await chooseVideoWithPrivacy({
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
		const coverPath = chooseRes.thumbTempFilePath || await getVideoCoverPath(chooseRes.tempFilePath)
		const uploadRes = await uploadVideo(chooseRes.tempFilePath)
		repairMediaSeed += 1
		product.media.push({
			id: `vid-${repairMediaSeed}`,
			type: 'video',
			path: chooseRes.tempFilePath,
			coverPath,
			fileID: normalizeUploadFileId(uploadRes),
			url: normalizeUploadUrl(uploadRes, chooseRes.tempFilePath),
			duration: chooseRes.duration,
			size: chooseRes.size
		})
		uni.hideLoading()
		loadingShown = false
	} catch (error) {
		if (isPickerCancel(error)) return
		console.warn('upload video fallback:', error)
		uni.showToast({ title: isWechatPrivacyError(error) ? getWechatPrivacyPickerMessage(error) : '视频上传失败', icon: 'none' })
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
		customerType: repairForm.value.customerType,
		status: 'submitted',
		statusText: '已提交',
		customerType: repairForm.value.customerType,
		customer_type: repairForm.value.customerType,
		productId: product.productId || '',
		productName: (product.name || getRepairProductModelValue(product) || '维修产品').trim(),
		productModel: getRepairProductModelValue(product),
		productSerial: String(product.serial || '').trim(),
		faultType: product.faultType || product.faultDesc || '待检测',
		faultDesc: String(product.faultDesc || '').trim(),
		images: firstMedia.images,
		videos: firstMedia.videos,
		logisticsCompany: repairForm.value.logisticsCompany,
		trackingNo,
		trackingPending: Boolean(trackingLater.value && !trackingNo),
		sendMethod: repairForm.value.sendMethod,
		senderName: String(repairForm.value.senderName || '').trim(),
		senderPhone: normalizePhone(repairForm.value.senderPhone),
		senderAddress: String(repairForm.value.senderAddress || '').trim(),
		receiverName: String(repairForm.value.receiverName || '').trim(),
		receiverPhone,
		receiverAddress: String(repairForm.value.receiverAddress || '').trim(),
		receiverUnit: String(repairForm.value.receiverUnit || '').trim(),
		products: repairProducts.value.map((item) => {
			const media = splitRepairMedia(item.media)
			const voucherUrls = (item.voucherList || []).map(getUploadedUrl).filter(Boolean)
			return {
				productId: item.productId || '',
				product_id: item.productId || '',
				productName: (item.name || getRepairProductModelValue(item) || '维修产品').trim(),
				productCategory: String(item.category || '').trim(),
				productModel: getRepairProductModelValue(item),
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
			if (!String(products[i].name || '').trim()) {
				uni.showToast({
					title: isOtherRepairProduct(products[i])
						? `第 ${i + 1} 个产品请填写其他产品名称`
						: `第 ${i + 1} 个产品请选择产品名称`,
					icon: 'none'
				})
				return false
			}
			if (!getRepairProductModelValue(products[i])) {
				uni.showToast({
					title: isOtherRepairModel(products[i])
						? `第 ${i + 1} 个产品请填写自定义产品型号`
						: `第 ${i + 1} 个产品请填写产品型号`,
					icon: 'none'
				})
				return false
			}
			if (!String(products[i].serial || '').trim()) {
				uni.showToast({ title: `第 ${i + 1} 个产品请填写序列号`, icon: 'none' })
				return false
			}
			if (cleanSn(products[i].serial).length > 80) {
				uni.showToast({ title: `第 ${i + 1} 个产品序列号不能超过80个字符`, icon: 'none' })
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
	const map = { in_warranty: '在保', extended: '延保中', expired: '已过保', unknown: '保修未知' }
	return map[info.warrantyStatus] || '保修未知'
}

// SN 清洗：去除空格/换行/制表符与首尾空白，保留横杠/字母数字（后端再做规范化匹配）
const cleanSn = (raw) => String(raw == null ? '' : raw).replace(/[\s　]+/g, '').trim()
const getSnValidationMessage = (product = {}) => cleanSn(product.serial).length > 80 ? '产品序列号不能超过80个字符' : ''

// 防抖定时器（按产品下标）与最近一次扫码时间戳（节流）
const snQueryTimers = {}
let lastScanAt = 0

// 报修页 SN 查询：失焦/点【查询】触发，带防抖；force=true 时立即查询（点击查询按钮）
const recognizeSn = (index, force = false) => {
	const product = repairProducts.value[index]
	if (!product) return
	// 清洗并回填输入框
	const sn = cleanSn(product.serial)
	if (sn !== product.serial) product.serial = sn
	if (snQueryTimers[index]) { clearTimeout(snQueryTimers[index]); snQueryTimers[index] = null }
	if (!sn) { product.snInfo = null; return }
	if (sn.length > 80) { product.snInfo = null; return }
	const run = () => doRecognizeSn(index, sn)
	if (force) run()
	else snQueryTimers[index] = setTimeout(run, 500)
}

const doRecognizeSn = async (index, sn) => {
	const product = repairProducts.value[index]
	if (!product) return
	if (!hasLoginToken()) return
	if (product.snLoading) return
	// 同一 SN 已有结果则不重复请求（节流）
	if (product.snInfo && product.snInfo.sn === sn) return
	product.snLoading = true
	let info = null
	try {
		info = await lookupDeviceBySn(sn)
		product.snInfo = info || { found: false, sn }
		if (info && info.found) {
			if (info.productCategory && !String(product.category || '').trim()) product.category = info.productCategory
			if (info.productName && !product.isCustomName && !String(product.name || '').trim()) {
				product.name = info.productName
				product.isCustomName = false
				syncRepairProductModelPickerOptions(product)
			}
			if (info.model && !product.isCustomModel && !String(product.model || '').trim()) {
				product.model = info.model
				product.isCustomModel = !isConfiguredRepairProductModel(product, info.model)
				product.customModel = product.isCustomModel ? info.model : ''
			}
			if (info.buyDate && !product.buyDate) product.buyDate = info.buyDate
		} else {
			handleSnNotFound(index)
		}
	} catch (error) {
		console.warn('lookup sn failed:', error)
		product.snInfo = null
	} finally {
		product.snLoading = false
	}
	// 埋点：手动查询（fire-and-forget）
	logSnAction('sn_query', sn, {
		matched: Boolean(info && info.found),
		warranty_status: (info && info.warrantyStatus) || '',
		device_id: (info && info.deviceId) || ''
	})
}

// 未匹配到已登记设备：仅行内提示「首次报修可手动填写，提交后会自动登记」，
// 不再弹窗打断，也不清空用户已手填的分类/型号/购买日期。
const handleSnNotFound = (_index) => {}

// 历史维修工单跳转：列出该 SN 的历史工单，选择后进入工单详情
const openSnHistory = (index) => {
	const product = repairProducts.value[index]
	const history = (product && product.snInfo && product.snInfo.history) || []
	if (!history.length) return
	const snStatusMap = { pending: '待处理', sent: '已寄出', received: '已签收', inspecting: '检测中', fixing: '维修中', shipped: '已回寄', completed: '已完成', cancelled: '已取消' }
	const itemList = history.map((h) => `${h.orderNo || '工单'}（${snStatusMap[h.status] || h.status || '处理中'}）`)
	uni.showActionSheet({
		itemList,
		success: ({ tapIndex }) => {
			const target = history[tapIndex]
			if (target && target.id) openHistoryOrder(target.id)
			else uni.showToast({ title: '该工单暂无法打开', icon: 'none' })
		},
		fail: () => {}
	})
}

// 按工单 _id 拉取详情并打开：历史工单可能不在已加载列表中，故先拉取规范化后并入列表，
// 再以规范化 id（order_no 优先）打开，避免 detailOrder 因 _id/order_no 键不一致而空白。
const openHistoryOrder = async (orderId) => {
	try {
		uni.showLoading({ title: '加载中' })
		const detail = await getRepairDetail(orderId)
		const normalized = normalizeOrder(detail)
		await resolvePaymentProofUrls([normalized])
		uni.hideLoading()
		if (!normalized.id) { uni.showToast({ title: '工单暂无法打开', icon: 'none' }); return }
		const exists = orderList.value.some((o) => o.id === normalized.id)
		orderList.value = exists
			? orderList.value.map((o) => (o.id === normalized.id ? { ...o, ...normalized } : o))
			: [normalized, ...orderList.value]
		openOrderDetail({ id: normalized.id })
	} catch (error) {
		uni.hideLoading()
		uni.showToast({ title: toCustomerErrorMessage(error, '工单加载失败'), icon: 'none' })
	}
}

const scanSn = async (index) => {
	const now = Date.now()
	if (now - lastScanAt < 800) return // 连续扫码节流
	if (!(await ensureWechatPrivacyForAction())) return
	lastScanAt = now
	uni.scanCode({
		scanType: ['barCode', 'qrCode'],
		success: (res) => {
			const code = cleanSn(res && res.result)
			if (!code) {
				uni.showToast({ title: '未识别到 SN', icon: 'none' })
				return
			}
			const product = repairProducts.value[index]
			if (!product) return
			product.serial = code
			logSnAction('sn_scan', code) // 埋点：扫码
			recognizeSn(index, true) // 扫码成功自动查询，无需二次点击
		},
		fail: (error) => {
			if (!String(error && error.errMsg || '').includes('cancel')) {
				uni.showToast({ title: '扫码失败', icon: 'none' })
			}
		}
	})
}

const validateRepairForm = () => {
	if (!customerTypeOptions.some((item) => item.value === repairForm.value.customerType)) {
		openRepairSection('user')
		uni.showToast({ title: '请选择用户类型', icon: 'none' })
		return false
	}
	for (let index = 0; index < repairProducts.value.length; index += 1) {
		const product = repairProducts.value[index] || {}
		const label = `第 ${index + 1} 个产品`
		if (!String(product.name || '').trim()) {
			openRepairSection('products')
			uni.showToast({ title: isOtherRepairProduct(product) ? `${label}请填写其他产品名称` : `${label}请选择产品名称`, icon: 'none' })
			return false
		}
		if (!getRepairProductModelValue(product)) {
			openRepairSection('products')
			uni.showToast({ title: isOtherRepairModel(product) ? `${label}请填写自定义产品型号` : `${label}请填写产品型号`, icon: 'none' })
			return false
		}
		if (!String(product.serial || '').trim()) {
			openRepairSection('products')
			uni.showToast({ title: `${label}请填写序列号`, icon: 'none' })
			return false
		}
		if (cleanSn(product.serial).length > 80) {
			openRepairSection('products')
			uni.showToast({ title: `${label}序列号不能超过80个字符`, icon: 'none' })
			return false
		}
		if (!String(product.faultDesc || '').trim()) {
			openRepairSection('products')
			uni.showToast({ title: `${label}请填写故障描述`, icon: 'none' })
			return false
		}
	}

	if (!String(repairForm.value.senderName || '').trim()) {
		openRepairSection('sender')
		uni.showToast({ title: '请填写寄件人', icon: 'none' })
		return false
	}

	if (!isValidPhone(repairForm.value.senderPhone)) {
		openRepairSection('sender')
		uni.showToast({ title: '请输入正确的寄件人手机号', icon: 'none' })
		return false
	}

	if (!String(repairForm.value.senderAddress || '').trim()) {
		openRepairSection('sender')
		uni.showToast({ title: '请填写寄出地址', icon: 'none' })
		return false
	}

	if (!repairForm.value.logisticsCompany) {
		openRepairSection('sender')
		uni.showToast({ title: '请选择物流公司', icon: 'none' })
		return false
	}

	const trimmedTracking = String(repairForm.value.trackingNo || '').trim()
	if (!trackingLater.value && !trimmedTracking) {
		openRepairSection('sender')
		uni.showToast({ title: '请填写运单号，或选择「稍后补单号」', icon: 'none' })
		return false
	}
	if (trimmedTracking && !isValidTrackingNo(trimmedTracking)) {
		openRepairSection('sender')
		uni.showToast({ title: '请输入正确运单号', icon: 'none' })
		return false
	}

	if (!String(repairForm.value.receiverName || '').trim()) {
		openRepairSection('receiver')
		uni.showToast({ title: '请填写收货人', icon: 'none' })
		return false
	}

	if (!isValidPhone(repairForm.value.receiverPhone)) {
		openRepairSection('receiver')
		uni.showToast({ title: '请输入正确手机号', icon: 'none' })
		return false
	}

	if (!String(repairForm.value.receiverAddress || '').trim()) {
		openRepairSection('receiver')
		uni.showToast({ title: '请填写详细地址', icon: 'none' })
		return false
	}

	if (!String(repairForm.value.receiverUnit || '').trim()) {
		openRepairSection('receiver')
		uni.showToast({ title: '请填写单位名称', icon: 'none' })
		return false
	}

	repairForm.value.trackingNo = normalizeTrackingNo(repairForm.value.trackingNo)
	repairForm.value.senderPhone = normalizePhone(repairForm.value.senderPhone)
	repairForm.value.receiverPhone = normalizePhone(repairForm.value.receiverPhone)
	return true
}

const submitRepair = async () => {
	if (repairSubmitting.value) return
	if (!hasLoginToken()) {
		beginRepairLogin({ prompt: false })
		uni.showToast({ title: '请先登录后再提交报修', icon: 'none' })
		return
	}
	if (!validateRepairForm()) return

	repairSubmitting.value = true
	try {
		await requestStatusSubscription('repair_submit')
		const payload = buildRepairPayload()
		const res = await submitRepairOrder(payload)
		const resData = (res && res.data) ? res.data : (res || {})
		submittedOrderId.value = resData.order_no || resData.orderNo || resData.orderId || resData.id || ''
		submittedRepairSummary.value = {
			logisticsCompany: payload.logisticsCompany,
			trackingNo: payload.trackingNo,
			trackingPending: payload.trackingPending
		}
		uni.removeStorageSync(repairDraftKey)
		openModule('repair-success')
		loadRemoteContent()
	} catch (error) {
		if (isAuthError(error)) {
			logoutLocal()
			beginRepairLogin({ prompt: false })
			uni.showToast({ title: '登录已失效，请重新登录', icon: 'none' })
			return
		}
		console.warn('submit repair failed:', error)
		const draftSaved = persistRepairDraft()
		uni.showToast({ title: toCustomerErrorMessage(error, draftSaved ? '提交失败，已保留草稿' : '提交失败，请重试'), icon: 'none' })
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
		uni.showToast({ title: '该产品暂未提供故障现象选项，可联系售后协助判断', icon: 'none' })
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
	diagErrorText.value = ''
	if (diagLoading.value && localRecord) return
	diagLoading.value = true

	try {
		const result = await searchFault({
			productType: diagProduct.value,
			faultTypeId: localRecord ? (localRecord.faultTypeId || localRecord.id || '') : '',
			faultName: diagFault.value,
			forceRefresh: true
		})
		diagResult.value = result || localRecord || null
		if (!diagResult.value) diagErrorText.value = '暂未找到对应自查方案，请联系售后协助判断。'
	} catch (error) {
		console.warn('fault search fallback:', error)
		diagErrorText.value = localRecord
			? '最新方案同步失败，当前显示上一次数据。'
			: '故障方案加载失败，请稍后重试。'
	} finally {
		diagLoading.value = false
	}
}

const selectDiagOption = (item = {}) => {
	if (!item.id || !item.title || !diagSheetOptions.value.some((option) => option.id === item.id)) {
		uni.showToast({ title: '选项无效，请重新选择', icon: 'none' })
		return
	}
	diagErrorText.value = ''
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
	diagErrorText.value = ''
}

const startRepairFromDiag = () => {
	const productLabel = diagProductLabel.value
	const faultLabel = diagFault.value
	const recommendText = diagRecommendRepair.value ? '（知识库建议报修）' : ''
	const faultSummary = '故障自查：' + productLabel + ' / ' + faultLabel + recommendText
	let product = repairProducts.value.find(item => !String(item.faultDesc || '').trim())

	if (!product) {
		repairProductSeed += 1
		product = defaultRepairProduct(repairProductSeed)
		repairProducts.value.push(product)
	}

	if (!String(product.category || '').trim()) product.category = productLabel
	const currentFaultDesc = String(product.faultDesc || '').trim()
	if (!currentFaultDesc) {
		product.faultDesc = faultSummary
	} else if (!currentFaultDesc.includes(faultLabel)) {
		product.faultDesc = currentFaultDesc + '\n' + faultSummary
	}

	repairSectionOpen.value.products = true
	openModule('repair')
	uni.showToast({ title: '已带入故障自查信息', icon: 'none' })
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

const openVoucherPicker = async (productIndex) => {
	const product = repairProducts.value[productIndex]
	if (!product) return
	
	if (!product.voucherList) {
		product.voucherList = []
	}
	
	if (product.voucherList.length >= 3) {
		uni.showToast({ title: '最多上传3张凭证', icon: 'none' })
		return
	}
	
	try {
		const chooseRes = await chooseImageWithPrivacy({
			count: 3 - product.voucherList.length,
			sourceType: ['album', 'camera'],
			sizeType: ['compressed']
		})
		const tempFilePaths = chooseRes.tempFilePaths || []
		if (!tempFilePaths.length) return
		const oversized = (chooseRes.tempFiles || []).find((file) => isFileTooLarge(file, maxRepairImageSize))
		if (oversized) {
			uni.showToast({ title: `凭证图片不能超过${formatFileSize(maxRepairImageSize)}`, icon: 'none' })
			return
		}

		let loadingShown = false
		try {
			uni.showLoading({ title: '上传中' })
			loadingShown = true

			const slots = Math.max(0, 3 - product.voucherList.length)
			const targets = tempFilePaths.slice(0, slots)
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
					console.warn('upload voucher image failed:', error)
					return null
				}
			}))

			let failedCount = 0
			for (const item of results) {
				if (product.voucherList.length >= 3) break
				if (item) {
					product.voucherList.push({ id: `voucher-${Date.now()}-${Math.random()}`, ...item })
				} else {
					failedCount += 1
				}
			}
			product.voucher = product.voucherList.map((v) => getUploadedUrl(v)).filter(Boolean).join(',')

			uni.hideLoading()
			loadingShown = false
			if (failedCount && failedCount === targets.length) {
				uni.showToast({ title: '凭证上传失败', icon: 'none' })
			} else if (failedCount) {
				uni.showToast({ title: '部分凭证上传失败', icon: 'none' })
			}
		} catch (error) {
			console.warn('voucher upload fallback:', error)
			uni.showToast({ title: '凭证上传失败', icon: 'none' })
		} finally {
			if (loadingShown) uni.hideLoading()
		}
	} catch (error) {
		if (!isPickerCancel(error)) {
			console.warn('choose voucher image failed:', error)
			uni.showToast({ title: isWechatPrivacyError(error) ? getWechatPrivacyPickerMessage(error) : '图片选择失败', icon: 'none' })
		}
	}
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
			title: toCustomerErrorMessage(error, '保存地址失败，请重试'),
			icon: 'none'
		})
	}
}

const regionPickerValue = computed(() => {
	const parts = String(addressForm.value.region || '').split(/[\/\s]+/).filter(Boolean)
	return parts.length === 3 ? parts : ['广东省', '佛山市', '禅城区']
})

const onRegionChange = (event) => {
	const parts = (event.detail.value || []).filter(Boolean)
	addressForm.value.region = parts.join('/')
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
		title: '删除地址',
		content: '删除后无法恢复。',
		confirmText: '删除',
		confirmColor: '#EF4444',
		success: async (res) => {
			if (res.confirm) {
				try {
					await deleteAddress(addressForm.value.addressId)
					resetAddressForm()
					uni.showToast({ title: '已删除', icon: 'success' })
					setTimeout(() => {
						closeModule()
					}, 500)
				} catch (error) {
					console.warn('delete address fallback:', error)
					uni.showToast({ title: '删除失败', icon: 'none' })
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
			title: '反馈已提交',
			content: `反馈单号：${record.ticketNo}`,
			showCancel: false,
			confirmText: '关闭'
		})
		resetFeedbackForm()
		syncFeedbackRecords()
	} catch (error) {
		console.warn('submit feedback failed:', error)
		if (isAuthError(error)) {
			logoutLocal()
			openModule('login')
			uni.showToast({ title: '登录已失效，请重新登录', icon: 'none' })
		} else {
			uni.showToast({ title: toCustomerErrorMessage(error, '提交失败'), icon: 'none' })
		}
	} finally {
		feedbackSubmitting.value = false
	}
}

// 微信一键登录：仅通过 wx.login code 换取 openid 作为账号身份，不再获取手机号。
const doWechatLogin = async ({ automatic = false } = {}) => {
	if (loginSubmitting.value) return
	if (!pcLoginGuard.beginAttempt({ automatic })) return
	loginRetrying.value = false
	loginSubmitting.value = true

	try {
		const res = await loginWithWechatOpenid(wechatLogin, {
			retries: 1,
			onRetry: () => {
				loginRetrying.value = true
			}
		})
		if (applyLoginSession(res)) {
			uni.showToast({ title: res.offline ? '体验登录成功' : '登录成功', icon: 'success' })
		}
	} catch (error) {
		console.warn('wechat login failed:', error)
		if (isLoginCancelledError(error)) return
		if (pcLoginGuard.handleRateLimit(error, automatic ? undefined : () => doWechatLogin({ automatic: true }))) {
			uni.showToast({
				title: automatic ? getLoginErrorMessage(error) : '操作过于频繁，15秒后自动重试',
				icon: 'none'
			})
			return
		}
		const message = getLoginErrorMessage(error)
		if (message) uni.showToast({ title: message, icon: 'none' })
	} finally {
		loginSubmitting.value = false
		loginRetrying.value = false
	}
}

const syncLoginPrivacyReady = () => {
	loginPrivacyReady.value = true
}

const toggleLoginAgreement = async () => {
	const nextValue = !loginAgreementChecked.value
	loginAgreementChecked.value = nextValue
}

const onLoginButtonTap = () => {
	if (!loginAgreementChecked.value) {
		onLoginDisabledTap()
		return
	}
	doWechatLogin()
}

const onLoginDisabledTap = () => {
	uni.showToast({ title: '请勾选同意《用户协议》和《隐私政策》后再登录', icon: 'none' })
}

const openLoginPolicy = (type) => {
	uni.navigateTo({ url: `/pages-sub/legal/index?type=${type === 'privacy' ? 'privacy' : 'user'}` })
}

const ensureWechatPrivacyForAction = async () => {
	try {
		if (await getWechatPrivacyReady()) return true
		try {
			await requestWechatPrivacyAuthorization()
			return true
		} catch (error) {
			console.warn('wechat privacy authorization before upload failed:', error)
			return await requestManualPrivacyConsent()
		}
	} catch (error) {
		console.warn('manual privacy authorization before upload failed:', error)
		uni.showToast({ title: '请先同意隐私授权后再使用该功能', icon: 'none' })
		return false
	}
}

let uploadPrivacyResolve = null

const requestManualPrivacyConsent = async () => {
	if (!uploadPrivacyHtml.value) {
		getCompliance()
			.then((data = {}) => {
				uploadPrivacyHtml.value = data.privacyPolicy || ''
			})
			.catch((error) => console.warn('load privacy policy before upload failed:', error))
	}
	uploadPrivacyVisible.value = true
	return new Promise((resolve) => {
		uploadPrivacyResolve = resolve
	})
}

const confirmUploadPrivacy = () => {
	if (!uploadPrivacyVisible.value) return
	markWechatPrivacyReady()
	uploadPrivacyVisible.value = false
	if (typeof uploadPrivacyResolve === 'function') {
		uploadPrivacyResolve(true)
		uploadPrivacyResolve = null
	}
}

const rejectUploadPrivacy = () => {
	uploadPrivacyVisible.value = false
	if (typeof uploadPrivacyResolve === 'function') {
		uploadPrivacyResolve(false)
		uploadPrivacyResolve = null
	}
	uni.showToast({ title: '请先同意隐私授权后再使用该功能', icon: 'none' })
}

const isWechatPrivacyScopeUndeclared = (error = {}) => {
	const message = String(error && (error.errMsg || error.message) || error || '')
	return error.errno === 112 || error.errCode === 112 || /api scope is not declared|privacy agreement/i.test(message)
}

const getWechatPrivacyPickerMessage = (error = {}) => {
	if (isWechatPrivacyScopeUndeclared(error)) {
		return '小程序隐私保护指引未声明图片/视频上传能力，请在微信公众平台补充后重试'
	}
	return '请先同意隐私授权后再上传'
}

const isWechatPrivacyError = (error) => isWechatPrivacyScopeUndeclared(error) || /privacy|agreePrivacyAuthorization|隐私/i.test(String(error && (error.errMsg || error.message) || error || ''))

const chooseImageWithPrivacy = async (options = {}) => {
	if (!(await ensureWechatPrivacyForAction())) {
		throw new Error('privacy authorization required')
	}
	try {
		return await uni.chooseImage(options)
	} catch (error) {
		if (!isWechatPrivacyError(error)) throw error
		if (isWechatPrivacyScopeUndeclared(error)) throw error
		resetWechatPrivacyReady()
		if (!(await ensureWechatPrivacyForAction())) throw error
		return await uni.chooseImage(options)
	}
}

const chooseVideoWithPrivacy = async (options = {}) => {
	if (!(await ensureWechatPrivacyForAction())) {
		throw new Error('privacy authorization required')
	}
	try {
		return await uni.chooseVideo(options)
	} catch (error) {
		if (!isWechatPrivacyError(error)) throw error
		if (isWechatPrivacyScopeUndeclared(error)) throw error
		resetWechatPrivacyReady()
		if (!(await ensureWechatPrivacyForAction())) throw error
		return await uni.chooseVideo(options)
	}
}

const applyLoginSession = (res = {}) => {
	if (!res || !res.token) {
		uni.showToast({ title: '登录状态获取失败，请重新登录', icon: 'none' })
		return false
	}

	try {
		uni.setStorageSync('token', res.token)
		uni.setStorageSync('userInfo', res.userInfo || {})
		uni.setStorageSync('isLoggedIn', true)
	} catch (error) {
		console.warn('persist login session failed:', error)
		uni.showToast({ title: '登录信息保存失败，请重试', icon: 'none' })
		return false
	}

	const returnToRepair = repairLoginPending.value || readRepairLoginReturn()
	currentUser.value = res.userInfo || {}
	logged.value = true
	resolveAvatarDisplay(currentUser.value.avatar)
	if (returnToRepair) {
		repairLoginPending.value = false
		clearRepairLoginReturn()
		restoreRepairDraft()
		previousModule.value = ''
		activeModule.value = 'repair'
		activeTab.value = 'home'
		prefillRepairAddress()
		loadRepairProductOptions()
	} else {
		activeModule.value = ''
		activeTab.value = 'mine'
	}
	// 登录后立即拉工单/设备，避免角标与列表空到下次 onShow
	loadRemoteContent().catch((error) => console.warn('load after login failed:', error))
	return true
}

const logoutLocal = async () => {
	try {
		await logoutRemote()
	} catch (error) {
		uni.removeStorageSync('token')
		uni.removeStorageSync('userInfo')
		uni.removeStorageSync('isLoggedIn')
	}
	currentUser.value = {}
	logged.value = false
}

// 用户自助注销账号：二次确认后调用后端软删除+脱敏，并清空本地登录态
const onCancelAccount = () => {
	uni.showModal({
		title: '注销账号',
		content: '注销后将清除您的账号信息并解绑微信，维修记录将匿名保留。此操作不可恢复，确定要注销吗？',
		confirmText: '确认注销',
		confirmColor: '#e54d42',
		success: async (res) => {
			if (!res.confirm) return
			try {
				uni.showLoading({ title: '注销中...', mask: true })
				await cancelAccount()
				uni.hideLoading()
				currentUser.value = {}
				logged.value = false
				uni.showToast({ title: '账号已注销', icon: 'success' })
			} catch (error) {
				uni.hideLoading()
				uni.showToast({ title: toCustomerErrorMessage(error, '注销失败'), icon: 'none' })
			}
		}
	})
}

const previewCompanyProductImage = (item = {}) => {
	const urls = companyProductLines.map(product => product.image).filter(Boolean)
	if (!item.image || !urls.length) return
	uni.previewImage({ current: item.image, urls })
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
		openModule(id, type)
		return
	}

	uni.showToast({ title: '暂不可用', icon: 'none' })
}

const openAddressPage = () => {
	uni.navigateTo({
		url: '/pages-sub/address/index',
		fail: () => uni.showToast({ title: '收货地址页面暂不可用', icon: 'none' })
	})
}

const openCustomerService = () => {
	if (customerService.value.wechat) {
		uni.setClipboardData({
			data: customerService.value.wechat,
			success: () => uni.showToast({ title: '客服微信已复制', icon: 'success' }),
			fail: () => uni.showToast({ title: '复制失败', icon: 'none' })
		})
		return
	}
	uni.showToast({ title: '客服方式暂未配置', icon: 'none' })
}

const normalizeOfficialAccountUsername = (value) => String(value || '').trim()

const launchOfficialAccountProfile = (username, options = {}) => {
	const fallbackMessage = options.fallbackMessage || '当前版本暂不支持直接打开公众号'
	const targetUsername = normalizeOfficialAccountUsername(username)
	if (!targetUsername) {
		uni.showToast({ title: fallbackMessage, icon: 'none' })
		return
	}
	// #ifdef MP-WEIXIN
	if (typeof wx !== 'undefined' && typeof wx.openOfficialAccountProfile === 'function') {
		wx.openOfficialAccountProfile({
			username: targetUsername,
			fail: (error = {}) => {
				const errMsg = String(error.errMsg || error.message || error || '')
				console.warn('open official account failed:', error)
				if (/cancel/i.test(errMsg)) return
				uni.showToast({ title: fallbackMessage, icon: 'none' })
			}
		})
		return
	}
	// #endif

	uni.showToast({ title: fallbackMessage, icon: 'none' })
}

const openOfficialAccountProfile = () => {
	const username = normalizeOfficialAccountUsername(wechatInfo.value.username) || OFFICIAL_ACCOUNT_USERNAME
	launchOfficialAccountProfile(username)
}

const openCicadaServiceAccountProfile = () => {
	if (isPcWebView) {
		showQr.value = true
		return
	}
	launchOfficialAccountProfile(CICADA_SERVICE_ACCOUNT_USERNAME, {
		fallbackMessage: '当前版本暂不支持直接打开服务号'
	})
}

const makePhoneCall = () => {
	callPhone(contactInfo.value.phone)
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

onLoad((options = {}) => {
	const type = Number(options.type)
	const routeType = Number.isInteger(type) ? type : undefined

	if (options.module && moduleMap[options.module]) {
		if (options.module === 'repair') restoreRepairDraft()
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
		await loadRemoteContent({ forceFaultRefresh: true })
	} finally {
		uni.stopPullDownRefresh()
	}
})

onBackPress(() => {
	if (uploadPrivacyVisible.value) {
		rejectUploadPrivacy()
		return true
	}
	if (!activeModule.value && !diagOpen.value) return false
	return returnFromModule()
})

const loadRemoteContent = async ({ forceFaultRefresh = false } = {}) => {
	const tasks = [
		getWarrantyPolicy()
			.then((doc) => updateDoc('warranty', doc))
			.catch((error) => console.warn('warranty fallback:', error)),
		getFeePolicy()
			.then((doc) => updateDoc('fees', doc))
			.catch((error) => console.warn('fee fallback:', error)),
		getGuide('repair')
			.then((doc) => updateDoc('guide-repair', doc))
			.catch((error) => console.warn('repair guide fallback:', error)),
		getGuide('invoice')
			.then((doc) => updateDoc('guide-invoice', doc))
			.catch((error) => console.warn('invoice guide fallback:', error)),
		loadMaintenanceVideos(),
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
		refreshFaultTypes({ forceRefresh: forceFaultRefresh, silent: true })
	]

	if (hasLoginToken()) {
		tasks.push(
			getMyDevices({ page: 1, size: 50 })
			.then((data = {}) => {
				const list = Array.isArray(data) ? data : (data.list || [])
				productList.value = Array.isArray(list) ? list.map(normalizeProduct).filter((item) => item.sn || item.title) : []
			})
			.catch((error) => console.warn('device list failed:', error)),
			getRepairList({ page: 1, size: 30 })
			.then((data = {}) => {
				const list = Array.isArray(data) ? data : (data.list || data.data || [])
				if (!Array.isArray(list)) return
				const normalized = list.map(normalizeOrder).filter((item) => item.id)
				orderList.value = normalized
				trackOrders.value = normalized
				resolvePaymentProofUrls(normalized)
				hydrateOrderDetails(normalized).catch((error) => console.warn('repair detail hydrate failed:', error))
			})
			.catch((error) => console.warn('repair list failed:', error))
		)
	}

	await Promise.allSettled(tasks)
	maybeShowHomeGuidePopup()
}

onMounted(() => {
	logBoot('onMounted start')
	if (logged.value) resolveAvatarDisplay(currentUser.value.avatar)
	uni.$on('wechatPrivacyReady', syncLoginPrivacyReady)
	getWechatPrivacyReady().then((ready) => {
		loginPrivacyReady.value = ready
	})
	initModuleSafeArea()
	setTimeout(() => {
		pageBootReady.value = true
		logBoot('full page enabled')
	}, BOOT_WAIT_MS)
	setTimeout(() => {
		logBoot('deferred boot start')
		restoreLocalBusinessState()
		restoreRepairDraft()
		loadSurveyConfig()
		loadRemoteContent()
	}, 220)
})

onUnmounted(() => {
	uni.$off('wechatPrivacyReady', syncLoginPrivacyReady)
	pcLoginGuard.dispose()
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
	animation: homeFadeIn 320ms ease-out both;
}

.upload-privacy-mask {
	position: fixed;
	inset: 0;
	z-index: 99999;
	padding: 48rpx 48rpx calc(48rpx + env(safe-area-inset-bottom));
	display: flex;
	align-items: center;
	justify-content: center;
	background: rgba(15, 31, 58, 0.48);
	box-sizing: border-box;
}

.upload-privacy-card {
	position: relative;
	width: 100%;
	max-width: 640rpx;
	height: 78vh;
	max-height: 78vh;
	padding: 36rpx 32rpx 28rpx;
	display: flex;
	flex-direction: column;
	overflow: hidden;
	border-radius: 24rpx;
	background: #FFFFFF;
	box-shadow: 0 24rpx 60rpx rgba(15, 31, 58, 0.22);
	box-sizing: border-box;
}

.upload-privacy-title {
	flex-shrink: 0;
	padding: 0 52rpx;
	text-align: center;
	font-size: 34rpx;
	font-weight: 800;
	line-height: 1.3;
	color: #0F1F3A;
}

.upload-privacy-close {
	position: absolute;
	top: 18rpx;
	right: 18rpx;
	z-index: 2;
	width: 64rpx;
	height: 64rpx;
	display: flex;
	align-items: center;
	justify-content: center;
	border-radius: 50%;
	background: #F2F4F7;
	font-size: 42rpx;
	font-weight: 400;
	line-height: 1;
	color: #667085;
}

.upload-privacy-body {
	flex: 1;
	min-height: 0;
	height: 0;
	margin: 24rpx 0;
	font-size: 27rpx;
	line-height: 1.8;
	color: #4E5969;
}

.upload-privacy-text {
	font-size: 27rpx;
	line-height: 1.8;
	color: #4E5969;
}

.upload-privacy-actions {
	flex-shrink: 0;
	display: flex;
	gap: 20rpx;
}

.upload-privacy-btn {
	flex: 1;
	height: 88rpx;
	padding: 0;
	display: flex;
	align-items: center;
	justify-content: center;
	border: 0;
	border-radius: 999rpx;
	font-size: 29rpx;
	font-weight: 700;
	line-height: 88rpx;
	box-sizing: border-box;
}

.upload-privacy-btn::after {
	border: 0;
}

.upload-privacy-btn.primary {
	background: #1E6FE0;
	color: #FFFFFF;
}

.upload-privacy-btn.ghost {
	background: #F2F4F7;
	color: #4E5969;
}

.boot-screen {
	min-height: 100vh;
	padding: 0 48rpx;
	display: flex;
	justify-content: center;
	align-items: flex-start;
	background: #FFFFFF;
	box-sizing: border-box;
	overflow: hidden;
}

.boot-content {
	width: 100%;
	padding-top: 32vh;
	display: flex;
	flex-direction: column;
	align-items: center;
	box-sizing: border-box;
}

.boot-logo {
	width: 208rpx;
	height: 208rpx;
	background: #FFFFFF;
	animation: bootLogoBounce 760ms cubic-bezier(0.22, 1.18, 0.36, 1) both;
}

.boot-title {
	margin-top: 24rpx;
	font-size: 32rpx;
	font-weight: 600;
	line-height: 1.4;
	color: #000000;
	animation: bootTitleFade 360ms ease-out 420ms both;
}

.boot-dots {
	margin-top: 46rpx;
	display: flex;
	align-items: center;
	justify-content: center;
	gap: 12rpx;
}

.boot-dot {
	width: 8rpx;
	height: 8rpx;
	border-radius: 50%;
	background: #A7A7A7;
	animation: bootDotJump 900ms ease-in-out infinite;
}

.boot-dot:nth-child(2) {
	animation-delay: 120ms;
}

.boot-dot:nth-child(3) {
	animation-delay: 240ms;
}

@keyframes bootLogoBounce {
	0% {
		opacity: 0;
		transform: translateY(-112rpx) scale(0.98);
	}
	56% {
		opacity: 1;
		transform: translateY(12rpx) scale(1);
	}
	72% {
		transform: translateY(-18rpx) scale(1);
	}
	86% {
		transform: translateY(6rpx) scale(1);
	}
	100% {
		opacity: 1;
		transform: translateY(0) scale(1);
	}
}

@keyframes bootTitleFade {
	0% {
		opacity: 0;
		transform: translateY(10rpx);
	}
	100% {
		opacity: 1;
		transform: translateY(0);
	}
}

@keyframes bootDotJump {
	0%, 80%, 100% {
		opacity: 0.5;
		transform: translateY(0);
	}
	40% {
		opacity: 1;
		transform: translateY(-8rpx);
	}
}

@keyframes homeFadeIn {
	0% {
		opacity: 0;
	}
	100% {
		opacity: 1;
	}
}

@media (prefers-reduced-motion: reduce) {
	.page-scroll,
	.boot-logo,
	.boot-title,
	.boot-dot {
		animation: none;
	}
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

.module-brand-watermark {
	width: 190rpx;
	height: 46rpx;
	margin-left: auto;
	flex-shrink: 0;
	opacity: 0.25;
	pointer-events: none;
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
	font-family: "Times New Roman", Georgia, "Songti SC", STSong, "宋体", SimSun, serif !important;
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
	width: 150rpx;
	height: 92rpx;
	padding: 17rpx 14rpx 14rpx 26rpx !important;
	border: none !important;
	border-radius: 48rpx 0 0 48rpx !important;
	background: linear-gradient(135deg, #23A8F2 0%, #1677E8 100%) !important;
	box-shadow: -8rpx 12rpx 26rpx -9rpx rgba(22, 119, 232, 0.4) !important;
	overflow: hidden;
}

.vi-side-logo-text {
	font-family: Georgia, "Times New Roman", "Noto Serif SC", serif;
	font-size: 32rpx;
	font-weight: 700;
	line-height: 1;
	letter-spacing: 0;
	color: #FFFFFF;
	text-shadow: 0 1rpx 2rpx rgba(0, 0, 0, 0.08);
}

.vi-side-logo-img {
	width: 102rpx;
	height: 26rpx;
}

.vi-side-logo-r {
	position: relative;
	top: -10rpx;
	margin-left: 2rpx;
	font-size: 12rpx;
	font-weight: 800;
	line-height: 1;
	color: #FFFFFF;
}

.vi-side-wordmark {
	display: flex;
	align-items: baseline;
	justify-content: center;
	width: 100%;
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

.input-placeholder {
	color: #94A3B8;
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
	padding-top: 28rpx;
}

.section-query,
.section-guide,
.section-contact {
	padding-top: 38rpx;
}

.home-section-heading {
	height: 54rpx;
	padding: 0 2rpx 18rpx;
	display: flex;
	align-items: center;
	gap: 14rpx;
	box-sizing: content-box;
}

.home-section-marker {
	width: 9rpx;
	height: 38rpx;
	flex-shrink: 0;
	border-radius: 999rpx;
	background: #2F86EA;
	box-shadow: 0 6rpx 14rpx rgba(47, 134, 234, 0.22);
}

.home-section-heading .section-title {
	padding: 0;
	font-size: 32rpx;
	font-weight: 800;
	line-height: 54rpx;
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
	gap: 14rpx;
}

.query-grid {
	display: grid;
	grid-template-columns: repeat(2, minmax(0, 1fr));
	gap: 20rpx 16rpx;
}

.service-card {
	min-width: 0;
	flex: 1;
	padding: 26rpx 10rpx 22rpx;
	display: flex;
	flex-direction: column;
	align-items: center;
	border-radius: 24rpx;
	background: #FFFFFF;
	box-shadow: 0 10rpx 28rpx rgba(55, 105, 171, 0.08);
	box-sizing: border-box;
}

.basic-service-card {
	min-height: 238rpx;
}

.service-icon-halo {
	display: flex;
	align-items: center;
	justify-content: center;
	flex-shrink: 0;
	border-radius: 999rpx;
}

.basic-icon-halo {
	width: 108rpx;
	height: 108rpx;
}

.service-icon {
	width: 86rpx;
	height: 86rpx;
	display: flex;
	align-items: center;
	justify-content: center;
	border-radius: 999rpx;
	box-shadow: inset 0 2rpx 8rpx rgba(255, 255, 255, 0.24), 0 6rpx 14rpx rgba(29, 78, 145, 0.12);
}

.section-basic .service-icon .glyph {
	width: 48rpx;
	height: 48rpx;
	transform: scale(1.06);
	transform-origin: center center;
}

.section-basic .service-icon .glyph-box {
	transform: translateY(-1rpx) scale(1.06);
}

.service-title {
	display: block;
	margin-top: 18rpx;
	font-size: 28rpx;
	font-weight: 700;
	line-height: 1.2;
	color: #0F1F3A;
}

.service-desc {
	display: block;
	margin-top: 8rpx;
	font-size: 21rpx;
	line-height: 1.3;
	color: #A0A9B8;
	white-space: nowrap;
}

.service-accent {
	width: 46rpx;
	height: 5rpx;
	margin-top: 16rpx;
	border-radius: 999rpx;
}

.query-service-card {
	min-width: 0;
	min-height: 120rpx;
	padding: 18rpx 18rpx;
	display: flex;
	align-items: center;
	gap: 16rpx;
	border-radius: 22rpx;
	background: #FFFFFF;
	box-shadow: 0 10rpx 28rpx rgba(55, 105, 171, 0.08);
	box-sizing: border-box;
}

.query-icon-halo {
	width: 82rpx;
	height: 82rpx;
}

.query-service-icon {
	width: 64rpx;
	height: 64rpx;
}

.query-service-icon .glyph {
	transform: scale(0.84);
	transform-origin: center center;
}

.query-service-copy {
	min-width: 0;
	flex: 1;
	display: flex;
	flex-direction: column;
}

.query-service-copy .service-title {
	margin-top: 0;
	font-size: 27rpx;
	white-space: nowrap;
}

.query-service-copy .service-desc {
	margin-top: 8rpx;
	font-size: 20rpx;
	overflow: hidden;
	text-overflow: ellipsis;
}

.query-chevron {
	width: 15rpx;
	height: 15rpx;
	flex-shrink: 0;
	border-right: 5rpx solid;
	border-bottom: 5rpx solid;
	transform: rotate(-45deg);
}

.guide-card {
	min-width: 0;
	min-height: 128rpx;
	padding: 20rpx 22rpx;
	display: flex;
	align-items: center;
	gap: 16rpx;
	border-radius: 22rpx;
	background: #FFFFFF;
	box-shadow: 0 10rpx 28rpx rgba(55, 105, 171, 0.08);
	box-sizing: border-box;
}

.guide-icon {
	width: 76rpx;
	height: 76rpx;
	display: flex;
	align-items: center;
	justify-content: center;
	flex-shrink: 0;
	border-radius: 17rpx;
	background: #E8F2FF;
	color: #2F86EA;
}

.guide-copy {
	min-width: 0;
	flex: 1;
	display: flex;
	flex-direction: column;
}

.guide-title {
	font-size: 27rpx;
	font-weight: 700;
	line-height: 1.25;
	color: #0F1F3A;
}

.guide-desc {
	margin-top: 8rpx;
	font-size: 20rpx;
	line-height: 1.25;
	color: #A0A9B8;
	white-space: nowrap;
}

.tutorial-guide-grid {
	display: grid;
	grid-template-columns: repeat(2, minmax(0, 1fr));
	gap: 20rpx;
}

.tutorial-guide-grid .guide-card {
	width: auto;
	min-width: 0;
}

.product-video-entry {
	margin-top: 20rpx;
	min-height: 124rpx;
	padding: 20rpx 24rpx;
	display: flex;
	align-items: center;
	gap: 20rpx;
	border-radius: 22rpx;
	background: #FFFFFF;
	box-shadow: 0 10rpx 28rpx rgba(55, 105, 171, 0.08);
	box-sizing: border-box;
}

.product-video-icon {
	position: relative;
	width: 76rpx;
	height: 76rpx;
	display: flex;
	align-items: center;
	justify-content: center;
	flex-shrink: 0;
	border-radius: 50%;
	background: #FFE6E5;
	color: #FF6B6B;
}

.product-video-icon::before {
	content: "";
	position: absolute;
	width: 58rpx;
	height: 58rpx;
	border-radius: 50%;
	background: #FF7775;
	box-shadow: 0 8rpx 18rpx rgba(255, 107, 107, 0.24);
}

.product-video-play {
	position: relative;
	width: 30rpx;
	height: 24rpx;
	border: 4rpx solid #FFFFFF;
	border-radius: 7rpx;
	box-sizing: border-box;
}

.product-video-play::after {
	content: "";
	position: absolute;
	left: 9rpx;
	top: 4rpx;
	width: 0;
	height: 0;
	border-top: 6rpx solid transparent;
	border-bottom: 6rpx solid transparent;
	border-left: 9rpx solid #FFFFFF;
}

.product-video-copy {
	min-width: 0;
	flex: 1;
	display: flex;
	flex-direction: column;
}

.product-video-title-row {
	display: flex;
	align-items: center;
	gap: 10rpx;
	min-width: 0;
}

.product-video-title {
	font-size: 28rpx;
	font-weight: 700;
	line-height: 1.25;
	color: #0F1F3A;
}

.product-video-new {
	padding: 3rpx 8rpx;
	border-radius: 12rpx;
	background: #FF5E5E;
	color: #FFFFFF;
	font-size: 16rpx;
	font-weight: 800;
	line-height: 1.2;
}

.product-video-desc {
	margin-top: 8rpx;
	font-size: 20rpx;
	line-height: 1.25;
	color: #A0A9B8;
}

.product-video-chevron {
	position: relative;
	width: 18rpx;
	height: 28rpx;
	flex-shrink: 0;
}

.product-video-chevron::before {
	content: "";
	position: absolute;
	top: 5rpx;
	left: 0;
	width: 15rpx;
	height: 15rpx;
	border-top: 5rpx solid #FF6B6B;
	border-right: 5rpx solid #FF6B6B;
	transform: rotate(45deg);
}

.maintenance-video-wrap {
	margin-top: 26rpx;
}

.maintenance-section-head {
	padding: 0 2rpx 16rpx;
	display: flex;
	align-items: flex-end;
	justify-content: space-between;
}

.maintenance-section-head text:first-child {
	font-size: 30rpx;
	font-weight: 800;
	line-height: 1.2;
	color: #0F1F3A;
}

.maintenance-section-head text:last-child {
	font-size: 23rpx;
	line-height: 1.2;
	color: #8A97AA;
}

.maintenance-video-list {
	display: flex;
	flex-direction: column;
	gap: 20rpx;
}

.maintenance-video-card {
	padding: 24rpx;
	border-radius: 16rpx;
	background: #FFFFFF;
	border: 1rpx solid #EEF2F7;
	box-shadow: 0 8rpx 24rpx rgba(15, 31, 58, 0.06);
	box-sizing: border-box;
}

.maintenance-video-title {
	display: block;
	font-size: 31rpx;
	font-weight: 700;
	line-height: 1.35;
	color: #0F1F3A;
}

.maintenance-video-intro {
	display: -webkit-box;
	margin-top: 6rpx;
	margin-bottom: 18rpx;
	font-size: 23rpx;
	line-height: 1.5;
	color: #6B7C97;
	-webkit-box-orient: vertical;
	-webkit-line-clamp: 2;
	overflow: hidden;
}

.maintenance-video-title + .maintenance-video-cover {
	margin-top: 18rpx;
}

.maintenance-video-cover {
	position: relative;
	width: 100%;
	height: 336rpx;
	overflow: hidden;
	border-radius: 16rpx;
	background: #F3F7FC;
}

.maintenance-video-image,
.maintenance-video-placeholder {
	width: 100%;
	height: 100%;
}

.maintenance-video-placeholder {
	display: flex;
	align-items: center;
	justify-content: center;
	flex-direction: column;
	gap: 16rpx;
	background: linear-gradient(135deg, #F6FAFF 0%, #EAF1FA 100%);
	color: #1E6FE0;
}

.maintenance-video-brand {
	font-size: 24rpx;
	font-weight: 800;
	line-height: 1.2;
	color: #1E6FE0;
}

.maintenance-video-placeholder-title {
	max-width: 520rpx;
	padding: 0 32rpx;
	font-size: 34rpx;
	font-weight: 700;
	line-height: 1.35;
	text-align: center;
	color: #132746;
}

.maintenance-video-shade {
	position: absolute;
	inset: 0;
	background: linear-gradient(180deg, rgba(15, 31, 58, 0) 0%, rgba(15, 31, 58, 0.12) 100%);
}

.maintenance-play-badge {
	position: absolute;
	left: 50%;
	top: 50%;
	width: 82rpx;
	height: 82rpx;
	display: flex;
	align-items: center;
	justify-content: center;
	border-radius: 999rpx;
	background: rgba(15, 31, 58, 0.54);
	box-shadow: 0 10rpx 24rpx rgba(15, 31, 58, 0.16);
	transform: translate(-50%, -50%);
}

.maintenance-play-badge text {
	margin-left: 6rpx;
	font-size: 32rpx;
	line-height: 1;
	color: #FFFFFF;
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
	width: auto;
	min-width: 0;
	min-height: 124rpx;
	margin: 0;
	padding: 20rpx 18rpx;
	display: flex;
	align-items: center;
	gap: 14rpx;
	border: 0;
	border-radius: 22rpx;
	background: #FFFFFF;
	box-shadow: 0 10rpx 28rpx rgba(55, 105, 171, 0.08);
	line-height: normal;
	box-sizing: border-box;
}

.contact-card::after {
	border: 0;
}

.contact-grid {
	display: grid;
	grid-template-columns: repeat(2, minmax(0, 1fr));
	gap: 16rpx;
}

.contact-icon {
	width: 72rpx;
	height: 72rpx;
	display: flex;
	align-items: center;
	justify-content: center;
	flex-shrink: 0;
	border-radius: 17rpx;
	background: #E8F2FF;
	color: #2F86EA;
}

.contact-icon .glyph {
	transform: scale(0.82);
	transform-origin: center center;
}

.contact-copy {
	min-width: 0;
	flex: 1;
	display: flex;
	flex-direction: column;
}

.contact-title {
	font-size: 25rpx;
	font-weight: 700;
	line-height: 1.2;
	color: #2F86EA;
	white-space: nowrap;
}

.contact-desc {
	margin-top: 6rpx;
	font-size: 20rpx;
	line-height: 1.2;
	color: #66758B;
	white-space: nowrap;
}

.contact-action {
	min-width: 68rpx;
	height: 48rpx;
	padding: 0 12rpx;
	display: flex;
	align-items: center;
	justify-content: center;
	flex-shrink: 0;
	border-radius: 999rpx;
	background: #2F86EA;
	color: #FFFFFF;
	font-size: 21rpx;
	font-weight: 700;
	line-height: 48rpx;
	box-sizing: border-box;
}

.home-receiver-detail {
	margin-top: 16rpx;
}

.home-receiver-detail .copy-row {
	padding: 16rpx 0 0;
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
	width: 100%;
	aspect-ratio: 1051 / 645;
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
	transform: scale(1.012);
	transform-origin: 50% 50%;
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

.company-intro-text-title {
	margin-top: 0;
	font-size: 30rpx;
	font-weight: 800;
	line-height: 1.35;
	color: #0F1F3A;
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

.business-image {
	display: block;
	width: 100%;
	height: 100%;
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

.company-service-slogan {
	display: block;
	margin-top: 8rpx;
	font-size: 24rpx;
	font-weight: 700;
	line-height: 1.3;
	letter-spacing: 0.8rpx;
	color: rgba(255, 255, 255, 0.92);
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

.account-cancel-row {
	display: flex;
	justify-content: center;
	padding: 40rpx 28rpx 0;
}

.account-cancel-link {
	font-size: 24rpx;
	color: #94A3B8;
	text-decoration: underline;
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
	top: 39%;
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
	letter-spacing: 0;
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
	font-size: 22rpx;
	font-weight: 700;
	line-height: 1.15;
	letter-spacing: 3rpx;
	padding-left: 3rpx;
	color: rgba(255, 255, 255, 0.96);
	text-shadow: 0 1rpx 2rpx rgba(0, 0, 0, 0.1);
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

.mini-copy-white::before,
.mini-copy-white::after {
	border-color: #FFFFFF;
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

.repair-section-head {
	min-height: 92rpx;
	padding-top: 28rpx;
}

.repair-section-actions,
.repair-section-toggle {
	display: flex;
	align-items: center;
	gap: 14rpx;
}

.repair-section-actions {
	gap: 26rpx;
}

.repair-section-actions > text {
	color: #0F766E !important;
	font-size: 23rpx !important;
	font-weight: 600 !important;
}

.repair-section-toggle > text {
	width: auto !important;
	color: #64748B !important;
	font-size: 23rpx !important;
	font-weight: 500 !important;
}

.section-chevron {
	width: 14rpx;
	height: 14rpx;
	border-right: 3rpx solid #94A3B8;
	border-bottom: 3rpx solid #94A3B8;
	transform: rotate(45deg);
	transition: transform 160ms ease;
}

.section-chevron.open {
	transform: rotate(225deg);
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
	position: relative;
	padding-bottom: 220rpx;
	overflow: hidden;
}

.repair-user-card {
	margin-top: 20rpx;
}

.repair-product {
	margin-bottom: 20rpx;
}

.repair-brand-watermark {
	position: relative;
	z-index: 0;
	min-height: 188rpx;
	margin: 36rpx 8rpx 8rpx;
	display: flex;
	flex-direction: column;
	align-items: center;
	justify-content: center;
	gap: 12rpx;
	opacity: 0.18;
	pointer-events: none;
}

.repair-brand-watermark::before {
	content: "";
	position: absolute;
	left: 50%;
	top: 50%;
	width: 520rpx;
	height: 180rpx;
	border-radius: 50%;
	background: radial-gradient(circle, rgba(30, 111, 224, 0.18) 0%, rgba(30, 111, 224, 0) 68%);
	transform: translate(-50%, -50%);
}

.repair-brand-watermark image {
	position: relative;
	width: 280rpx;
	height: 76rpx;
}

.repair-brand-watermark text {
	position: relative;
	font-size: 24rpx;
	font-weight: 600;
	letter-spacing: 2rpx;
	color: #0A4FB8;
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

.voucher-field .field-label-wrap {
	width: 220rpx;
	flex-wrap: nowrap;
	white-space: nowrap;
}

.voucher-field .field-label-wrap > text {
	white-space: nowrap;
}

.voucher-field .field-label-wrap > text:first-child {
	flex-shrink: 0;
	font-size: 27rpx;
	line-height: 1.3;
	color: #324563;
}

.voucher-field .field-optional {
	flex-shrink: 0;
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

.native-field-picker {
	display: block;
	width: 100%;
}

.native-field-action {
	flex-shrink: 0;
	padding: 10rpx 0 10rpx 16rpx;
	color: #1E6FE0;
	font-size: 23rpx;
	font-weight: 700;
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
	position: relative;
	width: 100%;
	height: 100%;
	display: flex;
	flex-direction: column;
	align-items: center;
	justify-content: center;
	gap: 8rpx;
	color: #1E6FE0;
}

.media-video-overlay {
	position: absolute;
	inset: 0;
	display: flex;
	flex-direction: column;
	align-items: center;
	justify-content: center;
	gap: 8rpx;
	background: rgba(15, 31, 58, 0.24);
	color: #FFFFFF;
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
	width: 108rpx;
	height: 92rpx;
	display: flex;
	flex-direction: column;
	align-items: center;
	justify-content: center;
	gap: 8rpx;
	border-radius: 18rpx;
	background: #F5F8FC;
	color: #324563;
	font-size: 21rpx;
}

.bottom-more-icon {
	width: 46rpx;
	height: 30rpx;
	display: flex;
	align-items: center;
	justify-content: center;
	gap: 6rpx;
	border-radius: 999rpx;
	background: #E9F0FA;
}

.bottom-more-icon > view {
	width: 6rpx;
	height: 6rpx;
	border-radius: 999rpx;
	background: #324563;
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
.sn-result.error { background: #FFF4F2; border-color: #F3C7C1; color: #B23A3A; }
.sn-result-row { display: flex; align-items: center; justify-content: space-between; }
.sn-result-label { font-size: 24rpx; color: #0A4FB8; font-weight: 600; }
.sn-result-line { font-size: 24rpx; color: #324563; }

.sn-tag { font-size: 22rpx; padding: 4rpx 14rpx; border-radius: 999rpx; }
.sn-tag-in_warranty { background: #E3F8EE; color: #0F9D58; }
.sn-tag-extended { background: #E8F0FE; color: #1E6FE0; }
.sn-tag-expired { background: #FDECEC; color: #E0524D; }
.sn-tag-unknown { background: #EEF1F5; color: #8597B2; }

.sn-query-btn {
	flex: none;
	margin-left: 12rpx;
	padding: 6rpx 20rpx;
	border-radius: 999rpx;
	background: #E8F0FE;
	color: #0A4FB8;
	font-size: 24rpx;
	font-weight: 600;
}
.sn-result-history { margin-top: 2rpx; }
.sn-result-line.link { color: #0A4FB8; font-weight: 600; }

/* 报价弹窗在保/过保提示栏 */
.quote-warranty-hint {
	margin: 4rpx 0 14rpx;
	padding: 16rpx 20rpx;
	border-radius: 14rpx;
	font-size: 24rpx;
	line-height: 1.5;
}
.quote-warranty-hint-in { background: #E3F8EE; color: #0F8A4F; border: 2rpx solid #BDEBD3; }
.quote-warranty-hint-out { background: #FDECEC; color: #D23E39; border: 2rpx solid #F6CFCD; }
.quote-warranty-hint-unknown { background: #FFF7E6; color: #9A6700; border: 2rpx solid #F5D58A; }

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

.tool-note {
	background: #F0F6EF;
	color: #2F7D46;
}

.tool-note > view {
	width: 30rpx;
	height: 36rpx;
	padding: 8rpx 6rpx;
	display: flex;
	flex-direction: column;
	gap: 5rpx;
	border: 3rpx solid currentColor;
	border-radius: 8rpx;
	box-sizing: border-box;
}

.tool-note > view > view {
	height: 3rpx;
	border-radius: 999rpx;
	background: currentColor;
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

.continue-repair-button {
	width: 100%;
	height: 88rpx;
	margin-top: 20rpx;
	display: flex;
	align-items: center;
	justify-content: center;
	border: 2rpx solid #B9DCD8;
	border-radius: 16rpx;
	background: #F0FDFA;
	color: #0F766E;
	font-size: 28rpx;
	font-weight: 700;
	box-sizing: border-box;
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

.package-tabs {
	display: flex;
	gap: 12rpx;
	margin-bottom: 24rpx;
	padding: 6rpx;
	border-radius: 999rpx;
	background: #F2F5FB;
}
.package-tab {
	flex: 1;
	text-align: center;
	padding: 16rpx 0;
	border-radius: 999rpx;
	font-size: 26rpx;
	font-weight: 600;
	color: #6B7C97;
}
.package-tab.on {
	background: #1E6FE0;
	color: #FFFFFF;
	box-shadow: 0 6rpx 16rpx -6rpx rgba(30, 111, 224, 0.55);
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

.package-copy-row {
	margin-top: 10rpx;
	display: flex;
	justify-content: flex-end;
}

.package-stagnant-notice {
	margin-top: 20rpx;
	padding: 18rpx 22rpx;
	display: flex;
	align-items: center;
	gap: 16rpx;
	border-radius: 18rpx;
	background: rgba(254, 242, 242, 0.9);
	box-sizing: border-box;
}

.package-stagnant-notice text:first-child {
	min-width: 0;
	flex: 1;
	font-size: 23rpx;
	line-height: 1.55;
	color: #B91C1C;
}

.package-stagnant-notice .copy-link {
	flex-shrink: 0;
}

.package-estimate-note {
	margin-top: 20rpx;
	background: rgba(243, 244, 246, 0.8);
	color: #6B7C97;
}

.package-estimate-note text:first-child {
	background: rgba(107, 124, 151, 0.12);
	color: #6B7C97;
}

.package-estimate-note text:last-child {
	color: #6B7C97;
}

.package-notfound-card .package-empty {
	margin-top: 0;
}

.package-notfound-actions {
	margin-top: 22rpx;
	display: flex;
	gap: 18rpx;
}

.package-notfound-actions .return-logistics-btn {
	flex: 1;
	text-align: center;
}

.outbound-fill-card .detail-action-button {
	margin-top: 24rpx;
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

.invoice-type-row > view.disabled {
	opacity: 0.45;
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
	min-width: 0;
	flex: 1;
	font-size: 32rpx;
	font-weight: 800;
	letter-spacing: 1rpx;
	word-break: break-all;
}

.detail-order-no-row {
	display: flex;
	align-items: center;
	gap: 20rpx;
	margin-top: 8rpx;
}

.detail-order-copy {
	min-width: 92rpx;
	height: 52rpx;
	padding: 0 14rpx;
	display: inline-flex;
	align-items: center;
	justify-content: center;
	gap: 6rpx;
	flex-shrink: 0;
	border: 2rpx solid rgba(255, 255, 255, 0.58);
	border-radius: 12rpx;
	box-sizing: border-box;
	color: #FFFFFF;
	font-size: 21rpx;
	font-weight: 600;
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

.detail-repair-list {
	display: flex;
	flex-direction: column;
	gap: 20rpx;
}

.detail-repair-card,
.detail-shipping-card,
.detail-timeline-card {
	padding: 28rpx;
	border: 2rpx solid #E4ECF7;
	border-radius: 16rpx;
	background: #FFFFFF;
	box-sizing: border-box;
}

.detail-repair-head,
.detail-timeline-heading {
	display: flex;
	align-items: center;
	justify-content: space-between;
	gap: 20rpx;
}

.detail-repair-head text:first-child,
.detail-timeline-heading text:first-child {
	font-size: 28rpx;
	font-weight: 800;
	color: #0F1F3A;
}

.detail-repair-head text:last-child,
.detail-timeline-heading text:last-child {
	min-width: 0;
	font-size: 23rpx;
	color: #64748B;
	text-align: right;
	word-break: break-all;
}

.detail-field-grid {
	display: grid;
	grid-template-columns: repeat(2, minmax(0, 1fr));
	gap: 20rpx 24rpx;
	margin-top: 24rpx;
	padding-top: 24rpx;
	border-top: 2rpx solid #EEF3FA;
}

.detail-field-grid > view,
.detail-shipping-group > view {
	min-width: 0;
	display: flex;
	flex-direction: column;
	gap: 6rpx;
}

.detail-field-grid > view > text:first-child,
.detail-shipping-group > view > text:first-child,
.detail-fault-block > text:first-child,
.detail-attachment-block > text:first-child {
	font-size: 22rpx;
	color: #94A3B8;
}

.detail-field-grid > view > text:last-child,
.detail-shipping-group > view > text:last-child {
	font-size: 25rpx;
	line-height: 1.5;
	color: #263952;
	word-break: break-all;
}

.detail-fault-block,
.detail-attachment-block {
	display: flex;
	flex-direction: column;
	gap: 10rpx;
	margin-top: 24rpx;
}

.detail-fault-block > text:last-child {
	font-size: 25rpx;
	line-height: 1.65;
	color: #263952;
	white-space: pre-wrap;
	word-break: break-all;
}

.detail-attachment-grid {
	display: grid;
	grid-template-columns: repeat(3, minmax(0, 1fr));
	gap: 14rpx;
}

.detail-attachment {
	min-width: 0;
	display: flex;
	flex-direction: column;
	gap: 8rpx;
}

.detail-attachment image,
.detail-attachment-placeholder,
.detail-video-placeholder {
	width: 100%;
	aspect-ratio: 1;
	border-radius: 12rpx;
	background: #F2F6FC;
	overflow: hidden;
}

.detail-attachment-placeholder,
.detail-video-placeholder {
	display: flex;
	align-items: center;
	justify-content: center;
	font-size: 23rpx;
	color: #64748B;
}

.detail-video-placeholder {
	position: relative;
}

.detail-video-placeholder image {
	width: 100%;
	height: 100%;
}

.detail-video-play {
	position: absolute;
	inset: 0;
	display: flex;
	align-items: center;
	justify-content: center;
	background: rgba(15, 31, 58, 0.2);
}

.detail-video-play text {
	font-size: 38rpx;
	color: #FFFFFF;
}

.detail-attachment > text:last-child {
	font-size: 21rpx;
	color: #64748B;
	text-align: center;
}

.detail-shipping-card {
	display: grid;
	grid-template-columns: repeat(2, minmax(0, 1fr));
	gap: 28rpx;
	margin-top: 20rpx;
}

.detail-shipping-group {
	min-width: 0;
	display: flex;
	flex-direction: column;
	gap: 18rpx;
}

.detail-shipping-group > text:first-child {
	font-size: 26rpx;
	font-weight: 800;
	color: #0F1F3A;
}

.detail-timeline-card {
	margin-top: 20rpx;
}

.detail-timeline-heading {
	margin-bottom: 28rpx;
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
	border: 2rpx solid #E4ECF7;
	box-shadow: none;
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
	padding: 0;
	border-radius: 0;
	background: transparent;
	border: none;
	box-sizing: border-box;
}

.quote-group + .quote-group {
	padding-top: 20rpx;
	border-top: 2rpx solid #EEF3FA;
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
	margin-top: 28rpx;
	padding-top: 24rpx;
	display: flex;
	flex-direction: column;
	gap: 6rpx;
	border-top: 2rpx solid #E4ECF7;
	box-sizing: border-box;
}


.quote-total-main {
	display: flex;
	align-items: baseline;
	justify-content: space-between;
	gap: 20rpx;
}

.quote-total-main text:first-child {
	font-size: 22rpx;
	color: #6B7C97;
}

.quote-total-main text:last-child {
	font-size: 40rpx;
	font-weight: 900;
	color: #D97706;
}

.quote-total-box > text {
	font-size: 23rpx;
	line-height: 1.5;
	color: #6B7C97;
}

.quote-status-note,
.quote-payment-note {
	display: block;
	margin-top: 16rpx;
	font-size: 23rpx;
	line-height: 1.55;
}

.quote-status-note { color: #6B7C97; }
.quote-status-note-in { color: #0F8A4F; }
.quote-status-note-out { color: #B23A3A; }
.quote-status-note-unknown { color: #9A6700; }
.quote-payment-note { color: #8A5A15; }

.payment-reject-notice {
	margin-top: 20rpx;
	padding: 20rpx 24rpx;
	display: flex;
	flex-direction: column;
	gap: 8rpx;
	border-radius: 20rpx;
	background: #FEF2F2;
	border: 2rpx solid #FCA5A5;
	box-sizing: border-box;
}

.payment-reject-title {
	font-size: 26rpx;
	font-weight: 700;
	color: #DC2626;
}

.transfer-proof-button {
	background: linear-gradient(180deg, #2F9E78 0%, #16865F 100%);
	box-shadow: 0 18rpx 36rpx -18rpx rgba(22, 134, 95, 0.52);
}
.payment-reject-reason {
	font-size: 24rpx;
	line-height: 1.5;
	color: #B91C1C;
}

.transfer-account-card {
	margin-top: 20rpx;
	padding: 24rpx;
	display: flex;
	flex-direction: column;
	gap: 14rpx;
	border-radius: 22rpx;
	background: #F5F9FF;
	border: 2rpx solid #D3E2FA;
	box-sizing: border-box;
}

.transfer-account-title {
	font-size: 26rpx;
	font-weight: 700;
	color: #1E6FE0;
}

.transfer-account-row {
	display: flex;
	align-items: center;
	gap: 16rpx;
}

.transfer-account-label {
	flex: 0 0 auto;
	width: 120rpx;
	font-size: 24rpx;
	color: #8A97AA;
}

.transfer-account-value {
	flex: 1;
	font-size: 25rpx;
	line-height: 1.5;
	color: #10264A;
	word-break: break-all;
}

.transfer-account-no {
	font-weight: 700;
	letter-spacing: 1rpx;
}

.transfer-account-muted {
	color: #9AA9BF;
}

.transfer-copy {
	flex: 0 0 auto;
	padding: 6rpx 20rpx;
	font-size: 22rpx;
	color: #1E6FE0;
	border: 2rpx solid #1E6FE0;
	border-radius: 999rpx;
	background: #FFFFFF;
}

.transfer-account-remark {
	margin-top: 4rpx;
	padding-top: 14rpx;
	display: flex;
	flex-direction: column;
	gap: 12rpx;
	border-top: 2rpx dashed #D3E2FA;
}

.transfer-remark-tip {
	font-size: 23rpx;
	line-height: 1.5;
	color: #D97706;
}

.transfer-remark-row {
	display: flex;
	align-items: center;
	gap: 16rpx;
}

.transfer-remark-no {
	flex: 1;
	font-size: 28rpx;
	font-weight: 800;
	letter-spacing: 1rpx;
	color: #10264A;
	word-break: break-all;
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
	margin: 0;
	padding: 0;
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

.quote-contact-action::after {
	border: none;
}

.quote-reject-action {
	min-height: 64rpx;
	display: flex;
	align-items: center;
	justify-content: center;
	border-radius: 999rpx;
	font-size: 24rpx;
	font-weight: 700;
	color: #B23A3A;
	background: #FDF2F2;
	border: 2rpx solid #F0CFCF;
}

.receipt-confirm-button {
	margin-top: 20rpx;
}

.package-order-link {
	color: #1E6FE0;
	font-weight: 700;
}

.order-complaint-card {
	padding: 20rpx;
	border-radius: 16rpx;
	background: #F7FAFF;
	display: flex;
	flex-direction: column;
	gap: 16rpx;
}

.order-complaint-list {
	display: flex;
	flex-direction: column;
	gap: 16rpx;
}

.order-complaint-item {
	padding: 18rpx;
	border-radius: 14rpx;
	background: #FFFFFF;
	border: 2rpx solid #E8EFFA;
	display: flex;
	flex-direction: column;
	gap: 10rpx;
}

.order-complaint-top {
	display: flex;
	align-items: center;
	justify-content: space-between;
}

.order-complaint-type {
	font-size: 26rpx;
	font-weight: 800;
	color: #1F2C44;
}

.order-complaint-content {
	font-size: 24rpx;
	color: #46566F;
	line-height: 1.5;
}

.order-complaint-reply {
	padding: 14rpx;
	border-radius: 12rpx;
	background: #F1F6FF;
	display: flex;
	flex-direction: column;
	gap: 6rpx;
	font-size: 24rpx;
	color: #1F2C44;
}

.order-complaint-reply-label {
	font-size: 22rpx;
	font-weight: 800;
	color: #1E6FE0;
}

.order-complaint-empty {
	font-size: 24rpx;
	color: #6B7C97;
	line-height: 1.5;
}

.order-complaint-action {
	min-height: 64rpx;
	display: flex;
	align-items: center;
	justify-content: center;
	border-radius: 999rpx;
	font-size: 24rpx;
	font-weight: 800;
	color: #B23A3A;
	background: #FDF2F2;
	border: 2rpx solid #F0CFCF;
}

.success-archive-tip {
	margin-top: 16rpx;
	font-size: 22rpx;
	color: #6B7C97;
	line-height: 1.5;
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

/* 四步维修进度 */
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
	display: flex;
	flex-direction: column;
	gap: 20rpx;
	min-height: 100vh;
	padding-bottom: 24rpx;
	box-sizing: border-box;
}

.survey-hero-card {
	padding: 28rpx;
	display: flex;
	align-items: center;
	gap: 22rpx;
	border: 2rpx solid #D7E3FA;
	border-radius: 28rpx;
	background: linear-gradient(135deg, #F3F8FF 0%, #FFFFFF 100%);
	box-shadow: 0 8rpx 24rpx rgba(30, 111, 224, 0.05);
	box-sizing: border-box;
}

.survey-hero-icon {
	width: 84rpx;
	height: 84rpx;
	display: flex;
	align-items: center;
	justify-content: center;
	flex-shrink: 0;
	border-radius: 24rpx;
	background: #FFF7E6;
	color: #A16207;
}

.survey-hero-icon .glyph {
	width: 42rpx;
	height: 42rpx;
}

.survey-hero-card > view:last-child {
	min-width: 0;
	flex: 1;
	display: flex;
	flex-direction: column;
	gap: 8rpx;
}

.survey-hero-card > view:last-child text:first-child {
	font-size: 30rpx;
	font-weight: 800;
	color: #0F1F3A;
}

.survey-hero-card > view:last-child text:last-child {
	font-size: 23rpx;
	line-height: 1.45;
	color: #6B7C97;
}

.survey-form-card {
	padding: 28rpx;
	border-radius: 28rpx;
	background: #FFFFFF;
	box-shadow: 0 2rpx 4rpx rgba(15, 31, 58, 0.04), 0 8rpx 28rpx rgba(30, 111, 224, 0.05);
	box-sizing: border-box;
	text-align: left;
}

.survey-poster-card {
	padding: 36rpx 28rpx 32rpx;
	border-radius: 28rpx;
	background: #FFFFFF;
	box-shadow: 0 2rpx 4rpx rgba(15, 31, 58, 0.04), 0 8rpx 28rpx rgba(30, 111, 224, 0.05);
	box-sizing: border-box;
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
	text-align: center;
}

.survey-benefits {
	margin-top: 24rpx;
	display: grid;
	grid-template-columns: repeat(3, 1fr);
	gap: 12rpx;
}

.survey-benefit {
	min-height: 96rpx;
	padding: 14rpx 10rpx;
	border-radius: 18rpx;
	background: #F7FAFF;
	border: 2rpx solid #E1EAF7;
	display: flex;
	flex-direction: column;
	align-items: center;
	justify-content: center;
	gap: 8rpx;
	box-sizing: border-box;
}

.survey-benefit text:first-child {
	width: 34rpx;
	height: 34rpx;
	border-radius: 50%;
	background: #1E6FE0;
	color: #FFFFFF;
	font-size: 20rpx;
	font-weight: 800;
	display: flex;
	align-items: center;
	justify-content: center;
}

.survey-benefit text:last-child {
	font-size: 21rpx;
	line-height: 1.25;
	color: #334155;
	text-align: center;
}

.survey-form {
	margin-top: 24rpx;
	display: flex;
	flex-direction: column;
	gap: 20rpx;
}

.survey-field {
	padding: 22rpx;
	border-radius: 20rpx;
	background: #F8FAFC;
	border: 2rpx solid #E5ECF6;
	box-sizing: border-box;
}

.survey-field-label {
	display: block;
	margin-bottom: 14rpx;
	font-size: 25rpx;
	font-weight: 700;
	color: #0F1F3A;
}

.survey-field input,
.survey-field textarea {
	width: 100%;
	min-height: 72rpx;
	font-size: 26rpx;
	line-height: 1.5;
	color: #0F1F3A;
	box-sizing: border-box;
}

.survey-field textarea {
	height: 172rpx;
	padding: 0;
}

.survey-chip-row {
	display: flex;
	flex-wrap: wrap;
	gap: 12rpx;
}

.survey-chip {
	min-height: 64rpx;
	padding: 0 22rpx;
	border-radius: 999rpx;
	background: #FFFFFF;
	border: 2rpx solid #D9E4F2;
	color: #5B6B82;
	font-size: 24rpx;
	font-weight: 600;
	display: flex;
	align-items: center;
	justify-content: center;
	box-sizing: border-box;
}

.survey-chip.on {
	background: #E8F1FE;
	border-color: #1E6FE0;
	color: #1E6FE0;
}

.survey-score-row {
	display: grid;
	grid-template-columns: repeat(5, 1fr);
	gap: 12rpx;
}

.survey-score {
	height: 68rpx;
	border-radius: 18rpx;
	background: #FFFFFF;
	border: 2rpx solid #D9E4F2;
	color: #5B6B82;
	font-size: 25rpx;
	font-weight: 800;
	display: flex;
	align-items: center;
	justify-content: center;
	box-sizing: border-box;
}

.survey-score.on {
	background: #FFF7E6;
	border-color: #F59E0B;
	color: #A16207;
}

.survey-score-tip {
	display: block;
	margin-top: 12rpx;
	font-size: 22rpx;
	color: #8A97AA;
	text-align: right;
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
	gap: 18rpx;
	justify-content: center;
}

.survey-secondary {
	flex: 1;
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

.survey-primary {
	flex: 1.4;
	height: 80rpx;
	display: flex;
	align-items: center;
	justify-content: center;
	border-radius: 999rpx;
	font-size: 28rpx;
	font-weight: 700;
	background: #1E6FE0;
	color: #FFFFFF;
	box-shadow: 0 16rpx 36rpx -20rpx rgba(30, 111, 224, 0.9);
}

.survey-primary.disabled {
	opacity: 0.62;
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

.diag-sync-tip {
	margin-bottom: 20rpx;
	padding: 18rpx 22rpx;
	border-radius: 16rpx;
	background: #EFF6FF;
	font-size: 24rpx;
	line-height: 1.5;
	color: #1E6FE0;
}

.diag-sync-tip.warning {
	background: #FFF7E6;
	color: #B45309;
}

.diag-advice-card {
	margin-bottom: 20rpx;
	padding: 24rpx 28rpx;
	display: flex;
	flex-direction: column;
	gap: 8rpx;
	border-left: 8rpx solid #10B981;
	border-radius: 16rpx;
	background: #ECFDF5;
	box-sizing: border-box;
}

.diag-advice-card.recommend {
	border-left-color: #F59E0B;
	background: #FFF7E6;
}

.diag-advice-card > text:first-child {
	font-size: 27rpx;
	font-weight: 700;
	color: #0F1F3A;
}

.diag-advice-card > text:last-child {
	font-size: 24rpx;
	line-height: 1.55;
	color: #52647F;
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
	height: 70vh;
	max-height: 70vh;
	display: flex;
	flex-direction: column;
	overflow: hidden;
	border-radius: 32rpx 32rpx 0 0;
	background: #FFFFFF;
	box-sizing: border-box;
}

.address-choice-row > view { min-width: 0; flex: 1; display: flex; flex-direction: column; gap: 8rpx; }
.address-choice-detail { font-size: 23rpx; color: #86909C; white-space: normal; line-height: 1.45; }
.address-choice-default { width: auto; flex-shrink: 0; font-size: 22rpx; color: #1E6FE0; }

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

.product-choice-search {
	margin: 18rpx 24rpx 8rpx;
	padding: 0 22rpx;
	min-height: 76rpx;
	display: flex;
	align-items: center;
	gap: 16rpx;
	border: 2rpx solid #D7E3FA;
	border-radius: 16rpx;
	background: #F7FAFF;
	box-sizing: border-box;
}

.product-choice-search .glyph-search {
	width: 30rpx;
	height: 30rpx;
	flex-shrink: 0;
	color: #5A6C8D;
}

.product-choice-search input {
	min-width: 0;
	flex: 1;
	height: 72rpx;
	font-size: 26rpx;
	color: #0F1F3A;
}

.choice-scroll {
	height: calc(70vh - 92rpx);
	flex: 1;
	min-height: 0;
	max-height: calc(70vh - 92rpx);
	-webkit-overflow-scrolling: touch;
	overscroll-behavior: contain;
}

.product-choice-scroll {
	height: calc(70vh - 192rpx);
	max-height: calc(70vh - 192rpx);
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

.choice-row-product > view:first-child {
	min-width: 0;
	flex: 1;
	display: flex;
	flex-direction: column;
	gap: 8rpx;
	padding: 20rpx 20rpx 20rpx 0;
}

.choice-row-product > view:first-child text:first-child {
	font-size: 28rpx;
	color: #0F1F3A;
}

.choice-row-product > view:first-child text + text {
	font-size: 23rpx;
	line-height: 1.45;
	color: #94A3B8;
}

.choice-row-other {
	background: #F7FAFF;
}

.choice-row-other > view:first-child text:first-child {
	color: #1E6FE0;
	font-weight: 700;
}

.choice-empty {
	padding: 56rpx 32rpx;
	text-align: center;
	font-size: 26rpx;
	line-height: 1.5;
	color: #94A3B8;
}

.doc-hero {
	padding: 36rpx;
	border-radius: 28rpx;
	background: linear-gradient(180deg, #1E6FE0 0%, #3A86FF 100%);
	color: #FFFFFF;
	box-shadow: 0 20rpx 48rpx -18rpx rgba(30, 111, 224, 0.55);
	box-sizing: border-box;
}

.doc-hero .glyph {
	width: 72rpx;
	height: 72rpx;
	color: #FFFFFF;
}

.doc-hero > text:first-child,
.doc-hero > text:nth-child(2),
.doc-hero > view text:first-child {
	margin-top: 12rpx;
	font-size: 40rpx;
	font-weight: 800;
	color: #FFFFFF;
}

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

.doc-paper,
.step-card {
	overflow: hidden;
}

.doc-paper {
	padding: 32rpx;
}

.warranty-paper {
	margin-top: 32rpx;
}

.policy-rich-content {
	padding: 32rpx 8rpx 80rpx;
	box-sizing: border-box;
	font-size: 28rpx;
	line-height: 1.8;
	color: #1F2A3D;
	word-break: break-word;
}

.warranty-module .dual-actions {
	margin-top: 36rpx;
	padding-bottom: 40rpx;
}

.policy-empty {
	display: block;
	padding: 96rpx 0;
	text-align: center;
	font-size: 26rpx;
	color: #86909C;
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
	flex-direction: column;
	gap: 14rpx;
}

.order-card-classic {
	padding: 28rpx 30rpx 26rpx;
	border-radius: 24rpx;
	background: rgba(255, 255, 255, 0.96);
	box-shadow: 0 10rpx 28rpx rgba(79, 112, 168, 0.08);
}

.order-card-head {
	min-width: 0;
	display: flex;
	align-items: center;
	justify-content: space-between;
	gap: 20rpx;
}

.order-card-no {
	min-width: 0;
	flex: 1;
	font-size: 22rpx;
	line-height: 1.35;
	color: #8795AB;
	white-space: nowrap;
	overflow: hidden;
	text-overflow: ellipsis;
}

.order-card-title {
	display: block;
	max-width: 100%;
	font-size: 30rpx;
	font-weight: 700;
	line-height: 1.35;
	color: #0F1F3A;
	white-space: nowrap;
	overflow: hidden;
	text-overflow: ellipsis;
}

.order-card-fault {
	max-width: 100%;
	font-size: 24rpx;
	line-height: 1.5;
	color: #6B7C97;
	display: -webkit-box;
	-webkit-box-orient: vertical;
	-webkit-line-clamp: 2;
	overflow: hidden;
}

.order-card-meta {
	max-width: 100%;
	display: flex;
	align-items: center;
	flex-wrap: wrap;
	gap: 10rpx 12rpx;
}

.order-card-meta text {
	min-width: 0;
	max-width: 100%;
	padding: 6rpx 12rpx;
	border-radius: 8rpx;
	background: #F3F8FF;
	color: #566A89;
	font-size: 22rpx;
	font-weight: 500;
	line-height: 1.35;
	white-space: nowrap;
	overflow: hidden;
	text-overflow: ellipsis;
}

.order-card-footer {
	min-width: 0;
	padding-top: 16rpx;
	display: flex;
	align-items: center;
	justify-content: space-between;
	gap: 20rpx;
	border-top: 2rpx solid #EEF3FA;
}

.order-card-date {
	min-width: 0;
	font-size: 22rpx;
	line-height: 1.3;
	color: #8795AB;
	white-space: nowrap;
}

.order-card-action {
	display: flex;
	align-items: center;
	justify-content: flex-end;
	gap: 10rpx;
	flex-shrink: 0;
	font-size: 22rpx;
	font-weight: 600;
	line-height: 1.2;
	color: #1E6FE0;
}

.order-card-price {
	margin-right: 6rpx;
	font-size: 26rpx;
	font-weight: 800;
	line-height: 1.2;
	color: #0F1F3A;
}

.order-card-chevron {
	width: 12rpx;
	height: 12rpx;
	border-top: 3rpx solid currentColor;
	border-right: 3rpx solid currentColor;
	transform: rotate(45deg);
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

.product-title {
	font-size: 28rpx;
	font-weight: 700;
	line-height: 1.35;
	color: #0F1F3A;
}

.product-meta {
	font-size: 22rpx;
	line-height: 1.45;
	color: #94A3B8;
}

.product-order {
	font-size: 26rpx;
	font-weight: 500;
	line-height: 1.45;
	color: #0F1F3A;
	word-break: break-all;
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
	display: flex;
	align-items: flex-start;
	gap: 16rpx;
	border-radius: 20rpx;
	background: #F7FAFF;
	box-sizing: border-box;
}

.feedback-ticket-meta view {
	width: 0;
	min-width: 0;
	flex: 1;
	display: flex;
	flex-direction: column;
	gap: 6rpx;
}

.feedback-ticket-meta text:first-child {
	font-size: 21rpx;
	color: #94A3B8;
}

.feedback-ticket-meta text:last-child {
	display: block;
	width: 100%;
	min-width: 0;
	font-size: 24rpx;
	font-weight: 700;
	line-height: 1.4;
	word-break: break-all;
	overflow-wrap: anywhere;
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
	display: block;
	flex: 0 0 112rpx;
	width: 112rpx;
	height: 112rpx;
	border-radius: 14rpx;
	background: #F3F8FF;
	overflow: hidden;
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
	margin: 0 -28rpx;
	padding: 0;
}

.login-auth-image {
	display: none;
}

.login-device-ghost {
	position: absolute;
	right: -110rpx;
	top: 430rpx;
	z-index: 1;
	width: 260rpx;
	height: 530rpx;
	border: 8rpx solid rgba(62, 157, 235, 0.12);
	border-radius: 80rpx;
	transform: rotate(18deg);
}

.login-device-ghost::before,
.login-device-ghost::after {
	content: "";
	position: absolute;
	box-sizing: border-box;
}

.login-device-ghost::before {
	left: 46rpx;
	top: 72rpx;
	width: 120rpx;
	height: 300rpx;
	border: 6rpx solid rgba(62, 157, 235, 0.1);
	border-radius: 60rpx;
}

.login-device-ghost::after {
	left: 86rpx;
	bottom: 48rpx;
	width: 86rpx;
	height: 86rpx;
	border: 6rpx solid rgba(62, 157, 235, 0.1);
	border-radius: 50%;
}

.login-back-button {
	position: absolute;
	left: 32rpx;
	top: 88rpx;
	z-index: 8;
	width: 72rpx;
	height: 72rpx;
	display: flex;
	align-items: center;
	justify-content: center;
	border-radius: 999rpx;
	background: rgba(255, 255, 255, 0.94);
	box-shadow: 0 10rpx 24rpx rgba(30, 111, 224, 0.14);
}

.login-back-button view {
	width: 20rpx;
	height: 20rpx;
	margin-left: 8rpx;
	border-left: 4rpx solid #2B7DE9;
	border-bottom: 4rpx solid #2B7DE9;
	transform: rotate(45deg);
}

.login-brand-panel {
	position: relative;
	z-index: 2;
	padding-top: 420rpx;
	display: flex;
	flex-direction: column;
	align-items: center;
	text-align: center;
}

.login-brand-logo {
	width: 420rpx;
	height: 98rpx;
}

.login-brand-title {
	margin-top: 118rpx;
	font-size: 54rpx;
	font-weight: 800;
	line-height: 1.2;
	color: #10264A;
	letter-spacing: 1rpx;
}

.login-brand-slogan {
	margin-top: 36rpx;
	display: flex;
	align-items: center;
	justify-content: center;
	gap: 24rpx;
}

.login-brand-slogan view {
	width: 72rpx;
	height: 2rpx;
	background: #2B8BFF;
}

.login-brand-slogan text {
	font-size: 29rpx;
	font-weight: 700;
	line-height: 1.2;
	color: #1684F6;
	letter-spacing: 6rpx;
}

.login-auth-button {
	position: relative;
	z-index: 3;
	width: 100%;
	height: 124rpx;
	margin: 256rpx 0 0;
	padding: 0;
	border: none;
	border-radius: 24rpx;
	display: flex;
	align-items: center;
	justify-content: center;
	gap: 24rpx;
	background: linear-gradient(135deg, #46A0FF 0%, #0075F6 100%);
	box-shadow: 0 22rpx 44rpx rgba(0, 117, 246, 0.22);
	color: #FFFFFF;
	font-size: 34rpx;
	font-weight: 800;
	line-height: 124rpx;
}

.login-auth-button::after {
	border: none;
}

.login-auth-button[disabled] {
	opacity: 0.7;
}

.wechat-login-icon {
	position: relative;
	width: 64rpx;
	height: 50rpx;
	flex-shrink: 0;
}

.wechat-login-icon view {
	position: absolute;
	border-radius: 50%;
	background: #FFFFFF;
}

.wechat-login-icon view:first-child {
	left: 0;
	top: 0;
	width: 42rpx;
	height: 36rpx;
}

.wechat-login-icon view:first-child::before,
.wechat-login-icon view:first-child::after,
.wechat-login-icon view:last-child::before,
.wechat-login-icon view:last-child::after {
	content: "";
	position: absolute;
	width: 5rpx;
	height: 5rpx;
	border-radius: 50%;
	background: #1684F6;
}

.wechat-login-icon view:first-child::before {
	left: 11rpx;
	top: 13rpx;
}

.wechat-login-icon view:first-child::after {
	left: 25rpx;
	top: 13rpx;
}

.wechat-login-icon view:last-child {
	right: 0;
	bottom: 0;
	width: 38rpx;
	height: 32rpx;
	box-shadow: 0 0 0 4rpx #1684F6;
}

.wechat-login-icon view:last-child::before {
	left: 10rpx;
	top: 11rpx;
}

.wechat-login-icon view:last-child::after {
	left: 23rpx;
	top: 11rpx;
}

.login-consent-panel {
	position: relative;
	z-index: 5;
	width: 100%;
	min-height: 72rpx;
	margin-top: 80rpx;
	padding: 0 12rpx;
	display: flex;
	flex-direction: column;
	align-items: center;
	justify-content: flex-start;
	gap: 12rpx;
	background: transparent;
	box-sizing: border-box;
}

.login-consent-check {
	width: 100%;
	display: flex;
	align-items: center;
	justify-content: center;
	flex-wrap: wrap;
	gap: 7rpx;
	font-size: 23rpx;
	line-height: 1.4;
	color: #8A97AA;
	text-align: center;
}

.login-checkbox {
	width: 28rpx;
	height: 28rpx;
	flex: 0 0 28rpx;
	display: flex;
	align-items: center;
	justify-content: center;
	border: 2rpx solid #9AA9BF;
	border-radius: 6rpx;
	background: rgba(255, 255, 255, 0.9);
	box-sizing: border-box;
}

.login-checkbox.checked {
	border-color: #1E7DF2;
	background: #1E7DF2;
}

.login-checkbox text {
	font-size: 22rpx;
	line-height: 1;
	color: #FFFFFF;
	font-weight: 900;
}

.login-policy-link {
	color: #1E7DF2;
	text-decoration: underline;
}

.login-save-tip {
	margin-top: 34rpx;
	font-size: 24rpx;
	line-height: 1.4;
	color: #A2ACBA;
	text-align: center;
}

.login-image-error {
	width: 100%;
	padding: 0;
	text-align: center;
	font-size: 21rpx;
	line-height: 1.45;
	color: #E5484D;
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

/* 教程媒体列表 */
.guide-media-list { background: #fff; border-radius: 16rpx; padding: 8rpx 24rpx; margin-bottom: 20rpx; }
.guide-media-item { display: flex; align-items: center; gap: 16rpx; padding: 20rpx 0; border-bottom: 1px solid #f7f8fa; }
.guide-media-item:last-child { border-bottom: none; }
.guide-media-type { font-size: 24rpx; color: #1E6FE0; flex-shrink: 0; }
.guide-media-name { flex: 1; font-size: 26rpx; color: #1d2129; overflow: hidden; white-space: nowrap; text-overflow: ellipsis; }
.guide-media-open { font-size: 24rpx; color: #86909c; flex-shrink: 0; }

/* ============== 编辑资料入口 + 弹层 ============== */
.profile-name-row { display: flex; align-items: center; gap: 12rpx; }
.profile-edit-tag {
	font-size: 21rpx; line-height: 1; color: #FFFFFF;
	padding: 5rpx 14rpx; border-radius: 999rpx;
	background: rgba(255, 255, 255, 0.22);
}
.avatar .avatar-image { width: 120rpx; height: 120rpx; border-radius: 999rpx; }

.edit-mask {
	position: fixed; left: 0; right: 0; top: 0; bottom: 0;
	z-index: 200; background: rgba(15, 23, 42, 0.45);
	display: flex; align-items: flex-end;
}
.edit-sheet {
	width: 100%; background: #FFFFFF; border-radius: 28rpx 28rpx 0 0;
	padding: 36rpx 40rpx calc(40rpx + constant(safe-area-inset-bottom));
	padding: 36rpx 40rpx calc(40rpx + env(safe-area-inset-bottom));
	box-sizing: border-box;
}
.edit-title { font-size: 32rpx; font-weight: 700; color: #1E293B; text-align: center; margin-bottom: 32rpx; }
.edit-avatar-row { display: flex; flex-direction: column; align-items: center; gap: 12rpx; margin-bottom: 32rpx; }
.edit-avatar-btn {
	width: 140rpx; height: 140rpx; padding: 0; border-radius: 999rpx; overflow: hidden;
	background: #F1F5F9; border: 2rpx solid #E4ECF7;
	display: flex; align-items: center; justify-content: center; line-height: 1;
}
.edit-avatar-btn::after { border: none; }
.edit-avatar-img { width: 140rpx; height: 140rpx; display: block; }
.edit-avatar-ph { font-size: 24rpx; color: #94A3B8; }
.edit-avatar-hint { font-size: 22rpx; color: #94A3B8; }
.edit-field { display: flex; align-items: center; gap: 20rpx; padding: 24rpx 0; border-top: 2rpx solid #F1F5F9; }
.edit-label { font-size: 28rpx; color: #475569; width: 96rpx; flex-shrink: 0; }
.edit-input { flex: 1; font-size: 28rpx; color: #1E293B; text-align: right; }
.edit-input-ph { color: #CBD5E1; }
.edit-actions { display: flex; gap: 20rpx; margin-top: 36rpx; }
.edit-btn { flex: 1; height: 84rpx; border-radius: 16rpx; display: flex; align-items: center; justify-content: center; font-size: 30rpx; font-weight: 600; }
.edit-btn.cancel { background: #F1F5F9; color: #475569; }
.edit-btn.save { background: #1E6FE0; color: #FFFFFF; }
.edit-btn.save.disabled { opacity: 0.6; }
</style>



