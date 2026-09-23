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
  Alert,
  Platform
} from 'react-native';
import { useTheme } from '../../context/ThemeContext';
import { useAuth } from '../../context/AuthContext';
import { apiGetAll, apiPost, apiPut } from '../../config/api';
import { canWriteResource } from '../../config/permissions';
import Header from '../../components/common/Header';
import SearchInput from '../../components/common/SearchInput';
import Badge from '../../components/common/Badge';
import EmptyState from '../../components/common/EmptyState';
import LoadingSpinner from '../../components/common/LoadingSpinner';
import AnimatedModal from '../../components/common/AnimatedModal';
import {
  Package,
  Plus,
  Barcode,
  AlertTriangle,
  X
} from 'lucide-react-native';

const CATEGORIES = ['All', 'GPS Trackers', 'CCTV Cameras', 'DVR / NVR', 'Cables & Power', 'Sensors & Accessories'];

export default function InventoryScreen() {
  const { colors } = useTheme();
  const { user } = useAuth();
  const canWrite = canWriteResource(user?.role, 'inventory');

  const [inventory, setInventory] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [search, setSearch] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('All');

  // Modal
  const [modalVisible, setModalVisible] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [saving, setSaving] = useState(false);
  const [formData, setFormData] = useState({
    name: '',
    category: 'GPS Trackers',
    barcode: '',
    stock: '10',
    min: '5',
    price: '2500',
    status: 'In Stock'
  });

  const fetchInventory = useCallback(async () => {
    try {
      const data = await apiGetAll('/inventory');
      setInventory(Array.isArray(data) ? data : []);
    } catch (err) {
      Alert.alert('Error', err.message || 'Failed to fetch inventory');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    fetchInventory();
  }, [fetchInventory]);

  const onRefresh = () => {
    setRefreshing(true);
    fetchInventory();
  };

  const openAddModal = () => {
    setEditingId(null);
    setFormData({
      name: '',
      category: 'GPS Trackers',
      barcode: `BC-${Math.floor(100000 + Math.random() * 900000)}`,
      stock: '10',
      min: '5',
      price: '2500',
      status: 'In Stock'
    });
    setModalVisible(true);
  };

  const openEditModal = (item) => {
    setEditingId(item.id);
    setFormData({
      name: item.name || '',
      category: item.category || 'GPS Trackers',
      barcode: item.barcode || '',
      stock: String(item.stock || 0),
      min: String(item.min || 0),
      price: String(item.price || 0),
      status: item.status || 'In Stock'
    });
    setModalVisible(true);
  };

  const handleSaveItem = async () => {
    if (!formData.name.trim() || !formData.barcode.trim()) {
      Alert.alert('Validation Error', 'Item Name and Barcode are required.');
      return;
    }

    const stockNum = Number(formData.stock) || 0;
    const minNum = Number(formData.min) || 0;
    const computedStatus = stockNum <= 0 ? 'Out of Stock' : (stockNum <= minNum ? 'Low Stock' : 'In Stock');

    setSaving(true);
    try {
      const payload = {
        name: formData.name,
        category: formData.category,
        barcode: formData.barcode,
        stock: stockNum,
        min: minNum,
        price: Number(formData.price) || 0,
        status: computedStatus
      };

      if (editingId) {
        const current = inventory.find((item) => item.id === editingId);
        const currentStock = Number(current?.stock) || 0;
        const stockDelta = stockNum - currentStock;
        const metadata = { name: payload.name, category: payload.category, barcode: payload.barcode, min: payload.min, price: payload.price, status: payload.status };
        await apiPut(`/inventory/${editingId}`, metadata);
        if (stockDelta !== 0) {
          await apiPost(`/inventory/${editingId}/adjust`, {
            direction: stockDelta > 0 ? 'IN' : 'OUT',
            quantity: Math.abs(stockDelta),
            purpose: 'Manual stock correction from mobile inventory'
          });
        }
        Alert.alert('Success', 'Inventory item updated');
      } else {
        await apiPost('/inventory', payload);
        Alert.alert('Success', 'Item added to inventory');
      }
      setModalVisible(false);
      fetchInventory();
    } catch (err) {
      Alert.alert('Error', err.message || 'Failed to save item');
    } finally {
      setSaving(false);
    }
  };

  const lowStockItems = inventory.filter(i => (Number(i.stock) || 0) <= (Number(i.min) || 0));

  const filtered = inventory.filter(i => {
    const matchSearch =
      (i.name || '').toLowerCase().includes(search.toLowerCase()) ||
      (i.barcode || '').toLowerCase().includes(search.toLowerCase()) ||
      (i.category || '').toLowerCase().includes(search.toLowerCase());

    const matchCategory = selectedCategory === 'All' || i.category === selectedCategory;
    return matchSearch && matchCategory;
  });

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <Header
        title="Inventory & Stock"
        subtitle={`${inventory.length} total SKU products`}
        rightElement={canWrite ? (
          <TouchableOpacity
            style={[styles.addBtn, { backgroundColor: colors.primary }]}
            onPress={openAddModal}
            activeOpacity={0.8}
          >
            <Plus size={16} color="#ffffff" />
            <Text style={styles.addBtnText}>Add SKU</Text>
          </TouchableOpacity>
        ) : null}
      />

      {/* Low Stock Banner */}
      {lowStockItems.length > 0 ? (
        <View style={styles.alertBanner}>
          <AlertTriangle size={16} color="#ef4444" />
          <Text style={styles.alertBannerText}>
            {lowStockItems.length} items are running below minimum stock threshold!
          </Text>
        </View>
      ) : null}

      {/* Filter Section */}
      <View style={[styles.filterSection, { backgroundColor: colors.card, borderBottomColor: colors.border }]}>
        <SearchInput
          value={search}
          onChangeText={setSearch}
          placeholder="Search products by name or barcode..."
        />

        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.filterScroll}>
          {CATEGORIES.map((cat, i) => {
            const isSelected = selectedCategory === cat;
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
                onPress={() => setSelectedCategory(cat)}
              >
                <Text style={[styles.filterChipText, { color: isSelected ? '#ffffff' : colors.textMuted }]}>
                  {cat}
                </Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>
      </View>

      {/* Inventory List */}
      {loading ? (
        <LoadingSpinner message="Loading stock inventory..." />
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
              title="No products in stock"
              description="Tap 'Add SKU' to add hardware units."
              icon={Package}
              actionText={canWrite ? 'Add Product' : undefined}
              onAction={canWrite ? openAddModal : undefined}
            />
          }
          renderItem={({ item }) => {
            const isLow = Number(item.stock) <= Number(item.min);
            return (
              <TouchableOpacity
                style={[styles.itemCard, { backgroundColor: colors.card, borderColor: isLow ? '#ef4444' : colors.border }]}
                onPress={canWrite ? () => openEditModal(item) : undefined}
                activeOpacity={canWrite ? 0.7 : 1}
                accessibilityRole={canWrite ? 'button' : undefined}
                accessibilityLabel={canWrite ? `Edit ${item.name}` : undefined}
              >
                <View style={styles.cardHeader}>
                  <View style={{ flex: 1, marginRight: 8 }}>
                    <Text style={[styles.itemName, { color: colors.text }]}>{item.name}</Text>
                    <Text style={[styles.categoryText, { color: colors.textMuted }]}>{item.category}</Text>
                  </View>
                  <Badge label={item.status || (isLow ? 'Low Stock' : 'In Stock')} />
                </View>

                <View style={styles.cardBody}>
                  <View style={styles.barcodeRow}>
                    <Barcode size={14} color={colors.textMuted} />
                    <Text style={[styles.barcodeText, { color: colors.textMuted }]}>{item.barcode}</Text>
                  </View>

                  <View style={styles.stockCol}>
                    <Text style={[styles.stockLabel, { color: colors.textMuted }]}>In Stock</Text>
                    <Text style={[styles.stockCount, { color: isLow ? '#ef4444' : colors.primary }]}>
                      {item.stock} <Text style={{ fontSize: 11, color: colors.textMuted }}>/ min {item.min}</Text>
                    </Text>
                  </View>
                </View>

                {item.price ? (
                  <View style={[styles.cardFooter, { borderTopColor: colors.border }]}>
                    <Text style={[styles.priceLabel, { color: colors.textMuted }]}>Unit Price</Text>
                    <Text style={[styles.priceValue, { color: colors.text }]}>₹{item.price}</Text>
                  </View>
                ) : null}
              </TouchableOpacity>
            );
          }}
        />
      )}

      {/* Add / Edit Modal */}
      <AnimatedModal visible={modalVisible} onRequestClose={() => setModalVisible(false)}>
        <View style={[styles.modalContent, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <View style={[styles.modalHeader, { borderBottomColor: colors.border }]}>
            <Text style={[styles.modalTitle, { color: colors.text }]}>
              {editingId ? 'Update Stock Item' : 'New Inventory Item'}
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
            <Text style={[styles.inputLabel, { color: colors.textSecondary }]}>Product Name *</Text>
            <TextInput
              style={[styles.formInput, { backgroundColor: colors.inputBg, color: colors.text, borderColor: colors.border }]}
              placeholder="e.g. AIS 140 GPS Device"
              placeholderTextColor={colors.textMuted}
              value={formData.name}
              onChangeText={(t) => setFormData({ ...formData, name: t })}
            />

            <Text style={[styles.inputLabel, { color: colors.textSecondary }]}>Category</Text>
            <View style={styles.choiceRow}>
              {CATEGORIES.filter(c => c !== 'All').map((cat, i) => (
                <TouchableOpacity
                  key={i}
                  style={[
                    styles.choiceChip,
                    {
                      backgroundColor: formData.category === cat ? colors.primary : colors.cardSecondary,
                      borderColor: formData.category === cat ? colors.primary : colors.border
                    }
                  ]}
                  onPress={() => setFormData({ ...formData, category: cat })}
                >
                  <Text style={[styles.choiceText, { color: formData.category === cat ? '#fff' : colors.text }]}>
                    {cat}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            <Text style={[styles.inputLabel, { color: colors.textSecondary }]}>Barcode / Serial Number *</Text>
            <TextInput
              style={[styles.formInput, { backgroundColor: colors.inputBg, color: colors.text, borderColor: colors.border }]}
              placeholder="e.g. 890123456789"
              placeholderTextColor={colors.textMuted}
              value={formData.barcode}
              onChangeText={(t) => setFormData({ ...formData, barcode: t })}
            />

            <View style={{ flexDirection: 'row', gap: 12 }}>
              <View style={{ flex: 1 }}>
                <Text style={[styles.inputLabel, { color: colors.textSecondary }]}>Current Stock</Text>
                <TextInput
                  style={[styles.formInput, { backgroundColor: colors.inputBg, color: colors.text, borderColor: colors.border }]}
                  placeholder="10"
                  placeholderTextColor={colors.textMuted}
                  value={formData.stock}
                  onChangeText={(t) => setFormData({ ...formData, stock: t })}
                  keyboardType="numeric"
                />
              </View>

              <View style={{ flex: 1 }}>
                <Text style={[styles.inputLabel, { color: colors.textSecondary }]}>Min Threshold</Text>
                <TextInput
                  style={[styles.formInput, { backgroundColor: colors.inputBg, color: colors.text, borderColor: colors.border }]}
                  placeholder="5"
                  placeholderTextColor={colors.textMuted}
                  value={formData.min}
                  onChangeText={(t) => setFormData({ ...formData, min: t })}
                  keyboardType="numeric"
                />
              </View>
            </View>

            <Text style={[styles.inputLabel, { color: colors.textSecondary }]}>Unit Selling Price (₹)</Text>
            <TextInput
              style={[styles.formInput, { backgroundColor: colors.inputBg, color: colors.text, borderColor: colors.border }]}
              placeholder="2500"
              placeholderTextColor={colors.textMuted}
              value={formData.price}
              onChangeText={(t) => setFormData({ ...formData, price: t })}
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
              onPress={handleSaveItem}
              disabled={saving}
            >
              <Text style={{ color: '#ffffff', fontWeight: '700' }}>
                {saving ? 'Saving...' : editingId ? 'Update Stock' : 'Add Item'}
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
  alertBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: 'rgba(239, 68, 68, 0.15)',
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  alertBannerText: {
    color: '#ef4444',
    fontSize: 12,
    fontWeight: '700',
    flex: 1,
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
  itemCard: {
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    gap: 10,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  itemName: {
    fontSize: 15,
    fontWeight: '700',
  },
  categoryText: {
    fontSize: 12,
    marginTop: 2,
  },
  cardBody: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  barcodeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  barcodeText: {
    fontSize: 12,
    fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
  },
  stockCol: {
    alignItems: 'flex-end',
  },
  stockLabel: {
    fontSize: 10,
    fontWeight: '600',
  },
  stockCount: {
    fontSize: 16,
    fontWeight: '800',
    marginTop: 1,
  },
  cardFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderTopWidth: 1,
    paddingTop: 8,
  },
  priceLabel: {
    fontSize: 11,
  },
  priceValue: {
    fontSize: 14,
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
