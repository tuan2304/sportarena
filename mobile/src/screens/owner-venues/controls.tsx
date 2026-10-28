import React from 'react'
import { Text, TextInput, TouchableOpacity, View } from 'react-native'
import { colors } from '../../theme/colors'
import { styles } from './styles'

export function IconButton({ label, onPress, children }: { label: string; onPress: () => void; children: React.ReactNode }) {
  return (
    <TouchableOpacity onPress={onPress} style={styles.iconBtn} accessibilityRole="button" accessibilityLabel={label}>
      {children}
    </TouchableOpacity>
  )
}

export function Field({ label, value, onChange, maxLength, numeric, multiline }: { label: string; value: string; onChange: (text: string) => void; maxLength?: number; numeric?: boolean; multiline?: boolean }) {
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
