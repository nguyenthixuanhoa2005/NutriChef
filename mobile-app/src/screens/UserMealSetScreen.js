import React, { useEffect, useMemo, useRef, useState } from 'react';
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
import { SafeAreaView } from 'react-native-safe-area-context';
import Slider from '@react-native-community/slider';
import { Feather, MaterialCommunityIcons } from '@expo/vector-icons';
import { AppBottomNav, AppHeader } from '../components/AppChrome';
import { authRequest, request } from '../services/client';

const MEAL_TIME_OPTIONS = [
  { key: 'breakfast', label: 'Bữa sáng', icon: 'weather-sunset-up' },
  { key: 'lunch', label: 'Bữa trưa', icon: 'weather-sunny' },
  { key: 'dinner', label: 'Bữa tối', icon: 'weather-night' },
];

const GOAL_OPTIONS = [
  { key: 'lose', label: 'Giảm cân', range: [400, 600] },
  { key: 'maintain', label: 'Duy trì', range: [600, 800] },
  { key: 'gain', label: 'Tăng cân', range: [800, 1200] },
];

const MEAL_SLOT_LABELS = ['Cơm trắng', 'Món mặn', 'Rau củ', 'Canh', 'Món phụ'];
const CALORIE_MIN = 400;
const CALORIE_MAX = 1200;
const CALORIE_STEP = 50;

let cachedMealScreenState = null;

const getDishCountForMealTime = (mealTime) => {
  if (mealTime === 'breakfast') {
    return 2 + Math.floor(Math.random() * 2); // 2-3 mon
  }

  if (mealTime === 'lunch') {
    return 3 + Math.floor(Math.random() * 3); // 3-5 mon
  }

  return 5; // Dinner is always 5 dishes.
};

const FONT_REGULAR = Platform.select({
  ios: 'AvenirNext-Regular',
  android: 'sans-serif',
  default: 'system-ui',
});

const FONT_MEDIUM = Platform.select({
  ios: 'AvenirNext-Medium',
  android: 'sans-serif-medium',
  default: 'system-ui',
});

const FONT_BOLD = Platform.select({
  ios: 'AvenirNext-DemiBold',
  android: 'sans-serif-condensed',
  default: 'system-ui',
});

const resolveRecipeImage = (imageUrl) => {
  const fallback = 'https://images.unsplash.com/photo-1512621776951-a57141f2eefd?auto=format&fit=crop&w=1200&q=80';
  if (!imageUrl) {
    return fallback;
  }

  const trimmed = String(imageUrl).trim();
  if (!trimmed) {
    return fallback;
  }

  return trimmed;
};

const clampToRange = (value, min, max) => Math.min(max, Math.max(min, value));

const snapToStep = (value, step) => Math.round(value / step) * step;

const inferGoalFromCalories = (calories) => {
  const value = Number(calories) || CALORIE_MIN;
  if (value <= GOAL_OPTIONS[0].range[1]) {
    return GOAL_OPTIONS[0].key;
  }

  if (value <= GOAL_OPTIONS[1].range[1]) {
    return GOAL_OPTIONS[1].key;
  }

  return GOAL_OPTIONS[2].key;
};

const buildMacroFromCalories = (calories) => {
  const normalizedCalories = Math.max(0, Number(calories) || 0);
  const protein = Math.round((normalizedCalories * 0.2) / 4);
  const carbs = Math.round((normalizedCalories * 0.5) / 4);
  const fat = Math.round((normalizedCalories * 0.3) / 9);
  return { protein, carbs, fat };
};

const dedupeRecipes = (recipes) => {
  const uniqueMap = new Map();
  (recipes || []).forEach((item) => {
    const id = Number(item?.recipe_id);
    if (!Number.isInteger(id) || id <= 0) {
      return;
    }

    if (!uniqueMap.has(id)) {
      uniqueMap.set(id, item);
    }
  });

  return [...uniqueMap.values()];
};

const sumNutrition = (mealItems) =>
  mealItems.reduce(
    (acc, item) => ({
      calories: acc.calories + (Number(item?.calories) || 0),
      protein: acc.protein + (Number(item?.protein) || 0),
      carbs: acc.carbs + (Number(item?.carbs) || 0),
      fat: acc.fat + (Number(item?.fat) || 0),
    }),
    { calories: 0, protein: 0, carbs: 0, fat: 0 }
  );

const findBestCombo = (entries, pickCount, targetTotalCalories) => {
  let bestEntries = null;
  let bestDiff = Number.POSITIVE_INFINITY;

  const backtrack = (startIndex, chosen, currentSum) => {
    if (chosen.length === pickCount) {
      const diff = Math.abs(currentSum - targetTotalCalories);
      if (diff < bestDiff) {
        bestDiff = diff;
        bestEntries = [...chosen];
      }
      return;
    }

    if (startIndex >= entries.length) {
      return;
    }

    const remainNeed = pickCount - chosen.length;
    const remainSource = entries.length - startIndex;
    if (remainSource < remainNeed) {
      return;
    }

    for (let index = startIndex; index < entries.length; index += 1) {
      chosen.push(entries[index]);
      backtrack(index + 1, chosen, currentSum + entries[index].calories);
      chosen.pop();
    }
  };

  backtrack(0, [], 0);
  return bestEntries;
};

