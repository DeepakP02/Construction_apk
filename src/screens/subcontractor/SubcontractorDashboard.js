import React, { useState } from 'react';
import {
    View, Text, StyleSheet, TouchableOpacity, Dimensions,
    FlatList, ActivityIndicator, TextInput, Modal, Alert
} from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { SHADOWS } from '../../constants/theme';
import { useApp } from '../../context/AppContext';

const { width } = Dimensions.get('window');

/** Supports /reports/stats rows (`action`, `job`, `time`, `date`) and optimistic/socket rows (`type`, `projectId`, `createdAt`). */
function normalizeActivityRow(act, index) {
    const actionStr = String(act.action || '').toLowerCase();
    const typeStr = String(act.type || '').toLowerCase();
    const isClockOut =
        typeStr === 'clock_out' ||
        (actionStr.includes('clock') && actionStr.includes('out'));
    const title =
        act.action ||
        (isClockOut ? 'Clocked Out' : 'Clocked In');
    const sub =
        act.projectId?.name ||
        act.job ||
        act.target ||
        '---';
    let timeLine = act.time;
    if (!timeLine && act.createdAt) {
        const d = new Date(act.createdAt);
        if (!Number.isNaN(d.getTime())) {
            timeLine = d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
        }
    }
    if (!timeLine) timeLine = '---';
    let dateLine = act.date;
    if (!dateLine && act.createdAt) {
        const d = new Date(act.createdAt);
        if (!Number.isNaN(d.getTime())) dateLine = d.toLocaleDateString();
    }
    if (!dateLine) dateLine = '';
    const key = act.id || act._id || `act-${index}`;
    return { isClockOut, title, sub, timeLine, dateLine, key };
}

