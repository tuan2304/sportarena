import React, { useCallback, useEffect, useState } from 'react'
import {
  ActivityIndicator,
  Alert,
  Image,
  KeyboardAvoidingView,
  Modal,
  Platform,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native'
import { Building2, ImageIcon, MapPin, Pencil, Plus, Trash2 } from 'lucide-react-native'
import { colors } from '../theme/colors'
import { supabase } from '../lib/supabase'
import { apiDelete, apiPatch, apiPost, apiPut } from '../lib/api'
import { pickAndUploadClubImage, saveClubImages } from '../lib/club-images'
import { currentCoords } from '../lib/location'
import { formatVnd } from '../lib/format'
import { MAX_CLUB_IMAGES } from '../shared/image-upload'
import { useI18n, type MessageKey } from '../i18n'

const SPORTS = ['football', 'badminton', 'pickleball', 'tennis', 'basketball'] as const

interface Rule {
  id: string
  name: string
  start_time: string
  end_time: string
  price_per_hour: number
}
interface Court {
  id: string
  name: string
  sport_type: string
  surface_type: string | null
  base_price_per_hour: number
  deposit_percentage: number
  is_active: boolean
  court_pricing_rules: Rule[] | null
}
interface Club {
  id: string
  name: string
  address: string
  images: string[] | null
  latitude: number | null
  longitude: number | null
  courts: Court[] | null
}

type Form =
  | { kind: 'club' }
  | { kind: 'court'; club: Club }
  | { kind: 'rule'; court: Court }
  | { kind: 'editCourt'; court: Court }
  | { kind: 'editRule'; court: Court; rule: Rule }

const SELECT = `
  id, name, address, images, latitude, longitude,
  courts ( id, name, sport_type, surface_type, base_price_per_hour, deposit_percentage, is_active,
    court_pricing_rules ( id, name, start_time, end_time, price_per_hour ) )
`

const hhmm = (time: string) => time.slice(0, 5)

/**
 * Chủ sân quản lý cụm sân ngay trên điện thoại: tạo cụm sân, ảnh, vị trí, thêm/sửa/bật tắt/xóa sân con và khung giá.
 * Đọc trực tiếp từ Supabase (RLS cho chủ sân thấy cụm sân của mình); ghi đi qua API của máy chủ web, nơi kiểm tra dữ liệu,
 * quyền sở hữu và giới hạn số sân theo gói. Ảnh được tải thẳng lên Storage bằng phiên của chủ sân rồi máy chủ mới lưu danh sách.
 */
export default function OwnerVenuesPanel() {
  const { t } = useI18n()
  const [clubs, setClubs] = useState<Club[]>([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [form, setForm] = useState<Form | null>(null)
  const [photosOf, setPhotosOf] = useState<Club | null>(null)
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
          <View key={club.id} style={[styles.card, busyId === club.id && styles.disabled]}>
            <View style={styles.row}>
              <View style={styles.flex}>
                <Text style={styles.clubName}>{club.name}</Text>
                <Text style={styles.muted}>{club.address}</Text>
              </View>
              <IconButton
                label={t('owner.venues.deleteClub')}
                onPress={() =>
                  confirmDelete(t('owner.venues.deleteClubTitle', { name: club.name }), t('owner.venues.deleteClubText'), club.id, `/api/mobile/owner/clubs/${club.id}`)
                }
              >
                <Trash2 size={16} color={colors.danger} />
              </IconButton>
            </View>

            <View style={styles.chips}>
              <TouchableOpacity style={styles.chip} onPress={() => setPhotosOf(club)} accessibilityRole="button">
                <ImageIcon size={14} color={colors.primary} />
                <Text style={styles.chipText}>{t('owner.venues.photos', { count: (club.images ?? []).length })}</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.chip} onPress={() => pinLocation(club)} accessibilityRole="button">
                <MapPin size={14} color={colors.primary} />
                <Text style={styles.chipText}>{club.latitude !== null ? t('owner.venues.pinned') : t('owner.venues.pin')}</Text>
              </TouchableOpacity>
            </View>

            {(club.courts ?? []).length === 0 && <Text style={styles.muted}>{t('owner.venues.noCourts')}</Text>}

            {(club.courts ?? []).map((court) => (
              <View key={court.id} style={[styles.court, busyId === court.id && styles.disabled]}>
                <View style={styles.row}>
                  <Text style={[styles.courtName, styles.flex]}>{court.name}</Text>
                  <Switch
                    value={court.is_active}
                    disabled={busyId === court.id}
                    onValueChange={(next) => run(court.id, () => apiPatch<unknown>(`/api/mobile/owner/courts/${court.id}`, { isActive: next }))}
                    trackColor={{ true: colors.primary, false: colors.cardBorder }}
                    accessibilityLabel={t('owner.venues.active')}
                  />
                </View>
                <Text style={styles.muted}>
                  {t(`owner.sport.${court.sport_type}` as MessageKey)} · {t('owner.venues.base')} {t('owner.venues.perHour', { price: formatVnd(court.base_price_per_hour) })} ·{' '}
                  {t('owner.venues.deposit', { percent: court.deposit_percentage })}
                </Text>
                {!court.is_active && <Text style={styles.off}>{t('owner.venues.inactive')}</Text>}

                {(court.court_pricing_rules ?? []).length === 0 && <Text style={styles.hint}>{t('owner.venues.noRules')}</Text>}
                {(court.court_pricing_rules ?? [])
                  .slice()
                  .sort((a, b) => a.start_time.localeCompare(b.start_time))
                  .map((rule) => (
                    <View key={rule.id} style={styles.rule}>
                      <View style={styles.flex}>
                        <Text style={styles.ruleName}>{rule.name}</Text>
                        <Text style={styles.muted}>
                          {hhmm(rule.start_time)} - {hhmm(rule.end_time)} · {t('owner.venues.perHour', { price: formatVnd(rule.price_per_hour) })}
                        </Text>
                      </View>
                      <IconButton label={t('owner.venues.edit')} onPress={() => setForm({ kind: 'editRule', court, rule })}>
                        <Pencil size={16} color={colors.primary} />
                      </IconButton>
                      <IconButton
                        label={t('owner.venues.delete')}
                        onPress={() =>
                          confirmDelete(t('owner.venues.deleteRuleTitle'), t('owner.venues.deleteRuleText', { name: rule.name }), rule.id, `/api/mobile/owner/pricing-rules/${rule.id}`)
                        }
                      >
                        <Trash2 size={16} color={colors.danger} />
                      </IconButton>
                    </View>
                  ))}

                <View style={styles.row}>
                  <TouchableOpacity style={styles.ghost} onPress={() => setForm({ kind: 'rule', court })} accessibilityRole="button">
                    <Plus size={14} color={colors.primary} />
                    <Text style={styles.ghostText}>{t('owner.venues.addRule')}</Text>
                  </TouchableOpacity>
                  <View style={styles.flex} />
                  <IconButton label={t('owner.venues.edit')} onPress={() => setForm({ kind: 'editCourt', court })}>
                    <Pencil size={16} color={colors.primary} />
                  </IconButton>
                  <IconButton
                    label={t('owner.venues.delete')}
                    onPress={() =>
                      confirmDelete(t('owner.venues.deleteCourtTitle', { name: court.name }), t('owner.venues.deleteCourtText'), court.id, `/api/mobile/owner/courts/${court.id}`)
                    }
                  >
                    <Trash2 size={16} color={colors.danger} />
                  </IconButton>
                </View>
              </View>
            ))}

            <TouchableOpacity style={styles.ghost} onPress={() => setForm({ kind: 'court', club })} accessibilityRole="button">
              <Plus size={14} color={colors.primary} />
              <Text style={styles.ghostText}>{t('owner.venues.addCourt')}</Text>
            </TouchableOpacity>
          </View>
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

function IconButton({ label, onPress, children }: { label: string; onPress: () => void; children: React.ReactNode }) {
  return (
    <TouchableOpacity onPress={onPress} style={styles.iconBtn} accessibilityRole="button" accessibilityLabel={label}>
      {children}
    </TouchableOpacity>
  )
}

/** Hộp thoại nhập liệu dùng chung cho các biểu mẫu; mỗi loại tự dựng trường và gọi API tương ứng. */
function FormSheet({ form, onClose, onSaved }: { form: Form | null; onClose: () => void; onSaved: () => void }) {
  const { t } = useI18n()
  const [values, setValues] = useState<Record<string, string>>({})
  const [sport, setSport] = useState<(typeof SPORTS)[number]>('football')
  const [saving, setSaving] = useState(false)

  // Mở biểu mẫu mới thì đặt lại dữ liệu: mặc định khi tạo, giá trị hiện có khi sửa
  useEffect(() => {
    if (!form) return
    setSport('football')
    if (form.kind === 'club') setValues({ openTime: '06:00', closeTime: '23:00', city: 'Hồ Chí Minh' })
    else if (form.kind === 'court') setValues({ basePrice: '150000', deposit: '30' })
    else if (form.kind === 'rule') setValues({ startTime: '17:00', endTime: '21:00', price: String(form.court.base_price_per_hour) })
    else if (form.kind === 'editCourt') {
      setValues({
        name: form.court.name,
        surface: form.court.surface_type ?? '',
        basePrice: String(form.court.base_price_per_hour),
        deposit: String(form.court.deposit_percentage),
      })
    } else {
      setValues({ name: form.rule.name, startTime: hhmm(form.rule.start_time), endTime: hhmm(form.rule.end_time), price: String(form.rule.price_per_hour) })
    }
  }, [form])

  const set = (key: string) => (text: string) => setValues((v) => ({ ...v, [key]: text }))
  const v = (key: string) => values[key] ?? ''

  async function submit() {
    if (!form) return
    const numbers = { basePricePerHour: Number(v('basePrice')), depositPercentage: Number(v('deposit')), pricePerHour: Number(v('price')) }
    const needsNumbers = form.kind === 'court' || form.kind === 'editCourt' ? [numbers.basePricePerHour, numbers.depositPercentage] : form.kind === 'club' ? [] : [numbers.pricePerHour]
    if (needsNumbers.some((n) => Number.isNaN(n))) {
      Alert.alert(t('owner.failed'), t('owner.form.invalidNumber'))
      return
    }

    let call: () => ReturnType<typeof apiPost>
    if (form.kind === 'club') {
      call = () =>
        apiPost('/api/mobile/owner/clubs', {
          name: v('name'),
          address: v('address'),
          district: v('district'),
          city: v('city'),
          description: v('description'),
          openTime: v('openTime'),
          closeTime: v('closeTime'),
        })
    } else if (form.kind === 'court') {
      call = () =>
        apiPost(`/api/mobile/owner/clubs/${form.club.id}/courts`, {
          name: v('name'),
          sportType: sport,
          surfaceType: v('surface'),
          basePricePerHour: numbers.basePricePerHour,
          depositPercentage: numbers.depositPercentage,
        })
    } else if (form.kind === 'editCourt') {
      call = () =>
        apiPatch(`/api/mobile/owner/courts/${form.court.id}`, {
          name: v('name'),
          surfaceType: v('surface'),
          basePricePerHour: numbers.basePricePerHour,
          depositPercentage: numbers.depositPercentage,
        })
    } else if (form.kind === 'rule') {
      call = () => apiPost(`/api/mobile/owner/courts/${form.court.id}/pricing-rules`, { name: v('name'), startTime: v('startTime'), endTime: v('endTime'), pricePerHour: numbers.pricePerHour })
    } else {
      call = () => apiPatch(`/api/mobile/owner/pricing-rules/${form.rule.id}`, { name: v('name'), startTime: v('startTime'), endTime: v('endTime'), pricePerHour: numbers.pricePerHour })
    }

    setSaving(true)
    const res = await call()
    setSaving(false)
    if (!res.ok) {
      Alert.alert(t('owner.failed'), res.error)
      return
    }
    onSaved()
  }

  const title = !form
    ? ''
    : form.kind === 'club'
      ? t('owner.form.clubTitle')
      : form.kind === 'court'
        ? t('owner.form.courtTitle', { club: form.club.name })
        : form.kind === 'rule'
          ? t('owner.form.ruleTitle', { court: form.court.name })
          : form.kind === 'editCourt'
            ? t('owner.form.editCourtTitle', { court: form.court.name })
            : t('owner.form.editRuleTitle')

  const courtFields = form?.kind === 'court' || form?.kind === 'editCourt'
  const ruleFields = form?.kind === 'rule' || form?.kind === 'editRule'

  return (
    <Modal visible={form !== null} animationType="slide" transparent onRequestClose={onClose}>
      <KeyboardAvoidingView style={styles.backdrop} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <View style={styles.sheet}>
          <Text style={styles.sheetTitle}>{title}</Text>
          <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{ gap: 6, paddingBottom: 8 }}>
            {form?.kind === 'club' && (
              <>
                <Field label={t('owner.form.clubName')} value={v('name')} onChange={set('name')} maxLength={100} />
                <Field label={t('owner.form.address')} value={v('address')} onChange={set('address')} maxLength={200} />
                <Field label={t('owner.form.district')} value={v('district')} onChange={set('district')} maxLength={60} />
                <Field label={t('owner.form.city')} value={v('city')} onChange={set('city')} maxLength={60} />
                <Field label={t('owner.form.openTime')} value={v('openTime')} onChange={set('openTime')} maxLength={5} />
                <Field label={t('owner.form.closeTime')} value={v('closeTime')} onChange={set('closeTime')} maxLength={5} />
                <Field label={t('owner.form.description')} value={v('description')} onChange={set('description')} maxLength={1000} multiline />
              </>
            )}

            {courtFields && (
              <>
                <Field label={t('owner.form.courtName')} value={v('name')} onChange={set('name')} maxLength={80} />
                {form?.kind === 'court' && (
                  <>
                    <Text style={styles.label}>{t('owner.form.sport')}</Text>
                    <View style={styles.chips}>
                      {SPORTS.map((s) => (
                        <TouchableOpacity key={s} style={[styles.chip, sport === s && styles.chipOn]} onPress={() => setSport(s)} accessibilityRole="button">
                          <Text style={[styles.chipText, sport === s && styles.chipTextOn]}>{t(`owner.sport.${s}` as MessageKey)}</Text>
                        </TouchableOpacity>
                      ))}
                    </View>
                  </>
                )}
                <Field label={t('owner.form.surface')} value={v('surface')} onChange={set('surface')} maxLength={40} />
                <Field label={t('owner.form.basePrice')} value={v('basePrice')} onChange={set('basePrice')} numeric />
                <Field label={t('owner.form.deposit')} value={v('deposit')} onChange={set('deposit')} numeric maxLength={3} />
              </>
            )}

            {ruleFields && (
              <>
                <Field label={t('owner.form.ruleName')} value={v('name')} onChange={set('name')} maxLength={80} />
                <Field label={t('owner.form.startTime')} value={v('startTime')} onChange={set('startTime')} maxLength={5} />
                <Field label={t('owner.form.endTime')} value={v('endTime')} onChange={set('endTime')} maxLength={5} />
                <Field label={t('owner.form.basePrice')} value={v('price')} onChange={set('price')} numeric />
              </>
            )}
          </ScrollView>

          <View style={styles.sheetActions}>
            <TouchableOpacity style={styles.danger} onPress={onClose} disabled={saving} accessibilityRole="button">
              <Text style={styles.dangerText}>{t('owner.form.cancel')}</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[styles.primary, styles.flex, saving && styles.disabled]} onPress={submit} disabled={saving} accessibilityRole="button">
              {saving ? <ActivityIndicator color={colors.white} /> : <Text style={styles.primaryText}>{t('owner.form.save')}</Text>}
            </TouchableOpacity>
          </View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  )
}

/** Quản lý ảnh của một cụm sân: thêm (chọn từ thư viện), gỡ, đặt làm ảnh bìa (ảnh đầu tiên), rồi lưu. */
function PhotosSheet({ club, onClose, onSaved }: { club: Club | null; onClose: () => void; onSaved: () => void }) {
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

function Field({ label, value, onChange, maxLength, numeric, multiline }: { label: string; value: string; onChange: (text: string) => void; maxLength?: number; numeric?: boolean; multiline?: boolean }) {
  return (
    <View>
      <Text style={styles.label}>{label}</Text>
      <TextInput
        style={[styles.input, multiline && styles.multiline]}
        value={value}
        onChangeText={onChange}
        maxLength={maxLength}
        keyboardType={numeric ? 'number-pad' : 'default'}
        multiline={multiline}
        placeholderTextColor={colors.textMuted}
        accessibilityLabel={label}
      />
    </View>
  )
}

const styles = StyleSheet.create({
  center: { alignItems: 'center', justifyContent: 'center', padding: 32, gap: 8 },
  list: { padding: 16, paddingTop: 4, paddingBottom: 40, gap: 10 },
  flex: { flex: 1 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  card: { backgroundColor: colors.card, borderRadius: 14, borderWidth: 1, borderColor: colors.cardBorder, padding: 14, gap: 8 },
  clubName: { color: colors.textPrimary, fontWeight: '800', fontSize: 15 },
  muted: { color: colors.textSecondary, fontSize: 12 },
  hint: { color: colors.textMuted, fontSize: 12 },
  court: { backgroundColor: colors.surface, borderRadius: 10, padding: 10, gap: 6 },
  courtName: { color: colors.textPrimary, fontWeight: '700', fontSize: 14 },
  off: { alignSelf: 'flex-start', color: colors.accent, backgroundColor: colors.accentLight, fontSize: 11, fontWeight: '700', paddingHorizontal: 8, paddingVertical: 2, borderRadius: 8, overflow: 'hidden' },
  rule: { flexDirection: 'row', alignItems: 'center', gap: 4, borderTopWidth: 1, borderTopColor: colors.cardBorder, paddingTop: 6 },
  ruleName: { color: colors.textPrimary, fontWeight: '600', fontSize: 13 },
  iconBtn: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center' },
  ghost: { flexDirection: 'row', alignItems: 'center', gap: 6, minHeight: 44 },
  ghostText: { color: colors.primary, fontWeight: '700', fontSize: 13 },
  primary: { minHeight: 44, borderRadius: 10, backgroundColor: colors.primary, alignItems: 'center', justifyContent: 'center', flexDirection: 'row', gap: 6 },
  primaryText: { color: colors.white, fontWeight: '800', fontSize: 13 },
  danger: { minHeight: 44, paddingHorizontal: 18, borderRadius: 10, backgroundColor: colors.dangerLight, alignItems: 'center', justifyContent: 'center' },
  dangerText: { color: colors.danger, fontWeight: '700', fontSize: 13 },
  disabled: { opacity: 0.5 },
  emptyTitle: { color: colors.textPrimary, fontWeight: '700', fontSize: 15 },
  emptyText: { color: colors.textMuted, fontSize: 12, textAlign: 'center' },
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'flex-end' },
  sheet: { backgroundColor: colors.card, borderTopLeftRadius: 18, borderTopRightRadius: 18, padding: 16, maxHeight: '90%', gap: 10 },
  sheetTitle: { color: colors.textPrimary, fontWeight: '800', fontSize: 16 },
  sheetActions: { flexDirection: 'row', gap: 8 },
  label: { color: colors.textSecondary, fontSize: 12, fontWeight: '600', marginBottom: 4, marginTop: 4 },
  input: { backgroundColor: colors.surface, borderRadius: 10, borderWidth: 1, borderColor: colors.cardBorder, color: colors.textPrimary, paddingHorizontal: 12, minHeight: 44, fontSize: 14 },
  multiline: { minHeight: 80, textAlignVertical: 'top', paddingTop: 10 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  chip: { flexDirection: 'row', alignItems: 'center', gap: 6, minHeight: 36, paddingHorizontal: 12, borderRadius: 18, borderWidth: 1, borderColor: colors.cardBorder },
  chipOn: { backgroundColor: colors.primaryLight, borderColor: colors.primary },
  chipText: { color: colors.textSecondary, fontSize: 12, fontWeight: '600' },
  chipTextOn: { color: colors.primary },
  photo: { backgroundColor: colors.surface, borderRadius: 10, overflow: 'hidden' },
  photoImg: { width: '100%', aspectRatio: 16 / 9, backgroundColor: colors.cardBorder },
  photoBar: { flexDirection: 'row', alignItems: 'center', paddingLeft: 12 },
  cover: { color: colors.accent, fontWeight: '800', fontSize: 12 },
  addPhoto: { minHeight: 56, borderRadius: 10, borderWidth: 1, borderStyle: 'dashed', borderColor: colors.primaryBorder, alignItems: 'center', justifyContent: 'center', flexDirection: 'row', gap: 6 },
})
