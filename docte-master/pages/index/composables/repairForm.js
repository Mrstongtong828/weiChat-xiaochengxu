import { REPAIR_PRODUCT_MODEL_OTHER_LABEL } from '../../../config/repair-product-models.mjs'

export const defaultRepairForm = () => ({
	customerType: '',
	logisticsCompany: '顺丰快递',
	trackingNo: '',
	sendMethod: '顺丰取件',
	senderName: '',
	senderPhone: '',
	senderAddress: '',
	receiverName: '',
	receiverPhone: '',
	receiverAddress: '',
	receiverUnit: ''
})

export const createRepairProduct = (id = 1) => ({
	id,
	productId: '',
	isCustomName: false,
	isCustomModel: false,
	modelPickerOptions: [REPAIR_PRODUCT_MODEL_OTHER_LABEL],
	name: '',
	category: '',
	model: '',
	serial: '',
	buyDate: '',
	voucher: '',
	voucherList: [],
	faultDesc: '',
	media: [],
	snInfo: null,
	snLoading: false
})
