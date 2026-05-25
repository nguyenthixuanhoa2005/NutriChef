import React, { useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { Feather } from '@expo/vector-icons';
import { register } from '../services/authApi';

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const PASSWORD_POLICY_REGEX = /^(?=.*[A-Z])(?=.*\d)(?=.*[^A-Za-z0-9]).{6,}$/;

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

export default function RegisterScreen({ onClose, onRegisterSuccess }) {
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [noticeMessage, setNoticeMessage] = useState('');
  const [noticeVisible, setNoticeVisible] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);

  const showNotice = (message, success = false) => {
    const content = String(message || '').trim();
    if (!content) return;
    setNoticeMessage(content);
    setIsSuccess(success);
    setNoticeVisible(true);
  };

  const handleNoticeClose = () => {
    setNoticeVisible(false);
    if (isSuccess && onRegisterSuccess) {
      onRegisterSuccess();
    }
  };

  const canSubmit = useMemo(() => {
    return (
      fullName.trim().length >= 2 &&
      EMAIL_REGEX.test(email.trim()) &&
      PASSWORD_POLICY_REGEX.test(password) &&
      password === confirmPassword
    );
  }, [fullName, email, password, confirmPassword]);

  const handleRegister = async () => {
    if (fullName.trim().length < 2) {
      showNotice('Vui lòng nhập họ tên đầy đủ.');
      return;
    }
    if (!EMAIL_REGEX.test(email.trim())) {
      showNotice('Vui lòng nhập email hợp lệ.');
      return;
    }
    if (!PASSWORD_POLICY_REGEX.test(password)) {
      showNotice('Mật khẩu phải có ít nhất 6 ký tự, gồm 1 chữ hoa, 1 chữ số và 1 ký tự đặc biệt.');
      return;
    }
    if (password !== confirmPassword) {
      showNotice('Mật khẩu xác nhận không khớp.');
      return;
    }

    try {
      setLoading(true);
      await register({
        fullName: fullName.trim(),
        email: email.trim().toLowerCase(),
        password,
      });

      showNotice('Tài khoản của bạn đã được tạo thành công. Vui lòng đăng nhập.', true);
    } catch (error) {
      showNotice(error.message || 'Không thể đăng ký tài khoản.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={styles.screen}>
      <Modal
        animationType="fade"
        transparent
        visible={noticeVisible}
        onRequestClose={handleNoticeClose}
      >
        <View style={styles.noticeBackdrop}>
          <View style={styles.noticeCard}>
            <Text style={[styles.noticeTitle, isSuccess && styles.successTitle]}>
              {isSuccess ? 'Thành công' : 'Thông báo'}
            </Text>
            <Text style={styles.noticeMessage}>{noticeMessage}</Text>
            <Pressable style={styles.noticeButton} onPress={handleNoticeClose}>
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
            <Feather name="pie-chart" size={50} color="#f55f12" />
            <Text style={styles.logoText}>NutriChef</Text>
          </View>
        </View>

        <SafeAreaView style={styles.cardContainer} edges={['bottom']}>
          <ScrollView style={styles.card} showsVerticalScrollIndicator={false}>
            <View style={styles.titleRow}>
              <Text style={styles.title}>Đăng ký</Text>
              <Pressable onPress={onClose} hitSlop={15}>
                <Feather name="x" size={26} color="#98a2b3" />
              </Pressable>
            </View>

            <Text style={styles.label}>Họ và tên</Text>
            <InputField
              icon="user"
              placeholder="Nguyễn Văn A"
              value={fullName}
              onChangeText={setFullName}
            />

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

            <Text style={styles.label}>Xác nhận mật khẩu</Text>
            <InputField
              icon="shield"
              placeholder="••••••••"
              value={confirmPassword}
              onChangeText={setConfirmPassword}
              secureTextEntry={!showPassword}
            />

            <View style={styles.policyWrap}>
              <Text style={styles.policyText}>
                Bằng cách đăng ký, bạn đồng ý với{' '}
                <Text style={styles.policyLink}>Điều khoản dịch vụ</Text> và{' '}
                <Text style={styles.policyLink}>Chính sách bảo mật</Text> của chúng tôi.
              </Text>
            </View>

            <Pressable
              onPress={handleRegister}
              disabled={loading}
              style={[styles.actionButton, loading && styles.buttonDisabled]}
            >
              {loading ? (
                <ActivityIndicator size="small" color="#ffffff" />
              ) : (
                <Text style={styles.actionButtonText}>Tạo tài khoản</Text>
              )}
            </Pressable>

            <View style={styles.loginRow}>
              <Text style={styles.loginHint}>Đã có tài khoản?</Text>
              <Pressable onPress={onClose}>
                <Text style={styles.loginLink}> Đăng nhập</Text>
              </Pressable>
            </View>
          </ScrollView>
        </SafeAreaView>
      </KeyboardAvoidingView>
    </View>
  );
}

// Reuse styles from LoginScreen for consistency
const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#020a1f' },
  topOverlay: {
    height: 140,
    backgroundColor: '#020a1f',
    justifyContent: 'center',
    alignItems: 'center',
  },
  logoPlaceholder: { alignItems: 'center', marginTop: 10 },
  logoText: { color: '#ffffff', fontSize: 20, fontWeight: '900', marginTop: 5, letterSpacing: 1 },
  cardContainer: { flex: 1, backgroundColor: '#ffffff', borderTopLeftRadius: 32, borderTopRightRadius: 32 },
  card: { flex: 1, paddingHorizontal: 24, paddingTop: 30 },
  titleRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 },
  title: { fontSize: 32, fontWeight: '800', color: '#111827' },
  label: { marginBottom: 8, fontSize: 14, fontWeight: '700', color: '#374151' },
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
    marginBottom: 16,
  },
  input: { flex: 1, fontSize: 16, color: '#111827' },
  policyWrap: { marginBottom: 24 },
  policyText: { color: '#6b7280', fontSize: 13, lineHeight: 18 },
  policyLink: { color: '#f55f12', fontWeight: '600' },
  actionButton: {
    height: 52,
    borderRadius: 12,
    backgroundColor: '#f55f12',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 20,
  },
  buttonDisabled: { opacity: 0.7 },
  actionButtonText: { color: '#ffffff', fontSize: 17, fontWeight: '800' },
  loginRow: { flexDirection: 'row', justifyContent: 'center', alignItems: 'center', marginBottom: 40 },
  loginHint: { color: '#6b7280', fontSize: 15 },
  loginLink: { color: '#f55f12', fontSize: 15, fontWeight: '700' },
  noticeBackdrop: { flex: 1, backgroundColor: 'rgba(0, 0, 0, 0.45)', justifyContent: 'center', alignItems: 'center', paddingHorizontal: 20 },
  noticeCard: { width: '100%', maxWidth: 360, backgroundColor: '#ffffff', borderRadius: 16, padding: 18 },
  noticeTitle: { fontSize: 18, fontWeight: '800', color: '#111827', marginBottom: 10 },
  successTitle: { color: '#10b981' },
  noticeMessage: { fontSize: 15, lineHeight: 21, color: '#374151', marginBottom: 16 },
  noticeButton: { alignSelf: 'flex-end', backgroundColor: '#f55f12', borderRadius: 10, paddingHorizontal: 16, paddingVertical: 10 },
  noticeButtonText: { color: '#ffffff', fontSize: 14, fontWeight: '700' },
});
