import React, { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Alert, StyleSheet, View } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as WebBrowser from 'expo-web-browser';
import HomeScreen from './src/screens/HomeScreen';
import IngredientSuggestionScreen from './src/screens/IngredientSuggestionScreen';
import UserMealSetScreen from './src/screens/UserMealSetScreen';
import UserFavoritesScreen from './src/screens/UserFavoritesScreen';
import ShoppingListScreen from './src/screens/ShoppingListScreen';
import AdminDashboardScreen from './src/screens/AdminDashboardScreen';
import AdminIngredientsScreen from './src/screens/AdminIngredientsScreen';
import AdminRecipeReviewScreen from './src/screens/AdminRecipeReviewScreen';
import AdminUsersScreen from './src/screens/AdminUsersScreen';
import AdminTransactionsScreen from './src/screens/AdminTransactionsScreen';
import RecipeSubmissionScreen from './src/screens/RecipeSubmissionScreen';
import RecipeDetailScreen from './src/screens/RecipeDetailScreen';
import UserUpgradeScreen from './src/screens/UserUpgradeScreen';
import LoginScreen from './src/screens/LoginScreen';
import RegisterScreen from './src/screens/RegisterScreen';
import { bootstrapAuthSession, logout } from './src/services/authApi';

WebBrowser.maybeCompleteAuthSession();

