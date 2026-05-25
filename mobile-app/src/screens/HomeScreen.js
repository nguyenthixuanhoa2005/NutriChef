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
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Feather, MaterialCommunityIcons } from '@expo/vector-icons';
import { AppBottomNav, AppHeader } from '../components/AppChrome';
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

const mapRecipeRow = (row, isGuest) => ({
  id: row.recipe_id,
  title: row.title,
  author: row.author_name || 'NutriChef',
  timeLabel: `${Number(row.cooking_time) || 0} phút`,
  views: formatNumber(row.rating_count),
  likes: formatNumber(row.like_count),
  likeCount: Number(row.like_count) || 0,
  ratingCount: Number(row.rating_count) || 0,
  rating: Number(row.avg_rating || 0).toFixed(1),
  rawRating: Number(row.avg_rating) || 0,
  premium: Boolean(isGuest),
  image: row.image_url || FALLBACK_RECIPE_IMAGE,
  isFavorite: false,
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

  return (
    <View style={styles.card}>
      <View style={styles.imageWrap}>
        <Image source={{ uri: recipe.image }} style={styles.recipeImage} />

        <Pressable
          style={[styles.favoriteFab, recipe.isFavorite && styles.favoriteFabActive]}
          onPress={() => {
            if (!guardPress()) {
              return;
            }
            onToggleFavorite?.(recipe.id);
          }}
          disabled={favoritePending}
        >
          <Feather name="heart" size={20} color={recipe.isFavorite ? '#ffffff' : '#4b5563'} />
        </Pressable>

        <View style={styles.ratingChip}>
          <MaterialCommunityIcons name="star" size={15} color="#fbbf24" />
          <Text style={styles.ratingText}>{recipe.rating}</Text>
        </View>

        {recipe.premium ? (
          <View style={styles.lockBanner}>
            <Feather name="lock" size={13} color="#ffffff" />
            <Text style={styles.lockText}>Đăng ký để xem chi tiết dinh dưỡng</Text>
          </View>
        ) : null}
      </View>

      <View style={styles.cardBody}>
        <Text style={styles.recipeTitle}>{recipe.title}</Text>
        <Text style={styles.recipeAuthor}>Bởi {recipe.author}</Text>

        <View style={styles.metaRow}>
          <View style={styles.metaLeft}>
            <MaterialCommunityIcons name="clock-time-four-outline" size={15} color="#6b7280" />
            <Text style={styles.metaText}>{recipe.timeLabel}</Text>
          </View>
          <View style={styles.metaLeft}>
            <Feather name="eye" size={15} color="#6b7280" />
            <Text style={styles.metaText}>{recipe.views}</Text>
          </View>
        </View>

        <View style={styles.divider} />

        <View style={styles.engagementRow}>
          <View style={styles.metaLeft}>
            <Feather name="heart" size={16} color="#6b7280" />
            <Text style={styles.metaText}>{formatNumber(recipe.likeCount)}</Text>
          </View>
          <Pressable
            onPress={() => {
              onShare?.(recipe);
            }}
          >
            <Feather name="share-2" size={17} color="#6b7280" />
          </Pressable>
        </View>

        <Pressable
          style={styles.ctaButton}
          onPress={() => {
            if (!guardPress()) {
              return;
            }
            onViewDetail?.(recipe.id);
          }}
        >
          <Text style={styles.ctaButtonText}>Xem công thức</Text>
        </Pressable>
      </View>
    </View>
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
  onOpenRecipeDetail,
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
      const data = await request('/api/recipes/trending?limit=20');
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

  const displayName = useMemo(() => {
    return user?.fullName || user?.name || 'Người dùng';
  }, [user]);

  const displayEmail = useMemo(() => {
    return user?.email || 'user@nutrichef.app';
  }, [user]);

  const promptLogout = () => {
    Alert.alert('Tài khoản', 'Bạn muốn đăng xuất?', [
      { text: 'Huỷ', style: 'cancel' },
      {
        text: 'Đăng xuất',
        style: 'destructive',
        onPress: () => {
          if (typeof onRequestLogout === 'function') {
            onRequestLogout();
          }
        },
      },
    ]);
  };

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

      <FlatList
        data={loadingRecipes ? [] : filteredRecipes}
        keyExtractor={(item) => String(item.id)}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        initialNumToRender={4}
        maxToRenderPerBatch={4}
        windowSize={7}
        removeClippedSubviews
        ListHeaderComponent={(
          <View style={styles.listHeader}>
            <View style={styles.searchCard}>
              <View style={styles.searchWrap}>
                <Feather name="search" size={20} color="#9ca3af" />
                <TextInput
                  placeholder="Tìm kiếm công thức..."
                  placeholderTextColor="#9ca3af"
                  style={styles.searchInput}
                  value={searchText}
                  onChangeText={setSearchText}
                  editable={!isGuest}
                  onFocus={() => {
                    if (isGuest) {
                      Keyboard.dismiss();
                      promptLogin();
                    }
                  }}
                />
              </View>
            </View>

            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>Công thức thịnh hành</Text>
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
    paddingHorizontal: 14,
    paddingTop: 12,
    paddingBottom: 28,
  },
  listHeader: {
    marginBottom: 14,
  },
  cardSpacer: {
    height: 14,
  },
  searchCard: {
    backgroundColor: '#ffffff',
    borderRadius: 14,
    padding: 14,
    borderWidth: 1,
    borderColor: '#e5e7eb',
    shadowColor: '#111827',
    shadowOpacity: 0.06,
    shadowOffset: { width: 0, height: 4 },
    shadowRadius: 10,
    elevation: 2,
  },
  searchWrap: {
    minHeight: 46,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#d1d5db',
    backgroundColor: '#f9fafb',
    paddingHorizontal: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  searchInput: {
    flex: 1,
    color: '#111827',
    fontSize: 15,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 2,
  },
  sectionTitle: {
    fontSize: 26,
    fontWeight: '700',
    color: '#111827',
  },
  seeAllText: {
    color: '#f55f12',
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
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#dbe1ea',
    backgroundColor: '#f8fafc',
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
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: '#e5e7eb',
    shadowColor: '#111827',
    shadowOpacity: 0.09,
    shadowOffset: { width: 0, height: 6 },
    shadowRadius: 12,
    elevation: 3,
  },
  imageWrap: {
    position: 'relative',
    height: 188,
    backgroundColor: '#d1d5db',
  },
  recipeImage: {
    width: '100%',
    height: '100%',
  },
  favoriteFab: {
    position: 'absolute',
    top: 10,
    left: 10,
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: '#ffffff',
    alignItems: 'center',
    justifyContent: 'center',
  },
  favoriteFabActive: {
    backgroundColor: '#ef4444',
  },
  ratingChip: {
    position: 'absolute',
    top: 10,
    right: 10,
    minHeight: 34,
    borderRadius: 17,
    backgroundColor: '#f9fafb',
    paddingHorizontal: 10,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  ratingText: {
    color: '#111827',
    fontSize: 14,
    fontWeight: '700',
  },
  lockBanner: {
    position: 'absolute',
    left: 10,
    bottom: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: 'rgba(17, 24, 39, 0.6)',
    paddingHorizontal: 9,
    paddingVertical: 6,
    borderRadius: 9,
  },
  lockText: {
    color: '#ffffff',
    fontSize: 12,
    fontWeight: '600',
  },
  cardBody: {
    paddingHorizontal: 14,
    paddingTop: 12,
    paddingBottom: 14,
  },
  recipeTitle: {
    fontSize: 22,
    fontWeight: '700',
    color: '#111827',
    marginBottom: 4,
  },
  recipeAuthor: {
    fontSize: 16,
    color: '#6b7280',
    marginBottom: 10,
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 10,
  },
  metaLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  metaText: {
    fontSize: 15,
    color: '#374151',
  },
  divider: {
    height: 1,
    backgroundColor: '#e5e7eb',
    marginBottom: 10,
  },
  engagementRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  ctaButton: {
    minHeight: 44,
    borderRadius: 12,
    backgroundColor: '#f55f12',
    alignItems: 'center',
    justifyContent: 'center',
  },
  ctaButtonText: {
    color: '#ffffff',
    fontSize: 17,
    fontWeight: '700',
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
