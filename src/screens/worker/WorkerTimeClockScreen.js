import React, { useState, useEffect, useRef } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Animated, Dimensions, ScrollView, StatusBar, Platform, Modal, Pressable, ActivityIndicator, useWindowDimensions } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { COLORS, SHADOWS, SPACING } from '../../constants/theme';
import { useApp } from '../../context/AppContext';
import WorkerHeader from '../../components/WorkerHeader';
import { scale, verticalScale, moderateScale, isTablet } from '../../utils/responsive';

const WorkerTimeClockScreen = ({ navigation }) => {
    const { isClockedIn, toggleClock, getWorkDuration, projects, user, timeLogs, tasks, metrics } = useApp();
    const { width, height } = useWindowDimensions();
    const [timer, setTimer] = useState('00:00:00');
    const [selectedSite, setSelectedSite] = useState(null);
    const [selectedTask, setSelectedTask] = useState(null);
    const [showSiteModal, setShowSiteModal] = useState(false);
    const [loading, setLoading] = useState(false);

    const fadeAnim = useRef(new Animated.Value(0)).current;

    useEffect(() => {
        Animated.timing(fadeAnim, { toValue: 1, duration: 800, useNativeDriver: true }).start();
        if (!isClockedIn && (projects || []).length === 1 && !selectedSite) {
            setSelectedSite((projects || [])[0]);
        }
    }, [projects, isClockedIn]);

    useEffect(() => {
        if (isClockedIn && (timeLogs || []).length > 0) {
            const activeLog = (timeLogs || []).find(log => !log.clockOut);
            if (activeLog && activeLog.projectId) {
                const project = (projects || []).find(p => (p._id || p.id) === (activeLog.projectId._id || activeLog.projectId));
                if (project) setSelectedSite(project);
            }
        }
    }, [isClockedIn, timeLogs, projects]);

    useEffect(() => {
        let interval;
        if (isClockedIn) {
            interval = setInterval(() => {
                setTimer(getWorkDuration() || '00:00:00');
            }, 1000);
        } else {
            setTimer('00:00:00');
            if (interval) clearInterval(interval);
        }
        return () => { if (interval) clearInterval(interval); };
    }, [isClockedIn]);

    const handleSelectOption = (item, type) => {
        if (type === 'project') {
            setSelectedSite(item);
            setSelectedTask(null);
        } else {
            const project = (projects || []).find(p => (p._id || p.id) === (item.projectId?._id || item.projectId));
            setSelectedSite(project || item.projectId);
            setSelectedTask(item);
        }
        setShowSiteModal(false);
    };

    const handleAction = async () => {
        if (!isClockedIn && !selectedSite) {
            setShowSiteModal(true);
            return;
        }

        setLoading(true);
        try {
            await toggleClock(
                selectedSite?._id || selectedSite?.id, 
                selectedTask?._id || selectedTask?.id
            );
        } catch (e) {
            console.error('Clock action error:', e);
        } finally {
            setLoading(false);
        }
    };

    const formatTime = (date) => {
        if (!date) return '--:--';
        return new Date(date).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: true });
    };

    const sortedLogs = [...(timeLogs || [])].sort((a, b) => new Date(b.clockIn) - new Date(a.clockIn)).slice(0, 5);
    const myTasks = (tasks || []).filter(t => t.status !== 'completed');

    return (
        <View style={styles.container}>
            <StatusBar barStyle="dark-content" />
            <WorkerHeader title="My Clock" />
            
            <ScrollView contentContainerStyle={[styles.scrollContent, { paddingBottom: verticalScale(100) }]} showsVerticalScrollIndicator={false}>
                <View style={[styles.headerSection, { marginTop: verticalScale(20), marginBottom: verticalScale(15) }]}>
                    <Text style={[styles.mainTitle, { fontSize: moderateScale(24) }]}>TIME CLOCK</Text>
                    <Text style={[styles.headerDesc, { fontSize: moderateScale(10), marginTop: verticalScale(2) }]}>PRECISION TRACKING FOR YOUR DAY</Text>
                </View>

                {/* MAIN TIMER CARD */}
                <View style={[styles.clockCard, { marginHorizontal: scale(16), borderRadius: moderateScale(32), padding: moderateScale(20), maxWidth: scale(500), alignSelf: 'center', width: width - scale(32) }]}>
                    <View style={[styles.statusBadge, { paddingHorizontal: scale(10), paddingVertical: verticalScale(5), borderRadius: moderateScale(10), gap: scale(6), marginBottom: verticalScale(10) }]}>
                        <View style={[styles.statusDot, { backgroundColor: isClockedIn ? '#10B981' : '#94A3B8', width: scale(6), height: scale(6), borderRadius: scale(3) }]} />
                        <Text style={[styles.statusText, { fontSize: moderateScale(9) }]}>{isClockedIn ? 'ON CLOCK' : 'OFF CLOCK'}</Text>
                    </View>

                    <Text style={[styles.timerLarge, { fontSize: moderateScale(52), marginVertical: verticalScale(8) }]}>{timer}</Text>

                    <Text style={[styles.selectorLabel, { fontSize: moderateScale(9), marginTop: verticalScale(10), marginBottom: verticalScale(8) }]}>SELECT WORKING SITE / TASK</Text>
                    <TouchableOpacity 
                        style={[styles.dropdown, { height: verticalScale(48), borderRadius: moderateScale(14), paddingHorizontal: scale(14) }]} 
                        onPress={() => !isClockedIn && setShowSiteModal(true)}
                        activeOpacity={0.7}
                    >
                        <Text style={[styles.dropdownText, { fontSize: moderateScale(13) }]} numberOfLines={1}>
                            {selectedTask ? `${selectedTask.title} (${selectedSite?.name})` : (selectedSite ? selectedSite.name : '-- Choose Task / Project --')}
                        </Text>
                        <MaterialCommunityIcons name="chevron-down" size={moderateScale(20)} color="#64748B" />
                    </TouchableOpacity>

                    <View style={[styles.metaRow, { gap: scale(15), marginVertical: verticalScale(15) }]}>
                        <View style={[styles.metaItem, { gap: scale(5) }]}>
                            <MaterialCommunityIcons name="map-marker-outline" size={moderateScale(16)} color="#94A3B8" />
                            <Text style={[styles.metaText, { fontSize: moderateScale(11) }]}>{selectedSite ? 'Site Selected' : 'No Active Site'}</Text>
                        </View>
                        <View style={[styles.metaItem, { gap: scale(5) }]}>
                            <MaterialCommunityIcons name="check-circle-outline" size={moderateScale(16)} color={selectedSite ? '#2563EB' : '#94A3B8'} />
                            <Text style={[styles.metaText, { fontSize: moderateScale(11) }, selectedSite && { color: '#2563EB' }]}>Verified Site</Text>
                        </View>
                    </View>

                    <TouchableOpacity 
                        style={[styles.actionBtn, isClockedIn ? styles.stopBtn : styles.startBtn, { height: verticalScale(60), borderRadius: moderateScale(18), gap: scale(10) }]}
                        onPress={handleAction}
                        disabled={loading}
                    >
                        {loading ? (
                            <ActivityIndicator color="#fff" />
                        ) : (
                            <>
                                <MaterialCommunityIcons name={isClockedIn ? "stop" : "play"} size={moderateScale(22)} color="#fff" />
                                <Text style={[styles.actionBtnText, { fontSize: moderateScale(14) }]}>
                                    {isClockedIn ? 'STOP TIMER & CLOCK OUT' : 'START TIMER & CLOCK IN'}
                                </Text>
                            </>
                        )}
                    </TouchableOpacity>

                    <Text style={[styles.footerNote, { fontSize: moderateScale(8.5), marginTop: verticalScale(15) }]}>AUTO-SYNCING YOUR GPS LOCATION...</Text>

                    <View style={[styles.divider, { marginVertical: verticalScale(20) }]} />

                    <View style={styles.bottomStats}>
                        <View style={styles.statCol}>
                            <Text style={[styles.statLabel, { fontSize: moderateScale(8) }]}>STARTED AT</Text>
                            <Text style={[styles.statValue, { fontSize: moderateScale(13), marginTop: verticalScale(4) }]}>{isClockedIn && (timeLogs || []).length > 0 ? formatTime((timeLogs || []).find(l => !l.clockOut)?.clockIn) : '--:--'}</Text>
                        </View>
                        <View style={styles.statDivider} />
                        <View style={styles.statCol}>
                            <Text style={[styles.statLabel, { fontSize: moderateScale(8) }]}>SITE ENTRY</Text>
                            <Text style={[styles.statValue, { fontSize: moderateScale(13), marginTop: verticalScale(4) }]}>{isClockedIn ? 'Clocked In' : 'Not Clocked In'}</Text>
                        </View>
                    </View>
                </View>

                {/* QUICK ACTIONS */}
                <View style={[styles.actionsGrid, { paddingHorizontal: scale(16), marginTop: verticalScale(12), gap: scale(10), maxWidth: scale(500), alignSelf: 'center', width: '100%' }]}>
                    <TouchableOpacity style={[styles.actionBox, { borderRadius: moderateScale(24), padding: moderateScale(15), gap: verticalScale(8) }]} onPress={() => navigation.navigate('MainTabs', { screen: 'Photos' })}>
                        <View style={[styles.actionIconCircle, { width: scale(44), height: scale(44), borderRadius: scale(22) }]}>
                            <MaterialCommunityIcons name="camera-outline" size={moderateScale(20)} color="#2563EB" />
                        </View>
                        <Text style={[styles.actionBoxLabel, { fontSize: moderateScale(9) }]}>SUBMIT PHOTO</Text>
                    </TouchableOpacity>
                    <TouchableOpacity style={[styles.actionBox, { borderRadius: moderateScale(24), padding: moderateScale(15), gap: verticalScale(8) }]} onPress={() => navigation.navigate('WorkerLogs')}>
                        <View style={[styles.actionIconCircle, { width: scale(44), height: scale(44), borderRadius: scale(22) }]}>
                            <MaterialCommunityIcons name="refresh" size={moderateScale(20)} color="#F59E0B" />
                        </View>
                        <Text style={[styles.actionBoxLabel, { fontSize: moderateScale(9) }]}>REQUEST CORRECTION</Text>
                    </TouchableOpacity>
                </View>

                {/* HISTORY */}
                <View style={[styles.historyContainer, { marginHorizontal: scale(16), marginTop: verticalScale(20), borderRadius: moderateScale(24), padding: moderateScale(20), maxWidth: scale(500), alignSelf: 'center', width: width - scale(32) }]}>
                    <View style={[styles.historyHeader, { marginBottom: verticalScale(20) }]}>
                        <View style={[styles.historyTitleRow, { gap: scale(6) }]}>
                            <MaterialCommunityIcons name="history" size={moderateScale(20)} color="#475569" />
                            <Text style={[styles.historyTitle, { fontSize: moderateScale(10) }]}>RECENT HISTORY</Text>
                        </View>
                        <TouchableOpacity onPress={() => navigation.navigate('WorkerLogs')}>
                            <Text style={[styles.viewAllText, { fontSize: moderateScale(10) }]}>VIEW ALL</Text>
                        </TouchableOpacity>
                    </View>

                    <View style={[styles.historyList, { gap: verticalScale(15) }]}>
                        {sortedLogs.length > 0 ? sortedLogs.map((log, idx) => (
                            <View key={log._id || idx} style={[styles.historyRow, { paddingBottom: verticalScale(12) }]}>
                                <View style={styles.historyMain}>
                                    <Text style={[styles.historyDate, { fontSize: moderateScale(13) }]}>{new Date(log.clockIn).toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric' })}</Text>
                                    <Text style={[styles.historySite, { fontSize: moderateScale(10), marginTop: verticalScale(2) }]}>{log.projectId?.name || '---'}</Text>
                                </View>
                                <View style={styles.historyMeta}>
                                    <Text style={[styles.historyTime, { fontSize: moderateScale(11) }]}>{formatTime(log.clockIn)} - {formatTime(log.clockOut)}</Text>
                                    <Text style={[styles.historyDuration, { fontSize: moderateScale(10), marginTop: verticalScale(2) }]}>{log.clockOut ? (Math.floor((new Date(log.clockOut) - new Date(log.clockIn))/3600000) + 'H ' + Math.floor(((new Date(log.clockOut) - new Date(log.clockIn))%3600000)/60000) + 'M') : 'ACTIVE'}</Text>
                                </View>
                            </View>
                        )) : (
                            <Text style={[styles.noData, { fontSize: moderateScale(11), paddingVertical: verticalScale(10) }]}>No recent logs</Text>
                        )}
                    </View>
                </View>
            </ScrollView>

            <Modal transparent visible={showSiteModal} animationType="slide">
                <Pressable style={styles.modalOverlay} onPress={() => setShowSiteModal(false)}>
                    <View style={[styles.modalContent, { borderRadius: moderateScale(24), padding: moderateScale(20), maxWidth: scale(500) }]}>
                        <View style={[styles.modalHeader, { marginBottom: verticalScale(15) }]}>
                            <Text style={[styles.modalTitle, { fontSize: moderateScale(18) }]}>Choose Task / Project</Text>
                            <TouchableOpacity onPress={() => setShowSiteModal(false)}>
                                <MaterialCommunityIcons name="close" size={moderateScale(20)} color="#64748B" />
                            </TouchableOpacity>
                        </View>
                        <ScrollView showsVerticalScrollIndicator={false}>
                            <Text style={[styles.sectionHeader, { fontSize: moderateScale(13), paddingVertical: verticalScale(8), paddingHorizontal: scale(12), borderRadius: moderateScale(8), marginTop: verticalScale(15), marginBottom: verticalScale(5) }]}>My Tasks</Text>
                            {myTasks.map((t) => (
                                <TouchableOpacity 
                                    key={t._id || t.id} 
                                    style={[styles.dropdownOption, { paddingVertical: verticalScale(12), paddingHorizontal: scale(15) }]}
                                    onPress={() => handleSelectOption(t, 'task')}
                                >
                                    <Text style={[styles.optionText, { fontSize: moderateScale(12) }]}>
                                        <Text style={styles.prefixText}>{t.parentTask ? 'Sub: ' : 'Task: '}</Text>
                                        <Text style={styles.mainText}>{t.title} </Text>
                                        <Text style={styles.metaText}>
                                            ({t.parentTask ? 'Subassignment / See Parent Task' : `${t.jobId?.name || 'Job'} / ${t.projectId?.name || 'Project'}`})
                                        </Text>
                                    </Text>
                                    {selectedTask?._id === t._id && <MaterialCommunityIcons name="check" size={moderateScale(16)} color="#2563EB" />}
                                </TouchableOpacity>
                            ))}

                            <Text style={[styles.sectionHeader, { fontSize: moderateScale(13), paddingVertical: verticalScale(8), paddingHorizontal: scale(12), borderRadius: moderateScale(8), marginTop: verticalScale(15), marginBottom: verticalScale(5) }]}>General Site Attendance</Text>
                            {(projects || []).map((p) => (
                                <TouchableOpacity 
                                    key={p._id || p.id} 
                                    style={[styles.dropdownOption, { paddingVertical: verticalScale(12), paddingHorizontal: scale(15) }]}
                                    onPress={() => handleSelectOption(p, 'project')}
                                >
                                    <Text style={[styles.optionText, { fontSize: moderateScale(12) }]}>
                                        <Text style={styles.prefixText}>Project: </Text>
                                        <Text style={styles.mainText}>{p.name} </Text>
                                        <Text style={styles.metaText}>({p.jobName || 'Demo Project job'})</Text>
                                    </Text>
                                    {selectedSite?._id === p._id && !selectedTask && <MaterialCommunityIcons name="check" size={moderateScale(16)} color="#2563EB" />}
                                </TouchableOpacity>
                            ))}
                        </ScrollView>
                    </View>
                </Pressable>
            </Modal>
        </View>
    );
};

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: '#F8FAFC' },
    scrollContent: { },
    headerSection: { alignItems: 'center' },
    mainTitle: { fontWeight: '900', color: '#0F172A', letterSpacing: -0.5 },
    headerDesc: { fontWeight: '700', color: '#64748B', letterSpacing: 0.5 },
    clockCard: { backgroundColor: '#fff', alignItems: 'center', ...SHADOWS.small },
    statusBadge: { backgroundColor: '#F1F5F9', flexDirection: 'row', alignItems: 'center' },
    statusDot: { },
    statusText: { fontWeight: '900', color: '#64748B', letterSpacing: 0.5 },
    timerLarge: { fontWeight: '900', color: '#0F172A', letterSpacing: -1 },
    selectorLabel: { fontWeight: '900', color: '#94A3B8', letterSpacing: 1 },
    dropdown: { width: '100%', backgroundColor: '#F8FAFC', borderWidth: 1, borderColor: '#E2E8F0', flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
    dropdownText: { fontWeight: '700', color: '#475569', flex: 1 },
    metaRow: { flexDirection: 'row' },
    metaItem: { flexDirection: 'row', alignItems: 'center' },
    metaText: { fontWeight: '800', color: '#94A3B8' },
    actionBtn: { width: '100%', flexDirection: 'row', alignItems: 'center', justifyContent: 'center', ...SHADOWS.small },
    startBtn: { backgroundColor: '#2563EB' },
    stopBtn: { backgroundColor: '#EF4444' },
    actionBtnText: { color: '#fff', fontWeight: '900', letterSpacing: 0.3 },
    footerNote: { fontWeight: '800', color: '#CBD5E1', letterSpacing: 0.5 },
    divider: { width: '100%', height: 1, backgroundColor: '#F1F5F9' },
    bottomStats: { flexDirection: 'row', width: '100%' },
    statCol: { flex: 1, alignItems: 'center' },
    statDivider: { width: 1, height: '100%', backgroundColor: '#F1F5F9' },
    statLabel: { fontWeight: '900', color: '#94A3B8', letterSpacing: 0.8 },
    statValue: { fontWeight: '900', color: '#1E293B' },
    actionsGrid: { flexDirection: 'row' },
    actionBox: { flex: 1, backgroundColor: '#fff', alignItems: 'center', ...SHADOWS.small },
    actionIconCircle: { backgroundColor: '#F8FAFC', justifyContent: 'center', alignItems: 'center' },
    actionBoxLabel: { fontWeight: '900', color: '#475569', letterSpacing: 0.3 },
    historyContainer: { backgroundColor: '#fff', ...SHADOWS.small },
    historyHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
    historyTitleRow: { flexDirection: 'row', alignItems: 'center' },
    historyTitle: { fontWeight: '900', color: '#475569', letterSpacing: 0.8 },
    viewAllText: { fontWeight: '900', color: '#2563EB' },
    historyList: { },
    historyRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', borderBottomWidth: 1, borderBottomColor: '#F8FAFC' },
    historyMain: { flex: 1 },
    historyDate: { fontWeight: '900', color: '#1E293B' },
    historySite: { fontWeight: '700', color: '#94A3B8', textTransform: 'uppercase' },
    historyMeta: { alignItems: 'flex-end' },
    historyTime: { fontWeight: '800', color: '#475569' },
    historyDuration: { fontWeight: '900', color: '#94A3B8' },
    noData: { textAlign: 'center', fontWeight: '700', color: '#CBD5E1' },
    modalOverlay: { flex: 1, backgroundColor: 'rgba(15, 23, 42, 0.6)', justifyContent: 'center', alignItems: 'center', padding: 20 },
    modalContent: { backgroundColor: '#fff', width: '100%', maxHeight: '80%' },
    modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
    modalTitle: { fontWeight: '900', color: '#0F172A' },
    sectionHeader: { fontWeight: '900', color: '#1E293B', backgroundColor: '#F8FAFC' },
    dropdownOption: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', borderBottomWidth: 1, borderBottomColor: '#F1F5F9' },
    optionText: { flex: 1, lineHeight: 18 },
    prefixText: { fontWeight: '800', color: '#64748B' },
    mainText: { fontWeight: '700', color: '#1E293B' },
    metaText: { fontWeight: '600', color: '#94A3B8' },
});

export default WorkerTimeClockScreen;
