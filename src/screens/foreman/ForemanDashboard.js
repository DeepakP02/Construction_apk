import React, { useCallback, useState, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Dimensions, ScrollView, ActivityIndicator, StatusBar, RefreshControl, useWindowDimensions, Alert, Modal } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { COLORS, SHADOWS, SPACING } from '../../constants/theme';
import { useApp } from '../../context/AppContext';
import WorkerHeader from '../../components/WorkerHeader';
import { scale, verticalScale, moderateScale, isTablet } from '../../utils/responsive';
import { isTodoVisibleToUser } from '../../utils/todoVisibility';

const sameUserId = (a, b) => String(a ?? '') === String(b ?? '');

const isTaskDone = (t) => {
    const s = (t?.status || '').toLowerCase();
    return s === 'completed' || s === 'done' || s === 'cancelled';
};

const ForemanDashboard = ({ navigation }) => {
    const { 
        user, tasks, refreshData, loading, todos, resolveUser, selectedProject, 
        toggleTodo, deleteTodo, addTodo, isClockedIn, toggleClock, getWorkDuration, 
        projects, metrics, clockInTime 
    } = useApp();
    const { width, height } = useWindowDimensions();
    const [refreshing, setRefreshing] = useState(false);
    const [timer, setTimer] = useState('00:00:00');
    const [clockModal, setClockModal] = useState(false);
    const [selectedAssignment, setSelectedAssignment] = useState(null); 

    // Timer logic
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

    const handleClockToggle = async (assignment = null) => {
        try {
            if (!isClockedIn && !assignment) {
                setClockModal(true);
                return;
            }
            let pId = null;
            let tId = null;
            const opts = {};
            if (assignment) {
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
                } else if (typeof assignment === 'string') {
                    pId = assignment;
                }
            }
            await toggleClock(pId, tId, opts);
            setClockModal(false);
            refreshData();
        } catch (e) {
            const errorMsg = e.response?.data?.message || e.message;
            Alert.alert('Attendance Error', errorMsg || 'Could not sync with server.');
        }
    };

    useFocusEffect(
        useCallback(() => {
            refreshData();
        }, [])
    );

    const onRefresh = async () => {
        setRefreshing(true);
        await refreshData();
        setRefreshing(false);
    };

    // Worker metrics from backend /reports/stats
    const workerMetrics = metrics?.workerMetrics || {};
    const currentJob = workerMetrics.currentJob || 'Not Clocked In';
    
    // Available general projects list for general site attendance
    const assignedTasks_list = workerMetrics.assignedTasks || [];
    const assignedProjects_list = workerMetrics.assignedProjects && workerMetrics.assignedProjects.length > 0
        ? workerMetrics.assignedProjects
        : projects || [];
    const hasAssignments = assignedTasks_list.length > 0 || assignedProjects_list.length > 0;

    // GET /tasks for FOREMAN already returns job/crew tasks (assignedTo workers), assignedForeman job tasks, etc.
    // Do not require assignedTo === foreman only — that hid the same "assigned work" the web shows for the site.
    const pendingTasks = (tasks || []).filter(t => {
        if (isTaskDone(t)) return false;

        if (selectedProject) {
            const taskPid = t.projectId?._id || t.projectId;
            const selPid = selectedProject._id || selectedProject.id;
            if (!sameUserId(taskPid, selPid)) return false;
        }

        if (user?.role === 'FOREMAN') {
            return true;
        }

        const myId = user?._id || user?.id;
        const assigned = Array.isArray(t.assignedTo) ? t.assignedTo : t.assignedTo != null ? [t.assignedTo] : [];
        const isAssignedToMe = assigned.some((a) => {
            const aId = typeof a === 'object' ? (a._id || a.id) : a;
            return sameUserId(aId, myId);
        });
        const assignedForeman = t.assignedForeman?._id || t.assignedForeman;
        const isForemanOnJobTask = myId && sameUserId(assignedForeman, myId);
        return isAssignedToMe || isForemanOnJobTask;
    });

    const myTodos = (todos || []).filter(t => isTodoVisibleToUser(t, user));

    const quickActions = [
        { id: '1', label: 'Clock In Crew', icon: 'account-clock', color: '#6366F1', bg: '#EEF2FF', screen: 'CrewClock' },
        { id: '2', label: 'Add Daily Log', icon: 'file-document-edit', color: '#F59E0B', bg: '#FFFBEB', screen: 'DailyLogs' },
        { id: '3', label: 'Upload Photo', icon: 'camera-plus', color: '#10B981', bg: '#ECFDF5', screen: 'Photos' },
        { id: '4', label: 'Create PO', icon: 'cart-plus', color: '#EF4444', bg: '#FEF2F2', screen: 'PurchaseOrders' },
    ];

    return (
        <View style={styles.container}>
            <StatusBar barStyle="dark-content" />
            <WorkerHeader showBranding={true} />
            <ScrollView 
                showsVerticalScrollIndicator={false} 
                contentContainerStyle={[styles.scrollContent, { paddingHorizontal: isTablet ? '10%' : moderateScale(16) }]}
                refreshControl={
                    <RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={[COLORS.primary]} />
                }
            >
                <View style={[styles.headerSubtitleWrap, { marginBottom: verticalScale(10), marginTop: verticalScale(10) }]}>
                    <Text style={[styles.headerTitle, { fontSize: moderateScale(32) }]} numberOfLines={1}>Foreman Dashboard</Text>
                    <Text style={[styles.headerSubtitle, { fontSize: moderateScale(13) }]} numberOfLines={1}>OWN YOUR TIME. CONTROL YOUR SITE.</Text>
                </View>

                {/* ═══ PERSONAL CLOCK IN/OUT CARD ═══ */}
                <View style={[styles.clockCard, SHADOWS.medium, { padding: moderateScale(16), borderRadius: moderateScale(16), marginBottom: verticalScale(16) }]}>
                    <View style={styles.clockStatusRow}>
                        <View style={[styles.clockStatusBadge, { backgroundColor: isClockedIn ? '#DCFCE7' : '#FFF7ED', paddingHorizontal: scale(10), paddingVertical: verticalScale(4) }]}>
                            <View style={[styles.clockStatusDot, { backgroundColor: isClockedIn ? '#16A34A' : '#F59E0B', width: scale(6), height: scale(6) }]} />
                            <Text style={[styles.clockStatusText, { color: isClockedIn ? '#16A34A' : '#D97706', fontSize: moderateScale(9) }]}>
                                {isClockedIn ? 'CURRENTLY ON CLOCK' : 'READY TO START'}
                            </Text>
                        </View>
                    </View>

                    <View style={styles.timerSection}>
                        <Text style={[styles.timerText, { fontSize: moderateScale(38) }]}>{isClockedIn ? timer : '00:00:00'}</Text>
                        <View style={styles.clockIconFloat}>
                            <MaterialCommunityIcons name="clock-outline" size={moderateScale(64)} color="#F1F5F9" />
                        </View>
                    </View>

                    <Text style={[styles.siteLabel, { fontSize: moderateScale(8) }]}>SELECT SITE FOR CLOCK IN</Text>
                    <TouchableOpacity
                        style={[styles.siteSelector, { height: verticalScale(44), borderRadius: moderateScale(10), paddingHorizontal: scale(12) }]}
                        onPress={() => !isClockedIn && setClockModal(true)}
                        disabled={isClockedIn}
                    >
                        <Text style={[styles.siteSelectorText, { fontSize: moderateScale(13) }]} numberOfLines={1}>
                            {isClockedIn ? (currentJob !== 'Not Clocked In' ? currentJob : 'Active Site') :
                                (selectedAssignment ? selectedAssignment.displayName : '-- Choose Task / Project --')}
                        </Text>
                        {!isClockedIn && <MaterialCommunityIcons name="chevron-down" size={moderateScale(18)} color="#94A3B8" />}
                    </TouchableOpacity>

                    {!isClockedIn && (
                        <View style={styles.notActiveRow}>
                            <View style={[styles.notActiveDot, { backgroundColor: '#94A3B8', width: scale(8), height: scale(8) }]} />
                            <Text style={[styles.notActiveText, { fontSize: moderateScale(11) }]}>Not Active</Text>
                        </View>
                    )}

                    <TouchableOpacity
                        style={[styles.clockBtn, { backgroundColor: isClockedIn ? '#EF4444' : '#2563EB', paddingVertical: verticalScale(13), borderRadius: moderateScale(12) }]}
                        onPress={() => handleClockToggle(selectedAssignment)}
                    >
                        <MaterialCommunityIcons
                            name={isClockedIn ? "stop-circle" : "play-circle"}
                            size={moderateScale(20)}
                            color="#fff"
                            style={{ marginRight: scale(8) }}
                        />
                        <Text style={[styles.clockBtnText, { fontSize: moderateScale(13) }]}>
                            {isClockedIn ? 'STOP CLOCK OUT' : 'START CLOCK IN'}
                        </Text>
                    </TouchableOpacity>
                </View>

                <Text style={[styles.sectionTitle, { fontSize: moderateScale(10), marginBottom: verticalScale(12) }]}>QUICK ACTIONS</Text>
                <View style={styles.actionGrid}>
                    {quickActions.map(action => (
                        <TouchableOpacity 
                            key={action.id} 
                            style={[styles.actionCard, { borderLeftColor: action.color, paddingVertical: verticalScale(10), paddingHorizontal: scale(12), borderRadius: moderateScale(14), width: isTablet ? '48%' : '48.5%' }]}
                            onPress={() => action.screen && navigation.navigate(action.screen)}
                        >
                            <View style={[styles.actionIconWrap, { width: scale(32), height: scale(32), borderRadius: moderateScale(8), marginRight: scale(10) }]}>
                                <MaterialCommunityIcons name={action.icon} size={moderateScale(16)} color={action.color} />
                            </View>
                            <Text style={[styles.actionLabel, { fontSize: moderateScale(12) }]} numberOfLines={1}>{action.label}</Text>
                        </TouchableOpacity>
                    ))}
                </View>

                <View style={[styles.sectionHeaderRow, { marginBottom: verticalScale(10), marginTop: verticalScale(15) }]}>
                    <Text style={[styles.sectionTitle, { fontSize: moderateScale(10) }]}>DAILY TO-DOS</Text>
                    <View style={[styles.pendingBadge, { backgroundColor: '#EEF2FF', paddingHorizontal: scale(10), paddingVertical: verticalScale(4), borderRadius: moderateScale(8) }]}>
                        <Text style={[styles.pendingBadgeText, { color: '#6366F1', fontSize: moderateScale(9) }]}>{myTodos.filter(t => t.status !== 'completed').length} Pending</Text>
                    </View>
                </View>

                <View style={[styles.tasksPremiumCard, SHADOWS.medium, { borderRadius: moderateScale(24), marginBottom: verticalScale(20), padding: moderateScale(16) }]}>
                    {myTodos.length > 0 ? (
                        myTodos.map((todo, idx) => (
                            <TouchableOpacity
                                key={todo._id || idx}
                                style={[styles.todoRow, { paddingVertical: verticalScale(10) }]}
                                onPress={() => toggleTodo(todo._id)}
                            >
                                <View style={[styles.todoCheckbox, todo.status === 'completed' && styles.todoChecked, { width: scale(20), height: scale(20) }]}>
                                    {todo.status === 'completed' && (
                                        <MaterialCommunityIcons name="check" size={moderateScale(12)} color="#fff" />
                                    )}
                                </View>
                                <View style={{ flex: 1, marginLeft: scale(12) }}>
                                    <Text style={[styles.todoItemText, todo.status === 'completed' && styles.todoItemDone, { fontSize: moderateScale(13) }]}>
                                        {todo.title || todo.description || 'Todo'}
                                    </Text>
                                    {todo.assignedBy && (
                                        <Text style={[styles.todoAssignedBy, { fontSize: moderateScale(9), color: '#6366F1', fontWeight: '800' }]}>
                                            ASSIGNED BY: {resolveUser(todo.assignedBy).fullName}
                                        </Text>
                                    )}
                                </View>
                                <TouchableOpacity onPress={() => deleteTodo(todo._id)}>
                                    <MaterialCommunityIcons name="close" size={moderateScale(16)} color="#CBD5E1" />
                                </TouchableOpacity>
                            </TouchableOpacity>
                        ))
                    ) : (
                        <Text style={[styles.emptyTasksSub, { textAlign: 'center', padding: 20 }]}>No todos for today.</Text>
                    )}
                </View>

                <View style={[styles.sectionHeaderRow, { marginBottom: verticalScale(10), marginTop: verticalScale(15) }]}>
                    <Text style={[styles.sectionTitle, { fontSize: moderateScale(10) }]}>ASSIGNED TASKS</Text>
                    <View style={[styles.pendingBadge, { paddingHorizontal: scale(10), paddingVertical: verticalScale(4), borderRadius: moderateScale(8) }]}>
                        <Text style={[styles.pendingBadgeText, { fontSize: moderateScale(9) }]}>{pendingTasks.length} Pending Tasks</Text>
                    </View>
                </View>

                <View style={[styles.tasksPremiumCard, SHADOWS.medium, { borderRadius: moderateScale(24), marginBottom: verticalScale(20) }]}>
                    {pendingTasks.length > 0 ? (
                        pendingTasks.map((task, index) => (
                            <TouchableOpacity 
                                key={task._id || index} 
                                style={[styles.taskItem, { padding: moderateScale(16) }, index === 0 && { borderTopWidth: 0 }]}
                                onPress={() => navigation.navigate('ForemanTasks')}
                            >
                                <View style={styles.taskLeft}>
                                    <View style={[styles.taskStatusDot, { width: scale(8), height: scale(8), borderRadius: scale(4), marginRight: scale(12), backgroundColor: task.priority === 'High' ? '#EF4444' : '#3B82F6' }]} />
                                    <View style={{ flex: 1 }}>
                                        <Text style={[styles.taskTitle, { fontSize: moderateScale(14) }]} numberOfLines={1}>{task.title}</Text>
                                        <Text style={[styles.taskProject, { fontSize: moderateScale(11), marginTop: verticalScale(2) }]} numberOfLines={1}>{task.projectId?.name || 'Site Task'}</Text>
                                    </View>
                                </View>
                                <MaterialCommunityIcons name="chevron-right" size={moderateScale(20)} color="#CBD5E1" />
                            </TouchableOpacity>
                        ))
                    ) : (
                        <View style={[styles.emptyTasksView, { padding: scale(40) }]}>
                            <MaterialCommunityIcons name="check-decagram" size={moderateScale(48)} color="#10B981" />
                            <Text style={[styles.emptyTasksTitle, { fontSize: moderateScale(18), marginTop: verticalScale(16) }]}>All caught up!</Text>
                            <Text style={[styles.emptyTasksSub, { fontSize: moderateScale(13), marginTop: verticalScale(8) }]}>No tasks assigned to your crew today.</Text>
                        </View>
                    )}
                    {pendingTasks.length > 3 && (
                        <TouchableOpacity 
                            style={[styles.viewMoreBtn, { padding: verticalScale(14) }]}
                            onPress={() => navigation.navigate('ForemanTasks')}
                        >
                            <Text style={[styles.viewMoreText, { fontSize: moderateScale(11) }]}>View all {pendingTasks.length} tasks</Text>
                        </TouchableOpacity>
                    )}
                </View>

                <View style={{ height: verticalScale(40) }} />
            </ScrollView>

            {/* ═══ CLOCK-IN SELECTOR MODAL ═══ */}
            <Modal visible={clockModal} animationType="slide" transparent>
                <View style={styles.modalOverlay}>
                    <View style={[styles.modalContent, SHADOWS.large, { maxWidth: scale(500), alignSelf: 'center', width: '100%', borderRadius: moderateScale(20) }]}>
                        <View style={[styles.modalHeader, { paddingBottom: verticalScale(12) }]}>
                            <Text style={[styles.modalTitle, { fontSize: moderateScale(18) }]}>Select Work Site</Text>
                            <TouchableOpacity onPress={() => setClockModal(false)}>
                                <MaterialCommunityIcons name="close" size={moderateScale(24)} color="#64748B" />
                            </TouchableOpacity>
                        </View>
                        <ScrollView style={{ maxHeight: verticalScale(400) }} showsVerticalScrollIndicator={false}>
                            {!hasAssignments ? (
                                <View style={{ padding: scale(40), alignItems: 'center' }}>
                                    <MaterialCommunityIcons name="briefcase-off-outline" size={moderateScale(48)} color="#E2E8F0" />
                                    <Text style={{ marginTop: verticalScale(12), color: '#94A3B8', fontWeight: '700', fontSize: moderateScale(13) }}>
                                        No assignments available
                                    </Text>
                                </View>
                            ) : (
                                <>
                                    {assignedTasks_list.length > 0 && (
                                        <>
                                            <View style={[styles.modalSectionLabel, { paddingVertical: verticalScale(10) }]}>
                                                <MaterialCommunityIcons name="clipboard-check-outline" size={moderateScale(14)} color="#94A3B8" />
                                                <Text style={[styles.modalSectionText, { fontSize: moderateScale(9) }]}>MY TASKS</Text>
                                            </View>
                                            {assignedTasks_list.map((t, tIdx) => {
                                                const prefix = t.type === 'SubTask' ? 'Sub: ' : t.type === 'Task' ? 'Global: ' : 'Task: ';
                                                const displayName = `${prefix}${t.title}`;
                                                return (
                                                    <TouchableOpacity
                                                        key={`task_${String(t._id)}_${tIdx}`}
                                                        style={[styles.projectItem, selectedAssignment?.id === t._id && styles.projectItemSelected, { paddingVertical: verticalScale(14), paddingHorizontal: scale(8) }]}
                                                        onPress={() => {
                                                            const assig = { type: 'task', id: t._id, displayName, projectId: t.projectId, jobId: t.jobId, taskType: t.type || 'JobTask' };
                                                            setSelectedAssignment(assig);
                                                            handleClockToggle(assig);
                                                        }}
                                                    >
                                                        <View style={[styles.projectDot, { backgroundColor: '#3B82F6', width: scale(10), height: scale(10) }]} />
                                                        <View style={{ flex: 1, marginLeft: scale(12) }}>
                                                            <Text style={[styles.projectName, { fontSize: moderateScale(14) }]} numberOfLines={1}>{displayName}</Text>
                                                            <Text style={[styles.projectLocation, { fontSize: moderateScale(11) }]}>{t.jobName || 'Job'} / {t.projectName || 'Project'}</Text>
                                                        </View>
                                                        <MaterialCommunityIcons name="chevron-right" size={moderateScale(20)} color="#94A3B8" />
                                                    </TouchableOpacity>
                                                );
                                            })}
                                        </>
                                    )}

                                    {assignedProjects_list.length > 0 && (
                                        <>
                                            <View style={[styles.modalSectionLabel, { paddingVertical: verticalScale(10) }]}>
                                                <MaterialCommunityIcons name="office-building-outline" size={moderateScale(14)} color="#94A3B8" />
                                                <Text style={[styles.modalSectionText, { fontSize: moderateScale(9) }]}>GENERAL SITE ATTENDANCE</Text>
                                            </View>
                                            {assignedProjects_list.map((p, pIdx) => (
                                                <TouchableOpacity
                                                    key={`project_${String(p._id)}_${String(p.jobId ?? 'nojob')}_${pIdx}`}
                                                    style={[styles.projectItem, selectedAssignment?.id === p._id && styles.projectItemSelected, { paddingVertical: verticalScale(14), paddingHorizontal: scale(8) }]}
                                                    onPress={() => {
                                                        const assig = { type: 'project', _id: p._id, id: p._id, displayName: `${p.name} (${p.jobName || 'Site'})`, jobId: p.jobId };
                                                        setSelectedAssignment(assig);
                                                        handleClockToggle(assig);
                                                    }}
                                                >
                                                    <View style={[styles.projectDot, { backgroundColor: '#22C55E', width: scale(10), height: scale(10) }]} />
                                                    <View style={{ flex: 1, marginLeft: scale(12) }}>
                                                        <Text style={[styles.projectName, { fontSize: moderateScale(14) }]} numberOfLines={1}>{p.name}</Text>
                                                        <Text style={[styles.projectLocation, { fontSize: moderateScale(11) }]}>{p.jobName || 'General Attendance'}</Text>
                                                    </View>
                                                    <MaterialCommunityIcons name="chevron-right" size={moderateScale(20)} color="#94A3B8" />
                                                </TouchableOpacity>
                                            ))}
                                        </>
                                    )}
                                </>
                            )}
                        </ScrollView>
                    </View>
                </View>
            </Modal>
        </View>
    );
};

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: '#F8FAFC' },
    scrollContent: { paddingBottom: 60 },
    headerSubtitleWrap: { paddingLeft: 2 },
    headerTitle: { fontWeight: '900', color: '#0F172A', letterSpacing: -1 },
    headerSubtitle: { fontWeight: '700', color: '#64748B' },
    sectionTitle: { fontWeight: '900', color: '#0F172A', letterSpacing: 1.5, paddingLeft: 2 },
    actionGrid: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between' },
    actionCard: { 
        backgroundColor: '#fff', 
        marginBottom: 8, 
        borderLeftWidth: 3, 
        flexDirection: 'row', 
        alignItems: 'center',
        elevation: 2, 
        shadowColor: '#000', 
        shadowOffset: { width: 0, height: 1 }, 
        shadowOpacity: 0.05, 
        shadowRadius: 2
    },
    actionIconWrap: { backgroundColor: '#F1F5F9', justifyContent: 'center', alignItems: 'center' },
    actionLabel: { fontWeight: '800', color: '#1E293B', flex: 1 },
    sectionHeaderRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
    pendingBadge: { backgroundColor: '#FEE2E2' },
    pendingBadgeText: { fontWeight: '900', color: '#EF4444' },
    tasksPremiumCard: { backgroundColor: '#fff', overflow: 'hidden', borderWidth: 1, borderColor: '#F1F5F9' },
    taskItem: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', borderTopWidth: 1, borderTopColor: '#F8FAFC' },
    taskLeft: { flexDirection: 'row', alignItems: 'center', flex: 1 },
    taskStatusDot: { },
    taskTitle: { fontWeight: '800', color: '#1E293B' },
    taskProject: { fontWeight: '600', color: '#94A3B8' },
    emptyTasksView: { alignItems: 'center' },
    emptyTasksTitle: { fontWeight: '900', color: '#0F172A' },
    emptyTasksSub: { fontWeight: '600', color: '#94A3B8', textAlign: 'center' },
    viewMoreBtn: { alignItems: 'center', borderTopWidth: 1, borderTopColor: '#F8FAFC', backgroundColor: '#FBFDFF' },
    viewMoreText: { fontWeight: '900', color: '#2563EB' },
    todoRow: { flexDirection: 'row', alignItems: 'center', borderBottomWidth: 1, borderBottomColor: '#F8FAFC' },
    todoCheckbox: { borderWidth: 2, borderColor: '#E2E8F0', borderRadius: 6, justifyContent: 'center', alignItems: 'center' },
    todoChecked: { backgroundColor: '#6366F1', borderColor: '#6366F1' },
    todoItemText: { fontWeight: '700', color: '#334155' },
    todoItemDone: { textDecorationLine: 'line-through', color: '#94A3B8' },
    todoAssignedBy: { marginTop: 2, textTransform: 'uppercase' },
    clockCard: { backgroundColor: '#FFFFFF', marginBottom: 12, overflow: 'hidden', borderWidth: 1, borderColor: '#F1F5F9' },
    clockStatusRow: { alignItems: 'flex-start', marginBottom: 4 },
    clockStatusBadge: { flexDirection: 'row', alignItems: 'center', borderRadius: 12, gap: 5 },
    clockStatusDot: { borderRadius: 3 },
    clockStatusText: { fontWeight: '900', letterSpacing: 0.8 },
    timerSection: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 },
    timerText: { fontWeight: '900', color: '#0F172A', letterSpacing: -1, fontVariant: ['tabular-nums'] },
    clockIconFloat: { opacity: 0.4 },
    siteLabel: { fontWeight: '800', color: '#94A3B8', letterSpacing: 1, marginBottom: 4 },
    siteSelector: { backgroundColor: '#F8FAFC', borderWidth: 1, borderColor: '#E2E8F0', flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 },
    siteSelectorText: { fontWeight: '700', color: '#475569', flex: 1 },
    notActiveRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 12 },
    notActiveDot: { borderRadius: 4 },
    notActiveText: { fontWeight: '700', color: '#94A3B8' },
    clockBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center' },
    clockBtnText: { color: '#FFFFFF', fontWeight: '900', letterSpacing: 0.5 },
    modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', padding: 20 },
    modalContent: { backgroundColor: '#FFFFFF', padding: 20, maxHeight: '70%' },
    modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', borderBottomWidth: 1, borderBottomColor: '#F1F5F9' },
    modalTitle: { fontWeight: '900', color: '#0F172A' },
    projectItem: { flexDirection: 'row', alignItems: 'center', borderBottomWidth: 1, borderBottomColor: '#F8FAFC' },
    projectItemSelected: { backgroundColor: '#EFF6FF', borderRadius: 10 },
    projectDot: { },
    projectName: { fontWeight: '800', color: '#1E293B' },
    projectLocation: { fontWeight: '600', color: '#94A3B8', marginTop: 2 },
    modalSectionLabel: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 4, borderBottomWidth: 1, borderBottomColor: '#F8FAFC', marginTop: 8 },
    modalSectionText: { fontWeight: '900', color: '#94A3B8', letterSpacing: 1.2, textTransform: 'uppercase' },
});

export default ForemanDashboard;
