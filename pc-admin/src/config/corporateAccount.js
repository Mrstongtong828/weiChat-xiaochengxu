export const DEFAULT_CORPORATE_ACCOUNT = Object.freeze({
  companyName: '佛山市登煌医疗器械有限公司',
  bankName: '中国农业银行佛山惠景支行',
  accountNo: '4442 3201 0400 04288'
})

export const resolveCorporateAccount = (settings = {}) => ({
  companyName: settings.bank_transfer_company_name || DEFAULT_CORPORATE_ACCOUNT.companyName,
  bankName: settings.bank_transfer_bank_name || DEFAULT_CORPORATE_ACCOUNT.bankName,
  accountNo: settings.bank_transfer_account_no || DEFAULT_CORPORATE_ACCOUNT.accountNo
})

export const isCorporateTransferPayment = (method = '') => (
  ['offline_transfer', 'bank_transfer'].includes(String(method || '').trim())
)

export const isInvoicePaymentMethod = (method = '') => (
  ['offline_transfer', 'bank_transfer', 'wechat_pay'].includes(String(method || '').trim())
)

export const getPaymentMethodLabel = (method = '') => ({
  offline_transfer: '对公支付',
  bank_transfer: '对公支付',
  wechat_pay: '微信支付'
}[String(method || '').trim()] || '未选择')
