const db = uniCloud.database()
const dbCmd = db.command
const crypto = require('crypto')

function hashPassword(password, salt) {
  return crypto.pbkdf2Sync(String(password), salt, 100000, 64, 'sha512').toString('hex')
}

function genSalt() {
  return crypto.randomBytes(16).toString('hex')
}

async function verifyAdminToken(token) {
  if (!token) throw new Error('鉴权失败')
  const res = await db.collection('cicada_users').where({ token }).limit(1).get()
  const user = res.data[0]
  if (!user || user.disabled || user.role !== 'admin') throw new Error('无权限')
  if (!user.token_expire || Date.now() > user.token_expire) throw new Error('Token已过期')
  return user
}

async function migrateDevices({ dryRun }) {
  const legacy = await db.collection('cicada_devices').limit(500).get()
  let migrated = 0

  for (const device of legacy.data) {
    if (!device.user_id || !device.product_name) continue
    const exists = await db.collection('cicada_user_devices')
      .where({
        user_id: device.user_id,
        product_name: device.product_name,
        sn: device.sn || ''
      })
      .limit(1)
      .get()
    if (exists.data.length) continue
    migrated += 1
    if (!dryRun) {
      await db.collection('cicada_user_devices').add({
        user_id: device.user_id,
        product_name: device.product_name,
        sn: device.sn || '',
        buy_date: device.buy_date || '',
        warranty_status: device.warranty_status || '',
        create_time: device.create_time || Date.now()
      })
    }
  }

  return { scanned: legacy.data.length, migrated }
}

async function fixFeedbacks({ dryRun }) {
  const res = await db.collection('cicada_feedbacks').limit(500).get()
  let fixed = 0

  for (const feedback of res.data) {
    const patch = {}
    if (!feedback.status) patch.status = '待处理'
    if (!feedback.create_time) patch.create_time = Date.now()
    if (!Object.keys(patch).length) continue
    fixed += 1
    if (!dryRun) await db.collection('cicada_feedbacks').doc(feedback._id).update(patch)
  }

  return { scanned: res.data.length, fixed }
}

async function migrateStaffPasswords({ dryRun }) {
  const res = await db.collection('cicada_users')
    .where({ role: db.command.in(['admin', 'engineer']) })
    .limit(500)
    .get()
  let migrated = 0

  for (const user of res.data) {
    if (!user.password || user.password_hash) continue
    const password_salt = genSalt()
    migrated += 1
    if (!dryRun) {
      await db.collection('cicada_users').doc(user._id).update({
        password_hash: hashPassword(user.password, password_salt),
        password_salt,
        password: ''
      })
    }
  }

  return { scanned: res.data.length, migrated }
}

async function findBrokenOrders() {
  const orders = await db.collection('cicada_orders').limit(500).get()
  const broken = []

  for (const order of orders.data) {
    const items = await db.collection('cicada_order_items')
      .where({ order_id: order._id })
      .limit(1)
      .get()
    if (!items.data.length) {
      broken.push({
        order_id: order._id,
        order_no: order.order_no,
        user_id: order.user_id
      })
    }
  }

  return { scanned: orders.data.length, broken }
}

// SN 规范化键：大写、去空格/横杠（与各业务云函数 normalizeSn 口径一致）
function normalizeSn(v) {
  return String(v == null ? '' : v).trim().toUpperCase().replace(/[\s-]+/g, '')
}

// 回填存量记录的 sn_normalized：扫描 cicada_user_devices 与 cicada_order_items，
// 为有 sn 但缺规范化键（或键不匹配）的记录补算。分批扫描避免单次超量。
async function backfillCollectionSn(collection, { dryRun }) {
  const PAGE = 500
  let skip = 0
  let scanned = 0
  let updated = 0
  // eslint-disable-next-line no-constant-condition
  while (true) {
    const res = await db.collection(collection)
      .field({ _id: true, sn: true, sn_normalized: true })
      .orderBy('_id', 'asc') // 固定顺序，保证 skip/limit 分页稳定、不漏扫
      .skip(skip).limit(PAGE).get()
    const rows = res.data || []
    if (!rows.length) break
    scanned += rows.length
    for (const row of rows) {
      const sn = String(row.sn || '').trim()
      if (!sn) continue
      const key = normalizeSn(sn)
      if (row.sn_normalized === key) continue
      updated += 1
      if (!dryRun) {
        await db.collection(collection).doc(row._id).update({ sn_normalized: key }).catch(() => {})
      }
    }
    if (rows.length < PAGE) break
    skip += PAGE
  }
  return { scanned, updated }
}

