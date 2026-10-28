import React, { useCallback, useEffect, useState } from 'react'
import { ActivityIndicator, Alert, RefreshControl, ScrollView, Text, TouchableOpacity, View } from 'react-native'
import { Building2, Plus } from 'lucide-react-native'
import { colors } from '../theme/colors'
import { supabase } from '../lib/supabase'
import { apiDelete, apiPatch, apiPut } from '../lib/api'
import { currentCoords } from '../lib/location'
import { useI18n } from '../i18n'
import { BankSheet } from './owner-venues/BankSheet'
import { ClubCard, type ClubCardActions } from './owner-venues/ClubCard'
import { FormSheet } from './owner-venues/FormSheet'
import { SELECT, type Club, type Form } from './owner-venues/model'
import { PhotosSheet } from './owner-venues/PhotosSheet'
import { styles } from './owner-venues/styles'

/**
 * Chủ sân quản lý cụm sân ngay trên điện thoại: tạo cụm sân, ảnh, vị trí, thêm/sửa/bật tắt/xóa sân con và khung giá.
 * Đọc trực tiếp từ Supabase (RLS cho chủ sân thấy cụm sân của mình); ghi đi qua API của máy chủ web, nơi kiểm tra dữ liệu,
 * quyền sở hữu và giới hạn số sân theo gói. Ảnh được tải thẳng lên Storage bằng phiên của chủ sân rồi máy chủ mới lưu danh sách.
 * Các hộp thoại và thẻ cụm sân nằm trong ./owner-venues.
 */
export default function OwnerVenuesPanel() {
  const { t } = useI18n()
  const [clubs, setClubs] = useState<Club[]>([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [form, setForm] = useState<Form | null>(null)
  const [photosOf, setPhotosOf] = useState<Club | null>(null)
  const [bankOf, setBankOf] = useState<Club | null>(null)
  const [busyId, setBusyId] = useState<string | null>(null)

  const load = useCallback(async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) {
        setClubs([])
        return
      }
      const { data, error } = await supabase.from('clubs').select(SELECT).eq('owner_id', user.id).order('name')
      if (error) throw error
      setClubs((data ?? []) as unknown as Club[])
    } catch (err) {
      console.warn('Không tải được cụm sân của chủ sân:', err)
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }, [])

  useEffect(() => {
    load()
  }, [load])

  /** Gọi API ghi rồi tải lại; lỗi hiện thành hộp thoại. */
  async function run(id: string, call: () => Promise<{ ok: true } | { ok: false; error: string }>) {
    setBusyId(id)
    const res = await call()
    setBusyId(null)
    if (!res.ok) {
      Alert.alert(t('owner.failed'), res.error)
      return
    }
    load()
  }

  function confirmDelete(title: string, text: string, id: string, path: string) {
    Alert.alert(title, text, [
      { text: t('owner.form.cancel'), style: 'cancel' },
      { text: t('owner.venues.delete'), style: 'destructive', onPress: () => run(id, () => apiDelete<unknown>(path)) },
    ])
  }

  function pinLocation(club: Club) {
    const save = (latitude: number | null, longitude: number | null) =>
      run(club.id, () => apiPut<unknown>(`/api/mobile/owner/clubs/${club.id}/location`, { latitude, longitude }))

    const buttons = [
      {
        text: t('owner.venues.pinUseCurrent'),
        onPress: async () => {
          const here = await currentCoords()
          if (!here.ok) Alert.alert(t('owner.failed'), here.error)
          else save(here.latitude, here.longitude)
        },
      },
      ...(club.latitude !== null ? [{ text: t('owner.venues.pinRemove'), style: 'destructive' as const, onPress: () => save(null, null) }] : []),
      { text: t('owner.form.cancel'), style: 'cancel' as const },
    ]
    Alert.alert(t('owner.venues.pinTitle'), t('owner.venues.pinHint'), buttons)
  }

  const actions: ClubCardActions = {
    openForm: setForm,
    openBank: setBankOf,
    openPhotos: setPhotosOf,
    pinLocation,
    toggleCourt: (court, active) => run(court.id, () => apiPatch<unknown>(`/api/mobile/owner/courts/${court.id}`, { isActive: active })),
    confirmDelete,
  }

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    )
  }

  return (
    <>
      <ScrollView
        contentContainerStyle={styles.list}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => {
              setRefreshing(true)
              load()
            }}
            tintColor={colors.primary}
          />
        }
      >
        <TouchableOpacity style={styles.primary} onPress={() => setForm({ kind: 'club' })} accessibilityRole="button">
          <Plus size={16} color={colors.white} />
          <Text style={styles.primaryText}>{t('owner.venues.addClub')}</Text>
        </TouchableOpacity>

        {clubs.length === 0 && (
          <View style={styles.center}>
            <Building2 size={48} color={colors.textMuted} />
            <Text style={styles.emptyTitle}>{t('owner.venues.empty')}</Text>
            <Text style={styles.emptyText}>{t('owner.venues.emptyText')}</Text>
          </View>
        )}

        {clubs.map((club) => (
          <ClubCard key={club.id} club={club} busyId={busyId} actions={actions} />
        ))}
      </ScrollView>

      <FormSheet
        form={form}
        onClose={() => setForm(null)}
        onSaved={() => {
          setForm(null)
          load()
        }}
      />
      <BankSheet
        club={bankOf}
        onClose={() => setBankOf(null)}
        onSaved={() => {
          setBankOf(null)
          load()
        }}
      />
      <PhotosSheet
        club={photosOf}
        onClose={() => setPhotosOf(null)}
        onSaved={() => {
          setPhotosOf(null)
          load()
        }}
      />
    </>
  )
}
