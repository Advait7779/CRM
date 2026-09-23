import React from 'react';
import { View, Text, StyleSheet } from 'react-native';

const BADGE_COLORS = {
  // Statuses
  'New': { bg: 'rgba(56, 189, 248, 0.15)', text: '#38bdf8' },
  'Contacted': { bg: 'rgba(192, 132, 252, 0.15)', text: '#c084fc' },
  'Demo Given': { bg: 'rgba(245, 158, 11, 0.15)', text: '#f59e0b' },
  'Quotation Sent': { bg: 'rgba(251, 146, 60, 0.15)', text: '#fb923c' },
  'Won': { bg: 'rgba(16, 185, 129, 0.15)', text: '#10b981' },
  'Lost': { bg: 'rgba(239, 68, 68, 0.15)', text: '#ef4444' },
  'Negotiation': { bg: 'rgba(249, 115, 22, 0.15)', text: '#f97316' },
  
  // Task / Ticket status
  'Pending': { bg: 'rgba(245, 158, 11, 0.15)', text: '#f59e0b' },
  'In Progress': { bg: 'rgba(59, 130, 246, 0.15)', text: '#3b82f6' },
  'Completed': { bg: 'rgba(16, 185, 129, 0.15)', text: '#10b981' },
  'Resolved': { bg: 'rgba(16, 185, 129, 0.15)', text: '#10b981' },
  'Open': { bg: 'rgba(239, 68, 68, 0.15)', text: '#ef4444' },
  'Closed': { bg: 'rgba(148, 163, 184, 0.15)', text: '#94a3b8' },

  // Priorities
  'High': { bg: 'rgba(239, 68, 68, 0.15)', text: '#ef4444' },
  'Medium': { bg: 'rgba(245, 158, 11, 0.15)', text: '#f59e0b' },
  'Low': { bg: 'rgba(16, 185, 129, 0.15)', text: '#10b981' },
  'Critical': { bg: 'rgba(220, 38, 38, 0.2)', text: '#dc2626' },

  // Renewals / Payments
  'Active': { bg: 'rgba(16, 185, 129, 0.15)', text: '#10b981' },
  'Due Soon': { bg: 'rgba(245, 158, 11, 0.15)', text: '#f59e0b' },
  'Overdue': { bg: 'rgba(239, 68, 68, 0.15)', text: '#ef4444' },
  'Paid': { bg: 'rgba(16, 185, 129, 0.15)', text: '#10b981' },
  'Unpaid': { bg: 'rgba(239, 68, 68, 0.15)', text: '#ef4444' },
  'Partial': { bg: 'rgba(245, 158, 11, 0.15)', text: '#f59e0b' },

  // Stock
  'In Stock': { bg: 'rgba(16, 185, 129, 0.15)', text: '#10b981' },
  'Low Stock': { bg: 'rgba(245, 158, 11, 0.15)', text: '#f59e0b' },
  'Out of Stock': { bg: 'rgba(239, 68, 68, 0.15)', text: '#ef4444' }
};

export default function Badge({ label, color, bgColor, size = 'medium' }) {
  const preset = BADGE_COLORS[label] || { bg: 'rgba(148, 163, 184, 0.15)', text: '#94a3b8' };
  const finalBg = bgColor || (color ? `${color}20` : preset.bg);
  const finalText = color || preset.text;

  const isSmall = size === 'small';

  return (
    <View style={[styles.badge, { backgroundColor: finalBg }, isSmall && styles.badgeSmall]}>
      <Text style={[styles.text, { color: finalText }, isSmall && styles.textSmall]}>
        {label}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
    alignSelf: 'flex-start',
  },
  badgeSmall: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
  },
  text: {
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 0.2,
  },
  textSmall: {
    fontSize: 10,
    fontWeight: '600',
  }
});
