import React, { useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  SafeAreaView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import * as WebBrowser from 'expo-web-browser';
import * as AuthSession from 'expo-auth-session';
import * as Google from 'expo-auth-session/providers/google';
import Constants from 'expo-constants';
import { Feather, FontAwesome } from '@expo/vector-icons';
import {
  loginWithEmail,
  loginWithGoogle,
} from '../services/authApi';

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const PASSWORD_POLICY_REGEX = /^(?=.*[A-Z])(?=.*\d)(?=.*[^A-Za-z0-9]).{6,}$/;

WebBrowser.maybeCompleteAuthSession();

const InputField = ({ 
  icon, 
  placeholder, 
  value, 
  onChangeText, 
  secureTextEntry = false,
  isPassword = false,
  onToggleSecure
}) => (
  <View style={styles.inputWrap}>
    <Feather name={icon} size={18} color="#98a2b3" />
    <TextInput
      value={value}
      onChangeText={onChangeText}
      placeholder={placeholder}
      placeholderTextColor="#98a2b3"
      autoCapitalize="none"
      autoCorrect={false}
      secureTextEntry={secureTextEntry}
      style={styles.input}
    />
    {isPassword && (
      <Pressable onPress={onToggleSecure} hitSlop={10}>
        <Feather name={secureTextEntry ? "eye-off" : "eye"} size={18} color="#98a2b3" />
      </Pressable>
    )}
  </View>
);

export default function LoginScreen({ onClose, onLoginSuccess, onNavigateRegister }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loadingType, setLoadingType] = useState('');
  const [rememberLogin, setRememberLogin] = useState(false);
  const [noticeMessage, setNoticeMessage] = useState('');
  const [noticeVisible, setNoticeVisible] = useState(false);

  const showNotice = (message) => {
    const content = String(message || '').trim();
    if (!content) {
      return;
    }

    setNoticeMessage(content);
    setNoticeVisible(true);
  };

  const authConfig = Constants.expoConfig?.extra?.auth || {};
  const googleConfig = authConfig.google || {};
  const configuredGoogleRedirectUri = String(googleConfig.redirectUri || '').trim().replace(/\/+$/, '');
  const expoOwner = Constants.expoConfig?.owner || '';
  const expoSlug = Constants.expoConfig?.slug || 'AppGoiY';
  const appScheme = String(Constants.expoConfig?.scheme || 'appgoiy').trim() || 'appgoiy';
  const isWeb = Platform.OS === 'web';
  const isExpoGo = Constants.appOwnership === 'expo' || (!isWeb && Constants.executionEnvironment === 'storeClient');
  const fallbackProxyRedirectUri = `https://auth.expo.io/@${expoOwner}/${expoSlug}`;

  // Expo Go cần proxy URL của Expo; build/app local dùng deep link scheme.
  const generatedRedirectUri = AuthSession.makeRedirectUri(
    isExpoGo
      ? { useProxy: true }
      : {
          scheme: appScheme,
          path: 'oauth/google',
        }
  );

  // Ưu tiên URI cấu hình sẵn cho Expo Go; Web/Standalone dùng generated URI (localhost hoặc scheme).
  const googleRedirectUri = (isExpoGo && !isWeb)
    ? (configuredGoogleRedirectUri || fallbackProxyRedirectUri)
    : generatedRedirectUri;

  const resolvedGoogleClientId =
    googleConfig.expoClientId ||
    googleConfig.webClientId ||
    googleConfig.androidClientId ||
    googleConfig.iosClientId ||
    '';

  // Hook của expo để tạo request login với Google.
  const [googleRequest, , promptGoogleLogin] = Google.useIdTokenAuthRequest({
    clientId: resolvedGoogleClientId,
    expoClientId: googleConfig.expoClientId || googleConfig.webClientId || resolvedGoogleClientId,
    iosClientId: googleConfig.iosClientId || undefined,
    androidClientId: googleConfig.androidClientId || undefined,
    webClientId: googleConfig.webClientId || resolvedGoogleClientId,
    redirectUri: googleRedirectUri,
    scopes: ['openid', 'profile', 'email'],
  });

  const canSubmit = useMemo(() => {
    return EMAIL_REGEX.test(email.trim()) && PASSWORD_POLICY_REGEX.test(password);
  }, [email, password]);

  const handleEmailLogin = async () => {
    if (!canSubmit) {
      showNotice('Vui lòng nhập email hợp lệ và mật khẩu có ít nhất 6 ký tự, gồm 1 chữ hoa, 1 chữ số và 1 ký tự đặc biệt.');
      return;
    }

    try {
      setLoadingType('email');
      const response = await loginWithEmail({
        email: email.trim().toLowerCase(),
        password,
        rememberLogin,
      });

      if (typeof onLoginSuccess === 'function') {
        onLoginSuccess(response?.user || null);
      }

      Alert.alert('Đăng nhập thành công', `Xin chào ${response?.user?.fullName || response?.user?.email}`);
    } catch (error) {
      showNotice(error.message || 'Không thể đăng nhập.');
    } finally {
      setLoadingType('');
    }
  };

  const handleGoogleLogin = async () => {
    const hasGoogleId = Boolean(resolvedGoogleClientId);
    if (!hasGoogleId) {
      showNotice('Vui lòng điền expoClientId hoặc webClientId vào app.json.');
      return;
    }

    if (!googleRequest) {
      showNotice('Yêu cầu đăng nhập Google đang khởi tạo. Vui lòng thử lại sau vài giây.');
      return;
    }

    if (isExpoGo && !expoOwner) {
      showNotice('File app.json cần thêm expo.owner để tạo redirect URL hợp lệ.');
      return;
    }

    if (isExpoGo && !googleRedirectUri.startsWith('https://auth.expo.io/')) {
      showNotice(`Redirect URI sai: ${googleRedirectUri}`);
      return;
    }

    try {
      setLoadingType('google');
      const oauthResult = await promptGoogleLogin(
        isExpoGo
          ? { useProxy: true, showInRecents: true }
          : { showInRecents: true }
      );
      if (oauthResult.type === 'error') {
        const details = oauthResult.params?.error_description || oauthResult.error?.message || oauthResult.params?.error;
        showNotice(details || 'Yêu cầu OAuth không hợp lệ.');
        return;
      }

      if (oauthResult.type !== 'success') {
        return;
      }

      const idToken = oauthResult.params?.id_token || oauthResult.authentication?.idToken;
      const accessToken = oauthResult.params?.access_token || oauthResult.authentication?.accessToken;
      if (!idToken && !accessToken) {
        showNotice('Không lấy được token từ Google.');
        return;
      }

      const response = await loginWithGoogle({
        idToken,
        accessToken,
        rememberLogin,
      });

      if (typeof onLoginSuccess === 'function') {
        onLoginSuccess(response?.user || null);
        return;
      }

      Alert.alert('Đăng nhập Google thành công', `Xin chào ${response?.user?.fullName || response?.user?.email}`);
    } catch (error) {
      const backendErrorCode = error?.data?.code;
      if (backendErrorCode === 'SOCIAL_ACCOUNT_NOT_REGISTERED') {
        showNotice('Tài khoản chưa tồn tại. Vui lòng đăng ký tài khoản');
        return;
      }

      showNotice(error.message || 'Không gọi được API Google login.');
    } finally {
      setLoadingType('');
    }
  };

  return (
    <View style={styles.screen}>
      <Modal
        animationType="fade"
        transparent
        visible={noticeVisible}
        onRequestClose={() => setNoticeVisible(false)}
      >
        <View style={styles.noticeBackdrop}>
          <View style={styles.noticeCard}>
            <Text style={styles.noticeTitle}>Thông báo</Text>
            <Text style={styles.noticeMessage}>{noticeMessage}</Text>
            <Pressable style={styles.noticeButton} onPress={() => setNoticeVisible(false)}>
              <Text style={styles.noticeButtonText}>OK</Text>
            </Pressable>
          </View>
        </View>
      </Modal>

      <SafeAreaView style={{ flex: 0, backgroundColor: '#020a1f' }} />
      
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={{ flex: 1, backgroundColor: '#020a1f' }}
      >
        <View style={styles.topOverlay}>
          <View style={styles.logoPlaceholder}>
            <Feather name="pie-chart" size={60} color="#f55f12" />
            <Text style={styles.logoText}>NutriChef</Text>
          </View>
        </View>

        <SafeAreaView style={styles.cardContainer} edges={['bottom']}>
          <View style={styles.card}>
            <View style={styles.titleRow}>
              <Text style={styles.title}>Đăng nhập</Text>
              <Pressable
                onPress={() => {
                  if (typeof onClose === 'function') {
                    onClose();
                    return;
                  }
                  Alert.alert('Đóng', 'Đang quay lại...');
                }}
                hitSlop={15}
              >
                <Feather name="x" size={26} color="#98a2b3" />
              </Pressable>
            </View>

            <Text style={styles.label}>Email</Text>
            <InputField
              icon="mail"
              placeholder="your@email.com"
              value={email}
              onChangeText={setEmail}
            />

            <Text style={styles.label}>Mật khẩu</Text>
            <InputField
              icon="lock"
              placeholder="••••••••"
              value={password}
              onChangeText={setPassword}
              secureTextEntry={!showPassword}
              isPassword
              onToggleSecure={() => setShowPassword(!showPassword)}
            />

            <Pressable
              onPress={() => Alert.alert('Quên mật khẩu', 'Tính năng đang phát triển.')}
              style={styles.forgotWrap}
            >
              <Text style={styles.forgotText}>Quên mật khẩu?</Text>
            </Pressable>

            <Pressable
              onPress={() => setRememberLogin((current) => !current)}
              style={styles.rememberWrap}
            >
              <Feather
                name={rememberLogin ? 'check-square' : 'square'}
                size={18}
                color={rememberLogin ? '#f55f12' : '#98a2b3'}
              />
              <Text style={styles.rememberText}>Ghi nhớ đăng nhập</Text>
            </Pressable>

            <Pressable
              onPress={handleEmailLogin}
              disabled={loadingType === 'email'}
              style={[styles.loginButton, loadingType === 'email' && styles.loginButtonDisabled]}
            >
              {loadingType === 'email' ? (
                <ActivityIndicator size="small" color="#ffffff" />
              ) : (
                <Text style={styles.loginButtonText}>Đăng nhập</Text>
              )}
            </Pressable>

            <View style={styles.signupRow}>
              <Text style={styles.signupHint}>Chưa có tài khoản?</Text>
              <Pressable onPress={onNavigateRegister}>
                <Text style={styles.signupText}> Đăng ký</Text>
              </Pressable>
            </View>

            <View style={styles.orWrap}>
              <View style={styles.orLine} />
              <Text style={styles.orText}>HOẶC</Text>
              <View style={styles.orLine} />
            </View>

            <View style={styles.socialRow}>
              <Pressable
                onPress={handleGoogleLogin}
                disabled={loadingType === 'google'}
                style={styles.socialButton}
              >
                {loadingType === 'google' ? (
                  <ActivityIndicator size="small" color="#5f6368" />
                ) : (
                  <>
                    <FontAwesome name="google" size={18} color="#ea4335" />
                    <Text style={styles.socialText}> Google</Text>
                  </>
                )}
              </Pressable>
            </View>
          </View>
        </SafeAreaView>
      </KeyboardAvoidingView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: '#020a1f',
  },
  topOverlay: {
    height: 180,
    backgroundColor: '#020a1f',
    justifyContent: 'center',
    alignItems: 'center',
  },
  logoPlaceholder: {
    alignItems: 'center',
    marginTop: 20,
  },
  logoText: {
    color: '#ffffff',
    fontSize: 24,
    fontWeight: '900',
    marginTop: 8,
    letterSpacing: 1,
  },
  cardContainer: {
    flex: 1,
    backgroundColor: '#ffffff',
    borderTopLeftRadius: 32,
    borderTopRightRadius: 32,
  },
  card: {
    flex: 1,
    paddingHorizontal: 24,
    paddingTop: 30,
    paddingBottom: 20,
  },
  titleRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  title: {
    fontSize: 38,
    fontWeight: '800',
    color: '#111827',
  },
  label: {
    marginTop: 6,
    marginBottom: 8,
    fontSize: 15,
    fontWeight: '700',
    color: '#374151',
  },
  inputWrap: {
    minHeight: 52,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#e5e7eb',
    backgroundColor: '#f9fafb',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 12,
    marginBottom: 12,
  },
  input: {
    flex: 1,
    fontSize: 16,
    color: '#111827',
  },
  forgotWrap: {
    alignItems: 'flex-end',
    marginBottom: 16,
  },
  forgotText: {
    color: '#f55f12',
    fontSize: 15,
    fontWeight: '700',
  },
  rememberWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 16,
  },
  rememberText: {
    color: '#374151',
    fontSize: 15,
    fontWeight: '600',
  },
  loginButton: {
    height: 52,
    borderRadius: 12,
    backgroundColor: '#f55f12',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 18,
  },
  loginButtonDisabled: {
    opacity: 0.8,
  },
  loginButtonText: {
    color: '#ffffff',
    fontSize: 18,
    fontWeight: '800',
  },
  signupRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 18,
  },
  signupHint: {
    color: '#6b7280',
    fontSize: 15,
  },
  signupText: {
    color: '#f55f12',
    fontSize: 15,
    fontWeight: '700',
  },
  orWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 14,
    gap: 12,
  },
  orLine: {
    flex: 1,
    borderTopWidth: 1,
    borderTopColor: '#e5e7eb',
  },
  orText: {
    color: '#9ca3af',
    fontSize: 14,
    fontWeight: '700',
  },
  socialRow: {
    flexDirection: 'row',
    gap: 10,
  },
  socialButton: {
    flex: 1,
    height: 46,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#d1d5db',
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    backgroundColor: '#ffffff',
  },
  socialText: {
    color: '#4b5563',
    fontSize: 15,
    fontWeight: '700',
  },
  noticeBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.45)',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 20,
  },
  noticeCard: {
    width: '100%',
    maxWidth: 360,
    backgroundColor: '#ffffff',
    borderRadius: 16,
    paddingHorizontal: 16,
    paddingVertical: 18,
  },
  noticeTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: '#111827',
    marginBottom: 10,
  },
  noticeMessage: {
    fontSize: 15,
    lineHeight: 21,
    color: '#374151',
    marginBottom: 16,
  },
  noticeButton: {
    alignSelf: 'flex-end',
    backgroundColor: '#f55f12',
    borderRadius: 10,
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  noticeButtonText: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: '700',
  },
});
