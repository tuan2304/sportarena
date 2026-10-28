import React, { useEffect, useState } from 'react'
import { ActivityIndicator, Alert, Image, Modal, ScrollView, Text, TouchableOpacity, View } from 'react-native'
import { Plus, Trash2 } from 'lucide-react-native'
import { colors } from '../../theme/colors'
import { pickAndUploadClubImage, saveClubImages } from '../../lib/club-images'
import { MAX_CLUB_IMAGES } from '../../shared/image-upload'
import { useI18n } from '../../i18n'
import { IconButton } from './controls'
import type { Club } from './model'
import { styles } from './styles'

/** Quản lý ảnh của một cụm sân: thêm (chọn từ thư viện), gỡ, đặt làm ảnh bìa (ảnh đầu tiên), rồi lưu. */
export function PhotosSheet({ club, onClose, onSaved }: { club: Club | null; onClose: () => void; onSaved: () => void }) {
  const { t } = useI18n()
  const [images, setImages] = useState<string[]>([])
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    if (club) setImages(club.images ?? [])
  }, [club])

  const saved = club?.images ?? []
  const dirty = club !== null && (images.length !== saved.length || images.some((u, i) => u !== saved[i]))

  async function add() {
    if (!club) return
    setBusy(true)
    const res = await pickAndUploadClubImage(club.id)
    setBusy(false)
    if (res.ok) setImages((list) => [...list, res.url])
    else if (!res.cancelled) Alert.alert(t('owner.failed'), res.error)
  }

  async function save() {
    if (!club) return
    setBusy(true)
    const res = await saveClubImages(club.id, images)
    setBusy(false)
    if (!res.ok) {
      Alert.alert(t('owner.failed'), res.error)
      return
    }
    onSaved()
  }

  return (
    <Modal visible={club !== null} animationType="slide" transparent onRequestClose={onClose}>
      <View style={styles.backdrop}>
        <View style={styles.sheet}>
          <Text style={styles.sheetTitle}>{t('owner.images.title', { club: club?.name ?? '' })}</Text>
          <Text style={styles.hint}>{t('owner.images.hint', { max: MAX_CLUB_IMAGES })}</Text>

          <ScrollView contentContainerStyle={{ gap: 10, paddingBottom: 8 }}>
            {images.map((url, index) => (
              <View key={url} style={styles.photo}>
                <Image source={{ uri: url }} style={styles.photoImg} accessibilityIgnoresInvertColors />
                <View style={styles.photoBar}>
                  {index === 0 ? (
                    <Text style={styles.cover}>{t('owner.images.cover')}</Text>
                  ) : (
                    <TouchableOpacity onPress={() => setImages((list) => [url, ...list.filter((u) => u !== url)])} accessibilityRole="button">
                      <Text style={styles.ghostText}>{t('owner.images.makeCover')}</Text>
                    </TouchableOpacity>
                  )}
                  <View style={styles.flex} />
                  <IconButton label={t('owner.images.remove')} onPress={() => setImages((list) => list.filter((u) => u !== url))}>
                    <Trash2 size={16} color={colors.danger} />
                  </IconButton>
                </View>
              </View>
            ))}
            {images.length < MAX_CLUB_IMAGES && (
              <TouchableOpacity style={styles.addPhoto} onPress={add} disabled={busy} accessibilityRole="button">
                <Plus size={16} color={colors.primary} />
                <Text style={styles.ghostText}>{t('owner.images.add')}</Text>
              </TouchableOpacity>
            )}
          </ScrollView>

          <View style={styles.sheetActions}>
            <TouchableOpacity style={styles.danger} onPress={onClose} disabled={busy} accessibilityRole="button">
              <Text style={styles.dangerText}>{t('owner.images.close')}</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[styles.primary, styles.flex, (busy || !dirty) && styles.disabled]} onPress={save} disabled={busy || !dirty} accessibilityRole="button">
              {busy ? <ActivityIndicator color={colors.white} /> : <Text style={styles.primaryText}>{t('owner.images.save')}</Text>}
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  )
}
