import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Share,
  Keyboard,
  FlatList,
  Image,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Feather, MaterialCommunityIcons } from '@expo/vector-icons';
import { AppBottomNav, AppHeader, AppAccountMenu } from '../components/AppChrome';
import { authRequest, request } from '../services/client';

const FALLBACK_RECIPE_IMAGE =
  'https://images.unsplash.com/photo-1517248135467-4c7edcad34c4?auto=format&fit=crop&w=1200&q=80';

const normalizeSearchText = (value) =>
  String(value || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim();

const formatNumber = (value) => new Intl.NumberFormat('vi-VN').format(Number(value) || 0);

const getDishTypeLabel = (type) => {
  if (!type) return 'Món ăn';
  const normalized = String(type).trim().toUpperCase();
  if (normalized === 'MAIN_DISH') return 'Món chính';
  if (normalized === 'SIDE_DISH' || normalized === 'SOUP' || normalized === 'APPETIZER') return 'Món phụ';
  if (normalized === 'DESSERT') return 'Tráng miệng';
  return 'Công thức';
};

const getDifficultyLabel = (diff) => {
  if (!diff) return '';
  const normalized = String(diff).trim().toUpperCase();
  if (normalized === 'EASY') return 'Dễ';
  if (normalized === 'MEDIUM') return 'Trung bình';
  if (normalized === 'HARD') return 'Khó';
  return '';
};

const mapRecipeRow = (row, isGuest) => ({
  id: row.recipe_id,
  title: row.title,
  author: row.author_name || 'NutriChef',
  timeLabel: `${Number(row.cooking_time) || 0} phút`,
  cookingTime: row.cooking_time,
  views: formatNumber(row.rating_count),
  likes: formatNumber(row.like_count),
  likeCount: Number(row.like_count) || 0,
  ratingCount: Number(row.rating_count) || 0,
  rating: Number(row.avg_rating || 0).toFixed(1),
  rawRating: Number(row.avg_rating) || 0,
  premium: Boolean(isGuest),
  image: row.image_url || FALLBACK_RECIPE_IMAGE,
  isFavorite: false,
  dishType: row.dish_type,
  difficulty: row.difficulty,
  totalCalories: row.total_calories,
});

const RecipeCard = ({
  recipe,
  isGuest,
  onProtectedAction,
  onViewDetail,
  onToggleFavorite,
  onShare,
  favoritePending,
}) => {
  const guardPress = () => {
    if (isGuest) {
      onProtectedAction?.();
      return false;
    }

    return true;
  };

  const difficultyText = getDifficultyLabel(recipe.difficulty);

  return (
    <Pressable 
      style={styles.premiumCard}
      onPress={() => {
        if (!guardPress()) return;
        onViewDetail?.(recipe.id);
      }}
    >
      <Image source={{ uri: recipe.image }} style={styles.premiumImage} />
      
      {/* Top Controls */}
      <View style={styles.premiumTopRow}>
        <View style={styles.premiumRatingBadge}>
          <MaterialCommunityIcons name="star" size={14} color="#fbbf24" />
          <Text style={styles.premiumRatingText}>{recipe.rating}</Text>
        </View>
        
        <View style={styles.premiumActionGroup}>
          <Pressable
            style={[styles.premiumCircleBtn, recipe.isFavorite && styles.premiumFavActive]}
            onPress={(e) => {
              e.stopPropagation();
              if (!guardPress()) return;
              onToggleFavorite?.(recipe.id);
            }}
            disabled={favoritePending}
          >
            <Feather 
              name="heart" 
              size={18} 
              color={recipe.isFavorite ? '#ffffff' : '#1e293b'} 
            />
          </Pressable>
          
          <Pressable
            style={styles.premiumCircleBtn}
            onPress={(e) => {
              e.stopPropagation();
              onShare?.(recipe);
            }}
          >
            <Feather name="share-2" size={18} color="#1e293b" />
          </Pressable>
        </View>
      </View>

      {/* Bottom Info Overlay */}
      <View style={styles.premiumOverlay}>
        <View style={styles.premiumTextContent}>
          <View style={styles.cardTagsRow}>
            {difficultyText ? (
              <View style={[styles.cardTag, styles.difficultyTag]}>
                <Text style={styles.cardTagText}>{difficultyText}</Text>
              </View>
            ) : null}
            <View style={[styles.cardTag, styles.timeTag]}>
              <Text style={styles.cardTagText}>{recipe.timeLabel}</Text>
            </View>
          </View>
          <Text style={styles.premiumTitle} numberOfLines={1}>{recipe.title}</Text>
          <View style={styles.premiumAuthorRow}>
            <MaterialCommunityIcons name="account-circle-outline" size={14} color="rgba(255,255,255,0.8)" />
            <Text style={styles.premiumAuthorText}>{recipe.author}</Text>
          </View>
        </View>
      </View>
    </Pressable>
  );
};

export default function HomeScreen({
  onLoginPress,
  onSignupPress,
  onRequestLogout,
  onNavigateSuggest,
  onNavigateMeal,
  onNavigateRecipeSubmission,
  onNavigateFavorites,
  onNavigateUpgrade,
  onNavigateShopping,
  onOpenRecipeDetail,
  onAchievementPress,
  isGuest,
  user,
  usageCount,
}) {
  const [menuOpen, setMenuOpen] = useState(false);
  const [searchText, setSearchText] = useState('');
  const [recipes, setRecipes] = useState([]);
  const [loadingRecipes, setLoadingRecipes] = useState(false);
  const [favoritePendingId, setFavoritePendingId] = useState(null);

  const fetchTrendingRecipes = useCallback(async () => {
    try {
      setLoadingRecipes(true);
      
      let apiUrl = '/api/recipes/trending?limit=20';

      const data = await request(apiUrl);
      const rows = Array.isArray(data?.recipes) ? data.recipes : [];
      const mapped = rows.map((row) => mapRecipeRow(row, isGuest));

      if (isGuest || mapped.length === 0) {
        setRecipes(mapped);
        return;
      }

      const favoriteStates = await Promise.all(
        mapped.map(async (item) => {
          try {
            const response = await authRequest(`/api/recipes/${item.id}/favorite-status`);
            return { recipeId: item.id, isFavorite: Boolean(response?.isFavorite) };
          } catch {
            return { recipeId: item.id, isFavorite: false };
          }
        })
      );

      const favoriteLookup = favoriteStates.reduce((acc, item) => {
        acc[item.recipeId] = item.isFavorite;
        return acc;
      }, {});

      setRecipes(
        mapped.map((item) => ({
          ...item,
          isFavorite: Boolean(favoriteLookup[item.id]),
        }))
      );
    } catch (error) {
      Alert.alert('Lỗi tải dữ liệu', error.message || 'Không thể tải danh sách công thức.');
      setRecipes([]);
    } finally {
      setLoadingRecipes(false);
    }
  }, [isGuest]);

  useEffect(() => {
    fetchTrendingRecipes();
  }, [fetchTrendingRecipes]);

  const filteredRecipes = useMemo(() => {
    const query = normalizeSearchText(searchText);
    if (!query) {
      return recipes;
    }

    return recipes.filter((item) => {
      const byTitle = normalizeSearchText(item.title).includes(query);
      const byAuthor = normalizeSearchText(item.author).includes(query);
      return byTitle || byAuthor;
    });
  }, [recipes, searchText]);

  const promptLogin = () => {
    Alert.alert('Yêu cầu đăng nhập', 'Vui lòng đăng nhập để sử dụng tính năng này.', [
      { text: 'Để sau', style: 'cancel' },
      {
        text: 'Đăng nhập',
        onPress: () => onLoginPress?.(),
      },
    ]);
  };

  const handleBottomTabPress = (tabKey) => {
    if (tabKey === 'favorites') {
      onNavigateFavorites?.();
      return;
    }

    if (tabKey === 'suggest') {
      onNavigateSuggest?.();
      return;
    }

    if (tabKey === 'menu') {
      onNavigateMeal?.();
      return;
    }

    if (tabKey === 'recipes') {
      onNavigateRecipeSubmission?.();
      return;
    }

    if (tabKey === 'upgrade') {
      onNavigateUpgrade?.();
      return;
    }

    if (tabKey === 'shopping') {
      onNavigateShopping?.();
      return;
    }

    if (tabKey !== 'home') {
      Alert.alert('Thông báo', `Tab ${tabKey} sẽ được nối ở bước tiếp theo.`);
    }
  };

  const handleProtectedAction = () => {
    if (isGuest) {
      promptLogin();
    }
  };

  const handleShareRecipe = useCallback(async (recipe) => {
    if (!recipe) {
      return;
    }

    try {
      const shareUrl = `https://nutrichef.app/recipes/${recipe.id}`;
      await Share.share({
        title: recipe.title,
        message: `Cùng xem công thức ${recipe.title} trên NutriChef: ${shareUrl}`,
        url: shareUrl,
      });
    } catch (error) {
      Alert.alert('Lỗi chia sẻ', error.message || 'Không thể chia sẻ công thức này.');
    }
  }, []);

  const handleToggleFavorite = useCallback(async (recipeId) => {
    if (!recipeId || isGuest) {
      return;
    }

    const target = recipes.find((item) => item.id === recipeId);
    if (!target) {
      return;
    }

    try {
      setFavoritePendingId(recipeId);
      const method = target.isFavorite ? 'DELETE' : 'POST';
      const response = await authRequest(`/api/recipes/${recipeId}/favorite`, { method });
      const nextFavorite = Boolean(response?.isFavorite);
      const nextLikeCount = Number(response?.likeCount);

      setRecipes((current) =>
        current.map((item) => {
          if (item.id !== recipeId) {
            return item;
          }

          return {
            ...item,
            isFavorite: nextFavorite,
            likeCount: Number.isFinite(nextLikeCount) ? nextLikeCount : item.likeCount,
            likes: formatNumber(Number.isFinite(nextLikeCount) ? nextLikeCount : item.likeCount),
          };
        })
      );
    } catch (error) {
      Alert.alert('Lỗi yêu thích', error.message || 'Không thể cập nhật yêu thích.');
    } finally {
      setFavoritePendingId(null);
    }
  }, [isGuest, recipes]);

  return (
    <SafeAreaView style={styles.screen}>
      <AppHeader
        onLoginPress={onLoginPress}
        onSignupPress={onSignupPress}
        isGuest={isGuest}
        user={user}
        onUpgradePress={onNavigateUpgrade}
        onAccountPress={() => setMenuOpen((current) => !current)}
      />

      <AppAccountMenu
        visible={menuOpen}
        onClose={() => setMenuOpen(false)}
        user={user}
        onLogout={onRequestLogout}
        onAchievementPress={onAchievementPress}
      />

      <FlatList
        data={loadingRecipes ? [] : filteredRecipes}
        keyExtractor={(item) => String(item.id)}
        numColumns={2}
        columnWrapperStyle={styles.gridRow}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        initialNumToRender={6}
        maxToRenderPerBatch={6}
        windowSize={7}
        removeClippedSubviews
        ListHeaderComponent={(
          <View style={styles.listHeader}>
            <View style={styles.welcomeRow}>
              <View>
                <Text style={styles.greetingText}>Chào {user?.full_name?.split(' ')[0] || 'bạn'},</Text>
                {user?.equippedTitle ? (
                  <View style={styles.titleBadge}>
                    <MaterialCommunityIcons name="shield-check" size={14} color="#f55f12" />
                    <Text style={styles.titleText}>{user.equippedTitle}</Text>
                  </View>
                ) : (
                  <Text style={styles.welcomeSubText}>Bạn muốn nấu món gì hôm nay?</Text>
                )}
              </View>
              <Pressable onPress={onNavigateUpgrade} style={styles.premiumBadgeHeader}>
                <MaterialCommunityIcons name="crown" size={20} color="#f59e0b" />
              </Pressable>
            </View>

            <View style={styles.searchBarFloating}>
              <Feather name="search" size={18} color="#94a3b8" />
              <TextInput
                placeholder="Tìm công thức, tác giả..."
                placeholderTextColor="#94a3b8"
                style={styles.searchInputPremium}
                value={searchText}
                onChangeText={setSearchText}
                editable={!isGuest}
                onFocus={() => { if (isGuest) { Keyboard.dismiss(); promptLogin(); } }}
              />
              {searchText.length > 0 && (
                <Pressable onPress={() => setSearchText('')}>
                  <Feather name="x-circle" size={16} color="#cbd5e1" />
                </Pressable>
              )}
            </View>

            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>Gợi ý cho bạn</Text>
            </View>
          </View>
        )}
        ListEmptyComponent={
          loadingRecipes ? (
            <View style={styles.loadingWrap}>
              <ActivityIndicator size="large" color="#f55f12" />
            </View>
          ) : (
            <View style={styles.emptyWrap}>
              <Feather name="inbox" size={20} color="#94a3b8" />
              <Text style={styles.emptyText}>Không tìm thấy công thức phù hợp.</Text>
            </View>
          )
        }
        ItemSeparatorComponent={() => <View style={styles.cardSpacer} />}
        renderItem={({ item: recipe }) => (
          <RecipeCard
            recipe={recipe}
            isGuest={isGuest}
            onProtectedAction={handleProtectedAction}
            onViewDetail={onOpenRecipeDetail}
            onToggleFavorite={handleToggleFavorite}
            onShare={handleShareRecipe}
            favoritePending={favoritePendingId === recipe.id}
          />
        )}
      />

      {!isGuest ? (
        <AppBottomNav
          role="user"
          activeKey="home"
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
    paddingHorizontal: 10,
    paddingTop: 12,
    paddingBottom: 28,
  },
  gridRow: {
    justifyContent: 'space-between',
    paddingHorizontal: 4,
  },
  listHeader: {
    marginBottom: 16,
    paddingHorizontal: 4,
  },
  welcomeRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
    marginTop: 10,
  },
  greetingText: {
    fontSize: 28,
    fontWeight: '900',
    color: '#1e293b',
  },
  welcomeSubText: {
    fontSize: 16,
    color: '#64748b',
    fontWeight: '600',
    marginTop: 2,
  },
  titleBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff7ed',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#fed7aa',
    marginTop: 4,
    alignSelf: 'flex-start',
    gap: 6,
  },
  titleText: {
    fontSize: 13,
    fontWeight: '800',
    color: '#f55f12',
    textTransform: 'uppercase',
  },
  premiumBadgeHeader: {
    width: 44,
    height: 44,
    borderRadius: 14,
    backgroundColor: '#fff7ed',
    borderWidth: 1,
    borderColor: '#ffedd5',
    alignItems: 'center',
    justifyContent: 'center',
  },
  searchBarFloating: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    borderRadius: 16,
    paddingHorizontal: 16,
    height: 52,
    gap: 12,
    shadowColor: '#000',
    shadowOpacity: 0.1,
    shadowOffset: { width: 0, height: 10 },
    shadowRadius: 20,
    elevation: 6,
    marginBottom: 24,
  },
  searchInputPremium: {
    flex: 1,
    fontSize: 15,
    fontWeight: '600',
    color: '#1e293b',
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  sectionTitle: {
    fontSize: 22,
    fontWeight: '800',
    color: '#1e293b',
  },
  seeAllText: {
    color: '#f97316',
    fontSize: 14,
    fontWeight: '700',
  },
  loadingWrap: {
    minHeight: 180,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyWrap: {
    minHeight: 140,
    borderRadius: 20,
    backgroundColor: '#fff',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    borderWidth: 1,
    borderColor: '#f1f5f9',
  },
  emptyText: {
    color: '#94a3b8',
    fontSize: 15,
    fontWeight: '600',
  },
  premiumCard: {
    backgroundColor: '#ffffff',
    borderRadius: 24,
    height: 280,
    width: '48.5%',
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOpacity: 0.15,
    shadowOffset: { width: 0, height: 8 },
    shadowRadius: 16,
    elevation: 8,
    marginBottom: 4,
  },
  premiumImage: {
    width: '100%',
    height: '100%',
    position: 'absolute',
  },
  premiumTopRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    padding: 12,
    alignItems: 'flex-start',
  },
  premiumRatingBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.9)',
    paddingHorizontal: 8,
    paddingVertical: 5,
    borderRadius: 10,
    gap: 4,
  },
  premiumRatingText: {
    fontSize: 12,
    fontWeight: '900',
    color: '#1e293b',
  },
  premiumActionGroup: {
    gap: 8,
  },
  premiumCircleBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(255,255,255,0.9)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  premiumFavActive: {
    backgroundColor: '#ef4444',
  },
  premiumOverlay: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    padding: 16,
    paddingTop: 40,
    backgroundColor: 'rgba(0,0,0,0.6)',
  },
  premiumTextContent: {
    flex: 1,
    gap: 4,
  },
  cardTagsRow: {
    flexDirection: 'row',
    marginBottom: 4,
    height: 22,
  },
  cardTagsContent: {
    gap: 6,
    paddingRight: 10,
  },
  cardTag: {
    backgroundColor: 'rgba(255,255,255,0.25)',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    borderWidth: 0.5,
    borderColor: 'rgba(255,255,255,0.3)',
    justifyContent: 'center',
  },
  difficultyTag: {
    backgroundColor: 'rgba(0,0,0,0.25)',
  },
  timeTag: {
    backgroundColor: 'rgba(59, 130, 246, 0.4)', // Blue-ish
  },
  calorieTag: {
    backgroundColor: 'rgba(16, 185, 129, 0.4)', // Green-ish
  },
  cardTagText: {
    color: '#fff',
    fontSize: 9,
    fontWeight: '800',
    textTransform: 'uppercase',
  },
  premiumTitle: {
    fontSize: 17,
    fontWeight: '900',
    color: '#ffffff',
    lineHeight: 22,
  },
  premiumAuthorRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  premiumAuthorText: {
    fontSize: 12,
    fontWeight: '600',
    color: 'rgba(255,255,255,0.8)',
  },
  premiumTimeBadge: {
    display: 'none',
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
