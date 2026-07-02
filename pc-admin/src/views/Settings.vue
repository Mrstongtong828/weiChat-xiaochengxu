<template>
  <div class="glass-card">
    <div class="section-title">
      <div>
        <span>系统配置</span>
        <p class="section-desc">维护保修政策、收费办法、基础收费项、隐私合规文案和小程序联系方式。</p>
      </div>
    </div>
    <el-tabs v-model="activeContentTab" class="modern-tabs">
      <el-tab-pane label="保修与收费" name="policy">
        <div class="field-title policy-field-title" style="margin-top:20px;">
          <span>保修政策总述</span>
          <el-button type="primary" link @click="openPolicyPreview('warranty')"><el-icon><View /></el-icon>预览小程序效果</el-button>
        </div>
        <div class="sub-label">直接填写保修政策内容，支持图文；保存后同步至小程序「保修政策」页展示。</div>
        <RichEditor v-model="config.warranty" upload-dir="warranty/" placeholder="填写保修政策总述，如质保范围、保修期限、免责情形等…" />

        <div class="qual-head" style="margin-top:24px;">
          <span>保修政策分块（小程序按块展示）</span>
          <el-button type="primary" link @click="addWarrantySection">+ 新增分块</el-button>
        </div>
        <div class="sub-label">配置后小程序保修政策页按「保修范围 / 保修期限 / 不保情形 / 收费说明 / 寄修注意 / 常见问答」等分块卡片展示；不配置则整段展示上方总述。</div>
        <div v-if="!warrantySections.length" class="empty-tip">暂未配置分块，小程序将展示上方「保修政策总述」整段内容。</div>
        <div v-for="(section, index) in warrantySections" :key="index" class="warranty-section-editor">
          <div class="warranty-section-editor-head">
            <el-input v-model="section.title" placeholder="分块标题，如：保修范围" style="max-width:320px;" />
            <div class="warranty-section-editor-actions">
              <el-button :disabled="index === 0" link @click="moveWarrantySection(index, -1)">上移</el-button>
              <el-button :disabled="index === warrantySections.length - 1" link @click="moveWarrantySection(index, 1)">下移</el-button>
              <el-button type="danger" link @click="warrantySections.splice(index, 1)">删除</el-button>
            </div>
          </div>
          <RichEditor v-model="section.content" upload-dir="warranty/" placeholder="填写该分块的内容，支持图文…" />
        </div>

        <div class="field-title policy-field-title" style="margin-top:24px;">
          <span>收费办法说明</span>
          <el-button type="primary" link @click="openPolicyPreview('fees')"><el-icon><View /></el-icon>预览小程序效果</el-button>
        </div>
        <div class="sub-label">直接填写收费办法说明，支持图文；保存后同步至小程序「收费指南」页展示。</div>
        <RichEditor v-model="config.feePolicy" upload-dir="fees/" placeholder="填写收费办法说明，如检测费、维修费、加急费的计费规则等…" />

        <div class="qual-head">
          <span>过保收费阶梯模板</span>
          <el-button type="primary" link @click="addFeeTier">+ 新增收费项</el-button>
        </div>
        <div v-if="!feeTiers.length" class="empty-tip">预设检测费、基础维修费、加急服务费等标准价，报价弹窗可一键带出；小程序收费指南展示价格表。</div>
        <el-table v-else :data="feeTiers" class="modern-table" style="width:100%;">
          <el-table-column label="收费项" width="200">
            <template #default="{ row }"><el-input v-model="row.name" placeholder="如 检测费 / 加急服务费" /></template>
          </el-table-column>
          <el-table-column label="标准价(元)" width="160">
            <template #default="{ row }"><el-input-number v-model="row.price" :min="0" :step="10" controls-position="right" style="width:100%;" /></template>
          </el-table-column>
          <el-table-column label="单位" width="120">
            <template #default="{ row }"><el-input v-model="row.unit" placeholder="如 次 / 台" /></template>
          </el-table-column>
          <el-table-column label="备注">
            <template #default="{ row }"><el-input v-model="row.note" placeholder="选填说明" /></template>
          </el-table-column>
          <el-table-column label="操作" width="80" align="right" fixed="right">
            <template #default="{ $index }"><el-button type="danger" link @click="feeTiers.splice($index, 1)">删除</el-button></template>
          </el-table-column>
        </el-table>

        <div class="save-row"><el-button type="primary" :loading="savingPolicy" @click="saveConfig">保存配置</el-button></div>
      </el-tab-pane>

      <el-tab-pane label="操作教程" name="guides">
        <el-alert
          title="这里维护小程序首页两个操作教程按钮，并管理首页「维修保养」视频。上传 PDF 或 Word 后，用户点击对应按钮会直接打开该文档。"
          type="info"
          show-icon
          :closable="false"
          style="margin: 20px 0;"
        />
        <div class="guide-document-grid">
          <div v-for="guide in guideDocuments" :key="guide.type" class="policy-document-card guide-document-card">
            <div class="policy-document-main">
              <el-icon class="policy-document-icon"><Document /></el-icon>
              <div class="policy-document-copy guide-document-copy">
                <div class="policy-document-title">{{ guide.category }}</div>
                <el-input
                  v-model="guide.desc"
                  class="guide-document-desc-input"
                  type="textarea"
                  :rows="2"
                  placeholder="填写这份教程在小程序中的简要说明"
                />
                <div v-if="guide.file_name" class="policy-document-file">
                  <span>{{ guide.file_name }}</span>
                  <em v-if="guide.updatedAt">更新于 {{ guide.updatedAt }}</em>
                </div>
                <div v-else class="policy-document-empty">暂未上传教程文件</div>
              </div>
            </div>
            <div class="policy-document-actions">
              <el-upload action="#" :auto-upload="false" :show-file-list="false" accept=".pdf,.doc,.docx" :on-change="(file) => handleGuideDocumentUpload(file, guide)">
                <el-button type="primary" :loading="uploadingGuideType === guide.type">
                  <el-icon><Upload /></el-icon>{{ guide.file_url ? '替换文件' : '上传文件' }}
                </el-button>
              </el-upload>
              <el-button v-if="guide.file_url" plain @click="openGuideDocument(guide)"><el-icon><View /></el-icon>预览</el-button>
              <el-button v-if="guide.file_url" type="danger" link @click="removeGuideDocument(guide)">移除</el-button>
            </div>
          </div>
        </div>
        <div class="qual-head maintenance-video-head">
          <span>维修保养视频</span>
          <el-button type="primary" link @click="addMaintenanceVideo">+ 新增视频</el-button>
        </div>
        <div class="sub-label">保存后展示在小程序首页「操作教程」下方的「维修保养」视频区。适合上传手机维护保养、注油、清洁消毒等教学视频。</div>
        <div class="product-video-list maintenance-video-list-admin">
          <div v-for="(video, index) in maintenanceVideos" :key="video._key" class="policy-document-card product-video-card">
            <div class="product-video-cover">
              <img v-if="video.coverPreview" :src="video.coverPreview" class="product-video-cover-img" />
              <div v-else class="product-video-cover-empty">无封面</div>
              <el-upload action="#" :auto-upload="false" :show-file-list="false" accept=".png,.jpg,.jpeg,.webp" :on-change="(file) => handleVideoCoverUpload(file, video, 'maintenance-video/')">
                <el-button size="small" plain><el-icon><Upload /></el-icon>{{ video.cover_url ? '换封面' : '封面' }}</el-button>
              </el-upload>
            </div>
            <div class="product-video-fields">
              <el-input v-model="video.title" placeholder="视频标题，如：NSK牙科手机维护保养指南——手动注油" maxlength="50" show-word-limit />
              <el-input v-model="video.intro" type="textarea" :rows="2" placeholder="一句话简介（可选）" maxlength="120" show-word-limit style="margin-top:8px;" />
              <div class="product-video-fileline">
                <el-tag v-if="video.video_name" type="success" effect="plain"><el-icon><VideoPlay /></el-icon> {{ video.video_name }}</el-tag>
                <span v-else class="policy-document-empty">暂未上传视频</span>
                <el-upload action="#" :auto-upload="false" :show-file-list="false" accept="video/*,.mp4,.mov,.m4v,.webm" :on-change="(file) => handleVideoUpload(file, video, 'maintenance-video/')">
                  <el-button type="primary" size="small" :loading="uploadingVideoKey === video._key"><el-icon><Upload /></el-icon>{{ uploadingVideoKey === video._key ? `上传中 ${video._progress || 0}%` : (video.video_url ? '替换视频' : '上传视频') }}</el-button>
                </el-upload>
                <el-button v-if="video.video_url" plain size="small" @click="previewVideo(video, '维修保养')"><el-icon><View /></el-icon>预览</el-button>
              </div>
            </div>
            <el-button class="product-video-del" type="danger" link @click="removeMaintenanceVideo(index)">删除</el-button>
          </div>
          <div v-if="!maintenanceVideos.length" class="empty-tip">还没有维修保养视频，点击上方「新增视频」添加。</div>
        </div>
        <div class="save-row guide-save-row">
          <el-button type="primary" :loading="savingGuides" @click="saveGuideDocuments">保存操作教程配置</el-button>
          <el-button type="primary" :loading="savingMaintenanceVideos" @click="saveMaintenanceVideos">保存维修保养视频</el-button>
        </div>
      </el-tab-pane>

      <el-tab-pane label="隐私与合规" name="compliance">
        <el-alert
          title="医疗器械小程序上线必备：隐私政策、账号注销规则、资质公示。保存后小程序端实时读取并展示。"
          type="warning"
          show-icon
          :closable="false"
          style="margin: 20px 0;"
        />

        <div class="field-title">隐私政策</div>
        <RichEditor v-model="compliance.privacy_policy" upload-dir="compliance/" placeholder="完整隐私协议，支持图文，一键同步至小程序隐私弹窗（个人信息收集用途也写在此处即可）…" />

        <div class="field-title" style="margin-top:20px;">账号注销规则</div>
        <el-input v-model="compliance.account_cancellation_policy" type="textarea" :rows="3" placeholder="账号注销流程与数据删除规则（满足《个人信息保护法》），简要说明即可" />

        <div class="qual-head">
          <span>资质公示</span>
          <el-button type="primary" link @click="addQualification">+ 新增资质</el-button>
        </div>
        <div v-if="!qualifications.length" class="empty-tip">还没有资质，点击右上角“新增资质”。小程序「公司介绍 / 关于我们」会自动读取展示。</div>
        <div v-for="(item, index) in qualifications" :key="index" class="qual-card">
          <div class="qual-row">
            <el-input v-model="item.name" placeholder="资质名称，如《医疗器械生产许可证》" style="max-width:360px;" />
            <el-radio-group v-model="item.type">
              <el-radio-button label="image">图片</el-radio-button>
              <el-radio-button label="text">文本</el-radio-button>
            </el-radio-group>
            <el-button type="danger" link @click="qualifications.splice(index, 1)">删除</el-button>
          </div>
          <div v-if="item.type === 'image'" class="qual-img-row">
            <el-upload action="#" :auto-upload="false" :show-file-list="false" accept=".png,.jpg,.jpeg,.webp" :on-change="(f) => handleQualImage(f, item)">
              <el-button>{{ item.imageUrl ? '更换图片' : '上传图片' }}</el-button>
            </el-upload>
            <img v-if="qualPreview(item)" :src="qualPreview(item)" class="qual-thumb" />
            <span v-else-if="item.imageUrl" class="preview-hint">图片已上传（云存储）</span>
          </div>
          <el-input v-else v-model="item.text" type="textarea" :rows="3" placeholder="资质说明文本，如备案号、有效期等" />
        </div>

        <el-divider />

        <div class="qual-head">
          <span>小程序体验版二维码</span>
        </div>
        <div class="empty-tip">上传微信公众平台「版本管理」的体验版/开发版二维码。后台顶栏「访问小程序」按钮会弹出此码供员工扫码预览客户端；换版后重新上传即可（员工微信需先在公众平台「成员管理」加为体验成员）。</div>
        <div class="qual-img-row">
          <el-upload action="#" :auto-upload="false" :show-file-list="false" accept=".png,.jpg,.jpeg,.webp" :on-change="handleMiniappQr">
            <el-button>{{ miniappQr ? '更换二维码' : '上传二维码' }}</el-button>
          </el-upload>
          <img v-if="miniappQrPreview" :src="miniappQrPreview" class="qual-thumb" />
          <span v-else-if="miniappQr" class="preview-hint">二维码已上传（云存储）</span>
          <el-button v-if="miniappQr" type="danger" link @click="removeMiniappQr">移除</el-button>
        </div>

        <div class="save-row"><el-button type="primary" :loading="savingCompliance" @click="saveCompliance">保存隐私与合规配置</el-button></div>
      </el-tab-pane>

      <el-tab-pane label="联系与公众号" name="contact">
        <el-alert
          title="以下内容直接展示在小程序首页与「关于我们」：企业联系方式、在线客服和公众号二维码。保存后小程序端实时读取展示。"
          type="info"
          show-icon
          :closable="false"
          style="margin: 20px 0;"
        />

        <div class="field-title">企业联系方式</div>
        <el-form :model="contactInfo" label-width="110px" class="print-form">
          <el-form-item label="公司名称"><el-input v-model="contactInfo.company_name" placeholder="如 XX 牙科设备维修中心" /></el-form-item>
          <el-form-item label="联系电话"><el-input v-model="contactInfo.contact_phone" placeholder="客服/售后电话" /></el-form-item>
          <el-form-item label="联系邮箱"><el-input v-model="contactInfo.contact_email" placeholder="选填" /></el-form-item>
          <el-form-item label="联系地址"><el-input v-model="contactInfo.contact_address" placeholder="寄修/办公地址" /></el-form-item>
          <el-form-item label="工作时间"><el-input v-model="contactInfo.work_time" placeholder="如 周一至周六 9:00-18:00" /></el-form-item>
        </el-form>

        <div class="field-title" style="margin-top:20px;">对公转账账户</div>
        <el-alert
          title="客户小程序「对公银行转账」弹窗会读取这里；转账备注仍要求填写工单编号。"
          type="warning"
          show-icon
          :closable="false"
          style="margin-bottom: 12px;"
        />
        <el-form :model="contactInfo" label-width="110px" class="print-form">
          <el-form-item label="户名"><el-input v-model="contactInfo.bank_transfer_company_name" placeholder="收款公司全称" /></el-form-item>
          <el-form-item label="纳税人识别号"><el-input v-model="contactInfo.bank_transfer_tax_no" placeholder="选填，用于财务核对" /></el-form-item>
          <el-form-item label="地址及电话"><el-input v-model="contactInfo.bank_transfer_address_phone" placeholder="营业地址 / 电话" /></el-form-item>
          <el-form-item label="开户行"><el-input v-model="contactInfo.bank_transfer_bank_name" placeholder="开户银行全称" /></el-form-item>
          <el-form-item label="对公账号"><el-input v-model="contactInfo.bank_transfer_account_no" placeholder="对公银行账号" /></el-form-item>
          <el-form-item label="行号"><el-input v-model="contactInfo.bank_transfer_line_no" placeholder="开户行行号 / 联行号" /></el-form-item>
        </el-form>

        <div class="field-title" style="margin-top:20px;">在线客服</div>
        <el-form :model="contactInfo" label-width="110px" class="print-form">
          <el-form-item label="客服标题"><el-input v-model="contactInfo.customer_service_title" placeholder="如 人工客服" /></el-form-item>
          <el-form-item label="客服说明"><el-input v-model="contactInfo.customer_service_desc" type="textarea" :rows="2" placeholder="客服介绍 / 服务时间" /></el-form-item>
          <el-form-item label="客服微信号"><el-input v-model="contactInfo.customer_service_wechat" placeholder="微信号，便于客户添加" /></el-form-item>
          <el-form-item label="客服二维码">
            <div class="logo-row">
              <el-upload action="#" :auto-upload="false" :show-file-list="false" accept=".png,.jpg,.jpeg,.webp" :on-change="(f) => handleQrUpload(f, 'customer_service_qrcode')">
                <el-button>{{ contactInfo.customer_service_qrcode ? '更换二维码' : '上传二维码' }}</el-button>
              </el-upload>
              <img v-if="qrPreview('customer_service_qrcode')" :src="qrPreview('customer_service_qrcode')" class="qual-thumb" />
              <el-button v-if="contactInfo.customer_service_qrcode" type="danger" link @click="contactInfo.customer_service_qrcode = ''">移除</el-button>
            </div>
          </el-form-item>
        </el-form>

        <div class="field-title" style="margin-top:20px;">公众号</div>
        <el-form :model="contactInfo" label-width="110px" class="print-form">
          <el-form-item label="公众号名称"><el-input v-model="contactInfo.wechat_name" placeholder="公众号名称" /></el-form-item>
          <el-form-item label="公众号简介"><el-input v-model="contactInfo.wechat_desc" type="textarea" :rows="2" placeholder="关注引导文案" /></el-form-item>
          <el-form-item label="公众号二维码">
            <div class="logo-row">
              <el-upload action="#" :auto-upload="false" :show-file-list="false" accept=".png,.jpg,.jpeg,.webp" :on-change="(f) => handleQrUpload(f, 'wechat_qrcode')">
                <el-button>{{ contactInfo.wechat_qrcode ? '更换二维码' : '上传二维码' }}</el-button>
              </el-upload>
              <img v-if="qrPreview('wechat_qrcode')" :src="qrPreview('wechat_qrcode')" class="qual-thumb" />
              <el-button v-if="contactInfo.wechat_qrcode" type="danger" link @click="contactInfo.wechat_qrcode = ''">移除</el-button>
            </div>
          </el-form-item>
        </el-form>

        <div class="save-row"><el-button type="primary" :loading="savingContact" @click="saveContact">保存联系与公众号配置</el-button></div>
      </el-tab-pane>

      <el-tab-pane label="调研有礼" name="survey">
        <el-alert
          title="这里维护小程序「调研有礼」页面。保存后小程序会动态读取最新标题、说明、选项和提交成功提示；客户后续修改内容无需重新发布小程序。"
          type="info"
          show-icon
          :closable="false"
          style="margin: 20px 0;"
        />

        <el-form :model="surveyConfig" label-width="120px" class="print-form">
          <el-form-item label="是否启用">
            <el-switch v-model="surveyConfig.enabled" active-text="启用" inactive-text="停用" />
          </el-form-item>
          <el-form-item label="页面标题"><el-input v-model="surveyConfig.title" placeholder="如 售后服务调研表" /></el-form-item>
          <el-form-item label="页面说明"><el-input v-model="surveyConfig.subtitle" type="textarea" :rows="2" placeholder="展示在标题下方的说明文案" /></el-form-item>
          <el-form-item label="福利说明"><el-input v-model="surveyConfig.giftText" placeholder="如 提交后由工作人员核对并登记福利" /></el-form-item>
          <el-form-item label="满意度选项"><el-input v-model="surveySatisfactionText" placeholder="用逗号分隔，如 满意,一般,不满意" /></el-form-item>
          <el-form-item label="解决状态选项"><el-input v-model="surveyResolvedText" placeholder="用逗号分隔，如 已解决,处理中,未解决" /></el-form-item>
          <el-form-item label="评分上限"><el-input-number v-model="surveyConfig.ratingMax" :min="1" :max="10" controls-position="right" /></el-form-item>
          <el-form-item label="成功标题"><el-input v-model="surveyConfig.successTitle" placeholder="如 提交成功" /></el-form-item>
          <el-form-item label="成功提示"><el-input v-model="surveyConfig.successMessage" type="textarea" :rows="2" placeholder="提交成功后弹窗展示的内容" /></el-form-item>
        </el-form>
        <div class="save-row"><el-button type="primary" :loading="savingSurvey" @click="saveSurveyConfig">保存调研配置</el-button></div>

        <el-divider />

        <div class="qual-head">
          <span>调研提交记录</span>
          <el-button type="primary" link :loading="surveyLoading" @click="loadSurveyRecords">刷新记录</el-button>
        </div>
        <div class="survey-toolbar">
          <el-input v-model="surveyQuery.keyword" clearable placeholder="搜索工单号 / 联系方式 / 内容" style="max-width:320px;" @keyup.enter="loadSurveyRecords" />
          <el-select v-model="surveyQuery.status" clearable placeholder="处理状态" style="width:160px;" @change="loadSurveyRecords">
            <el-option label="新提交" value="new" />
            <el-option label="已联系" value="contacted" />
            <el-option label="已关闭" value="closed" />
          </el-select>
          <el-button @click="loadSurveyRecords">查询</el-button>
        </div>
        <el-table :data="surveyRecords" v-loading="surveyLoading" class="modern-table" style="width:100%; margin-top:12px;">
          <el-table-column prop="order_no" label="工单号 / SN" width="150" show-overflow-tooltip />
          <el-table-column prop="satisfaction" label="满意度" width="100" />
          <el-table-column prop="rating" label="评分" width="80" />
          <el-table-column prop="resolved" label="是否解决" width="110" />
          <el-table-column prop="comment" label="反馈内容" min-width="220" show-overflow-tooltip />
          <el-table-column prop="contact" label="联系方式" width="150" show-overflow-tooltip />
          <el-table-column label="提交时间" width="170">
            <template #default="{ row }">{{ formatSurveyTime(row.create_time) }}</template>
          </el-table-column>
          <el-table-column label="状态" width="130">
            <template #default="{ row }">
              <el-select :model-value="row.status || 'new'" size="small" @change="(status) => changeSurveyStatus(row, status)">
                <el-option label="新提交" value="new" />
                <el-option label="已联系" value="contacted" />
                <el-option label="已关闭" value="closed" />
              </el-select>
            </template>
          </el-table-column>
        </el-table>
        <div class="survey-pagination">
          <el-pagination
            v-model:current-page="surveyQuery.page"
            v-model:page-size="surveyQuery.pageSize"
            :total="surveyTotal"
            :page-sizes="[10, 20, 50]"
            layout="total, sizes, prev, pager, next"
            @size-change="loadSurveyRecords"
            @current-change="loadSurveyRecords"
          />
        </div>
      </el-tab-pane>
    </el-tabs>

    <!-- 小程序页面效果预览 -->
    <el-dialog v-model="policyPreviewVisible" title="小程序效果预览" width="440px" append-to-body class="policy-preview-dialog">
      <div class="mp-preview-switch">
        <el-radio-group v-model="policyPreviewTab" size="small">
          <el-radio-button label="warranty">保修政策</el-radio-button>
          <el-radio-button label="fees">收费指南</el-radio-button>
        </el-radio-group>
      </div>
      <div class="mp-phone">
        <div class="mp-phone-notch"></div>
        <div class="mp-phone-header">{{ policyPreviewTab === 'warranty' ? '保修政策' : '收费指南' }}</div>
        <div class="mp-phone-body">
          <template v-if="policyPreviewTab === 'warranty'">
            <template v-if="previewWarrantySections.length">
              <div v-for="(section, index) in previewWarrantySections" :key="index" class="mp-warranty-section">
                <div class="mp-warranty-section-title">{{ section.title || '未命名分块' }}</div>
                <div class="mp-rich" v-html="section.content"></div>
              </div>
            </template>
            <div v-else-if="config.warranty" class="mp-rich" v-html="config.warranty"></div>
            <div v-else class="mp-empty">暂无保修政策内容</div>
          </template>
          <template v-else>
            <div v-if="feeTiers.length" class="mp-fee-table">
              <div class="mp-fee-row mp-fee-head"><span>收费项</span><span>标准价</span></div>
              <div v-for="(t, i) in feeTiers" :key="i" class="mp-fee-row">
                <span class="mp-fee-name">{{ t.name || '未命名' }}<em v-if="t.note">{{ t.note }}</em></span>
                <span class="mp-fee-price">¥{{ t.price || 0 }}<i v-if="t.unit">/{{ t.unit }}</i></span>
              </div>
            </div>
            <div v-if="config.feePolicy" class="mp-rich" v-html="config.feePolicy"></div>
            <div v-if="!feeTiers.length && !config.feePolicy" class="mp-empty">暂无收费办法内容</div>
          </template>
        </div>
      </div>
      <div class="mp-preview-note">预览为后台配置示意，最终以小程序端实际展示为准。</div>
    </el-dialog>

    <!-- 视频·小程序效果预览 -->
    <el-dialog v-model="videoPreviewVisible" title="小程序效果预览" width="440px" append-to-body class="policy-preview-dialog" @closed="videoPlayUrl = ''">
      <div class="mp-phone">
        <div class="mp-phone-notch"></div>
        <div class="mp-phone-header">{{ videoPreviewContext }}</div>
        <div class="mp-phone-body">
          <div class="mp-video-card">
            <video
              v-if="videoPlayUrl"
              :src="videoPlayUrl"
              class="mp-video-player"
              controls
              autoplay
              playsinline
              :poster="videoPreviewItem && videoPreviewItem.coverPreview"
            ></video>
            <div v-else class="mp-video-loading">{{ videoPlayLoading ? '视频加载中…' : '视频地址无效，请确认已上传成功' }}</div>
            <div class="mp-video-meta">
              <div class="mp-video-title">{{ (videoPreviewItem && videoPreviewItem.title) || '未命名视频' }}</div>
              <div v-if="videoPreviewItem && videoPreviewItem.intro" class="mp-video-intro">{{ videoPreviewItem.intro }}</div>
            </div>
          </div>
        </div>
      </div>
      <div class="mp-preview-note">此为小程序视频区的展示效果预览。</div>
    </el-dialog>
  </div>
