import { createLatestTask } from '../../utils/latestTask.js'

export const createWorkOrderQuery = ({ fetchPage, transform, toStatus, resolveCustomerType, toDateRange }) => {
  const latest = createLatestTask()

  const statusFrom = (filter) => filter === '处理中'
    ? ['inspecting', 'fixing']
    : (filter ? toStatus(filter) : undefined)

  const filtersFrom = (state, dateRange = state.dateRange) => ({
    keyword: String(state.search || '').trim(),
    invoiceStatus: state.invoiceStatus || '',
    warrantyStatus: state.warrantyFilter || '',
    customerType: resolveCustomerType(state.customerTypeFilter),
    todoType: state.todoType || '',
    slaLevel: state.slaLevel || '',
    ...toDateRange(dateRange),
    responseMode: 'page'
  })

  const normalize = (data) => {
    const list = Array.isArray(data) ? data : (data.list || [])
    const rows = transform(list)
    return { rows, total: Array.isArray(data) ? rows.length : Number(data.total || 0) }
  }

  return {
    async loadPage(token, state) {
      const result = await latest.run(() => fetchPage(
        token,
        statusFrom(state.filter),
        state.page,
        state.pageSize,
        filtersFrom(state)
      ))
      if (!result.accepted) return { accepted: false, rows: [], total: 0 }
      return { accepted: true, ...normalize(result.value) }
    },

    async loadAll(token, state, dateRange = null) {
      const pageSize = 100
      let page = 1
      let total = 0
      const rows = []
      while (true) {
        const data = await fetchPage(token, statusFrom(state.filter), page, pageSize, {
          ...filtersFrom(state, dateRange),
          responseMode: 'page'
        })
        const normalized = normalize(data)
        total = normalized.total
        rows.push(...normalized.rows)
        if (rows.length >= total || normalized.rows.length < pageSize) break
        page += 1
      }
      return rows
    },

    cancel() {
      latest.cancel()
    }
  }
}
