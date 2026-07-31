import assert from 'node:assert/strict'
import test from 'node:test'

import {
  parsePolicyDocument,
  resolvePolicyDocumentFiles
} from './policyDocument.js'

test('published policy document exposes its mobile and original views', () => {
  const document = parsePolicyDocument(JSON.stringify({
    schemaVersion: 1,
    status: 'published',
    source: {
      fileUrl: 'cloud://bucket/policy.docx',
      fileName: 'policy.docx',
      fileType: 'docx'
    },
    original: {
      pdfUrl: 'cloud://bucket/policy.pdf',
      pages: ['cloud://bucket/page-1.webp', 'cloud://bucket/page-2.webp']
    },
    mobileHtml: '<h1>Policy</h1>',
    version: 3,
    updatedAt: 123
  }))

  assert.equal(document.status, 'published')
  assert.equal(document.source.fileName, 'policy.docx')
  assert.equal(document.original.pages.length, 2)
  assert.equal(document.mobileHtml, '<h1>Policy</h1>')
  assert.equal(document.version, 3)
})

test('invalid or unpublished settings do not replace the legacy policy', () => {
  assert.deepEqual(parsePolicyDocument('{broken'), null)
  assert.deepEqual(parsePolicyDocument(JSON.stringify({ status: 'draft' })), null)
  assert.deepEqual(parsePolicyDocument(JSON.stringify({ status: 'published' })), null)
})

test('cloud files are resolved in one batch without changing persistent ids', async () => {
  const calls = []
  const document = parsePolicyDocument(JSON.stringify({
    schemaVersion: 1,
    status: 'published',
    source: { fileUrl: 'cloud://bucket/policy.docx', fileName: 'policy.docx' },
    original: {
      pdfUrl: 'cloud://bucket/policy.pdf',
      pages: ['cloud://bucket/page-1.webp', 'https://cdn.example/page-2.webp']
    },
    mobileHtml: '<p>Policy</p>'
  }))

  const resolved = await resolvePolicyDocumentFiles(document, async (fileIds) => {
    calls.push(fileIds)
    return Object.fromEntries(fileIds.map((id) => [id, `https://temp.example/${id.split('/').pop()}`]))
  })

  assert.deepEqual(calls, [[
    'cloud://bucket/policy.docx',
    'cloud://bucket/policy.pdf',
    'cloud://bucket/page-1.webp'
  ]])
  assert.equal(resolved.source.fileUrl, 'cloud://bucket/policy.docx')
  assert.equal(resolved.source.previewUrl, 'https://temp.example/policy.docx')
  assert.equal(resolved.original.pdfPreviewUrl, 'https://temp.example/policy.pdf')
  assert.deepEqual(resolved.original.pagePreviewUrls, [
    'https://temp.example/page-1.webp',
    'https://cdn.example/page-2.webp'
  ])
})