</template>

<script setup>
import { ref, reactive, computed, onMounted } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { saveSettings, getSettings, getTempFileURL, getSurveyList, updateSurveyStatus, getGuides, updateGuide, createGuide, deleteGuide } from '../api/admin.js'
import RichEditor from '../components/RichEditor.vue'
import { uploadFileToCloud } from '../utils/upload.js'
import { uploadToCos } from '../utils/cosUpload.js'

const activeContentTab = ref('policy')
const config = reactive({ warranty: '', feePolicy: '' })
const isWebUrl = (url = '') => /^https?:\/\//i.test(url)

// ===== 保修与收费 =====
const savingPolicy = ref(false)
const feeTiers = ref([])
// 保修政策分块（小程序按块渲染），存 warranty_policy_sections（JSON 数组 [{title, content}]）
const warrantySections = ref([])

// 小程序页面效果预览（保修政策页 / 收费指南页）
const policyPreviewVisible = ref(false)
const policyPreviewTab = ref('warranty')
const openPolicyPreview = (tab = 'warranty') => {
  policyPreviewTab.value = tab
  policyPreviewVisible.value = true
}

const parseJsonArray = (value) => {
  try {
    const parsed = value ? JSON.parse(value) : []
    return Array.isArray(parsed) ? parsed : []
  } catch (error) {
    return []
  }
}

