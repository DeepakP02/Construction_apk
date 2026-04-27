import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Image, Platform } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { COLORS, SHADOWS, SPACING } from '../constants/theme';
import { useApp } from '../context/AppContext';
import { useNavigation } from '@react-navigation/native';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

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

    return (
        <View style={[styles.safeArea, { paddingTop: Math.max(insets.top, 20) }]}>
            <View style={styles.headerContainer}>
                <View style={styles.leftSection}>
                     {showBack ? (
                        <View style={styles.backWrapper}>
                            <TouchableOpacity onPress={() => navigation.goBack()} style={styles.iconBtn}>
                                <MaterialCommunityIcons name="arrow-left" size={24} color={COLORS.primary} />
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
        backgroundColor: '#FFFFFF',
    },
    headerContainer: {
        height: 64,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: 16,
        backgroundColor: '#FFFFFF',
        borderBottomWidth: 1,
        borderBottomColor: '#E2E8F0',
    },
    leftSection: {
        width: 60,
        flexDirection: 'row',
        alignItems: 'center',
    },
    headerLogo: {
        width: 32,
        height: 32,
    },
    centerBranding: {
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center',
    },
    orgLabel: {
        fontSize: 9,
        fontWeight: '800',
        color: '#64748B',
        textTransform: 'uppercase',
        letterSpacing: 1.2,
    },
    brandTitle: {
        fontSize: 15,
        fontWeight: '900',
        color: '#0F172A',
        marginTop: -1,
    },
    rightSection: {
        width: 90,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'flex-end',
        gap: 8,
    },
    logoutIconBtn: {
        width: 38,
        height: 38,
        borderRadius: 12,
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
        width: 38,
        height: 38,
        borderRadius: 12,
        backgroundColor: COLORS.primary,
        alignItems: 'center',
        justifyContent: 'center',
        borderWidth: 2,
        borderColor: '#F1F5F9',
    },
    headerAvatarMini: {
        width: 34,
        height: 34,
        borderRadius: 8,
        backgroundColor: '#0F172A', // Deep Black/Navy
        justifyContent: 'center',
        alignItems: 'center',
        marginLeft: 12,
    },
    headerAvatarText: {
        fontSize: 16,
        fontWeight: '900',
        color: '#FFFFFF',
    },
    backWrapper: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    avatarLetter: {
        color: '#fff',
        fontSize: 16,
        fontWeight: '900',
    },
});

export default AppHeader;
