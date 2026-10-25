import { useI18n } from '../i18n'
import React, { useState, useEffect } from 'react'
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  ActivityIndicator,
  RefreshControl,
} from 'react-native'
import { colors } from '../theme/colors'
import { supabase } from '../lib/supabase'
import { NotificationItem } from '../types'
import { Bell, CircleDollarSign, Calendar, Flame, Info, CheckCheck } from 'lucide-react-native'

export default function NotificationsScreen() {
  const { t, lang } = useI18n()
  const [notifications, setNotifications] = useState<NotificationItem[]>([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)

  async function loadNotifications() {
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) {
        setNotifications([])
        return
      }

      const { data, error } = await supabase
        .from('notifications')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })

      if (error) throw error
      setNotifications(data || [])
    } catch (err: any) {
      console.error('Lỗi tải thông báo:', err.message)
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }

  useEffect(() => {
    loadNotifications()
  }, [])

  async function markAllAsRead() {
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return

      await supabase
        .from('notifications')
        .update({ is_read: true })
        .eq('user_id', user.id)
        .eq('is_read', false)

      setNotifications((prev) => prev.map((n) => ({ ...n, is_read: true })))
    } catch (err: any) {
      console.error('Lỗi đánh dấu đã đọc:', err.message)
    }
  }

  function renderTypeIcon(type: string) {
    switch (type) {
      case 'payment':
        return (
          <View style={[styles.iconBox, { backgroundColor: colors.primaryLight }]}>
            <CircleDollarSign size={18} color={colors.primary} />
          </View>
        )
      case 'match':
        return (
          <View style={[styles.iconBox, { backgroundColor: colors.accentLight }]}>
            <Flame size={18} color={colors.accent} />
          </View>
        )
      case 'booking':
        return (
          <View style={[styles.iconBox, { backgroundColor: 'rgba(59, 130, 246, 0.15)' }]}>
            <Calendar size={18} color="#3B82F6" />
          </View>
        )
      default:
        return (
          <View style={[styles.iconBox, { backgroundColor: colors.surface }]}>
            <Info size={18} color={colors.textSecondary} />
          </View>
        )
    }
  }

  function renderNotificationItem({ item }: { item: NotificationItem }) {
    return (
      <View style={[styles.card, !item.is_read && styles.cardUnread]}>
        {renderTypeIcon(item.type)}
        <View style={styles.cardContent}>
          <View style={styles.titleRow}>
            <Text style={styles.notifTitle} numberOfLines={1}>
              {lang === 'en' && item.title_en ? item.title_en : item.title}
            </Text>
            {!item.is_read && <View style={styles.unreadDot} />}
          </View>
          <Text style={styles.notifMessage} numberOfLines={3}>
            {lang === 'en' && item.message_en ? item.message_en : item.message}
          </Text>
          <Text style={styles.notifTime}>
            {new Date(item.created_at).toLocaleDateString('vi-VN', {
              hour: '2-digit',
              minute: '2-digit',
              day: '2-digit',
              month: '2-digit',
            })}
          </Text>
        </View>
      </View>
    )
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <View>
          <Text style={styles.title}>{t('notifications.title')}</Text>
          <Text style={styles.subtitle}>{t('notifications.subtitle')}</Text>
        </View>

        {notifications.some((n) => !n.is_read) && (
          <TouchableOpacity style={styles.readAllBtn} onPress={markAllAsRead}>
            <CheckCheck size={14} color={colors.primary} />
            <Text style={styles.readAllText}>{t('notifications.markRead')}</Text>
          </TouchableOpacity>
        )}
      </View>

      {loading ? (
        <View style={styles.centerContainer}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      ) : (
        <FlatList
          data={notifications}
          keyExtractor={(item) => item.id}
          renderItem={renderNotificationItem}
          contentContainerStyle={styles.listContent}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={() => {
                setRefreshing(true)
                loadNotifications()
              }}
              tintColor={colors.primary}
            />
          }
          ListEmptyComponent={
            <View style={styles.emptyContainer}>
              <Bell size={48} color={colors.textMuted} />
              <Text style={styles.emptyTitle}>{t('notifications.emptyTitle')}</Text>
              <Text style={styles.emptyDesc}>{t('notifications.emptyText')}</Text>
            </View>
          }
        />
      )}
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 14,
    backgroundColor: colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: colors.cardBorder,
  },
  title: {
    fontSize: 18,
    fontWeight: 'black',
    color: colors.textPrimary,
  },
  subtitle: {
    fontSize: 12,
    color: colors.textSecondary,
    marginTop: 2,
  },
  readAllBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  readAllText: {
    fontSize: 12,
    fontWeight: 'bold',
    color: colors.primary,
  },
  listContent: {
    padding: 16,
    gap: 10,
  },
  card: {
    flexDirection: 'row',
    backgroundColor: colors.card,
    borderRadius: 14,
    padding: 12,
    borderWidth: 1,
    borderColor: colors.cardBorder,
    gap: 12,
    alignItems: 'flex-start',
  },
  cardUnread: {
    backgroundColor: 'rgba(5, 150, 105, 0.08)',
    borderColor: colors.primaryBorder,
  },
  iconBox: {
    width: 38,
    height: 38,
    borderRadius: 19,
    justifyContent: 'center',
    alignItems: 'center',
  },
  cardContent: {
    flex: 1,
    gap: 4,
  },
  titleRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  notifTitle: {
    fontSize: 14,
    fontWeight: 'bold',
    color: colors.textPrimary,
    flex: 1,
  },
  unreadDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: colors.primary,
    marginLeft: 6,
  },
  notifMessage: {
    fontSize: 12,
    color: colors.textSecondary,
    lineHeight: 17,
  },
  notifTime: {
    fontSize: 10,
    color: colors.textMuted,
    marginTop: 2,
  },
  centerContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  emptyContainer: {
    paddingVertical: 80,
    alignItems: 'center',
    gap: 12,
  },
  emptyTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: colors.textPrimary,
  },
  emptyDesc: {
    fontSize: 12,
    color: colors.textMuted,
    textAlign: 'center',
    maxWidth: '80%',
  },
})

