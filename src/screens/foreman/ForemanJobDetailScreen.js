import React, { useState, useEffect, useRef } from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity, TextInput, Animated, StatusBar, ActivityIndicator, Dimensions, RefreshControl, ScrollView, Platform, useWindowDimensions, Alert } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import * as DocumentPicker from 'expo-document-picker';
import { COLORS, SHADOWS } from '../../constants/theme';
import WorkerHeader from '../../components/WorkerHeader';
import { useApp } from '../../context/AppContext';
import { scale, verticalScale, moderateScale, isTablet } from '../../utils/responsive';

const ForemanJobDetailScreen = ({ navigation, route }) => {
    const { jobId } = route.params || {};
    const { jobs, tasks, refreshData, user } = useApp();
    const { width } = useWindowDimensions();
    const [search, setSearch] = useState('');
    const [activeTab, setActiveTab] = useState('TASKS');
    const [refreshing, setRefreshing] = useState(false);
    const fadeAnim = useRef(new Animated.Value(0)).current;

    const job = (jobs || []).find(j => (j._id || j.id) === jobId) || {};
    const jobTasks = (tasks || []).filter(t => 
        (t.jobId?._id || t.jobId) === jobId || 
        (t.projectId?._id || t.projectId) === (job.projectId?._id || job.projectId)
    );

    const filteredTasks = jobTasks.filter(t => 
        (t.title || '').toLowerCase().includes(search.toLowerCase()) ||
        (t.description || '').toLowerCase().includes(search.toLowerCase())
    );

    useEffect(() => {
        const unsubscribe = navigation.addListener('focus', () => {
            refreshData();
        });
        Animated.timing(fadeAnim, { toValue: 1, duration: 600, useNativeDriver: true }).start();
        return unsubscribe;
    }, [navigation]);

    const onRefresh = async () => {
        setRefreshing(true);
        await refreshData();
        setRefreshing(false);
    };

    const stats = {
        progress: job.progress || 0,
        completedTasks: jobTasks.filter(t => ['completed', 'done'].includes((t.status || '').toLowerCase())).length,
        totalTasks: jobTasks.length,
    };

    const handleImport = async () => {
        try {
            const result = await DocumentPicker.getDocumentAsync({
                type: ['application/json', 'text/comma-separated-values', 'text/csv'],
                copyToCacheDirectory: true
            });
            
            if (!result.canceled && result.assets && result.assets.length > 0) {
                const file = result.assets[0];
                Alert.alert(
                    'Import Tasks', 
                    `File "${file.name}" selected. Do you want to import tasks to this site?`,
                    [
                        { text: 'Cancel', style: 'cancel' },
                        { 
                            text: 'Import', 
                            onPress: async () => {
                                // Simulate processing
                                Alert.alert('Processing', 'Connecting to server to parse and import data...');
                                // In a real app, we would send this file to the backend or parse it locally
                                // and call addTask() in a loop.
                            } 
                        }
                    ]
                );
            }
        } catch (e) {
            console.error('Import error:', e);
            Alert.alert('Error', 'Failed to pick file for import.');
        }
    };

    const renderTaskRow = ({ item }) => {
        const isDone = ['completed', 'done'].includes((item.status || '').toLowerCase());
        const priority = (item.priority || 'Medium').toLowerCase();
        
        return (
            <TouchableOpacity 
                style={[styles.taskRow, { paddingHorizontal: scale(16), paddingVertical: verticalScale(12) }]}
                onPress={() => navigation.navigate('TaskDetail', { taskId: item._id || item.id })}
                activeOpacity={0.7}
            >
                <View style={styles.statusCol}>
                    <View style={[styles.checkbox, isDone && styles.checkboxChecked, { width: scale(20), height: scale(20), borderRadius: moderateScale(5) }]}>
                        {isDone && <MaterialCommunityIcons name="check" size={moderateScale(14)} color="#fff" />}
                    </View>
                </View>

                <View style={styles.detailsCol}>
                    <View style={styles.titleLine}>
                        <MaterialCommunityIcons name="chevron-right" size={moderateScale(16)} color="#CBD5E1" style={{ marginRight: scale(4) }} />
                        <Text style={[styles.taskTitle, { fontSize: moderateScale(14) }]} numberOfLines={1}>{item.title}</Text>
                    </View>
                    {item.description ? (
                        <Text style={[styles.taskSub, { fontSize: moderateScale(10), marginLeft: scale(20) }]} numberOfLines={1}>{item.description}</Text>
                    ) : null}
                </View>

                <View style={[styles.assignedCol, { gap: scale(6) }]}>
                    <View style={[styles.userCircle, { width: scale(22), height: scale(22), borderRadius: scale(11) }]}>
                        <Text style={[styles.userInitial, { fontSize: moderateScale(10) }]}>
                            {(item.assignedTo?.[0]?.fullName || 'U')[0]}
                        </Text>
                    </View>
                    <Text style={[styles.assignedName, { fontSize: moderateScale(11) }]} numberOfLines={1}>
                        {item.assignedTo?.[0]?.fullName?.split(' ')[0] || 'Unassigned'}
                    </Text>
                </View>

                <View style={styles.priorityCol}>
                    <View style={[styles.priorityTag, { backgroundColor: priority === 'high' ? '#FEF2F2' : '#F1F5F9', paddingHorizontal: scale(8), paddingVertical: verticalScale(4), borderRadius: moderateScale(6) }]}>
                        <Text style={[styles.priorityText, { color: priority === 'high' ? '#EF4444' : '#64748B', fontSize: moderateScale(8.5) }]}>
                            {priority.toUpperCase()}
                        </Text>
                    </View>
                </View>
            </TouchableOpacity>
        );
    };

    const ListHeader = () => (
        <View style={styles.header}>
            <TouchableOpacity 
                style={[styles.backBtn, { padding: scale(16), gap: scale(8) }]}
                onPress={() => navigation.goBack()}
            >
                <MaterialCommunityIcons name="arrow-left" size={moderateScale(20)} color="#2563EB" />
                <Text style={[styles.backTxt, { fontSize: moderateScale(12) }]}>BACK TO MY JOBS</Text>
            </TouchableOpacity>

            <View style={[styles.jobHeading, { paddingHorizontal: scale(20), marginBottom: verticalScale(20) }]}>
                <View style={[styles.titleRow, { gap: scale(10) }]}>
                    <Text style={[styles.jobName, { fontSize: moderateScale(24) }]} numberOfLines={1}>{job.name || job.title || 'Job Details'}</Text>
                    <View style={[styles.badge, { paddingHorizontal: scale(10), paddingVertical: verticalScale(4), borderRadius: moderateScale(12) }]}>
                        <Text style={[styles.badgeText, { fontSize: moderateScale(8.5) }]}>{(job.status || 'PLANNING').toUpperCase()}</Text>
                    </View>
                </View>
                <View style={[styles.metaLine, { marginTop: verticalScale(8), gap: scale(12) }]}>
                    <View style={[styles.metaItem, { gap: scale(4) }]}>
                        <MaterialCommunityIcons name="map-marker-outline" size={moderateScale(14)} color="#64748B" />
                        <Text style={[styles.metaText, { fontSize: moderateScale(12) }]}>{job.location || 'Site Location'}</Text>
                    </View>
                    <View style={[styles.separator, { width: scale(4), height: scale(4) }]} />
                    <View style={[styles.metaItem, { gap: scale(4) }]}>
                        <MaterialCommunityIcons name="chart-donut" size={moderateScale(14)} color="#2563EB" />
                        <Text style={[styles.metaText, { color: '#2563EB', fontSize: moderateScale(12) }]}>{stats.progress}% Progress</Text>
                    </View>
                    {!isTablet && <View style={[styles.separator, { width: scale(4), height: scale(4) }]} />}
                    <View style={[styles.metaItem, { gap: scale(4) }]}>
                        <MaterialCommunityIcons name="format-list-checks" size={moderateScale(14)} color="#059669" />
                        <Text style={[styles.metaText, { color: '#059669', fontSize: moderateScale(12) }]}>{stats.completedTasks}/{stats.totalTasks} Done</Text>
                    </View>
                </View>
            </View>

            <View style={[styles.tabContainer, { paddingHorizontal: scale(20), gap: scale(24) }]}>
                {['TASKS', 'HISTORY', 'NOTES'].map(tab => (
                    <TouchableOpacity 
                        key={tab} 
                        onPress={() => setActiveTab(tab)}
                        style={[styles.tab, activeTab === tab && styles.tabActive, { paddingVertical: verticalScale(12) }]}
                    >
                        <Text style={[styles.tabLabel, activeTab === tab && styles.tabLabelActive, { fontSize: moderateScale(13) }]}>{tab}</Text>
                    </TouchableOpacity>
                ))}
            </View>

            <View style={[styles.actionRow, { padding: scale(16), gap: scale(10) }]}>
                <View style={[styles.searchBox, { height: verticalScale(44), borderRadius: moderateScale(10), paddingHorizontal: scale(12) }]}>
                    <MaterialCommunityIcons name="magnify" size={moderateScale(20)} color="#94A3B8" />
                    <TextInput 
                        style={[styles.input, { fontSize: moderateScale(14), marginLeft: scale(8) }]}
                        placeholder="Search tasks..."
                        value={search}
                        onChangeText={setSearch}
                    />
                </View>
                <TouchableOpacity style={[styles.filterBtn, { width: scale(44), height: scale(44), borderRadius: moderateScale(10) }]}>
                    <MaterialCommunityIcons name="tune-variant" size={moderateScale(20)} color="#2563EB" />
                </TouchableOpacity>
                <TouchableOpacity 
                    style={[styles.importBtn, { height: scale(44), paddingHorizontal: scale(16), borderRadius: moderateScale(10), gap: scale(8) }]}
                    onPress={handleImport}
                >
                    <MaterialCommunityIcons name="database-import-outline" size={moderateScale(20)} color="#fff" />
                    <Text style={[styles.importTxt, { fontSize: moderateScale(11) }]}>IMPORT</Text>
                </TouchableOpacity>
            </View>

            <View style={[styles.tableHeader, { paddingVertical: verticalScale(12), paddingHorizontal: scale(20) }]}>
                <Text style={[styles.th, { flex: 0.2, fontSize: moderateScale(9) }]}>STATUS</Text>
                <Text style={[styles.th, { flex: 0.4, fontSize: moderateScale(9) }]}>TASK DETAILS</Text>
                <Text style={[styles.th, { flex: 0.25, fontSize: moderateScale(9) }]}>ASSIGNED</Text>
                <Text style={[styles.th, { flex: 0.15, fontSize: moderateScale(9) }]}>PRIORITY</Text>
            </View>
        </View>
    );

    return (
        <View style={styles.container}>
            <StatusBar barStyle="dark-content" />
            <WorkerHeader title="Site Tasks" />

            <Animated.FlatList
                style={{ opacity: fadeAnim }}
                data={filteredTasks}
                keyExtractor={(item, index) => item._id ? `fjd-task-${item._id}-${index}` : `fjd-task-idx-${index}`}
                renderItem={renderTaskRow}
                ListHeaderComponent={ListHeader}
                showsVerticalScrollIndicator={false}
                contentContainerStyle={{ paddingBottom: verticalScale(100) }}
                refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
                ListEmptyComponent={
                    <View style={[styles.empty, { padding: scale(60) }]}>
                        <MaterialCommunityIcons name="clipboard-text-outline" size={moderateScale(50)} color="#CBD5E1" />
                        <Text style={[styles.emptyTxt, { fontSize: moderateScale(14), marginTop: verticalScale(12) }]}>No tasks found for this site.</Text>
                    </View>
                }
            />
        </View>
    );
};

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: '#fff' },
    header: { paddingBottom: 10 },
    backBtn: { flexDirection: 'row', alignItems: 'center' },
    backTxt: { fontWeight: '900', color: '#2563EB' },
    jobHeading: { },
    titleRow: { flexDirection: 'row', alignItems: 'center' },
    jobName: { fontWeight: '900', color: '#0F172A', flex: 1 },
    badge: { backgroundColor: '#F1F5F9' },
    badgeText: { fontWeight: '900', color: '#64748B' },
    metaLine: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap' },
    metaItem: { flexDirection: 'row', alignItems: 'center' },
    metaText: { fontWeight: '800', color: '#64748B' },
    separator: { borderRadius: 2, backgroundColor: '#CBD5E1' },
    tabContainer: { flexDirection: 'row', borderBottomWidth: 1, borderBottomColor: '#F1F5F9' },
    tab: { borderBottomWidth: 2, borderBottomColor: 'transparent' },
    tabActive: { borderBottomColor: '#2563EB' },
    tabLabel: { fontWeight: '900', color: '#94A3B8' },
    tabLabelActive: { color: '#2563EB' },
    actionRow: { flexDirection: 'row', alignItems: 'center' },
    searchBox: { flex: 1, flexDirection: 'row', alignItems: 'center', backgroundColor: '#F8FAFC', borderWidth: 1, borderColor: '#E2E8F0' },
    input: { flex: 1, fontWeight: '600', color: '#1E293B' },
    filterBtn: { backgroundColor: '#EFF6FF', alignItems: 'center', justifyContent: 'center' },
    importBtn: { backgroundColor: '#2563EB', flexDirection: 'row', alignItems: 'center' },
    importTxt: { color: '#fff', fontWeight: '900' },
    tableHeader: { flexDirection: 'row', backgroundColor: '#F8FAFC', borderBottomWidth: 1, borderBottomColor: '#F1F5F9' },
    th: { fontWeight: '900', color: '#94A3B8', letterSpacing: 0.5 },
    taskRow: { flexDirection: 'row', borderBottomWidth: 1, borderBottomColor: '#F8FAFC', alignItems: 'center' },
    statusCol: { flex: 0.2 },
    checkbox: { borderWidth: 2, borderColor: '#E2E8F0', alignItems: 'center', justifyContent: 'center' },
    checkboxChecked: { backgroundColor: '#059669', borderColor: '#059669' },
    detailsCol: { flex: 0.4, paddingRight: 4 },
    titleLine: { flexDirection: 'row', alignItems: 'center' },
    taskTitle: { fontWeight: '800', color: '#1E293B' },
    taskSub: { color: '#94A3B8', fontWeight: '600', marginTop: 2 },
    assignedCol: { flex: 0.25, flexDirection: 'row', alignItems: 'center' },
    userCircle: { backgroundColor: '#F1F5F9', alignItems: 'center', justifyContent: 'center' },
    userInitial: { fontWeight: '900', color: '#64748B' },
    assignedName: { fontWeight: '700', color: '#475569' },
    priorityCol: { flex: 0.15 },
    priorityTag: { alignSelf: 'flex-start' },
    priorityText: { fontWeight: '900' },
    empty: { alignItems: 'center' },
    emptyTxt: { fontWeight: '700', color: '#94A3B8' }
});

export default ForemanJobDetailScreen;
