import React, { useState, useEffect } from 'react'
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
  Alert,
} from 'react-native'
import { colors } from '../theme/colors'
import { supabase } from '../lib/supabase'
import AuthForm from '../components/AuthForm'
import ProfileEditForm from '../components/ProfileEditForm'
import Avatar from '../components/Avatar'
import { pickAndUploadAvatar, removeAvatar } from '../lib/avatar'
import { unregisterPush } from '../lib/push'
import { skillLabel } from '../shared/profile'
import { Profile } from '../types'
import { Shield, LogOut, Smartphone, Camera, ExternalLink } from 'lucide-react-native'

export default function ProfileScreen({ navigation }: any) {
  const [profile, setProfile] = useState<Profile | null>(null)
  const [currentUserEmail, setCurrentUserEmail] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [phone, setPhone] = useState('')
  const [editing, setEditing] = useState(false)
  const [avatarBusy, setAvatarBusy] = useState(false)

  async function checkSession() {
    try {
      const { data: { session } } = await supabase.auth.getSession()
      if (session?.user) {
        setCurrentUserEmail(session.user.email || null)
        // Số điện thoại bị khóa đọc trực tiếp; hàm này chỉ trả hồ sơ của chính mình (kể cả số điện thoại)
        const { data: mine } = await supabase.rpc('get_my_profile')
        if (mine && mine.length > 0) {
          setProfile(mine[0] as Profile)
          setPhone(mine[0].phone_number ?? '')
        } else {
          // Dự phòng khi hàm chưa có trên database: chỉ lấy các cột công khai
          const { data } = await supabase
            .from('profiles')
            .select('id, full_name, avatar_url, role, skill_level, rating')
            .eq('id', session.user.id)
            .single()
          setProfile(data)
        }
      } else {
        setProfile(null)
        setCurrentUserEmail(null)
      }
    } catch (err: any) {
      console.error('Lỗi check session:', err.message)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    checkSession()
  }, [])

  async function changeAvatar() {
    if (!profile) return
    setAvatarBusy(true)
    const res = await pickAndUploadAvatar(profile.id, profile.avatar_url)
    setAvatarBusy(false)
    if (res.ok) setProfile({ ...profile, avatar_url: res.url })
    else if (!res.cancelled) Alert.alert('Không đổi được ảnh', res.error)
  }

  function confirmRemoveAvatar() {
    if (!profile?.avatar_url) return
    Alert.alert('Gỡ ảnh đại diện?', 'Hồ sơ sẽ hiển thị chữ cái đầu của tên.', [
      { text: 'Hủy', style: 'cancel' },
      {
        text: 'Gỡ ảnh',
        style: 'destructive',
        onPress: async () => {
          setAvatarBusy(true)
          const res = await removeAvatar(profile.id, profile.avatar_url)
          setAvatarBusy(false)
          if (res.ok) setProfile({ ...profile, avatar_url: null })
          else Alert.alert('Không gỡ được ảnh', res.error)
        },
      },
    ])
  }

  async function handleLogout() {
    // Gỡ token trước khi đăng xuất: sau đó không còn phiên để gọi database
    await unregisterPush()
    await supabase.auth.signOut()
    setProfile(null)
    setCurrentUserEmail(null)
    Alert.alert('Thông báo', 'Bạn đã đăng xuất')
  }

  if (loading) {
    return (
      <View style={styles.centerContainer}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    )
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      {/* Current User Card */}
      {profile ? (
        <View style={styles.profileCard}>
          <TouchableOpacity
            onPress={changeAvatar}
            onLongPress={confirmRemoveAvatar}
            disabled={avatarBusy}
            accessibilityRole="button"
            accessibilityLabel="Đổi ảnh đại diện"
            accessibilityHint="Nhấn giữ để gỡ ảnh"
            style={styles.avatarWrap}
          >
            <Avatar name={profile.full_name} uri={profile.avatar_url} size={88} />
            <View style={styles.cameraBadge}>
              {avatarBusy ? <ActivityIndicator size="small" color={colors.white} /> : <Camera size={14} color={colors.white} />}
            </View>
          </TouchableOpacity>
          <Text style={styles.userName}>{profile.full_name}</Text>
          <Text style={styles.userEmail}>{currentUserEmail}</Text>
          <Text style={styles.userEmail}>Trình độ: {skillLabel(profile.skill_level)}</Text>

          <View style={styles.roleBadge}>
            <Shield size={12} color={colors.primary} />
            <Text style={styles.roleText}>
              {profile.role === 'owner' ? 'CHỦ SÂN BÃI' : 'NGƯỜI CHƠI THỂ THAO'}
            </Text>
          </View>

          <TouchableOpacity style={styles.editBtn} onPress={() => setEditing((v) => !v)} accessibilityRole="button">
            <Text style={styles.editText}>{editing ? 'Đóng chỉnh sửa' : 'Chỉnh sửa hồ sơ'}</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.publicBtn}
            onPress={() => navigation.navigate('PlayerProfile', { userId: profile.id })}
            accessibilityRole="button"
          >
            <ExternalLink size={14} color={colors.textSecondary} />
            <Text style={styles.publicText}>Xem hồ sơ công khai</Text>
          </TouchableOpacity>

          <TouchableOpacity style={styles.logoutBtn} onPress={handleLogout}>
            <LogOut size={16} color={colors.danger} />
            <Text style={styles.logoutText}>Đăng Xuất</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <AuthForm onSignedIn={checkSession} />
      )}

      {profile && editing && (
        <ProfileEditForm
          userId={profile.id}
          initial={{
            fullName: profile.full_name ?? '',
            phone,
            skillLevel: profile.skill_level ?? 'intermediate',
          }}
          onSaved={() => {
            setEditing(false)
            checkSession()
          }}
          onCancel={() => setEditing(false)}
        />
      )}

      {/* App Info Footer */}
      <View style={styles.appInfoBox}>
        <Smartphone size={16} color={colors.textMuted} />
        <Text style={styles.appInfoText}>
          SportArena Mobile App v1.0.0 (Expo SDK 58)
        </Text>
      </View>
    </ScrollView>
  )
}

