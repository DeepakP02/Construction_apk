import React, { useEffect, useRef, useState } from 'react';
import {
    View,
    ScrollView,
    Animated,
    StyleSheet,
    StatusBar,
    Modal,
    TouchableOpacity,
    Text,
    Alert,
    TextInput,
    useWindowDimensions
} from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { contentBottomForTabBar } from '../../constants/theme';
import { useApp } from '../../context/AppContext';
import WorkerHeader from '../../components/WorkerHeader';
import SubcontractorDashboard from './SubcontractorDashboard';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

const SubcontractorDashboardScreen = ({ navigation }) => {
    const insets = useSafeAreaInsets();
    const { width } = useWindowDimensions();
    const isTabletWidth = width >= 768;
    const { refreshData, isClockedIn, isClocking, toggleClock, getWorkDuration, projects, metrics } = useApp();
    const [timer, setTimer] = useState('00:00:00');
    const [clockModal, setClockModal] = useState(false);
    const [randomReasonModal, setRandomReasonModal] = useState(false);
    const [randomReason, setRandomReason] = useState('');
    const [selectedAssignment, setSelectedAssignment] = useState(null);
    const fadeAnim = useRef(new Animated.Value(0)).current;

    const workerMetrics = metrics?.workerMetrics || {};
    const assignedTasksList = workerMetrics.assignedTasks || [];
    const assignedProjectsList = workerMetrics.assignedProjects || [];
    const hasWorkerMetricsAssignments =
        assignedTasksList.length > 0 || assignedProjectsList.length > 0;

    useEffect(() => {
        const unsubscribe = navigation.addListener('focus', () => {
            refreshData();
        });
        Animated.timing(fadeAnim, { toValue: 1, duration: 800, useNativeDriver: true }).start();
        return unsubscribe;
    }, [navigation]);

    useEffect(() => {
        let interval;
        if (isClockedIn) {
            interval = setInterval(() => {
                setTimer(getWorkDuration() || '00:00:00');
            }, 1000);
        } else {
            setTimer('00:00:00');
            clearInterval(interval);
        }
        return () => clearInterval(interval);
    }, [isClockedIn]);

    useEffect(() => {
        if (isClockedIn) return;
        if (selectedAssignment) return;
        if (hasWorkerMetricsAssignments) return;
        const pl = projects || [];
        if (pl.length === 1) {
            const p = pl[0];
            const id = p._id || p.id;
            setSelectedAssignment({
                type: 'project',
                _id: id,
                id,
                displayName: `${p.name || 'Project'} (general)`,
                jobId: null
            });
        }
    }, [isClockedIn, selectedAssignment, hasWorkerMetricsAssignments, projects]);

    const applyClockIn = async (assignment) => {
        let pId = null;
        let tId = null;
        const opts = {};
        if (assignment.type === 'task') {
            const pidRaw = assignment.projectId?._id || assignment.projectId;
            pId = pidRaw != null ? String(pidRaw) : null;
            tId = assignment.id != null ? String(assignment.id) : null;
            const jidRaw = assignment.jobId?._id || assignment.jobId;
            if (jidRaw != null) opts.jobId = String(jidRaw);
            if (assignment.taskType) opts.taskType = assignment.taskType;
        } else if (assignment.type === 'project') {
            pId = assignment._id != null ? String(assignment._id) : assignment.id != null ? String(assignment.id) : null;
            const jidRaw = assignment.jobId?._id || assignment.jobId;
            if (jidRaw != null) opts.jobId = String(jidRaw);
        } else if (assignment.type === 'random') {
            opts.reason = assignment.reason;
        }
        await toggleClock(pId, tId, opts);
    };

    const handleClockToggle = async (assignment = null) => {
        try {
            if (!isClockedIn && !assignment) {
                setClockModal(true);
                return;
            }
            if (!isClockedIn && assignment?.type === 'random') {
                setClockModal(false);
                setRandomReason('');
                setRandomReasonModal(true);
                return;
            }
            if (!isClockedIn) {
                await applyClockIn(assignment);
                setSelectedAssignment(assignment);
                setClockModal(false);
                refreshData();
                return;
            }
            await toggleClock(null, null, {});
            setSelectedAssignment(null);
            refreshData();
        } catch (e) {
            const errorMsg = e.response?.data?.message || e.message;
            Alert.alert('Attendance Error', errorMsg || 'Could not sync with server.');
        }
    };

    const confirmRandomClockIn = async () => {
        const reason = randomReason.trim();
        if (!reason) {
            Alert.alert('Reason required', 'Please enter a short reason for emergency / random site clock-in.');
            return;
        }
        try {
            await applyClockIn({ type: 'random', reason });
            setSelectedAssignment({ type: 'random', displayName: 'Random Site / Emergency', reason });
            setRandomReasonModal(false);
            setRandomReason('');
            refreshData();
        } catch (e) {
            const errorMsg = e.response?.data?.message || e.message;
            Alert.alert('Attendance Error', errorMsg || 'Could not sync with server.');
        }
    };

    const renderTaskRow = (t, index = 0) => {
        const prefix = t.type === 'SubTask' ? 'Sub: ' : t.type === 'Task' ? 'Global: ' : 'Task: ';
        const displayName = `${prefix}${t.title}`;
        return (
            <TouchableOpacity
                key={`task_${String(t._id)}_${index}`}
                style={styles.pSelectRow}
                onPress={() => {
                    const assig = {
                        type: 'task',
                        id: t._id,
                        displayName,
                        projectId: t.projectId,
                        jobId: t.jobId,
                        taskType: t.type || 'JobTask'
                    };
                    setSelectedAssignment(assig);
                    handleClockToggle(assig);
                }}
            >
                <View style={styles.pSelectIcon}>
                    <MaterialCommunityIcons name="clipboard-text-outline" size={20} color="#2563EB" />
                </View>
                <View style={{ flex: 1 }}>
                    <Text style={styles.pSelectName} numberOfLines={2}>
                        {displayName}
                    </Text>
                    <Text style={styles.pSelectLoc} numberOfLines={1}>
                        {t.jobName || 'Job'} / {t.projectName || 'Project'}
                    </Text>
                </View>
                <MaterialCommunityIcons name="chevron-right" size={20} color="#94A3B8" />
            </TouchableOpacity>
        );
    };

    const renderProjectRow = (p, index = 0, keyPrefix = 'proj') => (
        <TouchableOpacity
            key={`${keyPrefix}_${String(p._id || p.id)}_${String(p.jobId ?? 'nojob')}_${index}`}
            style={styles.pSelectRow}
            onPress={() => {
                const assig = {
                    type: 'project',
                    _id: p._id,
                    id: p._id,
                    displayName: `Project: ${p.name} (${p.jobName || 'Site'})`,
                    jobId: p.jobId
                };
                setSelectedAssignment(assig);
                handleClockToggle(assig);
            }}
        >
            <View style={styles.pSelectIcon}>
                <MaterialCommunityIcons name="office-building" size={20} color="#16A34A" />
            </View>
            <View style={{ flex: 1 }}>
                <Text style={styles.pSelectName} numberOfLines={1}>
                    {p.name}
                </Text>
                <Text style={styles.pSelectLoc} numberOfLines={1}>
                    {p.jobName || 'General site attendance'}
                </Text>
            </View>
            <MaterialCommunityIcons name="chevron-right" size={20} color="#94A3B8" />
        </TouchableOpacity>
    );

    return (
        <View style={styles.container}>
            <StatusBar barStyle="dark-content" backgroundColor="#FFFFFF" />
            <WorkerHeader title="Dashboard" showBranding={true} />

            <Animated.ScrollView
                style={[styles.scroll, { opacity: fadeAnim }]}
                showsVerticalScrollIndicator={false}
                contentContainerStyle={[
                    styles.scrollContent,
                    {
                        paddingHorizontal: isTabletWidth ? 28 : 16,
                        paddingBottom: contentBottomForTabBar(insets.bottom),
                        alignSelf: 'center',
                        width: '100%',
                        maxWidth: 980
                    }
                ]}
            >
                <SubcontractorDashboard
                    navigation={navigation}
                    timer={timer}
                    isClockedIn={isClockedIn}
                    isClocking={isClocking}
                    handleClockToggle={handleClockToggle}
                    setClockModal={setClockModal}
                    selectedAssignment={selectedAssignment}
                />
            </Animated.ScrollView>

            <Modal visible={clockModal} transparent animationType="slide">
                <View style={styles.modalOverlay}>
                    <View style={styles.modalContent}>
                        <View style={styles.modalIndicator} />
                        <View style={{ marginBottom: 16 }}>
                            <Text style={styles.modalTitle}>Site Attendance</Text>
                            <Text style={styles.modalSub}>SELECT TASK OR PROJECT (SAME AS WEB)</Text>
                        </View>

                        <ScrollView style={{ maxHeight: 420 }} showsVerticalScrollIndicator={false}>
                            {assignedTasksList.length > 0 && (
                                <>
                                    <Text style={styles.sectionLabel}>MY TASKS</Text>
                                    {assignedTasksList.map((t, idx) => renderTaskRow(t, idx))}
                                </>
                            )}

                            {assignedProjectsList.length > 0 && (
                                <>
                                    <Text style={[styles.sectionLabel, { marginTop: assignedTasksList.length ? 12 : 0 }]}>
                                        GENERAL SITE ATTENDANCE
                                    </Text>
                                    {assignedProjectsList.map((p, idx) => renderProjectRow(p, idx, 'site'))}
                                </>
                            )}

                            {!hasWorkerMetricsAssignments && (projects || []).length > 0 && (
                                <>
                                    <Text style={styles.sectionLabel}>PROJECTS</Text>
                                    <Text style={styles.hintText}>
                                        Task-level assignments from the server are not loaded yet. You can clock in to
                                        a project below, or open this screen again after sync.
                                    </Text>
                                    {(projects || []).map((proj, idx) =>
                                        renderProjectRow(
                                            {
                                                _id: proj._id || proj.id,
                                                name: proj.name,
                                                jobName: proj.location || 'General site',
                                                jobId: null
                                            },
                                            idx,
                                            'fallback'
                                        )
                                    )}
                                </>
                            )}

                            <Text style={[styles.sectionLabel, { marginTop: 12 }]}>OTHER</Text>
                            <TouchableOpacity
                                style={styles.pSelectRow}
                                onPress={() => handleClockToggle({ type: 'random' })}
                            >
                                <View style={styles.pSelectIcon}>
                                    <MaterialCommunityIcons name="map-marker-alert" size={20} color="#EA580C" />
                                </View>
                                <View style={{ flex: 1 }}>
                                    <Text style={styles.pSelectName}>Random Site / Emergency Attendance</Text>
                                    <Text style={styles.pSelectLoc}>Requires a short reason</Text>
                                </View>
                                <MaterialCommunityIcons name="chevron-right" size={20} color="#94A3B8" />
                            </TouchableOpacity>

                            {!hasWorkerMetricsAssignments && (projects || []).length === 0 && (
                                <Text style={{ textAlign: 'center', color: '#94A3B8', padding: 20 }}>
                                    No assignments loaded. Pull to refresh from the main menu or use Random Site.
                                </Text>
                            )}
                        </ScrollView>

                        <TouchableOpacity style={styles.cancelBtn} onPress={() => setClockModal(false)}>
                            <Text style={styles.cancelBtnText}>CANCEL</Text>
                        </TouchableOpacity>
                    </View>
                </View>
            </Modal>

            <Modal visible={randomReasonModal} transparent animationType="fade">
                <View style={styles.modalOverlay}>
                    <View style={[styles.modalContent, { maxHeight: '70%' }]}>
                        <Text style={styles.modalTitle}>Random / emergency clock-in</Text>
                        <Text style={[styles.modalSub, { marginBottom: 12 }]}>REASON (REQUIRED)</Text>
                        <TextInput
                            style={styles.reasonInput}
                            placeholder="e.g. Unlisted site visit…"
                            value={randomReason}
                            onChangeText={setRandomReason}
                            multiline
                            placeholderTextColor="#94A3B8"
                        />
                        <TouchableOpacity
                            style={[styles.primaryBtn, !randomReason.trim() && { opacity: 0.5 }]}
                            disabled={!randomReason.trim() || isClocking}
                            onPress={confirmRandomClockIn}
                        >
                            <Text style={styles.primaryBtnText}>START CLOCK IN</Text>
                        </TouchableOpacity>
                        <TouchableOpacity
                            style={styles.cancelBtn}
                            onPress={() => {
                                setRandomReasonModal(false);
                                setRandomReason('');
                            }}
                        >
                            <Text style={styles.cancelBtnText}>CANCEL</Text>
                        </TouchableOpacity>
                    </View>
                </View>
            </Modal>
        </View>
    );
};

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: '#F8FAFC' },
    scroll: { flex: 1 },
    scrollContent: { padding: 20 },

    modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'flex-end' },
    modalContent: {
        backgroundColor: '#fff',
        borderTopLeftRadius: 32,
        borderTopRightRadius: 32,
        padding: 24,
        maxHeight: '85%'
    },
    modalIndicator: {
        width: 40,
        height: 4,
        backgroundColor: '#E2E8F0',
        borderRadius: 2,
        alignSelf: 'center',
        marginBottom: 20
    },
    modalTitle: { fontSize: 20, fontWeight: '900', color: '#0F172A' },
    modalSub: { fontSize: 9, fontWeight: '800', color: '#3B82F6', letterSpacing: 1 },

    sectionLabel: {
        fontSize: 10,
        fontWeight: '900',
        color: '#94A3B8',
        letterSpacing: 1,
        marginBottom: 8
    },
    hintText: {
        fontSize: 12,
        color: '#64748B',
        marginBottom: 10,
        lineHeight: 18
    },

    pSelectRow: {
        flexDirection: 'row',
        alignItems: 'center',
        padding: 14,
        backgroundColor: '#F8FAFC',
        borderRadius: 16,
        marginBottom: 10,
        borderWidth: 1,
        borderColor: '#F1F5F9'
    },
    pSelectIcon: {
        width: 40,
        height: 40,
        borderRadius: 12,
        backgroundColor: '#F1F5F9',
        justifyContent: 'center',
        alignItems: 'center',
        marginRight: 12
    },
    pSelectName: { fontSize: 14, fontWeight: '800', color: '#1E293B' },
    pSelectLoc: { fontSize: 11, color: '#94A3B8', marginTop: 2 },

    cancelBtn: {
        width: '100%',
        padding: 16,
        borderRadius: 16,
        alignItems: 'center',
        backgroundColor: '#F1F5F9',
        marginTop: 12
    },
    cancelBtnText: { fontWeight: '900', color: '#64748B', fontSize: 12 },
    reasonInput: {
        borderWidth: 1,
        borderColor: '#E2E8F0',
        borderRadius: 14,
        padding: 12,
        minHeight: 100,
        textAlignVertical: 'top',
        fontSize: 14,
        color: '#0F172A',
        marginBottom: 14
    },
    primaryBtn: {
        backgroundColor: '#2563EB',
        paddingVertical: 16,
        borderRadius: 14,
        alignItems: 'center',
        marginBottom: 8
    },
    primaryBtnText: { color: '#fff', fontWeight: '900', fontSize: 13 }
});

export default SubcontractorDashboardScreen;
