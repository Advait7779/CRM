import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { useTheme } from '../../context/ThemeContext';
import AnimatedModal from './AnimatedModal';
import { AlertTriangle } from 'lucide-react-native';

/**
 * ConfirmDeleteModal
 * Themed confirmation dialog box for deletion processes across the mobile app.
 * Matches the project theme: rounded card, soft red warning badge, bold title,
 * descriptive body copy, Cancel button, and prominent red destructive action button.
 */
export default function ConfirmDeleteModal({
  visible = false,
  onClose,
  onConfirm,
  title = 'Delete Item',
  subtitle,
  message,
  confirmText = 'Delete',
  loading = false,
}) {
  const { colors } = useTheme();

  return (
    <AnimatedModal visible={visible} onRequestClose={onClose}>
      <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
        {/* Header with red warning badge */}
        <View style={styles.header}>
          <View style={styles.iconContainer}>
            <AlertTriangle size={22} color="#ef4444" />
          </View>
          <View style={styles.headerText}>
            <Text style={[styles.title, { color: colors.text }]}>{title}</Text>
            {subtitle ? (
              <Text style={[styles.subtitle, { color: colors.textMuted }]}>{subtitle}</Text>
            ) : null}
          </View>
        </View>

        {/* Message Body */}
        <Text style={[styles.message, { color: colors.textSecondary }]}>
          {message}
        </Text>

        {/* Action Buttons */}
        <View style={styles.actions}>
          <TouchableOpacity
            style={[styles.cancelBtn, { backgroundColor: colors.cardSecondary, borderColor: colors.border }]}
            onPress={onClose}
            disabled={loading}
            activeOpacity={0.7}
            accessibilityRole="button"
            accessibilityLabel="Cancel deletion"
          >
            <Text style={[styles.cancelText, { color: colors.text }]}>Cancel</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.deleteBtn, { opacity: loading ? 0.6 : 1 }]}
            onPress={onConfirm}
            disabled={loading}
            activeOpacity={0.8}
            accessibilityRole="button"
            accessibilityLabel={confirmText}
          >
            <Text style={styles.deleteText}>
              {loading ? 'Deleting...' : confirmText}
            </Text>
          </TouchableOpacity>
        </View>
      </View>
    </AnimatedModal>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: 20,
    padding: 20,
    borderWidth: 1,
    flexShrink: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 12,
  },
  iconContainer: {
    width: 44,
    height: 44,
    borderRadius: 12,
    backgroundColor: 'rgba(239, 68, 68, 0.12)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerText: {
    flex: 1,
  },
  title: {
    fontSize: 18,
    fontWeight: '700',
    letterSpacing: -0.2,
  },
  subtitle: {
    fontSize: 13,
    marginTop: 2,
    fontWeight: '500',
  },
  message: {
    fontSize: 14,
    lineHeight: 20,
    marginBottom: 20,
  },
  actions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 10,
  },
  cancelBtn: {
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 10,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cancelText: {
    fontSize: 14,
    fontWeight: '600',
  },
  deleteBtn: {
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 10,
    backgroundColor: '#ef4444',
    alignItems: 'center',
    justifyContent: 'center',
  },
  deleteText: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: '700',
  },
});
