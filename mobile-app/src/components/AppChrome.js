import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Feather, Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';

const USER_NAV_ITEMS = [
  {
    key: 'home',
    label: 'Trang chủ',
    icon: { family: Feather, name: 'home' },
  },
  {
    key: 'suggest',
    label: 'Gợi ý',
    icon: { family: MaterialCommunityIcons, name: 'creation-outline' },
  },
  {
    key: 'menu',
    label: 'Mâm cơm',
    icon: { family: MaterialCommunityIcons, name: 'silverware-fork-knife' },
  },
  {
    key: 'recipes',
    label: 'Công thức',
    icon: { family: Ionicons, name: 'book-outline' },
  },
  {
    key: 'favorites',
    label: 'Yêu thích',
    icon: { family: Feather, name: 'heart' },
  },
  {
    key: 'upgrade',
    label: 'Nâng cấp',
    icon: { family: MaterialCommunityIcons, name: 'crown-outline' },
  },
];

const ADMIN_NAV_ITEMS = [
  {
    key: 'overview',
    label: 'Tổng quan',
    icon: { family: Feather, name: 'home' },
  },
  {
    key: 'users',
    label: 'Người dùng',
    icon: { family: Feather, name: 'users' },
  },
  {
    key: 'recipes',
    label: 'Công thức',
    icon: { family: Ionicons, name: 'book-outline' },
  },
  {
    key: 'ingredients',
    label: 'Nguyên liệu',
    icon: { family: MaterialCommunityIcons, name: 'cube-outline' },
  },
  {
    key: 'transactions',
    label: 'Giao dịch',
    icon: { family: MaterialCommunityIcons, name: 'swap-horizontal' },
  },
];

const NavIcon = ({ family: IconComponent, name, color, size }) => (
  <IconComponent name={name} size={size} color={color} />
);

export function AppHeader({
  onLoginPress,
  onSignupPress,
  isGuest = true,
  onAccountPress,
}) {
  return (
    <View style={styles.headerWrap}>
      <View style={styles.headerBar}>
        <View style={styles.brandWrap}>
          <View style={styles.brandIcon}>
            <MaterialCommunityIcons name="chef-hat" size={22} color="#ffffff" />
          </View>
          <Text style={styles.brandText}>NutriChef</Text>
        </View>

        {isGuest ? (
          <View style={styles.headerActions}>
            <Pressable onPress={onLoginPress} style={styles.ghostButton}>
              <Text style={styles.ghostButtonText}>Đăng nhập</Text>
            </Pressable>
            <Pressable onPress={onSignupPress} style={styles.primaryButton}>
              <Text style={styles.primaryButtonText}>Đăng ký</Text>
            </Pressable>
          </View>
        ) : (
          <View style={styles.authenticatedActions}>
            <Pressable style={styles.avatarBubble} onPress={onAccountPress}>
              <Feather name="user" size={18} color="#ffffff" />
            </Pressable>
          </View>
        )}
      </View>
    </View>
  );
}

export function AppBottomNav({ activeKey = 'home', onTabPress, role = 'user' }) {
  const navItems = role === 'admin' ? ADMIN_NAV_ITEMS : USER_NAV_ITEMS;
  const isUserRole = role !== 'admin';

  return (
    <View style={[styles.bottomNavWrap, isUserRole && styles.bottomNavWrapUser]}>
      <View style={[styles.bottomNavBar, isUserRole && styles.bottomNavBarUser]}>
        {navItems.map((item) => {
          const active = item.key === activeKey;
          const iconColor = active ? '#ffffff' : '#4b5563';
          const iconSize = 23;

          return (
            <Pressable
              key={item.key}
              onPress={() => onTabPress?.(item.key)}
              style={[styles.navItem, isUserRole && styles.navItemUser]}
            >
              <View style={[styles.navIconBubble, active && styles.navIconBubbleActive]}>
                <NavIcon {...item.icon} size={iconSize} color={iconColor} />
              </View>
              <Text numberOfLines={2} style={[styles.navLabel, active && styles.navLabelActive]}>{item.label}</Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  headerWrap: {
    width: '100%',
    backgroundColor: '#fff7ed',
    borderBottomWidth: 1,
    borderBottomColor: '#fed7aa',
    paddingHorizontal: 0,
    paddingTop: 0,
    paddingBottom: 0,
    marginTop: 0,
    borderTopLeftRadius: 0,
    borderTopRightRadius: 0,
  },
  headerBar: {
    width: '100%',
    maxWidth: 980,
    alignSelf: 'center',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
    paddingVertical: 8,
  },
  brandWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flexShrink: 1,
  },
  brandIcon: {
    width: 42,
    height: 42,
    borderRadius: 14,
    backgroundColor: '#f97316',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#f97316',
    shadowOpacity: 0.22,
    shadowOffset: { width: 0, height: 8 },
    shadowRadius: 14,
    elevation: 3,
  },
  brandText: {
    fontSize: 20,
    fontWeight: '700',
    color: '#f97316',
  },
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginLeft: 8,
  },
  authenticatedActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginLeft: 8,
  },
  avatarBubble: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#f97316',
    alignItems: 'center',
    justifyContent: 'center',
  },
  ghostButton: {
    minHeight: 36,
    paddingHorizontal: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  ghostButtonText: {
    fontSize: 14,
    fontWeight: '500',
    color: '#374151',
  },
  primaryButton: {
    minHeight: 36,
    paddingHorizontal: 10,
    borderRadius: 10,
    backgroundColor: '#f97316',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#f97316',
    shadowOpacity: 0.2,
    shadowOffset: { width: 0, height: 6 },
    shadowRadius: 10,
    elevation: 2,
  },
  primaryButtonText: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: '700',
  },
  bottomNavWrap: {
    width: '100%',
    backgroundColor: '#ffffff',
    borderTopWidth: 1,
    borderTopColor: '#e5e7eb',
    paddingTop: 0,
    paddingBottom: 0,
    paddingHorizontal: 6,
  },
  bottomNavWrapUser: {
    paddingTop: 0,
    paddingBottom: 0,
  },
  bottomNavBar: {
    width: '100%',
    maxWidth: 980,
    alignSelf: 'center',
    minHeight: 76,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#ffffff',
    borderRadius: 0,
    paddingHorizontal: 4,
    paddingTop: 2,
    paddingBottom: 2,
  },
  bottomNavBarUser: {
    minHeight: 76,
    paddingTop: 0,
    paddingBottom: 0,
  },
  navItem: {
    flex: 1,
    minWidth: 0,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 2,
  },
  navItemUser: {
    paddingVertical: 2,
  },
  navIconBubble: {
    width: 52,
    height: 42,
    borderRadius: 14,
    backgroundColor: 'transparent',
    alignItems: 'center',
    justifyContent: 'center',
  },
  navIconBubbleActive: {
    backgroundColor: '#f97316',
  },
  navLabel: {
    marginTop: 4,
    fontSize: 11,
    lineHeight: 13,
    fontWeight: '600',
    color: '#4b5563',
    textAlign: 'center',
  },
  navLabelActive: {
    color: '#f97316',
  },
});