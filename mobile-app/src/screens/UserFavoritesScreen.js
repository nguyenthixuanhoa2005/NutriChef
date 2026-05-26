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
  View,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Feather, MaterialCommunityIcons } from '@expo/vector-icons';
import { AppBottomNav, AppHeader, AppAccountMenu } from '../components/AppChrome';
import { authRequest, request } from '../services/client';

// Helpers for storage keys
const getShoppingListKey = (userId) => `nutrichef_shopping_list_${userId || 'guest'}`;
const getPrepListKey = (userId) => `nutrichef_prep_status_${userId || 'guest'}`;

const FALLBACK_IMAGE =
  'https://images.unsplash.com/photo-1517248135467-4c7edcad34c4?auto=format&fit=crop&w=1200&q=80';

const FONT_BOLD = Platform.select({
  ios: 'AvenirNext-DemiBold',
  android: 'sans-serif-condensed',
  default: 'system-ui',
});

const formatDate = (value) => {
  const date = value ? new Date(value) : null;
  if (!date || Number.isNaN(date.getTime())) {
    return '--';
  }

  return new Intl.DateTimeFormat('vi-VN', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  }).format(date);
};

const goalLabel = (value) => {
  const normalized = String(value || '').toUpperCase();
  if (normalized === 'LOSE_WEIGHT') return 'Giảm cân';
  if (normalized === 'GAIN_WEIGHT') return 'Tăng cân';
  return 'Duy trì';
};

const mealTypeLabel = (value) => {
  const normalized = String(value || '').toLowerCase();
  if (normalized === 'breakfast') return 'Bữa sáng';
  if (normalized === 'lunch') return 'Bữa trưa';
  if (normalized === 'dinner') return 'Bữa tối';
  return 'Bữa ăn';
};

const parseIngredientList = (json) => {
  if (!json) return [];
  try {
    const parsed = typeof json === 'string' ? JSON.parse(json) : json;
    return Array.isArray(parsed) ? parsed : [];
  } catch (e) {
    return [];
  }
};

