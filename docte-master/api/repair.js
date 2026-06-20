import { unwrapCloudResult, uploadToCloud, withToken } from './cloudHelpers.js'
import { importCloudObject } from '@/utils/cloud.js'

let orderCloudObject = null

const getCloudObject = () => {
  if (!orderCloudObject) {
    orderCloudObject = importCloudObject('cicada-client-order')
  }
  return orderCloudObject
}

const normalizePageParams = ({ page = 1, pageSize, size, ...rest } = {}) => ({
  ...rest,
  page,
  pageSize: pageSize || size || 10
})

const normalizeOrderId = (id) => ({
  order_id: id
})

const normalizeUrlArray = (...values) => {
  return values.reduce((urls, value) => {
    if (Array.isArray(value)) {
      return urls.concat(value)
    }
    if (value) {
      urls.push(value)
    }
    return urls
  }, []).filter(Boolean)
}

const normalizeSubmitRepairPayload = (data = {}) => {
  if (data.ship_out_info && data.ship_back_info && Array.isArray(data.items)) {
    return data
  }

  const products = Array.isArray(data.products) && data.products.length
    ? data.products
    : [data]

  return {
    ship_out_info: {
      name: data.senderName || data.receiverName || '',
      phone: data.senderPhone || data.receiverPhone || '',
      region: data.senderRegion || data.receiverRegion || '',
      detail: data.senderAddress || data.receiverAddress || '',
      unit: data.receiverUnit || '',
      logistics_company: data.logisticsCompany || '',
      logistics_no: data.trackingNo || '',
      send_method: data.sendMethod || ''
    },
    ship_back_info: {
      name: data.receiverName || data.senderName || '',
      phone: data.receiverPhone || data.senderPhone || '',
      region: data.receiverRegion || data.senderRegion || '',
      detail: data.receiverAddress || data.senderAddress || '',
      unit: data.receiverUnit || ''
    },
    items: products.map((item = {}) => ({
      product_name: item.productName || item.name || data.productName || '维修产品',
      product_model: item.productModel || item.model || data.productModel || '',
      sn: item.productSerial || item.serial || data.productSerial || '',
      buy_date: item.buyDate || data.buyDate || '',
      fault_desc: item.faultDesc || item.faultType || data.faultDesc || data.faultType || '',
      voucher_urls: normalizeUrlArray(item.voucher_urls, item.voucherUrls, item.voucherImages),
      image_urls: normalizeUrlArray(item.image_urls, item.imageUrls, item.images),
      video_urls: normalizeUrlArray(item.video_urls, item.videoUrls, item.videos),
      media_urls: normalizeUrlArray(item.media_urls, item.mediaUrls)
    }))
  }
}

export const getRepairList = (params = {}) => {
  return getCloudObject().getOrderList(withToken(normalizePageParams(params))).then(unwrapCloudResult)
}

export const getRepairDetail = (id) => {
  return getCloudObject().getOrderDetail(withToken(normalizeOrderId(id))).then(unwrapCloudResult)
}

export const submitRepair = (data) => {
  return getCloudObject().createOrder(withToken(normalizeSubmitRepairPayload(data || {}))).then(unwrapCloudResult)
}

export const cancelRepair = (id, reason) => {
  return getCloudObject().cancelOrder(withToken({ ...normalizeOrderId(id), reason })).then(unwrapCloudResult)
}

export const confirmRepairQuote = (id) => {
  return getCloudObject().confirmQuote(withToken(normalizeOrderId(id))).then(unwrapCloudResult)
}

export const uploadRepairPaymentProof = (id, proof = {}) => {
  return getCloudObject().uploadPaymentProof(withToken({ ...normalizeOrderId(id), proof })).then(unwrapCloudResult)
}

export const createRepairWechatPay = (id) => {
  return getCloudObject().createWechatPayPayment(withToken(normalizeOrderId(id))).then(unwrapCloudResult)
}

export const syncRepairWechatPay = (id, outTradeNo = '') => {
  return getCloudObject().syncWechatPayPayment(withToken({ ...normalizeOrderId(id), out_trade_no: outTradeNo })).then(unwrapCloudResult)
}

export const lookupDeviceBySn = (sn) => {
  return getCloudObject().lookupDeviceBySn(withToken({ sn })).then(unwrapCloudResult)
}

export const getRepairStats = () => {
  return Promise.resolve({})
}

export const uploadRepairImage = (filePath) => {
  return uploadToCloud(filePath, 'repair/images', 'jpg')
}
