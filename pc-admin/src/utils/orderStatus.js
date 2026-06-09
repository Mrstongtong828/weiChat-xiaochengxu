// 工单状态映射

// 后端状态到前端中文
export const STATUS_MAP = {
  'pending': '已提交',
  'sent': '运输中',
  'received': '已签收',
  'inspecting': '处理中',
  'fixing': '处理中',
  'processing': '处理中',
  'shipped': '已回寄',
  'completed': '已完成',
  'cancelled': '已取消',
  '待处理': '已提交',
  '维修中': '处理中',
  '已发货': '已回寄',
  '已处理': '已完成'
}

// 前端中文到后端状态
export const STATUS_REVERSE_MAP = {
  '待处理': 'pending',
  '已提交': 'pending',
  '运输中': 'sent',
  '已签收': 'received',
  '处理中': 'fixing',
  '维修中': 'fixing',
  '已回寄': 'shipped',
  '已发货': 'shipped',
  '已完成': 'completed',
  '已处理': 'completed',
  '已取消': 'cancelled'
}

// 状态对应的标签类型
export const STATUS_TAG_TYPE = {
  'pending': 'info',
  'sent': 'warning',
  'received': 'warning',
  'inspecting': 'primary',
  'fixing': 'primary',
  'processing': 'primary',
  'shipped': 'success',
  'completed': 'success',
  'cancelled': 'danger'
}

// 转换函数
export const toChineseStatus = (status) => STATUS_MAP[status] || status
export const toEnglishStatus = (status) => STATUS_REVERSE_MAP[status] || status
export const getStatusTagType = (status) => STATUS_TAG_TYPE[status] || 'info'
