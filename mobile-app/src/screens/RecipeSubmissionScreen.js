import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
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
import * as ImagePicker from 'expo-image-picker';
import { Feather } from '@expo/vector-icons';
import { AppBottomNav, AppHeader, AppAccountMenu } from '../components/AppChrome';
import { authRequest } from '../services/client';

const EMPTY_FORM = {
  title: '',
  description: '',
  ingredientsText: '',
  stepsText: '',
  dishType: 'MAIN_DISH',
  cookingTime: '',
  totalCalories: '',
  difficulty: 'EASY',
};

const DISH_TYPE_OPTIONS = [
  { key: 'MAIN_DISH', label: 'Món chính' },
  { key: 'SIDE_DISH', label: 'Món phụ' },
  { key: 'DESSERT', label: 'Tráng miệng' },
];

const DIFFICULTY_OPTIONS = [
  { key: 'EASY', label: 'Dễ' },
  { key: 'MEDIUM', label: 'Trung bình' },
  { key: 'HARD', label: 'Khó' },
];

const STATUS_MAP = {
  PENDING: { label: 'Chờ duyệt', color: '#f59e0b' },
  APPROVED: { label: 'Đã duyệt', color: '#16a34a' },
  REJECTED: { label: 'Bị từ chối', color: '#ef4444' },
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

const statusMeta = (status) => STATUS_MAP[String(status || '').toUpperCase()] || STATUS_MAP.PENDING;

const validateSubmissionForm = (form) => {
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
    nextErrors.totalCalories = 'Calories là bắt buộc.';
  } else if (!Number.isFinite(calories) || calories <= 0) {
    nextErrors.totalCalories = 'Calories phải lớn hơn 0.';
  }

  if (!String(form.cookingTime || '').trim()) {
    nextErrors.cookingTime = 'Thời gian nấu là bắt buộc.';
  } else if (!Number.isInteger(cookingTime) || cookingTime <= 0) {
    nextErrors.cookingTime = 'Thời gian nấu phải là số nguyên lớn hơn 0.';
  }

  return nextErrors;
};
export default function RecipeSubmissionScreen({
  isGuest = false,
  user,
  usageCount,
  onLoginPress,
  onSignupPress,
  onNavigateHome,
  onNavigateSuggest,
  onNavigateMeal,
  onNavigateFavorites,
  onNavigateUpgrade,
  onNavigateShopping,
  onAchievementPress,
  onRequestLogout,
}) {
  const [form, setForm] = useState(EMPTY_FORM);
  const [submitting, setSubmitting] = useState(false);
  const [loadingList, setLoadingList] = useState(false);
  const [submissions, setSubmissions] = useState([]);
  const [errors, setErrors] = useState({});
  const [selectedImage, setSelectedImage] = useState(null);
  const [menuOpen, setMenuOpen] = useState(false);

  const displayName = useMemo(() => user?.fullName || user?.name || 'Người dùng', [user]);
  const displayEmail = useMemo(() => user?.email || 'user@nutrichef.app', [user]);

  const ingredientCount = useMemo(() => toIngredientArray(form.ingredientsText).length, [form.ingredientsText]);
  const stepsCount = useMemo(() => toStepsArray(form.stepsText).length, [form.stepsText]);

  const fetchMySubmissions = useCallback(async () => {
    if (isGuest) {
      setSubmissions([]);
      return;
    }

    try {
      setLoadingList(true);
      const data = await authRequest('/api/recipes/submissions/me');
      setSubmissions(Array.isArray(data?.submissions) ? data.submissions : []);
    } catch (error) {
      Alert.alert('Lỗi tải trạng thái', error.message || 'Không thể tải danh sách công thức đã gửi.');
    } finally {
      setLoadingList(false);
    }
  }, [isGuest]);

  useEffect(() => {
    fetchMySubmissions();
  }, [fetchMySubmissions]);

  const submitRecipe = async () => {
    if (isGuest) {
      Alert.alert('Yêu cầu đăng nhập', 'Bạn cần đăng nhập để gửi công thức.', [
        { text: 'Để sau', style: 'cancel' },
        { text: 'Đăng nhập', onPress: () => onLoginPress?.() },
      ]);
      return;
    }

    const title = form.title.trim();
    const ingredients = toIngredientArray(form.ingredientsText);
    const steps = toStepsArray(form.stepsText);

    const nextErrors = validateSubmissionForm(form);
    if (Object.keys(nextErrors).length > 0) {
      setErrors(nextErrors);
      Alert.alert('Thiếu hoặc sai dữ liệu', 'Vui lòng kiểm tra các trường có dấu * và nhập đúng định dạng.');
      return;
    }

    setErrors({});

    const payload = new FormData();
    payload.append('title', title);
    payload.append('description', form.description.trim() || '');
    payload.append('ingredients_json', JSON.stringify(ingredients));
    payload.append('steps_json', JSON.stringify(steps));
    payload.append('dish_type', form.dishType);
    payload.append('cooking_time', String(Number(form.cookingTime)));
    payload.append('total_calories', String(Number(form.totalCalories)));
    payload.append('difficulty', form.difficulty);

    if (selectedImage?.uri) {
      payload.append('image', {
        uri: selectedImage.uri,
        name: selectedImage.fileName || `recipe-${Date.now()}.jpg`,
        type: selectedImage.mimeType || 'image/jpeg',
      });
    }

    try {
      setSubmitting(true);
      await authRequest('/api/recipes/submissions', {
        method: 'POST',
        body: payload,
      });

      Alert.alert('Đã gửi thành công', 'Công thức của bạn đang chờ admin duyệt.');
      setForm(EMPTY_FORM);
      setErrors({});
      setSelectedImage(null);
      await fetchMySubmissions();
    } catch (error) {
      Alert.alert('Lỗi gửi công thức', error.message || 'Không thể gửi công thức.');
    } finally {
      setSubmitting(false);
    }
  };

  const pickRecipeImage = async () => {
    try {
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Cần quyền truy cập ảnh', 'Vui lòng cho phép ứng dụng truy cập thư viện ảnh để tải ảnh món ăn.');
        return;
      }

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        aspect: [4, 3],
        quality: 0.8,
      });

      if (result.canceled || !Array.isArray(result.assets) || result.assets.length === 0) {
        return;
      }

      setSelectedImage(result.assets[0]);
    } catch (error) {
      Alert.alert('Không thể chọn ảnh', error.message || 'Vui lòng thử lại.');
    }
  };

  return (
    <SafeAreaView style={styles.screen} edges={['top', 'bottom']}>
      <AppHeader
        user={user}
        onUpgradePress={onNavigateUpgrade}
        onLoginPress={onLoginPress}
        onSignupPress={onLoginPress}
        isGuest={isGuest}
        onAccountPress={() => setMenuOpen(true)}
      />

      <AppAccountMenu 
        visible={menuOpen}
        onClose={() => setMenuOpen(false)}
        user={user}
        onAchievementPress={onAchievementPress}
        onLogout={onRequestLogout}
      />

      <ScrollView contentContainerStyle={styles.container}>
        <View style={styles.card}>
          <View style={styles.heroRow}>
            <View style={styles.heroIcon}>
              <Feather name="edit-3" size={18} color="#f97316" />
            </View>
            <View style={styles.heroTextWrap}>
              <Text style={styles.title}>Đóng góp công thức</Text>
              <Text style={styles.subTitle}>Công thức sẽ được kiểm duyệt bởi admin!</Text>
            </View>
          </View>

          <Text style={styles.fieldTitle}>Tên món <Text style={styles.requiredMark}>*</Text></Text>
          <TextInput
            value={form.title}
            onChangeText={(v) => {
              setForm((c) => ({ ...c, title: v }));
              setErrors((prev) => ({ ...prev, title: null }));
            }}
            placeholder="Tên công thức"
            style={[styles.input, errors.title && styles.inputError]}
          />
          {errors.title ? <Text style={styles.fieldError}>{errors.title}</Text> : null}

          <Text style={styles.fieldTitle}>Mô tả</Text>
          <TextInput
            value={form.description}
            onChangeText={(v) => setForm((c) => ({ ...c, description: v }))}
            placeholder="Mô tả ngắn"
            style={[styles.input, styles.textArea]}
            multiline
          />

          <Text style={styles.fieldTitle}>Loại món <Text style={styles.requiredMark}>*</Text></Text>
          <View style={styles.optionRow}>
            {DISH_TYPE_OPTIONS.map((item) => {
              const active = form.dishType === item.key;
              return (
                <Pressable
                  key={item.key}
                  onPress={() => {
                    setForm((c) => ({ ...c, dishType: item.key }));
                    setErrors((prev) => ({ ...prev, dishType: null }));
                  }}
                  style={[styles.optionChip, active && styles.optionChipActive]}
                >
                  <Text style={[styles.optionChipText, active && styles.optionChipTextActive]}>{item.label}</Text>
                </Pressable>
              );
            })}
          </View>
          {errors.dishType ? <Text style={styles.fieldError}>{errors.dishType}</Text> : null}

          <Text style={styles.fieldTitle}>Độ khó <Text style={styles.requiredMark}>*</Text></Text>
          <View style={styles.optionRow}>
            {DIFFICULTY_OPTIONS.map((item) => {
              const active = form.difficulty === item.key;
              return (
                <Pressable
                  key={item.key}
                  onPress={() => {
                    setForm((c) => ({ ...c, difficulty: item.key }));
                    setErrors((prev) => ({ ...prev, difficulty: null }));
                  }}
                  style={[styles.optionChip, active && styles.optionChipActive]}
                >
                  <Text style={[styles.optionChipText, active && styles.optionChipTextActive]}>{item.label}</Text>
                </Pressable>
              );
            })}
          </View>
          {errors.difficulty ? <Text style={styles.fieldError}>{errors.difficulty}</Text> : null}

          <Text style={styles.fieldTitle}>Nguyên liệu <Text style={styles.requiredMark}>*</Text></Text>
          <TextInput
            value={form.ingredientsText}
            onChangeText={(v) => {
              setForm((c) => ({ ...c, ingredientsText: v }));
              setErrors((prev) => ({ ...prev, ingredientsText: null }));
            }}
            placeholder="Nguyên liệu (mỗi dòng 1 nguyên liệu)"
            style={[styles.input, styles.textArea, errors.ingredientsText && styles.inputError]}
            multiline
          />
          {errors.ingredientsText ? <Text style={styles.fieldError}>{errors.ingredientsText}</Text> : null}

          <Text style={styles.fieldTitle}>Các bước nấu <Text style={styles.requiredMark}>*</Text></Text>
          <TextInput
            value={form.stepsText}
            onChangeText={(v) => {
              setForm((c) => ({ ...c, stepsText: v }));
              setErrors((prev) => ({ ...prev, stepsText: null }));
            }}
            placeholder="Các bước nấu (mỗi dòng 1 bước)"
            style={[styles.input, styles.textArea, errors.stepsText && styles.inputError]}
            multiline
          />
          {errors.stepsText ? <Text style={styles.fieldError}>{errors.stepsText}</Text> : null}

          <View style={styles.row}>
            <TextInput
              value={form.totalCalories}
              onChangeText={(v) => {
                setForm((c) => ({ ...c, totalCalories: v.replace(/[^0-9]/g, '') }));
                setErrors((prev) => ({ ...prev, totalCalories: null }));
              }}
              placeholder="Calories *"
              keyboardType="number-pad"
              style={[styles.input, styles.halfInput, errors.totalCalories && styles.inputError]}
            />
            <TextInput
              value={form.cookingTime}
              onChangeText={(v) => {
                setForm((c) => ({ ...c, cookingTime: v.replace(/[^0-9]/g, '') }));
                setErrors((prev) => ({ ...prev, cookingTime: null }));
              }}
              placeholder="Phút nấu *"
              keyboardType="number-pad"
              style={[styles.input, styles.halfInput, errors.cookingTime && styles.inputError]}
            />
          </View>
          {(errors.totalCalories || errors.cookingTime) ? (
            <Text style={styles.fieldError}>{errors.totalCalories || errors.cookingTime}</Text>
          ) : null}

          <Text style={styles.fieldTitle}>Ảnh món (tuỳ chọn)</Text>
          <Pressable style={styles.imagePickerButton} onPress={pickRecipeImage}>
            <Feather name="image" size={16} color="#2563eb" />
            <Text style={styles.imagePickerText}>{selectedImage?.fileName || 'Chọn ảnh từ thư viện'}</Text>
          </Pressable>
          {selectedImage?.uri ? <Image source={{ uri: selectedImage.uri }} style={styles.previewImage} /> : null}

          <View style={styles.helperRow}>
            <Text style={styles.helper}>Nguyên liệu: {ingredientCount} dòng</Text>
            <Text style={styles.helper}>Bước nấu: {stepsCount} dòng</Text>
          </View>

          <Pressable style={[styles.submitButton, submitting && styles.disabled]} onPress={submitRecipe} disabled={submitting}>
            {submitting ? <ActivityIndicator color="#fff" size="small" /> : <Text style={styles.submitText}>Gửi admin duyệt</Text>}
          </Pressable>
        </View>

        <View style={styles.card}>
          <Text style={styles.title}>Trạng thái công thức đã gửi</Text>
          {loadingList ? (
            <ActivityIndicator size="small" color="#f97316" />
          ) : submissions.length === 0 ? (
            <Text style={styles.emptyText}>Bạn chưa gửi công thức nào.</Text>
          ) : (
            submissions.map((item) => {
              const meta = statusMeta(item.status);
              return (
                <View key={item.submission_id} style={styles.statusItem}>
                  <View style={styles.statusHeader}>
                    <Text style={styles.statusTitle}>{item.title}</Text>
                    <Text style={[styles.statusBadge, { color: meta.color }]}>{meta.label}</Text>
                  </View>
                  <Text style={styles.statusMeta}>Calories: {Number(item.total_calories) || 0} • {item.cooking_time || '--'} phút</Text>
                  {String(item.status).toUpperCase() === 'REJECTED' && item.reject_reason ? (
                    <Text style={styles.rejectText}>Lý do từ chối: {item.reject_reason}</Text>
                  ) : null}
                </View>
              );
            })
          )}
        </View>
      </ScrollView>

      {!isGuest ? (
        <AppBottomNav
          role="user"
          activeKey="recipes"
          user={user}
          usageCount={usageCount}
          onTabPress={(tabKey) => {
            if (tabKey === 'home') {
              onNavigateHome?.();
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
            if (tabKey === 'favorites') {
              onNavigateFavorites?.();
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
          }}
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
  heroRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  heroIcon: {
    width: 36,
    height: 36,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#fed7aa',
    backgroundColor: '#fff7ed',
    alignItems: 'center',
    justifyContent: 'center',
  },
  heroTextWrap: {
    flex: 1,
  },
  title: {
    fontSize: 18,
    fontWeight: '700',
    color: '#111827',
  },
  subTitle: {
    color: '#6b7280',
    fontSize: 13,
    marginTop: 5,
  },
  fieldTitle: {
    marginTop: 2,
    color: '#334155',
    fontSize: 13,
    fontWeight: '700',
  },
  requiredMark: {
    color: '#dc2626',
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
    marginTop: -4,
    marginBottom: 2,
    fontWeight: '600',
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
    fontSize: 13,
    fontWeight: '600',
  },
  optionChipTextActive: {
    color: '#c2410c',
  },
  textArea: {
    minHeight: 78,
    textAlignVertical: 'top',
  },
  row: {
    flexDirection: 'row',
    gap: 8,
  },
  halfInput: {
    flex: 1,
  },
  helper: {
    color: '#6b7280',
    fontSize: 12,
  },
  helperRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  imagePickerButton: {
    minHeight: 40,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#bfdbfe',
    backgroundColor: '#eff6ff',
    paddingHorizontal: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  imagePickerText: {
    color: '#1d4ed8',
    fontWeight: '700',
    fontSize: 13,
    flex: 1,
  },
  previewImage: {
    width: '100%',
    height: 170,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#e5e7eb',
    backgroundColor: '#f8fafc',
  },
  submitButton: {
    minHeight: 44,
    borderRadius: 10,
    backgroundColor: '#f97316',
    alignItems: 'center',
    justifyContent: 'center',
  },
  submitText: {
    color: '#fff',
    fontWeight: '700',
    fontSize: 15,
  },
  disabled: {
    opacity: 0.65,
  },
  emptyText: {
    color: '#6b7280',
  },
  statusItem: {
    borderWidth: 1,
    borderColor: '#e5e7eb',
    borderRadius: 10,
    padding: 10,
    gap: 4,
  },
  statusHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 8,
  },
  statusTitle: {
    flex: 1,
    fontWeight: '700',
    color: '#111827',
  },
  statusBadge: {
    fontWeight: '700',
    fontSize: 12,
  },
  statusMeta: {
    color: '#6b7280',
    fontSize: 12,
  },
  rejectText: {
    color: '#b91c1c',
    fontSize: 12,
    fontWeight: '600',
  },
});