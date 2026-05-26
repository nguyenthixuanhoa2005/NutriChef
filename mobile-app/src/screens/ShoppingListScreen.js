import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Platform,
  Pressable,
  StyleSheet,
  Text,
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

const SHOPPING_LIST_STORAGE_KEY = 'nutrichef_shopping_list';

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

  useEffect(() => {
    loadShoppingList();
  }, []);

  const loadShoppingList = async () => {
    try {
      const saved = await AsyncStorage.getItem(SHOPPING_LIST_STORAGE_KEY);
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
      await AsyncStorage.setItem(SHOPPING_LIST_STORAGE_KEY, JSON.stringify(newList));
    } catch (e) {
      console.error('Failed to save shopping list', e);
    }
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
          {item.name}
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
          <Text style={styles.title}>Danh sách đi chợ</Text>
          {list.some(i => i.checked) && (
            <Pressable onPress={clearChecked} style={styles.clearBtn}>
              <Text style={styles.clearBtnText}>Xóa mục đã chọn</Text>
            </Pressable>
          )}
        </View>

        {loading ? (
          <ActivityIndicator size="large" color="#f97316" style={{ marginTop: 40 }} />
        ) : list.length === 0 ? (
          <View style={styles.emptyState}>
            <MaterialCommunityIcons name="basket-outline" size={64} color="#cbd5e1" />
            <Text style={styles.emptyText}>Chưa có nguyên liệu nào trong danh sách.</Text>
            <Text style={styles.emptySubText}>Thêm nguyên liệu từ các công thức món ăn để bắt đầu đi chợ nhé!</Text>
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
  title: {
    fontFamily: FONT_BOLD,
    fontSize: 24,
    color: '#0f172a',
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
});
