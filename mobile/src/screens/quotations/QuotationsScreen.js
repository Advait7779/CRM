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
  FileCheck,
  Plus,
  Calendar,
  X
} from 'lucide-react-native';

const STATUS_LIST = ['All', 'Draft', 'Sent', 'Accepted', 'Rejected'];

export default function QuotationsScreen() {
  const { colors } = useTheme();
  const { user } = useAuth();
  const canWrite = canWriteResource(user?.role, 'quotations');

  const [quotations, setQuotations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [search, setSearch] = useState('');
  const [selectedStatus, setSelectedStatus] = useState('All');

  // Modal
  const [modalVisible, setModalVisible] = useState(false);
  const [saving, setSaving] = useState(false);
  const [formData, setFormData] = useState({
    customer: '',
    date: new Date().toISOString().split('T')[0],
    description: '',
    qty: '1',
    rate: '',
    gst: '18',
    status: 'Draft'
  });

  const fetchQuotations = useCallback(async () => {
    try {
      const data = await apiGetAll('/quotations');
      setQuotations(Array.isArray(data) ? data : []);
    } catch (err) {
      Alert.alert('Error', err.message || 'Failed to fetch quotations');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    fetchQuotations();
  }, [fetchQuotations]);

  const onRefresh = () => {
    setRefreshing(true);
    fetchQuotations();
  };

  const openAddModal = () => {
    setFormData({
      customer: '',
      date: new Date().toISOString().split('T')[0],
      description: '',
      qty: '1',
      rate: '',
      gst: '18',
      status: 'Draft'
    });
    setModalVisible(true);
  };

  const handleSaveQuotation = async () => {
    if (!formData.customer.trim() || !formData.description.trim() || !formData.rate || Number(formData.qty) <= 0) {
      Alert.alert('Validation Error', 'Customer, item description, quantity, and rate are required.');
      return;
    }

    setSaving(true);
    try {
      await apiPost('/quotations', {
        customer: formData.customer.trim(),
        date: formData.date,
        status: formData.status,
        items: JSON.stringify([{
          desc: formData.description.trim(),
          qty: Number(formData.qty),
          rate: Number(formData.rate),
          gst: Number(formData.gst) || 0
        }])
      });
      Alert.alert('Success', 'Quotation generated');
      setModalVisible(false);
      fetchQuotations();
    } catch (err) {
      Alert.alert('Error', err.message || 'Failed to save quotation');
    } finally {
      setSaving(false);
    }
  };

  const handleSendQuotation = async (quotation) => {
    try {
      await apiPost(`/quotations/${quotation.id}/send`, {});
      Alert.alert('Sent', 'Quotation delivery was processed.');
      fetchQuotations();
    } catch (error) {
      Alert.alert('Delivery Failed', error.message || 'Unable to send quotation.');
    }
  };

  const formatItems = (value) => {
    try {
      const items = JSON.parse(value || '[]');
      return items.map(item => `${item.desc} × ${item.qty}`).join(', ');
    } catch {
      return value || '';
    }
  };

  const filtered = quotations.filter(q => {
    const matchSearch =
      (q.customer || '').toLowerCase().includes(search.toLowerCase()) ||
      (q.id || '').toLowerCase().includes(search.toLowerCase()) ||
      (q.items || '').toLowerCase().includes(search.toLowerCase());

    const matchStatus = selectedStatus === 'All' || q.status === selectedStatus;
    return matchSearch && matchStatus;
  });

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <Header
        title="Quotations"
        subtitle={`${quotations.length} total proposals`}
        rightElement={canWrite ? (
          <TouchableOpacity
            style={[styles.addBtn, { backgroundColor: colors.primary }]}
            onPress={openAddModal}
            activeOpacity={0.8}
          >
            <Plus size={16} color="#ffffff" />
            <Text style={styles.addBtnText}>Create</Text>
          </TouchableOpacity>
        ) : null}
      />

      {/* Filter Section */}
      <View style={[styles.filterSection, { backgroundColor: colors.card, borderBottomColor: colors.border }]}>
        <SearchInput
          value={search}
          onChangeText={setSearch}
          placeholder="Search quotation by #ID, client, items..."
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

      {/* Quotations List */}
      {loading ? (
        <LoadingSpinner message="Loading quotation records..." />
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
              title="No quotations found"
              description="Tap 'Create' to draft a proposal."
              icon={FileCheck}
              actionText={canWrite ? 'New Quotation' : undefined}
              onAction={canWrite ? openAddModal : undefined}
            />
          }
          renderItem={({ item }) => (
            <View style={[styles.quoteCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
              <View style={styles.cardHeader}>
                <View style={{ flex: 1 }}>
                  <Text style={[styles.quoteId, { color: colors.primary }]}>{item.id}</Text>
                  <Text style={[styles.customerName, { color: colors.text }]}>{item.customer}</Text>
                </View>
                <Badge label={item.status || 'Sent'} />
              </View>

              {item.items ? (
                <Text style={[styles.itemsText, { color: colors.textMuted }]} numberOfLines={2}>
                  {formatItems(item.items)}
                </Text>
              ) : null}

              <View style={[styles.cardFooter, { borderTopColor: colors.border }]}>
                <View style={styles.dateRow}>
                  <Calendar size={12} color={colors.textMuted} />
                  <Text style={[styles.dateText, { color: colors.textMuted }]}>{item.date}</Text>
                </View>
                <View style={styles.amountActions}>
                  {canWrite ? (
                    <TouchableOpacity style={[styles.sendBtn, { borderColor: colors.primary }]} onPress={() => handleSendQuotation(item)} accessibilityRole="button" accessibilityLabel={`Send quotation ${item.id}`}>
                      <Text style={[styles.sendBtnText, { color: colors.primary }]}>Send</Text>
                    </TouchableOpacity>
                  ) : null}
                  <Text style={[styles.amountText, { color: colors.text }]}>₹{item.amount}</Text>
                </View>
              </View>
            </View>
          )}
        />
      )}

      {/* Create Quotation Modal */}
      <AnimatedModal visible={modalVisible} onRequestClose={() => setModalVisible(false)}>
        <View style={[styles.modalContent, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <View style={[styles.modalHeader, { borderBottomColor: colors.border }]}>
            <Text style={[styles.modalTitle, { color: colors.text }]}>New Quotation</Text>
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
            <Text style={[styles.autoNumberText, { color: colors.textMuted }]}>Quotation number will be generated automatically.</Text>

            <Text style={[styles.inputLabel, { color: colors.textSecondary }]}>Customer / Prospect Name *</Text>
            <TextInput
              style={[styles.formInput, { backgroundColor: colors.inputBg, color: colors.text, borderColor: colors.border }]}
              placeholder="e.g. Kumar Graphics Xerox"
              placeholderTextColor={colors.textMuted}
              value={formData.customer}
              onChangeText={(t) => setFormData({ ...formData, customer: t })}
            />

            <Text style={[styles.inputLabel, { color: colors.textSecondary }]}>Item Description *</Text>
            <TextInput
              style={[styles.formInput, styles.textArea, { backgroundColor: colors.inputBg, color: colors.text, borderColor: colors.border }]}
              placeholder="List of products, hardware units, license duration..."
              placeholderTextColor={colors.textMuted}
              value={formData.description}
              onChangeText={(t) => setFormData({ ...formData, description: t })}
              multiline
              numberOfLines={3}
            />

            <View style={styles.lineItemRow}>
              <View style={styles.lineItemField}>
                <Text style={[styles.inputLabel, { color: colors.textSecondary }]}>Quantity *</Text>
                <TextInput style={[styles.formInput, { backgroundColor: colors.inputBg, color: colors.text, borderColor: colors.border }]} value={formData.qty} onChangeText={(t) => setFormData({ ...formData, qty: t })} keyboardType="numeric" />
              </View>
              <View style={styles.lineItemField}>
                <Text style={[styles.inputLabel, { color: colors.textSecondary }]}>Rate (₹) *</Text>
                <TextInput style={[styles.formInput, { backgroundColor: colors.inputBg, color: colors.text, borderColor: colors.border }]} value={formData.rate} onChangeText={(t) => setFormData({ ...formData, rate: t })} keyboardType="decimal-pad" />
              </View>
              <View style={styles.lineItemField}>
                <Text style={[styles.inputLabel, { color: colors.textSecondary }]}>GST %</Text>
                <TextInput style={[styles.formInput, { backgroundColor: colors.inputBg, color: colors.text, borderColor: colors.border }]} value={formData.gst} onChangeText={(t) => setFormData({ ...formData, gst: t })} keyboardType="decimal-pad" />
              </View>
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
              onPress={handleSaveQuotation}
              disabled={saving}
            >
              <Text style={{ color: '#ffffff', fontWeight: '700' }}>
                {saving ? 'Creating...' : 'Save Quotation'}
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
  autoNumberText: {
    fontSize: 12,
    marginBottom: 16,
  },
  lineItemRow: {
    flexDirection: 'row',
    gap: 8,
  },
  lineItemField: {
    flex: 1,
  },
  amountActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  sendBtn: {
    minHeight: 40,
    paddingHorizontal: 12,
    borderWidth: 1,
    borderRadius: 8,
    justifyContent: 'center',
  },
  sendBtnText: {
    fontSize: 12,
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
  quoteCard: {
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    gap: 8,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  quoteId: {
    fontSize: 12,
    fontWeight: '800',
  },
  customerName: {
    fontSize: 16,
    fontWeight: '700',
    marginTop: 2,
  },
  itemsText: {
    fontSize: 13,
    lineHeight: 18,
  },
  cardFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderTopWidth: 1,
    paddingTop: 10,
    marginTop: 4,
  },
  dateRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  dateText: {
    fontSize: 12,
  },
  amountText: {
    fontSize: 17,
    fontWeight: '800',
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
  textArea: {
    height: 70,
    textAlignVertical: 'top',
    paddingTop: 10,
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