const buildMealItems = ({ recipes, targetCalories, mealTime }) => {
  const uniqueRecipes = dedupeRecipes(recipes);
  if (uniqueRecipes.length === 0) {
    return [];
  }

  const pickCount = getDishCountForMealTime(mealTime);
  const targetTotal = Math.max(0, Number(targetCalories) || 0);
  const perDishCalories = Math.max(60, Math.round(targetTotal / pickCount));
  const scored = uniqueRecipes.map((recipe, idx) => {
    const recipeCalories = toDbCalories(recipe?.total_calories);
    return {
      id: `${recipe.recipe_id}-${idx}`,
      recipe,
      calories: recipeCalories ?? perDishCalories,
      scoreToDishTarget: Math.abs((recipeCalories ?? perDishCalories) - perDishCalories),
    };
  });

  const sortedByDishTarget = [...scored].sort(
    (left, right) => left.scoreToDishTarget - right.scoreToDishTarget
  );

  const comboPool = sortedByDishTarget.slice(0, Math.min(20, sortedByDishTarget.length));
  const bestCombo = comboPool.length >= pickCount
    ? findBestCombo(comboPool, pickCount, targetTotal)
    : null;

  let chosenEntries = bestCombo;

  if (!chosenEntries || chosenEntries.length < pickCount) {
    const fallbackEntries = [];
    for (let index = 0; index < pickCount; index += 1) {
      fallbackEntries.push(sortedByDishTarget[index % sortedByDishTarget.length]);
    }
    chosenEntries = fallbackEntries;
  }

  const picked = [];
  chosenEntries.forEach((entry, index) => {
    if (!entry?.recipe) {
      return;
    }

    const recipe = entry.recipe;
    const calories = entry.calories;
    const macros = buildMacroFromCalories(calories);
    picked.push({
      key: `${recipe.recipe_id}-${index}`,
      slotLabel: MEAL_SLOT_LABELS[index] || `Món ${index + 1}`,
      recipe,
      calories,
      protein: macros.protein,
      carbs: macros.carbs,
      fat: macros.fat,
    });
  });

  if (picked.length < pickCount) {
    for (let index = picked.length; index < pickCount; index += 1) {
      const entry = sortedByDishTarget[index % sortedByDishTarget.length];
      if (!entry?.recipe) {
        continue;
      }

      const recipe = entry.recipe;
      const calories = entry.calories;
      const macros = buildMacroFromCalories(calories);
      picked.push({
        key: `${recipe.recipe_id}-${index}-fallback`,
        slotLabel: MEAL_SLOT_LABELS[index] || `Món ${index + 1}`,
        recipe,
        calories,
        protein: macros.protein,
        carbs: macros.carbs,
        fat: macros.fat,
      });
    }
  }

  return picked.slice(0, pickCount);
};

const parseIngredientCount = (ingredientsJson) =>
  Array.isArray(ingredientsJson) ? ingredientsJson.filter(Boolean).length : 0;

const toDbGoalType = (goalKey) => {
  if (goalKey === 'lose') {
    return 'LOSE_WEIGHT';
  }

  if (goalKey === 'gain') {
    return 'GAIN_WEIGHT';
  }

  return 'MAINTAIN';
};

const toDbCalories = (value) => {
  const numeric = Number(value);
  return Number.isFinite(numeric) ? Math.max(0, Math.round(numeric)) : null;
};

