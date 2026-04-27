import React, { useCallback, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Dimensions, ScrollView, ActivityIndicator, StatusBar, RefreshControl, useWindowDimensions } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { COLORS, SHADOWS, SPACING } from '../../constants/theme';
import { useApp } from '../../context/AppContext';
import WorkerHeader from '../../components/WorkerHeader';
import { scale, verticalScale, moderateScale, isTablet } from '../../utils/responsive';
import { isTodoVisibleToUser } from '../../utils/todoVisibility';

const ForemanDashboard = ({ navigation }) => {
    const { user, tasks, metrics, refreshData, loading, todos, resolveUser, selectedProject, toggleTodo, deleteTodo, addTodo } = useApp();
    const { width, height } = useWindowDimensions();
    const [refreshing, setRefreshing] = useState(false);

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

    const pendingTasks = (tasks || []).filter(t => {
        if (t.status === 'completed') return false;
        
        // Filter by selected project
        if (selectedProject && (t.projectId?._id || t.projectId) !== (selectedProject._id || selectedProject.id)) return false;

        const assigned = Array.isArray(t.assignedTo) ? t.assignedTo : [t.assignedTo];
        const isAssignedToMe = assigned.some(a => {
            const aId = typeof a === 'object' ? (a._id || a.id) : a;
            return aId === user?._id;
        });

        // For Foreman, also show tasks on their projects even if not directly assigned?
        // Actually, let's stick to assigned tasks for clarity on the dashboard, or show all in project.
        return isAssignedToMe;
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

                <Text style={[styles.sectionTitle, { fontSize: moderateScale(10), marginBottom: verticalScale(10) }]}>SITE ACTIVITY</Text>
                <View style={[styles.activityCard, { borderRadius: moderateScale(20), padding: scale(4), marginBottom: verticalScale(20) }]}>
                    <View style={[styles.activityRow, { padding: moderateScale(12), gap: scale(10) }]}>
                        <MaterialCommunityIcons name="calendar-multiselect" size={moderateScale(20)} color="#64748B" />
                        <Text style={[styles.activityText, { fontSize: moderateScale(13) }]}>Daily Site Log: {metrics?.metrics?.logsSubmittedToday > 0 ? 'Submitted' : 'Pending'}</Text>
                        <MaterialCommunityIcons 
                            name={metrics?.metrics?.logsSubmittedToday > 0 ? "check-circle" : "alert-circle-outline"} 
                            size={moderateScale(18)} 
                            color={metrics?.metrics?.logsSubmittedToday > 0 ? "#10B981" : "#F59E0B"} 
                        />
                    </View>
                    <View style={[styles.activityRow, { padding: moderateScale(12), gap: scale(10) }]}>
                        <MaterialCommunityIcons name="camera-outline" size={moderateScale(20)} color="#64748B" />
                        <Text style={[styles.activityText, { fontSize: moderateScale(13) }]}>Photos Uploaded Today: {metrics?.metrics?.photosUploadedToday || 0}</Text>
                        <MaterialCommunityIcons name="arrow-right" size={moderateScale(18)} color="#CBD5E1" />
                    </View>
                </View>
                
                <View style={{ height: verticalScale(40) }} />
            </ScrollView>
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
    activityCard: { backgroundColor: '#fff', borderWidth: 1, borderColor: '#F1F5F9' },
    activityRow: { flexDirection: 'row', alignItems: 'center' },
    activityText: { fontWeight: '800', color: '#475569', flex: 1 },
    todoRow: { flexDirection: 'row', alignItems: 'center', borderBottomWidth: 1, borderBottomColor: '#F8FAFC' },
    todoCheckbox: { borderWidth: 2, borderColor: '#E2E8F0', borderRadius: 6, justifyContent: 'center', alignItems: 'center' },
    todoChecked: { backgroundColor: '#6366F1', borderColor: '#6366F1' },
    todoItemText: { fontWeight: '700', color: '#334155' },
    todoItemDone: { textDecorationLine: 'line-through', color: '#94A3B8' },
    todoAssignedBy: { marginTop: 2, textTransform: 'uppercase' },
});

export default ForemanDashboard;
