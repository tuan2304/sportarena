import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'
import AsyncStorage from '@react-native-async-storage/async-storage'
import { getLocales } from 'expo-localization'
import vi from './vi.json'
import en from './en.json'

/**
 * Hai ngôn ngữ Việt - Anh cho app. Bản dịch nằm ở vi.json / en.json (cùng cấu trúc); kiểu MessageKey liệt kê mọi khóa
 * của vi.json nên gõ sai khóa trong t('...') báo lỗi lúc typecheck, và en.json thiếu khóa cũng báo lỗi (xem `en` bên dưới).
 */
export type Lang = 'vi' | 'en'
export const LANGS: Lang[] = ['vi', 'en']

type Tree = typeof vi
type Paths<T, P extends string = ''> = {
  [K in keyof T & string]: T[K] extends string ? `${P}${K}` : Paths<T[K], `${P}${K}.`>
}[keyof T & string]
export type MessageKey = Paths<Tree>

// Kiểm tra lúc biên dịch: en.json phải có đủ khóa như vi.json
const _english: Tree = en
void _english

const STORAGE_KEY = 'sa-lang'
const dictionaries: Record<Lang, unknown> = { vi, en }

let current: Lang = 'vi'

function lookup(lang: Lang, key: string): string | undefined {
  let node: unknown = dictionaries[lang]
  for (const part of key.split('.')) {
    if (typeof node !== 'object' || node === null) return undefined
    node = (node as Record<string, unknown>)[part]
  }
  return typeof node === 'string' ? node : undefined
}

/** Dịch ngoài component (lib/api.ts, lib/avatar.ts...): dùng ngôn ngữ hiện tại của app. */
export function translate(key: MessageKey, vars?: Record<string, string | number>): string {
  const text = lookup(current, key) ?? lookup('vi', key) ?? key
  return vars ? text.replace(/\{(\w+)\}/g, (_, name: string) => String(vars[name] ?? `{${name}}`)) : text
}

export function currentLang(): Lang {
  return current
}

/** Tiếng Anh nếu điện thoại đặt tiếng Anh ưu tiên, còn lại tiếng Việt (thị trường chính). */
export function deviceLang(): Lang {
  try {
    return getLocales()[0]?.languageCode === 'en' ? 'en' : 'vi'
  } catch {
    return 'vi'
  }
}

interface I18nValue {
  lang: Lang
  t: (key: MessageKey, vars?: Record<string, string | number>) => string
  setLang: (lang: Lang) => void
}

const I18nContext = createContext<I18nValue>({ lang: 'vi', t: translate, setLang: () => {} })

export function I18nProvider({ children, onLangChange }: { children: React.ReactNode; onLangChange?: (lang: Lang) => void }) {
  const [lang, setLangState] = useState<Lang>(() => {
    current = deviceLang()
    return current
  })

  // Lựa chọn đã lưu đi trước ngôn ngữ của điện thoại
  useEffect(() => {
    AsyncStorage.getItem(STORAGE_KEY)
      .then((saved) => {
        if (saved === 'vi' || saved === 'en') {
          current = saved
          setLangState(saved)
        }
      })
      .catch(() => {})
  }, [])

  const setLang = useCallback(
    (next: Lang) => {
      current = next
      setLangState(next)
      AsyncStorage.setItem(STORAGE_KEY, next).catch(() => {})
      onLangChange?.(next)
    },
    [onLangChange]
  )

  const value = useMemo<I18nValue>(() => ({ lang, t: translate, setLang }), [lang, setLang])
  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>
}

export function useI18n(): I18nValue {
  return useContext(I18nContext)
}
