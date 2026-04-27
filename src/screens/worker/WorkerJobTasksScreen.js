import React, { useState, useEffect, useRef } from 'react';
import { 
    View, Text, StyleSheet, FlatList, TouchableOpacity, 
    TextInput, Animated, ActivityIndicator, Dimensions, 
    SafeAreaView, StatusBar 
} from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { COLORS, SHADOWS } from '../../constants/theme';
import { useApp } from '../../context/AppContext';
import { Card } from '../../components/shared/CommonUI';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { scale, verticalScale, moderateScale, isTablet } from '../../utils/responsive';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

const WorkerJobTasksScreen = ({ navigation, route }) => {
    const { jobId } = route.params || {};
    const { tasks, jobs, refreshData, user, updateTask } = useApp();
    const insets = useSafeAreaInsets();
    const [search, setSearch] = useState('');
    const fadeAnim = useRef(new Animated.Value(0)).current;

    const currentJob = jobs.find(j => (j._id || j.id) === jobId) || {};

    useEffect(() => {
        const unsubscribe = navigation.addListener('focus', () => {
            refreshData();
        });
        Animated.timing(fadeAnim, { toValue: 1, duration: 600, useNativeDriver: true }).start();
        return unsubscribe;
    }, [navigation]);

    const jobTasks = (tasks || []).filter(t => {
        const isAssigned = (Array.isArray(t.assignedTo) && t.assignedTo.some(a => (a._id || a) === user?._id)) ||
            (t.assignedTo === user?._id || t.assignedTo === user?.fullName);
        const matchesJob = !jobId || (t.projectId?._id || t.projectId) === (currentJob.projectId?._id || currentJob.projectId);
        const matchesSearch = t.title?.toLowerCase().includes(search.toLowerCase());
        return isAssigned && matchesJob && matchesSearch;
    });

    // Stats as per software screenshot
    const overdueCount = jobTasks.filter(t => {
        if (!t.dueDate || t.status === 'completed') return false;
        return new Date(t.dueDate) < new Date();
    }).length;
    const activeCount = jobTasks.filter(t => t.status === 'active' || t.status === 'in_progress').length;
    const doneCount = jobTasks.filter(t => t.status === 'completed').length;

    const renderTaskItem = ({ item }) => {
        const progress = item.status === 'completed' ? 100 : (item.status === 'active' || item.status === 'in_progress' ? 40 : 0);
        const priorityColor = (item.priority || '').toLowerCase() === 'high' ? '#EF4444' : (item.priority || '').toLowerCase() === 'medium' ? '#F97316' : '#2563EB';

        return (
            <Card style={styles.taskCard} onPress={() => navigation.navigate('TaskDetail', { taskId: item._id || item.id })}>
                <View style={styles.cardHeader}>
                    <View style={{ flex: 1 }}>
                        <View style={styles.titleRow}>
                            <Text style={styles.taskTitle}>{item.title}</Text>
                        </View>
                        {/* Inline Progress Bar as per software */}
                        <View style={styles.inlineProgressContainer}>
                            <View style={styles.inlineProgressBarBg}>
                                <View style={[styles.inlineProgressBarFill, { width: `${progress}%` }]} />
                            </View>
                            <Text style={styles.inlineProgressText}>{progress}%</Text>
                        </View>
                    </View>

                    <View style={[styles.statusBadge, { backgroundColor: item.status === 'completed' ? '#ECFDF5' : '#EFF6FF' }]}>
                        <Text style={[styles.statusBadgeText, { color: item.status === 'completed' ? '#10B981' : '#2563EB' }]}>
                            {(item.status || 'TODO').toUpperCase()}
                        </Text>
                    </View>
                </View>

                <View style={styles.cardDetails}>
                    <View style={styles.detailRow}>
                        <View style={styles.detailItem}>
                            <Text style={styles.detailLabel}>PROJECT</Text>
                            <Text style={styles.detailValue} numberOfLines={1}>{currentJob.name || 'General Site'}</Text>
                        </View>
                        <View style={styles.detailItem}>
                            <Text style={styles.detailLabel}>ROLE</Text>
                            <Text style={styles.detailValue}>Worker</Text>
                        </View>
                    </View>

                    <View style={[styles.detailRow, { marginTop: 12 }]}>
                        <View style={styles.detailItem}>
                            <Text style={styles.detailLabel}>PRIORITY</Text>
                            <Text style={[styles.detailValue, { color: priorityColor, fontWeight: '900' }]}>
                                {(item.priority || 'LOW').toUpperCase()}
                            </Text>
                        </View>
                        <View style={styles.detailItem}>
                            <Text style={styles.detailLabel}>TIMELINE</Text>
                            <Text style={styles.detailValue}>
                                {item.startDate ? new Date(item.startDate).toLocaleDateString('en-US', { month: 'numeric', day: 'numeric' }) : 'ASAP'} - {item.dueDate ? new Date(item.dueDate).toLocaleDateString('en-US', { month: 'numeric', day: 'numeric' }) : 'ASAP'}
                            </Text>
                        </View>
                    </View>
                </View>
                
                <TouchableOpacity style={styles.actionBtn} onPress={() => navigation.navigate('TaskDetail', { taskId: item._id || item.id })}>
                    <MaterialCommunityIcons name="eye-outline" size={16} color="#64748B" />
                    <Text style={styles.actionBtnText}>VIEW DETAILS</Text>
                </TouchableOpacity>
            </Card>
        );
    };

    return (
        <View style={styles.container}>
            <StatusBar barStyle="dark-content" backgroundColor="#FFFFFF" />
            
            {/* Header with Back Button */}
            <View style={[styles.headerBar, { paddingTop: Math.max(insets.top, 20) }]}>
                <TouchableOpacity style={styles.backBtn} onPress={() => navigation.goBack()}>
                    <MaterialCommunityIcons name="arrow-left" size={24} color="#0F172A" />
                </TouchableOpacity>
                <View style={{ flex: 1, alignItems: 'center' }}>
                    <Text style={styles.headerTitle}>Tasks</Text>
                </View>
                <View style={{ width: 44 }} />
            </View>

            <View style={styles.content}>
                <View style={styles.headerInfoSection}>
                    <View style={styles.tabsSection}>
                        <View style={styles.tabItem}>
                            <MaterialCommunityIcons name="clipboard-text-outline" size={moderateScale(18)} color="#2563EB" />
                            <Text style={styles.tabText}>TASKS</Text>
                        </View>
                        <View style={styles.badgeCount}>
                            <Text style={styles.badgeText}>{jobTasks.length}</Text>
                        </View>
                    </View>

                    <View style={styles.taskSearch}>
                        <MaterialCommunityIcons name="magnify" size={moderateScale(20)} color="#94A3B8" />
                        <TextInput
                            style={styles.searchInput}
                            placeholder="Search tasks..."
                            value={search}
                            onChangeText={setSearch}
                            placeholderTextColor="#94A3B8"
                        />
                    </View>
                </View>

                <Animated.FlatList
                    data={jobTasks}
                    keyExtractor={item => item._id || item.id}
                    renderItem={renderTaskItem}
                    contentContainerStyle={styles.listContainer}
                    showsVerticalScrollIndicator={false}
                    ListEmptyComponent={
                        <View style={styles.emptyState}>
                            <MaterialCommunityIcons name="clipboard-check-outline" size={60} color="#E2E8F0" />
                            <Text style={styles.emptyText}>No tasks found</Text>
                        </View>
                    }
                />
            </View>
        </View>
    );
};

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: '#F8FAFC' },
    headerBar: { 
        flexDirection: 'row', 
        alignItems: 'center', 
        paddingHorizontal: 16, 
        paddingBottom: 14, 
        backgroundColor: '#FFFFFF', 
        borderBottomWidth: 1, 
        borderBottomColor: '#F1F5F9' 
    },
    backBtn: { 
        width: 44, 
        height: 44, 
        borderRadius: 12, 
        backgroundColor: '#F8FAFC', 
        justifyContent: 'center', 
        alignItems: 'center' 
    },
    headerTitle: { 
        fontSize: 18, 
        fontWeight: '900', 
        color: '#0F172A', 
        letterSpacing: -0.3, 
    },
    subtitleRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4,
        marginTop: 1,
    },
    subtitleText: {
        fontSize: 8,
        fontWeight: '900',
        color: '#94A3B8',
        letterSpacing: 0.5,
    },
    headerInfoSection: {
        paddingHorizontal: 16,
        paddingTop: 16,
        paddingBottom: 12,
        backgroundColor: '#FFFFFF',
    },
    tabsSection: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: 16,
        gap: 8,
    },
    tabItem: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
    },
    tabText: {
        fontSize: 14,
        fontWeight: '900',
        color: '#0F172A',
        letterSpacing: 0.5,
    },
    badgeCount: {
        backgroundColor: '#EFF6FF',
        paddingHorizontal: 8,
        paddingVertical: 2,
        borderRadius: 6,
    },
    badgeText: {
        fontSize: 10,
        fontWeight: '900',
        color: '#2563EB',
    },
    taskSearch: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#F8FAFC',
        height: 48,
        borderRadius: 14,
        paddingHorizontal: 15,
        borderWidth: 1,
        borderColor: '#E2E8F0',
    },
    content: { flex: 1 },
    statsRow: {
        flexDirection: 'row',
        paddingHorizontal: 16,
        paddingTop: 16,
        gap: 8,
    },
    statBadge: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 10,
        paddingVertical: 6,
        borderRadius: 10,
        gap: 6,
    },
    statDot: {
        width: 6,
        height: 6,
        borderRadius: 3,
    },
    statText: {
        fontSize: 8,
        fontWeight: '900',
    },
    searchSection: {
        paddingHorizontal: 16,
        marginTop: 16,
        marginBottom: 8,
    },
    searchBox: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#FFFFFF',
        height: 48,
        borderRadius: 14,
        paddingHorizontal: 15,
        borderWidth: 1,
        borderColor: '#E2E8F0',
    },
    searchInput: {
        flex: 1,
        marginLeft: 10,
        fontSize: 13,
        fontWeight: '600',
        color: '#1E293B',
    },
    listContainer: {
        padding: 16,
        paddingBottom: 100,
    },
    taskCard: {
        backgroundColor: '#FFFFFF',
        borderRadius: 20,
        padding: 16,
        marginBottom: 16,
        borderWidth: 1,
        borderColor: '#F1F5F9',
        ...SHADOWS.small,
    },
    cardHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'flex-start',
        marginBottom: 16,
    },
    taskTitle: {
        fontSize: 16,
        fontWeight: '900',
        color: '#0F172A',
        marginBottom: 8,
    },
    inlineProgressContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 10,
    },
    inlineProgressBarBg: {
        width: 100,
        height: 4,
        backgroundColor: '#F1F5F9',
        borderRadius: 2,
        overflow: 'hidden',
    },
    inlineProgressBarFill: {
        height: '100%',
        backgroundColor: '#2563EB',
    },
    inlineProgressText: {
        fontSize: 10,
        fontWeight: '800',
        color: '#94A3B8',
    },
    statusBadge: {
        paddingHorizontal: 10,
        paddingVertical: 5,
        borderRadius: 8,
    },
    statusBadgeText: {
        fontSize: 9,
        fontWeight: '900',
    },
    cardDetails: {
        backgroundColor: '#F8FAFC',
        borderRadius: 12,
        padding: 12,
        marginBottom: 16,
    },
    detailRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
    },
    detailItem: {
        flex: 1,
    },
    detailLabel: {
        fontSize: 8,
        fontWeight: '900',
        color: '#94A3B8',
        letterSpacing: 0.5,
        marginBottom: 2,
    },
    detailValue: {
        fontSize: 12,
        fontWeight: '700',
        color: '#334155',
    },
    actionBtn: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 8,
        paddingVertical: 10,
        borderTopWidth: 1,
        borderTopColor: '#F1F5F9',
        marginTop: 4,
    },
    actionBtnText: {
        fontSize: 11,
        fontWeight: '900',
        color: '#64748B',
        letterSpacing: 0.5,
    },
    emptyState: { alignItems: 'center', marginTop: 60 },
    emptyText: { marginTop: 12, color: '#94A3B8', fontSize: 14, fontWeight: '700' },
});

export default WorkerJobTasksScreen;
