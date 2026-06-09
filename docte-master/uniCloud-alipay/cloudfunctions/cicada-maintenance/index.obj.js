const db = uniCloud.database()
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

module.exports = {
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