export default function UserFavoritesScreen({
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
  onNavigateUpgrade,
  onNavigateShopping,
  onOpenRecipeDetail,
}) {
  const [activeTab, setActiveTab] = useState('recipes');
  const [loading, setLoading] = useState(false);
  const [favoriteRecipes, setFavoriteRecipes] = useState([]);
  const [favoriteMealSets, setFavoriteMealSets] = useState([]);
  const [expandedMealSetId, setExpandedMealSetId] = useState(null);
  const [mealSetRecipesMap, setMealSetRecipesMap] = useState({});
  const [mealSetLoadingMap, setMealSetLoadingMap] = useState({});
  const [menuOpen, setMenuOpen] = useState(false);

  // New state for ingredient expansion
  const [expandedRecipeId, setExpandedRecipeId] = useState(null);
  const [localIngredientStatus, setLocalIngredientStatus] = useState({}); // { [recipeId]: { [ingName]: boolean } }
  const [fetchingRecipeId, setFetchingRecipeId] = useState(null);
  const [shoppingList, setShoppingList] = useState([]); // Persistent shopping list for sync

  const displayEmail = useMemo(() => user?.email || 'user@nutrichef.app', [user]);

  const fetchRecipeDetailIfMissing = async (recipe, type = 'direct') => {
    // Check if we already have ingredients
    const existingIngredients = parseIngredientList(recipe.ingredients_json);
    if (existingIngredients.length > 0) {
      return recipe;
    }

    try {
      setFetchingRecipeId(recipe.recipe_id);
      const data = await request(`/api/recipes/${recipe.recipe_id}`);
      const detail = data?.recipe;
      
      if (detail) {
        // Update the local state with the full detail
        if (type === 'direct') {
          setFavoriteRecipes(current => 
            current.map(r => r.recipe_id === recipe.recipe_id ? { ...r, ...detail } : r)
          );
        } else {
          // It's inside a meal set
          setMealSetRecipesMap(current => {
            const nextMap = { ...current };
            Object.keys(nextMap).forEach(msId => {
              nextMap[msId] = nextMap[msId].map(r => 
                r.recipe_id === recipe.recipe_id ? { ...r, ...detail } : r
              );
            });
            return nextMap;
          });
        }
        return { ...recipe, ...detail };
      }
    } catch (error) {
      console.error('Failed to fetch recipe detail for expansion', error);
    } finally {
      setFetchingRecipeId(null);
    }
    return recipe;
  };

  const handleToggleExpand = async (recipe, contextId, type) => {
    if (expandedRecipeId === contextId) {
      setExpandedRecipeId(null);
      return;
    }

    // Attempt to fetch if data is missing
    await fetchRecipeDetailIfMissing(recipe, type);
    setExpandedRecipeId(contextId);
  };

  const loadFavorites = useCallback(async () => {
    if (isGuest) {
      setFavoriteRecipes([]);
      setFavoriteMealSets([]);
      return;
    }

    try {
      setLoading(true);
      setExpandedMealSetId(null);
      setExpandedRecipeId(null);
      setMealSetRecipesMap({});
      setMealSetLoadingMap({});
      const [recipeData, mealSetData] = await Promise.all([
        authRequest('/api/recipes/favorites'),
        authRequest('/api/meal-sets/favorites'),
      ]);

      setFavoriteRecipes(Array.isArray(recipeData?.recipes) ? recipeData.recipes : []);
      setFavoriteMealSets(Array.isArray(mealSetData?.mealSets) ? mealSetData.mealSets : []);
    } catch (error) {
      Alert.alert('Lỗi tải dữ liệu', error.message || 'Không thể tải danh sách yêu thích.');
    } finally {
      setLoading(false);
    }
  }, [isGuest]);

  const loadPrepStatus = useCallback(async () => {
    try {
      const storageKey = getPrepListKey(user?.userId);
      const saved = await AsyncStorage.getItem(storageKey);
      if (saved) {
        setLocalIngredientStatus(JSON.parse(saved));
      }
    } catch (e) {
      console.error('Failed to load prep status', e);
    }
  }, [user?.userId]);

  const savePrepStatus = async (newStatus) => {
    try {
      const storageKey = getPrepListKey(user?.userId);
      await AsyncStorage.setItem(storageKey, JSON.stringify(newStatus));
    } catch (e) {
      console.error('Failed to save prep status', e);
    }
  };

  const loadShoppingListForSync = useCallback(async () => {
    try {
      const storageKey = getShoppingListKey(user?.userId);
      const saved = await AsyncStorage.getItem(storageKey);
      if (saved) {
        setShoppingList(JSON.parse(saved));
      }
    } catch (e) {
      console.error('Failed to load shopping list for sync', e);
    }
  }, [user?.userId]);

  useEffect(() => {
    loadFavorites();
    loadShoppingListForSync();
    loadPrepStatus();
  }, [loadFavorites, loadShoppingListForSync, loadPrepStatus]);

  const recipeCountText = useMemo(() => {
    return `${favoriteRecipes.length} công thức`;
  }, [favoriteRecipes.length]);

  const mealSetCountText = useMemo(() => {
    return `${favoriteMealSets.length} mâm cơm`;
  }, [favoriteMealSets.length]);

  const handleBottomTabPress = (tabKey) => {
    if (tabKey === 'home') onNavigateHome?.();
    else if (tabKey === 'suggest') onNavigateSuggest?.();
    else if (tabKey === 'menu') onNavigateMeal?.();
    else if (tabKey === 'recipes') onNavigateRecipeSubmission?.();
    else if (tabKey === 'upgrade') onNavigateUpgrade?.();
    else if (tabKey === 'shopping') onNavigateShopping?.();
    else if (tabKey === 'favorites') { /* current */ }
  };

  const addToShoppingList = async (ingredientName, recipeTitle, qty, unit) => {
    try {
      const storageKey = getShoppingListKey(user?.userId);
      const saved = await AsyncStorage.getItem(storageKey);
      let list = saved ? JSON.parse(saved) : [];
      
      const newItem = {
        id: Date.now().toString() + Math.random().toString(36).substr(2, 5),
        name: ingredientName,
        recipeTitle: recipeTitle,
        qty: qty,
        unit: unit,
        checked: false,
      };

      list.push(newItem);
      await AsyncStorage.setItem(storageKey, JSON.stringify(list));
      Alert.alert('Thành công', `Đã thêm "${ingredientName}" vào giỏ hàng.`);
    } catch (e) {
      console.error('Failed to add to shopping list', e);
    }
  };

  const toggleLocalIngredient = (recipeId, ingName) => {
    setLocalIngredientStatus((prev) => {
      const recipeStatus = prev[recipeId] || {};
      const isChecked = recipeStatus[ingName] || false;
      
      const newStatus = {
        ...prev,
        [recipeId]: {
          ...recipeStatus,
          [ingName]: !isChecked,
        },
      };
      savePrepStatus(newStatus);
      return newStatus;
    });
  };

  const renderRecipeIngredients = (recipe) => {
    const rawIngredients = typeof recipe.ingredients_json === 'string'
      ? JSON.parse(recipe.ingredients_json)
      : (recipe.ingredients_json || []);
    
    if (rawIngredients.length === 0) {
      return (
        <View style={styles.expandedIngredients}>
          <Text style={styles.emptyIngredientsText}>Không có dữ liệu nguyên liệu.</Text>
        </View>
      );
    }

    const statusMap = localIngredientStatus[recipe.recipe_id] || {};
    
    const sorted = [...rawIngredients].sort((a, b) => {
      const aChecked = statusMap[a.name] || shoppingList.some(c => c.name.toLowerCase() === a.name.toLowerCase() && c.checked);
      const bChecked = statusMap[b.name] || shoppingList.some(c => c.name.toLowerCase() === b.name.toLowerCase() && c.checked);
      if (aChecked === bChecked) return 0;
      return aChecked ? 1 : -1;
    });

    const allReady = rawIngredients.every(ing => {
      const isBought = shoppingList.some(cartItem => 
        cartItem.name.toLowerCase() === ing.name.toLowerCase() && 
        cartItem.checked
      );
      return statusMap[ing.name] || isBought;
    });

    return (
      <View style={styles.expandedIngredients}>
        <View style={styles.expandedHeaderRow}>
          <Text style={styles.expandedTitle}>Nguyên liệu cần thiết:</Text>
          {allReady && (
            <Pressable 
              onPress={() => onOpenRecipeDetail?.(recipe.recipe_id, { autoStartCooking: true })} 
              style={styles.miniCookNowBtn}
            >
              <MaterialCommunityIcons name="fire" size={14} color="#fff" />
              <Text style={styles.miniCookNowBtnText}>Nấu ngay</Text>
            </Pressable>
          )}
        </View>
        {sorted.map((ing, idx) => {
          const isBought = shoppingList.some(cartItem => 
            cartItem.name.toLowerCase() === ing.name.toLowerCase() && 
            cartItem.checked
          );
          const isChecked = statusMap[ing.name] || isBought;
          
          return (
            <Pressable 
              key={`${ing.name}-${idx}`} 
              style={styles.ingredientRow}
              onPress={() => toggleLocalIngredient(recipe.recipe_id, ing.name)}
            >
              <View style={styles.ingCheckbox}>
                <MaterialCommunityIcons 
                  name={isChecked ? 'checkbox-marked' : 'checkbox-blank-outline'} 
                  size={20} 
                  color={isChecked ? '#94a3b8' : '#f97316'} 
                />
              </View>
              
              <Text style={[styles.ingName, isChecked && styles.ingNameChecked]}>
                {ing.name}{ing.qty ? ` (${ing.qty} ${ing.unit || ''})` : ''}
              </Text>

              {!isChecked && (
                <Pressable 
                  onPress={(e) => {
                    e.stopPropagation();
                    addToShoppingList(ing.name, recipe.title, ing.qty, ing.unit);
                  }}
                  style={styles.ingAddBtn}
                  hitSlop={8}
                >
                  <Feather name="plus-circle" size={18} color="#f97316" />
                </Pressable>
              )}
            </Pressable>
          );
        })}
      </View>
    );
  };

  const loadMealSetRecipes = useCallback(async (mealSetId) => {
    const id = Number(mealSetId);
    if (!Number.isInteger(id) || id <= 0) {
      return;
    }

    if (mealSetRecipesMap[id]) {
      return;
    }

    try {
      setMealSetLoadingMap((current) => ({ ...current, [id]: true }));
      const data = await authRequest(`/api/meal-sets/${id}/recipes`);
      const recipes = Array.isArray(data?.recipes) ? data.recipes : [];
      setMealSetRecipesMap((current) => ({
        ...current,
        [id]: recipes,
      }));
    } catch (error) {
      Alert.alert('Lỗi tải món', error.message || 'Không thể tải món ăn trong mâm cơm này.');
    } finally {
      setMealSetLoadingMap((current) => ({ ...current, [id]: false }));
    }
  }, [mealSetRecipesMap]);

  const handleToggleMealSetExpand = async (mealSetId) => {
    const id = Number(mealSetId);
    if (!Number.isInteger(id) || id <= 0) {
      return;
    }

    if (expandedMealSetId === id) {
      setExpandedMealSetId(null);
      return;
    }

    setExpandedMealSetId(id);
    await loadMealSetRecipes(id);
  };

  return (
    <SafeAreaView style={styles.screen} edges={['top', 'bottom']}>
      <AppHeader
        user={user}
        onUpgradePress={onNavigateUpgrade}
        onLoginPress={onLoginPress}
        onSignupPress={onSignupPress}
        isGuest={isGuest}
        onAccountPress={() => setMenuOpen((current) => !current)}
      />

      <AppAccountMenu
        visible={menuOpen}
        onClose={() => setMenuOpen(false)}
        user={user}
        onLogout={onRequestLogout}
      />

      <ScrollView contentContainerStyle={styles.container}>
        <View style={styles.card}>
          <Text style={styles.title}>Mục yêu thích của bạn</Text>
          <Text style={styles.subtitle}>Xem nhanh công thức và mâm cơm bạn đã lưu.</Text>

          <View style={styles.tabRow}>
            <Pressable
              style={[styles.tabButton, activeTab === 'recipes' && styles.tabButtonActive]}
              onPress={() => setActiveTab('recipes')}
            >
              <Text style={[styles.tabText, activeTab === 'recipes' && styles.tabTextActive]}>Công thức</Text>
              <Text style={[styles.tabCount, activeTab === 'recipes' && styles.tabCountActive]}>{recipeCountText}</Text>
            </Pressable>

            <Pressable
              style={[styles.tabButton, activeTab === 'mealSets' && styles.tabButtonActive]}
              onPress={() => setActiveTab('mealSets')}
            >
              <Text style={[styles.tabText, activeTab === 'mealSets' && styles.tabTextActive]}>Mâm cơm</Text>
              <Text style={[styles.tabCount, activeTab === 'mealSets' && styles.tabCountActive]}>{mealSetCountText}</Text>
            </Pressable>
          </View>
        </View>

        {loading ? (
          <View style={styles.loadingWrap}>
            <ActivityIndicator size="small" color="#f97316" />
          </View>
        ) : null}

        {!loading && activeTab === 'recipes' ? (
          favoriteRecipes.length > 0 ? (
            favoriteRecipes.map((item) => (
              <View key={`fav-recipe-${item.recipe_id}`} style={styles.recipeCardWrapper}>
                <Pressable
                  style={styles.itemCard}
                  onPress={() => onOpenRecipeDetail?.(item.recipe_id)}
                >
                  <Image source={{ uri: item.image_url || FALLBACK_IMAGE }} style={styles.itemImage} />
                  <View style={styles.itemBody}>
                    <Text style={styles.itemTitle}>{item.title}</Text>
                    <Text style={styles.itemMeta}>
                      {Number(item.cooking_time) || 0} phút • {Math.round(Number(item.total_calories) || 0)} kcal
                    </Text>
                    <Text style={styles.itemMeta}>Yêu thích: {Number(item.like_count) || 0}</Text>
                  </View>
                  <View style={styles.itemActions}>
                    <Pressable 
                      onPress={() => handleToggleExpand(item, item.recipe_id, 'direct')}
                      style={[styles.shoppingToggleBtn, expandedRecipeId === item.recipe_id && styles.shoppingToggleBtnActive]}
                      disabled={fetchingRecipeId === item.recipe_id}
                    >
                      {fetchingRecipeId === item.recipe_id ? (
                        <ActivityIndicator size="small" color="#f97316" />
                      ) : (
                        <MaterialCommunityIcons 
                          name={expandedRecipeId === item.recipe_id ? 'chevron-up' : 'format-list-checks'} 
                          size={20} 
                          color={expandedRecipeId === item.recipe_id ? '#fff' : '#f97316'} 
                        />
                      )}
                    </Pressable>
                    <Feather name="chevron-right" size={18} color="#9ca3af" />
                  </View>
                </Pressable>
                {expandedRecipeId === item.recipe_id && renderRecipeIngredients(item)}
              </View>
            ))
          ) : (
            <View style={styles.emptyCard}>
              <Feather name="heart" size={20} color="#94a3b8" />
              <Text style={styles.emptyText}>Bạn chưa có công thức yêu thích nào.</Text>
            </View>
          )
        ) : null}

        {!loading && activeTab === 'mealSets' ? (
          favoriteMealSets.length > 0 ? (
            favoriteMealSets.map((item) => (
              <View key={`fav-meal-set-${item.meal_set_id}`} style={styles.mealSetCardWrap}>
                <View style={styles.itemCard}>
                  <Image source={{ uri: item.image_url || FALLBACK_IMAGE }} style={styles.itemImage} />
                  <View style={styles.itemBody}>
                    <Text style={styles.itemTitle}>{item.name || 'Mâm cơm yêu thích'}</Text>
                    <Text style={styles.itemMeta}>
                      {mealTypeLabel(item.meal_type)} • {goalLabel(item.goal_type)}
                    </Text>
                    <Text style={styles.itemMeta}>
                      {Math.round(Number(item.total_calories) || 0)} kcal • {Number(item.recipe_count) || 0} món
                    </Text>
                    <Text style={styles.itemMeta}>Lưu ngày: {formatDate(item.saved_at || item.created_at)}</Text>
                  </View>
                </View>

                <Pressable
                  style={styles.expandButton}
                  onPress={() => handleToggleMealSetExpand(item.meal_set_id)}
                >
                  <Text style={styles.expandButtonText}>
                    {expandedMealSetId === Number(item.meal_set_id) ? 'Ẩn món trong mâm' : 'Xem món trong mâm'}
                  </Text>
                  <Feather
                    name={expandedMealSetId === Number(item.meal_set_id) ? 'chevron-up' : 'chevron-down'}
                    size={16}
                    color="#f97316"
                  />
                </Pressable>

                {expandedMealSetId === Number(item.meal_set_id) ? (
                  <View style={styles.innerRecipeList}>
                    {mealSetLoadingMap[Number(item.meal_set_id)] ? (
                      <ActivityIndicator size="small" color="#f97316" />
                    ) : (
                      (mealSetRecipesMap[Number(item.meal_set_id)] || []).map((recipe) => (
                        <View key={`meal-set-${item.meal_set_id}-recipe-${recipe.recipe_id}`} style={styles.recipeCardWrapper}>
                          <Pressable
                            style={styles.innerRecipeRow}
                            onPress={() => onOpenRecipeDetail?.(recipe.recipe_id)}
                          >
                            <Image source={{ uri: recipe.image_url || FALLBACK_IMAGE }} style={styles.innerRecipeImage} />
                            <View style={styles.innerRecipeBody}>
                              <Text style={styles.innerRecipeTitle}>{recipe.title}</Text>
                              <Text style={styles.innerRecipeMeta}>
                                {Number(recipe.cooking_time) || 0} phút • {Math.round(Number(recipe.total_calories) || 0)} kcal
                              </Text>
                            </View>
                            <View style={styles.itemActions}>
                              <Pressable 
                                onPress={() => handleToggleExpand(recipe, `${item.meal_set_id}-${recipe.recipe_id}`, 'mealSet')}
                                style={[styles.shoppingToggleBtn, expandedRecipeId === `${item.meal_set_id}-${recipe.recipe_id}` && styles.shoppingToggleBtnActive]}
                                disabled={fetchingRecipeId === recipe.recipe_id}
                              >
                                {fetchingRecipeId === recipe.recipe_id ? (
                                  <ActivityIndicator size="small" color="#f97316" />
                                ) : (
                                  <MaterialCommunityIcons 
                                    name={expandedRecipeId === `${item.meal_set_id}-${recipe.recipe_id}` ? 'chevron-up' : 'format-list-checks'} 
                                    size={18} 
                                    color={expandedRecipeId === `${item.meal_set_id}-${recipe.recipe_id}` ? '#fff' : '#f97316'} 
                                  />
                                )}
                              </Pressable>
                              <Feather name="chevron-right" size={16} color="#9ca3af" />
                            </View>
                          </Pressable>
                          {expandedRecipeId === `${item.meal_set_id}-${recipe.recipe_id}` && renderRecipeIngredients(recipe)}
                        </View>
                      ))
                    )}
                  </View>
                ) : null}
              </View>
            ))
          ) : (
            <View style={styles.emptyCard}>
              <MaterialCommunityIcons name="silverware-fork-knife" size={20} color="#94a3b8" />
              <Text style={styles.emptyText}>Bạn chưa có mâm cơm yêu thích nào.</Text>
            </View>
          )
        ) : null}
      </ScrollView>

      {!isGuest ? (
        <AppBottomNav
          activeKey="favorites"
          onTabPress={handleBottomTabPress}
          user={user}
          usageCount={usageCount}
        />
      ) : null}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: '#eef1f5',
  },
  container: {
    paddingHorizontal: 14,
    paddingTop: 12,
    gap: 12,
    paddingBottom: 28,
  },
  card: {
    backgroundColor: '#fff',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#e5e7eb',
    padding: 14,
    gap: 10,
  },
  title: {
    fontSize: 22,
    fontWeight: '700',
    color: '#111827',
  },
  subtitle: {
    fontSize: 13,
    color: '#64748b',
  },
  tabRow: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 2,
  },
  tabButton: {
    flex: 1,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#e5e7eb',
    backgroundColor: '#f8fafc',
    paddingVertical: 10,
    alignItems: 'center',
    gap: 3,
  },
  tabButtonActive: {
    borderColor: '#fdba74',
    backgroundColor: '#fff7ed',
  },
  tabText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#475569',
  },
  tabTextActive: {
    color: '#c2410c',
  },
  tabCount: {
    fontSize: 12,
    color: '#94a3b8',
  },
  tabCountActive: {
    color: '#ea580c',
  },
  loadingWrap: {
    paddingVertical: 16,
    alignItems: 'center',
  },
  itemCard: {
    backgroundColor: '#fff',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#e5e7eb',
    padding: 10,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  mealSetCardWrap: {
    backgroundColor: '#fff',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#e5e7eb',
    overflow: 'hidden',
  },
  itemImage: {
    width: 82,
    height: 82,
    borderRadius: 10,
    backgroundColor: '#e5e7eb',
  },
  itemBody: {
    flex: 1,
    gap: 2,
  },
  itemTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#111827',
  },
  itemMeta: {
    fontSize: 12,
    color: '#64748b',
  },
  expandButton: {
    borderTopWidth: 1,
    borderTopColor: '#f1f5f9',
    paddingHorizontal: 12,
    minHeight: 40,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#fff7ed',
  },
  expandButtonText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#f97316',
  },
  innerRecipeList: {
    borderTopWidth: 1,
    borderTopColor: '#ffedd5',
    backgroundColor: '#fff',
    padding: 10,
    gap: 8,
  },
  innerRecipeRow: {
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#e5e7eb',
    padding: 8,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  innerRecipeImage: {
    width: 52,
    height: 52,
    borderRadius: 8,
    backgroundColor: '#e5e7eb',
  },
  innerRecipeBody: {
    flex: 1,
  },
  innerRecipeTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: '#111827',
  },
  innerRecipeMeta: {
    marginTop: 2,
    fontSize: 12,
    color: '#64748b',
  },
  emptyCard: {
    backgroundColor: '#fff',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#e5e7eb',
    paddingVertical: 22,
    alignItems: 'center',
    gap: 8,
  },
  emptyText: {
    fontSize: 13,
    color: '#64748b',
  },
  menuBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(17, 24, 39, 0.25)',
    justifyContent: 'flex-start',
  },
  menuPopup: {
    marginTop: 80,
    marginRight: 14,
    alignSelf: 'flex-end',
    width: 260,
    borderRadius: 14,
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: '#e5e7eb',
    shadowColor: '#111827',
    shadowOpacity: 0.15,
    shadowOffset: { width: 0, height: 10 },
    shadowRadius: 18,
    elevation: 10,
    overflow: 'hidden',
  },
  menuHeader: {
    backgroundColor: '#fff7ed',
    borderBottomWidth: 1,
    borderBottomColor: '#fed7aa',
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  menuName: {
    fontSize: 16,
    fontWeight: '700',
    color: '#111827',
  },
  menuEmail: {
    marginTop: 2,
    fontSize: 13,
    color: '#6b7280',
  },
  menuRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  menuIconWrap: {
    width: 30,
    height: 30,
    borderRadius: 8,
    backgroundColor: '#f3f4f6',
    alignItems: 'center',
    justifyContent: 'center',
  },
  menuText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#374151',
  },
  menuTextDanger: {
    fontSize: 14,
    fontWeight: '700',
    color: '#ef4444',
  },
  recipeCardWrapper: {
    backgroundColor: '#fff',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#e5e7eb',
    overflow: 'hidden',
  },
  itemActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  shoppingToggleBtn: {
    width: 34,
    height: 34,
    borderRadius: 8,
    backgroundColor: '#fff7ed',
    borderWidth: 1,
    borderColor: '#ffedd5',
    alignItems: 'center',
    justifyContent: 'center',
  },
  shoppingToggleBtnActive: {
    backgroundColor: '#f97316',
    borderColor: '#f97316',
  },
  expandedIngredients: {
    padding: 12,
    backgroundColor: '#f8fafc',
    borderTopWidth: 1,
    borderTopColor: '#e5e7eb',
  },
  expandedHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  expandedTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: '#334155',
  },
  miniCookNowBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#10b981',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
  },
  miniCookNowBtnText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '800',
  },
  ingredientRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 6,
  },
  ingCheckbox: {
    marginRight: 8,
  },
  ingName: {
    flex: 1,
    fontSize: 14,
    color: '#475569',
  },
  ingNameChecked: {
    textDecorationLine: 'line-through',
    color: '#94a3b8',
  },
  ingAddBtn: {
    padding: 4,
  },
  emptyIngredientsText: {
    fontSize: 13,
    color: '#94a3b8',
    fontStyle: 'italic',
  },
});
