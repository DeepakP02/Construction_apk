import React, { useState, useEffect, useRef, useMemo } from 'react';
import {
    View,
    Text,
    StyleSheet,
    Pressable,
    TouchableOpacity,
    TextInput,
    Animated,
    StatusBar,
    RefreshControl,
    ScrollView,
    Modal,
    ActivityIndicator,
    Alert,
    useWindowDimensions,
} from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { SHADOWS, contentBottomForTabBar } from '../../constants/theme';
import WorkerHeader from '../../components/WorkerHeader';
import { useApp } from '../../context/AppContext';
import { scale, verticalScale, moderateScale, isTablet } from '../../utils/responsive';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

const STATUS_FILTERS = ['ALL', 'PLANNING', 'ACTIVE', 'COMPLETE', 'ON HOLD'];

/** Backend Job.status enum: planning | active | on-hold | completed */
function canonicalJobStatus(raw) {
    const x = String(raw || 'planning')
        .toLowerCase()
        .trim()
        .replace(/\s+/g, '_')
        .replace(/-/g, '_');
    if (x === 'in_progress' || x === 'inprogress') return 'active';
    if (x === 'on_hold' || x === 'onhold' || x === 'hold') return 'on-hold';
    if (x === 'done') return 'completed';
    if (x === 'todo' || x === 'pending') return 'planning';
    if (['planning', 'active', 'on_hold', 'completed'].includes(x)) {
        return x === 'on_hold' ? 'on-hold' : x;
    }
    return 'planning';
}

function jobMatchesFilter(job, filterKey) {
    if (filterKey === 'ALL') return true;
    const c = canonicalJobStatus(job.status);
    if (filterKey === 'PLANNING') return c === 'planning';
    if (filterKey === 'ACTIVE') return c === 'active';
    if (filterKey === 'COMPLETE') return c === 'completed';
    if (filterKey === 'ON HOLD') return c === 'on-hold';
    return true;
}

