import React, { useState } from 'react';
import { View, Text, StyleSheet, ScrollView, Switch, TouchableOpacity, Alert } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { COLORS, SPACING, SHADOWS } from '../../constants/theme';
import AppHeader from '../../components/AppHeader';
import { useApp } from '../../context/AppContext';
import { Card } from '../../components/shared/CommonUI';

export const SettingsScreen = () => {
    const { user, logout } = useApp();
    const [notifications, setNotifications] = useState(true);
    const [biometrics, setBiometrics] = useState(false);
    const [darkMode, setDarkMode] = useState(false);

    const SettingRow = ({ icon, label, value, onValueChange, iconColor = COLORS.primary, iconBg = COLORS.primaryLight, isSwitch = true }) => (
        <TouchableOpacity activeOpacity={0.7}>
            <Card>
                <View style={styles.settingRow}>
                    <View style={[styles.settingIcon, { backgroundColor: iconBg }]}>
                        <MaterialCommunityIcons name={icon} size={20} color={iconColor} />
                    </View>
                    <Text style={styles.settingLabel}>{label}</Text>
                    {isSwitch ? (
                        <Switch
                            value={value}
                            onValueChange={onValueChange}
                            trackColor={{ false: COLORS.border, true: COLORS.primary }}
                            thumbColor="#fff"
                        />
                    ) : (
                        <MaterialCommunityIcons name="chevron-right" size={20} color={COLORS.textMuted} />
                    )}
                </View>
            </Card>
        </TouchableOpacity>
    );

    return (
        <View style={styles.container}>
            <AppHeader title="Settings" showBack />
            <ScrollView contentContainerStyle={styles.list} showsVerticalScrollIndicator={false}>
                <View style={[styles.profileCard, SHADOWS.card]}>
                    <View style={styles.profileHeader}>
                        <View style={styles.profileAvatar}>
                            <Text style={styles.profileInitial}>{user?.fullName?.charAt(0) || 'U'}</Text>
                            <View style={styles.onlineBadge} />
                        </View>
                        <View style={styles.profileInfo}>
                            <Text style={styles.profileName}>{user?.fullName || 'User Name'}</Text>
                            <View style={styles.roleChip}>
                                <Text style={styles.roleText}>{user?.role?.replace('_', ' ') || 'Member'}</Text>
                            </View>
                        </View>
                    </View>
                </View>

                <Text style={styles.settingSection}>APP PREFERENCES</Text>
                <SettingRow icon="bell-outline" label="Push Notifications" value={notifications} onValueChange={setNotifications} />
                <SettingRow icon="fingerprint" label="Biometric Security" value={biometrics} onValueChange={setBiometrics} iconColor="#7C3AED" iconBg="#F5F3FF" />
                <SettingRow icon="theme-light-dark" label="Premium Dark Mode" value={darkMode} onValueChange={setDarkMode} iconColor="#374151" iconBg="#F3F4F6" />

                <TouchableOpacity style={styles.logoutBtn} onPress={logout}>
                    <MaterialCommunityIcons name="logout-variant" size={20} color="#EF4444" />
                    <Text style={styles.logoutText}>LOGOUT</Text>
                </TouchableOpacity>
            </ScrollView>
        </View>
    );
};

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: COLORS.background },
    list: { padding: SPACING.m },
    settingSection: { fontSize: 11, fontWeight: '900', color: COLORS.textMuted, letterSpacing: 1.5, marginTop: SPACING.m, marginBottom: SPACING.s },
    settingRow: { flexDirection: 'row', alignItems: 'center', gap: 14 },
    settingIcon: { width: 40, height: 40, borderRadius: 12, justifyContent: 'center', alignItems: 'center' },
    settingLabel: { flex: 1, fontSize: 15, fontWeight: '700', color: COLORS.textPrimary },
    profileCard: { backgroundColor: COLORS.primaryDark, borderRadius: 28, padding: 24, marginBottom: 24 },
    profileHeader: { flexDirection: 'row', alignItems: 'center' },
    profileAvatar: { width: 64, height: 64, borderRadius: 32, backgroundColor: 'rgba(255,255,255,0.15)', justifyContent: 'center', alignItems: 'center' },
    profileInitial: { fontSize: 28, fontWeight: '900', color: '#fff' },
    onlineBadge: { width: 14, height: 14, borderRadius: 7, backgroundColor: '#10B981', position: 'absolute', bottom: 2, right: 2, borderWidth: 2, borderColor: COLORS.primaryDark },
    profileInfo: { flex: 1, marginLeft: 16 },
    profileName: { fontSize: 20, fontWeight: '900', color: '#fff' },
    roleChip: { backgroundColor: 'rgba(255,255,255,0.1)', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 8, marginTop: 6, alignSelf: 'flex-start' },
    roleText: { color: '#fff', fontSize: 9, fontWeight: '900', textTransform: 'uppercase' },
    logoutBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10, backgroundColor: '#FFF1F2', padding: 18, borderRadius: 20, marginTop: 32, borderWidth: 1, borderColor: '#FECACA' },
    logoutText: { color: '#EF4444', fontWeight: '900', fontSize: 13 }
});

export default SettingsScreen;
