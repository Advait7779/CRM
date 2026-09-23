import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  ScrollView,
  RefreshControl,
  StyleSheet,
  TouchableOpacity,
  Linking
} from 'react-native';
import { useAuth } from '../../context/AuthContext';
import { useTheme } from '../../context/ThemeContext';
import { useNotifications } from '../../context/NotificationContext';
import { apiGet } from '../../config/api';
import Header from '../../components/common/Header';
import Badge from '../../components/common/Badge';
import LoadingSpinner from '../../components/common/LoadingSpinner';
import { canAccessScreen } from '../../config/permissions';
import {
  Users,
  UserCheck,
  CreditCard,
  Headphones,
  RefreshCw,
  FileText,
  Phone,
  ArrowRight,
  Bell
} from 'lucide-react-native';

const SOURCE_COLORS = {
  Website: '#6366f1',
  Facebook: '#3b82f6',
  WhatsApp: '#10b981',
  Reference: '#f59e0b',
  Call: '#8b5cf6',
};

export default function DashboardScreen({ navigation }) {
  const { user } = useAuth();
  const { colors } = useTheme();
  const { unreadCount } = useNotifications();

  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');

  const fetchStats = useCallback(async () => {
    try {
      setError('');
      const data = await apiGet('/dashboard/stats');
      setStats(data);
    } catch (requestError) {
      setError(requestError.message || 'Dashboard data could not be loaded.');
      setStats({
        totalLeads: 0,
        totalCustomers: 0,
        openTickets: 0,
        pendingInvoices: 0,
        renewalsDueSoon: 0,
        pendingRevenue: 0,
        recentLeads: [],
        leadsBySource: []
      });
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    fetchStats();
  }, [fetchStats]);

  const onRefresh = () => {
    setRefreshing(true);
    fetchStats();
  };

  const statCards = stats ? [
    { label: 'Total Leads', value: stats.totalLeads?.toLocaleString() || '0', change: 'All time', up: true, icon: Users, color: '#6366f1', bg: 'rgba(99,102,241,0.12)', screen: 'Leads' },
    { label: 'Total Customers', value: stats.totalCustomers?.toLocaleString() || '0', change: 'Active', up: true, icon: UserCheck, color: '#10b981', bg: 'rgba(16,185,129,0.12)', screen: 'Customers' },
    { label: 'Pending Revenue', value: `₹${((stats.pendingRevenue || 0) / 1000).toFixed(0)}K`, change: 'Unpaid', up: false, icon: CreditCard, color: '#f59e0b', bg: 'rgba(245,158,11,0.12)', screen: 'Accounts' },
    { label: 'Open Tickets', value: stats.openTickets?.toLocaleString() || '0', change: 'Active', up: false, icon: Headphones, color: '#ef4444', bg: 'rgba(239,68,68,0.12)', screen: 'Tickets' },
    { label: 'Renewals (7d)', value: stats.renewalsDueSoon?.toLocaleString() || '0', change: 'Due Soon', up: false, icon: RefreshCw, color: '#8b5cf6', bg: 'rgba(139,92,246,0.12)', screen: 'Renewals' },
    { label: 'Pending Invoices', value: stats.pendingInvoices?.toLocaleString() || '0', change: 'Unpaid', up: false, icon: FileText, color: '#3b82f6', bg: 'rgba(59,130,246,0.12)', screen: 'Accounts' },
  ].filter(card => canAccessScreen(user?.role, card.screen)) : [];

  const totalSourceCount = (stats?.leadsBySource || []).reduce((sum, s) => sum + parseInt(s.count || 0), 0) || 1;

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <Header
        title="Dashboard"
        subtitle={`Welcome, ${user?.name?.split(' ')[0] || 'Admin'}`}
        rightElement={
          <TouchableOpacity
            onPress={() => navigation.navigate('Notifications')}
            style={[styles.bellBtn, { backgroundColor: colors.cardSecondary }]}
            activeOpacity={0.7}
            accessibilityRole="button"
            accessibilityLabel={`Notifications, ${unreadCount} unread`}
          >
            <Bell size={18} color={colors.text} />
            {unreadCount > 0 && (
              <View style={[styles.bellBadge, { backgroundColor: colors.danger }]}>
                <Text style={styles.bellBadgeText}>
                  {unreadCount > 99 ? '99+' : unreadCount}
                </Text>
              </View>
            )}
          </TouchableOpacity>
        }
      />

      <ScrollView
        contentContainerStyle={styles.scroll}
        showsVerticalScrollIndicator={false}
        overScrollMode="never"
        scrollEventThrottle={16}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />}
      >
        {error ? (
          <View style={[styles.errorBanner, { backgroundColor: colors.card, borderColor: colors.danger }]} accessibilityLiveRegion="assertive">
            <Text style={[styles.errorBannerText, { color: colors.danger }]}>{error}</Text>
          </View>
        ) : null}
        {loading ? (
          <LoadingSpinner message="Loading dashboard insights..." />
        ) : (
          <>
            {/* 2-Column Stats Grid */}
            <View style={styles.statsGrid}>
              {statCards.map((s, idx) => {
                const Icon = s.icon;
                return (
                  <TouchableOpacity
                    key={idx}
                    style={[styles.statCard, { backgroundColor: colors.card, borderColor: colors.border }]}
                    onPress={() => s.screen && navigation.navigate(s.screen)}
                    activeOpacity={0.7}
                  >
                    <View style={styles.statTopRow}>
                      <View style={[styles.statIconBox, { backgroundColor: s.bg }]}>
                        <Icon size={20} color={s.color} />
                      </View>
                      <View style={[styles.changeChip, { backgroundColor: s.up ? 'rgba(16,185,129,0.1)' : 'rgba(239,68,68,0.1)' }]}>
                        <Text style={{ fontSize: 10, fontWeight: '700', color: s.up ? '#10b981' : '#ef4444' }}>
                          {s.change}
                        </Text>
                      </View>
                    </View>
                    <Text style={[styles.statValue, { color: colors.text }]}>{s.value}</Text>
                    <Text style={[styles.statLabel, { color: colors.textMuted }]} numberOfLines={1}>
                      {s.label}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>

            {/* Leads By Source Breakdown */}
            <View style={[styles.sectionCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
              <View style={styles.sectionHeader}>
                <Text style={[styles.sectionTitle, { color: colors.text }]}>Leads by Source</Text>
                <Text style={[styles.sectionCount, { color: colors.textMuted }]}>
                  {stats?.leadsBySource?.length || 0} channels
                </Text>
              </View>

              <View style={styles.sourceList}>
                {(stats?.leadsBySource || []).map((src, i) => {
                  const color = SOURCE_COLORS[src.source] || '#6366f1';
                  const pct = Math.round((parseInt(src.count) / totalSourceCount) * 100);
                  return (
                    <View key={i} style={styles.sourceRow}>
                      <View style={styles.sourceInfo}>
                        <View style={[styles.sourceDot, { backgroundColor: color }]} />
                        <Text style={[styles.sourceName, { color: colors.text }]}>{src.source}</Text>
                      </View>
                      <View style={styles.progressContainer}>
                        <View style={[styles.progressBar, { backgroundColor: colors.cardSecondary }]}>
                          <View style={[styles.progressFill, { width: `${pct}%`, backgroundColor: color }]} />
                        </View>
                        <Text style={[styles.sourceCount, { color: colors.textMuted }]}>
                          {src.count} ({pct}%)
                        </Text>
                      </View>
                    </View>
                  );
                })}
              </View>
            </View>

            {/* Recent Leads */}
            <View style={[styles.sectionCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
              <View style={styles.sectionHeader}>
                <Text style={[styles.sectionTitle, { color: colors.text }]}>Recent Leads</Text>
                <TouchableOpacity
                  onPress={() => navigation.navigate('Leads')}
                  style={styles.viewAllBtn}
                >
                  <Text style={[styles.viewAllText, { color: colors.primary }]}>View All</Text>
                  <ArrowRight size={14} color={colors.primary} />
                </TouchableOpacity>
              </View>

              {(stats?.recentLeads || []).length === 0 ? (
                <Text style={[styles.emptyText, { color: colors.textMuted }]}>No recent leads found.</Text>
              ) : (
                (stats?.recentLeads || []).slice(0, 5).map((lead, i) => (
                  <View
                    key={lead.id || i}
                    style={[styles.leadItem, { borderBottomColor: colors.border }, i === 4 && { borderBottomWidth: 0 }]}
                  >
                    <View style={styles.leadDetails}>
                      <Text style={[styles.leadName, { color: colors.text }]}>{lead.name}</Text>
                      <Text style={[styles.leadService, { color: colors.textMuted }]}>
                        {lead.service} • {lead.company || lead.source || 'General'}
                      </Text>
                    </View>

                    <View style={styles.leadRight}>
                      <Badge label={lead.status || 'New'} size="small" />
                      {lead.phone ? (
                        <TouchableOpacity
                          style={[styles.callBtn, { backgroundColor: 'rgba(16, 185, 129, 0.15)' }]}
                          onPress={() => Linking.openURL(`tel:${lead.phone}`)}
                        >
                          <Phone size={14} color="#10b981" />
                        </TouchableOpacity>
                      ) : null}
                    </View>
                  </View>
                ))
              )}
            </View>
          </>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  errorBanner: {
    borderWidth: 1,
    borderRadius: 12,
    padding: 12,
    marginBottom: 14,
  },
  errorBannerText: {
    fontSize: 13,
    fontWeight: '600',
  },
  scroll: {
    padding: 16,
    paddingBottom: 80,
  },
  bellBtn: {
    width: 36,
    height: 36,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
  },
  bellBadge: {
    position: 'absolute',
    top: -3,
    right: -3,
    minWidth: 16,
    height: 16,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 3,
  },
  bellBadgeText: {
    color: '#ffffff',
    fontSize: 9,
    fontWeight: '800',
  },
  statsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
    marginBottom: 16,
  },
  statCard: {
    width: '48%',
    borderRadius: 16,
    padding: 14,
    borderWidth: 1,
  },
  statTopRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  statIconBox: {
    width: 36,
    height: 36,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  changeChip: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
  },
  statValue: {
    fontSize: 20,
    fontWeight: '800',
    letterSpacing: -0.5,
    marginBottom: 2,
  },
  statLabel: {
    fontSize: 12,
    fontWeight: '500',
  },
  sectionCard: {
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    marginBottom: 16,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 14,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '700',
  },
  sectionCount: {
    fontSize: 12,
    fontWeight: '500',
  },
  viewAllBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  viewAllText: {
    fontSize: 13,
    fontWeight: '600',
  },
  sourceList: {
    gap: 12,
  },
  sourceRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  sourceInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    width: 110,
  },
  sourceDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  sourceName: {
    fontSize: 13,
    fontWeight: '600',
  },
  progressContainer: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  progressBar: {
    flex: 1,
    height: 6,
    borderRadius: 3,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    borderRadius: 3,
  },
  sourceCount: {
    fontSize: 11,
    fontWeight: '600',
    minWidth: 55,
    textAlign: 'right',
  },
  leadItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
  },
  leadDetails: {
    flex: 1,
    marginRight: 10,
  },
  leadName: {
    fontSize: 14,
    fontWeight: '600',
  },
  leadService: {
    fontSize: 12,
    marginTop: 2,
  },
  leadRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  callBtn: {
    width: 32,
    height: 32,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyText: {
    fontSize: 13,
    textAlign: 'center',
    paddingVertical: 16,
  }
});
