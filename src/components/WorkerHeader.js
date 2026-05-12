import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, TextInput, Platform, Modal, ScrollView, Dimensions, useWindowDimensions } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { COLORS, SHADOWS } from '../constants/theme';
import { useApp } from '../context/AppContext';
import { useNavigation, DrawerActions } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { scale, verticalScale, moderateScale, isSmallPhone } from '../utils/responsive';

const WorkerHeader = ({ title, hideSearch = false, showBack = false, showBranding = true, showRight = true, rightComponent = null }) => {
    const { user, projects, notifications, markNotificationAsRead, markAllNotificationsAsRead, unreadChatCount, selectedProject, setSelectedProject } = useApp();
    const navigation = useNavigation();
    const insets = useSafeAreaInsets();
    const { width } = useWindowDimensions();
    const [isSearching, setIsSearching] = useState(false);
    const [searchQuery, setSearchQuery] = useState('');
    const [isNotifying, setIsNotifying] = useState(false);

    const activeProjects = projects.filter(p =>
        ['active', 'planning', 'in_progress', 'on_hold'].includes((p.status || '').toLowerCase())
    );

    const filteredProjects = activeProjects.filter(p =>
        p.name.toLowerCase().includes(searchQuery.toLowerCase())
    );

    const unreadCount = (notifications || []).filter(n => !n.isRead).length;

    const getStatusColor = (status) => {
        switch ((status || '').toLowerCase()) {
            case 'active': return '#22C55E';
            case 'planning': return '#F59E0B';
            case 'in_progress': return '#3B82F6';
            case 'on_hold': return '#EF4444';
            default: return '#94A3B8';
        }
    };

    const getStatusLabel = (status) => {
        switch ((status || '').toLowerCase()) {
            case 'active': return 'Active';
            case 'planning': return 'Planning';
            case 'in_progress': return 'In Progress';
            case 'on_hold': return 'On Hold';
            default: return status || 'Unknown';
        }
    };

    const safeGoBack = () => {
        try {
            if (navigation?.canGoBack?.()) {
                navigation.goBack();
                return;
            }
            // Root screens in drawer/tab stacks usually have no back history.
            navigation.navigate('Main');
        } catch (e) {
            try { navigation.navigate('Main'); } catch (_) {}
        }
    };

    return (
        <View style={[styles.headerContainer, { paddingTop: Math.max(insets.top, verticalScale(20)) }]}>
            <View style={styles.topRow}>
                <View style={[styles.leftSection, { width: scale(44) }]}>
                    {showBack ? (
                        <View style={styles.backWrapper}>
                            <TouchableOpacity
                                style={[styles.menuBtn, { width: scale(36), height: scale(36), borderRadius: scale(18) }]}
                                onPress={safeGoBack}
                            >
                                <MaterialCommunityIcons name="arrow-left" size={moderateScale(20)} color="#FFFFFF" />
                            </TouchableOpacity>
                        </View>
                    ) : (
                        (user?.role) && (
                            <TouchableOpacity
                                style={[styles.menuBtn, { width: scale(36), height: scale(36), borderRadius: scale(18) }]}
                                onPress={() => {
                                    try {
                                        let parent = navigation;
                                        let drawerFound = false;
                                        while (parent) {
                                            if (typeof parent.openDrawer === 'function' || typeof parent.toggleDrawer === 'function') {
                                                drawerFound = true;
                                                break;
                                            }
                                            parent = parent.getParent();
                                        }
                                        if (drawerFound && parent) {
                                            if (typeof parent.openDrawer === 'function') parent.openDrawer();
                                            else parent.toggleDrawer();
                                        } else {
                                            // Fallback: If no drawer and we can actually go back, do it. 
                                            // But for root screens, just don't do anything to avoid the 'GO_BACK' error.
                                            const state = navigation.getState();
                                            if (state && state.index > 0) {
                                                navigation.goBack();
                                            }
                                        }
                                    } catch (e) {
                                        console.warn('-- DRAWER ACTION FAILED --', e.message);
                                    }
                                }}
                            >
                                <MaterialCommunityIcons name="menu" size={moderateScale(20)} color="#FFFFFF" />
                            </TouchableOpacity>
                        )
                    )}
                </View>

                {showBranding && (
                    <View style={styles.centerBranding}>
                        {title ? (
                            <Text style={[styles.brandTitle, { fontSize: moderateScale(16) }]} numberOfLines={1}>{title}</Text>
                        ) : (
                            <>
                                <Text style={[styles.orgLabel, { fontSize: moderateScale(14) }]}>Organization</Text>
                                <Text style={[styles.brandTitle, { fontSize: moderateScale(16) }]}>KAAL Construction</Text>
                            </>
                        )}
                    </View>
                )}

                {rightComponent ? (
                    <View style={styles.customRightSection}>
                        {rightComponent}
                    </View>
                ) : (
                    showRight && (
                        <View style={[styles.iconSection, { width: scale(135) }]}>
                            <TouchableOpacity style={styles.iconBtn} onPress={() => navigation.navigate('Chatboard')}>
                                <View style={styles.notificationWrapper}>
                                    <MaterialCommunityIcons name="chat-outline" size={moderateScale(24)} color="#64748B" />
                                    {unreadChatCount > 0 && (
                                        <View style={[styles.badge, { backgroundColor: '#3B82F6', width: scale(18), height: scale(18), borderRadius: scale(9) }]}>
                                            <Text style={[styles.badgeText, { fontSize: moderateScale(9) }]}>{unreadChatCount}</Text>
                                        </View>
                                    )}
                                </View>
                            </TouchableOpacity>

                            <TouchableOpacity style={styles.iconBtn} onPress={() => setIsNotifying(true)}>
                                <View style={styles.notificationWrapper}>
                                    <MaterialCommunityIcons name="bell-outline" size={moderateScale(24)} color="#64748B" />
                                    {unreadCount > 0 && (
                                        <View style={[styles.badge, { width: scale(18), height: scale(18), borderRadius: scale(9) }]}>
                                            <Text style={[styles.badgeText, { fontSize: moderateScale(9) }]}>{unreadCount}</Text>
                                        </View>
                                    )}
                                </View>
                            </TouchableOpacity>

                            <TouchableOpacity
                                style={[styles.avatarContainer, { width: scale(42), height: scale(42), borderRadius: scale(21) }]}
                                onPress={() => navigation.navigate('Profile')}
                            >
                                <View style={[styles.avatarInner, { borderRadius: scale(20) }]}>
                                    <Text style={[styles.avatarText, { fontSize: moderateScale(18) }]}>
                                        {(user?.fullName || user?.name || user?.role || 'U')[0].toUpperCase()}
                                    </Text>
                                </View>
                            </TouchableOpacity>
                        </View>
                    )
                )}
            </View>

            {!hideSearch && (
                <View style={styles.bottomRow}>
                    <TouchableOpacity
                        style={[styles.searchBar, { height: verticalScale(44) }]}
                        onPress={() => setIsSearching(true)}
                        activeOpacity={0.8}
                    >
                        <MaterialCommunityIcons name="magnify" size={moderateScale(18)} color="#94A3B8" />
                        <Text style={[styles.searchPlaceholder, selectedProject && { color: '#0F172A', fontWeight: '800' }, { fontSize: moderateScale(14) }]} numberOfLines={1}>
                            {selectedProject ? selectedProject.name : 'Quick Select Job'}
                        </Text>
                        <MaterialCommunityIcons name="chevron-down" size={moderateScale(18)} color="#94A3B8" />
                    </TouchableOpacity>
                </View>
            )}

            <Modal visible={isNotifying} animationType="slide" transparent={false}>
                <View style={[styles.notifModalContainer, { paddingTop: insets.top }]}>
                    <View style={styles.notifModalContent}>
                        <View style={styles.modalSearchHeader}>
                            <Text style={[styles.modalTitle, { fontSize: moderateScale(20) }]}>Notifications</Text>
                            <TouchableOpacity onPress={() => setIsNotifying(false)}>
                                <MaterialCommunityIcons name="close" size={moderateScale(24)} color="#64748B" />
                            </TouchableOpacity>
                        </View>
                        <ScrollView style={styles.resultsList}>
                            {notifications.length === 0 ? (
                                <View style={{ padding: scale(40), alignItems: 'center' }}>
                                    <MaterialCommunityIcons name="bell-off-outline" size={moderateScale(48)} color="#E2E8F0" />
                                    <Text style={{ marginTop: 10, color: '#94A3B8', fontWeight: '700', fontSize: moderateScale(14) }}>All caught up!</Text>
                                </View>
                            ) : (
                                notifications.map((n, idx) => (
                                    <TouchableOpacity
                                        key={n._id ? `notif-${n._id}-${idx}` : `notif-idx-${idx}`}
                                        style={[styles.resultItem, !n.isRead && { backgroundColor: '#F0F9FF' }]}
                                        onPress={() => {
                                            markNotificationAsRead(n._id);
                                            setIsNotifying(false);
                                            const type = (n.type || '').toLowerCase();
                                            const title = (n.title || '').toLowerCase();
                                            const msg = (n.message || '').toLowerCase();
                                            if (type === 'rfi' || title.includes('rfi') || msg.includes('rfi')) navigation.navigate('RFI');
                                            else if (type === 'task' || title.includes('task') || msg.includes('task')) navigation.navigate('Tasks');
                                            else if (type === 'chat' || title.includes('message') || msg.includes('message')) navigation.navigate('Chatboard');
                                            else if (type === 'photo' || title.includes('photo') || msg.includes('photo')) navigation.navigate('Photos');
                                        }}
                                    >
                                        <View style={[styles.notifIcon, { backgroundColor: ['financial'].includes((n.type || '').toLowerCase()) ? '#ECFDF3' : (['task', 'rfi', 'project'].includes((n.type || '').toLowerCase()) ? '#EFF6FF' : '#FEF2F2'), width: scale(36), height: scale(36) }]}>
                                            <MaterialCommunityIcons
                                                name={
                                                    (n.type || '').toLowerCase() === 'chat' ? 'message-text-outline'
                                                        : (n.type || '').toLowerCase() === 'task' ? 'clipboard-check-outline'
                                                            : (n.type || '').toLowerCase() === 'rfi' ? 'file-question-outline'
                                                                : (n.type || '').toLowerCase() === 'financial' ? 'currency-usd'
                                                                    : (n.type || '').toLowerCase() === 'project' ? 'office-building'
                                                                        : (n.type || '').toLowerCase() === 'photo' ? 'image-outline'
                                                                            : (n.type || '').toLowerCase() === 'clock-out' || (n.type || '').toLowerCase() === 'clock-in' ? 'clock-outline'
                                                                                : 'information'
                                                }
                                                size={moderateScale(18)}
                                                color={['financial'].includes((n.type || '').toLowerCase()) ? '#059669' : (['task', 'rfi', 'project', 'chat'].includes((n.type || '').toLowerCase()) ? '#3B82F6' : '#EF4444')}
                                            />
                                        </View>
                                        <View style={{ flex: 1, marginLeft: scale(12) }}>
                                            <Text style={[styles.resultTitle, !n.isRead && { fontWeight: '900' }, { fontSize: moderateScale(15) }]}>{n.title}</Text>
                                            <Text style={[styles.resultSubtitle, { fontSize: moderateScale(11) }]} numberOfLines={2}>{n.message}</Text>
                                            <Text style={[styles.notifTime, { fontSize: moderateScale(10) }]}>{new Date(n.createdAt).toLocaleDateString()} • {new Date(n.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</Text>
                                        </View>
                                        {!n.isRead && <View style={[styles.unreadDot, { width: scale(8), height: scale(8), borderRadius: scale(4) }]} />}
                                    </TouchableOpacity>
                                ))
                            )}
                            <View style={{ height: 40 }} />
                        </ScrollView>
                        {unreadCount > 0 && (
                            <TouchableOpacity
                                style={styles.viewAllBtn}
                                onPress={async () => {
                                    await markAllNotificationsAsRead();
                                }}
                            >
                                <Text style={styles.viewAllBtnText}>Mark all as read</Text>
                            </TouchableOpacity>
                        )}
                    </View>
                </View>
            </Modal>

            <Modal visible={isSearching} animationType="fade" transparent>
                <View style={styles.modalOverlay}>
                    <View style={[styles.modalContent, { marginTop: verticalScale(100), maxWidth: scale(500), alignSelf: 'center', width: width - scale(32) }]}>
                        <View style={styles.modalSearchHeader}>
                            <MaterialCommunityIcons name="magnify" size={moderateScale(20)} color="#94A3B8" />
                            <TextInput
                                style={[styles.modalInput, { fontSize: moderateScale(16) }]}
                                placeholder="Search Job / Site..."
                                placeholderTextColor="#94A3B8"
                                value={searchQuery}
                                onChangeText={setSearchQuery}
                                autoFocus
                            />
                            <TouchableOpacity onPress={() => { setIsSearching(false); setSearchQuery(''); }}>
                                <MaterialCommunityIcons name="close" size={moderateScale(24)} color="#64748B" />
                            </TouchableOpacity>
                        </View>
                        <View style={styles.sectionLabel}>
                            <Text style={[styles.sectionLabelText, { fontSize: moderateScale(9) }]}>ACTIVE PROJECTS</Text>
                        </View>
                        <ScrollView style={styles.resultsList} keyboardShouldPersistTaps="handled">
                            {filteredProjects.length > 0 ? (
                                filteredProjects.map((p, idx) => (
                                    <TouchableOpacity
                                        key={p._id ? `proj-${p._id}-${idx}` : `proj-idx-${idx}`}
                                        style={[styles.projectItem, selectedProject?._id === (p._id || p.id) && styles.projectItemSelected]}
                                        onPress={() => {
                                            setSelectedProject(p);
                                            setIsSearching(false);
                                            setSearchQuery('');
                                        }}
                                    >
                                        <View style={[styles.statusDot, { backgroundColor: getStatusColor(p.status), width: scale(8), height: scale(8), borderRadius: scale(4) }]} />
                                        <View style={{ flex: 1, marginLeft: scale(12) }}>
                                            <Text style={[styles.projectName, { fontSize: moderateScale(14) }]} numberOfLines={1}>{p.name}</Text>
                                            {p.location && <Text style={[styles.projectLocation, { fontSize: moderateScale(11) }]} numberOfLines={1}>{(typeof p.location === 'object' ? p.location?.address : p.location)}</Text>}
                                        </View>
                                        <View style={[styles.statusBadge, { backgroundColor: getStatusColor(p.status) + '18', borderColor: getStatusColor(p.status) + '40' }]}>
                                            <Text style={[styles.statusBadgeText, { color: getStatusColor(p.status), fontSize: moderateScale(9) }]}>
                                                {getStatusLabel(p.status)}
                                            </Text>
                                        </View>
                                    </TouchableOpacity>
                                ))
                            ) : (
                                <View style={{ padding: scale(32), alignItems: 'center' }}>
                                    <MaterialCommunityIcons name="briefcase-off-outline" size={moderateScale(40)} color="#E2E8F0" />
                                    <Text style={{ marginTop: 12, color: '#94A3B8', fontWeight: '700', fontSize: moderateScale(13) }}>
                                        {searchQuery ? 'No matching projects' : 'No active projects'}
                                    </Text>
                                </View>
                            )}
                        </ScrollView>
                        <TouchableOpacity
                            style={[styles.viewAllBtn, { paddingVertical: verticalScale(14) }]}
                            onPress={() => {
                                setIsSearching(false);
                                setSearchQuery('');
                                // "View all" must reset quick-select context, otherwise list screens stay filtered.
                                setSelectedProject(null);
                                const targetTab = (user?.role === 'SUBCONTRACTOR' || user?.role === 'CLIENT') ? 'Projects' : 'Jobs';
                                try {
                                    navigation.navigate('MainTabs', { screen: targetTab });
                                } catch (e) {}
                            }}
                        >
                            <Text style={[styles.viewAllBtnText, { fontSize: moderateScale(10) }]}>VIEW ALL PROJECTS</Text>
                        </TouchableOpacity>
                    </View>
                </View>
            </Modal>
        </View>
    );
};

const styles = StyleSheet.create({
    headerContainer: {
        backgroundColor: '#FFFFFF',
        paddingBottom: verticalScale(14),
        paddingHorizontal: scale(16),
        borderBottomWidth: 1,
        borderBottomColor: '#F1F5F9',
        zIndex: 100,
    },
    topRow: { 
        flexDirection: 'row', 
        alignItems: 'center', 
        justifyContent: 'space-between', 
        marginBottom: 8,
        paddingHorizontal: 4
    },
    leftSection: { justifyContent: 'center' },
    centerBranding: { flex: 1, alignItems: 'center', justifyContent: 'center' },
    brandTitle: { fontWeight: '900', color: '#0F172A', letterSpacing: -0.5 },
    orgLabel: { fontWeight: '900', color: '#2563EB', textTransform: 'uppercase', letterSpacing: 1.5 },
    menuBtn: { backgroundColor: '#0F172A', justifyContent: 'center', alignItems: 'center', marginRight: 6, elevation: 4 },
    backWrapper: { flexDirection: 'row', alignItems: 'center' },
    avatarContainer: { backgroundColor: '#F1F5F9', padding: 2 },
    avatarInner: { flex: 1, backgroundColor: '#EFF6FF', justifyContent: 'center', alignItems: 'center', borderWidth: 1, borderColor: '#BFDBFE' },
    avatarText: { fontWeight: '900', color: '#2563EB' },
    iconSection: { flexDirection: 'row', gap: 8, alignItems: 'center', justifyContent: 'flex-end' },
    customRightSection: { flexDirection: 'row', alignItems: 'center', justifyContent: 'flex-end', minWidth: 80 },
    iconBtn: { padding: 4 },
    notificationWrapper: { position: 'relative' },
    badge: { position: 'absolute', top: -6, right: -6, backgroundColor: '#F97316', justifyContent: 'center', alignItems: 'center', borderWidth: 2, borderColor: '#fff' },
    badgeText: { color: '#fff', fontWeight: '900' },
    bottomRow: { width: '100%' },
    searchBar: { backgroundColor: '#F8FAFC', borderRadius: 12, borderWidth: 1, borderColor: '#E2E8F0', flexDirection: 'row', alignItems: 'center', paddingHorizontal: 12 },
    searchPlaceholder: { flex: 1, marginLeft: 10, color: '#475569' },
    modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-start' },
    modalContent: { backgroundColor: '#fff', marginHorizontal: 16, borderRadius: 20, padding: 20, maxHeight: '70%', elevation: 8 },
    modalSearchHeader: { flexDirection: 'row', alignItems: 'center', paddingBottom: 15, borderBottomWidth: 1, borderBottomColor: '#F1F5F9' },
    notifModalContainer: { flex: 1, backgroundColor: '#fff' },
    notifModalContent: { flex: 1, backgroundColor: '#fff', paddingHorizontal: 20 },
    modalInput: { flex: 1, marginLeft: 10, fontWeight: '600', color: '#0F172A' },
    resultsList: { marginTop: 15 },
    resultItem: { flexDirection: 'row', alignItems: 'center', paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: '#F8FAFC' },
    resultTitle: { fontWeight: '800', color: '#1E293B' },
    resultSubtitle: { color: '#94A3B8', fontWeight: '600', marginTop: 2 },
    modalTitle: { fontWeight: '900', color: '#1E293B' },
    notifIcon: { borderRadius: 12, justifyContent: 'center', alignItems: 'center' },
    notifTime: { color: '#94A3B8', fontWeight: '700', marginTop: 4 },
    unreadDot: { backgroundColor: '#3B82F6', marginLeft: 10 },
    sectionLabel: { paddingHorizontal: 4, paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: '#F8FAFC', marginBottom: 4 },
    sectionLabelText: { fontWeight: '900', color: '#94A3B8', letterSpacing: 1.5, textTransform: 'uppercase' },
    projectItem: { flexDirection: 'row', alignItems: 'center', paddingVertical: 14, paddingHorizontal: 4, borderBottomWidth: 1, borderBottomColor: '#F8FAFC' },
    projectItemSelected: { backgroundColor: '#EFF6FF', borderRadius: 12, paddingHorizontal: 10 },
    statusDot: { flexShrink: 0 },
    projectName: { fontWeight: '800', color: '#1E293B' },
    projectLocation: { color: '#94A3B8', fontWeight: '600', marginTop: 2 },
    statusBadge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 20, borderWidth: 1, marginLeft: 8, flexShrink: 0 },
    statusBadgeText: { fontWeight: '900', textTransform: 'uppercase', letterSpacing: 0.5 },
    viewAllBtn: { marginTop: 12, width: '100%', backgroundColor: '#F8FAFC', borderRadius: 12, alignItems: 'center' },
    viewAllBtnText: { fontWeight: '900', color: '#64748B', letterSpacing: 1, textTransform: 'uppercase' },
});

export default WorkerHeader;