// 在线查看文档：PDF 浏览器内联预览；Word/Excel/PPT 浏览器不支持内联（会直接下载），
// 改用微软 Office Online Viewer 在线渲染，实现「看效果」而非下载。需 url 为公网可访问地址。
const isOfficeDoc = (name = '') => /\.(docx?|xlsx?|pptx?)$/i.test(String(name || ''))
const openDocInViewer = (url, fileName = '') => {
  if (!url) return
  if (isOfficeDoc(fileName || url)) {
    window.open(`https://view.officeapps.live.com/op/view.aspx?src=${encodeURIComponent(url)}`, '_blank', 'noopener,noreferrer')
  } else {
    window.open(url, '_blank', 'noopener,noreferrer')
  }
}

const addFeeTier = () => feeTiers.value.push({ name: '', price: 0, unit: '次', note: '' })

const addWarrantySection = () => warrantySections.value.push({ title: '', content: '' })
const previewWarrantySections = computed(() => warrantySections.value.filter(s => (s.title || '').trim() || (s.content || '').trim()))
const moveWarrantySection = (index, offset) => {
  const target = index + offset
  if (target < 0 || target >= warrantySections.value.length) return
  const list = warrantySections.value
  ;[list[index], list[target]] = [list[target], list[index]]
}

// ===== 操作教程文档 =====
const GUIDE_TYPES = [
  { type: 'repair', category: '报修指南', desc: '说明报修流程、寄出注意事项和进度查询方式。', sort: 1 },
  { type: 'invoice', category: '开票指南', desc: '说明发票申请、抬头填写和寄送方式。', sort: 2 }
]
const guideDocuments = ref(GUIDE_TYPES.map(item => ({ ...item, _id: '', file_name: '', file_url: '', file_type: '', updatedAt: '' })))
const guidePreviewMap = reactive({})
const savingGuides = ref(false)
const uploadingGuideType = ref('')

