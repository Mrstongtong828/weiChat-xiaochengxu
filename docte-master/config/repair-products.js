export const REPAIR_PRODUCT_OTHER_VALUE = '__other__'
export {
	createRepairProductModelOptions,
	REPAIR_PRODUCT_MODEL_OTHER_LABEL,
	REPAIR_PRODUCT_MODEL_OTHER_VALUE,
	splitRepairProductModels
} from './repair-product-models.mjs'

const sourceOptions = [
	{ label: '牙科光固化机', model: 'CV-215、CV-215-I、CV-215 GUN、G1、G2、G3、G4、G5、G6、G7、G8、One Sec、Sweet Cure', initials: 'ykgghj' },
	{ label: '牙科种植机', model: 'Surgic Pro+、Surgic Pro、Surgic Plus', initials: 'ykzzj' },
	{ label: '机用根管锉', model: 'DT-C3', initials: 'jyggc' },
	{ label: '气动洁牙机', model: 'CV-S、CV-P、CV-K', initials: 'qdjyj' },
	{ label: '牙科根管长度测定仪', model: 'DPEX-6', initials: 'ykggcdcdy' },
	{ label: '牙科弯手机', model: 'D45L、D15L、DW15L', initials: 'ykwsj' },
	{ label: '牙科种植手机', model: 'W201L、SG20、W20L、CX20', initials: 'ykzzsj' },
	{ label: '喷砂洁牙机', model: 'DT-X1、DT-X2、DT-X3、DT-X4、DT-X5', initials: 'psjyj' },
	{ label: '根管预备机', model: 'T-Fine-II(IS)、T-Fine-II(LED)、T-Fine-II(CC)', initials: 'ggybj' },
	{ label: '高速气涡轮手机', model: 'CV/GX602、CV/GX604、CV/GX612、CV/GX、CV/GX622、CV/GX624、CV/GX632、CV/GX634、CV/GX642、CV/GX644、CV/GX652、CV/GX654、GK01L、GK02L、GK03L、GK45L、GN02L、GN45L、GN01、G401、G402、G445、G406、G408、G409、G410、G201、G245、G206、G208、G209、G210', initials: 'gsqwlssj' },
	{ label: '网电源供电骨组织手术设备', model: 'DT-JZ1', initials: 'wdygdgzzsssb' },
	{ label: '牙科抛光手机', model: 'PMTC-I、PMTC-E', initials: 'ykpgsj' },
	{ label: '牙科低压电动马达', model: 'NL 400-1、NL 400-2、NL 400-3、NL 400-4、NL 400-5', initials: 'ykdyddmd' },
	{ label: '低速气动马达手机', model: 'CV/DX、CV/DX802、J05/D05M/D05Z、J03W/D05M/D05Z、J04/D05M/D05Z、D02W/D02M/D02Z、Z45L/D02M/D02Z、Z01/D02M/D02Z、D04W/D04M/D04Z、D01W/D01M/D01Z、D05W/D04M/D04Z、D04W/D04M/D03Z、J03Z', initials: 'dsqdmdsj' },
	{ label: '热熔牙胶充填系统', model: 'DT-Fill、DT-Fill Plus', initials: 'rryjctxx' },
	{ label: '牙科去冠器', model: 'EASY REMOVER 01', initials: 'ykqgq' },
	{ label: '超声洁牙机工作尖', model: 'CV-EN18、CV-EN22、CV-EN28', initials: 'csjyjgzj' },
	{ label: '医用放大镜', model: 'CV-288、CV-292', initials: 'yyfdj' },
	{ label: '牙科用刀', model: '15HD、25HD、40HD、60HD、90HD、OKS15、OKS25、OKS40、OKS60、OKS80', initials: 'ykyd' },
	{ label: '牙科用镊', model: '根管锉夹持器 DT-JCQ-I', initials: 'ykyn' },
	{ label: '一次性使用牙科冲洗针', model: 'S-27G-22、S-27G-26、S-30G-22、S-30G-26、PP-S-26G-26', initials: 'ycxsykcxz' },
	{ label: '口腔冲洗器', model: 'DT-CX1', initials: 'kqcxq' },
	{ label: '牙用充填器', model: 'D01、D02、D03', initials: 'yyctq' },
	{ label: '牙科种植用扳手', model: 'F型', initials: 'ykzzybs' },
	{ label: '牙科医师椅', model: 'B型、M型、S型', initials: 'ykysy' },
	{ label: '牙胶尖切断器', model: 'CV-Fill-P1', initials: 'yjjqdq' },
	{ label: '一次性使用护牙弯角', model: 'DT-HY01、DT-HY02', initials: 'ycxsyhywj' },
	{ label: '气动洁牙机工作尖', model: 'SJ1、SJ2、SJ3、SG1、SG2、SQ1、SQ2、SQ3、SW1、SW2、SW3、SY1、SZ1', initials: 'qdjyjgzj' }
]

export const repairProductOptions = sourceOptions.map((item, index) => ({
	id: `repair-product-${String(index + 1).padStart(2, '0')}`,
	value: `repair-product-${String(index + 1).padStart(2, '0')}`,
	name: item.label,
	product_name: item.label,
	label: item.label,
	model: item.model,
	initials: item.initials,
	searchKeywords: [item.label, item.model, item.initials].join(' ').toLowerCase()
}))

export const repairProductOtherOption = {
	id: REPAIR_PRODUCT_OTHER_VALUE,
	value: REPAIR_PRODUCT_OTHER_VALUE,
	name: '其他',
	label: '其他',
	model: '',
	initials: 'qt',
	searchKeywords: '其他 qt'
}
