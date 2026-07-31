const assert = require('node:assert/strict')
const test = require('node:test')

const records = [
  { key: 'warranty_policy_document', value: '{"status":"published"}' },
  { key: 'fee_policy_document', value: '{"status":"published"}' }
]

global.uniCloud = {
  database() {
    return {
      command: {
        in(values) {
          return values
        }
      },
      collection() {
        return {
          where({ key }) {
            return {
              async get() {
                return { data: records.filter(item => key.includes(item.key)) }
              }
            }
          }
        }
      }
    }
  }
}

const publicApi = require('./index.obj.js')
const keys = ['warranty_policy_document', 'fee_policy_document']

test('getSettings reads cloud-object method arguments', async () => {
  const result = await publicApi.getSettings({ keys })

  assert.equal(result.code, 0)
  assert.equal(result.data.warranty_policy_document, records[0].value)
  assert.equal(result.data.fee_policy_document, records[1].value)
})

test('getSettings reads URL-based cloud-object parameters from context', async () => {
  const result = await publicApi.getSettings.call({ params: { keys } })

  assert.equal(result.code, 0)
  assert.equal(result.data.warranty_policy_document, records[0].value)
  assert.equal(result.data.fee_policy_document, records[1].value)
})

test('getSettings accepts URL-serialized key arrays', async () => {
  const result = await publicApi.getSettings({ keys: JSON.stringify(keys) })

  assert.equal(result.code, 0)
  assert.equal(result.data.warranty_policy_document, records[0].value)
  assert.equal(result.data.fee_policy_document, records[1].value)
})
