import React, { useState, useEffect, useCallback } from 'react';
import { chatPreviewDate } from '../../utils/chatDate';
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
import AnimatedModal from '../../components/common/AnimatedModal';
import { useTheme } from '../../context/ThemeContext';
import { apiGet, apiPost } from '../../config/api';
import Header from '../../components/common/Header';
import SearchInput from '../../components/common/SearchInput';
import EmptyState from '../../components/common/EmptyState';
import LoadingSpinner from '../../components/common/LoadingSpinner';
import {
  MessageSquare,
  Users,
  Plus,
  CheckCircle2,
  X,
} from 'lucide-react-native';

const AVATAR_COLORS = [
  '#10b981', '#6366f1', '#f59e0b', '#ec4899', '#8b5cf6', '#3b82f6', '#14b8a6', '#ef4444'
];

function getLastMessageText(contact) {
  const preview = contact?.lastMessage;
  if (typeof preview === 'string') return preview;
  if (preview && typeof preview === 'object') return String(preview.message || 'Attachment');
  return '';
}

function getLastMessageTime(contact) {
  return chatPreviewDate(contact?.lastMessage?.createdAt);
}

export default function ChatListScreen({ navigation }) {
  const { colors } = useTheme();

  const [contacts, setContacts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [search, setSearch] = useState('');

  // Group creation modal
  const [groupModalVisible, setGroupModalVisible] = useState(false);
  const [creatingGroup, setCreatingGroup] = useState(false);
  const [groupName, setGroupName] = useState('');
  const [groupDesc, setGroupDesc] = useState('');
  const [groupColor, setGroupColor] = useState('#10b981');
  const [selectedMemberIds, setSelectedMemberIds] = useState([]);

  const fetchContacts = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    try {
      const data = await apiGet('/chat/users');
      setContacts(Array.isArray(data) ? data : []);
    } catch (err) {
      if (!silent) Alert.alert('Error', err.message || 'Failed to load chats');
    } finally {
      if (!silent) {
        setLoading(false);
        setRefreshing(false);
      }
    }
  }, []);

  useEffect(() => {
    fetchContacts();
    const interval = setInterval(() => fetchContacts(true), 5000);
    return () => clearInterval(interval);
  }, [fetchContacts]);

  const onRefresh = () => {
    setRefreshing(true);
    fetchContacts();
  };

  const openCreateGroupModal = () => {
    setGroupName('');
    setGroupDesc('');
    setGroupColor('#10b981');
    setSelectedMemberIds([]);
    setGroupModalVisible(true);
  };

  const toggleMemberSelection = (memberId) => {
    setSelectedMemberIds(prev =>
      prev.includes(memberId) ? prev.filter(id => id !== memberId) : [...prev, memberId]
    );
  };

  const handleCreateGroup = async () => {
    if (!groupName.trim()) {
      Alert.alert('Validation Error', 'Please enter a group name.');
      return;
    }

    setCreatingGroup(true);
    try {
      await apiPost('/chat/groups', {
        name: groupName.trim(),
        description: groupDesc.trim(),
        avatarColor: groupColor,
        memberIds: selectedMemberIds
      });
      setGroupModalVisible(false);
      Alert.alert('Success', `Group "${groupName}" created!`);
      fetchContacts();
    } catch (err) {
      Alert.alert('Error', err.message || 'Failed to create group');
    } finally {
      setCreatingGroup(false);
    }
  };

  const filteredContacts = contacts.filter(c => {
    const query = search.toLowerCase();
    return (
      (c.name || '').toLowerCase().includes(query) ||
      (c.role || '').toLowerCase().includes(query) ||
      getLastMessageText(c).toLowerCase().includes(query)
    );
  });

  const getInitials = (name = '') => {
    return name
      .split(' ')
      .map(p => p[0])
      .slice(0, 2)
      .join('')
      .toUpperCase() || 'U';
  };

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <Header
        title="Team Chat"
        subtitle="Real-time messaging & files"
        rightElement={
          <TouchableOpacity
            style={[styles.newGroupBtn, { backgroundColor: colors.primary }]}
            onPress={openCreateGroupModal}
            activeOpacity={0.8}
          >
            <Plus size={16} color="#ffffff" />
            <Text style={styles.newGroupBtnText}>Group</Text>
          </TouchableOpacity>
        }
      />

      {/* Search Input */}
      <View style={[styles.searchSection, { backgroundColor: colors.card, borderBottomColor: colors.border }]}>
        <SearchInput
          value={search}
          onChangeText={setSearch}
          placeholder="Search team members, groups, messages..."
        />
      </View>

      {/* Chat List */}
      {loading ? (
        <LoadingSpinner message="Loading messages..." />
      ) : (
        <FlatList
          data={filteredContacts}
          keyExtractor={(item) => String(item.id)}
          contentContainerStyle={styles.list}
          showsVerticalScrollIndicator={false}
          overScrollMode="never"
          scrollEventThrottle={16}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />}
          ListEmptyComponent={
            <EmptyState
              title="No chats available"
              description="Start a direct chat or create a team group."
              icon={MessageSquare}
              actionText="Create Team Group"
              onAction={openCreateGroupModal}
            />
          }
          renderItem={({ item }) => {
            const isGroup = !!item.isGroup;
            const avatarColor = item.avatarColor || '#10b981';
            const lastMessageText = getLastMessageText(item);
            const lastMessageTime = getLastMessageTime(item);

            return (
              <TouchableOpacity
                style={[styles.chatCard, { backgroundColor: colors.card, borderColor: colors.border }]}
                onPress={() => navigation.navigate('ChatConversation', { contact: item })}
                activeOpacity={0.7}
              >
                {/* Contact avatar */}
                <View style={styles.avatarContainer}>
                  <View style={[styles.avatar, { backgroundColor: avatarColor }]}>
                    {isGroup ? (
                      <Users size={20} color="#ffffff" />
                    ) : (
                      <Text style={styles.avatarText}>{getInitials(item.name)}</Text>
                    )}
                  </View>


                </View>

                {/* Name, Role & Message preview */}
                <View style={styles.chatInfo}>
                  <View style={styles.chatHeaderRow}>
                    <Text style={[styles.contactName, { color: colors.text }]} numberOfLines={1}>
                      {item.name}
                    </Text>
                    {lastMessageTime ? (
                      <Text style={[styles.timeText, { color: colors.textMuted }]}>
                        {lastMessageTime}
                      </Text>
                    ) : null}
                  </View>

                  <View style={styles.chatSubRow}>
                    <Text
                      style={[
                        styles.lastMessage,
                        { color: item.unreadCount > 0 ? colors.text : colors.textMuted },
                        item.unreadCount > 0 && styles.unreadMessageText
                      ]}
                      numberOfLines={1}
                    >
                      {lastMessageText || (isGroup ? 'Group created' : item.role || 'Team Member')}
                    </Text>

                    {item.unreadCount > 0 ? (
                      <View style={[styles.unreadBadge, { backgroundColor: colors.primary }]}>
                        <Text style={styles.unreadCountText}>{item.unreadCount}</Text>
                      </View>
                    ) : null}
                  </View>
                </View>
              </TouchableOpacity>
            );
          }}
        />
      )}

      {/* Create Group Modal */}
      <AnimatedModal visible={groupModalVisible} onRequestClose={() => setGroupModalVisible(false)}>
        <View style={[styles.modalContent, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <View style={[styles.modalHeader, { borderBottomColor: colors.border }]}>
              <Text style={[styles.modalTitle, { color: colors.text }]}>Create Team Group</Text>
              <TouchableOpacity onPress={() => setGroupModalVisible(false)}>
                <X size={20} color={colors.textMuted} />
              </TouchableOpacity>
            </View>

            <ScrollView
              style={styles.modalForm}
              contentContainerStyle={styles.modalFormContent}
              keyboardShouldPersistTaps="handled"
              showsVerticalScrollIndicator={true}
            >
              <Text style={[styles.inputLabel, { color: colors.textSecondary }]}>Group Name *</Text>
              <TextInput
                style={[styles.formInput, { backgroundColor: colors.inputBg, color: colors.text, borderColor: colors.border }]}
                placeholder="e.g. Sales Field Team, CCTV Ops"
                placeholderTextColor={colors.textMuted}
                value={groupName}
                onChangeText={setGroupName}
              />

              <Text style={[styles.inputLabel, { color: colors.textSecondary }]}>Group Description</Text>
              <TextInput
                style={[styles.formInput, { backgroundColor: colors.inputBg, color: colors.text, borderColor: colors.border }]}
                placeholder="e.g. Daily installation updates and client alerts"
                placeholderTextColor={colors.textMuted}
                value={groupDesc}
                onChangeText={setGroupDesc}
              />

              <Text style={[styles.inputLabel, { color: colors.textSecondary }]}>Theme Color</Text>
              <View style={styles.colorPalette}>
                {AVATAR_COLORS.map((c, i) => (
                  <TouchableOpacity
                    key={i}
                    style={[
                      styles.colorCircle,
                      { backgroundColor: c },
                      groupColor === c && styles.colorSelected
                    ]}
                    onPress={() => setGroupColor(c)}
                  />
                ))}
              </View>

              <Text style={[styles.inputLabel, { color: colors.textSecondary }]}>Select Group Members</Text>
              <View style={styles.membersList}>
                {contacts.filter(c => !c.isGroup).map((member, i) => {
                  const selected = selectedMemberIds.includes(member.id);
                  return (
                    <TouchableOpacity
                      key={member.id || i}
                      style={[
                        styles.memberItem,
                        {
                          backgroundColor: selected ? 'rgba(16, 185, 129, 0.12)' : colors.cardSecondary,
                          borderColor: selected ? colors.primary : colors.border
                        }
                      ]}
                      onPress={() => toggleMemberSelection(member.id)}
                    >
                      <View style={[styles.memberAvatar, { backgroundColor: member.avatarColor || '#10b981' }]}>
                        <Text style={styles.memberAvatarText}>{getInitials(member.name)}</Text>
                      </View>
                      <View style={{ flex: 1 }}>
                        <Text style={[styles.memberName, { color: colors.text }]}>{member.name}</Text>
                        <Text style={[styles.memberRole, { color: colors.textMuted }]}>{member.role || 'Staff'}</Text>
                      </View>
                      {selected ? <CheckCircle2 size={20} color={colors.primary} /> : null}
                    </TouchableOpacity>
                  );
                })}
              </View>
            </ScrollView>

            <View style={[styles.modalFooter, { borderTopColor: colors.border }]}>
              <TouchableOpacity
                style={[styles.cancelBtn, { backgroundColor: colors.cardSecondary }]}
                onPress={() => setGroupModalVisible(false)}
              >
                <Text style={{ color: colors.text, fontWeight: '600' }}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.saveBtn, { backgroundColor: colors.primary }]}
                onPress={handleCreateGroup}
                disabled={creatingGroup}
              >
                <Text style={{ color: '#ffffff', fontWeight: '700' }}>
                  {creatingGroup ? 'Creating...' : 'Create Group'}
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
  newGroupBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
  },
  newGroupBtnText: {
    color: '#ffffff',
    fontSize: 12,
    fontWeight: '700',
  },
  searchSection: {
    padding: 14,
    borderBottomWidth: 1,
  },
  list: {
    padding: 14,
    paddingBottom: 40,
    gap: 10,
  },
  chatCard: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 16,
    padding: 14,
    borderWidth: 1,
  },
  avatarContainer: {
    position: 'relative',
    marginRight: 14,
  },
  avatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '800',
  },

  chatInfo: {
    flex: 1,
  },
  chatHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  contactName: {
    fontSize: 15,
    fontWeight: '700',
    flex: 1,
    marginRight: 8,
  },
  timeText: {
    fontSize: 11,
    fontWeight: '500',
  },
  chatSubRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  lastMessage: {
    fontSize: 13,
    flex: 1,
    marginRight: 8,
  },
  unreadMessageText: {
    fontWeight: '700',
  },
  unreadBadge: {
    minWidth: 20,
    height: 20,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 6,
  },
  unreadCountText: {
    color: '#ffffff',
    fontSize: 11,
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
  colorPalette: {
    flexDirection: 'row',
    gap: 10,
    marginVertical: 6,
  },
  colorCircle: {
    width: 32,
    height: 32,
    borderRadius: 16,
  },
  colorSelected: {
    borderWidth: 3,
    borderColor: '#ffffff',
  },
  membersList: {
    gap: 8,
    marginTop: 6,
  },
  memberItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    padding: 10,
    borderRadius: 10,
    borderWidth: 1,
  },
  memberAvatar: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: 'center',
    justifyContent: 'center',
  },
  memberAvatarText: {
    color: '#ffffff',
    fontSize: 12,
    fontWeight: '700',
  },
  memberName: {
    fontSize: 13,
    fontWeight: '600',
  },
  memberRole: {
    fontSize: 11,
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
