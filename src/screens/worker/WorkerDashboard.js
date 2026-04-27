import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Dimensions } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { COLORS, SHADOWS, SIZES } from '../../constants/theme';
import { useApp } from '../../context/AppContext';

const { width } = Dimensions.get('window');

const WorkerDashboard = ({ navigation, timer, isClockedIn, handleClockToggle, setClockModal, selectedProject, workerStats: propStats }) => {
    const { user, metrics, activities, tasks } = useApp();

    const workerStats = propStats || metrics?.workerMetrics || {
        myHoursToday: '0.0h',
        currentJob: '---',
        weeklyTarget: '40h',
        weeklyDone: '0h done'
    };

    const myRecentActivity = activities || [];
    const myTasks = (tasks || []).filter(t => {
        const isAssigned = (Array.isArray(t.assignedTo) && t.assignedTo.some(a => (a._id || a) === user?._id)) ||
            (t.assignedTo === user?._id || t.assignedTo === user?.fullName);
        return isAssigned;
    }).slice(0, 5);

    return (
        <View style={styles.workerContainer}>
            <View style={{ marginBottom: 20 }}>
                <Text style={styles.workerSubtitle}>
                    Organization
                </Text>
            </View>

            <View style={[styles.modernClockCard, SHADOWS.medium]}>
                <View style={styles.clockIconBg}>
                    <MaterialCommunityIcons name="clock-outline" size={width * 0.4} color="#F1F5F9" />
                </View>

                <View style={styles.clockTop}>
                    <View style={styles.statusBadgeModern}>
                        <View style={[styles.statusDotModern, { backgroundColor: isClockedIn ? COLORS.success : COLORS.textMuted }]} />
                        <Text style={styles.statusTextModern}>{isClockedIn ? 'CURRENTLY ON CLOCK' : 'READY TO START'}</Text>
                    </View>
                    <Text style={styles.digitalTimer}>{isClockedIn ? timer : '00:00:00'}</Text>

                    <TouchableOpacity
                        style={styles.projectPicker}
                        onPress={() => !isClockedIn && setClockModal(true)}
                        disabled={isClockedIn}
                    >
                        <Text style={styles.projectPickerLabel}>SELECT WORKING SITE:</Text>
                        <View style={styles.projectPickerContent}>
                            <Text style={styles.projectPickerText}>
                                {isClockedIn ? (workerStats.currentJob || 'Current Site') : (selectedProject ? selectedProject.name : 'Select Site...')}
                            </Text>
                            {!isClockedIn && <MaterialCommunityIcons name="chevron-down" size={20} color={COLORS.primary} />}
                        </View>
                    </TouchableOpacity>
                </View>

                <TouchableOpacity
                    style={[styles.startClockBtn, { backgroundColor: isClockedIn ? COLORS.error || '#EF4444' : COLORS.primary }, SHADOWS.medium]}
                    onPress={() => handleClockToggle(selectedProject?._id || selectedProject?.id)}
                >
                    <MaterialCommunityIcons name={isClockedIn ? "stop-circle" : "play-circle"} size={22} color="#fff" style={{ marginRight: 8 }} />
                    <Text style={styles.startClockBtnText}>
                        {isClockedIn ? 'STOP TIMER & CLOCK OUT' : 'START TIMER & CLOCK IN'}
                    </Text>
                </TouchableOpacity>

                {isClockedIn && (
                    <View style={styles.clockFooterPremium}>
                        <View style={styles.footerItem}>
                            <Text style={styles.footerLabel}>STARTED AT</Text>
                            <Text style={styles.footerValue}>{workerStats.startedAt || '---'}</Text>
                        </View>
                        <View style={styles.footerDivider} />
                        <View style={styles.footerItem}>
                            <Text style={styles.footerLabel}>SITE ENTRY</Text>
                            <Text style={styles.footerValue} numberOfLines={1}>{workerStats.currentJob || 'Verified Site'}</Text>
                        </View>
                    </View>
                )}

                {!isClockedIn && (
                    <View style={styles.clockFooter}>
                        <MaterialCommunityIcons name="shield-check" size={14} color="#10B981" />
                        <Text style={styles.clockFooterText}>GPS VERIFICATION ENABLED</Text>
                    </View>
                )}
            </View>

            <View style={styles.workerStatsRow}>
                <View style={styles.workerStatCard}>
                    <View style={[styles.workerStatIconWrap, { backgroundColor: COLORS.primary + '10' }]}>
                        <MaterialCommunityIcons name="clock-outline" size={20} color={COLORS.primary} />
                    </View>
                    <Text style={styles.workerStatValue}>{workerStats.myHoursToday}</Text>
                    <Text style={styles.workerStatLabel}>MY HOURS TODAY</Text>
                </View>
                <View style={styles.workerStatCard}>
                    <View style={[styles.workerStatIconWrap, { backgroundColor: '#FFF7ED' }]}>
                        <MaterialCommunityIcons name="briefcase-outline" size={20} color="#EA580C" />
                    </View>
                    <Text style={styles.workerStatValue}>{workerStats.currentJob === 'Not Clocked In' ? 'None' : (workerStats.currentJob || 'None')}</Text>
                    <Text style={styles.workerStatLabel}>CURRENT SITE</Text>
                </View>
                <View style={styles.workerStatCard}>
                    <View style={[styles.workerStatIconWrap, { backgroundColor: '#ECFDF5' }]}>
                        <MaterialCommunityIcons name="trending-up" size={20} color="#059669" />
                    </View>
                    <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: 4 }}>
                        <Text style={styles.workerStatValue}>{workerStats.weeklyTarget}</Text>
                        <Text style={styles.workerStatSubValue}>{workerStats.weeklyDone}</Text>
                    </View>
                    <Text style={styles.workerStatLabel}>WEEKLY PROGRESS</Text>
                </View>
            </View>

            <Text style={styles.sectionHeaderNew}>Quick Actions</Text>
            <View style={styles.quickActionsRow}>
                <TouchableOpacity style={styles.quickActionBtn} onPress={() => !isClockedIn && setClockModal(true)}>
                    <View style={[styles.quickActionIcon, { backgroundColor: '#2563EB' }]}>
                        <MaterialCommunityIcons name="clock-outline" size={26} color="#fff" />
                    </View>
                    <Text style={styles.quickActionLabel}>Clock In / Out</Text>
                </TouchableOpacity>
                
                <TouchableOpacity style={styles.quickActionBtn} onPress={() => navigation.navigate('Photos')}>
                    <View style={[styles.quickActionIcon, { backgroundColor: '#fff', borderWidth: 1, borderColor: '#E2E8F0' }]}>
                        <MaterialCommunityIcons name="camera-plus" size={26} color="#64748B" />
                    </View>
                    <Text style={[styles.quickActionLabel, { color: '#64748B' }]}>Submit Photo</Text>
                </TouchableOpacity>
                
                <TouchableOpacity style={styles.quickActionBtn} onPress={() => navigation.navigate('WorkerLogs')}>
                    <View style={[styles.quickActionIcon, { backgroundColor: '#fff', borderWidth: 1, borderColor: '#E2E8F0' }]}>
                        <MaterialCommunityIcons name="refresh-circle" size={26} color="#64748B" />
                    </View>
                    <Text style={[styles.quickActionLabel, { color: '#64748B' }]}>Request Correction</Text>
                </TouchableOpacity>
            </View>

            <View style={styles.sectionHeaderContainer}>
                <Text style={styles.sectionHeaderNew}>Assigned Tasks</Text>
                <TouchableOpacity onPress={() => navigation.navigate('Jobs')}>
                    <Text style={styles.viewMoreText}>VIEW ALL</Text>
                </TouchableOpacity>
            </View>
            <View style={styles.tasksContainerModern}>
                {myTasks.length === 0 ? (
                    <Text style={styles.emptyText}>No assigned tasks for today.</Text>
                ) : myTasks.map((task, i) => (
                    <View key={task.id || task._id || i} style={styles.taskRowModern}>
                        <MaterialCommunityIcons name="clipboard-text-outline" size={20} color="#64748B" />
                        <View style={styles.taskInfoModern}>
                            <Text style={styles.taskNameModern}>{task.title}</Text>
                            <Text style={styles.taskProjectModern}>{task.projectId?.name || 'General'}</Text>
                        </View>
                        <View style={styles.taskStatusBadge}>
                            <Text style={styles.taskStatusText}>{task.status?.toUpperCase()}</Text>
                        </View>
                    </View>
                ))}
            </View>
        </View>
    );
};

