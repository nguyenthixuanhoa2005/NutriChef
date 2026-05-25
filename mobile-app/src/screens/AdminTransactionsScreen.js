import React, { useEffect, useState, useCallback, useMemo } from 'react';
import {
  StyleSheet,
  View,
  Text,
  FlatList,
  ActivityIndicator,
  Alert,
  Pressable,
  TextInput,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Feather, MaterialCommunityIcons } from '@expo/vector-icons';
import { AppHeader, AppBottomNav } from '../components/AppChrome';
import { authRequest } from '../services/client';

const StatusBadge = ({ status }) => {
  const getStatusConfig = (s) => {
    switch (s?.toUpperCase()) {
      case 'SUCCESS':
        return { label: 'Thành công', color: '#10b981', bg: '#ecfdf5' };
      case 'PENDING':
        return { label: 'Chờ thanh toán', color: '#f59e0b', bg: '#fffbeb' };
      case 'FAILED':
        return { label: 'Thất bại', color: '#ef4444', bg: '#fef2f2' };
      case 'CANCELLED':
        return { label: 'Đã hủy', color: '#6b7280', bg: '#f3f4f6' };
      default:
        return { label: s, color: '#6366f1', bg: '#f5f7ff' };
    }
  };

  const config = getStatusConfig(status);
  return (
    <View style={[styles.badge, { backgroundColor: config.bg }]}>
      <Text style={[styles.badgeText, { color: config.color }]}>{config.label}</Text>
    </View>
  );
};

const TransactionItem = ({ item }) => (
  <View style={styles.transactionCard}>
    <View style={styles.cardHeader}>
      <View style={styles.userInfo}>
        <Text style={styles.userName}>{item.user_name}</Text>
        <Text style={styles.userEmail}>{item.user_email}</Text>
      </View>
      <StatusBadge status={item.status} />
    </View>

    <View style={styles.cardDivider} />

    <View style={styles.cardBody}>
      <View style={styles.infoRow}>
        <MaterialCommunityIcons name="package-variant-closed" size={16} color="#64748b" />
        <Text style={styles.infoLabel}>Gói nâng cấp:</Text>
        <Text style={styles.infoValue}>{item.plan_name}</Text>
      </View>
      
      <View style={styles.infoRow}>
        <MaterialCommunityIcons name="currency-usd" size={16} color="#64748b" />
        <Text style={styles.infoLabel}>Số tiền:</Text>
        <Text style={styles.priceValue}>
          {new Intl.NumberFormat('vi-VN').format(item.amount)} VNĐ
        </Text>
      </View>

      <View style={styles.infoRow}>
        <Feather name="calendar" size={14} color="#64748b" />
        <Text style={styles.infoLabel}>Ngày tạo:</Text>
        <Text style={styles.infoValue}>
          {new Date(item.create_at).toLocaleString('vi-VN')}
        </Text>
      </View>
    </View>

    <Text style={styles.txCode}>Mã: {item.transaction_code || item.payment_id}</Text>
  </View>
);

