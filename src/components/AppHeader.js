import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Image, Platform } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { COLORS, SHADOWS, SIZES, SPACING, TYPOGRAPHY } from '../constants/theme';
import { useApp } from '../context/AppContext';
import { useNavigation } from '@react-navigation/native';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { scale, verticalScale, moderateScale } from '../utils/responsive';

const AppHeader = ({ title, showBack = false, showRight = true, showLogo = false }) => {
    const { user, logout } = useApp();
    const navigation = useNavigation();
    const insets = useSafeAreaInsets();

    const handleLogout = async () => {
        await logout();
        // No need for navigation.reset or navigation.navigate.
        // AppNavigation.js will automatically swap to Login screen 
        // because the 'user' state becomes null.
    };

    const safeGoBack = () => {
        try {
            if (navigation?.canGoBack?.()) {
                const state = navigation.getState?.();
                if (state && state.routes && state.routes.length > 1) {
                    navigation.goBack();
                    return;
                }
            }
            navigation.navigate('MainTabs');
        } catch (e) {
            try { navigation.navigate('MainTabs'); } catch (_) {}
        }
    };

    return (
        <View style={[styles.safeArea, { paddingTop: Math.max(insets.top, 20) }]}>
            <View style={styles.headerContainer}>
                <View style={styles.leftSection}>
                     {showBack ? (
                        <View style={styles.backWrapper}>
                            <TouchableOpacity onPress={safeGoBack} style={styles.iconBtn}>
                                <MaterialCommunityIcons name="arrow-left" size={moderateScale(24)} color={COLORS.primary} />
                            </TouchableOpacity>
                        </View>
                    ) : (
                        <Image 
                            source={require('../../assets/logo.webp')} 
                            style={styles.headerLogo} 
                            resizeMode="contain"
                        />
                    )}
                </View>

                <View style={styles.centerBranding}>
                    {title ? (
                        <Text style={styles.brandTitle} numberOfLines={1}>{title}</Text>
                    ) : (
                        <>
                            <Text style={styles.orgLabel}>Organization</Text>
                            <Text style={styles.brandTitle}>KAAL Construction</Text>
                        </>
                    )}
                </View>

                {(showRight || showLogo) && (
                    <View style={styles.rightSection}>
                        {showLogo && (
                             <Image 
                                source={require('../../assets/logo.webp')} 
                                style={styles.headerLogo} 
                                resizeMode="contain"
                            />
                        )}
                        {showRight && (
                            <>
                                <TouchableOpacity
                                    onPress={handleLogout}
                                    style={[styles.logoutIconBtn, SHADOWS.small]}
                                    activeOpacity={0.7}
                                >
                                    <MaterialCommunityIcons name="logout-variant" size={20} color="#EF4444" />
                                </TouchableOpacity>

                                <TouchableOpacity
                                    onPress={() => navigation.navigate('Profile')}
                                    style={styles.avatarBtn}
                                >
                                    <View style={styles.avatar}>
                                        <Text style={styles.avatarLetter}>
                                            {user?.name?.charAt(0) || 'U'}
                                        </Text>
                                    </View>
                                </TouchableOpacity>
                            </>
                        )}
                    </View>
                )}
            </View>
        </View>
    );
};

const styles = StyleSheet.create({
    safeArea: {
        backgroundColor: COLORS.surface,
    },
    headerContainer: {
        height: Math.max(verticalScale(64), 60),
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: SPACING.m,
        backgroundColor: COLORS.surface,
        borderBottomWidth: 1,
        borderBottomColor: COLORS.border,
    },
    leftSection: {
        width: scale(60),
        flexDirection: 'row',
        alignItems: 'center',
    },
    headerLogo: {
        width: scale(32),
        height: scale(32),
    },
    centerBranding: {
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center',
    },
    orgLabel: {
        ...TYPOGRAPHY.badge,
        color: COLORS.textSecondary,
        letterSpacing: 1.2,
    },
    brandTitle: {
        ...TYPOGRAPHY.subtitle,
        color: COLORS.textPrimary,
        marginTop: -1,
    },
    rightSection: {
        width: scale(90),
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'flex-end',
        gap: SPACING.s,
    },
    logoutIconBtn: {
        width: scale(38),
        height: scale(38),
        borderRadius: SIZES.radiusBtn,
        backgroundColor: '#FEF2F2',
        alignItems: 'center',
        justifyContent: 'center',
        borderWidth: 1,
        borderColor: '#FEE2E2',
    },
    avatarBtn: {
        padding: 2,
    },
    avatar: {
        width: scale(38),
        height: scale(38),
        borderRadius: SIZES.radiusBtn,
        backgroundColor: COLORS.primary,
        alignItems: 'center',
        justifyContent: 'center',
        borderWidth: 2,
        borderColor: COLORS.separator,
    },
    headerAvatarMini: {
        width: scale(34),
        height: scale(34),
        borderRadius: 8,
        backgroundColor: COLORS.primaryDark,
        justifyContent: 'center',
        alignItems: 'center',
        marginLeft: 12,
    },
    headerAvatarText: {
        fontSize: 16,
        fontWeight: '900',
        color: COLORS.white,
    },
    backWrapper: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    avatarLetter: {
        color: COLORS.white,
        fontSize: 16,
        fontWeight: '900',
    },
});

export default AppHeader;
