import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  RefreshControl,
  StyleSheet,
  Linking,
  TextInput,
  ScrollView,
  Alert
} from 'react-native';
import { useTheme } from '../../context/ThemeContext';
import { useAuth } from '../../context/AuthContext';
import { apiGetAll, apiPost, apiPut } from '../../config/api';
import Header from '../../components/common/Header';
import SearchInput from '../../components/common/SearchInput';
import Badge from '../../components/common/Badge';
import EmptyState from '../../components/common/EmptyState';
import LoadingSpinner from '../../components/common/LoadingSpinner';
import AnimatedModal from '../../components/common/AnimatedModal';
import { canWriteResource } from '../../config/permissions';
import {
  Users,
  Plus,
  Phone,
  ChevronRight,
  X
} from 'lucide-react-native';

const SERVICE_OPTIONS = ['GPS Tracking', 'CCTV Security', 'Web Development', 'Digital Marketing', 'AMC Support'];

function parseServices(value) {
  if (Array.isArray(value)) return value;
  if (!value) return [];
  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed) ? parsed : [String(parsed)];
  } catch {
    return String(value).split(',').map(item => item.trim()).filter(Boolean);
  }
}

export default function CustomersScreen({ navigation }) {
  const { colors } = useTheme();
  const { user } = useAuth();
  const canWrite = canWriteResource(user?.role, 'customers');

  const [customers, setCustomers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [search, setSearch] = useState('');
  const [selectedService, setSelectedService] = useState('All');

  // Add / Edit Modal
  const [modalVisible, setModalVisible] = useState(false);
  const [saving, setSaving] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [formData, setFormData] = useState({
    name: '',
    contact: '',
    phone: '',
    email: '',
    gst: '',
    address: '',
    services: [],
    renewalDate: '',
    status: 'Active'
  });

  const fetchCustomers = useCallback(async () => {
    try {
      const data = await apiGetAll('/customers');
      setCustomers(Array.isArray(data) ? data : []);
    } catch (err) {
      Alert.alert('Error', err.message || 'Failed to fetch customers');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    fetchCustomers();
  }, [fetchCustomers]);

  const onRefresh = () => {
    setRefreshing(true);
    fetchCustomers();
  };

  const openAddModal = () => {
    setEditingId(null);
    setFormData({
      name: '',
      contact: '',
      phone: '',
      email: '',
      gst: '',
      address: '',
      services: ['GPS Tracking'],
      renewalDate: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
      status: 'Active'
    });
    setModalVisible(true);
  };

  const openEditModal = (customer) => {
    setEditingId(customer.id);
    setFormData({
      name: customer.name || '',
      contact: customer.contact || '',
      phone: customer.phone || '',
      email: customer.email || '',
      gst: customer.gst || '',
      address: customer.address || '',
      services: parseServices(customer.services),
      renewalDate: customer.renewalDate ? String(customer.renewalDate).slice(0, 10) : '',
      status: customer.status || 'Active'
    });
    setModalVisible(true);
  };

  const toggleService = (svc) => {
    setFormData(prev => {
      const exists = prev.services.includes(svc);
      return {
        ...prev,
        services: exists ? prev.services.filter(s => s !== svc) : [...prev.services, svc]
      };
    });
  };

  const handleSaveCustomer = async () => {
    if (!formData.name.trim() || !formData.phone.trim()) {
      Alert.alert('Validation Error', 'Customer Name and Phone Number are required.');
      return;
    }

    const payload = { ...formData, services: JSON.stringify(formData.services) };
    setSaving(true);
    try {
      if (editingId) {
        await apiPut(`/customers/${editingId}`, payload);
        Alert.alert('Success', 'Customer updated successfully');
      } else {
        await apiPost('/customers', payload);
        Alert.alert('Success', 'Customer added successfully');
      }
      setModalVisible(false);
      fetchCustomers();
    } catch (err) {
      Alert.alert('Error', err.message || 'Failed to save customer');
    } finally {
      setSaving(false);
    }
  };

  const filteredCustomers = customers.filter(c => {
    const matchSearch =
      (c.name || '').toLowerCase().includes(search.toLowerCase()) ||
      (c.phone || '').includes(search) ||
      (c.contact || '').toLowerCase().includes(search.toLowerCase()) ||
      (c.email || '').toLowerCase().includes(search.toLowerCase());

    const matchService =
      selectedService === 'All' ||
      (Array.isArray(c.services) && c.services.includes(selectedService)) ||
      (typeof c.services === 'string' && c.services.includes(selectedService));

    return matchSearch && matchService;
  });

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <Header
        title="Customers"
        subtitle={`${customers.length} total client accounts`}
        rightElement={canWrite ? (
          <TouchableOpacity
            style={[styles.addBtn, { backgroundColor: colors.primary }]}
            onPress={openAddModal}
            activeOpacity={0.8}
          >
            <Plus size={18} color="#ffffff" />
            <Text style={styles.addBtnText}>Add</Text>
          </TouchableOpacity>
        ) : null}
      />

      {/* Search & Filter Bar */}
      <View style={[styles.filterSection, { backgroundColor: colors.card, borderBottomColor: colors.border }]}>
        <SearchInput
          value={search}
          onChangeText={setSearch}
          placeholder="Search customer, phone, contact person..."
        />

        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.filterScroll}>
          {['All', ...SERVICE_OPTIONS].map((svc, i) => {
            const isSelected = selectedService === svc;
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
                onPress={() => setSelectedService(svc)}
              >
                <Text style={[styles.filterChipText, { color: isSelected ? '#ffffff' : colors.textMuted }]}>
                  {svc}
                </Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>
      </View>

      {/* Customers List */}
      {loading ? (
        <LoadingSpinner message="Loading customer directory..." />
      ) : (
        <FlatList
          data={filteredCustomers}
          keyExtractor={(item) => String(item.id)}
          contentContainerStyle={styles.list}
          showsVerticalScrollIndicator={false}
          overScrollMode="never"
          scrollEventThrottle={16}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />}
          ListEmptyComponent={
            <EmptyState
              title="No customers found"
              description="Tap 'Add' to create your first client record."
              icon={Users}
              actionText={canWrite ? 'Add Customer' : undefined}
              onAction={canWrite ? openAddModal : undefined}
            />
          }
          renderItem={({ item }) => {
            const rawServices = parseServices(item.services);
            const primaryService = rawServices[0];
            return (
              <TouchableOpacity
                style={[styles.customerCard, { backgroundColor: colors.card, borderColor: colors.border }]}
                onPress={() => navigation.navigate('CustomerDetail', { customerId: item.id })}
                activeOpacity={0.7}
                accessibilityRole="button"
                accessibilityLabel={`View customer details for ${item.name}`}
              >
                <View style={styles.cardHeader}>
                  <Text style={[styles.customerName, { color: colors.text }]} numberOfLines={1}>
                    {item.name}
                  </Text>
                  <Badge label={item.status || 'Active'} size="small" />
                </View>

                <View style={styles.cardMetaRow}>
                  {item.phone ? (
                    <TouchableOpacity
                      style={styles.metaPhone}
                      onPress={() => Linking.openURL(`tel:${item.phone}`)}
                      hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
                    >
                      <Phone size={11} color={colors.primary} />
                      <Text style={[styles.metaPhoneText, { color: colors.textSecondary }]} numberOfLines={1}>
                        {item.phone}{item.contact ? ` (${item.contact})` : ''}
                      </Text>
                    </TouchableOpacity>
                  ) : item.contact ? (
                    <Text style={[styles.metaPhoneText, { color: colors.textSecondary }]} numberOfLines={1}>
                      {item.contact}
                    </Text>
                  ) : null}

                  {primaryService ? (
                    <View style={[styles.serviceTag, { backgroundColor: 'rgba(99, 102, 241, 0.10)' }]}>
                      <Text style={styles.serviceTagText} numberOfLines={1}>
                        {primaryService}{rawServices.length > 1 ? ` +${rawServices.length - 1}` : ''}
                      </Text>
                    </View>
                  ) : null}

                  <View style={styles.metaRight}>
                    {canWrite ? (
                      <TouchableOpacity
                        onPress={() => openEditModal(item)}
                        style={styles.cardEditBtn}
                        hitSlop={{ top: 8, bottom: 8, left: 6, right: 6 }}
                        accessibilityRole="button"
                        accessibilityLabel={`Edit ${item.name}`}
                      >
                        <Text style={[styles.cardEditText, { color: colors.primary }]}>Edit</Text>
                      </TouchableOpacity>
                    ) : null}
                    <ChevronRight size={15} color={colors.textMuted} />
                  </View>
                </View>
              </TouchableOpacity>
            );
          }}
        />
      )}

      {/* Add / Edit Customer Modal */}
      <AnimatedModal visible={modalVisible} onRequestClose={() => setModalVisible(false)}>
        <View style={[styles.modalContent, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <View style={[styles.modalHeader, { borderBottomColor: colors.border }]}>
            <Text style={[styles.modalTitle, { color: colors.text }]}>
              {editingId ? 'Edit Customer' : 'New Customer'}
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
            overScrollMode="never"
          >
            <Text style={[styles.inputLabel, { color: colors.textSecondary }]}>Company / Customer Name *</Text>
            <TextInput
              style={[styles.formInput, { backgroundColor: colors.inputBg, color: colors.text, borderColor: colors.border }]}
              placeholder="e.g. Acme Corporation"
              placeholderTextColor={colors.textMuted}
              value={formData.name}
              onChangeText={(t) => setFormData({ ...formData, name: t })}
            />

            <Text style={[styles.inputLabel, { color: colors.textSecondary }]}>Contact Person</Text>
            <TextInput
              style={[styles.formInput, { backgroundColor: colors.inputBg, color: colors.text, borderColor: colors.border }]}
              placeholder="e.g. John Doe"
              placeholderTextColor={colors.textMuted}
              value={formData.contact}
              onChangeText={(t) => setFormData({ ...formData, contact: t })}
            />

            <Text style={[styles.inputLabel, { color: colors.textSecondary }]}>Phone Number *</Text>
            <TextInput
              style={[styles.formInput, { backgroundColor: colors.inputBg, color: colors.text, borderColor: colors.border }]}
              placeholder="e.g. +91 98765 43210"
              placeholderTextColor={colors.textMuted}
              value={formData.phone}
              onChangeText={(t) => setFormData({ ...formData, phone: t })}
              keyboardType="phone-pad"
            />

            <Text style={[styles.inputLabel, { color: colors.textSecondary }]}>Email Address</Text>
            <TextInput
              style={[styles.formInput, { backgroundColor: colors.inputBg, color: colors.text, borderColor: colors.border }]}
              placeholder="e.g. info@acme.com"
              placeholderTextColor={colors.textMuted}
              value={formData.email}
              onChangeText={(t) => setFormData({ ...formData, email: t })}
              keyboardType="email-address"
              autoCapitalize="none"
            />

            <Text style={[styles.inputLabel, { color: colors.textSecondary }]}>GST Number</Text>
            <TextInput
              style={[styles.formInput, { backgroundColor: colors.inputBg, color: colors.text, borderColor: colors.border }]}
              placeholder="e.g. 27AAAAA0000A1Z5"
              placeholderTextColor={colors.textMuted}
              value={formData.gst}
              onChangeText={(t) => setFormData({ ...formData, gst: t })}
              autoCapitalize="characters"
            />

            <Text style={[styles.inputLabel, { color: colors.textSecondary }]}>Services Enrolled</Text>
            <View style={styles.servicesGrid}>
              {SERVICE_OPTIONS.map((svc, idx) => {
                const selected = formData.services.includes(svc);
                return (
                  <TouchableOpacity
                    key={idx}
                    style={[
                      styles.serviceCheckChip,
                      {
                        backgroundColor: selected ? colors.primary : colors.cardSecondary,
                        borderColor: selected ? colors.primary : colors.border
                      }
                    ]}
                    onPress={() => toggleService(svc)}
                  >
                    <Text style={[styles.serviceCheckText, { color: selected ? '#ffffff' : colors.text }]}>
                      {selected ? '✓ ' : '+ '}{svc}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>

            <Text style={[styles.inputLabel, { color: colors.textSecondary }]}>Renewal Due Date (YYYY-MM-DD)</Text>
            <TextInput
              style={[styles.formInput, { backgroundColor: colors.inputBg, color: colors.text, borderColor: colors.border }]}
              placeholder="2027-01-15"
              placeholderTextColor={colors.textMuted}
              value={formData.renewalDate}
              onChangeText={(t) => setFormData({ ...formData, renewalDate: t })}
            />

            <Text style={[styles.inputLabel, { color: colors.textSecondary }]}>Full Address</Text>
            <TextInput
              style={[styles.formInput, styles.textArea, { backgroundColor: colors.inputBg, color: colors.text, borderColor: colors.border }]}
              placeholder="Street, City, Pin code"
              placeholderTextColor={colors.textMuted}
              value={formData.address}
              onChangeText={(t) => setFormData({ ...formData, address: t })}
              multiline
              numberOfLines={3}
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
              onPress={handleSaveCustomer}
              disabled={saving}
            >
              <Text style={{ color: '#ffffff', fontWeight: '700' }}>
                {saving ? 'Saving...' : editingId ? 'Update Customer' : 'Create Customer'}
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
    gap: 10,
  },
  customerCard: {
    borderRadius: 14,
    paddingVertical: 12,
    paddingHorizontal: 14,
    borderWidth: 1,
    gap: 6,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  customerName: {
    fontSize: 15,
    fontWeight: '700',
    flex: 1,
    marginRight: 8,
  },
  cardMetaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  metaPhone: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    flexShrink: 1,
  },
  metaPhoneText: {
    fontSize: 12,
    fontWeight: '500',
  },
  serviceTag: {
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 6,
    flexShrink: 0,
  },
  serviceTagText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#6366f1',
  },
  metaRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginLeft: 'auto',
    flexShrink: 0,
  },
  cardEditBtn: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  cardEditText: {
    fontSize: 12,
    fontWeight: '700',
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
  textArea: {
    height: 80,
    textAlignVertical: 'top',
    paddingTop: 10,
  },
  servicesGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginVertical: 4,
  },
  serviceCheckChip: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    borderWidth: 1,
  },
  serviceCheckText: {
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
