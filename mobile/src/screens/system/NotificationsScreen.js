import React from 'react';
import { View, Text, FlatList, TouchableOpacity, RefreshControl, StyleSheet } from 'react-native';
import { Bell, CheckCheck } from 'lucide-react-native';
import { useTheme } from '../../context/ThemeContext';
import { useNotifications } from '../../context/NotificationContext';
import Header from '../../components/common/Header';
import EmptyState from '../../components/common/EmptyState';

const EMOJI_MAP = {
  task: '📋', ticket: '🎫', lead: '🎯', payment: '💰', 
  renewal: '🔄', renewal_reminder: '⏰', invoice: '📄', leave: '🏖️', chat: '💬',
  customer: '👤', installation: '🔧', employee: '👔', inventory: '📦', system: '🔔'
};

const LINK_SCREENS = {
  '/accounts': 'Accounts',
  '/renewals': 'Renewals',
  '/tickets': 'Tickets',
  '/installations': 'Installations',
  '/leads': 'Leads',
  '/inventory': 'Inventory',
  '/employees': 'Employees',
  '/my-work': 'MyWork',
  '/hrms': 'Employees',
  '/users': 'Users'
};

function formatRelativeTime(dateStr) {
  if (!dateStr) return '';
  const now = Date.now();
  const then = new Date(dateStr).getTime();
  const diffSec = Math.floor((now - then) / 1000);
  if (diffSec < 60) return 'Just now';
  if (diffSec < 3600) return `${Math.floor(diffSec / 60)}m ago`;
  if (diffSec < 86400) return `${Math.floor(diffSec / 3600)}h ago`;
  if (diffSec < 604800) return `${Math.floor(diffSec / 86400)}d ago`;
  return new Date(dateStr).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });
}

export default function NotificationsScreen({ navigation }) {
  const { colors, fonts } = useTheme();
  const { notifications, unreadCount, markRead, markAllRead, refreshNotifications } = useNotifications();
  const [refreshing, setRefreshing] = React.useState(false);

  const onRefresh = async () => {
    setRefreshing(true);
    await refreshNotifications();
    setRefreshing(false);
  };

  const openNotification = async (item) => {
    const itemId = item._id || item.id;
    if (!item.read) {
      // Calls /notifications/${item.id}/read via NotificationContext
      await markRead(itemId);
    }
    if (item.link === '/tasks') navigation.navigate('MainTabs', { screen: 'TasksTab' });
    else if (item.link === '/customers') navigation.navigate('MainTabs', { screen: 'CustomersTab' });
    else if (item.link === '/chat') navigation.navigate('MainTabs', { screen: 'ChatTab' });
    else {
      const screen = LINK_SCREENS[item.link];
      if (screen) navigation.navigate(screen);
    }
  };

  const rightAction = unreadCount > 0 ? (
    <TouchableOpacity
      onPress={markAllRead}
      style={[styles.markAllBtn, { backgroundColor: colors.cardSecondary }]}
      activeOpacity={0.7}
      accessibilityRole="button"
      accessibilityLabel="Mark all as read"
    >
      <CheckCheck size={16} color={colors.primary} />
      <Text style={[styles.markAllText, { color: colors.primary, fontFamily: fonts.medium }]}>Read All</Text>
    </TouchableOpacity>
  ) : null;

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <Header
        title="Notifications"
        subtitle={unreadCount > 0 ? `${unreadCount} unread` : 'All caught up'}
        showBack
        onBack={() => navigation.goBack()}
        rightElement={rightAction}
      />
      <FlatList
        data={notifications}
        keyExtractor={(item) => String(item._id || item.id)}
        contentContainerStyle={styles.list}
        showsVerticalScrollIndicator={false}
        overScrollMode="never"
        scrollEventThrottle={16}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={colors.primary}
            colors={[colors.primary]}
          />
        }
        ListEmptyComponent={
          <EmptyState
            icon={Bell}
            title="You're all caught up"
            description="New notifications and alerts will appear here."
          />
        }
        renderItem={({ item }) => {
          const emoji = EMOJI_MAP[item.type] || EMOJI_MAP.system;
          return (
            <TouchableOpacity
              style={[
                styles.card,
                {
                  backgroundColor: colors.card,
                  borderColor: item.read ? colors.border : colors.primary,
                  borderLeftColor: item.read ? colors.border : colors.primary,
                  borderLeftWidth: item.read ? 1 : 4,
                }
              ]}
              onPress={() => openNotification(item)}
              activeOpacity={0.8}
            >
              <View style={[styles.iconContainer, { backgroundColor: colors.cardSecondary }]}>
                <Text style={styles.emoji}>{emoji}</Text>
              </View>
              <View style={styles.cardContent}>
                <View style={styles.titleRow}>
                  <Text
                    style={[
                      styles.title,
                      {
                        color: colors.text,
                        fontFamily: item.read ? fonts.medium : fonts.bold,
                      }
                    ]}
                    numberOfLines={1}
                  >
                    {item.title}
                  </Text>
                  {!item.read && (
                    <View style={[styles.unreadBadge, { backgroundColor: colors.primary }]} />
                  )}
                </View>
                <Text
                  style={[styles.message, { color: colors.textMuted, fontFamily: fonts.body }]}
                  numberOfLines={2}
                >
                  {item.message}
                </Text>
                <Text style={[styles.date, { color: colors.textMuted, fontFamily: fonts.body }]}>
                  {formatRelativeTime(item.createdAt)}
                </Text>
              </View>
            </TouchableOpacity>
          );
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  list: { padding: 16, paddingBottom: 40, gap: 10, flexGrow: 1 },
  card: {
    borderRadius: 14,
    borderWidth: 1,
    padding: 14,
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
  },
  iconContainer: {
    width: 40,
    height: 40,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emoji: { fontSize: 20 },
  cardContent: { flex: 1 },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  title: { fontSize: 14, flex: 1, marginRight: 8 },
  unreadBadge: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  message: { fontSize: 13, lineHeight: 18 },
  date: { fontSize: 11, marginTop: 6 },
  markAllBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 20,
  },
  markAllText: {
    fontSize: 12,
    fontWeight: '600',
  }
});
