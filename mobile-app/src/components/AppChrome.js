import React from 'react';
import { Pressable, StyleSheet, Text, View, ScrollView } from 'react-native';
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
    key: 'shopping',
    label: 'Giỏ',
    icon: { family: MaterialCommunityIcons, name: 'cart-outline' },
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
  user,
  onUpgradePress,
}) {
  const isAdmin = 
    user?.role?.toLowerCase() === 'admin' || 
    user?.primaryRole?.toLowerCase() === 'admin';
  const premiumData = user?.premium;
  const isPremiumActive =
    premiumData && (!premiumData.expiryDate || new Date(premiumData.expiryDate) > new Date());

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
            {isAdmin ? (
              <View style={[styles.upgradeBadge, styles.adminBadge]}>
                <Feather name="shield" size={14} color="#0ea5e9" />
                <Text style={[styles.upgradeText, styles.adminText]}>Quản trị viên</Text>
              </View>
            ) : (
              <Pressable style={styles.upgradeBadge} onPress={onUpgradePress}>
                <MaterialCommunityIcons name="crown" size={16} color="#f59e0b" />
                <Text style={styles.upgradeText}>
                  {isPremiumActive ? premiumData.planName : 'Nâng cấp Premium'}
                </Text>
              </Pressable>
            )}

            <Pressable style={styles.avatarBubble} onPress={onAccountPress}>
              <Feather name="user" size={18} color="#ffffff" />
            </Pressable>
          </View>
        )}
      </View>
    </View>
  );
}

import { Modal } from 'react-native';

