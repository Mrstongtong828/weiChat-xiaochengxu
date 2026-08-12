const assert = require('node:assert/strict')
const crypto = require('node:crypto')
const test = require('node:test')

global.uniCloud = { database: () => ({}) }

const { validateGenericAdminUpload, verifyPassword } = require('./index.obj').__test__

test('后台登录不再接受历史明文密码字段', () => {
  assert.equal(verifyPassword({ password: 'LegacyPassword123' }, 'LegacyPassword123'), false)
})

test('后台登录继续接受正确的 PBKDF2 密码哈希', () => {
  const salt = '0123456789abcdef0123456789abcdef'
  const password = 'SecurePassword123'
  const passwordHash = crypto.pbkdf2Sync(password, salt, 100000, 64, 'sha512').toString('hex')
  assert.equal(verifyPassword({ password_hash: passwordHash, password_salt: salt }, password), true)
  assert.equal(verifyPassword({ password_hash: passwordHash, password_salt: salt }, 'wrong-password'), false)
})

test('后台通用上传校验扩展名、MIME 和文件头', () => {
  const png = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])
  assert.doesNotThrow(() => validateGenericAdminUpload(png, 'cover.png', 'image/png'))
  assert.throws(() => validateGenericAdminUpload(png, 'cover.pdf', 'application/pdf'), /仅支持有效/)
  assert.throws(() => validateGenericAdminUpload(png, 'cover.png', 'application/pdf'), /文件类型与文件内容不一致/)
})
