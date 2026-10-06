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
import * as ImagePicker from 'expo-image-picker';
import * as FileSystem from 'expo-file-system/legacy';
import * as Sharing from 'expo-sharing';
import { useTheme } from '../../context/ThemeContext';
import { useAuth } from '../../context/AuthContext';
import { apiGetAll, apiPost, apiPut, apiUpload, getAuthToken, getServerUrl } from '../../config/api';
import { canWriteResource } from '../../config/permissions';
import Header from '../../components/common/Header';
import SearchInput from '../../components/common/SearchInput';
import Badge from '../../components/common/Badge';
import EmptyState from '../../components/common/EmptyState';
import LoadingSpinner from '../../components/common/LoadingSpinner';
import AnimatedModal from '../../components/common/AnimatedModal';
import {
  Wrench,
  Plus,
  Calendar,
  User,
  Truck,
  Camera,
  X
} from 'lucide-react-native';

const TYPES = ['All', 'gps', 'cctv'];
const proofCount = value => {
  if (!value) return 0;
  try {
    const photos = JSON.parse(value);
    if (Array.isArray(photos)) return photos.length;
  } catch {}
  return 1;
};
const proofExtension = (value, index) => {
  try {
    const names = JSON.parse(value);
    const name = Array.isArray(names) ? names[index] : value;
    return /\.(png|webp|jpe?g)$/i.exec(name)?.[1]?.toLowerCase() || 'jpg';
  } catch { return /\.(png|webp|jpe?g)$/i.exec(value)?.[1]?.toLowerCase() || 'jpg'; }
};

