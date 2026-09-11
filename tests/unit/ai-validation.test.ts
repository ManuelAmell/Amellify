import { describe, expect, it } from 'vitest'
import { isAllowedFileDataUrl, isPdfDataUrl, maxBodyBytesFor } from '@/lib/ai/validation'

// Regression/feature coverage for PDF upload support in the AI schedule
// scanner (plan: PDFs go to Google only, sized up to 15MB; image-only
// requests keep the existing 6MB ceiling).
describe('isAllowedFileDataUrl', () => {
  it('accepts both allowed image MIME types and application/pdf', () => {
    expect(isAllowedFileDataUrl('data:image/png;base64,AAAA')).toBe(true)
    expect(isAllowedFileDataUrl('data:application/pdf;base64,AAAA')).toBe(true)
  })

  it('rejects a MIME type outside the image/PDF allowlist', () => {
    expect(isAllowedFileDataUrl('data:application/msword;base64,AAAA')).toBe(false)
    expect(isAllowedFileDataUrl('data:image/svg+xml;base64,AAAA')).toBe(false)
  })
})

describe('maxBodyBytesFor', () => {
  it('returns the 15MB ceiling when at least one file in the batch is a PDF', () => {
    const images = ['data:image/png;base64,AAAA', 'data:application/pdf;base64,BBBB']
    expect(maxBodyBytesFor(images)).toBe(15 * 1024 * 1024)
  })

  it('returns the existing 6MB ceiling when the batch is images only', () => {
    const images = ['data:image/png;base64,AAAA', 'data:image/jpeg;base64,BBBB']
    expect(maxBodyBytesFor(images)).toBe(6 * 1024 * 1024)
  })

  it('returns the 6MB ceiling for an empty batch (no regression for text-only requests)', () => {
    expect(maxBodyBytesFor([])).toBe(6 * 1024 * 1024)
  })
})

describe('isPdfDataUrl', () => {
  it('identifies a PDF data URL and rejects a malformed one', () => {
    expect(isPdfDataUrl('data:application/pdf;base64,AAAA')).toBe(true)
    expect(isPdfDataUrl('not-a-data-url')).toBe(false)
  })
})