export default function AdminTransactionsScreen({
  user,
  onLogout,
  onNavigateOverview,
  onNavigateIngredients,
  onNavigateRecipeReview,
  onNavigateUsers,
}) {
  const [transactions, setTransactions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchText, setSearchText] = useState('');

  const fetchTransactions = useCallback(async () => {
    try {
      setLoading(true);
      const response = await authRequest('/api/admin/payments');
      setTransactions(Array.isArray(response.payments) ? response.payments : []);
    } catch (error) {
      Alert.alert('Lỗi', 'Không thể tải danh sách giao dịch.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchTransactions();
  }, [fetchTransactions]);

  const filteredTransactions = useMemo(() => {
    if (!searchText.trim()) return transactions;
    const query = searchText.toLowerCase();
    return transactions.filter((t) => 
      t.user_name?.toLowerCase().includes(query) ||
      t.user_email?.toLowerCase().includes(query) ||
      String(t.transaction_code || '').toLowerCase().includes(query) ||
      String(t.payment_id).includes(query)
    );
  }, [transactions, searchText]);

  const handleTabPress = (k) => {
    if (k === 'overview') onNavigateOverview();
    if (k === 'ingredients') onNavigateIngredients();
    if (k === 'recipes') onNavigateRecipeReview();
    if (k === 'users') onNavigateUsers();
    if (k === 'profile') onLogout();
  };

  return (
    <SafeAreaView style={styles.screen} edges={['top', 'bottom']}>
      <AppHeader isGuest={false} onAccountPress={onLogout} user={user} />
      
      <View style={styles.container}>
        <View style={styles.header}>
          <Text style={styles.title}>Quản lý giao dịch</Text>
          <Pressable style={styles.refreshBtn} onPress={fetchTransactions} hitSlop={10}>
            <Feather name="refresh-cw" size={20} color="#6366f1" />
          </Pressable>
        </View>

        <View style={styles.searchContainer}>
          <View style={styles.searchBar}>
            <Feather name="search" size={18} color="#94a3b8" />
            <TextInput
              style={styles.searchInput}
              placeholder="Tìm theo tên, email, mã giao dịch..."
              value={searchText}
              onChangeText={setSearchText}
              placeholderTextColor="#94a3b8"
            />
            {searchText !== '' && (
              <Pressable onPress={() => setSearchText('')}>
                <Feather name="x-circle" size={18} color="#94a3b8" />
              </Pressable>
            )}
          </View>
        </View>

        {loading ? (
          <View style={styles.center}><ActivityIndicator size="small" color="#6366f1" /></View>
        ) : (
          <FlatList
            data={filteredTransactions}
            keyExtractor={(item) => item.payment_id.toString()}
            renderItem={({ item }) => <TransactionItem item={item} />}
            contentContainerStyle={styles.listContent}
            ListEmptyComponent={
              <View style={styles.emptyContainer}>
                <MaterialCommunityIcons name="swap-horizontal" size={64} color="#cbd5e1" />
                <Text style={styles.emptyText}>
                  {searchText ? 'Không tìm thấy giao dịch nào' : 'Chưa có giao dịch nào'}
                </Text>
              </View>
            }
          />
        )}
      </View>

      <AppBottomNav role="admin" activeKey="transactions" onTabPress={handleTabPress} />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#f8fafc' },
  container: { flex: 1, padding: 16 },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 },
  title: { fontSize: 22, fontWeight: '900', color: '#0f172a' },
  refreshBtn: { width: 40, height: 40, borderRadius: 12, backgroundColor: '#eff6ff', alignItems: 'center', justifyContent: 'center' },
  searchContainer: { marginBottom: 16 },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    borderRadius: 16,
    paddingHorizontal: 12,
    height: 50,
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  searchInput: {
    flex: 1,
    marginLeft: 8,
    fontSize: 14,
    color: '#1e293b',
  },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  listContent: { paddingBottom: 20 },
  transactionCard: {
    backgroundColor: '#fff',
    borderRadius: 20,
    padding: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    elevation: 2,
    shadowColor: '#000',
    shadowOpacity: 0.05,
    shadowOffset: { width: 0, height: 2 },
    shadowRadius: 8,
  },
  cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
  userInfo: { flex: 1, marginRight: 10 },
  userName: { fontSize: 16, fontWeight: '800', color: '#1e293b' },
  userEmail: { fontSize: 13, color: '#64748b', marginTop: 2 },
  badge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 8 },
  badgeText: { fontSize: 11, fontWeight: '800' },
  cardDivider: { height: 1, backgroundColor: '#f1f5f9', marginVertical: 12 },
  cardBody: { gap: 8 },
  infoRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  infoLabel: { fontSize: 13, color: '#64748b', width: 100 },
  infoValue: { fontSize: 13, color: '#334155', fontWeight: '600', flex: 1 },
  priceValue: { fontSize: 14, color: '#0f172a', fontWeight: '800', flex: 1 },
  txCode: { fontSize: 10, color: '#94a3b8', marginTop: 12, textAlign: 'right', fontStyle: 'italic' },
  emptyContainer: { alignItems: 'center', justifyContent: 'center', paddingVertical: 100 },
  emptyText: { marginTop: 16, color: '#94a3b8', fontSize: 15, fontWeight: '600' },
});
