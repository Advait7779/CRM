import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  Switch,
  TextInput,
  Alert
} from 'react-native';
import AnimatedModal from '../../components/common/AnimatedModal';
import { useTheme } from '../../context/ThemeContext';
import { useAuth } from '../../context/AuthContext';
import { getServerUrl, setServerUrl, testServerConnection, setAuthToken, apiPut } from '../../config/api';
import Header from '../../components/common/Header';
import {
  Mail,
  Phone,
  Moon,
  Server,
  Lock,
  LogOut,
  ChevronRight,
  X
} from 'lucide-react-native';

export default function ProfileScreen() {
  const { colors, isDark, toggleTheme } = useTheme();
  const { user, logout } = useAuth();

  // Server URL modal
  const [serverUrl, setLocalServerUrl] = useState('');
  const [showServerModal, setShowServerModal] = useState(false);
  const [tempUrl, setTempUrl] = useState('');

  // Password Modal
  const [showPasswordModal, setShowPasswordModal] = useState(false);
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [changingPass, setChangingPass] = useState(false);

  useEffect(() => {
    getServerUrl().then(url => {
      setLocalServerUrl(url);
      setTempUrl(url);
    });
  }, []);

  const handleSaveServerUrl = async () => {
    if (!tempUrl.trim()) return;
    try {
      await testServerConnection(tempUrl);
      const saved = await setServerUrl(tempUrl);
      setLocalServerUrl(saved);
      setShowServerModal(false);
      Alert.alert('Connected', `Server URL verified and saved:\n${saved}`);
    } catch (error) {
      Alert.alert('Connection Failed', error.message || 'Could not reach this server.');
    }
  };

  const handleChangePassword = async () => {
    if (!currentPassword || !newPassword) {
      Alert.alert('Validation Error', 'Please fill in all password fields.');
      return;
    }
    if (newPassword.length < 12) {
      Alert.alert('Validation Error', 'New password must be at least 12 characters.');
      return;
    }
    if (newPassword !== confirmPassword) {
      Alert.alert('Validation Error', 'New passwords do not match.');
      return;
    }

    setChangingPass(true);
    try {
      const result = await apiPut('/auth/password', { currentPassword, newPassword });
      if (result?.token) await setAuthToken(result.token);
      Alert.alert('Success', 'Password updated successfully');
      setShowPasswordModal(false);
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
    } catch (err) {
      Alert.alert('Error', err.message || 'Failed to update password');
    } finally {
      setChangingPass(false);
    }
  };

  const handleLogout = () => {
    Alert.alert('Sign Out', 'Are you sure you want to sign out from the app?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Sign Out',
        style: 'destructive',
        onPress: logout
      }
    ]);
  };

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
      <Header title="My Profile & Settings" />

      <ScrollView
        contentContainerStyle={styles.scroll}
        showsVerticalScrollIndicator={false}
        overScrollMode="never"
      >
        {/* User Card */}
        <View style={[styles.userCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <View style={[styles.avatar, { backgroundColor: colors.primary }]}>
            <Text style={styles.avatarText}>{getInitials(user?.name)}</Text>
          </View>
          <Text style={[styles.userName, { color: colors.text }]}>{user?.name || 'Staff Member'}</Text>
          <Text style={[styles.userRole, { color: colors.primary }]}>
            {user?.role?.toUpperCase() || 'STAFF'}
          </Text>

          <View style={[styles.infoDivider, { borderTopColor: colors.border }]}>
            <View style={styles.infoRow}>
              <Mail size={16} color={colors.textMuted} />
              <Text style={[styles.infoText, { color: colors.text }]}>{user?.email || 'N/A'}</Text>
            </View>
            {user?.phone ? (
              <View style={styles.infoRow}>
                <Phone size={16} color={colors.textMuted} />
                <Text style={[styles.infoText, { color: colors.text }]}>{user?.phone}</Text>
              </View>
            ) : null}
          </View>
        </View>

        {/* App Settings Section */}
        <Text style={[styles.sectionTitle, { color: colors.textMuted }]}>PREFERENCES</Text>
        <View style={[styles.menuCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
          {/* Dark Mode Toggle */}
          <View style={[styles.menuItem, { borderBottomColor: colors.border }]}>
            <View style={styles.menuLeft}>
              <View style={[styles.iconBox, { backgroundColor: 'rgba(99, 102, 241, 0.15)' }]}>
                <Moon size={18} color="#6366f1" />
              </View>
              <Text style={[styles.menuText, { color: colors.text }]}>Dark Mode</Text>
            </View>
            <Switch
              value={isDark}
              onValueChange={toggleTheme}
              trackColor={{ false: '#cbd5e1', true: colors.primary }}
              thumbColor="#ffffff"
            />
          </View>

          {/* Change Password */}
          <TouchableOpacity
            style={[styles.menuItem, { borderBottomColor: colors.border }]}
            onPress={() => setShowPasswordModal(true)}
            activeOpacity={0.7}
          >
            <View style={styles.menuLeft}>
              <View style={[styles.iconBox, { backgroundColor: 'rgba(245, 158, 11, 0.15)' }]}>
                <Lock size={18} color="#f59e0b" />
              </View>
              <Text style={[styles.menuText, { color: colors.text }]}>Change Password</Text>
            </View>
            <ChevronRight size={18} color={colors.textMuted} />
          </TouchableOpacity>

          {/* Server Connection URL */}
          <TouchableOpacity
            style={styles.menuItem}
            onPress={() => {
              setTempUrl(serverUrl);
              setShowServerModal(true);
            }}
            activeOpacity={0.7}
          >
            <View style={styles.menuLeft}>
              <View style={[styles.iconBox, { backgroundColor: 'rgba(16, 185, 129, 0.15)' }]}>
                <Server size={18} color="#10b981" />
              </View>
              <View style={{ flex: 1, marginRight: 8 }}>
                <Text style={[styles.menuText, { color: colors.text }]}>API Server URL</Text>
                <Text style={[styles.serverSubText, { color: colors.textMuted }]} numberOfLines={1}>
                  {serverUrl}
                </Text>
              </View>
            </View>
            <ChevronRight size={18} color={colors.textMuted} />
          </TouchableOpacity>
        </View>

        {/* Logout Button */}
        <TouchableOpacity
          style={[styles.logoutBtn, { borderColor: '#ef4444' }]}
          onPress={handleLogout}
          activeOpacity={0.8}
        >
          <LogOut size={18} color="#ef4444" />
          <Text style={styles.logoutBtnText}>Sign Out from Account</Text>
        </TouchableOpacity>

        <Text style={[styles.appVersionText, { color: colors.textMuted }]}>
          Service Management CRM Mobile • v1.0.0
        </Text>
      </ScrollView>

      {/* Change Password Modal */}
      <AnimatedModal visible={showPasswordModal} onRequestClose={() => setShowPasswordModal(false)}>
        <View style={[styles.modalCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <View style={styles.modalHeader}>
            <Text style={[styles.modalTitle, { color: colors.text }]}>Change Password</Text>
            <TouchableOpacity onPress={() => setShowPasswordModal(false)}>
              <X size={20} color={colors.textMuted} />
            </TouchableOpacity>
          </View>

          <ScrollView
            showsVerticalScrollIndicator={true}
            keyboardShouldPersistTaps="handled"
            contentContainerStyle={styles.modalScrollContent}
          >
            <Text style={[styles.modalInputLabel, { color: colors.textSecondary }]}>Current Password</Text>
            <TextInput
              style={[styles.modalInput, { backgroundColor: colors.inputBg, color: colors.text, borderColor: colors.border }]}
              value={currentPassword}
              onChangeText={setCurrentPassword}
              secureTextEntry
            />

            <Text style={[styles.modalInputLabel, { color: colors.textSecondary }]}>New Password</Text>
            <TextInput
              style={[styles.modalInput, { backgroundColor: colors.inputBg, color: colors.text, borderColor: colors.border }]}
              value={newPassword}
              onChangeText={setNewPassword}
              secureTextEntry
            />

            <Text style={[styles.modalInputLabel, { color: colors.textSecondary }]}>Confirm New Password</Text>
            <TextInput
              style={[styles.modalInput, { backgroundColor: colors.inputBg, color: colors.text, borderColor: colors.border }]}
              value={confirmPassword}
              onChangeText={setConfirmPassword}
              secureTextEntry
            />
          </ScrollView>

          <View style={styles.modalButtons}>
            <TouchableOpacity
              style={[styles.modalBtn, { backgroundColor: colors.cardSecondary }]}
              onPress={() => setShowPasswordModal(false)}
            >
              <Text style={{ color: colors.text, fontWeight: '600' }}>Cancel</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.modalBtn, { backgroundColor: colors.primary }]}
              onPress={handleChangePassword}
              disabled={changingPass}
            >
              <Text style={{ color: '#ffffff', fontWeight: '700' }}>
                {changingPass ? 'Updating...' : 'Update Password'}
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </AnimatedModal>

      {/* Server URL Config Modal */}
      <AnimatedModal visible={showServerModal} onRequestClose={() => setShowServerModal(false)}>
        <View style={[styles.modalCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <View style={styles.modalHeader}>
            <Text style={[styles.modalTitle, { color: colors.text }]}>Configure API Server</Text>
            <TouchableOpacity onPress={() => setShowServerModal(false)}>
              <X size={20} color={colors.textMuted} />
            </TouchableOpacity>
          </View>

          <ScrollView
            showsVerticalScrollIndicator={true}
            keyboardShouldPersistTaps="handled"
            contentContainerStyle={styles.modalScrollContent}
          >
            <Text style={[styles.modalDesc, { color: colors.textMuted }]}>
              Enter the HTTPS backend API URL. Development builds can also use your computer's LAN address.
            </Text>

            <TextInput
              style={[styles.modalInput, { backgroundColor: colors.inputBg, color: colors.text, borderColor: colors.border }]}
              value={tempUrl}
              onChangeText={setTempUrl}
              placeholder="https://api.example.com/api"
              placeholderTextColor={colors.textMuted}
              autoCapitalize="none"
              autoCorrect={false}
            />
          </ScrollView>

          <View style={styles.modalButtons}>
            <TouchableOpacity
              style={[styles.modalBtn, { backgroundColor: colors.cardSecondary }]}
              onPress={() => setShowServerModal(false)}
            >
              <Text style={{ color: colors.text, fontWeight: '600' }}>Cancel</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.modalBtn, { backgroundColor: colors.primary }]}
              onPress={handleSaveServerUrl}
            >
              <Text style={{ color: '#ffffff', fontWeight: '700' }}>Test & Save</Text>
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
  scroll: {
    padding: 16,
    paddingBottom: 40,
  },
  userCard: {
    borderRadius: 20,
    padding: 24,
    borderWidth: 1,
    alignItems: 'center',
    marginBottom: 24,
  },
  avatar: {
    width: 72,
    height: 72,
    borderRadius: 36,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
  },
  avatarText: {
    color: '#ffffff',
    fontSize: 26,
    fontWeight: '800',
  },
  userName: {
    fontSize: 20,
    fontWeight: '700',
  },
  userRole: {
    fontSize: 12,
    fontWeight: '800',
    marginTop: 4,
    letterSpacing: 0.5,
  },
  infoDivider: {
    width: '100%',
    borderTopWidth: 1,
    paddingTop: 16,
    marginTop: 16,
    gap: 10,
  },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  infoText: {
    fontSize: 13,
    fontWeight: '500',
  },
  sectionTitle: {
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 0.5,
    marginBottom: 8,
    marginLeft: 4,
  },
  menuCard: {
    borderRadius: 16,
    borderWidth: 1,
    overflow: 'hidden',
    marginBottom: 24,
  },
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 16,
    borderBottomWidth: 1,
  },
  menuLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    flex: 1,
  },
  iconBox: {
    width: 36,
    height: 36,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  menuText: {
    fontSize: 15,
    fontWeight: '600',
  },
  serverSubText: {
    fontSize: 11,
    marginTop: 2,
  },
  logoutBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    borderWidth: 1.5,
    borderRadius: 14,
    paddingVertical: 14,
    marginBottom: 20,
  },
  logoutBtnText: {
    color: '#ef4444',
    fontSize: 15,
    fontWeight: '700',
  },
  appVersionText: {
    fontSize: 11,
    textAlign: 'center',
    fontWeight: '500',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.6)',
    justifyContent: 'center',
    padding: 20,
  },
  modalCard: {
    borderRadius: 18,
    padding: 20,
    borderWidth: 1,
    flexShrink: 1,
    maxHeight: '100%',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
    flexShrink: 0,
  },
  modalScrollContent: {
    paddingBottom: 16,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '700',
  },
  modalDesc: {
    fontSize: 12,
    lineHeight: 18,
    marginBottom: 16,
  },
  modalInputLabel: {
    fontSize: 12,
    fontWeight: '600',
    marginBottom: 6,
    marginTop: 8,
  },
  modalInput: {
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 12,
    height: 44,
    fontSize: 14,
    marginBottom: 10,
  },
  modalButtons: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 10,
    marginTop: 10,
    flexShrink: 0,
  },
  modalBtn: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 8,
  }
});
