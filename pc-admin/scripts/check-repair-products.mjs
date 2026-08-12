import fs from 'node:fs'
import path from 'node:path'
import vm from 'node:vm'
import { REPAIR_PRODUCT_OPTIONS, getRepairProductModels } from '../src/config/repairProducts.js'

const projectRoot = process.cwd()
const fail = (message) => {
  console.error(`[fail] ${message}`)
  process.exitCode = 1
}

const adminRows = REPAIR_PRODUCT_OPTIONS.map(item => [item.name, item.models.join('、')])

const miniPath = path.resolve(projectRoot, '../docte-master/config/repair-products.js')
const miniSource = fs.readFileSync(miniPath, 'utf8')
const miniBlock = miniSource.match(/const sourceOptions = (\[[\s\S]*?\n\])/)
const miniRows = miniBlock
  ? vm.runInNewContext(miniBlock[1]).map(item => [item.label, item.model])
  : []

const cloudPath = path.resolve(projectRoot, '../docte-master/uniCloud-alipay/cloudfunctions/cicada-client-public/index.obj.js')
const cloudSource = fs.readFileSync(cloudPath, 'utf8')
const cloudBlock = cloudSource.match(/const REPAIR_PRODUCT_OPTIONS = (\[[\s\S]*?\])\.map\(/)
const cloudRows = cloudBlock
  ? vm.runInNewContext(cloudBlock[1]).map(([name, model]) => [name, model])
  : []

if (adminRows.length !== 28) fail(`产品目录应为 28 类，当前为 ${adminRows.length} 类`)
if (JSON.stringify(adminRows) !== JSON.stringify(miniRows)) fail('PC 后台产品目录与小程序不一致')
if (JSON.stringify(adminRows) !== JSON.stringify(cloudRows)) fail('PC 后台产品目录与云端接口不一致')
if (getRepairProductModels('机用根管锉').join('、') !== 'DT-C3') fail('单型号产品解析不正确')
if (getRepairProductModels('其他产品').length !== 0) fail('目录外产品不应带入预设型号')

const workOrderPath = path.resolve(projectRoot, 'src/views/WorkOrder.vue')
const workOrderSource = fs.readFileSync(workOrderPath, 'utf8')
if (!/v-model="item\.product_name"[\s\S]*?allow-create[\s\S]*?REPAIR_PRODUCT_OPTIONS/.test(workOrderSource)) {
  fail('后台产品名称必须支持目录选择和手写其他')
}
if (!/v-model="item\.product_model"[\s\S]*?allow-create[\s\S]*?getRepairProductModels/.test(workOrderSource)) {
  fail('后台产品型号必须支持联动选择和手写其他')
}

if (!process.exitCode) console.log('[ok] PC 后台、小程序和云端的 28 类产品及型号完全一致')
