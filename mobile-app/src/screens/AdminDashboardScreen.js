import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  ScrollView,
  StyleSheet,
  Text,
  View,
  Pressable,
  Dimensions,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Feather, MaterialCommunityIcons } from '@expo/vector-icons';
import { AppBottomNav, AppHeader } from '../components/AppChrome';
import { authRequest } from '../services/client';

const { width } = Dimensions.get('window');

// StatCard mới: Sang trọng, sạch sẽ, không có thanh progress gây nhiễu
const StatCard = ({ title, value, icon, color }) => (
  <View style={styles.statCard}>
    <View style={[styles.statIconBox, { backgroundColor: color + '15' }]}>
      <Feather name={icon} size={22} color={color} />
    </View>
    <View style={styles.statContent}>
      <Text style={styles.statLabel}>{title}</Text>
      <Text style={styles.statValue}>{value}</Text>
    </View>
  </View>
);

const ManagementCard = ({ title, subtitle, icon, color, onPress, badge }) => (
  <Pressable 
    style={({ pressed }) => [styles.mgmtCard, pressed && styles.pressed]} 
    onPress={onPress}
  >
    <View style={[styles.mgmtCardIcon, { backgroundColor: color + '15' }]}>
      <Feather name={icon} size={24} color={color} />
      {badge > 0 && (
        <View style={styles.badge}>
          <Text style={styles.badgeText}>{badge > 99 ? '99+' : badge}</Text>
        </View>
      )}
    </View>
    <Text style={styles.mgmtCardTitle}>{title}</Text>
    <Text style={styles.mgmtCardSub} numberOfLines={1}>{subtitle}</Text>
  </Pressable>
);
export default function AdminDashboardScreen({
  user,
  onLogout,
  onNavigateIngredients,
  onNavigateRecipeReview,
  onNavigateUsers,
  onNavigateTransactions,
}) {
  const [stats, setStats] = useState(null);
  const [recentActivities, setRecentActivities] = useState([]);
  const [loading, setLoading] = useState(true);

  const fetchStats = useCallback(async () => {
    try {
      setLoading(true);
      const data = await authRequest('/api/admin/stats');
      setStats(data?.stats || null);
      setRecentActivities(data?.recentActivities || []);
    } catch (error) {
      Alert.alert('Lỗi', 'Không thể tải dữ liệu thống kê.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchStats();
  }, [fetchStats]);

  if (loading) {
    return (
      <SafeAreaView style={styles.screen}>
        <AppHeader isGuest={false} />
        <View style={styles.loadingWrap}>
          <ActivityIndicator size="small" color="#6366f1" />
          <Text style={styles.loadingText}>Đang tải dữ liệu...</Text>
        </View>
        <AppBottomNav role="admin" activeKey="overview" />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.screen} edges={['top', 'bottom']}>
      <AppHeader isGuest={false} onAccountPress={onLogout} />
      
      <ScrollView 
        style={styles.mainContainer} 
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
      >
        <View style={styles.pageHeader}>
          <View>
            <Text style={styles.mainTitle}>Bảng quản trị</Text>
            <Text style={styles.welcomeMsg}>Chào mừng trở lại, Admin</Text>
          </View>
          <Pressable style={styles.refreshIcon} onPress={fetchStats}>
            <Feather name="refresh-cw" size={18} color="#6366f1" />
          </Pressable>
        </View>

        {/* THỐNG KÊ NHANH */}
        <View style={styles.statsGrid}>
          <StatCard 
            title="Người dùng" 
            value={stats?.totalUsers || 0} 
            icon="users" 
            color="#6366f1" 
          />
          <StatCard 
            title="Công thức" 
            value={stats?.totalRecipes || 0} 
            icon="book-open" 
            color="#10b981" 
          />
          <StatCard 
            title="Chờ duyệt" 
            value={stats?.pendingSubmissions || 0} 
            icon="clock" 
            color="#f59e0b" 
          />
          <StatCard 
            title="Nguyên liệu" 
            value={stats?.totalIngredients || 0} 
            icon="package" 
            color="#f43f5e" 
          />
        </View>

        <Text style={styles.groupLabel}>QUẢN LÝ HỆ THỐNG</Text>
        <View style={styles.mgmtGrid}>
          <ManagementCard 
            title="Kho nguyên liệu" 
            subtitle="Cập nhật danh mục"
            icon="layers" 
            color="#6366f1" 
            onPress={onNavigateIngredients}
          />
          <ManagementCard 
            title="Duyệt món ăn" 
            subtitle={`${stats?.pendingSubmissions || 0} yêu cầu`}
            icon="check-circle" 
            color="#10b981" 
            badge={stats?.pendingSubmissions}
            onPress={onNavigateRecipeReview}
          />
          <ManagementCard 
            title="Người dùng" 
            subtitle="Quản lý thành viên"
            icon="user-check" 
            color="#f59e0b" 
            onPress={onNavigateUsers || (() => Alert.alert('Thông báo', 'Tính năng đang được phát triển'))}
          />
          <ManagementCard 
            title="Báo cáo" 
            subtitle="Phân tích dữ liệu"
            icon="pie-chart" 
            color="#f43f5e" 
            onPress={() => Alert.alert('Thông báo', 'Tính năng đang được phát triển')}
          />
        </View>

        <View style={styles.feedHeader}>
          <Text style={styles.groupLabel}>CÔNG THỨC MỚI NHẤT</Text>
          <Pressable onPress={onNavigateRecipeReview}>
            <Text style={styles.textLink}>Xem tất cả</Text>
          </Pressable>
        </View>

        <View style={styles.feedContainer}>
          {recentActivities.length === 0 ? (
            <Text style={styles.emptyText}>Không có hoạt động mới.</Text>
          ) : (
            recentActivities.map((item, index) => (
              <View key={index} style={[styles.feedItem, index === recentActivities.length - 1 && styles.noBorder]}>
                <View style={styles.activityIconBox}>
                  <MaterialCommunityIcons name="chef-hat" size={20} color="#64748b" />
                </View>
                <View style={styles.activityContent}>
                  <Text style={styles.activityTitle} numberOfLines={1}>{item.title}</Text>
                  <Text style={styles.activityMeta}>
                    Bởi {item.author_name} • {new Date(item.created_at).toLocaleDateString('vi-VN')}
                  </Text>
                </View>
              </View>
            ))
          )}
        </View>

        <View style={{ height: 40 }} />
      </ScrollView>

      <AppBottomNav 
        role="admin" 
        activeKey="overview" 
        onTabPress={(key) => {
          if (key === 'overview') fetchStats();
          if (key === 'ingredients') onNavigateIngredients();
          if (key === 'recipes') onNavigateRecipeReview();
          if (key === 'users') onNavigateUsers();
          if (key === 'transactions') onNavigateTransactions();
          if (key === 'profile') onLogout();
        }}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: '#f8fafc',
  },
  mainContainer: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 20,
    paddingTop: 16,
  },
  loadingWrap: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
  },
  loadingText: {
    color: '#94a3b8',
    fontSize: 14,
    fontWeight: '500',
  },
  pageHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 24,
  },
  mainTitle: {
    fontSize: 28,
    fontWeight: '900',
    color: '#1e293b',
    letterSpacing: -0.5,
  },
  welcomeMsg: {
    fontSize: 14,
    color: '#64748b',
    fontWeight: '500',
    marginTop: 2,
  },
  refreshIcon: {
    width: 44,
    height: 44,
    borderRadius: 12,
    backgroundColor: '#fff',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  statsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    gap: 12,
    marginBottom: 24,
  },
  statCard: {
    width: (width - 52) / 2,
    backgroundColor: '#fff',
    borderRadius: 20,
    padding: 14,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    shadowColor: '#000',
    shadowOpacity: 0.02,
    shadowOffset: { width: 0, height: 10 },
    shadowRadius: 20,
    elevation: 2,
    borderWidth: 1,
    borderColor: '#f1f5f9',
  },
  statIconBox: {
    width: 40,
    height: 40,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  statContent: {
    flex: 1,
  },
  statLabel: {
    fontSize: 11,
    color: '#64748b',
    fontWeight: '600',
  },
  statValue: {
    fontSize: 18,
    fontWeight: '800',
    color: '#0f172a',
    marginTop: 1,
  },
  groupLabel: {
    fontSize: 12,
    fontWeight: '800',
    color: '#94a3b8',
    marginBottom: 16,
    letterSpacing: 1.2,
    paddingLeft: 4,
  },
  mgmtGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    gap: 12,
    marginBottom: 30,
  },
  mgmtCard: {
    width: (width - 52) / 2,
    backgroundColor: '#fff',
    borderRadius: 24,
    padding: 16,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#f1f5f9',
    shadowColor: '#000',
    shadowOpacity: 0.03,
    shadowOffset: { width: 0, height: 12 },
    shadowRadius: 24,
    elevation: 3,
  },
  mgmtCardIcon: {
    width: 56,
    height: 56,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
    position: 'relative',
  },
  mgmtCardTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: '#1e293b',
    textAlign: 'center',
  },
  mgmtCardSub: {
    fontSize: 11,
    color: '#94a3b8',
    marginTop: 4,
    textAlign: 'center',
  },
  badge: {
    position: 'absolute',
    top: -4,
    right: -4,
    backgroundColor: '#f43f5e',
    borderRadius: 10,
    minWidth: 20,
    height: 20,
    paddingHorizontal: 6,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: '#fff',
  },
  badgeText: {
    color: '#fff',
    fontSize: 10,
    fontWeight: '800',
  },
  pressed: {
    transform: [{ scale: 0.98 }],
    backgroundColor: '#f8fafc',
  },
  feedHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  textLink: {
    fontSize: 13,
    color: '#6366f1',
    fontWeight: '700',
    marginBottom: 16,
  },
  feedContainer: {
    backgroundColor: '#fff',
    borderRadius: 24,
    paddingHorizontal: 20,
    borderWidth: 1,
    borderColor: '#f1f5f9',
  },
  feedItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 18,
    borderBottomWidth: 1,
    borderBottomColor: '#f1f5f9',
  },
  noBorder: {
    borderBottomWidth: 0,
  },
  activityIconBox: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: '#f8fafc',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 14,
  },
  activityContent: {
    flex: 1,
  },
  activityTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: '#334155',
  },
  activityMeta: {
    fontSize: 12,
    color: '#94a3b8',
    marginTop: 4,
  },
  emptyText: {
    textAlign: 'center',
    color: '#94a3b8',
    paddingVertical: 40,
    fontSize: 14,
  },
});
