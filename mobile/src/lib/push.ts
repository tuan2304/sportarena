import * as Notifications from 'expo-notifications'
import * as Device from 'expo-device'
import Constants from 'expo-constants'
import { Platform } from 'react-native'
import { supabase } from './supabase'

/**
 * Thông báo đẩy. Thông báo trong tab "Thông Báo" vẫn là nguồn sự thật; đẩy chỉ là lời nhắc, nên mọi lỗi ở đây
 * (không cấp quyền, chạy trên máy ảo, chưa cấu hình dự án EAS) đều bỏ qua êm và không ảnh hưởng phần còn lại của app.
 *
 * Token được đăng ký bằng hàm register_push_token của database (gắn vào người đang đăng nhập) và gỡ trước khi đăng xuất.
 */
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
  }),
})

const UUID = '[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}'

export type PushTarget =
  | { screen: 'MatchDetail'; params: { matchId: string } }
  | { screen: 'BookingPayment'; params: { bookingId: string } }
  | { screen: 'MainTabs'; params: { screen: 'BookingsTab' | 'NotificationsTab' } }

/** Đường dẫn trong thông báo (dùng chung với web) -> màn hình của app. Không nhận ra thì mở tab Thông Báo. */
export function targetForLink(link: unknown): PushTarget {
  const path = typeof link === 'string' ? link : ''
  const match = new RegExp(`^/matches/(${UUID})`, 'i').exec(path)
  if (match) return { screen: 'MatchDetail', params: { matchId: match[1] } }
  const booking = new RegExp(`^/bookings/(${UUID})`, 'i').exec(path)
  if (booking) return { screen: 'BookingPayment', params: { bookingId: booking[1] } }
  if (path.startsWith('/my-bookings')) return { screen: 'MainTabs', params: { screen: 'BookingsTab' } }
  return { screen: 'MainTabs', params: { screen: 'NotificationsTab' } }
}

async function currentToken(): Promise<string | null> {
  if (!Device.isDevice) return null // máy ảo không nhận được thông báo đẩy
  const projectId = Constants.expoConfig?.extra?.eas?.projectId ?? Constants.easConfig?.projectId
  if (!projectId) return null // chưa tạo dự án EAS (xem DEPLOYMENT.md)
  try {
    return (await Notifications.getExpoPushTokenAsync({ projectId })).data
  } catch {
    return null
  }
}

/** Xin quyền, lấy token và gắn vào tài khoản đang đăng nhập. Trả true nếu đã đăng ký được. */
export async function registerForPush(): Promise<boolean> {
  try {
    if (Platform.OS === 'android') {
      await Notifications.setNotificationChannelAsync('default', {
        name: 'Thông báo SportArena',
        importance: Notifications.AndroidImportance.HIGH,
      })
    }

    const existing = await Notifications.getPermissionsAsync()
    let granted = existing.granted
    if (!granted && existing.canAskAgain) granted = (await Notifications.requestPermissionsAsync()).granted
    if (!granted) return false

    const token = await currentToken()
    if (!token) return false

    const { error } = await supabase.rpc('register_push_token', { p_token: token, p_platform: Platform.OS === 'ios' ? 'ios' : 'android' })
    return !error
  } catch (err) {
    console.warn('Không đăng ký được thông báo đẩy:', err)
    return false
  }
}

/** Gỡ token của máy này khỏi tài khoản. Phải gọi TRƯỚC khi đăng xuất vì cần phiên đăng nhập. */
export async function unregisterPush(): Promise<void> {
  try {
    const token = await currentToken()
    if (token) await supabase.rpc('unregister_push_token', { p_token: token })
  } catch (err) {
    console.warn('Không gỡ được thông báo đẩy:', err)
  }
}
