import React, { useEffect } from 'react'
import { StatusBar } from 'expo-status-bar'
import { SafeAreaProvider } from 'react-native-safe-area-context'
import * as Notifications from 'expo-notifications'
import RootNavigator, { navigationRef } from './src/navigation/RootNavigator'
import { supabase } from './src/lib/supabase'
import { registerForPush, targetForLink } from './src/lib/push'

function openFromNotification(response: Notifications.NotificationResponse) {
  const target = targetForLink(response.notification.request.content.data?.link)
  if (navigationRef.isReady()) navigationRef.navigate(target.screen, target.params)
}

export default function App() {
  // Đăng ký thông báo đẩy mỗi khi có phiên đăng nhập (mở app, đăng nhập mới)
  useEffect(() => {
    const { data } = supabase.auth.onAuthStateChange((event, session) => {
      if (session && (event === 'INITIAL_SESSION' || event === 'SIGNED_IN')) registerForPush()
    })
    return () => data.subscription.unsubscribe()
  }, [])

  // Chạm vào thông báo: khi app đang chạy, và khi app được mở lên từ thông báo
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
