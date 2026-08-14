import assert from 'node:assert/strict'
import {
  buildPrintHtml,
  defaultPrintTemplate,
  openPrintWindow,
  parsePrintConfig,
  parsePrintTemplates
} from '../src/utils/orderPrint.js'

const order = {
  id: 'SH20260074',
  clinicName: '德良口腔',
  customerName: '陈先生',
  phone: '13800000000',
  complaintCode: 'FK20260078',
  submitTime: '2026-05-30 09:30',
  receivedTime: '2026-05-30',
  completedTime: '2026-06-02',
  updateTime: '2026-08-01 10:00',
  paymentStatus: 'uploaded',
  itemsList: [{
    product_name: '根管预备机',
    product_model: 'T-Fine-II',
    unit: '支',
    quantity: 1,
    batch_no: '20E19 246',
    fault_desc: '不好充电，机芯卡',
    fix_solution: '更换机芯、充电顶针',
    coverage_result: 'free'
  }],
  quoteDetail: {
    parts: [{ name: '机芯组件', unitPrice: 380, quantity: 1, amount: 380 }],
    services: [{ name: '维修服务', unitPrice: 200, quantity: 1, amount: 200 }],
    others: [],
    parts_total: 380,
    services_total: 200,
    others_total: 0,
    final_price: 580
  },
  receivedParts: [{ name: 'Calibration tool', quantity: 3, remark: 'Packed with device' }],
  receivedPartPhotos: [{ url: 'data:image/png;base64,dGVzdA==' }],
  receivedPartsReceipt: {
    status: 'confirmed',
    confirmed_at: '2026-08-14 14:46:49',
    confirmed_by_name: 'System Admin'
  }
}

const templates = parsePrintTemplates(JSON.stringify({
  quote: { paperSize: 'A5' }
}))

assert.equal(templates.quote.title, '维修报价单', '部分报价配置应保留报价单默认标题')
assert.equal(templates.quote.paperSize, 'A5')
assert.equal(templates.repair_order.orientation, 'landscape')

assert.equal(defaultPrintTemplate('repair_order').companyName, '佛山市登煌医疗器械有限公司')
assert.equal(
  parsePrintConfig({ companyName: '佛山市壹煌医疗器械有限公司' }, 'repair_order').companyName,
  '佛山市登煌医疗器械有限公司',
  '旧模板里的公司名应自动修正为新公司名'
)

const repairTemplate = defaultPrintTemplate('repair_order')
let repairHtml = buildPrintHtml([order], repairTemplate, 'repair_order')
assert.match(repairHtml, /佛山市登煌医疗器械有限公司/)
assert.doesNotMatch(repairHtml, /佛山市壹煌医疗器械有限公司/)
assert.match(repairHtml, /售后维修单/)
assert.match(repairHtml, /维修措施/)
assert.match(repairHtml, /更换机芯、充电顶针/)
assert.match(repairHtml, /20E19 246/)
assert.match(repairHtml, /received-part-print-group/)
assert.match(repairHtml, /Calibration tool/)
assert.match(repairHtml, /Packed with device/)
assert.match(repairHtml, /System Admin/)
assert.match(repairHtml, /data:image\/png;base64,dGVzdA==/)
assert.match(repairHtml, /维修完成日期/)
assert.doesNotMatch(repairHtml, /2026年6月2日/, '维修单完工日期应留空，由工程师手写')
assert.doesNotMatch(repairHtml, /2026年8月1日/, '维修单不应把更新时间当成完工日期')

repairTemplate.fields.find(item => item.key === 'batchNo').visible = false
repairTemplate.fields.push({
  key: 'custom_quality',
  label: '质检结果',
  group: 'item',
  visible: true,
  width: 10,
  defaultValue: '功能正常',
  custom: true
})
const customField = repairTemplate.fields.pop()
repairTemplate.fields.splice(10, 0, customField)
const reorderedTemplate = parsePrintTemplates({ repair_order: repairTemplate }).repair_order
const batchNoField = reorderedTemplate.fields.find(item => item.key === 'batchNo')
const customQualityField = reorderedTemplate.fields.find(item => item.key === 'custom_quality')
assert.equal(batchNoField.label, '批号', '系统字段名称应保持锁定，不被旧模板改乱')
assert.equal(customQualityField.label, '质检结果', '自定义项目应继续保留')
assert.ok(
  reorderedTemplate.fields.findIndex(item => item.key === 'custom_quality') > reorderedTemplate.fields.findIndex(item => item.key === 'serviceSignature'),
  '自定义项目应放在系统字段之后，避免插乱系统字段顺序'
)
repairHtml = buildPrintHtml([order], repairTemplate, 'repair_order')
assert.doesNotMatch(repairHtml, /批号/)
assert.match(repairHtml, /质检结果/)
assert.match(repairHtml, /功能正常/)

const settlementHtml = buildPrintHtml([order], defaultPrintTemplate('settlement'), 'settlement')
assert.match(settlementHtml, /待财务审核/)
assert.match(settlementHtml, /2026年6月2日/, '结算单仍应显示真实维修完成日期')
assert.doesNotMatch(settlementHtml, /2026年8月1日/, '结算单不应回退到更新时间')
assert.doesNotMatch(settlementHtml, />uploaded</)

let printCalls = 0
let writtenHtml = ''
global.window = {
  open: () => ({
    closed: false,
    document: {
      images: [],
      open() {},
      write(value) { writtenHtml = value },
      close() {}
    },
    focus() {},
    requestAnimationFrame(callback) { callback() },
    print() { printCalls += 1 }
  })
}

assert.equal(openPrintWindow([order], repairTemplate, 'repair_order'), true)
assert.match(writtenHtml, /__cicadaPrintStarted/)
await new Promise(resolve => setTimeout(resolve, 450))
assert.match(writtenHtml, /售后维修单/)
assert.equal(printCalls, 1, '打印资源准备完成后应只调用一次 print')

console.log('print template checks passed')
