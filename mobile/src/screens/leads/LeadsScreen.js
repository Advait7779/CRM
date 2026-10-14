import React, { useState, useEffect, useCallback } from 'react';
import * as FileSystem from 'expo-file-system/legacy';
import * as Sharing from 'expo-sharing';
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
import { apiGet, apiGetAll, apiPost, apiPut, getAuthToken, getServerUrl } from '../../config/api';
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
  Download,
  User,
  X,
} from 'lucide-react-native';

const ACTION_STATUSES = ['Connected', 'Future Prospect', 'Fake Enquiry', 'Interested', 'Not Interested', 'Follow-Up Required'];
const STATUS_LIST = ['New', ...ACTION_STATUSES];
const SOURCE_LIST = ['Website', 'Facebook', 'WhatsApp', 'Reference', 'Call', 'Justdial', 'Other'];
const SERVICE_LIST = ['GPS Tracking', 'CCTV', 'CCTV Security', 'Website Design', 'Web Development', 'Software Development', 'SMS Package', 'WhatsApp WABA', 'RCS Messaging', 'Voice Package', 'Digital Marketing', 'AMC Support'];
const LEAD_GROUPS = ['All', 'GPS & Fuel Sensor', 'CCTV', 'Digital Services'];
const DIGITAL_PRODUCTS = new Set(['SMS', 'WhatsApp WABA', 'RCS', 'Voice Call', 'Website Development', 'Software Development', 'Digital Marketing']);

