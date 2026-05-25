import React, { useEffect, useState, useCallback, useRef } from 'react';
import {
  StyleSheet,
  View,
  Text,
  ScrollView,
  Pressable,
  ActivityIndicator,
  Alert,
  Dimensions,
  Modal,
  Image,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Feather, MaterialCommunityIcons } from '@expo/vector-icons';
import { AppHeader, AppBottomNav } from '../components/AppChrome';
import { authRequest } from '../services/client';

const { width } = Dimensions.get('window');

// Cấu hình SePay (Sử dụng Virtual Account để nhận webhook)
const BANK_CONFIG = {
  bankId: 'BIDV', // Dùng chữ BIDV cho SePay QR
  accountNo: '96247ABC2005', 
  accountName: 'NGUYEN THI XUAN HOA',
};

const PlanCard = ({ plan, onSelect, isSelected }) => {
  const isBestValue = plan.plan_name?.toLowerCase().includes('năm');

  return (
    <Pressable
      style={[
        styles.planCard,
        isSelected && styles.planCardSelected,
        isBestValue && styles.planCardBest,
      ]}
      onPress={() => onSelect(plan)}
    >
      {isBestValue && (
        <View style={styles.bestBadge}>
          <Text style={styles.bestBadgeText}>TIẾT KIỆM NHẤT</Text>
        </View>
      )}
      <View style={styles.planHeader}>
        <MaterialCommunityIcons
          name={isBestValue ? 'crown' : 'star-outline'}
          size={32}
          color={isBestValue ? '#f59e0b' : '#6366f1'}
        />
        <View style={styles.planTitleContainer}>
          <Text style={styles.planName}>{plan.plan_name}</Text>
          <Text style={styles.planDuration}>{plan.duration_days} ngày sử dụng</Text>
        </View>
      </View>

      <Text style={styles.planPrice}>
        {new Intl.NumberFormat('vi-VN').format(plan.price)}
        <Text style={styles.currency}> VNĐ</Text>
      </Text>

      <Text style={styles.planDescription}>{plan.description}</Text>

      <View style={styles.featuresList}>
        <View style={styles.featureItem}>
          <Feather name="check-circle" size={16} color="#10b981" />
          <Text style={styles.featureText}>Gợi ý món ăn AI không giới hạn (Tối đa 5 lượt/ngày với bản Free)</Text>
        </View>
        <View style={styles.featureItem}>
          <Feather name="check-circle" size={16} color="#10b981" />
          <Text style={styles.featureText}>Tắt hoàn toàn quảng cáo gây phiền nhiễu</Text>
        </View>
        <View style={styles.featureItem}>
          <Feather name="check-circle" size={16} color="#10b981" />
          <Text style={styles.featureText}>Xem chi tiết dinh dưỡng 100% món ăn</Text>
        </View>
        <View style={styles.featureItem}>
          <Feather name="check-circle" size={16} color="#10b981" />
          <Text style={styles.featureText}>Đăng bài công thức không giới hạn</Text>
        </View>
      </View>
    </Pressable>
  );
};