export default function App() {
  const [activeScreen, setActiveScreen] = useState('home');
  const [screenHistory, setScreenHistory] = useState([]);
  const [selectedRecipeId, setSelectedRecipeId] = useState(null);
  const [currentUser, setCurrentUser] = useState(null);
  const [bootstrapping, setBootstrapping] = useState(true);
  const [usageCount, setUsageCount] = useState(0);

  const MAX_FREE_USAGE = 3;
  const isPremium = currentUser?.premium && (!currentUser.premium.expiryDate || new Date(currentUser.premium.expiryDate) > new Date());
  const isLimitReached = !isPremium && usageCount >= MAX_FREE_USAGE;

  const getTodayKey = () => {
    const now = new Date();
    return `usage_${now.getFullYear()}-${now.getMonth() + 1}-${now.getDate()}`;
  };

  const loadUsage = useCallback(async () => {
    try {
      const key = getTodayKey();
      const saved = await AsyncStorage.getItem(key);
      if (saved) {
        setUsageCount(parseInt(saved, 10) || 0);
      } else {
        setUsageCount(0);
      }
    } catch (e) {
      console.error('Failed to load usage count', e);
    }
  }, []);

  const incrementUsage = async () => {
    if (isPremium) return;
    try {
      const key = getTodayKey();
      const nextCount = usageCount + 1;
      await AsyncStorage.setItem(key, String(nextCount));
      setUsageCount(nextCount);
    } catch (e) {
      console.error('Failed to save usage count', e);
    }
  };

  useEffect(() => {
    loadUsage();
  }, [loadUsage]);

  const handleSuggestTabPress = () => {
    if (isLimitReached) {
      Alert.alert(
        'Giới hạn lượt dùng',
        'Bạn cần nâng cấp để mở khóa tính năng này (Bạn đã dùng hết 3 lượt miễn phí hôm nay).',
        [
          { text: 'Để sau', style: 'cancel' },
          { text: 'Nâng cấp ngay', onPress: () => navigateTo('upgrade') },
        ]
      );
      return;
    }
    navigateTo('suggest');
  };

  const handleMealTabPress = () => {
    if (!isPremium) {
      Alert.alert(
        'Tính năng Premium',
        'Tính năng Mâm cơm chỉ dành cho thành viên Premium. Hãy nâng cấp để trải nghiệm trọn vẹn!',
        [
          { text: 'Để sau', style: 'cancel' },
          { text: 'Nâng cấp ngay', onPress: () => navigateTo('upgrade') },
        ]
      );
      return;
    }
    navigateTo('meal');
  };

  const handleRecipeSubmitTabPress = () => {
    if (!isPremium) {
      Alert.alert(
        'Tính năng Premium',
        'Tính năng Đóng góp công thức chỉ dành cho thành viên Premium. Hãy nâng cấp để đóng góp nội dung!',
        [
          { text: 'Để sau', style: 'cancel' },
          { text: 'Nâng cấp ngay', onPress: () => navigateTo('upgrade') },
        ]
      );
      return;
    }
    navigateTo('recipe-submit');
  };

  const handleShoppingTabPress = () => {
    navigateTo('shopping');
  };

  const resetTo = useCallback((screenKey) => {
    setScreenHistory([]);
    setActiveScreen(screenKey);
  }, []);

  const navigateTo = useCallback((screenKey) => {
    setScreenHistory((current) => {
      if (activeScreen === screenKey) {
        return current;
      }

      return [...current, activeScreen];
    });
    setActiveScreen(screenKey);
  }, [activeScreen]);

  const goBack = useCallback((fallback = 'home') => {
    setScreenHistory((current) => {
      if (!current.length) {
        setActiveScreen(fallback);
        return current;
      }

      const previousScreen = current[current.length - 1];
      setActiveScreen(previousScreen);
      return current.slice(0, -1);
    });
  }, []);

  useEffect(() => {
    let cancelled = false;

    const restoreSession = async () => {
      try {
        const user = await bootstrapAuthSession();
        if (cancelled) {
          return;
        }

        setCurrentUser(user || null);
        setScreenHistory([]);
        const role = String(user?.primaryRole || '').toUpperCase();
        if (role === 'ADMIN') {
          setActiveScreen('admin');
          return;
        }

        setActiveScreen('home');
      } finally {
        if (!cancelled) {
          setBootstrapping(false);
        }
      }
    };

    restoreSession();

    return () => {
      cancelled = true;
    };
  }, []);

  const handleLogout = async () => {
    try {
      await logout();
    } catch (error) {
      // Keep UX smooth even if revoke API fails; local tokens are still cleared by logout().
      console.log('Logout warning:', error?.message || error);
    } finally {
      setCurrentUser(null);
      resetTo('login');
    }
  };

  const handleLoginSuccess = (user) => {
    setCurrentUser(user || null);
    const role = String(user?.primaryRole || '').toUpperCase();
    if (role === 'ADMIN') {
      resetTo('admin');
      return;
    }

    resetTo('home');
  };

  const handleOpenRecipeDetail = (recipeId) => {
    if (!recipeId) {
      return;
    }

    setSelectedRecipeId(recipeId);
    navigateTo('recipe-detail');
  };

  const handleBackFromRecipeDetail = () => {
    goBack('home');
  };

  const renderScreen = () => {
    if (bootstrapping) {
      return (
        <View style={styles.bootScreen}>
          <ActivityIndicator size="large" color="#2563eb" />
        </View>
      );
    }

    if (activeScreen === 'login') {
      return (
        <LoginScreen
          onClose={() => goBack('home')}
          onLoginSuccess={handleLoginSuccess}
          onNavigateRegister={() => navigateTo('register')}
        />
      );
    }

    if (activeScreen === 'register') {
      return (
        <RegisterScreen
          onClose={() => goBack('login')}
          onRegisterSuccess={() => navigateTo('login')}
        />
      );
    }

    if (activeScreen === 'admin') {
      return (
        <AdminDashboardScreen
          user={currentUser}
          onLogout={handleLogout}
          onNavigateIngredients={() => setActiveScreen('admin-ingredients')}
          onNavigateRecipeReview={() => setActiveScreen('admin-recipe-review')}
          onNavigateUsers={() => setActiveScreen('admin-users')}
          onNavigateTransactions={() => setActiveScreen('admin-transactions')}
        />
      );
    }

    if (activeScreen === 'admin-users') {
      return (
        <AdminUsersScreen
          user={currentUser}
          onBack={() => setActiveScreen('admin')}
          onLogout={handleLogout}
          onNavigateOverview={() => setActiveScreen('admin')}
          onNavigateIngredients={() => setActiveScreen('admin-ingredients')}
          onNavigateRecipeReview={() => setActiveScreen('admin-recipe-review')}
          onNavigateTransactions={() => setActiveScreen('admin-transactions')}
        />
      );
    }

    if (activeScreen === 'admin-ingredients') {
      return (
        <AdminIngredientsScreen
          user={currentUser}
          onLogout={handleLogout}
          onNavigateOverview={() => setActiveScreen('admin')}
          onNavigateRecipeReview={() => setActiveScreen('admin-recipe-review')}
          onNavigateUsers={() => setActiveScreen('admin-users')}
          onNavigateTransactions={() => setActiveScreen('admin-transactions')}
        />
      );
    }

    if (activeScreen === 'admin-recipe-review') {
      return (
        <AdminRecipeReviewScreen
          user={currentUser}
          onBackToAdmin={() => setActiveScreen('admin')}
          onLogout={handleLogout}
          onNavigateOverview={() => setActiveScreen('admin')}
          onNavigateIngredients={() => setActiveScreen('admin-ingredients')}
          onNavigateUsers={() => setActiveScreen('admin-users')}
          onNavigateTransactions={() => setActiveScreen('admin-transactions')}
        />
      );
    }

    if (activeScreen === 'admin-transactions') {
      return (
        <AdminTransactionsScreen
          user={currentUser}
          onLogout={handleLogout}
          onNavigateOverview={() => setActiveScreen('admin')}
          onNavigateIngredients={() => setActiveScreen('admin-ingredients')}
          onNavigateRecipeReview={() => setActiveScreen('admin-recipe-review')}
          onNavigateUsers={() => setActiveScreen('admin-users')}
        />
      );
    }

    if (activeScreen === 'upgrade') {
      return (
        <UserUpgradeScreen
          user={currentUser}
          usageCount={usageCount}
          onUserUpdate={setCurrentUser}
          onLogout={handleLogout}
          onNavigateHome={() => setActiveScreen('home')}
          onNavigateSuggest={handleSuggestTabPress}
          onNavigateMeal={handleMealTabPress}
          onNavigateRecipeSubmission={handleRecipeSubmitTabPress}
          onNavigateFavorites={() => setActiveScreen('favorites')}
          onNavigateShopping={handleShoppingTabPress}
        />
      );
    }

    if (activeScreen === 'suggest') {
      return (
        <IngredientSuggestionScreen
          isGuest={!currentUser}
          user={currentUser}
          usageCount={usageCount}
          onSuggestSuccess={incrementUsage}
          onLoginPress={() => navigateTo('login')}
          onSignupPress={() => navigateTo('register')}
          onNavigateHome={() => navigateTo('home')}
          onNavigateMeal={handleMealTabPress}
          onNavigateRecipeSubmission={handleRecipeSubmitTabPress}
          onNavigateFavorites={() => navigateTo('favorites')}
          onNavigateUpgrade={() => navigateTo('upgrade')}
          onNavigateShopping={handleShoppingTabPress}
          onGoBack={() => goBack('home')}
          onRequestLogout={handleLogout}
        />
      );
    }

    if (activeScreen === 'meal') {
      return (
        <UserMealSetScreen
          isGuest={!currentUser}
          user={currentUser}
          usageCount={usageCount}
          onLoginPress={() => navigateTo('login')}
          onGoBack={() => goBack('home')}
          onNavigateHome={() => navigateTo('home')}
          onNavigateSuggest={handleSuggestTabPress}
          onNavigateRecipeSubmission={handleRecipeSubmitTabPress}
          onNavigateFavorites={() => navigateTo('favorites')}
          onNavigateUpgrade={() => navigateTo('upgrade')}
          onNavigateShopping={handleShoppingTabPress}
          onOpenRecipeDetail={handleOpenRecipeDetail}
          onRequestLogout={handleLogout}
        />
      );
    }

    if (activeScreen === 'shopping') {
      return (
        <ShoppingListScreen
          isGuest={!currentUser}
          user={currentUser}
          usageCount={usageCount}
          onLoginPress={() => navigateTo('login')}
          onNavigateHome={() => navigateTo('home')}
          onNavigateSuggest={handleSuggestTabPress}
          onNavigateMeal={handleMealTabPress}
          onNavigateRecipeSubmission={handleRecipeSubmitTabPress}
          onNavigateFavorites={() => navigateTo('favorites')}
          onNavigateUpgrade={() => navigateTo('upgrade')}
          onNavigateShopping={handleShoppingTabPress}
          onRequestLogout={handleLogout}
        />
      );
    }

    if (activeScreen === 'favorites') {
      return (
        <UserFavoritesScreen
          isGuest={!currentUser}
          user={currentUser}
          usageCount={usageCount}
          onLoginPress={() => navigateTo('login')}
          onNavigateHome={() => navigateTo('home')}
          onNavigateSuggest={handleSuggestTabPress}
          onNavigateMeal={handleMealTabPress}
          onNavigateRecipeSubmission={handleRecipeSubmitTabPress}
          onNavigateUpgrade={() => navigateTo('upgrade')}
          onNavigateShopping={handleShoppingTabPress}
          onOpenRecipeDetail={handleOpenRecipeDetail}
          onRequestLogout={handleLogout}
        />
      );
    }

    if (activeScreen === 'recipe-submit') {
      return (
        <RecipeSubmissionScreen
          isGuest={!currentUser}
          user={currentUser}
          usageCount={usageCount}
          onLoginPress={() => navigateTo('login')}
          onNavigateHome={() => navigateTo('home')}
          onNavigateSuggest={handleSuggestTabPress}
          onNavigateMeal={handleMealTabPress}
          onNavigateFavorites={() => navigateTo('favorites')}
          onNavigateUpgrade={() => navigateTo('upgrade')}
          onNavigateShopping={handleShoppingTabPress}
          onRequestLogout={handleLogout}
        />
      );
    }

    if (activeScreen === 'recipe-detail') {
      return (
        <RecipeDetailScreen
          recipeId={selectedRecipeId}
          isGuest={!currentUser}
          onBack={handleBackFromRecipeDetail}
          onLoginPress={() => navigateTo('login')}
        />
      );
    }

    return (
      <HomeScreen
        onLoginPress={() => navigateTo('login')}
        onSignupPress={() => navigateTo('register')}
        onRequestLogout={handleLogout}
        onNavigateSuggest={handleSuggestTabPress}
        onNavigateMeal={handleMealTabPress}
        onNavigateRecipeSubmission={handleRecipeSubmitTabPress}
        onNavigateFavorites={() => navigateTo('favorites')}
        onNavigateUpgrade={() => navigateTo('upgrade')}
        onNavigateShopping={handleShoppingTabPress}
        onOpenRecipeDetail={handleOpenRecipeDetail}
        isGuest={!currentUser}
        user={currentUser}
        usageCount={usageCount}
      />
    );
  };

  return (
    <SafeAreaProvider>
      {renderScreen()}
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  bootScreen: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#ffffff',
  },
});