function formatLocationText(loc) {
    if (!loc || typeof loc !== 'string') return 'Site location';
    return loc
        .trim()
        .split(/[\s,]+/)
        .filter(Boolean)
        .map((w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
        .join(' ');
}

function getJobProgressPct(job) {
    const p = Number(job?.progress);
    if (!Number.isFinite(p)) return 0;
    return Math.min(100, Math.max(0, Math.round(p)));
}

function statusUi(raw) {
    const c = canonicalJobStatus(raw);
    if (c === 'completed') {
        return { label: 'DONE', color: '#047857', bg: '#ECFDF5', border: '#BBF7D0' };
    }
    if (c === 'on-hold') {
        return { label: 'ON HOLD', color: '#B45309', bg: '#FFFBEB', border: '#FDE68A' };
    }
    if (c === 'active') {
        return { label: 'LIVE', color: '#1D4ED8', bg: '#EFF6FF', border: '#BFDBFE' };
    }
    return { label: 'PLANNING', color: '#475569', bg: '#F8FAFC', border: '#E2E8F0' };
}

const STATUS_OPTIONS = [
    { label: 'Planning', value: 'planning' },
    { label: 'Active', value: 'active' },
    { label: 'On hold', value: 'on-hold' },
    { label: 'Completed', value: 'completed' },
];

const ForemanJobsScreen = ({ navigation }) => {
    const insets = useSafeAreaInsets();
    const { width } = useWindowDimensions();
    const isCompact = width < 380;
    const { jobs, refreshData, selectedProject, updateJob } = useApp();
    const [search, setSearch] = useState('');
    const [activeStatus, setActiveStatus] = useState('ALL');
    const [refreshing, setRefreshing] = useState(false);
    const [statusModalJob, setStatusModalJob] = useState(null);
    const [statusSavingId, setStatusSavingId] = useState(null);
    const fadeAnim = useRef(new Animated.Value(0)).current;

    useEffect(() => {
        const unsubscribe = navigation.addListener('focus', () => {
            refreshData();
        });
        Animated.timing(fadeAnim, { toValue: 1, duration: 600, useNativeDriver: true }).start();
        return unsubscribe;
    }, [navigation, refreshData]);

    const onRefresh = async () => {
        setRefreshing(true);
        await refreshData();
        setRefreshing(false);
    };

    const filteredJobs = useMemo(() => {
        return (jobs || []).filter((j) => {
            const title = (j.name || j.title || '').toLowerCase();
            const loc = (j.location || j.projectId?.name || '').toLowerCase();
            const q = search.toLowerCase().trim();
            const matchesSearch = !q || title.includes(q) || loc.includes(q);
            const matchesSelected =
                !selectedProject ||
                String(j.projectId?._id || j.projectId) === String(selectedProject._id || selectedProject.id);
            return matchesSearch && matchesSelected && jobMatchesFilter(j, activeStatus);
        });
    }, [jobs, search, selectedProject, activeStatus]);

    const pickJobStatus = async (job, nextValue) => {
        const id = job?._id || job?.id;
        if (!id) return;
        setStatusSavingId(String(id));
        const ok = await updateJob(id, nextValue);
        setStatusSavingId(null);
        setStatusModalJob(null);
        if (!ok) Alert.alert('Update failed', 'Could not update job status. Try again.');
        else await refreshData();
    };

    const padH = isTablet ? '10%' : scale(20);

    const renderJobCard = (item) => {
        const pct = getJobProgressPct(item);
        const su = statusUi(item.status);
        const loc = formatLocationText(item.location || item.projectId?.name || '');
        const title = item.name || item.title || 'Untitled job';
        const jid = item._id || item.id;
        const saving = statusSavingId && String(jid) === statusSavingId;

        return (
            <View
                key={String(jid)}
                style={[styles.jobCardShell, isTablet ? styles.jobCardShellTablet : null]}
            >
                <View style={[styles.jobCard, SHADOWS.small]}>
                    <View style={styles.cardHeader}>
                        <View style={styles.iconBox}>
                            <MaterialCommunityIcons name="briefcase-variant-outline" size={moderateScale(22)} color="#2563EB" />
                        </View>
                        <View style={styles.headerRight}>
                            <Text style={styles.manageLabel}>STATUS</Text>
                            <TouchableOpacity
                                style={[styles.statusPill, { borderColor: su.border, backgroundColor: su.bg }]}
                                onPress={() => setStatusModalJob(item)}
                                disabled={!!statusSavingId}
                                activeOpacity={0.75}
                            >
                                {saving ? (
                                    <ActivityIndicator size="small" color={su.color} />
                                ) : (
                                    <Text style={[styles.statusPillText, { color: su.color }]}>{su.label}</Text>
                                )}
                            </TouchableOpacity>
                        </View>
                    </View>

                    <View style={styles.cardBody}>
                        <Text style={[styles.jobTitle, isCompact && { fontSize: moderateScale(17) }]} numberOfLines={2}>
                            {title}
                        </Text>
                        {item.projectId?.name ? (
                            <Text style={styles.projectLine} numberOfLines={1}>
                                {item.projectId.name}
                            </Text>
                        ) : null}
                        <View style={styles.locationRow}>
                            <MaterialCommunityIcons name="map-marker" size={moderateScale(15)} color="#94A3B8" />
                            <Text style={styles.locationText} numberOfLines={2}>
                                {loc}
                            </Text>
                        </View>

                        <View style={styles.progressBlock}>
                            <View style={styles.progressLabelRow}>
                                <Text style={styles.progressLabel}>PROGRESS</Text>
                                <Text style={styles.progressValue}>{pct}%</Text>
                            </View>
                            <View style={styles.progressTrack}>
                                <View style={[styles.progressFill, { width: `${pct}%` }]} />
                            </View>
                        </View>
                    </View>

                    <TouchableOpacity
                        style={styles.viewTasksBtn}
                        onPress={() => navigation.navigate('ForemanJobDetail', { jobId: jid })}
                        activeOpacity={0.85}
                    >
                        <MaterialCommunityIcons name="clipboard-list-outline" size={moderateScale(20)} color="#fff" />
                        <Text style={styles.viewTasksText}>VIEW TASKS</Text>
                    </TouchableOpacity>
                </View>
            </View>
        );
    };

    return (
        <View style={styles.container}>
            <StatusBar barStyle="dark-content" />
            <WorkerHeader title="Job Center" showBranding={true} />

            <ScrollView
                stickyHeaderIndices={[1]}
                showsVerticalScrollIndicator={false}
                refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
                contentContainerStyle={{ paddingBottom: contentBottomForTabBar(insets.bottom) }}
                keyboardShouldPersistTaps="handled"
            >
                <View style={[styles.headerTitleSection, { paddingHorizontal: padH, paddingTop: verticalScale(12), paddingBottom: verticalScale(8) }]}>
                    <Text style={[styles.screenTitle, { fontSize: moderateScale(22) }]}>Site jobs</Text>
                    <Text style={[styles.commandSubtitle, { marginTop: verticalScale(4) }]}>ASSIGNED JOBS & TASK ROUTES</Text>
                </View>

                <View style={[styles.stickyActionArea, { paddingHorizontal: padH, paddingVertical: verticalScale(12) }]}>
                    <View style={[styles.searchBar, { height: verticalScale(44), borderRadius: moderateScale(12), paddingHorizontal: scale(12) }]}>
                        <MaterialCommunityIcons name="magnify" size={moderateScale(20)} color="#94A3B8" />
                        <TextInput
                            style={[styles.searchInput, { fontSize: moderateScale(14), marginLeft: scale(8) }]}
                            placeholder="Search jobs, location, project..."
                            placeholderTextColor="#94A3B8"
                            value={search}
                            onChangeText={setSearch}
                        />
                    </View>
                    <ScrollView
                        horizontal
                        showsHorizontalScrollIndicator={false}
                        style={{ marginTop: verticalScale(12) }}
                        contentContainerStyle={styles.chipRow}
                    >
                        {STATUS_FILTERS.map((chip) => (
                            <TouchableOpacity
                                key={chip}
                                style={[styles.filterChip, activeStatus === chip && styles.filterChipActive]}
                                onPress={() => setActiveStatus(chip)}
                            >
                                <Text style={[styles.filterChipText, activeStatus === chip && styles.filterChipTextActive]}>{chip}</Text>
                            </TouchableOpacity>
                        ))}
                    </ScrollView>
                </View>

                <Animated.View style={[styles.listBlock, { opacity: fadeAnim, paddingHorizontal: padH }]}>
                    {filteredJobs.length > 0 ? (
                        filteredJobs.map((item) => renderJobCard(item))
                    ) : (
                        <View style={styles.emptyView}>
                            <MaterialCommunityIcons name="office-building-marker" size={moderateScale(60)} color="#E2E8F0" />
                            <Text style={styles.emptyTitle}>No jobs found</Text>
                            <Text style={styles.emptySub}>Adjust filters, search, or pull to refresh.</Text>
                        </View>
                    )}
                </Animated.View>
            </ScrollView>

            <Modal visible={!!statusModalJob} transparent animationType="fade" onRequestClose={() => setStatusModalJob(null)}>
                <View style={styles.modalOverlay}>
                    <Pressable style={StyleSheet.absoluteFill} onPress={() => setStatusModalJob(null)} />
                    <View style={[styles.statusSheet, isTablet ? { maxWidth: 420, alignSelf: 'center', width: '100%' } : null]}>
                        <Text style={styles.sheetTitle}>Update status</Text>
                        <Text style={styles.sheetSub} numberOfLines={2}>
                            {statusModalJob?.name || statusModalJob?.title || 'Job'}
                        </Text>
                        {STATUS_OPTIONS.map((opt) => (
                            <TouchableOpacity
                                key={opt.value}
                                style={styles.statusOptionRow}
                                onPress={() => statusModalJob && pickJobStatus(statusModalJob, opt.value)}
                            >
                                <Text style={styles.statusOptionLabel}>{opt.label}</Text>
                                <MaterialCommunityIcons name="chevron-right" size={20} color="#94A3B8" />
                            </TouchableOpacity>
                        ))}
                        <TouchableOpacity style={styles.sheetCancel} onPress={() => setStatusModalJob(null)}>
                            <Text style={styles.sheetCancelText}>Cancel</Text>
                        </TouchableOpacity>
                    </View>
                </View>
            </Modal>
        </View>
    );
};

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: '#F8FAFC' },
    headerTitleSection: {},
    screenTitle: { fontWeight: '900', color: '#0F172A', letterSpacing: -0.3 },
    commandSubtitle: { fontSize: moderateScale(9), fontWeight: '800', color: '#64748B', letterSpacing: 1 },
    stickyActionArea: { backgroundColor: '#F8FAFC' },
    searchBar: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#fff',
        borderWidth: 1,
        borderColor: '#E2E8F0',
    },
    searchInput: { flex: 1, color: '#1E293B', fontWeight: '600' },
    chipRow: { flexDirection: 'row', alignItems: 'center', gap: scale(8), paddingRight: scale(8) },
    filterChip: {
        paddingHorizontal: scale(14),
        paddingVertical: verticalScale(8),
        borderRadius: moderateScale(10),
        backgroundColor: '#EDF2F7',
        borderWidth: 1,
        borderColor: 'transparent',
    },
    filterChipActive: { backgroundColor: '#fff', borderColor: '#BFDBFE', elevation: 1 },
    filterChipText: { fontSize: moderateScale(11), fontWeight: '800', color: '#94A3B8' },
    filterChipTextActive: { color: '#1E293B' },
    listBlock: { paddingTop: verticalScale(8) },
    jobCardShell: { marginBottom: verticalScale(14) },
    jobCardShellTablet: { maxWidth: 720, alignSelf: 'center', width: '100%' },
    jobCard: {
        backgroundColor: '#fff',
        borderRadius: moderateScale(16),
        padding: moderateScale(16),
        borderWidth: 1,
        borderColor: '#F1F5F9',
    },
    cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
    iconBox: {
        width: scale(46),
        height: scale(46),
        borderRadius: moderateScale(12),
        backgroundColor: '#EFF6FF',
        alignItems: 'center',
        justifyContent: 'center',
    },
    headerRight: { alignItems: 'flex-end', gap: verticalScale(4) },
    manageLabel: { fontSize: moderateScale(8), fontWeight: '900', color: '#94A3B8', letterSpacing: 0.8 },
    statusPill: {
        minWidth: scale(88),
        paddingHorizontal: scale(12),
        paddingVertical: verticalScale(6),
        borderRadius: moderateScale(8),
        borderWidth: 1,
        alignItems: 'center',
        justifyContent: 'center',
    },
    statusPillText: { fontSize: moderateScale(10), fontWeight: '900', letterSpacing: 0.5 },
    cardBody: { marginTop: verticalScale(14) },
    jobTitle: { fontSize: moderateScale(20), fontWeight: '900', color: '#0F172A' },
    projectLine: { fontSize: moderateScale(12), fontWeight: '700', color: '#64748B', marginTop: verticalScale(4) },
    locationRow: { flexDirection: 'row', alignItems: 'flex-start', gap: scale(6), marginTop: verticalScale(8) },
    locationText: { flex: 1, fontSize: moderateScale(13), fontWeight: '700', color: '#64748B', lineHeight: moderateScale(18) },
    progressBlock: { marginTop: verticalScale(16) },
    progressLabelRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: verticalScale(6) },
    progressLabel: { fontSize: moderateScale(10), fontWeight: '900', color: '#64748B', letterSpacing: 1 },
    progressValue: { fontSize: moderateScale(11), fontWeight: '900', color: '#0F172A' },
    progressTrack: {
        height: verticalScale(6),
        backgroundColor: '#F1F5F9',
        borderRadius: moderateScale(3),
        overflow: 'hidden',
    },
    progressFill: { height: '100%', backgroundColor: '#2563EB', borderRadius: moderateScale(3) },
    viewTasksBtn: {
        marginTop: verticalScale(16),
        height: verticalScale(52),
        borderRadius: moderateScale(14),
        backgroundColor: '#2563EB',
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: scale(10),
    },
    viewTasksText: { color: '#fff', fontWeight: '900', fontSize: moderateScale(13), letterSpacing: 0.8 },
    emptyView: { alignItems: 'center', paddingVertical: verticalScale(48), paddingHorizontal: scale(24) },
    emptyTitle: { fontSize: moderateScale(18), fontWeight: '900', color: '#1E293B', marginTop: verticalScale(16) },
    emptySub: { fontSize: moderateScale(13), fontWeight: '600', color: '#94A3B8', textAlign: 'center', marginTop: verticalScale(8) },
    modalOverlay: {
        flex: 1,
        backgroundColor: 'rgba(15,23,42,0.45)',
        justifyContent: 'flex-end',
    },
    statusSheet: {
        backgroundColor: '#fff',
        borderTopLeftRadius: 24,
        borderTopRightRadius: 24,
        paddingHorizontal: scale(20),
        paddingTop: verticalScale(20),
        paddingBottom: verticalScale(28),
        zIndex: 2,
        elevation: 12,
    },
    sheetTitle: { fontSize: moderateScale(18), fontWeight: '900', color: '#0F172A' },
    sheetSub: { fontSize: moderateScale(13), fontWeight: '600', color: '#64748B', marginTop: verticalScale(6), marginBottom: verticalScale(12) },
    statusOptionRow: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingVertical: verticalScale(14),
        borderBottomWidth: 1,
        borderBottomColor: '#F1F5F9',
    },
    statusOptionLabel: { fontSize: moderateScale(15), fontWeight: '700', color: '#1E293B' },
    sheetCancel: { marginTop: verticalScale(16), alignItems: 'center', paddingVertical: verticalScale(12) },
    sheetCancelText: { fontSize: moderateScale(13), fontWeight: '900', color: '#64748B' },
});

export default ForemanJobsScreen;
