import React, { useState, useMemo } from 'react';
import { 
    View, Text, StyleSheet, ScrollView, TouchableOpacity, 
    TextInput, FlatList, StatusBar, ActivityIndicator, Dimensions 
} from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { COLORS, SHADOWS } from '../../constants/theme';
import { useApp } from '../../context/AppContext';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const isSmallDevice = SCREEN_WIDTH < 380;

const SubcontractorJobDetailsScreen = ({ route, navigation }) => {
    const insets = useSafeAreaInsets();
    const { job } = route.params;
    const { tasks, loading, projects } = useApp();
    const [activeTab, setActiveTab] = useState('TASKS');
    const [searchQuery, setSearchQuery] = useState('');

    const project = projects.find(p => (p._id || p.id) === job.projectId || (p._id || p.id) === job.projectId?._id);

    const jobTasks = useMemo(() => {
        return (tasks || []).filter(t => (t.jobId === job._id || t.jobId === job.id || t.job === job.name));
    }, [tasks, job]);

    const completedTasks = jobTasks.filter(t => t.status === 'completed').length;
    const assignedWorkers = job.assignedTo || [];

    const tabs = [
        { id: 'TASKS', icon: 'clipboard-check-outline' },
        { id: 'PURCHASE ORDERS', icon: 'cart-outline' },
        { id: 'HISTORY', icon: 'history' },
        { id: 'NOTES', icon: 'note-text-outline' }
    ];

    const renderTaskItem = ({ item }) => (
        <View style={styles.tableRow}>
            <View style={[styles.col, { flex: isSmallDevice ? 1.2 : 1.5 }]}>
                <View style={[styles.statusPill, { backgroundColor: item.status === 'completed' ? '#DCFCE7' : '#F1F5F9' }]}>
                    <Text style={[styles.statusText, { color: item.status === 'completed' ? '#16A34A' : '#64748B' }]}>
                        {(item.status || 'todo').substring(0, 4).toUpperCase()}
                    </Text>
                </View>
            </View>
            <View style={[styles.col, { flex: 3 }]}>
                <Text style={styles.taskTitle} numberOfLines={1}>{item.title}</Text>
            </View>
            <View style={[styles.col, { flex: 1.5, alignItems: 'center' }]}>
                <View style={styles.avatarMini}>
                    <Text style={styles.avatarTxt}>{(item.assignedTo?.[0]?.fullName || 'U').charAt(0)}</Text>
                </View>
            </View>
            <View style={[styles.col, { flex: 1.2, alignItems: 'flex-end' }]}>
                <Text style={[styles.priorityTxt, { color: item.priority === 'High' ? '#EF4444' : '#64748B' }]}>
                    {item.priority?.substring(0, 3) || 'Med'}
                </Text>
            </View>
        </View>
    );

    return (
        <View style={styles.container}>
            <StatusBar barStyle="dark-content" backgroundColor="#FFFFFF" />
            
            <View style={[styles.header, { paddingTop: insets.top + 10 }]}>
                <TouchableOpacity 
                    style={styles.backBtn} 
                    onPress={() => navigation.goBack()}
                    activeOpacity={0.7}
                >
                    <View style={styles.backCircle}>
                        <MaterialCommunityIcons name="chevron-left" size={24} color="#1E293B" />
                    </View>
                    <Text style={styles.backText}>BACK TO JOB ASSIGNMENTS</Text>
                </TouchableOpacity>

                <View style={[styles.titleRow, { flexWrap: 'wrap' }]}>
                    <Text style={styles.jobName}>{job.name}</Text>
                    <View style={styles.planBadge}>
                        <Text style={styles.planText}>{(job.status || 'PLANNING').toUpperCase()}</Text>
                    </View>
                </View>
                
                <View style={styles.locRow}>
                    <MaterialCommunityIcons name="map-marker-outline" size={14} color="#94A3B8" />
                    <Text style={styles.locText} numberOfLines={1}>{project?.name || 'No location set'}</Text>
                </View>
            </View>

            <ScrollView 
                showsVerticalScrollIndicator={false}
                contentContainerStyle={{ paddingBottom: 100 }}
            >
                {/* Responsive Metric Grid */}
                <View style={styles.metricsContainer}>
                    <View style={styles.metricRow}>
                        <View style={[styles.metricCard, SHADOWS.small, { backgroundColor: '#EFF6FF' }]}>
                            <View style={styles.mIconHeader}>
                                <Text style={styles.pChartText}>{job.progress || 0}%</Text>
                                <MaterialCommunityIcons name="chart-pie" size={isSmallDevice ? 14 : 16} color="#2563EB" />
                            </View>
                            <Text style={styles.mLabel}>PROGRESS</Text>
                            <Text style={styles.mVal}>{job.progress || 0}%</Text>
                        </View>

                        <View style={[styles.metricCard, SHADOWS.small, { backgroundColor: '#FFF7ED' }]}>
                            <View style={styles.mIconHeader}>
                                <MaterialCommunityIcons name="check-circle-outline" size={isSmallDevice ? 16 : 18} color="#EA580C" />
                                <Text style={styles.mValSmall}>{completedTasks}/{jobTasks.length}</Text>
                            </View>
                            <Text style={styles.mLabel}>TASKS</Text>
                            <Text style={styles.mVal}>Overview</Text>
                        </View>

                        <View style={[styles.metricCard, SHADOWS.small, { backgroundColor: '#F0FDF4' }]}>
                            <View style={styles.mIconHeader}>
                                <MaterialCommunityIcons name="account-group-outline" size={isSmallDevice ? 16 : 18} color="#10B981" />
                                <Text style={styles.mValSmall}>{assignedWorkers.length}</Text>
                            </View>
                            <Text style={styles.mLabel}>TEAM</Text>
                            <Text style={styles.mVal}>Staff</Text>
                        </View>
                    </View>
                </View>

                {/* Tab Bar */}
                <View style={[styles.tabContainer, SHADOWS.small]}>
                    {tabs.map(tab => (
                        <TouchableOpacity 
                            key={tab.id} 
                            style={[styles.tab, activeTab === tab.id && styles.tabActive]}
                            onPress={() => setActiveTab(tab.id)}
                        >
                            <MaterialCommunityIcons 
                                name={tab.icon} 
                                size={isSmallDevice ? 12 : 14} 
                                color={activeTab === tab.id ? '#2563EB' : '#94A3B8'} 
                            />
                            <Text style={[styles.tabText, activeTab === tab.id && styles.tabTextActive]} numberOfLines={1}>
                                {tab.id.split(' ')[0]}
                            </Text>
                        </TouchableOpacity>
                    ))}
                </View>

                {/* Task Toolbar */}
                <View style={styles.taskHeader}>
                    <View style={styles.searchBar}>
                        <MaterialCommunityIcons name="magnify" size={18} color="#94A3B8" />
                        <TextInput 
                            placeholder="Search jobs..." 
                            style={styles.searchInput}
                            value={searchQuery}
                            onChangeText={setSearchQuery}
                        />
                    </View>
                    
                    <View style={styles.filterRow}>
                        <TouchableOpacity style={styles.filterBtn}>
                            <MaterialCommunityIcons name="tune-variant" size={12} color="#475569" />
                            <Text style={styles.filterBtnTxt}>FILTER</Text>
                        </TouchableOpacity>
                        <TouchableOpacity style={styles.filterBtn}>
                            <Text style={styles.filterBtnTxt}>PRIO</Text>
                        </TouchableOpacity>
                    </View>
                </View>

                {/* High-Fidelity Table Header */}
                <View style={styles.tableHeader}>
                    <Text style={[styles.tableHeadTxt, { flex: isSmallDevice ? 1.2 : 1.5 }]}>STATUS</Text>
                    <Text style={[styles.tableHeadTxt, { flex: 3 }]}>TASKS</Text>
                    <Text style={[styles.tableHeadTxt, { flex: 1.5, textAlign: 'center' }]}>TEAM</Text>
                    <Text style={[styles.tableHeadTxt, { flex: 1.2, textAlign: 'right' }]}>PRIO</Text>
                </View>

                {/* Task List */}
                <FlatList
                    data={jobTasks}
                    keyExtractor={item => item._id || item.id}
                    renderItem={renderTaskItem}
                    scrollEnabled={false}
                    ListEmptyComponent={
                        <View style={styles.empty}>
                            <Text style={styles.emptyText}>No active tasks found.</Text>
                        </View>
                    }
                />
            </ScrollView>
        </View>
    );
};

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: '#F8FAFC' },
    header: { padding: 16, backgroundColor: '#FFFFFF', paddingBottom: 12 },
    backBtn: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 12 },
    backCircle: { 
        width: 36, 
        height: 36, 
        borderRadius: 18, 
        backgroundColor: '#F1F5F9', 
        justifyContent: 'center', 
        alignItems: 'center' 
    },
    backText: { fontSize: 9, fontWeight: '900', color: '#64748B', letterSpacing: 0.8 },
    titleRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 4 },
    jobName: { fontSize: isSmallDevice ? 18 : 22, fontWeight: '900', color: '#0F172A', letterSpacing: -1 },
    planBadge: { paddingHorizontal: 10, paddingVertical: 4, backgroundColor: '#F1F5F9', borderRadius: 20 },
    planText: { fontSize: 8, fontWeight: '900', color: '#64748B', letterSpacing: 1 },
    locRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
    locText: { fontSize: 12, fontWeight: '700', color: '#64748B', flex: 1 },

    metricsContainer: { paddingHorizontal: 16, marginTop: 10 },
    metricRow: { flexDirection: 'row', gap: isSmallDevice ? 6 : 8 },
    metricCard: { flex: 1, padding: isSmallDevice ? 10 : 12, borderRadius: 20, justifyContent: 'space-between', height: isSmallDevice ? 85 : 95 },
    mIconHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
    pChartText: { fontSize: isSmallDevice ? 10 : 12, fontWeight: '900', color: '#2563EB' },
    mLabel: { fontSize: 8, fontWeight: '900', color: '#64748B', letterSpacing: 0.5, marginTop: 8 },
    mVal: { fontSize: isSmallDevice ? 11 : 12, fontWeight: '900', color: '#0F172A' },
    mValSmall: { fontSize: 10, fontWeight: '900', color: '#475569' },

    tabContainer: { marginHorizontal: 16, marginVertical: 12, backgroundColor: '#FFFFFF', borderRadius: 16, flexDirection: 'row', padding: 4, justifyContent: 'space-between' },
    tab: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 2, paddingVertical: 8, borderRadius: 12, justifyContent: 'center' },
    tabActive: { backgroundColor: '#F1F5F9' },
    tabText: { fontSize: isSmallDevice ? 7 : 8, fontWeight: '900', color: '#94A3B8' },
    tabTextActive: { color: '#2563EB' },

    taskHeader: { paddingHorizontal: 16, gap: 10, marginBottom: 12 },
    searchBar: { height: 44, backgroundColor: '#FFFFFF', borderRadius: 12, borderWidth: 1, borderColor: '#E2E8F0', flexDirection: 'row', alignItems: 'center', paddingHorizontal: 12 },
    searchInput: { flex: 1, marginLeft: 8, fontSize: 12, fontWeight: '600', color: '#0F172A' },
    filterRow: { flexDirection: 'row', justifyContent: 'flex-end', gap: 8 },
    filterBtn: { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: '#E2E8F0', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 8 },
    filterBtnTxt: { fontSize: 8, fontWeight: '900', color: '#475569' },

    tableHeader: { flexDirection: 'row', paddingHorizontal: 16, paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: '#F1F5F9' },
    tableHeadTxt: { fontSize: 8, fontWeight: '900', color: '#94A3B8', letterSpacing: 0.5 },
    tableRow: { flexDirection: 'row', paddingHorizontal: 16, paddingVertical: 14, backgroundColor: '#FFFFFF', borderBottomWidth: 1, borderBottomColor: '#F8FAFC', alignItems: 'center' },
    col: { justifyContent: 'center' },
    statusPill: { paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6 },
    statusText: { fontSize: 7, fontWeight: '900' },
    taskTitle: { fontSize: 12, fontWeight: '800', color: '#1E293B' },
    avatarMini: { width: 22, height: 22, borderRadius: 8, backgroundColor: '#F1F5F9', justifyContent: 'center', alignItems: 'center' },
    avatarTxt: { fontSize: 9, fontWeight: '900', color: '#64748B' },
    priorityTxt: { fontSize: 9, fontWeight: '900' },

    empty: { padding: 40, alignItems: 'center' },
    emptyText: { fontSize: 12, color: '#94A3B8', fontWeight: '700' }
});

export default SubcontractorJobDetailsScreen;
