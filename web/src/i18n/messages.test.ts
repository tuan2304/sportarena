import { describe, expect, it } from 'vitest'
import { createTranslator } from 'next-intl'
import vi from '../../messages/vi.json'
import en from '../../messages/en.json'

type Tree = { [key: string]: string | Tree }

function flatten(tree: Tree, prefix = ''): Record<string, string> {
  const out: Record<string, string> = {}
  for (const [key, value] of Object.entries(tree)) {
    const path = prefix ? `${prefix}.${key}` : key
    if (typeof value === 'string') out[path] = value
    else Object.assign(out, flatten(value, path))
  }
  return out
}

const viFlat = flatten(vi as Tree)
const enFlat = flatten(en as Tree)

// Chữ có dấu tiếng Việt, trừ "đ" vì "đ" là ký hiệu đồng dùng cả ở bản tiếng Anh (vd. "120.000 đ/h")
const VIETNAMESE_LETTERS = /[àáạảãâầấậẩẫăằắặẳẵèéẹẻẽêềếệểễìíịỉĩòóọỏõôồốộổỗơờớợởỡùúụủũưừứựửữỳýỵỷỹ]/i
const placeholders = (text: string) => [...text.matchAll(/\{(\w+)\}/g)].map((m) => m[1]).sort()

describe('messages vi/en', () => {
  it('hai ngôn ngữ có đúng cùng một bộ khóa', () => {
    expect(Object.keys(enFlat).sort()).toEqual(Object.keys(viFlat).sort())
  })

  it('không có bản dịch rỗng', () => {
    for (const [key, text] of [...Object.entries(viFlat), ...Object.entries(enFlat)]) {
      expect(text.trim().length, key).toBeGreaterThan(0)
    }
  })

  it('biến {tên} giống hệt nhau giữa hai ngôn ngữ', () => {
    for (const key of Object.keys(viFlat)) {
      expect(placeholders(enFlat[key]), key).toEqual(placeholders(viFlat[key]))
    }
  })

  it('bản tiếng Anh không còn chữ tiếng Việt', () => {
    for (const [key, text] of Object.entries(enFlat)) {
      expect(VIETNAMESE_LETTERS.test(text), `${key}: ${text}`).toBe(false)
    }
  })

  it('mọi câu định dạng được với giá trị mẫu (không lỗi ICU, thẻ <b>/<strong>... đều được xử lý)', () => {
    for (const [locale, messages] of [['vi', vi], ['en', en]] as const) {
      const t = createTranslator({ locale, messages: messages as never, onError: (e) => { throw e } })
      const flat = locale === 'vi' ? viFlat : enFlat
      for (const [key, text] of Object.entries(flat)) {
        const values: Record<string, unknown> = {}
        for (const name of placeholders(text)) values[name] = '1'
        for (const tag of text.matchAll(/<(\w+)>/g)) values[tag[1]] = (chunks: unknown) => String(chunks)
        expect(() => (t as unknown as { rich: (k: string, v: Record<string, unknown>) => unknown }).rich(key, values), `${locale}: ${key}`).not.toThrow()
      }
    }
  })
})