const goalLabelByKey = (goalKey) => {
  if (goalKey === 'lose') {
    return 'Giảm cân';
  }

  if (goalKey === 'gain') {
    return 'Tăng cân';
  }

  return 'Duy trì';
};
export default function UserMealSetScreen({
  isGuest = false,
  user,
  onLoginPress,
  onSignupPress,
  onGoBack,
  onRequestLogout,
  onNavigateHome,
  onNavigateSuggest,
  onNavigateRecipeSubmission,
  onNavigateFavorites,
  onNavigateUpgrade,
  onOpenRecipeDetail,
}) {
  const [mealTime, setMealTime] = useState(() => cachedMealScreenState?.mealTime || 'lunch');
  const [mealGoal, setMealGoal] = useState(() => cachedMealScreenState?.mealGoal || 'maintain');
  const [targetCalories, setTargetCalories] = useState(() => cachedMealScreenState?.targetCalories || 650);
  const [loadingPool, setLoadingPool] = useState(true);
  const [isGeneratingMeal, setIsGeneratingMeal] = useState(false);
  const [isSavingMeal, setIsSavingMeal] = useState(false);
  const [recipePool, setRecipePool] = useState(() => cachedMealScreenState?.recipePool || []);
  const [mealItems, setMealItems] = useState(() => cachedMealScreenState?.mealItems || []);
  const [viewMode, setViewMode] = useState(() => cachedMealScreenState?.viewMode || 'builder');
  const [menuOpen, setMenuOpen] = useState(false);
  const [favoriteRecipeMap, setFavoriteRecipeMap] = useState({});
  const [favoritePendingId, setFavoritePendingId] = useState(null);
  const [saveToastMessage, setSaveToastMessage] = useState('');
  const [saveToastType, setSaveToastType] = useState('success');
  const [showSaveToast, setShowSaveToast] = useState(false);
  const saveToastTimerRef = useRef(null);

  const displayName = useMemo(() => user?.fullName || user?.name || 'Người dùng', [user]);
  const displayEmail = useMemo(() => user?.email || 'user@nutrichef.app', [user]);

  const selectedGoalMeta = useMemo(
    () => GOAL_OPTIONS.find((item) => item.key === mealGoal) || GOAL_OPTIONS[1],
    [mealGoal]
  );

  const totalNutrition = useMemo(() => sumNutrition(mealItems), [mealItems]);

  const handleCaloriesChange = (value) => {
    const nextCalories = clampToRange(Number(value) || CALORIE_MIN, CALORIE_MIN, CALORIE_MAX);
    setTargetCalories(nextCalories);
    setMealGoal(inferGoalFromCalories(nextCalories));
  };

  const hydrateMealItemsFromDb = async (items) => {
    const hydrated = await Promise.all(
      items.map(async (item) => {
        const recipeId = Number(item?.recipe?.recipe_id);
        if (!Number.isInteger(recipeId) || recipeId <= 0) {
          return item;
        }

        try {
          const data = await request(`/api/recipes/${recipeId}`);
          const detail = data?.recipe;
          if (!detail) {
            return item;
          }

          const calories = toDbCalories(detail.total_calories) ?? toDbCalories(item.calories) ?? 0;
          const macros = buildMacroFromCalories(calories);
          return {
            ...item,
            recipe: {
              ...item.recipe,
              ...detail,
            },
            calories,
            protein: macros.protein,
            carbs: macros.carbs,
            fat: macros.fat,
            ingredientCount: parseIngredientCount(detail.ingredients_json),
          };
        } catch {
          return item;
        }
      })
    );

    return hydrated;
  };

  useEffect(() => {
    cachedMealScreenState = {
      mealTime,
      mealGoal,
      targetCalories,
      recipePool,
      mealItems,
      viewMode,
    };
  }, [mealGoal, mealItems, mealTime, recipePool, targetCalories, viewMode]);

  useEffect(() => {
    let mounted = true;

    const fetchPool = async () => {
      try {
        if (!cachedMealScreenState?.recipePool?.length) {
          setLoadingPool(true);
        }
        const data = await request('/api/recipes/trending?limit=30');
        if (!mounted) {
          return;
        }

        const recipes = Array.isArray(data?.recipes) ? data.recipes : [];
        setRecipePool(recipes);
      } catch (error) {
        if (mounted) {
          Alert.alert('Lỗi tải dữ liệu', error.message || 'Không thể tải danh sách món ăn.');
        }
      } finally {
        if (mounted) {
          setLoadingPool(false);
        }
      }
    };

    fetchPool();

    return () => {
      mounted = false;
    };
  }, []);

  useEffect(() => {
    setTargetCalories((current) => clampToRange(current, CALORIE_MIN, CALORIE_MAX));
  }, [selectedGoalMeta]);

  useEffect(() => () => {
    if (saveToastTimerRef.current) {
      clearTimeout(saveToastTimerRef.current);
    }
  }, []);

  const handleGenerateMeal = async () => {
    const validTarget = clampToRange(targetCalories, CALORIE_MIN, CALORIE_MAX);
    const built = buildMealItems({ recipes: recipePool, targetCalories: validTarget, mealTime });

    if (built.length === 0) {
      Alert.alert('Không có dữ liệu', 'Hiện chưa đủ món để tạo mâm cơm.');
      return;
    }

    setIsGeneratingMeal(true);
    try {
      const hydrated = await hydrateMealItemsFromDb(built);
      setMealItems(hydrated);
      setViewMode('result');
    } finally {
      setIsGeneratingMeal(false);
    }
  };

  const handleSaveMealSet = async () => {
    if (isGuest) {
      Alert.alert('Yêu cầu đăng nhập', 'Bạn cần đăng nhập để lưu mâm cơm yêu thích.', [
        { text: 'Để sau', style: 'cancel' },
        { text: 'Đăng nhập', onPress: () => onLoginPress?.() },
      ]);
      return;
    }

    if (mealItems.length === 0) {
      Alert.alert('Chưa có mâm cơm', 'Hãy tạo mâm cơm trước khi lưu.');
      return;
    }

    const recipeIds = mealItems
      .map((item) => Number(item?.recipe?.recipe_id))
      .filter((id) => Number.isInteger(id) && id > 0);

    if (recipeIds.length === 0) {
      Alert.alert('Thiếu dữ liệu', 'Không tìm thấy món ăn hợp lệ để lưu.');
      return;
    }

    const payload = {
      name: `Mâm ${mealTime} ${targetCalories} kcal`,
      targetCalories,
      mealType: mealTime,
      goalType: toDbGoalType(mealGoal),
      imageUrl: mealItems[0]?.recipe?.image_url || null,
      recipeIds,
    };

    setIsSavingMeal(true);
    try {
      const response = await authRequest('/api/meal-sets/favorite', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      });

      const savedCalories = toDbCalories(response?.mealSet?.total_calories);
      const successMessage = `Đã lưu mâm cơm vào mục yêu thích${savedCalories !== null ? ` - ${savedCalories} kcal` : ''}.`;
      setSaveToastMessage(successMessage);
      setSaveToastType('success');
      setShowSaveToast(true);
      if (saveToastTimerRef.current) {
        clearTimeout(saveToastTimerRef.current);
      }
      saveToastTimerRef.current = setTimeout(() => {
        setShowSaveToast(false);
      }, 2200);
    } catch (error) {
      setSaveToastMessage(error.message || 'Không thể lưu mâm cơm vào hệ thống.');
      setSaveToastType('error');
      setShowSaveToast(true);
      if (saveToastTimerRef.current) {
        clearTimeout(saveToastTimerRef.current);
      }
      saveToastTimerRef.current = setTimeout(() => {
        setShowSaveToast(false);
      }, 2600);
    } finally {
      setIsSavingMeal(false);
    }
  };

  const handleRebuildMeal = async () => {
    await handleGenerateMeal();
  };

  useEffect(() => {
    let cancelled = false;

    const loadFavoriteStatus = async () => {
      if (isGuest || mealItems.length === 0) {
        setFavoriteRecipeMap({});
        return;
      }

      const ids = [...new Set(
        mealItems
          .map((item) => Number(item?.recipe?.recipe_id))
          .filter((id) => Number.isInteger(id) && id > 0)
      )];

      if (ids.length === 0) {
        setFavoriteRecipeMap({});
        return;
      }

      try {
        const statuses = await Promise.all(
          ids.map(async (id) => {
            try {
              const response = await authRequest(`/api/recipes/${id}/favorite-status`);
              return { id, isFavorite: Boolean(response?.isFavorite) };
            } catch {
              return { id, isFavorite: false };
            }
          })
        );

        if (cancelled) {
          return;
        }

        const nextMap = statuses.reduce((acc, item) => {
          acc[item.id] = item.isFavorite;
          return acc;
        }, {});
        setFavoriteRecipeMap(nextMap);
      } catch {
        if (!cancelled) {
          setFavoriteRecipeMap({});
        }
      }
    };

    loadFavoriteStatus();

    return () => {
      cancelled = true;
    };
  }, [isGuest, mealItems]);

  const handleToggleRecipeFavorite = async (recipeId) => {
    const id = Number(recipeId);
    if (!Number.isInteger(id) || id <= 0) {
      return;
    }

    if (isGuest) {
      Alert.alert('Yêu cầu đăng nhập', 'Bạn cần đăng nhập để lưu công thức yêu thích.', [
        { text: 'Để sau', style: 'cancel' },
        { text: 'Đăng nhập', onPress: () => onLoginPress?.() },
      ]);
      return;
    }

    try {
      setFavoritePendingId(id);
      const currentValue = Boolean(favoriteRecipeMap[id]);
      const response = await authRequest(`/api/recipes/${id}/favorite`, {
        method: currentValue ? 'DELETE' : 'POST',
      });
      const nextValue = Boolean(response?.isFavorite);
      setFavoriteRecipeMap((current) => ({
        ...current,
        [id]: nextValue,
      }));
    } catch (error) {
      Alert.alert('Lỗi yêu thích', error.message || 'Không thể cập nhật yêu thích.');
    } finally {
      setFavoritePendingId(null);
    }
  };

  const handleSwapMealItem = (index) => {
    const uniquePool = dedupeRecipes(recipePool);
    if (uniquePool.length <= 1) {
      Alert.alert('Thông báo', 'Hiện chưa đủ món để đổi.');
      return;
    }

    setMealItems((current) => {
      const targetItem = current[index];
      if (!targetItem?.recipe) {
        return current;
      }

      const usedIds = new Set(current.map((item) => Number(item.recipe?.recipe_id)).filter(Boolean));
      const fallbackCandidates = uniquePool.filter(
        (item) => Number(item.recipe_id) !== Number(targetItem.recipe.recipe_id)
      );
      const availableCandidates = uniquePool.filter((item) => {
        const candidateId = Number(item.recipe_id);
        return candidateId !== Number(targetItem.recipe.recipe_id) && !usedIds.has(candidateId);
      });

      const candidatePool = availableCandidates.length > 0 ? availableCandidates : fallbackCandidates;
      const targetTotalCalories = Math.max(0, Number(targetCalories) || 0);
      const currentTotalCalories = current.reduce(
        (sum, mealItem) => sum + (toDbCalories(mealItem?.calories) ?? 0),
        0
      );
      const currentItemCalories = toDbCalories(targetItem?.calories) ?? 0;
      const otherItemsCalories = Math.max(0, currentTotalCalories - currentItemCalories);
      const dishCount = Math.max(1, current.length);
      const perDishTargetCalories = Math.max(60, Math.round(targetTotalCalories / dishCount));

      const replacement = [...candidatePool].sort((left, right) => {
        const leftCalories = toDbCalories(left?.total_calories) ?? perDishTargetCalories;
        const rightCalories = toDbCalories(right?.total_calories) ?? perDishTargetCalories;

        const leftTotalDiff = Math.abs((otherItemsCalories + leftCalories) - targetTotalCalories);
        const rightTotalDiff = Math.abs((otherItemsCalories + rightCalories) - targetTotalCalories);

        if (leftTotalDiff !== rightTotalDiff) {
          return leftTotalDiff - rightTotalDiff;
        }

        // Tie-breaker: pick candidate closer to ideal per-dish calories.
        return Math.abs(leftCalories - perDishTargetCalories) - Math.abs(rightCalories - perDishTargetCalories);
      })[0];

      if (!replacement) {
        return current;
      }

      const calories = toDbCalories(replacement.total_calories)
        ?? toDbCalories(targetItem.calories)
        ?? perDishTargetCalories;
      const macros = buildMacroFromCalories(calories);
      const swapped = current.map((item, itemIndex) =>
        itemIndex === index
          ? {
              ...item,
              recipe: replacement,
              key: `${replacement.recipe_id}-${itemIndex}-${Date.now()}`,
              calories,
              protein: macros.protein,
              carbs: macros.carbs,
              fat: macros.fat,
            }
          : item
      );

      hydrateMealItemsFromDb(swapped).then((hydrated) => setMealItems(hydrated));
      return swapped;
    });
  };

  const handleBottomTabPress = (tabKey) => {
    if (tabKey === 'home') {
      onNavigateHome?.();
      return;
    }

    if (tabKey === 'suggest') {
      onNavigateSuggest?.();
      return;
    }

    if (tabKey === 'recipes') {
      onNavigateRecipeSubmission?.();
      return;
    }

    if (tabKey === 'favorites') {
      onNavigateFavorites?.();
      return;
    }

    if (tabKey === 'upgrade') {
      onNavigateUpgrade?.();
      return;
    }
  };

  const handleAccountPress = () => {
    setMenuOpen((current) => !current);
  };

  return (
    <SafeAreaView style={styles.screen} edges={['top', 'bottom']}>
      <AppHeader
        user={user}
        onUpgradePress={onNavigateUpgrade}
        onLoginPress={onLoginPress}
        onSignupPress={onLoginPress}
        isGuest={isGuest}
        onAccountPress={handleAccountPress}
      />

      {!isGuest ? (
        <Modal
          visible={menuOpen}
          transparent
          animationType="fade"
          onRequestClose={() => setMenuOpen(false)}
        >
          <Pressable style={styles.menuBackdrop} onPress={() => setMenuOpen(false)}>
            <View style={styles.menuPopup}>
              <View style={styles.menuHeader}>
                <Text style={styles.menuName}>{displayName}</Text>
                <Text style={styles.menuEmail}>{displayEmail}</Text>
              </View>

              <Pressable
                style={styles.menuRow}
                onPress={() => {
                  setMenuOpen(false);
                  Alert.alert('Tài khoản', 'Tính năng cài đặt sẽ được bổ sung sau.');
                }}
              >
                <View style={styles.menuIconWrap}>
                  <Feather name="settings" size={18} color="#6b7280" />
                </View>
                <Text style={styles.menuText}>Cài đặt tài khoản</Text>
              </Pressable>

              <Pressable
                style={styles.menuRow}
                onPress={() => {
                  setMenuOpen(false);
                  onRequestLogout?.();
                }}
              >
                <View style={styles.menuIconWrap}>
                  <Feather name="log-out" size={18} color="#ef4444" />
                </View>
                <Text style={styles.menuTextDanger}>Đăng xuất</Text>
              </Pressable>
            </View>
          </Pressable>
        </Modal>
      ) : null}

      <ScrollView contentContainerStyle={styles.container}>
        {viewMode === 'builder' ? (
          <View style={styles.card}>
            <Text style={styles.sectionTitle}>CHỌN BỮA ĂN</Text>
            <View style={styles.mealTimeRow}>
              {MEAL_TIME_OPTIONS.map((option) => {
                const active = mealTime === option.key;
                return (
                  <Pressable
                    key={option.key}
                    onPress={() => setMealTime(option.key)}
                    style={[styles.mealTimeButton, active && styles.mealTimeButtonActive]}
                  >
                    <MaterialCommunityIcons
                      name={option.icon}
                      size={20}
                      color={active ? '#f97316' : '#9ca3af'}
                    />
                    <Text style={[styles.mealTimeText, active && styles.mealTimeTextActive]}>{option.label}</Text>
                  </Pressable>
                );
              })}
            </View>

            <Text style={styles.sectionTitle}>MỤC TIÊU</Text>
            <View style={styles.goalList}>
              {GOAL_OPTIONS.map((goal) => {
                const active = mealGoal === goal.key;
                return (
                  <Pressable
                    key={goal.key}
                    onPress={() => {
                      setMealGoal(goal.key);
                      const [minValue, maxValue] = goal.range;
                      const midpoint = (minValue + maxValue) / 2;
                      const nextCalories = snapToStep(midpoint, CALORIE_STEP);
                      setTargetCalories(clampToRange(nextCalories, CALORIE_MIN, CALORIE_MAX));
                    }}
                    style={[styles.goalCard, active && styles.goalCardActive]}
                  >
                    <Text style={[styles.goalTitle, active && styles.goalTitleActive]}>{goal.label}</Text>
                    <Text style={styles.goalSubTitle}>{goal.range[0]} - {goal.range[1]} kcal/bữa</Text>
                  </Pressable>
                );
              })}
            </View>

            <Text style={styles.sectionTitle}>TỔNG CALO</Text>
            <View style={styles.calorieHeader}>
              <Text style={styles.calorieCurrentText}>{targetCalories}</Text>
              <Text style={styles.calorieCurrentLabel}>kcal</Text>
            </View>

            <Slider
              minimumValue={CALORIE_MIN}
              maximumValue={CALORIE_MAX}
              step={CALORIE_STEP}
              value={targetCalories}
              onValueChange={handleCaloriesChange}
              minimumTrackTintColor="#f97316"
              maximumTrackTintColor="#e5e7eb"
              thumbTintColor="#ea580c"
              style={styles.slider}
            />

            <View style={styles.calorieRangeLabels}>
              <Text style={styles.calorieRangeLabel}>{CALORIE_MIN} kcal</Text>
              <Text style={styles.calorieRangeLabel}>{CALORIE_MAX} kcal</Text>
            </View>

            <Text style={styles.goalHintText}>
              Khoảng khuyến nghị cho mục tiêu này: {selectedGoalMeta.range[0]} - {selectedGoalMeta.range[1]} kcal/bữa
            </Text>

            <Pressable
              onPress={handleGenerateMeal}
              style={[styles.generateButton, (loadingPool || isGeneratingMeal) && styles.disabledButton]}
              disabled={loadingPool || isGeneratingMeal}
            >
              {loadingPool || isGeneratingMeal ? (
                <ActivityIndicator color="#fff" size="small" />
              ) : (
                <>
                  <MaterialCommunityIcons name="silverware-fork-knife" size={18} color="#fff" />
                  <Text style={styles.generateButtonText}>Tạo mâm cơm</Text>
                </>
              )}
            </Pressable>
          </View>
        ) : null}

        {viewMode === 'result' && mealItems.length > 0 ? (
          <View style={styles.resultCard}>
            <View style={styles.resultBackRow}>
              <Pressable
                style={styles.resultBackButton}
                onPress={() => setViewMode('builder')}
              >
                <Feather name="arrow-left" size={16} color="#f97316" />
                <Text style={styles.resultBackText}>Quay lại</Text>
              </Pressable>
            </View>
            <View style={styles.resultHeader}>
              <Text style={styles.resultTitle}>Mâm cơm của bạn</Text>
              <View style={styles.nutritionSummaryRow}>
                <View style={styles.nutritionItem}>
                  <Text style={styles.nutritionLabel}>TỔNG CALO</Text>
                  <Text style={styles.nutritionValue}>{totalNutrition.calories}</Text>
                </View>
                <View style={styles.nutritionItemNoBorder}>
                  <Text style={styles.nutritionLabel}>MỤC TIÊU</Text>
                  <Text style={styles.nutritionValueSmall}>{goalLabelByKey(mealGoal)}</Text>
                </View>
              </View>
              <Text style={styles.goalTargetHint}>Mục tiêu đặt: {targetCalories} kcal</Text>
            </View>

            <View style={styles.menuList}>
              {mealItems.map((item, index) => (
                <View key={item.key} style={styles.menuItemCard}>
                  <Image source={{ uri: resolveRecipeImage(item.recipe?.image_url) }} style={styles.menuItemImage} />
                  <View style={styles.menuItemBody}>
                    <Text style={styles.menuItemTitle}>{item.recipe?.title || item.slotLabel}</Text>
                    <Text style={styles.menuItemSub}>{item.slotLabel}</Text>
                    <Text style={styles.menuItemMeta}>
                      {item.recipe?.difficulty || '--'} • {item.recipe?.cooking_time || '--'} phút • {item.ingredientCount || 0} nguyên liệu
                    </Text>
                    {item.recipe?.description ? (
                      <Text numberOfLines={2} style={styles.menuItemDescription}>{item.recipe.description}</Text>
                    ) : null}
                    <Pressable style={styles.swapButton} onPress={() => handleSwapMealItem(index)}>
                      <MaterialCommunityIcons name="swap-horizontal" size={16} color="#f97316" />
                      <Text style={styles.swapButtonText}>Đổi món này</Text>
                    </Pressable>
                  </View>
                  <View style={styles.menuSideMeta}>
                    <View style={styles.calorieChip}>
                      <Text style={styles.calorieChipText}>{toDbCalories(item.calories) ?? '--'} kcal</Text>
                    </View>
                    <Pressable
                      onPress={() => handleToggleRecipeFavorite(item.recipe?.recipe_id)}
                      disabled={favoritePendingId === Number(item.recipe?.recipe_id)}
                    >
                      {favoritePendingId === Number(item.recipe?.recipe_id) ? (
                        <ActivityIndicator size="small" color="#ef4444" />
                      ) : (
                        <Feather
                          name="heart"
                          size={18}
                          color={favoriteRecipeMap[Number(item.recipe?.recipe_id)] ? '#ef4444' : '#9ca3af'}
                        />
                      )}
                    </Pressable>
                    <Pressable onPress={() => onOpenRecipeDetail?.(item.recipe?.recipe_id)}>
                      <Feather name="eye" size={18} color="#60a5fa" />
                    </Pressable>
                  </View>
                </View>
              ))}
            </View>

            <View style={styles.actionRow}>
              <Pressable
                style={[styles.saveButton, isSavingMeal && styles.disabledButton]}
                onPress={handleSaveMealSet}
                disabled={isSavingMeal}
              >
                {isSavingMeal ? (
                  <ActivityIndicator color="#fff" size="small" />
                ) : (
                  <>
                    <Feather name="heart" size={16} color="#fff" />
                    <Text style={styles.saveButtonText}>Lưu</Text>
                  </>
                )}
              </Pressable>
              <Pressable
                style={[styles.rebuildButton, isGeneratingMeal && styles.disabledButton]}
                onPress={handleRebuildMeal}
                disabled={isGeneratingMeal}
              >
                {isGeneratingMeal ? (
                  <ActivityIndicator color="#f97316" size="small" />
                ) : (
                  <>
                    <MaterialCommunityIcons name="reload" size={16} color="#f97316" />
                    <Text style={styles.rebuildButtonText}>Tạo lại</Text>
                  </>
                )}
              </Pressable>
            </View>
          </View>
        ) : null}
      </ScrollView>

      {showSaveToast ? (
        <View pointerEvents="none" style={styles.toastOverlay}>
          <View style={[styles.toastCard, saveToastType === 'error' && styles.toastCardError]}>
            <Feather
              name={saveToastType === 'error' ? 'x-circle' : 'check-circle'}
              size={24}
              color={saveToastType === 'error' ? '#b91c1c' : '#16a34a'}
            />
            <Text style={[styles.toastText, saveToastType === 'error' && styles.toastTextError]}>{saveToastMessage}</Text>
          </View>
        </View>
      ) : null}

      {!isGuest ? (
        <AppBottomNav activeKey="menu" onTabPress={handleBottomTabPress} />
      ) : null}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: '#f3f4f6',
  },
  container: {
    flexGrow: 1,
    paddingHorizontal: 14,
    paddingTop: 12,
    paddingBottom: 28,
    gap: 12,
  },
  card: {
    borderRadius: 16,
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#eceff3',
    padding: 14,
    gap: 12,
  },
  sectionTitle: {
    fontFamily: FONT_BOLD,
    fontSize: 14,
    color: '#334155',
    letterSpacing: 0.5,
  },
  mealTimeRow: {
    flexDirection: 'row',
    gap: 8,
  },
  mealTimeButton: {
    flex: 1,
    borderWidth: 1,
    borderColor: '#e5e7eb',
    borderRadius: 14,
    minHeight: 78,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: '#f8fafc',
  },
  mealTimeButtonActive: {
    borderColor: '#fb923c',
    backgroundColor: '#fff7ed',
  },
  mealTimeText: {
    fontFamily: FONT_MEDIUM,
    fontSize: 13,
    color: '#6b7280',
  },
  mealTimeTextActive: {
    color: '#ea580c',
  },
  goalList: {
    gap: 8,
  },
  goalCard: {
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#edf0f3',
    padding: 12,
    backgroundColor: '#f8fafc',
  },
  goalCardActive: {
    borderColor: '#fdba74',
    backgroundColor: '#fff7ed',
  },
  goalTitle: {
    fontFamily: FONT_BOLD,
    fontSize: 15,
    color: '#0f172a',
  },
  goalTitleActive: {
    color: '#c2410c',
  },
  goalSubTitle: {
    marginTop: 3,
    fontFamily: FONT_MEDIUM,
    fontSize: 13,
    color: '#94a3b8',
  },
  calorieHeader: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 4,
  },
  calorieCurrentText: {
    fontFamily: FONT_BOLD,
    fontSize: 32,
    color: '#f97316',
  },
  calorieCurrentLabel: {
    fontFamily: FONT_MEDIUM,
    fontSize: 15,
    color: '#94a3b8',
    paddingBottom: 5,
  },
  slider: {
    marginTop: -4,
    marginHorizontal: -6,
    height: 42,
  },
  calorieRangeLabels: {
    marginTop: -4,
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  calorieRangeLabel: {
    fontFamily: FONT_MEDIUM,
    fontSize: 12,
    color: '#94a3b8',
  },
  goalHintText: {
    marginTop: 2,
    fontFamily: FONT_MEDIUM,
    fontSize: 12,
    color: '#64748b',
  },
  generateButton: {
    minHeight: 48,
    borderRadius: 12,
    backgroundColor: '#f97316',
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: 8,
  },
  generateButtonText: {
    fontFamily: FONT_BOLD,
    color: '#fff',
    fontSize: 16,
  },
  disabledButton: {
    opacity: 0.65,
  },
  resultCard: {
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#eceff3',
    backgroundColor: '#fff',
    overflow: 'hidden',
  },
  resultBackRow: {
    paddingHorizontal: 12,
    paddingTop: 12,
    paddingBottom: 8,
    backgroundColor: '#fff',
  },
  resultBackButton: {
    alignSelf: 'flex-start',
    minHeight: 34,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#fed7aa',
    backgroundColor: '#fff7ed',
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    gap: 6,
  },
  resultBackText: {
    fontFamily: FONT_MEDIUM,
    fontSize: 13,
    color: '#f97316',
  },
  resultHeader: {
    backgroundColor: '#f97316',
    padding: 14,
  },
  resultTitle: {
    fontFamily: FONT_BOLD,
    color: '#fff',
    fontSize: 22,
    marginBottom: 10,
  },
  nutritionSummaryRow: {
    flexDirection: 'row',
    justifyContent: 'flex-start',
    gap: 8,
  },
  nutritionItem: {
    flex: 1,
    borderRightWidth: 1,
    borderRightColor: 'rgba(255,255,255,0.25)',
  },
  nutritionItemNoBorder: {
    flex: 1,
  },
  nutritionLabel: {
    fontFamily: FONT_MEDIUM,
    color: 'rgba(255,255,255,0.85)',
    fontSize: 11,
  },
  nutritionValue: {
    marginTop: 4,
    fontFamily: FONT_BOLD,
    color: '#fff',
    fontSize: 22,
  },
  nutritionValueSmall: {
    marginTop: 6,
    fontFamily: FONT_BOLD,
    color: '#fff',
    fontSize: 20,
  },
  goalTargetHint: {
    marginTop: 8,
    fontFamily: FONT_MEDIUM,
    color: 'rgba(255,255,255,0.9)',
    fontSize: 12,
  },
  menuList: {
    padding: 12,
    gap: 10,
  },
  menuItemCard: {
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#eceff3',
    backgroundColor: '#fff',
    padding: 10,
    flexDirection: 'row',
    gap: 10,
  },
  menuItemImage: {
    width: 86,
    height: 86,
    borderRadius: 10,
    backgroundColor: '#e5e7eb',
  },
  menuItemBody: {
    flex: 1,
  },
  menuItemTitle: {
    fontFamily: FONT_BOLD,
    fontSize: 16,
    color: '#111827',
  },
  menuItemSub: {
    marginTop: 2,
    fontFamily: FONT_MEDIUM,
    fontSize: 13,
    color: '#64748b',
  },
  menuItemMeta: {
    marginTop: 4,
    fontFamily: FONT_MEDIUM,
    fontSize: 12,
    color: '#475569',
  },
  menuItemDescription: {
    marginTop: 4,
    fontFamily: FONT_REGULAR,
    fontSize: 12,
    color: '#64748b',
    lineHeight: 18,
  },
  swapButton: {
    marginTop: 8,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#fed7aa',
    backgroundColor: '#fff7ed',
    minHeight: 32,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: 6,
  },
  swapButtonText: {
    fontFamily: FONT_BOLD,
    color: '#f97316',
    fontSize: 13,
  },
  menuSideMeta: {
    alignItems: 'flex-end',
    justifyContent: 'space-between',
    minWidth: 58,
  },
  calorieChip: {
    borderRadius: 999,
    backgroundColor: '#111827',
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  calorieChipText: {
    fontFamily: FONT_MEDIUM,
    color: '#fff',
    fontSize: 11,
  },
  actionRow: {
    borderTopWidth: 1,
    borderTopColor: '#f1f5f9',
    paddingHorizontal: 12,
    paddingVertical: 12,
    flexDirection: 'row',
    gap: 10,
  },
  saveButton: {
    flex: 1,
    minHeight: 46,
    borderRadius: 12,
    backgroundColor: '#16a34a',
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: 7,
  },
  saveButtonText: {
    fontFamily: FONT_BOLD,
    color: '#fff',
    fontSize: 16,
  },
  rebuildButton: {
    flex: 1,
    minHeight: 46,
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: '#fdba74',
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: 7,
    backgroundColor: '#fff',
  },
  rebuildButtonText: {
    fontFamily: FONT_BOLD,
    color: '#f97316',
    fontSize: 16,
  },
  toastOverlay: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
  },
  toastCard: {
    maxWidth: '86%',
    borderRadius: 14,
    paddingHorizontal: 18,
    paddingVertical: 15,
    backgroundColor: '#f0fdf4',
    borderWidth: 1,
    borderColor: '#bbf7d0',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    shadowColor: '#000',
    shadowOpacity: 0.14,
    shadowOffset: { width: 0, height: 6 },
    shadowRadius: 14,
    elevation: 8,
  },
  toastCardError: {
    backgroundColor: '#fef2f2',
    borderColor: '#fecaca',
  },
  toastText: {
    flex: 1,
    fontFamily: FONT_BOLD,
    color: '#14532d',
    fontSize: 16,
    lineHeight: 22,
  },
  toastTextError: {
    color: '#7f1d1d',
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
});
