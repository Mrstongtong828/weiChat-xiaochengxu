export const REPAIR_PRODUCT_OPTIONS = [
  ['牙科光固化机', 'CV-215、CV-215-I、CV-215 GUN、G1、G2、G3、G4、G5、G6、G7、G8、One Sec、Sweet Cure'],
  ['牙科种植机', 'Surgic Pro+、Surgic Pro、Surgic Plus'],
  ['机用根管锉', 'DT-C3'],
  ['气动洁牙机', 'CV-S、CV-P、CV-K'],
  ['牙科根管长度测定仪', 'DPEX-6'],
  ['牙科弯手机', 'D45L、D15L、DW15L'],
  ['牙科种植手机', 'W201L、SG20、W20L、CX20'],
  ['喷砂洁牙机', 'DT-X1、DT-X2、DT-X3、DT-X4、DT-X5'],
  ['根管预备机', 'T-Fine-II(IS)、T-Fine-II(LED)、T-Fine-II(CC)'],
  ['高速气涡轮手机', 'CV/GX602、CV/GX604、CV/GX612、CV/GX、CV/GX622、CV/GX624、CV/GX632、CV/GX634、CV/GX642、CV/GX644、CV/GX652、CV/GX654、GK01L、GK02L、GK03L、GK45L、GN02L、GN45L、GN01、G401、G402、G445、G406、G408、G409、G410、G201、G245、G206、G208、G209、G210'],
  ['网电源供电骨组织手术设备', 'DT-JZ1'],
  ['牙科抛光手机', 'PMTC-I、PMTC-E'],
  ['牙科低压电动马达', 'NL 400-1、NL 400-2、NL 400-3、NL 400-4、NL 400-5'],
  ['低速气动马达手机', 'CV/DX、CV/DX802、J05/D05M/D05Z、J03W/D05M/D05Z、J04/D05M/D05Z、D02W/D02M/D02Z、Z45L/D02M/D02Z、Z01/D02M/D02Z、D04W/D04M/D04Z、D01W/D01M/D01Z、D05W/D04M/D04Z、D04W/D04M/D03Z、J03Z'],
  ['热熔牙胶充填系统', 'DT-Fill、DT-Fill Plus'],
  ['牙科去冠器', 'EASY REMOVER 01'],
  ['超声洁牙机工作尖', 'CV-EN18、CV-EN22、CV-EN28'],
  ['医用放大镜', 'CV-288、CV-292'],
  ['牙科用刀', '15HD、25HD、40HD、60HD、90HD、OKS15、OKS25、OKS40、OKS60、OKS80'],
  ['牙科用镊', '根管锉夹持器 DT-JCQ-I'],
  ['一次性使用牙科冲洗针', 'S-27G-22、S-27G-26、S-30G-22、S-30G-26、PP-S-26G-26'],
  ['口腔冲洗器', 'DT-CX1'],
  ['牙用充填器', 'D01、D02、D03'],
  ['牙科种植用扳手', 'F型'],
  ['牙科医师椅', 'B型、M型、S型'],
  ['牙胶尖切断器', 'CV-Fill-P1'],
  ['一次性使用护牙弯角', 'DT-HY01、DT-HY02'],
  ['气动洁牙机工作尖', 'SJ1、SJ2、SJ3、SG1、SG2、SQ1、SQ2、SQ3、SW1、SW2、SW3、SY1、SZ1']
].map(([name, model]) => ({
  name,
  models: model.split('、').map(item => item.trim()).filter(Boolean)
}))

const PRODUCT_MODEL_MAP = new Map(REPAIR_PRODUCT_OPTIONS.map(item => [item.name, item.models]))

export const getRepairProductModels = (productName = '') => (
  PRODUCT_MODEL_MAP.get(String(productName || '').trim()) || []
)
