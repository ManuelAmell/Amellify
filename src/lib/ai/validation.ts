export const ALLOWED_IMAGE_MIME_TYPES = new Set(['image/png', 'image/jpeg', 'image/webp'])
export const ALLOWED_DOCUMENT_MIME_TYPES = new Set(['application/pdf'])

const DATA_URL_PATTERN = /^data:([a-zA-Z0-9.+-]+\/[a-zA-Z0-9.+-]+);base64,([a-zA-Z0-9+/=]+)$/

export function parseDataUrl(dataUrl: string): { mediaType: string; data: string } | null {
  const match = DATA_URL_PATTERN.exec(dataUrl.trim())
  if (!match || !match[1] || !match[2]) return null
  return { mediaType: match[1].toLowerCase(), data: match[2] }
}

export function isAllowedFileDataUrl(dataUrl: string): boolean {
  const parsed = parseDataUrl(dataUrl)
  if (!parsed) return false
  return ALLOWED_IMAGE_MIME_TYPES.has(parsed.mediaType) || ALLOWED_DOCUMENT_MIME_TYPES.has(parsed.mediaType)
}

export function isPdfDataUrl(dataUrl: string): boolean {
  const parsed = parseDataUrl(dataUrl)
  if (!parsed) return false
  return ALLOWED_DOCUMENT_MIME_TYPES.has(parsed.mediaType)
}

export const MAX_IMAGE_BODY_BYTES = 6 * 1024 * 1024
export const MAX_PDF_BODY_BYTES = 15 * 1024 * 1024

export function maxBodyBytesFor(images?: string[]): number {
  if (!images || images.length === 0) {
    return MAX_IMAGE_BODY_BYTES
  }
  const hasPdf = images.some((img) => isPdfDataUrl(img))
  return hasPdf ? MAX_PDF_BODY_BYTES : MAX_IMAGE_BODY_BYTES
}
