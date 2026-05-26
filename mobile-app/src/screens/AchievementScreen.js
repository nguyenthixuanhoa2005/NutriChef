
import React, { useEffect, useState, useCallback } from 'react';
import {
    View,
    Text,
    StyleSheet,
    FlatList,
    Image,
    Pressable,
    ActivityIndicator,
    Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Feather, MaterialCommunityIcons } from '@expo/vector-icons';
import { AppHeader, AppBottomNav } from '../components/AppChrome';
import { getAchievements, equipTitle } from '../services/achievementApi';

const AchievementItem = ({ item, onEquip, isEquipped }) => {
    const progressPercent = Math.min(100, (item.progress / item.criteria_value) * 100);
    const isCompleted = item.is_completed;

    return (
        <View style={[styles.card, isCompleted && styles.cardCompleted]}>
            <View style={styles.cardHeader}>
                <View style={[styles.iconContainer, isCompleted && styles.iconContainerCompleted]}>
                    <MaterialCommunityIcons 
                        name={isCompleted ? "medal" : "medal-outline"} 
                        size={32} 
                        color={isCompleted ? "#f59e0b" : "#94a3b8"} 
                    />
                </View>
                <View style={styles.textContainer}>
                    <Text style={styles.achievementName}>{item.name}</Text>
                    <Text style={styles.achievementDesc}>{item.description}</Text>
                </View>
            </View>

            <View style={styles.progressSection}>
                <View style={styles.progressLabelRow}>
                    <Text style={styles.progressText}>
                        Tiến độ: {item.progress} / {item.criteria_value}
                    </Text>
                    <Text style={styles.percentText}>{Math.floor(progressPercent)}%</Text>
                </View>
                <View style={styles.progressBarBg}>
                    <View style={[styles.progressBarFill, { width: `${progressPercent}%` }]} />
                </View>
            </View>

            {isCompleted && (
                <View style={styles.rewardSection}>
                    <View style={styles.rewardInfo}>
                        <Feather name="award" size={16} color="#059669" />
                        <Text style={styles.rewardText}>Danh hiệu: {item.title_reward}</Text>
                    </View>
                    <Pressable
                        style={[
                            styles.equipBtn,
                            isEquipped && styles.equipBtnActive
                        ]}
                        onPress={() => onEquip(item.title_reward)}
                    >
                        <Text style={[styles.equipBtnText, isEquipped && styles.equipBtnTextActive]}>
                            {isEquipped ? 'Đang dùng' : 'Trang bị'}
                        </Text>
                    </Pressable>
                </View>
            )}
        </View>
    );
};