export default function InstallationsScreen() {
  const { colors } = useTheme();
  const { user } = useAuth();
  const canWrite = canWriteResource(user?.role, 'installations');
  const canComplete = ['super_admin', 'director', 'installation_manager', 'gps_installer', 'cctv_technician'].includes(user?.role);

  const [installations, setInstallations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [search, setSearch] = useState('');
  const [selectedType, setSelectedType] = useState('All');

  // Modal
  const [modalVisible, setModalVisible] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [saving, setSaving] = useState(false);
  const [proofJob, setProofJob] = useState(null);
  const [proofMode, setProofMode] = useState('view');
  const [proofPhotos, setProofPhotos] = useState([null, null, null, null, null]);
  const [proofNotes, setProofNotes] = useState('');
  const [proofCameras, setProofCameras] = useState('4');
  const [proofDvr, setProofDvr] = useState('');
  const [submittingProof, setSubmittingProof] = useState(false);
  const [formData, setFormData] = useState({
    type: 'gps',
    customerId: '',
    customer: '',
    vehicle: '',
    imei: '',
    sim: '',
    phone: '',
    email: '',
    location: '',
    deviceType: '',
    installer: '',
    site: '',
    dvr: '',
    cameras: '4',
    date: new Date().toISOString().split('T')[0],
    status: 'Pending',
    reportNotes: ''
  });

  const fetchInstallations = useCallback(async () => {
    try {
      const jobs = await apiGetAll('/installations');
      setInstallations(Array.isArray(jobs) ? jobs : []);
    } catch (err) {
      Alert.alert('Error', err.message || 'Failed to fetch installations');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    fetchInstallations();
  }, [fetchInstallations]);

  const onRefresh = () => {
    setRefreshing(true);
    fetchInstallations();
  };

  const openAddModal = () => {
    setEditingId(null);
    setFormData({
      type: 'gps',
      customerId: '',
      customer: '',
      vehicle: '',
      imei: '',
      sim: '',
      phone: '',
      email: '',
      location: '',
      deviceType: '',
      installer: user?.name || '',
      site: '',
      dvr: '',
      cameras: '4',
      date: new Date().toISOString().split('T')[0],
      status: 'Pending',
      reportNotes: ''
    });
    setModalVisible(true);
  };

  const openEditModal = (item) => {
    setEditingId(item.id);
    const rawType = (item.type || 'gps').toLowerCase();
    const normalizedType = rawType === 'gps' ? 'gps' : 'cctv';
    setFormData({
      type: normalizedType,
      customerId: String(item.customerId || ''),
      customer: item.customer || '',
      vehicle: item.vehicle || '',
      imei: item.imei || '',
      sim: item.sim || '',
      phone: item.phone || '',
      email: item.email || '',
      location: item.location || '',
      deviceType: item.deviceType || '',
      installer: item.installer || '',
      site: item.site || '',
      dvr: item.dvr || '',
      cameras: String(item.cameras != null ? item.cameras : '4'),
      date: String(item.date || '').slice(0, 10),
      status: item.status || 'Pending',
      reportNotes: item.reportNotes || ''
    });
    setModalVisible(true);
  };

  const handleSave = async () => {
    if (!formData.customer?.trim()) {
      Alert.alert('Validation Error', 'Enter a customer name.');
      return;
    }

    setSaving(true);
    try {
      const typeMap = {
        gps: 'GPS',
        cctv: 'CCTV'
      };
      const normalizedType = typeMap[String(formData.type).toLowerCase()] || 'GPS';
      const cameras = normalizedType === 'CCTV' ? (Number.parseInt(formData.cameras, 10) || 0) : 0;

      const payload = {
        ...formData,
        type: normalizedType,
        cameras,
        customer: formData.customer.trim(),
        installer: formData.installer?.trim() || '',
        ...(normalizedType === 'CCTV' ? { tech: formData.installer?.trim() || '' } : {})
      };
      delete payload.customerId;

      if (editingId) {
        await apiPut(`/installations/${editingId}`, payload);
        Alert.alert('Success', 'Installation updated');
      } else {
        await apiPost('/installations', payload);
        Alert.alert('Success', 'Installation job scheduled');
      }
      setModalVisible(false);
      fetchInstallations();
    } catch (err) {
      Alert.alert('Error', err.message || 'Failed to save installation');
    } finally {
      setSaving(false);
    }
  };

  const openProof = (item) => {
    setProofJob(item);
    setProofMode(item.status === 'Completed' ? 'view' : 'submit');
    setProofPhotos([null, null, null, null, null]);
    setProofNotes(item.reportNotes || '');
    setProofCameras(String(item.cameras || 4));
    setProofDvr(item.dvr || '');
  };

  const pickProofPhoto = async (index) => {
    try {
      const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (permission.status !== 'granted') return Alert.alert('Permission needed', 'Allow photo access to upload completion proof.');
      const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ImagePicker.MediaTypeOptions.Images, quality: 0.8 });
      if (result.canceled || !result.assets?.[0]) return;
      setProofPhotos(current => current.map((photo, position) => position === index ? result.assets[0] : photo));
    } catch (error) { Alert.alert('Photo error', error.message); }
  };

  const submitProof = async () => {
    if (!proofJob || proofPhotos.some(photo => !photo)) return Alert.alert('Five images required', 'Please select all five proof images.');
    if (proofJob.type === 'CCTV' && (!Number(proofCameras) || !proofDvr.trim())) {
      return Alert.alert('Details required', 'Enter the camera count and NVR/DVR serial number.');
    }
    const form = new FormData();
    form.append('reportNotes', proofNotes);
    if (proofJob.type === 'CCTV') {
      form.append('cameras', proofCameras);
      form.append('dvr', proofDvr.trim());
    }
    proofPhotos.forEach((photo, index) => form.append('photos', {
      uri: photo.uri,
      name: photo.fileName || `proof_${index + 1}.jpg`,
      type: photo.mimeType || 'image/jpeg'
    }));
    setSubmittingProof(true);
    try {
      await apiUpload(`/installations/${proofJob.id}/proof`, form, { timeoutMs: 120000 });
      setProofJob(null);
      await fetchInstallations();
      Alert.alert('Completed', 'The five proof images and completion report were saved.');
    } catch (error) { Alert.alert('Completion failed', error.message); }
    finally { setSubmittingProof(false); }
  };

  const downloadProof = async (index) => {
    try {
      const [baseUrl, token] = await Promise.all([getServerUrl(), getAuthToken()]);
      const url = `${baseUrl}/installations/${proofJob.id}/proof/photo?index=${index}`;
      const localPath = `${FileSystem.documentDirectory}installation-${proofJob.id}-proof-${index + 1}.${proofExtension(proofJob.reportPhoto, index)}`;
      const result = await FileSystem.downloadAsync(url, localPath, { headers: token ? { Authorization: `Bearer ${token}` } : {} });
      if (result.status !== 200) throw new Error('Could not download the proof image.');
      if (await Sharing.isAvailableAsync()) await Sharing.shareAsync(result.uri);
      else Alert.alert('Saved', result.uri);
    } catch (error) { Alert.alert('Download failed', error.message); }
  };

  const filtered = installations.filter((i) => {
    if (user?.role === 'gps_installer') {
      if (i.type !== 'GPS') return false;
      if (user?.name && (i.installer || '').trim().toLowerCase() !== user.name.trim().toLowerCase()) return false;
    } else if (user?.role === 'cctv_technician') {
      if (i.type !== 'CCTV') return false;
      if (user?.name && ![i.tech, i.installer].some(value => String(value || '').trim().toLowerCase() === user.name.trim().toLowerCase())) return false;
    }

    const matchSearch =
      (i.customer || '').toLowerCase().includes(search.toLowerCase()) ||
      (i.vehicle || '').toLowerCase().includes(search.toLowerCase()) ||
      (i.installer || '').toLowerCase().includes(search.toLowerCase()) ||
      (i.site || '').toLowerCase().includes(search.toLowerCase());

    const itemType = (i.type || '').toLowerCase();
    const filterType = selectedType.toLowerCase();
    const matchType = filterType === 'all' || itemType === filterType;
    return matchSearch && matchType;
  });

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <Header
        title="Field Installations"
        subtitle={`${installations.length} total deployment jobs`}
        rightElement={canWrite ? (
          <TouchableOpacity
            style={[styles.addBtn, { backgroundColor: colors.primary }]}
            onPress={openAddModal}
            activeOpacity={0.8}
          >
            <Plus size={16} color="#ffffff" />
            <Text style={styles.addBtnText}>Schedule</Text>
          </TouchableOpacity>
        ) : null}
      />

      {/* Filter Section */}
      <View style={[styles.filterSection, { backgroundColor: colors.card, borderBottomColor: colors.border }]}>
        <SearchInput
          value={search}
          onChangeText={setSearch}
          placeholder="Search customer, vehicle, technician..."
        />

        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.filterScroll}>
          {TYPES.map((t, i) => {
            const isSelected = selectedType === t;
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
                onPress={() => setSelectedType(t)}
              >
                <Text style={[styles.filterChipText, { color: isSelected ? '#ffffff' : colors.textMuted }]}>
                  {t === 'all' ? 'All' : t.toUpperCase()}
                </Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>
      </View>

      {/* Installation List */}
      {loading ? (
        <LoadingSpinner message="Loading installation jobs..." />
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
              title="No installation jobs found"
              description="Tap 'Schedule' to dispatch an installer."
              icon={Wrench}
              actionText={canWrite ? 'Schedule Job' : undefined}
              onAction={canWrite ? openAddModal : undefined}
            />
          }
          renderItem={({ item }) => {
            const rawType = (item.type || 'gps').toLowerCase();
            const displayType = rawType.toUpperCase();
            const isGps = rawType === 'gps';
            const isCctv = rawType === 'cctv';
            return (
              <View style={[styles.instCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
                <View style={styles.cardHeader}>
                  <View style={{ flex: 1, marginRight: 8 }}>
                    <View style={styles.typeBadge}>
                      <Text style={styles.typeBadgeText}>{displayType}</Text>
                    </View>
                    <Text style={[styles.customerName, { color: colors.text }]}>{item.customer}</Text>
                  </View>
                  <Badge label={item.status || 'Pending'} />
                </View>

                {/* Type-specific info */}
                {isGps && item.vehicle ? (
                  <View style={styles.metaRow}>
                    <Truck size={14} color="#10b981" />
                    <Text style={[styles.metaText, { color: colors.text }]}>Vehicle: {item.vehicle}</Text>
                    {item.imei ? <Text style={[styles.metaSub, { color: colors.textMuted }]}>({item.imei})</Text> : null}
                  </View>
                ) : null}

                {isCctv && item.site ? (
                  <View style={styles.metaRow}>
                    <Camera size={14} color="#3b82f6" />
                    <Text style={[styles.metaText, { color: colors.text }]}>Site: {item.site}</Text>
                    {item.cameras ? <Text style={[styles.metaSub, { color: colors.textMuted }]}>({item.cameras} cams)</Text> : null}
                  </View>
                ) : null}

                <View style={[styles.cardFooter, { borderTopColor: colors.border }]}>
                  {item.installer ? (
                    <View style={styles.techRow}>
                      <User size={12} color={colors.primary} />
                      <Text style={[styles.techText, { color: colors.textMuted }]}>Tech: {item.installer}</Text>
                    </View>
                  ) : <View />}

                  <View style={styles.footerActions}>
                    {item.date ? (
                      <View style={styles.techRow}>
                        <Calendar size={12} color={colors.textMuted} />
                        <Text style={[styles.techText, { color: colors.textMuted }]}>{String(item.date).slice(0, 10)}</Text>
                      </View>
                    ) : null}
                    {(item.status === 'Completed' || canComplete) && (isGps || isCctv) ? (
                      <TouchableOpacity style={[styles.editJobBtn, { borderColor: colors.primary }]} onPress={() => openProof(item)} accessibilityRole="button" accessibilityLabel={`${item.status === 'Completed' ? 'View proof for' : 'Complete'} installation for ${item.customer}`}>
                        <Text style={{ color: colors.primary, fontWeight: '700', fontSize: 12 }}>{item.status === 'Completed' ? `Proof (${proofCount(item.reportPhoto)})` : 'Complete'}</Text>
                      </TouchableOpacity>
                    ) : null}
                    {canWrite && item.status !== 'Completed' ? (
                      <TouchableOpacity style={[styles.editJobBtn, { borderColor: colors.primary }]} onPress={() => openEditModal(item)} accessibilityRole="button" accessibilityLabel={`Edit installation for ${item.customer}`}>
                        <Text style={{ color: colors.primary, fontWeight: '700', fontSize: 12 }}>Edit</Text>
                      </TouchableOpacity>
                    ) : null}
                  </View>
                </View>
              </View>
            );
          }}
        />
      )}

      {/* Add / Edit Modal */}
      <AnimatedModal visible={modalVisible} onRequestClose={() => setModalVisible(false)}>
        <View style={[styles.modalContent, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <View style={[styles.modalHeader, { borderBottomColor: colors.border }]}>
            <Text style={[styles.modalTitle, { color: colors.text }]}>{editingId ? 'Edit Installation' : 'Schedule Installation'}</Text>
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
            <Text style={[styles.inputLabel, { color: colors.textSecondary }]}>Installation Type</Text>
            <View style={styles.choiceRow}>
              {['gps', 'cctv'].map((t, i) => (
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
                    {t.toUpperCase()}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            <Text style={[styles.inputLabel, { color: colors.textSecondary }]}>Customer *</Text>
            <TextInput
              style={[styles.formInput, { backgroundColor: colors.inputBg, color: colors.text, borderColor: colors.border }]}
              placeholder="Enter customer name"
              placeholderTextColor={colors.textMuted}
              value={formData.customer}
              onChangeText={(t) => setFormData({ ...formData, customer: t })}
            />

            {formData.type === 'gps' && [
              ['Customer Phone', 'phone', 'phone-pad'],
              ['Customer Email', 'email', 'email-address'],
              ['Installation Location', 'location', 'default'],
              ['Device Type', 'deviceType', 'default']
            ].map(([label, key, keyboardType]) => (
              <React.Fragment key={key}>
                <Text style={[styles.inputLabel, { color: colors.textSecondary }]}>{label}</Text>
                <TextInput style={[styles.formInput, { backgroundColor: colors.inputBg, color: colors.text, borderColor: colors.border }]}
                  placeholder={label} placeholderTextColor={colors.textMuted} value={formData[key]}
                  keyboardType={keyboardType} onChangeText={value => setFormData(current => ({ ...current, [key]: value }))} />
              </React.Fragment>
            ))}

            {formData.type === 'gps' && (
              <>
                <Text style={[styles.inputLabel, { color: colors.textSecondary }]}>Vehicle Reg. Number</Text>
                <TextInput
                  style={[styles.formInput, { backgroundColor: colors.inputBg, color: colors.text, borderColor: colors.border }]}
                  placeholder="e.g. MH 12 AB 1234"
                  placeholderTextColor={colors.textMuted}
                  value={formData.vehicle}
                  onChangeText={(t) => setFormData({ ...formData, vehicle: t })}
                />

                <Text style={[styles.inputLabel, { color: colors.textSecondary }]}>GPS Tracker IMEI Number</Text>
                <TextInput
                  style={[styles.formInput, { backgroundColor: colors.inputBg, color: colors.text, borderColor: colors.border }]}
                  placeholder="e.g. 860123456789012"
                  placeholderTextColor={colors.textMuted}
                  value={formData.imei}
                  onChangeText={(t) => setFormData({ ...formData, imei: t })}
                />
              </>
            )}

            {formData.type === 'cctv' && (
              <>
                <Text style={[styles.inputLabel, { color: colors.textSecondary }]}>Site Location / Address</Text>
                <TextInput
                  style={[styles.formInput, { backgroundColor: colors.inputBg, color: colors.text, borderColor: colors.border }]}
                  placeholder="e.g. Warehouse 3, MIDC Industrial Area"
                  placeholderTextColor={colors.textMuted}
                  value={formData.site}
                  onChangeText={(t) => setFormData({ ...formData, site: t })}
                />

                <Text style={[styles.inputLabel, { color: colors.textSecondary }]}>Total Cameras Count</Text>
                <TextInput
                  style={[styles.formInput, { backgroundColor: colors.inputBg, color: colors.text, borderColor: colors.border }]}
                  placeholder="4"
                  placeholderTextColor={colors.textMuted}
                  value={formData.cameras}
                  onChangeText={(t) => setFormData({ ...formData, cameras: t })}
                  keyboardType="numeric"
                />
                <Text style={[styles.inputLabel, { color: colors.textSecondary }]}>NVR/DVR Specification</Text>
                <TextInput style={[styles.formInput, { backgroundColor: colors.inputBg, color: colors.text, borderColor: colors.border }]}
                  placeholder="NVR/DVR details" placeholderTextColor={colors.textMuted} value={formData.dvr}
                  onChangeText={value => setFormData(current => ({ ...current, dvr: value }))} />
              </>
            )}

            <Text style={[styles.inputLabel, { color: colors.textSecondary }]}>Assigned Technician / Installer</Text>
            <TextInput
              style={[styles.formInput, { backgroundColor: colors.inputBg, color: colors.text, borderColor: colors.border }]}
              placeholder="Enter technician / installer name"
              placeholderTextColor={colors.textMuted}
              value={formData.installer}
              onChangeText={(t) => setFormData({ ...formData, installer: t })}
            />

            <Text style={[styles.inputLabel, { color: colors.textSecondary }]}>Scheduled Date (YYYY-MM-DD)</Text>
            <TextInput
              style={[styles.formInput, { backgroundColor: colors.inputBg, color: colors.text, borderColor: colors.border }]}
              placeholder="2026-08-25"
              placeholderTextColor={colors.textMuted}
              value={formData.date}
              onChangeText={(t) => setFormData({ ...formData, date: t })}
            />

            <Text style={[styles.inputLabel, { color: colors.textSecondary }]}>Job Notes & Observations</Text>
            <TextInput
              style={[styles.formInput, styles.textArea, { backgroundColor: colors.inputBg, color: colors.text, borderColor: colors.border }]}
              placeholder="Wiring details, power connection notes..."
              placeholderTextColor={colors.textMuted}
              value={formData.reportNotes}
              onChangeText={(t) => setFormData({ ...formData, reportNotes: t })}
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
              onPress={handleSave}
              disabled={saving}
            >
              <Text style={{ color: '#ffffff', fontWeight: '700' }}>
                {saving ? 'Saving...' : editingId ? 'Update Job' : 'Schedule Job'}
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </AnimatedModal>
      <AnimatedModal visible={Boolean(proofJob)} onRequestClose={() => setProofJob(null)}>
        <View style={[styles.modalContent, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <View style={[styles.modalHeader, { borderBottomColor: colors.border }]}>
            <Text style={[styles.modalTitle, { color: colors.text }]}>{proofMode === 'view' ? 'Completion Proof' : 'Job Completion & Proof'}</Text>
            <TouchableOpacity onPress={() => setProofJob(null)}><X size={20} color={colors.textMuted} /></TouchableOpacity>
          </View>
          <ScrollView style={styles.modalForm} contentContainerStyle={styles.modalFormContent} keyboardShouldPersistTaps="handled">
            <Text style={{ color: colors.textSecondary }}>{proofJob?.customer} · {proofJob?.vehicle || proofJob?.site || proofJob?.type}</Text>
            {proofMode === 'view' ? (
              <>
                <Text style={[styles.inputLabel, { color: colors.textSecondary }]}>Job Notes / Remarks</Text>
                <Text style={{ color: colors.text }}>{proofJob?.reportNotes || 'No remarks entered.'}</Text>
                <Text style={[styles.inputLabel, { color: colors.textSecondary }]}>Proof Images</Text>
                {proofCount(proofJob?.reportPhoto) ? Array.from({ length: proofCount(proofJob?.reportPhoto) }, (_, index) => (
                  <TouchableOpacity key={index} style={[styles.choiceChip, { borderColor: colors.primary, marginBottom: 8 }]} onPress={() => downloadProof(index)}>
                    <Text style={{ color: colors.primary }}>Open / share image {index + 1}</Text>
                  </TouchableOpacity>
                )) : <Text style={{ color: colors.textMuted }}>No images saved for this older record.</Text>}
              </>
            ) : (
              <>
                {proofJob?.type === 'CCTV' ? (
                  <>
                    <Text style={[styles.inputLabel, { color: colors.textSecondary }]}>Cameras Installed *</Text>
                    <TextInput style={[styles.formInput, { backgroundColor: colors.inputBg, color: colors.text, borderColor: colors.border }]}
                      keyboardType="numeric" value={proofCameras} onChangeText={setProofCameras} />
                    <Text style={[styles.inputLabel, { color: colors.textSecondary }]}>NVR/DVR Serial Number *</Text>
                    <TextInput style={[styles.formInput, { backgroundColor: colors.inputBg, color: colors.text, borderColor: colors.border }]}
                      value={proofDvr} onChangeText={setProofDvr} />
                  </>
                ) : null}
                <Text style={[styles.inputLabel, { color: colors.textSecondary }]}>Proof Images · {proofPhotos.filter(Boolean).length}/5</Text>
                {proofPhotos.map((photo, index) => (
                  <View key={index} style={{ flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 8 }}>
                    <TouchableOpacity style={[styles.choiceChip, { borderColor: colors.primary, flex: 1 }]} onPress={() => pickProofPhoto(index)}>
                      <Text style={{ color: colors.primary }} numberOfLines={1}>{photo ? photo.fileName || `Image ${index + 1} selected` : `+ Select image ${index + 1}`}</Text>
                    </TouchableOpacity>
                    {photo ? <TouchableOpacity onPress={() => setProofPhotos(current => current.map((value, position) => position === index ? null : value))}><X size={18} color={colors.danger} /></TouchableOpacity> : null}
                  </View>
                ))}
                <Text style={[styles.inputLabel, { color: colors.textSecondary }]}>Job Notes / Remarks</Text>
                <TextInput style={[styles.formInput, styles.textArea, { backgroundColor: colors.inputBg, color: colors.text, borderColor: colors.border }]}
                  value={proofNotes} onChangeText={setProofNotes} multiline placeholder="Work completed and verified..." placeholderTextColor={colors.textMuted} />
              </>
            )}
          </ScrollView>
          {proofMode === 'submit' ? <View style={[styles.modalFooter, { borderTopColor: colors.border }]}>
            <TouchableOpacity style={[styles.saveBtn, { backgroundColor: colors.primary }]} onPress={submitProof} disabled={submittingProof}>
              <Text style={{ color: '#fff', fontWeight: '700' }}>{submittingProof ? 'Submitting...' : 'Submit Completion Report'}</Text>
            </TouchableOpacity>
          </View> : null}
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
  instCard: {
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
  typeBadge: {
    alignSelf: 'flex-start',
    backgroundColor: 'rgba(99, 102, 241, 0.12)',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    marginBottom: 4,
  },
  typeBadgeText: {
    color: '#6366f1',
    fontSize: 10,
    fontWeight: '800',
  },
  customerName: {
    fontSize: 16,
    fontWeight: '700',
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 2,
  },
  metaText: {
    fontSize: 13,
    fontWeight: '600',
  },
  metaSub: {
    fontSize: 12,
  },
  cardFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderTopWidth: 1,
    paddingTop: 10,
    marginTop: 6,
  },
  techRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  techText: {
    fontSize: 12,
  },
  footerActions: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  editJobBtn: { minHeight: 36, paddingHorizontal: 12, borderRadius: 8, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
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
