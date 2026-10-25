import React, { useEffect } from 'react'
import { StatusBar } from 'expo-status-bar'
import { SafeAreaProvider } from 'react-native-safe-area-context'
import * as Notifications from 'expo-notifications'
import RootNavigator, { navigationRef } from './src/navigation/RootNavigator'
import { supabase } from './src/lib/supabase'
import { handleNotificationResponse, registerForPush, registerNotificationCategories } from './src/lib/push'
import { I18nProvider, currentLang, useI18n, type Lang } from './src/i18n'

/** Ghi ngôn ngữ vào hồ sơ để thông báo đẩy gửi đúng ngôn ngữ; không có phiên đăng nhập thì bỏ qua êm. */
async function saveLocale(lang: Lang) {
  try {
    await supabase.rpc('set_my_locale', { p_locale: lang })
  } catch {
    // bỏ qua
  }
}

async function openFromNotification(response: Notifications.NotificationResponse) {
  const target = await handleNotificationResponse(response)
  if (navigationRef.isReady()) navigationRef.navigate(target.screen, target.params)
}

/** Phần chạy bên trong I18nProvider để dùng được ngôn ngữ hiện tại. */
function Shell() {
  const { lang } = useI18n()

  // Đăng ký thông báo đẩy mỗi khi có phiên đăng nhập (mở app, đăng nhập mới)
  useEffect(() => {
    const { data } = supabase.auth.onAuthStateChange((event, session) => {
      if (session && (event === 'INITIAL_SESSION' || event === 'SIGNED_IN')) {
        registerForPush()
        saveLocale(currentLang())
      }
    })
    return () => data.subscription.unsubscribe()
  }, [])

  // Tiêu đề nút Duyệt/Từ chối trên thông báo đi theo ngôn ngữ của app
  useEffect(() => {
    registerNotificationCategories()
  }, [lang])

  // Chạm vào thông báo hoặc nút trên thông báo: khi app đang chạy, và khi app được mở lên từ thông báo
  useEffect(() => {
    const sub = Notifications.addNotificationResponseReceivedListener(openFromNotification)
    Notifications.getLastNotificationResponseAsync().then((last) => {
      if (last) setTimeout(() => openFromNotification(last), 500)
    })
    return () => sub.remove()
  }, [])

  return (
    <SafeAreaProvider>
      <StatusBar style="light" />
      <RootNavigator />
    </SafeAreaProvider>
  )
}

export default function App() {
  return (
    <I18nProvider onLangChange={saveLocale}>
      <Shell />
    </I18nProvider>
  )
}
