import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Image,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Feather, Ionicons } from '@expo/vector-icons';
import { AppBottomNav, AppHeader } from '../components/AppChrome';
import { authRequest } from '../services/client';
import * as ImagePicker from 'expo-image-picker';

const CATEGORIES = [
  { key: 'MEAT', label: 'Thịt' },
  { key: 'VEGETABLE', label: 'Rau củ' },
  { key: 'SPICE', label: 'Gia vị' },
  { key: 'FRUIT', label: 'Trái cây' },
  { key: 'STARCH', label: 'Tinh bột' },
  { key: 'OTHER', label: 'Khác' },
];

const FILTER_CHIPS = [
  { key: 'ALL', label: 'Tất cả' },
  { key: 'MEAT', label: 'Thịt' },
  { key: 'VEGETABLE', label: 'Rau củ' },
  { key: 'SPICE', label: 'Gia vị' },
  { key: 'FRUIT', label: 'Trái cây' },
  { key: 'STARCH', label: 'Tinh bột' },
  { key: 'OTHER', label: 'Khác' },
];

const emptyForm = {
  id: null,
  name: '',
  category: 'MEAT',
  imageUrl: null,
  popular: false,
  keywords: '',
};

const mapIngredient = (row) => ({
  id: row.ingredient_id,
  name: row.name,
  category: row.type,
  imageUrl: row.image_url || null,
  popular: Boolean(row.is_common),
  keywords: row.keywords || '',
});

const categoryLabel = (categoryKey) => CATEGORIES.find((item) => item.key === categoryKey)?.label || 'Khác';