export function AppAccountMenu({ 
  visible, 
  onClose, 
  user, 
  onLogout,
  onAchievementPress
}) {
  const displayName = user?.fullName || user?.name || 'Người dùng';
  const displayEmail = user?.email || 'user@nutrichef.app';

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
    >
      <Pressable style={styles.menuBackdrop} onPress={onClose}>
        <View style={styles.menuPopup}>
          <View style={styles.menuHeader}>
            <Text style={styles.menuName}>{displayName}</Text>
            <Text style={styles.menuEmail}>{displayEmail}</Text>
          </View>

          {onAchievementPress && (
            <Pressable
              style={styles.menuRow}
              onPress={() => {
                onClose();
                onAchievementPress?.();
              }}
            >
              <View style={styles.menuIconWrap}>
                <Feather name="award" size={18} color="#f97316" />
              </View>
              <Text style={styles.menuText}>Thành tựu</Text>
            </Pressable>
          )}

          <Pressable

            style={styles.menuRow}
            onPress={() => {
              onClose();
              onLogout?.();
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
  );
}

export function AppBottomNav({ activeKey = 'home', onTabPress, role = 'user', user, usageCount = 0 }) {
  const navItems = role === 'admin' ? ADMIN_NAV_ITEMS : USER_NAV_ITEMS;
  const isUserRole = role !== 'admin';
  const MAX_FREE_USAGE = 3;
  const isPremium = user?.premium && (!user.premium.expiryDate || new Date(user.premium.expiryDate) > new Date());
  const isLimitReached = !isPremium && usageCount >= MAX_FREE_USAGE;

  return (
    <View style={[styles.bottomNavWrap, isUserRole && styles.bottomNavWrapUser]}>
      <View style={[styles.bottomNavBar, isUserRole && styles.bottomNavBarUser]}>
        {navItems.map((item) => {
          const active = item.key === activeKey;
          const iconColor = active ? '#ffffff' : '#4b5563';
          const iconSize = 23;
          
          let showLimitCrown = false;
          if (role !== 'admin') {
            if (item.key === 'suggest') {
              showLimitCrown = isLimitReached;
            } else if (item.key === 'menu' || item.key === 'recipes') {
              showLimitCrown = !isPremium;
            }
          }

          return (
            <Pressable
              key={item.key}
              onPress={() => onTabPress?.(item.key)}
              style={[styles.navItem, isUserRole && styles.navItemUser]}
            >
              <View style={[styles.navIconBubble, active && styles.navIconBubbleActive]}>
                <NavIcon {...item.icon} size={iconSize} color={iconColor} />
                {showLimitCrown && (
                  <View style={styles.navLimitCrown}>
                    <MaterialCommunityIcons name="crown" size={10} color="#f59e0b" />
                  </View>
                )}
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
    marginLeft: 4,
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
    marginRight: 4,
  },
  authenticatedActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginLeft: 8,
    marginRight: 4,
  },
  upgradeBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fffbeb',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#fde68a',
    gap: 6,
  },
  upgradeText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#b45309',
  },
  adminBadge: {
    backgroundColor: '#f0f9ff',
    borderColor: '#bae6fd',
  },
  adminText: {
    color: '#0369a1',
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
  navLimitCrown: {
    position: 'absolute',
    top: -4,
    right: -4,
    backgroundColor: '#fffbeb',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#fde68a',
    padding: 1,
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
  menuBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(17, 24, 39, 0.25)',
    justifyContent: 'flex-start',
  },
  menuPopup: {
    marginTop: 64,
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
  achievementsContainer: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    padding: 20,
  },
  achievementsContent: {
    backgroundColor: '#ffffff',
    borderRadius: 24,
    maxHeight: '80%',
    overflow: 'hidden',
  },
  achievementsHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 24,
    borderBottomWidth: 1,
    borderBottomColor: '#f3f4f6',
  },
  achievementsTitle: {
    fontSize: 22,
    fontWeight: '800',
    color: '#111827',
  },
  achievementsSubtitle: {
    fontSize: 14,
    color: '#6b7280',
    marginTop: 2,
  },
  closeButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#f3f4f6',
    alignItems: 'center',
    justifyContent: 'center',
  },
  achievementsScroll: {
    padding: 20,
  },
  premiumBadgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fffbeb',
    padding: 16,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#fde68a',
    marginBottom: 20,
    gap: 12,
  },
  premiumIconWrap: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#fef3c7',
    alignItems: 'center',
    justifyContent: 'center',
  },
  premiumBadgeInfo: {
    flex: 1,
  },
  premiumBadgeTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#92400e',
  },
  premiumBadgeDesc: {
    fontSize: 13,
    color: '#b45309',
    marginTop: 1,
  },
  achievementCard: {
    flexDirection: 'row',
    backgroundColor: '#f9fafb',
    padding: 16,
    borderRadius: 20,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#f3f4f6',
    gap: 16,
  },
  achievementCardCompleted: {
    backgroundColor: '#ffffff',
    borderColor: '#d1fae5',
    borderWidth: 1,
    shadowColor: '#10b981',
    shadowOpacity: 0.05,
    shadowOffset: { width: 0, height: 4 },
    shadowRadius: 10,
    elevation: 2,
  },
  achievementIconWrap: {
    width: 52,
    height: 52,
    borderRadius: 18,
    backgroundColor: '#f3f4f6',
    alignItems: 'center',
    justifyContent: 'center',
  },
  achievementIconWrapCompleted: {
    backgroundColor: '#10b981',
  },
  achievementInfo: {
    flex: 1,
  },
  achievementRowHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  achievementName: {
    fontSize: 16,
    fontWeight: '700',
    color: '#374151',
  },
  achievementProgressText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#6b7280',
  },
  achievementDesc: {
    fontSize: 13,
    color: '#6b7280',
    marginTop: 4,
    marginBottom: 10,
    lineHeight: 18,
  },
  progressBarBg: {
    height: 6,
    backgroundColor: '#e5e7eb',
    borderRadius: 3,
    overflow: 'hidden',
  },
  progressBarFill: {
    height: '100%',
    backgroundColor: '#f97316',
  },
  progressBarFillCompleted: {
    backgroundColor: '#10b981',
  },
});