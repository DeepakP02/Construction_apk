import React, { useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Switch, Alert, Animated, useWindowDimensions } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { COLORS, SPACING, SHADOWS } from '../../constants/theme';
import AppHeader from '../../components/AppHeader';
import { useApp } from '../../context/AppContext';
import { Card } from '../../components/shared/CommonUI';
import { scale, verticalScale, moderateScale, isTablet } from '../../utils/responsive';

const WorkerProfileScreen = () => {
    const { user, logout } = useApp();
    const { width, height } = useWindowDimensions();
    const [notifications, setNotifications] = useState(true);

    const ProfileRow = ({ icon, label, sub, color, bg }) => (
        <Card style={[styles.card, { padding: moderateScale(16), borderRadius: moderateScale(16) }]}>
            <View style={styles.row}>
                <View style={[styles.iconBox, { backgroundColor: bg, width: scale(44), height: scale(44), borderRadius: moderateScale(14) }]}>
                    <MaterialCommunityIcons name={icon} size={moderateScale(22)} color={color} />
                </View>
                <View style={{ flex: 1, marginLeft: scale(14) }}>
                    <Text style={[styles.label, { fontSize: moderateScale(16) }]}>{label}</Text>
                    {sub && <Text style={[styles.subText, { fontSize: moderateScale(12) }]}>{sub}</Text>}
                </View>
                <MaterialCommunityIcons name="chevron-right" size={moderateScale(20)} color={COLORS.textMuted} />
            </View>
        </Card>
    );

    return (
        <View style={styles.container}>
            <AppHeader title="My Workspace Profile" />
            <ScrollView contentContainerStyle={[styles.scroll, { padding: scale(16) }]} showsVerticalScrollIndicator={false}>

                <View style={[styles.profileBox, { marginVertical: verticalScale(24) }]}>
                    <View style={[styles.avatar, SHADOWS.card, { width: scale(100), height: scale(100), borderRadius: scale(36) }]}>
                        <Text style={[styles.avatarText, { fontSize: moderateScale(40) }]}>{user?.fullName?.charAt(0) || user?.name?.charAt(0)}</Text>
                        <View style={[styles.statusDot, { width: scale(24), height: scale(24), borderRadius: scale(12) }]} />
                    </View>
                    <Text style={[styles.userName, { fontSize: moderateScale(24), marginTop: verticalScale(16) }]}>{user?.fullName || user?.name || 'Worker Master'}</Text>
                    <View style={[styles.roleChip, { paddingHorizontal: scale(16), paddingVertical: verticalScale(6), borderRadius: moderateScale(20), marginTop: verticalScale(8) }]}>
                        <Text style={[styles.roleText, { fontSize: moderateScale(11) }]}>{user?.role?.replace('_', ' ')}</Text>
                    </View>
                </View>

                <View style={[styles.statsRow, { borderRadius: moderateScale(24), padding: moderateScale(20), marginBottom: verticalScale(24), maxWidth: 600, alignSelf: 'center', width: '100%' }]}>
                    <View style={styles.statItem}>
                        <Text style={[styles.statNum, { fontSize: moderateScale(20) }]}>124h</Text>
                        <Text style={[styles.statLabel, { fontSize: moderateScale(10), marginTop: verticalScale(4) }]}>Month Hours</Text>
                    </View>
                    <View style={styles.dividerV} />
                    <View style={styles.statItem}>
                        <Text style={[styles.statNum, { fontSize: moderateScale(20) }]}>12</Text>
                        <Text style={[styles.statLabel, { fontSize: moderateScale(10), marginTop: verticalScale(4) }]}>Jobs Done</Text>
                    </View>
                </View>

                <View style={{ maxWidth: 600, alignSelf: 'center', width: '100%' }}>
                    <Text style={[styles.sectionTitle, { fontSize: moderateScale(11), marginBottom: verticalScale(12) }]}>MY ACCOUNT</Text>
                    <ProfileRow icon="account-details-outline" label="Account Information" sub="Manage your details" color={COLORS.primary} bg={COLORS.primary + '10'} />
                    <ProfileRow icon="shield-lock-outline" label="Security" sub="Password & PIN" color="#7C3AED" bg="#F5F3FF" />

                    <Card style={[styles.card, { padding: moderateScale(16), marginBottom: verticalScale(12), borderRadius: moderateScale(16) }]}>
                        <View style={styles.row}>
                            <View style={[styles.iconBox, { backgroundColor: COLORS.primary + '10', width: scale(44), height: scale(44), borderRadius: moderateScale(14) }]}>
                                <MaterialCommunityIcons name="bell-ring-outline" size={moderateScale(22)} color={COLORS.primary} />
                            </View>
                            <View style={{ flex: 1, marginLeft: scale(14) }}>
                                <Text style={[styles.label, { fontSize: moderateScale(16) }]}>Show Notifications</Text>
                            </View>
                            <Switch
                                value={notifications}
                                onValueChange={setNotifications}
                                trackColor={{ false: '#E2E8F0', true: COLORS.primary }}
                                thumbColor="#fff"
                            />
                        </View>
                    </Card>

                    <TouchableOpacity style={[styles.logoutBtn, { padding: moderateScale(20), borderRadius: moderateScale(24), marginTop: verticalScale(24), gap: scale(12) }]} onPress={logout}>
                        <MaterialCommunityIcons name="logout-variant" size={moderateScale(20)} color="#EF4444" />
                        <Text style={[styles.logoutText, { fontSize: moderateScale(14) }]}>LOGOUT</Text>
                    </TouchableOpacity>
                </View>

                <Text style={[styles.footerText, { fontSize: moderateScale(10), marginTop: verticalScale(40), marginBottom: verticalScale(60) }]}>KAAL ERP • BUILD RELEASE 4.2.0 • ASIA</Text>
            </ScrollView>
        </View>
    );
};

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: COLORS.background },
    scroll: { },
    profileBox: { alignItems: 'center' },
    avatar: { backgroundColor: COLORS.primary, justifyContent: 'center', alignItems: 'center' },
    avatarText: { fontWeight: '900', color: '#fff' },
    statusDot: { position: 'absolute', bottom: 4, right: 4, backgroundColor: '#10B981', borderWidth: 4, borderColor: COLORS.background },
    userName: { fontWeight: '900', color: COLORS.textPrimary },
    roleChip: { backgroundColor: '#F1F5F9' },
    roleText: { fontWeight: '900', color: COLORS.textMuted, letterSpacing: 0.5, textTransform: 'uppercase' },
    statsRow: { flexDirection: 'row', backgroundColor: '#fff', borderWidth: 1, borderColor: '#F1F5F9' },
    statItem: { flex: 1, alignItems: 'center' },
    statNum: { fontWeight: '900', color: COLORS.textPrimary },
    statLabel: { fontWeight: '800', color: COLORS.textMuted },
    dividerV: { width: 1, backgroundColor: '#F1F5F9' },
    sectionTitle: { fontWeight: '900', color: COLORS.textMuted, letterSpacing: 1.5, marginLeft: 4 },
    card: { },
    row: { flexDirection: 'row', alignItems: 'center' },
    iconBox: { justifyContent: 'center', alignItems: 'center' },
    label: { fontWeight: '800', color: COLORS.textPrimary },
    subText: { color: COLORS.textMuted, marginTop: 2 },
    logoutBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', backgroundColor: '#FFF1F2', borderWidth: 1, borderColor: '#FECACA' },
    logoutText: { color: '#EF4444', fontWeight: '900', letterSpacing: 0.5 },
    footerText: { textAlign: 'center', color: COLORS.textMuted, fontWeight: '800' }
});

export default WorkerProfileScreen;
