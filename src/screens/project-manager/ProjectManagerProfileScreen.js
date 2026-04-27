import React from 'react';
import { View, ScrollView, StyleSheet, TouchableOpacity, Text, Image, Alert } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { COLORS, SHADOWS } from '../../constants/theme';
import { useApp } from '../../context/AppContext';
import WorkerHeader from '../../components/WorkerHeader';
import { scale, verticalScale, moderateScale, isTablet } from '../../utils/responsive';

const ProjectManagerProfileScreen = ({ navigation }) => {
    const { user, logout } = useApp();

    const handleLogout = () => {
        Alert.alert(
            "Logout Session",
            "Are you sure you want to exit your project manager shift?",
            [
                { text: "STAY", style: "cancel" },
                { text: "EXIT", style: "destructive", onPress: logout }
            ]
        );
    };

    const stats = [
        { label: 'PROJECTS', value: '12', icon: 'office-building', color: '#3B82F6' },
        { label: 'CREW', value: '45', icon: 'account-group', color: '#10B981' },
        { label: 'EFFICIENCY', value: '94%', icon: 'trending-up', color: '#F59E0B' }
    ];

    return (
        <View style={styles.container}>
            <WorkerHeader title="PM Account" />
            <ScrollView contentContainerStyle={[styles.scroll, { padding: scale(20) }]} showsVerticalScrollIndicator={false}>
                <View style={[styles.profileCard, SHADOWS.large, { borderRadius: moderateScale(32), padding: moderateScale(24), marginBottom: verticalScale(24), maxWidth: 600, alignSelf: 'center', width: '100%' }]}>
                    <View style={[styles.avatarSection, { marginBottom: verticalScale(24) }]}>
                        <View style={[styles.avatarGlow, { padding: scale(4), borderRadius: scale(50) }]}>
                            <View style={[styles.avatar, { width: scale(80), height: scale(80), borderRadius: scale(40) }]}>
                                <Text style={[styles.avatarText, { fontSize: moderateScale(32) }]}>{(user?.fullName || 'PM')[0]}</Text>
                            </View>
                        </View>
                        <Text style={[styles.fullName, { fontSize: moderateScale(24), marginTop: verticalScale(16) }]}>{user?.fullName || 'Project Manager'}</Text>
                        <View style={[styles.roleBadge, { paddingHorizontal: scale(12), paddingVertical: verticalScale(4), borderRadius: moderateScale(20), marginTop: verticalScale(8), gap: scale(6) }]}>
                            <MaterialCommunityIcons name="shield-crown" size={moderateScale(14)} color="#fff" />
                            <Text style={[styles.roleText, { fontSize: moderateScale(10) }]}>SITE SUPERVISOR</Text>
                        </View>
                        <Text style={[styles.email, { fontSize: moderateScale(14), marginTop: verticalScale(8) }]}>{user?.email || 'manager@kaal.ca'}</Text>
                    </View>

                    <View style={[styles.statsRow, { borderTopWidth: 1, borderTopColor: '#F1F5F9', paddingTop: verticalScale(24) }]}>
                        {stats.map((s, i) => (
                            <View key={i} style={styles.statBox}>
                                <MaterialCommunityIcons name={s.icon} size={moderateScale(20)} color={s.color} />
                                <Text style={[styles.statValue, { fontSize: moderateScale(18), marginTop: verticalScale(4) }]}>{s.value}</Text>
                                <Text style={[styles.statLabel, { fontSize: moderateScale(9), marginTop: verticalScale(2) }]}>{s.label}</Text>
                            </View>
                        ))}
                    </View>
                </View>

                <View style={[styles.sectionHeader, { marginBottom: verticalScale(16), paddingHorizontal: scale(4), maxWidth: 600, alignSelf: 'center', width: '100%' }]}>
                    <Text style={[styles.sectionTitle, { fontSize: moderateScale(11) }]}>SITE ACTIONS</Text>
                </View>

                <View style={[styles.actionList, { gap: verticalScale(12), marginBottom: verticalScale(30), maxWidth: 600, alignSelf: 'center', width: '100%' }]}>
                    {[
                        { icon: 'account-edit-outline', label: 'Modify Site Profile', sub: 'Update your professional details', route: 'Profile' },
                        { icon: 'shield-lock-outline', label: 'Security & Access', sub: 'Reset and manage passwords', route: 'Settings' },
                        { icon: 'history', label: 'My Performance Logs', sub: 'Review past project milestones', route: 'Reports' }
                    ].map((item, idx) => (
                        <TouchableOpacity
                            key={idx}
                            style={[styles.actionItem, { padding: moderateScale(16), borderRadius: moderateScale(20) }]}
                            onPress={() => item.route && navigation.navigate(item.route)}
                        >
                            <View style={[styles.actionIcon, { width: scale(44), height: scale(44), borderRadius: moderateScale(14) }]}>
                                <MaterialCommunityIcons name={item.icon} size={moderateScale(24)} color="#475569" />
                            </View>
                            <View style={[styles.actionBody, { marginLeft: scale(16) }]}>
                                <Text style={[styles.actionLabel, { fontSize: moderateScale(15) }]}>{item.label}</Text>
                                <Text style={[styles.actionSub, { fontSize: moderateScale(12), marginTop: verticalScale(2) }]}>{item.sub}</Text>
                            </View>
                            <MaterialCommunityIcons name="chevron-right" size={moderateScale(24)} color="#CBD5E1" />
                        </TouchableOpacity>
                    ))}
                </View>

                <TouchableOpacity style={[styles.logoutBtn, { padding: moderateScale(20), borderRadius: moderateScale(20), gap: scale(10), maxWidth: 600, alignSelf: 'center', width: '100%' }]} onPress={handleLogout}>
                    <MaterialCommunityIcons name="logout-variant" size={moderateScale(20)} color="#EF4444" />
                    <Text style={[styles.logoutText, { fontSize: moderateScale(13) }]}>TERMINATE SESSION</Text>
                </TouchableOpacity>
                <View style={{ height: verticalScale(50) }} />
            </ScrollView>
        </View>
    );
};

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: '#F8FAFC' },
    scroll: { },
    profileCard: { backgroundColor: '#fff' },
    avatarSection: { alignItems: 'center' },
    avatarGlow: { backgroundColor: '#EFF6FF', borderWidth: 1, borderColor: '#BFDBFE' },
    avatar: { backgroundColor: COLORS.primary, justifyContent: 'center', alignItems: 'center' },
    avatarText: { fontWeight: '900', color: '#fff' },
    fullName: { fontWeight: '900', color: '#0F172A', letterSpacing: -0.5 },
    roleBadge: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#10B981' },
    roleText: { color: '#fff', fontWeight: '900', letterSpacing: 1 },
    email: { color: '#64748B', fontWeight: '600' },
    statsRow: { flexDirection: 'row', justifyContent: 'space-between' },
    statBox: { alignItems: 'center', flex: 1 },
    statValue: { fontWeight: '900', color: '#0F172A' },
    statLabel: { fontWeight: '800', color: '#94A3B8', letterSpacing: 1 },
    sectionHeader: { },
    sectionTitle: { fontWeight: '900', color: '#94A3B8', letterSpacing: 1.5 },
    actionList: { },
    actionItem: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#fff', borderWidth: 1, borderColor: '#F1F5F9' },
    actionIcon: { backgroundColor: '#F8FAFC', justifyContent: 'center', alignItems: 'center' },
    actionBody: { flex: 1 },
    actionLabel: { fontWeight: '800', color: '#1E293B' },
    actionSub: { color: '#94A3B8', fontWeight: '600' },
    logoutBtn: { flexDirection: 'row', justifyContent: 'center', alignItems: 'center', backgroundColor: '#FEF2F2', borderWidth: 1, borderColor: '#FEE2E2' },
    logoutText: { color: '#EF4444', fontWeight: '900', letterSpacing: 1 }
});

export default ProjectManagerProfileScreen;
