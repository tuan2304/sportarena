import React from 'react'
import { NavigationContainer, createNavigationContainerRef } from '@react-navigation/native'
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs'
import { createNativeStackNavigator } from '@react-navigation/native-stack'
import { colors } from '../theme/colors'

// Screens
import ClubsScreen from '../screens/ClubsScreen'
import ClubDetailScreen from '../screens/ClubDetailScreen'
import MatchesScreen from '../screens/MatchesScreen'
import MatchDetailScreen from '../screens/MatchDetailScreen'
import BookingScreen from '../screens/BookingScreen'
import BookingPaymentScreen from '../screens/BookingPaymentScreen'
import MyBookingsScreen from '../screens/MyBookingsScreen'
import NotificationsScreen from '../screens/NotificationsScreen'
import ProfileScreen from '../screens/ProfileScreen'
import PlayerProfileScreen from '../screens/PlayerProfileScreen'

// Icons
import { Compass, Flame, Calendar, Bell, User } from 'lucide-react-native'

/** Cho phép mở màn hình từ ngoài cây giao diện (chạm vào thông báo đẩy) */
export const navigationRef = createNavigationContainerRef<any>()

const Tab = createBottomTabNavigator()
const Stack = createNativeStackNavigator()

function BottomTabs() {
  return (
    <Tab.Navigator
      screenOptions={{
        headerStyle: {
          backgroundColor: colors.surface,
          shadowOpacity: 0,
          elevation: 0,
          borderBottomWidth: 1,
          borderBottomColor: colors.cardBorder,
        },
        headerTitleStyle: {
          color: colors.textPrimary,
          fontWeight: 'bold',
          fontSize: 17,
        },
        tabBarStyle: {
          backgroundColor: colors.surface,
          borderTopColor: colors.cardBorder,
          borderTopWidth: 1,
          height: 60,
          paddingBottom: 8,
          paddingTop: 6,
        },
        tabBarActiveTintColor: colors.primary,
        tabBarInactiveTintColor: colors.textMuted,
        tabBarLabelStyle: {
          fontSize: 11,
          fontWeight: '600',
        },
      }}
    >
      <Tab.Screen
        name="ClubsTab"
        component={ClubsScreen}
        options={{
          title: 'Khám Phá Sân',
          tabBarLabel: 'Khám Phá',
          tabBarIcon: ({ color, size }) => <Compass color={color} size={size - 2} />,
        }}
      />

      <Tab.Screen
        name="MatchesTab"
        component={MatchesScreen}
        options={{
          title: 'Kèo Giao Lưu',
          tabBarLabel: 'Kèo Ghép',
          tabBarIcon: ({ color, size }) => <Flame color={color} size={size - 2} />,
        }}
      />

      <Tab.Screen
        name="BookingsTab"
        component={MyBookingsScreen}
        options={{
          title: 'Lịch Đặt Của Tôi',
          tabBarLabel: 'Lịch Đặt',
          tabBarIcon: ({ color, size }) => <Calendar color={color} size={size - 2} />,
        }}
      />

      <Tab.Screen
        name="NotificationsTab"
        component={NotificationsScreen}
        options={{
          title: 'Thông Báo',
          tabBarLabel: 'Thông Báo',
          tabBarIcon: ({ color, size }) => <Bell color={color} size={size - 2} />,
        }}
      />

      <Tab.Screen
        name="ProfileTab"
        component={ProfileScreen}
        options={{
          title: 'Tài Khoản',
          tabBarLabel: 'Cá Nhân',
          tabBarIcon: ({ color, size }) => <User color={color} size={size - 2} />,
        }}
      />
    </Tab.Navigator>
  )
}

export default function RootNavigator() {
  return (
    <NavigationContainer ref={navigationRef}>
      <Stack.Navigator
        screenOptions={{
          headerShown: false,
          contentStyle: { backgroundColor: colors.background },
        }}
      >
        <Stack.Screen name="MainTabs" component={BottomTabs} />
        <Stack.Screen name="ClubDetail" component={ClubDetailScreen} />
        <Stack.Screen name="MatchDetail" component={MatchDetailScreen} />
        <Stack.Screen name="Booking" component={BookingScreen} />
        <Stack.Screen name="BookingPayment" component={BookingPaymentScreen} />
        <Stack.Screen name="PlayerProfile" component={PlayerProfileScreen} />
      </Stack.Navigator>
    </NavigationContainer>
  )
}