const formatGuideUpdateTime = (value) => {
  if (!value) return ''
  const date = new Date(Number(value))
  if (Number.isNaN(date.getTime())) return String(value).slice(0, 10)
  return date.toISOString().slice(0, 10)
}

const normalizeGuideDocument = (guide = {}) => {
  const fallback = GUIDE_TYPES.find(item => item.type === guide.type) || GUIDE_TYPES.find(item => guide.category && item.category === guide.category) || GUIDE_TYPES[0]
  return {
    ...fallback,
    _id: guide._id || guide.id || '',
    type: guide.type || fallback.type,
    category: guide.category || fallback.category,
    desc: guide.desc !== undefined ? guide.desc : fallback.desc,
    file_name: guide.file_name || guide.fileName || '',
    file_url: guide.file_url || guide.fileUrl || '',
    file_type: guide.file_type || guide.fileType || '',
    sort: Number(guide.sort || fallback.sort) || fallback.sort,
    updatedAt: guide.updatedAt || formatGuideUpdateTime(guide.update_time)
  }
}

const loadGuides = async () => {
  try {
    const token = localStorage.getItem('adminToken')
    const list = await getGuides(token)
    const map = new Map((Array.isArray(list) ? list : []).map(item => [item.type, item]))
    guideDocuments.value = GUIDE_TYPES.map(item => normalizeGuideDocument(map.get(item.type) || item))
    guideDocuments.value.forEach(resolveGuideDocumentPreview)
  } catch (error) {
    console.error('加载操作教程失败:', error)
  }
}

const resolveGuideDocumentPreview = async (guide) => {
  if (!guide.file_url || isWebUrl(guide.file_url) || guidePreviewMap[guide.file_url]) return
  const token = localStorage.getItem('adminToken')
  try {
    const map = await getTempFileURL(token, [guide.file_url])
    if (map && map[guide.file_url]) {
      guidePreviewMap[guide.file_url] = map[guide.file_url]
    }
  } catch (error) {
    console.error('解析教程文件地址失败:', error)
  }
}

const handleGuideDocumentUpload = async (uploadFile, guide) => {
  const raw = uploadFile && uploadFile.raw
  if (!raw) return
  if (!/\.(pdf|doc|docx)$/i.test(raw.name || '')) {
    ElMessage.warning('请上传 PDF 或 Word 文档')
    return
  }
  try {
    uploadingGuideType.value = guide.type
    const { fileUrl, tempUrl } = await uploadFileToCloud(raw, 'guides/', 20 * 1024 * 1024)
    guide.file_name = raw.name
    guide.file_url = fileUrl
    guide.file_type = raw.type || ''
    guide.updatedAt = new Date().toISOString().slice(0, 10)
    if (tempUrl) guidePreviewMap[fileUrl] = tempUrl
    ElMessage.success(`${guide.category}文件上传成功`)
  } catch (error) {
    ElMessage.error(error.message || '上传失败')
  } finally {
    uploadingGuideType.value = ''
  }
}

const openGuideDocument = async (guide) => {
  if (!guide.file_url) {
    ElMessage.warning('请先上传教程文件')
    return
  }
  if (isWebUrl(guide.file_url)) {
    openDocInViewer(guide.file_url, guide.file_name)
    return
  }
  await resolveGuideDocumentPreview(guide)
  const url = guidePreviewMap[guide.file_url]
  if (url) {
    openDocInViewer(url, guide.file_name)
    return
  }
  ElMessage.info('文件已上传到云存储，暂时无法生成后台预览链接')
}

const removeGuideDocument = (guide) => {
  guide.file_name = ''
  guide.file_url = ''
  guide.file_type = ''
  guide.updatedAt = ''
}