export default function AdminIngredientsScreen({ onLogout, user, onNavigateOverview, onNavigateRecipeReview, onNavigateUsers, onNavigateTransactions }) {
  const [menuOpen, setMenuOpen] = useState(false);
  const [activeFilter, setActiveFilter] = useState('ALL');
  const [searchText, setSearchText] = useState('');
  const [modalOpen, setModalOpen] = useState(false);
  const [categoryPickerOpen, setCategoryPickerOpen] = useState(false);
  const [modalMode, setModalMode] = useState('create');
  const [form, setForm] = useState(emptyForm);
  const [ingredients, setIngredients] = useState([]);
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const displayName = user?.fullName || 'Admin NutriChef';
  const displayEmail = user?.email || 'admin@nutrichef.com';

  const filteredIngredients = useMemo(() => {
    const query = searchText.trim().toLowerCase();
    // Only filter by text if length is at least 2 characters to avoid excessive filtering
    const shouldFilterByText = query.length >= 2;

    return ingredients.filter((item) => {
      const matchesQuery =
        !shouldFilterByText ||
        item.name.toLowerCase().includes(query) ||
        (item.keywords || '').toLowerCase().includes(query);

      const matchesFilter = activeFilter === 'ALL' || item.category === activeFilter;

      return matchesQuery && matchesFilter;
    });
  }, [ingredients, searchText, activeFilter]);

  const openCreateModal = () => {
    setModalMode('create');
    setForm(emptyForm);
    setCategoryPickerOpen(false);
    setModalOpen(true);
  };

  const openEditModal = (item) => {
    setModalMode('edit');
    setForm(item);
    setCategoryPickerOpen(false);
    setModalOpen(true);
  };

  const closeModal = () => {
    setModalOpen(false);
    setCategoryPickerOpen(false);
  };

  const pickAndUploadImage = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Không có quyền', 'Cần cấp quyền truy cập thư viện ảnh.');
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: 'images',
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.8,
    });

    if (result.canceled || !result.assets?.length) return;

    const asset = result.assets[0];
    console.log('📸 Selected image:', {
      uri: asset.uri,
      fileName: asset.fileName,
      mimeType: asset.mimeType,
      fileSize: asset.fileSize,
    });
    
    try {
      setUploading(true);
      
      // Lấy blob từ uri
      console.log('🔄 Fetching blob from URI...');
      const response = await fetch(asset.uri);
      const blob = await response.blob();
      console.log(`✅ Got blob: ${blob.size} bytes, type: ${blob.type}`);
      
      // Tạo FormData với blob
      const formData = new FormData();
      formData.append('image', blob, asset.fileName || 'ingredient.jpg');
      console.log('📤 Uploading FormData to /api/admin/upload/ingredient-image...');

      const data = await authRequest('/api/admin/upload/ingredient-image', {
        method: 'POST',
        body: formData,
      });
      console.log('✅ Upload success:', data.imageUrl);
      setForm((current) => ({ ...current, imageUrl: data.imageUrl }));
      Alert.alert('Thành công', 'Tải ảnh lên thành công');
    } catch (error) {
      console.error('❌ Lỗi upload ảnh:', error.message);
      console.error('   Full error:', error);
      Alert.alert('Lỗi tải ảnh', error.message || 'Không thể tải ảnh lên.');
    } finally {
      setUploading(false);
    }
  };

  const fetchIngredients = useCallback(async () => {
    try {
      setLoading(true);
      console.log('📥 Fetching ingredients...');
      const data = await authRequest('/api/admin/ingredients');
      console.log(`✅ Got ${(data.ingredients || []).length} ingredients`);
      setIngredients((data.ingredients || []).map(mapIngredient));
    } catch (error) {
      console.error('❌ Fetch error:', error.message);
      console.error('   Full error:', error);
      Alert.alert('Lỗi tải dữ liệu', error.message || 'Không thể tải danh sách nguyên liệu.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchIngredients();
  }, [fetchIngredients]);

  const openCategoryPicker = () => {
    setCategoryPickerOpen(true);
  };

  const closeCategoryPicker = () => {
    setCategoryPickerOpen(false);
  };

  const selectCategory = (categoryKey) => {
    setForm((current) => ({ ...current, category: categoryKey }));
    closeCategoryPicker();
  };

  const submitForm = async () => {
    const normalizedName = form.name.trim();
    if (!normalizedName) {
      Alert.alert('Thiếu dữ liệu', 'Tên nguyên liệu là bắt buộc.');
      return;
    }

    const payload = {
      name: normalizedName,
      type: form.category,
      image_url: form.imageUrl || null,
      is_common: form.popular,
      keywords: form.keywords.trim() || null,
    };

    console.log(`📤 Sending ${modalMode === 'create' ? 'POST' : 'PUT'} request`);
    console.log('   URL:', modalMode === 'create' ? '/api/admin/ingredients' : `/api/admin/ingredients/${form.id}`);
    console.log('   Payload:', JSON.stringify(payload, null, 2));

    try {
      setSubmitting(true);
      if (modalMode === 'create') {
        const response = await authRequest('/api/admin/ingredients', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });
        console.log('✅ Create response:', JSON.stringify(response, null, 2));
      } else {
        const response = await authRequest(`/api/admin/ingredients/${form.id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });
        console.log(`✅ Update response for ID ${form.id}:`, JSON.stringify(response, null, 2));
      }
      closeModal();
      await fetchIngredients();
      Alert.alert('Thành công', modalMode === 'create' ? 'Đã thêm nguyên liệu thành công.' : 'Đã sửa nguyên liệu thành công.');
    } catch (error) {
      console.error('❌ Error:', error.message);
      console.error('   Full error:', error);
      Alert.alert('Lỗi', error.message || 'Không thể lưu nguyên liệu.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDeleteIngredient = (item) => {
    Alert.alert(
      'Xác nhận xóa',
      `Bạn có chắc muốn xóa nguyên liệu "${item.name}" không?`,
      [
        {
          text: 'Hủy',
          style: 'cancel',
        },
        {
          text: 'Xóa',
          style: 'destructive',
          onPress: async () => {
            try {
              await authRequest(`/api/admin/ingredients/${item.id}`, {
                method: 'DELETE',
              });
              await fetchIngredients();
              Alert.alert('Thành công', 'Đã xóa nguyên liệu thành công.');
            } catch (error) {
              Alert.alert('Lỗi xóa', error.message || 'Không thể xóa nguyên liệu.');
            }
          },
        },
      ]
    );
  };

  return (
    <SafeAreaView style={styles.screen} edges={['top', 'bottom']}>
      <AppHeader isGuest={false} onAccountPress={() => setMenuOpen((v) => !v)} />

      {menuOpen ? (
        <View style={styles.menuPopup}>
          <View style={styles.menuHeader}>
            <Text style={styles.menuName}>{displayName}</Text>
            <Text style={styles.menuEmail}>{displayEmail}</Text>
          </View>

          <Pressable style={styles.menuRow} onPress={() => setMenuOpen(false)}>
            <View style={styles.menuIconWrap}>
              <Feather name="settings" size={18} color="#6b7280" />
            </View>
            <Text style={styles.menuText}>Cài đặt tài khoản</Text>
          </Pressable>

          <Pressable
            style={styles.menuRow}
            onPress={() => {
              setMenuOpen(false);
              onLogout?.();
            }}
          >
            <View style={styles.menuIconWrap}>
              <Feather name="log-out" size={18} color="#ef4444" />
            </View>
            <Text style={styles.menuTextDanger}>Đăng xuất</Text>
          </Pressable>
        </View>
      ) : null}

      <View style={styles.content}>
        <View style={styles.searchWrap}>
          <Feather name="search" size={16} color="#9ca3af" />
          <TextInput
            value={searchText}
            onChangeText={setSearchText}
            placeholder="Tìm kiếm nguyên liệu..."
            placeholderTextColor="#9ca3af"
            style={styles.searchInput}
            maxLength={50}
          />
        </View>

        <View style={styles.statRow}>
          <View style={styles.statCard}>
            <Text style={styles.statLabel}>Tổng số</Text>
            <Text style={styles.statValue}>{ingredients.length}</Text>
          </View>
          <View style={styles.statCardAccent}>
            <Text style={styles.statLabelAccent}>Đang hiển thị</Text>
            <Text style={styles.statValueAccent}>{filteredIngredients.length}</Text>
          </View>
        </View>

        <Pressable style={styles.addButton} onPress={openCreateModal}>
          <Feather name="plus" size={16} color="#ffffff" />
          <Text style={styles.addButtonText}>Thêm nguyên liệu</Text>
        </Pressable>

        <ScrollView
          horizontal
          style={styles.chipScroller}
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.chipRow}
        >
          {FILTER_CHIPS.map((chip) => {
            const active = chip.key === activeFilter;
            return (
              <Pressable
                key={chip.key}
                style={[styles.filterChip, active && styles.filterChipActive]}
                onPress={() => setActiveFilter(chip.key)}
              >
                <Text style={[styles.filterChipText, active && styles.filterChipTextActive]}>{chip.label}</Text>
              </Pressable>
            );
          })}
        </ScrollView>

        {loading ? (
          <View style={styles.listLoadingWrap}>
            <ActivityIndicator size="large" color="#f55f12" />
          </View>
        ) : (
          <ScrollView
            style={styles.listWrap}
            contentContainerStyle={styles.listContent}
            showsVerticalScrollIndicator={false}
          >
            {filteredIngredients.length === 0 ? (
              <View style={styles.emptyStateWrap}>
                <Feather name="inbox" size={24} color="#94a3b8" />
                <Text style={styles.emptyStateText}>Không có nguyên liệu phù hợp.</Text>
              </View>
            ) : (
              filteredIngredients.map((item) => (
                <View key={item.id} style={styles.itemCard}>
                  <View style={styles.itemCardInner}>
                    {item.imageUrl ? (
                      <Image source={{ uri: item.imageUrl }} style={styles.cardThumb} />
                    ) : (
                      <View style={[styles.cardThumb, styles.cardThumbPlaceholder]}>
                        <Feather name="image" size={16} color="#d1d5db" />
                      </View>
                    )}
                    <View style={styles.itemBody}>
                      <View style={styles.itemTopRow}>
                        <Text style={styles.itemName}>{item.name}</Text>
                        {item.popular ? (
                          <View style={styles.popularBadge}>
                            <Ionicons name="star" size={14} color="#facc15" />
                          </View>
                        ) : null}
                      </View>
                      <Text style={styles.itemMeta}>{categoryLabel(item.category)}</Text>
                      <Text numberOfLines={1} style={styles.itemKeywords}>{item.keywords || 'Chưa có từ khóa'}</Text>
                      <View style={styles.itemActions}>
                        <Pressable style={[styles.ghostAction, styles.deleteAction]} onPress={() => handleDeleteIngredient(item)}>
                          <Feather name="trash-2" size={14} color="#dc2626" />
                          <Text style={styles.deleteActionText}>Xóa</Text>
                        </Pressable>
                        <Pressable style={styles.ghostAction} onPress={() => openEditModal(item)}>
                          <Feather name="edit-2" size={14} color="#f55f12" />
                          <Text style={styles.ghostActionText}>Sửa</Text>
                        </Pressable>
                      </View>
                    </View>
                  </View>
                </View>
              ))
            )}
          </ScrollView>
        )}
      </View>

      <AppBottomNav
        role="admin"
        activeKey="ingredients"
        onTabPress={(tabKey) => {
          if (tabKey === 'overview') {
            onNavigateOverview?.();
            return;
          }
          if (tabKey === 'recipes') {
            onNavigateRecipeReview?.();
            return;
          }
          if (tabKey === 'users') {
            onNavigateUsers?.();
            return;
          }
          if (tabKey === 'transactions') {
            onNavigateTransactions?.();
            return;
          }
          if (tabKey === 'profile') {
            onLogout?.();
          }
        }}
      />

      <Modal transparent visible={modalOpen} animationType="fade" onRequestClose={closeModal}>
        <View style={styles.modalBackdrop}>
          <View style={styles.modalCard}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>{modalMode === 'edit' ? 'Sửa nguyên liệu' : 'Thêm nguyên liệu'}</Text>
              <Pressable onPress={closeModal} style={styles.closeButton}>
                <Feather name="x" size={20} color="#94a3b8" />
              </Pressable>
            </View>

            <ScrollView
              showsVerticalScrollIndicator={false}
              contentContainerStyle={styles.modalFormContent}
              keyboardShouldPersistTaps="handled"
            >
              <Text style={styles.fieldLabel}>Tên nguyên liệu *</Text>
              <TextInput
                value={form.name}
                onChangeText={(value) => setForm((current) => ({ ...current, name: value }))}
                placeholder="Ức gà"
                placeholderTextColor="#9ca3af"
                style={styles.fieldInput}
              />

              <Text style={styles.fieldLabel}>Danh mục *</Text>
              <Pressable 
                style={styles.selectInput} 
                onPress={openCategoryPicker}
                hitSlop={10}
              >
                <Text style={styles.selectText}>{categoryLabel(form.category)}</Text>
                <Feather name="chevron-down" size={18} color="#94a3b8" />
              </Pressable>

              <Text style={styles.fieldLabel}>Hình ảnh nguyên liệu</Text>
              <View style={styles.uploadRow}>
                <View style={styles.previewBox}>
                  {form.imageUrl ? (
                    <Image source={{ uri: form.imageUrl }} style={styles.previewImage} />
                  ) : (
                    <Feather name="image" size={20} color="#a3a3a3" />
                  )}
                </View>
                <Pressable
                  style={[styles.uploadButton, uploading && styles.uploadButtonDisabled]}
                  onPress={pickAndUploadImage}
                  disabled={uploading}
                >
                  {uploading ? (
                    <ActivityIndicator size="small" color="#9ca3af" />
                  ) : (
                    <>
                      <Feather name="upload-cloud" size={15} color="#9ca3af" />
                      <Text style={styles.uploadButtonText}>Tải ảnh lên</Text>
                    </>
                  )}
                </Pressable>
              </View>

              <Text style={styles.fieldLabel}>Từ khóa tìm kiếm</Text>
              <TextInput
                value={form.keywords}
                onChangeText={(value) => setForm((current) => ({ ...current, keywords: value }))}
                placeholder="VD: ức gà, thịt gà, chicken breast..."
                placeholderTextColor="#9ca3af"
                style={styles.fieldInput}
              />

              <Text style={styles.fieldLabel}>Tùy chọn</Text>
              <View style={styles.statusRow}>
                <Pressable
                  style={styles.checkboxRow}
                  onPress={() => setForm((current) => ({ ...current, popular: !current.popular }))}
                >
                  <View style={[styles.checkbox, form.popular && styles.checkboxActive]}>
                    {form.popular ? <Feather name="check" size={13} color="#ffffff" /> : null}
                  </View>
                  <Text style={styles.checkboxLabel}>Phổ biến</Text>
                </Pressable>
              </View>

              <View style={styles.modalActions}>
                <Pressable style={styles.cancelButton} onPress={closeModal}>
                  <Text style={styles.cancelButtonText}>Hủy</Text>
                </Pressable>
                <Pressable
                  style={[styles.saveButton, submitting && styles.saveButtonDisabled]}
                  onPress={submitForm}
                  disabled={submitting}
                >
                  <Text style={styles.saveButtonText}>{submitting ? 'Đang lưu...' : 'Lưu thay đổi'}</Text>
                </Pressable>
              </View>
            </ScrollView>
          </View>
        </View>
      </Modal>

      <Modal transparent visible={categoryPickerOpen} animationType="fade" onRequestClose={closeCategoryPicker}>
        <View style={styles.pickerBackdrop}>
          <View style={styles.pickerCard}>
            <Text style={styles.pickerTitle}>Chọn danh mục</Text>

            {CATEGORIES.map((item) => {
              const active = item.key === form.category;
              return (
                <Pressable
                  key={item.key}
                  style={[styles.pickerOption, active && styles.pickerOptionActive]}
                  onPress={() => selectCategory(item.key)}
                >
                  <Text style={[styles.pickerOptionText, active && styles.pickerOptionTextActive]}>{item.label}</Text>
                  {active ? <Feather name="check" size={16} color="#f55f12" /> : null}
                </Pressable>
              );
            })}

            <Pressable style={styles.pickerCancelButton} onPress={closeCategoryPicker}>
              <Text style={styles.pickerCancelText}>Hủy</Text>
            </Pressable>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: '#f3f4f6',
    paddingTop: Platform.select({
      ios: 8,
      android: 10,
      web: 0,
      default: 0,
    }),
  },
  menuPopup: {
    position: 'absolute',
    top: 52,
    right: 12,
    width: 250,
    backgroundColor: '#ffffff',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#e5e7eb',
    overflow: 'hidden',
    shadowColor: '#111827',
    shadowOpacity: 0.12,
    shadowOffset: { width: 0, height: 8 },
    shadowRadius: 16,
    elevation: 8,
    zIndex: 30,
  },
  menuHeader: {
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#f3f4f6',
  },
  menuName: {
    fontSize: 17,
    fontWeight: '700',
    color: '#111827',
  },
  menuEmail: {
    marginTop: 2,
    fontSize: 13,
    color: '#6b7280',
  },
  menuRow: {
    minHeight: 54,
    paddingHorizontal: 14,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    borderTopWidth: 1,
    borderTopColor: '#f3f4f6',
  },
  menuIconWrap: {
    width: 30,
    height: 30,
    borderRadius: 10,
    backgroundColor: '#f3f4f6',
    alignItems: 'center',
    justifyContent: 'center',
  },
  menuText: {
    fontSize: 15,
    color: '#374151',
    fontWeight: '500',
  },
  menuTextDanger: {
    fontSize: 15,
    color: '#ef4444',
    fontWeight: '600',
  },
  content: {
    flex: 1,
    paddingHorizontal: 14,
    paddingTop: 12,
  },
  searchWrap: {
    minHeight: 40,
    borderWidth: 1,
    borderColor: '#e5e7eb',
    borderRadius: 10,
    backgroundColor: '#f8fafc',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 10,
  },
  searchInput: {
    flex: 1,
    fontSize: 14,
    color: '#111827',
    paddingVertical: 7,
  },
  statRow: {
    marginTop: 10,
    flexDirection: 'row',
    gap: 8,
  },
  statCard: {
    flex: 1,
    backgroundColor: '#ffffff',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#e5e7eb',
    paddingHorizontal: 10,
    paddingVertical: 8,
  },
  statCardAccent: {
    flex: 1,
    backgroundColor: '#fff7ed',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#fed7aa',
    paddingHorizontal: 10,
    paddingVertical: 8,
  },
  statLabel: {
    fontSize: 12,
    color: '#6b7280',
  },
  statValue: {
    marginTop: 2,
    fontSize: 23,
    fontWeight: '800',
    color: '#111827',
  },
  statLabelAccent: {
    fontSize: 12,
    color: '#c2410c',
  },
  statValueAccent: {
    marginTop: 2,
    fontSize: 23,
    fontWeight: '800',
    color: '#f55f12',
  },
  addButton: {
    marginTop: 10,
    minHeight: 42,
    borderRadius: 10,
    backgroundColor: '#f55f12',
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: 8,
  },
  addButtonText: {
    color: '#ffffff',
    fontSize: 15,
    fontWeight: '700',
  },
  chipScroller: {
    marginTop: 10,
    flexGrow: 0,
    flexShrink: 0,
    maxHeight: 46,
  },
  chipRow: {
    paddingBottom: 2,
    gap: 8,
    alignItems: 'center',
  },
  filterChip: {
    height: 34,
    borderRadius: 9,
    paddingHorizontal: 14,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#f1f5f9',
  },
  filterChipActive: {
    backgroundColor: '#f55f12',
  },
  filterChipText: {
    color: '#334155',
    fontWeight: '600',
    fontSize: 13,
  },
  filterChipTextActive: {
    color: '#ffffff',
  },
  listWrap: {
    marginTop: 6,
    flex: 1,
  },
  listLoadingWrap: {
    marginTop: 6,
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  listContent: {
    paddingHorizontal: 0,
    paddingTop: 12,
    paddingBottom: 28,
  },
  emptyStateWrap: {
    marginTop: 26,
    paddingVertical: 18,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    backgroundColor: '#f8fafc',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  emptyStateText: {
    fontSize: 14,
    color: '#64748b',
    fontWeight: '600',
  },
  itemCard: {
    backgroundColor: '#ffffff',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#e5e7eb',
    paddingHorizontal: 12,
    paddingVertical: 10,
    marginBottom: 10,
  },
  itemTopRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 8,
  },
  itemName: {
    fontSize: 16,
    fontWeight: '700',
    color: '#111827',
    flex: 1,
  },
  popularBadge: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: '#fffbeb',
    borderWidth: 1,
    borderColor: '#fde68a',
    alignItems: 'center',
    justifyContent: 'center',
  },
  itemMeta: {
    marginTop: 4,
    fontSize: 13,
    color: '#6b7280',
  },
  itemKeywords: {
    marginTop: 4,
    fontSize: 13,
    color: '#475569',
  },
  itemActions: {
    marginTop: 8,
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 8,
  },
  ghostAction: {
    minHeight: 30,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#fed7aa',
    paddingHorizontal: 10,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: 6,
    backgroundColor: '#fff7ed',
  },
  ghostActionText: {
    color: '#f55f12',
    fontSize: 13,
    fontWeight: '700',
  },
  deleteAction: {
    borderColor: '#fecaca',
    backgroundColor: '#fff1f2',
  },
  deleteActionText: {
    color: '#dc2626',
    fontSize: 13,
    fontWeight: '700',
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.48)',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 18,
  },
  modalCard: {
    width: '100%',
    maxWidth: 390,
    maxHeight: '88%',
    backgroundColor: '#ffffff',
    borderRadius: 22,
    paddingHorizontal: 16,
    paddingTop: 14,
    paddingBottom: 14,
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  modalTitle: {
    fontSize: 24,
    fontWeight: '800',
    color: '#111827',
  },
  modalFormContent: {
    paddingBottom: 4,
  },
  closeButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  fieldLabel: {
    marginTop: 10,
    marginBottom: 7,
    fontSize: 14,
    fontWeight: '700',
    color: '#374151',
  },
  fieldInput: {
    minHeight: 44,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#dbe1ea',
    paddingHorizontal: 12,
    fontSize: 15,
    color: '#111827',
    backgroundColor: '#ffffff',
  },
  selectInput: {
    minHeight: 44,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#dbe1ea',
    paddingHorizontal: 12,
    alignItems: 'center',
    justifyContent: 'space-between',
    flexDirection: 'row',
    backgroundColor: '#ffffff',
  },
  selectText: {
    color: '#111827',
    fontSize: 15,
    fontWeight: '500',
  },
  uploadRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  previewBox: {
    width: 54,
    height: 54,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#e5e7eb',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#f8fafc',
  },
  uploadButton: {
    flex: 1,
    minHeight: 44,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#d4d4d8',
    borderStyle: 'dashed',
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: 7,
  },
  uploadButtonDisabled: {
    opacity: 0.5,
  },
  uploadButtonText: {
    color: '#64748b',
    fontSize: 15,
    fontWeight: '600',
  },
  statusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  checkboxRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
  },
  checkbox: {
    width: 22,
    height: 22,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#cbd5e1',
    backgroundColor: '#ffffff',
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkboxActive: {
    borderColor: '#f55f12',
    backgroundColor: '#f55f12',
  },
  checkboxLabel: {
    color: '#374151',
    fontWeight: '700',
    fontSize: 15,
  },
  modalActions: {
    marginTop: 18,
    marginBottom: 4,
    flexDirection: 'row',
    gap: 10,
  },
  cancelButton: {
    flex: 1,
    minHeight: 46,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#dbe1ea',
    backgroundColor: '#ffffff',
    alignItems: 'center',
    justifyContent: 'center',
  },
  cancelButtonText: {
    color: '#475569',
    fontSize: 16,
    fontWeight: '700',
  },
  saveButton: {
    flex: 1,
    minHeight: 46,
    borderRadius: 14,
    backgroundColor: '#f55f12',
    alignItems: 'center',
    justifyContent: 'center',
  },
  saveButtonDisabled: {
    opacity: 0.6,
  },
  saveButtonText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '700',
  },
  pickerBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.38)',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 18,
  },
  pickerCard: {
    width: '100%',
    maxWidth: 360,
    backgroundColor: '#ffffff',
    borderRadius: 16,
    paddingHorizontal: 14,
    paddingTop: 14,
    paddingBottom: 12,
  },
  pickerTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: '#111827',
    marginBottom: 10,
  },
  pickerOption: {
    minHeight: 44,
    borderRadius: 10,
    paddingHorizontal: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  pickerOptionActive: {
    backgroundColor: '#fff7ed',
    borderWidth: 1,
    borderColor: '#fed7aa',
  },
  pickerOptionText: {
    color: '#374151',
    fontSize: 15,
    fontWeight: '600',
  },
  pickerOptionTextActive: {
    color: '#c2410c',
  },
  pickerCancelButton: {
    marginTop: 8,
    minHeight: 42,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#e5e7eb',
  },
  pickerCancelText: {
    fontSize: 15,
    color: '#475569',
    fontWeight: '700',
  },
  cardThumb: {
    width: 54,
    height: 54,
    borderRadius: 10,
  },
  cardThumbPlaceholder: {
    backgroundColor: '#f1f5f9',
    alignItems: 'center',
    justifyContent: 'center',
  },
  itemCardInner: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
  },
  itemBody: {
    flex: 1,
  },
  previewImage: {
    width: 52,
    height: 52,
    borderRadius: 11,
  },
});
