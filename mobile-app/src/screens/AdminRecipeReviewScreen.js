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
import * as ImagePicker from 'expo-image-picker';
import { Feather } from '@expo/vector-icons';
import { AppAccountMenu, AppBottomNav, AppHeader } from '../components/AppChrome';
import { authRequest } from '../services/client';

const REVIEW_FILTERS = [
  { key: 'ALL', label: 'Tất cả' },
  { key: 'PENDING', label: 'Chờ duyệt' },
  { key: 'APPROVED', label: 'Đã duyệt' },
  { key: 'REJECTED', label: 'Từ chối' },
];

const DISH_TYPES = [
  { key: 'MAIN_DISH', label: 'Món chính' },
  { key: 'SIDE_DISH', label: 'Món phụ' },
  { key: 'DESSERT', label: 'Tráng miệng' },
];

const DIFFICULTIES = [
  { key: 'EASY', label: 'Dễ' },
  { key: 'MEDIUM', label: 'Trung bình' },
  { key: 'HARD', label: 'Khó' },
];

const EMPTY_FORM = {
  title: '',
  description: '',
  ingredientsText: '',
  stepsText: '',
  dishType: 'MAIN_DISH',
  difficulty: 'EASY',
  totalCalories: '',
  cookingTime: '',
  imageUrl: '',
};

const SAMPLE_FORM = {
  title: 'Ức gà áp chảo sốt tiêu',
  description: 'Món giàu đạm, ít dầu mỡ, phù hợp bữa trưa giảm cân.',
  ingredientsText: 'Ức gà 200g\nTỏi băm 1 muỗng cà phê\nTiêu đen 1/2 muỗng cà phê\nNước tương 1 muỗng canh\nDầu olive 1 muỗng cà phê',
  stepsText: 'Ướp ức gà với tỏi, tiêu, nước tương trong 15 phút.\nLàm nóng chảo với dầu olive.\nÁp chảo mỗi mặt 3-4 phút đến khi chín vàng.\nThái lát và dùng kèm rau luộc.',
  dishType: 'MAIN_DISH',
  difficulty: 'EASY',
  totalCalories: '420',
  cookingTime: '25',
  imageUrl: '',
};

const STATUS_META = {
  PENDING: { label: 'Chờ duyệt', color: '#f59e0b' },
  APPROVED: { label: 'Đã duyệt', color: '#16a34a' },
  REJECTED: { label: 'Từ chối', color: '#ef4444' },
};

const FALLBACK_RECIPE_IMAGE =
  'https://images.unsplash.com/photo-1517248135467-4c7edcad34c4?auto=format&fit=crop&w=1200&q=80';