const saveGuideDocuments = async () => {
  try {
    savingGuides.value = true
    const token = localStorage.getItem('adminToken')
    for (const guide of guideDocuments.value) {
      if (!guide._id) throw new Error(`${guide.category}缺少数据库记录，请刷新后重试`)
      await updateGuide(token, guide._id, {
        category: guide.category,
        desc: guide.desc || '',
        audience: 'client',
        file_name: guide.file_name || '',
        file_url: guide.file_url || '',
        file_type: guide.file_type || '',
        sort: guide.sort
      })
    }
    ElMessage.success('操作教程配置已保存')
    await loadGuides()
  } catch (error) {
    ElMessage.error(error.message || '保存失败')
  } finally {
    savingGuides.value = false
  }
}

// ===== 维修保养视频（cicada_guides，category=维修保养视频；desc=标题，content=简介，media=[视频,封面]）=====
const MAINTENANCE_VIDEO_CATEGORY = '维修保养视频'
const maintenanceVideos = ref([])
const savingMaintenanceVideos = ref(false)
const uploadingVideoKey = ref('')
let videoKeySeq = 0

// 视频「小程序效果预览」弹窗
const videoPreviewVisible = ref(false)
const videoPreviewItem = ref(null)
const videoPreviewContext = ref('维修保养')
const videoPlayUrl = ref('')
const videoPlayLoading = ref(false)

const loadMaintenanceVideos = async () => {
  try {
    const token = localStorage.getItem('adminToken')
    const list = await getGuides(token)
    const arr = (Array.isArray(list) ? list : []).filter(g => {
      const category = String(g.category || '')
      return (category.includes(MAINTENANCE_VIDEO_CATEGORY) || category.includes('维护保养视频'))
    })
    arr.sort((a, b) => (Number(a.sort) || 0) - (Number(b.sort) || 0))
    maintenanceVideos.value = arr.map(g => {
      const media = Array.isArray(g.media) ? g.media : []
      const video = media.find(m => m && m.type === 'video') || {}
      const cover = media.find(m => m && m.type === 'image') || {}
      return {
        _id: g._id || g.id || '',
        _key: g._id || g.id || `new-maint-${++videoKeySeq}`,
        title: g.desc || '',
        intro: g.content || '',
        video_url: video.url || '',
        video_name: video.name || '',
        cover_url: cover.url || '',
        cover_name: cover.name || '',
        coverPreview: '',
        sort: Number(g.sort) || 99
      }
    })
    resolveMaintenanceVideoCoverPreviews()
  } catch (error) {
    console.error('加载维修保养视频失败:', error)
  }
}
const resolveMaintenanceVideoCoverPreviews = async () => {
  maintenanceVideos.value.forEach(v => {
    if (v.cover_url && isWebUrl(v.cover_url)) v.coverPreview = v.cover_url
  })
  const token = localStorage.getItem('adminToken')
  const ids = maintenanceVideos.value
    .filter(v => v.cover_url && !isWebUrl(v.cover_url) && !v.coverPreview)
    .map(v => v.cover_url)
  if (!ids.length) return
  try {
    const map = await getTempFileURL(token, ids)
    maintenanceVideos.value.forEach(v => {
      if (v.cover_url && map && map[v.cover_url]) v.coverPreview = map[v.cover_url]
    })
  } catch (error) {
    console.error('解析维修保养视频封面地址失败:', error)
  }
}
const handleVideoUpload = async (uploadFile, video, keyPrefix = 'product-video/') => {
  const raw = uploadFile && uploadFile.raw
  if (!raw) return
  if (!/^video\//i.test(raw.type || '') && !/\.(mp4|mov|m4v|webm)$/i.test(raw.name || '')) {
    ElMessage.warning('请上传视频文件（建议 mp4）')
    return
  }
  if (raw.size > 500 * 1024 * 1024) {
    ElMessage.warning('视频不能超过 500MB')
    return
  }
  try {
    uploadingVideoKey.value = video._key
    video._progress = 0
    // 前端直传腾讯云 COS，支持几分钟的大视频（不经云函数体积限制）
    const { fileUrl } = await uploadToCos(raw, {
      keyPrefix,
      onProgress: (p) => { video._progress = p }
    })
    video.video_url = fileUrl
    video.video_name = raw.name
    ElMessage.success('视频上传成功')
  } catch (error) {
    ElMessage.error(error.message || '上传失败，请重试')
  } finally {
    uploadingVideoKey.value = ''
  }
}

const handleVideoCoverUpload = async (uploadFile, video, dir = 'product-video/') => {
  const raw = uploadFile && uploadFile.raw
  if (!raw) return
  try {
    const { fileUrl, tempUrl } = await uploadFileToCloud(raw, dir, 5 * 1024 * 1024)
    video.cover_url = fileUrl
    video.cover_name = raw.name
    video.coverPreview = tempUrl || ''
    ElMessage.success('封面上传成功')
  } catch (error) {
    ElMessage.error(error.message || '封面上传失败')
  }
}

// 点「预览」→ 弹出手机样式弹窗，按小程序视频区样式直接播放
const previewVideo = async (video, context = '维修保养') => {
  if (!video.video_url) {
    ElMessage.warning('请先上传视频')
    return
  }
  videoPreviewItem.value = video
  videoPreviewContext.value = context
  videoPlayUrl.value = ''
  videoPlayLoading.value = true
  videoPreviewVisible.value = true
  try {
    if (isWebUrl(video.video_url)) {
      videoPlayUrl.value = video.video_url
    } else {
      const token = localStorage.getItem('adminToken')
      const map = await getTempFileURL(token, [video.video_url])
      videoPlayUrl.value = (map && map[video.video_url]) || ''
    }
    if (!videoPlayUrl.value) ElMessage.info('视频地址解析失败，请确认已上传成功')
  } catch (error) {
    ElMessage.error('视频加载失败')
  } finally {
    videoPlayLoading.value = false
  }
}

const addMaintenanceVideo = () => {
  maintenanceVideos.value.push({
    _id: '',
    _key: `new-maint-${++videoKeySeq}`,
    title: '',
    intro: '',
    video_url: '',
    video_name: '',
    cover_url: '',
    cover_name: '',
    coverPreview: '',
    sort: maintenanceVideos.value.length + 1
  })
}
const removeMaintenanceVideo = async (index) => {
  const video = maintenanceVideos.value[index]
  if (!video) return
  if (!video._id) {
    maintenanceVideos.value.splice(index, 1)
    return
  }
  try {
    await ElMessageBox.confirm('确定删除该维修保养视频？删除后小程序首页将不再展示。', '提示', { type: 'warning' })
  } catch (e) {
    return
  }
  try {
    const token = localStorage.getItem('adminToken')
    await deleteGuide(token, video._id)
    maintenanceVideos.value.splice(index, 1)
    ElMessage.success('已删除')
  } catch (error) {
    ElMessage.error(error.message || '删除失败')
  }
}
const saveMaintenanceVideos = async () => {
  for (const v of maintenanceVideos.value) {
    if (!String(v.title || '').trim()) {
      ElMessage.warning('请为每个维修保养视频填写标题')
      return
    }
    if (!v.video_url) {
      ElMessage.warning(`「${v.title || '未命名'}」还没有上传视频`)
      return
    }
  }
  try {
    savingMaintenanceVideos.value = true
    const token = localStorage.getItem('adminToken')
    for (let i = 0; i < maintenanceVideos.value.length; i++) {
      const v = maintenanceVideos.value[i]
      const media = [{ type: 'video', url: v.video_url, name: v.video_name || '' }]
      if (v.cover_url) media.push({ type: 'image', url: v.cover_url, name: v.cover_name || '' })
      const payload = {
        category: MAINTENANCE_VIDEO_CATEGORY,
        audience: 'client',
        desc: String(v.title).trim(),
        content: v.intro || '',
        media,
        sort: i + 1
      }
      if (v._id) {
        await updateGuide(token, v._id, payload)
      } else {
        const res = await createGuide(token, payload)
        v._id = (res && (res._id || res.id)) || ''
        if (v._id) v._key = v._id
      }
      v.sort = i + 1
    }
    ElMessage.success('维修保养视频已保存')
    await loadMaintenanceVideos()
  } catch (error) {
    ElMessage.error(error.message || '保存失败')
  } finally {
    savingMaintenanceVideos.value = false
  }
}
const loadSettings = async () => {
  try {
    const token = localStorage.getItem('adminToken')
    const data = await getSettings(token)
    config.warranty = data.warranty_policy || ''
    config.feePolicy = data.fee_description || ''
    feeTiers.value = parseJsonArray(data.fee_tier_templates)
    warrantySections.value = parseJsonArray(data.warranty_policy_sections)
      .map(item => ({ title: String(item.title || ''), content: String(item.content || '') }))
    applyCompliance(data)
    applyContactInfo(data)
    applySurveyConfig(data.survey_config)
  } catch (error) {
    console.error('加载配置失败:', error)
  }
}

