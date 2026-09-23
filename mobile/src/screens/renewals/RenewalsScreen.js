import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  RefreshControl,
  StyleSheet,
  TextInput,
  ScrollView,
  Alert
} from 'react-native';
import { useTheme } from '../../context/ThemeContext';
import { useAuth } from '../../context/AuthContext';
import { apiGetAll, apiPost } from '../../config/api';
import { canWriteResource } from '../../config/permissions';
import Header from '../../components/common/Header';
import SearchInput from '../../components/common/SearchInput';
import Badge from '../../components/common/Badge';
import EmptyState from '../../components/common/EmptyState';
import LoadingSpinner from '../../components/common/LoadingSpinner';
import AnimatedModal from '../../components/common/AnimatedModal';
import {
  RefreshCw,
  Plus,
  MessageCircle,
  Calendar,
  CheckCircle2,
  X
} from 'lucide-react-native';

const RENEWAL_TYPES = ['GPS Software Subscription', 'CCTV Maintenance AMC', 'Domain & Hosting', 'SSL Security', 'Annual Support'];
const STATUS_LIST = ['All', 'Active', 'Due Soon', 'Overdue', 'Paid'];

export default function RenewalsScreen() {
  const { colors } = useTheme();
  const { user } = useAuth();
  const canWrite = canWriteResource(user?.role, 'renewals');

  const [renewals, setRenewals] = useState([]);
  const [customers, setCustomers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [search, setSearch] = useState('');
  const [selectedStatus, setSelectedStatus] = useState('All');

  // Add / Edit Modal
  const [modalVisible, setModalVisible] = useState(false);
  const [saving, setSaving] = useState(false);
  const [formData, setFormData] = useState({
    customer: '',
    type: 'GPS Software Subscription',
    amount: '',
    nextDue: '',
    status: 'Active'
  });

  const fetchRenewals = useCallback(async () => {
    try {
      const [data, customerRows] = await Promise.all([apiGetAll('/renewals'), apiGetAll('/customers')]);
      setRenewals(Array.isArray(data) ? data : []);
      setCustomers(Array.isArray(customerRows) ? customerRows : []);
    } catch (err) {
      Alert.alert('Error', err.message || 'Failed to fetch renewals');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    fetchRenewals();
  }, [fetchRenewals]);

  const onRefresh = () => {
    setRefreshing(true);
    fetchRenewals();
  };

  const openAddModal = () => {
    setFormData({
      customer: '',
      type: 'GPS Software Subscription',
      amount: '1200',
      nextDue: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
      status: 'Active'
    });
    setModalVisible(true);
  };

  const handleSaveRenewal = async () => {
    if (!formData.customer.trim() || !formData.amount || !formData.nextDue) {
      Alert.alert('Validation Error', 'Customer, Amount, and Next Due Date are required.');
      return;
    }

    setSaving(true);
    try {
      await apiPost('/renewals', {
        ...formData,
        amount: Number(formData.amount)
      });
      Alert.alert('Success', 'Renewal added');
      setModalVisible(false);
      fetchRenewals();
    } catch (err) {
      Alert.alert('Error', err.message || 'Failed to save renewal');
    } finally {
      setSaving(false);
    }
  };

  const handleSendReminder = async (item) => {
    try {
      const result = await apiPost(`/renewals/${item.id}/remind`, {});
      Alert.alert('Reminder Processed', result?.message || 'Customer reminder processed.');
    } catch (err) {
      Alert.alert('Error', err.message || 'Failed to send reminder');
    }
  };

  const handleRenew = async (item) => {
    try {
      await apiPost(`/renewals/${item.id}/renew`, { date: new Date().toISOString().slice(0, 10), gst: 18 });
      Alert.alert('Renewed', 'The service was renewed for one year and an invoice was generated.');
      fetchRenewals();
    } catch (err) {
      Alert.alert('Error', err.message || 'Failed to renew service');
    }
  };

  const filteredRenewals = renewals.filter(r => {
    const matchSearch =
      (r.customer || '').toLowerCase().includes(search.toLowerCase()) ||
      (r.type || '').toLowerCase().includes(search.toLowerCase());

    const matchStatus = selectedStatus === 'All' || r.status === selectedStatus;
    return matchSearch && matchStatus;
  });

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <Header
        title="Renewals"
        subtitle={`${renewals.length} active service contracts`}
        rightElement={canWrite ? (
          <TouchableOpacity
            style={[styles.addBtn, { backgroundColor: colors.primary }]}
            onPress={openAddModal}
            activeOpacity={0.8}
          >
            <Plus size={16} color="#ffffff" />
            <Text style={styles.addBtnText}>Add</Text>
          </TouchableOpacity>
        ) : null}
      />

      {/* Filter Section */}
      <View style={[styles.filterSection, { backgroundColor: colors.card, borderBottomColor: colors.border }]}>
        <SearchInput
          value={search}
          onChangeText={setSearch}
          placeholder="Search renewal by customer or service..."
        />

        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.filterScroll}>
          {STATUS_LIST.map((st, i) => {
            const isSelected = selectedStatus === st;
            return (
              <TouchableOpacity
                key={i}
                style={[
                  styles.filterChip,
                  {
                    backgroundColor: isSelected ? colors.primary : colors.cardSecondary,
                    borderColor: isSelected ? colors.primary : colors.border
                  }
                ]}
                onPress={() => setSelectedStatus(st)}
              >
                <Text style={[styles.filterChipText, { color: isSelected ? '#ffffff' : colors.textMuted }]}>
                  {st}
                </Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>
      </View>

      {/* Renewals List */}
      {loading ? (
        <LoadingSpinner message="Loading renewal schedules..." />
      ) : (
        <FlatList
          data={filteredRenewals}
          keyExtractor={(item) => String(item.id)}
          contentContainerStyle={styles.list}
          showsVerticalScrollIndicator={false}
          overScrollMode="never"
          scrollEventThrottle={16}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />}
          ListEmptyComponent={
            <EmptyState
              title="No renewals found"
              description="Tap 'Add' to record customer renewal dates."
              icon={RefreshCw}
              actionText={canWrite ? 'Add Renewal' : undefined}
              onAction={canWrite ? openAddModal : undefined}
            />
          }
          renderItem={({ item }) => (
            <View style={[styles.renewalCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
              <View style={styles.cardHeader}>
                <View style={{ flex: 1, marginRight: 8 }}>
                  <Text style={[styles.customerName, { color: colors.text }]}>{item.customer}</Text>
                  <Text style={[styles.serviceType, { color: colors.textMuted }]}>{item.type}</Text>
                </View>
                <Badge label={item.status || 'Active'} />
              </View>

              <View style={styles.cardBody}>
                <View style={styles.infoCol}>
                  <Text style={[styles.infoLabel, { color: colors.textMuted }]}>Amount</Text>
                  <Text style={[styles.amountValue, { color: colors.primary }]}>₹{item.amount}</Text>
                </View>

                <View style={styles.infoCol}>
                  <Text style={[styles.infoLabel, { color: colors.textMuted }]}>Next Due Date</Text>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 2 }}>
                    <Calendar size={12} color="#8b5cf6" />
                    <Text style={[styles.dateValue, { color: colors.text }]}>{item.nextDue}</Text>
                  </View>
                </View>
              </View>

              {/* Actions Footer */}
              {canWrite ? <View style={[styles.cardFooter, { borderTopColor: colors.border }]}>
                <TouchableOpacity
                  style={[styles.remindBtn, { backgroundColor: 'rgba(37, 211, 102, 0.12)' }]}
                  onPress={() => handleSendReminder(item)}
                  activeOpacity={0.7}
                >
                  <MessageCircle size={14} color="#25D366" />
                  <Text style={{ fontSize: 12, fontWeight: '700', color: '#25D366' }}>WhatsApp Reminder</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[styles.paidBtn, { backgroundColor: 'rgba(16, 185, 129, 0.15)' }]}
                  onPress={() => handleRenew(item)}
                  accessibilityRole="button"
                  accessibilityLabel={`Renew ${item.type} for ${item.customer}`}
                >
                  <CheckCircle2 size={14} color="#10b981" />
                  <Text style={{ fontSize: 12, fontWeight: '700', color: '#10b981' }}>Renew & Invoice</Text>
                </TouchableOpacity>
              </View> : null}
            </View>
          )}
        />
      )}

      {/* Add Renewal Modal */}
      <AnimatedModal visible={modalVisible} onRequestClose={() => setModalVisible(false)}>
        <View style={[styles.modalContent, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <View style={[styles.modalHeader, { borderBottomColor: colors.border }]}>
            <Text style={[styles.modalTitle, { color: colors.text }]}>New Service Renewal</Text>
            <TouchableOpacity onPress={() => setModalVisible(false)}>
              <X size={20} color={colors.textMuted} />
            </TouchableOpacity>
          </View>

          <ScrollView
            style={styles.modalForm}
            contentContainerStyle={styles.modalFormContent}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={true}
          >
            <Text style={[styles.inputLabel, { color: colors.textSecondary }]}>Customer *</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.selectorRow}>
              {customers.map((customer) => {
                const label = customer.company || customer.name;
                const selected = label === formData.customer;
                return (
                  <TouchableOpacity key={customer.id} style={[styles.selectorChip, { backgroundColor: selected ? colors.primary : colors.cardSecondary, borderColor: selected ? colors.primary : colors.border }]} onPress={() => setFormData({ ...formData, customer: label || '' })} accessibilityRole="radio" accessibilityState={{ checked: selected }}>
                    <Text style={{ color: selected ? '#fff' : colors.text, fontWeight: '600' }}>{label}</Text>
                  </TouchableOpacity>
                );
              })}
            </ScrollView>

            <Text style={[styles.inputLabel, { color: colors.textSecondary }]}>Service Type</Text>
            <View style={styles.choiceRow}>
              {RENEWAL_TYPES.map((t, i) => (
                <TouchableOpacity
                  key={i}
                  style={[
                    styles.choiceChip,
                    {
                      backgroundColor: formData.type === t ? colors.primary : colors.cardSecondary,
                      borderColor: formData.type === t ? colors.primary : colors.border
                    }
                  ]}
                  onPress={() => setFormData({ ...formData, type: t })}
                >
                  <Text style={[styles.choiceText, { color: formData.type === t ? '#fff' : colors.text }]}>
                    {t}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            <Text style={[styles.inputLabel, { color: colors.textSecondary }]}>Renewal Amount (₹) *</Text>
            <TextInput
              style={[styles.formInput, { backgroundColor: colors.inputBg, color: colors.text, borderColor: colors.border }]}
              placeholder="1500"
              placeholderTextColor={colors.textMuted}
              value={formData.amount}
              onChangeText={(t) => setFormData({ ...formData, amount: t })}
              keyboardType="numeric"
            />

            <Text style={[styles.inputLabel, { color: colors.textSecondary }]}>Next Due Date (YYYY-MM-DD) *</Text>
            <TextInput
              style={[styles.formInput, { backgroundColor: colors.inputBg, color: colors.text, borderColor: colors.border }]}
              placeholder="2027-02-15"
              placeholderTextColor={colors.textMuted}
              value={formData.nextDue}
              onChangeText={(t) => setFormData({ ...formData, nextDue: t })}
            />
          </ScrollView>

          <View style={[styles.modalFooter, { borderTopColor: colors.border }]}>
            <TouchableOpacity
              style={[styles.cancelBtn, { backgroundColor: colors.cardSecondary }]}
              onPress={() => setModalVisible(false)}
            >
              <Text style={{ color: colors.text, fontWeight: '600' }}>Cancel</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.saveBtn, { backgroundColor: colors.primary }]}
              onPress={handleSaveRenewal}
              disabled={saving}
            >
              <Text style={{ color: '#ffffff', fontWeight: '700' }}>
                {saving ? 'Saving...' : 'Add Renewal'}
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </AnimatedModal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  addBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
  },
  addBtnText: {
    color: '#ffffff',
    fontSize: 13,
    fontWeight: '700',
  },
  filterSection: {
    padding: 14,
    borderBottomWidth: 1,
    gap: 10,
  },
  filterScroll: {
    flexDirection: 'row',
  },
  filterChip: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    borderWidth: 1,
    marginRight: 8,
  },
  filterChipText: {
    fontSize: 12,
    fontWeight: '600',
  },
  list: {
    padding: 14,
    paddingBottom: 40,
    gap: 12,
  },
  renewalCard: {
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 12,
  },
  customerName: {
    fontSize: 16,
    fontWeight: '700',
  },
  serviceType: {
    fontSize: 12,
    marginTop: 2,
  },
  cardBody: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  infoCol: {
    flex: 1,
  },
  infoLabel: {
    fontSize: 11,
    fontWeight: '500',
  },
  amountValue: {
    fontSize: 18,
    fontWeight: '800',
    marginTop: 2,
  },
  dateValue: {
    fontSize: 13,
    fontWeight: '600',
  },
  cardFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderTopWidth: 1,
    paddingTop: 10,
  },
  remindBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
  },
  paidBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.6)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    borderRadius: 20,
    maxHeight: '100%',
    borderWidth: 1,
    overflow: 'hidden',
    flexShrink: 1,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 18,
    borderBottomWidth: 1,
    flexShrink: 0,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '700',
  },
  modalForm: {
    flexShrink: 1,
    flexGrow: 1,
  },
  modalFormContent: {
    padding: 18,
    paddingBottom: 40,
  },
  inputLabel: {
    fontSize: 12,
    fontWeight: '600',
    marginBottom: 6,
    marginTop: 10,
  },
  formInput: {
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 12,
    height: 44,
    fontSize: 14,
  },
  selectorRow: { marginVertical: 4 },
  selectorChip: { minHeight: 44, justifyContent: 'center', paddingHorizontal: 14, borderRadius: 10, borderWidth: 1, marginRight: 8 },
  choiceRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginVertical: 4,
  },
  choiceChip: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
    borderWidth: 1,
  },
  choiceText: {
    fontSize: 12,
    fontWeight: '600',
  },
  modalFooter: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 12,
    padding: 16,
    borderTopWidth: 1,
    flexShrink: 0,
  },
  cancelBtn: {
    paddingHorizontal: 18,
    paddingVertical: 10,
    borderRadius: 8,
  },
  saveBtn: {
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 8,
  }
});
