const test = require('node:test')
const assert = require('node:assert/strict')

const {
  SUBSCRIPTION_CONFIG_SCENES,
  getSubscriptionTemplateKey,
  buildSubscriptionData
} = require('./index')

const order = {
  _id: 'order-id',
  order_no: 'DR202607200001',
  product_name: '牙科综合治疗机',
  product_model: 'DC-8800',
  sn: 'SN-2026-001',
  total_price: 1280.5,
  create_time: Date.UTC(2026, 6, 20, 2, 30, 0),
  quote_update_time: Date.UTC(2026, 6, 20, 3, 30, 0),
  payment_update_time: Date.UTC(2026, 6, 20, 4, 30, 0),
  fix_solution: '更换主板后测试正常',
  invoice_info: { need_invoice: true, status: '已开具' },
  warehouse_address: '广东省佛山市南海区维修中心',
  ship_out_info: { logistics_no: 'SF1234567890' },
  ship_back_info: {
    region: '广东省佛山市南海区',
    detail: '桂城街道某某口腔诊所',
    logistics_no: 'YT9876543210'
  }
}

test('exposes exactly five production template configurations', () => {
  assert.deepEqual(
    SUBSCRIPTION_CONFIG_SCENES.map(item => item.envKey),
    ['REPAIR_SUBMIT', 'DEVICE_RECEIVE_SHIP', 'PAYMENT_QUOTE', 'PROCESS_TIP', 'ORDER_FINISH_INVOICE']
  )
})

test('maps reused business scenes to the same template key', () => {
  assert.equal(getSubscriptionTemplateKey('order_received'), 'DEVICE_RECEIVE_SHIP')
  assert.equal(getSubscriptionTemplateKey('order_shipped'), 'DEVICE_RECEIVE_SHIP')
  assert.equal(getSubscriptionTemplateKey('quote_issued'), 'PAYMENT_QUOTE')
  assert.equal(getSubscriptionTemplateKey('payment_confirmed'), 'PAYMENT_QUOTE')
  assert.equal(getSubscriptionTemplateKey('payment_rejected'), 'PAYMENT_QUOTE')
  assert.equal(getSubscriptionTemplateKey('order_completed'), 'ORDER_FINISH_INVOICE')
})

test('builds repair submission fields for the real template keywords', () => {
  const data = buildSubscriptionData(order, 'repair_submitted', '报修申请已提交')
  assert.deepEqual(Object.keys(data), ['thing1', 'character_string2', 'phrase3', 'thing4'])
  assert.equal(data.thing1.value, 'DC-8800')
  assert.equal(data.character_string2.value, order.order_no)
  assert.equal(data.phrase3.value, '已受理')
  assert.equal(data.thing4.value, '报修已受理，请留意后续进度')
})

test('builds inbound and return shipment fields for the shared pickup template', () => {
  const received = buildSubscriptionData(order, 'order_received', '设备已确认入库')
  const shipped = buildSubscriptionData(order, 'order_shipped', '设备已回寄')

  assert.deepEqual(Object.keys(received), ['character_string1', 'thing3', 'character_string6', 'thing5'])
  assert.equal(received.character_string6.value, 'SF1234567890')
  assert.match(received.thing3.value, /维修中心/)
  assert.deepEqual(Object.keys(shipped), ['character_string1', 'thing3', 'character_string6', 'thing5'])
  assert.equal(shipped.character_string6.value, 'YT9876543210')
  assert.match(shipped.thing3.value, /口腔诊所/)
})

test('builds quote and payment-result fields for the shared pending-payment template', () => {
  for (const scene of ['quote_issued', 'payment_confirmed', 'payment_rejected']) {
    const data = buildSubscriptionData(order, scene)
    assert.deepEqual(Object.keys(data), ['thing1', 'thing2', 'date3', 'amount4', 'character_string5'])
    assert.equal(data.thing2.value, 'DC-8800')
    assert.equal(data.amount4.value, '1280.50元')
    assert.equal(data.character_string5.value, order.order_no)
    assert.match(data.date3.value, /^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/)
  }
  assert.match(buildSubscriptionData(order, 'payment_confirmed').thing1.value, /到账/)
  assert.match(buildSubscriptionData(order, 'payment_rejected').thing1.value, /未通过/)
})

test('builds process and completion fields with valid lengths', () => {
  const process = buildSubscriptionData(order, 'process_tip', '工程师正在检测设备故障')
  const completed = buildSubscriptionData(order, 'order_completed', '更换主板后测试正常')

  assert.deepEqual(Object.keys(process), ['character_string1', 'character_string2', 'thing3'])
  assert.deepEqual(Object.keys(completed), ['character_string1', 'thing3', 'thing4'])
  assert.match(completed.thing4.value, /^更换主板/)
  assert.match(completed.thing4.value, /发票已开具/)

  for (const field of Object.values({ ...process, ...completed })) {
    assert.ok(field.value.length <= 32)
  }
  assert.ok(completed.thing3.value.length <= 20)
  assert.ok(completed.thing4.value.length <= 20)
})

test('does not claim an invoice is issued before the invoice status confirms it', () => {
  const completed = buildSubscriptionData({
    ...order,
    status: 'completed',
    payment_method: 'offline_transfer',
    payment_status: 'paid',
    invoice_info: { need_invoice: true, status: '待开票' }
  }, 'order_completed', '维修已完成')

  assert.doesNotMatch(completed.thing4.value, /已开具/)
  assert.match(completed.thing4.value, /开具后/)
  assert.ok(completed.thing4.value.length <= 20)
})

test('completed WeChat Pay orders never prompt the customer to request or download an invoice', () => {
  const completed = buildSubscriptionData({
    ...order,
    payment_method: 'wechat_pay',
    invoice_info: {}
  }, 'order_completed', '维修已完成')

  assert.match(completed.thing4.value, /微信支付订单不提供发票/)
  assert.doesNotMatch(completed.thing4.value, /申请|下载/)
})

test('stale invoice state cannot make an ineligible order promise invoice delivery', () => {
  const wechat = buildSubscriptionData({
    ...order,
    status: 'completed',
    payment_method: 'wechat_pay',
    payment_status: 'paid',
    invoice_info: { need_invoice: true, status: '待开票' }
  }, 'order_completed', '维修已完成')
  const unreconciled = buildSubscriptionData({
    ...order,
    status: 'completed',
    payment_method: 'offline_transfer',
    payment_status: 'uploaded',
    invoice_info: { need_invoice: true, status: '待开票' }
  }, 'order_completed', '维修已完成')

  assert.match(wechat.thing4.value, /微信支付订单不提供发票/)
  assert.doesNotMatch(wechat.thing4.value, /开具后/)
  assert.match(unreconciled.thing4.value, /款项核销后可申请发票/)
  assert.doesNotMatch(unreconciled.thing4.value, /开具后/)
})
