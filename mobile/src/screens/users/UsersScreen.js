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
import { apiGet, apiPost, apiPut, apiDelete } from '../../config/api';
import { canWriteResource } from '../../config/permissions';
import Header from '../../components/common/Header';
import SearchInput from '../../components/common/SearchInput';
import EmptyState from '../../components/common/EmptyState';
import LoadingSpinner from '../../components/common/LoadingSpinner';
import AnimatedModal from '../../components/common/AnimatedModal';
import ConfirmDeleteModal from '../../components/common/ConfirmDeleteModal';
import {
  ShieldCheck,
  Plus,
  Phone,
  X
} from 'lucide-react-native';

const ROLES = [
  'director',
  'sales_manager',
  'sales_executive',
  'installation_manager',
  'gps_installer',
  'cctv_technician',
  'website_developer',
  'digital_marketing',
  'support_executive',
  'accounts'
];

export default function UsersScreen() {
  const { colors } = useTheme();
  const { user } = useAuth();
  const canWrite = canWriteResource(user?.role, 'users');

  const [usersList, setUsersList] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [search, setSearch] = useState('');

  // Modal
  const [modalVisible, setModalVisible] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [saving, setSaving] = useState(false);
  const [confirmDeleteUser, setConfirmDeleteUser] = useState(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    phone: '',
    role: 'sales_executive',
    password: ''
  });

  const fetchUsers = useCallback(async () => {
    try {
      const data = await apiGet('/users');
      setUsersList(Array.isArray(data) ? data : []);
    } catch (err) {
      Alert.alert('Error', err.message || 'Failed to fetch users');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    fetchUsers();
  }, [fetchUsers]);

  const onRefresh = () => {
    setRefreshing(true);
    fetchUsers();
  };

  const openAddModal = () => {
    setEditingId(null);
    setFormData({
      name: '',
      email: '',
      phone: '',
      role: 'sales_executive',
      password: ''
    });
    setModalVisible(true);
  };

  const openEditModal = (item) => {
    setEditingId(item.id);
    setFormData({ name: item.name || '', email: item.email || '', phone: item.phone || '', role: item.role || 'sales_executive', password: '' });
    setModalVisible(true);
  };

  const handleDelete = (item) => {
    setConfirmDeleteUser(item);
  };

  const handleSaveUser = async () => {
    if (!formData.name.trim() || !formData.email.trim() || (!editingId && !formData.password)) {
      Alert.alert('Validation Error', editingId ? 'Name and Email are required.' : 'Name, Email, and Password are required.');
      return;
    }

    if (formData.password && formData.password.length < 12) {
      Alert.alert('Validation Error', 'Password must be at least 12 characters.');
      return;
    }

    setSaving(true);
    try {
      if (editingId) {
        await apiPut(`/users/${editingId}`, { name: formData.name, phone: formData.phone, role: formData.role });
        if (formData.password) await apiPut(`/users/${editingId}/password`, { newPassword: formData.password });
      } else {
        await apiPost('/users', formData);
      }
      Alert.alert('Success', editingId ? 'User updated successfully' : 'User created successfully');
      setModalVisible(false);
      fetchUsers();
    } catch (err) {
      Alert.alert('Error', err.message || 'Failed to create user');
    } finally {
      setSaving(false);
    }
  };

  const filtered = usersList.filter(u => {
    const query = search.toLowerCase();
    return (
      (u.name || '').toLowerCase().includes(query) ||
      (u.email || '').toLowerCase().includes(query) ||
      (u.role || '').toLowerCase().includes(query)
    );
  });

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <Header
        title="User Access Control"
        subtitle={`${usersList.length} registered accounts`}
        rightElement={
          canWrite ? (
            <TouchableOpacity
              style={[styles.addBtn, { backgroundColor: colors.primary }]}
              onPress={openAddModal}
              activeOpacity={0.8}
            >
              <Plus size={16} color="#ffffff" />
              <Text style={styles.addBtnText}>Add User</Text>
            </TouchableOpacity>
          ) : null
        }
      />

      <View style={[styles.filterSection, { backgroundColor: colors.card, borderBottomColor: colors.border }]}>
        <SearchInput
          value={search}
          onChangeText={setSearch}
          placeholder="Search user by name, email, role..."
        />
      </View>

      {loading ? (
        <LoadingSpinner message="Loading user directory..." />
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
              title="No users found"
              description="Tap 'Add User' to invite team members."
              icon={ShieldCheck}
              actionText={canWrite ? 'Add User' : undefined}
              onAction={canWrite ? openAddModal : undefined}
            />
          }
          renderItem={({ item }) => (
            <View style={[styles.userCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
              <View style={styles.cardHeader}>
                <View style={styles.userInfo}>
                  <Text style={[styles.userName, { color: colors.text }]}>{item.name}</Text>
                  <Text style={[styles.userEmail, { color: colors.textMuted }]}>{item.email}</Text>
                </View>
                <View style={[styles.rolePill, { backgroundColor: 'rgba(99, 102, 241, 0.12)' }]}>
                  <Text style={styles.roleText}>{item.role}</Text>
                </View>
              </View>

              {item.phone ? (
                <View style={[styles.cardFooter, { borderTopColor: colors.border }]}>
                  <Phone size={12} color={colors.textMuted} />
                  <Text style={[styles.phoneText, { color: colors.textMuted }]}>{item.phone}</Text>
                </View>
              ) : null}
              {canWrite ? (
                <View style={styles.adminActions}>
                  <TouchableOpacity style={[styles.adminBtn, { borderColor: colors.primary }]} onPress={() => openEditModal(item)} accessibilityRole="button">
                    <Text style={{ color: colors.primary, fontWeight: '700' }}>Edit</Text>
                  </TouchableOpacity>
                  {item.role !== 'super_admin' ? (
                    <TouchableOpacity style={[styles.adminBtn, { borderColor: colors.danger }]} onPress={() => handleDelete(item)} accessibilityRole="button">
                      <Text style={{ color: colors.danger, fontWeight: '700' }}>Delete</Text>
                    </TouchableOpacity>
                  ) : null}
                </View>
              ) : null}
            </View>
          )}
        />
      )}

      {/* Add User Modal */}
      <AnimatedModal visible={modalVisible} onRequestClose={() => setModalVisible(false)}>
        <View style={[styles.modalContent, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <View style={[styles.modalHeader, { borderBottomColor: colors.border }]}>
              <Text style={[styles.modalTitle, { color: colors.text }]}>{editingId ? 'Edit User' : 'Add New User'}</Text>
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
              <Text style={[styles.inputLabel, { color: colors.textSecondary }]}>Full Name *</Text>
              <TextInput
                style={[styles.formInput, { backgroundColor: colors.inputBg, color: colors.text, borderColor: colors.border }]}
                placeholder="e.g. Ramesh Kulkarni"
                placeholderTextColor={colors.textMuted}
                value={formData.name}
                onChangeText={(t) => setFormData({ ...formData, name: t })}
              />

              <Text style={[styles.inputLabel, { color: colors.textSecondary }]}>Email Address *</Text>
              <TextInput
                style={[styles.formInput, { backgroundColor: colors.inputBg, color: colors.text, borderColor: colors.border }]}
                placeholder="e.g. ramesh@crm.com"
                placeholderTextColor={colors.textMuted}
                value={formData.email}
                onChangeText={(t) => setFormData({ ...formData, email: t })}
                editable={!editingId}
                keyboardType="email-address"
                autoCapitalize="none"
              />

              <Text style={[styles.inputLabel, { color: colors.textSecondary }]}>Phone Number</Text>
              <TextInput
                style={[styles.formInput, { backgroundColor: colors.inputBg, color: colors.text, borderColor: colors.border }]}
                placeholder="e.g. +91 98765 43210"
                placeholderTextColor={colors.textMuted}
                value={formData.phone}
                onChangeText={(t) => setFormData({ ...formData, phone: t })}
                keyboardType="phone-pad"
              />

              <Text style={[styles.inputLabel, { color: colors.textSecondary }]}>User Role *</Text>
              <View style={styles.choiceRow}>
                {ROLES.map((r, i) => (
                  <TouchableOpacity
                    key={i}
                    style={[
                      styles.choiceChip,
                      {
                        backgroundColor: formData.role === r ? colors.primary : colors.cardSecondary,
                        borderColor: formData.role === r ? colors.primary : colors.border
                      }
                    ]}
                    onPress={() => setFormData({ ...formData, role: r })}
                  >
                    <Text style={[styles.choiceText, { color: formData.role === r ? '#fff' : colors.text }]}>
                      {r.replace('_', ' ')}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>

              <Text style={[styles.inputLabel, { color: colors.textSecondary }]}>{editingId ? 'New Password (optional)' : 'Login Password *'}</Text>
              <TextInput
                style={[styles.formInput, { backgroundColor: colors.inputBg, color: colors.text, borderColor: colors.border }]}
                placeholder="••••••••"
                placeholderTextColor={colors.textMuted}
                value={formData.password}
                onChangeText={(t) => setFormData({ ...formData, password: t })}
                secureTextEntry
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
                onPress={handleSaveUser}
                disabled={saving}
              >
                <Text style={{ color: '#ffffff', fontWeight: '700' }}>
                  {saving ? 'Saving...' : editingId ? 'Update User' : 'Create Account'}
                </Text>
              </TouchableOpacity>
            </View>
          </View>
      </AnimatedModal>

      <ConfirmDeleteModal
        visible={Boolean(confirmDeleteUser)}
        onClose={() => setConfirmDeleteUser(null)}
        title="Delete User"
        subtitle={confirmDeleteUser?.name}
        message={`Are you sure you want to delete ${confirmDeleteUser?.name}? Their account and administrative access will be permanently revoked.`}
        confirmText="Delete User"
        loading={isDeleting}
        onConfirm={async () => {
          if (!confirmDeleteUser) return;
          setIsDeleting(true);
          try {
            await apiDelete(`/users/${confirmDeleteUser.id}`);
            setConfirmDeleteUser(null);
            fetchUsers();
          } catch (error) {
            Alert.alert('Error', error.message || 'Could not delete user.');
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
  },
  list: {
    padding: 14,
    paddingBottom: 40,
    gap: 12,
  },
  userCard: {
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
  userInfo: {
    flex: 1,
    marginRight: 8,
  },
  userName: {
    fontSize: 16,
    fontWeight: '700',
  },
  userEmail: {
    fontSize: 12,
    marginTop: 2,
  },
  rolePill: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  roleText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#6366f1',
    textTransform: 'capitalize',
  },
  cardFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    borderTopWidth: 1,
    paddingTop: 8,
    marginTop: 2,
  },
  phoneText: {
    fontSize: 12,
  },
  adminActions: { flexDirection: 'row', justifyContent: 'flex-end', gap: 8, marginTop: 4 },
  adminBtn: { minHeight: 40, minWidth: 72, paddingHorizontal: 12, borderWidth: 1, borderRadius: 8, alignItems: 'center', justifyContent: 'center' },
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
