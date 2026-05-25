import React, { useEffect, useMemo, useState } from 'react';
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
import { Audio } from 'expo-av';
import * as ImagePicker from 'expo-image-picker';
import {
  Feather,
  Ionicons,
  AntDesign,
} from '@expo/vector-icons';
import { AppBottomNav, AppHeader } from '../components/AppChrome';
import { API_BASE_URL, authRequest, request } from '../services/client';

const INPUT_METHODS = [
  {
    key: 'list',
    label: 'Chọn từ danh sách',
    icon: { family: Ionicons, name: 'nutrition-outline', color: '#ff5a00' },
  },
  {
    key: 'text',
    label: 'Nhập text',
    icon: { family: Ionicons, name: 'paper-plane-outline', color: '#2f6df6' },
  },
  {
    key: 'voice',
    label: 'Giọng nói',
    icon: { family: Feather, name: 'mic', color: '#ff2d2d' },
  },
  {
    key: 'image',
    label: 'Chụp ảnh',
    icon: { family: Feather, name: 'camera', color: '#18a957' },
  },
];

const normalizeIngredient = (value) => String(value || '').trim().replace(/\s+/g, ' ');

const parseIngredientText = (value) => {
  const seen = new Set();

  return String(value || '')
    .split(/[\n,;]+/)
    .map(normalizeIngredient)
    .filter((item) => {
      const lower = item.toLowerCase();
      if (!lower || seen.has(lower)) {
        return false;
      }
      seen.add(lower);
      return true;
    });
};

