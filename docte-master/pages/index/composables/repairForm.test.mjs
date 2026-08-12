import assert from 'node:assert/strict'
import test from 'node:test'

import { createRepairProduct, getRepairProductModelValue } from './repairForm.js'

test('new repair products keep an independent custom model draft', () => {
	const product = createRepairProduct()
	assert.equal(product.customModel, '')
	assert.equal(getRepairProductModelValue(product), '')
})

test('custom model value is preferred and trimmed for submission', () => {
	assert.equal(getRepairProductModelValue({
		isCustomModel: true,
		customModel: '  CUSTOM-01  ',
		model: 'legacy-value'
	}), 'CUSTOM-01')
	assert.equal(getRepairProductModelValue({
		isCustomModel: true,
		customModel: '',
		model: 'OLD-CUSTOM'
	}), 'OLD-CUSTOM')
})

test('configured model keeps using the selected picker value', () => {
	assert.equal(getRepairProductModelValue({
		isCustomModel: false,
		customModel: 'CUSTOM-01',
		model: 'W201L'
	}), 'W201L')
})
