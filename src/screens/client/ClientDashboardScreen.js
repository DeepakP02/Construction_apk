import React, { useState, useCallback, useMemo, useEffect } from 'react';
import {
    View,
    Text,
    StyleSheet,
    ScrollView,
    TouchableOpacity,
    Image,
    StatusBar,
    ActivityIndicator,
    RefreshControl,
} from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { COLORS, SHADOWS, SPACING, contentBottomForTabBar } from '../../constants/theme';
import WorkerHeader from '../../components/WorkerHeader';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useApp } from '../../context/AppContext';
import api, { getServerUrl } from '../../utils/api';

const asList = (res) => {
    const d = res?.data;
    if (Array.isArray(d)) return d;
    if (Array.isArray(d?.data)) return d.data;
    return [];
};

const projectProgress = (p) => {
    if (!p) return 0;
    const n = Number(p.progress ?? p.progressPercentage ?? 0);
    return Number.isFinite(n) ? Math.min(100, Math.max(0, n)) : 0;
};

const ClientDashboardScreen = ({ navigation }) => {
    const insets = useSafeAreaInsets();
    const { user, projects, refreshData } = useApp();
    const [dashLoading, setDashLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [invoices, setInvoices] = useState([]);
    const [photos, setPhotos] = useState([]);
    const [drawings, setDrawings] = useState([]);
    const [updates, setUpdates] = useState([]);

    const primaryProject = projects?.[0] || null;

    const loadDashboardExtras = useCallback(async () => {
        try {
            setDashLoading(true);
            const [invRes, photoRes, drawRes] = await Promise.all([
                api.get('/invoices').catch(() => ({ data: [] })),
                api.get('/photos').catch(() => ({ data: [] })),
                api.get('/drawings').catch(() => ({ data: [] })),
            ]);
            setInvoices(asList(invRes));
            setPhotos(asList(photoRes));
            setDrawings(asList(drawRes));

            const firstId = projects?.[0]?._id || projects?.[0]?.id;
            if (firstId) {
                try {
                    const upRes = await api.get(`/projects/${firstId}/client-updates`);
                    const raw = asList(upRes);
                    setUpdates((raw || []).slice(0, 5));
                } catch {
                    setUpdates([]);
                }
            } else {
                setUpdates([]);
            }
        } catch (e) {
            console.warn('Client dashboard fetch:', e?.message || e);
        } finally {
            setDashLoading(false);
        }
    }, [projects]);

    useEffect(() => {
        loadDashboardExtras();
    }, [loadDashboardExtras]);

    const onRefresh = useCallback(async () => {
        setRefreshing(true);
        try {
            await refreshData?.();
            await loadDashboardExtras();
        } finally {
            setRefreshing(false);
        }
    }, [refreshData, loadDashboardExtras]);

    const stats = useMemo(() => {
        const list = projects || [];
        const totalBudget = list.reduce((acc, p) => acc + (Number(p.budget) || 0), 0);
        const avgProgress =
            list.length > 0
                ? Math.round(list.reduce((acc, p) => acc + projectProgress(p), 0) / list.length)
                : 0;
        const unpaid = (invoices || []).filter((i) => (i.status || '').toLowerCase() !== 'paid').length;
        return { totalBudget, avgProgress, unpaid, projectCount: list.length };
    }, [projects, invoices]);

    const latestUpdate = updates[0];
    const galleryPhotos = (photos || []).slice(0, 4);
    const vaultDrawings = (drawings || []).slice(0, 3);

    const progress = projectProgress(primaryProject);
    const lastUpdateDate = latestUpdate?.date
        ? new Date(latestUpdate.date).toLocaleDateString()
        : primaryProject?.updatedAt
          ? new Date(primaryProject.updatedAt).toLocaleDateString()
          : '—';

    return (
        <View style={styles.container}>
            <StatusBar barStyle="dark-content" backgroundColor="#FFFFFF" />
            <WorkerHeader showBranding={true} hideSearch={true} title="Client Dashboard" />

            {dashLoading && !(projects?.length) ? (
                <View style={styles.centerLoad}>
                    <ActivityIndicator size="large" color={COLORS.primaryAccent} />
                    <Text style={styles.loadHint}>Loading your portfolio…</Text>
                </View>
            ) : (
                <ScrollView
                    showsVerticalScrollIndicator={false}
                    refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
                    contentContainerStyle={[
                        styles.scrollContent,
                        { paddingBottom: contentBottomForTabBar(insets.bottom) },
                    ]}
                >
                    <Text style={styles.welcome}>
                        Welcome, <Text style={styles.welcomeName}>{user?.fullName || 'Client'}</Text>
                    </Text>
                    <Text style={styles.welcomeSub}>
                        {projects?.length
                            ? `Synced with your projects on the web portal.`
                            : "You don't have any projects assigned yet. When your PM links you to a job, it will appear here."}
                    </Text>

                    {/* Quick stats — mirrors web client portal dashboard metrics */}
                    <View style={styles.statsGrid}>
                        <View style={[styles.statCell, SHADOWS.small]}>
                            <Text style={styles.statLabel}>Portfolio</Text>
                            <Text style={styles.statValue}>{stats.projectCount}</Text>
                            <Text style={styles.statSub}>project(s)</Text>
                        </View>
                        <View style={[styles.statCell, SHADOWS.small]}>
                            <Text style={styles.statLabel}>Avg progress</Text>
                            <Text style={styles.statValue}>{stats.avgProgress}%</Text>
                            <Text style={styles.statSub}>across sites</Text>
                        </View>
                        <View style={[styles.statCell, SHADOWS.small]}>
                            <Text style={styles.statLabel}>Open invoices</Text>
                            <Text style={styles.statValue}>{stats.unpaid}</Text>
                            <Text style={styles.statSub}>not paid</Text>
                        </View>
                        <View style={[styles.statCell, SHADOWS.small]}>
                            <Text style={styles.statLabel}>Site photos</Text>
                            <Text style={styles.statValue}>{photos.length}</Text>
                            <Text style={styles.statSub}>in gallery</Text>
                        </View>
                    </View>

                    {primaryProject ? (
                        <View style={[styles.mainCard, SHADOWS.card]}>
                            <View style={styles.cardHeader}>
                                <Text style={styles.cardTopTitle}>Project timeline</Text>
                            </View>

                            <View style={styles.progressRow}>
                                <Text style={styles.bigPercent}>{progress}%</Text>
                                <View style={styles.progressNameBox}>
                                    <Text style={styles.projectNameText} numberOfLines={2}>
                                        {primaryProject.name}
                                    </Text>
                                    <Text style={styles.progressLabel}>Current progress</Text>
                                </View>
                            </View>

                            <View style={styles.progressBarWrapper}>
                                <View style={[styles.progressBarFill, { width: `${Math.max(progress, 2)}%` }]} />
                            </View>

                            <View style={styles.cardDivider} />

                            <View style={styles.updateSection}>
                                <View style={styles.updateMeta}>
                                    <Text style={styles.updateDate}>{lastUpdateDate}</Text>
                                    <View style={styles.dotSeparator} />
                                    <Text style={styles.updateType}>Site update</Text>
                                </View>
                                <Text style={styles.updateDesc} numberOfLines={4}>
                                    {latestUpdate?.description ||
                                        latestUpdate?.title ||
                                        'No client-visible updates yet. Your project team will post progress here.'}
                                </Text>
                            </View>

                            <View style={styles.rowActions}>
                                <TouchableOpacity
                                    style={styles.compactActionBtn}
                                    onPress={() =>
                                        navigation.navigate('ClientProgress', { project: primaryProject })
                                    }
                                >
                                    <LinearGradient
                                        colors={[COLORS.primaryAccent, '#2563EB']}
                                        start={{ x: 0, y: 0 }}
                                        end={{ x: 1, y: 0 }}
                                        style={styles.btnGradient}
                                    >
                                        <MaterialCommunityIcons name="chart-line" size={18} color="#fff" />
                                        <Text style={styles.btnText}>View progress</Text>
                                    </LinearGradient>
                                </TouchableOpacity>
                                <TouchableOpacity style={styles.outlineMini} onPress={() => navigation.navigate('Drawings')}>
                                    <MaterialCommunityIcons name="floor-plan" size={18} color="#2563EB" />
                                    <Text style={styles.outlineMiniTxt}>Drawings</Text>
                                </TouchableOpacity>
                            </View>
                        </View>
                    ) : null}

                    <View style={styles.sectionHeaderCompact}>
                        <Text style={styles.sectionTitleCompact}>Latest site views</Text>
                        <TouchableOpacity onPress={() => navigation.navigate('Photos')}>
                            <Text style={styles.linkText}>Gallery</Text>
                        </TouchableOpacity>
                    </View>

                    {galleryPhotos.length === 0 ? (
                        <Text style={styles.mutedBox}>No photos yet. Open the Photos tab when your team uploads site images.</Text>
                    ) : (
                        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.galleryScrollCompact}>
                            {galleryPhotos.map((ph) => {
                                const uri = getServerUrl(ph.imageUrl) || ph.imageUrl;
                                const key = ph._id || ph.id || uri;
                                return (
                                    <View key={key} style={styles.galleryItemCompact}>
                                        <Image source={{ uri }} style={styles.galleryImgCompact} />
                                        <View style={styles.siteLabelCompact}>
                                            <Text style={styles.siteLabelText} numberOfLines={1}>
                                                {ph.projectId?.name || 'Site'}
                                            </Text>
                                        </View>
                                    </View>
                                );
                            })}
                        </ScrollView>
                    )}

                    <View style={[styles.sectionHeaderCompact, { marginTop: 25 }]}>
                        <Text style={styles.sectionTitleCompact}>Vault & drawings</Text>
                    </View>

                    {vaultDrawings.length === 0 ? (
                        <Text style={styles.mutedBox}>No drawings on file yet.</Text>
                    ) : (
                        vaultDrawings.map((doc) => (
                            <TouchableOpacity
                                key={doc._id || doc.id}
                                style={[styles.docItemCompact, SHADOWS.small]}
                                onPress={() => navigation.navigate('Drawings')}
                            >
                                <View style={styles.docIconCircle}>
                                    <MaterialCommunityIcons name="file-pdf-box" size={24} color="#DC2626" />
                                </View>
                                <View style={{ flex: 1, marginLeft: 12 }}>
                                    <Text style={styles.docTitleCompact} numberOfLines={1}>
                                        {doc.title || doc.drawingNumber || 'Drawing'}
                                    </Text>
                                    <Text style={styles.docMetaCompact} numberOfLines={1}>
                                        {(doc.category || 'document').toString()} · v{doc.currentVersion ?? 1}
                                    </Text>
                                </View>
                                <MaterialCommunityIcons name="chevron-right" size={20} color="#94A3B8" />
                            </TouchableOpacity>
                        ))
                    )}

                    <TouchableOpacity style={styles.viewAllVaultBtnCompact} onPress={() => navigation.navigate('Drawings')}>
                        <Text style={styles.viewAllVaultTextCompact}>View all vault</Text>
                    </TouchableOpacity>
                </ScrollView>
            )}
        </View>
    );
};

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: '#F8FAFC' },
    centerLoad: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 24 },
    loadHint: { marginTop: 12, fontWeight: '700', color: '#64748B', fontSize: 13 },
    scrollContent: { paddingHorizontal: SPACING.m, paddingTop: 10 },
    welcome: { fontSize: 22, fontWeight: '900', color: '#0F172A', marginBottom: 6 },
    welcomeName: { color: '#2563EB' },
    welcomeSub: { fontSize: 13, fontWeight: '600', color: '#64748B', marginBottom: 16, lineHeight: 18 },
    statsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginBottom: 18 },
    statCell: {
        width: '48%',
        flexGrow: 1,
        backgroundColor: '#fff',
        borderRadius: 16,
        padding: 14,
        borderWidth: 1,
        borderColor: '#F1F5F9',
    },
    statLabel: { fontSize: 9, fontWeight: '900', color: '#94A3B8', textTransform: 'uppercase', letterSpacing: 0.8 },
    statValue: { fontSize: 22, fontWeight: '900', color: '#0F172A', marginTop: 4 },
    statSub: { fontSize: 11, fontWeight: '600', color: '#64748B', marginTop: 2 },
    mainCard: {
        backgroundColor: '#fff',
        borderRadius: 24,
        padding: 20,
        marginBottom: 20,
        borderWidth: 1,
        borderColor: '#F1F5F9',
    },
    cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 },
    cardTopTitle: {
        fontSize: 12,
        fontWeight: '900',
        color: '#64748B',
        textTransform: 'uppercase',
        letterSpacing: 1,
    },
    progressRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 15 },
    bigPercent: { fontSize: 36, fontWeight: '900', color: '#0F172A', letterSpacing: -1.5 },
    progressNameBox: { marginLeft: 15, flex: 1 },
    projectNameText: { fontSize: 16, fontWeight: '800', color: '#1E293B' },
    progressLabel: { fontSize: 12, fontWeight: '600', color: '#94A3B8', marginTop: 2 },
    progressBarWrapper: {
        height: 8,
        backgroundColor: '#F1F5F9',
        borderRadius: 4,
        width: '100%',
        marginBottom: 20,
        overflow: 'hidden',
    },
    progressBarFill: { height: '100%', backgroundColor: COLORS.primaryAccent, borderRadius: 4 },
    cardDivider: { height: 1, backgroundColor: '#F1F5F9', width: '100%', marginBottom: 15 },
    updateSection: { marginBottom: 16 },
    updateMeta: { flexDirection: 'row', alignItems: 'center', marginBottom: 6 },
    updateDate: { fontSize: 12, fontWeight: '800', color: '#64748B' },
    dotSeparator: { width: 3, height: 3, borderRadius: 1.5, backgroundColor: '#CBD5E1', marginHorizontal: 8 },
    updateType: { fontSize: 12, fontWeight: '800', color: COLORS.primaryAccent },
    updateDesc: { fontSize: 14, color: '#475569', lineHeight: 20, fontWeight: '600' },
    rowActions: { flexDirection: 'row', gap: 10, alignItems: 'stretch' },
    compactActionBtn: { flex: 1, borderRadius: 14, overflow: 'hidden', elevation: 3 },
    outlineMini: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 6,
        paddingHorizontal: 14,
        borderRadius: 14,
        borderWidth: 1,
        borderColor: '#BFDBFE',
        backgroundColor: '#EFF6FF',
    },
    outlineMiniTxt: { fontWeight: '900', fontSize: 12, color: '#2563EB' },
    btnGradient: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingVertical: 12, gap: 8 },
    btnText: { color: '#fff', fontSize: 14, fontWeight: '900' },
    sectionHeaderCompact: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 12,
        paddingHorizontal: 4,
    },
    sectionTitleCompact: { fontSize: 15, fontWeight: '900', color: '#1E293B' },
    linkText: { fontSize: 12, fontWeight: '800', color: COLORS.primaryAccent },
    mutedBox: { fontSize: 13, fontWeight: '600', color: '#94A3B8', marginBottom: 14, paddingHorizontal: 4 },
    galleryScrollCompact: { marginHorizontal: -16, paddingHorizontal: 16 },
    galleryItemCompact: {
        marginRight: 12,
        width: 120,
        height: 120,
        borderRadius: 18,
        overflow: 'hidden',
        backgroundColor: '#E2E8F0',
    },
    galleryImgCompact: { width: '100%', height: '100%' },
    siteLabelCompact: {
        position: 'absolute',
        bottom: 8,
        left: 8,
        backgroundColor: 'rgba(15, 23, 42, 0.6)',
        paddingHorizontal: 8,
        paddingVertical: 3,
        borderRadius: 6,
        maxWidth: 100,
    },
    siteLabelText: { color: '#fff', fontSize: 10, fontWeight: '900' },
    docItemCompact: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#fff',
        padding: 14,
        borderRadius: 18,
        marginBottom: 10,
        borderWidth: 1,
        borderColor: '#F1F5F9',
    },
    docIconCircle: {
        width: 44,
        height: 44,
        borderRadius: 12,
        backgroundColor: '#FEF2F2',
        justifyContent: 'center',
        alignItems: 'center',
    },
    docTitleCompact: { fontSize: 14, fontWeight: '800', color: '#1E293B' },
    docMetaCompact: { fontSize: 11, color: '#94A3B8', fontWeight: '700', marginTop: 2 },
    viewAllVaultBtnCompact: {
        marginTop: 8,
        width: '100%',
        padding: 14,
        borderRadius: 14,
        backgroundColor: '#F1F5F9',
        alignItems: 'center',
    },
    viewAllVaultTextCompact: { fontSize: 13, fontWeight: '800', color: '#64748B' },
});

export default ClientDashboardScreen;
