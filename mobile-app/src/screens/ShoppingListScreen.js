import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Modal,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Feather, MaterialCommunityIcons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { AppBottomNav, AppHeader, AppAccountMenu } from '../components/AppChrome';

const FONT_REGULAR = Platform.select({
  ios: 'AvenirNext-Regular',
  android: 'sans-serif',
  default: 'system-ui',
});

const FONT_BOLD = Platform.select({
  ios: 'AvenirNext-DemiBold',
  android: 'sans-serif-condensed',
  default: 'system-ui',
});

// Helpers for storage keys
const getShoppingListKey = (userId) => `nutrichef_shopping_list_${userId || 'guest'}`;

export default function ShoppingListScreen({
  onNavigateShopping,
  isGuest = false,
  user,
  usageCount,
  onLoginPress,
  onSignupPress,
  onRequestLogout,
  onNavigateHome,
  onNavigateSuggest,
  onNavigateMeal,
  onNavigateRecipeSubmission,
  onNavigateFavorites,
  onNavigateUpgrade,
}) {
  const [list, setList] = useState([]);
  const [loading, setLoading] = useState(true);
  const [menuOpen, setMenuOpen] = useState(false);
  
  // States for manual adding
  const [modalVisible, setModalVisible] = useState(false);
  const [newItemName, setNewItemName] = useState('');
  const [newItemQty, setNewItemQty] = useState('');
  const [newItemUnit, setNewItemUnit] = useState('');

  useEffect(() => {
    loadShoppingList();
  }, []);

  const loadShoppingList = async () => {
    try {
      const storageKey = getShoppingListKey(user?.userId);
      const saved = await AsyncStorage.getItem(storageKey);
      if (saved) {
        setList(JSON.parse(saved));
      }
    } catch (e) {
      console.error('Failed to load shopping list', e);
    } finally {
      setLoading(false);
    }
  };

  const saveShoppingList = async (newList) => {
    try {
      const storageKey = getShoppingListKey(user?.userId);
      await AsyncStorage.setItem(storageKey, JSON.stringify(newList));
    } catch (e) {
      console.error('Failed to save shopping list', e);
    }
  };

  const addItemManually = () => {
    if (!newItemName.trim()) {
      Alert.alert('Thiếu thông tin', 'Vui lòng nhập tên nguyên liệu.');
      return;
    }

    // Kiểm tra số lượng nếu người dùng có nhập
    if (newItemQty.trim()) {
      const qtyNum = parseFloat(newItemQty);
      if (isNaN(qtyNum) || qtyNum <= 0) {
        Alert.alert('Số lượng không hợp lệ', 'Vui lòng nhập số lượng lớn hơn 0.');
        return;
      }
    }

    const newItem = {
      id: Date.now().toString() + Math.random().toString(36).substr(2, 5),
      name: newItemName.trim(),
      qty: newItemQty.trim(),
      unit: newItemUnit.trim(),
      recipeTitle: 'Tự thêm',
      checked: false,
    };

    const newList = [newItem, ...list];
    setList(newList);
    saveShoppingList(newList);
    
    // Reset form
    setNewItemName('');
    setNewItemQty('');
    setNewItemUnit('');
    setModalVisible(false);
  };

  const toggleItem = (id) => {
    const newList = list.map((item) => {
      if (item.id === id) {
        return { ...item, checked: !item.checked };
      }
      return item;
    });

    // Reorder: checked items at bottom
    const sorted = [...newList].sort((a, b) => {
      if (a.checked === b.checked) return 0;
      return a.checked ? 1 : -1;
    });

    setList(sorted);
    saveShoppingList(sorted);
  };

  const removeItem = (id) => {
    const newList = list.filter((item) => item.id !== id);
    setList(newList);
    saveShoppingList(newList);
  };

  const clearChecked = () => {
    const newList = list.filter((item) => !item.checked);
    setList(newList);
    saveShoppingList(newList);
  };

  const handleBottomTabPress = (tabKey) => {
    if (tabKey === 'home') onNavigateHome?.();
    else if (tabKey === 'suggest') onNavigateSuggest?.();
    else if (tabKey === 'menu') onNavigateMeal?.();
    else if (tabKey === 'recipes') onNavigateRecipeSubmission?.();
    else if (tabKey === 'favorites') onNavigateFavorites?.();
    else if (tabKey === 'upgrade') onNavigateUpgrade?.();
    else if (tabKey === 'shopping') {
      if (typeof onNavigateShopping === 'function') {
        onNavigateShopping();
      } else {
        loadShoppingList();
      }
    }
  };

  const renderItem = ({ item }) => (
    <View style={[styles.itemCard, item.checked && styles.itemCardChecked]}>
      <Pressable onPress={() => toggleItem(item.id)} style={styles.checkboxArea}>
        <MaterialCommunityIcons
          name={item.checked ? 'checkbox-marked' : 'checkbox-blank-outline'}
          size={24}
          color={item.checked ? '#94a3b8' : '#f97316'}
        />
      </Pressable>
      <View style={styles.itemContent}>
        <Text style={[styles.itemName, item.checked && styles.itemNameChecked]}>
          {item.name}{item.qty ? ` (${item.qty} ${item.unit || ''})` : ''}
        </Text>
        {item.recipeTitle && (
          <Text style={styles.itemSource}>Món: {item.recipeTitle}</Text>
        )}
      </View>
      <Pressable onPress={() => removeItem(item.id)} style={styles.removeButton}>
        <Feather name="trash-2" size={18} color="#ef4444" />
      </Pressable>
    </View>
  );

  return (
    <SafeAreaView style={styles.screen} edges={['top', 'bottom']}>
      <AppHeader
        user={user}
        onUpgradePress={onNavigateUpgrade}
        onLoginPress={onLoginPress}
        onSignupPress={onSignupPress}
        isGuest={isGuest}
        onAccountPress={() => setMenuOpen(true)}
      />

      <AppAccountMenu
        visible={menuOpen}
        onClose={() => setMenuOpen(false)}
        user={user}
        onLogout={onRequestLogout}
      />

      <View style={styles.container}>
        <View style={styles.headerRow}>
          <Text style={[styles.title, { fontWeight: '800' }]}>Giỏ hàng</Text>
          <View style={styles.headerActions}>
            <Pressable onPress={() => setModalVisible(true)} style={styles.addBtnHeader}>
              <Feather name="plus-circle" size={20} color="#f97316" />
            </Pressable>
            {list.some(i => i.checked) && (
              <Pressable onPress={clearChecked} style={styles.clearBtn}>
                <Text style={styles.clearBtnText}>Xóa đã chọn</Text>
              </Pressable>
            )}
          </View>
        </View>

        {loading ? (
          <ActivityIndicator size="large" color="#f97316" style={{ marginTop: 40 }} />
        ) : list.length === 0 ? (
          <View style={styles.emptyState}>
            <MaterialCommunityIcons name="cart-outline" size={64} color="#cbd5e1" />
            <Text style={styles.emptyText}>Chưa có nguyên liệu nào trong giỏ hàng.</Text>
            <Text style={styles.emptySubText}>Thêm nguyên liệu từ các công thức món ăn hoặc bấm dấu + để tự thêm nhé!</Text>
            <Pressable onPress={() => setModalVisible(true)} style={styles.emptyAddBtn}>
              <Text style={styles.emptyAddBtnText}>Thêm thủ công ngay</Text>
            </Pressable>
          </View>
        ) : (
          <FlatList
            data={list}
            renderItem={renderItem}
            keyExtractor={(item) => item.id}
            contentContainerStyle={styles.listContent}
          />
        )}
      </View>

      {/* Manual Add Modal */}
      <Modal
        animationType="fade"
        transparent={true}
        visible={modalVisible}
        onRequestClose={() => setModalVisible(false)}
      >
        <View style={styles.modalBackdrop}>
          <View style={styles.modalCard}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Thêm nguyên liệu</Text>
              <Pressable onPress={() => setModalVisible(false)}>
                <Feather name="x" size={22} color="#64748b" />
              </Pressable>
            </View>

            <View style={styles.modalBody}>
              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>Tên nguyên liệu *</Text>
                <TextInput
                  style={styles.textInput}
                  placeholder="Ví dụ: Thịt bò, Cà chua..."
                  value={newItemName}
                  onChangeText={setNewItemName}
                />
              </View>

              <View style={styles.rowInputs}>
                <View style={[styles.inputGroup, { flex: 1 }]}>
                  <Text style={styles.inputLabel}>Số lượng</Text>
                  <TextInput
                    style={styles.textInput}
                    placeholder="Ví dụ: 500, 2..."
                    value={newItemQty}
                    onChangeText={setNewItemQty}
                    keyboardType="numeric"
                  />
                </View>
                <View style={[styles.inputGroup, { flex: 1 }]}>
                  <Text style={styles.inputLabel}>Đơn vị</Text>
                  <TextInput
                    style={styles.textInput}
                    placeholder="Ví dụ: g, quả, kg..."
                    value={newItemUnit}
                    onChangeText={setNewItemUnit}
                  />
                </View>
              </View>

              <Pressable onPress={addItemManually} style={styles.submitBtn}>
                <Text style={styles.submitBtnText}>Thêm vào giỏ</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>

      <AppBottomNav
        activeKey="shopping"
        onTabPress={handleBottomTabPress}
        user={user}
        usageCount={usageCount}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: '#f8fafc',
  },
  container: {
    flex: 1,
    paddingHorizontal: 16,
    paddingTop: 16,
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  title: {
    fontFamily: FONT_BOLD,
    fontSize: 24,
    color: '#0f172a',
  },
  addBtnHeader: {
    padding: 4,
  },
  clearBtn: {
    paddingVertical: 4,
  },
  clearBtnText: {
    color: '#ef4444',
    fontSize: 14,
    fontWeight: '600',
  },
  listContent: {
    paddingBottom: 24,
    gap: 12,
  },
  itemCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 12,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    shadowColor: '#000',
    shadowOpacity: 0.05,
    shadowOffset: { width: 0, height: 2 },
    shadowRadius: 4,
    elevation: 2,
  },
  itemCardChecked: {
    backgroundColor: '#f1f5f9',
    borderColor: '#cbd5e1',
    opacity: 0.7,
  },
  checkboxArea: {
    paddingRight: 12,
  },
  itemContent: {
    flex: 1,
  },
  itemName: {
    fontFamily: FONT_BOLD,
    fontSize: 16,
    color: '#334155',
  },
  itemNameChecked: {
    textDecorationLine: 'line-through',
    color: '#94a3b8',
  },
  itemSource: {
    fontSize: 12,
    color: '#64748b',
    marginTop: 2,
  },
  removeButton: {
    padding: 8,
  },
  emptyState: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: -60,
  },
  emptyText: {
    fontFamily: FONT_BOLD,
    fontSize: 18,
    color: '#64748b',
    marginTop: 16,
    textAlign: 'center',
  },
  emptySubText: {
    fontSize: 14,
    color: '#94a3b8',
    marginTop: 8,
    textAlign: 'center',
    paddingHorizontal: 32,
  },
  emptyAddBtn: {
    marginTop: 20,
    backgroundColor: '#fff7ed',
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 99,
    borderWidth: 1,
    borderColor: '#ffedd5',
  },
  emptyAddBtnText: {
    color: '#f97316',
    fontWeight: '700',
    fontSize: 14,
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  modalCard: {
    width: '100%',
    backgroundColor: '#fff',
    borderRadius: 16,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOpacity: 0.2,
    shadowOffset: { width: 0, height: 10 },
    shadowRadius: 15,
    elevation: 10,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#f1f5f9',
  },
  modalTitle: {
    fontSize: 18,
    fontFamily: FONT_BOLD,
    color: '#0f172a',
  },
  modalBody: {
    padding: 16,
    gap: 16,
  },
  inputGroup: {
    gap: 6,
  },
  inputLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#64748b',
  },
  textInput: {
    height: 44,
    borderWidth: 1,
    borderColor: '#cbd5e1',
    borderRadius: 8,
    paddingHorizontal: 12,
    fontSize: 15,
    color: '#1e293b',
    backgroundColor: '#f8fafc',
  },
  rowInputs: {
    flexDirection: 'row',
    gap: 12,
  },
  submitBtn: {
    backgroundColor: '#f97316',
    height: 48,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 8,
  },
  submitBtnText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '700',
  },
});
