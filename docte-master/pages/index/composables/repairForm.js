export const defaultRepairForm = () => ({
	logisticsCompany: '顺丰速运',
	trackingNo: '',
	sendMethod: '顺丰取件',
	receiverName: '',
	receiverPhone: '',
	receiverAddress: '',
	receiverUnit: ''
})

export const createRepairProduct = (id = 1) => ({
	id,
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
