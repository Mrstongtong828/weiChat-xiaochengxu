<template>
  <div class="glass-card">
    <div class="section-title">
      <div>
        <span>系统配置</span>
        <p class="section-desc">维护保修政策、收费模板、报价套餐、打印配置、教程内容和隐私合规文案。</p>
      </div>
    </div>
    <el-tabs v-model="activeContentTab" class="modern-tabs">
      <el-tab-pane label="保修与收费" name="policy">
        <div class="field-title" style="margin-top:20px;">保修政策总述</div>
        <RichEditor v-model="config.warranty" upload-dir="warranty/" min-height="180px" placeholder="保修范围、期限、注意事项总述，小程序保修页顶部展示…" />

        <div class="qual-head">
          <span>按机型保修规则</span>
          <el-button type="primary" link @click="addWarrantyRule">+ 新增机型规则</el-button>
        </div>
        <div v-if="!warrantyRules.length" class="empty-tip">按 高端机 / 基础机 / 耗材配件 等分类录入不同保修时长，小程序保修页按分类分组展示。</div>
        <el-table v-else :data="warrantyRules" class="modern-table" style="width:100%;">
          <el-table-column label="机型分类" width="180">
            <template #default="{ row }">
              <el-select v-model="row.category" filterable allow-create default-first-option placeholder="选择/输入分类" style="width:100%;">
                <el-option v-for="c in warrantyCategoryOptions" :key="c" :label="c" :value="c" />
              </el-select>
            </template>
          </el-table-column>
          <el-table-column label="型号/适用范围">
            <template #default="{ row }"><el-input v-model="row.model" placeholder="如 XX-3000 高端综合机" /></template>
          </el-table-column>
          <el-table-column label="保修时长" width="160">
            <template #default="{ row }"><el-input v-model="row.warrantyPeriod" placeholder="如 整机 2 年" /></template>
          </el-table-column>
          <el-table-column label="保修条款">
            <template #default="{ row }"><el-input v-model="row.terms" type="textarea" :rows="2" placeholder="该机型保修条款说明" /></template>
          </el-table-column>
          <el-table-column label="操作" width="80" align="right" fixed="right">
            <template #default="{ $index }"><el-button type="danger" link @click="warrantyRules.splice($index, 1)">删除</el-button></template>
          </el-table-column>
        </el-table>

        <div class="field-title" style="margin-top:24px;">延保政策</div>
        <el-row :gutter="20">
          <el-col :xs="24" :sm="12" style="margin-bottom:12px;">
            <div class="sub-label">延保服务说明</div>
            <el-input v-model="extended.desc" type="textarea" :rows="4" placeholder="延保服务范围与权益说明" />
          </el-col>
          <el-col :xs="24" :sm="12" style="margin-bottom:12px;">
            <div class="sub-label">延保收费标准</div>
            <el-input v-model="extended.fee" type="textarea" :rows="4" placeholder="延保收费标准、价格档位" />
          </el-col>
        </el-row>
        <div class="sub-label">延保生效规则</div>
        <el-input v-model="extended.rules" type="textarea" :rows="3" placeholder="延保购买条件、生效时间、失效情形等" />

        <div class="field-title" style="margin-top:24px;">收费办法说明</div>
        <el-input v-model="config.feePolicy" type="textarea" :rows="5" placeholder="过保后收费办法总述，小程序收费指南展示" />

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

        <div class="qual-head">
          <span>报价通用备注模板库</span>
          <el-button type="primary" link @click="addQuoteTemplate">+ 新增备注模板</el-button>
        </div>
        <div v-if="!quoteTemplates.length" class="empty-tip">预设常用报价备注（配件质保周期、付款时效、寄修须知等），工程师开报价单可一键选择填充。</div>
        <el-table v-else :data="quoteTemplates" class="modern-table" style="width:100%;">
          <el-table-column label="模板名称" width="220">
            <template #default="{ row }"><el-input v-model="row.title" placeholder="如 配件质保说明" /></template>
          </el-table-column>
          <el-table-column label="备注内容">
            <template #default="{ row }"><el-input v-model="row.content" type="textarea" :rows="2" placeholder="报价单备注文本" /></template>
          </el-table-column>
          <el-table-column label="操作" width="80" align="right" fixed="right">
            <template #default="{ $index }"><el-button type="danger" link @click="quoteTemplates.splice($index, 1)">删除</el-button></template>
          </el-table-column>
        </el-table>

        <div class="qual-head">
          <span>报价套餐模板</span>
          <el-button type="primary" link @click="addQuotePackage">+ 新增套餐</el-button>
        </div>
        <div v-if="!quotePackages.length" class="empty-tip">预设常用检修套餐，报价弹窗可一键带出服务费、其他费用和客户可见备注。</div>
        <div v-for="(pkg, pkgIndex) in quotePackages" v-else :key="pkg.localId" class="package-card">
          <div class="package-head">
            <el-input v-model="pkg.name" placeholder="套餐名称，如 牙科手机整机检修套餐" />
            <el-input v-model="pkg.category" placeholder="适用分类/机型" />
            <el-button type="danger" link @click="quotePackages.splice(pkgIndex, 1)">删除套餐</el-button>
          </div>
          <el-table :data="pkg.services" class="modern-table package-table" size="small">
            <el-table-column label="服务项目">
              <template #default="{ row }"><el-input v-model="row.name" placeholder="如 整机检测费" /></template>
            </el-table-column>
            <el-table-column label="分类" width="150">
              <template #default="{ row }"><el-input v-model="row.productCategory" placeholder="产品分类" /></template>
            </el-table-column>
            <el-table-column label="单价" width="130">
              <template #default="{ row }"><el-input-number v-model="row.unitPrice" :min="0" :step="10" controls-position="right" style="width:100%;" /></template>
            </el-table-column>
            <el-table-column label="数量" width="110">
              <template #default="{ row }"><el-input-number v-model="row.quantity" :min="1" :step="1" :precision="0" controls-position="right" style="width:100%;" /></template>
            </el-table-column>
            <el-table-column label="操作" width="80" align="right" fixed="right">
              <template #default="{ $index }"><el-button type="danger" link @click="pkg.services.splice($index, 1)">删除</el-button></template>
            </el-table-column>
          </el-table>
          <el-button type="primary" link @click="pkg.services.push(createPackageService())">+ 服务项目</el-button>
          <el-table :data="pkg.others" class="modern-table package-table" size="small">
            <el-table-column label="其他费用">
              <template #default="{ row }"><el-input v-model="row.name" placeholder="如 清洁保养费 / 加急处理费" /></template>
            </el-table-column>
            <el-table-column label="单价" width="130">
              <template #default="{ row }"><el-input-number v-model="row.unitPrice" :min="0" :step="10" controls-position="right" style="width:100%;" /></template>
            </el-table-column>
            <el-table-column label="数量" width="110">
              <template #default="{ row }"><el-input-number v-model="row.quantity" :min="1" :step="1" :precision="0" controls-position="right" style="width:100%;" /></template>
            </el-table-column>
            <el-table-column label="操作" width="80" align="right" fixed="right">
              <template #default="{ $index }"><el-button type="danger" link @click="pkg.others.splice($index, 1)">删除</el-button></template>
            </el-table-column>
          </el-table>
          <el-button type="primary" link @click="pkg.others.push(createPackageOther())">+ 其他费用</el-button>
          <el-input v-model="pkg.remark" type="textarea" :rows="2" maxlength="200" show-word-limit placeholder="套餐备注，套用后追加到报价备注" />
        </div>

        <div class="save-row"><el-button type="primary" :loading="savingPolicy" @click="saveConfig">保存配置</el-button></div>
      </el-tab-pane>

      <el-tab-pane label="打印配置" name="print">
        <el-alert
          title="浏览器网页只能打开打印对话框，不能静默指定物理打印机。这里按单据类型分别保存模板、纸张、水印与字段显隐；目前报修工单已接入打印渲染，其余单据可先维护配置。"
          type="info"
          show-icon
          :closable="false"
          style="margin: 20px 0;"
        />
        <el-radio-group v-model="activePrintDoc" style="margin-bottom: 16px;">
          <el-radio-button v-for="d in printDocTypes" :key="d.key" :label="d.key">{{ d.label }}</el-radio-button>
        </el-radio-group>
        <el-form v-if="currentPrintTemplate" :model="currentPrintTemplate" label-width="130px" class="print-form">
          <el-form-item label="打印单标题">
            <el-input v-model="currentPrintTemplate.title" placeholder="例如：设备维修回寄单"></el-input>
          </el-form-item>
          <el-form-item label="页眉文字">
            <el-input v-model="currentPrintTemplate.header" placeholder="如公司名称（与 logo 并排显示）"></el-input>
          </el-form-item>
          <el-form-item label="企业 logo">
            <div class="logo-row">
              <el-upload action="#" :auto-upload="false" :show-file-list="false" accept=".png,.jpg,.jpeg,.webp" :on-change="(f) => handleLogoUpload(f, currentPrintTemplate)">
                <el-button>{{ currentPrintTemplate.logoUrl ? '更换 logo' : '上传 logo' }}</el-button>
              </el-upload>
              <img v-if="printLogoPreview(currentPrintTemplate)" :src="printLogoPreview(currentPrintTemplate)" class="logo-thumb" />
              <el-button v-if="currentPrintTemplate.logoUrl" type="danger" link @click="currentPrintTemplate.logoUrl = ''">移除</el-button>
            </div>
          </el-form-item>
          <el-form-item label="纸张规格">
            <el-select v-model="currentPrintTemplate.paperSize" style="width: 220px;">
              <el-option label="A4" value="A4"></el-option>
              <el-option label="A5" value="A5"></el-option>
              <el-option label="热敏小票 80mm" value="receipt-80"></el-option>
            </el-select>
          </el-form-item>
          <el-form-item label="默认份数">
            <el-input-number v-model="currentPrintTemplate.copies" :min="1" :max="5"></el-input-number>
          </el-form-item>
          <el-form-item label="显示签名栏">
            <el-switch v-model="currentPrintTemplate.showSignature"></el-switch>
          </el-form-item>
          <el-form-item label="字段显隐">
            <el-checkbox v-model="currentPrintTemplate.fields.showPhone">打印客户手机号</el-checkbox>
            <el-checkbox v-model="currentPrintTemplate.fields.showAddress">打印回寄地址</el-checkbox>
            <el-checkbox v-model="currentPrintTemplate.fields.showCost">打印费用/采购成本（对外报价单建议关闭）</el-checkbox>
          </el-form-item>
          <el-form-item label="水印">
            <div class="watermark-row">
              <el-switch v-model="currentPrintTemplate.watermarkEnabled" />
              <el-input v-if="currentPrintTemplate.watermarkEnabled" v-model="currentPrintTemplate.watermarkText" placeholder="如 内部存档 / 客户留存 / 保密文件" style="width: 240px;" />
              <template v-if="currentPrintTemplate.watermarkEnabled">
                <span class="sub-label" style="margin:0;">透明度</span>
                <el-slider v-model="currentPrintTemplate.watermarkOpacity" :min="0.05" :max="0.4" :step="0.01" style="width: 160px;" />
              </template>
            </div>
          </el-form-item>
          <el-form-item label="页脚提示">
            <el-input v-model="currentPrintTemplate.footer" type="textarea" :rows="3" placeholder="打印单底部展示给客户的提示"></el-input>
          </el-form-item>
          <el-form-item>
            <el-button type="primary" :loading="savingPrint" @click="savePrintTemplates">保存打印配置</el-button>
          </el-form-item>
        </el-form>
      </el-tab-pane>

      <el-tab-pane label="操作教程" name="guide">
        <el-alert
          title="四个固定栏目（快速/报修/查询/开票）始终展示；可编辑图文、上传图片/视频/文档，或新增客户端/工程师端自定义教程。"
          type="info"
          show-icon
          :closable="false"
          style="margin: 20px 0;"
        />

        <div class="field-title">首页教程弹窗</div>
        <div class="popup-row">
          <el-switch v-model="homeGuidePopup.enabled" />
          <span class="sub-label" style="margin:0 0 0 12px;">开启后，新客户首次进入小程序自动弹出操作指引（仅弹一次）。</span>
        </div>
        <RichEditor v-if="homeGuidePopup.enabled" v-model="homeGuidePopup.content" upload-dir="tutorials/" min-height="160px" placeholder="弹窗展示的操作指引图文内容…" />
        <div style="margin:12px 0 4px;"><el-button type="primary" :loading="savingHomePopup" @click="saveHomePopup">保存弹窗设置</el-button></div>

        <div class="qual-head">
          <span>教程栏目</span>
          <el-button type="primary" link @click="openCreateGuide">+ 新增教程</el-button>
        </div>
        <div class="table-responsive">
          <el-table :data="guideItems" class="modern-table" style="width:100%;">
            <el-table-column prop="category" label="教程栏目" width="130"></el-table-column>
            <el-table-column label="受众" width="90">
              <template #default="{row}">{{ row.audience === 'engineer' ? '工程师端' : '客户端' }}</template>
            </el-table-column>
            <el-table-column prop="desc" label="功能说明" show-overflow-tooltip></el-table-column>
            <el-table-column label="图文/媒体" width="130">
              <template #default="{row}">
                <span>{{ row.content ? '图文✓' : '—' }}<span v-if="row.media && row.media.length"> · 媒体{{ row.media.length }}</span></span>
              </template>
            </el-table-column>
            <el-table-column label="文档" min-width="140" show-overflow-tooltip>
              <template #default="{row}">
                <span :class="{ 'empty-file': !row.file }">{{ row.file || '未上传' }}</span>
              </template>
            </el-table-column>
            <el-table-column prop="updatedAt" label="更新时间" width="110"></el-table-column>
            <el-table-column label="操作" width="240" align="right" fixed="right">
              <template #default="{row}">
                <el-button type="primary" link @click="openContentDialog(row)">编辑图文</el-button>
                <el-button type="primary" link @click="openUploadDialog(row)">上传文档</el-button>
                <el-button v-if="!row.type" type="danger" link @click="removeGuide(row)">删除</el-button>
              </template>
            </el-table-column>
          </el-table>
        </div>
      </el-tab-pane>

      <el-tab-pane label="隐私与合规" name="compliance">
        <el-alert
          title="医疗器械小程序上线必备：隐私政策、账号注销规则、资质公示、数据收集告知。保存后小程序端实时读取并展示。"
          type="warning"
          show-icon
          :closable="false"
          style="margin: 20px 0;"
        />

        <div class="field-title">隐私政策</div>
        <RichEditor v-model="compliance.privacy_policy" upload-dir="compliance/" placeholder="完整隐私协议，支持图文，一键同步至小程序隐私弹窗…" />

        <div class="field-title" style="margin-top:20px;">隐私更新公告</div>
        <RichEditor v-model="compliance.privacy_update_notice" upload-dir="compliance/" min-height="160px" placeholder="隐私政策更新时向用户展示的公告说明…" />

        <div class="field-title" style="margin-top:20px;">账号注销规则</div>
        <RichEditor v-model="compliance.account_cancellation_policy" upload-dir="compliance/" min-height="160px" placeholder="账号注销流程与数据删除规则（满足《个人信息保护法》）…" />

        <div class="field-title" style="margin-top:20px;">数据收集告知</div>
        <RichEditor v-model="compliance.data_collection_notice" upload-dir="compliance/" min-height="160px" placeholder="说明手机号、设备 SN、微信 openid 等信息的收集用途…" />

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

        <div class="save-row"><el-button type="primary" :loading="savingCompliance" @click="saveCompliance">保存隐私与合规配置</el-button></div>
      </el-tab-pane>
    </el-tabs>
  </div>

  <el-dialog v-model="contentDialogVisible" :title="isNewGuide ? '新增教程' : `编辑「${contentGuide?.category}」`" width="760px" align-center>
    <template v-if="contentGuide">
      <div class="qual-row">
        <el-input v-model="contentGuide.category" :disabled="!!contentGuide.type" placeholder="教程栏目名称" style="max-width:240px;" />
        <el-select v-if="!contentGuide.type" v-model="contentGuide.category" filterable allow-create default-first-option placeholder="或选择常用分类" style="width:180px;">
          <el-option v-for="c in guideCategoryOptions" :key="c" :label="c" :value="c" />
        </el-select>
        <el-select v-model="contentGuide.audience" placeholder="受众" style="width:140px;">
          <el-option label="客户端" value="client" />
          <el-option label="工程师端" value="engineer" />
        </el-select>
      </div>
      <div class="sub-label" style="margin-top:12px;">功能说明</div>
      <el-input v-model="contentGuide.desc" type="textarea" :rows="2" placeholder="栏目简介，小程序列表展示" />
      <div class="sub-label" style="margin-top:12px;">图文内容</div>
      <RichEditor v-model="contentGuide.content" upload-dir="tutorials/" min-height="220px" placeholder="图文教程内容，支持图片…" />
      <div class="sub-label" style="margin-top:12px;">媒体（图片 / 视频 / 文档）</div>
      <div v-if="contentGuide.media.length" class="media-list">
        <div v-for="(m, i) in contentGuide.media" :key="i" class="media-item">
          <span>{{ m.type === 'video' ? '视频' : m.type === 'image' ? '图片' : '文档' }} · {{ m.name }}</span>
          <el-button type="danger" link @click="contentGuide.media.splice(i, 1)">移除</el-button>
        </div>
      </div>
      <el-upload action="#" :auto-upload="false" :show-file-list="false" :on-change="handleMediaUpload" accept="image/*,video/*,.pdf,.doc,.docx">
        <el-button>上传媒体</el-button>
        <template #tip><span class="upload-tip">图片/视频/文档，单个建议不超过 50MB</span></template>
      </el-upload>
    </template>
    <template #footer>
      <el-button @click="contentDialogVisible = false">取消</el-button>
      <el-button type="primary" :loading="savingContent" @click="saveGuideContent">保存</el-button>
    </template>
  </el-dialog>

  <el-dialog v-model="uploadDialogVisible" title="上传替换教程文档" width="560px" align-center>
    <div class="upload-title">正在为「{{ currentGuide?.category }}」上传新文档</div>
    <el-upload
      drag
      action="#"
      :auto-upload="false"
      :limit="1"
      :on-change="handleFileChange"
      :on-exceed="handleFileExceed"
      :file-list="uploadFileList"
      accept=".pdf,.doc,.docx,.png,.jpg,.jpeg,.webp"
    >
      <el-icon><UploadFilled /></el-icon>
      <div class="el-upload__text">将文件拖到此处，或 <em>点击上传</em></div>
      <template #tip>
        <div class="upload-tip">支持 PDF、Word 和常见图片格式，建议单个文件不超过 10MB。</div>
      </template>
    </el-upload>
    <template #footer>
      <el-button @click="uploadDialogVisible = false">取消</el-button>
      <el-button type="primary" :loading="uploadingGuide" @click="confirmUpload">确认上传</el-button>
    </template>
  </el-dialog>

  <el-dialog v-model="guidePreviewVisible" :title="guidePreviewTarget ? guidePreviewTarget.category + ' - 预览' : '操作指南预览'" width="560px" align-center>
    <template v-if="guidePreviewTarget">
      <div class="preview-box">
        <p class="preview-title">{{guidePreviewTarget.category}}</p>
        <p>功能说明：{{guidePreviewTarget.desc}}</p>
        <p>当前文档：{{guidePreviewTarget.file}}</p>
        <p>更新时间：{{guidePreviewTarget.updatedAt}}</p>
        <div v-if="guidePreviewTarget.fileUrl" class="preview-actions">
          <el-button type="primary" @click="openGuideFile(guidePreviewTarget)">打开文档</el-button>
          <span v-if="!isWebUrl(guidePreviewTarget.fileUrl)" class="preview-hint">云存储文件会在小程序端打开，后台仅展示上传记录。</span>
        </div>
        <div v-else class="preview-placeholder">还未上传文档，请先点击“上传替换”。</div>
      </div>
    </template>
    <template #footer>
      <el-button @click="guidePreviewVisible = false">关闭</el-button>
    </template>
  </el-dialog>
