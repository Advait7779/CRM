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
import Header from '../../components/common/Header';
import SearchInput from '../../components/common/SearchInput';
import Badge from '../../components/common/Badge';
import EmptyState from '../../components/common/EmptyState';
import LoadingSpinner from '../../components/common/LoadingSpinner';
import AnimatedModal from '../../components/common/AnimatedModal';
import { canWriteResource } from '../../config/permissions';
import {
  Plus,
  Calendar,
  FileText,
  X
} from 'lucide-react-native';

const STATUS_LIST = ['All', 'Paid', 'Unpaid', 'Partially Paid'];
const PAYMENT_METHODS = ['UPI', 'NEFT', 'Cash', 'Card', 'Cheque'];

export default function AccountsScreen() {
  const { colors } = useTheme();
  const { user } = useAuth();
  const canWrite = canWriteResource(user?.role, 'invoices');

  const [invoices, setInvoices] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [search, setSearch] = useState('');
  const [selectedStatus] = useState('All');
  const [payments, setPayments] = useState([]);
  const [paymentInvoice, setPaymentInvoice] = useState(null);
  const [paymentAmount, setPaymentAmount] = useState('');
  const [paymentMethod, setPaymentMethod] = useState('UPI');
  const [paymentReference, setPaymentReference] = useState('');

  // Modal
  const [modalVisible, setModalVisible] = useState(false);
  const [saving, setSaving] = useState(false);
  const [formData, setFormData] = useState({
    customer: '',
    date: new Date().toISOString().split('T')[0],
    amount: '',
    gst: '18',
    status: 'Unpaid'
  });

  const fetchInvoices = useCallback(async () => {
    try {
      const [invoiceData, paymentData] = await Promise.all([
        apiGetAll('/invoices'),
        apiGetAll('/payments').catch(() => [])
      ]);
      setInvoices(Array.isArray(invoiceData) ? invoiceData : []);
      setPayments(Array.isArray(paymentData) ? paymentData : []);
    } catch (err) {
      Alert.alert('Error', err.message || 'Failed to fetch invoices');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    fetchInvoices();
  }, [fetchInvoices]);

  const onRefresh = () => {
    setRefreshing(true);
    fetchInvoices();
  };

  const openAddModal = () => {
    setFormData({
      customer: '',
      date: new Date().toISOString().split('T')[0],
      amount: '',
      gst: '18',
      status: 'Unpaid'
    });
    setModalVisible(true);
  };

  const handleSaveInvoice = async () => {
    if (!formData.customer.trim() || !formData.amount) {
      Alert.alert('Validation Error', 'Customer Name and Amount are required.');
      return;
    }

    const baseAmount = Number(formData.amount);
    const gstPct = Number(formData.gst) || 18;
    setSaving(true);
    try {
      await apiPost('/invoices', {
        customer: formData.customer.trim(),
        date: formData.date,
        amount: baseAmount,
        gst: gstPct,
        status: formData.status
      });
      Alert.alert('Success', 'Invoice generated');
      setModalVisible(false);
      fetchInvoices();
    } catch (err) {
      Alert.alert('Error', err.message || 'Failed to save invoice');
    } finally {
      setSaving(false);
    }
  };

  const paidForInvoice = (invoiceId) => payments
    .filter(payment => payment.invoiceId === invoiceId)
    .reduce((sum, payment) => sum + Number(payment.amount || 0), 0);

  const openPaymentModal = (invoice) => {
    const outstanding = Math.max(0, Number(invoice.total || invoice.amount || 0) - paidForInvoice(invoice.id));
    setPaymentInvoice(invoice);
    setPaymentAmount(outstanding.toFixed(2));
    setPaymentMethod('UPI');
    setPaymentReference('');
  };

  const handleSavePayment = async () => {
    const amount = Number(paymentAmount);
    if (!paymentInvoice || !Number.isFinite(amount) || amount <= 0) {
      Alert.alert('Validation Error', 'Enter a valid payment amount.');
      return;
    }
    setSaving(true);
    try {
      await apiPost('/payments', {
        invoiceId: paymentInvoice.id,
        amount,
        method: paymentMethod,
        reference: paymentReference.trim() || undefined,
        date: new Date().toISOString().split('T')[0]
      });
      setPaymentInvoice(null);
      Alert.alert('Success', 'Payment recorded successfully.');
      fetchInvoices();
    } catch (error) {
      Alert.alert('Payment Failed', error.message || 'Unable to record payment.');
    } finally {
      setSaving(false);
    }
  };

  const totalInvoiced = invoices.reduce((acc, i) => acc + (Number(i.total) || Number(i.amount) || 0), 0);
  const totalPaid = payments.reduce((sum, payment) => sum + Number(payment.amount || 0), 0);
  const totalPending = totalInvoiced - totalPaid;

  const filtered = invoices.filter(i => {
    const matchSearch =
      (i.customer || '').toLowerCase().includes(search.toLowerCase()) ||
      (i.id || '').toLowerCase().includes(search.toLowerCase());

    const matchStatus = selectedStatus === 'All' || i.status === selectedStatus;
    return matchSearch && matchStatus;
  });

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <Header
        title="Accounts & Billing"
        subtitle={`${invoices.length} total invoices`}
        rightElement={canWrite ? (
          <TouchableOpacity
            style={[styles.addBtn, { backgroundColor: colors.primary }]}
            onPress={openAddModal}
            activeOpacity={0.8}
          >
            <Plus size={16} color="#ffffff" />
            <Text style={styles.addBtnText}>Invoice</Text>
          </TouchableOpacity>
        ) : null}
      />

      {/* Summary Cards */}
      <View style={[styles.summarySection, { backgroundColor: colors.card, borderBottomColor: colors.border }]}>
        <View style={styles.summaryGrid}>
          <View style={[styles.summaryCard, { backgroundColor: colors.cardSecondary }]}>
            <Text style={[styles.summaryLabel, { color: colors.textMuted }]}>Total Billed</Text>
            <Text style={[styles.summaryValue, { color: colors.text }]}>₹{(totalInvoiced / 1000).toFixed(1)}K</Text>
          </View>
          <View style={[styles.summaryCard, { backgroundColor: 'rgba(16, 185, 129, 0.12)' }]}>
            <Text style={[styles.summaryLabel, { color: '#10b981' }]}>Collected</Text>
            <Text style={[styles.summaryValue, { color: '#10b981' }]}>₹{(totalPaid / 1000).toFixed(1)}K</Text>
          </View>
          <View style={[styles.summaryCard, { backgroundColor: 'rgba(239, 68, 68, 0.12)' }]}>
            <Text style={[styles.summaryLabel, { color: '#ef4444' }]}>Pending</Text>
            <Text style={[styles.summaryValue, { color: '#ef4444' }]}>₹{(totalPending / 1000).toFixed(1)}K</Text>
          </View>
        </View>

        <SearchInput
          value={search}
          onChangeText={setSearch}
          placeholder="Search invoice by #ID or customer..."
          style={{ marginTop: 12 }}
        />
      </View>

      {/* Invoices List */}
      {loading ? (
        <LoadingSpinner message="Loading financial accounts..." />
      ) : (
        <FlatList
          data={filtered}
          keyExtractor={(item) => String(item.id)}
          contentContainerStyle={styles.list}
          showsVerticalScrollIndicator={false}
          overScrollMode="never"
          scrollEventThrottle={16}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />}
          ListEmptyComponent={
            <EmptyState
              title="No invoices found"
              description="Tap 'Invoice' to issue a new bill."
              icon={FileText}
              actionText={canWrite ? 'Generate Invoice' : undefined}
              onAction={canWrite ? openAddModal : undefined}
            />
          }
          renderItem={({ item }) => (
            <View style={[styles.invoiceCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
              <View style={styles.cardHeader}>
                <View style={{ flex: 1 }}>
                  <Text style={[styles.invoiceId, { color: colors.primary }]}>{item.id}</Text>
                  <Text style={[styles.customerName, { color: colors.text }]}>{item.customer}</Text>
                </View>
                <Badge label={item.status || 'Unpaid'} />
              </View>

              <View style={styles.metaRow}>
                <View style={styles.metaItem}>
                  <Calendar size={13} color={colors.textMuted} />
                  <Text style={[styles.metaText, { color: colors.textMuted }]}>{item.date || 'Today'}</Text>
                </View>
                <Text style={[styles.amountText, { color: colors.text }]}>₹{item.total || item.amount || 0}</Text>
              </View>

              {canWrite && item.status !== 'Paid' && (
                <TouchableOpacity
                  style={[styles.paymentBtn, { borderColor: colors.primary, backgroundColor: 'rgba(99, 102, 241, 0.08)' }]}
                  onPress={() => openPaymentModal(item)}
                  accessibilityRole="button"
                  accessibilityLabel={`Record payment for ${item.id}`}
                >
                  <Text style={[styles.paymentBtnText, { color: colors.primary }]}>Record Payment</Text>
                </TouchableOpacity>
              )}
            </View>
          )}
        />
      )}

      {/* Create Invoice Modal */}
      <AnimatedModal visible={modalVisible} onRequestClose={() => setModalVisible(false)}>
        <View style={[styles.modalContent, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <View style={[styles.modalHeader, { borderBottomColor: colors.border }]}>
            <Text style={[styles.modalTitle, { color: colors.text }]}>New Invoice</Text>
            <TouchableOpacity onPress={() => setModalVisible(false)}>
              <X size={20} color={colors.textMuted} />
            </TouchableOpacity>
          </View>

          <ScrollView
            style={styles.modalForm}
            contentContainerStyle={styles.modalFormContent}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={true}
            overScrollMode="never"
          >
            <Text style={[styles.autoNumberText, { color: colors.textMuted }]}>Invoice number will be generated automatically.</Text>

            <Text style={[styles.inputLabel, { color: colors.textSecondary }]}>Customer Name *</Text>
            <TextInput
              style={[styles.formInput, { backgroundColor: colors.inputBg, color: colors.text, borderColor: colors.border }]}
              placeholder="e.g. Matoshree net cafe"
              placeholderTextColor={colors.textMuted}
              value={formData.customer}
              onChangeText={(t) => setFormData({ ...formData, customer: t })}
            />

            <Text style={[styles.inputLabel, { color: colors.textSecondary }]}>Base Amount (₹) *</Text>
            <TextInput
              style={[styles.formInput, { backgroundColor: colors.inputBg, color: colors.text, borderColor: colors.border }]}
              placeholder="10000"
              placeholderTextColor={colors.textMuted}
              value={formData.amount}
              onChangeText={(t) => setFormData({ ...formData, amount: t })}
              keyboardType="numeric"
            />

            <Text style={[styles.inputLabel, { color: colors.textSecondary }]}>GST Rate (%)</Text>
            <TextInput
              style={[styles.formInput, { backgroundColor: colors.inputBg, color: colors.text, borderColor: colors.border }]}
              placeholder="18"
              placeholderTextColor={colors.textMuted}
              value={formData.gst}
              onChangeText={(t) => setFormData({ ...formData, gst: t })}
              keyboardType="numeric"
            />

            <Text style={[styles.inputLabel, { color: colors.textSecondary }]}>Payment Status</Text>
            <View style={styles.choiceRow}>
              {STATUS_LIST.filter(s => s !== 'All').map((st, i) => (
                <TouchableOpacity
                  key={i}
                  style={[
                    styles.choiceChip,
                    {
                      backgroundColor: formData.status === st ? colors.primary : colors.cardSecondary,
                      borderColor: formData.status === st ? colors.primary : colors.border
                    }
                  ]}
                  onPress={() => setFormData({ ...formData, status: st })}
                >
                  <Text style={[styles.choiceText, { color: formData.status === st ? '#fff' : colors.text }]}>
                    {st}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
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
              onPress={handleSaveInvoice}
              disabled={saving}
            >
              <Text style={{ color: '#ffffff', fontWeight: '700' }}>
                {saving ? 'Creating...' : 'Issue Invoice'}
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </AnimatedModal>

      {/* Record Payment Modal */}
      <AnimatedModal visible={!!paymentInvoice} onRequestClose={() => setPaymentInvoice(null)}>
        <View style={[styles.modalContent, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <View style={[styles.modalHeader, { borderBottomColor: colors.border }]}>
            <Text style={[styles.modalTitle, { color: colors.text }]}>Record Payment</Text>
            <TouchableOpacity onPress={() => setPaymentInvoice(null)} accessibilityRole="button" accessibilityLabel="Close payment form">
              <X size={20} color={colors.textMuted} />
            </TouchableOpacity>
          </View>
          <ScrollView
            style={styles.modalForm}
            contentContainerStyle={styles.modalFormContent}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={true}
            overScrollMode="never"
          >
            <Text style={[styles.inputLabel, { color: colors.textSecondary }]}>Amount (₹) *</Text>
            <TextInput style={[styles.formInput, { backgroundColor: colors.inputBg, color: colors.text, borderColor: colors.border }]} value={paymentAmount} onChangeText={setPaymentAmount} keyboardType="decimal-pad" accessibilityLabel="Payment amount" />
            <Text style={[styles.inputLabel, { color: colors.textSecondary }]}>Method</Text>
            <View style={styles.choiceRow}>{PAYMENT_METHODS.map(method => <TouchableOpacity key={method} style={[styles.choiceChip, { backgroundColor: paymentMethod === method ? colors.primary : colors.cardSecondary, borderColor: paymentMethod === method ? colors.primary : colors.border }]} onPress={() => setPaymentMethod(method)}><Text style={[styles.choiceText, { color: paymentMethod === method ? '#fff' : colors.text }]}>{method}</Text></TouchableOpacity>)}</View>
            <Text style={[styles.inputLabel, { color: colors.textSecondary }]}>Reference</Text>
            <TextInput style={[styles.formInput, { backgroundColor: colors.inputBg, color: colors.text, borderColor: colors.border }]} value={paymentReference} onChangeText={setPaymentReference} placeholder="Transaction or receipt number" placeholderTextColor={colors.textMuted} />
          </ScrollView>
          <View style={[styles.modalFooter, { borderTopColor: colors.border }]}>
            <TouchableOpacity style={[styles.cancelBtn, { backgroundColor: colors.cardSecondary }]} onPress={() => setPaymentInvoice(null)}><Text style={{ color: colors.text, fontWeight: '600' }}>Cancel</Text></TouchableOpacity>
            <TouchableOpacity style={[styles.saveBtn, { backgroundColor: colors.primary }]} onPress={handleSavePayment} disabled={saving}><Text style={{ color: '#fff', fontWeight: '700' }}>{saving ? 'Saving...' : 'Save Payment'}</Text></TouchableOpacity>
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
  autoNumberText: {
    fontSize: 12,
    marginBottom: 14,
  },
  paymentBtn: {
    minHeight: 40,
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 10,
    justifyContent: 'center',
    marginTop: 8,
  },
  paymentBtnText: {
    fontSize: 11,
    fontWeight: '700',
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
  summarySection: {
    padding: 14,
    borderBottomWidth: 1,
  },
  summaryGrid: {
    flexDirection: 'row',
    gap: 8,
  },
  summaryCard: {
    flex: 1,
    padding: 12,
    borderRadius: 12,
  },
  summaryLabel: {
    fontSize: 11,
    fontWeight: '600',
  },
  summaryValue: {
    fontSize: 16,
    fontWeight: '800',
    marginTop: 4,
  },
  list: {
    padding: 14,
    paddingBottom: 40,
    gap: 12,
  },
  invoiceCard: {
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    gap: 10,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  invoiceId: {
    fontSize: 12,
    fontWeight: '800',
  },
  customerName: {
    fontSize: 16,
    fontWeight: '700',
    marginTop: 2,
  },
  cardFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderTopWidth: 1,
    paddingTop: 10,
  },
  dateRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  dateText: {
    fontSize: 12,
  },
  totalAmount: {
    fontSize: 17,
    fontWeight: '800',
  },
  gstText: {
    fontSize: 11,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.6)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    borderRadius: 20,
    maxHeight: '100%',
    flexShrink: 1,
    borderWidth: 1,
    overflow: 'hidden',
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
