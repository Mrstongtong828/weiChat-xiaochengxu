const PARAGRAPH_STYLE = 'margin:0 0 10px;font-size:14px;line-height:1.8;color:#1F2A3D;'
const STRONG_STYLE = 'font-weight:700;color:#0F1F3A;'
const LIST_STYLE = 'margin:8px 0 12px;padding-left:20px;'
const LIST_ITEM_STYLE = 'margin:0 0 6px;font-size:14px;line-height:1.8;color:#1F2A3D;'
const LINK_STYLE = 'color:#1E6FE0;text-decoration:none;'
const IMAGE_STYLE = 'max-width:100%;height:auto;border-radius:6px;margin:10px 0;display:block;'

const DANGEROUS_TAG_RE = /<\s*(script|style|iframe|object|embed|link|meta|form|input|button|textarea|select|option|svg|canvas)[^>]*>[\s\S]*?<\s*\/\s*\1\s*>/gi
const DANGEROUS_SINGLE_TAG_RE = /<\s*(script|style|iframe|object|embed|link|meta|form|input|button|textarea|select|option|svg|canvas)[^>]*\/?\s*>/gi
const UNSAFE_ATTR_RE = /\s(?:style|class|id|width|height|size|face|color|align|lang|dir|on\w+|data-[\w-]+|aria-[\w-]+)=(".*?"|'.*?'|[^\s>]*)/gi
const SAFE_TAGS = new Set(['p', 'br', 'strong', 'em', 'u', 'ul', 'ol', 'li', 'a', 'img'])

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

const getAttr = (source = '', name = '') => {
  const re = new RegExp(`\\s${name}\\s*=\\s*("([^"]*)"|'([^']*)'|([^\\s>]+))`, 'i')
  const match = String(source).match(re)
  return match ? (match[2] || match[3] || match[4] || '') : ''
}

const normalizeTagName = (tagName = '') => {
  const tag = String(tagName || '').toLowerCase()
  if (tag === 'b') return 'strong'
  if (tag === 'i') return 'em'
  return tag
}

const tagStyle = (tagName) => {
  if (tagName === 'p') return PARAGRAPH_STYLE
  if (tagName === 'strong') return STRONG_STYLE
  if (tagName === 'ul' || tagName === 'ol') return LIST_STYLE
  if (tagName === 'li') return LIST_ITEM_STYLE
  if (tagName === 'a') return LINK_STYLE
  if (tagName === 'img') return IMAGE_STYLE
  return ''
}

const rebuildTag = (match, rawTagName) => {
  const closing = /^<\s*\//.test(match)
  const tagName = normalizeTagName(rawTagName)
  if (!SAFE_TAGS.has(tagName)) return ''

  if (tagName === 'br') return closing ? '' : '<br/>'
  if (tagName === 'img') {
    if (closing) return ''
    const src = getAttr(match, 'src')
    if (!isSafeUrl(src, { image: true })) return ''
    const alt = getAttr(match, 'alt')
    return `<img src="${escapeAttr(src.trim())}"${alt ? ` alt="${escapeAttr(alt)}"` : ''} style="${IMAGE_STYLE}"/>`
  }

  if (closing) return `</${tagName}>`

  if (tagName === 'a') {
    const href = getAttr(match, 'href')
    if (!isSafeUrl(href)) return '<a style="' + LINK_STYLE + '">'
    return `<a href="${escapeAttr(href.trim())}" style="${LINK_STYLE}">`
  }

  const style = tagStyle(tagName)
  return style ? `<${tagName} style="${style}">` : `<${tagName}>`
}

const cleanLooseHtml = (html = '') => String(html)
  .replace(/<!--[\s\S]*?-->/g, '')
  .replace(DANGEROUS_TAG_RE, '')
  .replace(DANGEROUS_SINGLE_TAG_RE, '')
  .replace(UNSAFE_ATTR_RE, '')
  .replace(/<\s*h[1-6][^>]*>/gi, '<p><strong>')
  .replace(/<\s*\/\s*h[1-6]\s*>/gi, '</strong></p>')
  .replace(/<\s*(div|section|article|header|footer|main|aside|blockquote|pre)[^>]*>/gi, '<p>')
  .replace(/<\s*\/\s*(div|section|article|header|footer|main|aside|blockquote|pre)\s*>/gi, '</p>')
  .replace(/<\s*(span|font|center|table|thead|tbody|tfoot|tr|td|th)[^>]*>/gi, '')
  .replace(/<\s*\/\s*(span|font|center|table|thead|tbody|tfoot|tr|td|th)\s*>/gi, '')
  .replace(/<\/?([a-z][\w-]*)([^>]*)>/gi, rebuildTag)
  .replace(/<p[^>]*>\s*(?:&nbsp;|\s|<br\s*\/?>)*<\/p>/gi, '')
  .replace(/(<br\s*\/?>\s*){3,}/gi, '<br/><br/>')
  .trim()

export const normalizePolicyHtml = (html = '') => {
  const source = String(html || '').trim()
  if (!source) return ''
  const prepared = hasHtmlTag(source) ? source : textToParagraphs(source)
  return cleanLooseHtml(prepared)
}

export default normalizePolicyHtml