export default function UserUpgradeScreen({
  user: initialUser,
  onLogout,
  onNavigateHome,
  onNavigateSuggest,
  onNavigateMeal,
  onNavigateRecipeSubmission,
  onNavigateFavorites,
}) {
  const [user, setUser] = useState(initialUser);
  const [plans, setPlans] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedPlan, setSelectedPlan] = useState(null);
  const [submitting, setSubmitting] = useState(false);

  // Payment State
  const [showQR, setShowQR] = useState(false);
  const [showSuccessModal, setShowSuccessModal] = useState(false);
  const [currentPayment, setCurrentPayment] = useState(null);
  const [timeLeft, setCountdown] = useState(600); // 10 minutes
  const timerRef = useRef(null);
  const pollingRef = useRef(null);

  const fetchProfile = useCallback(async () => {
    try {
      const response = await authRequest('/api/auth/me');
      if (response.status === 'success') {
        setUser(response.user);
      }
    } catch (error) {
      console.error('Lỗi lấy thông tin user:', error);
    }
  }, []);

  const fetchPlans = useCallback(async () => {
    try {
      setLoading(true);
      const response = await authRequest('/api/premium-plans');
      const planList = Array.isArray(response.plans) ? response.plans : [];
      setPlans(planList);
      if (planList.length > 0) {
        setSelectedPlan(planList[1] || planList[0]);
      }
    } catch (error) {
      Alert.alert('Lỗi', 'Không thể tải danh sách gói nâng cấp.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchPlans();
    fetchProfile();
  }, [fetchPlans, fetchProfile]);

  // Logic đếm ngược (Chạy riêng mỗi giây)
  useEffect(() => {
    if (showQR && timeLeft > 0) {
      timerRef.current = setInterval(() => {
        setCountdown((prev) => prev - 1);
      }, 1000);
    }
    return () => clearInterval(timerRef.current);
  }, [showQR, timeLeft > 0]); // Chỉ chạy lại khi bật QR hoặc hết giờ

  // Logic Polling (Kiểm tra trạng thái thanh toán - Tách biệt để không bị reset mỗi giây)
  useEffect(() => {
    if (showQR && currentPayment?.payment_id) {
      console.log('🔄 Bắt đầu Polling cho giao dịch:', currentPayment.payment_id);
      
      pollingRef.current = setInterval(async () => {
        try {
          const res = await authRequest(`/api/payments/${currentPayment.payment_id}/status`);
          console.log('💳 Trạng thái thanh toán:', res.payment?.status);
          
          if (res.payment?.status === 'SUCCESS') {
            console.log('✅ Phát hiện thanh toán thành công!');
            handlePaymentSuccess();
          }
        } catch (e) {
          console.warn('⚠️ Lỗi Polling:', e.message);
        }
      }, 3000); // Kiểm tra mỗi 3 giây
    }

    return () => {
      if (pollingRef.current) {
        console.log('🛑 Dừng Polling');
        clearInterval(pollingRef.current);
      }
    };
  }, [showQR, currentPayment?.payment_id]);

  // Logic xử lý khi hết hạn thanh toán
  useEffect(() => {
    if (showQR && timeLeft === 0) {
      setShowQR(false);
      Alert.alert(
        '⚠️ Thanh toán thất bại',
        'Thời gian thanh toán đã hết hạn. Vui lòng thực hiện lại nếu bạn vẫn muốn nâng cấp tài khoản.',
        [{ text: 'Đóng' }]
      );
    }
  }, [timeLeft, showQR]);

  const handlePaymentSuccess = () => {
    clearInterval(timerRef.current);
    clearInterval(pollingRef.current);
    setShowQR(false);
    setShowSuccessModal(true);
  };

  const handleCloseSuccess = () => {
    setShowSuccessModal(false);
    fetchProfile();
  };

  const formatTime = (seconds) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs < 10 ? '0' : ''}${secs}`;
  };

  const handleUpgrade = async () => {
    if (!selectedPlan) return;

    try {
      setSubmitting(true);
      const response = await authRequest('/api/payments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          plan_id: selectedPlan.plan_id,
        }),
      });

      if (response.status === 'success') {
        setCurrentPayment(response.payment);
        setCountdown(600);
        setShowQR(true);
      }
    } catch (error) {
      Alert.alert('Lỗi', error.message || 'Thao tác nâng cấp thất bại.');
    } finally {
      setSubmitting(false);
    }
  };

  const qrUrl = currentPayment 
    ? `https://qr.sepay.vn/img?bank=${BANK_CONFIG.bankId}&acc=${BANK_CONFIG.accountNo}&amount=${currentPayment.amount}&des=${currentPayment.internal_reference}`
    : '';

  const handleBottomTabPress = (tabKey) => {
    if (tabKey === 'home') onNavigateHome?.();
    if (tabKey === 'suggest') onNavigateSuggest?.();
    if (tabKey === 'menu') onNavigateMeal?.();
    if (tabKey === 'recipes') onNavigateRecipeSubmission?.();
    if (tabKey === 'favorites') onNavigateFavorites?.();
  };

  return (
    <SafeAreaView style={styles.screen} edges={['top', 'bottom']}>
      <AppHeader isGuest={false} onAccountPress={onLogout} />
      
      <ScrollView style={styles.container} contentContainerStyle={styles.scrollContent}>
        {user?.premium ? (
          <View style={styles.currentPlanBox}>
            <View style={styles.premiumHeader}>
              <View style={styles.crownCircle}>
                <MaterialCommunityIcons name="crown" size={32} color="#fff" />
              </View>
              <View style={styles.premiumTitle}>
                <View style={styles.premiumBadgeContainer}>
                  <Text style={styles.premiumBadgeText}>PREMIUM MEMBER</Text>
                </View>
                <View style={styles.currentPlanNameWrap}>
                  <Text style={styles.currentPlanName}>{user.premium.planName}</Text>
                </View>
              </View>
            </View>
            <View style={styles.premiumDivider} />
            <View style={styles.expiryBox}>
              <View style={styles.expiryIconBox}>
                <Feather name="calendar" size={14} color="#d97706" />
              </View>
              <Text style={styles.expiryText}>
                Hạn dùng đến: <Text style={styles.expiryDate}>{new Date(user.premium.expiryDate).toLocaleDateString('vi-VN')}</Text>
              </Text>
            </View>
          </View>
        ) : (
          <View style={styles.header}>
            <Text style={styles.title}>Nâng cấp tài khoản</Text>
            <Text style={styles.subtitle}>Tận hưởng trọn bộ tính năng cao cấp từ NutriChef</Text>
          </View>
        )}

        {loading ? (
          <View style={styles.center}><ActivityIndicator size="large" color="#6366f1" /></View>
        ) : (
          <View style={styles.plansContainer}>
            {plans.map((plan) => (
              <PlanCard
                key={plan.plan_id}
                plan={plan}
                onSelect={setSelectedPlan}
                isSelected={selectedPlan?.plan_id === plan.plan_id}
              />
            ))}
          </View>
        )}

        {!user?.premium && (
          <View style={styles.footer}>
            <Pressable
              style={({ pressed }) => [
                styles.upgradeBtn,
                (!selectedPlan || submitting) && styles.disabledBtn,
                pressed && styles.upgradeBtnPressed
              ]}
              onPress={handleUpgrade}
              disabled={!selectedPlan || submitting}
            >
              {submitting ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <View style={styles.upgradeBtnInner}>
                  <MaterialCommunityIcons name="crown" size={24} color="#fff" style={styles.btnIcon} />
                  <Text style={styles.upgradeBtnText}>NÂNG CẤP NGAY</Text>
                </View>
              )}
            </Pressable>
            <Text style={styles.disclaimer}>
              Bằng cách nâng cấp, bạn đồng ý với các Điều khoản và Chính sách của chúng tôi.
            </Text>
          </View>
        )}
      </ScrollView>

      {/* MODAL THANH TOÁN QR */}
      <Modal visible={showQR} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={styles.qrCard}>
            <View style={styles.qrHeader}>
              <Text style={styles.qrTitle}>Quét mã thanh toán</Text>
              <Pressable onPress={() => setShowQR(false)} hitSlop={10}>
                <Feather name="x" size={24} color="#94a3b8" />
              </Pressable>
            </View>

            <View style={styles.qrContainer}>
              {qrUrl ? (
                <Image source={{ uri: qrUrl }} style={styles.qrImage} resizeMode="contain" />
              ) : (
                <ActivityIndicator size="large" color="#6366f1" />
              )}
            </View>

            <View style={styles.paymentInfo}>
              <View style={styles.infoRow}>
                <Text style={styles.infoLabel}>Nội dung chuyển khoản:</Text>
                <Text style={styles.infoValueHighlight}>{currentPayment?.internal_reference}</Text>
              </View>
              <View style={styles.infoRow}>
                <Text style={styles.infoLabel}>Số tiền:</Text>
                <Text style={styles.infoValue}>
                  {new Intl.NumberFormat('vi-VN').format(currentPayment?.amount || 0)}đ
                </Text>
              </View>
            </View>

            <View style={styles.timerBox}>
              <Text style={styles.timerLabel}>Tự động đóng sau:</Text>
              <Text style={styles.timerValue}>{formatTime(timeLeft)}</Text>
            </View>

            <View style={styles.pollingBox}>
              <ActivityIndicator size="small" color="#10b981" />
              <Text style={styles.pollingText}>Đang chờ hệ thống xác nhận thanh toán...</Text>
            </View>
          </View>
        </View>
      </Modal>

      <AppBottomNav activeKey="upgrade" onTabPress={handleBottomTabPress} />

      {/* MODAL THÀNH CÔNG */}
      <Modal visible={showSuccessModal} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={styles.successCard}>
            <View style={styles.successIconCircle}>
              <MaterialCommunityIcons name="crown" size={50} color="#fff" />
            </View>
            <Text style={styles.successTitle}>Nâng cấp thành công!</Text>
            <Text style={styles.successMessage}>
              Chúc mừng bạn đã trở thành hội viên Premium của NutriChef. Hãy tận hưởng các đặc quyền dành riêng cho bạn!
            </Text>
            <Pressable style={styles.successBtn} onPress={handleCloseSuccess}>
              <Text style={styles.successBtnText}>BẮT ĐẦU TRẢI NGHIỆM</Text>
            </Pressable>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#f8fafc' },
  container: { flex: 1 },
  scrollContent: { padding: 20, paddingBottom: 40 },
  header: { alignItems: 'center', marginBottom: 30 },
  title: { fontSize: 28, fontWeight: '900', color: '#0f172a' },
  subtitle: { fontSize: 14, color: '#64748b', marginTop: 8, textAlign: 'center' },
  center: { paddingVertical: 100 },
  plansContainer: { gap: 20 },
  planCard: {
    backgroundColor: '#fff',
    borderRadius: 24,
    padding: 24,
    borderWidth: 2,
    borderColor: '#e2e8f0',
    position: 'relative',
  },
  planCardSelected: {
    borderColor: '#6366f1',
    backgroundColor: '#f5f7ff',
  },
  planCardBest: {
    borderColor: '#f59e0b',
  },
  bestBadge: {
    position: 'absolute',
    top: -12,
    right: 24,
    backgroundColor: '#f59e0b',
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 10,
    shadowColor: '#f59e0b',
    shadowOpacity: 0.3,
    shadowOffset: { width: 0, height: 4 },
    shadowRadius: 6,
    elevation: 3,
  },
  bestBadgeText: { color: '#fff', fontSize: 11, fontWeight: '700', letterSpacing: 0.5 },
  planHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: 16 },
  planTitleContainer: { marginLeft: 16 },
  planName: { fontSize: 20, fontWeight: '800', color: '#1e293b' },
  planDuration: { fontSize: 12, color: '#64748b', marginTop: 2 },
  planPrice: { fontSize: 24, fontWeight: '900', color: '#0f172a', marginBottom: 8 },
  currency: { fontSize: 14, color: '#64748b' },
  planDescription: { fontSize: 14, color: '#475569', marginBottom: 20, lineHeight: 20 },
  featuresList: { borderTopWidth: 1, borderTopColor: '#f1f5f9', paddingTop: 16, gap: 12, marginBottom: 24 },
  featureItem: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  featureText: { fontSize: 13, color: '#334155', fontWeight: '500' },
  footer: { marginTop: 40, alignItems: 'center' },
  upgradeBtn: {
    backgroundColor: '#6366f1',
    width: '100%',
    paddingVertical: 18,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#6366f1',
    shadowOpacity: 0.3,
    shadowOffset: { width: 0, height: 8 },
    shadowRadius: 16,
    elevation: 8,
  },
  upgradeBtnPressed: {
    transform: [{ scale: 0.98 }],
    backgroundColor: '#4f46e5',
    shadowOffset: { width: 0, height: 4 },
    shadowRadius: 8,
  },
  upgradeBtnInner: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  upgradeBtnText: { color: '#fff', fontSize: 17, fontWeight: '700', letterSpacing: 1, textTransform: 'uppercase' },
  btnIcon: { marginRight: 4 },
  disabledBtn: { opacity: 0.5, backgroundColor: '#94a3b8', shadowOpacity: 0 },
  disclaimer: { fontSize: 11, color: '#94a3b8', marginTop: 16, textAlign: 'center' },

  // Styles cho Premium User
  currentPlanBox: {
    backgroundColor: '#fff',
    borderRadius: 28,
    padding: 24,
    marginBottom: 30,
    borderWidth: 1.5,
    borderColor: '#fde68a',
    backgroundColor: '#fffbeb',
    shadowColor: '#f59e0b',
    shadowOpacity: 0.1,
    shadowOffset: { width: 0, height: 10 },
    shadowRadius: 20,
    elevation: 5,
  },
  premiumHeader: { flexDirection: 'row', alignItems: 'center', gap: 18 },
  crownCircle: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: '#f59e0b',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#f59e0b',
    shadowOpacity: 0.4,
    shadowOffset: { width: 0, height: 4 },
    shadowRadius: 8,
  },
  premiumBadgeContainer: {
    backgroundColor: '#fef3c7',
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: 999,
    alignSelf: 'flex-start',
    marginBottom: 6,
    borderWidth: 1,
    borderColor: '#fde68a',
    shadowColor: '#f59e0b',
    shadowOpacity: 0.08,
    shadowOffset: { width: 0, height: 2 },
    shadowRadius: 4,
    elevation: 1,
  },
  premiumBadgeText: { 
    color: '#d97706', 
    fontSize: 10, 
    fontWeight: '900', 
    letterSpacing: 1.1,
    textTransform: 'uppercase',
  },
  currentPlanNameWrap: {
    alignSelf: 'flex-start',
    backgroundColor: '#fff7ed',
    borderWidth: 1,
    borderColor: '#fcd34d',
    borderRadius: 16,
    paddingHorizontal: 12,
    paddingVertical: 8,
    shadowColor: '#f59e0b',
    shadowOpacity: 0.12,
    shadowOffset: { width: 0, height: 3 },
    shadowRadius: 6,
    elevation: 2,
  },
  currentPlanName: {
    fontSize: 24,
    fontWeight: '900',
    color: '#92400e',
    letterSpacing: -0.4,
    lineHeight: 28,
    textTransform: 'uppercase',
  },
  premiumDivider: {
    height: 1,
    backgroundColor: '#fde68a',
    marginVertical: 20,
    opacity: 0.6,
  },
  expiryBox: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  expiryIconBox: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: '#fef3c7',
    justifyContent: 'center',
    alignItems: 'center',
  },
  expiryText: { fontSize: 15, color: '#92400e', fontWeight: '500' },
  expiryDate: { fontWeight: '800', color: '#d97706' },

  // Styles cho Modal QR
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.6)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  qrCard: {
    backgroundColor: '#fff',
    width: '100%',
    borderRadius: 32,
    padding: 24,
    alignItems: 'center',
  },
  qrHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    width: '100%',
    marginBottom: 20,
    alignItems: 'center',
  },
  qrTitle: { fontSize: 20, fontWeight: '800', color: '#0f172a' },
  qrContainer: {
    width: width * 0.7,
    height: width * 0.7,
    backgroundColor: '#f8fafc',
    borderRadius: 24,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 20,
    borderWidth: 1,
    borderColor: '#f1f5f9',
  },
  qrImage: { width: '90%', height: '90%' },
  paymentInfo: { width: '100%', gap: 12, marginBottom: 24 },
  infoRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  infoLabel: { fontSize: 14, color: '#64748b' },
  infoValue: { fontSize: 16, fontWeight: '800', color: '#0f172a' },
  infoValueHighlight: { fontSize: 16, fontWeight: '900', color: '#6366f1' },
  timerBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#fef2f2',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 12,
    marginBottom: 24,
  },
  timerLabel: { fontSize: 13, color: '#ef4444', fontWeight: '600' },
  timerValue: { fontSize: 15, color: '#ef4444', fontWeight: '800' },
  pollingBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: '#f0fdf4',
    padding: 16,
    borderRadius: 16,
    width: '100%',
  },
  pollingText: { flex: 1, fontSize: 13, color: '#15803d', fontWeight: '600' },
  // Success Modal Styles
  successCard: {
    backgroundColor: '#fff',
    width: '90%',
    borderRadius: 32,
    padding: 30,
    alignItems: 'center',
    shadowColor: '#10b981',
    shadowOpacity: 0.2,
    shadowOffset: { width: 0, height: 10 },
    shadowRadius: 20,
    elevation: 10,
  },
  successIconCircle: {
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: '#f59e0b',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 20,
  },
  successTitle: {
    fontSize: 24,
    fontWeight: '900',
    color: '#0f172a',
    marginBottom: 12,
    textAlign: 'center',
  },
  successMessage: {
    fontSize: 15,
    color: '#64748b',
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: 30,
  },
  successBtn: {
    backgroundColor: '#0f172a',
    paddingVertical: 16,
    paddingHorizontal: 30,
    borderRadius: 16,
    width: '100%',
    alignItems: 'center',
  },
  successBtnText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '800',
    letterSpacing: 1,
  },
});

