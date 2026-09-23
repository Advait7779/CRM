import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  RefreshControl,
  StyleSheet,
  Linking,
  Alert
} from 'react-native';
import { useTheme } from '../../context/ThemeContext';
import { useAuth } from '../../context/AuthContext';
import { apiGet, apiDelete } from '../../config/api';
import Header from '../../components/common/Header';
import Badge from '../../components/common/Badge';
import LoadingSpinner from '../../components/common/LoadingSpinner';
import ConfirmDeleteModal from '../../components/common/ConfirmDeleteModal';
import { canWriteResource } from '../../config/permissions';
import {
  Building2,
  Phone,
  MessageCircle,
  Mail,
  MapPin,
  Calendar,
  Trash2,
  CheckCircle2,
  ShieldCheck
} from 'lucide-react-native';

export default function CustomerDetailScreen({ route, navigation }) {
  const { customerId } = route.params || {};
  const { colors } = useTheme();
  const { user } = useAuth();
  const canWrite = canWriteResource(user?.role, 'customers');

  const [customer, setCustomer] = useState(null);
  const [installations, setInstallations] = useState([]);
  const [renewals, setRenewals] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [activeTab, setActiveTab] = useState('overview'); // 'overview' | 'installations' | 'renewals'
  const [confirmDeleteVisible, setConfirmDeleteVisible] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  const fetchCustomerData = useCallback(async () => {
    if (!customerId) return;
    try {
      const overview = await apiGet(`/customers/${customerId}/overview`);
      setCustomer(overview.customer || null);
      setInstallations(Array.isArray(overview.installations) ? overview.installations : []);
      setRenewals(Array.isArray(overview.renewals) ? overview.renewals : []);
    } catch (err) {
      Alert.alert('Error', err.message || 'Failed to fetch customer details');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [customerId]);

  useEffect(() => {
    fetchCustomerData();
  }, [fetchCustomerData]);

  const onRefresh = () => {
    setRefreshing(true);
    fetchCustomerData();
  };

  const handleDelete = () => {
    setConfirmDeleteVisible(true);
  };

  if (loading) {
    return (
      <View style={[styles.container, { backgroundColor: colors.background }]}>
        <Header title="Customer Details" showBack onBack={() => navigation.goBack()} />
        <LoadingSpinner message="Loading client profile..." />
      </View>
    );
  }

  if (!customer) {
    return (
      <View style={[styles.container, { backgroundColor: colors.background }]}>
        <Header title="Customer Details" showBack onBack={() => navigation.goBack()} />
        <View style={styles.errorContainer}>
          <Text style={[styles.errorText, { color: colors.textMuted }]}>Customer not found</Text>
        </View>
      </View>
    );
  }

  let rawServices = [];
  try {
    rawServices = Array.isArray(customer.services) ? customer.services : JSON.parse(customer.services || '[]');
  } catch {
    rawServices = String(customer.services || '').split(',').map(item => item.trim()).filter(Boolean);
  }

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <Header
        title={customer.name}
        subtitle="Customer Account Details"
        showBack
        onBack={() => navigation.goBack()}
        rightElement={
          canWrite ? (
            <TouchableOpacity
              style={[styles.deleteHeaderBtn, { backgroundColor: 'rgba(239, 68, 68, 0.15)' }]}
              onPress={handleDelete}
              accessibilityRole="button"
              accessibilityLabel={`Delete ${customer.name}`}
            >
              <Trash2 size={16} color="#ef4444" />
            </TouchableOpacity>
          ) : null
        }
      />

      <ScrollView
        contentContainerStyle={styles.scroll}
        showsVerticalScrollIndicator={false}
        overScrollMode="never"
        scrollEventThrottle={16}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />}
      >
        {/* Profile Card */}
        <View style={[styles.profileCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <View style={styles.profileHeader}>
            <View style={[styles.avatarBox, { backgroundColor: 'rgba(16, 185, 129, 0.15)' }]}>
              <Building2 size={28} color={colors.primary} />
            </View>
            <View style={styles.profileHeaderInfo}>
              <Text style={[styles.profileName, { color: colors.text }]}>{customer.name}</Text>
              {customer.contact ? (
                <Text style={[styles.profileContact, { color: colors.textMuted }]}>
                  Contact: {customer.contact}
                </Text>
              ) : null}
              <View style={{ marginTop: 6 }}>
                <Badge label={customer.status || 'Active'} />
              </View>
            </View>
          </View>

          {/* Quick Action Buttons */}
          <View style={[styles.actionRow, { borderTopColor: colors.border }]}>
            {customer.phone ? (
              <TouchableOpacity
                style={[styles.actionBtn, { backgroundColor: colors.cardSecondary }]}
                onPress={() => Linking.openURL(`tel:${customer.phone}`)}
              >
                <Phone size={16} color="#10b981" />
                <Text style={[styles.actionBtnText, { color: colors.text }]}>Call</Text>
              </TouchableOpacity>
            ) : null}

            {customer.phone ? (
              <TouchableOpacity
                style={[styles.actionBtn, { backgroundColor: colors.cardSecondary }]}
                onPress={() => Linking.openURL(`https://wa.me/${customer.phone.replace(/[^0-9]/g, '')}`)}
              >
                <MessageCircle size={16} color="#25D366" />
                <Text style={[styles.actionBtnText, { color: colors.text }]}>WhatsApp</Text>
              </TouchableOpacity>
            ) : null}

            {customer.email ? (
              <TouchableOpacity
                style={[styles.actionBtn, { backgroundColor: colors.cardSecondary }]}
                onPress={() => Linking.openURL(`mailto:${customer.email}`)}
              >
                <Mail size={16} color="#3b82f6" />
                <Text style={[styles.actionBtnText, { color: colors.text }]}>Email</Text>
              </TouchableOpacity>
            ) : null}
          </View>
        </View>

        {/* Tab Navigation */}
        <View style={[styles.tabBar, { backgroundColor: colors.card, borderColor: colors.border }]}>
          {[
            { id: 'overview', label: 'Overview' },
            { id: 'installations', label: `Installations (${installations.length})` },
            { id: 'renewals', label: `Renewals (${renewals.length})` },
          ].map(tab => {
            const active = activeTab === tab.id;
            return (
              <TouchableOpacity
                key={tab.id}
                style={[
                  styles.tabItem,
                  active && { borderBottomColor: colors.primary, borderBottomWidth: 2 }
                ]}
                onPress={() => setActiveTab(tab.id)}
              >
                <Text style={[styles.tabText, { color: active ? colors.primary : colors.textMuted }]}>
                  {tab.label}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>

        {/* Tab 1: Overview */}
        {activeTab === 'overview' && (
          <View style={styles.tabContent}>
            {/* Account Details Box */}
            <View style={[styles.detailBox, { backgroundColor: colors.card, borderColor: colors.border }]}>
              <Text style={[styles.boxTitle, { color: colors.text }]}>Account Information</Text>

              <View style={styles.detailRow}>
                <Phone size={16} color={colors.textMuted} />
                <View style={styles.detailTextContainer}>
                  <Text style={[styles.detailLabel, { color: colors.textMuted }]}>Phone</Text>
                  <Text style={[styles.detailValue, { color: colors.text }]}>{customer.phone || 'N/A'}</Text>
                </View>
              </View>

              <View style={styles.detailRow}>
                <Mail size={16} color={colors.textMuted} />
                <View style={styles.detailTextContainer}>
                  <Text style={[styles.detailLabel, { color: colors.textMuted }]}>Email</Text>
                  <Text style={[styles.detailValue, { color: colors.text }]}>{customer.email || 'N/A'}</Text>
                </View>
              </View>

              <View style={styles.detailRow}>
                <ShieldCheck size={16} color={colors.textMuted} />
                <View style={styles.detailTextContainer}>
                  <Text style={[styles.detailLabel, { color: colors.textMuted }]}>GST Number</Text>
                  <Text style={[styles.detailValue, { color: colors.text }]}>{customer.gst || 'Not registered'}</Text>
                </View>
              </View>

              <View style={styles.detailRow}>
                <MapPin size={16} color={colors.textMuted} />
                <View style={styles.detailTextContainer}>
                  <Text style={[styles.detailLabel, { color: colors.textMuted }]}>Address</Text>
                  <Text style={[styles.detailValue, { color: colors.text }]}>{customer.address || 'N/A'}</Text>
                </View>
              </View>

              <View style={styles.detailRow}>
                <Calendar size={16} color={colors.textMuted} />
                <View style={styles.detailTextContainer}>
                  <Text style={[styles.detailLabel, { color: colors.textMuted }]}>Next Renewal Date</Text>
                  <Text style={[styles.detailValue, { color: colors.primary }]}>{customer.renewalDate || 'N/A'}</Text>
                </View>
              </View>
            </View>

            {/* Active Services Box */}
            <View style={[styles.detailBox, { backgroundColor: colors.card, borderColor: colors.border }]}>
              <Text style={[styles.boxTitle, { color: colors.text }]}>Active Services & Subscriptions</Text>
              <View style={styles.servicesGrid}>
                {rawServices.map((svc, i) => (
                  <View key={i} style={[styles.servicePill, { backgroundColor: colors.cardSecondary }]}>
                    <CheckCircle2 size={14} color="#10b981" />
                    <Text style={[styles.servicePillText, { color: colors.text }]}>{svc}</Text>
                  </View>
                ))}
              </View>
            </View>
          </View>
        )}
        {/* Tab 2: Installations */}
        {activeTab === 'installations' && (
          <View style={styles.tabContent}>
            {installations.length === 0 ? (
              <View style={[styles.emptyBox, { backgroundColor: colors.card, borderColor: colors.border }]}>
                <Text style={[styles.emptyBoxText, { color: colors.textMuted }]}>
                  No active installations recorded for this customer.
                </Text>
              </View>
            ) : (
              installations.map((inst, i) => (
                <View key={inst.id || i} style={[styles.itemCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
                  <View style={styles.itemHeader}>
                    <Text style={[styles.itemTitle, { color: colors.text }]}>
                      {inst.type?.toUpperCase()} Installation
                    </Text>
                    <Badge label={inst.status || 'Pending'} size="small" />
                  </View>
                  {inst.vehicle ? <Text style={[styles.itemSub, { color: colors.textMuted }]}>Vehicle: {inst.vehicle}</Text> : null}
                  {inst.imei ? <Text style={[styles.itemSub, { color: colors.textMuted }]}>IMEI: {inst.imei}</Text> : null}
                  {inst.installer ? <Text style={[styles.itemSub, { color: colors.textMuted }]}>Tech: {inst.installer}</Text> : null}
                  {inst.date ? <Text style={[styles.itemSub, { color: colors.textMuted }]}>Date: {inst.date}</Text> : null}
                </View>
              ))
            )}
          </View>
        )}

        {/* Tab 3: Renewals */}
        {activeTab === 'renewals' && (
          <View style={styles.tabContent}>
            {renewals.length === 0 ? (
              <View style={[styles.emptyBox, { backgroundColor: colors.card, borderColor: colors.border }]}>
                <Text style={[styles.emptyBoxText, { color: colors.textMuted }]}>
                  No renewal records found for this client.
                </Text>
              </View>
            ) : (
              renewals.map((ren, i) => (
                <View key={ren.id || i} style={[styles.itemCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
                  <View style={styles.itemHeader}>
                    <Text style={[styles.itemTitle, { color: colors.text }]}>{ren.type || 'Annual Renewal'}</Text>
                    <Badge label={ren.status || 'Active'} size="small" />
                  </View>
                  <Text style={[styles.itemAmount, { color: colors.primary }]}>₹{ren.amount || 0}</Text>
                  <Text style={[styles.itemSub, { color: colors.textMuted }]}>Next Due: {ren.nextDue}</Text>
                </View>
              ))
            )}
          </View>
        )}
      </ScrollView>

      <ConfirmDeleteModal
        visible={confirmDeleteVisible}
        onClose={() => setConfirmDeleteVisible(false)}
        title="Delete Customer"
        subtitle={customer?.name}
        message={`Are you sure you want to delete ${customer?.name}? This action cannot be undone and will permanently remove all associated customer records.`}
        confirmText="Delete Customer"
        loading={isDeleting}
        onConfirm={async () => {
          setIsDeleting(true);
          try {
            await apiDelete(`/customers/${customerId}`);
            setConfirmDeleteVisible(false);
            Alert.alert('Success', 'Customer deleted');
            navigation.goBack();
          } catch (err) {
            Alert.alert('Error', err.message || 'Failed to delete customer');
          } finally {
            setIsDeleting(false);
          }
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  scroll: {
    padding: 16,
    paddingBottom: 40,
  },
  deleteHeaderBtn: {
    padding: 8,
    borderRadius: 8,
  },
  profileCard: {
    borderRadius: 18,
    padding: 18,
    borderWidth: 1,
    marginBottom: 16,
  },
  profileHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  avatarBox: {
    width: 60,
    height: 60,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 14,
  },
  profileHeaderInfo: {
    flex: 1,
  },
  profileName: {
    fontSize: 18,
    fontWeight: '700',
  },
  profileContact: {
    fontSize: 13,
    marginTop: 2,
  },
  actionRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    borderTopWidth: 1,
    paddingTop: 12,
  },
  actionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 8,
  },
  actionBtnText: {
    fontSize: 12,
    fontWeight: '600',
  },
  tabBar: {
    flexDirection: 'row',
    borderRadius: 12,
    borderWidth: 1,
    marginBottom: 16,
    overflow: 'hidden',
  },
  tabItem: {
    flex: 1,
    paddingVertical: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  tabText: {
    fontSize: 12,
    fontWeight: '700',
  },
  tabContent: {
    gap: 14,
  },
  detailBox: {
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    gap: 12,
  },
  boxTitle: {
    fontSize: 15,
    fontWeight: '700',
    marginBottom: 4,
  },
  detailRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  detailTextContainer: {
    flex: 1,
  },
  detailLabel: {
    fontSize: 11,
    fontWeight: '500',
  },
  detailValue: {
    fontSize: 14,
    fontWeight: '600',
    marginTop: 1,
  },
  servicesGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 6,
  },
  servicePill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
  },
  servicePillText: {
    fontSize: 12,
    fontWeight: '600',
  },
  itemCard: {
    borderRadius: 14,
    padding: 14,
    borderWidth: 1,
    gap: 4,
  },
  itemHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  itemTitle: {
    fontSize: 14,
    fontWeight: '700',
  },
  itemAmount: {
    fontSize: 16,
    fontWeight: '800',
    marginVertical: 2,
  },
  itemSub: {
    fontSize: 12,
  },
  emptyBox: {
    borderRadius: 14,
    padding: 24,
    borderWidth: 1,
    alignItems: 'center',
  },
  emptyBoxText: {
    fontSize: 13,
    textAlign: 'center',
  },
  errorContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 20,
  },
  errorText: {
    fontSize: 15,
    fontWeight: '600',
  }
});