const styles = StyleSheet.create({
    workerContainer: { flex: 1, padding: 14, paddingTop: 2 },
    workerSubtitle: { fontSize: Dimensions.get('window').width < 380 ? 28 : 32, fontWeight: '900', color: COLORS.primary, letterSpacing: -1, marginTop: 4, textTransform: 'uppercase' },
    modernClockCard: { backgroundColor: '#fff', borderRadius: 32, padding: 24, marginBottom: 24, overflow: 'hidden' },
    clockIconBg: { position: 'absolute', right: -40, top: -40, opacity: 0.5 },
    clockTop: { alignItems: 'center', marginBottom: 24 },
    statusBadgeModern: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#F8FAFC', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 12, gap: 6 },
    statusDotModern: { width: 6, height: 6, borderRadius: 3 },
    statusTextModern: { fontSize: 11, fontWeight: '900', color: '#64748B', letterSpacing: 1 },
    digitalTimer: { fontSize: 44, fontWeight: '900', color: '#0F172A', letterSpacing: -1, marginVertical: 8 },
    projectPicker: { width: '100%', backgroundColor: '#F8FAFC', padding: 16, borderRadius: 20, borderWidth: 1, borderColor: '#E2E8F0' },
    projectPickerLabel: { fontSize: 9, fontWeight: '800', color: '#94A3B8', letterSpacing: 1 },
    projectPickerContent: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 4 },
    projectPickerText: { fontSize: 16, fontWeight: '800', color: '#1E293B' },
    startClockBtn: { alignSelf: 'center', paddingVertical: 14, paddingHorizontal: 32, borderRadius: 24, alignItems: 'center', marginTop: 12, flexDirection: 'row', width: '100%', justifyContent: 'center' },
    startClockBtnText: { color: '#fff', fontSize: 13, fontWeight: '900', letterSpacing: 0.5 },
    clockFooterPremium: { backgroundColor: '#F8FAFC', padding: 16, borderTopWidth: 1, borderTopColor: '#F1F5F9', flexDirection: 'row', gap: 16, marginHorizontal: -24, marginBottom: -24, marginTop: 24 },
    footerItem: { flex: 1, alignItems: 'center' },
    footerLabel: { fontSize: 8, fontWeight: '900', color: '#94A3B8', letterSpacing: 1, marginBottom: 4 },
    footerValue: { fontSize: 12, fontWeight: '800', color: '#1E293B' },
    footerDivider: { width: 1, height: '60%', backgroundColor: '#E2E8F0', alignSelf: 'center' },
    clockFooter: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, marginTop: 16 },
    clockFooterText: { fontSize: 11, fontWeight: '700', color: '#94A3B8' },
    workerStatsRow: { flexDirection: 'row', gap: 12, marginBottom: 24 },
    workerStatCard: { flex: 1, backgroundColor: '#fff', padding: 16, borderRadius: 24, borderWidth: 1, borderColor: '#F1F5F9' },
    workerStatIconWrap: { width: 36, height: 36, borderRadius: 12, justifyContent: 'center', alignItems: 'center', marginBottom: 12 },
    workerStatValue: { fontSize: 18, fontWeight: '900', color: '#0F172A' },
    workerStatSubValue: { fontSize: 10, fontWeight: '700', color: '#94A3B8' },
    workerStatLabel: { fontSize: 8, fontWeight: '800', color: '#64748B', marginTop: 4, letterSpacing: 0.5 },
    sectionHeaderNew: { fontSize: 10, fontWeight: '900', color: '#0F172A', letterSpacing: 1.5, marginBottom: 16, textTransform: 'uppercase' },
    quickActionsRow: { flexDirection: 'row', gap: 12, marginBottom: 24 },
    quickActionBtn: { flex: 1, alignItems: 'center', gap: 8 },
    quickActionIcon: { width: 56, height: 56, borderRadius: 18, justifyContent: 'center', alignItems: 'center' },
    quickActionLabel: { fontSize: 10, fontWeight: '800', color: '#1E293B', textAlign: 'center' },
    sectionHeaderContainer: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 },
    viewMoreText: { fontSize: 11, fontWeight: '900', color: COLORS.primary },
    tasksContainerModern: { backgroundColor: '#fff', borderRadius: 24, padding: 16, borderWidth: 1, borderColor: '#F1F5F9' },
    taskRowModern: { flexDirection: 'row', alignItems: 'center', paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: '#F8FAFC' },
    taskInfoModern: { flex: 1, marginLeft: 12 },
    taskNameModern: { fontSize: 14, fontWeight: '800', color: '#1E293B' },
    taskProjectModern: { fontSize: 11, color: '#64748B', marginTop: 2 },
    taskStatusBadge: { backgroundColor: '#F8FAFC', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6 },
    taskStatusText: { fontSize: 9, fontWeight: '900', color: '#64748B' },
    emptyText: { textAlign: 'center', color: '#94A3B8', fontSize: 12, paddingVertical: 20 }
});

export default WorkerDashboard;
