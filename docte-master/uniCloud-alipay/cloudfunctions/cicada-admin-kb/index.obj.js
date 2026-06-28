const db = uniCloud.database()

async function verifyAdminToken(token, allowedRoles = ['admin']) {
  if (!token) throw new Error('鉴权失败：非管理人员禁止访问该接口')
  const res = await db.collection('cicada_users').where({ token }).limit(1).get()
  const user = res.data[0]
  if (!user || user.disabled || !allowedRoles.includes(user.role)) {
    throw new Error('鉴权失败：非管理人员禁止访问该接口')
  }
  if (Date.now() > user.token_expire) throw new Error('鉴权失败：Token已过期')
  return user
}

function pickFields(source = {}, fields = []) {
  return fields.reduce((result, field) => {
    if (Object.prototype.hasOwnProperty.call(source, field)) {
      result[field] = source[field]
    }
    return result
  }, {})
}

module.exports = {
  async _before() {
    let token
    const httpInfo = this.getHttpInfo && this.getHttpInfo()
    if (httpInfo && httpInfo.body) {
      const body = JSON.parse(httpInfo.body)
      token = body.token
    } else {
      const params = this.getParams()[0] || {}
      token = params.token
    }
    await verifyAdminToken(token, ['admin', 'engineer'])
  },

  // 统一错误出口：_before/方法体抛出的异常（如鉴权失败）转成 { code: -1 } 正常返回，
  // 避免 URL 化下未捕获异常导致 HTTP 500（前端据 code 处理/跳登录）
  _after(error, result) {
    if (error) {
      return { code: -1, msg: (error && error.message) ? error.message : '请求失败' }
    }
    return result
  },

  async manageCategories(params) {
    try {
      let action, id, data
      if (params && params.action) {
        ({ action, id, data } = params)
      } else {
        const httpInfo = this.getHttpInfo && this.getHttpInfo()
        if (httpInfo && httpInfo.body) {
          const body = JSON.parse(httpInfo.body)
          ;({ action, id, data } = body)
        }
      }
      const col = db.collection('cicada_product_categories')
      if (action === 'add') {
        const category = pickFields(data, ['category_name', 'status', 'sort'])
        if (!category.category_name) return { code: -1, msg: '分类名称不能为空' }
        if (!category.status) category.status = '上架'
        const res = await col.add({ ...category, create_time: Date.now() })
        return { code: 0, data: { id: res.id } }
      } else if (action === 'update') {
        if (!id) return { code: -1, msg: '缺少分类ID' }
        const category = pickFields(data, ['category_name', 'status', 'sort'])
        if (!Object.keys(category).length) return { code: -1, msg: '没有可更新的分类字段' }
        const res = await col.doc(id).update(category)
        if (!res.updated) return { code: -1, msg: '分类不存在' }
        return { code: 0 }
      } else if (action === 'delete') {
        if (!id) return { code: -1, msg: '缺少分类ID' }
        const res = await col.doc(id).remove()
        if (!res.deleted) return { code: -1, msg: '分类不存在' }
        return { code: 0 }
      } else {
        const res = await col.orderBy('sort', 'asc').get()
        return { code: 0, data: res.data }
      }
    } catch (e) {
      return { code: -1, msg: e.message }
    }
  },

  async manageFaultKb(params) {
    try {
      let action, id, data
      if (params && params.action) {
        ({ action, id, data } = params)
      } else {
        const httpInfo = this.getHttpInfo && this.getHttpInfo()
        if (httpInfo && httpInfo.body) {
          const body = JSON.parse(httpInfo.body)
          ;({ action, id, data } = body)
        }
      }
      const col = db.collection('cicada_fault_kb')
      if (action === 'add') {
        const kb = pickFields(data, [
          'category_id',
          'fault_name',
          'related_questions',
          'check_steps',
          'fix_solutions',
          'is_recommend_repair'
        ])
        if (!kb.category_id || !kb.fault_name) return { code: -1, msg: '分类和故障名称不能为空' }
        const res = await col.add({ ...kb, create_time: Date.now() })
        return { code: 0, data: { id: res.id } }
      } else if (action === 'update') {
        if (!id) return { code: -1, msg: '缺少知识库ID' }
        const kb = pickFields(data, [
          'category_id',
          'fault_name',
          'related_questions',
          'check_steps',
          'fix_solutions',
          'is_recommend_repair'
        ])
        if (!Object.keys(kb).length) return { code: -1, msg: '没有可更新的知识库字段' }
        const res = await col.doc(id).update(kb)
        if (!res.updated) return { code: -1, msg: '知识库条目不存在' }
        return { code: 0 }
      } else if (action === 'delete') {
        if (!id) return { code: -1, msg: '缺少知识库ID' }
        const res = await col.doc(id).remove()
        if (!res.deleted) return { code: -1, msg: '知识库条目不存在' }
        return { code: 0 }
      } else {
        const query = data && data.category_id
          ? col.where({ category_id: data.category_id })
          : col
        const res = await query.get()
        return { code: 0, data: res.data }
      }
    } catch (e) {
      return { code: -1, msg: e.message }
    }
  }
}
