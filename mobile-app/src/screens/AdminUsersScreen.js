import React, { useState, useEffect, useCallback } from 'react';
import {
  StyleSheet,
  View,
  Text,
  FlatList,
  TextInput,
  Pressable,
  ActivityIndicator,
  Alert,
  Modal,
  ScrollView,
  Dimensions,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';
import { AppHeader, AppBottomNav } from '../components/AppChrome';
import { authRequest } from '../services/client';

const { width } = Dimensions.get('window');

const UserCard = ({ user, onPress, onEdit, onDelete }) => (
  <View style={styles.userCard}>
    <Pressable style={styles.userCardMain} onPress={() => onPress(user)}>
      <View style={styles.userAvatar}>
        <View style={[styles.avatarPlaceholder, { backgroundColor: user.role === 'admin' ? '#fecaca' : '#e2e8f0' }]}>
          <Text style={[styles.avatarText, { color: user.role === 'admin' ? '#ef4444' : '#64748b' }]}>
            {user.full_name?.charAt(0).toUpperCase() || 'U'}
          </Text>
        </View>
        {user.role === 'admin' && (
          <View style={styles.adminBadge}>
            <Feather name="shield" size={10} color="#fff" />
          </View>
        )}
      </View>
      <View style={styles.userInfo}>
        <Text style={styles.userName} numberOfLines={1}>{user.full_name}</Text>
        <Text style={styles.userEmail} numberOfLines={1}>{user.email}</Text>
        <View style={styles.userMeta}>
          <Text style={styles.userRole}>{user.role === 'admin' ? 'Quản trị' : 'Thành viên'}</Text>
          <Text style={styles.dot}>•</Text>
          <Text style={styles.userDate}>{new Date(user.created_at).toLocaleDateString('vi-VN')}</Text>
        </View>
      </View>
    </Pressable>
    
    <View style={styles.userActions}>
      <Pressable style={[styles.actionBtn, styles.editBtnBg]} onPress={() => onEdit(user)} hitSlop={15}>
        <Feather name="edit-2" size={16} color="#4f46e5" />
      </Pressable>
      <Pressable style={[styles.actionBtn, styles.deleteBtnBg]} onPress={() => onDelete(user.id)} hitSlop={15}>
        <Feather name="trash-2" size={16} color="#dc2626" />
      </Pressable>
    </View>
  </View>
);

export default function AdminUsersScreen({
  onLogout,
  onNavigateOverview,
  onNavigateIngredients,
  onNavigateRecipeReview,
  onNavigateTransactions
}) {  const [users, setUsers] = useState([]);
  const [filteredUsers, setFilteredUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterRole, setFilterRole] = useState('all');
  
  const [isModalVisible, setIsModalVisible] = useState(false);
  const [isDetailVisible, setIsDetailVisible] = useState(false);
  const [editingUser, setEditingUser] = useState(null);
  const [selectedUser, setSelectedUser] = useState(null);
  const [userRecipes, setUserRecipes] = useState([]);
  const [loadingRecipes, setLoadingRecipes] = useState(false);

  const [formData, setFormData] = useState({ full_name: '', email: '', password: '', role: 'user' });
  const [errors, setErrors] = useState({});

  const fetchUsers = useCallback(async () => {
    try {
      setLoading(true);
      const response = await authRequest('/api/admin/users');
      setUsers(Array.isArray(response) ? response : []);
      setFilteredUsers(Array.isArray(response) ? response : []);
    } catch (error) {
      Alert.alert('Lỗi', 'Không thể tải danh sách người dùng.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchUsers(); }, [fetchUsers]);

  useEffect(() => {
    let result = users;
    if (searchQuery) {
      result = result.filter(u => 
        u.full_name?.toLowerCase().includes(searchQuery.toLowerCase()) || 
        u.email?.toLowerCase().includes(searchQuery.toLowerCase())
      );
    }
    if (filterRole !== 'all') result = result.filter(u => u.role === filterRole);
    setFilteredUsers(result);
  }, [searchQuery, filterRole, users]);

  const validate = () => {
    let nextErrors = {};
    if (!formData.full_name?.trim()) nextErrors.full_name = true;
    if (!formData.email?.trim()) nextErrors.email = true;
    if (!editingUser && !formData.password?.trim()) nextErrors.password = true;
    setErrors(nextErrors);
    return Object.keys(nextErrors).length === 0;
  };

  const updateField = (field, value) => {
    setFormData({ ...formData, [field]: value });
    if (errors[field]) setErrors({ ...errors, [field]: false });
  };

  const handleOpenAddModal = () => {
    setEditingUser(null);
    setFormData({ full_name: '', email: '', password: '', role: 'user' });
    setErrors({});
    setIsModalVisible(true);
  };

  const handleOpenEditModal = (user) => {
    setEditingUser(user);
    setFormData({ full_name: user.full_name, email: user.email, password: '', role: user.role });
    setErrors({});
    setIsModalVisible(true);
  };

  const handleDeleteUser = (id) => {
    Alert.alert('Xác nhận xóa', 'Bạn có chắc chắn muốn xóa người dùng này?', [
      { text: 'Hủy', style: 'cancel' },
      { text: 'Xóa ngay', style: 'destructive', onPress: async () => {
          try {
            await authRequest(`/api/admin/users/${id}`, { method: 'DELETE' });
            Alert.alert('Thành công', 'Đã xóa người dùng.');
            fetchUsers();
          } catch (error) { Alert.alert('Lỗi', 'Thao tác thất bại.'); }
        }
      }
    ]);
  };

  const handleOpenUserDetails = async (user) => {
    setSelectedUser(user);
    setIsDetailVisible(true);
    setLoadingRecipes(true);
    try {
      const data = await authRequest(`/api/admin/users/${user.id}/recipes`);
      setUserRecipes(Array.isArray(data?.recipes) ? data.recipes : []);
    } catch (error) {
      setUserRecipes([]);
      Alert.alert('Lỗi', error.message || 'Không thể tải công thức của người dùng.');
    } finally {
      setLoadingRecipes(false);
    }
  };

  const handleSubmit = async () => {
    if (!validate()) {
      Alert.alert('Lỗi', 'Vui lòng nhập đầy đủ các thông tin có dấu (*)');
      return;
    }
    try {
      setSubmitting(true);
      if (editingUser) {
        await authRequest(`/api/admin/users/${editingUser.id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(formData),
        });
      } else {
        await authRequest('/api/admin/users', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(formData),
        });
      }
      setIsModalVisible(false);
      Alert.alert('Thành công', 'Dữ liệu đã được cập nhật.');
      fetchUsers();
    } catch (error) { Alert.alert('Lỗi', error.message || 'Không thể lưu.'); }
    finally { setSubmitting(false); }
  };

  return (
    <SafeAreaView style={styles.screen} edges={['top', 'bottom']}>
      <AppHeader isGuest={false} onAccountPress={onLogout} />
      <View style={styles.container}>
        <View style={styles.header}>
          <Text style={styles.title}>Quản lý người dùng</Text>
          <Pressable style={styles.addBtn} onPress={handleOpenAddModal} hitSlop={10}>
            <Feather name="user-plus" size={20} color="#fff" />
          </Pressable>
        </View>

        <View style={styles.searchBar}>
          <Feather name="search" size={18} color="#94a3b8" />
          <TextInput style={styles.searchInput} placeholder="Tìm theo tên hoặc email..." value={searchQuery} onChangeText={setSearchQuery} />
        </View>

        <View style={styles.filterRow}>
          <ScrollView horizontal showsHorizontalScrollIndicator={false}>
            {['all', 'admin', 'user'].map(val => (
              <Pressable key={val} style={[styles.filterTag, filterRole === val && styles.filterTagActive]} onPress={() => setFilterRole(val)}>
                <Text style={[styles.filterTagText, filterRole === val && styles.filterTagActiveText]}>
                  {val === 'all' ? 'Tất cả' : val === 'admin' ? 'Quản trị' : 'Thành viên'}
                </Text>
              </Pressable>
            ))}
          </ScrollView>
        </View>

        {loading ? (
          <View style={styles.center}><ActivityIndicator size="small" color="#6366f1" /></View>
        ) : (
          <FlatList
            data={filteredUsers}
            keyExtractor={item => item.id.toString()}
            renderItem={({ item }) => <UserCard user={item} onPress={handleOpenUserDetails} onEdit={handleOpenEditModal} onDelete={handleDeleteUser} />}
            contentContainerStyle={styles.listContent}
          />
        )}
      </View>

      <Modal visible={isModalVisible} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>{editingUser ? 'Sửa người dùng' : 'Thêm người dùng'}</Text>
              <Pressable onPress={() => setIsModalVisible(false)} hitSlop={15}><Feather name="x" size={22} color="#64748b" /></Pressable>
            </View>
            <ScrollView style={styles.modalBody}>
              <Text style={styles.inputLabel}>Họ và tên <Text style={styles.requiredStar}>*</Text></Text>
              <TextInput style={[styles.input, errors.full_name && styles.inputError]} value={formData.full_name} onChangeText={t => updateField('full_name', t)} placeholder="Nhập họ tên" />
              
              <Text style={styles.inputLabel}>Email <Text style={styles.requiredStar}>*</Text></Text>
              <TextInput style={[styles.input, errors.email && styles.inputError]} value={formData.email} onChangeText={t => updateField('email', t)} autoCapitalize="none" keyboardType="email-address" placeholder="example@gmail.com" />
              
              <Text style={styles.inputLabel}>Mật khẩu {editingUser ? '(Để trống nếu giữ cũ)' : <Text style={styles.requiredStar}>*</Text>}</Text>
              <TextInput style={[styles.input, errors.password && styles.inputError]} value={formData.password} onChangeText={t => updateField('password', t)} secureTextEntry placeholder="Nhập mật khẩu" />
              
              <View style={styles.rolePicker}>
                <Pressable style={[styles.roleOption, formData.role === 'user' && styles.roleOptionActive]} onPress={() => updateField('role', 'user')}>
                  <Text style={[styles.roleText, formData.role === 'user' && styles.roleTextActive]}>Thành viên</Text>
                </Pressable>
                <Pressable style={[styles.roleOption, formData.role === 'admin' && styles.roleOptionActive]} onPress={() => updateField('role', 'admin')}>
                  <Text style={[styles.roleText, formData.role === 'admin' && styles.roleTextActive]}>Quản trị</Text>
                </Pressable>
              </View>
              <View style={{ height: 20 }} />
            </ScrollView>
            <View style={styles.modalFooter}>
              <Pressable style={[styles.saveBtn, submitting && styles.disabledBtn]} onPress={handleSubmit} disabled={submitting}>
                {submitting ? <ActivityIndicator color="#fff" /> : <Text style={styles.saveBtnText}>Lưu thay đổi</Text>}
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>

      <Modal visible={isDetailVisible} animationType="fade" transparent>
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, styles.detailModalContent]}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Thông tin</Text>
              <Pressable onPress={() => setIsDetailVisible(false)} hitSlop={15}><Feather name="x" size={22} color="#64748b" /></Pressable>
            </View>

            <View style={styles.detailHeaderCard}>
              <Text style={styles.detailName}>{selectedUser?.full_name}</Text>
              <Text style={styles.detailEmail}>{selectedUser?.email}</Text>
              <Text style={styles.detailRoleText}>{selectedUser?.role === 'admin' ? 'Quản trị viên' : 'Thành viên'}</Text>
              <Text style={styles.detailJoinText}>Ngày tạo: {selectedUser?.created_at ? new Date(selectedUser.created_at).toLocaleDateString('vi-VN') : '--'}</Text>
            </View>

            <View style={styles.detailSectionHeader}>
              <Text style={styles.detailSectionTitle}>Công thức đã đăng</Text>
              <Text style={styles.detailCount}>{userRecipes.length}</Text>
            </View>

            {loadingRecipes ? (
              <View style={styles.center}><ActivityIndicator size="small" color="#6366f1" /></View>
            ) : (
              <ScrollView style={styles.detailRecipeList} contentContainerStyle={styles.detailRecipeListContent}>
                {userRecipes.length === 0 ? (
                  <Text style={styles.detailEmptyText}>Người dùng này chưa đăng công thức nào.</Text>
                ) : (
                  userRecipes.map((item) => {
                    const normalizedStatus = String(item.status || '').toUpperCase();
                    const statusLabel = normalizedStatus === 'APPROVED'
                      ? 'Đã duyệt'
                      : normalizedStatus === 'PENDING'
                        ? 'Chờ duyệt'
                        : normalizedStatus === 'REJECTED'
                          ? 'Từ chối'
                          : normalizedStatus;

                    return (
                      <View key={`${item.source}-${item.item_id}`} style={styles.detailRecipeItem}>
                        <View style={styles.detailRecipeTopRow}>
                          <Text style={styles.detailRecipeTitle} numberOfLines={1}>{item.title}</Text>
                          <Text style={styles.detailRecipeStatus}>{statusLabel}</Text>
                        </View>
                        <Text style={styles.detailRecipeMeta}>
                          {item.source === 'submission' ? 'Bản gửi duyệt' : 'Đã vào kho'} • {item.created_at ? new Date(item.created_at).toLocaleDateString('vi-VN') : '--'}
                        </Text>
                      </View>
                    );
                  })
                )}
              </ScrollView>
            )}
          </View>
        </View>
      </Modal>

      <AppBottomNav role="admin" activeKey="users" onTabPress={(k) => {
        if (k === 'overview') onNavigateOverview();
        if (k === 'ingredients') onNavigateIngredients();
        if (k === 'recipes') onNavigateRecipeReview();
        if (k === 'transactions') onNavigateTransactions();
        if (k === 'profile') onLogout();
      }} />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#f8fafc' },
  container: { flex: 1, padding: 16 },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 },
  title: { fontSize: 22, fontWeight: '900', color: '#0f172a' },
  addBtn: { backgroundColor: '#6366f1', width: 42, height: 42, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  searchBar: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#fff', borderRadius: 14, paddingHorizontal: 12, height: 48, borderWidth: 1, borderColor: '#e2e8f0', marginBottom: 16 },
  searchInput: { flex: 1, marginLeft: 10, fontSize: 15 },
  filterRow: { marginBottom: 16 },
  filterTag: { paddingHorizontal: 16, paddingVertical: 8, borderRadius: 20, backgroundColor: '#fff', borderWidth: 1, borderColor: '#e2e8f0', marginRight: 8 },
  filterTagActive: { backgroundColor: '#6366f1', borderColor: '#6366f1' },
  filterTagText: { fontSize: 13, fontWeight: '700', color: '#64748b' },
  filterTagActiveText: { color: '#fff' },
  listContent: { paddingBottom: 20 },
  userCard: { flexDirection: 'row', backgroundColor: '#fff', borderRadius: 18, marginBottom: 12, borderWidth: 1, borderColor: '#f1f5f9', elevation: 2, overflow: 'hidden' },
  userCardMain: { flex: 1, flexDirection: 'row', alignItems: 'center', padding: 12 },
  userAvatar: { position: 'relative' },
  avatarPlaceholder: { width: 48, height: 48, borderRadius: 24, alignItems: 'center', justifyContent: 'center' },
  avatarText: { fontSize: 18, fontWeight: '800' },
  adminBadge: { position: 'absolute', bottom: -2, right: -2, backgroundColor: '#ef4444', width: 16, height: 16, borderRadius: 8, alignItems: 'center', justifyContent: 'center', borderWidth: 2, borderColor: '#fff' },
  userInfo: { flex: 1, marginLeft: 12 },
  userName: { fontSize: 16, fontWeight: '700', color: '#1e293b' },
  userEmail: { fontSize: 13, color: '#64748b' },
  userMeta: { flexDirection: 'row', alignItems: 'center', marginTop: 4 },
  userRole: { fontSize: 11, fontWeight: '700', color: '#6366f1' },
  dot: { fontSize: 11, color: '#cbd5e1', marginHorizontal: 4 },
  userDate: { fontSize: 11, color: '#94a3b8' },
  userActions: { flexDirection: 'row', alignItems: 'center', paddingRight: 12, gap: 8 },
  actionBtn: { width: 34, height: 34, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  editBtnBg: { backgroundColor: '#eef2ff' },
  deleteBtnBg: { backgroundColor: '#fef2f2' },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(15, 23, 42, 0.5)', justifyContent: 'flex-end' },
  modalContent: { backgroundColor: '#fff', borderTopLeftRadius: 28, borderTopRightRadius: 28, padding: 24 },
  modalHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 },
  modalTitle: { fontSize: 20, fontWeight: '900', color: '#0f172a' },
  modalBody: { maxHeight: 400 },
  inputLabel: { fontSize: 14, fontWeight: '700', color: '#475569', marginBottom: 8, marginTop: 12 },
  input: { backgroundColor: '#f8fafc', borderWidth: 1, borderColor: '#e2e8f0', borderRadius: 12, padding: 12, fontSize: 15 },
  inputError: { borderColor: '#ef4444', borderWidth: 1.5 },
  requiredStar: { color: '#ef4444' },
  rolePicker: { flexDirection: 'row', gap: 12, marginTop: 12 },
  roleOption: { flex: 1, paddingVertical: 12, borderRadius: 12, borderWidth: 1, borderColor: '#e2e8f0', alignItems: 'center' },
  roleOptionActive: { borderColor: '#6366f1', backgroundColor: '#eef2ff' },
  roleText: { fontSize: 14, fontWeight: '700', color: '#64748b' },
  roleTextActive: { color: '#6366f1' },
  modalFooter: { paddingTop: 20 },
  saveBtn: { backgroundColor: '#6366f1', paddingVertical: 16, borderRadius: 16, alignItems: 'center' },
  saveBtnText: { color: '#fff', fontSize: 16, fontWeight: '800' },
  disabledBtn: { opacity: 0.6 },
  detailName: { fontSize: 22, fontWeight: '900', color: '#0f172a' },
  detailEmail: { fontSize: 15, color: '#64748b', marginTop: 4 },
  detailModalContent: { height: '72%' },
  detailHeaderCard: { backgroundColor: '#f8fafc', borderWidth: 1, borderColor: '#e2e8f0', borderRadius: 14, padding: 14, marginBottom: 14 },
  detailRoleText: { fontSize: 12, fontWeight: '700', color: '#6366f1', marginTop: 8 },
  detailJoinText: { fontSize: 12, color: '#94a3b8', marginTop: 4 },
  detailSectionHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 },
  detailSectionTitle: { fontSize: 15, fontWeight: '800', color: '#1e293b' },
  detailCount: { fontSize: 13, fontWeight: '800', color: '#6366f1' },
  detailRecipeList: { flex: 1 },
  detailRecipeListContent: { paddingBottom: 12 },
  detailRecipeItem: { backgroundColor: '#fff', borderWidth: 1, borderColor: '#e2e8f0', borderRadius: 12, padding: 12, marginBottom: 8 },
  detailRecipeTopRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  detailRecipeTitle: { flex: 1, fontSize: 14, fontWeight: '700', color: '#0f172a' },
  detailRecipeStatus: { fontSize: 11, fontWeight: '700', color: '#f59e0b' },
  detailRecipeMeta: { fontSize: 12, color: '#64748b', marginTop: 4 },
  detailEmptyText: { textAlign: 'center', color: '#94a3b8', marginTop: 24, fontSize: 13 },
});
