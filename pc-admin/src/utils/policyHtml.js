const PARAGRAPH_STYLE = 'margin:0 0 10px;font-size:14px;line-height:1.8;color:#1F2A3D;'
const STRONG_STYLE = 'font-weight:700;color:#0F1F3A;'
const LIST_STYLE = 'margin:8px 0 12px;padding-left:20px;'
const LIST_ITEM_STYLE = 'margin:0 0 6px;font-size:14px;line-height:1.8;color:#1F2A3D;'
const LINK_STYLE = 'color:#1E6FE0;text-decoration:none;'
const IMAGE_STYLE = 'max-width:100%;height:auto;border-radius:6px;margin:10px 0;display:block;'

const DROP_TAGS = new Set([
  'script',
  'style',
  'iframe',
  'object',
  'embed',
  'link',
  'meta',
  'form',
  'input',
  'button',
  'textarea',
  'select',
  'option',
  'svg',
  'canvas'
])

const UNWRAP_TAGS = new Set(['span', 'font', 'center', 'table', 'thead', 'tbody', 'tfoot', 'tr', 'td', 'th'])
const PARAGRAPH_TAGS = new Set(['div', 'section', 'article', 'header', 'footer', 'main', 'aside', 'blockquote', 'pre'])
const HEADING_TAGS = new Set(['h1', 'h2', 'h3', 'h4', 'h5', 'h6'])
const INLINE_TOP_LEVEL_TAGS = new Set(['strong', 'b', 'em', 'i', 'u', 'a', 'br'])

