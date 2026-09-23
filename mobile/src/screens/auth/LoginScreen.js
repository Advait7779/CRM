import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  Alert
} from 'react-native';
import { useAuth } from '../../context/AuthContext';
import { useTheme } from '../../context/ThemeContext';
import { Shield, Lock, Mail, Eye, EyeOff } from 'lucide-react-native';

export default function LoginScreen() {
  const { login } = useAuth();
  const { colors } = useTheme();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleLogin = async () => {
    if (!email.trim() || !password) {
      Alert.alert('Validation Error', 'Please enter both email and password.');
      return;
    }

    setLoading(true);
    try {
      await login(email, password);
    } catch (err) {
      Alert.alert(
        'Login Failed',
        err.message || 'Unable to connect to server. Please check your credentials.'
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      style={[styles.container, { backgroundColor: colors.background }]}
      keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : -30}
    >
      {/* Decorative Purple & White Theme Combo Background Glows */}
      <View style={styles.bgGlowTopLeft} pointerEvents="none" />
      <View style={styles.bgGlowMidRight} pointerEvents="none" />
      <View style={styles.bgGlowBottomLeft} pointerEvents="none" />
      <View style={styles.bgGlowBottomRight} pointerEvents="none" />
      <View style={styles.bgGlowBottomCenter} pointerEvents="none" />

      <ScrollView
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
        bounces={false}
      >
        {/* Header Branding (Compact) */}
        <View style={styles.brandContainer}>
          <View style={[styles.logoBox, { backgroundColor: 'rgba(99, 102, 241, 0.12)', borderColor: 'rgba(99, 102, 241, 0.35)' }]}>
            <Shield size={22} color={colors.primary} />
          </View>
          <Text style={[styles.brandTitle, { color: colors.text }]}>Service CRM</Text>
          <Text style={[styles.brandSubtitle, { color: colors.textMuted }]}>
            Enterprise Service Management System
          </Text>
        </View>

        {/* Login Form Card (Compact with Purple & White Combo) */}
        <View style={[styles.card, { backgroundColor: colors.card, borderColor: 'rgba(99, 102, 241, 0.2)', borderTopColor: colors.primary }]}>
          <Text style={[styles.cardTitle, { color: colors.text }]}>Sign In</Text>
          <Text style={[styles.cardSubtitle, { color: colors.textMuted }]}>
            Enter your credentials to access your portal
          </Text>

          {/* Email Field */}
          <View style={styles.inputGroup}>
            <Text style={[styles.label, { color: colors.textSecondary }]}>Email Address</Text>
            <View style={[styles.inputBox, { backgroundColor: colors.inputBg, borderColor: colors.border }]}>
              <Mail size={16} color={colors.textMuted} style={styles.inputIcon} />
              <TextInput
                style={[styles.input, { color: colors.text }]}
                placeholder="admin@company.com"
                placeholderTextColor={colors.textMuted}
                value={email}
                onChangeText={setEmail}
                keyboardType="email-address"
                autoCapitalize="none"
                autoCorrect={false}
                autoComplete="email"
                textContentType="emailAddress"
                returnKeyType="next"
                accessibilityLabel="Email address"
              />
            </View>
          </View>

          {/* Password Field */}
          <View style={styles.inputGroup}>
            <Text style={[styles.label, { color: colors.textSecondary }]}>Password</Text>
            <View style={[styles.inputBox, { backgroundColor: colors.inputBg, borderColor: colors.border }]}>
              <Lock size={16} color={colors.textMuted} style={styles.inputIcon} />
              <TextInput
                style={[styles.input, { color: colors.text }]}
                placeholder="••••••••"
                placeholderTextColor={colors.textMuted}
                value={password}
                onChangeText={setPassword}
                secureTextEntry={!showPassword}
                autoCapitalize="none"
                autoComplete="current-password"
                textContentType="password"
                returnKeyType="done"
                onSubmitEditing={handleLogin}
                accessibilityLabel="Password"
              />
              <TouchableOpacity
                onPress={() => setShowPassword(!showPassword)}
                style={styles.eyeBtn}
                accessibilityRole="button"
                accessibilityLabel={showPassword ? 'Hide password' : 'Show password'}
              >
                {showPassword ? (
                  <EyeOff size={16} color={colors.textMuted} />
                ) : (
                  <Eye size={16} color={colors.textMuted} />
                )}
              </TouchableOpacity>
            </View>
          </View>

          {/* Login Button */}
          <TouchableOpacity
            style={[styles.loginBtn, { backgroundColor: colors.primary }]}
            onPress={handleLogin}
            disabled={loading}
            activeOpacity={0.8}
            accessibilityRole="button"
            accessibilityLabel="Sign in to dashboard"
          >
            {loading ? (
              <ActivityIndicator color="#ffffff" size="small" />
            ) : (
              <Text style={styles.loginBtnText}>Sign In to Dashboard</Text>
            )}
          </TouchableOpacity>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    position: 'relative',
    overflow: 'hidden',
  },
  bgGlowTopLeft: {
    position: 'absolute',
    top: -50,
    left: -165,
    width: 230,
    height: 230,
    borderRadius: 115,
    backgroundColor: 'rgba(99, 102, 241, 0.17)',
  },
  bgGlowMidRight: {
    position: 'absolute',
    top: 190,
    right: -130,
    width: 200,
    height: 200,
    borderRadius: 100,
    backgroundColor: 'rgba(139, 92, 246, 0.08)',
  },
  bgGlowBottomLeft: {
    position: 'absolute',
    bottom: 30,
    left: -80,
    width: 170,
    height: 170,
    borderRadius: 85,
    backgroundColor: 'rgba(139, 92, 246, 0.13)',
  },
  bgGlowBottomRight: {
    position: 'absolute',
    bottom: -60,
    right: -55,
    width: 230,
    height: 230,
    borderRadius: 115,
    backgroundColor: 'rgba(99, 102, 241, 0.16)',
  },
  bgGlowBottomCenter: {
    position: 'absolute',
    bottom: -50,
    left: '40%',
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: 'rgba(99, 102, 241, 0.04)',
  },
  scrollContent: {
    flexGrow: 1,
    justifyContent: 'flex-start',
    alignItems: 'center',
    paddingHorizontal: 24,
    paddingTop: Platform.OS === 'android' ? 56 : 72,
    paddingBottom: 32,
  },
  brandContainer: {
    alignItems: 'center',
    marginBottom: 18,
  },
  logoBox: {
    width: 44,
    height: 44,
    borderRadius: 12,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
  },
  brandTitle: {
    fontSize: 17,
    fontWeight: '700',
    letterSpacing: -0.3,
  },
  brandSubtitle: {
    fontSize: 11,
    marginTop: 2,
    fontWeight: '500',
  },
  card: {
    width: '100%',
    maxWidth: 268,
    alignSelf: 'center',
    borderRadius: 18,
    paddingVertical: 32,
    paddingHorizontal: 15,
    borderWidth: 1,
    borderTopWidth: 3,
    shadowColor: '#6366f1',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.12,
    shadowRadius: 10,
    elevation: 4,
  },
  cardTitle: {
    fontSize: 15,
    fontWeight: '700',
  },
  cardSubtitle: {
    fontSize: 11,
    marginTop: 2,
    marginBottom: 20,
  },
  inputGroup: {
    marginBottom: 16,
  },
  label: {
    fontSize: 11,
    fontWeight: '600',
    marginBottom: 6,
  },
  inputBox: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 10,
    borderWidth: 1,
    paddingHorizontal: 12,
    height: 48,
  },
  inputIcon: {
    marginRight: 8,
  },
  input: {
    flex: 1,
    fontSize: 13,
    height: '100%',
    padding: 0,
  },
  eyeBtn: {
    padding: 4,
  },
  loginBtn: {
    height: 48,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 12,
  },
  loginBtnText: {
    color: '#ffffff',
    fontSize: 13,
    fontWeight: '700',
  }
});