function leadMatchesGroup(lead, group) {
  if (group === 'All') return true;
  if (lead.justdialProduct) {
    if (group === 'GPS & Fuel Sensor') return lead.justdialProduct === 'GPS & Fuel Sensor';
    if (group === 'CCTV') return lead.justdialProduct === 'CCTV';
    return DIGITAL_PRODUCTS.has(lead.justdialProduct);
  }
  const service = String(lead.service || '');
  if (group === 'GPS & Fuel Sensor') return /\b(gps|fuel sensor|fuel monitoring|vehicle tracking|fleet tracking)\b/i.test(service);
  if (group === 'CCTV') return /\b(cctv|camera|surveillance)\b/i.test(service);
  return /\b(sms|rcs|whatsapp|waba|voice|ivr|website|web design|web development|software|app development|digital marketing|seo)\b/i.test(service);
}
const leadDate = lead => {
  const enquiryDate = lead.source === 'Justdial' ? String(lead.justdialPayload?.date || '') : '';
  if (/^\d{4}-\d{2}-\d{2}$/.test(enquiryDate) && !Number.isNaN(new Date(`${enquiryDate}T00:00:00Z`).getTime())) {
    return `${enquiryDate}${lead.justdialPayload?.time ? ` ${String(lead.justdialPayload.time).slice(0, 5)}` : ''}`;
  }
  const received = new Date(lead.createdAt);
  return Number.isNaN(received.getTime()) ? 'Date unavailable' : received.toLocaleString('en-IN', { timeZone: 'Asia/Kolkata', day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
};

export default function LeadsScreen() {
  const { colors } = useTheme();
  const { user } = useAuth();
  const isAdmin = ['super_admin', 'director'].includes(user?.role);

  const [leads, setLeads] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [search, setSearch] = useState('');
  const [selectedGroup, setSelectedGroup] = useState('All');
  const [exporting, setExporting] = useState(false);
  const [productOptions, setProductOptions] = useState([]);
  const [systemUsers, setSystemUsers] = useState([]);
  const [statusLead, setStatusLead] = useState(null);
  const [savingStatus, setSavingStatus] = useState(false);

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
    notes: '',
    justdialProduct: 'Unclassified'
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

  useEffect(() => {
    if (isAdmin) apiGet('/justdial/products').then(data => setProductOptions(data?.assignable || [])).catch(() => {});
  }, [isAdmin]);

  useEffect(() => {
    apiGet('/system-users')
      .then(data => setSystemUsers(Array.isArray(data) ? data : []))
      .catch(() => Alert.alert('Executives unavailable', 'Could not load system users for lead assignment.'));
  }, []);

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
      exec: user?.role === 'sales_executive' ? user.name : '',
      followUp: new Date(Date.now() + 2 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
      notes: '',
      justdialProduct: 'Unclassified'
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
      notes: lead.notes || '',
      justdialProduct: lead.justdialProduct || 'Unclassified'
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
        const editingLead = leads.find(lead => lead.id === editingId);
        const payload = { ...formData };
        if (editingLead?.source === 'Justdial' && !isAdmin) {
          delete payload.source;
          delete payload.service;
          delete payload.justdialProduct;
        }
        await apiPut(`/leads/${editingId}`, payload);
        Alert.alert('Success', 'Lead updated successfully');
      } else {
        const payload = { ...formData };
        delete payload.justdialProduct;
        await apiPost('/leads', payload);
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

  const handleStatusChange = async (nextStatus) => {
    if (!statusLead || savingStatus || nextStatus === statusLead.status) {
      setStatusLead(null);
      return;
    }
    setSavingStatus(true);
    try {
      const updated = await apiPut(`/leads/${statusLead.id}`, { status: nextStatus });
      setLeads(current => current.map(lead => lead.id === statusLead.id ? updated : lead));
      setStatusLead(null);
    } catch (error) {
      Alert.alert('Status update failed', error.message || 'Please try again.');
    } finally {
      setSavingStatus(false);
    }
  };



  const filteredLeads = leads.filter(lead => {
    const matchSearch =
      (lead.name || '').toLowerCase().includes(search.toLowerCase()) ||
      (lead.phone || '').includes(search) ||
      (lead.company || '').toLowerCase().includes(search.toLowerCase()) ||
      (lead.service || '').toLowerCase().includes(search.toLowerCase()) ||
      (lead.justdialProduct || '').toLowerCase().includes(search.toLowerCase());

    return matchSearch && leadMatchesGroup(lead, selectedGroup);
  });

  const handleDownloadExcel = async () => {
    if (!filteredLeads.length || exporting) return;
    setExporting(true);
    try {
      const [baseUrl, token] = await Promise.all([getServerUrl(), getAuthToken()]);
      if (!baseUrl || !token) throw new Error('Please log in again to download leads.');
      const query = `group=${encodeURIComponent(selectedGroup)}&search=${encodeURIComponent(search.trim())}`;
      const slug = selectedGroup.toLowerCase().replace(/[^a-z0-9]+/g, '-');
      const date = new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' });
      const filename = `leads-${slug}-${date}.xlsx`;
      const result = await FileSystem.downloadAsync(
        `${baseUrl}/leads-export.xlsx?${query}`,
        `${FileSystem.documentDirectory}${filename}`,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      if (result.status !== 200) throw new Error(`Download failed (HTTP ${result.status}).`);
      if (await Sharing.isAvailableAsync()) {
        await Sharing.shareAsync(result.uri, {
          mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
          dialogTitle: 'Save or share leads Excel file'
        });
      } else {
        Alert.alert('Excel file saved', result.uri);
      }
    } catch (error) {
      Alert.alert('Excel download failed', error.message || 'Could not download leads.');
    } finally {
      setExporting(false);
    }
  };

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
          {LEAD_GROUPS.map(group => {
            const isSelected = selectedGroup === group;
            return (
              <TouchableOpacity
                key={group}
                style={[
                  styles.filterChip,
                  {
                    backgroundColor: isSelected ? colors.primary : colors.cardSecondary,
                    borderColor: isSelected ? colors.primary : colors.border
                  }
                ]}
                onPress={() => setSelectedGroup(group)}
                accessibilityRole="button"
                accessibilityState={{ selected: isSelected }}
              >
                <Text style={[styles.filterChipText, { color: isSelected ? '#ffffff' : colors.textMuted }]}>
                  {group}
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
          ListHeaderComponent={
            <View style={styles.exportRow}>
              <Text style={[styles.exportCount, { color: colors.textMuted }]}>{filteredLeads.length} leads in this view</Text>
              <TouchableOpacity
                style={[styles.exportBtn, { backgroundColor: colors.primary }, (!filteredLeads.length || exporting) && styles.exportBtnDisabled]}
                onPress={handleDownloadExcel}
                disabled={!filteredLeads.length || exporting}
                accessibilityRole="button"
                accessibilityLabel={`Download ${filteredLeads.length} leads as Excel`}
              >
                <Download size={15} color="#ffffff" />
                <Text style={styles.exportBtnText}>{exporting ? 'Preparing…' : 'Download Excel'}</Text>
              </TouchableOpacity>
            </View>
          }
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
              {item.justdialProduct ? <Text style={{ color: item.justdialProduct === 'Unclassified' ? '#b45309' : colors.textMuted, fontSize: 12 }}>{item.justdialProduct}</Text> : null}
              <Text style={{ color: colors.textMuted, fontSize: 12, marginTop: 5 }}>Lead date: {leadDate(item)}</Text>

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
                {item.status !== 'Converted' && !item.convertedCustomerId ? <TouchableOpacity
                  style={[styles.editBtn, { backgroundColor: colors.cardSecondary }]}
                  onPress={() => setStatusLead(item)}
                  accessibilityRole="button"
                  accessibilityLabel={`Change status for ${item.name}`}
                ><Text style={[styles.editBtnText, { color: colors.primary }]}>Status</Text></TouchableOpacity> : null}
                {item.status !== 'Converted' && !item.convertedCustomerId ? <TouchableOpacity style={[styles.editBtn, { backgroundColor: 'rgba(16,185,129,0.12)' }]}
                  onPress={() => Alert.alert('Convert to Customer', `Convert ${item.name} into an active customer account?`, [
                    { text: 'Cancel', style: 'cancel' },
                    { text: 'Convert', onPress: async () => {
                      try { await apiPost(`/leads/${item.id}/convert`, {}); await fetchLeads(); Alert.alert('Converted', `${item.name} is now a customer.`); }
                      catch (error) { Alert.alert('Conversion failed', error.message); }
                    } }
                  ])}><Text style={{ color: '#059669', fontWeight: '700' }}>Convert</Text></TouchableOpacity> : null}
              </View>
            </View>
          )}
        />
      )}

      <AnimatedModal visible={Boolean(statusLead)} onRequestClose={() => !savingStatus && setStatusLead(null)}>
        <View style={[styles.modalContent, { backgroundColor: colors.card, borderColor: colors.border, padding: 18 }]}>
          <Text style={[styles.modalTitle, { color: colors.text }]}>Update Lead Status</Text>
          <Text style={[styles.detailText, { color: colors.textMuted, marginTop: 4, marginBottom: 12 }]}>{statusLead?.name}</Text>
          {statusLead?.status && !ACTION_STATUSES.includes(statusLead.status) ? (
            <Text style={[styles.detailText, { color: colors.textMuted, marginBottom: 8 }]}>Current: {statusLead.status}</Text>
          ) : null}
          {ACTION_STATUSES.map(status => (
            <TouchableOpacity
              key={status}
              style={[styles.statusOption, { backgroundColor: statusLead?.status === status ? 'rgba(99, 102, 241, 0.12)' : colors.cardSecondary, borderColor: statusLead?.status === status ? colors.primary : colors.border }]}
              onPress={() => handleStatusChange(status)}
              disabled={savingStatus}
              accessibilityRole="button"
              accessibilityState={{ selected: statusLead?.status === status }}
            >
              <Text style={[styles.choiceText, { color: colors.text }]}>{status}</Text>
            </TouchableOpacity>
          ))}
          <TouchableOpacity style={[styles.cancelBtn, { alignSelf: 'flex-end', marginTop: 12 }]} onPress={() => setStatusLead(null)} disabled={savingStatus}>
            <Text style={{ color: colors.text }}>Cancel</Text>
          </TouchableOpacity>
        </View>
      </AnimatedModal>

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
            {editingId && formData.source === 'Justdial' && !isAdmin ? <Text style={{ color: colors.text }}>{formData.service}</Text> : <View style={styles.choiceRow}>
              {formData.service && !SERVICE_LIST.includes(formData.service) ? <Text style={{ color: colors.text, width: '100%' }}>Current: {formData.service}</Text> : null}
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
                  onPress={() => setFormData({ ...formData, service: svc, justdialProduct: undefined })}
                >
                  <Text style={[styles.choiceText, { color: formData.service === svc ? '#fff' : colors.text }]}>
                    {svc}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>}
            {editingId && formData.source === 'Justdial' && isAdmin ? <TextInput
              style={[styles.formInput, { backgroundColor: colors.inputBg, color: colors.text, borderColor: colors.border }]}
              value={formData.service} onChangeText={service => setFormData(current => ({ ...current, service, justdialProduct: undefined }))}
              placeholder="Justdial service category" placeholderTextColor={colors.textMuted} /> : null}

            <Text style={[styles.inputLabel, { color: colors.textSecondary }]}>Pipeline Status</Text>
            <View style={styles.choiceRow}>
            {editingId && (formData.status === 'Converted' || leads.find(lead => lead.id === editingId)?.convertedCustomerId) ? (
              <Text style={{ color: colors.text }}>Converted</Text>
            ) : <>{formData.status && !STATUS_LIST.includes(formData.status) ? (
              <TouchableOpacity style={[styles.choiceChip, { backgroundColor: colors.primary, borderColor: colors.primary }]}>
                <Text style={[styles.choiceText, { color: '#fff' }]}>{formData.status}</Text>
              </TouchableOpacity>
            ) : null}{STATUS_LIST.map((st, i) => (
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
              ))}</>}
            </View>

            <Text style={[styles.inputLabel, { color: colors.textSecondary }]}>Assigned Executive</Text>
            {user?.role === 'sales_executive' ? (
              <Text style={[styles.detailText, { color: colors.text }]}>Assigned to you: {user.name}</Text>
            ) : <View style={styles.choiceRow}>
              {[{ id: 'unassigned', name: '', label: 'Unassigned' },
                ...(formData.exec && !systemUsers.some(person => person.name === formData.exec) ? [{ id: 'current', name: formData.exec }] : []),
                ...systemUsers].map(person => (
                <TouchableOpacity
                  key={person.id}
                  style={[styles.choiceChip, { backgroundColor: formData.exec === person.name ? colors.primary : colors.cardSecondary, borderColor: formData.exec === person.name ? colors.primary : colors.border }]}
                  onPress={() => setFormData(current => ({ ...current, exec: person.name }))}
                  accessibilityRole="button"
                  accessibilityState={{ selected: formData.exec === person.name }}
                >
                  <Text style={[styles.choiceText, { color: formData.exec === person.name ? '#fff' : colors.text }]}>{person.label || person.name}</Text>
                </TouchableOpacity>
              ))}
            </View>}

            <Text style={[styles.inputLabel, { color: colors.textSecondary }]}>Lead Source</Text>
            {editingId && formData.source === 'Justdial' && !isAdmin ? <Text style={{ color: colors.text }}>Justdial</Text> : <View style={styles.choiceRow}>
              {SOURCE_LIST.filter(source => source !== 'Justdial' || (editingId && isAdmin)).map((src, i) => (
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
            </View>}
            {editingId && isAdmin ? <>
              <Text style={[styles.inputLabel, { color: colors.textSecondary }]}>Lead Product Group</Text>
              <View style={styles.choiceRow}>
                {['Unclassified', ...productOptions].map(product => <TouchableOpacity key={product}
                  style={[styles.choiceChip, { borderColor: formData.justdialProduct === product ? colors.primary : colors.border, backgroundColor: formData.justdialProduct === product ? colors.primary : colors.cardSecondary }]}
                  onPress={() => setFormData(current => ({ ...current, justdialProduct: product }))}>
                  <Text style={{ color: formData.justdialProduct === product ? '#fff' : colors.text }}>{product}</Text>
                </TouchableOpacity>)}
              </View>
            </> : null}

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
  exportRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  exportCount: {
    flexShrink: 1,
    fontSize: 12,
  },
  exportBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 9,
    borderRadius: 8,
  },
  exportBtnDisabled: {
    opacity: 0.5,
  },
  exportBtnText: {
    color: '#ffffff',
    fontSize: 12,
    fontWeight: '700',
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
    flexWrap: 'wrap',
    justifyContent: 'flex-end',
    alignItems: 'center',
    gap: 8,
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
  statusOption: {
    paddingHorizontal: 14,
    paddingVertical: 11,
    borderWidth: 1,
    borderRadius: 9,
    marginTop: 7,
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