const saveConfig = async () => {
  try {
    savingPolicy.value = true
    const token = localStorage.getItem('adminToken')
    const cleanFeeTiers = feeTiers.value.filter(t => t.name || t.price)
    const cleanWarrantySections = warrantySections.value.filter(s => (s.title || '').trim() || (s.content || '').trim())
    await saveSettings(token, {
      warranty_policy: config.warranty,
      fee_description: config.feePolicy,
      // 已下线「文档上传」入口：清空旧文档字段，避免小程序端读到过期文档
      warranty_policy_file: '',
      fee_policy_file: '',
      fee_tier_templates: JSON.stringify(cleanFeeTiers),
      warranty_policy_sections: JSON.stringify(cleanWarrantySections)
    })
    ElMessage.success('配置保存成功')
  } catch (error) {
    ElMessage.error(error.message || '保存失败')
  } finally {
    savingPolicy.value = false
  }
}

// ===== 隐私与合规配置 =====
const compliance = reactive({
  privacy_policy: '',
  account_cancellation_policy: ''
})
const qualifications = ref([])
const qualPreviewMap = reactive({}) // fileID -> 临时预览地址
const savingCompliance = ref(false)
const miniappQr = ref('')          // 小程序体验版二维码（云存储 fileID 或外链）
const miniappQrPreview = ref('')   // 临时预览地址

const parseQualifications = (value) => {
  try {
    const list = value ? JSON.parse(value) : []
    return Array.isArray(list)
      ? list.map(it => ({ name: it.name || '', type: it.type === 'text' ? 'text' : 'image', imageUrl: it.imageUrl || '', text: it.text || '' }))
      : []
  } catch (error) {
    return []
  }
}

const resolveQualPreviews = async () => {
  const token = localStorage.getItem('adminToken')
  const ids = qualifications.value
    .filter(it => it.type === 'image' && it.imageUrl && !isWebUrl(it.imageUrl) && !qualPreviewMap[it.imageUrl])
    .map(it => it.imageUrl)
  if (!ids.length) return
  try {
    const map = await getTempFileURL(token, ids)
    Object.entries(map || {}).forEach(([id, url]) => { qualPreviewMap[id] = url })
  } catch (error) {
    console.error('解析资质图片地址失败:', error)
  }
}

const qualPreview = (item) => {
  if (!item || item.type !== 'image' || !item.imageUrl) return ''
  if (isWebUrl(item.imageUrl)) return item.imageUrl
  return qualPreviewMap[item.imageUrl] || ''
}

const addQualification = () => {
  qualifications.value.push({ name: '', type: 'image', imageUrl: '', text: '' })
}

const handleQualImage = async (uploadFile, item) => {
  const raw = uploadFile && uploadFile.raw
  if (!raw) return
  try {
    const { fileUrl, tempUrl } = await uploadFileToCloud(raw, 'compliance/', 5 * 1024 * 1024)
    item.imageUrl = fileUrl
    if (tempUrl) qualPreviewMap[fileUrl] = tempUrl
    ElMessage.success('图片上传成功')
  } catch (error) {
    ElMessage.error(error.message || '图片上传失败')
  }
}

const handleMiniappQr = async (uploadFile) => {
  const raw = uploadFile && uploadFile.raw
  if (!raw) return
  try {
    const { fileUrl, tempUrl } = await uploadFileToCloud(raw, 'miniapp/', 2 * 1024 * 1024)
    miniappQr.value = fileUrl
    miniappQrPreview.value = tempUrl || ''
    ElMessage.success('二维码上传成功')
  } catch (error) {
    ElMessage.error(error.message || '二维码上传失败')
  }
}

const removeMiniappQr = () => {
  miniappQr.value = ''
  miniappQrPreview.value = ''
}

const applyCompliance = (data = {}) => {
  compliance.privacy_policy = data.privacy_policy || ''
  compliance.account_cancellation_policy = data.account_cancellation_policy || ''
  qualifications.value = parseQualifications(data.qualifications)
  resolveQualPreviews()
  miniappQr.value = data.miniapp_preview_qr || ''
  resolveMiniappQrPreview()
}

const resolveMiniappQrPreview = async () => {
  const id = miniappQr.value
  if (!id) { miniappQrPreview.value = ''; return }
  if (isWebUrl(id)) { miniappQrPreview.value = id; return }
  try {
    const token = localStorage.getItem('adminToken')
    const map = await getTempFileURL(token, [id])
    miniappQrPreview.value = (map && map[id]) || ''
  } catch (error) {
    console.error('解析小程序二维码地址失败:', error)
  }
}

const saveCompliance = async () => {
  try {
    savingCompliance.value = true
    const token = localStorage.getItem('adminToken')
    const cleaned = qualifications.value
      .filter(it => it.name || it.imageUrl || it.text)
      .map(it => ({ name: it.name, type: it.type, imageUrl: it.type === 'image' ? it.imageUrl : '', text: it.type === 'text' ? it.text : '' }))
    await saveSettings(token, {
      privacy_policy: compliance.privacy_policy,
      account_cancellation_policy: compliance.account_cancellation_policy,
      // 已下线的字段：保存空串以清除历史内容，避免小程序端仍展示旧的更新公告/数据收集告知
      privacy_update_notice: '',
      data_collection_notice: '',
      qualifications: JSON.stringify(cleaned),
      miniapp_preview_qr: miniappQr.value || ''
    })
    ElMessage.success('隐私与合规配置已保存')
  } catch (error) {
    ElMessage.error(error.message || '保存失败')
  } finally {
    savingCompliance.value = false
  }
}

// ===== 联系方式 / 在线客服 / 公众号 =====
const CONTACT_KEYS = [
  'company_name', 'contact_phone', 'contact_email', 'contact_address', 'work_time',
  'bank_transfer_company_name', 'bank_transfer_tax_no', 'bank_transfer_address_phone', 'bank_transfer_bank_name', 'bank_transfer_account_no', 'bank_transfer_line_no',
  'customer_service_title', 'customer_service_desc', 'customer_service_wechat', 'customer_service_qrcode',
  'wechat_name', 'wechat_desc', 'wechat_qrcode'
]
const CONTACT_QR_KEYS = ['customer_service_qrcode', 'wechat_qrcode']
const DEFAULT_CONTACT_INFO = {
  company_name: '佛山市思科达医疗器械有限公司',
  contact_phone: '0757-85775667',
  contact_address: '广东省佛山市南海区狮山镇罗村广东新光源核心基地B5座五楼',
  work_time: '周一至周五 08:00 - 21:00',
  bank_transfer_company_name: '佛山市登煌医疗器械有限公司',
  bank_transfer_tax_no: '91440605688623440U',
  bank_transfer_address_phone: '佛山市南海区狮山镇罗村广东新光源产业基地核心区内B区5座二层  0757-85775667',
  bank_transfer_bank_name: '中国农业银行佛山惠景支行',
  bank_transfer_account_no: '4442 3201 0400 04288',
  bank_transfer_line_no: '103588042208'
}
const contactInfo = reactive(CONTACT_KEYS.reduce((acc, key) => { acc[key] = DEFAULT_CONTACT_INFO[key] || ''; return acc }, {}))
const contactQrPreviewMap = reactive({})
const savingContact = ref(false)

const qrPreview = (key) => {
  const value = contactInfo[key]
  if (!value) return ''
  if (isWebUrl(value)) return value
  return contactQrPreviewMap[value] || ''
}

