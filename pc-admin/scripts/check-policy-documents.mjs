import assert from 'node:assert/strict'

import {
  createPolicyDocumentManifest,
  parsePolicyDocumentSetting,
  serializePolicyDocumentSetting
} from '../src/utils/policyDocument.js'

const previous = {
  schemaVersion: 1,
  status: 'published',
  source: { fileUrl: 'cloud://old.docx', fileName: 'old.docx', fileType: 'docx' },
  original: { pdfUrl: 'cloud://old.pdf', pages: ['cloud://old-1.webp'] },
  mobileHtml: '<p>Old</p>',
  version: 2,
  updatedAt: 100
}

const manifest = createPolicyDocumentManifest({
  previous,
  source: {
    fileUrl: 'cloud://new.docx',
    tempUrl: 'https://temp.example/new.docx',
    fileName: 'new.docx',
    fileType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
  },
  pdf: { fileUrl: 'cloud://new.pdf', tempUrl: 'https://temp.example/new.pdf' },
  pages: [
    { fileUrl: 'cloud://new-1.webp', tempUrl: 'blob:page-1' },
    { fileUrl: 'cloud://new-2.webp', tempUrl: 'blob:page-2' }
  ],
  mobileHtml: '<h1>New</h1>'
})

assert.equal(manifest.status, 'published')
assert.equal(manifest.version, 3)
assert.equal(manifest.source.fileType, 'docx')
assert.deepEqual(manifest.original.pages, ['cloud://new-1.webp', 'cloud://new-2.webp'])
assert.equal(JSON.stringify(manifest).includes('temp.example'), false)
assert.equal(JSON.stringify(manifest).includes('blob:'), false)

const serialized = serializePolicyDocumentSetting(manifest)
assert.deepEqual(parsePolicyDocumentSetting(serialized), manifest)
assert.equal(parsePolicyDocumentSetting('{broken'), null)

console.log('policy document manifest checks passed')