export default function AchievementScreen({ 
    user, 
    onBack, 
    onNavigateSuggest,
    onNavigateMeal,
    onNavigateRecipeSubmission,
    onNavigateFavorites,
    onNavigateUpgrade,
    onNavigateShopping,
    onLogout,
    navigation 
}) {
    const [achievements, setAchievements] = useState([]);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [equippedTitle, setEquippedTitle] = useState(user?.equippedTitle || null);

    const fetchAchievements = useCallback(async () => {
        try {
            const data = await getAchievements();
            if (data.status === 'success') {
                setAchievements(data.achievements || []);
            }
        } catch (error) {
            console.error('Lỗi chi tiết:', error);
            Alert.alert('Lỗi', `Không thể tải danh sách thành tựu: ${error.message}`);
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    }, []);

    useEffect(() => {
        fetchAchievements();
    }, [fetchAchievements]);

    const handleEquip = async (title) => {
        try {
            // Nếu click vào cái đang equipped thì là tháo ra (null)
            const newTitle = equippedTitle === title ? null : title;
            await equipTitle(newTitle);
            setEquippedTitle(newTitle);
            
            // Cập nhật state cục bộ để UI feedback ngay lập tức
            if (user) user.equippedTitle = newTitle;
            
            Alert.alert('Thành công', newTitle ? `Đã trang bị danh hiệu: ${newTitle}` : 'Đã tháo danh hiệu');
        } catch (error) {
            Alert.alert('Lỗi', error.message || 'Không thể trang bị danh hiệu');
        }
    };

    const handleBottomTabPress = (tabKey) => {
        if (tabKey === 'home') {
            onBack?.();
        } else if (tabKey === 'suggest') {
            onNavigateSuggest?.();
        } else if (tabKey === 'menu') { // Khớp với key 'menu' trong AppChrome.js (Mâm cơm)
            onNavigateMeal?.();
        } else if (tabKey === 'recipes') { // Khớp với key 'recipes' trong AppChrome.js (Công thức)
            onNavigateRecipeSubmission?.();
        } else if (tabKey === 'favorites') {
            onNavigateFavorites?.();
        } else if (tabKey === 'shopping') {
            onNavigateShopping?.();
        }
    };


    if (loading) {
        return (
            <View style={styles.loadingContainer}>
                <ActivityIndicator size="large" color="#f55f12" />
            </View>
        );
    }

    return (
        <SafeAreaView style={styles.container}>
            <AppHeader
                user={user}
                isGuest={false}
                onUpgradePress={onNavigateUpgrade}
            />

            <View style={styles.header}>
                <Pressable onPress={onBack} style={styles.backBtn}>
                    <Feather name="arrow-left" size={24} color="#1e293b" />
                </Pressable>
                <Text style={styles.headerTitle}>Thành tựu & Danh hiệu</Text>
            </View>

            <FlatList
                data={achievements}
                keyExtractor={(item) => item.achievement_id.toString()}
                renderItem={({ item }) => (
                    <AchievementItem 
                        item={item} 
                        onEquip={handleEquip}
                        isEquipped={equippedTitle === item.title_reward}
                    />
                )}
                contentContainerStyle={styles.listContent}
                refreshing={refreshing}
                onRefresh={() => {
                    setRefreshing(true);
                    fetchAchievements();
                }}
                ListEmptyComponent={
                  <View style={styles.emptyContainer}>
                    <Text style={styles.emptyText}>Chưa có thành tựu nào.</Text>
                  </View>
                }
            />

            <AppBottomNav
                role="user"
                activeKey="achievements"
                onTabPress={handleBottomTabPress}
                user={user}
            />
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#f8fafc',
    },
    loadingContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
    },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 16,
        paddingVertical: 12,
        backgroundColor: '#fff',
    },
    backBtn: {
        padding: 4,
        marginRight: 12,
    },
    headerTitle: {
        fontSize: 20,
        fontWeight: '700',
        color: '#1e293b',
    },
    listContent: {
        padding: 16,
        paddingBottom: 100,
    },
    card: {
        backgroundColor: '#fff',
        borderRadius: 16,
        padding: 16,
        marginBottom: 16,
        borderWidth: 1,
        borderColor: '#e2e8f0',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.05,
        shadowRadius: 8,
        elevation: 2,
    },
    cardCompleted: {
        borderColor: '#fde68a',
        backgroundColor: '#fffbeb',
    },
    cardHeader: {
        flexDirection: 'row',
        marginBottom: 16,
    },
    iconContainer: {
        width: 56,
        height: 56,
        borderRadius: 28,
        backgroundColor: '#f1f5f9',
        justifyContent: 'center',
        alignItems: 'center',
        marginRight: 16,
    },
    iconContainerCompleted: {
        backgroundColor: '#fef3c7',
    },
    textContainer: {
        flex: 1,
        justifyContent: 'center',
    },
    achievementName: {
        fontSize: 16,
        fontWeight: '700',
        color: '#1e293b',
        marginBottom: 4,
    },
    achievementDesc: {
        fontSize: 14,
        color: '#64748b',
    },
    progressSection: {
        marginBottom: 12,
    },
    progressLabelRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        marginBottom: 6,
    },
    progressText: {
        fontSize: 12,
        fontWeight: '600',
        color: '#64748b',
    },
    percentText: {
        fontSize: 12,
        fontWeight: '700',
        color: '#f55f12',
    },
    progressBarBg: {
        height: 8,
        backgroundColor: '#e2e8f0',
        borderRadius: 4,
        overflow: 'hidden',
    },
    progressBarFill: {
        height: '100%',
        backgroundColor: '#f55f12',
        borderRadius: 4,
    },
    rewardSection: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingTop: 12,
        borderTopWidth: 1,
        borderTopColor: '#e2e8f0',
    },
    rewardInfo: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
    },
    rewardText: {
        fontSize: 13,
        fontWeight: '700',
        color: '#059669',
    },
    equipBtn: {
        paddingHorizontal: 12,
        paddingVertical: 6,
        borderRadius: 8,
        backgroundColor: '#f1f5f9',
        borderWidth: 1,
        borderColor: '#cbd5e1',
    },
    equipBtnActive: {
        backgroundColor: '#f55f12',
        borderColor: '#f55f12',
    },
    equipBtnText: {
        fontSize: 12,
        fontWeight: '700',
        color: '#475569',
    },
    equipBtnTextActive: {
        color: '#fff',
    },
    emptyContainer: {
      padding: 40,
      alignItems: 'center',
    },
    emptyText: {
      color: '#94a3b8',
      fontSize: 16,
    }
});
