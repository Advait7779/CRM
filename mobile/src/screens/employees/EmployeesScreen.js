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
import { apiGetAll, apiPost, apiPut, apiDelete } from '../../config/api';
import { canWriteResource } from '../../config/permissions';
import Header from '../../components/common/Header';
import SearchInput from '../../components/common/SearchInput';
import Badge from '../../components/common/Badge';
import EmptyState from '../../components/common/EmptyState';
import LoadingSpinner from '../../components/common/LoadingSpinner';
import AnimatedModal from '../../components/common/AnimatedModal';
import ConfirmDeleteModal from '../../components/common/ConfirmDeleteModal';
import {
  Users,
  Plus,
  Phone,
  Mail,
  Briefcase,
  X
} from 'lucide-react-native';

const DEPTS = ['All', 'Management', 'Sales', 'Technical', 'Field Operations', 'Accounts', 'Support'];

export default function EmployeesScreen() {
  const { colors } = useTheme();
  const { user } = useAuth();
  const canWrite = canWriteResource(user?.role, 'employees');

  const [employees, setEmployees] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [search, setSearch] = useState('');
  const [selectedDept, setSelectedDept] = useState('All');

  // Modal
  const [modalVisible, setModalVisible] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [saving, setSaving] = useState(false);
  const [confirmDeleteEmployee, setConfirmDeleteEmployee] = useState(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [formData, setFormData] = useState({
    name: '',
    dept: 'Sales',
    role: 'Sales Executive',
    phone: '',
    email: '',
    status: 'Active',
    basicSalary: '25000',
    payrollStatus: 'Processed'
  });

  const fetchEmployees = useCallback(async () => {
    try {
      const data = await apiGetAll('/employees');
      setEmployees(Array.isArray(data) ? data : []);
    } catch (err) {
      Alert.alert('Error', err.message || 'Failed to fetch employees');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    fetchEmployees();
  }, [fetchEmployees]);

  const onRefresh = () => {
    setRefreshing(true);
    fetchEmployees();
  };

  const openAddModal = () => {
    setEditingId(null);
    setFormData({
      name: '',
      dept: 'Sales',
      role: 'Sales Executive',
      phone: '',
      email: '',
      status: 'Active',
      basicSalary: '25000',
      payrollStatus: 'Pending'
    });
    setModalVisible(true);
  };

  const openEditModal = (item) => {
    setEditingId(item.id);
    setFormData({ name: item.name || '', dept: item.dept || 'Sales', role: item.role || '', phone: item.phone || '', email: item.email || '', status: item.status || 'Active', basicSalary: String(item.basicSalary || 0), payrollStatus: item.payrollStatus || 'Pending' });
    setModalVisible(true);
  };

  const handleDelete = (item) => {
    setConfirmDeleteEmployee(item);
  };

  const handleSave = async () => {
    if (!formData.name.trim() || !formData.phone.trim()) {
      Alert.alert('Validation Error', 'Employee Name and Phone are required.');
      return;
    }

    setSaving(true);
    try {
      const payload = { ...formData, basicSalary: Number(formData.basicSalary) || 0 };
      if (editingId) await apiPut(`/employees/${editingId}`, payload);
      else await apiPost('/employees', payload);
      Alert.alert('Success', editingId ? 'Employee updated' : 'Employee added');
      setModalVisible(false);
      fetchEmployees();
    } catch (err) {
      Alert.alert('Error', err.message || 'Failed to save employee');
    } finally {
      setSaving(false);
    }
  };

  const filtered = employees.filter(e => {
    const matchSearch =
      (e.name || '').toLowerCase().includes(search.toLowerCase()) ||
      (e.role || '').toLowerCase().includes(search.toLowerCase()) ||
      (e.phone || '').includes(search);

    const matchDept = selectedDept === 'All' || e.dept === selectedDept;
    return matchSearch && matchDept;
  });

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <Header
        title="Staff & Employees"
        subtitle={`${employees.length} team members`}
        rightElement={
          canWrite ? (
            <TouchableOpacity
              style={[styles.addBtn, { backgroundColor: colors.primary }]}
              onPress={openAddModal}
              activeOpacity={0.8}
            >
              <Plus size={16} color="#ffffff" />
              <Text style={styles.addBtnText}>Add Staff</Text>
            </TouchableOpacity>
          ) : null
        }
      />

      {/* Filter Section */}
      <View style={[styles.filterSection, { backgroundColor: colors.card, borderBottomColor: colors.border }]}>
        <SearchInput
          value={search}
          onChangeText={setSearch}
          placeholder="Search staff by name, role, phone..."
        />

        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.filterScroll}>
          {DEPTS.map((d, i) => {
            const isSelected = selectedDept === d;
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
                onPress={() => setSelectedDept(d)}
              >
                <Text style={[styles.filterChipText, { color: isSelected ? '#ffffff' : colors.textMuted }]}>
                  {d}
                </Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>
      </View>

      {/* Employee List */}
      {loading ? (
        <LoadingSpinner message="Loading team directory..." />
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
              title="No employees found"
              description="Tap 'Add Staff' to register team members."
              icon={Users}
              actionText={canWrite ? 'Add Employee' : undefined}
              onAction={canWrite ? openAddModal : undefined}
            />
          }
          renderItem={({ item }) => (
            <View style={[styles.employeeCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
              <View style={styles.cardHeader}>
                <View style={{ flex: 1 }}>
                  <Text style={[styles.employeeName, { color: colors.text }]}>{item.name}</Text>
                  <Text style={[styles.employeeRole, { color: colors.primary }]}>{item.role || item.dept}</Text>
                </View>
                <Badge label={item.status || 'Active'} />
              </View>

              <View style={styles.infoRow}>
                <View style={[styles.deptBadge, { backgroundColor: 'rgba(99, 102, 241, 0.12)' }]}>
                  <Briefcase size={12} color="#6366f1" />
                  <Text style={styles.deptBadgeText}>{item.dept}</Text>
                </View>

                {item.basicSalary ? (
                  <View style={[styles.deptBadge, { backgroundColor: 'rgba(16, 185, 129, 0.12)' }]}>
                    <Text style={{ fontSize: 11, fontWeight: '700', color: '#10b981' }}>
                      ₹{item.basicSalary}/mo
                    </Text>
                  </View>
                ) : null}
              </View>

              <View style={[styles.cardFooter, { borderTopColor: colors.border }]}>
                {item.phone ? (
                  <TouchableOpacity
                    style={styles.contactItem}
                    onPress={() => Linking.openURL(`tel:${item.phone}`)}
                  >
                    <Phone size={14} color="#10b981" />
                    <Text style={[styles.contactText, { color: colors.text }]}>{item.phone}</Text>
                  </TouchableOpacity>
                ) : <View />}

                {item.email ? (
                  <TouchableOpacity
                    style={styles.contactItem}
                    onPress={() => Linking.openURL(`mailto:${item.email}`)}
                  >
                    <Mail size={14} color="#3b82f6" />
                    <Text style={[styles.contactText, { color: colors.text }]}>{item.email}</Text>
                  </TouchableOpacity>
                ) : null}
              </View>
              {canWrite ? (
                <View style={styles.adminActions}>
                  <TouchableOpacity style={[styles.adminBtn, { borderColor: colors.primary }]} onPress={() => openEditModal(item)} accessibilityRole="button">
                    <Text style={{ color: colors.primary, fontWeight: '700' }}>Edit</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={[styles.adminBtn, { borderColor: colors.danger }]} onPress={() => handleDelete(item)} accessibilityRole="button">
                    <Text style={{ color: colors.danger, fontWeight: '700' }}>Delete</Text>
                  </TouchableOpacity>
                </View>
              ) : null}
            </View>
          )}
        />
      )}

      {/* Add Employee Modal */}
      <AnimatedModal visible={modalVisible} onRequestClose={() => setModalVisible(false)}>
        <View style={[styles.modalContent, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <View style={[styles.modalHeader, { borderBottomColor: colors.border }]}>
            <Text style={[styles.modalTitle, { color: colors.text }]}>{editingId ? 'Edit Employee' : 'Add New Employee'}</Text>
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
            <Text style={[styles.inputLabel, { color: colors.textSecondary }]}>Full Name *</Text>
            <TextInput
              style={[styles.formInput, { backgroundColor: colors.inputBg, color: colors.text, borderColor: colors.border }]}
              placeholder="e.g. Vikas Kulkarni"
              placeholderTextColor={colors.textMuted}
              value={formData.name}
              onChangeText={(t) => setFormData({ ...formData, name: t })}
            />

            <Text style={[styles.inputLabel, { color: colors.textSecondary }]}>Department</Text>
            <View style={styles.choiceRow}>
              {DEPTS.filter(d => d !== 'All').map((d, i) => (
                <TouchableOpacity
                  key={i}
                  style={[
                    styles.choiceChip,
                    {
                      backgroundColor: formData.dept === d ? colors.primary : colors.cardSecondary,
                      borderColor: formData.dept === d ? colors.primary : colors.border
                    }
                  ]}
                  onPress={() => setFormData({ ...formData, dept: d })}
                >
                  <Text style={[styles.choiceText, { color: formData.dept === d ? '#fff' : colors.text }]}>
                    {d}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            <Text style={[styles.inputLabel, { color: colors.textSecondary }]}>Designation / Role *</Text>
            <TextInput
              style={[styles.formInput, { backgroundColor: colors.inputBg, color: colors.text, borderColor: colors.border }]}
              placeholder="e.g. Senior CCTV Technician"
              placeholderTextColor={colors.textMuted}
              value={formData.role}
              onChangeText={(t) => setFormData({ ...formData, role: t })}
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
              placeholder="e.g. vikas@company.com"
              placeholderTextColor={colors.textMuted}
              value={formData.email}
              onChangeText={(t) => setFormData({ ...formData, email: t })}
              keyboardType="email-address"
              autoCapitalize="none"
            />

            <Text style={[styles.inputLabel, { color: colors.textSecondary }]}>Monthly Base Salary (₹)</Text>
            <TextInput
              style={[styles.formInput, { backgroundColor: colors.inputBg, color: colors.text, borderColor: colors.border }]}
              placeholder="25000"
              placeholderTextColor={colors.textMuted}
              value={formData.basicSalary}
              onChangeText={(t) => setFormData({ ...formData, basicSalary: t })}
              keyboardType="numeric"
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
                {saving ? 'Saving...' : editingId ? 'Update Employee' : 'Add Employee'}
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </AnimatedModal>

      <ConfirmDeleteModal
        visible={Boolean(confirmDeleteEmployee)}
        onClose={() => setConfirmDeleteEmployee(null)}
        title="Delete Employee"
        subtitle={confirmDeleteEmployee?.name}
        message={`Are you sure you want to delete ${confirmDeleteEmployee?.name}? This will remove their record from active staff rosters and payroll.`}
        confirmText="Delete Employee"
        loading={isDeleting}
        onConfirm={async () => {
          if (!confirmDeleteEmployee) return;
          setIsDeleting(true);
          try {
            await apiDelete(`/employees/${confirmDeleteEmployee.id}`);
            setConfirmDeleteEmployee(null);
            fetchEmployees();
          } catch (error) {
            Alert.alert('Error', error.message || 'Could not delete employee.');
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
  employeeCard: {
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
  employeeName: {
    fontSize: 16,
    fontWeight: '700',
  },
  employeeRole: {
    fontSize: 13,
    fontWeight: '600',
    marginTop: 2,
  },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginVertical: 4,
  },
  deptBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  deptBadgeText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#6366f1',
  },
  cardFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderTopWidth: 1,
    paddingTop: 10,
    marginTop: 4,
  },
  adminActions: { flexDirection: 'row', justifyContent: 'flex-end', gap: 8, marginTop: 10 },
  adminBtn: { minHeight: 40, minWidth: 72, paddingHorizontal: 12, borderWidth: 1, borderRadius: 8, alignItems: 'center', justifyContent: 'center' },
  contactItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  contactText: {
    fontSize: 12,
    fontWeight: '500',
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
