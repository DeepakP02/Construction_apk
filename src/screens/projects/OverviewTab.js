import React from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity } from 'react-native';
import { ProgressBar } from 'react-native-paper';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { COLORS, SHADOWS, SIZES, SPACING, TYPOGRAPHY } from '../../constants/theme';
import { useApp } from '../../context/AppContext';

export const OverviewTab = ({ project }) => {
    const { tasks, jobs } = useApp();

    // Filter tasks and jobs for this project to get a LIVE consolidated count
    const projectWorkCount = [
        ...tasks.filter(t => {
            const tProjId = typeof t.projectId === 'object' ? t.projectId?._id : t.projectId;
            return tProjId === (project._id || project.id) || t.projectId === project.name || t.project === project.name;
        }),
        ...jobs.filter(j => {
            const jProjId = typeof j.projectId === 'object' ? j.projectId?._id : j.projectId;
            return jProjId === (project._id || project.id) || j.name === project.name;
        })
    ].length;

    // Helper to calculate days remaining
    const deadlineStr = project.deadline || project.endDate || '2026-12-31';
    const progressVal = project.progress || 0;
    const progressColor = progressVal > 75 ? '#10B981' : progressVal > 40 ? '#F59E0B' : '#3B82F6';

    const ProjectStat = ({ icon, label, val, color = '#1E293B' }) => (
        <View style={styles.statCard}>
            <View style={styles.statHeader}>
                <View style={[styles.statIconBox, { backgroundColor: color + '10' }]}>
                    <MaterialCommunityIcons name={icon} size={18} color={color} />
                </View>
                <Text style={styles.statLabel}>{label}</Text>
            </View>
            <Text style={[styles.statVal, { color }]}>{val}</Text>
        </View>
    );

    return (
        <ScrollView style={styles.container} contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
            {/* 🏗️ PROGRESS CARD */}
            <View style={[styles.premiumCard, SHADOWS.medium]}>
                <View style={styles.cardHeader}>
                    <Text style={styles.projectType}>{(project.type || 'COMMERCIAL').toUpperCase()}</Text>
                    <View style={styles.liveBadge}>
                        <View style={styles.liveDot} />
                        <Text style={styles.liveText}>ON TRACK</Text>
                    </View>
                </View>

                <Text style={styles.pTitle}>Execution Timeline</Text>
                <View style={styles.progressDetail}>
                    <Text style={[styles.pPercent, { color: progressColor }]}>{progressVal}%</Text>
                    <Text style={styles.pSub}>COMPLETION SCORE</Text>
                </View>
                <ProgressBar progress={progressVal / 100} color={progressColor} style={styles.pBar} />

                <View style={styles.dateRow}>
                    <View style={styles.dateItem}>
                        <MaterialCommunityIcons name="calendar-import" size={14} color="#64748B" />
                        <Text style={styles.dateVal}>JAN 15, 2026</Text>
                    </View>
                    <View style={styles.dateDivider} />
                    <View style={styles.dateItem}>
                        <MaterialCommunityIcons name="calendar-export" size={14} color="#64748B" />
                        <Text style={styles.dateVal}>{new Date(deadlineStr).toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric' }).toUpperCase()}</Text>
                    </View>
                </View>
            </View>

            {/* 📊 KPI GRID */}
            <View style={styles.kpiGrid}>
                <ProjectStat icon="clipboard-list-outline" label="TOTAL JOBS" val={projectWorkCount} color="#6366F1" />
                <ProjectStat icon="alert-octagon-outline" label="DEFICIENCIES" val={project.stats?.issues || 0} color="#EF4444" />
                <ProjectStat icon="currency-usd" label="BUDGET SPENT" val={project.budget ? `$${(project.budget / 1000).toFixed(0)}K` : 'TBD'} color="#059669" />
            </View>

            {/* 👥 PRIMARY LEADERSHIP */}
            <View style={styles.sectionHeader}>
                <Text style={styles.sTitle}>PROJECT LEADERSHIP</Text>
            </View>
            <View style={styles.leadCard}>
                <View style={styles.leadInfo}>
                    <View style={styles.leadAvatar}>
                        <Text style={styles.leadInitial}>{(project.manager || 'U').charAt(0)}</Text>
                    </View>
                    <View>
                        <Text style={styles.leadName}>{project.pmId?.fullName || project.manager || 'Senior Manager'}</Text>
                        <Text style={styles.leadRole}>PROJECT DIRECTOR (CA)</Text>
                    </View>
                </View>
                <TouchableOpacity style={styles.chatAction}>
                    <MaterialCommunityIcons name="comment-text-multiple-outline" size={20} color="#fff" />
                </TouchableOpacity>
            </View>

            {/* 📍 SITE GEOLOCATION */}
            <View style={styles.sectionHeader}>
                <Text style={styles.sTitle}>SITE GEOLOCATION</Text>
            </View>
            <View style={styles.locCard}>
                <View style={styles.locIconBox}>
                    <MaterialCommunityIcons name="map-marker-radius" size={24} color={COLORS.primary} />
                </View>
                <View style={{ flex: 1 }}>
                    <Text style={styles.locText}>{(typeof project.location === 'object' ? project.location?.address : project.location) || 'Ontario, Canada'}</Text>
                    <View style={styles.gpsRow}>
                        <View style={styles.gpsPulse} />
                        <Text style={styles.gpsText}>GPS ACTIVE • REAL-TIME SYNC</Text>
                    </View>
                </View>
                <TouchableOpacity style={styles.mapBtn}>
                    <MaterialCommunityIcons name="navigation-variant" size={20} color={COLORS.primary} />
                </TouchableOpacity>
            </View>

            <View style={{ height: 40 }} />
        </ScrollView>
    );
};

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: COLORS.surfaceSecondary },
    content: { padding: SPACING.m },

    // Premium Card
    premiumCard: { backgroundColor: COLORS.card, borderRadius: 28, padding: 24, marginBottom: SPACING.m },
    cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: SPACING.m },
    projectType: { fontSize: 10, fontWeight: '900', color: COLORS.textSecondary, letterSpacing: 1 },
    liveBadge: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: '#ECFDF5', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 8 },
    liveDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: '#10B981' },
    liveText: { fontSize: 9, fontWeight: '900', color: '#059669' },
    pTitle: { fontSize: 15, fontWeight: '900', color: COLORS.textPrimary, marginBottom: SPACING.m },
    progressDetail: { flexDirection: 'row', alignItems: 'baseline', gap: SPACING.s, marginBottom: 12 },
    pPercent: { fontSize: 32, fontWeight: '900' },
    pSub: { fontSize: 10, fontWeight: '800', color: COLORS.textMuted },
    pBar: { height: 10, borderRadius: 5, backgroundColor: COLORS.surfaceSecondary },
    dateRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 24, paddingVertical: 12, borderTopWidth: 1, borderColor: COLORS.border },
    dateItem: { flexDirection: 'row', alignItems: 'center', gap: SPACING.s },
    dateVal: { fontSize: 11, fontWeight: '900', color: COLORS.textPrimary },
    dateDivider: { width: 1, height: 14, backgroundColor: '#E2E8F0' },

    // KPI Grid
    kpiGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginBottom: 24 },
    statCard: { width: '31.3%', minWidth: 90, backgroundColor: COLORS.card, borderRadius: SIZES.radiusCard, padding: 12, borderWidth: 1, borderColor: COLORS.border },
    statHeader: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 12 },
    statIconBox: { width: 28, height: 28, borderRadius: 8, justifyContent: 'center', alignItems: 'center' },
    statLabel: { fontSize: 8, fontWeight: '900', color: COLORS.textSecondary, letterSpacing: 0.5 },
    statVal: { fontSize: 14, fontWeight: '900' },

    // Section Header
    sectionHeader: { marginBottom: SPACING.m, borderLeftWidth: 3, borderColor: COLORS.primary, paddingLeft: 12 },
    sTitle: { fontSize: 11, fontWeight: '900', color: COLORS.textSecondary, letterSpacing: 1 },

    // Lead Card
    leadCard: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', backgroundColor: COLORS.card, padding: SPACING.m, borderRadius: SIZES.radiusCard, marginBottom: 24 },
    leadInfo: { flexDirection: 'row', alignItems: 'center', gap: SPACING.sm },
    leadAvatar: { width: 44, height: 44, borderRadius: SIZES.radiusBtn, backgroundColor: COLORS.primaryLight, justifyContent: 'center', alignItems: 'center' },
    leadInitial: { fontSize: 20, fontWeight: '900', color: COLORS.primary },
    leadName: { fontSize: 15, fontWeight: '800', color: COLORS.textPrimary },
    leadRole: { fontSize: 9, fontWeight: '800', color: COLORS.textMuted, marginTop: 2 },
    chatAction: { width: 44, height: 44, borderRadius: SIZES.radiusBtn, backgroundColor: COLORS.primary, justifyContent: 'center', alignItems: 'center' },

    // Loc Card
    locCard: { flexDirection: 'row', alignItems: 'center', backgroundColor: COLORS.card, padding: SPACING.m, borderRadius: SIZES.radiusCard, gap: 16 },
    locIconBox: { width: 48, height: 48, borderRadius: SIZES.radiusCard, backgroundColor: COLORS.surfaceSecondary, justifyContent: 'center', alignItems: 'center' },
    locText: { fontSize: 14, fontWeight: '700', color: COLORS.textPrimary, marginBottom: 6 },
    gpsRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
    gpsPulse: { width: 6, height: 6, borderRadius: 3, backgroundColor: '#BFDBFE' },
    gpsText: { fontSize: 9, fontWeight: '900', color: '#3B82F6' },
    mapBtn: { width: 40, height: 40, borderRadius: SIZES.radiusBtn, backgroundColor: COLORS.primaryLight, justifyContent: 'center', alignItems: 'center' },
});

export default OverviewTab;
