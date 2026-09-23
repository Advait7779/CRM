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
import { apiGet, apiGetAll, apiPost, apiPut, apiDelete } from '../../config/api';
import Header from '../../components/common/Header';
import SearchInput from '../../components/common/SearchInput';
import Badge from '../../components/common/Badge';
import EmptyState from '../../components/common/EmptyState';
import LoadingSpinner from '../../components/common/LoadingSpinner';
import AnimatedModal from '../../components/common/AnimatedModal';
import ConfirmDeleteModal from '../../components/common/ConfirmDeleteModal';
import { canWriteResource } from '../../config/permissions';
import {
  CheckSquare,
  Square,
  Plus,
  User,
  X,
  Clock,
  Trash2
} from 'lucide-react-native';

const DEPTS = ['All', 'Installation', 'Technical', 'Development', 'Sales', 'Accounts', 'Support'];
const PRIORITIES = ['High', 'Medium', 'Low'];

export default function TasksScreen() {
  const { colors } = useTheme();
  const { user } = useAuth();
  const canManage = canWriteResource(user?.role, 'tasks');

  const [tasks, setTasks] = useState([]);
  const [assignees, setAssignees] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [search, setSearch] = useState('');
  const [selectedDept, setSelectedDept] = useState('All');
  const [selectedStatus] = useState('All');

  // Add / Edit Modal
  const [modalVisible, setModalVisible] = useState(false);
  const [confirmDeleteTask, setConfirmDeleteTask] = useState(null);
  const [editingId, setEditingId] = useState(null);
  const [saving, setSaving] = useState(false);
  const [formData, setFormData] = useState({
    title: '',
    desc: '',
    dept: 'Installation',
    assignedTo: '',
    assignedUserId: '',
    priority: 'Medium',
    status: 'Pending',
    due: ''
  });

  const fetchTasks = useCallback(async () => {
    try {
      const [data, staff] = await Promise.all([apiGetAll('/tasks'), canManage ? apiGet('/task-assignees') : []]);
      setTasks(Array.isArray(data) ? data : []);
      setAssignees(staff);
    } catch (err) {
      Alert.alert('Error', err.message || 'Failed to fetch tasks');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [canManage]);

  useEffect(() => {
    fetchTasks();
  }, [fetchTasks]);

  const onRefresh = () => {
    setRefreshing(true);
    fetchTasks();
  };

  const openAddModal = () => {
    setEditingId(null);
    setFormData({
      title: '',
      desc: '',
      dept: 'Installation',
      assignedTo: user?.name || '',
      assignedUserId: '',
      priority: 'Medium',
      status: 'Pending',
      due: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString().split('T')[0]
    });
    setModalVisible(true);
  };

  const openEditModal = (task) => {
    setEditingId(task.id);
    setFormData({
      title: task.title || '',
      desc: task.desc || '',
      dept: task.dept || 'Installation',
      assignedTo: task.assignedTo || '',
      assignedUserId: task.assignedUserId || '',
      priority: task.priority || 'Medium',
      status: task.status || 'Pending',
      due: task.due || ''
    });
    setModalVisible(true);
  };

  const handleToggleTask = async (task) => {
    const nextStatus = task.status === 'Completed' ? 'Pending' : 'Completed';
    try {
      setTasks(prev => prev.map(t => t.id === task.id ? { ...t, status: nextStatus } : t));
      await apiPut(`/tasks/${task.id}/status`, { status: nextStatus });
    } catch  {
      Alert.alert('Error', 'Failed to update task status');
      fetchTasks();
    }
  };

  const handleSaveTask = async () => {
    if (!formData.title.trim() || !formData.dept || !formData.assignedUserId) {
      Alert.alert('Validation Error', 'Title, Department, and Assigned Person are required.');
      return;
    }

    setSaving(true);
    try {
      if (editingId) {
        await apiPut(`/tasks/${editingId}`, formData);
        Alert.alert('Success', 'Task updated');
      } else {
        await apiPost('/tasks', formData);
        Alert.alert('Success', 'Task created');
      }
      setModalVisible(false);
      fetchTasks();
    } catch (err) {
      Alert.alert('Error', err.message || 'Failed to save task');
    } finally {
      setSaving(false);
    }
  };

  const filteredTasks = tasks.filter(t => {
    const matchSearch =
      (t.title || '').toLowerCase().includes(search.toLowerCase()) ||
      (t.desc || '').toLowerCase().includes(search.toLowerCase()) ||
      (t.assignedTo || '').toLowerCase().includes(search.toLowerCase());

    const matchDept = selectedDept === 'All' || t.dept === selectedDept;
    const matchStatus = selectedStatus === 'All' || t.status === selectedStatus;

    return matchSearch && matchDept && matchStatus;
  });

  const completedCount = tasks.filter(t => t.status === 'Completed').length;

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <Header
        title="Tasks"
        subtitle={`${completedCount}/${tasks.length} completed`}
        rightElement={canManage ? (
          <TouchableOpacity
            style={[styles.addBtn, { backgroundColor: colors.primary }]}
            onPress={openAddModal}
            activeOpacity={0.8}
          >
            <Plus size={18} color="#ffffff" />
            <Text style={styles.addBtnText}>New Task</Text>
          </TouchableOpacity>
        ) : null}
      />

      {/* Filter and Search Bar */}
      <View style={[styles.filterSection, { backgroundColor: colors.card, borderBottomColor: colors.border }]}>
        <SearchInput
          value={search}
          onChangeText={setSearch}
          placeholder="Search tasks by title, assignee..."
        />

        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.filterScroll}>
          {DEPTS.map((dept, i) => {
            const isSelected = selectedDept === dept;
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
                onPress={() => setSelectedDept(dept)}
              >
                <Text style={[styles.filterChipText, { color: isSelected ? '#ffffff' : colors.textMuted }]}>
                  {dept}
                </Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>
      </View>

      {/* Task List */}
      {loading ? (
        <LoadingSpinner message="Loading task boards..." />
      ) : (
        <FlatList
          data={filteredTasks}
          keyExtractor={(item) => String(item.id)}
          contentContainerStyle={styles.list}
          showsVerticalScrollIndicator={false}
          overScrollMode="never"
          scrollEventThrottle={16}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />}
          ListEmptyComponent={
            <EmptyState
              title="No tasks found"
              description="Tap 'New Task' to assign work to team members."
              icon={CheckSquare}
              actionText={canManage ? 'Create Task' : undefined}
              onAction={canManage ? openAddModal : undefined}
            />
          }
          renderItem={({ item }) => {
            const isDone = item.status === 'Completed';
            const canToggle = canManage || item.assignedUserId === user?.id;
            return (
              <View style={[styles.taskCard, { backgroundColor: colors.card, borderColor: colors.border }, isDone && { opacity: 0.7 }]}>
                <View style={styles.taskRow}>
                  {/* Checkbox */}
                  <TouchableOpacity
                    style={styles.checkbox}
                    onPress={() => canToggle && handleToggleTask(item)}
                    activeOpacity={0.7}
                    disabled={!canToggle}
                    accessibilityRole="checkbox"
                    accessibilityState={{ checked: isDone, disabled: !canToggle }}
                    accessibilityLabel={`${item.title}, ${isDone ? 'completed' : 'not completed'}`}
                  >
                    {isDone ? (
                      <CheckSquare size={22} color={colors.primary} />
                    ) : (
                      <Square size={22} color={colors.textMuted} />
                    )}
                  </TouchableOpacity>

                  {/* Task Info */}
                  <View style={styles.taskInfo}>
                    <Text style={[styles.taskTitle, { color: colors.text }, isDone && styles.taskDoneTitle]}>
                      {item.title}
                    </Text>

                    {item.desc ? (
                      <Text style={[styles.taskDesc, { color: colors.textMuted }]} numberOfLines={2}>
                        {item.desc}
                      </Text>
                    ) : null}

                    {/* Metadata chips */}
                    <View style={styles.metaRow}>
                      <Badge label={item.priority || 'Medium'} size="small" />
                      <View style={[styles.deptChip, { backgroundColor: 'rgba(99, 102, 241, 0.12)' }]}>
                        <Text style={styles.deptChipText}>{item.dept}</Text>
                      </View>
                      {item.assignedTo ? (
                        <View style={[styles.deptChip, { backgroundColor: colors.cardSecondary }]}>
                          <User size={10} color={colors.textMuted} />
                          <Text style={[styles.assigneeText, { color: colors.textSecondary }]}>
                            {item.assignedTo}
                          </Text>
                        </View>
                      ) : null}
                    </View>

                    {/* Due date */}
                    {item.due ? (
                      <View style={styles.dueRow}>
                        <Clock size={12} color="#f59e0b" />
                        <Text style={[styles.dueText, { color: colors.textMuted }]}>Due: {item.due}</Text>
                      </View>
                    ) : null}
                  </View>
                </View>

                {/* Edit / Delete Row */}
                {canManage ? (
                <View style={[styles.cardFooter, { borderTopColor: colors.border }]}>
                  <TouchableOpacity
                    onPress={() => openEditModal(item)}
                    style={styles.actionTextBtn}
                  >
                    <Text style={[styles.actionText, { color: colors.primary }]}>Edit</Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    onPress={() => setConfirmDeleteTask(item)}
                    style={styles.actionTextBtn}
                    accessibilityRole="button"
                    accessibilityLabel={`Delete task ${item.title}`}
                  >
                    <Trash2 size={14} color="#ef4444" />
                  </TouchableOpacity>
                </View>
                ) : null}
              </View>
            );
          }}
        />
      )}

      {/* Add / Edit Task Modal */}
      <AnimatedModal visible={modalVisible} onRequestClose={() => setModalVisible(false)}>
        <View style={[styles.modalContent, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <View style={[styles.modalHeader, { borderBottomColor: colors.border }]}>
            <Text style={[styles.modalTitle, { color: colors.text }]}>
              {editingId ? 'Edit Task' : 'New Task'}
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
            <Text style={[styles.inputLabel, { color: colors.textSecondary }]}>Task Title *</Text>
            <TextInput
              style={[styles.formInput, { backgroundColor: colors.inputBg, color: colors.text, borderColor: colors.border }]}
              placeholder="e.g. GPS tracker install for 5 trucks"
              placeholderTextColor={colors.textMuted}
              value={formData.title}
              onChangeText={(t) => setFormData({ ...formData, title: t })}
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

            <Text style={[styles.inputLabel, { color: colors.textSecondary }]}>Assigned To *</Text>
            <View style={styles.choiceRow}>
              {assignees.map(person => <TouchableOpacity key={person.id}
                onPress={() => setFormData({ ...formData, assignedUserId: person.id, assignedTo: person.name })}
                style={{ padding: 10, margin: 3, borderRadius: 8, borderWidth: 1, borderColor: Number(formData.assignedUserId) === person.id ? colors.primary : colors.border }}>
                <Text style={{ color: colors.text }}>{person.name}</Text>
                <Text style={{ color: colors.textMuted, fontSize: 11 }}>{person.email || person.role}</Text>
              </TouchableOpacity>)}
            </View>

            <Text style={[styles.inputLabel, { color: colors.textSecondary }]}>Priority</Text>
            <View style={styles.choiceRow}>
              {PRIORITIES.map((p, i) => (
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

            <Text style={[styles.inputLabel, { color: colors.textSecondary }]}>Due Date (YYYY-MM-DD)</Text>
            <TextInput
              style={[styles.formInput, { backgroundColor: colors.inputBg, color: colors.text, borderColor: colors.border }]}
              placeholder="2026-08-25"
              placeholderTextColor={colors.textMuted}
              value={formData.due}
              onChangeText={(t) => setFormData({ ...formData, due: t })}
            />

            <Text style={[styles.inputLabel, { color: colors.textSecondary }]}>Task Description</Text>
            <TextInput
              style={[styles.formInput, styles.textArea, { backgroundColor: colors.inputBg, color: colors.text, borderColor: colors.border }]}
              placeholder="Task details and instructions..."
              placeholderTextColor={colors.textMuted}
              value={formData.desc}
              onChangeText={(t) => setFormData({ ...formData, desc: t })}
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
              onPress={handleSaveTask}
              disabled={saving}
            >
              <Text style={{ color: '#ffffff', fontWeight: '700' }}>
                {saving ? 'Saving...' : editingId ? 'Update Task' : 'Create Task'}
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </AnimatedModal>

      <ConfirmDeleteModal
        visible={Boolean(confirmDeleteTask)}
        onClose={() => setConfirmDeleteTask(null)}
        title="Delete Task"
        subtitle={confirmDeleteTask ? `Task #${confirmDeleteTask.id} · ${confirmDeleteTask.dept}` : ''}
        message={confirmDeleteTask ? `Are you sure you want to delete task "${confirmDeleteTask.title}"? This action cannot be undone.` : ''}
        confirmText="Delete Task"
        onConfirm={async () => {
          if (!confirmDeleteTask) return;
          try {
            await apiDelete(`/tasks/${confirmDeleteTask.id}`);
            setTasks(prev => prev.filter(t => t.id !== confirmDeleteTask.id));
            setConfirmDeleteTask(null);
          } catch {
            Alert.alert('Error', 'Failed to delete task');
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
  taskCard: {
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
  },
  taskRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
  },
  checkbox: {
    paddingTop: 2,
  },
  taskInfo: {
    flex: 1,
  },
  taskTitle: {
    fontSize: 15,
    fontWeight: '700',
    marginBottom: 4,
  },
  taskDoneTitle: {
    textDecorationLine: 'line-through',
    opacity: 0.6,
  },
  taskDesc: {
    fontSize: 13,
    lineHeight: 18,
    marginBottom: 8,
  },
  metaRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: 6,
    marginBottom: 6,
  },
  deptChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  deptChipText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#6366f1',
  },
  assigneeText: {
    fontSize: 11,
    fontWeight: '600',
  },
  dueRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 4,
  },
  dueText: {
    fontSize: 11,
    fontWeight: '500',
  },
  cardFooter: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 14,
    borderTopWidth: 1,
    paddingTop: 8,
    marginTop: 8,
  },
  actionTextBtn: {
    padding: 4,
  },
  actionText: {
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