const statusMeta = (status) => STATUS_META[String(status || '').toUpperCase()] || STATUS_META.PENDING;

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
  switch (type) {
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

const toIngredientArray = (value) =>
  String(value || '')
    .split(/\n+/)
    .map((line) => String(line || '').trim())
    .filter(Boolean)
    .map((line) => {
      // Regex pattern: "Name (Qty Unit)"
      // Matches "Ingredient Name (100 g)" or "Ingredient (2)"
      const bracketRegex = /^(.*?)\s*\((.*?)\)$/;
      const match = line.match(bracketRegex);

      if (match) {
        const name = match[1].trim();
        const detail = match[2].trim();

        // Try to separate number and unit from the content inside brackets
        // e.g., "100g" -> 100 and "g"
        const unitRegex = /^(\d+(?:\.\d+)?)\s*(.*)$/;
        const unitMatch = detail.match(unitRegex);

        if (unitMatch) {
          return {
            name,
            qty: Number(unitMatch[1]),
            unit: unitMatch[2].trim() || null,
          };
        }

        // If no number found, treat whole bracket content as unit/detail
        return { name, qty: null, unit: detail };
      }

      // No brackets found, just use the whole line as name
      return { name: line, qty: null, unit: null };
    });

const toStepsArray = (value) =>
  String(value || '')
    .split(/\n+/)
    .map((line) => String(line || '').trim())
    .filter(Boolean)
    .map((content, index) => ({ step: index + 1, content }));

const validateAdminCreateForm = (form) => {
  const nextErrors = {};
  const title = String(form.title || '').trim();
  const ingredients = toIngredientArray(form.ingredientsText);
  const steps = toStepsArray(form.stepsText);
  const calories = Number(form.totalCalories);
  const cookingTime = Number(form.cookingTime);

  if (!title) {
    nextErrors.title = 'Tên món là bắt buộc.';
  }

  if (!form.dishType) {
    nextErrors.dishType = 'Vui lòng chọn loại món.';
  }

  if (!form.difficulty) {
    nextErrors.difficulty = 'Vui lòng chọn độ khó.';
  }

  if (ingredients.length === 0) {
    nextErrors.ingredientsText = 'Cần ít nhất 1 nguyên liệu.';
  }

  if (steps.length === 0) {
    nextErrors.stepsText = 'Cần ít nhất 1 bước nấu.';
  }

  if (!String(form.totalCalories || '').trim()) {
    nextErrors.totalCalories = 'Số calo là bắt buộc.';
  } else if (!Number.isFinite(calories) || calories <= 0) {
    nextErrors.totalCalories = 'Số calo phải lớn hơn 0.';
  }

  if (!String(form.cookingTime || '').trim()) {
    nextErrors.cookingTime = 'Số phút nấu là bắt buộc.';
  } else if (!Number.isInteger(cookingTime) || cookingTime <= 0) {
    nextErrors.cookingTime = 'Số phút nấu phải là số nguyên lớn hơn 0.';
  }

  return nextErrors;
};

export default function AdminRecipeReviewScreen({
  user,
  onBackToAdmin,
  onLogout,
  onNavigateOverview,
  onNavigateIngredients,
  onNavigateUsers,
  onNavigateTransactions
}) {  const [menuOpen, setMenuOpen] = useState(false);
  const [activeFilter, setActiveFilter] = useState('PENDING');
  const [query, setQuery] = useState('');
  const [loading, setLoading] = useState(false);
  const [loadingRecipes, setLoadingRecipes] = useState(false);
  const [workingId, setWorkingId] = useState(null);
  const [submissions, setSubmissions] = useState([]);
  const [recipes, setRecipes] = useState([]);
  const [selected, setSelected] = useState(null);
  const [viewMode, setViewMode] = useState('catalog');
  const [createOpen, setCreateOpen] = useState(false);
  const [editingRecipe, setEditingRecipe] = useState(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [creating, setCreating] = useState(false);
  const [createErrors, setCreateErrors] = useState({});
  const [uploading, setUploading] = useState(false);

  const filtered = useMemo(() => {
    const text = String(query || '').toLowerCase().trim();
    let result = submissions;

    if (activeFilter !== 'ALL') {
      result = result.filter((item) => String(item.status).toUpperCase() === activeFilter);
    }

    if (text) {
      result = result.filter((item) =>
        String(item.title || '').toLowerCase().includes(text)
        || String(item.submitter_name || '').toLowerCase().includes(text)
      );
    }

    return result;
  }, [activeFilter, submissions, query]);

  const filteredRecipes = useMemo(() => {
    const text = String(query || '').toLowerCase().trim();
    if (!text) {
      return recipes;
    }

    return recipes.filter((item) =>
      String(item.title || '').toLowerCase().includes(text)
      || String(item.author_name || '').toLowerCase().includes(text)
    );
  }, [recipes, query]);

  const selectedIngredients = useMemo(() => safeArray(selected?.ingredients_json), [selected]);
  const selectedSteps = useMemo(() => safeArray(selected?.steps_json), [selected]);

  const fetchRecipes = useCallback(async () => {
    try {
      setLoadingRecipes(true);
      const data = await authRequest('/api/admin/recipes');
      setRecipes(Array.isArray(data?.recipes) ? data.recipes : []);
    } catch (error) {
      Alert.alert('Lỗi tải kho công thức', error.message || 'Không thể tải danh sách công thức.');
    } finally {
      setLoadingRecipes(false);
    }
  }, []);

  const fetchSubmissions = useCallback(async () => {
    try {
      setLoading(true);
      const data = await authRequest('/api/admin/recipe-submissions?status=ALL');
      setSubmissions(Array.isArray(data?.submissions) ? data.submissions : []);
    } catch (error) {
      Alert.alert('Lỗi tải dữ liệu', error.message || 'Không thể tải danh sách công thức chờ duyệt.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchRecipes();
    fetchSubmissions();
  }, [fetchRecipes, fetchSubmissions]);

  const pickAndUploadImage = async () => {
    try {
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Quyền truy cập', 'Vui lòng cho phép ứng dụng truy cập thư viện ảnh.');
        return;
      }

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        quality: 0.7,
      });

      if (result.canceled || !result.assets?.[0]) {
        return;
      }

      const selectedAsset = result.assets[0];
      setUploading(true);

      // CÁCH LÀM CHUẨN ĐÃ CHẠY TỐT Ở MÀN NGUYÊN LIỆU
      console.log('🔄 Fetching blob from URI...');
      const response = await fetch(selectedAsset.uri);
      const blob = await response.blob();
      
      const formData = new FormData();
      formData.append('image', blob, selectedAsset.fileName || 'recipe.jpg');

      const data = await authRequest('/api/admin/upload/recipe-image', {
        method: 'POST',
        body: formData,
      });

      if (data.status === 'success' && data.imageUrl) {
        setForm((prev) => ({ ...prev, imageUrl: data.imageUrl }));
        Alert.alert('Thành công', 'Đã tải ảnh lên.');
      } else {
        throw new Error('Không nhận được URL ảnh sau khi upload.');
      }
    } catch (error) {
      console.error('❌ Lỗi upload ảnh:', error.message);
      Alert.alert('Lỗi tải ảnh', error.message || 'Không thể tải ảnh lên server.');
    } finally {
      setUploading(false);
    }
  };

  const openEditModal = (recipe) => {
    console.log('📝 Đang mở form sửa cho recipe:', recipe.recipe_id);
    setEditingRecipe(recipe);
    
    // Nạp lại dữ liệu cực kỳ cẩn thận
    const ingredientsText = safeArray(recipe.ingredients_json)
      .map((ing) => ing.name || ing.ingredient_name || '')
      .filter(Boolean)
      .join('\n');
      
    const stepsText = safeArray(recipe.steps_json)
      .map((s) => s.content || '')
      .filter(Boolean)
      .join('\n');

    setForm({
      title: String(recipe.title || ''),
      description: String(recipe.description || ''),
      ingredientsText: ingredientsText,
      stepsText: stepsText,
      dishType: recipe.dish_type || 'MAIN_DISH',
      difficulty: recipe.difficulty || 'EASY',
      totalCalories: String(recipe.total_calories || ''),
      cookingTime: String(recipe.cooking_time || ''),
      imageUrl: String(recipe.image_url || ''),
    });
    
    setCreateErrors({});
    setCreateOpen(true);
  };

  const saveRecipe = async () => {
    const title = form.title.trim();
    const ingredients = toIngredientArray(form.ingredientsText);
    const steps = toStepsArray(form.stepsText);

    const nextErrors = validateAdminCreateForm(form);
    if (Object.keys(nextErrors).length > 0) {
      setCreateErrors(nextErrors);
      Alert.alert('Thiếu hoặc sai dữ liệu', 'Vui lòng kiểm tra các trường có dấu * và nhập đúng định dạng.');
      return;
    }

    setCreateErrors({});

    try {
      setCreating(true);
      const isEdit = Boolean(editingRecipe);
      const url = isEdit ? `/api/admin/recipes/${editingRecipe.recipe_id}` : '/api/admin/recipes';
      const method = isEdit ? 'PUT' : 'POST';

      await authRequest(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title,
          description: form.description.trim() || null,
          ingredients_json: ingredients,
          steps_json: steps,
          dish_type: form.dishType,
          difficulty: form.difficulty,
          total_calories: form.totalCalories ? Number(form.totalCalories) : null,
          cooking_time: form.cookingTime ? Number(form.cookingTime) : null,
          image_url: form.imageUrl.trim() || null,
        }),
      });

      setCreateOpen(false);
      setEditingRecipe(null);
      setForm(EMPTY_FORM);
      setCreateErrors({});
      await fetchRecipes();
      Alert.alert('Thành công', isEdit ? 'Đã cập nhật công thức.' : 'Đã thêm công thức vào kho.');
    } catch (error) {
      Alert.alert('Lỗi lưu công thức', error.message || 'Không thể lưu công thức.');
    } finally {
      setCreating(false);
    }
  };

  const deleteRecipe = async (recipeId) => {
    Alert.alert(
      'Xóa công thức',
      'Bạn có chắc chắn muốn xóa công thức này khỏi kho không? Hành động này không thể hoàn tác.',
      [
        { text: 'Huỷ', style: 'cancel' },
        {
          text: 'Xóa',
          style: 'destructive',
          onPress: async () => {
            try {
              setWorkingId(recipeId);
              await authRequest(`/api/admin/recipes/${recipeId}`, { method: 'DELETE' });
              await fetchRecipes();
              Alert.alert('Thành công', 'Đã xóa công thức.');
            } catch (error) {
              Alert.alert('Lỗi xóa công thức', error.message || 'Không thể xóa công thức.');
            } finally {
              setWorkingId(null);
            }
          },
        },
      ]
    );
  };

  const reviewSubmission = async (submissionId, action) => {
    try {
      setWorkingId(submissionId);
      await authRequest(`/api/admin/recipe-submissions/${submissionId}/review`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action }),
      });
      await fetchSubmissions();
      if (action === 'APPROVE') {
        await fetchRecipes();
      }
      setSelected(null);
      Alert.alert('Thành công', action === 'APPROVE' ? 'Đã duyệt công thức.' : 'Đã từ chối công thức.');
    } catch (error) {
      Alert.alert('Lỗi xử lý', error.message || 'Không thể cập nhật trạng thái duyệt.');
    } finally {
      setWorkingId(null);
    }
  };

  return (
    <SafeAreaView style={styles.screen} edges={['top', 'bottom']}>
      <AppHeader isGuest={false} onAccountPress={() => setMenuOpen(true)} user={user} />

      <AppAccountMenu
        visible={menuOpen}
        onClose={() => setMenuOpen(false)}
        user={user}
        onLogout={onLogout}
      />

      {viewMode === 'catalog' ? (
        <View style={styles.topActions}>
          <View style={styles.searchWrap}>
            <Feather name="search" size={16} color="#9ca3af" />
            <TextInput
              value={query}
              onChangeText={setQuery}
              placeholder="Tìm tên món hoặc tác giả..."
              placeholderTextColor="#9ca3af"
              style={styles.searchInput}
            />
          </View>
          <View style={styles.catalogActionRow}>
            <Pressable style={styles.reviewButton} onPress={() => {
              setQuery('');
              setViewMode('review');
            }}>
              <Feather name="check-square" size={14} color="#ea580c" />
              <Text style={styles.reviewButtonText}>Duyệt công thức</Text>
            </Pressable>
            <Pressable style={styles.addButton} onPress={() => {
              setCreateErrors({});
              setCreateOpen(true);
            }}>
              <Feather name="plus" size={16} color="#fff" />
              <Text style={styles.addButtonText}>Thêm công thức</Text>
            </Pressable>
          </View>
        </View>
      ) : (
        <View style={styles.topActions}>
          <View style={styles.reviewTopRow}>
            <Pressable style={styles.reviewBackButton} onPress={async () => {
              setQuery('');
              await fetchRecipes();
              setViewMode('catalog');
            }}>
              <Feather name="arrow-left" size={16} color="#475569" />
              <Text style={styles.reviewBackText}>Về kho công thức</Text>
            </Pressable>
          </View>
          <View style={styles.searchWrap}>
            <Feather name="search" size={16} color="#9ca3af" />
            <TextInput
              value={query}
              onChangeText={setQuery}
              placeholder="Tìm công thức hoặc người gửi..."
              placeholderTextColor="#9ca3af"
              style={styles.searchInput}
            />
          </View>
          <ScrollView horizontal style={styles.chipScroller} contentContainerStyle={styles.chipRow} showsHorizontalScrollIndicator={false}>
            {REVIEW_FILTERS.map((chip) => {
              const active = chip.key === activeFilter;
              return (
                <Pressable key={chip.key} style={[styles.filterChip, active && styles.filterChipActive]} onPress={() => setActiveFilter(chip.key)}>
                  <Text style={[styles.filterChipText, active && styles.filterChipTextActive]}>{chip.label}</Text>
                </Pressable>
              );
            })}
          </ScrollView>
        </View>
      )}

      {viewMode === 'catalog' && loadingRecipes ? (
        <View style={styles.loadingWrap}>
          <ActivityIndicator size="large" color="#f97316" />
        </View>
      ) : viewMode === 'catalog' ? (
        <ScrollView style={styles.listScroll} contentContainerStyle={styles.listContent} keyboardShouldPersistTaps="handled">
          {filteredRecipes.length === 0 ? (
            <Text style={styles.emptyText}>Không có công thức phù hợp.</Text>
          ) : (
            filteredRecipes.map((item) => {
              return (
                <View key={item.recipe_id} style={styles.itemCard}>
                  <View style={styles.itemMainRow}>
                    <View style={styles.itemInfoCol}>
                      <View style={styles.itemHeader}>
                        <Text style={styles.itemTitle}>{item.title}</Text>
                        <Text style={styles.recipeBadge}>#{item.recipe_id}</Text>
                      </View>
                      <Text style={styles.itemAuthor}>{item.author_name || 'NutriChef'}</Text>
                      <Text numberOfLines={2} style={styles.itemDesc}>{item.description || 'Không có mô tả.'}</Text>
                      <Text style={styles.recipeMeta}>
                        {difficultyLabel(item.difficulty)} • {item.cooking_time || '--'} phút • {Number(item.total_calories) || 0} kcal
                      </Text>
                    </View>
                    <View style={styles.imageContainerCatalog}>
                      <Image
                        source={{ uri: String(item.image_url || '').trim() || FALLBACK_RECIPE_IMAGE }}
                        style={styles.itemThumb}
                      />
                      <View style={[styles.dishTypeBadge, { backgroundColor: getDishTypeBadgeInfo(item.dish_type).color }]}>
                        <Text style={styles.dishTypeBadgeText}>{getDishTypeBadgeInfo(item.dish_type).label}</Text>
                      </View>
                    </View>
                  </View>
                  <View style={styles.itemCatalogActions}>
                    <Pressable 
                      style={styles.viewBtnCatalog} 
                      onPress={() => setSelected(item)}
                      hitSlop={8}
                    >
                      <Feather name="eye" size={14} color="#2563eb" />
                      <Text style={styles.viewBtnTextCatalog}>Xem</Text>
                    </Pressable>
                    <Pressable 
                      style={styles.editBtn} 
                      onPress={() => openEditModal(item)}
                      hitSlop={8}
                    >
                      <Feather name="edit-2" size={14} color="#2563eb" />
                      <Text style={styles.editBtnText}>Sửa</Text>
                    </Pressable>
                    <Pressable
                      style={[styles.deleteBtn, workingId === item.recipe_id && styles.disabled]}
                      onPress={() => {
                        console.log('🗑️ Bấm nút xóa recipe:', item.recipe_id);
                        deleteRecipe(item.recipe_id);
                      }}
                      disabled={workingId === item.recipe_id}
                      hitSlop={8}
                    >
                      <Feather name="trash-2" size={14} color="#dc2626" />
                      <Text style={styles.deleteBtnText}>Xóa</Text>
                    </Pressable>
                  </View>
                </View>
              );
            })
          )}
        </ScrollView>
      ) : (
        <ScrollView style={styles.listScroll} contentContainerStyle={styles.listContent} keyboardShouldPersistTaps="handled">
          {loading ? (
            <ActivityIndicator size="small" color="#f97316" style={styles.reviewLoading} />
          ) : filtered.length === 0 ? (
            <Text style={styles.emptyText}>Không có công thức cần duyệt.</Text>
          ) : (
            filtered.map((item) => {
              const meta = statusMeta(item.status);
              return (
                <Pressable key={item.submission_id} style={styles.itemCard} onPress={() => setSelected(item)}>
                  <View style={styles.itemHeader}>
                    <Text style={styles.itemTitle}>{item.title}</Text>
                    <Text style={[styles.statusBadge, { color: meta.color }]}>{meta.label}</Text>
                  </View>
                  <Text style={styles.itemAuthor}>{item.submitter_name || 'Người dùng'}</Text>
                  <Text numberOfLines={2} style={styles.itemDesc}>{item.description || 'Không có mô tả.'}</Text>
                  <View style={styles.itemActions}>
                    <Pressable style={styles.viewBtn} onPress={() => setSelected(item)}>
                      <Text style={styles.viewBtnText}>Xem</Text>
                    </Pressable>
                    {String(item.status).toUpperCase() === 'PENDING' ? (
                      <>
                        <Pressable
                          style={[styles.approveBtn, workingId === item.submission_id && styles.disabled]}
                          onPress={() => reviewSubmission(item.submission_id, 'APPROVE')}
                          disabled={workingId === item.submission_id}
                        >
                          <Text style={styles.approveBtnText}>Duyệt</Text>
                        </Pressable>
                        <Pressable
                          style={[styles.rejectBtn, workingId === item.submission_id && styles.disabled]}
                          onPress={() => reviewSubmission(item.submission_id, 'REJECT')}
                          disabled={workingId === item.submission_id}
                        >
                          <Text style={styles.rejectBtnText}>Từ chối</Text>
                        </Pressable>
                      </>
                    ) : null}
                  </View>
                </Pressable>
              );
            })
          )}
        </ScrollView>
      )}

      <Modal visible={createOpen} transparent animationType="fade" onRequestClose={() => setCreateOpen(false)}>
        <View style={styles.modalBackdrop}>
          <View style={styles.modalCard}>
            <Pressable
              style={styles.modalCloseIconBtn}
              onPress={() => {
                setCreateOpen(false);
                setEditingRecipe(null);
                setForm(EMPTY_FORM);
              }}
              hitSlop={10}
            >
              <Feather name="x" size={18} color="#64748b" />
            </Pressable>
            <Text style={styles.modalTitle}>{editingRecipe ? 'Chỉnh sửa công thức' : 'Thêm công thức mới vào kho'}</Text>
            
            <ScrollView style={styles.modalFormScroll} contentContainerStyle={styles.modalFormContent}>
              {!editingRecipe && (
                <Pressable style={styles.sampleBtn} onPress={() => setForm(SAMPLE_FORM)}>
                  <Feather name="edit-3" size={14} color="#1d4ed8" />
                  <Text style={styles.sampleBtnText}>Điền mẫu để tham khảo cách nhập</Text>
                </Pressable>
              )}

              <Text style={styles.fieldLabel}>Tên món <Text style={styles.requiredMark}>*</Text></Text>
              <TextInput
                value={form.title}
                onChangeText={(v) => {
                  setForm((c) => ({ ...c, title: v }));
                  setCreateErrors((prev) => ({ ...prev, title: null }));
                }}
                placeholder="Tên món"
                placeholderTextColor="#9ca3af"
                style={[styles.input, createErrors.title && styles.inputError]}
              />
              {createErrors.title ? <Text style={styles.fieldError}>{createErrors.title}</Text> : null}

              <Text style={styles.fieldLabel}>Mô tả</Text>
              <TextInput value={form.description} onChangeText={(v) => setForm((c) => ({ ...c, description: v }))} placeholder="Mô tả" style={[styles.input, styles.textArea]} multiline />

              <Text style={styles.fieldLabel}>Loại món <Text style={styles.requiredMark}>*</Text></Text>
              <View style={styles.optionRow}>
                {DISH_TYPES.map((item) => {
                  const active = form.dishType === item.key;
                  return (
                    <Pressable key={item.key} onPress={() => {
                      setForm((c) => ({ ...c, dishType: item.key }));
                      setCreateErrors((prev) => ({ ...prev, dishType: null }));
                    }} style={[styles.optionChip, active && styles.optionChipActive]}>
                      <Text style={[styles.optionChipText, active && styles.optionChipTextActive]}>{item.label}</Text>
                    </Pressable>
                  );
                })}
              </View>
              {createErrors.dishType ? <Text style={styles.fieldError}>{createErrors.dishType}</Text> : null}

              <Text style={styles.fieldLabel}>Độ khó <Text style={styles.requiredMark}>*</Text></Text>
              <View style={styles.optionRow}>
                {DIFFICULTIES.map((item) => {
                  const active = form.difficulty === item.key;
                  return (
                    <Pressable key={item.key} onPress={() => {
                      setForm((c) => ({ ...c, difficulty: item.key }));
                      setCreateErrors((prev) => ({ ...prev, difficulty: null }));
                    }} style={[styles.optionChip, active && styles.optionChipActive]}>
                      <Text style={[styles.optionChipText, active && styles.optionChipTextActive]}>{item.label}</Text>
                    </Pressable>
                  );
                })}
              </View>
              {createErrors.difficulty ? <Text style={styles.fieldError}>{createErrors.difficulty}</Text> : null}

              <Text style={styles.fieldLabel}>Nguyên liệu <Text style={styles.requiredMark}>*</Text></Text>
              <TextInput
                value={form.ingredientsText}
                onChangeText={(v) => {
                  setForm((c) => ({ ...c, ingredientsText: v }));
                  setCreateErrors((prev) => ({ ...prev, ingredientsText: null }));
                }}
                placeholder={"Nguyên liệu (mỗi dòng 1 mục)\nVD: Ức gà 200g\nVD: Tỏi băm 1 muỗng cà phê"}
                placeholderTextColor="#9ca3af"
                style={[styles.input, styles.textArea, createErrors.ingredientsText && styles.inputError]}
                multiline
              />
              {createErrors.ingredientsText ? <Text style={styles.fieldError}>{createErrors.ingredientsText}</Text> : null}

              <Text style={styles.fieldLabel}>Bước nấu <Text style={styles.requiredMark}>*</Text></Text>
              <TextInput
                value={form.stepsText}
                onChangeText={(v) => {
                  setForm((c) => ({ ...c, stepsText: v }));
                  setCreateErrors((prev) => ({ ...prev, stepsText: null }));
                }}
                placeholder={"Bước nấu (mỗi dòng 1 bước)\nVD: Ướp gà 15 phút.\nVD: Áp chảo mỗi mặt 3-4 phút."}
                placeholderTextColor="#9ca3af"
                style={[styles.input, styles.textArea, createErrors.stepsText && styles.inputError]}
                multiline
              />
              {createErrors.stepsText ? <Text style={styles.fieldError}>{createErrors.stepsText}</Text> : null}

              <Text style={styles.fieldLabel}>Thông tin công thức: <Text style={styles.requiredMark}>*</Text></Text>
              <View style={styles.row}>
                <TextInput
                  value={form.totalCalories}
                  onChangeText={(v) => {
                    setForm((c) => ({ ...c, totalCalories: v.replace(/[^0-9]/g, '') }));
                    setCreateErrors((prev) => ({ ...prev, totalCalories: null }));
                  }}
                  placeholder="Số calo * (VD: 420)"
                  placeholderTextColor="#9ca3af"
                  keyboardType="number-pad"
                  style={[styles.input, styles.halfInput, createErrors.totalCalories && styles.inputError]}
                />
                <TextInput
                  value={form.cookingTime}
                  onChangeText={(v) => {
                    setForm((c) => ({ ...c, cookingTime: v.replace(/[^0-9]/g, '') }));
                    setCreateErrors((prev) => ({ ...prev, cookingTime: null }));
                  }}
                  placeholder="Số phút nấu * (VD: 25)"
                  placeholderTextColor="#9ca3af"
                  keyboardType="number-pad"
                  style={[styles.input, styles.halfInput, createErrors.cookingTime && styles.inputError]}
                />
              </View>
              {(createErrors.totalCalories || createErrors.cookingTime) ? (
                <Text style={styles.fieldError}>{createErrors.totalCalories || createErrors.cookingTime}</Text>
              ) : null}

              <Text style={styles.fieldLabel}>Ảnh công thức</Text>
              <View style={styles.imagePickerWrap}>
                {form.imageUrl ? (
                  <View style={styles.imagePreviewWrap}>
                    <Image source={{ uri: form.imageUrl }} style={styles.imagePreview} />
                    <Pressable
                      style={styles.removeImageBtn}
                      onPress={() => setForm((c) => ({ ...c, imageUrl: '' }))}
                    >
                      <Feather name="trash-2" size={14} color="#fff" />
                    </Pressable>
                  </View>
                ) : (
                  <View style={styles.imagePlaceholder}>
                    <Feather name="image" size={24} color="#9ca3af" />
                    <Text style={styles.imagePlaceholderText}>Chưa có ảnh</Text>
                  </View>
                )}
                <Pressable
                  style={[styles.uploadBtn, uploading && styles.disabled]}
                  onPress={pickAndUploadImage}
                  disabled={uploading}
                >
                  <Feather name={uploading ? 'loader' : 'upload-cloud'} size={14} color="#f97316" />
                  <Text style={styles.uploadBtnText}>{uploading ? 'Đang tải...' : 'Tải ảnh lên'}</Text>
                </Pressable>
              </View>
            </ScrollView>

            <View style={styles.modalActions}>
              <Pressable style={styles.closeBtn} onPress={() => {
                setCreateOpen(false);
                setEditingRecipe(null);
                setForm(EMPTY_FORM);
              }}>
                <Text style={styles.closeBtnText}>Huỷ</Text>
              </Pressable>
              <Pressable style={[styles.approveBtn, creating && styles.disabled]} onPress={saveRecipe} disabled={creating}>
                <Text style={styles.approveBtnText}>{creating ? 'Đang lưu...' : (editingRecipe ? 'Lưu thay đổi' : 'Thêm công thức')}</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>

      <Modal visible={Boolean(selected)} transparent animationType="fade" onRequestClose={() => setSelected(null)}>
        <View style={styles.modalBackdrop}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>{selected?.title}</Text>
            <Text style={styles.modalMeta}>Người gửi: {selected?.submitter_name || 'Người dùng'}</Text>
            <Text style={styles.modalMeta}>Trạng thái: {statusMeta(selected?.status).label}</Text>

            <ScrollView style={styles.modalDetailScroll} contentContainerStyle={styles.modalDetailContent}>
              <View style={styles.modalHeroImageWrap}>
                <Image
                  source={{ uri: String(selected?.image_url || '').trim() || FALLBACK_RECIPE_IMAGE }}
                  style={styles.modalHeroImage}
                />
              </View>

              <View style={styles.modalInfoGrid}>
                <View style={styles.modalInfoChip}>
                  <Text style={styles.modalInfoLabel}>Loại món</Text>
                  <Text style={styles.modalInfoValue}>{dishTypeLabel(selected?.dish_type)}</Text>
                </View>
                <View style={styles.modalInfoChip}>
                  <Text style={styles.modalInfoLabel}>Độ khó</Text>
                  <Text style={styles.modalInfoValue}>{difficultyLabel(selected?.difficulty)}</Text>
                </View>
                <View style={styles.modalInfoChip}>
                  <Text style={styles.modalInfoLabel}>Calories</Text>
                  <Text style={styles.modalInfoValue}>{Number(selected?.total_calories) || 0} kcal</Text>
                </View>
                <View style={styles.modalInfoChip}>
                  <Text style={styles.modalInfoLabel}>Thời gian</Text>
                  <Text style={styles.modalInfoValue}>{selected?.cooking_time || '--'} phút</Text>
                </View>
              </View>

              {selected?.description ? (
                <View style={styles.modalSection}>
                  <Text style={styles.modalSectionTitle}>Mô tả món ăn</Text>
                  <Text style={styles.modalBody}>{selected.description}</Text>
                </View>
              ) : null}

              <View style={styles.modalSection}>
                <Text style={styles.modalSectionTitle}>Nguyên liệu</Text>
                {selectedIngredients.length === 0 ? (
                  <Text style={styles.modalPlaceholder}>Chưa có dữ liệu nguyên liệu.</Text>
                ) : (
                  selectedIngredients.map((item, index) => (
                    <View key={`selected-ing-${index}`} style={styles.modalListRow}>
                      <Text style={styles.modalListBullet}>•</Text>
                      <Text style={styles.modalListText}>
                        {item?.name || item?.ingredient_name || `Nguyên liệu ${index + 1}`}
                        {item?.qty ? ` - ${item.qty}` : ''}
                        {item?.unit ? ` ${item.unit}` : ''}
                      </Text>
                    </View>
                  ))
                )}
              </View>

              <View style={styles.modalSection}>
                <Text style={styles.modalSectionTitle}>Cách làm</Text>
                {selectedSteps.length === 0 ? (
                  <Text style={styles.modalPlaceholder}>Chưa có dữ liệu bước nấu.</Text>
                ) : (
                  selectedSteps.map((item, index) => (
                    <View key={`selected-step-${index}`} style={styles.modalStepRow}>
                      <View style={styles.modalStepBadge}>
                        <Text style={styles.modalStepBadgeText}>{item?.step || index + 1}</Text>
                      </View>
                      <Text style={styles.modalStepText}>{item?.content || ''}</Text>
                    </View>
                  ))
                )}
              </View>
            </ScrollView>

            <View style={styles.modalActions}>
              <Pressable style={styles.closeBtn} onPress={() => setSelected(null)}>
                <Text style={styles.closeBtnText}>Đóng</Text>
              </Pressable>
              {String(selected?.status).toUpperCase() === 'PENDING' ? (
                <>
                  <Pressable
                    style={[styles.approveBtn, workingId === selected?.submission_id && styles.disabled]}
                    onPress={() => reviewSubmission(selected.submission_id, 'APPROVE')}
                    disabled={workingId === selected?.submission_id}
                  >
                    <Text style={styles.approveBtnText}>Duyệt</Text>
                  </Pressable>
                  <Pressable
                    style={[styles.rejectBtn, workingId === selected?.submission_id && styles.disabled]}
                    onPress={() => reviewSubmission(selected.submission_id, 'REJECT')}
                    disabled={workingId === selected?.submission_id}
                  >
                    <Text style={styles.rejectBtnText}>Từ chối</Text>
                  </Pressable>
                </>
              ) : null}
            </View>
          </View>
        </View>
      </Modal>

      <AppBottomNav
        role="admin"
        activeKey="recipes"
        onTabPress={(tabKey) => {
          if (tabKey === 'overview') {
            onNavigateOverview?.();
            return;
          }
          if (tabKey === 'ingredients') {
            onNavigateIngredients?.();
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
  headerRow: {
    paddingHorizontal: 14,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  brandTitle: {
    fontSize: 24,
    fontWeight: '800',
    color: '#111827',
  },
  subTitle: {
    color: '#6b7280',
    fontSize: 13,
  },
  topActions: {
    paddingHorizontal: 14,
    paddingTop: 12,
    gap: 8,
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
  addButton: {
    flex: 1,
    minHeight: 40,
    borderRadius: 10,
    backgroundColor: '#f97316',
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: 8,
  },
  catalogActionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  reviewButton: {
    minHeight: 40,
    paddingHorizontal: 12,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#fdba74',
    backgroundColor: '#fff7ed',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  reviewButtonText: {
    color: '#ea580c',
    fontWeight: '800',
    fontSize: 12,
  },
  reviewTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  reviewBackButton: {
    minHeight: 35,
    minWidth: 150,
    borderRadius: 15,
    borderWidth: 1,
    borderColor: '#e5e7eb',
    backgroundColor: '#fff',
    paddingHorizontal: 18,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  reviewBackText: {
    color: '#475569',
    fontWeight: '700',
    fontSize: 14,
  },
  addButtonText: {
    color: '#fff',
    fontWeight: '700',
    fontSize: 13,
  },
  chipScroller: {
    marginTop: 10,
    maxHeight: 54,
  },
  chipRow: {
    paddingHorizontal: 12,
    gap: 8,
  },
  filterChip: {
    borderRadius: 999,
    borderWidth: 1,
    borderColor: '#e5e7eb',
    backgroundColor: '#fff',
    minHeight: 40,
    paddingHorizontal: 16,
    justifyContent: 'center',
    alignItems: 'center',
  },
  filterChipActive: {
    borderColor: '#fdba74',
    backgroundColor: '#fff7ed',
  },
  filterChipText: {
    color: '#6b7280',
    fontSize: 14,
    fontWeight: '700',
  },
  filterChipTextActive: {
    color: '#c2410c',
  },
  loadingWrap: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  listScroll: {
    marginTop: 6,
    flex: 1,
  },
  listContent: {
    paddingHorizontal: 14,
    paddingTop: 12,
    paddingBottom: 32,
    gap: 10,
  },
  secondaryPanelHeader: {
    marginTop: 6,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#e5e7eb',
    backgroundColor: '#fff',
    minHeight: 42,
    paddingHorizontal: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  secondaryPanelTitle: {
    color: '#334155',
    fontWeight: '700',
    fontSize: 13,
  },
  reviewLoading: {
    marginTop: 10,
  },
  emptyText: {
    color: '#6b7280',
    textAlign: 'center',
    marginTop: 22,
  },
  recipeBadge: {
    fontSize: 12,
    fontWeight: '700',
    color: '#64748b',
  },
  recipeMeta: {
    color: '#64748b',
    fontSize: 12,
    fontWeight: '600',
  },
  itemCard: {
    backgroundColor: '#fff',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#e5e7eb',
    padding: 12,
    gap: 6,
  },
  itemHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 8,
  },
  itemTitle: {
    flex: 1,
    fontWeight: '700',
    color: '#111827',
    fontSize: 17,
  },
  statusBadge: {
    fontWeight: '700',
    fontSize: 12,
  },
  itemAuthor: {
    color: '#475569',
    fontWeight: '600',
    fontSize: 13,
  },
  itemDesc: {
    color: '#6b7280',
    fontSize: 13,
    lineHeight: 18,
  },
  itemActions: {
    marginTop: 2,
    flexDirection: 'row',
    gap: 10,
  },
  itemMainRow: {
    flexDirection: 'row',
    gap: 12,
    alignItems: 'flex-start',
  },
  itemInfoCol: {
    flex: 1,
    gap: 4,
  },
  itemThumb: {
    width: 80,
    height: 80,
    borderRadius: 10,
    backgroundColor: '#f3f4f6',
  },
  imageContainerCatalog: {
    position: 'relative',
    width: 80,
    height: 80,
  },
  dishTypeBadge: {
    position: 'absolute',
    top: -4,
    left: -4,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
    shadowColor: '#000',
    shadowOpacity: 0.2,
    shadowOffset: { width: 0, height: 2 },
    shadowRadius: 3,
    elevation: 4,
    zIndex: 1,
  },
  dishTypeBadgeText: {
    fontFamily: Platform.select({
      ios: 'AvenirNext-Bold',
      android: 'sans-serif-condensed',
      default: 'system-ui',
    }),
    fontSize: 8,
    fontWeight: '800',
    color: '#fff',
    textTransform: 'uppercase',
  },
  itemCatalogActions: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 8,
    borderTopWidth: 1,
    borderTopColor: '#f3f4f6',
    paddingTop: 8,
  },
  editBtn: {
    flex: 1,
    minHeight: 36,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#bfdbfe',
    backgroundColor: '#eff6ff',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  editBtnText: {
    color: '#2563eb',
    fontWeight: '700',
    fontSize: 13,
  },
  deleteBtn: {
    flex: 1,
    minHeight: 36,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#fecaca',
    backgroundColor: '#fef2f2',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  deleteBtnText: {
    color: '#dc2626',
    fontWeight: '700',
    fontSize: 13,
  },
  viewBtnCatalog: {
    flex: 1,
    minHeight: 36,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#cbd5e1',
    backgroundColor: '#f1f5f9',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  viewBtnTextCatalog: {
    color: '#475569',
    fontWeight: '700',
    fontSize: 13,
  },
  viewBtn: {
    flex: 1,
    minHeight: 44,
    paddingHorizontal: 12,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#bfdbfe',
    backgroundColor: '#eff6ff',
    alignItems: 'center',
    justifyContent: 'center',
  },
  viewBtnText: {
    color: '#2563eb',
    fontWeight: '700',
    fontSize: 14,
  },
  approveBtn: {
    flex: 1,
    minHeight: 44,
    paddingHorizontal: 12,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#86efac',
    backgroundColor: '#f0fdf4',
    alignItems: 'center',
    justifyContent: 'center',
  },
  approveBtnText: {
    color: '#16a34a',
    fontWeight: '700',
    fontSize: 14,
  },
  rejectBtn: {
    flex: 1,
    minHeight: 44,
    paddingHorizontal: 12,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#fecaca',
    backgroundColor: '#fef2f2',
    alignItems: 'center',
    justifyContent: 'center',
  },
  rejectBtnText: {
    color: '#dc2626',
    fontWeight: '700',
    fontSize: 14,
  },
  disabled: {
    opacity: 0.6,
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(17,24,39,0.4)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 18,
  },
  modalCard: {
    width: '100%',
    maxWidth: 420,
    backgroundColor: '#fff',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#e5e7eb',
    padding: 14,
    gap: 8,
  },
  modalCloseIconBtn: {
    position: 'absolute',
    top: 10,
    right: 10,
    minWidth: 30,
    minHeight: 30,
    borderRadius: 15,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#e5e7eb',
    backgroundColor: '#f8fafc',
    zIndex: 2,
  },
  fieldLabel: {
    color: '#334155',
    fontSize: 13,
    fontWeight: '700',
    marginTop: 2,
  },
  requiredMark: {
    color: '#dc2626',
  },
  sampleBtn: {
    minHeight: 36,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#bfdbfe',
    backgroundColor: '#eff6ff',
    paddingHorizontal: 10,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
  },
  sampleBtnText: {
    color: '#1e40af',
    fontSize: 12,
    fontWeight: '700',
  },
  input: {
    borderWidth: 1,
    borderColor: '#d1d5db',
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 9,
    fontSize: 14,
    backgroundColor: '#fff',
  },
  inputError: {
    borderColor: '#ef4444',
  },
  fieldError: {
    color: '#b91c1c',
    fontSize: 12,
    marginTop: -3,
    marginBottom: 2,
    fontWeight: '600',
  },
  textArea: {
    minHeight: 74,
    textAlignVertical: 'top',
  },
  row: {
    flexDirection: 'row',
    gap: 8,
  },
  halfInput: {
    flex: 1,
  },
  optionRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  optionChip: {
    borderRadius: 999,
    borderWidth: 1,
    borderColor: '#e5e7eb',
    backgroundColor: '#fff',
    paddingHorizontal: 12,
    minHeight: 34,
    alignItems: 'center',
    justifyContent: 'center',
  },
  optionChipActive: {
    borderColor: '#fdba74',
    backgroundColor: '#fff7ed',
  },
  optionChipText: {
    color: '#6b7280',
    fontSize: 12,
    fontWeight: '600',
  },
  optionChipTextActive: {
    color: '#c2410c',
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: '#111827',
  },
  modalMeta: {
    fontSize: 13,
    color: '#64748b',
  },
  modalBody: {
    marginTop: 4,
    color: '#334155',
    lineHeight: 20,
  },
  modalDetailScroll: {
    marginTop: 6,
    maxHeight: 360,
  },
  modalDetailContent: {
    gap: 10,
    paddingBottom: 4,
  },
  modalHeroImageWrap: {
    borderRadius: 12,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: '#e5e7eb',
    backgroundColor: '#f8fafc',
  },
  modalHeroImage: {
    width: '100%',
    height: 170,
    resizeMode: 'cover',
  },
  modalInfoGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  modalInfoChip: {
    minWidth: '48%',
    flex: 1,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#e5e7eb',
    backgroundColor: '#f8fafc',
    paddingVertical: 8,
    paddingHorizontal: 10,
    gap: 2,
  },
  modalInfoLabel: {
    color: '#64748b',
    fontSize: 12,
    fontWeight: '600',
  },
  modalInfoValue: {
    color: '#0f172a',
    fontSize: 13,
    fontWeight: '700',
  },
  modalSection: {
    gap: 6,
  },
  modalSectionTitle: {
    color: '#0f172a',
    fontSize: 14,
    fontWeight: '800',
  },
  modalPlaceholder: {
    color: '#64748b',
    fontSize: 13,
  },
  modalListRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
  },
  modalListBullet: {
    color: '#334155',
    fontSize: 15,
    lineHeight: 20,
  },
  modalListText: {
    flex: 1,
    color: '#334155',
    fontSize: 13,
    lineHeight: 20,
  },
  modalStepRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
  },
  modalStepBadge: {
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: '#f97316',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 1,
  },
  modalStepBadgeText: {
    color: '#fff',
    fontSize: 11,
    fontWeight: '800',
  },
  modalStepText: {
    flex: 1,
    color: '#334155',
    fontSize: 13,
    lineHeight: 20,
  },
  modalActions: {
    marginTop: 8,
    flexDirection: 'row',
    gap: 8,
  },
  closeBtn: {
    flex: 1,
    minHeight: 34,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#d1d5db',
    alignItems: 'center',
    justifyContent: 'center',
  },
  closeBtnText: {
    color: '#374151',
    fontWeight: '700',
    fontSize: 13,
  },
  modalFormScroll: {
    maxHeight: 450,
  },
  modalFormContent: {
    gap: 8,
    paddingBottom: 10,
  },
  imagePickerWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginTop: 4,
  },
  imagePreviewWrap: {
    width: 100,
    height: 100,
    borderRadius: 10,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: '#e5e7eb',
  },
  imagePreview: {
    width: '100%',
    height: '100%',
    resizeMode: 'cover',
  },
  removeImageBtn: {
    position: 'absolute',
    top: 4,
    right: 4,
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: 'rgba(0,0,0,0.5)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  imagePlaceholder: {
    width: 100,
    height: 100,
    borderRadius: 10,
    borderWidth: 1,
    borderStyle: 'dashed',
    borderColor: '#d1d5db',
    backgroundColor: '#f9fafb',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
  },
  imagePlaceholderText: {
    fontSize: 10,
    color: '#9ca3af',
    fontWeight: '600',
  },
  uploadBtn: {
    flex: 1,
    minHeight: 40,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#fdba74',
    backgroundColor: '#fff7ed',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  uploadBtnText: {
    color: '#f97316',
    fontWeight: '700',
    fontSize: 13,
  },
});