// 扫在途工单，判定 48h 未揽收 / 72h 停滞的物流异常。
// dryRun:true 仅统计；正式执行写入 cicada_order_events(action:'logistics_exception')，
// 并在工单上打 logistics_exception_at 时间戳去重（24h 内不重复写同段异常）。
async function scanLogisticsExceptions({ dryRun }) {
  const now = Date.now()
  const H = 60 * 60 * 1000
  const NO_PICKUP_MS = 48 * H
  const STALLED_MS = 72 * H
  const DEDUP_MS = 24 * H
  const PAGE = 500
  let skip = 0
  let scanned = 0
  const exceptions = []

  // eslint-disable-next-line no-constant-condition
  while (true) {
    const res = await db.collection('cicada_orders')
      .where({ status: dbCmd.in(['pending', 'sent', 'shipped']) })
      .orderBy('_id', 'asc')
      .skip(skip).limit(PAGE).get()
    const rows = res.data || []
    if (!rows.length) break
    scanned += rows.length
    for (const order of rows) {
      const out = order.ship_out_info || {}
      const back = order.ship_back_info || {}
      const outNo = String(out.logistics_no || out.logisticsNo || '').trim()
      const backNo = String(back.logistics_no || back.logisticsNo || back.return_no || back.returnNo || '').trim()
      const updatedAt = Number(order.update_time) || Number(order.create_time) || 0
      let hit = null
      if (outNo && order.status === 'pending') {
        const since = now - (Number(out.shipped_at || out.shippedAt) || Number(order.create_time) || 0)
        if (since > NO_PICKUP_MS) hit = { segment: 'out', type: 'no_pickup', hours: Math.floor(since / H), trackingNo: outNo }
      } else if (outNo && order.status === 'sent') {
        const since = now - (Number(out.shipped_at || out.shippedAt) || Number(order.create_time) || 0)
        if (since > STALLED_MS) hit = { segment: 'out', type: 'stalled', hours: Math.floor(since / H), trackingNo: outNo }
      } else if (backNo && order.status === 'shipped' && updatedAt && now - updatedAt > STALLED_MS) {
        hit = { segment: 'back', type: 'stalled', hours: Math.floor((now - updatedAt) / H), trackingNo: backNo }
      }
      if (!hit) continue
      exceptions.push({ orderNo: order.order_no || '', orderId: order._id, ...hit })
      if (!dryRun) {
        const lastAt = Number(order.logistics_exception_at) || 0
        if (now - lastAt < DEDUP_MS) continue // 24h 内已记过，跳过避免重复刷
        // cicada_order_events 为封闭 schema：source/actor_*/before/after 均必填
        await db.collection('cicada_order_events').add({
          order_id: order._id,
          order_no: order.order_no || '',
          source: 'system',
          action: 'logistics_exception',
          actor_id: 'system',
          actor_role: 'system',
          actor_name: '物流巡检',
          before: {},
          after: {
            ...hit,
            desc: `${hit.segment === 'back' ? '回寄' : '寄出'}物流${hit.type === 'no_pickup' ? '超 48h 未揽收' : '停滞超 72h'}（${hit.hours}h）`
          },
          create_time: now
        }).catch(() => {})
        await db.collection('cicada_orders').doc(order._id).update({ logistics_exception_at: now }).catch(() => {})
      }
    }
    if (rows.length < PAGE) break
    skip += PAGE
  }
  return { scanned, exceptionCount: exceptions.length, exceptions: exceptions.slice(0, 100) }
}

module.exports = {
  // 物流异常巡检：先 dryRun:true 看清单条数，再正式执行写入异常事件。
  async scanLogisticsExceptions({ token, dryRun = true } = {}) {
    try {
      await verifyAdminToken(token)
      const result = await scanLogisticsExceptions({ dryRun })
      return { code: 0, data: { dryRun, ...result } }
    } catch (e) {
      return { code: -1, msg: e.message }
    }
  },

  // 回填 sn_normalized（SN 容错检索字段）。先 dryRun:true 验证条数，再正式执行。
  async backfillSnNormalized({ token, dryRun = true } = {}) {
    try {
      await verifyAdminToken(token)
      const [devices, orderItems] = await Promise.all([
        backfillCollectionSn('cicada_user_devices', { dryRun }),
        backfillCollectionSn('cicada_order_items', { dryRun })
      ])
      return { code: 0, data: { dryRun, devices, orderItems } }
    } catch (e) {
      return { code: -1, msg: e.message }
    }
  },

  async run({ token, dryRun = true } = {}) {
    try {
      await verifyAdminToken(token)
      const [devices, feedbacks, staffPasswords, brokenOrders] = await Promise.all([
        migrateDevices({ dryRun }),
        fixFeedbacks({ dryRun }),
        migrateStaffPasswords({ dryRun }),
        findBrokenOrders()
      ])

      return {
        code: 0,
        data: {
          dryRun,
          devices,
          feedbacks,
          staffPasswords,
          brokenOrders
        }
      }
    } catch (e) {
      return { code: -1, msg: e.message }
    }
  }
}