</template>

<script setup>
import { ref, reactive, computed, onMounted } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { saveSettings, getSettings, getGuides, updateGuide, uploadGuideFile, getTempFileURL, createGuide, deleteGuide } from '../api/admin.js'
import RichEditor from '../components/RichEditor.vue'
import { uploadFileToCloud } from '../utils/upload.js'
import { PRINT_DOC_TYPES, parsePrintTemplates, defaultPrintTemplate } from '../utils/orderPrint.js'

const activeContentTab = ref('policy')
const config = reactive({ warranty: '', feePolicy: '' })

// ===== 打印配置（多模板）=====
const printDocTypes = PRINT_DOC_TYPES
const activePrintDoc = ref('repair_order')
const savingPrint = ref(false)
const printTemplates = reactive({})
PRINT_DOC_TYPES.forEach(({ key }) => { printTemplates[key] = defaultPrintTemplate(key) })
const currentPrintTemplate = computed(() => printTemplates[activePrintDoc.value])
const printLogoPreviewMap = reactive({})
const printLogoPreview = (tpl) => {
  if (!tpl || !tpl.logoUrl) return ''
  if (/^https?:\/\//i.test(tpl.logoUrl)) return tpl.logoUrl
  return printLogoPreviewMap[tpl.logoUrl] || ''
}
const handleLogoUpload = async (uploadFile, tpl) => {
  const raw = uploadFile && uploadFile.raw
  if (!raw || !tpl) return
  try {
    const { fileUrl, tempUrl } = await uploadFileToCloud(raw, 'print/', 2 * 1024 * 1024)
    tpl.logoUrl = fileUrl
    if (tempUrl) printLogoPreviewMap[fileUrl] = tempUrl
    ElMessage.success('logo 上传成功')
  } catch (error) {
    ElMessage.error(error.message || 'logo 上传失败')
  }
}
const resolvePrintLogoPreviews = async () => {
  const token = localStorage.getItem('adminToken')
  const ids = Object.values(printTemplates)
    .map(t => t.logoUrl)
    .filter(url => url && !/^https?:\/\//i.test(url) && !printLogoPreviewMap[url])
  if (!ids.length) return
  try {
    const map = await getTempFileURL(token, ids)
    Object.entries(map || {}).forEach(([id, url]) => { printLogoPreviewMap[id] = url })
  } catch (error) {
    console.error('解析打印 logo 预览失败:', error)
  }
}
const savePrintTemplates = async () => {
  try {
    savingPrint.value = true
    const token = localStorage.getItem('adminToken')
    const plain = {}
    PRINT_DOC_TYPES.forEach(({ key }) => { plain[key] = printTemplates[key] })
    await saveSettings(token, {
      print_templates: JSON.stringify(plain),
      print_config: JSON.stringify(plain.repair_order) // 兼容旧逻辑
    })
    ElMessage.success('打印配置已保存')
  } catch (error) {
    ElMessage.error(error.message || '保存失败')
  } finally {
    savingPrint.value = false
  }
}

// ===== 保修与收费 =====
const savingPolicy = ref(false)
const warrantyCategoryOptions = ['高端机', '基础机', '耗材配件']
const warrantyRules = ref([])
const extended = reactive({ desc: '', fee: '', rules: '' })
const quoteTemplates = ref([])
const feeTiers = ref([])
const quotePackages = ref([])

const parseJsonArray = (value) => {
  try {
    const parsed = value ? JSON.parse(value) : []
    return Array.isArray(parsed) ? parsed : []
  } catch (error) {
    return []
  }
}

const addWarrantyRule = () => warrantyRules.value.push({ category: '', model: '', warrantyPeriod: '', terms: '' })
const addQuoteTemplate = () => quoteTemplates.value.push({ title: '', content: '' })
const addFeeTier = () => feeTiers.value.push({ name: '', price: 0, unit: '次', note: '' })
const createPackageService = () => ({ name: '', productCategory: '', unitPrice: 0, quantity: 1, remark: '' })
const createPackageOther = () => ({ name: '', unitPrice: 0, quantity: 1, remark: '' })
const addQuotePackage = () => quotePackages.value.push({
  localId: `pkg-${Date.now()}-${Math.random().toString(16).slice(2)}`,
  name: '',
  category: '',
  services: [createPackageService()],
  others: [],
  remark: ''
})
const guideDefaults = [
  { type: 'quick', category: '快速指南', desc: '跳转到图文并茂的快速入门文档，帮助用户快速了解小程序售后流程。', sort: 1 },
  { type: 'repair', category: '报修指南', desc: '跳转到图文并茂的报修文档，说明报修流程、寄出注意事项和进度查询方式。', sort: 2 },
  { type: 'query', category: '查询指南', desc: '跳转到图文并茂的查询文档，说明工单、物流和维修进度查询方式。', sort: 3 },
  { type: 'invoice', category: '开票指南', desc: '跳转到图文并茂的开票文档，说明发票申请、资料填写和开票进度查看方式。', sort: 4 }
]
const guideAliases = {
  quick: ['快速指南', '快速入门'],
  repair: ['报修指南', '报修流程'],
  query: ['查询指南', '查询办法', '维修查询', '物流寄送'],
  invoice: ['开票指南', '发票开具']
}

const loadSettings = async () => {
  try {
    const token = localStorage.getItem('adminToken')
    const data = await getSettings(token)
    config.warranty = data.warranty_policy || ''
    config.feePolicy = data.fee_description || ''
    const tpls = parsePrintTemplates(data.print_templates, data.print_config)
    PRINT_DOC_TYPES.forEach(({ key }) => { printTemplates[key] = tpls[key] })
    resolvePrintLogoPreviews()
    warrantyRules.value = parseJsonArray(data.warranty_rules)
    quoteTemplates.value = parseJsonArray(data.quote_remark_templates)
    feeTiers.value = parseJsonArray(data.fee_tier_templates)
    quotePackages.value = parseJsonArray(data.quote_package_templates).map((pkg) => ({
      localId: pkg.localId || `pkg-${Date.now()}-${Math.random().toString(16).slice(2)}`,
      name: pkg.name || '',
      category: pkg.category || '',
      services: Array.isArray(pkg.services) ? pkg.services : [],
      others: Array.isArray(pkg.others) ? pkg.others : [],
      remark: pkg.remark || ''
    }))
    extended.desc = data.extended_warranty_desc || ''
    extended.fee = data.extended_warranty_fee || ''
    extended.rules = data.extended_warranty_rules || ''
    applyHomeGuidePopup(data)
    applyCompliance(data)
  } catch (error) {
    console.error('加载配置失败:', error)
  }
}

const saveConfig = async () => {
  try {
    savingPolicy.value = true
    const token = localStorage.getItem('adminToken')
    const cleanWarrantyRules = warrantyRules.value.filter(r => r.category || r.model || r.warrantyPeriod || r.terms)
    const cleanQuoteTemplates = quoteTemplates.value.filter(t => t.title || t.content)
    const cleanFeeTiers = feeTiers.value.filter(t => t.name || t.price)
    const cleanQuotePackages = quotePackages.value
      .map(pkg => ({
        name: pkg.name || '',
        category: pkg.category || '',
        services: (pkg.services || []).filter(row => row.name || row.unitPrice).map(row => ({
          name: row.name || '',
          productCategory: row.productCategory || '',
          unitPrice: Number(row.unitPrice || 0),
          quantity: Number(row.quantity || 1) || 1,
          remark: row.remark || ''
        })),
        others: (pkg.others || []).filter(row => row.name || row.unitPrice).map(row => ({
          name: row.name || '',
          unitPrice: Number(row.unitPrice || 0),
          quantity: Number(row.quantity || 1) || 1,
          remark: row.remark || ''
        })),
        remark: pkg.remark || ''
      }))
      .filter(pkg => pkg.name || pkg.services.length || pkg.others.length || pkg.remark)
    await saveSettings(token, {
      warranty_policy: config.warranty,
      fee_description: config.feePolicy,
      warranty_rules: JSON.stringify(cleanWarrantyRules),
      extended_warranty_desc: extended.desc,
      extended_warranty_fee: extended.fee,
      extended_warranty_rules: extended.rules,
      quote_remark_templates: JSON.stringify(cleanQuoteTemplates),
      fee_tier_templates: JSON.stringify(cleanFeeTiers),
      quote_package_templates: JSON.stringify(cleanQuotePackages)
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
  privacy_update_notice: '',
  account_cancellation_policy: '',
  data_collection_notice: ''
})
const qualifications = ref([])
const qualPreviewMap = reactive({}) // fileID -> 临时预览地址
const savingCompliance = ref(false)

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

const applyCompliance = (data = {}) => {
  compliance.privacy_policy = data.privacy_policy || ''
  compliance.privacy_update_notice = data.privacy_update_notice || ''
  compliance.account_cancellation_policy = data.account_cancellation_policy || ''
  compliance.data_collection_notice = data.data_collection_notice || ''
  qualifications.value = parseQualifications(data.qualifications)
  resolveQualPreviews()
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
      privacy_update_notice: compliance.privacy_update_notice,
      account_cancellation_policy: compliance.account_cancellation_policy,
      data_collection_notice: compliance.data_collection_notice,
      qualifications: JSON.stringify(cleaned)
    })
    ElMessage.success('隐私与合规配置已保存')
  } catch (error) {
    ElMessage.error(error.message || '保存失败')
  } finally {
    savingCompliance.value = false
  }
}

const guideItems = ref([])
const detectGuideType = (item = {}) => {
  if (guideAliases[item.type]) return item.type
  const category = String(item.category || '')
  const matched = Object.entries(guideAliases).find(([, aliases]) => aliases.some(alias => category.includes(alias)))
  return matched ? matched[0] : ''
}

const normalizeGuideRow = (item = {}, fallback = {}) => ({
  _id: item._id || '',
  type: item.type || fallback.type || detectGuideType(item),
  category: fallback.category || item.category || '',
  audience: item.audience || 'client',
  desc: item.desc || fallback.desc || '',
  content: item.content || '',
  media: Array.isArray(item.media) ? item.media : [],
  file: item.file_name || '',
  fileUrl: item.file_url || '',
  fileType: item.file_type || '',
  sort: item.sort || fallback.sort || 99,
  updatedAt: item.update_time ? new Date(item.update_time).toISOString().slice(0, 10) : ''
})

const mergeGuideRows = (rows = []) => {
  const fixed = guideDefaults.map(defaultGuide => {
    const matched = rows.find(item => detectGuideType(item) === defaultGuide.type)
    return normalizeGuideRow(matched || {}, defaultGuide)
  })
  // 追加自定义教程（不属于四个固定栏目的记录）
  const custom = rows
    .filter(item => !detectGuideType(item))
    .map(item => normalizeGuideRow(item))
  return [...fixed, ...custom]
}

const loadGuides = async () => {
  try {
    const token = localStorage.getItem('adminToken')
    const data = await getGuides(token)
    guideItems.value = mergeGuideRows(data || [])
  } catch (error) {
    console.error('加载教程列表失败:', error)
    guideItems.value = mergeGuideRows([])
  }
}

// 首页教程弹窗
const homeGuidePopup = reactive({ enabled: false, content: '' })
const savingHomePopup = ref(false)
const applyHomeGuidePopup = (data = {}) => {
  homeGuidePopup.enabled = data.home_guide_popup_enabled === '1' || data.home_guide_popup_enabled === true
  homeGuidePopup.content = data.home_guide_popup_content || ''
}
const saveHomePopup = async () => {
  try {
    savingHomePopup.value = true
    const token = localStorage.getItem('adminToken')
    await saveSettings(token, {
      home_guide_popup_enabled: homeGuidePopup.enabled ? '1' : '',
      home_guide_popup_content: homeGuidePopup.content
    })
    ElMessage.success('弹窗设置已保存')
  } catch (error) {
    ElMessage.error(error.message || '保存失败')
  } finally {
    savingHomePopup.value = false
  }
}

// 教程图文/媒体编辑
const guideCategoryOptions = ['报修指引', '付款说明', '寄修物流', '设备保养', '售后常见问题']
const contentDialogVisible = ref(false)
const contentGuide = ref(null)
const savingContent = ref(false)
const isNewGuide = ref(false)

const mediaTypeOf = (fileType = '', fileName = '') => {
  const t = String(fileType || '')
  if (t.startsWith('image/')) return 'image'
  if (t.startsWith('video/')) return 'video'
  if (/\.(png|jpe?g|webp|gif)$/i.test(fileName)) return 'image'
  if (/\.(mp4|mov|m4v|webm)$/i.test(fileName)) return 'video'
  return 'doc'
}

const openContentDialog = (row) => {
  isNewGuide.value = false
  contentGuide.value = {
    _id: row._id,
    type: row.type || '',
    category: row.category || '',
    audience: row.audience || 'client',
    desc: row.desc || '',
    content: row.content || '',
    media: Array.isArray(row.media) ? JSON.parse(JSON.stringify(row.media)) : []
  }
  contentDialogVisible.value = true
}

const openCreateGuide = () => {
  isNewGuide.value = true
  contentGuide.value = { _id: '', type: '', category: '', audience: 'client', desc: '', content: '', media: [] }
  contentDialogVisible.value = true
}

const handleMediaUpload = async (uploadFile) => {
  const raw = uploadFile && uploadFile.raw
  if (!raw || !contentGuide.value) return
  try {
    const { fileUrl } = await uploadFileToCloud(raw, 'tutorials/', 50 * 1024 * 1024)
    contentGuide.value.media.push({ type: mediaTypeOf(raw.type, raw.name), url: fileUrl, name: raw.name, fileType: raw.type || '' })
    ElMessage.success('媒体上传成功')
  } catch (error) {
    ElMessage.error(error.message || '媒体上传失败')
  }
}

const saveGuideContent = async () => {
  const g = contentGuide.value
  if (!g) return
  if (!g.category) { ElMessage.warning('请填写教程栏目名称'); return }
  try {
    savingContent.value = true
    const token = localStorage.getItem('adminToken')
    const payload = { category: g.category, audience: g.audience, desc: g.desc, content: g.content, media: g.media }
    if (isNewGuide.value) {
      await createGuide(token, payload)
    } else {
      await updateGuide(token, g._id, payload)
    }
    contentDialogVisible.value = false
    ElMessage.success('保存成功')
    await loadGuides()
  } catch (error) {
    ElMessage.error(error.message || '保存失败')
  } finally {
    savingContent.value = false
  }
}

const removeGuide = async (row) => {
  try {
    await ElMessageBox.confirm(`确定删除教程「${row.category}」吗？`, '提示', { type: 'warning' })
  } catch (e) {
    return
  }
  try {
    const token = localStorage.getItem('adminToken')
    await deleteGuide(token, row._id)
    ElMessage.success('已删除')
    await loadGuides()
  } catch (error) {
    ElMessage.error(error.message || '删除失败')
  }
}

const uploadDialogVisible = ref(false)
const currentGuide = ref(null)
const uploadFileList = ref([])
const uploadingGuide = ref(false)

const openUploadDialog = (row) => {
  currentGuide.value = row
  uploadFileList.value = []
  uploadDialogVisible.value = true
}
const handleFileChange = (file, fileList) => { uploadFileList.value = fileList }
const handleFileExceed = () => {
  ElMessage.warning('每个教程栏目一次只能上传 1 个文档')
}
const confirmUpload = async () => {
  if (!uploadFileList.value.length) { ElMessage.warning('请先选择要上传的文件'); return }
  if (!currentGuide.value) return
  if (!currentGuide.value._id) { ElMessage.error('教程栏目尚未初始化，请刷新页面后重试'); return }

  const file = uploadFileList.value[0].raw
  if (file.size > 10 * 1024 * 1024) {
    ElMessage.warning('教程文档不能超过 10MB')
    return
  }
  const token = localStorage.getItem('adminToken')

  try {
    uploadingGuide.value = true
    const fileContent = await new Promise((resolve, reject) => {
      const reader = new FileReader()
      reader.onload = (e) => resolve(e.target.result.split(',')[1])
      reader.onerror = reject
      reader.readAsDataURL(file)
    })
    const uploadData = await uploadGuideFile(token, fileContent, file.name, file.type)
    await updateGuide(token, currentGuide.value._id, {
      file_name: file.name,
      file_url: uploadData.fileUrl,
      file_type: file.type,
      desc: currentGuide.value.desc
    })
    uploadDialogVisible.value = false
    ElMessage.success('文档上传成功')
    await loadGuides()
  } catch (error) {
    ElMessage.error(error.message || '上传失败')
  } finally {
    uploadingGuide.value = false
  }
}

const guidePreviewVisible = ref(false)
const guidePreviewTarget = ref(null)
const openGuidePreview = (row) => { guidePreviewTarget.value = row; guidePreviewVisible.value = true }
const isWebUrl = (url = '') => /^https?:\/\//i.test(url)
const openGuideFile = (row) => {
  if (!row.fileUrl) {
    ElMessage.warning('该教程还未上传文档')
    return
  }
  if (isWebUrl(row.fileUrl)) {
    window.open(row.fileUrl, '_blank', 'noopener,noreferrer')
    return
  }
  ElMessage.info('该文件已上传到云存储，请在小程序端打开查看')
}

onMounted(() => {
  loadSettings()
  loadGuides()
})
</script>

<style scoped>
.glass-card { background: #fff; border-radius: 12px; padding: 24px; box-shadow: 0 2px 12px rgba(0,0,0,0.03); margin-bottom: 20px; }
.field-title { font-weight:600; margin-bottom:12px; }
.sub-label { font-size:13px; color:#4e5969; margin-bottom:8px; }
.save-row { margin-top:20px; text-align:center; }
.print-form { max-width: 720px; margin-top: 20px; }
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
.table-responsive { width: 100%; overflow-x: auto; }
.modern-table { min-width: 800px; }
.modern-table :deep(.el-table__inner-wrapper::before) { display: none; }
.modern-table :deep(th.el-table__cell) { background-color: #f7f8fa !important; color: #4e5969; font-weight: 600; border-bottom: none; }
.modern-table :deep(td.el-table__cell) { border-bottom: 1px solid #f0f2f5; padding: 12px 0; }
.modern-tabs :deep(.el-tabs__nav-wrap::after) { height: 1px; background-color: #f0f2f5; }
.modern-tabs :deep(.el-tabs__item) { font-size: 15px; padding: 0 20px; }
</style>
