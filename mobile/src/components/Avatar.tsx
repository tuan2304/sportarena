import React from 'react'
import { Image, StyleSheet, Text, View } from 'react-native'
import { colors } from '../theme/colors'
import { translate } from '../i18n'

interface AvatarProps {
  name?: string | null
  uri?: string | null
  size?: number
}

/** Ảnh đại diện tròn; chưa có ảnh thì hiện chữ cái đầu của tên. Chỉ nhận URL http(s). */
export default function Avatar({ name, uri, size = 40 }: AvatarProps) {
  const box = { width: size, height: size, borderRadius: size / 2 }
  if (uri && /^https?:\/\//i.test(uri)) {
    return <Image source={{ uri }} style={box} accessibilityLabel={name ? translate('avatar.a11yOf', { name }) : translate('avatar.a11y')} />
  }
  return (
    <View style={[styles.fallback, box]}>
      <Text style={[styles.letter, { fontSize: size * 0.4 }]}>{name?.trim().charAt(0).toUpperCase() || 'U'}</Text>
    </View>
  )
}

const styles = StyleSheet.create({
  fallback: { backgroundColor: colors.primaryLight, justifyContent: 'center', alignItems: 'center', borderWidth: 1, borderColor: colors.primaryBorder },
  letter: { color: colors.primary, fontWeight: '800' },
})
