import React, { useEffect, useState } from 'react';
import { View, Text, FlatList, TouchableOpacity, StyleSheet, ActivityIndicator } from 'react-native';
import { Search, ChevronRight } from 'lucide-react-native';
import { useTheme } from '../../context/ThemeContext';
import { apiGet } from '../../config/api';
import Header from '../../components/common/Header';
import SearchInput from '../../components/common/SearchInput';
import EmptyState from '../../components/common/EmptyState';

export default function GlobalSearchScreen({ navigation }) {
  const { colors } = useTheme();
  const [query, setQuery] = useState('');
  const [results, setResults] = useState([]);
  const [searching, setSearching] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    const trimmed = query.trim();
    if (trimmed.length < 2) {
      setResults([]);
      setSearching(false);
      setError('');
      return undefined;
    }
    setSearching(true);
    const timer = setTimeout(async () => {
      try {
        const data = await apiGet(`/search?q=${encodeURIComponent(trimmed)}`);
        setResults(Array.isArray(data) ? data : []);
        setError('');
      } catch (requestError) {
        setError(requestError.message || 'Search failed.');
        setResults([]);
      } finally {
        setSearching(false);
      }
    }, 350);
    return () => clearTimeout(timer);
  }, [query]);

  const openResult = (item) => {
    if (item.type === 'Customer') navigation.navigate('CustomerDetail', { customerId: item.id });
    else if (item.type === 'Lead') navigation.navigate('Leads');
    else if (item.type === 'Invoice') navigation.navigate('Accounts');
    else if (item.type === 'Ticket') navigation.navigate('Tickets');
  };

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <Header title="Global Search" subtitle="Search CRM records" showBack onBack={() => navigation.goBack()} />
      <View style={[styles.searchArea, { backgroundColor: colors.card, borderBottomColor: colors.border }]}>
        <SearchInput value={query} onChangeText={setQuery} placeholder="Customer, lead, invoice, or ticket..." autoFocus />
      </View>
      {searching ? <ActivityIndicator style={styles.loader} color={colors.primary} /> : null}
      {error ? <Text style={[styles.error, { color: colors.danger }]} accessibilityLiveRegion="assertive">{error}</Text> : null}
      <FlatList
        data={results}
        keyExtractor={(item) => `${item.type}-${item.id}`}
        contentContainerStyle={styles.list}
        showsVerticalScrollIndicator={false}
        overScrollMode="never"
        scrollEventThrottle={16}
        keyboardShouldPersistTaps="handled"
        ListEmptyComponent={!searching ? (
          <EmptyState
            icon={Search}
            title={query.trim().length < 2 ? 'Search across the CRM' : 'No matching records'}
            description={query.trim().length < 2 ? 'Enter at least two characters.' : 'Try another name, phone number, or reference.'}
          />
        ) : null}
        renderItem={({ item }) => (
          <TouchableOpacity
            style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}
            onPress={() => openResult(item)}
            accessibilityRole="button"
            accessibilityLabel={`${item.type}: ${item.title}`}
          >
            <View style={{ flex: 1 }}>
              <Text style={[styles.type, { color: colors.primary }]}>{item.type}</Text>
              <Text style={[styles.title, { color: colors.text }]}>{item.title}</Text>
              {item.subtitle ? <Text style={[styles.subtitle, { color: colors.textMuted }]}>{item.subtitle}</Text> : null}
            </View>
            <ChevronRight size={18} color={colors.textMuted} />
          </TouchableOpacity>
        )}
      />
    </View>
  );
}
const styles = StyleSheet.create({
  container: { flex: 1 },
  searchArea: { padding: 14, borderBottomWidth: 1 },
  loader: { marginTop: 18 },
  error: { paddingHorizontal: 16, paddingTop: 12 },
  list: { padding: 14, paddingBottom: 40, gap: 10, flexGrow: 1 },
  card: { minHeight: 72, borderRadius: 14, borderWidth: 1, padding: 14, flexDirection: 'row', alignItems: 'center' },
  type: { fontSize: 11, fontWeight: '800', textTransform: 'uppercase' },
  title: { fontSize: 15, fontWeight: '700', marginTop: 2 },
  subtitle: { fontSize: 12, marginTop: 2 }
});
