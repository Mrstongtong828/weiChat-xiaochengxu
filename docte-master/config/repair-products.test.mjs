import assert from 'node:assert/strict'
import test from 'node:test'

import {
	createRepairProductModelOptions,
	REPAIR_PRODUCT_MODEL_OTHER_LABEL,
	REPAIR_PRODUCT_MODEL_OTHER_VALUE,
	splitRepairProductModels
} from './repair-product-models.mjs'
import { createRepairProduct } from '../pages/index/composables/repairForm.js'

test('splits configured repair models into native picker choices', () => {
	assert.deepEqual(
		splitRepairProductModels('CV-215、CV-215-I, CV-215 GUN；G1\nG2'),
		['CV-215', 'CV-215-I', 'CV-215 GUN', 'G1', 'G2']
	)
})

test('keeps slash-based model names intact and removes duplicates', () => {
	assert.deepEqual(
		splitRepairProductModels('CV/GX602、CV/GX602、J05/D05M/D05Z'),
		['CV/GX602', 'J05/D05M/D05Z']
	)
})

test('places the manual model choice last with a stable internal value', () => {
	const options = createRepairProductModelOptions('G1、G2')
	assert.deepEqual(options, [
		{ label: 'G1', value: 'G1' },
		{ label: 'G2', value: 'G2' },
		{ label: REPAIR_PRODUCT_MODEL_OTHER_LABEL, value: REPAIR_PRODUCT_MODEL_OTHER_VALUE }
	])
})

test('new repair products always provide a safe native picker range', () => {
	const product = createRepairProduct()
	assert.deepEqual(product.modelPickerOptions, [REPAIR_PRODUCT_MODEL_OTHER_LABEL])
})
