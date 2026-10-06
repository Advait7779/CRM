import React, { useEffect, useState } from 'react';
import { Alert, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { useTheme } from '../../context/ThemeContext';
import { apiGet, apiPut } from '../../config/api';
import Header from '../../components/common/Header';

const CHANNELS = [
  { id: 'sms', label: 'SMS' },
  { id: 'rcs', label: 'RCS' },
  { id: 'voice', label: 'Voice Call' },
  { id: 'whatsapp', label: 'WhatsApp WABA' }
];
const GROUPS = [
  { id: 'cctv', title: 'CCTV' },
  { id: 'gps_fuel', title: 'GPS & Fuel Sensor' },
  { id: 'digital', title: 'Digital Services' }
];
const CUSTOMER_FIELDS = [
  { key: 'sms_webhook_url', label: 'SMS URL' },
  { key: 'whatsapp_webhook_url', label: 'WhatsApp WABA URL' },
  { key: 'rcs_webhook_url', label: 'RCS URL' },
  { key: 'voice_call_webhook_url', label: 'Voice Call URL' }
];
const ALL_KEYS = [
  ...CUSTOMER_FIELDS.map(field => field.key),
  'new_lead_sms_webhook_url',
  ...GROUPS.flatMap(group => CHANNELS.map(channel => `justdial_${group.id}_${channel.id}_webhook_url`))
];
const readSettings = data => Object.fromEntries(ALL_KEYS.map(key => [key, data?.[key] || '']));

export default function NotificationSettingsScreen() {
  const { colors } = useTheme();
  const [form, setForm] = useState(() => readSettings({}));
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    apiGet('/settings').then(data => setForm(readSettings(data)))
      .catch(error => Alert.alert('Settings unavailable', error.message))
      .finally(() => setLoading(false));
  }, []);

  const save = async () => {
    setSaving(true);
    try {
      const updated = await apiPut('/settings', form);
      setForm(readSettings(updated));
      Alert.alert('Saved', 'Notification URLs were updated.');
    } catch (error) { Alert.alert('Save failed', error.message); }
    finally { setSaving(false); }
  };

  const field = (key, label) => (
    <View key={key} style={{ marginTop: 12 }}>
      <Text style={{ color: colors.textSecondary, fontSize: 13, fontWeight: '600', marginBottom: 6 }}>{label}</Text>
      <TextInput style={[styles.input, { backgroundColor: colors.inputBg, color: colors.text, borderColor: colors.border }]}
        value={form[key]} onChangeText={value => setForm(current => ({ ...current, [key]: value }))}
        placeholder={`https://provider.example/send?phone={phone}`} placeholderTextColor={colors.textMuted}
        autoCapitalize="none" autoCorrect={false} multiline textAlignVertical="top" />
    </View>
  );

  return <View style={[styles.container, { backgroundColor: colors.background }]}>
    <Header title="Notification URLs" subtitle="Customer, lead and Justdial templates" />
    <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
      {loading ? <Text style={{ color: colors.textMuted }}>Loading settings...</Text> : <>
        <View style={[styles.section, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <Text style={[styles.title, { color: colors.text }]}>New Customer Notifications</Text>
          {CUSTOMER_FIELDS.map(item => field(item.key, item.label))}
        </View>
        <View style={[styles.section, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <Text style={[styles.title, { color: colors.text }]}>New Lead SMS</Text>
          <Text style={{ color: colors.textMuted, fontSize: 12 }}>Runs when a lead is created in the CRM.</Text>
          {field('new_lead_sms_webhook_url', 'SMS URL')}
        </View>
        {GROUPS.map(group => <View key={group.id} style={[styles.section, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <Text style={[styles.title, { color: colors.text }]}>Justdial · {group.title}</Text>
          {CHANNELS.map(channel => field(`justdial_${group.id}_${channel.id}_webhook_url`, `${channel.label} URL`))}
        </View>)}
        <Text style={{ color: colors.textMuted, fontSize: 12 }}>Use {'{phone}'} in the recipient URL. For Justdial SMS, [alp] or {'{name}'} becomes the lead name. Empty URLs disable that channel.</Text>
        <TouchableOpacity style={[styles.save, { backgroundColor: colors.primary }]} onPress={save} disabled={saving}>
          <Text style={{ color: '#fff', fontWeight: '700' }}>{saving ? 'Saving...' : 'Save Notification URLs'}</Text>
        </TouchableOpacity>
      </>}
    </ScrollView>
  </View>;
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  content: { padding: 16, gap: 16, paddingBottom: 48 },
  section: { borderWidth: 1, borderRadius: 14, padding: 16 },
  title: { fontSize: 16, fontWeight: '700' },
  input: { borderWidth: 1, borderRadius: 8, padding: 10, minHeight: 72, fontSize: 12 },
  save: { padding: 14, borderRadius: 10, alignItems: 'center' }
});
