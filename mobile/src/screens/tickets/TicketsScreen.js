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
import { apiGetAll, apiPost, apiPut } from '../../config/api';
import { canWriteResource } from '../../config/permissions';
import Header from '../../components/common/Header';
import SearchInput from '../../components/common/SearchInput';
import Badge from '../../components/common/Badge';
import EmptyState from '../../components/common/EmptyState';
import LoadingSpinner from '../../components/common/LoadingSpinner';
import AnimatedModal from '../../components/common/AnimatedModal';
import {
  Headphones,
  Plus,
  X
} from 'lucide-react-native';

const STATUS_LIST = ['All', 'Open', 'In Progress', 'Resolved', 'Closed'];
const PRIORITY_LIST = ['Critical', 'High', 'Medium', 'Low'];
const SERVICE_LIST = ['GPS Tracking', 'CCTV Security', 'Web Development', 'Digital Marketing', 'General Support'];

export default function TicketsScreen() {
  const { colors } = useTheme();
  const { user } = useAuth();
  const canWrite = canWriteResource(user?.role, 'tickets');

  const [tickets, setTickets] = useState([]);
  const [customers, setCustomers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [search, setSearch] = useState('');
  const [selectedStatus, setSelectedStatus] = useState('All');

  // Add / Resolve Modal
  const [modalVisible, setModalVisible] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [saving, setSaving] = useState(false);
  const [formData, setFormData] = useState({
    customer: '',
    subject: '',
    description: '',
    service: 'GPS Tracking',
    priority: 'Medium',
    status: 'Open',
    resolution: ''
  });

  const fetchTickets = useCallback(async () => {
    try {
      const [data, customerRows] = await Promise.all([apiGetAll('/tickets'), apiGetAll('/customers')]);
      setTickets(Array.isArray(data) ? data : []);
      setCustomers(Array.isArray(customerRows) ? customerRows : []);
    } catch (err) {
      Alert.alert('Error', err.message || 'Failed to fetch tickets');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    fetchTickets();
  }, [fetchTickets]);

  const onRefresh = () => {
    setRefreshing(true);
    fetchTickets();
  };

  const openAddModal = () => {
    setEditingId(null);
    setFormData({
      customer: '',
      subject: '',
      description: '',
      service: 'GPS Tracking',
      priority: 'Medium',
      status: 'Open',
      resolution: ''
    });
    setModalVisible(true);
  };

  const openEditModal = (t) => {
    setEditingId(t.id);
    setFormData({
      customer: t.customer || '',
      subject: t.subject || '',
      description: t.description || '',
      service: t.service || 'GPS Tracking',
      priority: t.priority || 'Medium',
      status: t.status || 'Open',
      resolution: t.resolution || ''
    });
    setModalVisible(true);
  };

  const handleSaveTicket = async () => {
    if (!formData.customer.trim() || !formData.subject.trim()) {
      Alert.alert('Validation Error', 'Customer Name and Ticket Subject are required.');
      return;
    }

    setSaving(true);
    try {
      if (editingId) {
        await apiPut(`/tickets/${editingId}`, formData);
        Alert.alert('Success', 'Ticket updated');
      } else {
        await apiPost('/tickets', formData);
        Alert.alert('Success', 'Ticket created');
      }
      setModalVisible(false);
      fetchTickets();
    } catch (err) {
      Alert.alert('Error', err.message || 'Failed to save ticket');
    } finally {
      setSaving(false);
    }
  };

  const filteredTickets = tickets.filter(t => {
    const matchSearch =
      (t.customer || '').toLowerCase().includes(search.toLowerCase()) ||
      (t.subject || '').toLowerCase().includes(search.toLowerCase()) ||
      (t.description || '').toLowerCase().includes(search.toLowerCase());

    const matchStatus = selectedStatus === 'All' || t.status === selectedStatus;
    return matchSearch && matchStatus;
  });

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <Header
        title="Support Tickets"
        subtitle={`${tickets.length} total tickets`}
        rightElement={canWrite ? (
          <TouchableOpacity
            style={[styles.addBtn, { backgroundColor: colors.primary }]}
            onPress={openAddModal}
            activeOpacity={0.8}
          >
            <Plus size={16} color="#ffffff" />
            <Text style={styles.addBtnText}>Ticket</Text>
          </TouchableOpacity>
        ) : null}
      />

      {/* Filter Section */}
      <View style={[styles.filterSection, { backgroundColor: colors.card, borderBottomColor: colors.border }]}>
        <SearchInput
          value={search}
          onChangeText={setSearch}
          placeholder="Search ticket by subject, client..."
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

      {/* Ticket List */}
      {loading ? (
        <LoadingSpinner message="Loading support tickets..." />
      ) : (
        <FlatList
          data={filteredTickets}
          keyExtractor={(item) => String(item.id)}
          contentContainerStyle={styles.list}
          showsVerticalScrollIndicator={false}
          overScrollMode="never"
          scrollEventThrottle={16}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />}
          ListEmptyComponent={
            <EmptyState
              title="No tickets found"
              description="Tap 'Ticket' to raise a new support request."
              icon={Headphones}
              actionText={canWrite ? 'Raise Ticket' : undefined}
              onAction={canWrite ? openAddModal : undefined}
            />
          }
          renderItem={({ item }) => (
            <TouchableOpacity
              style={[styles.ticketCard, { backgroundColor: colors.card, borderColor: colors.border }]}
              onPress={canWrite ? () => openEditModal(item) : undefined}
              activeOpacity={canWrite ? 0.7 : 1}
              accessibilityRole={canWrite ? 'button' : undefined}
              accessibilityLabel={canWrite ? `Edit ticket ${item.subject}` : undefined}
            >
              <View style={styles.cardHeader}>
                <View style={{ flex: 1, marginRight: 8 }}>
                  <Text style={[styles.subjectText, { color: colors.text }]}>{item.subject}</Text>
                  <Text style={[styles.customerText, { color: colors.textMuted }]}>{item.customer}</Text>
                </View>
                <Badge label={item.status || 'Open'} />
              </View>

              {item.description ? (
                <Text style={[styles.descText, { color: colors.textMuted }]} numberOfLines={2}>
                  {item.description}
                </Text>
              ) : null}

              <View style={styles.cardFooter}>
                <Badge label={item.priority || 'Medium'} size="small" />
                <View style={[styles.servicePill, { backgroundColor: 'rgba(99, 102, 241, 0.12)' }]}>
                  <Text style={styles.serviceText}>{item.service}</Text>
                </View>
              </View>

              {item.resolution ? (
                <View style={[styles.resolutionBox, { backgroundColor: colors.cardSecondary }]}>
                  <Text style={[styles.resolutionTitle, { color: '#10b981' }]}>Resolution:</Text>
                  <Text style={[styles.resolutionText, { color: colors.text }]}>{item.resolution}</Text>
                </View>
              ) : null}
            </TouchableOpacity>
          )}
        />
      )}

      {/* Add / Edit Ticket Modal */}
      <AnimatedModal visible={modalVisible} onRequestClose={() => setModalVisible(false)}>
        <View style={[styles.modalContent, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <View style={[styles.modalHeader, { borderBottomColor: colors.border }]}>
            <Text style={[styles.modalTitle, { color: colors.text }]}>
              {editingId ? 'Update Ticket' : 'Raise Support Ticket'}
            </Text>
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

            <Text style={[styles.inputLabel, { color: colors.textSecondary }]}>Issue Subject *</Text>
            <TextInput
              style={[styles.formInput, { backgroundColor: colors.inputBg, color: colors.text, borderColor: colors.border }]}
              placeholder="e.g. GPS Device Offline in Vehicle MH12-AB-1234"
              placeholderTextColor={colors.textMuted}
              value={formData.subject}
              onChangeText={(t) => setFormData({ ...formData, subject: t })}
            />

            <Text style={[styles.inputLabel, { color: colors.textSecondary }]}>Service Category</Text>
            <View style={styles.choiceRow}>
              {SERVICE_LIST.map((svc, i) => (
                <TouchableOpacity
                  key={i}
                  style={[
                    styles.choiceChip,
                    {
                      backgroundColor: formData.service === svc ? colors.primary : colors.cardSecondary,
                      borderColor: formData.service === svc ? colors.primary : colors.border
                    }
                  ]}
                  onPress={() => setFormData({ ...formData, service: svc })}
                >
                  <Text style={[styles.choiceText, { color: formData.service === svc ? '#fff' : colors.text }]}>
                    {svc}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            <Text style={[styles.inputLabel, { color: colors.textSecondary }]}>Priority</Text>
            <View style={styles.choiceRow}>
              {PRIORITY_LIST.map((p, i) => (
                <TouchableOpacity
                  key={i}
                  style={[
                    styles.choiceChip,
                    {
                      backgroundColor: formData.priority === p ? colors.primary : colors.cardSecondary,
                      borderColor: formData.priority === p ? colors.primary : colors.border
                    }
                  ]}
                  onPress={() => setFormData({ ...formData, priority: p })}
                >
                  <Text style={[styles.choiceText, { color: formData.priority === p ? '#fff' : colors.text }]}>
                    {p}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            <Text style={[styles.inputLabel, { color: colors.textSecondary }]}>Status</Text>
            <View style={styles.choiceRow}>
              {STATUS_LIST.filter(s => s !== 'All').map((s, i) => (
                <TouchableOpacity
                  key={i}
                  style={[
                    styles.choiceChip,
                    {
                      backgroundColor: formData.status === s ? colors.primary : colors.cardSecondary,
                      borderColor: formData.status === s ? colors.primary : colors.border
                    }
                  ]}
                  onPress={() => setFormData({ ...formData, status: s })}
                >
                  <Text style={[styles.choiceText, { color: formData.status === s ? '#fff' : colors.text }]}>
                    {s}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            <Text style={[styles.inputLabel, { color: colors.textSecondary }]}>Issue Description</Text>
            <TextInput
              style={[styles.formInput, styles.textArea, { backgroundColor: colors.inputBg, color: colors.text, borderColor: colors.border }]}
              placeholder="Detailed description of client issue..."
              placeholderTextColor={colors.textMuted}
              value={formData.description}
              onChangeText={(t) => setFormData({ ...formData, description: t })}
              multiline
              numberOfLines={3}
            />

            {editingId ? (
              <>
                <Text style={[styles.inputLabel, { color: colors.textSecondary }]}>Resolution & Fix Notes</Text>
                <TextInput
                  style={[styles.formInput, styles.textArea, { backgroundColor: colors.inputBg, color: colors.text, borderColor: colors.border }]}
                  placeholder="Steps taken to resolve this ticket..."
                  placeholderTextColor={colors.textMuted}
                  value={formData.resolution}
                  onChangeText={(t) => setFormData({ ...formData, resolution: t })}
                  multiline
                  numberOfLines={3}
                />
              </>
            ) : null}
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
              onPress={handleSaveTicket}
              disabled={saving}
            >
              <Text style={{ color: '#ffffff', fontWeight: '700' }}>
                {saving ? 'Saving...' : editingId ? 'Update Ticket' : 'Raise Ticket'}
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
  ticketCard: {
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
  subjectText: {
    fontSize: 15,
    fontWeight: '700',
  },
  customerText: {
    fontSize: 12,
    marginTop: 2,
    fontWeight: '500',
  },
  descText: {
    fontSize: 13,
    lineHeight: 18,
  },
  cardFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 4,
  },
  servicePill: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  serviceText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#6366f1',
  },
  resolutionBox: {
    marginTop: 6,
    padding: 10,
    borderRadius: 8,
  },
  resolutionTitle: {
    fontSize: 11,
    fontWeight: '700',
    marginBottom: 2,
  },
  resolutionText: {
    fontSize: 12,
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
