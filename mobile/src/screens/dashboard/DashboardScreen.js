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
import { apiGet, apiGetAll } from '../../config/api';
import Header from '../../components/common/Header';
import Badge from '../../components/common/Badge';
import LoadingSpinner from '../../components/common/LoadingSpinner';
import { canAccessScreen, isFieldInstaller } from '../../config/permissions';
import {
  Users,
  UserCheck,
  CreditCard,
  CheckSquare,
  RefreshCw,
  FileText,
  Phone,
  ArrowRight,
  Bell
} from 'lucide-react-native';

const isCompleted = status => ['completed', 'complete'].includes(String(status || '').toLowerCase());
const isPendingTask = status => ['pending', 'ongoing'].includes(String(status || '').toLowerCase());

export default function DashboardScreen({ navigation }) {
  const { user } = useAuth();
  const installer = isFieldInstaller(user?.role);
  const { colors } = useTheme();
  const { unreadCount } = useNotifications();

  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');

  const fetchStats = useCallback(async () => {
    try {
      setError('');
      if (installer) {
        const [assignedInstallations, assignedTasks] = await Promise.all([
          apiGetAll('/installations'),
          apiGetAll('/tasks')
        ]);
        setStats({
          assignedInstallations: Array.isArray(assignedInstallations) ? assignedInstallations : [],
          assignedTasks: Array.isArray(assignedTasks) ? assignedTasks : []
        });
      } else {
        setStats(await apiGet('/dashboard/stats'));
      }
    } catch (requestError) {
      setError(requestError.message || 'Dashboard data could not be loaded.');
      setStats(installer ? { assignedInstallations: [], assignedTasks: [] } : {
        totalLeads: 0,
        totalCustomers: 0,
        pendingTasks: 0,
        pendingInvoices: 0,
        renewalsDueSoon: 0,
        pendingRevenue: 0,
        recentLeads: []
      });
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [installer]);

  useEffect(() => {
    fetchStats();
  }, [fetchStats]);

  const onRefresh = () => {
    setRefreshing(true);
    fetchStats();
  };

  const installerJobs = stats?.assignedInstallations || [];
  const installerTasks = stats?.assignedTasks || [];
  const statCards = installer ? [
    { label: 'Assigned Installations', value: installerJobs.length.toLocaleString(), change: 'My Jobs', up: true, icon: UserCheck, color: '#6366f1', bg: 'rgba(99,102,241,0.12)', screen: 'Installations' },
    { label: 'Pending Installations', value: installerJobs.filter(job => !isCompleted(job.status)).length.toLocaleString(), change: 'To Do', up: false, icon: RefreshCw, color: '#f59e0b', bg: 'rgba(245,158,11,0.12)', screen: 'Installations' },
    { label: 'Completed Installations', value: installerJobs.filter(job => isCompleted(job.status)).length.toLocaleString(), change: 'Done', up: true, icon: CheckSquare, color: '#10b981', bg: 'rgba(16,185,129,0.12)', screen: 'Installations' },
    { label: 'Pending Tasks', value: installerTasks.filter(task => isPendingTask(task.status)).length.toLocaleString(), change: 'My Tasks', up: false, icon: CheckSquare, color: '#ef4444', bg: 'rgba(239,68,68,0.12)', screen: 'Tasks', target: 'TasksTab' },
  ] : stats ? [
    { label: 'Total Leads', value: stats.totalLeads?.toLocaleString() || '0', change: 'All time', up: true, icon: Users, color: '#6366f1', bg: 'rgba(99,102,241,0.12)', screen: 'Leads' },
    { label: 'Total Customers', value: stats.totalCustomers?.toLocaleString() || '0', change: 'Active', up: true, icon: UserCheck, color: '#10b981', bg: 'rgba(16,185,129,0.12)', screen: 'Customers', target: 'CustomersTab' },
    { label: 'Pending Revenue', value: `₹${((stats.pendingRevenue || 0) / 1000).toFixed(0)}K`, change: 'Unpaid', up: false, icon: CreditCard, color: '#f59e0b', bg: 'rgba(245,158,11,0.12)', screen: 'Accounts' },
    { label: 'Pending Tasks', value: stats.pendingTasks?.toLocaleString() || '0', change: 'Action Needed', up: false, icon: CheckSquare, color: '#ef4444', bg: 'rgba(239,68,68,0.12)', screen: 'Tasks', target: 'TasksTab' },
    { label: 'Renewals (7d)', value: stats.renewalsDueSoon?.toLocaleString() || '0', change: 'Due Soon', up: false, icon: RefreshCw, color: '#8b5cf6', bg: 'rgba(139,92,246,0.12)', screen: 'Renewals' },
    { label: 'Pending Invoices', value: stats.pendingInvoices?.toLocaleString() || '0', change: 'Unpaid', up: false, icon: FileText, color: '#3b82f6', bg: 'rgba(59,130,246,0.12)', screen: 'Accounts' },
  ].filter(card => canAccessScreen(user?.role, card.screen)) : [];

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
                    onPress={() => navigation.navigate(s.target || s.screen)}
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

            {/* Recent assigned work for installers; leads for other roles */}
            {installer ? (
              <View style={[styles.sectionCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
                <View style={styles.sectionHeader}>
                  <Text style={[styles.sectionTitle, { color: colors.text }]}>My Installations</Text>
                  <TouchableOpacity onPress={() => navigation.navigate('Installations')} style={styles.viewAllBtn}>
                    <Text style={[styles.viewAllText, { color: colors.primary }]}>View All</Text>
                    <ArrowRight size={14} color={colors.primary} />
                  </TouchableOpacity>
                </View>
                {installerJobs.length === 0 ? (
                  <Text style={[styles.emptyText, { color: colors.textMuted }]}>No installations assigned yet.</Text>
                ) : installerJobs.slice(0, 5).map((job, index) => (
                  <View key={job.id || index} style={[styles.leadItem, { borderBottomColor: colors.border }]}>
                    <View style={styles.leadDetails}>
                      <Text style={[styles.leadName, { color: colors.text }]}>{job.customer || 'Installation'}</Text>
                      <Text style={[styles.leadService, { color: colors.textMuted }]}>
                        {job.type || 'Installation'}{job.vehicle || job.site ? ` • ${job.vehicle || job.site}` : ''}
                      </Text>
                    </View>
                    <Badge label={job.status || 'Pending'} size="small" />
                  </View>
                ))}
              </View>
            ) : (
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
            )}
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
  viewAllBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  viewAllText: {
    fontSize: 13,
    fontWeight: '600',
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
