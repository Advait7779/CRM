import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Alert, FlatList, RefreshControl, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import AnimatedModal from '../../components/common/AnimatedModal';
import ConfirmDeleteModal from '../../components/common/ConfirmDeleteModal';
import * as DocumentPicker from 'expo-document-picker';
import * as FileSystem from 'expo-file-system/legacy';
import * as Sharing from 'expo-sharing';
import { CalendarDays, Check, Clock, Download, FileText, LogIn, LogOut, Plus, Trash2, X } from 'lucide-react-native';
import { useTheme } from '../../context/ThemeContext';
import { useAuth } from '../../context/AuthContext';
import { ADMIN } from '../../config/permissions';
import { apiDelete, apiGet, apiGetAll, apiPost, apiPut, apiUpload, getAuthToken, getServerUrl } from '../../config/api';
import Header from '../../components/common/Header';
import Badge from '../../components/common/Badge';
import LoadingSpinner from '../../components/common/LoadingSpinner';
import EmptyState from '../../components/common/EmptyState';

const today = new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' });
const currentPeriod = today.slice(0, 7);
const tabs = ['Attendance', 'Leave', 'Documents', 'Payslips'];
const money = value => `₹${Number(value || 0).toLocaleString('en-IN', { maximumFractionDigits: 2 })}`;
const dateOnly = value => String(value || '').slice(0, 10);

async function downloadProtected(path, filename) {
  const [baseUrl, token] = await Promise.all([getServerUrl(), getAuthToken()]);
  const safeName = String(filename || 'document').replace(/[^a-zA-Z0-9._-]/g, '_');
  const result = await FileSystem.downloadAsync(`${baseUrl}${path}`, `${FileSystem.documentDirectory}${safeName}`, { headers: token ? { Authorization: `Bearer ${token}` } : {} });
  if (result.status !== 200) throw new Error('Download failed.');
  if (await Sharing.isAvailableAsync()) await Sharing.shareAsync(result.uri);
  else Alert.alert('Saved', result.uri);
}

