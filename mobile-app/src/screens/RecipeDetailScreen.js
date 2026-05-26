import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { SafeAreaView } from 'react-native-safe-area-context';
import {
  ActivityIndicator,
  Alert,
  Image,
  Platform,
  Pressable,
  ScrollView,
  Share,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Feather, MaterialCommunityIcons } from '@expo/vector-icons';
import { authRequest, request } from '../services/client';
import { AppBottomNav } from '../components/AppChrome';

const SHOPPING_LIST_STORAGE_KEY = 'nutrichef_shopping_list';

const FALLBACK_RECIPE_IMAGE =
  'https://images.unsplash.com/photo-1517248135467-4c7edcad34c4?auto=format&fit=crop&w=1200&q=80';

const FONT_BOLD = Platform.select({
  ios: 'AvenirNext-DemiBold',
  android: 'sans-serif-condensed',
  default: 'system-ui',
});

const formatNumber = (value) => new Intl.NumberFormat('vi-VN').format(Number(value) || 0);

const safeArray = (value) => {
  if (Array.isArray(value)) {
    return value;
  }

  if (!value) {
    return [];
  }

  if (typeof value === 'string') {
    try {
      const parsed = JSON.parse(value);
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  }

  return [];
};

const difficultyLabel = (value) => {
  const normalized = String(value || '').toUpperCase();
  if (normalized === 'EASY') return 'Dễ';
  if (normalized === 'MEDIUM') return 'Trung bình';
  if (normalized === 'HARD') return 'Khó';
  return 'Chưa cập nhật';
};

const dishTypeLabel = (value) => {
  const normalized = String(value || '').toUpperCase();
  if (normalized === 'MAIN_DISH') return 'Món chính';
  if (normalized === 'SIDE_DISH') return 'Món phụ';
  if (normalized === 'DESSERT' || normalized === 'DRINK') return 'Tráng miệng';
  return 'Khác';
};

const getDishTypeBadgeInfo = (type) => {
  switch (String(type || '').toUpperCase()) {
    case 'MAIN_DISH':
      return { label: 'Món chính', color: '#f97316' };
    case 'SIDE_DISH':
      return { label: 'Món phụ', color: '#10b981' };
    case 'DESSERT':
      return { label: 'Tráng miệng', color: '#ec4899' };
    default:
      return { label: 'Khác', color: '#6b7280' };
  }
};

const dbCaloriesLabel = (value) => {
  const normalized = Number(value);
  if (!Number.isFinite(normalized)) {
    return '--';
  }

  return String(Math.round(Math.max(0, normalized)));
};

export default function RecipeDetailScreen({
  recipeId,
  isGuest = true,
  user,
  usageCount,
  onBack,
  onLoginPress,
  onNavigateHome,
  onNavigateSuggest,
  onNavigateMeal,
  onNavigateRecipeSubmission,
  onNavigateFavorites,
  onNavigateUpgrade,
  onNavigateShopping,
}) {
  const [recipe, setRecipe] = useState(null);
  const [loading, setLoading] = useState(false);
  const [isFavorite, setIsFavorite] = useState(false);
  const [submittingFavorite, setSubmittingFavorite] = useState(false);
  
  const [ratings, setRatings] = useState([]);
  const [userScore, setUserScore] = useState(5);
  const [userComment, setUserComment] = useState('');
  const [submittingRating, setSubmittingRating] = useState(false);

  // New state for ingredient checklist
  const [expandedIngredients, setExpandedIngredients] = useState(false);
  const [localIngredientStatus, setLocalIngredientStatus] = useState({}); // { [ingName]: boolean }

  const fetchRecipeDetail = useCallback(async () => {
    if (!recipeId) {
      return;
    }

    try {
      setLoading(true);
      const data = await request(`/api/recipes/${recipeId}`);
      setRecipe(data?.recipe || null);

      if (!isGuest) {
        try {
          const favoriteStatus = await authRequest(`/api/recipes/${recipeId}/favorite-status`);
          setIsFavorite(Boolean(favoriteStatus?.isFavorite));
        } catch {
          setIsFavorite(false);
        }
      } else {
        setIsFavorite(false);
      }
      
      // Tải danh sách đánh giá
      const ratingsData = await request(`/api/recipes/${recipeId}/ratings`);
      setRatings(ratingsData?.ratings || []);
      
    } catch (error) {
      Alert.alert('Lỗi tải công thức', error.message || 'Không thể tải chi tiết công thức.');
      setRecipe(null);
    } finally {
      setLoading(false);
    }
  }, [isGuest, recipeId]);

  useEffect(() => {
    fetchRecipeDetail();
  }, [fetchRecipeDetail]);

  const ingredients = useMemo(() => safeArray(recipe?.ingredients_json), [recipe]);
  const steps = useMemo(() => safeArray(recipe?.steps_json), [recipe]);

  const handleShareRecipe = async () => {
    if (!recipe) {
      return;
    }

    try {
      const shareUrl = `https://nutrichef.app/recipes/${recipe.recipe_id}`;
      await Share.share({
        message: `Cùng xem công thức ${recipe.title} trên NutriChef: ${shareUrl}`,
        title: recipe.title,
        url: shareUrl,
      });
    } catch (error) {
      Alert.alert('Lỗi chia sẻ', error.message || 'Không thể chia sẻ công thức này.');
    }
  };

  const handleToggleFavorite = async () => {
    if (!recipe?.recipe_id) {
      return;
    }

    if (isGuest) {
      Alert.alert('Yêu cầu đăng nhập', 'Bạn cần đăng nhập để lưu công thức yêu thích.', [
        { text: 'Để sau', style: 'cancel' },
        {
          text: 'Đăng nhập',
          onPress: () => onLoginPress?.(),
        },
      ]);
      return;
    }

    try {
      setSubmittingFavorite(true);
      const method = isFavorite ? 'DELETE' : 'POST';
      const response = await authRequest(`/api/recipes/${recipe.recipe_id}/favorite`, { method });
      const nextFavorite = Boolean(response?.isFavorite);
      const nextLikeCount = Number(response?.likeCount);

      setIsFavorite(nextFavorite);
      if (Number.isFinite(nextLikeCount)) {
        setRecipe((current) => {
          if (!current) {
            return current;
          }
          return {
            ...current,
            like_count: nextLikeCount,
          };
        });
      }
    } catch (error) {
      Alert.alert('Lỗi cập nhật yêu thích', error.message || 'Không thể cập nhật yêu thích.');
    } finally {
      setSubmittingFavorite(false);
    }
  };

  const handleSubmitRating = async () => {
    if (isGuest) {
      Alert.alert('Yêu cầu đăng nhập', 'Bạn cần đăng nhập để đánh giá công thức.', [
        { text: 'Để sau', style: 'cancel' },
        {
          text: 'Đăng nhập',
          onPress: () => onLoginPress?.(),
        },
      ]);
      return;
    }

    if (!userComment.trim()) {
      Alert.alert('Thông báo', 'Vui lòng nhập nhận xét của bạn.');
      return;
    }

    try {
      setSubmittingRating(true);
      const response = await authRequest(`/api/recipes/${recipe.recipe_id}/ratings`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          score: userScore,
          comment: userComment.trim(),
        }),
      });

      if (response?.status === 'success') {
        Alert.alert('Thành công', 'Cảm ơn bạn đã đánh giá công thức!');
        setUserComment('');
        // Reload ratings and update avg_rating
        const ratingsData = await request(`/api/recipes/${recipe.recipe_id}/ratings`);
        setRatings(ratingsData?.ratings || []);
        setRecipe(prev => ({
          ...prev,
          avg_rating: response.avg_rating,
          rating_count: response.rating_count
        }));
      }
    } catch (error) {
      Alert.alert('Lỗi', error.message || 'Không thể gửi đánh giá.');
    } finally {
      setSubmittingRating(false);
    }
  };

  const addToShoppingList = async (ingredientName, recipeTitle, qty, unit) => {
    try {
      const saved = await AsyncStorage.getItem(SHOPPING_LIST_STORAGE_KEY);
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
      await AsyncStorage.setItem(SHOPPING_LIST_STORAGE_KEY, JSON.stringify(list));
      Alert.alert('Thành công', `Đã thêm "${ingredientName}" vào giỏ hàng.`);
    } catch (e) {
      console.error('Failed to add to shopping list', e);
    }
  };

  const toggleLocalIngredient = (ingName) => {
    setLocalIngredientStatus((prev) => ({
      ...prev,
      [ingName]: !prev[ingName],
    }));
  };

  const renderRecipeIngredients = () => {
    if (ingredients.length === 0) {
      return <Text style={styles.placeholderText}>Chưa có dữ liệu nguyên liệu.</Text>;
    }

    // Sort: checked items at bottom
    const sorted = [...ingredients].sort((a, b) => {
      const aChecked = localIngredientStatus[a.name] || false;
      const bChecked = localIngredientStatus[b.name] || false;
      if (aChecked === bChecked) return 0;
      return aChecked ? 1 : -1;
    });

    return (
      <View style={styles.expandedIngredients}>
        {sorted.map((ing, idx) => {
          const isChecked = localIngredientStatus[ing.name] || false;
          return (
            <View key={`${ing.name}-${idx}`} style={styles.ingredientRow}>
              <Pressable 
                onPress={() => toggleLocalIngredient(ing.name)}
                style={styles.ingCheckbox}
              >
                <MaterialCommunityIcons 
                  name={isChecked ? 'checkbox-marked' : 'checkbox-blank-outline'} 
                  size={20} 
                  color={isChecked ? '#94a3b8' : '#f97316'} 
                />
              </Pressable>
              
              <Text style={[styles.ingName, isChecked && styles.ingNameChecked]}>
                {ing.name}{ing.qty ? ` (${ing.qty} ${ing.unit || ''})` : ''}
              </Text>

              {!isChecked && (
                <Pressable 
                  onPress={() => addToShoppingList(ing.name, recipe.title, ing.qty, ing.unit)}
                  style={styles.ingAddBtn}
                >
                  <Feather name="plus-circle" size={20} color="#f97316" />
                </Pressable>
              )}
            </View>
          );
        })}
      </View>
    );
  };

  const handleBottomTabPress = (tabKey) => {
    if (tabKey === 'home') onNavigateHome?.();
    else if (tabKey === 'suggest') onNavigateSuggest?.();
    else if (tabKey === 'menu') onNavigateMeal?.();
    else if (tabKey === 'recipes') onNavigateRecipeSubmission?.();
    else if (tabKey === 'favorites') onNavigateFavorites?.();
    else if (tabKey === 'upgrade') onNavigateUpgrade?.();
    else if (tabKey === 'shopping') onNavigateShopping?.();
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.screen} edges={['top', 'bottom']}>
        <View style={styles.loadingWrap}>
          <ActivityIndicator size="large" color="#f55f12" />
        </View>
      </SafeAreaView>
    );
  }

  if (!recipe) {
    return (
      <SafeAreaView style={styles.screen} edges={['top', 'bottom']}>
        <View style={styles.headerRow}>
          <Pressable style={styles.backButton} onPress={onBack}>
            <Feather name="arrow-left" size={18} color="#111827" />
            <Text style={styles.backButtonText}>Quay lại</Text>
          </Pressable>
        </View>
        <View style={styles.emptyWrap}>
          <Feather name="inbox" size={22} color="#94a3b8" />
          <Text style={styles.emptyText}>Không tìm thấy công thức.</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.screen} edges={['top', 'bottom']}>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.headerRow}>
          <Pressable style={styles.backButton} onPress={onBack}>
            <Feather name="arrow-left" size={18} color="#111827" />
            <Text style={styles.backButtonText}>Quay lại</Text>
          </Pressable>
        </View>

        <View style={styles.card}>
          <View style={styles.imageContainer}>
            <Image source={{ uri: recipe.image_url || FALLBACK_RECIPE_IMAGE }} style={styles.heroImage} />
            <View style={[styles.dishTypeBadge, { backgroundColor: getDishTypeBadgeInfo(recipe.dish_type).color }]}>
              <Text style={styles.dishTypeBadgeText}>{getDishTypeBadgeInfo(recipe.dish_type).label}</Text>
            </View>
          </View>

          <View style={styles.cardBody}>
            <Text style={styles.title}>{recipe.title}</Text>
            <Text style={styles.authorText}>Bởi {recipe.author_name || 'NutriChef'}</Text>

            <View style={styles.infoRow}>
              <View style={styles.infoChip}>
                <MaterialCommunityIcons name="clock-time-four-outline" size={15} color="#4b5563" />
                <Text style={styles.infoText}>{Number(recipe.cooking_time) || 0} phút</Text>
              </View>
              <View style={styles.infoChip}>
                <MaterialCommunityIcons name="star" size={15} color="#f59e0b" />
                <Text style={styles.infoText}>{Number(recipe.avg_rating || 0).toFixed(1)}</Text>
              </View>
              <View style={styles.infoChip}>
                <Feather name="heart" size={15} color="#ef4444" />
                <Text style={styles.infoText}>{formatNumber(recipe.like_count)}</Text>
              </View>
            </View>

            <View style={styles.infoRow}>
              <View style={styles.infoChipSecondary}>
                <Text style={styles.infoSecondaryText}>Độ khó: {difficultyLabel(recipe.difficulty)}</Text>
              </View>
              <View style={styles.infoChipSecondary}>
                <Text style={styles.infoSecondaryText}>Loại món: {dishTypeLabel(recipe.dish_type)}</Text>
              </View>
              <View style={[styles.infoChipSecondary, styles.infoChipSecondaryWide]}>
                <Text style={styles.infoSecondaryText}>Năng lượng: {dbCaloriesLabel(recipe.total_calories)} kcal</Text>
              </View>
            </View>

            <View style={styles.actionRow}>
              <Pressable
                style={[styles.favoriteButton, isFavorite && styles.favoriteButtonActive, submittingFavorite && styles.disabledButton]}
                onPress={handleToggleFavorite}
                disabled={submittingFavorite}
              >
                <Feather name={isFavorite ? 'heart' : 'heart'} size={16} color={isFavorite ? '#ffffff' : '#ef4444'} />
                <Text style={[styles.favoriteButtonText, isFavorite && styles.favoriteButtonTextActive]}>
                  {isFavorite ? 'Đã yêu thích' : 'Yêu thích'}
                </Text>
              </Pressable>

              <Pressable style={styles.shareButton} onPress={handleShareRecipe}>
                <Feather name="share-2" size={16} color="#374151" />
                <Text style={styles.shareButtonText}>Chia sẻ</Text>
              </Pressable>
            </View>

            {recipe.description ? (
              <View style={styles.section}>
                <Text style={styles.sectionTitle}>Mô tả món ăn</Text>
                <Text style={styles.sectionContent}>{recipe.description}</Text>
              </View>
            ) : null}

            <View style={styles.section}>
              <View style={styles.sectionHeaderRow}>
                <Text style={styles.sectionTitle}>Nguyên liệu</Text>
                <Pressable 
                  onPress={() => setExpandedIngredients(!expandedIngredients)}
                  style={[styles.shoppingToggleBtn, expandedIngredients && styles.shoppingToggleBtnActive]}
                >
                  <MaterialCommunityIcons 
                    name={expandedIngredients ? 'chevron-up' : 'format-list-checks'} 
                    size={22} 
                    color={expandedIngredients ? '#fff' : '#f97316'} 
                  />
                </Pressable>
              </View>
              
              {expandedIngredients ? renderRecipeIngredients() : (
                ingredients.length === 0 ? (
                  <Text style={styles.placeholderText}>Chưa có dữ liệu nguyên liệu.</Text>
                ) : (
                  ingredients.map((item, index) => (
                    <View key={`ing-${index}`} style={styles.listRow}>
                      <Text style={styles.bullet}>•</Text>
                      <Text style={styles.listText}>
                        {item?.name || 'Nguyên liệu'} {item?.qty ? `- ${item.qty}` : ''} {item?.unit || ''}
                      </Text>
                    </View>
                  ))
                )
              )}
            </View>

            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Cách làm</Text>
              {steps.length === 0 ? (
                <Text style={styles.placeholderText}>Chưa có dữ liệu các bước nấu.</Text>
              ) : (
                steps.map((item, index) => (
                  <View key={`step-${index}`} style={styles.stepRow}>
                    <View style={styles.stepBadge}>
                      <Text style={styles.stepBadgeText}>{item?.step || index + 1}</Text>
                    </View>
                    <Text style={styles.stepText}>{item?.content || ''}</Text>
                  </View>
                ))
              )}
            </View>

            {/* PHẦN ĐÁNH GIÁ CÔNG THỨC */}
            <View style={styles.divider} />
            
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Đánh giá & Nhận xét</Text>
              
              {/* Form gửi đánh giá */}
              <View style={styles.ratingForm}>
                <Text style={styles.ratingFormTitle}>Đánh giá của bạn</Text>
                <View style={styles.starRow}>
                  {[1, 2, 3, 4, 5].map((s) => (
                    <Pressable key={`star-${s}`} onPress={() => setUserScore(s)}>
                      <MaterialCommunityIcons 
                        name={s <= userScore ? "star" : "star-outline"} 
                        size={28} 
                        color={s <= userScore ? "#f59e0b" : "#94a3b8"} 
                      />
                    </Pressable>
                  ))}
                </View>
                <TextInput
                  style={styles.commentInput}
                  placeholder="Nhận xét của bạn về món ăn này..."
                  multiline
                  numberOfLines={3}
                  value={userComment}
                  onChangeText={setUserComment}
                />
                <Pressable 
                  style={[styles.submitRatingButton, submittingRating && styles.disabledButton]}
                  onPress={handleSubmitRating}
                  disabled={submittingRating}
                >
                  {submittingRating ? (
                    <ActivityIndicator size="small" color="#ffffff" />
                  ) : (
                    <Text style={styles.submitRatingText}>Gửi đánh giá</Text>
                  )}
                </Pressable>
              </View>

              {/* Danh sách các nhận xét */}
              <View style={styles.ratingsList}>
                {ratings.length === 0 ? (
                  <Text style={styles.placeholderText}>Chưa có đánh giá nào. Hãy là người đầu tiên!</Text>
                ) : (
                  ratings.map((item, index) => (
                    <View key={`rating-${item.rating_id || index}`} style={styles.ratingItem}>
                      <View style={styles.ratingHeader}>
                        <View style={styles.userAvatar}>
                          <Text style={styles.avatarText}>{item.full_name?.charAt(0).toUpperCase()}</Text>
                        </View>
                        <View style={styles.ratingUserMeta}>
                          <Text style={styles.userName}>{item.full_name}</Text>
                          <View style={styles.miniStarRow}>
                            {[1, 2, 3, 4, 5].map((s) => (
                              <MaterialCommunityIcons 
                                key={`mini-star-${s}`}
                                name={s <= item.score ? "star" : "star-outline"} 
                                size={12} 
                                color={s <= item.score ? "#f59e0b" : "#94a3b8"} 
                              />
                            ))}
                            <Text style={styles.ratingTime}>
                              • {new Date(item.created_at).toLocaleDateString('vi-VN')}
                            </Text>
                          </View>
                        </View>
                      </View>
                      <Text style={styles.ratingComment}>{item.comment}</Text>
                    </View>
                  ))
                )}
              </View>
            </View>
          </View>
        </View>
      </ScrollView>

      {!isGuest ? (
        <AppBottomNav
          activeKey="home" // Since it's a detail screen, highlighting 'home' or nothing is fine
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
  content: {
    paddingHorizontal: 14,
    paddingTop: 12,
    paddingBottom: 80, // Space for bottom nav
  },
  loadingWrap: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerRow: {
    marginBottom: 10,
  },
  backButton: {
    minHeight: 38,
    borderRadius: 10,
    alignSelf: 'flex-start',
    paddingHorizontal: 10,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: '#e5e7eb',
  },
  backButtonText: {
    color: '#111827',
    fontSize: 14,
    fontWeight: '600',
  },
  emptyWrap: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  emptyText: {
    color: '#64748b',
    fontSize: 14,
    fontWeight: '600',
  },
  card: {
    backgroundColor: '#ffffff',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#e5e7eb',
    overflow: 'hidden',
  },
  heroImage: {
    width: '100%',
    height: 230,
    backgroundColor: '#d1d5db',
  },
  imageContainer: {
    position: 'relative',
    width: '100%',
    height: 230,
  },
  dishTypeBadge: {
    position: 'absolute',
    top: 10,
    left: 10,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
    shadowColor: '#000',
    shadowOpacity: 0.3,
    shadowOffset: { width: 0, height: 2 },
    shadowRadius: 4,
    elevation: 6,
    zIndex: 10,
  },
  dishTypeBadgeText: {
    fontSize: 11,
    fontWeight: '800',
    color: '#fff',
    textTransform: 'uppercase',
  },
  cardBody: {
    paddingHorizontal: 14,
    paddingTop: 12,
    paddingBottom: 14,
  },
  title: {
    fontSize: 24,
    fontWeight: '800',
    color: '#111827',
  },
  authorText: {
    marginTop: 4,
    color: '#6b7280',
    fontSize: 15,
    marginBottom: 10,
  },
  infoRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 8,
  },
  infoChip: {
    borderRadius: 999,
    borderWidth: 1,
    borderColor: '#e5e7eb',
    backgroundColor: '#f9fafb',
    minHeight: 34,
    paddingHorizontal: 10,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: 5,
  },
  infoText: {
    color: '#111827',
    fontSize: 14,
    fontWeight: '600',
  },
  infoChipSecondary: {
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#dbe1ea',
    backgroundColor: '#ffffff',
    minHeight: 34,
    paddingHorizontal: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  infoChipSecondaryWide: {
    minWidth: 170,
  },
  infoSecondaryText: {
    color: '#374151',
    fontSize: 13,
    fontWeight: '600',
  },
  actionRow: {
    marginTop: 4,
    marginBottom: 12,
    flexDirection: 'row',
    gap: 10,
  },
  favoriteButton: {
    flex: 1,
    minHeight: 44,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#fecaca',
    backgroundColor: '#fff1f2',
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: 7,
  },
  favoriteButtonActive: {
    backgroundColor: '#ef4444',
    borderColor: '#ef4444',
  },
  favoriteButtonText: {
    color: '#ef4444',
    fontSize: 14,
    fontWeight: '700',
  },
  favoriteButtonTextActive: {
    color: '#ffffff',
  },
  shareButton: {
    flex: 1,
    minHeight: 44,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#dbe1ea',
    backgroundColor: '#ffffff',
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: 7,
  },
  shareButtonText: {
    color: '#374151',
    fontSize: 14,
    fontWeight: '700',
  },
  disabledButton: {
    opacity: 0.6,
  },
  section: {
    marginTop: 10,
  },
  sectionHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  sectionTitle: {
    fontSize: 17,
    fontWeight: '800',
    color: '#111827',
  },
  sectionContent: {
    color: '#374151',
    fontSize: 15,
    lineHeight: 22,
  },
  listRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
    marginBottom: 6,
  },
  bullet: {
    marginTop: 1,
    color: '#111827',
    fontWeight: '700',
  },
  listText: {
    flex: 1,
    color: '#374151',
    fontSize: 15,
    lineHeight: 21,
  },
  stepRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
    marginBottom: 10,
  },
  stepBadge: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: '#f55f12',
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepBadgeText: {
    color: '#ffffff',
    fontSize: 12,
    fontWeight: '800',
  },
  stepText: {
    flex: 1,
    color: '#374151',
    fontSize: 15,
    lineHeight: 22,
  },
  placeholderText: {
    color: '#64748b',
    fontSize: 14,
    fontWeight: '600',
  },
  divider: {
    height: 1,
    backgroundColor: '#e5e7eb',
    marginVertical: 16,
  },
  ratingForm: {
    backgroundColor: '#f8fafc',
    borderRadius: 12,
    padding: 12,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  ratingFormTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: '#475569',
    marginBottom: 8,
  },
  starRow: {
    flexDirection: 'row',
    gap: 5,
    marginBottom: 12,
  },
  commentInput: {
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: '#cbd5e1',
    borderRadius: 8,
    padding: 10,
    fontSize: 14,
    textAlignVertical: 'top',
    minHeight: 80,
    marginBottom: 12,
  },
  submitRatingButton: {
    backgroundColor: '#f55f12',
    borderRadius: 8,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  submitRatingText: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: '700',
  },
  ratingsList: {
    gap: 16,
  },
  ratingItem: {
    borderBottomWidth: 1,
    borderBottomColor: '#f1f5f9',
    paddingBottom: 12,
  },
  ratingHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 6,
  },
  userAvatar: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#e2e8f0',
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#64748b',
  },
  ratingUserMeta: {
    flex: 1,
  },
  userName: {
    fontSize: 14,
    fontWeight: '700',
    color: '#1e293b',
  },
  miniStarRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
  },
  ratingTime: {
    fontSize: 11,
    color: '#94a3b8',
    marginLeft: 4,
  },
  ratingComment: {
    fontSize: 14,
    color: '#475569',
    lineHeight: 20,
  },
  shoppingToggleBtn: {
    width: 38,
    height: 38,
    borderRadius: 10,
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
    marginTop: 4,
    padding: 10,
    backgroundColor: '#f8fafc',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  ingredientRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#f1f5f9',
  },
  ingCheckbox: {
    marginRight: 10,
  },
  ingName: {
    flex: 1,
    fontSize: 15,
    color: '#334155',
  },
  ingNameChecked: {
    textDecorationLine: 'line-through',
    color: '#94a3b8',
  },
  ingAddBtn: {
    padding: 4,
  },
});
