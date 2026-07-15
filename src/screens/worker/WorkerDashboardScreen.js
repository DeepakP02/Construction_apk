import React, { useEffect, useState, useRef, useCallback } from 'react';
import {
    View, Text, StyleSheet, TouchableOpacity, TextInput,
    Dimensions, Modal, ScrollView, Alert, StatusBar, Platform, FlatList, useWindowDimensions, KeyboardAvoidingView
} from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { COLORS, SHADOWS, SIZES, SPACING, TYPOGRAPHY } from '../../constants/theme';
import { useApp } from '../../context/AppContext';
import WorkerHeader from '../../components/WorkerHeader';

import api from '../../utils/api';
import { scale, verticalScale, moderateScale, isTablet, fontScale } from '../../utils/responsive';
import { isTodoVisibleToUser } from '../../utils/todoVisibility';


const WorkerDashboardScreen = ({ navigation }) => {
    const {
        user, isClockedIn, toggleClock, getWorkDuration, refreshData,
        projects, metrics, clockInTime, tasks, activities, todos,
        addTodo, toggleTodo, deleteTodo, jobs, selectedProject, resolveUser
    } = useApp();

    const { width, height } = useWindowDimensions();
    const [timer, setTimer] = useState('00:00:00');
    const [clockModal, setClockModal] = useState(false);
    const [selectedAssignment, setSelectedAssignment] = useState(null); 
    const [todoText, setTodoText] = useState('');
    const [showTodoFilter, setShowTodoFilter] = useState(false);
    const [todoFilter, setTodoFilter] = useState('all');
    const [todosExpanded, setTodosExpanded] = useState(false);

    const TODO_LIST_COLLAPSE_COUNT = 4; 

    // Worker metrics from backend /reports/stats
    const workerMetrics = metrics?.workerMetrics || {};
    const myHoursToday = workerMetrics.myHoursToday || '0.0h';
    const currentJob = workerMetrics.currentJob || 'Not Clocked In';
    const assignedJobs = workerMetrics.assignedProjects?.length || 0;

    // All tasks assigned to current user
    const myTasks = (workerMetrics.assignedTasks || []).length > 0
        ? workerMetrics.assignedTasks
        : (tasks || []).filter(t => {
            const isAssigned = (Array.isArray(t.assignedTo) && t.assignedTo.some(a => (a._id || a) === user?._id)) ||
                (t.assignedTo === user?._id || t.assignedTo === user?.fullName);
            return isAssigned;
        });

    const pendingTasks = (tasks || []).filter(t => {
        if (t.status === 'completed') return false;
        
        // Filter by selected project
        if (selectedProject && (t.projectId?._id || t.projectId) !== (selectedProject._id || selectedProject.id)) return false;

        const assigned = Array.isArray(t.assignedTo) ? t.assignedTo : [t.assignedTo];
        const isAssignedToMe = assigned.some(a => {
            const aId = typeof a === 'object' ? (a._id || a.id) : a;
            return aId === user?._id;
        });

        return isAssignedToMe;
    });

    // Todos: only this user's assigned items (e.g. PM → worker) or self-created with no assignee
    const myTodos = (todos || []).filter(t => {
        const belongsToMe = isTodoVisibleToUser(t, user);
        if (todoFilter === 'pending') return t.status !== 'completed' && belongsToMe;
        if (todoFilter === 'completed') return t.status === 'completed' && belongsToMe;
        return belongsToMe;
    });
    const todayTodos = myTodos.filter(t => {
        const created = new Date(t.createdAt);
        const now = new Date();
        return created.toDateString() === now.toDateString();
    });
    const displayTodos = todayTodos.length > 0 ? todayTodos : myTodos;
    const pendingTodoCount = displayTodos.filter(t => t.status !== 'completed').length;
    const hasMoreTodosThanVisible = displayTodos.length > TODO_LIST_COLLAPSE_COUNT;
    const visibleTodos = todosExpanded || !hasMoreTodosThanVisible
        ? displayTodos
        : displayTodos.slice(0, TODO_LIST_COLLAPSE_COUNT);

    // Recent Activity from backend
    const myRecentActivity = (metrics?.myRecentActivity || activities || [])
        .filter(act => !selectedProject || (act.projectId?._id || act.projectId) === (selectedProject._id || selectedProject.id));

    // Data for clock-in selector
    const assignedTasks_list = workerMetrics.assignedTasks || [];
    const assignedProjects_list = workerMetrics.assignedProjects || [];
    const hasAssignments = assignedTasks_list.length > 0 || assignedProjects_list.length > 0;

    // Timer logic
    useEffect(() => {
        const unsubscribe = navigation.addListener('focus', () => { refreshData(); });
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

    const handleAddTodo = async () => {
        if (!todoText.trim()) return;
        const result = await addTodo({ title: todoText.trim() });
        if (result) setTodoText('');
    };

    return (
        <View style={styles.container}>
            <StatusBar barStyle="dark-content" backgroundColor="#FFFFFF" />
            <WorkerHeader showBranding={true} />

            <KeyboardAvoidingView
                behavior={Platform.OS === 'ios' ? 'padding' : undefined}
                style={{ flex: 1 }}
                keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 0}
            >
                <ScrollView
                    style={styles.scrollView}
                    contentContainerStyle={[styles.scrollContent, { paddingHorizontal: isTablet ? '10%' : moderateScale(14), paddingBottom: verticalScale(100) }]}
                    showsVerticalScrollIndicator={false}
                    bounces={false}
                >
                {/* ═══ DASHBOARD TITLE ═══ */}
                <View style={styles.dashboardHeader}>
                    <View style={styles.dashTitleRow}>
                        <Text style={[styles.dashTitle, { fontSize: moderateScale(22) }]}>Dashboard</Text>
                    </View>
                    <Text style={[styles.dashSubtitle, { fontSize: moderateScale(9) }]}>
                        <MaterialCommunityIcons name="clock-outline" size={moderateScale(11)} color="#64748B" />
                        {' '}OWN YOUR TIME. CONTROL YOUR SITE.
                    </Text>
                </View>

                {/* ═══ CLOCK IN/OUT CARD ═══ */}
                <View style={[styles.clockCard, SHADOWS.card, { padding: moderateScale(16), borderRadius: moderateScale(16) }]}>
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

                {/* ═══ DAILY QUICK TO-DO ═══ */}
                <View style={[styles.todoSection, { borderRadius: moderateScale(14) }]}>
                    <LinearGradient
                        colors={['#1E3A8A', '#2563EB']}
                        start={{ x: 0, y: 0 }}
                        end={{ x: 1, y: 1 }}
                        style={[styles.todoGradient, { padding: moderateScale(16) }]}
                    >
                        <Text style={[styles.todoTitle, { fontSize: moderateScale(14) }]}>Daily Quick To-Do</Text>
                        <Text style={[styles.todoSubLabel, { fontSize: moderateScale(8) }]}>TASK DESCRIPTION</Text>
                        <View style={styles.todoInputRow}>
                            <TextInput
                                style={[styles.todoInput, { fontSize: moderateScale(12), paddingVertical: moderateScale(10) }]}
                                placeholder="e.g. Pick up supplies, call site manager..."
                                placeholderTextColor="rgba(255,255,255,0.5)"
                                value={todoText}
                                onChangeText={setTodoText}
                                onSubmitEditing={handleAddTodo}
                            />
                            <TouchableOpacity style={[styles.todoAddBtn, { paddingHorizontal: scale(14), paddingVertical: verticalScale(10) }]} onPress={handleAddTodo}>
                                <Text style={[styles.todoAddBtnText, { fontSize: moderateScale(9) }]}>ADD MY TODO</Text>
                            </TouchableOpacity>
                        </View>
                    </LinearGradient>
                </View>

                {/* ═══ MY DAILY TODOS LIST ═══ */}
                <View style={styles.sectionHeaderRow}>
                    <View style={styles.sectionTitleWrap}>
                        <Text style={[styles.sectionTitle, { fontSize: moderateScale(10) }]}>MY DAILY TODOS</Text>
                        <View style={[styles.todoBadge, { width: scale(18), height: scale(18), borderRadius: scale(9) }]}>
                            <Text style={[styles.todoBadgeText, { fontSize: moderateScale(9) }]}>{pendingTodoCount}</Text>
                        </View>
                    </View>
                    <TouchableOpacity onPress={() => setShowTodoFilter(!showTodoFilter)}>
                        <MaterialCommunityIcons name="filter-variant" size={moderateScale(18)} color="#64748B" />
                    </TouchableOpacity>
                </View>

                {showTodoFilter && (
                    <View style={styles.filterRow}>
                        {['all', 'pending', 'completed'].map(f => (
                            <TouchableOpacity
                                key={f}
                                style={[styles.filterChip, todoFilter === f && styles.filterChipActive, { paddingHorizontal: scale(12), paddingVertical: verticalScale(5) }]}
                                onPress={() => { setTodoFilter(f); setShowTodoFilter(false); }}
                            >
                                <Text style={[styles.filterChipText, todoFilter === f && styles.filterChipTextActive, { fontSize: moderateScale(10) }]}>
                                    {f.charAt(0).toUpperCase() + f.slice(1)}
                                </Text>
                            </TouchableOpacity>
                        ))}
                    </View>
                )}

                <View style={[styles.todosContainer, SHADOWS.small, { padding: moderateScale(12), borderRadius: moderateScale(12), marginBottom: hasMoreTodosThanVisible ? 0 : moderateScale(16) }]}>
                    {displayTodos.length === 0 ? (
                        <Text style={[styles.emptyText, { fontSize: moderateScale(12) }]}>No todos yet. Add one above!</Text>
                    ) : visibleTodos.map((todo, idx) => (
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
                                    {todo.description || todo.title || 'Todo'}
                                </Text>
                                {todo.assignedBy && (
                                    <Text style={[styles.todoAssignedBy, { fontSize: moderateScale(9) }]}>
                                        ASSIGNED BY: {resolveUser(todo.assignedBy).fullName}
                                    </Text>
                                )}
                            </View>
                            <TouchableOpacity onPress={() => deleteTodo(todo._id)} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
                                <MaterialCommunityIcons name="close" size={moderateScale(16)} color="#CBD5E1" />
                            </TouchableOpacity>
                        </TouchableOpacity>
                    ))}
                </View>
                {hasMoreTodosThanVisible && displayTodos.length > 0 && (
                    <TouchableOpacity
                        style={styles.viewMoreTodosRow}
                        onPress={() => setTodosExpanded((e) => !e)}
                    >
                        <Text style={[styles.viewMoreTodosText, { fontSize: moderateScale(11) }]}>
                            {todosExpanded ? 'View less' : 'View more'}
                        </Text>
                        <MaterialCommunityIcons
                            name={todosExpanded ? 'chevron-up' : 'chevron-down'}
                            size={moderateScale(18)}
                            color="#2563EB"
                        />
                    </TouchableOpacity>
                )}

                {/* ═══ ASSIGNED TASKS ═══ */}
                <View style={styles.sectionHeaderRow}>
                    <View style={styles.sectionTitleWrap}>
                        <MaterialCommunityIcons name="checkbox-marked-circle" size={moderateScale(18)} color="#16A34A" />
                        <Text style={[styles.sectionTitle, { marginLeft: scale(6), fontSize: moderateScale(10) }]}>Assigned Tasks</Text>
                    </View>
                    <TouchableOpacity onPress={() => navigation.navigate('Jobs')}>
                        <Text style={[styles.viewJobsLink, { fontSize: moderateScale(11) }]}>VIEW JOBS</Text>
                    </TouchableOpacity>
                </View>
                <Text style={[styles.pendingCountText, { fontSize: moderateScale(9) }]}>{pendingTasks.length} PENDING TASKS</Text>

                <View style={[styles.tasksContainer, SHADOWS.small, { borderRadius: moderateScale(12) }]}>
                    {pendingTasks.length === 0 ? (
                        <Text style={[styles.emptyText, { fontSize: moderateScale(12) }]}>No pending tasks assigned.</Text>
                    ) : pendingTasks.map((task, idx) => (
                        <View key={task._id || idx} style={[styles.taskRow, { paddingVertical: verticalScale(10), paddingHorizontal: scale(10) }]}>
                            <View style={{ flex: 1 }}>
                                <View style={styles.taskTitleRow}>
                                    <Text style={[styles.taskTitle, { fontSize: moderateScale(12) }]} numberOfLines={1}>
                                        {task.title}{task.jobName ? ` in ${task.jobName}` : ''}
                                    </Text>
                                    {(task.status || '').toLowerCase() === 'todo' && (
                                        <View style={[styles.globalBadge, { paddingHorizontal: scale(6), paddingVertical: verticalScale(1), borderRadius: moderateScale(4) }]}>
                                            <Text style={[styles.globalBadgeText, { fontSize: moderateScale(8) }]}>Global</Text>
                                        </View>
                                    )}
                                </View>
                                <Text style={[styles.taskSubInfo, { fontSize: moderateScale(10) }]}>
                                    <MaterialCommunityIcons name="briefcase-outline" size={moderateScale(10)} color="#94A3B8" />
                                    {' '}{task.projectName || task.projectId?.name || 'General'}
                                    {'  '}
                                    <MaterialCommunityIcons name="calendar" size={moderateScale(10)} color="#94A3B8" />
                                    {' '}{task.dueDate ? new Date(task.dueDate).toLocaleDateString() : 'No due date'}
                                </Text>
                            </View>
                            <View style={styles.taskActionsRow}>
                                <View style={[styles.taskPriorityPill, {
                                    backgroundColor: (task.priority || '').toLowerCase() === 'high' ? '#FEF2F2' :
                                        (task.priority || '').toLowerCase() === 'medium' ? '#FFF7ED' : '#F8FAFC',
                                    borderColor: (task.priority || '').toLowerCase() === 'high' ? '#FECACA' :
                                        (task.priority || '').toLowerCase() === 'medium' ? '#FED7AA' : '#E2E8F0',
                                    paddingHorizontal: scale(8), paddingVertical: verticalScale(3), borderRadius: moderateScale(8)
                                }]}>
                                    <Text style={[styles.taskPriorityText, {
                                        color: (task.priority || '').toLowerCase() === 'high' ? '#DC2626' :
                                            (task.priority || '').toLowerCase() === 'medium' ? '#EA580C' : '#64748B',
                                        fontSize: moderateScale(8)
                                    }]}>
                                        {(task.priority || 'LOW').toUpperCase()}
                                    </Text>
                                </View>
                            </View>
                        </View>
                    ))}
                </View>

                {/* ═══ MY RECENT ACTIVITY ═══ */}
                <View style={styles.sectionHeaderRow}>
                    <Text style={[styles.sectionTitle, { fontSize: moderateScale(11), fontWeight: '800' }]}>My Recent Activity</Text>
                    <TouchableOpacity style={{ flexDirection: 'row', alignItems: 'center', gap: scale(4) }} onPress={() => navigation.navigate('WorkerLogs')}>
                        <Text style={[styles.viewHistoryLink, { fontSize: moderateScale(10) }]}>VIEW FULL HISTORY</Text>
                        <MaterialCommunityIcons name="arrow-right" size={moderateScale(14)} color="#2563EB" />
                    </TouchableOpacity>
                </View>

                <View style={[styles.activityContainer, SHADOWS.small, { borderRadius: moderateScale(12) }]}>
                    {myRecentActivity.length === 0 ? (
                        <Text style={[styles.emptyText, { fontSize: moderateScale(12) }]}>No recent activity.</Text>
                    ) : myRecentActivity.map((act, idx) => (
                        <View key={act.id || idx} style={[styles.activityRow, { paddingVertical: verticalScale(10), paddingHorizontal: scale(10) }]}>
                            <View style={[styles.activityIconWrap, { width: scale(36), height: scale(36), borderRadius: scale(18) }]}>
                                <MaterialCommunityIcons
                                    name={act.action === 'Clocked Out' || act.type === 'clock_out' ? 'clock-remove-outline' : 'clock-check-outline'}
                                    size={moderateScale(18)}
                                    color="#64748B"
                                />
                            </View>
                            <View style={{ flex: 1, marginLeft: scale(12) }}>
                                <Text style={[styles.activityTitle, { fontSize: moderateScale(13) }]}>
                                    {act.action || (act.type === 'clock_out' ? 'Clocked Out' : 'Clocked In')}
                                </Text>
                                <Text style={[styles.activityJob, { fontSize: moderateScale(11) }]}>
                                    {act.job || act.projectId?.name || 'Project Site'}
                                </Text>
                            </View>
                            <View style={styles.activityTimeWrap}>
                                <Text style={[styles.activityTime, { fontSize: moderateScale(12) }]}>{act.time || '---'}</Text>
                                <Text style={[styles.activityDate, { fontSize: moderateScale(9) }]}>
                                    {act.date || (act.createdAt ? new Date(act.createdAt).toLocaleDateString() : '')}
                                </Text>
                            </View>
                        </View>
                    ))}
                </View>

                <View style={{ height: verticalScale(100) }} />
            </ScrollView>
            </KeyboardAvoidingView>

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
    container: { flex: 1, backgroundColor: COLORS.background },
    scrollView: { flex: 1 },
    scrollContent: { paddingTop: SPACING.s, paddingBottom: 100 },
    dashboardHeader: { marginBottom: SPACING.m, paddingHorizontal: SPACING.m },
    dashTitleRow: { flexDirection: 'row', alignItems: 'center' },
    dashTitle: { ...TYPOGRAPHY.screenTitle, color: COLORS.textPrimary },
    dashSubtitle: { ...TYPOGRAPHY.caption, color: COLORS.textSecondary, letterSpacing: 0.8, marginTop: 2 },
    clockCard: { backgroundColor: COLORS.card, borderRadius: SIZES.radiusCard, padding: SPACING.m, marginBottom: SPACING.m, overflow: 'hidden', borderWidth: 1, borderColor: COLORS.border, ...SHADOWS.card },
    clockStatusRow: { alignItems: 'flex-start', marginBottom: SPACING.xs },
    clockStatusBadge: { flexDirection: 'row', alignItems: 'center', borderRadius: SIZES.radiusBtn, gap: 5 },
    clockStatusDot: { borderRadius: 3 },
    clockStatusText: { ...TYPOGRAPHY.badge },
    timerSection: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: SPACING.s },
    timerText: { fontSize: fontScale(36), fontWeight: '900', color: COLORS.textPrimary, letterSpacing: -1, fontVariant: ['tabular-nums'] },
    clockIconFloat: { opacity: 0.4 },
    siteLabel: { ...TYPOGRAPHY.label, color: COLORS.textMuted, marginBottom: SPACING.xs },
    siteSelector: { backgroundColor: COLORS.surfaceSecondary, borderRadius: SIZES.radiusInput, borderWidth: 1, borderColor: COLORS.border, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: SPACING.sm, marginBottom: SPACING.s },
    siteSelectorText: { ...TYPOGRAPHY.body, fontWeight: '700', color: COLORS.textSecondary, flex: 1 },
    notActiveRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: SPACING.sm },
    notActiveDot: { borderRadius: 4 },
    notActiveText: { ...TYPOGRAPHY.caption, color: COLORS.textMuted },
    clockBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', height: Math.max(verticalScale(52), 48), borderRadius: SIZES.radiusBtn },
    clockBtnText: { color: COLORS.white, fontWeight: '900', letterSpacing: 0.5, ...TYPOGRAPHY.body },
    todoSection: { marginBottom: SPACING.m, borderRadius: SIZES.radiusCard, overflow: 'hidden', padding: SPACING.m, ...SHADOWS.card },
    todoGradient: { },
    todoTitle: { ...TYPOGRAPHY.cardTitle, color: COLORS.white, marginBottom: SPACING.s },
    todoSubLabel: { ...TYPOGRAPHY.label, color: 'rgba(255,255,255,0.6)', marginBottom: SPACING.xs },
    todoInputRow: { flexDirection: 'row', alignItems: 'center', gap: SPACING.s },
    todoInput: { flex: 1, height: 48, backgroundColor: 'rgba(255,255,255,0.15)', borderRadius: SIZES.radiusInput, paddingHorizontal: SPACING.m, color: COLORS.white, fontWeight: '600', borderWidth: 1, borderColor: 'rgba(255,255,255,0.2)' },
    todoAddBtn: { height: 48, backgroundColor: 'rgba(255,255,255,0.2)', borderRadius: SIZES.radiusBtn, borderWidth: 1, borderColor: 'rgba(255,255,255,0.3)', paddingHorizontal: SPACING.m, justifyContent: 'center' },
    todoAddBtnText: { fontWeight: '900', color: COLORS.white, letterSpacing: 0.5, ...TYPOGRAPHY.badge },
    sectionHeaderRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: SPACING.s, paddingHorizontal: SPACING.m },
    sectionTitleWrap: { flexDirection: 'row', alignItems: 'center', gap: 6 },
    sectionTitle: { ...TYPOGRAPHY.label, color: COLORS.textSecondary },
    todoBadge: { backgroundColor: '#2563EB', minWidth: 20, height: 20, borderRadius: 10, justifyContent: 'center', alignItems: 'center', marginLeft: 6 },
    todoBadgeText: { ...TYPOGRAPHY.badge, color: COLORS.white },
    pendingCountText: { ...TYPOGRAPHY.caption, color: COLORS.textMuted, marginBottom: SPACING.s, marginTop: -4, paddingHorizontal: SPACING.m },
    viewJobsLink: { ...TYPOGRAPHY.caption, color: '#2563EB', fontWeight: '900' },
    viewHistoryLink: { ...TYPOGRAPHY.caption, color: '#2563EB', fontWeight: '900' },
    filterRow: { flexDirection: 'row', gap: SPACING.s, marginBottom: SPACING.s, paddingHorizontal: SPACING.m },
    filterChip: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: SIZES.radiusCard, backgroundColor: COLORS.surfaceSecondary, borderWidth: 1, borderColor: COLORS.border },
    filterChipActive: { backgroundColor: '#2563EB', borderColor: '#2563EB' },
    filterChipText: { ...TYPOGRAPHY.badge, color: COLORS.textSecondary },
    filterChipTextActive: { color: COLORS.white },
    viewMoreTodosRow: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 4,
        marginTop: 4,
        marginBottom: SPACING.m,
        paddingVertical: 8,
    },
    viewMoreTodosText: { ...TYPOGRAPHY.caption, color: '#2563EB', fontWeight: '900' },
    todosContainer: { backgroundColor: COLORS.card, borderRadius: SIZES.radiusCard, overflow: 'hidden', borderWidth: 1, borderColor: COLORS.border, marginHorizontal: SPACING.m, marginBottom: SPACING.m, ...SHADOWS.card },
    todoRow: { flexDirection: 'row', alignItems: 'center', padding: SPACING.m, borderBottomWidth: 1, borderBottomColor: COLORS.surfaceSecondary },
    todoCheckbox: { width: 22, height: 22, borderRadius: 6, borderWidth: 2, borderColor: COLORS.border, justifyContent: 'center', alignItems: 'center', marginRight: SPACING.sm },
    todoChecked: { backgroundColor: '#2563EB', borderColor: '#2563EB' },
    todoItemText: { ...TYPOGRAPHY.body, color: COLORS.textPrimary },
    todoItemDone: { textDecorationLine: 'line-through', color: COLORS.textMuted },
    todoAssignedBy: { ...TYPOGRAPHY.badge, color: '#2563EB', marginTop: 2 },
    tasksContainer: { backgroundColor: COLORS.card, borderRadius: SIZES.radiusCard, padding: SPACING.s, marginHorizontal: SPACING.m, marginBottom: SPACING.m, borderWidth: 1, borderColor: COLORS.border, ...SHADOWS.card },
    taskRow: { flexDirection: 'row', alignItems: 'center', padding: SPACING.m, borderBottomWidth: 1, borderBottomColor: COLORS.surfaceSecondary },
    taskTitleRow: { flexDirection: 'row', alignItems: 'center', gap: 6, flexWrap: 'wrap' },
    taskTitle: { ...TYPOGRAPHY.body, color: COLORS.textPrimary, fontWeight: '700', flexShrink: 1 },
    globalBadge: { backgroundColor: '#DBEAFE', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4 },
    globalBadgeText: { ...TYPOGRAPHY.badge, color: '#2563EB' },
    taskSubInfo: { ...TYPOGRAPHY.caption, color: COLORS.textMuted, marginTop: 2 },
    taskActionsRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginLeft: 8 },
    taskPriorityPill: { borderWidth: 1, paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4 },
    taskPriorityText: { ...TYPOGRAPHY.badge },
    activityContainer: { backgroundColor: COLORS.card, borderRadius: SIZES.radiusCard, padding: SPACING.s, marginHorizontal: SPACING.m, marginBottom: SPACING.m, borderWidth: 1, borderColor: COLORS.border, ...SHADOWS.card },
    activityRow: { flexDirection: 'row', alignItems: 'center', padding: SPACING.m, borderBottomWidth: 1, borderBottomColor: COLORS.surfaceSecondary },
    activityIconWrap: { width: 36, height: 36, borderRadius: 18, backgroundColor: COLORS.surfaceSecondary, justifyContent: 'center', alignItems: 'center', marginRight: SPACING.sm },
    activityTitle: { ...TYPOGRAPHY.body, color: COLORS.textPrimary, fontWeight: '700' },
    activityJob: { ...TYPOGRAPHY.caption, color: COLORS.textMuted, marginTop: 1 },
    activityTimeWrap: { alignItems: 'flex-end', flex: 1 },
    activityTime: { ...TYPOGRAPHY.body, color: COLORS.textPrimary, fontWeight: '800' },
    activityDate: { ...TYPOGRAPHY.badge, color: '#2563EB', marginTop: 1 },
    emptyText: { textAlign: 'center', color: COLORS.textMuted, ...TYPOGRAPHY.body, paddingVertical: SPACING.xl },
    modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', padding: SPACING.m },
    modalContent: { backgroundColor: COLORS.card, borderRadius: SIZES.radiusModal, padding: SPACING.m, maxHeight: '70%' },
    modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingBottom: SPACING.sm, borderBottomWidth: 1, borderBottomColor: COLORS.border },
    modalTitle: { ...TYPOGRAPHY.cardTitle, color: COLORS.textPrimary },
    projectItem: { flexDirection: 'row', alignItems: 'center', padding: SPACING.sm, borderBottomWidth: 1, borderBottomColor: COLORS.surfaceSecondary },
    projectItemSelected: { backgroundColor: '#EFF6FF', borderRadius: SIZES.radiusCard },
    projectDot: { },
    projectName: { ...TYPOGRAPHY.body, color: COLORS.textPrimary, fontWeight: '700' },
    projectLocation: { ...TYPOGRAPHY.caption, color: COLORS.textMuted, marginTop: 2 },
    modalSectionLabel: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 4, borderBottomWidth: 1, borderBottomColor: COLORS.border, marginTop: SPACING.sm },
    modalSectionText: { ...TYPOGRAPHY.label, color: COLORS.textMuted },
});

export default WorkerDashboardScreen;

