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
import {
  Target,
  Plus,
  Phone,
  MessageCircle,
  Calendar,
  User,
  X,
} from 'lucide-react-native';

const STATUS_LIST = ['All', 'New', 'Contacted', 'Demo Given', 'Quotation Sent', 'Negotiation', 'Won', 'Lost'];
const SOURCE_LIST = ['Website', 'Facebook', 'WhatsApp', 'Reference', 'Call', 'Other'];
const SERVICE_LIST = ['GPS Tracking', 'CCTV Security', 'Web Development', 'Digital Marketing', 'AMC Support'];

export default function LeadsScreen() {
  const { colors } = useTheme();
  const { user } = useAuth();

  const [leads, setLeads] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [search, setSearch] = useState('');
  const [selectedStatus, setSelectedStatus] = useState('All');

  // Modal State
  const [modalVisible, setModalVisible] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [saving, setSaving] = useState(false);
  const [formData, setFormData] = useState({
    name: '',
    phone: '',
    email: '',
    company: '',
    source: 'Website',
    service: 'GPS Tracking',
    status: 'New',
    exec: '',
    followUp: '',
    notes: ''
  });

  const fetchLeads = useCallback(async () => {
    try {
      const data = await apiGetAll('/leads');
      setLeads(Array.isArray(data) ? data : []);
    } catch (err) {
      Alert.alert('Error', err.message || 'Failed to load leads');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    fetchLeads();
  }, [fetchLeads]);

  const onRefresh = () => {
    setRefreshing(true);
    fetchLeads();
  };

  const openAddModal = () => {
    setEditingId(null);
    setFormData({
      name: '',
      phone: '',
      email: '',
      company: '',
      source: 'Website',
      service: 'GPS Tracking',
      status: 'New',
      exec: user?.name || '',
      followUp: new Date(Date.now() + 2 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
      notes: ''
    });
    setModalVisible(true);
  };

  const openEditModal = (lead) => {
    setEditingId(lead.id);
    setFormData({
      name: lead.name || '',
      phone: lead.phone || '',
      email: lead.email || '',
      company: lead.company || '',
      source: lead.source || 'Website',
      service: lead.service || 'GPS Tracking',
      status: lead.status || 'New',
      exec: lead.exec || '',
      followUp: lead.followUp || '',
      notes: lead.notes || ''
    });
    setModalVisible(true);
  };

  const handleSaveLead = async () => {
    if (!formData.name.trim() || !formData.phone.trim() || !formData.service) {
      Alert.alert('Validation Error', 'Lead Name, Phone, and Service are required.');
      return;
    }

    setSaving(true);
    try {
      if (editingId) {
        await apiPut(`/leads/${editingId}`, formData);
        Alert.alert('Success', 'Lead updated successfully');
      } else {
        await apiPost('/leads', formData);
        Alert.alert('Success', 'Lead created successfully');
      }
      setModalVisible(false);
      fetchLeads();
    } catch (err) {
      Alert.alert('Error', err.message || 'Failed to save lead');
    } finally {
      setSaving(false);
    }
  };



  const filteredLeads = leads.filter(lead => {
    const matchSearch =
      (lead.name || '').toLowerCase().includes(search.toLowerCase()) ||
      (lead.phone || '').includes(search) ||
      (lead.company || '').toLowerCase().includes(search.toLowerCase()) ||
      (lead.service || '').toLowerCase().includes(search.toLowerCase());

    const matchStatus = selectedStatus === 'All' || lead.status === selectedStatus;
    return matchSearch && matchStatus;
  });

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <Header
        title="Leads Pipeline"
        subtitle={`${leads.length} total prospects`}
        rightElement={
          <TouchableOpacity
            style={[styles.addBtn, { backgroundColor: colors.primary }]}
            onPress={openAddModal}
            activeOpacity={0.8}
          >
            <Plus size={18} color="#ffffff" />
            <Text style={styles.addBtnText}>New Lead</Text>
          </TouchableOpacity>
        }
      />

      {/* Filter and Search Bar */}
      <View style={[styles.filterSection, { backgroundColor: colors.card, borderBottomColor: colors.border }]}>
        <SearchInput
          value={search}
          onChangeText={setSearch}
          placeholder="Search leads by name, phone, company..."
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

      {/* Leads List */}
      {loading ? (
        <LoadingSpinner message="Loading sales pipeline..." />
      ) : (
        <FlatList
          data={filteredLeads}
          keyExtractor={(item) => String(item.id)}
          contentContainerStyle={styles.list}
          showsVerticalScrollIndicator={false}
          overScrollMode="never"
          scrollEventThrottle={16}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />}
          ListEmptyComponent={
            <EmptyState
              title="No leads in this view"
              description="Tap 'New Lead' to capture a new prospect inquiry."
              icon={Target}
              actionText="Add New Lead"
              onAction={openAddModal}
            />
          }
          renderItem={({ item }) => (
            <View style={[styles.leadCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
              {/* Header */}
              <View style={styles.cardHeader}>
                <View style={styles.leadInfo}>
                  <Text style={[styles.leadName, { color: colors.text }]}>{item.name}</Text>
                  {item.company ? (
                    <Text style={[styles.leadCompany, { color: colors.textMuted }]}>
                      {item.company}
                    </Text>
                  ) : null}
                </View>
                <Badge label={item.status || 'New'} />
              </View>

              {/* Service & Meta Pill */}
              <View style={styles.metaRow}>
                <View style={[styles.metaPill, { backgroundColor: 'rgba(99, 102, 241, 0.12)' }]}>
                  <Text style={styles.serviceText}>{item.service}</Text>
                </View>
                <View style={[styles.metaPill, { backgroundColor: colors.cardSecondary }]}>
                  <Text style={[styles.sourceText, { color: colors.textMuted }]}>
                    Source: {item.source || 'General'}
                  </Text>
                </View>
              </View>

              {/* Follow-up & Executive */}
              <View style={styles.detailsRow}>
                {item.followUp ? (
                  <View style={styles.detailItem}>
                    <Calendar size={12} color="#f59e0b" />
                    <Text style={[styles.detailText, { color: colors.textMuted }]}>
                      Follow-up: {item.followUp}
                    </Text>
                  </View>
                ) : null}

                {item.exec ? (
                  <View style={styles.detailItem}>
                    <User size={12} color={colors.primary} />
                    <Text style={[styles.detailText, { color: colors.textMuted }]}>
                      Rep: {item.exec}
                    </Text>
                  </View>
                ) : null}
              </View>

              {/* Notes if any */}
              {item.notes ? (
                <Text style={[styles.notesText, { color: colors.textMuted }]} numberOfLines={2}>
                  "{item.notes}"
                </Text>
              ) : null}

              {/* Actions Footer */}
              <View style={[styles.cardFooter, { borderTopColor: colors.border }]}>
                <View style={styles.contactActions}>
                  {item.phone ? (
                    <>
                      <TouchableOpacity
                        style={[styles.actionBtn, { backgroundColor: 'rgba(16, 185, 129, 0.12)' }]}
                        onPress={() => Linking.openURL(`tel:${item.phone}`)}
                      >
                        <Phone size={14} color="#10b981" />
                        <Text style={[styles.actionBtnText, { color: '#10b981' }]}>Call</Text>
                      </TouchableOpacity>
                      <TouchableOpacity
                        style={[styles.actionBtn, { backgroundColor: 'rgba(37, 211, 102, 0.12)' }]}
                        onPress={() => Linking.openURL(`https://wa.me/${item.phone.replace(/[^0-9]/g, '')}`)}
                      >
                        <MessageCircle size={14} color="#25D366" />
                        <Text style={[styles.actionBtnText, { color: '#25D366' }]}>WhatsApp</Text>
                      </TouchableOpacity>
                    </>
                  ) : null}
                </View>

                <TouchableOpacity
                  style={[styles.editBtn, { backgroundColor: colors.cardSecondary }]}
                  onPress={() => openEditModal(item)}
                >
                  <Text style={[styles.editBtnText, { color: colors.text }]}>Edit</Text>
                </TouchableOpacity>
              </View>
            </View>
          )}
        />
      )}

      {/* Add / Edit Lead Modal */}
      <AnimatedModal visible={modalVisible} onRequestClose={() => setModalVisible(false)}>
        <View style={[styles.modalContent, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <View style={[styles.modalHeader, { borderBottomColor: colors.border }]}>
            <Text style={[styles.modalTitle, { color: colors.text }]}>
              {editingId ? 'Edit Lead' : 'Create New Lead'}
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
            <Text style={[styles.inputLabel, { color: colors.textSecondary }]}>Prospect / Contact Name *</Text>
            <TextInput
              style={[styles.formInput, { backgroundColor: colors.inputBg, color: colors.text, borderColor: colors.border }]}
              placeholder="e.g. Ramesh Patel"
              placeholderTextColor={colors.textMuted}
              value={formData.name}
              onChangeText={(t) => setFormData({ ...formData, name: t })}
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

            <Text style={[styles.inputLabel, { color: colors.textSecondary }]}>Company Name</Text>
            <TextInput
              style={[styles.formInput, { backgroundColor: colors.inputBg, color: colors.text, borderColor: colors.border }]}
              placeholder="e.g. Patel Logistics"
              placeholderTextColor={colors.textMuted}
              value={formData.company}
              onChangeText={(t) => setFormData({ ...formData, company: t })}
            />

            <Text style={[styles.inputLabel, { color: colors.textSecondary }]}>Service Required</Text>
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

            <Text style={[styles.inputLabel, { color: colors.textSecondary }]}>Pipeline Status</Text>
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

            <Text style={[styles.inputLabel, { color: colors.textSecondary }]}>Lead Source</Text>
            <View style={styles.choiceRow}>
              {SOURCE_LIST.map((src, i) => (
                <TouchableOpacity
                  key={i}
                  style={[
                    styles.choiceChip,
                    {
                      backgroundColor: formData.source === src ? colors.primary : colors.cardSecondary,
                      borderColor: formData.source === src ? colors.primary : colors.border
                    }
                  ]}
                  onPress={() => setFormData({ ...formData, source: src })}
                >
                  <Text style={[styles.choiceText, { color: formData.source === src ? '#fff' : colors.text }]}>
                    {src}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            <Text style={[styles.inputLabel, { color: colors.textSecondary }]}>Next Follow-up Date (YYYY-MM-DD)</Text>
            <TextInput
              style={[styles.formInput, { backgroundColor: colors.inputBg, color: colors.text, borderColor: colors.border }]}
              placeholder="2026-08-30"
              placeholderTextColor={colors.textMuted}
              value={formData.followUp}
              onChangeText={(t) => setFormData({ ...formData, followUp: t })}
            />

            <Text style={[styles.inputLabel, { color: colors.textSecondary }]}>Internal Notes</Text>
            <TextInput
              style={[styles.formInput, styles.textArea, { backgroundColor: colors.inputBg, color: colors.text, borderColor: colors.border }]}
              placeholder="Budget, key requirements, conversation summary..."
              placeholderTextColor={colors.textMuted}
              value={formData.notes}
              onChangeText={(t) => setFormData({ ...formData, notes: t })}
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
              onPress={handleSaveLead}
              disabled={saving}
            >
              <Text style={{ color: '#ffffff', fontWeight: '700' }}>
                {saving ? 'Saving...' : editingId ? 'Update Lead' : 'Save Lead'}
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
  leadCard: {
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 8,
  },
  leadInfo: {
    flex: 1,
    marginRight: 8,
  },
  leadName: {
    fontSize: 16,
    fontWeight: '700',
  },
  leadCompany: {
    fontSize: 12,
    marginTop: 2,
    fontWeight: '500',
  },
  metaRow: {
    flexDirection: 'row',
    gap: 8,
    marginVertical: 4,
  },
  metaPill: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  serviceText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#6366f1',
  },
  sourceText: {
    fontSize: 11,
    fontWeight: '600',
  },
  detailsRow: {
    flexDirection: 'row',
    gap: 14,
    marginTop: 6,
  },
  detailItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  detailText: {
    fontSize: 11,
    fontWeight: '500',
  },
  notesText: {
    fontSize: 12,
    fontStyle: 'italic',
    marginTop: 8,
  },
  cardFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderTopWidth: 1,
    paddingTop: 10,
    marginTop: 10,
  },
  contactActions: {
    flexDirection: 'row',
    gap: 8,
  },
  actionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
  },
  actionBtnText: {
    fontSize: 11,
    fontWeight: '700',
  },
  editBtn: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
  },
  editBtnText: {
    fontSize: 12,
    fontWeight: '600',
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
    height: 70,
    textAlignVertical: 'top',
    paddingTop: 10,
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