const SubcontractorDashboard = ({
    navigation,
    timer,
    isClockedIn,
    isClocking,
    handleClockToggle,
    setClockModal,
    selectedAssignment
}) => {
    const {
        user, metrics,
        teamMembers, todos, addTodo, toggleTodo, deleteTodo,
        tasks, activities
    } = useApp();

    const [todoTitle, setTodoTitle] = useState('');
    const [selectedUser, setSelectedUser] = useState(null);
    const [showUserModal, setShowUserModal] = useState(false);
    const [submittingTodo, setSubmittingTodo] = useState(false);
    const [userSearch, setUserSearch] = useState('');

    // ── Metrics ─────────────────────────────────────────────────
    const workerStats = metrics?.workerMetrics || {
        myHoursToday: '0.0h',
        currentJob: '---',
        weeklyTarget: '40h',
        weeklyDone: '0h done'
    };

    // ── Task calculations ────────────────────────────────────────
    const myTasks = (tasks || []).filter(t => {
        return (Array.isArray(t.assignedTo) && t.assignedTo.some(a => (a._id || a) === user?._id)) ||
            t.assignedTo === user?._id || t.assignedTo === user?.fullName;
    });
    const pendingTasks = myTasks.filter(t => t.status !== 'completed');
    const overdueTasks = pendingTasks.filter(t => t.dueDate && new Date(t.dueDate) < new Date());

    // ── Todo split ───────────────────────────────────────────────
    const myTodos = (todos || []).filter(t => (t.assignedTo?._id || t.assignedTo) === user?._id);
    const assignedByMe = (todos || []).filter(t =>
        (t.createdBy?._id || t.createdBy) === user?._id &&
        (t.assignedTo?._id || t.assignedTo) !== user?._id
    );

    return (
        <View style={styles.container}>

            {/* ── Page Header ─────────────────────────────────── */}
            <View style={styles.pageHeader}>
                <Text style={styles.pageTitle}>Dashboard</Text>
                <Text style={styles.pageSubtitle}>OWN YOUR TIME. CONTROL YOUR SITE.</Text>
            </View>

            {/* ── Clock Banner ────────────────────────────────── */}
            <View style={[styles.clockCard, SHADOWS.medium]}>
                <View style={styles.clockTop}>
                    <View style={styles.statusBadge}>
                        <View style={[styles.statusDot, { backgroundColor: isClockedIn ? '#10B981' : '#64748B' }]} />
                        <Text style={styles.statusText}>{isClockedIn ? 'ON SITE SESSION' : 'READY TO START'}</Text>
                    </View>
                    <Text style={styles.timerLarge}>{isClockedIn ? timer : '00:00:00'}</Text>
                    <Text style={styles.timerSub}>{isClockedIn ? 'Session Recording' : 'Not Active'}</Text>
                </View>
                {!isClockedIn && (
                    <>
                        <Text style={[styles.inputLabel, { marginTop: 12 }]}>SELECT SITE FOR CLOCK IN</Text>
                        <TouchableOpacity
                            style={styles.selectorBtn}
                            onPress={() => setClockModal(true)}
                            activeOpacity={0.7}
                        >
                            <Text style={[styles.selectorTxt, !selectedAssignment && { color: '#94A3B8' }]} numberOfLines={1}>
                                {selectedAssignment?.displayName || '-- Choose Task / Project --'}
                            </Text>
                            <MaterialCommunityIcons name="chevron-down" size={20} color="#64748B" />
                        </TouchableOpacity>
                    </>
                )}
                <TouchableOpacity
                    style={[styles.clockBtn, { backgroundColor: isClockedIn ? '#475569' : '#0F172A' }, isClocking && { opacity: 0.7 }]}
                    onPress={() => (!isClockedIn ? handleClockToggle(selectedAssignment) : handleClockToggle(null))}
                    disabled={isClocking}
                >
                    {isClocking ? (
                        <ActivityIndicator color="#fff" size="small" />
                    ) : (
                        <Text style={styles.clockBtnTxt}>{isClockedIn ? 'END CLOCK SESSION' : 'START CLOCK IN'}</Text>
                    )}
                </TouchableOpacity>
            </View>

            {/* ── Three Metric Cards ───────────────────────────── */}
            <View style={styles.metricsRow}>
                <View style={[styles.metricBox, SHADOWS.small]}>
                    <View style={[styles.metricIcon, { backgroundColor: '#FFF7ED' }]}>
                        <MaterialCommunityIcons name="clock-outline" size={16} color="#EA580C" />
                    </View>
                    <Text style={styles.metricVal}>{workerStats.myHoursToday}</Text>
                    <Text style={styles.metricLab}>My Hours Today</Text>
                </View>
                <View style={[styles.metricBox, SHADOWS.small]}>
                    <View style={[styles.metricIcon, { backgroundColor: '#EFF6FF' }]}>
                        <MaterialCommunityIcons name="office-building-marker" size={16} color="#2563EB" />
                    </View>
                    <Text style={styles.metricVal} numberOfLines={1}>
                        {isClockedIn ? (workerStats.currentJob || 'Active') : 'Not Clocked In'}
                    </Text>
                    <Text style={styles.metricLab}>Current Job</Text>
                </View>
                <View style={[styles.metricBox, SHADOWS.small]}>
                    <View style={[styles.metricIcon, { backgroundColor: '#ECFDF5' }]}>
                        <MaterialCommunityIcons name="target" size={16} color="#10B981" />
                    </View>
                    <Text style={styles.metricVal}>{workerStats.weeklyTarget}</Text>
                    <Text style={styles.metricLab}>{workerStats.weeklyDone} done</Text>
                </View>
            </View>

            {/* ── Quick Actions ─────────────────────────────────── */}
            <Text style={styles.sectionTitle}>Quick Actions</Text>
            <View style={styles.actionsRow}>
                <TouchableOpacity
                    style={[styles.actionPrimary, SHADOWS.small, isClocking && { opacity: 0.7 }]}
                    onPress={() => !isClockedIn ? setClockModal(true) : handleClockToggle(null)}
                    disabled={isClocking}
                >
                    {isClocking ? (
                        <ActivityIndicator color="#fff" size="small" />
                    ) : (
                        <>
                            <MaterialCommunityIcons name="clock-check" size={18} color="#fff" />
                            <Text style={styles.actionPrimaryTxt}>Start Clock In</Text>
                        </>
                    )}
                </TouchableOpacity>
                <TouchableOpacity
                    style={[styles.actionSecondary, SHADOWS.small]}
                    onPress={() => navigation.navigate('Photos')}
                >
                    <MaterialCommunityIcons name="camera-plus" size={18} color="#0F172A" />
                    <Text style={styles.actionSecondaryTxt}>Upload Photo</Text>
                </TouchableOpacity>
            </View>

            {/* ── Daily Quick To-Do ─────────────────────────────── */}
            <View style={[styles.card, SHADOWS.small]}>
                <View style={styles.cardTitleRow}>
                    <MaterialCommunityIcons name="playlist-check" size={20} color="#0F172A" />
                    <Text style={styles.cardTitle}>Daily Quick To-Do</Text>
                </View>

                <Text style={styles.inputLabel}>Task Description</Text>
                <TextInput
                    style={styles.textInput}
                    placeholder="e.g. Pick up supplies, call site manager..."
                    placeholderTextColor="#94A3B8"
                    value={todoTitle}
                    onChangeText={setTodoTitle}
                />

                <Text style={styles.inputLabel}>Assign To User</Text>
                <TouchableOpacity style={styles.selectorBtn} onPress={() => setShowUserModal(true)}>
                    <Text style={[styles.selectorTxt, !selectedUser && { color: '#94A3B8' }]}>
                        {selectedUser ? selectedUser.fullName : 'Search user...'}
                    </Text>
                    <MaterialCommunityIcons name="account-search" size={20} color="#64748B" />
                </TouchableOpacity>

                <TouchableOpacity
                    style={[styles.submitBtn, (!todoTitle.trim() || submittingTodo) && { opacity: 0.5 }]}
                    disabled={!todoTitle.trim() || submittingTodo}
                    onPress={async () => {
                        setSubmittingTodo(true);
                        await addTodo({ title: todoTitle, assignedTo: selectedUser?._id || user?._id });
                        setTodoTitle('');
                        setSelectedUser(null);
                        setSubmittingTodo(false);
                    }}
                >
                    {submittingTodo
                        ? <ActivityIndicator size="small" color="#fff" />
                        : <Text style={styles.submitBtnTxt}>Assign Item</Text>}
                </TouchableOpacity>

                {/* My Todos list */}
                <View style={styles.todoSection}>
                    <View style={styles.todoSectionHeader}>
                        <Text style={styles.todoSectionTitle}>My Daily Todos</Text>
                        <View style={styles.countBadge}><Text style={styles.countBadgeTxt}>{myTodos.filter(t => t.status !== 'completed').length}</Text></View>
                    </View>
                    {myTodos.length === 0
                        ? <Text style={styles.emptyNote}>No pending todos</Text>
                        : myTodos.slice(0, 4).map(t => (
                            <TouchableOpacity key={t._id} style={styles.todoRow} onPress={() => toggleTodo(t._id)}>
                                <MaterialCommunityIcons
                                    name={t.status === 'completed' ? 'checkbox-marked-circle' : 'checkbox-blank-circle-outline'}
                                    size={20}
                                    color={t.status === 'completed' ? '#10B981' : '#CBD5E1'}
                                />
                                <Text style={[styles.todoTxt, t.status === 'completed' && styles.strikethrough]}>{t.title}</Text>
                            </TouchableOpacity>
                        ))}

                    <View style={styles.todoDivider} />

                    <View style={styles.todoSectionHeader}>
                        <Text style={styles.todoSectionTitle}>Assigned By Me</Text>
                        <View style={styles.countBadge}><Text style={styles.countBadgeTxt}>{assignedByMe.length}</Text></View>
                    </View>
                    {assignedByMe.length === 0
                        ? <Text style={styles.emptyNote}>No pending todos</Text>
                        : assignedByMe.slice(0, 3).map(t => (
                            <View key={t._id} style={styles.todoRow}>
                                <MaterialCommunityIcons name="account-arrow-right" size={16} color="#64748B" />
                                <Text style={styles.todoTxt}>{t.title}</Text>
                            </View>
                        ))}
                </View>
            </View>

            {/* ── Assigned Tasks ───────────────────────────────── */}
            <View style={[styles.tasksCard, SHADOWS.medium]}>
                <View style={styles.tasksHeadRow}>
                    <View>
                        <Text style={styles.tasksCardTitle}>Assigned Tasks</Text>
                        <Text style={styles.tasksCardSub}>{pendingTasks.length} Pending Tasks</Text>
                    </View>
                    <TouchableOpacity onPress={() => navigation.navigate('Projects')}>
                        <Text style={styles.linkTxt}>VIEW PROJECTS</Text>
                    </TouchableOpacity>
                </View>

                {pendingTasks.length === 0 ? (
                    <View style={styles.emptyBlock}>
                        <MaterialCommunityIcons name="clipboard-check-outline" size={36} color="#E2E8F0" />
                        <Text style={styles.emptyBlockTxt}>No pending tasks assigned.</Text>
                    </View>
                ) : pendingTasks.slice(0, 3).map(task => (
                    <View key={task._id} style={styles.taskRow}>
                        <View style={styles.taskIconBox}>
                            <MaterialCommunityIcons name="clock-alert-outline" size={20} color="#EF4444" />
                        </View>
                        <View style={styles.taskContent}>
                            <View style={styles.taskTopRow}>
                                <Text style={styles.taskName}>{task.title}</Text>
                                <View style={[styles.priorityTag, { backgroundColor: task.priority === 'High' ? '#FEE2E2' : '#F1F5F9' }]}>
                                    <Text style={[styles.priorityTagTxt, { color: task.priority === 'High' ? '#EF4444' : '#64748B' }]}>{task.priority}</Text>
                                </View>
                            </View>
                            <Text style={styles.taskProject}>{task.projectId?.name || 'Main Site'}</Text>
                            <View style={styles.taskBottomRow}>
                                <Text style={styles.taskDate}>{task.dueDate ? new Date(task.dueDate).toLocaleDateString() : 'No date'}</Text>
                                {task.dueDate && new Date(task.dueDate) < new Date() && (
                                    <Text style={styles.overdueLabel}>Overdue</Text>
                                )}
                            </View>
                        </View>
                    </View>
                ))}
            </View>

            {/* ── Recent Activity ──────────────────────────────── */}
            <View style={[styles.card, { padding: 20 }, SHADOWS.small]}>
                <View style={styles.sectionHeadRow}>
                    <Text style={styles.cardTitle}>My Recent Activity</Text>
                    <TouchableOpacity onPress={() => navigation.navigate('RFI')}>
                        <Text style={styles.linkTxt}>VIEW FULL HISTORY</Text>
                    </TouchableOpacity>
                </View>
                {(!activities || activities.length === 0) ? (
                    <Text style={[styles.emptyNote, { textAlign: 'center', paddingVertical: 20 }]}>No recent activity</Text>
                ) : activities.slice(0, 4).map((act, i) => {
                    const row = normalizeActivityRow(act, i);
                    return (
                    <View key={row.key} style={styles.actRow}>
                        <View style={[styles.actIcon, { backgroundColor: row.isClockOut ? '#FFF1F2' : '#F0FDF4' }]}>
                            <MaterialCommunityIcons
                                name={row.isClockOut ? 'clock-minus' : 'clock-plus'}
                                size={16}
                                color={row.isClockOut ? '#E11D48' : '#16A34A'}
                            />
                        </View>
                        <View style={styles.actMid}>
                            <Text style={styles.actTitle}>{row.title}</Text>
                            <Text style={styles.actSub}>{row.sub}</Text>
                        </View>
                        <View style={styles.actRight}>
                            <Text style={styles.actTime}>{row.timeLine}</Text>
                            {!!row.dateLine && <Text style={styles.actDate}>{row.dateLine}</Text>}
                        </View>
                    </View>
                    );
                })}
            </View>

            {/* ── Attention & Alerts ───────────────────────────── */}
            <View style={[styles.alertsCard, SHADOWS.small]}>
                <Text style={styles.alertsTitle}>Attention &amp; Alerts</Text>
                <View style={styles.alertStack}>
                    <TouchableOpacity
                        style={[styles.alertBar, { backgroundColor: '#EF4444' }]}
                        onPress={() => navigation.navigate('Tasks')}
                    >
                        <View style={styles.alertNumBox}>
                            <Text style={styles.alertNum}>{overdueTasks.length}</Text>
                        </View>
                        <Text style={styles.alertLbl}>OVERDUE TASKS</Text>
                        <MaterialCommunityIcons name="chevron-right" size={20} color="rgba(255,255,255,0.8)" />
                    </TouchableOpacity>
                </View>
            </View>

            {/* ── User Selection Modal ─────────────────────────── */}
            <Modal visible={showUserModal} transparent animationType="slide">
                <View style={styles.modalBg}>
                    <View style={styles.modalBox}>
                        <View style={styles.modalHead}>
                            <Text style={styles.modalHeadTxt}>Assign To User</Text>
                            <TouchableOpacity onPress={() => { setShowUserModal(false); setUserSearch(''); }}>
                                <MaterialCommunityIcons name="close" size={24} color="#64748B" />
                            </TouchableOpacity>
                        </View>
                        <TextInput
                            style={styles.modalSearch}
                            placeholder="Search user..."
                            value={userSearch}
                            onChangeText={setUserSearch}
                            placeholderTextColor="#94A3B8"
                        />
                        <FlatList
                            data={(teamMembers || []).filter(m => m.fullName?.toLowerCase().includes(userSearch.toLowerCase()))}
                            keyExtractor={item => item._id}
                            style={{ maxHeight: 300 }}
                            renderItem={({ item }) => (
                                <TouchableOpacity
                                    style={styles.userPickRow}
                                    onPress={() => { setSelectedUser(item); setShowUserModal(false); setUserSearch(''); }}
                                >
                                    <View style={styles.userPickAvatar}>
                                        <Text style={styles.userPickAvatarTxt}>{item.fullName?.charAt(0)}</Text>
                                    </View>
                                    <View>
                                        <Text style={styles.userPickName}>{item.fullName}</Text>
                                        <Text style={styles.userPickRole}>{item.role}</Text>
                                    </View>
                                    {selectedUser?._id === item._id && (
                                        <MaterialCommunityIcons name="check-circle" size={18} color="#2563EB" style={{ marginLeft: 'auto' }} />
                                    )}
                                </TouchableOpacity>
                            )}
                            ListEmptyComponent={<Text style={[styles.emptyNote, { textAlign: 'center', padding: 20 }]}>No users found</Text>}
                        />
                    </View>
                </View>
            </Modal>
        </View>
    );
};

