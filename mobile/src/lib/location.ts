import * as Location from 'expo-location'
import { translate } from '../i18n'

export type CoordsResult = { ok: true; latitude: number; longitude: number } | { ok: false; error: string }

/** Vị trí hiện tại của điện thoại, để chủ sân đứng tại sân rồi ghim lên bản đồ. Chỉ xin quyền khi người dùng bấm nút. */
export async function currentCoords(): Promise<CoordsResult> {
  const permission = await Location.requestForegroundPermissionsAsync()
  if (!permission.granted) return { ok: false, error: translate('owner.venues.locationPermission') }
  try {
    const position = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced })
    return { ok: true, latitude: position.coords.latitude, longitude: position.coords.longitude }
  } catch {
    return { ok: false, error: translate('owner.venues.locationFailed') }
  }
}