const escapeHtml = (value = '') => String(value)
  .replace(/&/g, '&amp;')
  .replace(/</g, '&lt;')
  .replace(/>/g, '&gt;')
  .replace(/"/g, '&quot;')
  .replace(/'/g, '&#39;')

const escapeAttr = (value = '') => escapeHtml(value).replace(/`/g, '&#96;')

const hasHtmlTag = (value = '') => /<\/?[a-z][\s\S]*>/i.test(value)

const textToParagraphs = (value = '') => String(value)
  .split(/\r?\n/)
  .map((line) => line.trim())
  .filter(Boolean)
  .map((line) => `<p>${escapeHtml(line)}</p>`)
  .join('')

const isSafeUrl = (value = '', { image = false } = {}) => {
  const url = String(value || '').trim()
  if (!url || /^javascript:/i.test(url) || /^vbscript:/i.test(url)) return false
  if (/^https?:\/\//i.test(url) || /^\/\//.test(url) || /^\//.test(url)) return true
  if (image && /^cloud:\/\//i.test(url)) return true
  if (image && /^data:image\/(?:png|jpe?g|gif|webp);base64,/i.test(url)) return true
  return false
}

const applyCommonStyle = (element, tagName) => {
  if (tagName === 'p') element.setAttribute('style', PARAGRAPH_STYLE)
  if (tagName === 'strong' || tagName === 'b') element.setAttribute('style', STRONG_STYLE)
  if (tagName === 'ul' || tagName === 'ol') element.setAttribute('style', LIST_STYLE)
  if (tagName === 'li') element.setAttribute('style', LIST_ITEM_STYLE)
  if (tagName === 'a') element.setAttribute('style', LINK_STYLE)
  if (tagName === 'img') element.setAttribute('style', IMAGE_STYLE)
}

const appendCleanChildren = (target, source, doc) => {
  Array.from(source.childNodes).forEach((child) => {
    const cleaned = sanitizeNode(child, doc)
    if (cleaned) target.appendChild(cleaned)
  })
}

const isEmptyElement = (element) => {
  if (!element || element.nodeType !== 1) return false
  if (element.querySelector('img,br')) return false
  return !String(element.textContent || '').replace(/\u00a0/g, ' ').trim()
}

const createStyledElement = (doc, tagName) => {
  const element = doc.createElement(tagName)
  applyCommonStyle(element, tagName)
  return element
}

const unwrapChildren = (node, doc) => {
  const fragment = doc.createDocumentFragment()
  appendCleanChildren(fragment, node, doc)
  return fragment
}

const sanitizeNode = (node, doc) => {
  if (node.nodeType === 3) {
    return doc.createTextNode(node.textContent || '')
  }

  if (node.nodeType !== 1) return doc.createDocumentFragment()

  const originalTag = node.tagName.toLowerCase()
  if (DROP_TAGS.has(originalTag)) return doc.createDocumentFragment()
  if (UNWRAP_TAGS.has(originalTag)) return unwrapChildren(node, doc)

  if (originalTag === 'br') return doc.createElement('br')

  if (originalTag === 'img') {
    const src = node.getAttribute('src') || ''
    if (!isSafeUrl(src, { image: true })) return doc.createDocumentFragment()
    const img = createStyledElement(doc, 'img')
    img.setAttribute('src', src.trim())
    const alt = node.getAttribute('alt') || ''
    if (alt) img.setAttribute('alt', alt.trim())
    return img
  }

  if (HEADING_TAGS.has(originalTag)) {
    const paragraph = createStyledElement(doc, 'p')
    const strong = createStyledElement(doc, 'strong')
    appendCleanChildren(strong, node, doc)
    if (isEmptyElement(strong)) return doc.createDocumentFragment()
    paragraph.appendChild(strong)
    return paragraph
  }

  const tagName = PARAGRAPH_TAGS.has(originalTag)
    ? 'p'
    : originalTag === 'b'
      ? 'strong'
      : originalTag === 'i'
        ? 'em'
        : originalTag

  const allowedTags = new Set(['p', 'strong', 'em', 'u', 'ul', 'ol', 'li', 'a'])
  if (!allowedTags.has(tagName)) return unwrapChildren(node, doc)

  const element = createStyledElement(doc, tagName)

  if (tagName === 'a') {
    const href = node.getAttribute('href') || ''
    if (isSafeUrl(href)) {
      element.setAttribute('href', href.trim())
      element.setAttribute('target', '_blank')
      element.setAttribute('rel', 'noopener noreferrer')
    }
  }

  appendCleanChildren(element, node, doc)

  if (isEmptyElement(element) && tagName !== 'li') return doc.createDocumentFragment()
  return element
}

const normalizeTopLevel = (fragment, doc) => {
  const output = doc.createDocumentFragment()
  let paragraph = null

  const ensureParagraph = () => {
    if (!paragraph) paragraph = createStyledElement(doc, 'p')
    return paragraph
  }

  const flushParagraph = () => {
    if (paragraph && !isEmptyElement(paragraph)) output.appendChild(paragraph)
    paragraph = null
  }

  Array.from(fragment.childNodes).forEach((node) => {
    if (node.nodeType === 3) {
      if (!String(node.textContent || '').trim()) return
      ensureParagraph().appendChild(node)
      return
    }

    if (node.nodeType === 1 && INLINE_TOP_LEVEL_TAGS.has(node.tagName.toLowerCase())) {
      ensureParagraph().appendChild(node)
      return
    }

    flushParagraph()
    output.appendChild(node)
  })

  flushParagraph()
  return output
}

const serializeFragment = (fragment, doc) => {
  const wrapper = doc.createElement('div')
  wrapper.appendChild(fragment)
  return wrapper.innerHTML
    .replace(/(<br\s*\/?>\s*){3,}/gi, '<br><br>')
    .trim()
}

export const normalizePolicyHtml = (html = '') => {
  const source = String(html || '').trim()
  if (!source) return ''

  if (typeof DOMParser === 'undefined') return source

  const parser = new DOMParser()
  const prepared = hasHtmlTag(source) ? source : textToParagraphs(source)
  const doc = parser.parseFromString(prepared, 'text/html')
  const fragment = doc.createDocumentFragment()

  Array.from(doc.body.childNodes).forEach((node) => {
    const cleaned = sanitizeNode(node, doc)
    if (cleaned) fragment.appendChild(cleaned)
  })

  return serializeFragment(normalizeTopLevel(fragment, doc), doc)
}

export default normalizePolicyHtml
