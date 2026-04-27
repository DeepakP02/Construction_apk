import React, { useState, useEffect, useRef } from 'react';
import { 
    View, Text, StyleSheet, FlatList, TouchableOpacity, 
    TextInput, Animated, ActivityIndicator, Dimensions, 
    SafeAreaView, StatusBar, useWindowDimensions
} from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { COLORS, SHADOWS } from '../../constants/theme';
import { useApp } from '../../context/AppContext';
import { Card } from '../../components/shared/CommonUI';
import WorkerHeader from '../../components/WorkerHeader';
import { scale, verticalScale, moderateScale, isTablet } from '../../utils/responsive';

const WorkerTasksScreen = ({ navigation }) => {
    const { tasks, metrics, refreshData, user, updateTask } = useApp();
    const { width, height } = useWindowDimensions();
    const [search, setSearch] = useState('');
    const fadeAnim = useRef(new Animated.Value(0)).current;

    const workerMetrics = metrics?.workerMetrics || {};
    const assignedTasks = workerMetrics.assignedTasks || [];

    useEffect(() => {
        const unsubscribe = navigation.addListener('focus', () => { refreshData(); });
        Animated.timing(fadeAnim, { toValue: 1, duration: 600, useNativeDriver: true }).start();
        return unsubscribe;
    }, [navigation]);

    const displayTasks = (assignedTasks.length > 0 ? assignedTasks : (tasks || [])).filter(t => {
        const isAssignedToMe = (Array.isArray(t.assignedTo) && t.assignedTo.some(a => (a._id || a) === user?._id)) ||
            (t.assignedTo === user?._id || (typeof t.assignedTo === 'string' && t.assignedTo === user?.fullName));
        if (assignedTasks.length === 0 && !isAssignedToMe) return false;
        const matchesSearch = t.title?.toLowerCase().includes(search.toLowerCase()) || 
                             t.projectId?.name?.toLowerCase().includes(search.toLowerCase());
        return matchesSearch;
    });

    const overdueCount = displayTasks.filter(t => {
        if (!t.dueDate || t.status === 'completed' || t.status === 'done') return false;
        return new Date(t.dueDate) < new Date();
    }).length;
    const activeCount = displayTasks.filter(t => t.status === 'active' || t.status === 'in_progress').length;
    const doneCount = displayTasks.filter(t => t.status === 'completed' || t.status === 'done').length;

    const renderTaskItem = ({ item }) => {
        const realTaskId = item._id || item.id || item.taskId?._id || (typeof item.taskId === 'string' ? item.taskId : null);
        const isCompleted = ['completed', 'complete', 'done'].includes((item.status || '').toLowerCase());
        const progress = item.progress !== undefined ? item.progress : (isCompleted ? 100 : (item.status === 'active' || item.status === 'in_progress' ? 40 : 0));
        const priority = (item.priority || 'Medium').toLowerCase();
        const priorityColor = priority === 'high' ? '#EF4444' : (priority === 'medium' ? '#F97316' : '#2563EB');
        const projectTitle = item.projectId?.name || item.projectName || 'Main Site';
        const role = item.assignedRoleType || 'Worker';

        return (
            <Card style={[styles.taskCard, { padding: moderateScale(16), borderRadius: moderateScale(20) }]} onPress={() => navigation.navigate('TaskDetail', { taskId: realTaskId })}>
                <View style={styles.cardHeader}>
                    <View style={{ flex: 1 }}>
                        <Text style={[styles.taskTitle, { fontSize: moderateScale(16) }]}>{item.title}</Text>
                        <View style={styles.inlineProgressContainer}>
                            <View style={[styles.inlineProgressBarBg, { height: verticalScale(4), maxWidth: scale(120), borderRadius: moderateScale(2) }]}>
                                <View style={[styles.inlineProgressBarFill, { width: `${progress}%` }]} />
                            </View>
                            <Text style={[styles.inlineProgressText, { fontSize: moderateScale(10) }]}>{progress}%</Text>
                        </View>
                    </View>
                    <View style={[styles.statusBadge, { backgroundColor: isCompleted ? '#ECFDF5' : '#EFF6FF', paddingHorizontal: scale(10), paddingVertical: verticalScale(5), borderRadius: moderateScale(8) }]}>
                        <Text style={[styles.statusBadgeText, { color: isCompleted ? '#10B981' : '#2563EB', fontSize: moderateScale(10) }]}>
                            {(item.status || 'TODO').toUpperCase()}
                        </Text>
                    </View>
                </View>

                <View style={[styles.cardDetails, { padding: moderateScale(12), borderRadius: moderateScale(12) }]}>
                    <View style={styles.detailRow}>
                        <View style={styles.detailItem}>
                            <Text style={[styles.detailLabel, { fontSize: moderateScale(8) }]}>PROJECT</Text>
                            <Text style={[styles.detailValue, { fontSize: moderateScale(12) }]} numberOfLines={1}>{projectTitle}</Text>
                        </View>
                        <View style={styles.detailItem}>
                            <Text style={[styles.detailLabel, { fontSize: moderateScale(8) }]}>ROLE</Text>
                            <Text style={[styles.detailValue, { fontSize: moderateScale(12) }]}>{role}</Text>
                        </View>
                    </View>
                    <View style={[styles.detailRow, { marginTop: verticalScale(12) }]}>
                        <View style={styles.detailItem}>
                            <Text style={[styles.detailLabel, { fontSize: moderateScale(8) }]}>PRIORITY</Text>
                            <Text style={[styles.detailValue, { color: priorityColor, fontWeight: '900', fontSize: moderateScale(12) }]}>
                                {priority.toUpperCase()}
                            </Text>
                        </View>
                        <View style={styles.detailItem}>
                            <Text style={[styles.detailLabel, { fontSize: moderateScale(8) }]}>TIMELINE</Text>
                            <Text style={[styles.detailValue, { fontSize: moderateScale(12) }]}>
                                {item.startDate ? new Date(item.startDate).toLocaleDateString('en-US', { month: 'numeric', day: 'numeric' }) : 'ASAP'} - {item.dueDate ? new Date(item.dueDate).toLocaleDateString('en-US', { month: 'numeric', day: 'numeric' }) : 'ASAP'}
                            </Text>
                        </View>
                    </View>
                </View>
                
                <TouchableOpacity style={[styles.actionBtn, { paddingVertical: verticalScale(10), marginTop: verticalScale(4) }]} onPress={() => navigation.navigate('TaskDetail', { taskId: realTaskId })}>
                    <MaterialCommunityIcons name="eye-outline" size={moderateScale(16)} color="#64748B" />
                    <Text style={[styles.actionBtnText, { fontSize: moderateScale(11) }]}>VIEW DETAILS</Text>
                </TouchableOpacity>
            </Card>
        );
    };

    return (
        <SafeAreaView style={styles.container}>
            <StatusBar barStyle="dark-content" backgroundColor="#FFFFFF" />
            <WorkerHeader showBranding={true} title="Tasks" />

            <View style={[styles.content, { paddingHorizontal: isTablet ? '8%' : 0 }]}>
                {/* Search Bar */}
                <View style={[styles.searchSection, { paddingHorizontal: scale(16), marginTop: verticalScale(20), marginBottom: verticalScale(8) }]}>
                    <View style={[styles.searchBox, { height: verticalScale(48), borderRadius: moderateScale(14), paddingHorizontal: scale(15) }]}>
                        <MaterialCommunityIcons name="magnify" size={moderateScale(20)} color="#94A3B8" />
                        <TextInput
                            style={[styles.searchInput, { fontSize: moderateScale(13) }]}
                            placeholder="Search tasks, projects..."
                            value={search}
                            onChangeText={setSearch}
                            placeholderTextColor="#94A3B8"
                        />
                    </View>
                </View>

                <Animated.View style={{ flex: 1, opacity: fadeAnim }}>
                    <FlatList
                        data={displayTasks}
                        keyExtractor={item => item._id || item.id}
                        renderItem={renderTaskItem}
                        contentContainerStyle={[styles.listContainer, { padding: scale(16), paddingBottom: verticalScale(100) }]}
                        showsVerticalScrollIndicator={false}
                        ListEmptyComponent={
                            <View style={styles.emptyState}>
                                <MaterialCommunityIcons name="clipboard-text-outline" size={moderateScale(60)} color="#E2E8F0" />
                                <Text style={[styles.emptyText, { fontSize: moderateScale(14) }]}>No tasks found</Text>
                            </View>
                        }
                    />
                </Animated.View>
            </View>
        </SafeAreaView>
    );
};

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: '#F8FAFC' },
    content: { flex: 1 },
    titleSection: { },
    mainTitle: { fontWeight: '900', color: '#0F172A', letterSpacing: -0.5 },
    subtitleRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 2 },
    subtitleText: { fontWeight: '900', color: '#94A3B8', letterSpacing: 0.5 },
    statsRow: { flexDirection: 'row' },
    statBadge: { flex: 1, flexDirection: 'row', alignItems: 'center', paddingVertical: 10, gap: 4, justifyContent: 'center' },
    statDot: { },
    statText: { fontWeight: '900' },
    searchSection: { },
    searchBox: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: '#E2E8F0' },
    searchInput: { flex: 1, marginLeft: 10, fontWeight: '600', color: '#1E293B' },
    listContainer: { },
    taskCard: { backgroundColor: '#FFFFFF', marginBottom: 16, borderWidth: 1, borderColor: '#F1F5F9', ...SHADOWS.small },
    cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 16 },
    taskTitle: { fontWeight: '900', color: '#0F172A', marginBottom: 8 },
    inlineProgressContainer: { flexDirection: 'row', alignItems: 'center', gap: 10 },
    inlineProgressBarBg: { flex: 1, backgroundColor: '#F1F5F9', overflow: 'hidden' },
    inlineProgressBarFill: { height: '100%', backgroundColor: '#2563EB' },
    inlineProgressText: { fontWeight: '800', color: '#94A3B8' },
    statusBadge: { },
    statusBadgeText: { fontWeight: '900' },
    cardDetails: { backgroundColor: '#F8FAFC', marginBottom: 16 },
    detailRow: { flexDirection: 'row', justifyContent: 'space-between' },
    detailItem: { flex: 1 },
    detailLabel: { fontWeight: '900', color: '#94A3B8', letterSpacing: 0.5, marginBottom: 2 },
    detailValue: { fontWeight: '700', color: '#334155' },
    actionBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, borderTopWidth: 1, borderTopColor: '#F1F5F9' },
    actionBtnText: { fontWeight: '900', color: '#64748B', letterSpacing: 0.5 },
    emptyState: { alignItems: 'center', marginTop: 60 },
    emptyText: { marginTop: 12, color: '#94A3B8', fontWeight: '700' },
});

export default WorkerTasksScreen;
