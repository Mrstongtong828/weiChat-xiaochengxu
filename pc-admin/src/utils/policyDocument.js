export const POLICY_DOCUMENT_MAX_SIZE = 15 * 1024 * 1024
export const POLICY_DOCUMENT_MAX_PAGES = 20

const asText = (value = '') => String(value || '').trim()

const normalizeFileType = (value = '', fileName = '') => {
  const extension = asText(fileName).split('.').pop().toLowerCase()
  if (extension === 'docx' || extension === 'pdf') return extension
  const type = asText(value).toLowerCase()
  if (type.includes('wordprocessingml')) return 'docx'
  if (type.includes('pdf')) return 'pdf'
  return type
}

export const parsePolicyDocumentSetting = (value) => {
  let parsed = value
  try {
    if (typeof value === 'string') parsed = value ? JSON.parse(value) : null
  } catch (error) {
    return null
  }

  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed) || parsed.status !== 'published') {
    return null
  }

  const sourceValue = parsed.source && typeof parsed.source === 'object' ? parsed.source : {}
  const originalValue = parsed.original && typeof parsed.original === 'object' ? parsed.original : {}
  const source = {
    fileUrl: asText(sourceValue.fileUrl),
    fileName: asText(sourceValue.fileName),
    fileType: normalizeFileType(sourceValue.fileType, sourceValue.fileName)
  }
  const original = {
    pdfUrl: asText(originalValue.pdfUrl),
    pages: Array.isArray(originalValue.pages) ? originalValue.pages.map(asText).filter(Boolean) : []
  }
  const mobileHtml = asText(parsed.mobileHtml)
  if (!mobileHtml && !original.pdfUrl && !original.pages.length) return null

  return {
    schemaVersion: Number(parsed.schemaVersion) || 1,
    status: 'published',
    source,
    original,
    mobileHtml,
    version: Math.max(1, Number(parsed.version) || 1),
    updatedAt: Number(parsed.updatedAt) || 0
  }
}

export const createPolicyDocumentManifest = ({ previous, source, pdf, pages = [], mobileHtml }) => ({
  schemaVersion: 1,
  status: 'published',
  source: {
    fileUrl: asText(source && source.fileUrl),
    fileName: asText(source && source.fileName),
    fileType: normalizeFileType(source && source.fileType, source && source.fileName)
  },
  original: {
    pdfUrl: asText(pdf && pdf.fileUrl),
    pages: pages.map(item => asText(item && item.fileUrl)).filter(Boolean)
  },
  mobileHtml: asText(mobileHtml),
  version: Math.max(1, Number(previous && previous.version) + 1 || 1),
  updatedAt: Date.now()
})

export const serializePolicyDocumentSetting = (document) => {
  const normalized = parsePolicyDocumentSetting(document)
  return normalized ? JSON.stringify(normalized) : ''
}

const DOCX_MIME = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'

const nextFrame = () => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)))

const canvasToFile = (canvas, fileName) => new Promise((resolve, reject) => {
  canvas.toBlob((blob) => {
    if (!blob) {
      reject(new Error('文档页面图片生成失败'))
      return
    }
    const isWebp = blob.type === 'image/webp'
    resolve(new File([blob], fileName.replace(/\.webp$/i, isWebp ? '.webp' : '.png'), {
      type: blob.type || 'image/png'
    }))
  }, 'image/webp', 0.86)
})

const applyMobileStyles = (html, purify) => {
  const clean = purify.sanitize(html, {
    ALLOWED_TAGS: ['h1', 'h2', 'h3', 'h4', 'p', 'br', 'strong', 'b', 'em', 'i', 'u', 'ul', 'ol', 'li', 'table', 'thead', 'tbody', 'tfoot', 'tr', 'th', 'td', 'a'],
    ALLOWED_ATTR: ['href', 'colspan', 'rowspan']
  })
  const doc = new DOMParser().parseFromString(`<div id="policy-root">${clean}</div>`, 'text/html')
  const root = doc.getElementById('policy-root')
  const styles = {
    h1: 'margin:0 0 18px;font-size:22px;line-height:1.45;color:#24599B;font-weight:700;',
    h2: 'margin:22px 0 10px;font-size:19px;line-height:1.5;color:#24599B;font-weight:700;',
    h3: 'margin:18px 0 8px;font-size:17px;line-height:1.55;color:#17233B;font-weight:700;',
    h4: 'margin:16px 0 8px;font-size:16px;line-height:1.6;color:#17233B;font-weight:700;',
    p: 'margin:0 0 11px;font-size:15px;line-height:1.85;color:#27364D;',
    ul: 'margin:8px 0 14px;padding-left:22px;',
    ol: 'margin:8px 0 14px;padding-left:22px;',
    li: 'margin:0 0 7px;font-size:15px;line-height:1.8;color:#27364D;',
    table: 'width:100%;margin:12px 0 18px;border-collapse:collapse;table-layout:fixed;',
    th: 'padding:9px 7px;border:1px solid #B9C9DE;background:#315D9D;color:#FFFFFF;font-size:14px;line-height:1.5;font-weight:700;text-align:center;',
    td: 'padding:9px 7px;border:1px solid #CBD5E1;color:#27364D;font-size:14px;line-height:1.6;vertical-align:middle;word-break:break-word;',
    strong: 'font-weight:700;color:#17233B;',
    b: 'font-weight:700;color:#17233B;',
    a: 'color:#1E6FE0;text-decoration:none;'
  }

  Object.entries(styles).forEach(([tag, style]) => {
    root.querySelectorAll(tag).forEach(node => node.setAttribute('style', style))
  })
  root.querySelectorAll('p,li,h1,h2,h3,h4').forEach(node => {
    if (!node.textContent.trim() && !node.querySelector('br')) node.remove()
  })
  return root.innerHTML.trim()
}