const styles = StyleSheet.create({
  avatarWrap: { marginBottom: 4 },
  cameraBadge: {
    position: 'absolute',
    right: -2,
    bottom: -2,
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: colors.primary,
    borderWidth: 2,
    borderColor: colors.card,
    justifyContent: 'center',
    alignItems: 'center',
  },
  publicBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, minHeight: 40, marginTop: 4 },
  publicText: { color: colors.textSecondary, fontSize: 13, fontWeight: '600' },
  editBtn: {
    minHeight: 44,
    alignSelf: 'stretch',
    marginTop: 12,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: colors.primaryBorder,
    backgroundColor: colors.primaryLight,
    justifyContent: 'center',
    alignItems: 'center',
  },
  editText: {
    color: colors.primary,
    fontWeight: '700',
    fontSize: 14,
  },
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  content: {
    padding: 16,
    gap: 16,
    paddingBottom: 40,
  },
  centerContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: colors.background,
  },
  profileCard: {
    backgroundColor: colors.card,
    borderRadius: 20,
    padding: 20,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.cardBorder,
    gap: 8,
  },
  avatarLarge: {
    width: 68,
    height: 68,
    borderRadius: 34,
    backgroundColor: colors.primaryLight,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: colors.primary,
    marginBottom: 4,
  },
  avatarTextLarge: {
    color: colors.primary,
    fontSize: 28,
    fontWeight: 'black',
  },
  userName: {
    fontSize: 18,
    fontWeight: 'bold',
    color: colors.textPrimary,
  },
  userEmail: {
    fontSize: 13,
    color: colors.textSecondary,
  },
  roleBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.primaryLight,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 8,
    gap: 6,
    marginTop: 4,
  },
  roleText: {
    color: colors.primary,
    fontSize: 11,
    fontWeight: 'bold',
    letterSpacing: 0.5,
  },
  logoutBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 12,
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 10,
    backgroundColor: colors.dangerLight,
  },
  logoutText: {
    color: colors.danger,
    fontSize: 13,
    fontWeight: 'bold',
  },
  notLoggedCard: {
    backgroundColor: colors.card,
    borderRadius: 20,
    padding: 24,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.cardBorder,
    gap: 10,
  },
  notLoggedTitle: {
    fontSize: 17,
    fontWeight: 'bold',
    color: colors.textPrimary,
  },
  notLoggedDesc: {
    fontSize: 12,
    color: colors.textMuted,
    textAlign: 'center',
    lineHeight: 18,
  },
  appInfoBox: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 6,
    marginTop: 20,
  },
  appInfoText: {
    fontSize: 11,
    color: colors.textMuted,
  },
})