export default function MyWorkScreen() {
  const { colors } = useTheme();
  const { user } = useAuth();
  const isAdmin = ADMIN.includes(user?.role);
  const [activeTab, setActiveTab] = useState('Attendance');
  const [data, setData] = useState(null);
  const [payslips, setPayslips] = useState([]);
  const [approvals, setApprovals] = useState([]);
  const [selectedPayslip, setSelectedPayslip] = useState(null);
  const [activePayslip, setActivePayslip] = useState(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    if (selectedPayslip) setActivePayslip(selectedPayslip);
  }, [selectedPayslip]);
  const [busy, setBusy] = useState(false);
  const [leaveModal, setLeaveModal] = useState(false);
  const [leave, setLeave] = useState({ type: 'Paid', startDate: '', endDate: '', reason: '' });
  const [confirmModal, setConfirmModal] = useState(null);
  const [isDeleting, setIsDeleting] = useState(false);

  const load = useCallback(async () => {
    const requests = [apiGet(`/my/hr?period=${currentPeriod}`), apiGet(`/my/payslips?period=${currentPeriod}`), ...(isAdmin ? [apiGetAll('/leaves')] : [])];
    const results = await Promise.allSettled(requests);
    if (results[0].status === 'fulfilled') setData(results[0].value);
    else setData(null);
    if (results[1].status === 'fulfilled') setPayslips(Array.isArray(results[1].value) ? results[1].value : []);
    if (isAdmin && results[2]?.status === 'fulfilled') setApprovals(results[2].value);
    if (results[0].status === 'rejected' && !isAdmin) Alert.alert('Employee Link Required', results[0].reason.message);
    setLoading(false); setRefreshing(false);
  }, [isAdmin]);

  useEffect(() => { load(); }, [load]);
  const availableTabs = isAdmin ? [...tabs, 'Approvals'] : tabs;
  const todayRecord = useMemo(() => data?.attendance?.find(row => dateOnly(row.date) === today), [data]);

  const attendanceAction = async action => {
    if (!data?.employee) return Alert.alert('Employee Link Required', 'Ask an administrator to link your login email to your employee record.');
    const now = new Date().toTimeString().slice(0, 8);
    const checkIn = action === 'in' ? now : todayRecord?.checkIn;
    const checkOut = action === 'out' ? now : null;
    let hoursWorked = null;
    if (checkIn && checkOut) hoursWorked = Math.max(0, (new Date(`${today}T${checkOut}`) - new Date(`${today}T${checkIn}`)) / 3600000);
    setBusy(true);
    try {
      await apiPut(`/attendance/${data.employee.id}`, { date: today, status: 'Present', checkIn, checkOut, hoursWorked });
      Alert.alert('Success', action === 'in' ? 'Checked in successfully.' : 'Checked out successfully.');
      await load();
    } catch (error) { Alert.alert('Error', error.message); } finally { setBusy(false); }
  };

  const requestLeave = async () => {
    if (!leave.startDate || !leave.endDate || !leave.reason.trim()) return Alert.alert('Required', 'Enter dates and a reason.');
    setBusy(true);
    try {
      await apiPost('/leaves', leave);
      setLeave({ type: 'Paid', startDate: '', endDate: '', reason: '' });
      setLeaveModal(false);
      Alert.alert('Submitted', 'Your leave request was sent for approval.');
      await load();
    } catch (error) { Alert.alert('Error', error.message); } finally { setBusy(false); }
  };

  const uploadDocument = async () => {
    if (!data?.employee) return Alert.alert('Employee Link Required', 'Ask an administrator to link your login email to your employee record.');
    try {
      const result = await DocumentPicker.getDocumentAsync({ copyToCacheDirectory: true, multiple: false });
      if (result.canceled || !result.assets?.[0]) return;
      const asset = result.assets[0];
      const form = new FormData();
      form.append('type', 'Employee Document');
      form.append('document', { uri: asset.uri, name: asset.name || 'document', type: asset.mimeType || 'application/octet-stream' });
      setBusy(true);
      await apiUpload('/my/documents', form);
      Alert.alert('Uploaded', 'Employee document stored securely.');
      await load();
    } catch (error) { Alert.alert('Upload Error', error.message); } finally { setBusy(false); }
  };

  const cancelLeave = item => setConfirmModal({
    title: 'Cancel Leave',
    subtitle: `${item.type} Leave (${dateOnly(item.startDate)} - ${dateOnly(item.endDate)})`,
    message: 'Are you sure you want to cancel this pending leave request?',
    confirmText: 'Cancel Leave',
    onConfirm: async () => {
      setIsDeleting(true);
      try {
        await apiDelete(`/leaves/${item.id}`);
        setConfirmModal(null);
        await load();
      } catch (error) {
        Alert.alert('Error', error.message);
      } finally {
        setIsDeleting(false);
      }
    }
  });
  const deleteDocument = item => setConfirmModal({
    title: 'Delete Document',
    subtitle: item.originalName,
    message: `Are you sure you want to delete ${item.originalName}? This document will be permanently removed.`,
    confirmText: 'Delete Document',
    onConfirm: async () => {
      setIsDeleting(true);
      try {
        await apiDelete(`/employee-documents/${item.id}`);
        setConfirmModal(null);
        await load();
      } catch (error) {
        Alert.alert('Error', error.message);
      } finally {
        setIsDeleting(false);
      }
    }
  });
  const reviewLeave = async (id, status) => { try { await apiPut(`/leaves/${id}/status`, { status }); await load(); } catch (error) { Alert.alert('Error', error.message); } };

  if (loading) return <LoadingSpinner message="Loading your HR records..." />;

  const renderAttendance = () => !data?.employee ? <EmptyState title="Employee record not linked" description="Ask an administrator to use your login email on your employee profile." icon={Clock} /> : <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false} overScrollMode="never" refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(); }} tintColor={colors.primary} />}>
    <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}><Clock size={28} color={colors.primary} /><Text style={[styles.cardTitle, { color: colors.text }]}>Today · {today}</Text><Badge label={todayRecord?.status || 'Not checked in'} /><Text style={[styles.meta, { color: colors.textMuted }]}>Check in: {todayRecord?.checkIn || '—'}  ·  Check out: {todayRecord?.checkOut || '—'}</Text><Text style={[styles.meta, { color: colors.textMuted }]}>Hours worked: {todayRecord?.hoursWorked ? Number(todayRecord.hoursWorked).toFixed(1) : '—'}</Text><View style={styles.actionRow}><TouchableOpacity disabled={busy || Boolean(todayRecord?.checkIn)} style={[styles.primaryBtn, { backgroundColor: colors.primary }, (busy || todayRecord?.checkIn) && styles.disabled]} onPress={() => attendanceAction('in')}><LogIn size={16} color="#fff" /><Text style={styles.primaryText}>Check In</Text></TouchableOpacity><TouchableOpacity disabled={busy || !todayRecord?.checkIn || Boolean(todayRecord?.checkOut)} style={[styles.outlineBtn, { borderColor: colors.primary }, (busy || !todayRecord?.checkIn || todayRecord?.checkOut) && styles.disabled]} onPress={() => attendanceAction('out')}><LogOut size={16} color={colors.primary} /><Text style={{ color: colors.primary, fontWeight: '700' }}>Check Out</Text></TouchableOpacity></View></View>
    <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}><CalendarDays size={26} color="#10b981" /><Text style={[styles.cardTitle, { color: colors.text }]}>Monthly summary</Text><Text style={[styles.meta, { color: colors.textMuted }]}>{data.attendance.filter(row => ['Present', 'Late'].includes(row.status)).length} attended · {data.attendance.filter(row => row.status === 'Late').length} late · {data.payroll?.absentDays || 0} absent</Text></View>
  </ScrollView>;

  const renderLeave = () => !data?.employee ? <EmptyState title="Employee record not linked" description="Link your login email to an employee profile before requesting leave." icon={CalendarDays} /> : <FlatList contentContainerStyle={styles.content} showsVerticalScrollIndicator={false} overScrollMode="never" scrollEventThrottle={16} data={data?.leaves || []} keyExtractor={item => String(item.id)} refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(); }} tintColor={colors.primary} />} ListHeaderComponent={<TouchableOpacity style={[styles.primaryBtn, { backgroundColor: colors.primary, alignSelf: 'flex-start' }]} onPress={() => setLeaveModal(true)}><Plus size={16} color="#fff" /><Text style={styles.primaryText}>Request Leave</Text></TouchableOpacity>} ListEmptyComponent={<EmptyState title="No leave requests" description="Your leave requests will appear here." icon={CalendarDays} />} renderItem={({ item }) => <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}><View style={styles.between}><View><Text style={[styles.cardTitle, { color: colors.text }]}>{item.type} Leave</Text><Text style={[styles.meta, { color: colors.textMuted }]}>{dateOnly(item.startDate)} – {dateOnly(item.endDate)} · {item.days} days</Text></View><Badge label={item.status} /></View><Text style={[styles.body, { color: colors.textSecondary }]}>{item.reason}</Text>{item.status === 'Pending' && <TouchableOpacity style={[styles.smallBtn, { borderColor: colors.danger }]} onPress={() => cancelLeave(item)}><X size={14} color={colors.danger} /><Text style={{ color: colors.danger, fontWeight: '700' }}>Cancel</Text></TouchableOpacity>}</View>} />;

  const renderDocuments = () => !data?.employee ? <EmptyState title="Employee record not linked" description="Link your login email to an employee profile before uploading documents." icon={FileText} /> : <FlatList contentContainerStyle={styles.content} showsVerticalScrollIndicator={false} overScrollMode="never" scrollEventThrottle={16} data={data?.documents || []} keyExtractor={item => String(item.id)} ListHeaderComponent={<TouchableOpacity disabled={busy || !data} style={[styles.primaryBtn, { backgroundColor: colors.primary, alignSelf: 'flex-start' }, (!data || busy) && styles.disabled]} onPress={uploadDocument}><Plus size={16} color="#fff" /><Text style={styles.primaryText}>Upload Document</Text></TouchableOpacity>} ListEmptyComponent={<EmptyState title="No employee documents" description="Upload identity, qualification or employment documents." icon={FileText} />} renderItem={({ item }) => <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}><Text style={[styles.cardTitle, { color: colors.text }]}>{item.originalName}</Text><Text style={[styles.meta, { color: colors.textMuted }]}>{item.type} · {(Number(item.size) / 1024 / 1024).toFixed(2)} MB</Text><View style={styles.actionRow}><TouchableOpacity style={[styles.smallBtn, { borderColor: colors.primary }]} onPress={() => downloadProtected(`/employee-documents/${item.id}/download`, item.originalName).catch(error => Alert.alert('Download Error', error.message))}><Download size={14} color={colors.primary} /><Text style={{ color: colors.primary, fontWeight: '700' }}>Download</Text></TouchableOpacity><TouchableOpacity style={[styles.smallBtn, { borderColor: colors.danger }]} onPress={() => deleteDocument(item)}><Trash2 size={14} color={colors.danger} /><Text style={{ color: colors.danger, fontWeight: '700' }}>Delete</Text></TouchableOpacity></View></View>} />;

  const renderPayslips = () => !data?.employee ? <EmptyState title="Employee record not linked" description="Link your login email to an employee profile to access payslips." icon={FileText} /> : <FlatList contentContainerStyle={styles.content} showsVerticalScrollIndicator={false} overScrollMode="never" scrollEventThrottle={16} data={payslips} keyExtractor={item => String(item.id)} ListEmptyComponent={<EmptyState title="No payslips" description="Monthly payroll records will appear here." icon={FileText} />} renderItem={({ item }) => <TouchableOpacity style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]} onPress={() => setSelectedPayslip(item)}><View style={styles.between}><Text style={[styles.cardTitle, { color: colors.text }]}>{item.period}</Text><Badge label={item.status} /></View><Text style={[styles.net, { color: colors.primary }]}>{money(item.net)}</Text><Text style={[styles.meta, { color: colors.textMuted }]}>Gross {money(item.gross)} · Attendance deduction {money(item.attendanceDeduction)}</Text></TouchableOpacity>} />;

  const renderApprovals = () => <FlatList contentContainerStyle={styles.content} showsVerticalScrollIndicator={false} overScrollMode="never" scrollEventThrottle={16} data={approvals} keyExtractor={item => String(item.id)} ListEmptyComponent={<EmptyState title="No leave requests" description="Employee requests will appear here." icon={CalendarDays} />} renderItem={({ item }) => <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}><View style={styles.between}><View style={{ flex: 1 }}><Text style={[styles.cardTitle, { color: colors.text }]}>{item.employee?.name || `Employee #${item.employeeId}`}</Text><Text style={[styles.meta, { color: colors.textMuted }]}>{item.type} · {dateOnly(item.startDate)} – {dateOnly(item.endDate)}</Text></View><Badge label={item.status} /></View><Text style={[styles.body, { color: colors.textSecondary }]}>{item.reason}</Text>{item.status === 'Pending' && <View style={styles.actionRow}><TouchableOpacity style={[styles.smallBtn, { borderColor: '#10b981' }]} onPress={() => reviewLeave(item.id, 'Approved')}><Check size={14} color="#10b981" /><Text style={{ color: '#10b981', fontWeight: '700' }}>Approve</Text></TouchableOpacity><TouchableOpacity style={[styles.smallBtn, { borderColor: colors.danger }]} onPress={() => reviewLeave(item.id, 'Rejected')}><X size={14} color={colors.danger} /><Text style={{ color: colors.danger, fontWeight: '700' }}>Reject</Text></TouchableOpacity></View>}</View>} />;

  return <View style={[styles.container, { backgroundColor: colors.background }]}><Header title="My Work & HR" subtitle={data?.employee?.name || 'Employee self-service'} /><ScrollView horizontal showsHorizontalScrollIndicator={false} style={[styles.tabs, { borderBottomColor: colors.border }]} contentContainerStyle={{ paddingHorizontal: 12 }}>{availableTabs.map(tab => <TouchableOpacity key={tab} style={[styles.tab, activeTab === tab && { borderBottomColor: colors.primary }]} onPress={() => setActiveTab(tab)}><Text style={{ color: activeTab === tab ? colors.primary : colors.textMuted, fontWeight: '700' }}>{tab}</Text></TouchableOpacity>)}</ScrollView>{activeTab === 'Attendance' ? renderAttendance() : activeTab === 'Leave' ? renderLeave() : activeTab === 'Documents' ? renderDocuments() : activeTab === 'Payslips' ? renderPayslips() : renderApprovals()}

    <AnimatedModal visible={leaveModal} onRequestClose={() => setLeaveModal(false)}>
      <View style={[styles.modal, { backgroundColor: colors.card, borderColor: colors.border }]}>
        <View style={styles.modalHeader}>
          <Text style={[styles.modalTitle, { color: colors.text }]}>Request Leave</Text>
          <TouchableOpacity onPress={() => setLeaveModal(false)}>
            <X color={colors.textMuted} />
          </TouchableOpacity>
        </View>

        <ScrollView
          showsVerticalScrollIndicator={true}
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={styles.modalScrollContent}
        >
          <Text style={[styles.label, { color: colors.textSecondary }]}>Type</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false}>
            {['Paid', 'Sick', 'Unpaid', 'Other'].map(type => (
              <TouchableOpacity
                key={type}
                style={[
                  styles.choice,
                  {
                    borderColor: leave.type === type ? colors.primary : colors.border,
                    backgroundColor: leave.type === type ? colors.primary : colors.cardSecondary
                  }
                ]}
                onPress={() => setLeave(v => ({ ...v, type }))}
              >
                <Text style={{ color: leave.type === type ? '#fff' : colors.text }}>{type}</Text>
              </TouchableOpacity>
            ))}
          </ScrollView>

          <Text style={[styles.label, { color: colors.textSecondary }]}>Start date (YYYY-MM-DD)</Text>
          <TextInput
            style={[styles.input, { color: colors.text, borderColor: colors.border, backgroundColor: colors.inputBg }]}
            value={leave.startDate}
            onChangeText={value => setLeave(v => ({ ...v, startDate: value }))}
            placeholder="2026-08-27"
            placeholderTextColor={colors.textMuted}
          />

          <Text style={[styles.label, { color: colors.textSecondary }]}>End date (YYYY-MM-DD)</Text>
          <TextInput
            style={[styles.input, { color: colors.text, borderColor: colors.border, backgroundColor: colors.inputBg }]}
            value={leave.endDate}
            onChangeText={value => setLeave(v => ({ ...v, endDate: value }))}
            placeholder="2026-08-28"
            placeholderTextColor={colors.textMuted}
          />

          <Text style={[styles.label, { color: colors.textSecondary }]}>Reason</Text>
          <TextInput
            style={[styles.input, { color: colors.text, borderColor: colors.border, backgroundColor: colors.inputBg, height: 90, textAlignVertical: 'top' }]}
            multiline
            value={leave.reason}
            onChangeText={value => setLeave(v => ({ ...v, reason: value }))}
            placeholder="Describe reason for leave..."
            placeholderTextColor={colors.textMuted}
          />

          <TouchableOpacity
            style={[styles.primaryBtn, { backgroundColor: colors.primary, justifyContent: 'center', marginTop: 18 }]}
            disabled={busy}
            onPress={requestLeave}
          >
            <Text style={styles.primaryText}>{busy ? 'Submitting...' : 'Submit Request'}</Text>
          </TouchableOpacity>
        </ScrollView>
      </View>
    </AnimatedModal>

    <AnimatedModal visible={Boolean(selectedPayslip)} onRequestClose={() => setSelectedPayslip(null)}>
      {activePayslip && (
        <View style={[styles.modal, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <View style={styles.modalHeader}>
            <Text style={[styles.modalTitle, { color: colors.text }]}>Payslip · {activePayslip.period}</Text>
            <TouchableOpacity onPress={() => setSelectedPayslip(null)}>
              <X color={colors.textMuted} />
            </TouchableOpacity>
          </View>
          <ScrollView showsVerticalScrollIndicator={true} contentContainerStyle={styles.modalScrollContent}>
            {[
              ['Basic', activePayslip.basic],
              ['Incentive', activePayslip.incentive],
              [`Attendance (${activePayslip.absentDays} absent)`, -Number(activePayslip.attendanceDeduction || 0)],
              ['Other deductions', -Number(activePayslip.deduction || 0)],
              ['Net salary', activePayslip.net]
            ].map(([label, value]) => (
              <View key={label} style={[styles.payRow, { borderBottomColor: colors.border }]}>
                <Text style={{ color: colors.textSecondary }}>{label}</Text>
                <Text style={{ color: colors.text, fontWeight: label === 'Net salary' ? '800' : '600' }}>{money(value)}</Text>
              </View>
            ))}
          </ScrollView>
        </View>
      )}
    </AnimatedModal>

    <ConfirmDeleteModal
      visible={Boolean(confirmModal)}
      onClose={() => setConfirmModal(null)}
      title={confirmModal?.title || 'Delete'}
      subtitle={confirmModal?.subtitle}
      message={confirmModal?.message || 'Are you sure you want to proceed?'}
      confirmText={confirmModal?.confirmText || 'Delete'}
      loading={isDeleting}
      onConfirm={confirmModal?.onConfirm}
    />
  </View>;
}

const styles = StyleSheet.create({ container: { flex: 1 }, tabs: { maxHeight: 48, borderBottomWidth: 1 }, tab: { paddingHorizontal: 14, paddingVertical: 13, borderBottomWidth: 2, borderBottomColor: 'transparent' }, content: { padding: 14, gap: 12, paddingBottom: 40 }, card: { borderWidth: 1, borderRadius: 16, padding: 16, gap: 9 }, cardTitle: { fontSize: 16, fontWeight: '800' }, meta: { fontSize: 12, lineHeight: 18 }, body: { fontSize: 13, lineHeight: 19 }, net: { fontSize: 25, fontWeight: '900' }, between: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 10 }, actionRow: { flexDirection: 'row', gap: 9, flexWrap: 'wrap', marginTop: 7 }, primaryBtn: { flexDirection: 'row', alignItems: 'center', gap: 7, paddingHorizontal: 14, paddingVertical: 11, borderRadius: 10 }, primaryText: { color: '#fff', fontWeight: '800' }, outlineBtn: { flexDirection: 'row', alignItems: 'center', gap: 7, paddingHorizontal: 14, paddingVertical: 10, borderRadius: 10, borderWidth: 1 }, smallBtn: { flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 10, paddingVertical: 7, borderRadius: 8, borderWidth: 1, alignSelf: 'flex-start' }, disabled: { opacity: 0.45 }, overlay: { flex: 1, backgroundColor: 'rgba(15,23,42,0.55)', justifyContent: 'center', padding: 16 }, modal: { borderRadius: 20, borderWidth: 1, padding: 20, maxHeight: '100%', overflow: 'hidden', flexShrink: 1 }, modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14, flexShrink: 0 }, modalScrollContent: { paddingBottom: 16 }, modalTitle: { fontSize: 19, fontWeight: '800' }, label: { fontSize: 12, fontWeight: '700', marginTop: 14, marginBottom: 6 }, input: { borderWidth: 1, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 11 }, choice: { borderWidth: 1, borderRadius: 20, paddingHorizontal: 12, paddingVertical: 8, marginRight: 8 }, payRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 13, borderBottomWidth: 1 } });