const resolveContactQrPreviews = async () => {
  const token = localStorage.getItem('adminToken')
  const ids = CONTACT_QR_KEYS
    .map(key => contactInfo[key])
    .filter(value => value && !isWebUrl(value) && !contactQrPreviewMap[value])
  if (!ids.length) return
  try {
    const map = await getTempFileURL(token, ids)
    Object.entries(map || {}).forEach(([id, url]) => { contactQrPreviewMap[id] = url })
  } catch (error) {
    console.error('解析二维码预览失败:', error)
  }
}

const handleQrUpload = async (uploadFile, key) => {
  const raw = uploadFile && uploadFile.raw
  if (!raw) return
  try {
    const { fileUrl, tempUrl } = await uploadFileToCloud(raw, 'contact/', 5 * 1024 * 1024)
    contactInfo[key] = fileUrl
    if (tempUrl) contactQrPreviewMap[fileUrl] = tempUrl
    ElMessage.success('二维码上传成功')
  } catch (error) {
    ElMessage.error(error.message || '二维码上传失败')
  }
}

const applyContactInfo = (data = {}) => {
  CONTACT_KEYS.forEach(key => { contactInfo[key] = data[key] || DEFAULT_CONTACT_INFO[key] || '' })
  resolveContactQrPreviews()
}

const saveContact = async () => {
  try {
    savingContact.value = true
    const token = localStorage.getItem('adminToken')
    const payload = {}
    CONTACT_KEYS.forEach(key => { payload[key] = contactInfo[key] || '' })
    await saveSettings(token, payload)
    ElMessage.success('联系与公众号配置已保存')
  } catch (error) {
    ElMessage.error(error.message || '保存失败')
  } finally {
    savingContact.value = false
  }
}

// ===== 调研有礼配置 / 记录 =====
const surveyConfig = reactive({
  enabled: true,
  title: '售后服务调研表',
  subtitle: '提交一次真实售后体验反馈，工作人员核对后为您登记调研福利。',
  giftText: '查看原调研有礼海报',
  ratingMax: 5,
  successTitle: '提交成功',
  successMessage: '感谢参与售后调研，工作人员会根据联系方式核对并登记福利。'
})
const surveySatisfactionText = ref('满意,一般,不满意')
const surveyResolvedText = ref('已解决,处理中,未解决')
const surveyRecords = ref([])
const surveyLoading = ref(false)
const savingSurvey = ref(false)
const surveyTotal = ref(0)
const surveyQuery = reactive({ keyword: '', status: '', page: 1, pageSize: 10 })

const parseSurveyList = (value, fallback = []) => {
  const text = String(value || '')
    .split(/[,\n，、]+/)
    .map(item => item.trim())
    .filter(Boolean)
  return text.length ? text.slice(0, 8) : fallback
}

const applySurveyConfig = (value = '') => {
  try {
    const parsed = value ? JSON.parse(value) : {}
    if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
      surveyConfig.enabled = parsed.enabled !== false
      surveyConfig.title = parsed.title || surveyConfig.title
      surveyConfig.subtitle = parsed.subtitle || surveyConfig.subtitle
      surveyConfig.giftText = parsed.giftText || surveyConfig.giftText
      surveyConfig.ratingMax = Math.max(1, Math.min(10, Number(parsed.ratingMax) || surveyConfig.ratingMax))
      surveyConfig.successTitle = parsed.successTitle || surveyConfig.successTitle
      surveyConfig.successMessage = parsed.successMessage || surveyConfig.successMessage
      surveySatisfactionText.value = Array.isArray(parsed.satisfactionOptions) ? parsed.satisfactionOptions.join(',') : surveySatisfactionText.value
      surveyResolvedText.value = Array.isArray(parsed.resolvedOptions) ? parsed.resolvedOptions.join(',') : surveyResolvedText.value
    }
  } catch (error) {
    console.warn('parse survey config failed:', error)
  }
}

const serializeSurveyConfig = () => JSON.stringify({
  enabled: surveyConfig.enabled,
  title: surveyConfig.title,
  subtitle: surveyConfig.subtitle,
  giftText: surveyConfig.giftText,
  ratingMax: Number(surveyConfig.ratingMax) || 5,
  satisfactionOptions: parseSurveyList(surveySatisfactionText.value, ['满意', '一般', '不满意']),
  resolvedOptions: parseSurveyList(surveyResolvedText.value, ['已解决', '处理中', '未解决']),
  successTitle: surveyConfig.successTitle,
  successMessage: surveyConfig.successMessage
})

const saveSurveyConfig = async () => {
  try {
    savingSurvey.value = true
    const token = localStorage.getItem('adminToken')
    await saveSettings(token, {
      survey_config: serializeSurveyConfig()
    })
    ElMessage.success('调研配置保存成功')
  } catch (error) {
    ElMessage.error(error.message || '保存失败')
  } finally {
    savingSurvey.value = false
  }
}

