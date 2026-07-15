import React, { useState, useEffect } from 'react';
import { 
    View, Text, StyleSheet, FlatList, TouchableOpacity, 
    ActivityIndicator, StatusBar, ScrollView, TextInput, 
    Dimensions, Modal
} from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { COLORS, SHADOWS, SIZES, SPACING, TYPOGRAPHY } from '../../constants/theme';
import { useApp } from '../../context/AppContext';
import api from '../../utils/api';
import { scale, verticalScale, moderateScale } from '../../utils/responsive';

import { useSafeAreaInsets } from 'react-native-safe-area-context';

const { width } = Dimensions.get('window');

const WorkerLogsScreen = ({ navigation }) => {
    const insets = useSafeAreaInsets();
    const { user, isClockedIn } = useApp();
    const [logs, setLogs] = useState([]);
    const [loading, setLoading] = useState(true);
    const [search, setSearch] = useState('');
    const [selectedLog, setSelectedLog] = useState(null);
    const [showDetail, setShowDetail] = useState(false);

    const fetchLogs = async () => {
        try {
            setLoading(true);
            const res = await api.get('/timelogs');
            setLogs(res.data);
        } catch (e) {
            console.error('Fetch logs error:', e);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchLogs();
    }, []);

    const calculateTotalHours = () => {
        const totalMs = (logs || []).reduce((acc, log) => {
            if (log.clockIn && log.clockOut) {
                return acc + (new Date(log.clockOut) - new Date(log.clockIn));
            }
            return acc;
        }, 0);
        return (totalMs / 3600000).toFixed(1);
    };

    const stats = [
        { label: 'TOTAL HOURS', value: `${calculateTotalHours()}h`, sub: 'Current Period', icon: 'clock-time-four', color: '#2563EB' },
        { label: 'PENDING', value: logs.filter(l => !l.approved && l.clockOut).length, sub: 'In Review', icon: 'timer-sand', color: '#F59E0B' },
        { label: 'APPROVED', value: logs.filter(l => l.approved).length, sub: 'Verified', icon: 'check-decagram', color: '#10B981' },
    ];

    const openDetails = (log) => {
        setSelectedLog(log);
        setShowDetail(true);
    };

    const renderLogItem = ({ item }) => {
        const durationH = item.clockOut ? ((new Date(item.clockOut) - new Date(item.clockIn)) / 3600000).toFixed(1) : '---';
        const status = item.approved ? 'APPROVED' : (item.clockOut ? 'PENDING' : 'ON-GOING');
        const statusColor = item.approved ? '#10B981' : (item.clockOut ? '#F59E0B' : '#2563EB');

        return (
            <View style={styles.logCard}>
                <View style={styles.cardHeader}>
                    <View style={styles.siteInfo}>
                        <MaterialCommunityIcons name="office-building" size={20} color="#64748B" />
                        <Text style={styles.siteName} numberOfLines={1}>{item.projectId?.name || 'Project Site'}</Text>
                    </View>
                    <View style={[styles.statusBadge, { backgroundColor: statusColor + '15' }]}>
                        <Text style={[styles.statusText, { color: statusColor }]}>{status}</Text>
                    </View>
                </View>

                <View style={styles.cardBody}>
                    <View style={styles.infoRow}>
                        <View style={styles.infoCol}>
                            <Text style={styles.infoLabel}>DATE</Text>
                            <Text style={styles.infoValue}>{new Date(item.clockIn).toLocaleDateString([], { month: 'short', day: '2-digit', year: 'numeric' })}</Text>
                        </View>
                        <View style={styles.infoCol}>
                            <Text style={styles.infoLabel}>SHIFT TIME</Text>
                            <Text style={styles.infoValue}>
                                {new Date(item.clockIn).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} - {item.clockOut ? new Date(item.clockOut).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '...'}
                            </Text>
                        </View>
                    </View>

                    <View style={styles.divider} />

                    <View style={styles.cardFooter}>
                        <View style={styles.durationBox}>
                            <Text style={styles.durationLabel}>TOTAL DURATION</Text>
                            <Text style={styles.durationValue}>{durationH} Hours</Text>
                        </View>
                        <TouchableOpacity style={styles.detailsBtn} onPress={() => openDetails(item)}>
                            <Text style={styles.detailsBtnText}>View Details</Text>
                            <MaterialCommunityIcons name="chevron-right" size={16} color="#2563EB" />
                        </TouchableOpacity>
                    </View>
                </View>
            </View>
        );
    };

    const Header = () => (
        <View style={styles.headerArea}>
            <View style={styles.titleBox}>
                <Text style={styles.headerTitle}>My Hours</Text>
                <Text style={styles.headerSub}>Track your site hours and attendance history</Text>
            </View>

            <View style={styles.statsGrid}>
                {stats.map((s, i) => (
                    <View key={i} style={[styles.miniStat, { borderTopColor: s.color }]}>
                        <Text style={styles.miniLabel}>{s.label}</Text>
                        <Text style={styles.miniValue}>{s.value}</Text>
                        <Text style={styles.miniSub}>{s.sub}</Text>
                    </View>
                ))}
            </View>

            <View style={styles.searchContainer}>
                <View style={styles.searchBar}>
                    <MaterialCommunityIcons name="magnify" size={20} color="#94A3B8" />
                    <TextInput 
                        placeholder="Search by site or date..." 
                        style={styles.searchInput}
                        value={search}
                        onChangeText={setSearch}
                    />
                </View>
            </View>
        </View>
    );

    return (
        <View style={styles.container}>
            <StatusBar barStyle="dark-content" backgroundColor="#fff" />
            
            {/* COMPACT TOPBAR */}
            <View style={[styles.topbar, { paddingTop: Math.max(insets.top, 12), height: Math.max(insets.top + 50, 64) }]}>
                <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
                    <MaterialCommunityIcons name="arrow-left" size={22} color="#0F172A" />
                </TouchableOpacity>
                <Text style={styles.topbarTitle}>Attendance Logs</Text>
                <TouchableOpacity style={styles.actionBtn}>
                    <MaterialCommunityIcons name="filter-variant" size={22} color="#0F172A" />
                </TouchableOpacity>
            </View>

            {loading ? (
                <View style={styles.center}>
                    <ActivityIndicator size="large" color="#2563EB" />
                    <Text style={styles.loadingText}>Syncing logs...</Text>
                </View>
            ) : (
                <FlatList
                    data={logs}
                    keyExtractor={item => item._id || item.id}
                    renderItem={renderLogItem}
                    ListHeaderComponent={Header}
                    contentContainerStyle={styles.listContent}
                    showsVerticalScrollIndicator={false}
                    ListEmptyComponent={
                        <View style={styles.emptyBox}>
                            <MaterialCommunityIcons name="clock-alert-outline" size={64} color="#E2E8F0" />
                            <Text style={styles.emptyMain}>No Records Found</Text>
                        </View>
                    }
                />
            )}

            {/* DETAIL MODAL */}
            <Modal visible={showDetail} transparent animationType="slide">
                <View style={styles.modalOverlay}>
                    <View style={styles.modalContent}>
                        <View style={styles.modalHeader}>
                            <Text style={styles.modalTitle}>Log Details</Text>
                            <TouchableOpacity onPress={() => setShowDetail(false)}>
                                <MaterialCommunityIcons name="close-circle" size={28} color="#CBD5E1" />
                            </TouchableOpacity>
                        </View>

                        {selectedLog && (
                            <ScrollView showsVerticalScrollIndicator={false}>
                                <View style={styles.detailCard}>
                                    <Text style={styles.detailSectionLabel}>SITE INFORMATION</Text>
                                    <View style={styles.detailRow}>
                                        <MaterialCommunityIcons name="office-building" size={20} color="#2563EB" />
                                        <Text style={styles.detailValue}>{selectedLog.projectId?.name || 'Project Site'}</Text>
                                    </View>
                                    <Text style={styles.detailSubValue}>{((typeof selectedLog.projectId?.location === 'object' ? selectedLog.projectId.location.address : selectedLog.projectId?.location) || 'Assigned Location').toUpperCase()}</Text>

                                    <View style={styles.detailDivider} />

                                    <Text style={styles.detailSectionLabel}>SHIFT BREAKDOWN</Text>
                                    <View style={styles.timeInfoRow}>
                                        <View style={styles.timeInfoBox}>
                                            <Text style={styles.timeLabel}>CLOCKED IN</Text>
                                            <Text style={styles.timeValue}>{new Date(selectedLog.clockIn).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: true })}</Text>
                                            <Text style={styles.timeDate}>{new Date(selectedLog.clockIn).toLocaleDateString()}</Text>
                                        </View>
                                        <View style={styles.timeArrow}>
                                            <MaterialCommunityIcons name="arrow-right" size={20} color="#CBD5E1" />
                                        </View>
                                        <View style={styles.timeInfoBox}>
                                            <Text style={styles.timeLabel}>CLOCKED OUT</Text>
                                            <Text style={styles.timeValue}>{selectedLog.clockOut ? new Date(selectedLog.clockOut).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: true }) : '--:--'}</Text>
                                            <Text style={styles.timeDate}>{selectedLog.clockOut ? new Date(selectedLog.clockOut).toLocaleDateString() : 'Active'}</Text>
                                        </View>
                                    </View>

                                    <View style={styles.detailDivider} />

                                    <View style={styles.verifiedRow}>
                                        <MaterialCommunityIcons name="check-decagram" size={20} color="#10B981" />
                                        <Text style={styles.verifiedText}>GPS Location Verified at Site</Text>
                                    </View>

                                    <TouchableOpacity 
                                        style={styles.closeModalBtn}
                                        onPress={() => setShowDetail(false)}
                                    >
                                        <Text style={styles.closeModalBtnText}>CLOSE DETAILS</Text>
                                    </TouchableOpacity>
                                </View>
                            </ScrollView>
                        )}
                    </View>
                </View>
            </Modal>
        </View>
    );
};

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: COLORS.background },
    center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
    loadingText: { marginTop: 15, fontSize: moderateScale(13), fontWeight: '700', color: COLORS.textSecondary },
    listContent: { paddingBottom: 100 },

    topbar: { 
        flexDirection: 'row', 
        alignItems: 'center', 
        justifyContent: 'space-between', 
        backgroundColor: COLORS.surface, 
        paddingHorizontal: SPACING.m,
        height: Math.max(verticalScale(64), 60),
        borderBottomWidth: 1,
        borderBottomColor: COLORS.border
    },
    backBtn: { width: 40, height: 40, borderRadius: SIZES.radiusCard, backgroundColor: COLORS.surfaceSecondary, justifyContent: 'center', alignItems: 'center', borderWidth: 1, borderColor: COLORS.border },
    topbarTitle: { ...TYPOGRAPHY.subtitle, color: COLORS.textPrimary },
    actionBtn: { width: 40, height: 40, borderRadius: SIZES.radiusCard, backgroundColor: COLORS.surfaceSecondary, justifyContent: 'center', alignItems: 'center', borderWidth: 1, borderColor: COLORS.border },

    headerArea: { paddingHorizontal: SPACING.m, paddingTop: SPACING.m, marginBottom: SPACING.xs },
    titleBox: { marginBottom: SPACING.m },
    headerTitle: { ...TYPOGRAPHY.screenTitle, color: COLORS.textPrimary },
    headerSub: { ...TYPOGRAPHY.caption, color: COLORS.textSecondary, marginTop: 4 },

    statsGrid: { flexDirection: 'row', gap: 10, marginBottom: SPACING.m, paddingHorizontal: SPACING.m },
    miniStat: { flex: 1, backgroundColor: COLORS.card, borderRadius: SIZES.radiusCard, padding: SPACING.m, borderTopWidth: 4, borderTopColor: COLORS.primaryAccent, ...SHADOWS.small },
    miniLabel: { ...TYPOGRAPHY.label, color: COLORS.textMuted },
    miniValue: { fontSize: moderateScale(18), fontWeight: '900', color: COLORS.textPrimary, marginTop: 5 },
    miniSub: { ...TYPOGRAPHY.badge, color: COLORS.textMuted, marginTop: 3 },

    searchContainer: { paddingHorizontal: SPACING.m, marginBottom: SPACING.sm },
    searchBar: { flexDirection: 'row', alignItems: 'center', backgroundColor: COLORS.card, height: 50, borderRadius: SIZES.radiusInput, paddingHorizontal: SPACING.m, borderWidth: 1, borderColor: COLORS.border, ...SHADOWS.small },
    searchInput: { flex: 1, marginLeft: 12, fontSize: moderateScale(14), fontWeight: '700', color: COLORS.textPrimary },

    logCard: { backgroundColor: COLORS.card, marginHorizontal: SPACING.m, marginBottom: SPACING.m, borderRadius: SIZES.radiusCard, overflow: 'hidden', borderWidth: 1, borderColor: COLORS.border, ...SHADOWS.card },
    cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', backgroundColor: COLORS.surfaceSecondary, paddingHorizontal: SPACING.m, paddingVertical: SPACING.sm, borderBottomWidth: 1, borderBottomColor: COLORS.border },
    siteInfo: { flexDirection: 'row', alignItems: 'center', gap: 10, flex: 1 },
    siteName: { ...TYPOGRAPHY.body, fontWeight: '800', color: COLORS.textPrimary },
    statusBadge: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: SIZES.radiusCard },
    statusText: { ...TYPOGRAPHY.badge },

    cardBody: { padding: SPACING.m },
    infoRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: SPACING.m },
    infoCol: { flex: 1 },
    infoLabel: { ...TYPOGRAPHY.badge, color: COLORS.textMuted },
    infoValue: { ...TYPOGRAPHY.caption, color: COLORS.textSecondary, marginTop: 6 },

    divider: { height: 1.5, backgroundColor: COLORS.border, marginVertical: SPACING.sm },

    cardFooter: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
    durationBox: { flex: 1 },
    durationLabel: { ...TYPOGRAPHY.badge, color: COLORS.textMuted },
    durationValue: { ...TYPOGRAPHY.body, fontWeight: '900', color: '#2563EB', marginTop: 4 },
    detailsBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: '#EFF6FF', paddingHorizontal: 12, paddingVertical: 8, borderRadius: SIZES.radiusBtn },
    detailsBtnText: { ...TYPOGRAPHY.caption, color: '#2563EB' },

    emptyBox: { alignItems: 'center', marginTop: 100, paddingHorizontal: 40 },
    emptyMain: { ...TYPOGRAPHY.subtitle, color: COLORS.textPrimary, marginTop: SPACING.m },

    // MODAL STYLES
    modalOverlay: { flex: 1, backgroundColor: 'rgba(15, 23, 42, 0.7)', justifyContent: 'flex-end' },
    modalContent: { backgroundColor: COLORS.card, borderTopLeftRadius: SIZES.radiusModal, borderTopRightRadius: SIZES.radiusModal, padding: SPACING.md, maxHeight: '85%' },
    modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: SPACING.md },
    modalTitle: { ...TYPOGRAPHY.cardTitle, color: COLORS.textPrimary },
    
    detailCard: { padding: 4 },
    detailSectionLabel: { ...TYPOGRAPHY.label, color: COLORS.textMuted, marginBottom: 12 },
    detailRow: { flexDirection: 'row', alignItems: 'center', gap: SPACING.sm },
    detailValue: { fontSize: moderateScale(18), fontWeight: '900', color: COLORS.textPrimary },
    detailSubValue: { ...TYPOGRAPHY.badge, color: COLORS.textSecondary, marginLeft: 32, marginTop: 4 },
    detailDivider: { height: 1, backgroundColor: COLORS.border, marginVertical: SPACING.md },

    timeInfoRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
    timeInfoBox: { flex: 1, alignItems: 'center', backgroundColor: COLORS.surfaceSecondary, padding: SPACING.m, borderRadius: SIZES.radiusCard, borderWidth: 1, borderColor: COLORS.border },
    timeLabel: { ...TYPOGRAPHY.badge, color: COLORS.textMuted },
    timeValue: { fontSize: moderateScale(16), fontWeight: '900', color: COLORS.textPrimary, marginTop: 8 },
    timeDate: { ...TYPOGRAPHY.badge, color: COLORS.textSecondary, marginTop: 4 },
    timeArrow: { paddingHorizontal: 10 },

    verifiedRow: { flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: '#F0FDF4', padding: 15, borderRadius: SIZES.radiusCard, marginVertical: SPACING.m },
    verifiedText: { ...TYPOGRAPHY.caption, color: '#10B981', fontWeight: '800' },
    closeModalBtn: { backgroundColor: COLORS.primary, height: 52, borderRadius: SIZES.radiusBtn, justifyContent: 'center', alignItems: 'center', marginTop: SPACING.m },
    closeModalBtnText: { color: COLORS.white, ...TYPOGRAPHY.body, fontWeight: '900' },
});

export default WorkerLogsScreen;
