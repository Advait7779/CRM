import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { useTheme } from '../../context/ThemeContext';
import { Inbox } from 'lucide-react-native';

export default function EmptyState({
  title = 'No records found',
  description = 'Try changing your search query or add a new record.',
  icon: Icon = Inbox,
  actionText,
  onAction
}) {
  const { colors, fonts } = useTheme();

  return (
    <View style={styles.container} accessibilityLiveRegion="polite">
      <View style={[styles.iconBox, { backgroundColor: colors.cardSecondary }]}>
        <Icon size={36} color={colors.textMuted} accessible={false} />
      </View>
      <Text style={[styles.title, { color: colors.text, fontFamily: fonts.bold }]}>{title}</Text>
      <Text style={[styles.desc, { color: colors.textMuted, fontFamily: fonts.body }]}>{description}</Text>
      {actionText && onAction ? (
        <TouchableOpacity
          style={[styles.btn, { backgroundColor: colors.primary }]}
          onPress={onAction}
          activeOpacity={0.8}
          accessibilityRole="button"
          accessibilityLabel={actionText}
        >
          <Text style={[styles.btnText, { fontFamily: fonts.bold }]}>{actionText}</Text>
        </TouchableOpacity>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    paddingVertical: 50,
    paddingHorizontal: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconBox: {
    width: 72,
    height: 72,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  title: {
    fontSize: 16,
    textAlign: 'center',
    marginBottom: 6,
  },
  desc: {
    fontSize: 13,
    textAlign: 'center',
    lineHeight: 18,
    maxWidth: 280,
  },
  btn: {
    minHeight: 44,
    marginTop: 20,
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 10,
    justifyContent: 'center',
  },
  btnText: {
    color: '#ffffff',
    fontSize: 14,
  }
});