const formatSurveyTime = (value) => {
  if (!value) return ''
  const d = new Date(Number(value))
  if (Number.isNaN(d.getTime())) return String(value)
  const pad = (n) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`
}

const loadSurveyRecords = async () => {
  try {
    surveyLoading.value = true
    const token = localStorage.getItem('adminToken')
    const data = await getSurveyList(token, {
      page: surveyQuery.page,
      pageSize: surveyQuery.pageSize,
      keyword: surveyQuery.keyword,
      status: surveyQuery.status
    })
    surveyRecords.value = (data && data.list) || []
    surveyTotal.value = (data && data.total) || 0
  } catch (error) {
    ElMessage.error(error.message || '加载调研记录失败')
  } finally {
    surveyLoading.value = false
  }
}

const changeSurveyStatus = async (row, status) => {
  try {
    const token = localStorage.getItem('adminToken')
    await updateSurveyStatus(token, row._id || row.id, status)
    ElMessage.success('状态已更新')
    row.status = status
  } catch (error) {
    ElMessage.error(error.message || '状态更新失败')
  }
}

onMounted(() => {
  loadSettings()
  loadGuides()
  loadMaintenanceVideos()
  loadSurveyRecords()
})
</script>

<style scoped>
.glass-card { background: #fff; border-radius: 12px; padding: 24px; box-shadow: 0 2px 12px rgba(0,0,0,0.03); margin-bottom: 20px; }
.field-title { font-weight:600; margin-bottom:12px; }
.policy-field-title { display:flex; align-items:center; justify-content:space-between; gap:12px; }
.policy-field-title span { flex:0 0 auto; }
/* 小程序效果预览弹窗 */
.mp-preview-switch { display:flex; justify-content:center; margin-bottom:16px; }
.mp-phone { width:340px; margin:0 auto; border-radius:28px; background:#F4F9FF; border:8px solid #1d2b4a; box-shadow:0 12px 32px rgba(16,32,68,0.24); overflow:hidden; }
.mp-phone-notch { width:120px; height:20px; margin:0 auto; background:#1d2b4a; border-radius:0 0 14px 14px; }
.mp-phone-header { text-align:center; font-size:16px; font-weight:800; color:#102044; padding:10px 0 12px; }
.mp-phone-body { height:440px; overflow-y:auto; padding:4px 18px 24px; box-sizing:border-box; }
.mp-doc-card { display:flex; align-items:center; gap:12px; background:#fff; border:1px solid #dce8ff; border-radius:12px; padding:14px; margin-bottom:14px; cursor:pointer; transition:box-shadow .2s; }
.mp-doc-card:hover { box-shadow:0 6px 16px rgba(30,111,224,0.14); }
.mp-doc-icon { flex:0 0 40px; width:40px; height:40px; border-radius:9px; background:#e8f1ff; color:#165dff; font-size:22px; display:flex; align-items:center; justify-content:center; }
.mp-doc-info { flex:1; min-width:0; display:flex; flex-direction:column; gap:4px; }
.mp-doc-name { font-size:14px; font-weight:600; color:#1d2129; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }
.mp-doc-sub { font-size:12px; color:#86909c; }
.mp-doc-open { flex:0 0 auto; font-size:13px; color:#165dff; font-weight:600; }
.mp-fee-table { background:#fff; border:1px solid #e5eefb; border-radius:12px; overflow:hidden; margin-bottom:14px; }
.mp-fee-row { display:flex; justify-content:space-between; align-items:center; gap:12px; padding:12px 14px; border-bottom:1px solid #f0f4fb; font-size:13px; color:#4e5f7e; }
.mp-fee-row:last-child { border-bottom:none; }
.mp-fee-head { background:#f2f7ff; font-weight:700; color:#16325f; }
.mp-fee-name { min-width:0; display:flex; flex-direction:column; gap:2px; }
.mp-fee-name em { font-style:normal; font-size:11px; color:#a8b1c0; }
.mp-fee-price { flex:0 0 auto; font-weight:700; color:#f5713d; }
.mp-fee-price i { font-style:normal; font-size:11px; color:#a8b1c0; font-weight:400; }
.mp-rich { font-size:13px; line-height:1.75; color:#4e5f7e; word-break:break-word; }
.mp-rich :deep(img) { max-width:100%; border-radius:8px; }
.mp-empty { text-align:center; color:#a8b1c0; font-size:13px; padding:60px 0; }
.mp-preview-note { text-align:center; font-size:12px; color:#a8b1c0; margin-top:14px; }
.mp-video-card { background:#fff; border:1px solid #e5eefb; border-radius:12px; overflow:hidden; }
.mp-video-player { width:100%; height:200px; background:#000; display:block; object-fit:contain; }
.mp-video-loading { height:200px; display:flex; align-items:center; justify-content:center; color:#a8b1c0; font-size:13px; background:#f2f4f8; }
.mp-video-meta { padding:12px 14px; }
.mp-video-title { font-size:14px; font-weight:700; color:#1d2129; }
.mp-video-intro { margin-top:6px; font-size:12px; color:#86909c; line-height:1.6; }
.sub-label { font-size:13px; color:#4e5969; margin-bottom:8px; }
.save-row { margin-top:20px; text-align:center; }
.print-form { max-width: 720px; margin-top: 20px; }
.maintenance-video-head { margin-top:24px; }
.guide-save-row { gap:10px; }
.product-video-list { display:flex; flex-direction:column; gap:14px; }
.product-video-card { align-items:flex-start; }
.product-video-cover { flex:0 0 150px; width:150px; display:flex; flex-direction:column; align-items:center; gap:8px; }
.product-video-cover-img { width:150px; height:96px; object-fit:cover; border-radius:8px; background:#e8f1ff; }
.product-video-cover-empty { width:150px; height:96px; border-radius:8px; background:#eef2f8; color:#a8b1c0; font-size:13px; display:flex; align-items:center; justify-content:center; }
.product-video-fields { flex:1; min-width:0; }
.product-video-fileline { display:flex; align-items:center; flex-wrap:wrap; gap:10px; margin-top:10px; }
.product-video-fileline .el-tag { max-width:280px; overflow:hidden; text-overflow:ellipsis; }
.product-video-del { flex:0 0 auto; align-self:flex-start; }
.policy-document-card { display:flex; justify-content:space-between; gap:18px; align-items:center; border:1px solid #dce8ff; background:#f7fbff; border-radius:8px; padding:18px; }
.policy-document-main { display:flex; align-items:flex-start; gap:14px; min-width:0; }
.policy-document-icon { flex:0 0 42px; width:42px; height:42px; border-radius:8px; background:#e8f1ff; color:#165dff; font-size:22px; display:flex; align-items:center; justify-content:center; }
.policy-document-copy { min-width:0; }
.policy-document-title { font-weight:600; color:#1d2129; margin-bottom:6px; }
.policy-document-desc { color:#4e5969; font-size:13px; line-height:1.6; }
.policy-document-file { display:flex; align-items:center; gap:10px; margin-top:10px; color:#165dff; font-size:13px; min-width:0; }
.policy-document-file span { max-width:360px; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }
.policy-document-file em { color:#86909c; font-style:normal; white-space:nowrap; }
.policy-document-empty { margin-top:10px; color:#86909c; font-size:13px; }
.policy-document-actions { display:flex; align-items:center; gap:10px; flex-wrap:wrap; justify-content:flex-end; }
.guide-document-grid { display:grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap:16px; }
.guide-document-card { align-items:flex-start; }
.guide-document-card .policy-document-main { flex:1; }
.guide-document-copy { width:100%; }
.guide-document-desc-input { margin-top:8px; max-width:520px; }
.upload-title { margin-bottom:16px; color:#165DFF; font-weight:600; }
.upload-tip { margin-top: 8px; font-size: 12px; color: #86909c; }
.preview-box { background:#f7f8fa; border-radius:10px; padding:20px; line-height:1.8; color:#4e5969; }
.preview-title { font-weight:600; color:#1d2129; margin:0 0 8px; }
.preview-placeholder { text-align:center; padding:32px 0 12px; color:#86909c; }
.preview-actions { display: flex; align-items: center; gap: 12px; padding-top: 16px; }
.preview-hint { color: #86909c; font-size: 12px; }
.empty-file { color: #c9cdd4; }
.qual-head { display:flex; justify-content:space-between; align-items:center; font-weight:600; margin:24px 0 12px; }
.empty-tip { color:#86909c; font-size:13px; background:#f7f8fa; border-radius:8px; padding:16px; }
.warranty-section-editor { border:1px solid #e5eefb; border-radius:10px; padding:14px; margin-bottom:12px; background:#fbfdff; }
.warranty-section-editor-head { display:flex; justify-content:space-between; align-items:center; gap:12px; margin-bottom:10px; flex-wrap:wrap; }
.warranty-section-editor-actions { display:flex; align-items:center; gap:4px; }
.mp-warranty-section { margin-bottom:14px; background:#fff; border:1px solid #e5eefb; border-radius:10px; padding:12px 14px; }
.mp-warranty-section-title { font-size:14px; font-weight:700; color:#1d2129; margin-bottom:8px; padding-left:8px; border-left:3px solid #1e6fe0; }
.package-card { border:1px solid #e5eefb; border-radius:8px; padding:14px; margin-bottom:12px; background:#fbfdff; }
.package-head { display:grid; grid-template-columns: minmax(180px, 1fr) minmax(160px, 220px) auto; gap:10px; align-items:center; margin-bottom:10px; }
.package-table { margin:8px 0; }
.qual-card { border:1px solid #f0f2f5; border-radius:10px; padding:16px; margin-bottom:12px; }
.qual-row { display:flex; align-items:center; gap:12px; flex-wrap:wrap; margin-bottom:12px; }
.qual-img-row { display:flex; align-items:center; gap:12px; }
.qual-thumb { height:72px; border-radius:6px; border:1px solid #f0f2f5; object-fit:contain; }
.popup-row { display:flex; align-items:center; margin-bottom:12px; }
.media-list { margin-bottom:12px; }
.media-item { display:flex; justify-content:space-between; align-items:center; padding:8px 12px; background:#f7f8fa; border-radius:6px; margin-bottom:8px; font-size:13px; color:#4e5969; }
.logo-row { display:flex; align-items:center; gap:12px; }
.logo-thumb { height:44px; border:1px solid #f0f2f5; border-radius:6px; object-fit:contain; }
.watermark-row { display:flex; align-items:center; gap:12px; flex-wrap:wrap; }
.survey-toolbar { display:flex; align-items:center; gap:12px; flex-wrap:wrap; }
.survey-pagination { display:flex; justify-content:flex-end; margin-top:16px; }
.table-responsive { width: 100%; overflow-x: auto; }
.modern-table { min-width: 800px; }
.modern-table :deep(.el-table__inner-wrapper::before) { display: none; }
.modern-table :deep(th.el-table__cell) { background-color: #f7f8fa !important; color: #4e5969; font-weight: 600; border-bottom: none; }
.modern-table :deep(td.el-table__cell) { border-bottom: 1px solid #f0f2f5; padding: 12px 0; }
.modern-tabs :deep(.el-tabs__nav-wrap::after) { height: 1px; background-color: #f0f2f5; }
.modern-tabs :deep(.el-tabs__item) { font-size: 15px; padding: 0 20px; }

@media (max-width: 768px) {
  .guide-document-grid { grid-template-columns: 1fr; }
  .policy-document-card { align-items:flex-start; flex-direction:column; }
  .policy-document-actions { width:100%; justify-content:flex-start; }
  .policy-document-file { align-items:flex-start; flex-direction:column; gap:4px; }
  .policy-document-file span { max-width:100%; }
}
</style>
