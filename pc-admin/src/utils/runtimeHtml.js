import DOMPurify from 'dompurify'

const ALLOWED_TAGS = [
  'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'p', 'br', 'strong', 'b', 'em', 'i', 'u',
  'ul', 'ol', 'li', 'table', 'thead', 'tbody', 'tfoot', 'tr', 'th', 'td', 'a', 'img'
]

const ALLOWED_ATTR = [
  'href', 'src', 'alt', 'title', 'style', 'target', 'rel', 'colspan', 'rowspan', 'width', 'height'
]

// Policy content is rendered with v-html in the admin preview. Keep the same
// visual vocabulary as the editor while allowing private cloud image IDs.
DOMPurify.setConfig({
  ALLOWED_TAGS,
  ALLOWED_ATTR,
  ALLOW_DATA_ATTR: false,
  ALLOW_UNKNOWN_PROTOCOLS: false,
  ADD_URI_SAFE_ATTR: ['src', 'href'],
  ALLOWED_URI_REGEXP: /^(?:(?:https?|mailto|tel):|\/|#|cloud:\/\/)/i
})

export const sanitizeRuntimeHtml = (value = '') => DOMPurify.sanitize(String(value || ''))

export default sanitizeRuntimeHtml