const normalizeText = (value) =>
  String(value || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

const CLASSIFIER_PREFIXES = new Set([
  'qua',
  'con',
  'trai',
  'cu',
  'cay',
  'la',
  'mieng',
  'khoanh',
  'lat',
  'hat',
]);

const stripClassifierPrefixes = (value) => {
  const tokens = normalizeText(value).split(' ').filter(Boolean);
  while (tokens.length > 1 && CLASSIFIER_PREFIXES.has(tokens[0])) {
    tokens.shift();
  }

  return tokens.join(' ');
};

const toKeywordTerms = (value) =>
  String(value || '')
    .split(/[\n,;|]+/)
    .map((part) => normalizeText(part))
    .filter(Boolean);

const parseStepList = (stepsJson) => {
  if (!Array.isArray(stepsJson)) {
    return [];
  }

  return stepsJson
    .map((step, index) => {
      if (typeof step === 'string') {
        return { step: index + 1, content: step };
      }

      return {
        step: Number(step?.step) || index + 1,
        content: String(step?.content || '').trim(),
      };
    })
    .filter((step) => step.content);
};

const parseIngredientList = (ingredientsJson) => {
  if (!Array.isArray(ingredientsJson)) {
    return [];
  }

  return ingredientsJson
    .map((item) => {
      const name = String(item?.name || '').trim();
      const qty = item?.qty;
      const unit = String(item?.unit || '').trim();

      if (!name) {
        return null;
      }

      const hasQty = qty !== undefined && qty !== null && qty !== '';
      const detail = hasQty ? `${qty}${unit ? ` ${unit}` : ''}` : unit;
      return { name, detail: String(detail || '').trim() };
    })
    .filter(Boolean);
};

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

const InputMethodCard = ({ item, active, onPress }) => {
  const IconComponent = item.icon.family;

  return (
    <Pressable
      onPress={onPress}
      style={[styles.methodCard, active && styles.methodCardActive]}
    >
      <IconComponent name={item.icon.name} size={22} color={item.icon.color} />
      <Text style={styles.methodCardText}>{item.label}</Text>
    </Pressable>
  );
};

export default function IngredientSuggestionScreenV2({
  isGuest = false,
  user,
  onLoginPress,
  onSignupPress,
  onNavigateHome,
  onGoBack,
  onNavigateMeal,
  onNavigateRecipeSubmission,
  onNavigateFavorites,
  onNavigateUpgrade,
  onRequestLogout,
}) {
  const [recording, setRecording] = useState();
  const [isRecording, setIsRecording] = useState(false);
  const [voiceUri, setVoiceUri] = useState(null);
  const [voiceSource, setVoiceSource] = useState(null);
  const [imageUri, setImageUri] = useState(null);
  const [imageSource, setImageSource] = useState(null);
  const [loading, setLoading] = useState(false);
  const [step, setStep] = useState(1);
  const [inputMethod, setInputMethod] = useState('list');
  const [selectedTags, setSelectedTags] = useState([]);
  const [textInputValue, setTextInputValue] = useState('');
  const [ingredients, setIngredients] = useState([]);
  const [suggestions, setSuggestions] = useState([]);
  const [selectedRecipe, setSelectedRecipe] = useState(null);
  const [catalogLoading, setCatalogLoading] = useState(true);
  const [ingredientCatalog, setIngredientCatalog] = useState([]);
  const [detectFeedback, setDetectFeedback] = useState('');
  const [menuOpen, setMenuOpen] = useState(false);
  const [selectedRecipeFavorite, setSelectedRecipeFavorite] = useState(false);
  const [favoritePending, setFavoritePending] = useState(false);

  const displayName = useMemo(() => user?.fullName || user?.name || 'Người dùng', [user]);
  const displayEmail = useMemo(() => user?.email || 'user@nutrichef.app', [user]);

  const ingredientOptions = useMemo(() => {
    const prioritized = [...ingredientCatalog].sort((left, right) => {
      const leftPopular = left.is_common ? 1 : 0;
      const rightPopular = right.is_common ? 1 : 0;
      if (rightPopular !== leftPopular) {
        return rightPopular - leftPopular;
      }

      return String(left.name || '').localeCompare(String(right.name || ''));
    });

    return prioritized.slice(0, 30).map((item) => item.name);
  }, [ingredientCatalog]);

  useEffect(() => {
    let cancelled = false;

    const loadIngredientCatalog = async () => {
      try {
        setCatalogLoading(true);
        const data = await request('/api/ingredients', { method: 'GET' });
        if (cancelled) {
          return;
        }

        setIngredientCatalog(Array.isArray(data?.ingredients) ? data.ingredients : []);
      } catch (error) {
        if (!cancelled) {
          Alert.alert('Lỗi tải dữ liệu', error.message || 'Không tải được danh sách nguyên liệu.');
        }
      } finally {
        if (!cancelled) {
          setCatalogLoading(false);
        }
      }
    };

    loadIngredientCatalog();

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    let cancelled = false;

    const loadFavoriteStatus = async () => {
      if (isGuest || !selectedRecipe?.recipe_id) {
        setSelectedRecipeFavorite(false);
        return;
      }

      try {
        const response = await authRequest(`/api/recipes/${selectedRecipe.recipe_id}/favorite-status`);
        if (!cancelled) {
          setSelectedRecipeFavorite(Boolean(response?.isFavorite));
        }
      } catch {
        if (!cancelled) {
          setSelectedRecipeFavorite(false);
        }
      }
    };

    loadFavoriteStatus();

    return () => {
      cancelled = true;
    };
  }, [isGuest, selectedRecipe?.recipe_id]);

  const handleToggleRecipeFavorite = async () => {
    if (!selectedRecipe?.recipe_id) {
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
      setFavoritePending(true);
      const response = await authRequest(`/api/recipes/${selectedRecipe.recipe_id}/favorite`, {
        method: selectedRecipeFavorite ? 'DELETE' : 'POST',
      });
      setSelectedRecipeFavorite(Boolean(response?.isFavorite));
      Alert.alert('Yêu thích', response?.isFavorite ? 'Đã thêm công thức vào mục yêu thích.' : 'Đã bỏ công thức khỏi mục yêu thích.');
    } catch (error) {
      Alert.alert('Lỗi yêu thích', error.message || 'Không thể cập nhật yêu thích.');
    } finally {
      setFavoritePending(false);
    }
  };

  const updateDetectedIngredients = (items) => {
    const cleaned = parseIngredientText((items || []).join(','));
    setIngredients(cleaned);
    setSuggestions([]);
    setSelectedRecipe(null);
    setDetectFeedback('');
    setStep(2);
  };

  const buildFilePayload = async (source, type) => {
    const fallbackName = type === 'voice' ? 'recording.wav' : 'photo.jpg';
    const fallbackType = type === 'voice' ? 'audio/wav' : 'image/jpeg';

    if (Platform.OS === 'web') {
      if (source?.file) {
        return {
          file: source.file,
          name: source.name || source.file.name || fallbackName,
        };
      }

      if (source?.uri) {
        const blobResponse = await fetch(source.uri);
        const blob = await blobResponse.blob();
        const fileType = source.type || blob.type || fallbackType;
        const fileName = source.name || fallbackName;
        const webFile = new File([blob], fileName, { type: fileType });
        return {
          file: webFile,
          name: fileName,
        };
      }

      return null;
    }

    if (!source?.uri) {
      return null;
    }

    return {
      uri: Platform.OS === 'android' ? source.uri : source.uri.replace('file://', ''),
      name: source.name || fallbackName,
      type: source.type || fallbackType,
    };
  };

  const uploadFileToServer = async (source, type) => {
    if (!source?.uri && !source?.file) {
      Alert.alert('Lỗi', 'Không có file để upload.');
      return;
    }

    setLoading(true);
    setSuggestions([]);
    setSelectedRecipe(null);
    setDetectFeedback('');

    const apiUrl = `${API_BASE_URL}/api/ai/detect-ingredients?type=${type}`;

    try {
      const formData = new FormData();
      const filePayload = await buildFilePayload(source, type);
      if (!filePayload) {
        throw new Error('Không tạo được dữ liệu file để upload.');
      }

      if (Platform.OS === 'web') {
        formData.append('file', filePayload.file, filePayload.name);
      } else {
        formData.append('file', filePayload);
      }

      const response = await fetch(apiUrl, {
        method: 'POST',
        body: formData,
        headers: {
          Accept: 'application/json',
        },
      });

      const data = await response.json();

      // Lấy tên từ AI trả về trực tiếp (Cấu trúc mới của AI Service)
      const namesFromAi = Array.isArray(data?.detected_ingredients)
        ? data.detected_ingredients.map((item) => String(item || '').trim()).filter(Boolean)
        : [];
      
      const names = namesFromAi;

      if (response.ok && names.length > 0) {
        updateDetectedIngredients(names);
        return;
      }

      if (response.ok) {
        setIngredients([]);
        setDetectFeedback('AI không nhận diện được nguyên liệu nào trong ảnh. Hãy thử chụp rõ hơn hoặc dùng món AI biết (Táo, Cam, Cà rốt...).');
        return;
      }

      Alert.alert('Lỗi Server', data?.error || data?.message || 'Có lỗi xảy ra.');
    } catch (error) {
      console.log('Upload error:', error);
      setDetectFeedback('Không kết nối được AI Service. Hãy kiểm tra Backend.');
    } finally {
      setLoading(false);
    }
  };

  async function startRecording() {
    try {
      const permission = await Audio.requestPermissionsAsync();
      if (permission.status !== 'granted') {
        Alert.alert('Thiếu quyền', 'Vui lòng cấp quyền ghi âm.');
        return;
      }

      await Audio.setAudioModeAsync({
        allowsRecordingIOS: true,
        playsInSilentModeIOS: true,
      });

      const recordingOptions = {
        android: {
          extension: '.m4a',
          outputFormat: Audio.AndroidOutputFormat.MPEG_4,
          audioEncoder: Audio.AndroidAudioEncoder.AAC,
          sampleRate: 44100,
          numberOfChannels: 1,
          bitRate: 128000,
        },
        ios: {
          extension: '.wav',
          audioQuality: Audio.IOSAudioQuality.HIGH,
          sampleRate: 44100,
          numberOfChannels: 1,
          bitRate: 128000,
          linearPCMBitDepth: 16,
          linearPCMIsBigEndian: false,
          linearPCMIsFloat: false,
        },
      };

      const { recording: newRecording } = await Audio.Recording.createAsync(recordingOptions);
      setRecording(newRecording);
      setVoiceUri(null);
      setVoiceSource(null);
      setIsRecording(true);
    } catch (error) {
      console.log('Start recording error:', error);
      Alert.alert('Lỗi', 'Không thể bắt đầu ghi âm.');
    }
  }

  async function stopRecording() {
    if (!recording) {
      return;
    }

    setIsRecording(false);
    try {
      await recording.stopAndUnloadAsync();
      const uri = recording.getURI();
      setRecording(undefined);
      const normalizedUri = uri || null;
      setVoiceUri(normalizedUri);
      
      const extension = Platform.OS === 'android' ? 'm4a' : 'wav';
      const type = Platform.OS === 'android' ? 'audio/m4a' : 'audio/wav';

      const nextVoiceSource = normalizedUri
        ? {
            uri: normalizedUri,
            name: `recording.${extension}`,
            type: type,
          }
        : null;

      setVoiceSource(nextVoiceSource);

      if (nextVoiceSource) {
        uploadFileToServer(nextVoiceSource, 'voice');
      }
    } catch (error) {
      console.log('Stop recording error:', error);
      Alert.alert('Lỗi', 'Không thể dừng ghi âm.');
    }
  }

  const handleImagePicked = async (result) => {
    if (!result.canceled) {
      const asset = result.assets[0] || {};
      const uri = asset.uri;
      const nextImageSource = {
        uri,
        file: asset.file || null,
        name: asset.fileName || 'photo.jpg',
        type: asset.mimeType || 'image/jpeg',
      };

      setImageUri(uri);
      setImageSource(nextImageSource);
      uploadFileToServer(nextImageSource, 'image');
    }
  };

  const pickImageFromGallery = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Cần quyền', 'Cần quyền truy cập ảnh.');
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [4, 3],
      quality: 0.7,
    });

    handleImagePicked(result);
  };

  const takePhotoWithCamera = async () => {
    const { status } = await ImagePicker.requestCameraPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Cần quyền', 'Cần quyền Camera.');
      return;
    }

    const result = await ImagePicker.launchCameraAsync({
      allowsEditing: true,
      aspect: [4, 3],
      quality: 0.7,
    });

    handleImagePicked(result);
  };

  const toggleIngredientTag = (item) => {
    setSelectedTags((current) =>
      current.includes(item)
        ? current.filter((entry) => entry !== item)
        : [...current, item]
    );
  };

  const handleContinueFromStepOne = () => {
    if (inputMethod === 'list') {
      if (selectedTags.length === 0) {
        Alert.alert('Thiếu dữ liệu', 'Hãy chọn ít nhất một nguyên liệu.');
        return;
      }

      setIngredients(selectedTags);
      setSuggestions([]);
      setSelectedRecipe(null);
      setStep(2);
      return;
    }

    if (inputMethod === 'text') {
      const parsed = parseIngredientText(textInputValue);
      if (parsed.length === 0) {
        Alert.alert('Thiếu dữ liệu', 'Hãy nhập ít nhất một nguyên liệu.');
        return;
      }

      setIngredients(parsed);
      setSuggestions([]);
      setSelectedRecipe(null);
      setStep(2);
      return;
    }

    Alert.alert('Chọn phương thức', 'Hãy dùng giọng nói hoặc ảnh để AI nhận diện nguyên liệu.');
  };

  const updateIngredientAt = (index, value) => {
    setIngredients((current) =>
      current.map((item, itemIndex) => (itemIndex === index ? value : item))
    );
  };

  const removeIngredientAt = (index) => {
    setIngredients((current) => current.filter((_, itemIndex) => itemIndex !== index));
  };

  const addIngredient = () => {
    setIngredients((current) => [...current, '']);
  };

  const mapNamesToIngredientIds = (names) => {
    const MIN_FUZZY_TERM_LENGTH = 3;
    const tokenize = (value) =>
      String(value || '')
        .split(' ')
        .map((token) => token.trim())
        .filter((token) => token.length >= MIN_FUZZY_TERM_LENGTH);

    const catalog = ingredientCatalog.map((item) => ({
      ...item,
      normalized: normalizeText(item.name),
      simplified: stripClassifierPrefixes(item.name),
      searchTerms: [
        normalizeText(item.name),
        stripClassifierPrefixes(item.name),
        ...toKeywordTerms(item.keywords),
        ...toKeywordTerms(item.keywords).map((term) => stripClassifierPrefixes(term)),
      ].filter(Boolean),
    }));

    const ids = new Set();
    names.forEach((name) => {
      const normalizedInput = normalizeText(name);
      const simplifiedInput = stripClassifierPrefixes(name);
      if (!normalizedInput) {
        return;
      }

      const inputTokens = tokenize(simplifiedInput || normalizedInput);

      const matchedItems = catalog.filter((item) => {
        const hasDirectMatch = item.searchTerms.some(
          (term) =>
            term === normalizedInput ||
            term === simplifiedInput ||
            (normalizedInput.length >= MIN_FUZZY_TERM_LENGTH && term.includes(normalizedInput)) ||
            (simplifiedInput.length >= MIN_FUZZY_TERM_LENGTH && term.includes(simplifiedInput))
        );

        if (hasDirectMatch) {
          return true;
        }

        if (inputTokens.length === 0) {
          return false;
        }

        return item.searchTerms.some((term) => {
          const termTokens = tokenize(term);
          if (termTokens.length === 0) {
            return false;
          }

          return inputTokens.every((token) =>
            termTokens.some((part) => part === token || part.startsWith(token) || token.startsWith(part))
          );
        });
      });

      matchedItems.forEach((item) => {
        ids.add(Number(item.ingredient_id));
      });
    });

    return [...ids].filter((id) => Number.isInteger(id) && id > 0);
  };

  const handleFindDishes = async () => {
    const cleaned = ingredients.map(normalizeIngredient).filter(Boolean);
    if (cleaned.length === 0) {
      Alert.alert('Thiếu dữ liệu', 'Danh sách nguyên liệu đang trống.');
      return;
    }

    const ingredientIds = mapNamesToIngredientIds(cleaned);
    if (ingredientIds.length === 0) {
      Alert.alert('Không tìm thấy', 'Không map được nguyên liệu với dữ liệu hệ thống.');
      return;
    }

    try {
      setLoading(true);
      setIngredients(cleaned);

      const data = await request('/api/recipes/recommend', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ ingredient_ids: ingredientIds }),
      });

      const recipes = Array.isArray(data?.recipes) ? data.recipes : [];
      setSuggestions(recipes);
      setSelectedRecipe(recipes[0] || null);
      setStep(3);
    } catch (error) {
      Alert.alert('Lỗi gợi ý', error.message || 'Không lấy được danh sách món ăn.');
    } finally {
      setLoading(false);
    }
  };
  const handleBottomTabPress = (tabKey) => {
    if (tabKey === 'home') {
      onNavigateHome?.();
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

    if (tabKey === 'favorites') {
      onNavigateFavorites?.();
      return;
    }

    if (tabKey === 'upgrade') {
      onNavigateUpgrade?.();
      return;
    }

    if (tabKey !== 'suggest') {
      Alert.alert('Thông báo', `Tab ${tabKey} chưa được nối màn.`);
    }
  };

  const handleAccountPress = () => {
    setMenuOpen((current) => !current);
  };

  const renderStepOneContent = () => (
    <View style={styles.card}>
      <Text style={styles.cardTitle}>Chọn cách nhập nguyên liệu</Text>
      <View style={styles.methodGrid}>
        {INPUT_METHODS.map((item) => (
          <InputMethodCard
            key={item.key}
            item={item}
            active={inputMethod === item.key}
            onPress={() => setInputMethod(item.key)}
          />
        ))}
      </View>

      {inputMethod === 'list' ? (
        <>
          <Text style={styles.fieldLabel}>Chọn nguyên liệu có sẵn:</Text>
          {catalogLoading ? (
            <View style={styles.loadingState}>
              <ActivityIndicator size="small" color="#ff5a00" />
              <Text style={styles.loadingText}>Đang tải nguyên liệu từ hệ thống...</Text>
            </View>
          ) : (
            <View style={styles.tagsScrollWrapper}>
              <ScrollView
                nestedScrollEnabled
                style={styles.tagsScroll}
                contentContainerStyle={styles.tagsContainer}
                showsVerticalScrollIndicator={false}
              >
                {ingredientOptions.map((item) => {
                  const active = selectedTags.includes(item);
                  return (
                    <Pressable
                      key={item}
                      onPress={() => toggleIngredientTag(item)}
                      style={[styles.tag, active && styles.tagActive]}
                    >
                      <Text style={[styles.tagText, active && styles.tagTextActive]}>{item}</Text>
                    </Pressable>
                  );
                })}
              </ScrollView>
            </View>
          )}
        </>
      ) : null}

      {inputMethod === 'text' ? (
        <>
          <Text style={styles.fieldLabel}>Nhập nguyên liệu, ngăn cách bằng dấu phẩy hoặc xuống dòng:</Text>
          <TextInput
            value={textInputValue}
            onChangeText={setTextInputValue}
            placeholder="Ví dụ: trứng, hành, cà chua"
            placeholderTextColor="#9aa4b2"
            multiline
            textAlignVertical="top"
            style={styles.textArea}
          />
        </>
      ) : null}

      {inputMethod === 'voice' ? (
        <View style={styles.actionPanel}>
          <Text style={styles.panelDescription}>Nhấn để ghi âm tên nguyên liệu, sau đó AI sẽ tự nhận diện.</Text>
          <Pressable
            onPress={isRecording ? stopRecording : startRecording}
            style={[styles.primaryButton, isRecording && styles.recordingButton]}
          >
            <Feather name={isRecording ? 'square' : 'mic'} size={18} color="#fff" />
            <Text style={styles.primaryButtonText}>
              {isRecording ? 'Dừng và gửi' : 'Bắt đầu ghi âm'}
            </Text>
          </Pressable>
          {!isRecording ? <Text style={styles.voiceHintText}>Lần đầu bấm "Bắt đầu ghi âm" hệ thống sẽ yêu cầu quyền microphone.</Text> : null}
          {detectFeedback ? <Text style={styles.detectFeedbackText}>{detectFeedback}</Text> : null}
        </View>
      ) : null}

      {inputMethod === 'image' ? (
        <View style={styles.actionPanel}>
          <Text style={styles.panelDescription}>Chụp ảnh hoặc chọn từ thư viện, AI sẽ tự nhận diện ngay sau khi bạn chọn ảnh.</Text>
          <View style={styles.imageQuickActions}>
            <Pressable onPress={takePhotoWithCamera} style={styles.imageQuickActionCard}>
              <View style={styles.imageQuickActionIcon}>
                <Feather name="camera" size={22} color="#ffffff" />
              </View>
              <Text style={styles.imageQuickActionTitle}>Chụp ảnh</Text>
            </Pressable>
            <Pressable onPress={pickImageFromGallery} style={styles.imageQuickActionCard}>
              <View style={[styles.imageQuickActionIcon, styles.imageQuickActionIconAlt]}>
                <Feather name="image" size={22} color="#ffffff" />
              </View>
              <Text style={styles.imageQuickActionTitle}>Thư viện</Text>
            </Pressable>
          </View>
          {detectFeedback ? <Text style={styles.detectFeedbackText}>{detectFeedback}</Text> : null}
          {imageUri ? <Image source={{ uri: imageUri }} style={styles.previewImage} /> : null}
        </View>
      ) : null}

      {loading ? (
        <View style={styles.loadingState}>
          <ActivityIndicator size="small" color="#ff5a00" />
          <Text style={styles.loadingText}>Đang xử lý...</Text>
        </View>
      ) : null}

      {(inputMethod === 'list' || inputMethod === 'text') ? (
        <Pressable onPress={handleContinueFromStepOne} style={styles.primaryButton}>
          <Text style={styles.primaryButtonText}>Tiếp tục</Text>
        </Pressable>
      ) : null}
    </View>
  );

  const renderStepTwoContent = () => (
    <View style={styles.card}>
      <Text style={styles.cardTitle}>Kiểm tra và chỉnh sửa nguyên liệu</Text>
      <Text style={styles.descriptionText}>
        Hệ thống đã nhận diện được {ingredients.filter((item) => normalizeIngredient(item)).length} nguyên liệu. Vui lòng kiểm tra và điều chỉnh.
      </Text>

      <View style={styles.editorList}>
        {ingredients.map((item, index) => (
          <View key={`ingredient-row-${index}`} style={styles.editorRow}>
            <View style={styles.editorIconBox}>
              <Ionicons name="nutrition-outline" size={18} color="#ff5a00" />
            </View>
            <TextInput
              value={item}
              onChangeText={(value) => updateIngredientAt(index, value)}
              placeholder="Tên nguyên liệu"
              placeholderTextColor="#98a2b3"
              style={styles.editorInput}
            />
            <Pressable onPress={() => removeIngredientAt(index)} style={styles.deleteButton}>
              <AntDesign name="delete" size={18} color="#ff3b30" />
            </Pressable>
          </View>
        ))}
      </View>

      <Pressable onPress={addIngredient} style={styles.addMoreButton}>
        <AntDesign name="plus" size={18} color="#ff5a00" />
        <Text style={styles.addMoreText}>Thêm nguyên liệu khác</Text>
      </Pressable>

      <View style={styles.footerActions}>
        <Pressable onPress={() => setStep(1)} style={styles.outlineButton}>
          <Text style={styles.outlineButtonText}>Quay lại</Text>
        </Pressable>
        <Pressable onPress={handleFindDishes} style={[styles.primaryButton, styles.flexButton]}>
          <Text style={styles.primaryButtonText}>Tìm món ăn</Text>
        </Pressable>
      </View>
    </View>
  );

  const renderRecipeDetail = () => {
    if (!selectedRecipe) {
      return (
        <View style={styles.emptySuggestionLarge}>
          <Ionicons name="search-outline" size={48} color="#94a3b8" />
          <Text style={styles.emptySuggestionTextLarge}>
            Đang không có món ăn được làm từ nguyên liệu này.
          </Text>
        </View>
      );
    }

    const recipeIngredients = parseIngredientList(selectedRecipe.ingredients_json);
    const recipeSteps = parseStepList(selectedRecipe.steps_json);

    return (
      <View style={styles.recipeDetailCard}>
        <View style={styles.recipeHeroWrap}>
          <Image source={{ uri: resolveRecipeImage(selectedRecipe.image_url) }} style={styles.recipeHeroImage} />
          <View style={styles.recipeImageActions}>
            <Pressable
              onPress={handleToggleRecipeFavorite}
              style={styles.recipeImageActionButton}
              disabled={favoritePending}
              hitSlop={8}
            >
              <Feather name="heart" size={18} color={selectedRecipeFavorite ? '#ef4444' : '#344054'} />
            </Pressable>
            <Pressable
              onPress={() => Alert.alert('Chia sẻ', `Copy link chia sẻ cho "${selectedRecipe.title}" (demo UI).`)}
              style={styles.recipeImageActionButton}
              hitSlop={8}
            >
              <Feather name="share-2" size={18} color="#344054" />
            </Pressable>
          </View>
        </View>
        <Text style={styles.recipeDetailTitle}>{selectedRecipe.title}</Text>

        <View style={styles.recipeMetaRow}>
          <Text style={styles.recipeMetaItem}>Thời gian: {selectedRecipe.cooking_time || '--'} phút</Text>
          <Text style={styles.recipeMetaItem}>Độ khó: {selectedRecipe.difficulty || '--'}</Text>
          <Text style={styles.recipeMetaItem}>Calories: {selectedRecipe.total_calories || 0} kcal</Text>
        </View>

        <Text style={styles.sectionTitle}>Nguyên liệu cần thiết:</Text>
        <View style={styles.bulletList}>
          {recipeIngredients.map((item) => (
            <Text key={`${item.name}-${item.detail}`} style={styles.bulletText}>
              - {item.name}{item.detail ? ` (${item.detail})` : ''}
            </Text>
          ))}
        </View>

        <Text style={styles.sectionTitle}>Cách làm:</Text>
        <View style={styles.stepsList}>
          {recipeSteps.map((step) => (
            <View key={`${step.step}-${step.content}`} style={styles.stepRow}>
              <View style={styles.stepIndexBubble}>
                <Text style={styles.stepIndexText}>{step.step}</Text>
              </View>
              <Text style={styles.stepContent}>{step.content}</Text>
            </View>
          ))}
        </View>
      </View>
    );
  };

  const renderStepThreeContent = () => (
    <View style={styles.card}>
      <Text style={styles.cardTitle}>Kết quả gợi ý món ăn</Text>
      <Text style={styles.descriptionText}>Toàn bộ dữ liệu được lấy trực tiếp từ cơ sở dữ liệu.</Text>

      <View style={styles.summaryBox}>
        <Text style={styles.summaryLabel}>Nguyên liệu đã chọn</Text>
        <View style={styles.summaryTags}>
          {ingredients.map((item) => (
            <View key={item} style={styles.summaryTag}>
              <Text style={styles.summaryTagText}>{item}</Text>
            </View>
          ))}
        </View>
      </View>

      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.recipeTabs} contentContainerStyle={styles.recipeTabsContent}>
        {suggestions.map((dish) => {
          const active = dish.recipe_id === selectedRecipe?.recipe_id;
          return (
            <Pressable key={dish.recipe_id} style={[styles.recipeTab, active && styles.recipeTabActive]} onPress={() => setSelectedRecipe(dish)}>
              <Text style={[styles.recipeTabText, active && styles.recipeTabTextActive]}>{dish.title}</Text>
            </Pressable>
          );
        })}
      </ScrollView>

      {renderRecipeDetail()}

      <View style={styles.footerActions}>
        <Pressable onPress={() => setStep(1)} style={[styles.primaryButton, styles.flexButton]}>
          <Text style={styles.primaryButtonText}>Nhận gợi ý khác</Text>
        </Pressable>
        <Pressable
          onPress={() => onNavigateHome?.()}
          style={styles.outlineButton}
        >
          <Text style={styles.outlineButtonText}>Trang chủ</Text>
        </Pressable>
      </View>
    </View>
  );

  return (
    <SafeAreaView style={styles.screen} edges={['top', 'bottom']}>
      <AppHeader
        onLoginPress={onLoginPress}
        onSignupPress={onSignupPress}
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
        {step === 1 ? renderStepOneContent() : null}
        {step === 2 ? renderStepTwoContent() : null}
        {step === 3 ? renderStepThreeContent() : null}
      </ScrollView>

      {!isGuest ? (
        <AppBottomNav
          activeKey="suggest"
          onTabPress={handleBottomTabPress}
        />
      ) : null}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: '#f3f4f6',
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
  container: {
    flexGrow: 1,
    paddingHorizontal: 14,
    paddingTop: 12,
    paddingBottom: 28,
    backgroundColor: '#f3f4f6',
    alignItems: 'center',
  },
  card: {
    width: '100%',
    maxWidth: 860,
    backgroundColor: '#ffffff',
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: '#e5e7eb',
  },
  cardTitle: {
    fontSize: 22,
    fontWeight: '700',
    color: '#101828',
    marginBottom: 14,
  },
  fieldLabel: {
    fontSize: 15,
    color: '#344054',
    marginBottom: 12,
    marginTop: 6,
  },
  methodGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    rowGap: 10,
    marginBottom: 16,
  },
  methodCard: {
    width: '48.5%',
    height: 82,
    borderRadius: 14,
    borderWidth: 1.5,
    borderColor: '#d0d5dd',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#ffffff',
    gap: 8,
  },
  methodCardActive: {
    borderColor: '#ff5a00',
    backgroundColor: '#fff6f0',
  },
  methodCardText: {
    fontSize: 14,
    color: '#101828',
    textAlign: 'center',
    fontWeight: '500',
  },
  tagsContainer: {
    padding: 12,
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  tagsScrollWrapper: {
    width: '100%',
    maxHeight: 250,
    backgroundColor: '#f3f4f6',
    borderRadius: 14,
    overflow: 'hidden',
  },
  tagsScroll: {
    width: '100%',
  },
  tag: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderWidth: 1,
    borderColor: '#c7ced6',
    borderRadius: 999,
    backgroundColor: '#fff',
  },
  tagActive: {
    borderColor: '#ff5a00',
    backgroundColor: '#fff0e8',
  },
  tagText: {
    color: '#344054',
    fontSize: 14,
  },
  tagTextActive: {
    color: '#ff5a00',
    fontWeight: '600',
  },
  textArea: {
    minHeight: 120,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#d0d5dd',
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 15,
    color: '#101828',
    backgroundColor: '#f9fafb',
  },
  actionPanel: {
    borderRadius: 14,
    padding: 14,
    backgroundColor: '#f9fafb',
    borderWidth: 1,
    borderColor: '#eaecf0',
  },
  panelDescription: {
    color: '#475467',
    fontSize: 14,
    lineHeight: 20,
    marginBottom: 10,
  },
  imageQuickActions: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 10,
  },
  imageQuickActionCard: {
    width: '48.5%',
    minHeight: 112,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#e4e7ec',
    backgroundColor: '#ffffff',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    paddingVertical: 12,
    paddingHorizontal: 10,
  },
  imageQuickActionIcon: {
    width: 52,
    height: 52,
    borderRadius: 26,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#22c55e',
    shadowColor: '#16a34a',
    shadowOpacity: 0.2,
    shadowOffset: { width: 0, height: 6 },
    shadowRadius: 8,
    elevation: 4,
  },
  imageQuickActionIconAlt: {
    backgroundColor: '#0ea5e9',
    shadowColor: '#0284c7',
  },
  voiceHintText: {
    marginTop: 10,
    color: '#475467',
    fontSize: 13,
    lineHeight: 18,
  },
  detectFeedbackText: {
    marginTop: 10,
    color: '#b42318',
    fontSize: 13,
    lineHeight: 18,
    fontWeight: '500',
  },
  imageQuickActionTitle: {
    color: '#344054',
    fontWeight: '700',
    fontSize: 14,
  },
  previewImage: {
    width: '100%',
    height: 190,
    borderRadius: 14,
    marginTop: 12,
  },
  loadingState: {
    marginTop: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  loadingText: {
    fontSize: 14,
    color: '#475467',
  },
  primaryButton: {
    marginTop: 16,
    minHeight: 48,
    borderRadius: 12,
    backgroundColor: '#ff5a00',
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: 8,
    paddingHorizontal: 16,
  },
  recordingButton: {
    backgroundColor: '#dc2626',
  },
  primaryButtonText: {
    color: '#ffffff',
    fontSize: 15,
    fontWeight: '700',
  },
  descriptionText: {
    fontSize: 14,
    lineHeight: 22,
    color: '#475467',
    marginBottom: 14,
  },
  editorList: {
    gap: 10,
  },
  editorRow: {
    backgroundColor: '#f8fafc',
    borderRadius: 12,
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderWidth: 1,
    borderColor: '#eef2f6',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  editorIconBox: {
    width: 26,
    alignItems: 'center',
    justifyContent: 'center',
  },
  editorInput: {
    flex: 1,
    height: 42,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#d0d5dd',
    paddingHorizontal: 10,
    fontSize: 15,
    color: '#101828',
    backgroundColor: '#ffffff',
  },
  deleteButton: {
    width: 32,
    height: 32,
    alignItems: 'center',
    justifyContent: 'center',
  },
  addMoreButton: {
    marginTop: 14,
    alignSelf: 'flex-start',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  addMoreText: {
    color: '#ff5a00',
    fontSize: 15,
    fontWeight: '600',
  },
  footerActions: {
    marginTop: 18,
    flexDirection: 'row',
    gap: 10,
    flexWrap: 'wrap',
  },
  outlineButton: {
    flex: 1,
    minWidth: 150,
    minHeight: 48,
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: '#c7ced6',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 14,
    backgroundColor: '#fff',
  },
  outlineButtonText: {
    color: '#344054',
    fontSize: 15,
    fontWeight: '600',
  },
  flexButton: {
    flex: 1,
    marginTop: 0,
  },
  summaryBox: {
    backgroundColor: '#f9fafb',
    borderRadius: 14,
    padding: 12,
    borderWidth: 1,
    borderColor: '#eaecf0',
  },
  summaryLabel: {
    fontSize: 14,
    color: '#475467',
    marginBottom: 8,
    fontWeight: '600',
  },
  summaryTags: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  summaryTag: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
    backgroundColor: '#fff0e8',
  },
  summaryTagText: {
    color: '#ff5a00',
    fontWeight: '600',
    fontSize: 13,
  },
  recipeTabs: {
    marginTop: 14,
  },
  recipeTabsContent: {
    gap: 8,
  },
  recipeTab: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 999,
    backgroundColor: '#f3f4f6',
  },
  recipeTabActive: {
    backgroundColor: '#ff5a00',
  },
  recipeTabText: {
    fontSize: 13,
    color: '#344054',
    fontWeight: '600',
  },
  recipeTabTextActive: {
    color: '#fff',
  },
  recipeDetailCard: {
    marginTop: 14,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#e5e7eb',
    padding: 12,
    backgroundColor: '#fff',
  },
  recipeHeroWrap: {
    position: 'relative',
    marginBottom: 12,
  },
  recipeHeroImage: {
    width: '100%',
    height: 180,
    borderRadius: 12,
  },
  recipeImageActions: {
    position: 'absolute',
    top: 10,
    right: 10,
    flexDirection: 'row',
    gap: 8,
  },
  recipeImageActionButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: '#e4e7ec',
    alignItems: 'center',
    justifyContent: 'center',
  },
  recipeDetailTitle: {
    fontSize: 26,
    fontWeight: '700',
    color: '#111827',
  },
  recipeMetaRow: {
    marginTop: 8,
    gap: 6,
  },
  recipeMetaItem: {
    fontSize: 14,
    color: '#475467',
    fontWeight: '600',
  },
  sectionTitle: {
    marginTop: 14,
    marginBottom: 8,
    fontSize: 18,
    fontWeight: '700',
    color: '#101828',
  },
  bulletList: {
    gap: 6,
  },
  bulletText: {
    fontSize: 15,
    color: '#374151',
    lineHeight: 22,
  },
  stepsList: {
    gap: 10,
  },
  stepRow: {
    flexDirection: 'row',
    gap: 10,
    alignItems: 'flex-start',
  },
  stepIndexBubble: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: '#ff5a00',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 2,
  },
  stepIndexText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '700',
  },
  stepContent: {
    flex: 1,
    fontSize: 15,
    color: '#374151',
    lineHeight: 22,
  },
  emptySuggestion: {
    marginTop: 12,
    borderRadius: 12,
    backgroundColor: '#f9fafb',
    borderWidth: 1,
    borderColor: '#eaecf0',
    padding: 12,
  },
  emptySuggestionText: {
    color: '#64748b',
    fontSize: 14,
  },
  emptySuggestionLarge: {
    marginTop: 20,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 40,
    backgroundColor: '#f8fafc',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    borderStyle: 'dashed',
  },
  emptySuggestionTextLarge: {
    marginTop: 16,
    fontSize: 16,
    color: '#64748b',
    textAlign: 'center',
    paddingHorizontal: 20,
    lineHeight: 24,
  },
  retryButton: {
    marginTop: 24,
    backgroundColor: '#ff5a00',
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 99,
    shadowColor: '#ff5a00',
    shadowOpacity: 0.2,
    shadowOffset: { width: 0, height: 4 },
    shadowRadius: 8,
    elevation: 3,
  },
  retryButtonText: {
    color: '#ffffff',
    fontSize: 15,
    fontWeight: '700',
  },
});
