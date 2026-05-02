import React, { useState, useEffect, useCallback } from 'react';
import {
    View,
    Text,
    StyleSheet,
    ScrollView,
    TouchableOpacity,
    StatusBar,
    useWindowDimensions,
    ActivityIndicator,
    Image,
} from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { SHADOWS } from '../../constants/theme';
import api, { getServerUrl } from '../../utils/api';

const fmtDate = (v) => {
    if (!v) return '—';
    const d = new Date(v);
    return Number.isNaN(d.getTime()) ? '—' : d.toLocaleDateString();
};

const ClientProgressScreen = ({ route, navigation }) => {
    const { width } = useWindowDimensions();
    const insets = useSafeAreaInsets();
    const isCompact = width < 380;
    const isTablet = width >= 768;
    const { project } = route.params || {};
    const projectId = project?._id || project?.id;

    const [loading, setLoading] = useState(true);
    const [progressData, setProgressData] = useState(null);
    const [updates, setUpdates] = useState([]);

    const load = useCallback(async () => {
        if (!projectId) {
            setLoading(false);
            return;
        }
        try {
            setLoading(true);
            const [progRes, updateRes] = await Promise.all([
                api.get(`/projects/${projectId}/client-progress`),
                api.get(`/projects/${projectId}/client-updates`),
            ]);
            setProgressData(progRes.data);
            setUpdates(Array.isArray(updateRes.data) ? updateRes.data : []);
        } catch (e) {
            console.warn('Client progress fetch:', e?.response?.data || e?.message);
            setProgressData(null);
            setUpdates([]);
        } finally {
            setLoading(false);
        }
    }, [projectId]);

    useEffect(() => {
        load();
    }, [load]);

    const progress = progressData?.progress ?? project?.progress ?? project?.progressPercentage ?? 0;
    const currentPhase = progressData?.currentPhase || project?.currentPhase || 'Planning';
    const displayName = progressData?.projectName || project?.name || 'Project';
    const statusRaw = (progressData?.status || project?.status || 'planning').toString();

    if (!projectId) {
        return (
            <View style={[styles.container, styles.centerMsg]}>
                <Text style={styles.centerMsgTxt}>Missing project.</Text>
                <TouchableOpacity onPress={() => navigation.goBack()} style={{ marginTop: 16 }}>
                    <Text style={styles.linkBack}>Go back</Text>
                </TouchableOpacity>
            </View>
        );
    }

    if (loading) {
        return (
            <View style={[styles.container, styles.centerMsg]}>
                <ActivityIndicator size="large" color="#2563EB" />
                <Text style={[styles.centerMsgTxt, { marginTop: 12 }]}>Loading live progress…</Text>
            </View>
        );
    }

    if (!progressData) {
        return (
            <View style={[styles.container, styles.centerMsg]}>
                <Text style={styles.centerMsgTxt}>Could not load progress for this project.</Text>
                <TouchableOpacity onPress={load} style={{ marginTop: 16 }}>
                    <Text style={styles.linkBack}>Retry</Text>
                </TouchableOpacity>
                <TouchableOpacity onPress={() => navigation.goBack()} style={{ marginTop: 8 }}>
                    <Text style={styles.linkBack}>Go back</Text>
                </TouchableOpacity>
            </View>
        );
    }

    const completed = progressData.completedWork || [];
    const upcoming = progressData.upcomingWork || [];

    return (
        <View style={styles.container}>
            <StatusBar barStyle="dark-content" backgroundColor="#FFFFFF" />

            <View style={[styles.header, { paddingTop: insets.top + 10, paddingHorizontal: isCompact ? 12 : 20 }]}>
                <View style={styles.topRow}>
                    <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
                        <MaterialCommunityIcons name="chevron-left" size={28} color="#0F172A" />
                    </TouchableOpacity>
                    <View style={[styles.projectHeaderInfo, { flexWrap: 'wrap' }]}>
                        <Text style={[styles.projectName, { fontSize: isCompact ? 22 : 28 }]} numberOfLines={2}>
                            {displayName}
                        </Text>
                        <View style={styles.statusBadge}>
                            <Text style={styles.statusText}>{statusRaw.replace(/_/g, ' ').toUpperCase()}</Text>
                        </View>
                    </View>
                </View>
                <View style={styles.breadcrumbRow}>
                    <MaterialCommunityIcons name="pulse" size={16} color="#3B82F6" />
                    <Text style={styles.breadcrumbText}>LIVE WORK PROGRESS VIEW</Text>
                </View>
            </View>

            <ScrollView
                showsVerticalScrollIndicator={false}
                contentContainerStyle={[
                    styles.scrollContent,
                    { paddingHorizontal: isCompact ? 12 : 16, maxWidth: isTablet ? 980 : undefined, alignSelf: 'center', width: '100%' },
                ]}
            >
                <View style={styles.topDashboardRow}>
                    <View style={[styles.progressCard, SHADOWS.medium, { padding: isCompact ? 18 : 30 }]}>
                        <View style={[styles.circularContainer, { width: isCompact ? 150 : 180, height: isCompact ? 150 : 180 }]}>
                            <View
                                style={[
                                    styles.outerCircle,
                                    {
                                        width: isCompact ? 132 : 160,
                                        height: isCompact ? 132 : 160,
                                        borderRadius: isCompact ? 66 : 80,
                                    },
                                ]}
                            >
                                <View
                                    style={[
                                        styles.innerCircle,
                                        {
                                            width: isCompact ? 106 : 130,
                                            height: isCompact ? 106 : 130,
                                            borderRadius: isCompact ? 53 : 65,
                                        },
                                    ]}
                                >
                                    <Text style={[styles.percentText, { fontSize: isCompact ? 34 : 44 }]}>{progress}%</Text>
                                    <Text style={styles.overallLabel}>OVERALL</Text>
                                </View>
                            </View>
                        </View>
                        <View style={styles.datesRow}>
                            <View>
                                <Text style={styles.dateLabel}>STARTED: {fmtDate(progressData.startDate)}</Text>
                            </View>
                            <View style={styles.dateSpacer} />
                            <View>
                                <Text style={styles.dateLabel}>EST. FINISH: {fmtDate(progressData.endDate)}</Text>
                            </View>
                        </View>
                    </View>

                    <View style={[styles.phaseCard, SHADOWS.medium, { padding: isCompact ? 18 : 30 }]}>
                        <Text style={styles.phaseHeaderLabel}>CURRENT PHASE</Text>
                        <Text style={[styles.phaseTitle, { fontSize: isCompact ? 24 : 32 }]}>{currentPhase}</Text>

                        <View style={styles.inProgressBadge}>
                            <View style={styles.greenDot} />
                            <Text style={styles.inProgressText}>IN PROGRESS</Text>
                        </View>

                        <Text style={styles.phaseDesc}>
                            Our team is currently focused on <Text style={{ fontWeight: '900' }}>{currentPhase}</Text>. Progress
                            reflects completed job tasks across your sites.
                        </Text>
                    </View>
                </View>

                <View style={styles.secondaryRow}>
                    <View style={[styles.milestoneCard, SHADOWS.small, { minHeight: isCompact ? 180 : 220 }]}>
                        <View style={styles.cardIconHeader}>
                            <MaterialCommunityIcons name="check-circle-outline" size={20} color="#10B981" />
                            <Text style={styles.cardHeading}>Completed milestones</Text>
                        </View>
                        {completed.length === 0 ? (
                            <View style={styles.milestoneEmptyState}>
                                <Text style={styles.emptyNoteText}>No milestones completed yet.</Text>
                                <MaterialCommunityIcons name="shield-check-outline" size={60} color="#F1F5F9" style={styles.shieldDecoration} />
                            </View>
                        ) : (
                            <View style={{ gap: 12 }}>
                                {completed.map((item, idx) => (
                                    <View key={`c-${idx}`} style={styles.stepItem}>
                                        <View style={styles.dotContainer}>
                                            <MaterialCommunityIcons name="check" size={14} color="#10B981" />
                                        </View>
                                        <Text style={styles.stepText} numberOfLines={3}>
                                            {item}
                                        </Text>
                                    </View>
                                ))}
                            </View>
                        )}
                    </View>

                    <View style={[styles.nextStepsCard, SHADOWS.small, { minHeight: isCompact ? 180 : 220 }]}>
                        <View style={styles.cardIconHeader}>
                            <MaterialCommunityIcons name="clock-outline" size={20} color="#3B82F6" />
                            <Text style={styles.cardHeading}>Next steps</Text>
                        </View>
                        {upcoming.length === 0 ? (
                            <Text style={styles.emptyNoteText}>No upcoming tasks scheduled.</Text>
                        ) : (
                            <View style={styles.stepsList}>
                                {upcoming.map((item, idx) => (
                                    <View key={`u-${idx}`} style={styles.stepItem}>
                                        <View style={styles.dotContainer}>
                                            <View style={[styles.blueDot, { opacity: 0.8 }]} />
                                        </View>
                                        <Text style={styles.stepText} numberOfLines={3}>
                                            {item}
                                        </Text>
                                    </View>
                                ))}
                            </View>
                        )}
                        <MaterialCommunityIcons name="format-list-bulleted" size={60} color="#F8FAFC" style={styles.listDecoration} />
                    </View>
                </View>

                <View style={styles.activityHeader}>
                    <MaterialCommunityIcons name="comment-outline" size={18} color="#3B82F6" />
                    <Text style={styles.activitySectionTitle}>Recent site activity</Text>
                </View>

                {updates.length === 0 ? (
                    <View style={styles.emptyActivityBox}>
                        <MaterialCommunityIcons name="comment-text-outline" size={32} color="#E2E8F0" style={{ marginBottom: 16 }} />
                        <Text style={styles.emptyActivityText}>NO UPDATES POSTED YET.</Text>
                    </View>
                ) : (
                    <View style={{ gap: 16, marginBottom: 24 }}>
                        {updates.map((update) => (
                            <View key={update._id || update.id} style={[styles.updateCard, SHADOWS.small]}>
                                <View style={styles.updateCardHead}>
                                    <Text style={styles.updateTitle} numberOfLines={2}>
                                        {update.title || 'Update'}
                                    </Text>
                                    <Text style={styles.updateDatePill}>{fmtDate(update.date)}</Text>
                                </View>
                                <Text style={styles.updateBody}>{update.description}</Text>
                                {update.images?.length > 0 ? (
                                    <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginTop: 12 }}>
                                        {update.images.map((img, i) => (
                                            <Image
                                                key={i}
                                                source={{ uri: getServerUrl(img) || img }}
                                                style={styles.updateThumb}
                                            />
                                        ))}
                                    </ScrollView>
                                ) : null}
                            </View>
                        ))}
                    </View>
                )}

                <View style={{ height: Math.max(insets.bottom + 60, 100) }} />
            </ScrollView>
        </View>
    );
};

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: '#FFFFFF' },
    centerMsg: { justifyContent: 'center', alignItems: 'center', padding: 24 },
    centerMsgTxt: { fontSize: 15, fontWeight: '700', color: '#64748B', textAlign: 'center' },
    linkBack: { fontWeight: '900', color: '#2563EB', fontSize: 14 },
    header: { paddingHorizontal: 20, backgroundColor: '#FFFFFF', paddingBottom: 16 },
    topRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
    backBtn: { width: 40, height: 40, justifyContent: 'center', alignItems: 'left' },
    projectHeaderInfo: { flexDirection: 'row', alignItems: 'center', gap: 10, flex: 1 },
    projectName: { fontSize: 28, fontWeight: '900', color: '#0F172A', letterSpacing: -1.5, flex: 1 },
    statusBadge: { backgroundColor: '#DBEAFE', paddingHorizontal: 12, paddingVertical: 4, borderRadius: 20 },
    statusText: { fontSize: 10, fontWeight: '900', color: '#1D4ED8', letterSpacing: 0.5 },
    breadcrumbRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 4, opacity: 0.8 },
    breadcrumbText: { fontSize: 9, fontWeight: '900', color: '#64748B', letterSpacing: 1 },

    scrollContent: { padding: 16 },

    topDashboardRow: { flexDirection: 'column', gap: 16, marginBottom: 16 },

    progressCard: { backgroundColor: '#FFFFFF', borderRadius: 32, padding: 30, alignItems: 'center', flex: 1 },
    circularContainer: { width: 180, height: 180, justifyContent: 'center', alignItems: 'center' },
    outerCircle: {
        width: 160,
        height: 160,
        borderRadius: 80,
        borderWidth: 12,
        borderColor: '#F8FAFC',
        justifyContent: 'center',
        alignItems: 'center',
    },
    innerCircle: { width: 130, height: 130, borderRadius: 65, backgroundColor: '#FFFFFF', justifyContent: 'center', alignItems: 'center' },
    percentText: { fontSize: 44, fontWeight: '900', color: '#0F172A', letterSpacing: -2 },
    overallLabel: { fontSize: 10, fontWeight: '900', color: '#94A3B8', letterSpacing: 1, marginTop: -4 },
    datesRow: {
        flexDirection: 'row',
        width: '100%',
        justifyContent: 'center',
        gap: 20,
        marginTop: 24,
        borderTopWidth: 1,
        borderTopColor: '#F1F5F9',
        paddingTop: 16,
    },
    dateLabel: { fontSize: 9, fontWeight: '900', color: '#94A3B8', letterSpacing: 0.5 },
    dateSpacer: { width: 1, height: 12, backgroundColor: '#E2E8F0' },

    phaseCard: { backgroundColor: '#1E293B', borderRadius: 32, padding: 30, flex: 1 },
    phaseHeaderLabel: { fontSize: 10, fontWeight: '900', color: '#94A3B8', letterSpacing: 1.5, marginBottom: 12 },
    phaseTitle: { fontSize: 32, fontWeight: '900', color: '#FFFFFF', letterSpacing: -1, marginBottom: 16 },
    inProgressBadge: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
        backgroundColor: 'rgba(16, 185, 129, 0.15)',
        paddingHorizontal: 12,
        paddingVertical: 6,
        borderRadius: 20,
        alignSelf: 'flex-start',
        marginBottom: 30,
    },
    greenDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: '#10B981' },
    inProgressText: { fontSize: 10, fontWeight: '900', color: '#10B981', letterSpacing: 0.5 },
    phaseDesc: { fontSize: 12, color: '#94A3B8', lineHeight: 18, fontWeight: '500' },

    secondaryRow: { flexDirection: 'column', gap: 16, marginBottom: 24 },
    milestoneCard: { backgroundColor: '#FFFFFF', borderRadius: 28, padding: 24, flex: 1 },
    nextStepsCard: { backgroundColor: '#FFFFFF', borderRadius: 28, padding: 24, flex: 1, position: 'relative', overflow: 'hidden' },
    cardIconHeader: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 20 },
    cardHeading: { fontSize: 16, fontWeight: '900', color: '#0F172A', letterSpacing: -0.5 },

    milestoneEmptyState: { flex: 1, justifyContent: 'center', position: 'relative' },
    emptyNoteText: { fontSize: 11, fontStyle: 'italic', color: '#94A3B8', fontWeight: '500' },
    shieldDecoration: { position: 'absolute', right: -10, bottom: -10, opacity: 0.5 },

    stepsList: { gap: 16 },
    stepItem: { flexDirection: 'row', alignItems: 'flex-start', gap: 12 },
    dotContainer: { width: 24, height: 24, borderRadius: 12, backgroundColor: '#EFF6FF', justifyContent: 'center', alignItems: 'center' },
    blueDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: '#3B82F6' },
    stepText: { fontSize: 12, fontWeight: '800', color: '#475569', flex: 1 },
    listDecoration: { position: 'absolute', right: -10, top: 20, opacity: 0.2 },

    activityHeader: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 4, marginBottom: 16 },
    activitySectionTitle: { fontSize: 16, fontWeight: '900', color: '#0F172A', letterSpacing: -0.5 },
    emptyActivityBox: {
        height: 180,
        borderRadius: 32,
        borderWidth: 1.5,
        borderColor: '#F1F5F9',
        borderStyle: 'dashed',
        justifyContent: 'center',
        alignItems: 'center',
    },
    emptyActivityText: { fontSize: 10, fontWeight: '900', color: '#CBD5E1', letterSpacing: 1 },
    updateCard: {
        backgroundColor: '#fff',
        borderRadius: 24,
        padding: 16,
        borderWidth: 1,
        borderColor: '#F1F5F9',
    },
    updateCardHead: { flexDirection: 'row', justifyContent: 'space-between', gap: 8, marginBottom: 8 },
    updateTitle: { flex: 1, fontSize: 16, fontWeight: '900', color: '#0F172A' },
    updateDatePill: {
        fontSize: 10,
        fontWeight: '900',
        color: '#64748B',
        backgroundColor: '#F8FAFC',
        paddingHorizontal: 10,
        paddingVertical: 4,
        borderRadius: 10,
        overflow: 'hidden',
    },
    updateBody: { fontSize: 13, color: '#475569', lineHeight: 20, fontWeight: '600' },
    updateThumb: { width: 72, height: 72, borderRadius: 12, marginRight: 8, backgroundColor: '#F1F5F9' },
});

export default ClientProgressScreen;