const makeOriginalPdf = (canvases, sourceName, JsPdf) => {
  const first = canvases[0]
  const firstOrientation = first.width > first.height ? 'landscape' : 'portrait'
  const pdf = new JsPdf({
    orientation: firstOrientation,
    unit: 'px',
    format: [first.width, first.height],
    compress: true,
    hotfixes: ['px_scaling']
  })

  canvases.forEach((canvas, index) => {
    if (index > 0) {
      pdf.addPage([canvas.width, canvas.height], canvas.width > canvas.height ? 'landscape' : 'portrait')
    }
    pdf.addImage(canvas.toDataURL('image/jpeg', 0.9), 'JPEG', 0, 0, canvas.width, canvas.height, undefined, 'FAST')
  })

  const pdfName = sourceName.replace(/\.docx$/i, '') + '.pdf'
  return new File([pdf.output('blob')], pdfName, { type: 'application/pdf' })
}

const createRenderHost = () => {
  const host = document.createElement('div')
  host.setAttribute('aria-hidden', 'true')
  Object.assign(host.style, {
    position: 'fixed',
    left: '-20000px',
    top: '0',
    width: '1200px',
    minHeight: '1px',
    background: '#fff',
    pointerEvents: 'none'
  })
  document.body.appendChild(host)
  return host
}

export const convertPolicyDocument = async (file, onProgress = () => {}) => {
  if (!file) throw new Error('请选择 Word 文档')
  const extension = asText(file.name).split('.').pop().toLowerCase()
  if (extension !== 'docx') throw new Error('一键排版目前仅支持 DOCX 文件')
  if (file.size > POLICY_DOCUMENT_MAX_SIZE) throw new Error('Word 文档不能超过 15MB')

  onProgress({ percent: 5, label: '读取 Word 文档' })
  const arrayBuffer = await file.arrayBuffer()
  const [{ default: mammoth }, docxPreview, { default: html2canvas }, { jsPDF }, { default: DOMPurify }] = await Promise.all([
    import('mammoth'),
    import('docx-preview'),
    import('html2canvas'),
    import('jspdf'),
    import('dompurify')
  ])

  onProgress({ percent: 15, label: '生成手机适配内容' })
  const mobileResult = await mammoth.convertToHtml({ arrayBuffer }, {
    styleMap: [
      "p[style-name='Title'] => h1:fresh",
      "p[style-name='Heading 1'] => h2:fresh",
      "p[style-name='Heading 2'] => h3:fresh",
      "p[style-name='Heading 3'] => h4:fresh"
    ]
  })
  const mobileHtml = applyMobileStyles(mobileResult.value, DOMPurify)
  if (!mobileHtml) throw new Error('未能从 Word 文档中解析出可展示内容')

  const host = createRenderHost()
  try {
    onProgress({ percent: 28, label: '还原 Word 页面版式' })
    await docxPreview.renderAsync(arrayBuffer, host, null, {
      className: 'policy-docx',
      inWrapper: true,
      breakPages: true,
      ignoreWidth: false,
      ignoreHeight: false,
      ignoreFonts: false,
      useBase64URL: true,
      renderHeaders: true,
      renderFooters: true
    })
    if (document.fonts && document.fonts.ready) await document.fonts.ready
    await nextFrame()

    const pageElements = [...host.querySelectorAll('.docx-wrapper > section, section.policy-docx')]
      .filter((item, index, list) => list.indexOf(item) === index)
    if (!pageElements.length) throw new Error('Word 文档没有可渲染页面')
    if (pageElements.length > POLICY_DOCUMENT_MAX_PAGES) {
      throw new Error(`文档页数不能超过 ${POLICY_DOCUMENT_MAX_PAGES} 页`)
    }

    const canvases = []
    for (let index = 0; index < pageElements.length; index += 1) {
      const page = pageElements[index]
      page.style.boxShadow = 'none'
      onProgress({
        percent: 30 + Math.round(((index + 1) / pageElements.length) * 48),
        label: `生成原稿页面 ${index + 1}/${pageElements.length}`
      })
      canvases.push(await html2canvas(page, {
        backgroundColor: '#ffffff',
        scale: 1.5,
        useCORS: true,
        logging: false
      }))
    }

    onProgress({ percent: 82, label: '压缩页面并合成 PDF' })
    const pageFiles = await Promise.all(canvases.map((canvas, index) => (
      canvasToFile(canvas, `page-${String(index + 1).padStart(3, '0')}.webp`)
    )))
    const pdfFile = makeOriginalPdf(canvases, file.name, jsPDF)

    onProgress({ percent: 88, label: '准备上传' })
    return {
      sourceFile: new File([arrayBuffer], file.name, { type: file.type || DOCX_MIME }),
      pdfFile,
      pageFiles,
      mobileHtml,
      warnings: Array.isArray(mobileResult.messages) ? mobileResult.messages.map(item => item.message).filter(Boolean) : []
    }
  } finally {
    host.remove()
  }
}