const styles = StyleSheet.create({
    container: { flex: 1 },

    // Header
    pageHeader: { marginBottom: 20 },
    pageTitle: { fontSize: 28, fontWeight: '900', color: '#0F172A', letterSpacing: -0.8 },
    pageSubtitle: { fontSize: 9, fontWeight: '800', color: '#2563EB', letterSpacing: 1.5, marginTop: 3 },

    // Clock card
    clockCard: { backgroundColor: '#fff', borderRadius: 28, padding: 22, alignItems: 'center', borderWidth: 1, borderColor: '#F1F5F9', marginBottom: 20 },
    clockTop: { alignItems: 'center', marginBottom: 16 },
    statusBadge: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: '#F1F5F9', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 20, marginBottom: 8 },
    statusDot: { width: 6, height: 6, borderRadius: 3 },
    statusText: { fontSize: 8, fontWeight: '900', color: '#64748B', letterSpacing: 1 },
    timerLarge: { fontSize: 44, fontWeight: '900', color: '#0F172A', letterSpacing: -1.5 },
    timerSub: { fontSize: 11, fontWeight: '700', color: '#94A3B8', marginTop: 2 },
    clockBtn: { width: '100%', height: 48, borderRadius: 14, justifyContent: 'center', alignItems: 'center' },
    clockBtnTxt: { color: '#fff', fontSize: 12, fontWeight: '900', letterSpacing: 0.8 },

    // Metrics
    metricsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 28 },
    metricBox: { width: '31.5%', minWidth: 100, backgroundColor: '#fff', padding: 12, borderRadius: 20, borderWidth: 1, borderColor: '#F1F5F9', alignItems: 'center' },
    metricIcon: { width: 32, height: 32, borderRadius: 10, justifyContent: 'center', alignItems: 'center', marginBottom: 6 },
    metricVal: { fontSize: 13, fontWeight: '900', color: '#0F172A', textAlign: 'center' },
    metricLab: { fontSize: 8, fontWeight: '700', color: '#94A3B8', textAlign: 'center', marginTop: 2 },

    // Actions
    sectionTitle: { fontSize: 12, fontWeight: '900', color: '#0F172A', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 12 },
    actionsRow: { flexDirection: 'row', gap: 10, marginBottom: 28 },
    actionPrimary: { flex: 1.2, height: 52, backgroundColor: '#FF6B00', borderRadius: 14, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 },
    actionPrimaryTxt: { color: '#fff', fontSize: 13, fontWeight: '900' },
    actionSecondary: { flex: 1, height: 52, backgroundColor: '#fff', borderRadius: 14, borderWidth: 1, borderColor: '#E2E8F0', flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 },
    actionSecondaryTxt: { color: '#0F172A', fontSize: 13, fontWeight: '900' },

    // Standard card
    card: { backgroundColor: '#fff', borderRadius: 22, padding: 18, marginBottom: 20, borderWidth: 1, borderColor: '#F1F5F9' },
    cardTitleRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 16 },
    cardTitle: { fontSize: 16, fontWeight: '900', color: '#0F172A' },
    sectionHeadRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 },
    linkTxt: { fontSize: 11, fontWeight: '900', color: '#2563EB', letterSpacing: 0.5 },

    // Inputs/To-do form
    inputLabel: { fontSize: 11, fontWeight: '800', color: '#64748B', marginBottom: 6 },
    textInput: { backgroundColor: '#F8FAFC', padding: 12, borderRadius: 12, borderWidth: 1, borderColor: '#E2E8F0', fontSize: 13, fontWeight: '600', color: '#0F172A', marginBottom: 12 },
    selectorBtn: { backgroundColor: '#F8FAFC', padding: 12, borderRadius: 12, borderWidth: 1, borderColor: '#E2E8F0', flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
    selectorTxt: { fontSize: 13, fontWeight: '600', color: '#0F172A' },
    submitBtn: { backgroundColor: '#0F172A', padding: 14, borderRadius: 14, alignItems: 'center', marginBottom: 4 },
    submitBtnTxt: { color: '#fff', fontSize: 14, fontWeight: '900' },

    // Todo lists
    todoSection: { marginTop: 16, paddingTop: 16, borderTopWidth: 1, borderTopColor: '#F1F5F9' },
    todoSectionHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 },
    todoSectionTitle: { fontSize: 13, fontWeight: '800', color: '#64748B' },
    countBadge: { backgroundColor: '#EFF6FF', paddingHorizontal: 8, paddingVertical: 2, borderRadius: 8 },
    countBadgeTxt: { fontSize: 11, fontWeight: '900', color: '#2563EB' },
    todoRow: { flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: '#F8FAFC', padding: 10, borderRadius: 10, marginBottom: 6 },
    todoTxt: { fontSize: 13, fontWeight: '700', color: '#334155' },
    strikethrough: { textDecorationLine: 'line-through', opacity: 0.5 },
    todoDivider: { height: 1, backgroundColor: '#F1F5F9', marginVertical: 14 },
    emptyNote: { fontSize: 12, color: '#94A3B8', fontStyle: 'italic' },

    // Tasks card
    tasksCard: { backgroundColor: '#fff', borderRadius: 28, padding: 22, marginBottom: 20, borderWidth: 1, borderColor: '#F1F5F9' },
    tasksHeadRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 20 },
    tasksCardTitle: { fontSize: 20, fontWeight: '900', color: '#0F172A' },
    tasksCardSub: { fontSize: 10, fontWeight: '800', color: '#94A3B8', marginTop: 2, textTransform: 'uppercase' },
    taskRow: { flexDirection: 'row', gap: 14, marginBottom: 16, paddingBottom: 16, borderBottomWidth: 1, borderBottomColor: '#F8FAFC' },
    taskIconBox: { width: 40, height: 40, borderRadius: 12, backgroundColor: '#FEF2F2', justifyContent: 'center', alignItems: 'center' },
    taskContent: { flex: 1, gap: 3 },
    taskTopRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
    taskName: { fontSize: 14, fontWeight: '800', color: '#1E293B', flex: 1 },
    priorityTag: { paddingHorizontal: 7, paddingVertical: 2, borderRadius: 7 },
    priorityTagTxt: { fontSize: 9, fontWeight: '900' },
    taskProject: { fontSize: 12, color: '#64748B', fontWeight: '600' },
    taskBottomRow: { flexDirection: 'row', gap: 10, alignItems: 'center', marginTop: 2 },
    taskDate: { fontSize: 11, fontWeight: '700', color: '#94A3B8' },
    overdueLabel: { fontSize: 10, fontWeight: '900', color: '#EF4444' },
    emptyBlock: { alignItems: 'center', paddingVertical: 30, gap: 8 },
    emptyBlockTxt: { fontSize: 13, color: '#94A3B8', fontWeight: '700' },

    // Activity
    actRow: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: '#F8FAFC' },
    actIcon: { width: 36, height: 36, borderRadius: 11, justifyContent: 'center', alignItems: 'center' },
    actMid: { flex: 1 },
    actTitle: { fontSize: 13, fontWeight: '800', color: '#1E293B' },
    actSub: { fontSize: 11, color: '#94A3B8', fontWeight: '600', marginTop: 2 },
    actRight: { alignItems: 'flex-end' },
    actTime: { fontSize: 12, fontWeight: '900', color: '#0F172A' },
    actDate: { fontSize: 10, fontWeight: '700', color: '#94A3B8' },

    // Alerts
    alertsCard: { backgroundColor: '#fff', borderRadius: 22, padding: 22, marginBottom: 24, borderWidth: 1, borderColor: '#F1F5F9' },
    alertsTitle: { fontSize: 20, fontWeight: '900', color: '#0F172A', marginBottom: 16 },
    alertStack: { gap: 10 },
    alertBar: { height: 56, borderRadius: 16, flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, gap: 12 },
    alertNumBox: { width: 30, height: 30, borderRadius: 8, backgroundColor: 'rgba(255,255,255,0.25)', justifyContent: 'center', alignItems: 'center' },
    alertNum: { color: '#fff', fontSize: 14, fontWeight: '900' },
    alertLbl: { flex: 1, color: '#fff', fontSize: 12, fontWeight: '900', letterSpacing: 0.5 },

    // Modal
    modalBg: { flex: 1, backgroundColor: 'rgba(15,23,42,0.6)', justifyContent: 'flex-end' },
    modalBox: { backgroundColor: '#fff', borderTopLeftRadius: 28, borderTopRightRadius: 28, padding: 24, maxHeight: '70%' },
    modalHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 },
    modalHeadTxt: { fontSize: 18, fontWeight: '900', color: '#0F172A' },
    modalSearch: { backgroundColor: '#F8FAFC', padding: 12, borderRadius: 12, borderWidth: 1, borderColor: '#E2E8F0', marginBottom: 12, fontSize: 14, fontWeight: '600' },
    userPickRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: '#F1F5F9', gap: 12 },
    userPickAvatar: { width: 36, height: 36, borderRadius: 10, backgroundColor: '#EFF6FF', justifyContent: 'center', alignItems: 'center' },
    userPickAvatarTxt: { fontWeight: '900', color: '#2563EB', fontSize: 15 },
    userPickName: { fontSize: 14, fontWeight: '800', color: '#1E293B' },
    userPickRole: { fontSize: 11, color: '#94A3B8', fontWeight: '600' },
});

export default SubcontractorDashboard;
